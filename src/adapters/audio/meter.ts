import { emptyMetrics, type AudioMetrics } from '../../core/audio';

// Consumes PCM s16le in arbitrary byte boundaries; no buffers are retained as history.
export class PcmMeter {
  private carry: number | null = null;
  private total = 0;
  push(buffer: Uint8Array): AudioMetrics {
    let squareSum = 0,
      peak = 0,
      count = 0,
      offset = 0;
    const accept = (low: number, high: number) => {
      const raw = low | (high << 8);
      const value = (raw >= 32768 ? raw - 65536 : raw) / 32768;
      squareSum += value * value;
      peak = Math.max(peak, Math.abs(value));
      count += 1;
    };
    if (this.carry !== null && buffer.length) {
      accept(this.carry, buffer[0]);
      offset = 1;
      this.carry = null;
    }
    while (offset + 1 < buffer.length) {
      accept(buffer[offset], buffer[offset + 1]);
      offset += 2;
    }
    if (offset < buffer.length) this.carry = buffer[offset];
    this.total += count;
    return {
      ...emptyMetrics(),
      samples: this.total,
      durationMs: this.total / 16,
      rms: count ? Math.sqrt(squareSum / count) : 0,
      peak,
    };
  }
}
