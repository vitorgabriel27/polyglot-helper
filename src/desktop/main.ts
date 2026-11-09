import { createLoginStartup } from './login-startup';
import { positionWindows } from './window-position';
import { harden } from './window-security';
import {
  app,
  BrowserWindow,
  globalShortcut,
  ipcMain,
  Menu,
  nativeImage,
  screen,
  session,
  Tray,
} from 'electron';
import path from 'node:path';
import os from 'node:os';
import { pathToFileURL } from 'node:url';
import {
  CaptionPipeline,
  UtteranceSegmenter,
  type SpeechHandle,
  type SpeechStatus,
} from '../core/speech';
import { LocalSpeech } from '../adapters/speech/local';
import {
  TranslationPipeline,
  type TranslationHandle,
  type TranslationStatus,
} from '../core/translation';
import { LocalTranslation } from '../adapters/translation/local';
import { Session } from '../core/session';
import { CaptureManager, emptyMetrics, type AudioSource } from '../core/audio';
import { defaults } from '../core/preferences';
import {
  DESKTOP_EVENTS,
  isCommand,
  type Segment,
  type Snapshot,
  type UserSettings,
} from '../core/contracts';
import { startDemo } from '../adapters/demo';
import { platformAudio } from '../adapters/audio/platform';
import { SettingsStore } from './settings-store';
import { LinuxAutostart } from './autostart';

const isTest = process.argv.includes('--smoke-test');
const nativeWayland =
  process.argv.includes('--ozone-platform=wayland') || process.argv.includes('--wayland');
// XWayland implements the positioning/z-order contract this overlay needs on GNOME.
if (process.platform === 'linux') {
  if (nativeWayland) app.commandLine.appendSwitch('ozone-platform', 'wayland');
  else if (process.env.DISPLAY || process.argv.includes('--x11'))
    app.commandLine.appendSwitch('ozone-platform', 'x11');
}
if (process.platform === 'linux' && !process.argv.includes('--enable-gpu'))
  app.disableHardwareAcceleration();
app.setName('PolyglotHelper');
if (isTest && process.env.HELPER_TEST_PROFILE)
  app.setPath('userData', process.env.HELPER_TEST_PROFILE);
app.setAppUserModelId('com.polyglothelper.desktop');
const hasLock = app.requestSingleInstanceLock();
if (!hasLock) app.quit();
const controller = new Session();
const audio = platformAudio();
const capture = new CaptureManager(audio);
const localSpeech = new LocalSpeech(app.getAppPath());
const localTranslation = new LocalTranslation(app.getAppPath());
let translationPipeline: TranslationPipeline | undefined;
let wordLookupHandle: TranslationHandle | undefined;
let wordLookupAbort: AbortController | undefined;
let wordLookupQueue: Promise<void> = Promise.resolve();
let translationDraining: Promise<void> = Promise.resolve();
let translationStatus: TranslationStatus = {
  available: false,
  state: 'idle',
  error: null,
  decodeMs: null,
};
let speechHandle: SpeechHandle | undefined;
let speechAbort: AbortController | undefined;
let captionPipeline: CaptionPipeline | undefined;
let speechLoading: Promise<SpeechHandle> | undefined;
let speechDraining: Promise<void> = Promise.resolve();
let speechStatus: SpeechStatus = {
  available: false,
  state: 'idle',
  model: 'base.en',
  device: 'cpu',
  decodeMs: null,
  dropped: 0,
};
const store = new SettingsStore(app.getPath('userData'));
const configDirectory = isTest
  ? path.join(app.getPath('userData'), 'system-config')
  : process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
const launchArgs = app.isPackaged
  ? []
  : [process.platform === 'win32' ? `"${app.getAppPath()}"` : app.getAppPath()];
