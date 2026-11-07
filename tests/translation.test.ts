import { describe, expect, it } from 'vitest';
import { Session } from '../src/core/session';
import {
  TranslationPipeline,
  type TranslationBackend,
  type TranslationResult,
} from '../src/core/translation';
const flush = () => new Promise((resolve) => setImmediate(resolve));
const request = (revision = 1, text = 'Hello') => ({
  generation: 1,
  segmentId: 'one',
  revision,
  text,
});

describe('translation identity', () => {
  it('updates a finalized caption but never applies an old revision, text or generation', () => {
    const session = new Session();
    const generation = session.start();
    session.ready(generation);
    session.accept({
      ...request(2),
      generation,
      sequence: 0,
      startMs: 0,
      endMs: 1000,
      translation: '',
      pronunciation: '',
      isFinal: true,
    });
    expect(session.applyTranslation({ ...request(1), generation }, 'antigo')).toBe(false);
    expect(session.applyTranslation({ ...request(2, 'Wrong text'), generation }, 'errado')).toBe(
      false,
    );
    expect(session.applyTranslation({ ...request(2), generation }, 'Olá')).toBe(true);
    expect(session.segment?.translation).toBe('Olá');
    session.pause();
    expect(session.applyTranslation({ ...request(2), generation }, 'atrasado')).toBe(false);
  });
});
describe('non-blocking translation queue', () => {
  it('discards a delayed translation and keeps only the current revision', async () => {
    const resolvers: ((value: TranslationResult) => void)[] = [];
    const submitted: string[] = [],
      output: string[] = [];
    const backend: TranslationBackend = {
      start: async () => ({
        stop: async () => {},
        translate: (text) => {
          submitted.push(text);
          return new Promise((resolve) => resolvers.push(resolve));
        },
      }),
    };
    const pipeline = new TranslationPipeline(
      backend,
      (_identity, answer) => output.push(answer.text),
      () => {},
    );
    pipeline.submit(request(1, 'First'));
    await flush();
    pipeline.submit(request(2, 'Second'));
    pipeline.submit(request(3, 'Latest'));
    resolvers.shift()!({ text: 'Primeira', decodeMs: 1 });
    await flush();
    expect(output).toEqual([]);
    expect(submitted).toEqual(['First', 'Latest']);
    resolvers.shift()!({ text: 'Atual', decodeMs: 1 });
    await flush();
    expect(output).toEqual(['Atual']);
    await pipeline.stop();
  });
  it('does not deliver a result after disabling and stopping translation', async () => {
    let resolve!: (value: TranslationResult) => void;
    let count = 0;
    const pipeline = new TranslationPipeline(
      {
        start: async () => ({
          stop: async () => {},
          translate: () =>
            new Promise((r) => {
              resolve = r;
            }),
        }),
      },
      () => {
        count += 1;
      },
      () => {},
    );
    pipeline.submit(request());
    await flush();
    const stopped = pipeline.stop();
    resolve({ text: 'Tarde', decodeMs: 1 });
    await stopped;
    expect(count).toBe(0);
  });
  it('fails translation independently without rejecting the caption publisher', async () => {
    const statuses: string[] = [];
    const pipeline = new TranslationPipeline(
      {
        start: async () => {
          throw new Error('model unavailable');
        },
      },
      () => {},
      (state) => statuses.push(state),
    );
    pipeline.submit(request());
    await flush();
    expect(statuses.at(-1)).toBe('error');
    await pipeline.stop();
  });
  it('reuses an exact text result without retaining an unbounded history', async () => {
    let calls = 0;
    const results: string[] = [];
    const pipeline = new TranslationPipeline(
      {
        start: async () => ({
          stop: async () => {},
          translate: async () => {
            calls += 1;
            return { text: 'Olá', decodeMs: 1 };
          },
        }),
      },
      (_identity, answer) => results.push(answer.text),
      () => {},
    );
    pipeline.submit(request(1));
    await flush();
    pipeline.submit(request(2));
    await flush();
    expect(calls).toBe(1);
    expect(results).toEqual(['Olá', 'Olá']);
    await pipeline.stop();
  });
});
