/**
 * JSON round-trip for tuned physical-model patches. The exported shape mirrors
 * the libsonare `*PatchParams` struct 1:1 under `params`, so a maintainer can
 * transcribe a tuned voice straight into `gm_fallback_map.cpp` /
 * `synth_presets.cpp`. The `wrapper` block carries the audition envelope/body/
 * gain (not part of the physical model) so a shared patch reloads identically.
 */
import { buildDefaultSpec, type ModelSpec } from '@/tuner/dsp/engine';
import { ENGINE_INFO, type PhysicalEngineMode, paramSpecsFor } from '@/tuner/dsp/params';

/** The deep `*PatchParams` object for a spec's active engine. */
export function activeParams(spec: ModelSpec): Record<string, unknown> {
  switch (spec.engineMode) {
    case 'karplus-strong':
      return spec.ks as Record<string, unknown>;
    case 'modal':
      return spec.modal as Record<string, unknown>;
    case 'bowed-string':
      return spec.bowed as Record<string, unknown>;
    case 'reed':
      return spec.reed as Record<string, unknown>;
    case 'brass':
      return spec.brass as Record<string, unknown>;
    case 'flute':
      return spec.flute as Record<string, unknown>;
    case 'piano':
      return spec.piano as Record<string, unknown>;
    case 'pipe-organ':
      return spec.pipeOrgan as Record<string, unknown>;
    case 'percussion':
      return spec.percussion as Record<string, unknown>;
    case 'plucked-string':
      return spec.pluckedString as Record<string, unknown>;
    case 'vocal':
      return spec.vocal as Record<string, unknown>;
    case 'free-reed':
      return spec.freeReed as Record<string, unknown>;
  }
}

/** The GM/GS slot a tuned patch is contributed for. */
export interface TunerTarget {
  /** `GM` = General MIDI Level 1 capital tone; `GS` = a Roland GS address. */
  standard: 'GM' | 'GS';
  kind: 'melodic' | 'drum';
  /** GM program (melodic) — omitted for drums. */
  program?: number;
  /** GM channel-10 note (drum) — omitted for melodic. */
  drumNote?: number;
  /** GS bank select addressing a variation tone: CC0 (MSB) / CC32 (LSB).
   *  The GS capital tone is 0 / 0. Present only for GS melodic targets. */
  bankMsb?: number;
  bankLsb?: number;
  /** GS drum-kit program (channel-10 program change) the note belongs to.
   *  Present only for GS drum targets; GM has a single Standard Kit. */
  drumKit?: number;
  /** Human-readable instrument / drum name. */
  name: string;
}

/** Serializable tuner patch. */
export interface TunerPatchJson {
  format: 'libsonare-physical-model';
  version: 1;
  engine: PhysicalEngineMode;
  /** The GM/GS slot this patch fills in (absent when no target was chosen). */
  target?: TunerTarget;
  params: Record<string, unknown>;
  wrapper: {
    body: ModelSpec['body'];
    bodyMix: number;
    drive: number;
    ampEnv: ModelSpec['ampEnv'];
    gain: number;
  };
}

