import type { SonareWasmModule } from '@/composables/useWasmBoot';
import { mulberry32 } from '@/demos/inline/audio/processors';

export const DEFAULT_AB_PROCESSOR = 'denoise-classical';

const VOWEL_PROCESSOR = 'effects.filter.vowel';
const NMF_COMPONENT_COUNT = 4;

interface NmfCacheEntry {
  sampleRate: number;
  components: Float32Array[];
}

// Both keys are weak: a page can mount and unmount demos without making this
// cache retain a WASM module or an old clip buffer for the lifetime of the page.
const nmfCache = new WeakMap<object, WeakMap<Float32Array, NmfCacheEntry>>();

function componentIndex(mode: string): number {
  const index = Number(mode);
  if (!Number.isInteger(index) || index < 0 || index >= NMF_COMPONENT_COUNT) {
    throw new Error(
      `ab-process: NMF component must be an integer from 0 to ${NMF_COMPONENT_COUNT - 1} (got ${mode})`,
    );
  }
  return index;
}

/** Prepare all NMF components once for one WASM module, source buffer, and rate. */
export function prepareNmfStems(
  wasm: SonareWasmModule,
  samples: Float32Array,
  sampleRate: number,
): Float32Array[] {
  const bySource = nmfCache.get(wasm);
  const cached = bySource?.get(samples);
  if (cached?.sampleRate === sampleRate) return cached.components;

  const result = wasm.decomposeStems({
    samples,
    sampleRate,
    nComponents: NMF_COMPONENT_COUNT,
    nFft: 1024,
    hopLength: 256,
    nIter: 30,
  });
  if (
    result.components.length !== NMF_COMPONENT_COUNT ||
    result.components.some((component) => component.length !== samples.length)
  ) {
    throw new Error('ab-process: NMF returned an unexpected component shape');
  }

  const nextCache = bySource ?? new WeakMap<Float32Array, NmfCacheEntry>();
  if (!bySource) nmfCache.set(wasm, nextCache);
  nextCache.set(samples, { sampleRate, components: result.components });
  return result.components;
}

const HUM_FUNDAMENTAL_HZ = 50;
const HUM_HARMONICS = 4;
const HUM_AMPLITUDE = 0.04;
const CRACKLE_PER_SECOND = 80;
const CRACKLE_AMPLITUDE = 0.5;

/** Add mains hum: a 50 Hz fundamental and three harmonics with falling levels and fixed phases. */
export function injectHum(samples: Float32Array, sampleRate: number): Float32Array {
  const out = new Float32Array(samples.length);
  for (let i = 0; i < out.length; i++) {
    let hum = 0;
    for (let k = 1; k <= HUM_HARMONICS; k++) {
      hum +=
        (HUM_AMPLITUDE / Math.sqrt(k)) *
        Math.sin((2 * Math.PI * HUM_FUNDAMENTAL_HZ * k * i) / sampleRate + k);
    }
    out[i] = samples[i]! + hum;
  }
  return out;
}

/** Add seeded crackle: random-polarity pops one or two samples long at a fixed density. */
export function injectCrackle(samples: Float32Array, sampleRate: number): Float32Array {
  const out = Float32Array.from(samples);
  const rng = mulberry32(0x5eed);
  const count = Math.round((CRACKLE_PER_SECOND * samples.length) / sampleRate);
  for (let n = 0; n < count; n++) {
    const at = Math.floor(rng() * (samples.length - 4));
    const pop = CRACKLE_AMPLITUDE * (0.4 + 0.6 * rng()) * (rng() < 0.5 ? -1 : 1);
    const length = 1 + Math.floor(rng() * 2);
    for (let j = 0; j < length; j++) out[at + j]! += pop * (1 - j / length);
  }
  return out;
}

/** Contaminate a clean clip with the defect a repair demo is about to remove. */
export function injectDefect(
  kind: string,
  samples: Float32Array,
  sampleRate: number,
): Float32Array {
  if (kind === 'hum') return injectHum(samples, sampleRate);
  if (kind === 'crackle') return injectCrackle(samples, sampleRate);
  throw new Error(`ab-process: unknown defect "${kind}"`);
}

/**
 * Run one of the processors supported by the A/B process archetype.
 *
 * The vowel entry deliberately uses the named mastering processor instead of a
 * browser-side filter. That keeps the demo's five voices on the same WASM path
 * used by the library's public mastering API. NMF prepares all four unnamed
 * components together because selecting another component must not rerun the
 * factorisation.
 */
export function renderAbProcess(
  wasm: SonareWasmModule,
  processorName: string,
  samples: Float32Array,
  sampleRate: number,
  mode: string,
): Float32Array {
  switch (processorName) {
    case 'denoise-classical':
      return wasm.masteringRepairDenoiseClassical(samples, sampleRate, {
        mode: mode as 'logMmse' | 'spectralSubtraction' | 'mmseStsa',
        overSubtraction: 1.5,
      });
    case 'repair-clicks':
      return wasm.masteringRepairDeclick(samples, sampleRate);
    case 'repair-dehum': {
      if (mode !== 'subtract' && mode !== 'notch' && mode !== 'fundamental') {
        throw new Error(
          `ab-process: dehum mode must be subtract, notch or fundamental (got ${mode})`,
        );
      }
      return wasm.masteringRepairDehum(samples, sampleRate, {
        fundamentalHz: HUM_FUNDAMENTAL_HZ,
        harmonics: mode === 'fundamental' ? 1 : HUM_HARMONICS,
        mode: mode === 'notch' ? 'notch' : 'subtract',
      });
    }
    case 'repair-crackle': {
      const threshold = Number(mode);
      if (!(threshold > 0)) {
        throw new Error(`ab-process: decrackle threshold must be positive (got ${mode})`);
      }
      return wasm.masteringRepairDecrackle(samples, sampleRate, { mode: 'median', threshold });
    }
    case 'dereverb-classical':
      return wasm.masteringRepairDereverbClassical(samples, sampleRate);
    case 'hpss-decompose':
      return wasm.hpss(samples, sampleRate).percussive;
    case 'vowel-filter': {
      const vowel = Number(mode);
      if (!Number.isInteger(vowel) || vowel < 0 || vowel > 4) {
        throw new Error(`ab-process: vowel mode must be an integer from 0 to 4 (got ${mode})`);
      }
      return wasm.masteringProcess(VOWEL_PROCESSOR, samples, sampleRate, {
        vowel,
        accelMs: 0,
        dryWet: 1,
        driveOn: false,
      }).samples;
    }
    case 'nmf-stems': {
      const index = componentIndex(mode);
      return prepareNmfStems(wasm, samples, sampleRate)[index]!;
    }
    default:
      throw new Error(`ab-process: unknown processor "${processorName}"`);
  }
}
