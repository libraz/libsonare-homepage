import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { effectScope } from 'vue';
import {
  SCOPE_TAP_FFT_SIZE,
  SCOPE_TAP_MAX_POINTS,
  type ScopeTapWasm,
  useScopeTap,
} from '@/composables/useScopeTap';

function installFrameQueue() {
  let queue: Array<{ id: number; cb: FrameRequestCallback }> = [];
  let nextId = 1;
  const cancel = vi.fn((id: number) => {
    queue = queue.filter((entry) => entry.id !== id);
  });
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    const id = nextId++;
    queue.push({ id, cb });
    return id;
  });
  vi.stubGlobal('cancelAnimationFrame', cancel);
  return {
    cancel,
    flush(timeMs: number) {
      const run = queue;
      queue = [];
      for (const entry of run) entry.cb(timeMs);
    },
    get pending() {
      return queue.length;
    },
  };
}

function fakeNode() {
  return { connect: vi.fn(), disconnect: vi.fn() };
}

function fakeGraph(leftValue = 0.2, rightValue = 0.4) {
  const splitter = fakeNode();
  const analysers = [leftValue, rightValue].map((value) => ({
    ...fakeNode(),
    fftSize: 2048,
    getFloatTimeDomainData: vi.fn((out: Float32Array) => out.fill(value)),
  }));
  let made = 0;
  const context = {
    sampleRate: 48000,
    createChannelSplitter: vi.fn(() => splitter),
    createAnalyser: vi.fn(() => analysers[made++]),
  };
  const source = fakeNode();
  return { context, source, splitter, analysers };
}

function fakeWasm() {
  const frequencies = Float32Array.of(0, 11.71875);
  const meteringSpectrumFrame = vi.fn((request: { samples: Float32Array }) => ({
    frequencies,
    magnitude: new Float32Array(2),
    power: new Float32Array(2),
    db: Float32Array.of(request.samples[0], -120),
    nFft: SCOPE_TAP_FFT_SIZE,
    sampleRate: 48000,
  }));
  const meteringPhaseScope = vi.fn(() => ({
    mid: Float32Array.of(0.1, 0.2),
    side: Float32Array.of(0, 0.05),
    radius: new Float32Array(2),
    angleRad: new Float32Array(2),
    correlation: 0.87,
    averageAbsAngleRad: 0,
    maxRadius: 0.2,
  }));
  return {
    wasm: { meteringSpectrumFrame, meteringPhaseScope } as unknown as ScopeTapWasm,
    meteringSpectrumFrame,
    meteringPhaseScope,
  };
}

function startTap(
  graph: ReturnType<typeof fakeGraph>,
  wasm: ScopeTapWasm,
  spectrum?: 'mid' | 'stereo',
) {
  return useScopeTap(
    graph.context as unknown as AudioContext,
    graph.source as unknown as AudioNode,
    {
      wasm,
      spectrum,
    },
  );
}

function setHidden(hidden: boolean) {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
  document.dispatchEvent(new Event('visibilitychange'));
}

function setReducedMotion(matches: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
}

