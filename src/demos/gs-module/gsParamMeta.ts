/**
 * Unit and range for a bound control, asked of the engine's capability
 * catalog rather than written down here — a second copy would drift from the
 * build that actually ships. A stage the catalog does not carry (`utility.gain`
 * in the bundled build) is a stage this build predates, not an error.
 */

import type { SonareWasmModule } from '@/composables/useWasmBoot';
import type { CapabilityCatalogParameter } from '@/wasm/public_types';

export interface GsParamMeta {
  unit: string | null;
  min: number | null;
  max: number | null;
  default: number | null;
}

/** The map key {@link paramMetaOf} keys its entries by. */
export function paramMetaKey(stage: string, key: string): string {
  return `${stage}/${key}`;
}

function toMeta(param: CapabilityCatalogParameter): GsParamMeta {
  return {
    unit: param.unit,
    min: param.min,
    max: param.max,
    default: typeof param.default === 'number' ? param.default : null,
  };
}

let cache: Map<string, GsParamMeta> | null = null;

/** Every (stage, key) the bundled engine can describe, keyed by `${stage}/${key}`. */
export function paramMetaOf(wasm: SonareWasmModule): Map<string, GsParamMeta> {
  if (cache) return cache;
  const meta = new Map<string, GsParamMeta>();
  for (const processor of wasm.capabilityCatalog().processors) {
    for (const param of processor.params) {
      meta.set(paramMetaKey(processor.id, param.name), toMeta(param));
    }
  }
  cache = meta;
  return meta;
}
