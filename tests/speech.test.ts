import { describe, expect, it } from 'vitest';
import { CaptionPipeline, UtteranceSegmenter, type SpeechHandle, type SpeechResult, type Utterance } from '../src/core/speech';
const voiced = (ms: number) => {
  const buffer = Buffer.alloc(ms * 32);
  for (let i = 0; i < buffer.length; i += 2) buffer.writeInt16LE(4096, i);
  return buffer;
};
const task = (sequence: number): Utterance => ({ sequence, revision: 1, startMs: 0, endMs: 2000, pcm: voiced(20), isFinal: true });
const flush = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };

describe('bounded speech windows', () => {
  it('does not submit silence and produces partial/final updates for the same utterance', () => {
    const output: Utterance[] = [];
    const segmenter = new UtteranceSegmenter(item => output.push(item));
    segmenter.push(Buffer.alloc(32000));
    expect(output).toHaveLength(0);
    segmenter.push(voiced(2000));
    expect(output[0].isFinal).toBe(false);
    segmenter.push(Buffer.alloc(16000));
    expect(output.at(-1)!.isFinal).toBe(true);
    expect(output.at(-1)!.sequence).toBe(output[0].sequence);
    expect(output.at(-1)!.revision).toBeGreaterThan(output[0].revision);
  });
  it('caps every window at six seconds even with continuous sound and odd byte boundaries', () => {
    const output: Utterance[] = [];
    const segmenter = new UtteranceSegmenter(item => output.push(item));
    const data = voiced(14000);
    segmenter.push(data.subarray(0, 1));
    segmenter.push(data.subarray(1));
    expect(output.length).toBeGreaterThan(3);
    expect(output.every(item => item.pcm.byteLength <= 192000)).toBe(true);
    expect(output.filter(item => item.isFinal).length).toBeGreaterThanOrEqual(2);
  });
});
describe('caption backpressure and cancellation', () => {
  it('keeps only the newest pending window and reports skipped segments', async () => {
    const resolvers: ((result: SpeechResult) => void)[] = [];
    const submitted: number[] = [], shown: number[] = [], drops: number[] = [];
    const handle: SpeechHandle = { stop: async () => {}, transcribe: async pcm => { submitted.push(pcm[0]); return new Promise(resolve => resolvers.push(resolve)); } };
    const pipeline = new CaptionPipeline(handle, item => shown.push(item.sequence), () => {}, (_busy, dropped) => drops.push(dropped));
    pipeline.submit(task(0)); pipeline.submit(task(1)); pipeline.submit(task(2));
    expect(submitted).toHaveLength(1);
    resolvers.shift()!({ text: 'old', decodeMs: 1 }); await flush();
    expect(submitted).toHaveLength(2);
    expect(shown).toHaveLength(0);
    resolvers.shift()!({ text: 'new', decodeMs: 1 }); await flush();
    expect(shown).toEqual([2]); expect(Math.max(...drops)).toBeGreaterThan(0);
  });
  it('never displays a result arriving after stop', async () => {
    let resolve!: (result: SpeechResult) => void;
    let updates = 0;
    const handle: SpeechHandle = { stop: async () => {}, transcribe: () => new Promise(r => { resolve = r; }) };
    const pipeline = new CaptionPipeline(handle, () => { updates += 1; }, () => {}, () => {});
    pipeline.submit(task(0)); pipeline.stop(); resolve({ text: 'late', decodeMs: 1 }); await flush();
    expect(updates).toBe(0);
  });
});
