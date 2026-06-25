import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { flushPromises, mount } from '@vue/test-utils';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';

const lang = ref('en');
vi.mock('vitepress', () => ({ useData: () => ({ lang }) }));

import PianoRollDemo from '@/components/demos/archetypes/PianoRollDemo.vue';
import { getDemo } from '@/demos/registry';
import * as wasm from '@/wasm/index.js';

// The demo plays mono PCM through the shared AudioContext. A stub context records
// the exact buffer the demo hands to playback, so a test can inspect the audio the
// engine actually rendered for the on-screen passage.
let captured: Float32Array | null = null;

class StubAudioContext {
  state = 'running';
  currentTime = 0;
  sampleRate = 44_100;
  destination = {};
  async resume(): Promise<void> {}
  createBuffer(_channels: number, length: number, sampleRate: number) {
    return {
      length,
      duration: length / sampleRate,
      copyToChannel: (src: Float32Array) => {
        captured = src.slice();
      },
    };
  }
  createBufferSource() {
    return {
      buffer: null as unknown,
      onended: null as null | (() => void),
      connect() {},
      disconnect() {},
      start() {},
      stop() {},
    };
  }
}

/** RMS of `pcm` over the half-open frame range [a, b). */
function rms(pcm: Float32Array, a: number, b: number): number {
  let sum = 0;
  const lo = Math.max(0, a);
  const hi = Math.min(pcm.length, b);
  for (let i = lo; i < hi; i++) sum += pcm[i] * pcm[i];
  return Math.sqrt(sum / Math.max(1, hi - lo));
}

/** Mount the demo, defaulting to active so it renders on the spot. */
function mountDemo(active = false) {
  const def = getDemo('midi-piano-roll');
  if (!def) throw new Error('midi-piano-roll not registered');
  return mount(PianoRollDemo, { props: { def, active } });
}

/** Spin the event loop until the demo reaches a terminal (ready/error) state. */
async function settle(wrapper: ReturnType<typeof mountDemo>): Promise<void> {
  for (let i = 0; i < 80; i++) {
    await flushPromises();
    if (wrapper.find('figure.td--ready').exists() || wrapper.find('figure.td--error').exists()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

beforeAll(async () => {
  await wasm.init({ wasmBinary: readFileSync(join(process.cwd(), 'src/wasm/sonare.wasm')) });
  (globalThis as unknown as { AudioContext: unknown }).AudioContext = StubAudioContext;
  (window as unknown as { AudioContext: unknown }).AudioContext = StubAudioContext;
}, 30_000);

beforeEach(() => {
  captured = null;
  lang.value = 'en';
});

describe('PianoRollDemo', () => {
  it('renders its chrome in the idle state without touching the engine', () => {
    const wrapper = mountDemo(false);
    try {
      expect(wrapper.find('.td__eyebrow').text()).toContain('MIDI');
      expect(wrapper.find('.td__title').text()).toContain('A MIDI passage');
      // Idle: not yet rendered, no error overlay.
      expect(wrapper.find('figure.td--error').exists()).toBe(false);
      expect(wrapper.find('.pr-canvas').exists()).toBe(true);
    } finally {
      wrapper.unmount();
    }
  });

  it('renders the passage through the engine and reaches the ready state', async () => {
    const wrapper = mountDemo(true);
    try {
      await settle(wrapper);
      expect(wrapper.find('figure.td--error').exists()).toBe(false);
      expect(wrapper.find('figure.td--ready').exists()).toBe(true);
    } finally {
      wrapper.unmount();
    }
  });

  it('auditions audio with energy across the whole phrase, peak-normalized', async () => {
    const wrapper = mountDemo(true);
    try {
      await settle(wrapper);
      expect(wrapper.find('figure.td--ready').exists()).toBe(true);

      await wrapper.find('button.td__play').trigger('click');
      await flushPromises();

      expect(captured).not.toBeNull();
      const pcm = captured as Float32Array;

      // Peak-normalized to the demo's 0.85 headroom (within float tolerance).
      let peak = 0;
      for (const v of pcm) peak = Math.max(peak, Math.abs(v));
      expect(peak).toBeGreaterThan(0.8);
      expect(peak).toBeLessThanOrEqual(0.86);

      // Regression guard for the quarter-note unit (ppq is quarter notes, not
      // 480 ticks): with the wrong unit only the downbeat lands in the buffer and
      // the rest is silent. The phrase is 8 beats at 100 BPM (= 4.8 s); assert the
      // last third carries real energy, i.e. later notes actually sounded.
      const phraseFrames = Math.round(44_100 * 8 * (60 / 100));
      const third = Math.floor(phraseFrames / 3);
      expect(rms(pcm, 0, third)).toBeGreaterThan(0.02);
      expect(rms(pcm, third, 2 * third)).toBeGreaterThan(0.02);
      expect(rms(pcm, 2 * third, phraseFrames)).toBeGreaterThan(0.02);
    } finally {
      wrapper.unmount();
    }
  });

  it('localizes its title for the ja locale', () => {
    lang.value = 'ja';
    const wrapper = mountDemo(false);
    try {
      expect(wrapper.find('.td__title').text()).toContain('MIDI のフレーズ');
    } finally {
      wrapper.unmount();
    }
  });
});
