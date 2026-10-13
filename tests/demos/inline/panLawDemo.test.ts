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

import PanLawDemo from '@/demos/inline/archetypes/PanLawDemo.vue';
import {
  measurePanCurve,
  monoSumDb,
  PAN_LAWS,
  powerDb,
  renderPanSweep,
} from '@/demos/inline/archetypes/panLawMath';
import { getDemo } from '@/demos/inline/registry';
import * as wasm from '@/wasm/index.js';

const DEF = getDemo('pan-law');
if (!DEF) throw new Error('pan-law not registered');

beforeAll(async () => {
  await wasm.init({ wasmBinary: readFileSync(join(process.cwd(), 'src/wasm/sonare.wasm')) });
}, 30_000);

function range(values: number[]) {
  return { min: Math.min(...values), max: Math.max(...values) };
}

function levels(law: (typeof PAN_LAWS)[number], mode: 'balance' | 'stereoPan') {
  const c = measurePanCurve(wasm, law, mode);
  const power = [...c.left].map((l, i) => powerDb(l, c.right[i]));
  const mono = [...c.left].map((l, i) => monoSumDb(l, c.right[i]));
  return { c, power: range(power), mono: range(mono) };
}

describe('pan-law curves measured from the Mixer strip', () => {
  it('is hard left and hard right at the ends under every law and mode', () => {
    for (const mode of ['balance', 'stereoPan'] as const) {
      for (const law of PAN_LAWS) {
        const c = measurePanCurve(wasm, law, mode);
        expect(c.left[0]).toBeCloseTo(1, 4);
        expect(c.right[0]).toBeCloseTo(0, 4);
        expect(c.left.at(-1)).toBeCloseTo(0, 4);
        expect(c.right.at(-1)).toBeCloseTo(1, 4);
      }
    }
  });

  it('matches the caption in stereoPan: const3dB holds power, const6dB holds the mono sum', () => {
    const c3 = levels('const3dB', 'stereoPan');
    expect(c3.power.max - c3.power.min).toBeLessThan(0.01);
    expect(c3.mono.max).toBeCloseTo(3.01, 1);
    expect(c3.c.left[20]).toBeCloseTo(Math.SQRT1_2, 3);

    const c6 = levels('const6dB', 'stereoPan');
    expect(c6.mono.max - c6.mono.min).toBeLessThan(0.01);
    expect(c6.power.min).toBeCloseTo(-3.01, 1);
    expect(c6.c.left[20]).toBeCloseTo(0.5, 3);

    // The page's center-gain table: 0.707 / 0.595 / 0.5 / 1.0.
    expect(levels('const4.5dB', 'stereoPan').c.left[20]).toBeCloseTo(0.5946, 3);
    expect(levels('linear0dB', 'stereoPan').c.left[20]).toBeCloseTo(1, 3);
  });

  it('matches the caption in balance: unity at the center under every law', () => {
    for (const law of PAN_LAWS) {
      const { c } = levels(law, 'balance');
      expect(c.left[20], law).toBeCloseTo(1, 3);
      expect(c.right[20], law).toBeCloseTo(1, 3);
    }
  });

  it('sweeps the audition from the left channel to the right', () => {
    const n = 48_000 * 2;
    const src = new Float32Array(n).map((_, i) => 0.3 * Math.sin(i * 0.05));
    const out = renderPanSweep(wasm, 'const3dB', 'stereoPan', src, 48_000);
    const rms = (x: Float32Array, s: number, e: number) =>
      Math.sqrt(x.subarray(s, e).reduce((q, v) => q + v * v, 0) / (e - s));
    const head = n / 20;
    expect(rms(out.left, 0, head)).toBeGreaterThan(10 * rms(out.right, 0, head));
    expect(rms(out.right, n - head, n)).toBeGreaterThan(10 * rms(out.left, n - head, n));
  });
});

describe('pan-law demo', () => {
  it('measures on activation, reports the center gain, and auditions a stereo sweep', async () => {
    const wrapper = mount(PanLawDemo, { props: { def: DEF, active: true } });
    for (let i = 0; i < 100 && !wrapper.text().includes('CENTER'); i++) {
      await flushPromises();
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
    expect(wrapper.text()).toContain('CENTER −3.0 dB / CH');
    const buttons = wrapper.findAll('.dc__seg-btn');
    await buttons.find((b) => b.text() === 'balance')?.trigger('click');
    await flushPromises();
    expect(wrapper.text()).toContain('CENTER 0.0 dB / CH');
    await buttons.find((b) => b.text() === 'stereoPan')?.trigger('click');
    await buttons.find((b) => b.text() === 'const6dB')?.trigger('click');
    await flushPromises();
    expect(wrapper.text()).toContain('CENTER −6.0 dB / CH');

    await wrapper.find('button.td__play').trigger('click');
    await flushPromises();
    const sweep = audio.played.at(-1) as { left: Float32Array; right: Float32Array };
    expect(sweep.left.length).toBe(48_000 * 4);
    expect(sweep.right.length).toBe(sweep.left.length);
    wrapper.unmount();
  });
});
