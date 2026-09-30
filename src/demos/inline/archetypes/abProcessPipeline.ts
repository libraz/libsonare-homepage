import type { SonareWasmModule } from '@/composables/useWasmBoot';

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
