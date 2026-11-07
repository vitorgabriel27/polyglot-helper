import { describe, expect, it } from 'vitest';
import { CaptureManager, emptyMetrics, type AudioBackend, type CaptureHandle } from '../src/core/audio';
import { PcmMeter } from '../src/adapters/audio/meter';
import { parseSources } from '../src/adapters/audio/pipewire';

function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(r => { resolve = r; }); return { promise, resolve }; }
describe('local PCM and source identity', () => {
  it('preserves odd-byte samples and normalizes signed s16le', () => {
    const meter = new PcmMeter();
    expect(meter.push(Uint8Array.of(0)).samples).toBe(0);
    const metrics = meter.push(Uint8Array.of(128, 0, 64)); // -1, +0.5
    expect(metrics.samples).toBe(2);
    expect(metrics.peak).toBe(1);
    expect(metrics.rms).toBeCloseTo(Math.sqrt(0.625));
    expect(metrics.durationMs).toBe(0.125);
  });
  it('uses stable node names instead of ephemeral PipeWire IDs and excludes clients', () => {
    const input = [
      { id: 5, type: 'PipeWire:Interface:Node', info: { props: { 'node.name': 'output', 'node.description': 'Speakers', 'media.class': 'Audio/Sink' } } },
      { id: 7, type: 'PipeWire:Interface:Node', info: { props: { 'node.name': 'input', 'media.class': 'Audio/Source' } } },
      { id: 8, type: 'PipeWire:Interface:Node', info: { props: { 'node.name': 'client', 'media.class': 'Stream/Input/Audio' } } },
    ];
    const sources = parseSources(input);
    expect(sources).toHaveLength(2);
    expect(sources.find(source => source.kind === 'system')?.id).toBe('pipewire:output');
  });
});
describe('capture cancellation', () => {
  it('stops a late handle and suppresses updates after cancellation', async () => {
    const ready = deferred<CaptureHandle>();
    let emit!: (data: ReturnType<typeof emptyMetrics>) => void;
    let stops = 0, updates = 0;
    const backend: AudioBackend = { listSources: async () => [], start: async (_id, _signal, onMetrics) => { emit = onMetrics; return ready.promise; } };
    const capture = new CaptureManager(backend);
    const starting = capture.start('one', () => { updates += 1; }, () => {});
    await Promise.resolve(); await Promise.resolve();
    const stopping = capture.stop();
    emit(emptyMetrics());
    ready.resolve({ stop: async () => { stops += 1; } });
    expect(await starting).toBe(false);
    await stopping;
    expect(stops).toBe(1); expect(updates).toBe(0);
  });
  it('does not start a stale request after rapid start/stop/start', async () => {
    const ids: string[] = [];
    const backend: AudioBackend = { listSources: async () => [], start: async id => { ids.push(id); return { stop: async () => {} }; } };
    const capture = new CaptureManager(backend);
    const first = capture.start('old', () => {}, () => {});
    const stopping = capture.stop();
    const current = capture.start('current', () => {}, () => {});
    await Promise.all([first, stopping, current]);
    expect(ids).toEqual(['current']);
    await capture.stop();
  });
});
