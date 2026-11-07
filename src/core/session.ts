import type { Segment, SessionState } from './contracts';

// Pure lifecycle: effects live in adapters and late generations cannot change current state.
export class Session {
  state: SessionState = 'idle';
  generation = 0;
  segment: Segment | null = null;

  start() {
    this.generation += 1;
    this.state = 'starting';
    this.segment = null;
    return this.generation;
  }
  ready(generation: number) {
    if (this.generation !== generation || this.state !== 'starting') return false;
    this.state = 'listening';
    return true;
  }
  accept(segment: Segment) {
    if (this.state !== 'listening' || segment.generation !== this.generation) return false;
    if (this.segment && segment.sequence < this.segment.sequence) return false;
    if (
      this.segment?.segmentId === segment.segmentId &&
      (segment.revision <= this.segment.revision || this.segment.isFinal)
    )
      return false;
    this.segment = segment;
    return true;
  }
  applyTranslation(
    identity: { generation: number; segmentId: string; revision: number; text: string },
    translation: string,
  ) {
    const segment = this.segment;
    if (
      this.state !== 'listening' ||
      !segment ||
      identity.generation !== this.generation ||
      identity.segmentId !== segment.segmentId ||
      identity.revision !== segment.revision ||
      identity.text !== segment.text
    )
      return false;
    this.segment = { ...segment, translation };
    return true;
  }
  clearTranslation() {
    if (this.segment) this.segment = { ...this.segment, translation: '' };
  }
  fail(generation: number) {
    if (generation !== this.generation) return false;
    this.generation += 1;
    this.segment = null;
    this.state = 'error';
    return true;
  }
  pause() {
    this.generation += 1;
    this.segment = null;
    this.state = 'paused';
  }
  stop() {
    this.state = 'stopping';
    this.generation += 1;
    this.segment = null;
    this.state = 'idle';
  }
}
