/**
 * Seeded, deterministic per-voice variation, faithfully ported from libsonare's
 * `src/midi/synth/voice_random.h`.
 *
 * Determinism contract: no wall clock, no native RNG. All variation derives from
 * a (voiceIndex, note, age) seed through a fixed SplitMix64 integer hash, so a
 * given note reproduces the same excitation as the C++ core. 64-bit integer math
 * requires BigInt in JavaScript; callers precompute a per-note noise table at
 * note-on rather than hashing inside the sample loop.
 */

const MASK64 = (1n << 64n) - 1n;
const GAMMA = 0x9e3779b97f4a7c15n;
const M1 = 0xbf58476d1ce4e5b9n;
const M2 = 0x94d049bb133111ebn;
const INV_2POW24 = 1 / 16777216;

/** SplitMix64-style avalanche of a 64-bit seed (Steele/Lea/Flood finalizer). */
export function voiceHash(seed: bigint): bigint {
  let z = (seed + GAMMA) & MASK64;
  z = ((z ^ (z >> 30n)) * M1) & MASK64;
  z = ((z ^ (z >> 27n)) * M2) & MASK64;
  return z ^ (z >> 31n);
}

/** Combines the canonical per-voice identifiers into one seed. */
export function voiceSeed(voiceIndex: number, note: number, age: bigint): bigint {
  return voiceHash(((BigInt(voiceIndex) << 40n) ^ (BigInt(note) << 32n) ^ age) & MASK64);
}

/** Uniform float in [0, 1) from a seed (top 24 bits keep the mapping exact). */
export function voiceRandomUnipolar(seed: bigint): number {
  return Number(voiceHash(seed) >> 40n) * INV_2POW24;
}

/** Uniform float in [-1, 1) from a seed. */
export function voiceRandomBipolar(seed: bigint): number {
  return 2 * voiceRandomUnipolar(seed) - 1;
}

/**
 * A small deterministic stream for voices that need several variation values.
 * Counter-based: `at(k)` is independent of how many values were drawn before it,
 * mirroring the C++ `VoiceRandomSequence`.
 */
export class VoiceRandomSequence {
  private seed = 0n;
  private counter = 0n;

  constructor(seed = 0n) {
    this.seed = seed & MASK64;
  }

  reseed(voiceIndex: number, note: number, age: bigint): void {
    this.seed = voiceSeed(voiceIndex, note, age);
    this.counter = 0n;
  }

  nextUnipolar(): number {
    return voiceRandomUnipolar((this.seed ^ this.counter++) & MASK64);
  }

  nextBipolar(): number {
    return voiceRandomBipolar((this.seed ^ this.counter++) & MASK64);
  }

  /** Random access without disturbing the stream position. */
  unipolarAt(index: number | bigint): number {
    return voiceRandomUnipolar((this.seed ^ BigInt(index)) & MASK64);
  }

  bipolarAt(index: number | bigint): number {
    return voiceRandomBipolar((this.seed ^ BigInt(index)) & MASK64);
  }
}