export function specToJson(spec: ModelSpec, target?: TunerTarget | null): TunerPatchJson {
  return {
    format: 'libsonare-physical-model',
    version: 1,
    engine: spec.engineMode,
    ...(target ? { target } : {}),
    // JSON round-trip (not structuredClone) so a reactive-Proxy spec from the
    // page's `ref` de-proxies cleanly — structuredClone throws on a Proxy.
    params: JSON.parse(JSON.stringify(activeParams(spec))),
    wrapper: {
      body: spec.body,
      bodyMix: spec.bodyMix,
      drive: spec.drive,
      ampEnv: { ...spec.ampEnv },
      gain: spec.gain,
    },
  };
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Merge an imported mode/rank table element (e.g. one modal mode) over its
 * default, coercing each numeric field to a finite value and each boolean.
 * Unknown fields on the incoming element are ignored.
 */
function mergeTableElement(def: unknown, incoming: unknown): unknown {
  if (!isPlainObject(def)) return def;
  const out: Record<string, unknown> = { ...def };
  if (isPlainObject(incoming)) {
    for (const key of Object.keys(out)) {
      const dv = out[key];
      const iv = incoming[key];
      if (typeof dv === 'number') {
        out[key] = typeof iv === 'number' && Number.isFinite(iv) ? iv : dv;
      } else if (typeof dv === 'boolean') {
        out[key] = typeof iv === 'boolean' ? iv : dv;
      }
    }
  }
  return out;
}

/**
 * Merge imported `params` over the engine defaults with validation: scalar
 * numbers are coerced finite and clamped to the tuning-UI range, booleans are
 * coerced, and nested mode/rank tables are sized to the default's declared
 * length (so a truncated or missing table can never index past its end and
 * throw at render). Fields absent from the defaults are ignored.
 */
function sanitizeParams(
  defaults: Record<string, unknown>,
  incoming: Record<string, unknown>,
): void {
  const ranges = new Map(paramSpecsFor(defaults).map((s) => [s.key, s] as const));
  for (const key of Object.keys(defaults)) {
    if (!(key in incoming)) continue;
    const dv = defaults[key];
    const iv = incoming[key];
    if (typeof dv === 'number') {
      let n = typeof iv === 'number' && Number.isFinite(iv) ? iv : dv;
      const r = ranges.get(key);
      if (r) n = Math.min(Math.max(n, r.min), r.max);
      defaults[key] = n;
    } else if (typeof dv === 'boolean') {
      defaults[key] = typeof iv === 'boolean' ? iv : dv;
    } else if (Array.isArray(dv)) {
      // Keep the default (fixed-capacity) table length; merge whatever the
      // import supplied element-by-element.
      const src = Array.isArray(iv) ? iv : [];
      defaults[key] = dv.map((el, i) => mergeTableElement(el, src[i]));
    }
    // Non-array objects and unknown shapes: keep the default.
  }
}

/** Rebuild a spec from imported JSON, merging over the engine defaults. */
export function jsonToSpec(json: unknown): ModelSpec {
  if (!json || typeof json !== 'object') throw new Error('Not a tuner patch object');
  const j = json as Partial<TunerPatchJson>;
  const engine = j.engine;
  if (!engine || !(engine in ENGINE_INFO)) throw new Error(`Unknown engine: ${String(engine)}`);
  const spec = buildDefaultSpec(engine);
  if (j.params && typeof j.params === 'object') {
    sanitizeParams(activeParams(spec), j.params as Record<string, unknown>);
  }
  if (j.wrapper && typeof j.wrapper === 'object') {
    const w = j.wrapper;
    if (w.body !== undefined) spec.body = w.body;
    if (Number.isFinite(w.bodyMix)) spec.bodyMix = w.bodyMix as number;
    if (Number.isFinite(w.drive)) spec.drive = w.drive as number;
    if (w.ampEnv && typeof w.ampEnv === 'object') {
      const env = { ...spec.ampEnv };
      for (const key of Object.keys(env) as (keyof typeof env)[]) {
        const v = (w.ampEnv as Record<string, unknown>)[key];
        if (typeof v === 'number' && Number.isFinite(v)) env[key] = v;
      }
      spec.ampEnv = env;
    }
    if (Number.isFinite(w.gain)) spec.gain = w.gain as number;
  }
  return spec;
}

/** Read the contribution target back from an imported patch, if present. */
export function targetFromJson(json: unknown): TunerTarget | null {
  if (!json || typeof json !== 'object') return null;
  const t = (json as { target?: unknown }).target;
  if (!t || typeof t !== 'object') return null;
  const c = t as Record<string, unknown>;
  if (c.standard !== 'GM' && c.standard !== 'GS') return null;
  if (c.kind !== 'melodic' && c.kind !== 'drum') return null;
  const out: TunerTarget = {
    standard: c.standard,
    kind: c.kind,
    name: typeof c.name === 'string' ? c.name : '',
  };
  if (typeof c.program === 'number') out.program = c.program;
  if (typeof c.drumNote === 'number') out.drumNote = c.drumNote;
  if (typeof c.bankMsb === 'number') out.bankMsb = c.bankMsb;
  if (typeof c.bankLsb === 'number') out.bankLsb = c.bankLsb;
  if (typeof c.drumKit === 'number') out.drumKit = c.drumKit;
  return out;
}

/** Trigger a browser download of the patch JSON. */
export function downloadPatch(
  spec: ModelSpec,
  target?: TunerTarget | null,
  filename?: string,
): void {
  const json = specToJson(spec, target);
  const blob = new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename ?? `${spec.engineMode}-patch.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
