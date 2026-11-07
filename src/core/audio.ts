export interface AudioSource {
  id: string;
  label: string;
  kind: 'microphone' | 'system';
}
export interface AudioMetrics {
  sampleRate: 16000;
  channels: 1;
  samples: number;
  durationMs: number;
  rms: number;
  peak: number;
}
export interface CaptureHandle {
  stop(): Promise<void>;
}
export interface AudioBackend {
  listSources(): Promise<AudioSource[]>;
  start(
    sourceId: string,
    signal: AbortSignal,
    onMetrics: (metrics: AudioMetrics) => void,
    onError: (message: string) => void,
    onPcm?: (pcm: Uint8Array) => void,
  ): Promise<CaptureHandle>;
}
export const emptyMetrics = (): AudioMetrics => ({
  sampleRate: 16000,
  channels: 1,
  samples: 0,
  durationMs: 0,
  rms: 0,
  peak: 0,
});

// Serializes startup/teardown even if the user quickly pauses and resumes.
export class CaptureManager {
  private revision = 0;
  private active?: { abort: AbortController; pending: Promise<CaptureHandle> };
  private draining: Promise<void> = Promise.resolve();
  constructor(private backend: AudioBackend) {}
  private detach() {
    const run = this.active;
    this.active = undefined;
    if (run) {
      run.abort.abort();
      this.draining = this.draining.then(() =>
        run.pending.then(
          (handle) => handle.stop(),
          () => {},
        ),
      );
    }
    return this.draining;
  }
  async start(
    sourceId: string,
    metrics: (data: AudioMetrics) => void,
    error: (message: string) => void,
    pcm?: (data: Uint8Array) => void,
  ) {
    const revision = ++this.revision;
    await this.detach();
    if (revision !== this.revision) return false;
    const run = {
      abort: new AbortController(),
      pending: Promise.resolve(null as unknown as CaptureHandle),
    };
    this.active = run;
    run.pending = Promise.resolve().then(() =>
      this.backend.start(
        sourceId,
        run.abort.signal,
        (data) => {
          if (this.active === run && !run.abort.signal.aborted) metrics(data);
        },
        (message) => {
          if (this.active === run && !run.abort.signal.aborted) error(message);
        },
        (data) => {
          if (this.active === run && !run.abort.signal.aborted) pcm?.(data);
        },
      ),
    );
    try {
      await run.pending;
      return this.active === run && !run.abort.signal.aborted;
    } catch (cause) {
      if (this.active === run && !run.abort.signal.aborted) {
        error(cause instanceof Error ? cause.message : 'Não foi possível iniciar a captura.');
      }
      return false;
    }
  }
  stop() {
    this.revision += 1;
    return this.detach();
  }
}
