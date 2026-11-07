import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import { PipeWireAudio } from '../src/adapters/audio/pipewire';
import { CaptureManager } from '../src/core/audio';
import { CaptionPipeline, UtteranceSegmenter, type SpeechHandle } from '../src/core/speech';
import { LocalSpeech } from '../src/adapters/speech/local';
const exec = promisify(execFile);

it.skipIf(process.platform !== 'linux' || process.env.HELPER_ASR_TEST !== '1')(
  'transcribes public speech through a real isolated PipeWire capture and local worker',
  async () => {
    const response = await fetch(
      'https://raw.githubusercontent.com/ggml-org/whisper.cpp/master/samples/jfk.wav',
    );
    if (!response.ok) throw new Error('Public fixture unavailable');
    const wave = Buffer.from(await response.arrayBuffer());
    expect(createHash('sha256').update(wave).digest('hex')).toBe(
      '59dfb9a4acb36fe2a2affc14bacbee2920ff435cb13cc314a08c13f66ba7860e',
    );
    const dataMarker = wave.indexOf('data');
    const pcm = wave.subarray(dataMarker + 8);
    const name = `polyglothelper-selftest-${process.pid}-${Date.now()}`;
    const backend = new PipeWireAudio();
    const capture = new CaptureManager(backend);
    const abort = new AbortController();
    let speech: SpeechHandle | undefined;
    let pipeline: CaptionPipeline | undefined;
    let player: ReturnType<typeof spawn> | undefined;
    const captions: string[] = [];
    let failure: string | undefined;
    let dropped = 0,
      finals = 0;
    let firstCaptionMs: number | undefined;
    const started = performance.now();
    try {
      speech = await new LocalSpeech(process.cwd()).start(abort.signal);
      await exec(
        'pw-cli',
        [
          'create-node',
          'adapter',
          JSON.stringify({
            'factory.name': 'support.null-audio-sink',
            'node.name': name,
            'node.description': 'PolyglotHelper isolated ASR test',
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
      pipeline = new CaptionPipeline(
        speech,
        (utterance, result) => {
          if (utterance.isFinal && result.text) finals += 1;
          if (result.text) {
            captions.push(result.text);
            firstCaptionMs ??= Math.round(performance.now() - started);
          }
        },
        (message) => {
          failure = message;
        },
        (_running, count) => {
          dropped = count;
        },
      );
      const segmenter = new UtteranceSegmenter((utterance) => pipeline!.submit(utterance));
      expect(
        await capture.start(
          `pipewire:${name}`,
          () => {},
          (message) => {
            failure = message;
          },
          (data) => segmenter.push(data),
        ),
      ).toBe(true);
      player = spawn(
        'pw-play',
        ['--raw', '--rate=16000', '--channels=1', '--format=s16', '--target', name, '-'],
        { stdio: ['pipe', 'ignore', 'ignore'] },
      );
      player.stdin!.on('error', () => {});
      player.stdin!.end(Buffer.concat([pcm, Buffer.alloc(32000)]));
      await expect
        .poll(
          () => {
            if (failure) throw new Error(failure);
            return captions.join(' ').toLowerCase();
          },
          { timeout: 20000 },
        )
        .toMatch(/americans|country/);
      await expect.poll(() => finals, { timeout: 20000 }).toBeGreaterThan(0);
      const activeSpeech = speech;
      if (!activeSpeech) throw new Error('ASR não foi inicializado.');
      pipeline.stop();
      await capture.stop();
      abort.abort();
      await activeSpeech.stop();
      speech = undefined;
      expect(failure).toBeUndefined();
      console.log(
        JSON.stringify({
          firstCaptionMs,
          recognizedUpdates: captions.length,
          finalUpdates: finals,
          dropped,
          local: true,
        }),
      );
    } finally {
      pipeline?.stop();
      await capture.stop();
      abort.abort();
      if (speech) await speech.stop();
      player?.kill('SIGTERM');
      const { stdout } = await exec('pw-dump', [], { timeout: 4000, maxBuffer: 8 * 1024 * 1024 });
      const owned = JSON.parse(stdout).find(
        (node: { info?: { props?: Record<string, unknown> } }) =>
          node.info?.props?.['node.name'] === name,
      );
      if (owned) await exec('pw-cli', ['destroy', String(owned.id)], { timeout: 4000 });
    }
  },
  35000,
);
