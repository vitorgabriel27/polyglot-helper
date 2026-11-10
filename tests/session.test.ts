import { describe, expect, it } from 'vitest';
import { defaults } from '../src/core/preferences';
import { Session } from '../src/core/session';
import { isCommand, type Segment } from '../src/core/contracts';
const segment = (generation: number, revision = 1): Segment => ({
  generation,
  revision,
  segmentId: 'one',
  sequence: 0,
  startMs: 0,
  endMs: 1000,
  text: 'Hello',
  translation: 'Olá',
  pronunciation: '',
  isFinal: false,
});
describe('simulation lifecycle', () => {
  it('keeps a bounded final-segment history with timestamps and later translations', () => {
    const session = new Session();
    const generation = session.start();
    session.ready(generation);
    for (let sequence = 0; sequence < 105; sequence++) {
      expect(
        session.accept({
          ...segment(generation),
          segmentId: `segment-${sequence}`,
          sequence,
          startMs: sequence * 1000,
          endMs: (sequence + 1) * 1000,
          isFinal: true,
        }),
      ).toBe(true);
    }
    expect(session.recentSegments).toHaveLength(100);
    expect(session.recentSegments[0].startMs).toBe(5000);
    const last = session.recentSegments.at(-1)!;
    expect(
      session.applyTranslation(
        {
          generation,
          segmentId: last.segmentId,
          revision: last.revision,
          text: last.text,
        },
        'Translated',
      ),
    ).toBe(true);
    expect(session.recentSegments.at(-1)?.translation).toBe('Translated');
  });
  it('rejects an old provider after pause and restart', () => {
    const session = new Session();
    const old = session.start();
    session.ready(old);
    session.pause();
    const current = session.start();
    session.ready(current);
    expect(session.accept(segment(old))).toBe(false);
    expect(session.accept(segment(current))).toBe(true);
  });
  it('ignores out-of-order and post-final revisions', () => {
    const session = new Session();
    const generation = session.start();
    session.ready(generation);
    expect(session.accept(segment(generation, 2))).toBe(true);
    expect(session.accept(segment(generation, 1))).toBe(false);
    expect(session.accept({ ...segment(generation, 3), isFinal: true })).toBe(true);
    expect(session.accept(segment(generation, 4))).toBe(false);
  });
  it('rejects a late segment from earlier in the same generation', () => {
    const session = new Session();
    const generation = session.start();
    session.ready(generation);
    session.accept({ ...segment(generation), segmentId: 'two', sequence: 2 });
    expect(session.accept(segment(generation))).toBe(false);
  });
  it('invalidates startup and results when stopped', () => {
    const session = new Session();
    const generation = session.start();
    session.stop();
    expect(session.ready(generation)).toBe(false);
    expect(session.accept(segment(generation))).toBe(false);
    expect(session.state).toBe('stopping');
    session.finishStop();
    expect(session.state).toBe('idle');
    expect(session.segment).toBeNull();
  });
  it('tracks reconnect and stop transitions while invalidating stale generations', () => {
    const session = new Session();
    const generation = session.start();
    session.ready(generation);
    expect(session.reconnect(generation)).toBe(true);
    expect(session.state).toBe('reconnecting');
    expect(session.reconnected(generation)).toBe(true);
    expect(session.state).toBe('listening');
    session.stop();
    expect(session.state).toBe('stopping');
    expect(session.ready(generation)).toBe(false);
    expect(session.finishStop()).toBe(true);
    expect(session.state).toBe('idle');
  });
});
describe('IPC command boundary', () => {
  it('rejects arbitrary operations, unexpected arguments and invalid preferences', () => {
    for (const input of [
      { type: 'fit-notch', height: NaN },
      { type: 'fit-notch', height: 10000 },
      null,
      'quit',
      { type: 'shell', value: 'ls' },
      { type: 'quit', value: true },
      { type: 'preferences', value: { translation: true, pronunciation: false, fontSize: '999' } },
      {
        type: 'preferences',
        value: { translation: true, pronunciation: false, fontSize: 'normal', token: 'secret' },
      },
    ])
      expect(isCommand(input)).toBe(false);
    expect(
      isCommand({
        type: 'configure',
        value: {
          ...defaults(),
          preferences: {
            translation: true,
            pronunciation: false,
            fontSize: 'large',
            sourceLanguage: 'en-US',
            targetLanguage: 'pt-BR',
          },
        },
      }),
    ).toBe(true);
    expect(isCommand({ type: 'toggle-session' })).toBe(true);
  });
});
