import { test, expect, _electron as electron, type ElectronApplication } from '@playwright/test';
import path from 'node:path';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises';

async function launch(profile: string) {
  const environment: Record<string, string> = Object.fromEntries(
    Object.entries(process.env).filter(
      (entry): entry is [string, string] => entry[1] !== undefined,
    ),
  );
  delete environment.ELECTRON_RUN_AS_NODE;
  return electron.launch({
    args: [
      '.',
      '--smoke-test',
      ...(process.platform === 'linux'
        ? process.env.HELPER_TEST_WAYLAND
          ? ['--ozone-platform=wayland']
          : ['--ozone-platform=x11', '--disable-gpu', '--x11']
        : []),
    ],
    env: { ...environment, HELPER_TEST_PROFILE: profile },
  });
}
async function windows(app: ElectronApplication) {
  await app.firstWindow();
  await expect.poll(() => app.windows().length).toBe(2);
  await expect
    .poll(() => app.windows().some((window) => window.url().endsWith('/index.html')))
    .toBe(true);
  return {
    notch: app.windows().find((window) => window.url().endsWith('/index.html'))!,
    settings: app.windows().find((window) => window.url().includes('view=settings'))!,
  };
}

test('first run, quick settings and demo lifecycle without device capture', async () => {
  const profile = await mkdtemp(path.join(os.tmpdir(), 'helper-e2e-'));
  const app = await launch(profile);
  try {
    const { notch, settings } = await windows(app);
    await expect(settings.getByRole('heading', { name: 'Vamos começar.' })).toBeVisible();
    await expect(settings.getByLabel('Iniciar com o sistema')).not.toBeChecked();
    await expect
      .poll(() =>
        app.evaluate(({ BrowserWindow }) =>
          BrowserWindow.getAllWindows()
            .find((window) => window.webContents.getURL().includes('view=settings'))!
            .isVisible(),
        ),
      )
      .toBe(true);
    await settings.evaluate(
      () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())),
    );
    await expect(async () => {
      await settings.screenshot({ path: path.join('test-results', 'first-run-settings.png') });
    }).toPass({ timeout: 5000 });
    await settings.getByRole('button', { name: 'Salvar e continuar' }).click();
    await expect(notch.getByRole('button', { name: 'Abrir configurações' })).toBeVisible();
    expect(
      await notch.evaluate(() => ({
        require: typeof (globalThis as Record<string, unknown>).require,
        bridge: typeof window.polyglotHelper.command,
      })),
    ).toEqual({ require: 'undefined', bridge: 'function' });
    await notch.getByRole('button', { name: 'Iniciar demonstração', exact: true }).click();
    await expect(notch.locator('.original')).toContainText('Take your');
    await notch.getByRole('button', { name: 'Abrir configurações' }).click();
    await settings.getByLabel('Pronúncia em IPA').check();
    await settings.getByRole('button', { name: 'Salvar', exact: true }).click();
    await expect(notch.locator('.pronunciation')).toBeVisible();
    await notch.getByRole('button', { name: 'Pausar demonstração' }).click();
    await expect(notch.locator('.captions')).toHaveCount(0);
    await notch.getByRole('button', { name: 'Iniciar demonstração', exact: true }).click();
    await expect(notch.locator('.translation')).toHaveText('Vá com calma.');
    await notch.screenshot({
      path: path.join(
        'test-results',
        `notch-${process.platform}-${process.env.HELPER_TEST_WAYLAND ? 'wayland' : 'default'}.png`,
      ),
    });
    expect(
      await notch.evaluate(async () => {
        try {
          await window.polyglotHelper.command({ type: 'shell' } as never);
          return false;
        } catch {
          return true;
        }
      }),
    ).toBe(true);
    expect(await notch.evaluate(() => Object.keys(window.polyglotHelper).sort())).toEqual([
      'command',
      'snapshot',
      'subscribe',
    ]);
    await notch.getByRole('button', { name: 'Abrir configurações' }).click();
    await settings.keyboard.press('Escape');
    expect(
      await app.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()
          .find((window) => window.webContents.getURL().includes('view=settings'))!
          .isVisible(),
      ),
    ).toBe(false);
    expect(
      await app.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()
          .find((window) => window.webContents.getURL().endsWith('/index.html'))!
          .isAlwaysOnTop(),
      ),
    ).toBe(true);
    if (process.platform === 'linux' && !process.env.HELPER_TEST_WAYLAND) {
      const targetFile = path.join(profile, 'focus-target.html');
      await writeFile(
        targetFile,
        '<!doctype html><title>Focus target</title><button>Focus target</button>',
      );
      await app.evaluate(async ({ BrowserWindow }, file) => {
        const target = new BrowserWindow({ title: 'Focus target', width: 240, height: 120 });
        await target.loadFile(file);
        target.show();
        target.focus();
      }, targetFile);
      await expect
        .poll(() =>
          app.evaluate(({ BrowserWindow }) => BrowserWindow.getFocusedWindow()?.getTitle()),
        )
        .toBe('Focus target');
      expect(
        await app.evaluate(({ BrowserWindow }) =>
          BrowserWindow.getAllWindows()
            .find((window) => window.webContents.getURL().endsWith('/index.html'))!
            .isFocused(),
        ),
      ).toBe(false);
      expect(
        await app.evaluate(({ BrowserWindow }) =>
          BrowserWindow.getAllWindows()
            .find((window) => window.webContents.getURL().endsWith('/index.html'))!
            .isAlwaysOnTop(),
        ),
      ).toBe(true);
      if (process.env.HELPER_CHECK_STACKING === '1') {
        const handles = await app.evaluate(({ BrowserWindow }) => ({
          notch:
            '0x' +
            BrowserWindow.getAllWindows()
              .find((window) => window.webContents.getURL().endsWith('/index.html'))!
              .getNativeWindowHandle()
              .readUInt32LE(0)
              .toString(16),
          target:
            '0x' +
            BrowserWindow.getAllWindows()
              .find((window) => window.getTitle() === 'Focus target')!
              .getNativeWindowHandle()
              .readUInt32LE(0)
              .toString(16),
        }));
        await expect
          .poll(async () => {
            const { stdout } = await promisify(execFile)('xprop', [
              '-root',
              '_NET_CLIENT_LIST_STACKING',
            ]);
            const ids: string[] = stdout.match(/0x[0-9a-f]+/g) || [];
            return {
              notchListed: ids.includes(handles.notch),
              targetListed: ids.includes(handles.target),
              above: ids.indexOf(handles.notch) > ids.indexOf(handles.target),
              ids,
              handles,
            };
          })
          .toMatchObject({ notchListed: true, targetListed: true, above: true });
      }
    }
  } finally {
    await app.close();
    await rm(profile, { recursive: true, force: true });
  }
});

