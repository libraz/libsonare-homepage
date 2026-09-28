import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';

const lang = ref('en');
const audioMock = vi.hoisted(() => {
  const plays: Array<{ id: string; samples: Float32Array; sampleRate: number }> = [];
  return {
    plays,
    play: vi.fn(async (id: string, audio: { samples: Float32Array; sampleRate: number }) => {
      plays.push({ id, ...audio });
    }),
    stop: vi.fn(),
  };
});

vi.mock('vitepress', () => ({ useData: () => ({ lang }) }));
vi.mock('@/demos/inline/useSonareDemoAudio', async () => {
  const { readonly, ref: vueRef } = await vi.importActual<typeof import('vue')>('vue');
  const playingId = vueRef('');
  const progress = vueRef(0);
  return {
    useSonareDemoAudio: () => ({
      play: audioMock.play,
      stop: audioMock.stop,
      playingId: readonly(playingId),
      progress: readonly(progress),
    }),
  };
});

import MonoFoldDemo from '@/demos/inline/archetypes/MonoFoldDemo.vue';
import { buildMonoFoldSignal, measureMonoFold } from '@/demos/inline/archetypes/monoFoldMath';
import { getDemo } from '@/demos/inline/registry';

const SAMPLE_RATE = 44_100;
const DURATION = 1.8;
const FREQUENCY = 220;

function modelAt(phaseDegrees: number) {
  return buildMonoFoldSignal({
    sampleRate: SAMPLE_RATE,
    duration: DURATION,
    frequency: FREQUENCY,
    phaseRadians: (phaseDegrees * Math.PI) / 180,
    amplitude: 0.7,
    fadeSeconds: 0.05,
  });
}

function mountDemo(active = true) {
  const def = getDemo('mono-fold');
  if (!def) throw new Error('mono-fold not registered');
  return mount(MonoFoldDemo, { props: { def, active } });
}

function rms(samples: Float32Array): number {
  let sum = 0;
  for (const sample of samples) sum += sample * sample;
  return Math.sqrt(sum / samples.length);
}

beforeEach(() => {
  audioMock.plays.length = 0;
  audioMock.play.mockClear();
  audioMock.stop.mockClear();
  lang.value = 'en';
  vi.stubGlobal(
    'requestAnimationFrame',
    vi.fn(() => 1),
  );
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
});

describe('mono-fold PCM model', () => {
  it('reports in-phase PCM as correlated and unchanged by a mono fold', () => {
    const metrics = measureMonoFold(modelAt(0));

    expect(metrics.correlation).toBeCloseTo(1, 6);
    expect(metrics.monoRelativeDb).toBeCloseTo(0, 6);
  });

  it('reports a 90° phase offset as uncorrelated and 3.01 dB lower in mono', () => {
    const metrics = measureMonoFold(modelAt(90));

    expect(metrics.correlation).toBeCloseTo(0, 5);
    expect(metrics.monoRelativeDb).toBeCloseTo(-3.0103, 3);
  });

  it('reports true antiphase as negative correlation and exact PCM cancellation', () => {
    const metrics = measureMonoFold(modelAt(180));

    expect(metrics.correlation).toBeCloseTo(-1, 6);
    expect(metrics.monoRms).toBe(0);
    expect(metrics.monoRelativeDb).toBe(Number.NEGATIVE_INFINITY);
  });
});

describe('MonoFoldDemo', () => {
  it('auditions the selected mono fold or the left reference from the same phase model', async () => {
    const wrapper = mountDemo();
    try {
      expect(wrapper.find('.td--ready').exists()).toBe(true);
      expect(wrapper.find('.td__state').text()).toContain('MONO −3.01 dB');

      await wrapper.find('button.td__play').trigger('click');
      await flushPromises();
      const defaultMono = audioMock.plays.at(-1)?.samples;
      expect(defaultMono).toBeDefined();
      expect(rms(defaultMono as Float32Array)).toBeCloseTo(measureMonoFold(modelAt(90)).monoRms, 6);

      await wrapper.findAll('.dc__seg-btn')[0].trigger('click');
      await wrapper.find('button.td__play').trigger('click');
      await flushPromises();
      const leftReference = audioMock.plays.at(-1)?.samples;
      expect(leftReference).toBeDefined();
      expect(rms(leftReference as Float32Array)).toBeCloseTo(
        measureMonoFold(modelAt(90)).leftRms,
        6,
      );
      expect(rms(leftReference as Float32Array)).toBeGreaterThan(rms(defaultMono as Float32Array));
      expect(audioMock.play).toHaveBeenCalledTimes(2);
    } finally {
      wrapper.unmount();
    }
  });
});
