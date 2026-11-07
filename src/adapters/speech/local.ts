import { access } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import type { SpeechBackend, SpeechHandle, SpeechResult } from '../../core/speech';

export class LocalSpeech implements SpeechBackend {
  constructor(private root: string) {}
  get python() {
    return path.join(
      this.root,
      '.asr-venv',
      process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python',
    );
  }
  async available() {
    try {
      await Promise.all(
        [
          this.python,
          path.join(this.root, '.models/base.en/model.bin'),
          path.join(this.root, '.models/base.en/tokenizer.json'),
        ].map((file) => access(file)),
      );
      return true;
    } catch {
      return false;
    }
  }
  async start(signal: AbortSignal, onFailure?: (message: string) => void): Promise<SpeechHandle> {
    signal.throwIfAborted();
    if (!(await this.available()))
      throw new Error(
        'O reconhecimento local não está preparado neste computador. Consulte o guia de instalação.',
      );
    signal.throwIfAborted();
    const child = spawn(this.python, ['-u', path.join(this.root, 'workers/asr/worker.py')], {
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: false,
      windowsHide: true,
      env: {
        ...process.env,
        HF_HUB_OFFLINE: '1',
        HF_HUB_DISABLE_TELEMETRY: '1',
        TRANSFORMERS_OFFLINE: '1',
        PYTHONIOENCODING: 'utf-8',
      },
    });
    let buffer = '',
      closed = false,
      stopping = false,
      booted = false,
      sequence = 0;
    let pending: {
      id: number;
      resolve: (result: SpeechResult) => void;
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
      45000,
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
      if (unexpected) onFailure?.('O processo de reconhecimento local foi interrompido.');
    }
    signal.addEventListener('abort', () => fail(new Error('Reconhecimento cancelado.'), false), {
      once: true,
    });
    child.stderr.resume(); // Do not log transcript-bearing diagnostics from third-party libraries.
    child.stdin.on('error', () => fail(new Error('O processo local ficou indisponível.')));
    child.once('error', () => fail(new Error('Não foi possível iniciar o reconhecimento local.')));
    child.once('close', () => {
      clearTimeout(killTimer);
      clearTimeout(bootTimeout);
      fail(new Error('O reconhecimento local foi encerrado.'));
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
          if (message.type === 'ready' && message.model === 'base.en' && message.device === 'cpu') {
            clearTimeout(bootTimeout);
            booted = true;
            resolveReady();
          } else if (
            message.type === 'result' &&
            pending &&
            message.id === pending.id &&
            typeof message.text === 'string' &&
            message.text.length <= 4096 &&
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
          fail(new Error('Falha no protocolo do reconhecimento local.'));
        }
      }
    });
    if (signal.aborted) fail(new Error('Reconhecimento cancelado.'));
    try {
      await ready;
    } catch (cause) {
      stopProcess();
      await ended;
      throw cause;
    }
    return {
      transcribe: (pcm) =>
        new Promise<SpeechResult>((resolve, reject) => {
          if (
            stopping ||
            closed ||
            signal.aborted ||
            pending ||
            !pcm.byteLength ||
            pcm.byteLength > 256000 ||
            pcm.byteLength % 2
          ) {
            reject(new Error('Entrada local inválida ou ocupada.'));
            return;
          }
          const id = ++sequence;
          pending = {
            id,
            resolve,
            reject,
            timeout: setTimeout(
              () => fail(new Error('Tempo limite do reconhecimento local.')),
              15000,
            ),
          };
          child.stdin.write(
            JSON.stringify({ id, pcm: Buffer.from(pcm).toString('base64') }) + '\n',
          );
        }),
      stop: async () => {
        fail(new Error('Reconhecimento cancelado.'), false);
        await ended;
      },
    };
  }
}
