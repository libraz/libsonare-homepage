import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { flushPromises, mount } from '@vue/test-utils';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';

vi.mock('vitepress', () => ({ useData: () => ({ lang: ref('en') }) }));
vi.mock('@/demos/inline/useSonareDemoAudio', async () => {
  const engine = await vi.importActual<typeof import('@/wasm/index.js')>('@/wasm/index.js');
  const { readonly, ref } = await import('vue');
  return {
    useSonareDemoAudio: () => ({
      ensureWasm: async () => engine,
      loadClip: async () => {
        throw new Error('no clips');
      },
      play: async () => {},
      stop: () => {},
      playingId: readonly(ref('')),
      progress: readonly(ref(0)),
      wasmReady: readonly(ref(true)),
    }),
  };
});

import TransformDemo from '@/demos/inline/archetypes/TransformDemo.vue';
import { getDemo } from '@/demos/inline/registry';
import { generateSignal } from '@/demos/inline/signal';
import * as wasm from '@/wasm/index.js';

const DEF = getDemo('stft-basics');
if (DEF?.source.kind !== 'generate') throw new Error('stft-basics not a generated demo');
const SOURCE = DEF.source;
const HOP = DEF.config?.hopLength as number;

beforeAll(async () => {
  await wasm.init({ wasmBinary: readFileSync(join(process.cwd(), 'src/wasm/sonare.wasm')) });
}, 30_000);

/** Half-amplitude width of the click at 1.25 s (ms) and of the tone line at 1.0 s (Hz). */
function resolution(nFft: number) {
  const { samples, sampleRate } = generateSignal(SOURCE);
  const { nBins, nFrames, magnitude } = wasm.stft(samples, sampleRate, nFft, HOP);
  const binHz = sampleRate / nFft;

  // The tone stays below 1 kHz, so 3-8 kHz carries only the clicks.
  const lo = Math.round(3000 / binHz);
  const hi = Math.round(8000 / binHz);
  const column = new Float32Array(nFrames);
  for (let f = 0; f < nFrames; f++) {
    let sum = 0;
    for (let b = lo; b < hi; b++) sum += magnitude[b * nFrames + f];
    column[f] = sum;
  }
  const clickFrame = Math.round((1.25 * sampleRate) / HOP);
  let clickPeak = 0;
  for (let f = clickFrame - 60; f < clickFrame + 60; f++)
    clickPeak = Math.max(clickPeak, column[f]);
  let clickFrames = 0;
  for (let f = clickFrame - 200; f < clickFrame + 200; f++) {
    if (column[f] > clickPeak / 2) clickFrames++;
  }

  const toneFrame = Math.round((1.0 * sampleRate) / HOP);
  let tonePeak = 0;
  let toneBin = 0;
  for (let b = 0; b < nBins; b++) {
    const v = magnitude[b * nFrames + toneFrame];
    if (v > tonePeak) {
      tonePeak = v;
      toneBin = b;
    }
  }
  let toneBins = 0;
  for (let b = 0; b < nBins; b++) if (magnitude[b * nFrames + toneFrame] > tonePeak / 2) toneBins++;

  return {
    clickMs: (1000 * clickFrames * HOP) / sampleRate,
    toneHz: toneBins * binHz,
    toneAtHz: toneBin * binHz,
  };
}

describe('stft-basics window selector', () => {
  it('recomputes on a grid cropped to 2.5 kHz whose row count follows nFft', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
      () =>
        ({
          createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }),
          putImageData: () => {},
        }) as unknown as CanvasRenderingContext2D,
    );
    const wrapper = mount(TransformDemo, { props: { def: DEF, active: true } });
    const canvas = () => wrapper.find('canvas').element as HTMLCanvasElement;
    const settle = async (height: number) => {
      for (let i = 0; i < 100 && canvas().height !== height; i++) {
        await flushPromises();
        await new Promise((resolve) => setTimeout(resolve, 5));
      }
    };
    // rows = ceil(2500 * nFft / 22050) + 1
    await settle(118);
    expect(canvas().height).toBe(118);
    expect(wrapper.text()).toContain('46 ms · 21.5 Hz/BIN');
    const buttons = () => wrapper.findAll('.dc__seg-btn');
    expect(buttons().map((b) => b.text())).toEqual(['256', '1024', '4096']);
    await buttons()[2].trigger('click');
    await settle(466);
    expect(canvas().height).toBe(466);
    await flushPromises();
    expect(wrapper.text()).toContain('186 ms · 5.4 Hz/BIN');
    await buttons()[0].trigger('click');
    await settle(31);
    expect(canvas().height).toBe(31);
    wrapper.unmount();
    vi.restoreAllMocks();
  });
});

describe('stft-basics resolution trade-off', () => {
  it('offers the three window sizes the caption compares, at a fixed hop', () => {
    const options = DEF.params?.find((p) => p.key === 'nFft')?.options?.map((o) => o.value);
    expect(options).toEqual(['256', '1024', '4096']);
    expect(HOP).toBe(128);
  });

  it('keeps the signal within full scale', () => {
    const { samples } = generateSignal(SOURCE);
    let peak = 0;
    for (const s of samples) peak = Math.max(peak, Math.abs(s));
    expect(peak).toBeLessThanOrEqual(1);
    expect(peak).toBeGreaterThan(0.9);
  });

  it('matches the caption: short window sharp in time, long window sharp in frequency', () => {
    const short = resolution(256);
    const mid = resolution(1024);
    const long = resolution(4096);

    // The tone is at 400 + 600 * (1 / 3) = 600 Hz one second in.
    for (const r of [short, mid, long]) expect(Math.abs(r.toneAtHz - 600)).toBeLessThan(90);

    // Caption: "a band about 170 Hz wide" at 256, "a line about 20 Hz wide" at 4096.
    expect(short.toneHz).toBeGreaterThan(150);
    expect(short.toneHz).toBeLessThan(190);
    expect(long.toneHz).toBeGreaterThan(15);
    expect(long.toneHz).toBeLessThan(25);

    // Caption: "each click smears across about 280 ms" at 4096; thin at 256.
    expect(long.clickMs).toBeGreaterThan(250);
    expect(long.clickMs).toBeLessThan(310);
    expect(short.clickMs).toBeLessThan(30);

    expect(short.clickMs).toBeLessThan(mid.clickMs);
    expect(mid.clickMs).toBeLessThan(long.clickMs);
    expect(short.toneHz).toBeGreaterThan(mid.toneHz);
    expect(mid.toneHz).toBeGreaterThan(long.toneHz);
  });
});
