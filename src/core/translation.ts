export interface TranslationResult {
  text: string;
  decodeMs: number;
}
export interface TranslationHandle {
  translate(text: string): Promise<TranslationResult>;
  stop(): Promise<void>;
}
export interface TranslationBackend {
  start(signal: AbortSignal, onFailure?: (message: string) => void): Promise<TranslationHandle>;
}
export interface TranslationRequest {
  generation: number;
  segmentId: string;
  revision: number;
  text: string;
}
export interface TranslationStatus {
  available: boolean;
  state: 'disabled' | 'idle' | 'loading' | 'translating' | 'ready' | 'error';
  error: string | null;
  decodeMs: number | null;
}

// Translation never blocks ASR: one active request and only the latest pending revision.
export class TranslationPipeline {
  private abort = new AbortController();
  private handle?: TranslationHandle;
  private pending: { request: TranslationRequest; token: number } | null = null;
  private token = 0;
  private running = false;
  private stopped = false;
  private failed = false;
  private task: Promise<void> = Promise.resolve();
  private cache = new Map<string, TranslationResult>();
  constructor(
    private backend: TranslationBackend,
    private result: (request: TranslationRequest, result: TranslationResult) => void,
    private status: (state: TranslationStatus['state'], error?: string) => void,
  ) {}
  submit(request: TranslationRequest) {
    if (this.stopped || this.failed) return;
    const token = ++this.token;
    this.pending = request.text.trim() ? { request, token } : null;
    if (!this.pending) {
      this.status('idle');
      return;
    }
    this.status(this.handle ? 'translating' : 'loading');
    if (!this.running) this.task = this.drain();
  }
  private fail() {
    if (this.stopped || this.failed) return;
    this.failed = true;
    this.pending = null;
    this.abort.abort();
    this.status(
      'error',
      'Tradução local indisponível. A transcrição continua; pause e retome para tentar novamente.',
    );
  }
  private async drain() {
    this.running = true;
    try {
      if (!this.handle) {
        const handle = await this.backend.start(this.abort.signal, () => this.fail());
        this.handle = handle;
        if (this.stopped || this.failed) {
          await handle.stop();
          return;
        }
      }
      while (this.pending && !this.stopped && !this.failed) {
        const { request, token } = this.pending;
        this.pending = null;
        this.status('translating');
        let translated = this.cache.get(request.text);
        if (!translated) {
          translated = await this.handle.translate(request.text);
          if (!translated.text.trim()) throw new Error('empty translation');
          this.cache.set(request.text, translated);
          if (this.cache.size > 64) this.cache.delete(this.cache.keys().next().value!);
        }
        if (!this.stopped && !this.failed && token === this.token) {
          this.result(request, translated);
          this.status('ready');
        }
      }
    } catch {
      this.fail();
    } finally {
      this.running = false;
    }
  }
  async stop() {
    this.stopped = true;
    this.token += 1;
    this.pending = null;
    this.cache.clear();
    this.abort.abort();
    await this.task;
    await this.handle?.stop();
  }
}
