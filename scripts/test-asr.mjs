import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const temporary = await mkdtemp(path.join(os.tmpdir(), 'helper-asr-test-'));
let handle;
try {
  const response = await fetch('https://raw.githubusercontent.com/ggml-org/whisper.cpp/master/samples/jfk.wav');
  if (!response.ok) throw new Error('Não foi possível obter a amostra pública de teste.');
  const wave = Buffer.from(await response.arrayBuffer());
  const digest = createHash('sha256').update(wave).digest('hex');
  if (digest !== '59dfb9a4acb36fe2a2affc14bacbee2920ff435cb13cc314a08c13f66ba7860e') throw new Error('A fixture pública mudou; revise antes de atualizar o hash.');
  let pcm;
  for (let offset = 12; offset + 8 <= wave.length;) {
    const size = wave.readUInt32LE(offset + 4);
    if (wave.toString('ascii', offset, offset + 4) === 'fmt ' && (wave.readUInt16LE(offset + 8) !== 1 || wave.readUInt16LE(offset + 10) !== 1 || wave.readUInt32LE(offset + 12) !== 16000 || wave.readUInt16LE(offset + 22) !== 16)) throw new Error('Formato de fixture não suportado.');
    if (wave.toString('ascii', offset, offset + 4) === 'data') { pcm = wave.subarray(offset + 8, offset + 8 + size); break; }
    offset += 8 + size + size % 2;
  }
  if (!pcm?.length) throw new Error('Fixture sem PCM.');
  const output = path.join(temporary, 'local.mjs');
  await build({ entryPoints: [path.join(root, 'src/adapters/speech/local.ts')], outfile: output, bundle: true, platform: 'node', format: 'esm' });
  const { LocalSpeech } = await import(pathToFileURL(output).href);
  const abort = new AbortController();
  const started = performance.now();
  handle = await new LocalSpeech(root).start(abort.signal);
  const bootMs = Math.round(performance.now() - started);
  const result = await handle.transcribe(pcm.subarray(0, 16000 * 2 * 6));
  if (!/country|americans/i.test(result.text)) throw new Error('Reconhecimento não corresponde à amostra de fala.');
  const silence = await handle.transcribe(Buffer.alloc(32000));
  if (silence.text !== '') throw new Error('Silêncio gerou legenda indevida.');
  const inFlight = handle.transcribe(pcm.subarray(0, 16000 * 2 * 6));
  const cancellation = inFlight.then(() => false, () => true);
  abort.abort();
  if (!await cancellation) throw new Error('Inferência não foi cancelada.');
  await handle.stop(); handle = undefined;
  console.log(JSON.stringify({ passed: true, model: 'base.en', device: 'cpu', bootMs, decodeMs: result.decodeMs, recognizedCharacters: result.text.length, silenceEmpty: true, cancellation: true }));
} catch (cause) { console.error(cause.message); process.exitCode = 1; }
finally { if (handle) await handle.stop(); await rm(temporary, { recursive: true, force: true }); }
