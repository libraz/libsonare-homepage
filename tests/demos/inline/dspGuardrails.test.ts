import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';
import {
  magnitudePeak,
  normalizeMagnitudeRelativeDb,
} from '@/demos/inline/archetypes/spectralDisplay';
import type { SonareDemoDef } from '@/demos/inline/types';
import type { MonoAudio } from '@/demos/inline/useSonareDemoAudio';
import * as wasm from '@/wasm/index.js';

const lang = ref('en');
vi.mock('vitepress', () => ({ useData: () => ({ lang }) }));

const audioRuntime = vi.hoisted(() => ({
  ensureWasm: vi.fn(),
  play: vi.fn(),
  stop: vi.fn(),
  playingId: null as { value: string } | null,
  played: [] as MonoAudio[],
}));

vi.mock('@/demos/inline/useSonareDemoAudio', async () => {
  const { readonly, ref } = await vi.importActual<typeof import('vue')>('vue');
  const playingId = ref('');
  const progress = ref(0);
  audioRuntime.playingId = playingId;
  audioRuntime.play.mockImplementation(async (id: string, audio: MonoAudio) => {
    audioRuntime.played.push(audio);
    playingId.value = id;
  });
  audioRuntime.stop.mockImplementation(() => {
    playingId.value = '';
    progress.value = 0;
  });
  return {
    useSonareDemoAudio: () => ({
      ensureWasm: audioRuntime.ensureWasm,
      loadClip: vi.fn(),
      play: audioRuntime.play,
      stop: audioRuntime.stop,
      playingId: readonly(playingId),
      progress: readonly(progress),
    }),
  };
});

import CompressorDemo from '@/demos/inline/archetypes/CompressorDemo.vue';
import SendRoutingDemo from '@/demos/inline/archetypes/SendRoutingDemo.vue';
import SynthDemo from '@/demos/inline/archetypes/SynthDemo.vue';

const sendDef: SonareDemoDef = {
  id: 'pre-post-fader',
  archetype: 'send-routing',
  source: { kind: 'generate', signal: 'sine', freq: 220 },
  title: { en: 'Send routing', ja: 'センドルーティング' },
  params: [
    {
      key: 'fader',
      kind: 'range',
      default: 0,
      min: -40,
      max: 6,
      step: 1,
      unit: 'dB',
      label: { en: 'Channel fader', ja: 'チャンネルフェーダー' },
    },
  ],
};

const compressorDef: SonareDemoDef = {
  id: 'compressor-curve',
  archetype: 'compressor',
  source: { kind: 'generate', signal: 'saw', freq: 150 },
  title: { en: 'Compressor', ja: 'コンプレッサー' },
  params: [
    {
      key: 'threshold',
      kind: 'range',
      default: -18,
      min: -42,
      max: 0,
      step: 1,
      unit: 'dB',
      label: { en: 'Threshold', ja: 'スレッショルド' },
    },
    {
      key: 'ratio',
      kind: 'range',
      default: 4,
      min: 1,
      max: 20,
      step: 0.5,
      unit: ':1',
      label: { en: 'Ratio', ja: 'レシオ' },
    },
    {
      key: 'knee',
      kind: 'range',
      default: 6,
      min: 0,
      max: 24,
      step: 1,
      unit: 'dB',
      label: { en: 'Knee', ja: 'ニー' },
    },
    {
      key: 'attack',
      kind: 'range',
      default: 15,
      min: 1,
      max: 120,
      step: 1,
      unit: 'ms',
      label: { en: 'Attack', ja: 'アタック' },
    },
    {
      key: 'release',
      kind: 'range',
      default: 160,
      min: 20,
      max: 600,
      step: 10,
      unit: 'ms',
      label: { en: 'Release', ja: 'リリース' },
    },
  ],
};

const synthDef: SonareDemoDef = {
  id: 'synth-note',
  archetype: 'synth',
  source: { kind: 'generate', signal: 'saw', freq: 220 },
  title: { en: 'Synth note', ja: 'シンセ音' },
  params: [
    {
      key: 'waveform',
      kind: 'select',
      default: 'saw',
      label: { en: 'Oscillator', ja: 'オシレーター' },
      options: [{ value: 'saw', label: { en: 'Saw', ja: 'ノコギリ' } }],
    },
    {
      key: 'cutoff',
      kind: 'range',
      default: 2200,
      min: 200,
      max: 8000,
      step: 50,
      unit: 'Hz',
      label: { en: 'Cutoff', ja: 'カットオフ' },
    },
    {
      key: 'attack',
      kind: 'range',
      default: 8,
      min: 1,
      max: 400,
      step: 1,
      unit: 'ms',
      label: { en: 'Attack', ja: 'アタック' },
    },
  ],
};

function peak(samples: Float32Array): number {
  return Math.max(...Array.from(samples, (sample) => Math.abs(sample)));
}

function maximum(values: ArrayLike<number>): number {
  let result = Number.NEGATIVE_INFINITY;
  for (let i = 0; i < values.length; i++) result = Math.max(result, values[i] ?? 0);
  return result;
}

function minimum(values: ArrayLike<number>): number {
  let result = Number.POSITIVE_INFINITY;
  for (let i = 0; i < values.length; i++) result = Math.min(result, values[i] ?? 0);
  return result;
}