if (process.platform === 'linux') {
  launchArgs.push(`--ozone-platform=${nativeWayland || !process.env.DISPLAY ? 'wayland' : 'x11'}`);
  if (!process.argv.includes('--enable-gpu')) launchArgs.push('--disable-gpu');
}
const linuxAutostart = new LinuxAutostart(configDirectory, process.execPath, launchArgs);
const { loginEnabled, setLogin } = createLoginStartup(linuxAutostart, launchArgs, isTest);
let userSettings = defaults();
let notch: BrowserWindow;
let settingsWindow: BrowserWindow;
let tray: Tray | undefined;
let stopDemo: (() => void) | undefined;
let shortcutAvailable = false;
let notchHeight = 62;
let popoverPlacement: 'above' | 'below' = 'below';
let notchBaseHeight = 62;
let metrics = emptyMetrics();
let sources: AudioSource[] = [];
let sourcesLoading = false;
let sourceError: string | null = null;
let error: string | null = null;
let settingsQueue: Promise<void> = Promise.resolve();
let quitting = false;
let configuring = false;
let settingsRevision = 0;
let windowsReady = false;
let pendingActivation = false;
const html = path.join(__dirname, '../renderer/index.html');
const origin = pathToFileURL(html).href;
const wayland =
  process.platform === 'linux' &&
  (nativeWayland || !process.env.DISPLAY) &&
  process.env.XDG_SESSION_TYPE === 'wayland';

