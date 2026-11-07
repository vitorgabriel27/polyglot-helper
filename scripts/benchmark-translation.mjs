import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputDirectory = path.resolve(root, 'test-results/benchmark-translation');
const temporary = await mkdtemp(path.join(os.tmpdir(), 'helper-benchmark-'));
const abort = new AbortController();
let handle;
try {
  const fixture = await readFile(path.join(root, 'tests/fixtures/translation-en-pt-BR.json'));
  const dataset = JSON.parse(fixture);
  const modulePath = path.join(temporary, 'translation.mjs');
  await build({
    entryPoints: [path.join(root, 'src/adapters/translation/local.ts')],
    outfile: modulePath,
    bundle: true,
    platform: 'node',
    format: 'esm',
  });
  const { LocalTranslation } = await import(pathToFileURL(modulePath).href);
  const bootStart = performance.now();
  handle = await new LocalTranslation(root).start(abort.signal);
  const bootMs = performance.now() - bootStart;
  // Warm-up is excluded from timed samples; boot is reported separately.
  await handle.translate('This is a warm-up sentence.');
  const samples = [];
  for (const sample of dataset.samples) {
    const runs = [];
    for (let repeat = 0; repeat < 3; repeat++) {
      const started = performance.now();
      const result = await handle.translate(sample.source);
      runs.push({
        text: result.text,
        roundTripMs: performance.now() - started,
        decodeMs: result.decodeMs,
      });
    }
    samples.push({ ...sample, runs, review: { meaning: null, fluency: null, notes: '' } });
  }
  const times = samples
    .flatMap((sample) => sample.runs.map((run) => run.roundTripMs))
    .sort((a, b) => a - b);
  const modelHash = createHash('sha256')
    .update(await readFile(path.join(root, '.models/translate-en_pb-1_9/model/model.bin')))
    .digest('hex');
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
    model: { name: 'translate-en_pb-1_9', sha256: modelHash },
    dataset: {
      sha256: createHash('sha256').update(fixture).digest('hex'),
      provenance: dataset.provenance,
    },
    protocol: {
      repeats: 3,
      warmups: 1,
      scope:
        'Sequential worker round-trip; excludes ASR, segmentation, UI and boot. No network or capture.',
      quality: 'Pending bilingual review; reference differences are not automatic errors.',
    },
    summary: {
      bootMs,
      samples: samples.length,
      observations: times.length,
      medianMs: times[Math.ceil(times.length * 0.5) - 1],
      empiricalP95Ms: times[Math.ceil(times.length * 0.95) - 1],
      maxMs: times.at(-1),
      qualityReviewed: 0,
    },
    samples,
  };
  await mkdir(outputDirectory, { recursive: true });
  const output = path.join(outputDirectory, `report-${Date.now()}.json`);
  await writeFile(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ report: output, ...report.summary }, null, 2));
} catch (cause) {
  console.error(cause.message);
  process.exitCode = 1;
} finally {
  abort.abort();
  if (handle) await handle.stop();
  await rm(temporary, { recursive: true, force: true });
}
