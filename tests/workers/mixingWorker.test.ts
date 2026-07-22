import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mixerInstances: any[] = [];

const wasmMock = vi.hoisted(() => {
  const instances: any[] = [];

  // Mimic an embind std::vector: an array-like carrying wrapped methods as own
  // properties. Structured clone rejects it (DataCloneError), so the worker must
  // re-root it with Array.from() before it reaches the postMessage payload.
  function embindArray<T>(items: T[]): T[] {
    const arr: any = {
      length: items.length,
      get(i: number) {
        return this[i];
      },
      size() {
        return this.length;
      },
      delete() {},
    };
    items.forEach((item, i) => {
      arr[i] = item;
    });
    arr[Symbol.iterator] = Array.prototype[Symbol.iterator];
    return arr as T[];
  }
  class MixerMock {
    processCalls: Array<{ left: Float32Array[]; right: Float32Array[] }> = [];
    faderAutomation: unknown[] = [];
    panAutomation: unknown[] = [];
    widthAutomation: unknown[] = [];
    deleted = false;

    constructor(
      public sceneJson: string,
      public sampleRate: number,
      public blockSize: number,
    ) {
      instances.push(this);
    }

    processStereo(leftChannels: Float32Array[], rightChannels: Float32Array[]) {
      this.processCalls.push({
        left: leftChannels.map((channel) => new Float32Array(channel)),
        right: rightChannels.map((channel) => new Float32Array(channel)),
      });
      const length = leftChannels[0]?.length ?? 0;
      const left = new Float32Array(length);
      const right = new Float32Array(length);
      for (let i = 0; i < length; i++) {
        for (const channel of leftChannels) left[i] += channel[i] || 0;
        for (const channel of rightChannels) right[i] += channel[i] || 0;
      }
      return { left, right, sampleRate: this.sampleRate };
    }

    stripMeter(index: number) {
      return {
        peakDbL: -6 - index,
        peakDbR: -7 - index,
        rmsDbL: -12 - index,
        rmsDbR: -13 - index,
        maxTruePeakDb: -5 - index,
        correlation: 0.8 - index * 0.1,
        likelyMonoCompatible: index === 0,
      };
    }

    readGoniometerLatest(index: number, maxPoints: number) {
      return embindArray([{ left: index, right: maxPoints }]);
    }

    scheduleFaderAutomation(...args: unknown[]) {
      this.faderAutomation.push(args);
    }

    schedulePanAutomation(...args: unknown[]) {
      this.panAutomation.push(args);
    }

    scheduleWidthAutomation(...args: unknown[]) {
      this.widthAutomation.push(args);
      throw new Error('ignored automation failure');
    }

    toSceneJson() {
      return JSON.stringify({ rendered: true, scene: JSON.parse(this.sceneJson) });
    }

    sceneWarnings() {
      return [];
    }

    delete() {
      this.deleted = true;
    }
  }

  return {
    instances,
    init: vi.fn(async () => undefined),
    // Mono downmix path; the worker must NOT use this for the master readout.
    lufs: vi.fn(() => ({
      integratedLufs: -15,
      momentaryLufs: -15,
      shortTermLufs: -15,
      loudnessRange: 3,
    })),
    lufsInterleaved: vi.fn(() => ({
      integratedLufs: -14,
      momentaryLufs: -14,
      shortTermLufs: -14,
      loudnessRange: 3,
    })),
    // Sample peak (dB) plus a small inter-sample bump so the value is distinguishable
    // from the plain peak and proves the true-peak path ran on the passed buffer.
    meteringTruePeakDb: vi.fn((samples: Float32Array) => {
      let max = 0;
      for (const value of samples) max = Math.max(max, Math.abs(value));
      return max > 0 ? 20 * Math.log10(max) + 0.5 : -120;
    }),
    Mixer: {
      fromSceneJson: vi.fn(
        (json: string, sampleRate = 48_000, blockSize = 512) =>
          new MixerMock(json, sampleRate, blockSize),
      ),
    },
  };
});

vi.mock('@/wasm/index.js', () => wasmMock);

function track(overrides: Record<string, unknown> = {}) {
  return {
    id: 'a',
    name: 'A',
    left: new Float32Array([0.5, 0.5]),
    right: new Float32Array([0.25, 0.25]),
    offsetSeconds: 0,
    inputTrimDb: 0,
    faderDb: 0,
    pan: 0,
    width: 1,
    muted: false,
    soloed: false,
    soloSafe: false,
    polarityLeft: false,
    polarityRight: false,
    automation: [],
    ...overrides,
  };
}