function snapshot(): Snapshot {
  return {
    state: controller.state,
    generation: controller.generation,
    segment: controller.segment,
    recentSegments: controller.recentSegments,
    preferences: userSettings.preferences,
    settings: userSettings,
    platform: process.platform,
    wayland,
    shortcutAvailable,
    mode: userSettings.sourceId ? 'local-audio' : 'simulation',
    audioSources: sources,
    sourcesLoading,
    settingsRevision,
    sourceError,
    metrics,
    error,
    speech: speechStatus,
    translation: translationStatus,
  };
}
function position(recenter = false) {
  positionWindows(
    {
      notch,
      settingsWindow,
      quitting,
      notchHeight,
      notchBaseHeight,
      state: controller.state,
      popoverPlacement,
    },
    recenter,
  );
}
function publish() {
  if (quitting || !notch || notch.isDestroyed()) return;
  position();
  for (const window of [notch, settingsWindow])
    if (window && !window.isDestroyed() && !window.webContents.isDestroyed())
      window.webContents.send(DESKTOP_EVENTS.state, snapshot());
}
function run(operation: Promise<void>) {
  void operation.catch((cause) => {
    error = cause instanceof Error ? cause.message : 'A operação falhou.';
    publish();
  });
}
function keepAbove() {
  if (quitting || !notch || notch.isDestroyed()) return;
  notch.setAlwaysOnTop(true, 'screen-saver');
  if (!settingsWindow || settingsWindow.isDestroyed() || !settingsWindow.isFocused())
    notch.moveTop();
}
function openSettings() {
  if (quitting) return;
  if (!windowsReady) {
    pendingActivation = true;
    return;
  }
  if (!notch || notch.isDestroyed() || !settingsWindow || settingsWindow.isDestroyed()) {
    app.quit();
    return;
  }
  settingsRevision += 1;
  position();
  settingsWindow.show();
  publish();
  void refreshSources();
}
async function refreshSources() {
  if (sourcesLoading) return;
  sourcesLoading = true;
  publish();
  try {
    sources = await audio.listSources();
    sourceError = null;
  } catch (cause) {
    sources = [];
    sourceError = cause instanceof Error ? cause.message : 'Não foi possível listar as fontes.';
  } finally {
    sourcesLoading = false;
    publish();
  }
}
function submitTranslation(segment: Segment) {
  if (!userSettings.preferences.translation || !userSettings.sourceId || quitting) return;
  if (!translationPipeline) {
    const generation = controller.generation;
    const pipeline = new TranslationPipeline(
      {
        start: async (signal, onFailure) => {
          await translationDraining;
          return localTranslation.start(signal, onFailure);
        },
      },
      (request, answer) => {
        if (
          translationPipeline !== pipeline ||
          generation !== controller.generation ||
          !userSettings.preferences.translation
        )
          return;
        if (controller.applyTranslation(request, answer.text)) {
          translationStatus = { ...translationStatus, decodeMs: answer.decodeMs };
          publish();
        }
      },
      (state, message) => {
        if (translationPipeline !== pipeline || generation !== controller.generation) return;
        translationStatus = {
          ...translationStatus,
          state,
          error: message || null,
          available:
            state === 'translating' || state === 'ready' ? true : translationStatus.available,
        };
        publish();
      },
    );
    translationPipeline = pipeline;
  }
  translationPipeline.submit(segment);
}
async function stopTranslation() {
  const pipeline = translationPipeline;
  translationPipeline = undefined;
  controller.clearTranslation();
  translationStatus = {
    ...translationStatus,
    state: userSettings.preferences.translation ? 'idle' : 'disabled',
    error: null,
  };
  if (pipeline) {
    const stopped = pipeline.stop();
    translationDraining = translationDraining.then(() => stopped);
  }
  await translationDraining;
}
function lookupWord(word: string): Promise<string> {
  let resolveResult!: (value: string) => void;
  let rejectResult!: (cause: Error) => void;
  const result = new Promise<string>((resolve, reject) => {
    resolveResult = resolve;
    rejectResult = reject;
  });
  wordLookupQueue = wordLookupQueue.then(async () => {
    try {
      if (!wordLookupHandle) {
        wordLookupAbort = new AbortController();
        wordLookupHandle = await localTranslation.start(wordLookupAbort.signal);
      }
      const translated = await wordLookupHandle.translate(word);
      resolveResult(translated.text);
    } catch (cause) {
      rejectResult(cause instanceof Error ? cause : new Error('Falha ao consultar a palavra.'));
    }
  });
  return result;
}
async function stopWordLookup() {
  wordLookupAbort?.abort();
  await wordLookupQueue;
  await wordLookupHandle?.stop();
  wordLookupHandle = undefined;
  wordLookupAbort = undefined;
}
async function stopSpeech() {
  captionPipeline?.stop();
  captionPipeline = undefined;
  speechAbort?.abort();
  speechAbort = undefined;
  const handle = speechHandle;
  speechHandle = undefined;
  const loading = speechLoading;
  speechLoading = undefined;
  speechDraining = speechDraining.then(async () => {
    if (handle) await handle.stop();
    else if (loading)
      await loading.then(
        (ready) => ready.stop(),
        () => {},
      );
  });
  await speechDraining;
  if (!speechAbort)
    speechStatus = { ...speechStatus, state: controller.state === 'error' ? 'error' : 'idle' };
}
function failSession(generation: number, message: string) {
  if (!controller.fail(generation)) return;
  error = message;
  metrics = { ...metrics, rms: 0, peak: 0 };
  speechStatus = { ...speechStatus, state: 'error' };
  publish();
  run(Promise.all([capture.stop(), stopSpeech(), stopTranslation()]).then(() => {}));
}
async function endCapture(pause = false) {
  stopDemo?.();
  stopDemo = undefined;
  if (pause) controller.pause();
  else controller.stop();
  metrics = { ...metrics, rms: 0, peak: 0 };
  publish();
  try {
    await Promise.all([capture.stop(), stopSpeech(), stopTranslation()]);
    if (!pause) controller.finishStop();
    publish();
  } catch {
    error = 'A captura não encerrou corretamente. Feche o aplicativo antes de retomar.';
    controller.fail(controller.generation);
    publish();
    throw new Error(error);
  }
}
async function toggle() {
  if (quitting || configuring) return;
  if (!userSettings.onboardingComplete) {
    openSettings();
    return;
  }
  if (['starting', 'listening', 'reconnecting'].includes(controller.state)) {
    await endCapture(true);
    return;
  }
  const generation = controller.start();
  error = null;
  metrics = emptyMetrics();
  publish();
  if (!userSettings.sourceId) {
    controller.ready(generation);
    stopDemo = startDemo(generation, (segment) => {
      if (controller.accept(segment)) publish();
    });
    publish();
    return;
  }
  const sourceId = userSettings.sourceId;
  const abort = new AbortController();
  speechAbort = abort;
  speechStatus = { ...speechStatus, state: 'loading', decodeMs: null, dropped: 0 };
  publish();
  try {
    await speechDraining;
    if (abort.signal.aborted || generation !== controller.generation) return;
    const loading = localSpeech.start(abort.signal, (message) => failSession(generation, message));
    speechLoading = loading;
    const handle = await loading;
    if (speechLoading === loading) speechLoading = undefined;
    if (abort.signal.aborted || generation !== controller.generation) {
      await handle.stop();
      return;
    }
    speechHandle = handle;
    speechStatus.available = true;
    captionPipeline = new CaptionPipeline(
      handle,
      (utterance, answer) => {
        if (generation !== controller.generation) return;
        speechStatus = { ...speechStatus, decodeMs: answer.decodeMs };
        const segment: Segment = {
          generation,
          segmentId: `${generation}:${utterance.sequence}`,
          sequence: utterance.sequence,
          startMs: utterance.startMs,
          endMs: utterance.endMs,
          revision: utterance.revision,
          isFinal: utterance.isFinal,
          text: answer.text,
          translation: '',
          pronunciation: '',
        };
        if (controller.accept(segment)) {
          publish();
          submitTranslation(segment);
        }
      },
      (message) => failSession(generation, message),
      (transcribing, dropped) => {
        if (generation !== controller.generation) return;
        speechStatus = {
          ...speechStatus,
          state: transcribing ? 'transcribing' : 'listening',
          dropped,
        };
        publish();
      },
    );
    const pipeline = captionPipeline;
    const activeSegmenter = new UtteranceSegmenter((utterance) => pipeline.submit(utterance));
    const started = await capture.start(
      sourceId,
      (next) => {
        if (generation === controller.generation) {
          metrics = next;
          publish();
        }
      },
      (message) => failSession(generation, message),
      (pcm) => {
        if (generation === controller.generation) activeSegmenter.push(pcm);
      },
    );
    if (started && controller.ready(generation)) {
      speechStatus = { ...speechStatus, state: 'listening' };
      publish();
    }
  } catch (cause) {
    if (!abort.signal.aborted && generation === controller.generation)
      failSession(
        generation,
        cause instanceof Error ? cause.message : 'O reconhecimento local não pôde iniciar.',
      );
  }
}

