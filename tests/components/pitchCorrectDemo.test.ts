import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { flushPromises, mount } from '@vue/test-utils';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';

const lang = ref('en');
vi.mock('vitepress', () => ({ useData: () => ({ lang }) }));

import PitchCorrectDemo from '@/components/demos/archetypes/PitchCorrectDemo.vue';
import { getDemo } from '@/demos/registry';
import * as wasm from '@/wasm/index.js';

// The demo plays mono PCM through the shared AudioContext. A stub context records
// the exact buffer handed to playback so a test can inspect the rendered audio.
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

const SR = 32_000;
const HOP = 256;
const BPM = 100;
const MELODY = [60, 62, 64, 65, 67, 65, 64, 62, 64, 65, 67, 69, 67, 65, 64, 60];
const DETUNE = [
  0.4, -0.3, 0.6, -0.5, 0.35, -0.6, 0.5, -0.25, 0.45, -0.4, 0.55, -0.5, 0.3, -0.45, 0.5, -0.35,
];
const C_MAJOR_MASK = 0xab5;
const C_MAJOR_DEGREES = [0, 2, 4, 5, 7, 9, 11];

function peakOf(pcm: Float32Array): number {
  let peak = 0;
  for (const v of pcm) peak = Math.max(peak, Math.abs(v));
  return peak;
}

function peakNormalize(pcm: Float32Array, target = 0.85): void {
  const gain = target / Math.max(1e-9, peakOf(pcm));
  for (let i = 0; i < pcm.length; i++) pcm[i] *= gain;
}

/** Bounce the deliberately off-pitch C-major melody through the vocal engine. */
function renderRaw(): Float32Array {
  const project = new (wasm as unknown as { Project: any }).Project();
  try {
    project.setSampleRate(SR);
    project.setTempoSegments([{ startPpq: 0, bpm: BPM }]);
    const { clipId } = project.addMidiClip(0, MELODY.length);
    const Project = (wasm as unknown as { Project: any }).Project;
    const tagged: Array<{ at: number; key: number; ev: unknown }> = [];
    for (let i = 0; i < MELODY.length; i++) {
      const bend = 8192 + Math.round(DETUNE[i] * 4096);
      tagged.push({ at: i, key: 0, ev: Project.midiPitchBend(i, 0, 0, bend) });
      tagged.push({ at: i, key: 1, ev: Project.midiNoteOn(i, 0, 0, MELODY[i], 96) });
      tagged.push({ at: i + 0.9, key: 2, ev: Project.midiNoteOff(i + 0.9, 0, 0, MELODY[i], 0) });
    }
    tagged.sort((a, b) => a.at - b.at || a.key - b.key);
    project.setMidiEvents(
      clipId,
      tagged.map((t) => t.ev),
    );
    const totalFrames = Math.round(SR * ((MELODY.length * 60) / BPM + 0.4));
    const pcm = project.bounceWithSynthInstrument(
      { engineMode: 'vocal', gain: 1, polyphony: 1, ampAttackMs: 8, ampReleaseMs: 120 },
      { numChannels: 1, sampleRate: SR, totalFrames },
    );
    peakNormalize(pcm);
    return pcm;
  } finally {
    project.delete();
  }
}

/** Mean absolute distance from the nearest C-major tone over voiced frames, cents. */
function meanCentsOffScale(samples: Float32Array): number {
  const pr = wasm.pitchPyin(samples, SR, 2048, HOP, 65, 1000, 0.1, true);
  let sum = 0;
  let n = 0;
  for (let i = 0; i < pr.f0.length; i++) {
    if (!pr.voicedFlag[i]) continue;
    const hz = pr.f0[i];
    if (!(hz > 0)) continue;
    const midi = 69 + 12 * Math.log2(hz / 440);
    let best = Number.POSITIVE_INFINITY;
    const base = Math.round(midi / 12) * 12;
    for (let oct = -1; oct <= 1; oct++) {
      for (const d of C_MAJOR_DEGREES) {
        best = Math.min(best, Math.abs((midi - (base + oct * 12 + d)) * 100));
      }
    }
    sum += best;
    n++;
  }
  return n > 0 ? sum / n : 0;
}