describe('mixing worker protocol', () => {
  let originalSelf: typeof globalThis.self;
  let posted: Array<{ message: unknown; transfer?: Transferable[] }>;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    wasmMock.instances.length = 0;
    mixerInstances.length = 0;
    posted = [];
    originalSelf = globalThis.self;
    Object.defineProperty(globalThis, 'self', {
      configurable: true,
      value: {
        postMessage: vi.fn((message: unknown, transfer?: Transferable[]) => {
          posted.push({ message, transfer });
        }),
      },
    });
    await import('@/workers/mixing.worker.ts');
  });

  afterEach(() => {
    Object.defineProperty(globalThis, 'self', {
      configurable: true,
      value: originalSelf,
    });
  });

  it('bounces active tracks with offsets, automation, meters and master fader', async () => {
    await (self as any).onmessage({
      data: {
        type: 'mixBounce',
        id: 1,
        sampleRate: 10,
        masterFaderDb: -6,
        tracks: [
          track({
            id: 'solo',
            name: 'Solo',
            soloed: true,
            automation: [
              { param: 'fader', timeSec: 0.1, value: -3, curve: 'linear' },
              { param: 'pan', timeSec: 0.2, value: 0.5, curve: 's-curve' },
              { param: 'width', timeSec: 0.3, value: 1.2, curve: 'hold' },
            ],
          }),
          track({
            id: 'safe',
            name: 'Safe',
            soloSafe: true,
            offsetSeconds: 0.2,
            left: new Float32Array([0.25, 0.25]),
            right: new Float32Array([0.1, 0.1]),
          }),
          track({ id: 'muted-out', name: 'Muted out', muted: true }),
        ],
        reverb: { enabled: false, decaySec: 2, preDelayMs: 20 },
        vcaGroups: [{ id: 'A', gainDb: 0 }],
      },
    });

    expect(wasmMock.init).toHaveBeenCalledTimes(1);
    expect(wasmMock.Mixer.fromSceneJson).toHaveBeenCalledWith(expect.any(String), 10, 512);
    const mixer = wasmMock.instances[0];
    expect(mixer.faderAutomation).toEqual([[0, 1, -3, 'linear']]);
    expect(mixer.panAutomation).toEqual([[0, 2, 0.5, 's-curve']]);
    expect(mixer.widthAutomation).toEqual([[0, 3, 1.2, 'hold']]);
    expect(mixer.processCalls).toHaveLength(1);
    expect(Array.from(mixer.processCalls[0].left[0].slice(0, 4))).toEqual([0.5, 0.5, 0, 0]);
    expect(Array.from(mixer.processCalls[0].left[1].slice(0, 4))).toEqual([0, 0, 0.25, 0.25]);
    expect(mixer.deleted).toBe(true);

    const done = posted.at(-1)!;
    expect(done.message).toMatchObject({
      type: 'done',
      id: 1,
      result: {
        sampleRate: 10,
        duration: 0.4,
        integratedLufs: -14,
        truePeakDb: expect.closeTo(20 * Math.log10(0.5 * 10 ** (-6 / 20)) + 0.5, 3),
        stripMeters: [
          {
            id: 'solo',
            name: 'Solo',
            peakDb: -6,
            rmsDb: -12,
            truePeakDb: -5,
            correlation: 0.8,
            monoCompatible: true,
            goniometer: [{ left: 0, right: 96 }],
          },
          {
            id: 'safe',
            name: 'Safe',
            peakDb: -7,
            rmsDb: -13,
            truePeakDb: -6,
            correlation: expect.closeTo(0.7),
            monoCompatible: false,
            goniometer: [{ left: 1, right: 96 }],
          },
        ],
      },
    });
    const result = (done.message as any).result;
    expect(result.left).toBeInstanceOf(Float32Array);
    expect(result.left).toHaveLength(4);
    expect(result.left[0]).toBeCloseTo(0.5 * 10 ** (-6 / 20), 6);
    expect(JSON.parse(result.sceneJson).rendered).toBe(true);
    expect(done.transfer).toEqual([result.left.buffer, result.right.buffer]);
  });

  it('returns empty results when all tracks are muted or silent length', async () => {
    await (self as any).onmessage({
      data: {
        type: 'mixBounce',
        id: 2,
        sampleRate: 48_000,
        masterFaderDb: 0,
        tracks: [track({ muted: true })],
        reverb: { enabled: false, decaySec: 2, preDelayMs: 20 },
        vcaGroups: [],
      },
    });

    expect(wasmMock.Mixer.fromSceneJson).not.toHaveBeenCalled();
    expect(posted.at(-1)?.message).toMatchObject({
      type: 'done',
      id: 2,
      result: {
        duration: 2 / 48_000,
        sceneJson: '',
        peakDb: -120,
        rmsDb: -120,
        integratedLufs: -120,
        truePeakDb: -120,
        correlation: 0,
      },
    });
  });

  it('posts recoverable errors when the mixer throws', async () => {
    wasmMock.Mixer.fromSceneJson.mockImplementationOnce(() => {
      throw new Error('bad scene');
    });

    await (self as any).onmessage({
      data: {
        type: 'mixBounce',
        id: 3,
        sampleRate: 48_000,
        masterFaderDb: 0,
        tracks: [track()],
        reverb: { enabled: false, decaySec: 2, preDelayMs: 20 },
        vcaGroups: [],
      },
    });

    expect(posted.at(-1)?.message).toEqual({
      type: 'error',
      id: 3,
      error: 'bad scene',
      recoverable: true,
    });
  });

  it('produces a done payload that survives structuredClone with goniometer data', async () => {
    await (self as any).onmessage({
      data: {
        type: 'mixBounce',
        id: 5,
        sampleRate: 10,
        masterFaderDb: 0,
        tracks: [track({ soloed: true })],
        reverb: { enabled: false, decaySec: 2, preDelayMs: 20 },
        vcaGroups: [],
      },
    });

    const done = posted.at(-1)!;
    expect((done.message as any).type).toBe('done');
    const goniometer = (done.message as any).result.stripMeters[0].goniometer;
    expect(goniometer.length).toBeGreaterThan(0);
    // The raw embind array is not structured-cloneable; the worker's Array.from()
    // must have re-rooted it so the whole payload clones cleanly.
    expect(() => structuredClone(done.message)).not.toThrow();
    expect(structuredClone(done.message).result.stripMeters[0].goniometer).toEqual(goniometer);
  });

  it('measures integrated loudness from the interleaved stereo output', async () => {
    await (self as any).onmessage({
      data: {
        type: 'mixBounce',
        id: 6,
        sampleRate: 10,
        masterFaderDb: 0,
        tracks: [track({ soloed: true })],
        reverb: { enabled: false, decaySec: 2, preDelayMs: 20 },
        vcaGroups: [],
      },
    });

    expect(wasmMock.lufsInterleaved).toHaveBeenCalledTimes(1);
    const [buffer, channels, sr] = wasmMock.lufsInterleaved.mock.calls[0];
    expect(buffer).toBeInstanceOf(Float32Array);
    expect(channels).toBe(2);
    expect(sr).toBe(10);
    // The mono downmix path must not be used for the master loudness readout.
    expect(wasmMock.lufs).not.toHaveBeenCalled();
    expect((posted.at(-1)!.message as any).result.integratedLufs).toBe(-14);
  });

  it('extends the render tail when reverb decay is active', async () => {
    const dry = track({
      soloed: true,
      left: new Float32Array([0.5, 0.5]),
      right: new Float32Array([0.5, 0.5]),
    });

    await (self as any).onmessage({
      data: {
        type: 'mixBounce',
        id: 7,
        sampleRate: 10,
        masterFaderDb: 0,
        tracks: [dry],
        reverb: { enabled: false, decaySec: 1, preDelayMs: 0 },
        vcaGroups: [],
      },
    });
    const dryLength = (posted.at(-1)!.message as any).result.left.length;

    await (self as any).onmessage({
      data: {
        type: 'mixBounce',
        id: 8,
        sampleRate: 10,
        masterFaderDb: 0,
        tracks: [
          track({
            soloed: true,
            left: new Float32Array([0.5, 0.5]),
            right: new Float32Array([0.5, 0.5]),
          }),
        ],
        reverb: { enabled: true, decaySec: 1, preDelayMs: 0 },
        vcaGroups: [],
      },
    });
    const wetLength = (posted.at(-1)!.message as any).result.left.length;

    expect(dryLength).toBe(2);
    // 2 dry frames + ceil(1s * 10) reverb decay tail.
    expect(wetLength).toBe(12);
    expect(wetLength).toBeGreaterThan(dryLength);
  });

  it('measures master true peak on the post-master-fader output', async () => {
    await (self as any).onmessage({
      data: {
        type: 'mixBounce',
        id: 9,
        sampleRate: 10,
        masterFaderDb: -6,
        tracks: [track({ soloed: true })],
        reverb: { enabled: false, decaySec: 2, preDelayMs: 20 },
        vcaGroups: [],
      },
    });

    // Called once for the left channel and once for the right, on the faded output.
    expect(wasmMock.meteringTruePeakDb).toHaveBeenCalledTimes(2);
    const gain = 10 ** (-6 / 20);
    const leftBuffer = wasmMock.meteringTruePeakDb.mock.calls[0][0] as Float32Array;
    expect(leftBuffer[0]).toBeCloseTo(0.5 * gain, 6);
    const result = (posted.at(-1)!.message as any).result;
    // Reflects the −6 dB master fader, not the per-strip pre-fader true peak (−5).
    expect(result.truePeakDb).toBeCloseTo(20 * Math.log10(0.5 * gain) + 0.5, 3);
    expect(result.truePeakDb).not.toBe(-5);
  });
});
