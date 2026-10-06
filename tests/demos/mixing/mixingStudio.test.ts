import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { computed, effectScope, nextTick, shallowRef } from 'vue';

const harness = vi.hoisted(() => ({
  calls: [] as Array<[string, ...unknown[]]>,
  engine: null as any,
  worker: null as any,
  downloads: [] as string[],
  durationSec: 2,
  lang: { value: 'en' },
}));

vi.mock('vitepress', () => ({ useData: () => ({ lang: harness.lang }) }));

// No equalizer: EQ curves stay flat, which these tests do not look at.
vi.mock('@/wasm/index.js', () => ({
  init: vi.fn(async () => undefined),
  version: vi.fn(() => 'test-wasm'),
  StreamingEqualizer: undefined,
}));

vi.mock('@/composables/useSonareEngine', async () => {
  // The same Vue instance the page uses, so its watchers see these refs.
  const { ref: vueRef, shallowRef: vueShallowRef } = await import('vue');
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
          const left = new Float32Array(480).fill(0.25);
          const right = new Float32Array(480).fill(-0.25);
          return {
            sampleRate: 48000,
            duration: harness.durationSec,
            length: 480,
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
        setMonitorGainDb: vi.fn(),
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
    downloadBlob: (_blob: Blob, name: string) => {
      harness.downloads.push(name);
    },
  };
});

vi.mock('@/demos/mixing/mixingBounce', async () => {
  const actual = await vi.importActual<typeof import('@/demos/mixing/mixingBounce')>(
    '@/demos/mixing/mixingBounce',
  );
  function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((r) => {
      resolve = r;
    });
    return { promise, resolve };
  }
  return {
    ...actual,
    createMixWorkerClient: () => {
      const worker = {
        pending: null as null | { resolve: (value: unknown) => void },
        bounce: vi.fn((_state, _audio, sampleRate: number) => {
          const d = deferred<unknown>();
          worker.pending = d;
          return {
            result: d.promise.then(() => ({
              left: new Float32Array(4),
              right: new Float32Array(4),
              sampleRate,
              integratedLufs: -18,
              loudnessRange: 5,
              maxMomentaryLufs: -12,
              maxShortTermLufs: -14,
              truePeakDb: -1.5,
            })),
            cancel: vi.fn(),
          };
        }),
        suggest: vi.fn((state: any) => ({
          result: Promise.resolve({
            analyzedSec: 60,
            suggestion: {
              patch: { tracks: { [state.tracks[0].id]: { faderDb: -9, pan: 0.25 } } },
              unapplied: [{ source: '1', name: 'dynamics.vocalRider', reason: 'noSlot' }],
              classification: [
                { trackId: state.tracks[0].id, source: 'bass', confidence: 0.62, usable: true },
              ],
              mix: {
                trackCount: 1,
                bandDominance: [],
                alignment: [],
                crowdedBands: [],
                monoRisks: [],
              },
              explanation: ['Lowered the bass'],
            },
          }),
          cancel: vi.fn(),
        })),
        measureAB: vi.fn(() => ({
          result: Promise.resolve({ aLufs: -26, bLufs: -30 }),
          cancel: vi.fn(),
        })),
        dispose: vi.fn(),
      };
      harness.worker = worker;
      return worker;
    },
  };
});

import MixingStudio from '@/demos/mixing/MixingStudio.vue';
import { enCopy } from '@/demos/mixing/mixingCopy';
import {
  addTrack,
  createMixingState,
  serializeMixingState,
  setFader,
} from '@/demos/mixing/mixingState';
import { MIXING_STATE_STORAGE_KEY } from '@/demos/mixing/useMixingSession';
import { useMixingStudio } from '@/demos/mixing/useMixingStudio';

function setup() {
  const scope = effectScope();
  const m = scope.run(() =>
    useMixingStudio({ copy: computed(() => enCopy), wasm: shallowRef(null) }),
  )!;
  return {
    m,
    stop: () => {
      m.dispose();
      scope.stop();
    },
  };
}

