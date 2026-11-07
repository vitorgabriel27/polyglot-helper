import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { expect, it } from 'vitest';
import { PipeWireAudio } from '../src/adapters/audio/pipewire';
import { CaptureManager, type AudioMetrics } from '../src/core/audio';
const exec = promisify(execFile);

it.skipIf(process.platform !== 'linux' || process.env.HELPER_REAL_AUDIO_TEST !== '1')(
  'captures 60s of synthetic audio from an isolated PipeWire sink and stops cleanly',
  async () => {
    const name = `polyglothelper-selftest-${process.pid}-${Date.now()}`;
    const backend = new PipeWireAudio();
    const capture = new CaptureManager(backend);
    let player: ReturnType<typeof spawn> | undefined;
    let last: AudioMetrics | undefined;
    let failure: string | undefined;
    try {
      await exec(
        'pw-cli',
        [
          'create-node',
          'adapter',
          JSON.stringify({
            'factory.name': 'support.null-audio-sink',
            'node.name': name,
            'node.description': 'PolyglotHelper isolated test',
            'media.class': 'Audio/Sink',
            'object.linger': true,
            'audio.position': ['MONO'],
            'priority.session': 0,
            'node.virtual': true,
          }),
        ],
        { timeout: 4000 },
      );
      await expect
        .poll(async () =>
          (await backend.listSources()).some((source) => source.id === `pipewire:${name}`),
        )
        .toBe(true);
      let finish!: () => void;
      const complete = new Promise<void>((resolve) => {
        finish = resolve;
      });
      expect(
        await capture.start(
          `pipewire:${name}`,
          (metrics) => {
            last = metrics;
            if (metrics.durationMs >= 60000) finish();
          },
          (message) => {
            failure = message;
            finish();
          },
        ),
      ).toBe(true);
      player = spawn(
        'pw-play',
        ['--raw', '--rate=16000', '--channels=1', '--format=s16', '--target', name, '-'],
        { stdio: ['pipe', 'ignore', 'ignore'] },
      );
      player.on('error', () => {
        failure = 'Synthetic player failed';
        finish();
      });
      player.stdin!.on('error', () => {});
      const tone = Buffer.alloc(16000 * 2 * 63);
      for (let i = 0; i < tone.length / 2; i += 1)
        tone.writeInt16LE(Math.round(Math.sin((i * 2 * Math.PI * 440) / 16000) * 8192), i * 2);
      player.stdin!.end(tone);
      const timeout = setTimeout(() => {
        failure = 'Timed out before 60 seconds of PCM';
        finish();
      }, 70000);
      await complete;
      clearTimeout(timeout);
      expect(failure).toBeUndefined();
      expect(last!.durationMs).toBeGreaterThanOrEqual(60000);
      expect(last!.peak).toBeGreaterThan(0.1);
      await capture.stop();
      const samples = last!.samples;
      await new Promise((resolve) => setTimeout(resolve, 250));
      expect(last!.samples).toBe(samples);
    } finally {
      await capture.stop();
      player?.kill('SIGTERM');
      const { stdout } = await exec('pw-dump', [], { timeout: 4000, maxBuffer: 8 * 1024 * 1024 });
      const owned = JSON.parse(stdout).find(
        (node: { info?: { props?: Record<string, unknown> } }) =>
          node.info?.props?.['node.name'] === name,
      );
      if (owned) await exec('pw-cli', ['destroy', String(owned.id)], { timeout: 4000 });
    }
  },
  80000,
);
