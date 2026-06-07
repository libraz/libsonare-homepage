import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mixerInstances: any[] = [];

const wasmMock = vi.hoisted(() => {
  const instances: any[] = [];
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
      return [{ left: index, right: maxPoints }];
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
    lufs: vi.fn(() => ({
      integratedLufs: -15,
      momentaryLufs: -15,
      shortTermLufs: -15,
      loudnessRange: 3,
    })),
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
        integratedLufs: -15,
        truePeakDb: -5,
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
});
