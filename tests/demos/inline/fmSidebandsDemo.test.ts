import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { flushPromises, mount } from '@vue/test-utils';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';

const audio = vi.hoisted(() => ({ played: [] as unknown[] }));
vi.mock('vitepress', () => ({ useData: () => ({ lang: ref('en') }) }));
vi.mock('@/demos/inline/useSonareDemoAudio', async () => {
  const engine = await vi.importActual<typeof import('@/wasm/index.js')>('@/wasm/index.js');
  const { readonly, ref } = await import('vue');
  const playingId = ref('');
  return {
    useSonareDemoAudio: () => ({
      ensureWasm: async () => engine,
      loadClip: async () => {
        throw new Error('no clips');
      },
      play: async (id: string, pcm: unknown) => {
        audio.played.push(pcm);
        playingId.value = id;
      },
      stop: () => {
        playingId.value = '';
      },
      playingId: readonly(playingId),
      progress: readonly(ref(0)),
      wasmReady: readonly(ref(true)),
    }),
  };
});

import FmSidebandsDemo from '@/demos/inline/archetypes/FmSidebandsDemo.vue';
import {
  FM_F0,
  findPartials,
  fmSpectrum,
  renderFmNote,
  spectralCentroidHz,
} from '@/demos/inline/archetypes/fmSidebandMath';
import { getDemo } from '@/demos/inline/registry';
import * as wasm from '@/wasm/index.js';

const DEF = getDemo('fm-index-ratio');
if (!DEF) throw new Error('fm-index-ratio not registered');

beforeAll(async () => {
  await wasm.init({ wasmBinary: readFileSync(join(process.cwd(), 'src/wasm/sonare.wasm')) });
}, 30_000);

function measure(ratio: number, index: number) {
  const pcm = renderFmNote(wasm, ratio, index);
  const spec = fmSpectrum(wasm, pcm);
  return { pcm, partials: findPartials(spec, -40), centroid: spectralCentroidHz(spec) };
}

const harmonicNumber = (hz: number) => hz / FM_F0;
const offGrid = (hz: number) => Math.abs(harmonicNumber(hz) - Math.round(harmonicNumber(hz)));

describe('FM engine spectrum behind the fm-index-ratio caption', () => {
  it('is one sine partial at index 0, at the note', () => {
    const { pcm, partials } = measure(1, 0);
    expect(partials).toHaveLength(1);
    expect(Math.abs(partials[0].hz - FM_F0)).toBeLessThan(6);
    let peak = 0;
    for (const v of pcm) peak = Math.max(peak, Math.abs(v));
    expect(peak).toBeCloseTo(0.85, 3);
  });

  it('spreads into more partials as the index rises: 7 within 40 dB at 1 : 1, index 3', () => {
    const counts = [0, 1, 3].map((index) => measure(1, index).partials.length);
    expect(counts[0]).toBeLessThan(counts[1]);
    expect(counts[1]).toBeLessThan(counts[2]);
    expect(counts[2]).toBe(7);
    expect(measure(1, 3).centroid).toBeGreaterThan(measure(1, 1).centroid);
  }, 30_000);

  it('keeps whole-number ratios on the harmonic grid, odd harmonics only at 1 : 2', () => {
    for (const p of measure(1, 3).partials) expect(offGrid(p.hz)).toBeLessThan(0.04);
    const two = measure(2, 2).partials;
    expect(two.length).toBeGreaterThan(3);
    for (const p of two) {
      expect(offGrid(p.hz)).toBeLessThan(0.04);
      expect(Math.round(harmonicNumber(p.hz)) % 2).toBe(1);
    }
  }, 30_000);

  it('puts partials between the grid lines at a 3.5 ratio', () => {
    const between = measure(3.5, 2).partials.filter((p) => offGrid(p.hz) > 0.2);
    expect(between.length).toBeGreaterThan(2);
  }, 30_000);
});

describe('fm-sidebands demo', () => {
  it('renders on activation, reports partial count, re-renders on a control change', async () => {
    const wrapper = mount(FmSidebandsDemo, { props: { def: DEF, active: true } });
    const waitFor = async (text: string) => {
      for (let i = 0; i < 200 && !wrapper.text().includes(text); i++) {
        await flushPromises();
        await new Promise((resolve) => setTimeout(resolve, 5));
      }
    };
    await waitFor('PARTIALS');
    expect(wrapper.text()).toContain('1 : 1 · I 1.5');
    const sliders = wrapper.findAll('input[type="range"]');
    await sliders[1].setValue('0');
    await waitFor('1 PARTIALS');
    expect(wrapper.text()).toContain('I 0.0 · 1 PARTIALS');
    await wrapper.find('button.td__play').trigger('click');
    await flushPromises();
    const played = audio.played.at(-1) as { samples: Float32Array; sampleRate: number };
    expect(played.sampleRate).toBe(44_100);
    expect(played.samples.length).toBeGreaterThan(44_100);
    wrapper.unmount();
  }, 30_000);
});
