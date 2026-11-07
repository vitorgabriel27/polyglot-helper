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
import { Session } from '../core/session';
import { CaptureManager, emptyMetrics, type AudioSource } from '../core/audio';
import { defaults } from '../core/preferences';
import { isCommand, type Snapshot, type UserSettings } from '../core/contracts';
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
let userSettings = defaults();
let notch: BrowserWindow;
let settingsWindow: BrowserWindow;
let tray: Tray | undefined;
let stopDemo: (() => void) | undefined;
let shortcutAvailable = false;
let notchHeight = 62;
let metrics = emptyMetrics();
let sources: AudioSource[] = [];
let sourcesLoading = false;
let sourceError: string | null = null;
let error: string | null = null;
let settingsQueue: Promise<void> = Promise.resolve();
let quitting = false;
let configuring = false;
let settingsRevision = 0;
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
  };
}
function position(recenter = false) {
  const old = notch.getBounds();
  const area = (recenter ? screen.getPrimaryDisplay() : screen.getDisplayMatching(old)).workArea;
  const expanded = ['listening', 'starting', 'error'].includes(controller.state);
  const width = Math.min(expanded ? 560 : 300, area.width);
  const center = recenter ? area.x + area.width / 2 : old.x + old.width / 2;
  const x = Math.max(area.x, Math.min(Math.round(center - width / 2), area.x + area.width - width));
  const y = recenter
    ? area.y + 10
    : Math.max(area.y, Math.min(old.y, area.y + area.height - notchHeight));
  if (old.width !== width || old.height !== notchHeight || recenter)
    notch.setBounds({ width, height: notchHeight, x, y });
  const panelWidth = Math.min(400, area.width);
  const panelHeight = Math.min(620, area.height - 16);
  const panel = {
    width: panelWidth,
    height: panelHeight,
    x: Math.max(
      area.x,
      Math.min(x + Math.round((width - panelWidth) / 2), area.x + area.width - panelWidth),
    ),
    y: Math.max(area.y, Math.min(y + notchHeight + 8, area.y + area.height - panelHeight)),
  };
  const previousPanel = settingsWindow.getBounds();
  if (
    Object.entries(panel).some(([key, value]) => previousPanel[key as keyof typeof panel] !== value)
  )
    settingsWindow.setBounds(panel);
}
function publish() {
  if (!notch || notch.isDestroyed()) return;
  position();
  for (const window of [notch, settingsWindow])
    if (!window.isDestroyed()) window.webContents.send('helper:state', snapshot());
}
function run(operation: Promise<void>) {
  void operation.catch((cause) => {
    error = cause instanceof Error ? cause.message : 'A operação falhou.';
    publish();
  });
}
function keepAbove() {
  if (!notch || notch.isDestroyed()) return;
  notch.setAlwaysOnTop(true, 'screen-saver');
  if (!settingsWindow.isFocused()) notch.moveTop();
}
function openSettings() {
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
  run(Promise.all([capture.stop(), stopSpeech()]).then(() => {}));
}
async function endCapture(pause = false) {
  stopDemo?.();
  stopDemo = undefined;
  if (pause) controller.pause();
  else controller.stop();
  metrics = { ...metrics, rms: 0, peak: 0 };
  publish();
  try {
    await Promise.all([capture.stop(), stopSpeech()]);
  } catch {
    error = 'A captura não encerrou corretamente. Feche o aplicativo antes de retomar.';
    controller.fail(controller.generation);
    publish();
    throw new Error(error);
  }
}
async function toggle() {
  if (configuring) return;
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
        controller.accept({
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
        });
        publish();
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

async function loginEnabled() {
  if (process.platform === 'linux') return linuxAutostart.enabled();
  if (process.platform === 'win32' && !isTest)
    return app.getLoginItemSettings({ path: process.execPath, args: launchArgs }).openAtLogin;
  return false;
}
async function setLogin(enabled: boolean) {
  if (process.platform === 'linux') await linuxAutostart.set(enabled);
  else if (process.platform === 'win32' && !isTest) {
    app.setLoginItemSettings({
      openAtLogin: enabled,
      enabled,
      name: 'PolyglotHelper',
      path: process.execPath,
      args: launchArgs,
    });
    if ((await loginEnabled()) !== enabled)
      throw new Error('O Windows não confirmou a configuração de inicialização.');
  } else if (enabled) throw new Error('Inicialização automática indisponível neste ambiente.');
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
  publish();
  if (next.onboardingComplete) settingsWindow.hide();
}
async function configure(next: UserSettings) {
  configuring = true;
  try {
    await applySettings(next);
  } finally {
    configuring = false;
  }
}
function harden(window: BrowserWindow) {
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event) => event.preventDefault());
  window.webContents.on('will-attach-webview', (event) => event.preventDefault());
}
function authorized(event: Electron.IpcMainInvokeEvent) {
  return (
    [notch, settingsWindow].some(
      (window) => !window.isDestroyed() && event.sender === window.webContents,
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
      notch.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
      settingsWindow.setAlwaysOnTop(true, 'screen-saver');
      notch.on('blur', keepAbove);
      notch.on('always-on-top-changed', (_event, above) => {
        if (!above) keepAbove();
      });
      settingsWindow.on('blur', () => {
        if (userSettings.onboardingComplete) settingsWindow.hide();
        keepAbove();
      });
      notch.webContents.on('render-process-gone', () => {
        void endCapture().finally(() => app.quit());
      });
      ipcMain.handle('helper:snapshot', (event) => {
        if (!authorized(event)) throw new Error('Origem inválida');
        return snapshot();
      });
      ipcMain.handle('helper:command', async (event, command: unknown) => {
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
            position();
            break;
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
      if (!userSettings.onboardingComplete) openSettings();
      else void refreshSources();
    })
    .catch((cause) => {
      console.error(cause);
      app.exit(1);
    });
app.on('second-instance', () => {
  if (settingsWindow) openSettings();
});
app.on('window-all-closed', () => app.quit());
app.on('before-quit', (event) => {
  if (quitting) return;
  event.preventDefault();
  quitting = true;
  stopDemo?.();
  controller.stop();
  void Promise.allSettled([capture.stop(), stopSpeech(), settingsQueue]).then(() => app.quit());
});
app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  tray?.destroy();
});
