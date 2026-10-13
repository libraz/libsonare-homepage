import { flushPromises } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { computed, effectScope } from 'vue';
import type { LoudnessFitResult } from '@/demos/mastering/masteringLoudnessFit';

const harness = vi.hoisted(() => ({
  calls: [] as Array<[string, ...unknown[]]>,
  engine: null as any,
  worker: null as any,
  downloads: [] as string[],
}));

vi.mock('vitepress', () => ({ useData: () => ({ lang: { value: 'en' } }) }));

vi.mock('@/wasm/index.js', () => ({ init: vi.fn(async () => undefined) }));

vi.mock('@/composables/useSonareEngine', async () => {
  const { ref: vueRef, shallowRef: vueShallowRef } =
    await vi.importActual<typeof import('vue')>('vue');
  return {
    useSonareEngine: () => {
      const engine = {
        setTempo: vi.fn(),
        setLoop: vi.fn(),
        resetMasterLoudnessMeter: vi.fn(),
      };
      const context = {
        sampleRate: 48000,
        decodeAudioData: vi.fn(async () => {
          const left = new Float32Array(4800).fill(0.25);
          const right = new Float32Array(4800).fill(-0.25);
          return {
            sampleRate: 48000,
            duration: 0.1,
            length: 4800,
            numberOfChannels: 2,
            getChannelData: (channel: number) => (channel === 0 ? left : right),
          };
        }),
      };
      const playing = vueRef(false);
      const sonare = {
        engine: vueShallowRef<any>(null),
        context: vueShallowRef<any>(null),
        outputNode: vueShallowRef(null),
        offlineEngine: vueShallowRef(null),
        ready: vueRef(false),
        starting: vueRef(false),
        error: vueRef(null),
        position: vueRef(0),
        playing,
        start: vi.fn(async () => {
          sonare.engine.value = engine;
          sonare.context.value = context;
          sonare.ready.value = true;
          return true;
        }),
        play: vi.fn(() => {
          playing.value = true;
        }),
        stop: vi.fn(() => {
          playing.value = false;
        }),
        seek: vi.fn(),
        onMeter: vi.fn(() => () => {}),
        dispose: vi.fn(async () => {}),
      };
      harness.engine = sonare;
      return sonare;
    },
  };
});

vi.mock('@/utils/engineApply', async () => {
  const actual = await vi.importActual<typeof import('@/utils/engineApply')>('@/utils/engineApply');
  return {
    ...actual,
    createFacadeTarget: () =>
      new Proxy(
        {},
        {
          get:
            (_target, name) =>
            (...args: unknown[]) => {
              harness.calls.push([String(name), ...args]);
            },
        },
      ),
  };
});

vi.mock('@/utils/audio', async () => {
  const actual = await vi.importActual<typeof import('@/utils/audio')>('@/utils/audio');
  return {
    ...actual,
    triggerDownload: (_url: string, name: string) => {
      harness.downloads.push(name);
    },
  };
});

vi.mock('@/demos/mastering/masteringWorkerClient', async () => {
  const actual = await vi.importActual<typeof import('@/demos/mastering/masteringWorkerClient')>(
    '@/demos/mastering/masteringWorkerClient',
  );
  const job = <T>(result: Promise<T>) => ({ result, cancel: vi.fn() });
  return {
    ...actual,
    createMasteringWorkerClient: () => {
      const worker = {
        prepare: vi.fn((registry: Map<string, any>) => {
          const source = registry.get('source');
          registry.set('program', { ...source, integratedLufs: -20 });
          return job(Promise.resolve({ stages: [] }));
        }),
        fit: vi.fn(() => job(Promise.resolve(worker.fitResult))),
        afterLufs: -14,
        measure: vi.fn((registry: Map<string, any>) => {
          const program = registry.get('program');
          registry.set('program', { ...program, integratedLufs: -20 });
          return job(Promise.resolve({ programLufs: -20, afterLufs: worker.afterLufs }));
        }),
        fitResult: {
          targetLufs: -14,
          driveDb: 5.5,
          measuredLufs: -14.05,
          residualLu: 0.05,
          bounces: 2,
          limited: false,
        } as LoudnessFitResult,
        bounce: vi.fn((registry: Map<string, any>, _state, _options, refit: boolean) => {
          const program = registry.get('program');
          registry.set('master', { ...program });
          return job(
            Promise.resolve({
              fit: refit ? worker.fitResult : null,
              integratedLufs: -14.02,
              loudnessRange: 4,
              maxMomentaryLufs: -10,
              maxShortTermLufs: -12,
              truePeakDb: -1.1,
              shortTermLufs: new Float32Array([-14, -14]),
            }),
          );
        }),
        assist: vi.fn(() =>
          job(
            Promise.resolve({
              profile: {},
              suggestions: { explanation: ['Lift the air band'] },
              chainParams: { 'spectral.airBand.amount': 0.4 },
              unmapped: [],
            }),
          ),
        ),
        analyzeReference: vi.fn(),
        detectRepair: vi.fn(() =>
          job(
            Promise.resolve({
              recommended: { dehum: { fundamentalHz: 50, harmonics: 4 } },
              defects: {},
              declipThresholdSafe: true,
            }),
          ),
        ),
        previewPlatforms: vi.fn(() => job(Promise.resolve([]))),
        dispose: vi.fn(),
      };
      harness.worker = worker;
      return worker;
    },
  };
});

