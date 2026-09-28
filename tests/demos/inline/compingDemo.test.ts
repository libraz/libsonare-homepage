import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { flushPromises, mount } from '@vue/test-utils';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';

const lang = ref('en');
vi.mock('vitepress', () => ({ useData: () => ({ lang }) }));

const audioRuntime = vi.hoisted(() => ({
  clips: {} as Record<string, { samples: Float32Array; sampleRate: number }>,
  plays: [] as Array<{ id: string; samples: Float32Array; sampleRate: number }>,
  playingId: { value: '' as string },
  stops: 0,
}));

vi.mock('@/demos/inline/useSonareDemoAudio', async () => {
  const { readonly, ref } = await vi.importActual<typeof import('vue')>('vue');
  const playingId = ref('');
  const progress = ref(0);
  audioRuntime.playingId = playingId;

  function loadWav(name: string): { samples: Float32Array; sampleRate: number } {
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
      for (let channel = 0; channel < channels; channel++) {
        sum += bytes.readInt16LE(dataOffset + (frame * channels + channel) * 2) / 32768;
      }
      samples[frame] = sum / channels;
    }
    return { samples, sampleRate };
  }

  return {
    useSonareDemoAudio: () => ({
      loadClip: async (name: string) => {
        const clip = loadWav(name);
        audioRuntime.clips[name] = clip;
        return clip;
      },
      play: async (id: string, audio: { samples: Float32Array; sampleRate: number }) => {
        audioRuntime.plays.push({ id, ...audio });
        playingId.value = id;
      },
      stop: () => {
        audioRuntime.stops += 1;
        playingId.value = '';
      },
      playingId: readonly(playingId),
      progress: readonly(progress),
    }),
  };
});

import CompingDemo from '@/demos/inline/archetypes/CompingDemo.vue';
import {
  assembleComp,
  type CompingTake,
  compSegmentAtFrame,
  compSegmentBoundaries,
} from '@/demos/inline/archetypes/compingSession';
import { getDemo } from '@/demos/inline/registry';
import * as wasm from '@/wasm/index.js';

const SR = 32_000;
const CLIP_NAMES = ['a', 'b', 'c'] as const;

function readClip(name: (typeof CLIP_NAMES)[number]): {
  samples: Float32Array;
  sampleRate: number;
} {
  const bytes = readFileSync(
    join(process.cwd(), 'src', 'public', 'demo-clips', `comp-take-${name}.wav`),
  );
  let dataOffset = 0;
  let dataSize = 0;
  for (let offset = 12; offset + 8 <= bytes.length; ) {
    const chunk = bytes.toString('ascii', offset, offset + 4);
    const size = bytes.readUInt32LE(offset + 4);
    if (chunk === 'data') {
      dataOffset = offset + 8;
      dataSize = size;
      break;
    }
    offset += 8 + size + (size & 1);
  }
  const samples = new Float32Array(Math.floor(dataSize / 2));
  for (let i = 0; i < samples.length; i++)
    samples[i] = bytes.readInt16LE(dataOffset + i * 2) / 32768;
  return { samples, sampleRate: SR };
}

function medianPitchAt(samples: Float32Array, time: number): number {
  const result = wasm.pitchPyin(samples, SR, 2048, 128, 400, 1200, 0.1, true);
  const centre = Math.round((time * SR) / 128);
  const values: number[] = [];
  for (let i = Math.max(0, centre - 2); i <= Math.min(result.f0.length - 1, centre + 2); i++) {
    if (result.voicedFlag[i] && result.f0[i] > 0) values.push(result.f0[i]);
  }
  values.sort((a, b) => a - b);
  if (values.length === 0) throw new Error(`no voiced pYIN frame near ${time}s`);
  return values[Math.floor(values.length / 2)];
}

function mountDemo(active = false) {
  const def = getDemo('comping');
  if (!def) throw new Error('comping not registered');
  return mount(CompingDemo, { props: { def, active } });
}

