import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import os from 'node:os';
import path from 'node:path';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const temporary = await mkdtemp(path.join(os.tmpdir(), 'helper-translation-test-'));
let handle;
try {
  const output = path.join(temporary, 'translation.mjs');
  await build({
    entryPoints: [path.join(root, 'src/adapters/translation/local.ts')],
    outfile: output,
    bundle: true,
    platform: 'node',
    format: 'esm',
  });
  const { LocalTranslation } = await import(pathToFileURL(output).href);
  const abort = new AbortController();
  handle = await new LocalTranslation(root).start(abort.signal);
  const answer = await handle.translate('Hello, how are you?');
  if (!/olá|como|você|voce|está/i.test(answer.text) || answer.text === 'Hello, how are you?')
    throw new Error('Tradução não corresponde ao português esperado.');
  if (answer.text.includes('▁')) throw new Error('Marcador de tokenização vazou para a legenda.');
  const second = await handle.translate('The book is on the table.');
  if (!/livro/i.test(second.text) || !/mesa/i.test(second.text))
    throw new Error('Frase de referência não foi traduzida.');
  console.log(
    JSON.stringify({
      passed: true,
      target: 'pt-BR',
      decodeMs: [answer.decodeMs, second.decodeMs],
      output: [answer.text, second.text],
    }),
  );
  abort.abort();
  await handle.stop();
  handle = undefined;
} catch (cause) {
  console.error(cause.message);
  process.exitCode = 1;
} finally {
  if (handle) await handle.stop();
  await rm(temporary, { recursive: true, force: true });
}