test('saved setup and preferences survive relaunch; autostart is opt-in', async () => {
  const profile = await mkdtemp(path.join(os.tmpdir(), 'helper-e2e-'));
  let app = await launch(profile);
  try {
    let views = await windows(app);
    await expect
      .poll(
        async () =>
          (await views.settings.evaluate(() => window.polyglotHelper.snapshot())).sourcesLoading,
      )
      .toBe(false);
    const available = await views.settings.evaluate(() => window.polyglotHelper.snapshot());
    const chosenSource = available.audioSources[0]?.id ?? null;
    if (chosenSource) await views.settings.getByLabel('Fonte de áudio').selectOption(chosenSource);
    await views.settings.getByLabel('Pronúncia em IPA').check();
    await views.settings.getByLabel('Tamanho da legenda').selectOption('large');
    if (process.platform === 'linux')
      await views.settings.getByLabel('Iniciar com o sistema').check();
    await views.settings.getByRole('button', { name: 'Salvar e continuar' }).click();
    await expect
      .poll(
        async () =>
          (await views.settings.evaluate(() => window.polyglotHelper.snapshot())).settings
            .onboardingComplete,
      )
      .toBe(true);
    if (process.platform === 'linux')
      expect(
        await readFile(
          path.join(profile, 'system-config/autostart/polyglot-helper.desktop'),
          'utf8',
        ),
      ).toContain('PolyglotHelper');
    await app.close();
    app = await launch(profile);
    views = await windows(app);
    const snapshot = await views.notch.evaluate(() => window.polyglotHelper.snapshot());
    expect(snapshot.settings.onboardingComplete).toBe(true);
    expect(snapshot.settings.sourceId).toBe(chosenSource);
    expect(snapshot.state).toBe('idle'); // Startup never begins recording.
    expect(snapshot.preferences.pronunciation).toBe(true);
    expect(snapshot.preferences.fontSize).toBe('large');
    expect(
      await app.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()
          .find((window) => window.webContents.getURL().includes('view=settings'))!
          .isVisible(),
      ),
    ).toBe(false);
    await views.notch.getByRole('button', { name: 'Abrir configurações' }).click();
    await expect(views.settings.getByRole('heading', { name: 'Do seu jeito.' })).toBeVisible();
    if (process.platform === 'linux') {
      await expect(views.settings.getByLabel('Iniciar com o sistema')).toBeChecked();
      await views.settings.getByLabel('Iniciar com o sistema').uncheck();
      await views.settings.getByRole('button', { name: 'Salvar', exact: true }).click();
      await expect
        .poll(
          async () =>
            (await views.settings.evaluate(() => window.polyglotHelper.snapshot())).settings
              .launchAtLogin,
        )
        .toBe(false);
    }
  } finally {
    await app.close();
    await rm(profile, { recursive: true, force: true });
  }
});