function mountDemo(active = false) {
  const def = getDemo('pitch-correct');
  if (!def) throw new Error('pitch-correct not registered');
  return mount(PitchCorrectDemo, { props: { def, active } });
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

beforeAll(async () => {
  await wasm.init({ wasmBinary: readFileSync(join(process.cwd(), 'src/wasm/sonare.wasm')) });
  (globalThis as unknown as { AudioContext: unknown }).AudioContext = StubAudioContext;
  (window as unknown as { AudioContext: unknown }).AudioContext = StubAudioContext;
}, 30_000);

beforeEach(() => {
  captured = null;
  lang.value = 'en';
});

describe('pitch correction DSP chain', () => {
  it('retunes an off-pitch take meaningfully closer to the scale', () => {
    const raw = renderRaw();
    const pr = wasm.pitchPyin(raw, SR, 2048, HOP, 65, 1000, 0.1, true);
    const voiced = new Int32Array(pr.f0.length);
    for (let i = 0; i < voiced.length; i++) voiced[i] = pr.voicedFlag[i] ? 1 : 0;

    const tuned = wasm.pitchCorrectTimevarying(raw, pr.f0, SR, HOP, {
      mode: 'scale',
      scaleRoot: 0,
      scaleModeMask: C_MAJOR_MASK,
      retuneAmount: 1,
      retuneSpeedMs: 15,
      vibratoThresholdCents: 10,
      voiced,
    });
    peakNormalize(tuned);

    const rawCents = meanCentsOffScale(raw);
    const tunedCents = meanCentsOffScale(tuned);

    // The raw take sits well off the grid; correction pulls it much closer.
    expect(rawCents).toBeGreaterThan(25);
    expect(tunedCents).toBeLessThan(rawCents * 0.6);

    // Corrected output is peak-normalized to the demo headroom and length-preserving.
    expect(peakOf(tuned)).toBeGreaterThan(0.8);
    expect(peakOf(tuned)).toBeLessThanOrEqual(0.86);
    expect(tuned.length).toBe(raw.length);
    expect(raw.length).toBeGreaterThan(SR * 9);
  }, 30_000);
});

describe('PitchCorrectDemo', () => {
  it('renders its chrome in the idle state without touching the engine', () => {
    const wrapper = mountDemo(false);
    try {
      expect(wrapper.find('.td__eyebrow').text()).toContain('PITCH CORRECT');
      expect(wrapper.find('.td__title').text()).toContain('Pitch correction');
      expect(wrapper.find('figure.td--error').exists()).toBe(false);
      expect(wrapper.find('.pc-canvas').exists()).toBe(true);
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

  it('auditions peak-normalized audio for the selected side', async () => {
    const wrapper = mountDemo(true);
    try {
      await settle(wrapper);
      expect(wrapper.find('figure.td--ready').exists()).toBe(true);

      await wrapper.find('button.td__play').trigger('click');
      await flushPromises();

      expect(captured).not.toBeNull();
      const pcm = captured as Float32Array;
      expect(peakOf(pcm)).toBeGreaterThan(0.8);
      expect(peakOf(pcm)).toBeLessThanOrEqual(0.86);
      // The tuned side (default view) is close to the scale it was snapped to.
      expect(meanCentsOffScale(pcm)).toBeLessThan(20);
    } finally {
      wrapper.unmount();
    }
  });

  it('localizes its title for the ja locale', () => {
    lang.value = 'ja';
    const wrapper = mountDemo(false);
    try {
      expect(wrapper.find('.td__title').text()).toContain('ピッチ補正');
    } finally {
      wrapper.unmount();
    }
  });
});