async function applySettings(next: UserSettings) {
  const previous = userSettings;
  if (next.sourceId && next.sourceId !== previous.sourceId) {
    if (!(await audio.listSources()).some((source) => source.id === next.sourceId))
      throw new Error('A fonte não está mais disponível. Atualize a lista.');
  }
  if (next.sourceId !== previous.sourceId) await endCapture();
  try {
    if (next.launchAtLogin !== previous.launchAtLogin || next.launchAtLogin)
      await setLogin(next.launchAtLogin);
    await store.save(next);
  } catch (cause) {
    try {
      await setLogin(previous.launchAtLogin);
    } catch {
      error = 'Falha ao salvar e restaurar a inicialização. Confira a configuração do sistema.';
      publish();
    }
    throw cause;
  }
  userSettings = structuredClone(next);
  error = null;
  if (previous.preferences.translation !== next.preferences.translation) {
    await stopTranslation();
    if (next.preferences.translation && controller.state === 'listening' && controller.segment)
      submitTranslation(controller.segment);
  }
  publish();
  if (!quitting && next.onboardingComplete && settingsWindow && !settingsWindow.isDestroyed())
    settingsWindow.hide();
}
async function configure(next: UserSettings) {
  configuring = true;
  try {
    await applySettings(next);
  } finally {
    configuring = false;
  }
}
function authorized(event: Electron.IpcMainInvokeEvent) {
  return (
    !quitting &&
    [notch, settingsWindow].some(
      (window) =>
        window &&
        !window.isDestroyed() &&
        !window.webContents.isDestroyed() &&
        event.sender === window.webContents,
    ) &&
    event.senderFrame === event.sender.mainFrame &&
    event.senderFrame.url.split('?')[0] === origin
  );
}

