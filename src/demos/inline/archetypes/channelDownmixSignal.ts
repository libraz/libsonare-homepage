/**
 * Test bed for the channel-downmix demo: a 5.1 source the engine folds.
 *
 * Each channel first plays its own short sound in canonical order (a roll call,
 * so every channel's path through the fold is audible on its own), then every
 * enabled channel plays the same in-phase sine together. That last segment is
 * the full-scale, in-phase case whose folded peak the docs state, and its
 * period is a whole number of samples so a sample lands on the exact crest.
 */

/** Canonical 5.1 order, matching `WAVE_FORMAT_EXTENSIBLE` and `downmix`. */
export const SURROUND_51_ROLES = ['L', 'R', 'C', 'LFE', 'Ls', 'Rs'] as const;
export type Surround51Role = (typeof SURROUND_51_ROLES)[number];

/** `ChannelLayout` ordinals the demo targets. */
export const DOWNMIX_TARGETS = { mono: 0, stereo: 1 } as const;
export type DownmixTarget = keyof typeof DOWNMIX_TARGETS;

export const DOWNMIX_SAMPLE_RATE = 44_100;
const SLOT_SECONDS = 0.42;
const GAP_SECONDS = 0.18;
const TOGETHER_SECONDS = 1.1;
const FADE_SECONDS = 0.015;
/** 200-sample period: sample 50 of every cycle is the exact crest. */
const TOGETHER_PERIOD = 200;

interface RollCallVoice {
  freq: number;
  /** Relative harmonic amplitudes, fundamental first. */
  harmonics: number[];
}

// Fronts are near-pure tones, the centre is hollow (odd harmonics), the
// surrounds are bright, and the LFE is a low sine the fold removes.
const ROLL_CALL: Record<Surround51Role, RollCallVoice> = {
  L: { freq: 523.25, harmonics: [1, 0.2] },
  R: { freq: 659.25, harmonics: [1, 0.2] },
  C: { freq: 392, harmonics: [1, 0, 0.33, 0, 0.2] },
  LFE: { freq: 55, harmonics: [1] },
  Ls: { freq: 293.66, harmonics: [1, 0.5, 0.33, 0.25, 0.2] },
  Rs: { freq: 349.23, harmonics: [1, 0.5, 0.33, 0.25, 0.2] },
};

export interface SurroundTimeline {
  /** Start and end frame of each channel's roll-call slot, in canonical order. */
  slots: Array<{ role: Surround51Role; start: number; end: number }>;
  /** Start and end frame of the in-phase segment. */
  together: { start: number; end: number };
  frames: number;
}

export function surroundTimeline(sampleRate = DOWNMIX_SAMPLE_RATE): SurroundTimeline {
  const slot = Math.round(SLOT_SECONDS * sampleRate);
  const gap = Math.round(GAP_SECONDS * sampleRate);
  const slots = SURROUND_51_ROLES.map((role, index) => ({
    role,
    start: index * slot,
    end: (index + 1) * slot,
  }));
  const togetherStart = SURROUND_51_ROLES.length * slot + gap;
  const togetherEnd = togetherStart + Math.round(TOGETHER_SECONDS * sampleRate);
  return {
    slots,
    together: { start: togetherStart, end: togetherEnd },
    frames: togetherEnd + gap,
  };
}

function fadeGain(i: number, length: number, fade: number): number {
  if (fade <= 0) return 1;
  if (i < fade) return 0.5 - 0.5 * Math.cos((Math.PI * i) / fade);
  const tail = length - 1 - i;
  if (tail < fade) return 0.5 - 0.5 * Math.cos((Math.PI * Math.max(0, tail)) / fade);
  return 1;
}

export interface SurroundSourceOptions {
  /** Peak level of every channel, linear (1 = full scale). */
  level: number;
  /** Which channels sound, in canonical order. */
  enabled: readonly boolean[];
  sampleRate?: number;
}

/**
 * The six planar channels the demo hands to `downmix`. Every enabled channel
 * peaks at exactly `level`, in its roll-call slot and in the in-phase segment.
 */
export function buildSurroundSource(options: SurroundSourceOptions): Float32Array[] {
  const sampleRate = options.sampleRate ?? DOWNMIX_SAMPLE_RATE;
  const level = Math.max(0, options.level);
  const timeline = surroundTimeline(sampleRate);
  const fade = Math.round(FADE_SECONDS * sampleRate);
  const channels = SURROUND_51_ROLES.map(() => new Float32Array(timeline.frames));

  timeline.slots.forEach(({ role, start, end }, index) => {
    if (!options.enabled[index]) return;
    const voice = ROLL_CALL[role];
    const length = end - start;
    const raw = new Float64Array(length);
    let peak = 0;
    for (let i = 0; i < length; i++) {
      const t = i / sampleRate;
      let v = 0;
      voice.harmonics.forEach((amp, h) => {
        v += amp * Math.sin(2 * Math.PI * voice.freq * (h + 1) * t);
      });
      // A gentle decay after the attack so each slot reads as a single note.
      v *= fadeGain(i, length, fade) * (1 - 0.35 * (i / length));
      raw[i] = v;
      peak = Math.max(peak, Math.abs(v));
    }
    const scale = peak > 0 ? level / peak : 0;
    const out = channels[index];
    for (let i = 0; i < length; i++) out[start + i] = raw[i] * scale;
  });

  const { start, end } = timeline.together;
  const length = end - start;
  for (let i = 0; i < length; i++) {
    const v = level * fadeGain(i, length, fade) * Math.sin((2 * Math.PI * i) / TOGETHER_PERIOD);
    channels.forEach((out, index) => {
      if (options.enabled[index]) out[start + i] = v;
    });
  }
  return channels;
}

/** Largest absolute sample of each channel. */
export function channelPeaks(channels: readonly Float32Array[]): number[] {
  return channels.map((samples) => {
    let peak = 0;
    for (const s of samples) peak = Math.max(peak, Math.abs(s));
    return peak;
  });
}

/** Peak per block of `blockSize` frames, for meters that follow playback. */
export function peakEnvelope(samples: Float32Array, blockSize: number): Float32Array {
  const blocks = Math.ceil(samples.length / blockSize);
  const out = new Float32Array(blocks);
  for (let b = 0; b < blocks; b++) {
    let peak = 0;
    const end = Math.min(samples.length, (b + 1) * blockSize);
    for (let i = b * blockSize; i < end; i++) peak = Math.max(peak, Math.abs(samples[i]));
    out[b] = peak;
  }
  return out;
}

/** Linear amplitude to dBFS; `-Infinity` for silence. */
export function toDbfs(linear: number): number {
  return linear > 0 ? 20 * Math.log10(linear) : Number.NEGATIVE_INFINITY;
}

/**
 * Listening copy of the fold: scaled so its loudest sample sits at `ceiling`.
 * Only the audition uses it; the meters read the unscaled fold.
 */
export function normalizeForListening(
  channels: readonly Float32Array[],
  ceiling: number,
): { channels: Float32Array[]; gain: number } {
  const peak = Math.max(0, ...channelPeaks(channels));
  const gain = peak > 0 ? ceiling / peak : 1;
  return { channels: channels.map((c) => c.map((s) => s * gain)), gain };
}
