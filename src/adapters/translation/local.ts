import { access } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import type { TranslationHandle, TranslationResult } from '../../core/translation';
import type { TranslationProvider } from '../../core/contracts';

export class LocalTranslation implements TranslationProvider {
  constructor(
    private root: string,
    private modelIds = ['translate-en_pb-1_9'],
  ) {}
  get python() {
    return path.join(
      this.root,
      '.asr-venv',
      process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python',
    );
  }
  async available() {
    if (!this.modelIds.length) return false;
    try {
      await Promise.all(
        [
          this.python,
          ...this.modelIds.flatMap((id) => [
            path.join(this.root, '.models', id, 'model/model.bin'),
            path.join(this.root, '.models', id, 'sentencepiece.model'),
          ]),
        ].map((file) => access(file)),
      );
      return true;
    } catch {
      return false;
    }
  }
  async start(
    signal: AbortSignal,
    onFailure?: (message: string) => void,
  ): Promise<TranslationHandle> {
    signal.throwIfAborted();
    if (!(await this.available()))
      throw new Error(
        'A tradução local não está preparada neste computador. Consulte o guia de instalação.',
      );
    signal.throwIfAborted();
    const child = spawn(
      this.python,
      ['-u', path.join(this.root, 'workers/translation/worker.py')],
      {
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: false,
        windowsHide: true,
        env: {
          ...process.env,
          HELPER_TRANSLATION_MODELS: JSON.stringify(this.modelIds),
          HF_HUB_OFFLINE: '1',
          HF_HUB_DISABLE_TELEMETRY: '1',
          TRANSFORMERS_OFFLINE: '1',
          PYTHONIOENCODING: 'utf-8',
        },
      },
    );
    let buffer = '',
      closed = false,
      stopping = false,
      booted = false,
      sequence = 0;
    let pending: {
      id: number;
      resolve: (result: TranslationResult) => void;
      reject: (cause: Error) => void;
      timeout: ReturnType<typeof setTimeout>;
    } | null = null;
    let resolveReady!: () => void, rejectReady!: (cause: Error) => void;
    const ready = new Promise<void>((resolve, reject) => {
      resolveReady = resolve;
      rejectReady = reject;
    });
    const bootTimeout = setTimeout(
      () => fail(new Error('O modelo local demorou demais para carregar.')),
      15000,
    );
    const ended = new Promise<void>((resolve) =>
      child.once('close', () => {
        closed = true;
        resolve();
      }),
    );
    let killTimer: ReturnType<typeof setTimeout> | undefined;
    function stopProcess() {
      if (stopping || closed) return;
      stopping = true;
      child.kill('SIGTERM');
      killTimer = setTimeout(() => child.kill('SIGKILL'), 700);
    }
    function fail(cause: Error, notify = true) {
      const unexpected = booted && !stopping && !signal.aborted && notify;
      clearTimeout(bootTimeout);
      rejectReady(cause);
      if (pending) {
        clearTimeout(pending.timeout);
        pending.reject(cause);
        pending = null;
      }
      stopProcess();
      if (unexpected) onFailure?.('O processo de tradução local foi interrompido.');
    }
    signal.addEventListener('abort', () => fail(new Error('Tradução cancelada.'), false), {
      once: true,
    });
    child.stderr.resume(); // Do not log transcript-bearing diagnostics from third-party libraries.
    child.stdin.on('error', () => fail(new Error('O processo local ficou indisponível.')));
    child.once('error', () => fail(new Error('Não foi possível iniciar a tradução local.')));
    child.once('close', () => {
      clearTimeout(killTimer);
      clearTimeout(bootTimeout);
      fail(new Error('A tradução local foi encerrada.'));
    });
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      buffer += chunk;
      if (buffer.length > 65536) {
        fail(new Error('Resposta local excedeu o limite.'));
        return;
      }
      let newline: number;
      while ((newline = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, newline);
        buffer = buffer.slice(newline + 1);
        try {
          const message = JSON.parse(line);
          if (message.type === 'ready' && message.model === this.modelIds.join('+')) {
            clearTimeout(bootTimeout);
            booted = true;
            resolveReady();
          } else if (
            message.type === 'result' &&
            pending &&
            message.id === pending.id &&
            typeof message.text === 'string' &&
            message.text.length <= 8192 &&
            Number.isFinite(message.decodeMs) &&
            message.decodeMs >= 0
          ) {
            const request = pending;
            pending = null;
            clearTimeout(request.timeout);
            request.resolve({ text: message.text, decodeMs: message.decodeMs });
          } else {
            fail(new Error('O modelo local retornou uma resposta inválida.'));
          }
        } catch {
          fail(new Error('Falha no protocolo da tradução local.'));
        }
      }
    });
    if (signal.aborted) fail(new Error('Tradução cancelada.'));
    try {
      await ready;
    } catch (cause) {
      stopProcess();
      await ended;
      throw cause;
    }
    return {
      translate: (text) =>
        new Promise<TranslationResult>((resolve, reject) => {
          if (
            stopping ||
            closed ||
            signal.aborted ||
            pending ||
            typeof text !== 'string' ||
            !text.trim() ||
            text.length > 4096
          ) {
            reject(new Error('Tradução inválida ou ocupada.'));
            return;
          }
          const id = ++sequence;
          pending = {
            id,
            resolve,
            reject,
            timeout: setTimeout(() => fail(new Error('Tempo limite da tradução local.')), 5000),
          };
          child.stdin.write(JSON.stringify({ id, text }) + '\n');
        }),
      stop: async () => {
        fail(new Error('Tradução cancelada.'), false);
        await ended;
      },
    };
  }
}
