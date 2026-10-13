import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { flushPromises, mount } from '@vue/test-utils';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';
import * as wasm from '@/wasm/index.js';

const lang = ref('en');
const audioMock = vi.hoisted(() => {
  const plays: Array<Record<string, unknown>> = [];
  return {
    plays,
    play: vi.fn(async (_id: string, audio: Record<string, unknown>) => {
      plays.push(audio);
    }),
    stop: vi.fn(),
  };
});

vi.mock('vitepress', () => ({ useData: () => ({ lang }) }));
vi.mock('@/demos/inline/useSonareDemoAudio', async () => {
  const { readonly, ref: vueRef } = await vi.importActual<typeof import('vue')>('vue');
  const engine = await vi.importActual<typeof import('@/wasm/index.js')>('@/wasm/index.js');
  return {
    useSonareDemoAudio: () => ({
      ensureWasm: async () => engine,
      play: audioMock.play,
      stop: audioMock.stop,
      playingId: readonly(vueRef('')),
      progress: readonly(vueRef(0)),
    }),
  };
});

import ChannelDownmixDemo from '@/demos/inline/archetypes/ChannelDownmixDemo.vue';
import {
  buildSurroundSource,
  channelPeaks,
  surroundTimeline,
} from '@/demos/inline/archetypes/channelDownmixSignal';
import { getDemo } from '@/demos/inline/registry';

const ALL_ON = [true, true, true, true, true, true];
const ones = (n: number) => Array.from({ length: n }, () => new Float32Array(16).fill(1));

beforeAll(async () => {
  await wasm.init({ wasmBinary: readFileSync(join(process.cwd(), 'src/wasm/sonare.wasm')) });
}, 30_000);

beforeEach(() => {
  audioMock.plays.length = 0;
  audioMock.play.mockClear();
  lang.value = 'en';
  vi.stubGlobal(
    'requestAnimationFrame',
    vi.fn(() => 1),
  );
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
});

describe('downmix overshoot (engine)', () => {
  it('folds full-scale in-phase beds past 1.0 without normalizing', () => {
    const s51 = wasm.downmix(ones(6), 1);
    expect(s51).toHaveLength(2);
    expect(s51[0][0]).toBeCloseTo(2.4142, 3);
    expect(s51[1][0]).toBeCloseTo(2.4142, 3);
    expect(wasm.downmix(ones(6), 0)[0][0]).toBeCloseTo(2.4142, 3);
    const s71 = wasm.downmix(ones(8), 1);
    expect(s71[0][0]).toBeCloseTo(3.1213, 3);
    expect(s71[1][0]).toBeCloseTo(3.1213, 3);
  });

  it('drops the LFE and adds centre and surrounds at -3 dB', () => {
    const unit = (index: number) =>
      Array.from({ length: 6 }, (_, i) => new Float32Array(1).fill(i === index ? 1 : 0));
    expect(wasm.downmix(unit(3), 1).map((p) => p[0])).toEqual([0, 0]);
    const centre = wasm.downmix(unit(2), 1).map((p) => p[0]);
    expect(centre[0]).toBeCloseTo(Math.SQRT1_2, 4);
    expect(centre[1]).toBeCloseTo(Math.SQRT1_2, 4);
    const ls = wasm.downmix(unit(4), 1).map((p) => p[0]);
    expect(ls[0]).toBeCloseTo(Math.SQRT1_2, 4);
    expect(ls[1]).toBe(0);
  });
});

describe('demo source', () => {
  it('peaks every enabled channel at the set level and the in-phase fold at 2.4142', () => {
    const source = buildSurroundSource({ level: 1, enabled: ALL_ON });
    for (const peak of channelPeaks(source)) expect(peak).toBeCloseTo(1, 6);
    const { together } = surroundTimeline();
    const segment = source.map((c) => c.subarray(together.start, together.end));
    for (const peak of channelPeaks(wasm.downmix(segment, 1))) expect(peak).toBeCloseTo(2.4142, 3);
    expect(channelPeaks(wasm.downmix(segment, 0))[0]).toBeCloseTo(2.4142, 3);
  });
});

function mountDemo() {
  const def = getDemo('channel-downmix');
  if (!def) throw new Error('channel-downmix not registered');
  return mount(ChannelDownmixDemo, { props: { def, active: true } });
}

async function settle(wrapper: ReturnType<typeof mountDemo>): Promise<void> {
  for (let i = 0; i < 40; i++) {
    await flushPromises();
    if (wrapper.find('figure.td--ready').exists() || wrapper.find('figure.td--error').exists())
      return;
  }
}

describe('ChannelDownmixDemo', () => {
  it('meters the unnormalized engine fold and auditions a normalized copy', async () => {
    const wrapper = mountDemo();
    try {
      await settle(wrapper);
      expect(wrapper.find('figure.td--ready').exists()).toBe(true);
      expect(wrapper.find('.td__state').text()).toBe('PEAK +7.66 dBFS');
      expect(wrapper.find('.cd-readout').text()).toContain('L 2.4142');
      expect(wrapper.find('.cd-readout').text()).toContain('R 2.4142');

      await wrapper.find('button.td__play').trigger('click');
      await flushPromises();
      const played = audioMock.plays.at(-1) as { left: Float32Array; right: Float32Array };
      const engine = wasm.downmix(buildSurroundSource({ level: 1, enabled: ALL_ON }), 1);
      const gain = 10 ** (-1 / 20) / Math.max(...channelPeaks(engine));
      expect(Math.max(...channelPeaks([played.left, played.right]))).toBeCloseTo(
        10 ** (-1 / 20),
        5,
      );
      // Same fold as the engine's, scaled once.
      for (const i of [1000, 30_000, 45_000, surroundTimeline().together.start + 50]) {
        expect(played.left[i]).toBeCloseTo(engine[0][i] * gain, 5);
        expect(played.right[i]).toBeCloseTo(engine[1][i] * gain, 5);
      }
    } finally {
      wrapper.unmount();
    }
  }, 30_000);

  it('follows the target and the per-channel toggles', async () => {
    const wrapper = mountDemo();
    try {
      await settle(wrapper);
      // Mono target.
      const monoButton = wrapper.findAll('.dc__seg-btn').find((b) => b.text().trim() === 'Mono');
      await monoButton?.trigger('click');
      await settle(wrapper);
      await flushPromises();
      // rAF is stubbed, so run the scheduled compute by hand.
      const raf = vi.mocked(requestAnimationFrame).mock.calls.at(-1)?.[0];
      raf?.(0);
      await flushPromises();
      expect(wrapper.find('.cd-readout').text()).toContain('M 2.4142');

      // Surrounds off: L + 0.707 C per side, averaged.
      const buttons = wrapper.findAll('button.cd-speaker');
      await buttons[4].trigger('click');
      await buttons[5].trigger('click');
      await flushPromises();
      vi.mocked(requestAnimationFrame).mock.calls.at(-1)?.[0]?.(0);
      await flushPromises();
      expect(buttons[4].attributes('aria-pressed')).toBe('false');
      expect(wrapper.find('.cd-readout').text()).toContain(`M ${(1 + Math.SQRT1_2).toFixed(4)}`);
    } finally {
      wrapper.unmount();
    }
  }, 30_000);
});