function sineMix(sampleRate: number, duration: number): Float32Array {
  const samples = new Float32Array(Math.round(sampleRate * duration));
  for (let i = 0; i < samples.length; i++) {
    const t = i / sampleRate;
    const tone = 0.55 * Math.sin(2 * Math.PI * 220 * t);
    const pulse = i % Math.round(sampleRate * 0.1) < 48 ? 0.35 : 0;
    samples[i] = tone + pulse;
  }
  return samples;
}

describe('inline DSP display guardrails', () => {
  beforeAll(async () => {
    await wasm.init({ wasmBinary: readFileSync(join(process.cwd(), 'src/wasm/sonare.wasm')) });
  }, 30_000);

  beforeEach(() => {
    audioRuntime.ensureWasm.mockReset();
    audioRuntime.play.mockClear();
    audioRuntime.stop.mockClear();
    audioRuntime.played.length = 0;
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn(() => 1),
    );
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
  });

  afterEach(() => {
    if (audioRuntime.playingId) audioRuntime.playingId.value = '';
    lang.value = 'en';
    vi.unstubAllGlobals();
  });

  it('keeps real STFT peak contrast while mapping raw FFT magnitudes to relative dB', () => {
    const samples = sineMix(44_100, 1.2);
    const result = wasm.stft(samples, 44_100, 1024, 256);
    const rawPeak = magnitudePeak(result.magnitude);
    const normalized = normalizeMagnitudeRelativeDb(result.magnitude);

    expect(rawPeak).toBeGreaterThan(1);
    expect(maximum(normalized)).toBeCloseTo(1, 5);
    expect(minimum(normalized)).toBeLessThan(0.2);
    expect(normalized.every(Number.isFinite)).toBe(true);
  });

  it('uses one full-mix reference for HPSS layers instead of hiding attenuation', () => {
    const samples = sineMix(44_100, 1.2);
    const separated = wasm.hpss(samples, 44_100);
    const full = wasm.stft(samples, 44_100, 1024, 256).magnitude;
    const harmonic = wasm.stft(separated.harmonic, 44_100, 1024, 256).magnitude;
    const percussive = wasm.stft(separated.percussive, 44_100, 1024, 256).magnitude;
    const referencePeak = magnitudePeak(full);
    const harmonicDisplay = normalizeMagnitudeRelativeDb(harmonic, referencePeak);
    const percussiveDisplay = normalizeMagnitudeRelativeDb(percussive, referencePeak);

    const harmonicPeak = maximum(harmonicDisplay);
    const percussivePeak = maximum(percussiveDisplay);
    expect(harmonicPeak).toBeLessThanOrEqual(1);
    expect(percussivePeak).toBeLessThanOrEqual(1);
    expect(harmonicPeak).toBeGreaterThan(0);
    expect(percussivePeak).toBeGreaterThan(0);
    expect(harmonicPeak < 0.999 || percussivePeak < 0.999).toBe(true);
  });

  it('keeps the +6 dB send audition below full scale and locks its fader while playing', async () => {
    const wrapper = mount(SendRoutingDemo, {
      props: { def: sendDef, active: true },
    });
    const slider = wrapper.find<HTMLInputElement>('input[type="range"]');
    await slider.setValue('6');
    await wrapper.find<HTMLButtonElement>('button.td__play').trigger('click');
    await flushPromises();

    const rendered = audioRuntime.played.at(-1);
    expect(rendered).toBeDefined();
    expect(peak(rendered!.samples)).toBeLessThan(1);
    expect(peak(rendered!.samples)).toBeGreaterThan(0.5);
    expect(slider.element.disabled).toBe(true);
    wrapper.unmount();
  });

  it.each([
    ['compressor-curve', CompressorDemo, compressorDef, 'Threshold'],
    ['synth-note', SynthDemo, synthDef, 'Cutoff'],
  ] as const)(
    'stops a stale audition when %s controls change',
    async (id, component, def, label) => {
      if (id === 'synth-note') {
        class Project {
          static midiNoteOn() {
            return {};
          }
          static midiNoteOff() {
            return {};
          }
          setSampleRate() {}
          addMidiClip() {
            return { trackId: 0, clipId: 0 };
          }
          setMidiEvents() {}
          bounceWithSynthInstrument(_patch: Record<string, unknown>) {
            return Float32Array.from({ length: 512 }, (_, i) => Math.sin(i / 8) * 0.4);
          }
          delete() {}
        }
        audioRuntime.ensureWasm.mockResolvedValue({
          Project,
          synthPresetPatch: () => ({}),
        });
      }

      const wrapper = mount(component, {
        props: { def, active: true },
      });
      await flushPromises();
      await wrapper.find<HTMLButtonElement>('button.td__play').trigger('click');
      await flushPromises();
      expect(audioRuntime.playingId?.value).toBe(id);

      const control = wrapper
        .findAll('.dc__field')
        .find((field) => field.text().includes(label))
        ?.find('input[type="range"]');
      expect(control?.exists()).toBe(true);
      await control!.setValue(id === 'synth-note' ? '2500' : '-12');
      await flushPromises();

      expect(audioRuntime.stop).toHaveBeenCalled();
      expect(audioRuntime.playingId?.value).toBe('');
      wrapper.unmount();
    },
  );
});