import { enCopy } from '@/demos/mastering/masteringCopy';
import {
  defaultMasteringState,
  MASTERING_SLOT,
  MASTERING_STATE_STORAGE_KEY,
  masteringMutators,
  serializeMasteringState,
} from '@/demos/mastering/masteringState';
import { MEASURE_DELAY_MS, useMastering } from '@/demos/mastering/useMastering';

function setup() {
  const scope = effectScope();
  const m = scope.run(() => useMastering({ copy: computed(() => enCopy) }))!;
  return {
    m,
    stop: () => {
      m.dispose();
      scope.stop();
    },
  };
}

const file = () => new File([new Uint8Array(8)], 'mix.wav', { type: 'audio/wav' });
const opNames = () => harness.calls.map((call) => call[0]);

async function loaded() {
  const context = setup();
  await context.m.loadSource(file());
  await flushPromises();
  harness.calls.length = 0;
  return context;
}

describe('useMastering', () => {
  beforeEach(() => {
    if (harness.worker) harness.worker.afterLufs = -14;
    harness.calls.length = 0;
    harness.downloads.length = 0;
    localStorage.clear();
    globalThis.URL.createObjectURL = vi.fn(() => 'blob:test');
    globalThis.URL.revokeObjectURL = vi.fn();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('keeps edits off the engine until audio is loaded, then builds the whole project', async () => {
    const { m, stop } = setup();
    m.edit('setInsertParam', MASTERING_SLOT.compressor, 'thresholdDb', -24);
    expect(harness.calls).toEqual([]);
    expect(m.state.value.inserts[MASTERING_SLOT.compressor].params.thresholdDb).toBe(-24);

    await m.loadSource(file());
    await flushPromises();
    expect(harness.engine.engine.value.setTempo).toHaveBeenCalledWith(60);
    expect(opNames()).toContain('setTopology');
    expect(opNames()).toContain('setStripJson');
    expect(opNames().filter((name) => name === 'setTrackClips')).toHaveLength(3);
    expect(m.hasProgram.value).toBe(true);
    expect(m.sourceInfo.value?.fileName).toBe('mix.wav');
    // Settings made before the audio survive the load; the undo history does not.
    expect(m.state.value.inserts[MASTERING_SLOT.compressor].params.thresholdDb).toBe(-24);
    expect(m.canUndo.value).toBe(false);
    stop();
  });

  it('sends a continuous edit as one by-name parameter and a drag as one history entry', async () => {
    const { m, stop } = await loaded();
    m.begin();
    m.edit('setInsertParam', MASTERING_SLOT.compressor, 'ratio', 3);
    m.edit('setInsertParam', MASTERING_SLOT.compressor, 'ratio', 4);
    m.end();
    const params = harness.calls.filter((call) => call[0] === 'setInsertParam');
    expect(params).toHaveLength(2);
    expect(params.at(-1)).toEqual([
      'setInsertParam',
      { kind: 'track', trackId: 1 },
      MASTERING_SLOT.compressor,
      'ratio',
      4,
    ]);
    expect(m.resetFlash.value).toBe(0);
    m.undo();
    expect(m.state.value.inserts[MASTERING_SLOT.compressor].params.ratio).toBe(
      defaultMasteringState().inserts[MASTERING_SLOT.compressor].params.ratio,
    );
    expect(m.canUndo.value).toBe(false);
    stop();
  });

  it('rebuilds the strip for a parameter that is not realtime-safe and flags the rebuild', async () => {
    const { m, stop } = await loaded();
    m.edit('setInsertParam', MASTERING_SLOT.multiband, 'cutoff0Hz', 300);
    expect(opNames()).toContain('setStripJson');
    expect(opNames()).not.toContain('setInsertParam');
    expect(m.resetFlash.value).toBeGreaterThan(0);
    stop();
  });

  it('switches A/B/R with lane faders, and refuses the reference lane without a reference', async () => {
    const { m, stop } = await loaded();
    m.setLane('reference');
    expect(m.state.value.monitor.lane).toBe('after');
    m.setLane('before');
    expect(m.state.value.monitor.lane).toBe('before');
    const faders = harness.calls.filter((call) => call[0] === 'setFader');
    expect(faders).toEqual(
      expect.arrayContaining([
        ['setFader', 1, -120],
        ['setFader', 2, 0],
      ]),
    );
    stop();
  });

  it('locks edits while the loudness fit runs and writes the fitted drive back', async () => {
    const { m, stop } = await loaded();
    let resolve!: (value: LoudnessFitResult) => void;
    harness.worker.fit.mockImplementationOnce(() => ({
      result: new Promise<LoudnessFitResult>((done) => {
        resolve = done;
      }),
      cancel: vi.fn(),
    }));
    expect(m.fitStale.value).toBe(true);
    const fitting = m.fit();
    await flushPromises();
    expect(m.editLocked.value).toBe(true);
    m.edit('setMacro', 'tone', 2);
    expect(m.state.value.quick.macros.tone).toBe(0);
    resolve(harness.worker.fitResult);
    await fitting;
    expect(m.editLocked.value).toBe(false);
    expect(m.state.value.inserts[MASTERING_SLOT.drive].params.levelDb).toBe(5.5);
    expect(m.fitStale.value).toBe(false);
    expect(harness.calls).toEqual(
      expect.arrayContaining([
        ['setInsertParam', { kind: 'track', trackId: 1 }, MASTERING_SLOT.drive, 'levelDb', 5.5],
      ]),
    );
    stop();
  });

  it('refits before an export when the fit is stale and keeps the refit drive', async () => {
    const { m, stop } = await loaded();
    await m.exportMaster('pcm16', 'noiseShaped');
    const [, , options, refit] = harness.worker.bounce.mock.calls.at(-1);
    expect(options).toEqual({ dither: 3, ditherBits: 16 });
    expect(refit).toBe(true);
    expect(m.fitStale.value).toBe(false);
    expect(m.lastRender.value?.format).toBe('pcm16');
    expect(harness.downloads).toEqual(['mix-master.wav']);

    await m.exportMaster('float32', 'tpdf');
    const [, , floatOptions, secondRefit] = harness.worker.bounce.mock.calls.at(-1);
    expect(floatOptions).toEqual({ dither: 0 });
    expect(secondRefit).toBe(false);
    stop();
  });

  it('reruns the repair preprocess after a repair edit, and only then', async () => {
    vi.useFakeTimers();
    const { m, stop } = await loaded();
    const before = harness.worker.prepare.mock.calls.length;
    m.edit('setMacro', 'width', 1.2);
    await vi.advanceTimersByTimeAsync(1000);
    expect(harness.worker.prepare.mock.calls.length).toBe(before);
    m.edit('setRepairStageEnabled', 'denoise', true);
    await vi.advanceTimersByTimeAsync(1000);
    expect(harness.worker.prepare.mock.calls.length).toBe(before + 1);
    expect(opNames()).toContain('setTrackClips');
    stop();
  });

  it('resets integrated loudness when playback starts', async () => {
    const { m, stop } = await loaded();
    m.play();
    expect(harness.engine.engine.value.resetMasterLoudnessMeter).toHaveBeenCalledTimes(1);
    expect(harness.engine.play).toHaveBeenCalled();
    m.togglePlay();
    expect(harness.engine.stop).toHaveBeenCalled();
    m.toggleLoop();
    expect(harness.engine.engine.value.setLoop).toHaveBeenCalledWith(0, 0.1, true);
    stop();
  });

  it('restores a saved project and waits for its audio before touching the engine', () => {
    const saved = masteringMutators.setSource(defaultMasteringState(), {
      id: 'a',
      fileName: 'old.wav',
      sampleRate: 48000,
      frames: 10,
      channels: 2,
    });
    localStorage.setItem(MASTERING_STATE_STORAGE_KEY, serializeMasteringState(saved));
    const { m, stop } = setup();
    m.restore();
    expect(m.pendingRestore.value).toBe(true);
    expect(m.state.value.source?.fileName).toBe('old.wav');
    m.edit('setMode', 'studio');
    expect(harness.calls).toEqual([]);
    stop();
  });

  it('detects repair needs on the source and applies the suggestion as one edit', async () => {
    const { m, stop } = await loaded();
    m.edit('setRepairStageEnabled', 'dereverb', true);
    await m.detectRepair();
    expect(harness.worker.detectRepair).toHaveBeenCalledTimes(1);
    expect(m.repairDetection.value?.recommended).toEqual({
      dehum: { fundamentalHz: 50, harmonics: 4 },
    });
    m.applyRepairSuggestion();
    expect(m.state.value.repair.dehum).toEqual({
      enabled: true,
      params: { fundamentalHz: 50, harmonics: 4 },
    });
    expect(m.state.value.repair.dereverb.enabled).toBe(false);
    m.undo();
    expect(m.state.value.repair.dehum.enabled).toBe(false);
    expect(m.state.value.repair.dereverb.enabled).toBe(true);
    stop();
  });

  it('applies the assistant chain through the mutator', async () => {
    const { m, stop } = await loaded();
    await m.insights.analyzeSourceInsights();
    expect(m.insights.insightSuggestions.value).toEqual(['Lift the air band']);
    m.applyAssistant();
    expect(m.state.value.inserts[MASTERING_SLOT.air].params.amount).toBe(0.4);
    stop();
  });

  it('measures the lanes on load and matches A and B without waiting for a fit', async () => {
    const { m, stop } = await loaded();
    expect(harness.worker.prepare).not.toHaveBeenCalled();
    expect(harness.worker.measure).toHaveBeenCalled();
    expect(m.matchPending.value).toBe(false);
    // After (-14 LUFS) comes down to Before (-20 LUFS); the quieter lane stays at 0 dB.
    expect(m.matchGains.value.after).toBeCloseTo(-6, 6);
    expect(m.matchGains.value.before).toBe(0);
    m.setLane('before');
    expect(harness.calls).toEqual(expect.arrayContaining([['setFader', 2, 0]]));
    m.setLane('after');
    expect(harness.calls).toEqual(expect.arrayContaining([['setFader', 1, -6]]));
    stop();
  });

  it('remeasures After once edits settle and applies the new match gain', async () => {
    vi.useFakeTimers();
    const { m, stop } = await loaded();
    const measured = harness.worker.measure.mock.calls.length;
    harness.worker.afterLufs = -11;
    m.edit('setInsertParam', MASTERING_SLOT.compressor, 'makeupGainDb', 3);
    expect(m.matchPending.value).toBe(true);
    await vi.advanceTimersByTimeAsync(MEASURE_DELAY_MS / 2);
    m.edit('setInsertParam', MASTERING_SLOT.compressor, 'makeupGainDb', 4);
    await vi.advanceTimersByTimeAsync(MEASURE_DELAY_MS / 2 + 10);
    // The second edit restarted the wait.
    expect(harness.worker.measure.mock.calls.length).toBe(measured);
    await vi.advanceTimersByTimeAsync(MEASURE_DELAY_MS);
    expect(harness.worker.measure.mock.calls.length).toBe(measured + 1);
    expect(m.matchPending.value).toBe(false);
    expect(m.matchGains.value.after).toBeCloseTo(-9, 6);
    expect(harness.calls).toEqual(expect.arrayContaining([['setFader', 1, -9]]));
    stop();
  });

  it('takes the After loudness from a fit instead of measuring again', async () => {
    const { m, stop } = await loaded();
    await m.fit();
    await flushPromises();
    expect(m.matchPending.value).toBe(false);
    expect(m.matchGains.value.after).toBeCloseTo(-20 + 14.05, 6);
    stop();
  });

  it('keeps editing open while a repair preprocess runs', async () => {
    vi.useFakeTimers();
    const { m, stop } = await loaded();
    let resolve!: () => void;
    harness.worker.prepare.mockImplementationOnce((registry: Map<string, any>) => {
      const source = registry.get('source');
      return {
        result: new Promise((done) => {
          resolve = () => {
            registry.set('program', { ...source, integratedLufs: -21 });
            done({ stages: ['denoise'] });
          };
        }),
        cancel: vi.fn(),
      };
    });
    m.edit('setRepairStageEnabled', 'denoise', true);
    await vi.advanceTimersByTimeAsync(1000);
    expect(m.job.value?.kind).toBe('prepare');
    expect(m.editLocked.value).toBe(false);
    m.edit('setMacro', 'width', 1.2);
    expect(m.state.value.quick.macros.width).toBe(1.2);
    resolve();
    await vi.advanceTimersByTimeAsync(0);
    expect(m.job.value).toBeNull();
    stop();
  });
});
