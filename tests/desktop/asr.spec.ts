import { test, expect, _electron as electron } from '@playwright/test';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { defaults } from '../../src/core/preferences';
const exec = promisify(execFile);

test('local ASR from isolated audio reaches the notch and pauses/resumes cleanly', async () => {
  test.skip(
    process.platform !== 'linux' || process.env.HELPER_ASR_TEST !== '1',
    'Requires prepared local ASR, translation and PipeWire; no personal audio.',
  );
  test.setTimeout(45000);
  const profile = await mkdtemp(path.join(os.tmpdir(), 'helper-asr-ui-'));
  const name = `polyglothelper-selftest-${process.pid}-${Date.now()}`;
  let app: Awaited<ReturnType<typeof electron.launch>> | undefined;
  let player: ReturnType<typeof spawn> | undefined;
  try {
    const response = await fetch(
      'https://raw.githubusercontent.com/ggml-org/whisper.cpp/master/samples/jfk.wav',
    );
    const wave = Buffer.from(await response.arrayBuffer());
    expect(createHash('sha256').update(wave).digest('hex')).toBe(
      '59dfb9a4acb36fe2a2affc14bacbee2920ff435cb13cc314a08c13f66ba7860e',
    );
    const pcm = wave.subarray(wave.indexOf('data') + 8);
    await exec(
      'pw-cli',
      [
        'create-node',
        'adapter',
        JSON.stringify({
          'factory.name': 'support.null-audio-sink',
          'node.name': name,
          'node.description': 'PolyglotHelper ASR fixture',
          'media.class': 'Audio/Sink',
          'object.linger': true,
          'audio.position': ['MONO'],
          'priority.session': 0,
          'node.virtual': true,
        }),
      ],
      { timeout: 4000 },
    );
    await writeFile(
      path.join(profile, 'preferences.json'),
      JSON.stringify({ ...defaults(), onboardingComplete: true, sourceId: `pipewire:${name}` }),
    );
    const environment = Object.fromEntries(
      Object.entries(process.env).filter(
        (entry): entry is [string, string] => entry[1] !== undefined,
      ),
    );
    delete environment.ELECTRON_RUN_AS_NODE;
    app = await electron.launch({
      args: ['.', '--smoke-test', '--ozone-platform=x11', '--disable-gpu', '--x11'],
      env: { ...environment, HELPER_TEST_PROFILE: profile },
    });
    await app.firstWindow();
    await expect
      .poll(() => app!.windows().some((window) => window.url().endsWith('/index.html')))
      .toBe(true);
    const notch = app.windows().find((window) => window.url().endsWith('/index.html'))!;
    await notch.getByRole('button', { name: 'Iniciar captura' }).click();
    await expect
      .poll(async () => (await notch.evaluate(() => window.polyglotHelper.snapshot())).state, {
        timeout: 15000,
      })
      .toBe('listening');
    player = spawn(
      'pw-play',
      ['--raw', '--rate=16000', '--channels=1', '--format=s16', '--target', name, '-'],
      { stdio: ['pipe', 'ignore', 'ignore'] },
    );
    player.stdin!.on('error', () => {});
    player.stdin!.end(Buffer.concat([pcm, Buffer.alloc(32000)]));
    await expect(notch.locator('.original')).toContainText(/americans|country/i, {
      timeout: 20000,
    });
    await expect(notch.locator('.translation')).toContainText(
      /americanos|compatriotas|país|pais/i,
      { timeout: 10000 },
    );
    await expect(notch.locator('.translation')).not.toContainText('▁');
    await notch.screenshot({ path: 'test-results/notch-local-asr.png' });
    await notch.getByRole('button', { name: 'Abrir configurações' }).click();
    const settings = app.windows().find((window) => window.url().includes('view=settings'))!;
    await settings.getByLabel('Tradução', { exact: true }).uncheck();
    await settings.getByRole('button', { name: 'Salvar', exact: true }).click();
    await expect(notch.locator('.translation')).toHaveCount(0);
    expect((await notch.evaluate(() => window.polyglotHelper.snapshot())).state).toBe('listening');
    expect((await notch.evaluate(() => window.polyglotHelper.snapshot())).translation.state).toBe(
      'disabled',
    );
    await notch.getByRole('button', { name: 'Abrir configurações' }).click();
    await settings.getByLabel('Tradução', { exact: true }).check();
    await settings.getByRole('button', { name: 'Salvar', exact: true }).click();
    await expect(notch.locator('.translation')).toContainText(
      /americanos|compatriotas|país|pais/i,
      { timeout: 10000 },
    );
    await notch.getByRole('button', { name: 'Pausar captura' }).click();
    await expect
      .poll(async () => (await notch.evaluate(() => window.polyglotHelper.snapshot())).state)
      .toBe('paused');
    expect((await notch.evaluate(() => window.polyglotHelper.snapshot())).segment).toBeNull();
    await notch.getByRole('button', { name: 'Iniciar captura' }).click();
    await expect
      .poll(async () => (await notch.evaluate(() => window.polyglotHelper.snapshot())).state, {
        timeout: 15000,
      })
      .toBe('listening');
    await notch.evaluate(() => window.polyglotHelper.command({ type: 'stop' }));
    const stopped = await notch.evaluate(() => window.polyglotHelper.snapshot());
    expect(stopped.state).toBe('idle');
    expect(stopped.segment).toBeNull();
    expect(stopped.metrics.rms).toBe(0);
  } finally {
    await app?.close();
    player?.kill('SIGTERM');
    const { stdout } = await exec('pw-dump', [], { timeout: 4000, maxBuffer: 8 * 1024 * 1024 });
    const owned = JSON.parse(stdout).find(
      (node: { info?: { props?: Record<string, unknown> } }) =>
        node.info?.props?.['node.name'] === name,
    );
    if (owned) await exec('pw-cli', ['destroy', String(owned.id)], { timeout: 4000 });
    await rm(profile, { recursive: true, force: true });
  }
});
