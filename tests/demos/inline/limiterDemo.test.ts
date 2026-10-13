import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { flushPromises, mount } from '@vue/test-utils';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';

const audio = vi.hoisted(() => ({ played: [] as unknown[] }));
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

import LimiterDemo from '@/demos/inline/archetypes/LimiterDemo.vue';
import { runLimiter } from '@/demos/inline/archetypes/limiterMath';
import { getDemo } from '@/demos/inline/registry';
import * as wasm from '@/wasm/index.js';

const DEF = getDemo('limiter-gr');
if (DEF?.source.kind !== 'clip') throw new Error('limiter-gr not registered on a clip');
const CLIP = loadWav(DEF.source.clip);
clips.load = () => CLIP;

beforeAll(async () => {
  await wasm.init({ wasmBinary: readFileSync(join(process.cwd(), 'src/wasm/sonare.wasm')) });
}, 30_000);

describe('true-peak limiter behind the limiter-gr caption', () => {
  it('holds the output at the −1 dBTP ceiling at every drive while the input climbs', () => {
    for (const drive of [0, 6, 12, 18]) {
      const r = runLimiter(wasm, CLIP.samples, CLIP.sampleRate, drive, -1);
      expect(r.outputTruePeakDb, `drive ${drive}`).toBeLessThanOrEqual(-0.99);
      expect(r.outputTruePeakDb, `drive ${drive}`).toBeGreaterThan(-1.05);
      expect(r.output.length).toBe(r.input.length);
    }
    expect(runLimiter(wasm, CLIP.samples, CLIP.sampleRate, 9).inputTruePeakDb).toBeGreaterThan(0);
  }, 30_000);

  it('deepens the gain reduction with drive while buying ever less loudness', () => {
    const at = [0, 9, 18].map((d) => runLimiter(wasm, CLIP.samples, CLIP.sampleRate, d));
    const maxGr = at.map((r) => Math.min(...r.gainReductionDb));
    expect(maxGr[1]).toBeLessThan(maxGr[0]);
    expect(maxGr[2]).toBeLessThan(maxGr[1]);
    // Caption: "18 dB of drive raises the output RMS by only about 8 dB".
    const gain = at[2].outputRmsDb - at[0].outputRmsDb;
    expect(gain).toBeGreaterThan(7);
    expect(gain).toBeLessThan(9);
  }, 30_000);

  it('returns the output time-aligned with the input, so the trace is a true ratio', () => {
    const r = runLimiter(wasm, CLIP.samples, CLIP.sampleRate, -12);
    let maxDiff = 0;
    for (let i = 0; i < r.input.length; i++) {
      maxDiff = Math.max(maxDiff, Math.abs(r.input[i] - r.output[i]));
    }
    expect(maxDiff).toBeLessThan(0.005);
    expect(Math.min(...r.gainReductionDb)).toBeGreaterThan(-0.1);
  }, 30_000);
});

describe('limiter demo', () => {
  it('limits on activation, reports input and output true peak, and auditions the output', async () => {
    const wrapper = mount(LimiterDemo, { props: { def: DEF, active: true } });
    const t0 = Date.now();
    const state = () => wrapper.find('.td__state').text();
    while (!state().includes('dBTP') && Date.now() - t0 < 20_000) {
      await flushPromises();
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
    expect(state()).toMatch(/IN \+\d+\.\d → OUT −1\.0 dBTP/);
    await wrapper.find('button.td__play').trigger('click');
    await flushPromises();
    const played = audio.played.at(-1) as { samples: Float32Array; sampleRate: number };
    expect(played.samples.length).toBe(CLIP.samples.length);
    wrapper.unmount();
  }, 30_000);
});