describe('useScopeTap', () => {
  let frames: ReturnType<typeof installFrameQueue>;

  beforeEach(() => {
    frames = installFrameQueue();
    setHidden(false);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    setHidden(false);
  });

  it('wires source → splitter → two 4096-point analysers', () => {
    const graph = fakeGraph();
    const { wasm } = fakeWasm();
    const tap = startTap(graph, wasm);

    expect(graph.context.createChannelSplitter).toHaveBeenCalledWith(2);
    expect(graph.source.connect).toHaveBeenCalledWith(graph.splitter);
    expect(graph.splitter.connect).toHaveBeenCalledWith(graph.analysers[0], 0);
    expect(graph.splitter.connect).toHaveBeenCalledWith(graph.analysers[1], 1);
    expect(graph.analysers.map((a) => a.fftSize)).toEqual([4096, 4096]);
    expect(tap.spectrum.value).toBeNull();
    expect(tap.scope.value).toBeNull();
    tap.dispose();
  });

  it('hands the analyser windows to the engine each frame (mid spectrum)', () => {
    const graph = fakeGraph(0.2, 0.4);
    const fake = fakeWasm();
    const tap = startTap(graph, fake.wasm);
    frames.flush(16);

    expect(fake.meteringSpectrumFrame).toHaveBeenCalledTimes(1);
    const spectrumRequest = fake.meteringSpectrumFrame.mock.calls[0][0] as Record<string, unknown>;
    expect(spectrumRequest).toMatchObject({ sampleRate: 48000, nFft: 4096, frameOffset: 0 });
    const samples = spectrumRequest.samples as Float32Array;
    expect(samples).toHaveLength(SCOPE_TAP_FFT_SIZE);
    expect(samples[0]).toBeCloseTo(0.3, 6);

    expect(fake.meteringPhaseScope).toHaveBeenCalledTimes(1);
    const phaseRequest = (fake.meteringPhaseScope.mock.calls[0] as unknown[])[0] as Record<
      string,
      unknown
    >;
    expect(phaseRequest).toMatchObject({ sampleRate: 48000, maxPoints: SCOPE_TAP_MAX_POINTS });
    expect((phaseRequest.left as Float32Array)[100]).toBeCloseTo(0.2, 6);
    expect((phaseRequest.right as Float32Array)[100]).toBeCloseTo(0.4, 6);

    expect(tap.spectrum.value?.db).toHaveLength(1);
    expect(tap.spectrum.value?.freqs[1]).toBeCloseTo(11.71875);
    expect(tap.scope.value?.correlation).toBe(0.87);
    expect(Array.from(tap.scope.value?.mid ?? [])).toHaveLength(2);
    expect(frames.pending).toBe(1);
    tap.dispose();
  });

  it('analyses L and R separately in stereo mode', () => {
    const graph = fakeGraph(0.2, 0.4);
    const fake = fakeWasm();
    const tap = startTap(graph, fake.wasm, 'stereo');
    frames.flush(16);
    expect(fake.meteringSpectrumFrame).toHaveBeenCalledTimes(2);
    expect(tap.spectrum.value?.db.map((d) => d[0])).toEqual([
      expect.closeTo(0.2, 6),
      expect.closeTo(0.4, 6),
    ]);
    tap.dispose();
  });

  it('drops to 4 Hz under prefers-reduced-motion', () => {
    setReducedMotion(true);
    const graph = fakeGraph();
    const fake = fakeWasm();
    const tap = startTap(graph, fake.wasm);
    for (const t of [0, 100, 200, 260, 400, 510]) frames.flush(t);
    expect(fake.meteringPhaseScope).toHaveBeenCalledTimes(3);
    tap.dispose();
  });

  it('pauses while the document is hidden and resumes when visible', () => {
    const graph = fakeGraph();
    const fake = fakeWasm();
    const tap = startTap(graph, fake.wasm);
    setHidden(true);
    expect(frames.pending).toBe(0);
    frames.flush(16);
    expect(fake.meteringPhaseScope).not.toHaveBeenCalled();

    setHidden(false);
    expect(frames.pending).toBe(1);
    frames.flush(32);
    expect(fake.meteringPhaseScope).toHaveBeenCalledTimes(1);
    tap.dispose();
  });

  it('dispose stops the loop and disconnects only its own nodes', () => {
    const graph = fakeGraph();
    const fake = fakeWasm();
    const tap = startTap(graph, fake.wasm);
    tap.dispose();
    tap.dispose();

    expect(frames.cancel).toHaveBeenCalledTimes(1);
    expect(frames.pending).toBe(0);
    expect(graph.source.disconnect).toHaveBeenCalledTimes(1);
    expect(graph.source.disconnect).toHaveBeenCalledWith(graph.splitter);
    expect(graph.splitter.disconnect).toHaveBeenCalledTimes(1);
    for (const analyser of graph.analysers) expect(analyser.disconnect).toHaveBeenCalledTimes(1);

    setHidden(false);
    expect(frames.pending).toBe(0);
    frames.flush(16);
    expect(fake.meteringSpectrumFrame).not.toHaveBeenCalled();
  });

  it('disposes with the owning effect scope', () => {
    const graph = fakeGraph();
    const fake = fakeWasm();
    const scope = effectScope();
    scope.run(() => startTap(graph, fake.wasm));
    scope.stop();
    expect(graph.splitter.disconnect).toHaveBeenCalledTimes(1);
    expect(frames.pending).toBe(0);
  });
});
