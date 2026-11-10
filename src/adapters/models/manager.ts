import { access, mkdir, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import type { LanguageCode } from '../../core/preferences';
import { downloadVerifiedFile } from './downloader';

const HF_EN_REVISION = '3d3d5dee26484f91867d81cb899cfcf72b96be6c';
const HF_MULTI_REVISION = 'ebe41f70d5b6dfa9166e2c581c45c9c0cfc57b66';
const ASR_FILES = ['config.json', 'model.bin', 'tokenizer.json', 'vocabulary.txt'] as const;
const ASR_HASHES_EN: Record<(typeof ASR_FILES)[number], string> = {
  'config.json': 'f3bc3821e9fc76a27bae538e11ae5b677dcdd352b4600429ce7951d398569aeb',
  'model.bin': '2a166925539a16005f14ff328359f9b9adb9dc4fb631bb3b227526862e93e2ef',
  'tokenizer.json': '929c5252409436dce1b38a75d1abbcb5e132d170d8e324e4e04ed915fa2d22df',
  'vocabulary.txt': 'ff77588746d3a2595d32ab5b69ffd7b95ce2441ac57533cb66fc3eb575a115cf',
};
const KNOWN_ARGOS_HASHES: Record<string, string> = {
  'translate-en_pb-1_9': '1d1cd5e9540c6b38c258bed002a42d3b311b8a189acb74feaa311ef30d175c5b',
};
const LANG_CODE: Record<LanguageCode, string> = {
  'en-US': 'en',
  'pt-BR': 'pb',
  it: 'it',
  fr: 'fr',
  de: 'de',
  'zh-CN': 'zh',
};
const LANG_ASR: Record<LanguageCode, string> = {
  'en-US': 'en',
  'pt-BR': 'pt',
  it: 'it',
  fr: 'fr',
  de: 'de',
  'zh-CN': 'zh',
};
const MANIFEST_URL =
  'https://raw.githubusercontent.com/argosopentech/argospm-index/main/index.json';

export class ModelManager {
  constructor(private root: string) {}

  async ensure(
    source: LanguageCode,
    target: LanguageCode,
    signal: AbortSignal,
    progress: (stage: 'asr' | 'translation', fraction: number | null) => void,
  ) {
    await this.ensureAsr(source, signal, (fraction) => progress('asr', fraction));
    return this.ensureTranslation(source, target, signal, (fraction) =>
      progress('translation', fraction),
    );
  }

  async installedTranslationModels(source: LanguageCode, target: LanguageCode) {
    const root = path.join(this.root, '.models');
    const entries = await readdir(root, { withFileTypes: true }).catch(() => []);
    const graph = new Map<string, Array<{ to: string; id: string }>>();
    for (const entry of entries) {
      if (!entry.isDirectory() || !entry.name.startsWith('translate-')) continue;
      try {
        const metadata = JSON.parse(
          await readFile(path.join(root, entry.name, 'metadata.json'), 'utf8'),
        );
        if (typeof metadata.from_code !== 'string' || typeof metadata.to_code !== 'string')
          continue;
        if (!(await this.isArgosInstalled(entry.name))) continue;
        graph.set(metadata.from_code, [
          ...(graph.get(metadata.from_code) ?? []),
          { to: metadata.to_code, id: entry.name },
        ]);
      } catch {
        continue;
      }
    }
    const start = LANG_CODE[source];
    const finish = LANG_CODE[target];
    const queue: Array<{ code: string; ids: string[] }> = [{ code: start, ids: [] }];
    const seen = new Set([start]);
    while (queue.length) {
      const current = queue.shift()!;
      if (current.code === finish) return current.ids;
      for (const edge of graph.get(current.code) ?? []) {
        if (seen.has(edge.to)) continue;
        seen.add(edge.to);
        queue.push({ code: edge.to, ids: [...current.ids, edge.id] });
      }
    }
    return [];
  }

  private async ensureAsr(
    language: LanguageCode,
    signal: AbortSignal,
    progress: (fraction: number | null) => void,
  ) {
    const isEnglish = language === 'en-US';
    const modelName = isEnglish ? 'base.en' : 'multilingual-base';
    const directory = path.join(this.root, '.models', modelName);
    await mkdir(directory, { recursive: true });
    const repo = isEnglish ? 'faster-whisper-base.en' : 'faster-whisper-base';
    const revision = isEnglish ? HF_EN_REVISION : HF_MULTI_REVISION;
    const base = `https://huggingface.co/Systran/${repo}/resolve/${revision}`;
    const manifestPath = path.join(directory, 'download-manifest.json');
    let hashManifest: { hashes?: Record<string, string> } = {};
    if (!isEnglish) {
      try {
        hashManifest = JSON.parse(
          await (await import('node:fs/promises')).readFile(manifestPath, 'utf8'),
        );
      } catch {
        hashManifest = {};
      }
    }
    for (const file of ASR_FILES) {
      const destination = path.join(directory, file);
      const expected = isEnglish ? ASR_HASHES_EN[file] : hashManifest.hashes?.[file];
      if (await this.matchesHash(destination, expected)) {
        if (!isEnglish && !expected) {
          hashManifest.hashes = {
            ...hashManifest.hashes,
            [file]: await this.hashFile(destination),
          };
          await this.writeAsrManifest(manifestPath, repo, revision, language, hashManifest.hashes);
        }
        continue;
      }
      const digest = await downloadVerifiedFile(
        `${base}/${file}`,
        destination,
        expected,
        signal,
        progress,
      );
      if (!isEnglish) {
        hashManifest.hashes = { ...hashManifest.hashes, [file]: digest };
        await (
          await import('node:fs/promises')
        ).writeFile(
          manifestPath,
          JSON.stringify(
            {
              repository: `Systran/${repo}`,
              revision,
              language: LANG_ASR[language],
              hashes: hashManifest.hashes,
              hashSource: 'computed-after-download',
            },
            null,
            2,
          ),
          { mode: 0o600 },
        );
      }
    }
  }

  private async ensureTranslation(
    source: LanguageCode,
    target: LanguageCode,
    signal: AbortSignal,
    progress: (fraction: number | null) => void,
  ): Promise<string[]> {
    const existing = await this.installedTranslationModels(source, target);
    if (existing.length) return existing;
    const chain: LanguageCode[] =
      source === target
        ? []
        : source === 'en-US' || target === 'en-US'
          ? [source, target]
          : [source, 'en-US', target];
    if (!chain.length) return [];
    const index = await this.fetchIndex(signal);
    const pairs = chain.slice(0, -1).map((from, i) => ({ from, to: chain[i + 1] }));
    const selected = pairs.map(({ from, to }) => {
      const found = index.find(
        (item) => item.from_code === LANG_CODE[from] && item.to_code === LANG_CODE[to],
      );
      if (!found) throw new Error(`O catálogo Argos não oferece ${from} → ${to}.`);
      const url = found.links.find((link) => link.startsWith('https://'));
      if (!url)
        throw new Error(`O catálogo Argos não oferece download HTTPS para ${from} → ${to}.`);
      const version = url.match(/-(\d+(?:_\d+)*)\.argosmodel$/)?.[1];
      if (!version) throw new Error(`Versão do pacote Argos ausente para ${from} → ${to}.`);
      return { id: `${found.code}-${version}`, url };
    });
    const installed: string[] = [];
    for (const [indexInChain, model] of selected.entries()) {
      const archive = path.join(this.root, '.models', `${model.id}.argosmodel`);
      const manifestFile = `${archive}.json`;
      let expected = KNOWN_ARGOS_HASHES[model.id] ?? (await this.readHashManifest(manifestFile));
      if (!(await this.matchesHash(archive, expected))) {
        const digest = await downloadVerifiedFile(
          model.url,
          archive,
          undefined,
          signal,
          (fraction) => progress((indexInChain + (fraction ?? 0)) / selected.length),
        );
        expected = digest;
        await (
          await import('node:fs/promises')
        ).writeFile(
          manifestFile,
          JSON.stringify(
            { url: model.url, sha256: expected, hashSource: 'computed-after-download' },
            null,
            2,
          ),
          { mode: 0o600 },
        );
      } else if (!expected) {
        expected = await this.hashFile(archive);
        await (
          await import('node:fs/promises')
        ).writeFile(
          manifestFile,
          JSON.stringify(
            { url: model.url, sha256: expected, hashSource: 'computed-from-local-file' },
            null,
            2,
          ),
          { mode: 0o600 },
        );
      }
      installed.push(model.id);
    }
    const ready = await Promise.all(installed.map((id) => this.isArgosInstalled(id)));
    if (ready.every(Boolean)) return installed;
    const python = path.join(
      this.root,
      '.asr-venv',
      process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python',
    );
    try {
      await access(python);
    } catch {
      throw new Error(
        'Instale uv e execute pnpm setup:translation uma vez para habilitar o preparo automático dos modelos.',
      );
    }
    const { spawn } = await import('node:child_process');
    await new Promise<void>((resolve, reject) => {
      const child = spawn(python, ['workers/translation/prepare.py'], {
        cwd: this.root,
        shell: false,
        windowsHide: true,
        stdio: 'ignore',
        env: {
          ...process.env,
          HELPER_MODEL_ARCHIVES: installed
            .map((id) => path.join(this.root, '.models', `${id}.argosmodel`))
            .join(path.delimiter),
          HELPER_MODEL_DIR: path.join(this.root, '.models'),
          HF_HUB_OFFLINE: '1',
          HF_HUB_DISABLE_TELEMETRY: '1',
        },
      });
      child.once('error', () =>
        reject(new Error('Não foi possível preparar o pacote de tradução.')),
      );
      child.once('close', (code) =>
        code === 0
          ? resolve()
          : reject(new Error('Falha ao extrair os arquivos do modelo de tradução.')),
      );
    });
    if (!(await Promise.all(installed.map((id) => this.isArgosInstalled(id)))).every(Boolean))
      throw new Error('Os pacotes de tradução não foram instalados corretamente.');
    return installed;
  }

  private async fetchIndex(signal: AbortSignal) {
    const response = await fetch(MANIFEST_URL, { signal });
    if (!response.ok) throw new Error('Não foi possível consultar o índice de modelos Argos.');
    const value: unknown = await response.json();
    if (!Array.isArray(value)) throw new Error('Índice de modelos Argos inválido.');
    return value.filter(
      (
        item,
      ): item is {
        from_code: string;
        to_code: string;
        code: string;
        package_version: string;
        links: string[];
      } =>
        Boolean(
          item &&
          typeof item === 'object' &&
          typeof item.from_code === 'string' &&
          typeof item.to_code === 'string' &&
          typeof item.code === 'string' &&
          typeof item.package_version === 'string' &&
          Array.isArray(item.links) &&
          item.links.every((link: unknown) => typeof link === 'string'),
        ),
    );
  }

  private async readHashManifest(file: string) {
    try {
      const data = JSON.parse(await (await import('node:fs/promises')).readFile(file, 'utf8'));
      return typeof data.sha256 === 'string' ? data.sha256 : undefined;
    } catch {
      return undefined;
    }
  }

  private async isArgosInstalled(id: string) {
    return this.matchesHash(path.join(this.root, '.models', id, 'model', 'model.bin'));
  }

  private async matchesHash(file: string, expected?: string) {
    try {
      return expected
        ? (await this.hashFile(file)) === expected
        : (await (await import('node:fs/promises')).stat(file)).size > 0;
    } catch {
      return false;
    }
  }

  private async hashFile(file: string) {
    const { createHash } = await import('node:crypto');
    const { createReadStream } = await import('node:fs');
    const hash = createHash('sha256');
    for await (const chunk of createReadStream(file)) hash.update(chunk);
    return hash.digest('hex');
  }

  private async writeAsrManifest(
    file: string,
    repo: string,
    revision: string,
    language: LanguageCode,
    hashes: Record<string, string>,
  ) {
    await (
      await import('node:fs/promises')
    ).writeFile(
      file,
      JSON.stringify(
        {
          repository: `Systran/${repo}`,
          revision,
          language: LANG_ASR[language],
          hashes,
          hashSource: 'computed-after-download',
        },
        null,
        2,
      ),
      { mode: 0o600 },
    );
  }
}