const file = (name: string) => new File([new Uint8Array(8)], name, { type: 'audio/wav' });
const opNames = () => harness.calls.map((call) => call[0]);
const opsOf = (name: string) => harness.calls.filter((call) => call[0] === name);

async function loaded(names = ['Kick.wav', 'Bass.wav']) {
  const context = setup();
  await context.m.addFiles(names.map(file));
  await flushPromises();
  harness.calls.length = 0;
  return context;
}

const stops: Array<() => void> = [];

beforeEach(() => {
  harness.calls.length = 0;
  harness.downloads.length = 0;
  harness.durationSec = 2;
  harness.lang.value = 'en';
  localStorage.clear();
  globalThis.URL.createObjectURL = vi.fn(() => 'blob:test');
  globalThis.URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
  for (const stop of stops.splice(0)) stop();
});

describe('useMixingStudio', () => {
  it('builds the engine from the first audio and adds later tracks by diff', async () => {
    const { m, stop } = setup();
    stops.push(stop);
    await m.addFiles([file('Kick.wav')]);
    expect(m.state.value.tracks.map((t) => t.name)).toEqual(['Kick']);
    expect(opNames()).toContain('setTopology');
    expect(opsOf('setTrackClips')).toHaveLength(1);
    expect(harness.engine.engine.value.setTempo).toHaveBeenCalledWith(60);
    expect(m.hasAudio.value).toBe(true);

    harness.calls.length = 0;
    await m.addFiles([file('Bass.wav')]);
    expect(opsOf('setTopology')).toHaveLength(1);
    expect(opsOf('setStripJson').map((call) => call[1])).toEqual([{ kind: 'track', trackId: 2 }]);
    expect(opsOf('setTrackClips').map((call) => call[1])).toEqual([2]);
  });

  it('sends a continuous edit as its setter and folds a drag into one history entry', async () => {
    const { m, stop } = await loaded();
    stops.push(stop);
    m.begin();
    m.edit('setFader', 1, -3);
    m.edit('setFader', 1, -4.5);
    m.end();
    expect(opNames()).toEqual(['setFader', 'setFader']);
    expect(opNames()).not.toContain('setStripJson');
    m.undo();
    expect(m.state.value.tracks[0].faderDb).toBe(0);
    m.redo();
    expect(m.state.value.tracks[0].faderDb).toBe(-4.5);
  });

  it('rebuilds a strip for a construction-only parameter and flags it', async () => {
    const { m, stop } = await loaded();
    stops.push(stop);
    m.edit('setSlotParam', 2, 'gate', 'holdMs', 20);
    expect(opsOf('setStripJson').map((call) => call[1])).toEqual([{ kind: 'track', trackId: 2 }]);
    expect(m.rebuilt.value.has(2)).toBe(true);
  });

  it('applies a channel-delay edit while playing without waiting for a stop', async () => {
    const { m, stop } = await loaded();
    stops.push(stop);
    m.play();
    m.edit('setChannelDelay', 1, 2);
    const delayCalls = () =>
      opsOf('setTrackStripScalars').filter(
        (call) => (call[2] as any).channelDelaySamples !== undefined,
      );
    expect(delayCalls().map((call) => [call[1], (call[2] as any).channelDelaySamples])).toEqual([
      [1, 96],
    ]);
  });

  it('auditions a suggestion with setters only and adopts it as one entry', async () => {
    const { m, stop } = await loaded();
    stops.push(stop);
    await m.suggest();
    expect(m.suggestion.value?.analyzedSec).toBe(60);
    harness.calls.length = 0;

    m.setAb('b');
    expect(opNames().sort()).toEqual(['setFader', 'setPan']);
    expect(m.view.value.tracks[0].faderDb).toBe(-9);
    expect(m.state.value.tracks[0].faderDb).toBe(0);
    expect(m.editLocked.value).toBe(true);
    m.edit('setFader', 2, -20);
    expect(m.state.value.tracks[1].faderDb).toBe(0);

    m.setAb('a');
    expect(harness.calls.at(-1)?.[0]).toMatch(/setFader|setPan/);
    expect(m.view.value.tracks[0].faderDb).toBe(0);

    m.setAb('b');
    harness.calls.length = 0;
    m.adoptSuggestion();
    expect(opNames()).toEqual([]);
    expect(m.state.value.tracks[0].faderDb).toBe(-9);
    expect(m.suggestion.value).toBeNull();
    m.undo();
    expect(m.state.value.tracks[0].faderDb).toBe(0);
  });

  it('level-matches A and B on the monitor and returns to 0 dB when the suggestion ends', async () => {
    const { m, stop } = await loaded();
    stops.push(stop);
    const gain = harness.engine.setMonitorGainDb as ReturnType<typeof vi.fn>;
    await m.suggest();
    await flushPromises();
    expect(harness.worker.measureAB.mock.calls[0][4]).toBe(60);
    expect(m.match.value).toMatchObject({ aDb: -4, bDb: 0 });
    expect(gain).toHaveBeenLastCalledWith(-4);

    m.setAb('b');
    await nextTick();
    expect(gain).toHaveBeenLastCalledWith(0);
    m.setAb('a');
    await nextTick();
    expect(gain).toHaveBeenLastCalledWith(-4);
    expect(harness.worker.measureAB).toHaveBeenCalledTimes(1);

    m.edit('setFader', 2, -3);
    m.setAb('b');
    await flushPromises();
    expect(harness.worker.measureAB).toHaveBeenCalledTimes(2);

    m.discardSuggestion();
    await flushPromises();
    expect(m.match.value).toBeNull();
    expect(gain).toHaveBeenLastCalledWith(0);
  });

  it('locks editing while the export borrows the audio, then downloads the render', async () => {
    const { m, stop } = await loaded();
    stops.push(stop);
    const exporting = m.exportMix('pcm16', 'tpdf');
    await flushPromises();
    expect(harness.worker.bounce.mock.calls[0][3]).toEqual({ dither: 2, ditherBits: 16 });
    expect(m.editLocked.value).toBe(true);
    m.edit('setFader', 1, -6);
    expect(m.state.value.tracks[0].faderDb).toBe(0);
    harness.worker.pending.resolve(undefined);
    await exporting;
    expect(m.editLocked.value).toBe(false);
    expect(m.lastRender.value?.result.integratedLufs).toBe(-18);
    expect(harness.downloads).toEqual(['libsonare-mix.wav']);
  });

  it('refuses audio over the per-track and total budgets', async () => {
    const { m, stop } = setup();
    stops.push(stop);
    harness.durationSec = 301;
    await m.addFiles([file('long.wav')]);
    expect(m.notices.value.map((n) => n.key)).toEqual(['trackTooLong']);
    harness.durationSec = 300;
    await m.addFiles(['a', 'b', 'c', 'd'].map((n) => file(`${n}.wav`)));
    harness.durationSec = 10;
    await m.addFiles([file('e.wav')]);
    expect(m.state.value.tracks).toHaveLength(4);
    expect(m.notices.value.map((n) => n.key)).toEqual(['trackTooLong', 'totalExceeded']);
    expect(m.notices.value[1].values.min).toBe('0.0');
  });

  it('restores a saved project without touching the engine until its audio arrives', async () => {
    let saved = addTrack(addTrack(createMixingState(), 'Kick', 2), 'Bass', 2);
    saved = setFader(saved, 2, -7);
    localStorage.setItem(MIXING_STATE_STORAGE_KEY, serializeMixingState(saved));
    const { m, stop } = setup();
    stops.push(stop);
    m.restore();
    expect(m.state.value.tracks.map((t) => t.name)).toEqual(['Kick', 'Bass']);
    expect(m.missingAudio.value).toHaveLength(2);
    expect(harness.calls).toEqual([]);
    expect(m.hasAudio.value).toBe(false);

    await m.addFiles([file('Bass.wav')]);
    expect(m.missingAudio.value.map((t) => t.name)).toEqual(['Kick']);
    expect(m.state.value.tracks).toHaveLength(2);
    expect(opsOf('setTrackClips').map((call) => call[1])).toEqual([2]);
    expect(opsOf('setFader')).toContainEqual(['setFader', 2, -7]);
  });

  it('saves the project JSON under its file name and reads v1 files with a notice', async () => {
    const { m, stop } = await loaded();
    stops.push(stop);
    m.exportProject();
    expect(harness.downloads).toEqual(['libsonare-mix-project.json']);

    const v1 = JSON.stringify({
      version: 1,
      masterFaderDb: -2,
      tracks: [{ name: 'Kick', faderDb: -5 }],
    });
    await m.importProject(new File([v1], 'old.json', { type: 'application/json' }));
    expect(m.notices.value.map((n) => n.key)).toEqual(['projectV1']);
    expect(m.state.value.tracks[0].faderDb).toBe(-5);
    expect(m.state.value.master.faderDb).toBe(-2);

    await m.importProject(new File(['{"strips":[]}'], 'scene.json'));
    expect(m.error.value).toBe('projectInvalid');
  });

  it('persists every committed state to localStorage', async () => {
    vi.useFakeTimers();
    try {
      const { m, stop } = await loaded();
      stops.push(stop);
      m.edit('setMute', 1, true);
      vi.runAllTimers();
      const stored = JSON.parse(localStorage.getItem(MIXING_STATE_STORAGE_KEY) ?? '{}');
      expect(stored.version).toBe(2);
      expect(stored.tracks[0].muted).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('MixingStudio page', () => {
  it('mounts in English and Japanese with an empty console', () => {
    const wrapper = mount(MixingStudio);
    expect(wrapper.find('.tool-page').exists()).toBe(true);
    expect(wrapper.text()).toContain('Mixing Studio');
    expect(wrapper.findAll('.console__free')).toHaveLength(8);
    wrapper.unmount();

    harness.lang.value = 'ja';
    const ja = mount(MixingStudio);
    expect(ja.text()).toContain('ミキシングスタジオ');
    ja.unmount();
  });

  it('loads dropped stems, then mutes, solos and undoes from the keyboard', async () => {
    const wrapper = mount(MixingStudio, { attachTo: document.body });
    await wrapper.find('.mix-page__main').trigger('drop', {
      dataTransfer: { files: [file('Kick.wav'), file('Bass.wav')] },
    });
    await flushPromises();
    expect(wrapper.findAll('.strip')).toHaveLength(2);

    const key = (code: string, init: KeyboardEventInit = {}) =>
      window.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true, ...init }));
    key('KeyM');
    key('KeyS');
    await nextTick();
    const first = wrapper.findAll('.strip')[0];
    expect(first.find('.strip__btn--mute').attributes('aria-pressed')).toBe('true');
    expect(first.find('.strip__btn--solo').attributes('aria-pressed')).toBe('true');

    key('KeyZ', { ctrlKey: true });
    await nextTick();
    expect(wrapper.findAll('.strip')[0].find('.strip__btn--solo').attributes('aria-pressed')).toBe(
      'false',
    );
    key('KeyZ', { ctrlKey: true, shiftKey: true });
    await nextTick();
    expect(wrapper.findAll('.strip')[0].find('.strip__btn--solo').attributes('aria-pressed')).toBe(
      'true',
    );

    key('Space');
    expect(harness.engine.play).toHaveBeenCalled();
    wrapper.unmount();
  });

  it('shows the restore note until the saved tracks have audio', async () => {
    const saved = addTrack(createMixingState(), 'Kick', 2);
    localStorage.setItem(MIXING_STATE_STORAGE_KEY, serializeMixingState(saved));
    const wrapper = mount(MixingStudio);
    await nextTick();
    expect(wrapper.find('.mix-page__banner--restore').exists()).toBe(true);
    await wrapper
      .find('.mix-page__main')
      .trigger('drop', { dataTransfer: { files: [file('Kick.wav')] } });
    await flushPromises();
    expect(wrapper.find('.mix-page__banner--restore').exists()).toBe(false);
    wrapper.unmount();
  });
});
