import type {
  SynthEngineMode,
  SynthParamCondition,
  SynthParamInfo,
  SynthPatch,
} from '@/wasm/index';

// Knob travel. Each sits inside the range `synthPatchParamInfo()` publishes and
// is deliberately narrower: the musical part of the field on a 270° knob.
export const CUTOFF_MIN_HZ = 80;
export const CUTOFF_MAX_HZ = 16_000;
export const RESONANCE_MIN = 0.5;
export const RESONANCE_MAX = 12;
export const ATTACK_MIN_MS = 1;
export const ATTACK_MAX_MS = 2_000;
export const RELEASE_MIN_MS = 10;
export const RELEASE_MAX_MS = 5_000;
export const GLIDE_MAX_MS = 300;

/** Each tweak key is the {@link SynthPatch} field it writes. */
export type SynthTweakKey =
  | 'waveform'
  | 'filterModel'
  | 'cutoffHz'
  | 'resonanceQ'
  | 'ampAttackMs'
  | 'ampReleaseMs'
  | 'glideMs'
  | 'stereoSpread';

/**
 * The tweaks the engine can move on sounding notes, through
 * `resolveInstrumentAutomationId` + `setParameterSmoothed`. The rest change the
 * voice's structure and need the instrument rebound.
 */
export const LIVE_TWEAKS: ReadonlySet<SynthTweakKey> = new Set([
  'cutoffHz',
  'resonanceQ',
  'ampAttackMs',
  'ampReleaseMs',
  'glideMs',
  'stereoSpread',
]);

export interface SynthPatchControls {
  waveform: string;
  filterModel: string;
  cutoffNorm: number;
  resonanceQ: number;
  attackNorm: number;
  releaseNorm: number;
  glideMs: number;
  stereoSpread: number;
}

