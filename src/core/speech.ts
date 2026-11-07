export interface SpeechResult { text: string; decodeMs: number }
export interface SpeechHandle {
  transcribe(pcm: Uint8Array): Promise<SpeechResult>;
  stop(): Promise<void>;
}
export interface SpeechBackend { start(signal: AbortSignal, onFailure?: (message: string) => void): Promise<SpeechHandle> }
export interface SpeechStatus {
  available: boolean;
  state: 'idle' | 'loading' | 'listening' | 'transcribing' | 'error';
  model: string;
  device: 'cpu' | 'cuda';
  decodeMs: number | null;
  dropped: number;
}
export interface Utterance {
  sequence: number;
  revision: number;
  startMs: number;
  endMs: number;
  pcm: Uint8Array;
  isFinal: boolean;
}

const FRAME_BYTES = 640; // 20 ms of mono PCM s16le/16 kHz.
const PRE_ROLL = 10;
export class UtteranceSegmenter {
  private tail = Buffer.alloc(0);
  private preRoll: Buffer[] = [];
  private frames: Buffer[] = [];
  private clockMs = 0;
  private startMs = 0;
  private silenceFrames = 0;
  private sequence = 0;
  private revision = 0;
  constructor(private emit: (utterance: Utterance) => void) {}
  push(input: Uint8Array) {
    const data = Buffer.concat([this.tail, input]);
    let offset = 0;
    while (offset + FRAME_BYTES <= data.length) {
      this.frame(data.subarray(offset, offset + FRAME_BYTES)); offset += FRAME_BYTES;
    }
    this.tail = Buffer.from(data.subarray(offset));
  }
  private frame(input: Buffer) {
    this.clockMs += 20;
    let energy = 0;
    for (let i = 0; i < input.length; i += 2) { const sample = input.readInt16LE(i) / 32768; energy += sample * sample; }
    const voiced = Math.sqrt(energy / 320) >= 0.008;
    if (!this.frames.length && !voiced) {
      this.preRoll.push(Buffer.from(input));
      if (this.preRoll.length > PRE_ROLL) this.preRoll.shift();
      return;
    }
    if (!this.frames.length) {
      this.startMs = this.clockMs - 20 - this.preRoll.length * 20;
      this.frames = this.preRoll; this.preRoll = []; this.revision = 0;
    }
    this.frames.push(Buffer.from(input));
    this.silenceFrames = voiced ? 0 : this.silenceFrames + 1;
    const final = this.silenceFrames >= 25 || this.frames.length >= 300;
    if (final || this.frames.length % 100 === 0) {
      this.emit({ sequence: this.sequence, revision: ++this.revision, startMs: this.startMs,
        endMs: this.clockMs, pcm: Buffer.concat(this.frames), isFinal: final });
    }
    if (final) {
      this.preRoll = this.frames.slice(-PRE_ROLL); this.frames = [];
      this.silenceFrames = 0; this.sequence += 1;
    }
  }
}

// One inference plus one bounded pending window. Superseded windows are reported, not accumulated.
export class CaptionPipeline {
  private pending: Utterance | null = null;
  private running = false;
  private stopped = false;
  private newestSequence = -1;
  private dropped = 0;
  constructor(private speech: SpeechHandle,
    private result: (utterance: Utterance, result: SpeechResult) => void,
    private failure: (message: string) => void,
    private status: (transcribing: boolean, dropped: number) => void) {}
  submit(utterance: Utterance) {
    if (this.stopped) return;
    this.newestSequence = Math.max(this.newestSequence, utterance.sequence);
    if (this.pending && this.pending.sequence !== utterance.sequence) this.dropped += 1;
    this.pending = utterance;
    this.status(true, this.dropped);
    void this.drain();
  }
  private async drain() {
    if (this.running || this.stopped) return;
    this.running = true;
    try {
      while (this.pending && !this.stopped) {
        const utterance = this.pending; this.pending = null;
        const started = performance.now();
        const answer = await this.speech.transcribe(utterance.pcm);
        if (!this.stopped && utterance.sequence === this.newestSequence && performance.now() - started <= 15000) this.result(utterance, answer);
        else if (!this.stopped) this.dropped += 1;
      }
    } catch {
      if (!this.stopped) { this.stopped = true; this.pending = null; this.failure('O reconhecimento local foi interrompido. Pause e tente novamente.'); }
    } finally { this.running = false; if (!this.stopped) this.status(false, this.dropped); }
  }
  stop() { this.stopped = true; this.pending = null; }
}
