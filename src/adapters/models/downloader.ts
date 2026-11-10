import { createHash } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdir, rename, rm } from 'node:fs/promises';
import path from 'node:path';

const MAX_MODEL_BYTES = 2_000_000_000;
const MAX_MANIFEST_BYTES = 2_000_000;
const ALLOWED_HOSTS = new Set([
  'huggingface.co',
  'cdn-lfs.huggingface.co',
  'argos-net.com',
  'data.argosopentech.com',
]);
function trustedHost(hostname: string) {
  return ALLOWED_HOSTS.has(hostname) || hostname.endsWith('.hf.co');
}

export async function downloadVerifiedFile(
  url: string,
  destination: string,
  sha256: string | undefined,
  signal?: AbortSignal,
  progress?: (fraction: number | null) => void,
) {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || !trustedHost(parsed.hostname))
    throw new Error('Origem de modelo não autorizada.');
  if (sha256 && !/^[a-f0-9]{64}$/i.test(sha256)) throw new Error('Hash de modelo inválido.');
  await mkdir(path.dirname(destination), { recursive: true });
  const temporary = `${destination}.download`;
  try {
    const response = await fetch(parsed, { signal, redirect: 'follow' });
    if (!response.ok || !response.body) throw new Error('Não foi possível baixar o modelo.');
    const finalUrl = new URL(response.url);
    if (finalUrl.protocol !== 'https:' || !trustedHost(finalUrl.hostname))
      throw new Error('O download redirecionou para uma origem não autorizada.');
    const sizeHeader = Number(response.headers.get('content-length'));
    if (Number.isFinite(sizeHeader) && sizeHeader > MAX_MODEL_BYTES)
      throw new Error('O arquivo de modelo excede o limite de tamanho.');
    const hash = createHash('sha256');
    let bytes = 0;
    const reader = response.body.getReader();
    const writable = createWriteStream(temporary, { flags: 'w', mode: 0o600 });
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > MAX_MODEL_BYTES)
          throw new Error('O arquivo de modelo excede o limite de tamanho.');
        hash.update(value);
        if (!writable.write(value))
          await new Promise<void>((resolve, reject) => {
            writable.once('drain', resolve);
            writable.once('error', reject);
          });
        progress?.(
          Number.isFinite(sizeHeader) && sizeHeader > 0 ? Math.min(1, bytes / sizeHeader) : null,
        );
      }
      writable.end();
      await new Promise<void>((resolve, reject) => {
        writable.once('finish', resolve);
        writable.once('error', reject);
      });
    } catch (cause) {
      reader.cancel().catch(() => {});
      writable.destroy();
      throw cause;
    }
    const digest = hash.digest('hex').toLowerCase();
    if (sha256 && digest !== sha256.toLowerCase())
      throw new Error('A verificação de integridade do modelo falhou.');
    await rename(temporary, destination);
    return digest;
  } catch (cause) {
    await rm(temporary, { force: true });
    throw cause;
  }
}

export async function fetchModelManifest(url: string, signal?: AbortSignal) {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || !trustedHost(parsed.hostname))
    throw new Error('Origem de catálogo não autorizada.');
  const response = await fetch(parsed, { signal, redirect: 'follow' });
  if (!response.ok) throw new Error('Não foi possível consultar o catálogo de modelos.');
  const finalUrl = new URL(response.url);
  if (finalUrl.protocol !== 'https:' || !trustedHost(finalUrl.hostname))
    throw new Error('O catálogo redirecionou para uma origem não autorizada.');
  const text = await response.text();
  if (text.length > MAX_MANIFEST_BYTES) throw new Error('Catálogo de modelos excedeu o limite.');
  return JSON.parse(text) as unknown;
}