export interface SynthPatchBaseValues {
  cutoffNorm: number;
  resonanceQ: number;
  attackNorm: number;
  releaseNorm: number;
  glideMs: number;
  stereoSpread: number;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function logKnobHz(norm: number, min: number, max: number): number {
  return Math.round(min * (max / min) ** norm);
}

export function hzToNorm(hz: number, min: number, max: number): number {
  return clamp(Math.log(hz / min) / Math.log(max / min), 0, 1);
}

export function msLabel(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)} s` : `${Math.round(ms)} ms`;
}

export function controlsFromPreset(base: Partial<SynthPatch>): {
  controls: SynthPatchControls;
  baseValues: SynthPatchBaseValues;
} {
  const controls: SynthPatchControls = {
    waveform: String(base.waveform ?? 'default'),
    filterModel: String(base.filterModel ?? 'default'),
    cutoffNorm: hzToNorm(base.cutoffHz ?? CUTOFF_MAX_HZ, CUTOFF_MIN_HZ, CUTOFF_MAX_HZ),
    resonanceQ: clamp(base.resonanceQ ?? 0.7, RESONANCE_MIN, RESONANCE_MAX),
    attackNorm: hzToNorm(
      clamp(base.ampAttackMs ?? 1, ATTACK_MIN_MS, ATTACK_MAX_MS),
      ATTACK_MIN_MS,
      ATTACK_MAX_MS,
    ),
    releaseNorm: hzToNorm(
      clamp(base.ampReleaseMs ?? 300, RELEASE_MIN_MS, RELEASE_MAX_MS),
      RELEASE_MIN_MS,
      RELEASE_MAX_MS,
    ),
    glideMs: clamp(base.glideMs ?? 0, 0, GLIDE_MAX_MS),
    stereoSpread: clamp(base.stereoSpread ?? 0, 0, 1),
  };

  return {
    controls,
    baseValues: {
      cutoffNorm: controls.cutoffNorm,
      resonanceQ: controls.resonanceQ,
      attackNorm: controls.attackNorm,
      releaseNorm: controls.releaseNorm,
      glideMs: controls.glideMs,
      stereoSpread: controls.stereoSpread,
    },
  };
}

/**
 * The init patch's wrapper values, as `synthPatchParamInfo()` reports them. A
 * base voice names no preset, so these are what it plays.
 */
export function initPatchValues(info: readonly SynthParamInfo[]): Partial<SynthPatch> {
  return Object.fromEntries(info.map((field) => [field.name, field.default]));
}

/** The patch field value a tweak writes, from the knob positions. */
export function tweakValue(key: SynthTweakKey, controls: SynthPatchControls): string | number {
  switch (key) {
    case 'waveform':
      return controls.waveform;
    case 'filterModel':
      return controls.filterModel;
    case 'cutoffHz':
      return logKnobHz(controls.cutoffNorm, CUTOFF_MIN_HZ, CUTOFF_MAX_HZ);
    case 'resonanceQ':
      return controls.resonanceQ;
    case 'ampAttackMs':
      return logKnobHz(controls.attackNorm, ATTACK_MIN_MS, ATTACK_MAX_MS);
    case 'ampReleaseMs':
      return logKnobHz(controls.releaseNorm, RELEASE_MIN_MS, RELEASE_MAX_MS);
    case 'glideMs':
      return controls.glideMs;
    case 'stereoSpread':
      return controls.stereoSpread;
  }
}

const BASE_VOICE_PREFIX = 'base:';

/**
 * Engines without a base voice: `default` keeps another patch's engine, and
 * `sample` has nothing to voice until a sample bank is supplied.
 */
const NO_BASE_VOICE: ReadonlySet<string> = new Set(['', 'default', 'sample']);

/** Program id of an engine's base voice: a patch that names only the engine mode. */
export function baseVoiceId(engine: string): string {
  return `${BASE_VOICE_PREFIX}${engine}`;
}

/** The engine a base-voice program id names, or null for a catalog preset. */
export function baseVoiceEngine(program: string): string | null {
  return program.startsWith(BASE_VOICE_PREFIX) ? program.slice(BASE_VOICE_PREFIX.length) : null;
}

export function hasBaseVoice(engine: string): boolean {
  return !NO_BASE_VOICE.has(engine);
}

/**
 * Build the instrument argument for the engine: the bare preset name while the
 * user has touched nothing, otherwise the preset (or, for a base voice, the
 * engine mode) plus only the touched fields.
 *
 * Membership in `dirtyTweaks` alone decides what is sent — never the value — so
 * an explicit `0` (a fully centered Width, an instant Glide) is emitted and
 * overrides the preset's own value.
 */
export function buildSynthPatch(
  program: string,
  dirtyTweaks: Set<SynthTweakKey>,
  controls: SynthPatchControls,
  engineParams: Record<string, number> = {},
): string | SynthPatch {
  const engine = baseVoiceEngine(program);
  const hasModel = Object.keys(engineParams).length > 0;
  if (dirtyTweaks.size === 0 && !engine && !hasModel) return program;

  const patch: SynthPatch = engine
    ? { engineMode: engine as SynthEngineMode }
    : { preset: program };
  const fields = patch as Record<string, unknown>;
  for (const key of dirtyTweaks) fields[key] = tweakValue(key, controls);
  if (hasModel) patch.engineParams = { ...engineParams };
  return patch;
}

/** The engine that has an oscillator for `waveform` to shape. */
const OSCILLATOR_ENGINE = 'subtractive';
/** The engine that voices its kit pieces itself, past every per-voice control. */
const KIT_ENGINE = 'percussion';

const NO_TWEAKS: ReadonlySet<SynthTweakKey> = new Set();
const OSCILLATOR_TWEAKS: ReadonlySet<SynthTweakKey> = new Set(['waveform']);
const ALL_TWEAKS: ReadonlySet<SynthTweakKey> = new Set([
  'waveform',
  'filterModel',
  'cutoffHz',
  'resonanceQ',
  'ampAttackMs',
  'ampReleaseMs',
  'glideMs',
  'stereoSpread',
]);

/**
 * The tweaks an engine renders bit-identically without, measured across the
 * whole preset catalog. An engine not yet known has none.
 */
export function inertTweaks(engine: string): ReadonlySet<SynthTweakKey> {
  if (!engine || engine === OSCILLATOR_ENGINE) return NO_TWEAKS;
  return engine === KIT_ENGINE ? ALL_TWEAKS : OSCILLATOR_TWEAKS;
}

/** One engine and the programs that run on it, its base voice first. */
export interface EngineGroup {
  engine: string;
  presets: string[];
}

/**
 * Programs grouped by engine, in the engine's own order of its modes; an engine
 * missing from that order follows, in the order its first preset appears.
 * Every engine with a base voice leads its group with it, so an engine no
 * preset uses is still listed; presets keep their catalog order after it.
 */
export function groupPresetsByEngine(
  names: readonly string[],
  engineOf: (name: string) => string,
  engineOrder: readonly string[] = [],
): EngineGroup[] {
  const groups = new Map<string, EngineGroup>();
  const groupOf = (engine: string) => {
    let group = groups.get(engine);
    if (!group) {
      group = { engine, presets: hasBaseVoice(engine) ? [baseVoiceId(engine)] : [] };
      groups.set(engine, group);
    }
    return group;
  };
  for (const engine of engineOrder) groupOf(engine);
  for (const name of names) groupOf(engineOf(name)).presets.push(name);
  return [...groups.values()].filter((group) => group.presets.length > 0);
}

/** A model field the deck can put on a control: a switch, or a number with a closed range. */
export function isKnobField(field: SynthParamInfo): boolean {
  return field.type === 'boolean' || (field.min !== undefined && field.max !== undefined);
}

/** A field's default as the number `engineParams` takes (a switch is 0 or 1). */
export function fieldDefault(field: SynthParamInfo): number {
  return typeof field.default === 'boolean' ? (field.default ? 1 : 0) : field.default;
}

/** Whether one `activeWhen` condition holds for the value it reads (`undefined`: not set). */
function conditionHolds(
  condition: SynthParamCondition,
  current: number | boolean | string | undefined,
): boolean {
  if (current === undefined) return false;
  const { relation, value } = condition;
  if (typeof value === 'string' || typeof current === 'string') {
    if (relation === 'eq') return current === value;
    return relation === 'ne' && current !== value;
  }
  // A switch is 0 or 1 in `engineParams` and true/false in a condition.
  const a = Number(current);
  const b = Number(value);
  switch (relation) {
    case 'eq':
      return a === b;
    case 'ne':
      return a !== b;
    case 'gt':
      return a > b;
    case 'ge':
      return a >= b;
    case 'lt':
      return a < b;
    default:
      return a <= b;
  }
}

/**
 * Whether the engine lets a field reach the voice: every condition of at least
 * one `activeWhen` alternative holds, each read through `readValue` (the user's
 * value, else the base voice's). A field with no gate is always active.
 */
export function isFieldActive(
  field: SynthParamInfo,
  readValue: (condition: SynthParamCondition) => number | boolean | string | undefined,
): boolean {
  if (field.activeWhen === undefined) return true;
  return field.activeWhen.some((alternative) =>
    alternative.every((condition) => conditionHolds(condition, readValue(condition))),
  );
}

/**
 * The fields of an engine section the current values leave active. Engine-scope
 * conditions read `values` over the section's own defaults; patch-scope ones
 * read `patch`, where the base voice sets nothing.
 */
export function activeModelFields(
  info: readonly SynthParamInfo[],
  values: Readonly<Record<string, number>>,
  patch: Readonly<Record<string, number | string>> = {},
): SynthParamInfo[] {
  const defaults = new Map(info.map((field) => [field.name, fieldDefault(field)]));
  const readValue = (condition: SynthParamCondition) =>
    condition.scope === 'patch'
      ? patch[condition.key]
      : (values[condition.key] ?? defaults.get(condition.key));
  return info.filter((field) => isFieldActive(field, readValue));
}

/** Fields of one engine section sharing a prefix (`ops0`, `drawbars`), in engine order. */
export interface ModelFieldGroup {
  /** The shared prefix; empty for the section's own top-level fields. */
  id: string;
  fields: { info: SynthParamInfo; label: string }[];
}

/**
 * Split an engine section into its sub-sections by key shape: `ops0.ratio`
 * belongs to `ops0`, `drawbars3` to `drawbars`, `algorithm` to the top level.
 */
export function groupModelFields(info: readonly SynthParamInfo[]): ModelFieldGroup[] {
  const groups = new Map<string, ModelFieldGroup>();
  for (const field of info) {
    if (!isKnobField(field)) continue;
    const dot = field.name.indexOf('.');
    const indexed = field.name.match(/^(.*\D)(\d+)$/);
    let id = '';
    let label = field.name;
    if (dot > 0) {
      id = field.name.slice(0, dot);
      label = field.name.slice(dot + 1);
    } else if (indexed) {
      id = indexed[1];
      label = indexed[2];
    }
    let group = groups.get(id);
    if (!group) {
      group = { id, fields: [] };
      groups.set(id, group);
    }
    group.fields.push({ info: field, label });
  }
  return [...groups.values()];
}

/** Knob step for a model field: whole numbers for an integer field, 1/200 of the range otherwise. */
export function modelFieldStep(field: SynthParamInfo): number {
  if (field.integer) return 1;
  return ((field.max ?? 1) - (field.min ?? 0)) / 200;
}

/** Readout for a model field value in the unit the engine reports it in. */
export function formatModelValue(value: number, field: SynthParamInfo): string {
  if (field.integer) return String(Math.round(value));
  switch (field.unit) {
    case 'Hz':
      return value >= 1000 ? `${(value / 1000).toFixed(2)} kHz` : `${value.toFixed(0)} Hz`;
    case 'ms':
      return msLabel(value);
    case 's':
      return `${value.toFixed(2)} s`;
    case 'cents':
      return `${value > 0 ? '+' : ''}${value.toFixed(0)} ct`;
    case 'ratio':
      return `×${value.toFixed(2)}`;
    case 'dB':
      return `${value.toFixed(1)} dB`;
    default:
      return value.toFixed(2);
  }
}
