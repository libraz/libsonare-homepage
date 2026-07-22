import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useTunerEngine } from '@/composables/useTunerEngine';
import { buildDefaultSpec, renderNoteOffline } from '@/tuner/dsp/engine';
import { ENGINE_ORDER } from '@/tuner/dsp/params';

const SR = 48000;

function peak(buf: Float32Array): number {
  let p = 0;
  for (const s of buf) {
    const a = Math.abs(s);
    if (a > p) p = a;
  }
  return p;
}

describe('engine dispatch — all models play from their default spec', () => {
  for (const mode of ENGINE_ORDER) {
    it(`${mode} renders an audible note`, () => {
      const spec = buildDefaultSpec(mode);
      // A mid-register note in every instrument's range.
      const buf = renderNoteOffline(spec, 60, 100, SR, Math.round(SR * 0.5));
      expect(peak(buf)).toBeGreaterThan(0.001);
      expect(Number.isFinite(peak(buf))).toBe(true);
    });
  }
});

/**
 * Minimal Web Audio stubs that never post the worklet 'ready' message, so a
 * pending {@link useTunerEngine.start} stays parked on `await readyPromise`
 * unless dispose() settles it — the exact hang the disposed guard fixes.
 */
class FakePort {
  onmessage: ((event: MessageEvent) => void) | null = null;
  postMessage(): void {}
}
class FakeNode {
  port = new FakePort();
  connect(): void {}
  disconnect(): void {}
}
class FakeAnalyser {
  fftSize = 0;
  smoothingTimeConstant = 0;
  connect(): void {}
  disconnect(): void {}
}
class FakeAudioContext {
  state = 'suspended';
  destination = {};
  onstatechange: (() => void) | null = null;
  audioWorklet = { addModule: async () => {} };
  createAnalyser(): FakeAnalyser {
    return new FakeAnalyser();
  }
  resume(): Promise<void> {
    return Promise.resolve();
  }
  close(): Promise<void> {
    return Promise.resolve();
  }
}

describe('useTunerEngine lifecycle (M-2 disposed guard)', () => {
  const g = globalThis as unknown as Record<string, unknown>;
  const savedCtx = g.AudioContext;
  const savedNode = g.AudioWorkletNode;

  beforeEach(() => {
    g.AudioContext = FakeAudioContext;
    g.AudioWorkletNode = FakeNode;
  });
  afterEach(() => {
    g.AudioContext = savedCtx;
    g.AudioWorkletNode = savedNode;
  });

  it('dispose() settles a start() that is still awaiting the worklet ready', async () => {
    const engine = useTunerEngine();
    const started = engine.start(buildDefaultSpec('karplus-strong'));
    // Let start() advance past addModule to `await readyPromise` before unmount.
    await new Promise((r) => setTimeout(r, 0));
    await engine.dispose();
    const result = await started; // must not hang
    expect(result).toBe(false);
    expect(engine.starting.value).toBe(false);
  });

  it('start() after dispose() short-circuits instead of hanging', async () => {
    const engine = useTunerEngine();
    await engine.dispose();
    const result = await engine.start(buildDefaultSpec('karplus-strong'));
    expect(result).toBe(false);
    expect(engine.starting.value).toBe(false);
  });
});
