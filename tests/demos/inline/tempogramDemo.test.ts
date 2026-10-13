import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { flushPromises, mount } from '@vue/test-utils';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';

vi.mock('vitepress', () => ({ useData: () => ({ lang: ref('en') }) }));

/** Decode a shipped 16-bit PCM demo clip to mono, as the browser loader would. */
function loadWav(name: string) {
  const bytes = readFileSync(join(process.cwd(), 'src', 'public', 'demo-clips', `${name}.wav`));
  let channels = 0;
  let sampleRate = 0;
  let dataOffset = 0;
  let dataSize = 0;
  for (let offset = 12; offset + 8 <= bytes.length; ) {
    const chunk = bytes.toString('ascii', offset, offset + 4);
    const size = bytes.readUInt32LE(offset + 4);
    const body = offset + 8;
    if (chunk === 'fmt ') {
      channels = bytes.readUInt16LE(body + 2);
      sampleRate = bytes.readUInt32LE(body + 4);
    } else if (chunk === 'data') {
      dataOffset = body;
      dataSize = size;
      break;
    }
    offset = body + size + (size & 1);
  }
  const frames = Math.floor(dataSize / (channels * 2));
  const samples = new Float32Array(frames);
  for (let frame = 0; frame < frames; frame++) {
    let sum = 0;
    for (let c = 0; c < channels; c++)
      sum += bytes.readInt16LE(dataOffset + (frame * channels + c) * 2);
    samples[frame] = sum / 32768 / channels;
  }
  return { samples, sampleRate };
}
const clips = vi.hoisted(() => ({ load: null as null | ((name: string) => unknown) }));

vi.mock('@/demos/inline/useSonareDemoAudio', async () => {
  const engine = await vi.importActual<typeof import('@/wasm/index.js')>('@/wasm/index.js');
  const { readonly, ref } = await import('vue');
  const playingId = ref('');
  return {
    useSonareDemoAudio: () => ({
      ensureWasm: async () => engine,
      loadClip: async (name: string) => clips.load?.(name),
      play: async (id: string) => {
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

import TempogramDemo from '@/demos/inline/archetypes/TempogramDemo.vue';
import {
  acPeaks,
  analyzeTempo,
  clickTrack,
  TEMPO_SR,
} from '@/demos/inline/archetypes/tempogramMath';
import { getDemo } from '@/demos/inline/registry';
import * as wasm from '@/wasm/index.js';

const DEF = getDemo('tempogram');
if (DEF?.source.kind !== 'clip') throw new Error('tempogram not registered on a clip');
const DRUM = loadWav(DEF.source.clip);
clips.load = () => DRUM;

beforeAll(async () => {
  await wasm.init({ wasmBinary: readFileSync(join(process.cwd(), 'src/wasm/sonare.wasm')) });
}, 30_000);

const clicksAt = (bpm: number) => analyzeTempo(wasm, clickTrack(wasm, bpm), TEMPO_SR);
const near = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol;

describe('tempo analysis behind the tempogram caption', () => {
  it('reads the drum loop at 120.1 BPM', () => {
    expect(analyzeTempo(wasm, DRUM.samples, DRUM.sampleRate).bpm).toBeCloseTo(120.1, 1);
  }, 30_000);

  it('reports 200 and 240 BPM clicks at a slower relative inside 80-180, and 60 as itself', () => {
    expect(clicksAt(200).bpm).toBeCloseTo(99.7, 1);
    expect(clicksAt(240).bpm).toBeCloseTo(80.0, 1);
    expect(clicksAt(60).bpm).toBeCloseTo(60.0, 1);
  }, 30_000);

  it('shows peaks at the click tempo and at its half in the global autocorrelation', () => {
    for (const bpm of [100, 200]) {
      const peaks = acPeaks(clicksAt(bpm))
        .slice(0, 4)
        .map((p) => p.bpm);
      // Lag resolution at 22050 Hz / 512 hop is a few BPM up here.
      expect(
        peaks.some((p) => near(p, bpm, bpm * 0.03)),
        `${bpm}: ${peaks}`,
      ).toBe(true);
      expect(
        peaks.some((p) => near(p, bpm / 2, bpm * 0.03)),
        `${bpm}/2: ${peaks}`,
      ).toBe(true);
    }
  }, 30_000);
});

describe('tempogram demo', () => {
  it('reports the engine tempo and follows a source change', async () => {
    const wrapper = mount(TempogramDemo, { props: { def: DEF, active: true } });
    const state = () => wrapper.find('.td__state').text();
    const waitFor = async (re: RegExp) => {
      const t0 = Date.now();
      while (!re.test(state()) && Date.now() - t0 < 20_000) {
        await flushPromises();
        await new Promise((resolve) => setTimeout(resolve, 5));
      }
    };
    await waitFor(/^ENGINE /);
    expect(state()).toMatch(/^ENGINE 120\.1 BPM/);
    await wrapper
      .findAll('.dc__seg-btn')
      .find((b) => b.text() === 'Clicks 200')
      ?.trigger('click');
    await waitFor(/99\.7/);
    expect(state()).toMatch(/^ENGINE 99\.7 BPM/);
    wrapper.unmount();
  }, 30_000);
});
