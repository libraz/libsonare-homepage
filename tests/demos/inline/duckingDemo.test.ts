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

import DuckingDemo from '@/demos/inline/archetypes/DuckingDemo.vue';
import { buildDuckKey, duckSummary, runDuck } from '@/demos/inline/archetypes/duckingMath';
import { getDemo } from '@/demos/inline/registry';
import * as wasm from '@/wasm/index.js';

const DEF = getDemo('ducking');
if (!DEF) throw new Error('ducking not registered');
const [VOICE_CLIP, BED_CLIP] = (DEF.config?.clips ?? []) as string[];
const VOICE = loadWav(VOICE_CLIP);
const BED = loadWav(BED_CLIP);
clips.load = (name) => (name === VOICE_CLIP ? VOICE : BED);
const KEY = buildDuckKey(VOICE.samples, BED.samples.length, BED.sampleRate);

beforeAll(async () => {
  await wasm.init({ wasmBinary: readFileSync(join(process.cwd(), 'src/wasm/sonare.wasm')) });
}, 30_000);

function duck(releaseMs: number, thresholdDb = -30, ratio = 4) {
  return runDuck(wasm, KEY, BED.samples, BED.sampleRate, {
    thresholdDb,
    ratio,
    attackMs: 5,
    releaseMs,
    rangeDb: 18,
  });
}

describe('sidechain duck behind the ducking caption', () => {
  it('ducks the bed about 10 dB under the voice and pumps back in word gaps at 100 ms', () => {
    const s = duckSummary(duck(100));
    expect(s.underVoiceDb).toBeLessThan(-8.5);
    expect(s.underVoiceDb).toBeGreaterThan(-11.5);
    expect(s.inGapsDb).toBeGreaterThan(-3.5);
    expect(s.inGapsDb).toBeLessThan(-1);
  }, 30_000);

  it('holds the bed down through the sentence at 500 ms release', () => {
    const s = duckSummary(duck(500));
    expect(s.inGapsDb).toBeLessThan(-9.5);
    expect(s.inGapsDb).toBeGreaterThan(-12.5);
  }, 30_000);

  it('never ducks past the 18 dB range, and leaves the bed alone with no voice', () => {
    const deep = duck(100, -50, 10);
    expect(Math.min(...deep.gainReductionDb)).toBeGreaterThan(-18.3);
    const pause = deep.gainReductionDb.slice(Math.round(3.0 / 0.01), Math.round(3.3 / 0.01));
    expect(Math.max(...pause)).toBeGreaterThan(-0.2);
  }, 30_000);

  it('ducks less as the threshold rises above the voice', () => {
    const under = (t: number) => duckSummary(duck(100, t)).underVoiceDb;
    expect(under(-20)).toBeGreaterThan(under(-30));
  }, 30_000);
});

describe('ducking demo', () => {
  it('renders on activation, summarizes the duck, and auditions the mix', async () => {
    const wrapper = mount(DuckingDemo, { props: { def: DEF, active: true } });
    const state = () => wrapper.find('.td__state').text();
    const t0 = Date.now();
    while (!state().includes('UNDER VOICE') && Date.now() - t0 < 20_000) {
      await flushPromises();
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
    expect(state()).toMatch(/UNDER VOICE −\d+\.\d dB · IN GAPS −\d\.\d dB/);
    await wrapper.find('button.td__play').trigger('click');
    await flushPromises();
    const played = audio.played.at(-1) as { samples: Float32Array; sampleRate: number };
    expect(played.samples.length).toBe(BED.samples.length);
    wrapper.unmount();
  }, 30_000);
});
