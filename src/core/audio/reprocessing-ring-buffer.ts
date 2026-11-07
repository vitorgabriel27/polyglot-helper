export interface ReprocessingChunk {
  sequence: number;
  startMs: number;
  endMs: number;
  data: Uint8Array;
}

export type ReplayWindow =
  | { status: 'available'; chunks: readonly ReprocessingChunk[] }
  | { status: 'expired' }
  | { status: 'invalid_range' };

export class ReprocessingRingBuffer {
  private chunks: ReprocessingChunk[] = [];
  private bytes = 0;

  constructor(
    readonly maxDurationMs: number,
    readonly maxBytes: number,
  ) {
    if (
      !Number.isFinite(maxDurationMs) ||
      maxDurationMs <= 0 ||
      !Number.isSafeInteger(maxBytes) ||
      maxBytes <= 0
    )
      throw new Error('invalid_ring_buffer_limits');
  }

  append(chunk: ReprocessingChunk): void {
    if (chunk.endMs <= chunk.startMs || chunk.data.byteLength === 0)
      throw new Error('invalid_audio_chunk');
    const last = this.chunks.at(-1);
    if (last && (chunk.sequence <= last.sequence || chunk.startMs < last.endMs))
      throw new Error('non_monotonic_audio_chunk');
    this.chunks.push({ ...chunk, data: chunk.data.slice() });
    this.bytes += chunk.data.byteLength;
    const newestEnd = chunk.endMs;
    while (
      this.chunks.length &&
      (this.bytes > this.maxBytes || newestEnd - this.chunks[0]!.startMs > this.maxDurationMs)
    ) {
      this.bytes -= this.chunks.shift()!.data.byteLength;
    }
  }

  get retainedBytes(): number {
    return this.bytes;
  }
  get retainedDurationMs(): number {
    const first = this.chunks[0];
    const last = this.chunks.at(-1);
    return first && last ? last.endMs - first.startMs : 0;
  }

  read(startMs: number, endMs: number): ReplayWindow {
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs)
      return { status: 'invalid_range' };
    const first = this.chunks[0];
    const last = this.chunks.at(-1);
    if (!first || !last || startMs < first.startMs || endMs > last.endMs)
      return { status: 'expired' };
    const selected = this.chunks
      .filter((chunk) => chunk.endMs > startMs && chunk.startMs < endMs)
      .map((chunk) => ({ ...chunk, data: chunk.data.slice() }));
    return selected.length ? { status: 'available', chunks: selected } : { status: 'expired' };
  }

  clear(): void {
    this.chunks = [];
    this.bytes = 0;
  }
}
