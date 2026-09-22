import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { flushPromises, mount } from '@vue/test-utils';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';

const lang = ref('en');
vi.mock('vitepress', () => ({ useData: () => ({ lang }) }));

const audioRuntime = vi.hoisted(() => ({
  plays: [] as string[],
  playingId: { value: '' },
}));

// The demo loads its clip through the shared audio composable, which fetches over
// HTTP in a browser. Serve the shipped WAV from disk instead so the engine sees the
// exact samples a visitor's browser decodes.
vi.mock('@/demos/inline/useSonareDemoAudio', async () => {
  const wasm = await vi.importActual<typeof import('@/wasm/index.js')>('@/wasm/index.js');
  const { readonly, ref } = await import('vue');
  const { readFileSync } = await import('node:fs');
  const { join } = await import('node:path');
  const playingId = ref('');
  const progress = ref(0);
  const wasmReady = ref(true);
  audioRuntime.playingId = playingId;

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
      for (let channel = 0; channel < channels; channel++) {
        sum += bytes.readInt16LE(dataOffset + (frame * channels + channel) * 2) / 32768;
      }
      samples[frame] = sum / channels;
    }
    return { samples, sampleRate };
  }

  return {
    ensureWasm: async () => wasm,
    useSonareDemoAudio: () => ({
      ensureWasm: async () => wasm,
      loadClip: async (name: string) => loadWav(name),
      play: async (id: string) => {
        audioRuntime.plays.push(id);
        playingId.value = id;
      },
      stop: () => {
        playingId.value = '';
      },
      playingId: readonly(playingId),
      progress: readonly(progress),
      wasmReady: readonly(wasmReady),
    }),
  };
});

import ChordTrackDemo from '@/demos/inline/archetypes/ChordTrackDemo.vue';
import { getDemo } from '@/demos/inline/registry';
import { useSonareDemoAudio } from '@/demos/inline/useSonareDemoAudio';
import * as wasm from '@/wasm/index.js';

const DEF = getDemo('chord-track');
if (!DEF || DEF.source.kind !== 'clip') throw new Error('chord-track not registered on a clip');
const CLIP = DEF.source.clip;

function mountDemo(active = false) {
  return mount(ChordTrackDemo, { props: { def: DEF, active } });
}

/** Spin the event loop until the demo reaches a terminal (ready/error) state. */
async function settle(wrapper: ReturnType<typeof mountDemo>): Promise<void> {
  for (let i = 0; i < 120; i++) {
    await flushPromises();
    if (wrapper.find('figure.td--ready').exists() || wrapper.find('figure.td--error').exists()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

const names = (r: { chords: Array<{ name: string }> }) => r.chords.map((c) => c.name);

beforeAll(async () => {
  await wasm.init({ wasmBinary: readFileSync(join(process.cwd(), 'src/wasm/sonare.wasm')) });
}, 30_000);

beforeEach(() => {
  audioRuntime.plays.length = 0;
  audioRuntime.playingId.value = '';
  lang.value = 'en';
});

describe('chord recognition on the demo clip', () => {
  it('returns a progression, not one segment, and triads only strips the extensions', async () => {
    const { samples, sampleRate } = await useSonareDemoAudio().loadClip(CLIP);
    const full = wasm.detectChords(samples, sampleRate, { useTriadsOnly: false, minDuration: 0.3 });
    const triads = wasm.detectChords(samples, sampleRate, {
      useTriadsOnly: true,
      minDuration: 0.3,
    });

    expect(full.chords.length).toBeGreaterThan(1);
    expect(triads.chords.length).toBeGreaterThan(1);
    // Segments tile the clip in order.
    for (let i = 1; i < full.chords.length; i++) {
      expect(full.chords[i].start).toBeGreaterThanOrEqual(full.chords[i - 1].end - 1e-6);
    }

    // The full set reaches beyond the four triads on this clip; the triad set never does.
    const triadMax = wasm.ChordQuality.Augmented;
    expect(full.chords.some((c) => c.quality > triadMax)).toBe(true);
    for (const c of triads.chords) expect(c.quality).toBeLessThanOrEqual(triadMax);

    // The page's claim: triads only reads the C–Am–F–G turnaround, and the full set
    // hears the F bar as an A-minor extension instead.
    expect(names(triads)).toEqual(['C', 'Am', 'F', 'G']);
    expect(names(full)).not.toContain('F');
    expect(names(full).some((n) => n.startsWith('Am'))).toBe(true);
  }, 30_000);

  it('merges more segments as the minimum duration rises', async () => {
    const { samples, sampleRate } = await useSonareDemoAudio().loadClip(CLIP);
    const counts = [0, 0.3, 1].map(
      (minDuration) => wasm.detectChords(samples, sampleRate, { minDuration }).chords.length,
    );
    expect(counts[0]).toBeGreaterThan(counts[1]);
    expect(counts[1]).toBeGreaterThan(counts[2]);
    // The shortest bar in the triad reading is F; a half-second floor removes it.
    const merged = wasm.detectChords(samples, sampleRate, {
      useTriadsOnly: true,
      minDuration: 0.5,
    });
    expect(names(merged)).not.toContain('F');
    expect(merged.chords.length).toBeGreaterThan(1);
  }, 30_000);
});

describe('ChordTrackDemo', () => {
  it('renders its chrome in the idle state without touching the engine', () => {
    const spy = vi.spyOn(wasm, 'detectChords');
    const wrapper = mountDemo(false);
    try {
      expect(wrapper.find('.td__eyebrow').text()).toContain('CHORD TRACK');
      expect(wrapper.find('.td__title').text()).toContain('Chord track');
      expect(wrapper.find('figure.td--error').exists()).toBe(false);
      expect(wrapper.find('.ct-canvas').exists()).toBe(true);
      expect(spy).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
      wrapper.unmount();
    }
  });

  it('analyzes the clip with the registry defaults and reaches the ready state', async () => {
    const spy = vi.spyOn(wasm, 'detectChords');
    const wrapper = mountDemo(true);
    try {
      await settle(wrapper);
      expect(wrapper.find('figure.td--error').exists()).toBe(false);
      expect(wrapper.find('figure.td--ready').exists()).toBe(true);
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy.mock.calls[0][2]).toEqual({ useTriadsOnly: false, minDuration: 0.3 });
      expect(wrapper.find('.td__state').text()).toMatch(/^\d+ CHORDS$/);
    } finally {
      spy.mockRestore();
      wrapper.unmount();
    }
  }, 30_000);

  it('auditions the clip it analyzed', async () => {
    const wrapper = mountDemo(true);
    try {
      await settle(wrapper);
      await wrapper.find('button.td__play').trigger('click');
      await flushPromises();
      expect(audioRuntime.plays).toEqual(['chord-track']);
    } finally {
      wrapper.unmount();
    }
  }, 30_000);

  it('localizes its title for the ja locale', () => {
    lang.value = 'ja';
    const wrapper = mountDemo(false);
    try {
      expect(wrapper.find('.td__title').text()).toContain('コードトラック');
    } finally {
      wrapper.unmount();
    }
  });
});