if (hasLock)
  app
    .whenReady()
    .then(async () => {
      speechStatus.available = await localSpeech.available();
      const loaded = await store.load();
      userSettings = loaded.settings;
      error = loaded.warning;
      translationStatus.available = await localTranslation.available();
      translationStatus.state = userSettings.preferences.translation ? 'idle' : 'disabled';
      try {
        userSettings.launchAtLogin = await loginEnabled();
      } catch {
        error = 'Não foi possível verificar a inicialização automática. Confira nas configurações.';
      }
      session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) =>
        callback(false),
      );
      session.defaultSession.setPermissionCheckHandler(() => false);
      session.defaultSession.webRequest.onBeforeRequest((details, callback) =>
        callback({
          cancel: !details.url.startsWith('file:') && !details.url.startsWith('devtools:'),
        }),
      );
      const options = {
        frame: false,
        transparent: true,
        alwaysOnTop: true,
        resizable: false,
        show: false,
        hasShadow: false,
        autoHideMenuBar: true,
        webPreferences: {
          preload: path.join(__dirname, 'preload.cjs'),
          nodeIntegration: false,
          contextIsolation: true,
          sandbox: true,
          webviewTag: false,
          devTools: !app.isPackaged,
        },
      };
      notch = new BrowserWindow({ ...options, width: 300, height: 62, title: 'PolyglotHelper' });
      settingsWindow = new BrowserWindow({
        ...options,
        width: 400,
        height: 620,
        title: 'PolyglotHelper — configurações',
        skipTaskbar: true,
      });
      harden(notch);
      harden(settingsWindow);
      notch.on('close', (event) => {
        if (!quitting) {
          event.preventDefault();
          app.quit();
        }
      });
      notch.on('closed', () => {
        windowsReady = false;
        if (!quitting) app.quit();
      });
      settingsWindow.on('close', (event) => {
        if (!quitting) {
          event.preventDefault();
          settingsWindow.hide();
          keepAbove();
        }
      });
      settingsWindow.on('closed', () => {
        windowsReady = false;
        if (!quitting) app.quit();
      });
      notch.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
      settingsWindow.setAlwaysOnTop(true, 'screen-saver');
      notch.on('blur', keepAbove);
      notch.on('always-on-top-changed', (_event, above) => {
        if (!above) keepAbove();
      });
      settingsWindow.on('blur', () => {
        if (quitting || settingsWindow.isDestroyed()) return;
        if (userSettings.onboardingComplete) settingsWindow.hide();
        keepAbove();
      });
      notch.webContents.on('render-process-gone', () => {
        void endCapture().finally(() => app.quit());
      });
      ipcMain.handle(DESKTOP_EVENTS.snapshot, (event) => {
        if (!authorized(event)) throw new Error('Origem inválida');
        return snapshot();
      });
      ipcMain.handle(DESKTOP_EVENTS.command, async (event, command: unknown) => {
        if (!authorized(event) || !isCommand(command)) throw new Error('Comando inválido');
        if (command.type === 'fit-notch' && event.sender !== notch.webContents)
          throw new Error('Origem inválida para resize');
        if (command.type === 'configure' && event.sender !== settingsWindow.webContents)
          throw new Error('Abra as configurações para salvar preferências.');
        switch (command.type) {
          case 'toggle-session':
            await toggle();
            break;
          case 'stop':
            await endCapture();
            break;
          case 'open-settings':
            openSettings();
            break;
          case 'close-settings':
            settingsWindow.hide();
            keepAbove();
            break;
          case 'refresh-sources':
            await refreshSources();
            break;
          case 'quit':
            app.quit();
            break;
          case 'fit-notch':
            notchHeight = command.height;
            notchBaseHeight = command.height;
            popoverPlacement = 'below';
            position();
            break;
          case 'fit-notch-popover':
            notchHeight = command.height;
            notchBaseHeight = command.baseHeight;
            popoverPlacement = command.placement;
            position();
            break;
          case 'lookup-word':
            return lookupWord(command.word);
          case 'configure':
            settingsQueue = settingsQueue.catch(() => {}).then(() => configure(command.value));
            await settingsQueue;
            break;
        }
      });
      await Promise.all([
        notch.loadFile(html),
        settingsWindow.loadFile(html, { query: { view: 'settings' } }),
      ]);
      if (quitting || notch.isDestroyed() || settingsWindow.isDestroyed()) return;
      windowsReady = true;
      shortcutAvailable =
        !isTest &&
        globalShortcut.register('CommandOrControl+Shift+Space', () => {
          run(toggle());
        });
      screen.on('display-removed', () => position(true));
      screen.on('display-metrics-changed', () => position(true));
      position(true);
      keepAbove();
      if (!isTest) {
        const icon = nativeImage.createFromPath(path.join(__dirname, '../../assets/tray.png'));
        tray = new Tray(icon);
        tray.setToolTip('PolyglotHelper');
        tray.setContextMenu(
          Menu.buildFromTemplate([
            {
              label: 'Pausar / retomar',
              click: () => {
                run(toggle());
              },
            },
            { label: 'Configurações', click: openSettings },
            {
              label: 'Parar captura',
              click: () => {
                run(endCapture());
              },
            },
            { label: 'Sair', click: () => app.quit() },
          ]),
        );
      }
      notch.showInactive();
      publish();
      if (pendingActivation || !userSettings.onboardingComplete) {
        pendingActivation = false;
        openSettings();
      } else void refreshSources();
    })
    .catch((cause) => {
      if (!quitting) {
        console.error(cause);
        app.exit(1);
      }
    });
app.on('second-instance', () => openSettings());
app.on('window-all-closed', () => app.quit());
app.on('before-quit', (event) => {
  if (quitting) return;
  event.preventDefault();
  quitting = true;
  windowsReady = false;
  pendingActivation = false;
  stopDemo?.();
  controller.stop();
  void Promise.allSettled([
    capture.stop(),
    stopSpeech(),
    stopTranslation(),
    stopWordLookup(),
    settingsQueue,
  ]).then(() => app.quit());
});
app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  tray?.destroy();
});