async function settle(wrapper: ReturnType<typeof mountDemo>): Promise<void> {
  for (let i = 0; i < 120; i++) {
    await flushPromises();
    if (wrapper.find('figure.td--ready').exists() || wrapper.find('figure.td--error').exists())
      return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

beforeAll(async () => {
  await wasm.init({ wasmBinary: readFileSync(join(process.cwd(), 'src/wasm/sonare.wasm')) });
}, 30_000);

beforeEach(() => {
  audioRuntime.clips = {};
  audioRuntime.plays.length = 0;
  audioRuntime.playingId.value = '';
  audioRuntime.stops = 0;
  lang.value = 'en';
});

describe('comping session timeline', () => {
  it('uses note-pair edit points and keeps the release in the final segment', () => {
    const edges = compSegmentBoundaries(100_800, SR);
    expect(edges).toEqual([0, 16_000, 32_000, 48_000, 100_800]);
    expect(compSegmentAtFrame(15_999, edges)).toBe(0);
    expect(compSegmentAtFrame(16_000, edges)).toBe(1);
    expect(compSegmentAtFrame(47_999, edges)).toBe(2);
    expect(compSegmentAtFrame(48_000, edges)).toBe(3);
    expect(compSegmentAtFrame(100_799, edges)).toBe(3);
  });

  it('assembles selected regions without mutating a take', () => {
    const takes = {
      a: Float32Array.from({ length: 100_800 }, (_, i) => 0.1 + i / 1_000_000),
      b: Float32Array.from({ length: 100_800 }, () => 0.4),
      c: Float32Array.from({ length: 100_800 }, () => -0.2),
    } satisfies Record<CompingTake, Float32Array>;
    const before = takes.a.slice();
    const output = assembleComp(takes, ['b', 'a', 'a', 'c'], SR, 0);

    expect(output).not.toBe(takes.a);
    expect(output[1_000]).toBe(takes.b[1_000]);
    expect(output[20_000]).toBe(takes.a[20_000]);
    expect(output[40_000]).toBe(takes.a[40_000]);
    expect(output[60_000]).toBe(takes.c[60_000]);
    expect(takes.a).toEqual(before);
  });

  it('does not boost matching waveforms at a take boundary', () => {
    const signal = Float32Array.from({ length: 100_800 }, () => 0.8);
    const output = assembleComp({ a: signal, b: signal, c: signal }, ['b', 'a', 'a', 'c'], SR);
    expect(Math.max(...output.subarray(16_000 - 256, 16_000 + 256))).toBeCloseTo(0.8, 6);
    expect(Math.max(...output.subarray(48_000 - 256, 48_000 + 256))).toBeCloseTo(0.8, 6);
  });
});

describe('comping asset musical evidence', () => {
  it('places Take B’s wrong G#5 at 1.0s while A and C play A5', () => {
    const clips = Object.fromEntries(CLIP_NAMES.map((name) => [name, readClip(name)])) as Record<
      (typeof CLIP_NAMES)[number],
      { samples: Float32Array; sampleRate: number }
    >;
    const aHz = medianPitchAt(clips.a.samples, 1.1);
    const bHz = medianPitchAt(clips.b.samples, 1.1);
    const cHz = medianPitchAt(clips.c.samples, 1.1);
    expect(aHz).toBeGreaterThan(860);
    expect(aHz).toBeLessThan(900);
    expect(cHz).toBeGreaterThan(860);
    expect(cHz).toBeLessThan(900);
    expect(bHz).toBeGreaterThan(800);
    expect(bHz).toBeLessThan(850);
    expect(aHz - bHz).toBeGreaterThan(40);

    const comp = assembleComp(
      { a: clips.a.samples, b: clips.b.samples, c: clips.c.samples },
      ['b', 'a', 'a', 'c'],
      SR,
      0,
    );
    const compHz = medianPitchAt(comp, 1.1);
    expect(compHz).toBeGreaterThan(860);
    expect(compHz - bHz).toBeGreaterThan(40);
  }, 30_000);
});

describe('CompingDemo', () => {
  it('stops the old comp when a segment changes during playback', async () => {
    const wrapper = mountDemo(true);
    try {
      await settle(wrapper);
      await wrapper.find('button.td__play').trigger('click');
      expect(audioRuntime.playingId.value).toBe('comping');
      const priorComp = audioRuntime.plays.at(-1)?.samples;

      const thirdSegment = wrapper.findAll('.dc__field--select')[2];
      await thirdSegment.findAll('.dc__seg-btn')[1].trigger('click');
      await flushPromises();

      expect(audioRuntime.stops).toBe(1);
      expect(audioRuntime.playingId.value).toBe('');
      expect(audioRuntime.plays.at(-1)?.samples).toBe(priorComp);
      expect(thirdSegment.find('.is-on').text()).toBe('Take B');
    } finally {
      wrapper.unmount();
    }
  });

  it('exposes the B/A/A/C default and auditions the matching take or comp buffer', async () => {
    const wrapper = mountDemo(true);
    try {
      await settle(wrapper);
      expect(wrapper.find('figure.td--ready').exists()).toBe(true);
      expect(
        wrapper.findAll('.dc__field--select').map((field) => field.find('.is-on').text()),
      ).toEqual(['Take B', 'Take A', 'Take A', 'Take C']);

      const buttons = wrapper.findAll('.cp-audition__button');
      expect(buttons.map((button) => button.text())).toEqual([
        'Comp',
        'Take A',
        'Take B',
        'Take C',
      ]);

      await buttons[2].trigger('click');
      await flushPromises();
      expect(audioRuntime.plays.at(-1)?.samples).toBe(audioRuntime.clips['comp-take-b'].samples);
      expect(buttons[2].attributes('aria-pressed')).toBe('true');
      expect(wrapper.find('.td__state').text()).toContain('Take B');

      await wrapper.find('button.td__play').trigger('click');
      await flushPromises();
      const compPlay = audioRuntime.plays.at(-1);
      expect(compPlay?.id).toBe('comping');
      expect(compPlay?.samples).not.toBe(audioRuntime.clips['comp-take-b'].samples);
      const frame = Math.round(1.1 * SR);
      expect(compPlay?.samples[frame]).toBe(audioRuntime.clips['comp-take-a'].samples[frame]);
      expect(wrapper.find('.td__state').text()).toContain('Comp');
    } finally {
      wrapper.unmount();
    }
  }, 30_000);

  it('localizes source labels and aria labels', () => {
    lang.value = 'ja';
    const wrapper = mountDemo(false);
    try {
      const buttons = wrapper.findAll('.cp-audition__button');
      expect(buttons.map((button) => button.text())).toEqual([
        'コンプ',
        'テイク A',
        'テイク B',
        'テイク C',
      ]);
      expect(buttons[0].attributes('aria-label')).toBe('再生 コンプ');
      expect(wrapper.find('.cp-audition').attributes('aria-label')).toBe('試聴する音源');
    } finally {
      wrapper.unmount();
    }
  });
});
