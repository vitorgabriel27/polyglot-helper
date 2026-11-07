import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import type { AudioBackend, AudioSource, CaptureHandle } from '../../core/audio';
import { PcmMeter } from './meter';
const exec = promisify(execFile);

export function parseSources(input: unknown): AudioSource[] {
  if (!Array.isArray(input)) throw new Error('Catálogo de áudio inválido.');
  const sources: AudioSource[] = [];
  for (const item of input) {
    if (!item || typeof item !== 'object' || item.type !== 'PipeWire:Interface:Node') continue;
    const p = item.info?.props;
    if (!p || !['Audio/Source', 'Audio/Sink'].includes(p['media.class']) || typeof p['node.name'] !== 'string') continue;
    const label = p['node.description'] || p['node.nick'] || p['node.name'];
    sources.push({ id: `pipewire:${p['node.name']}`, label: String(label).slice(0, 160),
      kind: p['media.class'] === 'Audio/Sink' ? 'system' : 'microphone' });
  }
  return sources.sort((a, b) => a.kind.localeCompare(b.kind) || a.label.localeCompare(b.label));
}
export class PipeWireAudio implements AudioBackend {
  async listSources() {
    try {
      const { stdout } = await exec('pw-dump', [], { timeout: 4000, maxBuffer: 8 * 1024 * 1024 });
      return parseSources(JSON.parse(stdout));
    } catch {
      throw new Error('Não foi possível listar o áudio. Verifique PipeWire e os comandos pw-dump/pw-record.');
    }
  }
  async start(sourceId: string, signal: AbortSignal, onMetrics: Parameters<AudioBackend['start']>[2], onError: Parameters<AudioBackend['start']>[3], onPcm?: Parameters<AudioBackend['start']>[4]): Promise<CaptureHandle> {
    signal.throwIfAborted();
    const source = (await this.listSources()).find(item => item.id === sourceId);
    signal.throwIfAborted();
    if (!source) throw new Error('A fonte salva não está disponível. Escolha outra fonte nas configurações.');
    const target = source.id.slice('pipewire:'.length);
    const child = spawn('pw-record', ['--raw', '--rate=16000', '--channels=1', '--format=s16',
      '--latency=100ms', '--target', target, '--properties', JSON.stringify({
        'application.name': 'PolyglotHelper', 'node.dont-reconnect': true,
        'stream.capture.sink': source.kind === 'system',
      }), '-'], { stdio: ['ignore', 'pipe', 'pipe'], shell: false });
    let stopping = false, finished = false, lastReport = 0;
    let killTimer: ReturnType<typeof setTimeout> | undefined;
    let verifyTimer: ReturnType<typeof setTimeout> | undefined;
    let watchdog: ReturnType<typeof setTimeout> | undefined;
    const meter = new PcmMeter();
    const closed = new Promise<void>((resolve, reject) => {
      child.once('close', () => { finished = true; clearTimeout(killTimer); clearTimeout(verifyTimer); clearTimeout(watchdog); signal.removeEventListener('abort', abort); resolve(); });
      // SIGKILL should close the stream. A timeout is an explicit failure, never a silent restart.
      const abort = () => {
        if (stopping || finished) return;
        stopping = true; child.kill('SIGTERM');
        killTimer = setTimeout(() => {
          child.kill('SIGKILL');
          verifyTimer = setTimeout(() => reject(new Error('Não foi possível encerrar a captura. Feche o aplicativo.')), 1000);
        }, 700);
      };
      signal.addEventListener('abort', abort, { once: true });
      if (signal.aborted) abort();
    });
    // Error output is drained but not logged: device diagnostics may contain personal data.
    child.stderr.resume();
    child.stdout.on('data', (buffer: Buffer) => {
      if (stopping || signal.aborted) return;
      clearTimeout(watchdog);
      const metrics = meter.push(buffer);
      onPcm?.(buffer);
      const now = performance.now();
      if (now - lastReport >= 100) { lastReport = now; onMetrics(metrics); }
      watchdog = setTimeout(() => onError('O dispositivo parou de enviar áudio. Selecione a fonte novamente.'), 5000);
    });
    child.once('close', () => { if (!stopping && !signal.aborted) onError('A captura foi encerrada ou o dispositivo ficou indisponível.'); });
    await new Promise<void>((resolve, reject) => {
      child.once('spawn', resolve);
      child.once('error', () => reject(new Error('Não foi possível executar pw-record. Verifique a instalação do PipeWire.')));
    });
    watchdog = setTimeout(() => onError('Nenhum áudio recebido. Verifique a fonte escolhida e as permissões.'), 5000);
    return { stop: async () => {
      if (!finished && !stopping) { stopping = true; child.kill('SIGTERM'); killTimer = setTimeout(() => child.kill('SIGKILL'), 700); }
      await closed;
    } };
  }
}
