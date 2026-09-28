import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';

const lang = ref('en');
vi.mock('vitepress', () => ({ useData: () => ({ lang }) }));

const runtime = vi.hoisted(() => ({
  loadClip: vi.fn(),
  pitchShift: null as null | ReturnType<typeof vi.fn>,
  timeStretch: null as null | ReturnType<typeof vi.fn>,
  plays: [] as Float32Array[],
  stops: 0,
  playingId: null as null | { value: string },
}));

vi.mock('@/demos/inline/useSonareDemoAudio', async () => {
  const { readonly, ref } = await vi.importActual<typeof import('vue')>('vue');
  const playingId = ref('');
  const progress = ref(0);
  const pitchShift = vi.fn((samples: Float32Array) =>
    Float32Array.from(samples, (sample, index) => (index % 2 === 0 ? sample : -sample)),
  );
  const timeStretch = vi.fn((samples: Float32Array) => Float32Array.from([...samples, ...samples]));
  const wasm = {
    stft: vi.fn(() => ({
      nBins: 4,
      nFrames: 1,
      magnitude: new Float32Array([1, 0.5, 0.25, 0.125]),
    })),
    timeStretch,
    voiceChange: vi.fn((samples: Float32Array) => Float32Array.from(samples)),
    melSpectrogram: vi.fn(() => ({
      power: new Float32Array([1]),
      nMels: 1,
      nFrames: 1,
    })),
    melToAudio: vi.fn(() => new Float32Array([0.1, -0.2, 0.3])),
    pitchShift,
  };
  runtime.pitchShift = pitchShift;
  runtime.timeStretch = timeStretch;
  runtime.playingId = playingId;

  return {
    useSonareDemoAudio: () => ({
      ensureWasm: async () => wasm,
      loadClip: runtime.loadClip,
      play: async (_id: string, audio: { samples: Float32Array }) => {
        runtime.plays.push(audio.samples.slice());
        playingId.value = _id;
      },
      stop: () => {
        runtime.stops += 1;
        playingId.value = '';
        progress.value = 0;
      },
      playingId: readonly(playingId),
      progress: readonly(progress),
    }),
  };
});

import ParamSweepDemo from '@/demos/inline/archetypes/ParamSweepDemo.vue';
import { getDemo } from '@/demos/inline/registry';
import type { SonareDemoDef } from '@/demos/inline/types';

function demoWithDefault(id: string, key: string, value: number): SonareDemoDef {
  const def = getDemo(id);
  if (!def) throw new Error(`${id} is not registered`);
  return {
    ...def,
    params: (def.params ?? []).map((param) =>
      param.key === key ? { ...param, default: value } : param,
    ),
  };
}

async function settle(wrapper: ReturnType<typeof mount>): Promise<void> {
  for (let i = 0; i < 30; i++) {
    await flushPromises();
    if (wrapper.find('figure.td--ready').exists() || wrapper.find('figure.td--error').exists())
      return;
    await new Promise((resolve) => setTimeout(resolve, 1));
  }
}

beforeEach(() => {
  runtime.loadClip.mockReset();
  runtime.loadClip.mockResolvedValue({
    samples: new Float32Array([0.1, -0.4, 0.2, 0.8]),
    sampleRate: 10,
  });
  runtime.plays.length = 0;
  runtime.stops = 0;
  runtime.playingId!.value = '';
  runtime.pitchShift?.mockClear();
  runtime.timeStretch?.mockClear();
  lang.value = 'en';
  vi.stubGlobal(
    'requestAnimationFrame',
    vi.fn(() => 1),
  );
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
});

describe('ParamSweepDemo original / processed preview', () => {
  it('defaults to processed, switches playback to original, and reuses one transform', async () => {
    const wrapper = mount(ParamSweepDemo, {
      props: { def: demoWithDefault('pitch-shift', 'semitones', 12), active: true },
    });
    try {
      await settle(wrapper);
      expect(wrapper.find('figure.td--ready').exists()).toBe(true);
      expect(runtime.pitchShift).toHaveBeenCalledTimes(1);

      const original = wrapper.find<HTMLButtonElement>('[data-side="original"]');
      const processed = wrapper.find<HTMLButtonElement>('[data-side="processed"]');
      expect(processed.attributes('aria-pressed')).toBe('true');
      expect(original.attributes('aria-pressed')).toBe('false');
      expect(original.attributes('aria-describedby')).toBe('pitch-shift-preview-hint');
      expect(wrapper.find('.td__state').text()).toBe('440 Hz');

      await wrapper.find('button.td__play').trigger('click');
      await flushPromises();
      expect(runtime.plays).toHaveLength(1);

      await original.trigger('click');
      await flushPromises();

      expect(runtime.stops).toBe(1);
      expect(runtime.plays).toHaveLength(2);
      expect(runtime.plays[1]).not.toEqual(runtime.plays[0]);
      expect(runtime.pitchShift).toHaveBeenCalledTimes(1);
      expect(original.attributes('aria-pressed')).toBe('true');
      runtime.playingId!.value = '';
      await wrapper.vm.$nextTick();
      expect(wrapper.find('.td__state').text()).toBe('220 Hz');
    } finally {
      wrapper.unmount();
    }
  });

  it('updates duration metadata when the selected side changes', async () => {
    const wrapper = mount(ParamSweepDemo, {
      props: { def: demoWithDefault('time-stretch', 'rate', 0.5), active: true },
    });
    try {
      await settle(wrapper);
      expect(wrapper.find('.td__state').text()).toBe('0.8 s');
      await wrapper.find('[data-side="original"]').trigger('click');
      expect(wrapper.find('.td__state').text()).toBe('0.4 s');
      expect(runtime.timeStretch).toHaveBeenCalledTimes(1);
    } finally {
      wrapper.unmount();
    }
  });

  it.each([
    ['formant-shift', 'formant', 1.4, '×1.40', '×1.00'],
    ['griffin-lim', 'iters', 32, '32 iter', 'ORIGINAL'],
    ['tilt-eq', 'tilt', 12, '+12.0 dB', '+0.0 dB'],
  ])('shows the selected side for %s', async (id, key, value, processedState, originalState) => {
    const wrapper = mount(ParamSweepDemo, {
      props: { def: demoWithDefault(id, key, value), active: true },
    });
    try {
      await settle(wrapper);
      expect(wrapper.find('figure.td--ready').exists()).toBe(true);
      expect(wrapper.find('.td__state').text()).toBe(processedState);
      await wrapper.find('[data-side="original"]').trigger('click');
      expect(wrapper.find('.td__state').text()).toBe(originalState);
    } finally {
      wrapper.unmount();
    }
  });

  it('localizes the A/B selector on Japanese pages', () => {
    lang.value = 'ja';
    const wrapper = mount(ParamSweepDemo, {
      props: { def: demoWithDefault('pitch-shift', 'semitones', 0), active: false },
    });
    try {
      expect(wrapper.find('.ps-ab__label').text()).toBe('試聴対象');
      expect(wrapper.find('[data-side="original"]').text()).toBe('オリジナル');
      expect(wrapper.find('[data-side="processed"]').text()).toBe('処理後');
    } finally {
      wrapper.unmount();
    }
  });
});
