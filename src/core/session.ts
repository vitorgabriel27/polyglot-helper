import type { Segment, SessionState } from './contracts';

// Pure lifecycle: effects live in adapters and late generations cannot change current state.
export class Session {
  state: SessionState = 'idle';
  generation = 0;
  segment: Segment | null = null;
  recentSegments: Segment[] = [];

  start() {
    this.generation += 1;
    this.state = 'starting';
    this.segment = null;
    this.recentSegments = [];
    return this.generation;
  }
  ready(generation: number) {
    if (this.generation !== generation || this.state !== 'starting') return false;
    this.state = 'listening';
    return true;
  }
  reconnect(generation: number) {
    if (this.generation !== generation || this.state !== 'listening') return false;
    this.state = 'reconnecting';
    return true;
  }
  reconnected(generation: number) {
    if (this.generation !== generation || this.state !== 'reconnecting') return false;
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
    if (segment.isFinal) {
      const index = this.recentSegments.findIndex((item) => item.segmentId === segment.segmentId);
      if (index >= 0) this.recentSegments[index] = segment;
      else this.recentSegments.push(segment);
      this.recentSegments = this.recentSegments.slice(-3);
    }
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
    const index = this.recentSegments.findIndex((item) => item.segmentId === segment.segmentId);
    if (index >= 0) this.recentSegments[index] = this.segment;
    return true;
  }
  clearTranslation() {
    if (this.segment) this.segment = { ...this.segment, translation: '' };
  }
  fail(generation: number) {
    if (generation !== this.generation) return false;
    this.generation += 1;
    this.segment = null;
    this.recentSegments = [];
    this.state = 'error';
    return true;
  }
  pause() {
    this.generation += 1;
    this.segment = null;
    this.recentSegments = [];
    this.state = 'paused';
  }
  stop() {
    this.state = 'stopping';
    this.generation += 1;
    this.segment = null;
    this.recentSegments = [];
  }
  finishStop() {
    if (this.state !== 'stopping') return false;
    this.state = 'idle';
    return true;
  }
}
