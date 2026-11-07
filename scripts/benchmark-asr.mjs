import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const datasetDirectory = path.join(root, 'tests/fixtures/asr/librispeech-clean');
const temporary = await mkdtemp(path.join(os.tmpdir(), 'helper-asr-benchmark-'));
let handle;

function parseWave(wave) {
  if (wave.toString('ascii', 0, 4) !== 'RIFF' || wave.toString('ascii', 8, 12) !== 'WAVE')
    throw new Error('Fixture WAV inválida.');
  let format, channels, rate, bits, pcm;
  for (let offset = 12; offset + 8 <= wave.length;) {
    const id = wave.toString('ascii', offset, offset + 4),
      size = wave.readUInt32LE(offset + 4);
    if (offset + 8 + size > wave.length) throw new Error('Chunk WAV truncado.');
    if (id === 'fmt ') {
      format = wave.readUInt16LE(offset + 8);
      channels = wave.readUInt16LE(offset + 10);
      rate = wave.readUInt32LE(offset + 12);
      bits = wave.readUInt16LE(offset + 22);
    }
    if (id === 'data') pcm = wave.subarray(offset + 8, offset + 8 + size);
    offset += 8 + size + (size % 2);
  }
  if (format !== 1 || channels !== 1 || rate !== 16000 || bits !== 16 || !pcm?.length)
    throw new Error('Esperado WAV PCM mono, 16 kHz, 16-bit.');
  return pcm;
}

function words(text) {
  return text.toLowerCase().match(/[a-z0-9]+(?:'[a-z0-9]+)*/g) ?? [];
}
function wer(expected, actual) {
  const a = words(expected),
    b = words(actual);
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++)
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    previous = current;
  }
  return {
    referenceWords: a.length,
    errors: previous[b.length],
    rate: a.length ? previous[b.length] / a.length : 0,
  };
}

try {
  const manifestBytes = await readFile(path.join(datasetDirectory, 'manifest.json'));
  const manifest = JSON.parse(manifestBytes.toString());
  const entry = path.join(temporary, 'asr.mjs');
  await build({
    entryPoints: [path.join(root, 'src/adapters/speech/local.ts')],
    outfile: entry,
    bundle: true,
    platform: 'node',
    format: 'esm',
  });
  const { LocalSpeech } = await import(pathToFileURL(entry).href),
    abort = new AbortController(),
    bootStart = performance.now();
  handle = await new LocalSpeech(root).start(abort.signal);
  const bootMs = performance.now() - bootStart;
  const clips = [
    ...manifest.files.map((item) => ({
      id: item.id,
      condition: 'clean',
      wav: item.id + '.wav',
      reference: item.reference,
      expectedHash: item.wavSha256,
    })),
    ...manifest.variants.map((item) => ({ ...item, expectedHash: item.wavSha256 })),
  ];
  const results = [];
  for (const clip of clips) {
    const wave = await readFile(path.join(datasetDirectory, clip.wav));
    const digest = createHash('sha256').update(wave).digest('hex');
    if (digest !== clip.expectedHash) throw new Error(`Hash inválido: ${clip.wav}`);
    const pcm = parseWave(wave);
    if (pcm.length > 16000 * 2 * 8) throw new Error(`Clip excede 8 s: ${clip.wav}`);
    const started = performance.now();
    const answer = await handle.transcribe(pcm);
    results.push({
      id: clip.id,
      condition: clip.condition,
      wav: clip.wav,
      reference: clip.reference,
      recognized: answer.text,
      ...wer(clip.reference, answer.text),
      roundTripMs: performance.now() - started,
      decodeMs: answer.decodeMs,
      durationSeconds: pcm.length / 32000,
    });
  }
  const models = await Promise.all(
    ['model.bin', 'config.json', 'tokenizer.json', 'vocabulary.txt'].map((name) =>
      readFile(path.join(root, '.models/base.en', name)),
    ),
  );
  const modelHash = createHash('sha256').update(Buffer.concat(models)).digest('hex');
  const report = {
    schemaVersion: 1,
    createdAt: new Date().toISOString(),
    environment: {
      platform: process.platform,
      release: os.release(),
      arch: process.arch,
      cpu: os.cpus()[0]?.model,
      logicalCpus: os.cpus().length,
      node: process.version,
    },
    model: { name: 'base.en', device: 'cpu', computeType: 'int8', sha256: modelHash },
    dataset: {
      name: manifest.dataset,
      license: manifest.license,
      manifestSha256: createHash('sha256').update(manifestBytes).digest('hex'),
      samples: results.length,
    },
    protocol: {
      conditions: ['clean', 'fast-1.2x', 'noise-12db'],
      scope:
        'Sequential single-clip PCM worker round-trip. Excludes PipeWire, UI and live segmentation.',
    },
    summary: {
      ...Object.fromEntries(
        ['clean', 'fast-1.2x', 'noise-12db'].map((condition) => {
          const group = results.filter((r) => r.condition === condition);
          const errors = group.reduce((n, r) => n + r.errors, 0),
            wordsCount = group.reduce((n, r) => n + r.referenceWords, 0);
          const latencies = group.map((r) => r.roundTripMs).sort((a, b) => a - b);
          return [
            condition,
            {
              samples: group.length,
              referenceWords: wordsCount,
              wordErrors: errors,
              wer: wordsCount ? errors / wordsCount : 0,
              medianMs: latencies[Math.floor(latencies.length / 2)],
              maxMs: latencies.at(-1),
            },
          ];
        }),
      ),
      bootMs,
      results,
    },
  };
  const directory = path.join(root, 'test-results/benchmark-asr');
  await mkdir(directory, { recursive: true });
  const output = path.join(directory, `report-${Date.now()}.json`);
  await writeFile(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ report: output, ...report.summary }, null, 2));
} catch (cause) {
  console.error(cause.message);
  process.exitCode = 1;
} finally {
  if (handle) await handle.stop();
  await rm(temporary, { recursive: true, force: true });
}
