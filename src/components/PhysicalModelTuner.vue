<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue';
import { useMidiInput } from '@/components/practice/useMidiInput';
import SynthKeyboard from '@/components/synth/SynthKeyboard.vue';
import { useSynthKeyboardInput } from '@/components/synth/useSynthKeyboardInput';
import ToolShell from '@/components/ToolShell.vue';
import { type CompareMetrics, computeMetrics } from '@/components/tuner/compareMetrics';
import {
  GM_DRUM_NAMES_JA,
  GM_DRUM_NOTES,
  GM_FAMILIES,
  GM_FAMILY_NAMES_JA,
  GM_PROGRAM_NAMES,
  GM_PROGRAM_NAMES_JA,
  type GmBody,
  type GmVoicing,
  GS_DRUM_KIT_NAMES_JA,
  GS_DRUM_KITS,
  gmBody,
  gmEngineFor,
  gmNoteFor,
  gmVoicing,
  type SynthMode,
} from '@/components/tuner/gmTargets';
import { LAYER_ORDER, type LayerId, layerOf } from '@/components/tuner/paramLayers';
import TunerChain from '@/components/tuner/TunerChain.vue';
import TunerCompare from '@/components/tuner/TunerCompare.vue';
import TunerProgramPicker from '@/components/tuner/TunerProgramPicker.vue';
import TunerScene from '@/components/tuner/TunerScene.vue';
import TunerScore from '@/components/tuner/TunerScore.vue';
import { enCopy, jaCopy } from '@/components/tuner/tunerCopy';
import {
  activeParams,
  downloadPatch,
  jsonToSpec,
  specToJson,
  type TunerTarget,
  targetFromJson,
} from '@/components/tuner/tunerJson';
import {
  downloadSmf,
  exportPhraseSmf,
  importPhraseSmf,
  type PhraseNote,
} from '@/components/tuner/tunerMidi';
import {
  COMPARE_FRAMES,
  COMPARE_SR,
  renderAdjusted,
  renderGmFallback,
  renderReference,
} from '@/components/tuner/tunerReference';
import { RotaryKnob, StatusIndicator, TechPanel, Tooltip } from '@/components/ui';
import { useI18n } from '@/composables/useI18n';
import { useTheme } from '@/composables/useTheme';
import { useTunerAutofit } from '@/composables/useTunerAutofit';
import { useTunerEngine } from '@/composables/useTunerEngine';
import { useWasmBoot } from '@/composables/useWasmBoot';
import { type AutofitResult, OracleTooShortError, prepareOracle } from '@/tuner/dsp/autofit';
import { buildDrumSeedSpec } from '@/tuner/dsp/drum-seeds';
import { buildDefaultSpec, type ModelSpec } from '@/tuner/dsp/engine';
import { gsDrumKitIndex } from '@/tuner/dsp/gs-kit';
import { applyMacro, deriveMacroValue, type MacroDef, macrosFor } from '@/tuner/dsp/macros';
import {
  type BodyType,
  ENGINE_INFO,
  ENGINE_ORDER,
  type EngineFamily,
  type ParamSpec,
  type PhysicalEngineMode,
  paramSpecsFor,
} from '@/tuner/dsp/params';
import { decayPeakHold } from '@/utils/scale';

const { localizedPath, alternateLocalePath, localizedValue } = useI18n();
const { isDark } = useTheme();
const copy = computed(() => localizedValue({ en: enCopy, ja: jaCopy }));
const engine = useTunerEngine();
const { version: libVersion } = useWasmBoot();

const BODY_TYPES: BodyType[] = ['none', 'guitar', 'violin', 'wood-tube', 'brass-bell', 'vocal'];
const MIN_BASE_NOTE = 24;
const MAX_BASE_NOTE = 84;
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
/** Major-scale semitone offsets played by the "play scale" button. */
const SCALE_STEPS = [0, 2, 4, 5, 7, 9, 11, 12];

// Target-first flow: the tool opens on a GM/GS slot, so the engine boots as the
// one libsonare uses for that slot (program 0) rather than a fixed default.
const spec = ref<ModelSpec>(buildDefaultSpec(gmEngineFor(0)));
const baseNote = ref(48); // C3
const activeNotes = ref<Set<number>>(new Set());
const peakHold = ref(0);
const reduceMotion = ref(false);
const patchInput = shallowRef<HTMLInputElement | null>(null);
const importError = ref('');

const engineMode = computed(() => spec.value.engineMode);
const family = computed<EngineFamily>(() => ENGINE_INFO[engineMode.value].family);

/** Wide keybed for full-range instruments (piano), roomier for the rest. */
const keyboardOctaves = computed(() => (engineMode.value === 'piano' ? 5 : 3));
/** Highest base C that keeps the whole keybed within MIDI range (top ≤ 127). */
const maxBaseNote = computed(() => Math.min(MAX_BASE_NOTE, 127 - keyboardOctaves.value * 12));
// A wider keybed (piano) lowers the base ceiling — pull the base down if the
// previous engine's higher octave would now push the top key past MIDI 127.
watch(maxBaseNote, (max) => {
  if (baseNote.value > max) {
    releaseAll();
    baseNote.value = max;
  }
});

const isReady = engine.ready;
const isStarting = engine.starting;
const isRunning = engine.running;
const meter = engine.meter;

watch(meter, (value) => {
  peakHold.value = decayPeakHold(peakHold.value, value.peak);
  sceneLevel.value = value.peak;
});

const sceneLevel = ref(0);
const sceneRef = ref<InstanceType<typeof TunerScene> | null>(null);

/** Engines grouped by instrument family for the picker rack. */
const familyGroups = computed(() => {
  const order: EngineFamily[] = [];
  const byFamily = new Map<EngineFamily, PhysicalEngineMode[]>();
  for (const mode of ENGINE_ORDER) {
    const fam = ENGINE_INFO[mode].family;
    if (!byFamily.has(fam)) {
      byFamily.set(fam, []);
      order.push(fam);
    }
    byFamily.get(fam)?.push(mode);
  }
  return order.map((fam) => ({ family: fam, modes: byFamily.get(fam) ?? [] }));
});

const paramSpecs = computed<ParamSpec[]>(() => paramSpecsFor(activeParams(spec.value)));

/** Model params grouped by physical layer (signal-flow order), knobs and
 *  toggles split within each layer so the panel reads as a physical chain. */
const paramLayerGroups = computed(() => {
  const mode = engineMode.value;
  const byLayer = new Map<LayerId, ParamSpec[]>();
  for (const ps of paramSpecs.value) {
    const layer = layerOf(mode, ps.key);
    const bucket = byLayer.get(layer);
    if (bucket) bucket.push(ps);
    else byLayer.set(layer, [ps]);
  }
  return LAYER_ORDER.filter((l) => byLayer.has(l)).map((layer) => {
    const specs = byLayer.get(layer) ?? [];
    return {
      layer,
      knobs: specs.filter((p) => !p.bool),
      toggles: specs.filter((p) => p.bool),
    };
  });
});

const statusKind = computed<'idle' | 'active' | 'warning' | 'error'>(() => {
  if (engine.error.value) return 'error';
  if (isRunning.value) return 'active';
  if (isStarting.value) return 'warning';
  return 'idle';
});
const statusLabel = computed(() => {
  if (engine.error.value) return copy.value.status.error;
  if (isRunning.value) return copy.value.status.ready;
  if (isReady.value) return copy.value.status.armed;
  if (isStarting.value) return copy.value.status.starting;
  return copy.value.status.idle;
});

const octaveLabel = computed(() => {
  const n = baseNote.value;
  return `${NOTE_NAMES[n % 12]}${Math.floor(n / 12) - 1}`;
});
const peakDb = computed(() => {
  const peak = meter.value.peak;
  return peak > 0 ? `${(20 * Math.log10(peak)).toFixed(1)} dB` : '-∞ dB';
});

const docsPath = computed(() => localizedPath('/docs/native-synth'));
const synthPath = computed(() => localizedPath('/synth'));
const oppositeLocalePath = computed(() => alternateLocalePath('/tuner'));

/** Display label for a non-physical synth engine (FM / Subtractive / Additive). */
function synthModeLabel(mode: SynthMode): string {
  return copy.value.synthModes[mode];
}

/** Rich-tooltip props for a parameter, keyed by its `*PatchParams` field name.
 *  Returns `{}` for keys without copy so the info dot simply stays hidden. */
type TermItem = { title: string; body: string; tip: string };
function term(key: string): Record<string, string | undefined> {
  const t = copy.value.terms;
  const item = (t.items as Record<string, TermItem>)[key];
  if (!item) return {};
  return {
    eyebrow: t.eyebrow,
    title: item.title,
    body: item.body,
    tip: item.tip,
    tipLabel: t.tipLabel,
    href: docsPath.value,
    linkLabel: t.linkLabel,
  };
}

// ---- A/B comparison --------------------------------------------------------

const originalBuf = shallowRef<Float32Array | null>(null);
const adjustedBuf = shallowRef<Float32Array | null>(null);
const oracleBuf = shallowRef<Float32Array | null>(null);
const compareRendering = ref(false);
const compareActive = ref(false);
const metrics = ref<CompareMetrics>({ rmsErrorPct: 0, specSimPct: 0 });
/** Cached WASM baseline render per engine (the bounce is the expensive step). */
const referenceCache = new Map<PhysicalEngineMode, Float32Array>();
let adjustTimer: ReturnType<typeof setTimeout> | null = null;
let adjustIdle: number | null = null;

// ---- GM/GS contribution target --------------------------------------------
// The tool's purpose is to voice libsonare's GM/GS fallback bank. A target ties
// the tuned patch to a concrete GM slot: it tags the export/issue, suggests the
// engine that slot uses, and renders the CURRENT built-in voice as the A/B
// original so the contributor tunes against "today's sound".

type TargetMode = 'melodic' | 'drum';
type TargetStandard = 'GM' | 'GS';
const targetActive = ref(true);
const targetMode = ref<TargetMode>('melodic');
const targetStandard = ref<TargetStandard>('GM');
const targetProgram = ref(0);
const targetDrumNote = ref(38);
/** GS variation bank select (CC0) for a melodic target; 0 = capital tone. */
const targetBankMsb = ref(0);
/** GS drum-kit program (channel-10 PC) for a drum target. */
const targetDrumKit = ref(0);
/** GM drum note the model was last seeded for; drives note-change reseeding. */
const lastDrumSeedKey = ref('');
/** Cached GM fallback render per slot (`mel:<program>` / `drum:<note>`). */
const gmCache = new Map<string, Float32Array>();

// Instrument / timbre names are localized for display; the exported JSON keeps
// the canonical English GM names (see `currentTarget`).
const programNames = computed(() =>
  localizedValue({ en: GM_PROGRAM_NAMES, ja: GM_PROGRAM_NAMES_JA }),
);
const familyNames = computed(() =>
  localizedValue({ en: GM_FAMILIES.map((f) => f.name), ja: GM_FAMILY_NAMES_JA }),
);

/** Localized display name for a GM program / drum note / GS kit. */
function displayProgramName(program: number): string {
  return programNames.value[program] ?? `Program ${program}`;
}
function displayDrumName(note: number): string {
  const en = GM_DRUM_NOTES.find((d) => d.note === note)?.name;
  return localizedValue({
    en: en ?? `Drum ${note}`,
    ja: GM_DRUM_NAMES_JA[note] ?? en ?? `Drum ${note}`,
  });
}
function displayKitName(program: number): string {
  const en = GS_DRUM_KITS.find((k) => k.program === program)?.name;
  return localizedValue({ en: en ?? '', ja: GS_DRUM_KIT_NAMES_JA[program] ?? en ?? '' });
}

const suggestedEngine = computed<PhysicalEngineMode>(() =>
  targetMode.value === 'drum' ? 'percussion' : gmEngineFor(targetProgram.value),
);

/** How the current target slot is voiced (a physical model, or a non-physical
 *  synth engine this tool does not cover). Drums are always physical. */
const targetVoicing = computed<GmVoicing>(() =>
  targetMode.value === 'drum'
    ? { kind: 'physical', engine: 'percussion' }
    : gmVoicing(targetProgram.value),
);

/** True when the slot's voice is a physical model this tool can tune. */
const targetCovered = computed(() => targetVoicing.value.kind === 'physical');

/** The non-physical engine voicing this slot, when out of scope. */
const targetSynthMode = computed<SynthMode | null>(() =>
  targetVoicing.value.kind === 'synth' ? targetVoicing.value.mode : null,
);

/** The resonator body implied by the current covered target slot. Drums carry no
 *  corpus of their own (the shell modes live in the percussion voice). */
const suggestedBody = computed<GmBody>(() =>
  targetMode.value === 'drum'
    ? { body: ENGINE_INFO.percussion.defaultBody, mix: ENGINE_INFO.percussion.defaultBodyMix }
    : gmBody(targetProgram.value),
);

/** True while the body is fixed by the slot (a covered target is active). */
const bodyLocked = computed(() => targetActive.value && targetCovered.value);

/** True when the chosen body type differs from the slot's implied body. The mix
 *  knob is a free continuous tuning, so divergence tracks the discrete body only. */
const bodyDiverged = computed(() => spec.value.body !== suggestedBody.value.body);

const isGs = computed(() => targetStandard.value === 'GS');

/** Channel-10 kit program for the A/B renders; 0 (Standard) for GM or melodic.
 *  A GS drum target voices its A/B "current sound" and adjusted trace under the
 *  selected kit; the edited spec itself stays the Standard base patch. */
const effectiveDrumKit = computed(() =>
  targetMode.value === 'drum' && isGs.value ? targetDrumKit.value : 0,
);

const currentTarget = computed<TunerTarget | null>(() => {
  if (!targetActive.value) return null;
  const standard = targetStandard.value;
  if (targetMode.value === 'drum') {
    const d = GM_DRUM_NOTES.find((x) => x.note === targetDrumNote.value);
    return {
      standard,
      kind: 'drum',
      drumNote: targetDrumNote.value,
      // A GS drum note is scoped to a named kit; GM has one Standard Kit.
      ...(standard === 'GS' ? { drumKit: targetDrumKit.value } : {}),
      name: d?.name ?? `Drum ${targetDrumNote.value}`,
    };
  }
  return {
    standard,
    kind: 'melodic',
    program: targetProgram.value,
    // CC0 addresses a GS variation tone (capital tone omitted; LSB is 0 for GS).
    ...(standard === 'GS' && targetBankMsb.value > 0
      ? { bankMsb: targetBankMsb.value, bankLsb: 0 }
      : {}),
    name: GM_PROGRAM_NAMES[targetProgram.value] ?? `Program ${targetProgram.value}`,
  };
});

/** Localized name of the selected GS drum kit (for labels). */
const drumKitName = computed(() => displayKitName(targetDrumKit.value));

/** How the selected GS kit re-voices the piece (empty for the Standard kit). */
const kitScopeHint = computed(() => {
  const scope = copy.value.target.kitScope as Record<number, string>;
  return scope[gsDrumKitIndex(targetDrumKit.value)] ?? '';
});

/** Slot label for the active target, e.g. "GM · 040 · バイオリン" or
 *  "GS · 040 · バイオリン · CC0 8". Uses localized names (the exported JSON keeps
 *  the canonical English names via `currentTarget`). */
const targetLabel = computed(() => {
  const t = currentTarget.value;
  if (!t) return '';
  const std = t.standard;
  if (t.kind === 'drum') {
    const kit = t.standard === 'GS' ? ` · ${drumKitName.value}` : '';
    return `${std} · ${t.drumNote} · ${displayDrumName(t.drumNote)}${kit}`;
  }
  const bank = t.bankMsb ? ` · CC0 ${t.bankMsb}` : '';
  return `${std} · ${String(t.program).padStart(3, '0')} · ${displayProgramName(t.program)}${bank}`;
});

/** The note both A/B traces use (the GM family note, or the drum note). */
function targetNote(): number {
  return targetMode.value === 'drum' ? targetDrumNote.value : gmNoteFor(targetProgram.value);
}

const compareLabels = computed(() => ({
  ...copy.value.compare,
}));
const hasCompareData = computed(() => Boolean(originalBuf.value || adjustedBuf.value));

/** Fetch (and cache) the libsonare baseline render for the active engine. */
async function ensureReference(mode: PhysicalEngineMode): Promise<Float32Array | null> {
  const cached = referenceCache.get(mode);
  if (cached) {
    originalBuf.value = cached;
    return cached;
  }
  compareRendering.value = true;
  try {
    const ref = await renderReference(mode);
    referenceCache.set(mode, ref);
    if (spec.value.engineMode === mode) originalBuf.value = ref;
    return ref;
  } catch {
    return null;
  } finally {
    compareRendering.value = false;
  }
}

/** Fetch (and cache) the current built-in GM voice for the active target. */
async function ensureGmOriginal(): Promise<Float32Array | null> {
  const isDrum = targetMode.value === 'drum';
  const kit = effectiveDrumKit.value;
  const key = isDrum ? `drum:${targetDrumNote.value}:${kit}` : `mel:${targetProgram.value}`;
  const cached = gmCache.get(key);
  if (cached) {
    originalBuf.value = cached;
    return cached;
  }
  compareRendering.value = true;
  try {
    const buf = await renderGmFallback(targetProgram.value, targetNote(), 100, isDrum, kit);
    gmCache.set(key, buf);
    originalBuf.value = buf;
    return buf;
  } catch {
    return null;
  } finally {
    compareRendering.value = false;
  }
}

/** The A/B "original": the current GM built-in voice when targeting a slot,
 *  otherwise the engine's own baseline render. */
async function ensureOriginal(): Promise<Float32Array | null> {
  return targetActive.value ? ensureGmOriginal() : ensureReference(spec.value.engineMode);
}

function recomputeMetrics(): void {
  const adjusted = adjustedBuf.value;
  const target = oracleBuf.value ?? originalBuf.value;
  if (!adjusted || !target) return;
  metrics.value = computeMetrics(adjusted, target, COMPARE_SR);
}

/** Re-render the tuned TS model and refresh the error readout. */
function renderAdjustedNow(): void {
  adjustedBuf.value = renderAdjusted(
    spec.value,
    targetActive.value ? targetNote() : undefined,
    undefined,
    targetActive.value ? effectiveDrumKit.value : 0,
  );
  recomputeMetrics();
}

async function runCompare(): Promise<void> {
  compareActive.value = true;
  // Every call site fires this as `void runCompare()`, so swallow failures here
  // rather than let a rejection escape as an unhandled promise (e.g. an oracle
  // render throwing) — a failed comparison must not tear down the demo.
  try {
    await ensureOriginal();
    renderAdjustedNow();
  } catch (err) {
    console.error('[tuner] compare failed:', err);
  }
}

/** Debounced adjusted re-render while the user drags parameters. */
function scheduleAdjustedRender(): void {
  if (!compareActive.value) return;
  if (adjustTimer) clearTimeout(adjustTimer);
  if (adjustIdle !== null && 'cancelIdleCallback' in window) {
    window.cancelIdleCallback(adjustIdle);
    adjustIdle = null;
  }
  adjustTimer = setTimeout(() => {
    adjustTimer = null;
    if ('requestIdleCallback' in window) {
      adjustIdle = window.requestIdleCallback(
        () => {
          adjustIdle = null;
          renderAdjustedNow();
        },
        { timeout: 350 },
      );
    } else {
      renderAdjustedNow();
    }
  }, 140);
}

/** Play a mono reference buffer through the engine's audio context. */
function playBuffer(buf: Float32Array | null): void {
  const ctx = engine.context.value;
  if (!ctx || !buf) return;
  engine.resume();
  const audioBuffer = ctx.createBuffer(1, buf.length, COMPARE_SR);
  audioBuffer.copyToChannel(buf, 0);
  const source = ctx.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(ctx.destination);
  source.start();
}

function audition(trace: 'original' | 'adjusted' | 'oracle'): void {
  if (trace === 'original') playBuffer(originalBuf.value);
  else if (trace === 'adjusted') playBuffer(adjustedBuf.value);
  else playBuffer(oracleBuf.value);
}

// ---- oracle import (WAV/MIDI) ----------------------------------------------

const oracleName = ref('');
const oracleError = ref('');
const oracleInput = shallowRef<HTMLInputElement | null>(null);
/** MIDI note the oracle was played at (drives the fit render + manual A/B). */
const oracleNote = ref(57);
const oracleVelocity = ref(100);
const oracleNoteName = computed(() => {
  const n = oracleNote.value;
  return `${NOTE_NAMES[n % 12]}${Math.floor(n / 12) - 1}`;
});

function openOracleImport(): void {
  oracleInput.value?.click();
}

/**
 * Import an oracle: a `.mid`/`.midi` supplies the target NOTE (its first note),
 * any audio file supplies the target SOUND. The decoded WAV is trimmed to
 * note-on and peak-normalized so it aligns with the model renders (which also
 * sharpens the manual A/B). The note defaults to the current target's note.
 */
async function onOracleFile(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  oracleError.value = '';
  const isMidi = /\.midi?$/i.test(file.name);
  try {
    if (isMidi) {
      const phrase = await importPhraseSmf(new Uint8Array(await file.arrayBuffer()));
      const first = phrase[0];
      if (first) {
        oracleNote.value = first.note;
        oracleVelocity.value = first.velocity || 100;
      }
      return;
    }
    const arrayBuffer = await file.arrayBuffer();
    const offline = new OfflineAudioContext({
      numberOfChannels: 1,
      length: 1,
      sampleRate: COMPARE_SR,
    });
    const decoded = await offline.decodeAudioData(arrayBuffer);
    oracleBuf.value = prepareOracle(decoded.getChannelData(0).slice(), COMPARE_SR);
    oracleName.value = file.name;
    if (targetActive.value) oracleNote.value = targetNote();
    compareActive.value = true;
    await ensureOriginal();
    if (!adjustedBuf.value) renderAdjustedNow();
    else recomputeMetrics();
  } catch (err) {
    oracleError.value =
      err instanceof OracleTooShortError
        ? copy.value.autofit.tooShort
        : copy.value.oracle.decodeError;
  }
}

function onOracleNote(event: Event): void {
  const v = Number((event.target as HTMLInputElement).value);
  if (Number.isFinite(v)) oracleNote.value = Math.min(127, Math.max(0, Math.round(v)));
}

function clearOracle(): void {
  oracleBuf.value = null;
  oracleName.value = '';
  oracleError.value = '';
  fitResult.value = null;
  recomputeMetrics();
}

// ---- oracle auto-fit -------------------------------------------------------
// A gradient-free search (in a worker) approximates the oracle by tuning the
// engine's core params. Progress previews live through pushSpec so the knobs and
// the worklet voice visibly converge; the result offers Keep or Revert.

const autofit = useTunerAutofit();
const fitResult = shallowRef<AutofitResult | null>(null);
let preFitSpec: ModelSpec | null = null;

async function startAutofit(): Promise<void> {
  const oracle = oracleBuf.value;
  if (!oracle || autofit.running.value) return;
  fitResult.value = null;
  preFitSpec = cloneSpec(spec.value);
  compareActive.value = true;
  const result = await autofit.start({
    spec: spec.value,
    oracle,
    note: oracleNote.value,
    velocity: oracleVelocity.value,
    sampleRate: COMPARE_SR,
    frames: COMPARE_FRAMES,
  });
  if (result) {
    pushSpec(result.bestSpec);
    fitResult.value = result;
    renderAdjustedNow();
  }
}

function cancelAutofit(): void {
  autofit.cancel();
}

function keepFit(): void {
  fitResult.value = null;
  preFitSpec = null;
}

function revertFit(): void {
  if (preFitSpec) pushSpec(preFitSpec);
  preFitSpec = null;
  fitResult.value = null;
  renderAdjustedNow();
}

// ---- spec editing (clone-then-set so Vue reactivity + the worklet update) --

/**
 * Deep-clone the active spec to a plain object. `spec` lives in a Vue `ref`, so
 * `spec.value` is a reactive Proxy that `structuredClone` cannot clone
 * (DataCloneError). The spec is pure data, so a JSON round-trip de-proxies it
 * safely before we mutate and re-set it.
 */
function cloneSpec(source: ModelSpec): ModelSpec {
  return JSON.parse(JSON.stringify(source));
}

/** Replace the active spec and push it to the audio thread. */
function pushSpec(next: ModelSpec): void {
  spec.value = next;
  engine.setSpec(next);
  scheduleAdjustedRender();
}

function paramValue(key: string): number {
  const raw = (activeParams(spec.value) as Record<string, unknown>)[key];
  return typeof raw === 'boolean' ? (raw ? 1 : 0) : Number(raw ?? 0);
}

function boolValue(key: string): boolean {
  return Boolean((activeParams(spec.value) as Record<string, unknown>)[key]);
}

function editParam(ps: ParamSpec, value: number): void {
  const next = cloneSpec(spec.value);
  const params = activeParams(next) as Record<string, unknown>;
  params[ps.key] = ps.bool ? value >= 0.5 : value;
  pushSpec(next);
}

// ---- perceptual macros -----------------------------------------------------
// A few intuitive axes (brightness, attack, breathiness …) sweep small, disjoint
// sets of the deep params together, so the sound moves in a coherent direction
// without hunting through the full knob grid. The sliders derive their position
// from the params, so they and the advanced panel stay in sync both ways.

const macroDefs = computed<MacroDef[]>(() => macrosFor(engineMode.value));

/** Current slider position (0..1) for each macro, derived from the params. */
const macroValues = computed<number[]>(() => {
  const params = activeParams(spec.value) as Record<string, unknown>;
  return macroDefs.value.map((def) => deriveMacroValue(params, def));
});

/** Sweep a macro: write every param it drives, then push the new spec. */
function editMacro(def: MacroDef, value: number): void {
  const next = cloneSpec(spec.value);
  const params = activeParams(next) as Record<string, unknown>;
  const patch = applyMacro(def, value);
  for (const [key, v] of Object.entries(patch)) params[key] = v;
  pushSpec(next);
}

function macroLabel(id: string): string {
  return (
    (copy.value.macros.items as Record<string, { label: string; hint: string }>)[id]?.label ?? id
  );
}
function macroHint(id: string): string {
  return (
    (copy.value.macros.items as Record<string, { label: string; hint: string }>)[id]?.hint ?? ''
  );
}

function toggleBool(ps: ParamSpec): void {
  editParam(ps, boolValue(ps.key) ? 0 : 1);
}

function editWrapper(patch: Partial<ModelSpec>): void {
  pushSpec({ ...cloneSpec(spec.value), ...patch });
}

function editAmp(key: keyof ModelSpec['ampEnv'], value: number): void {
  const next = cloneSpec(spec.value);
  next.ampEnv = { ...next.ampEnv, [key]: value };
  pushSpec(next);
}

function selectEngine(mode: PhysicalEngineMode): void {
  if (mode === engineMode.value) return;
  releaseAll();
  // When targeting a GM slot the "original" is the GM voice (engine-independent),
  // so keep it; otherwise reset it to the newly-selected engine's baseline.
  if (!targetActive.value) originalBuf.value = referenceCache.get(mode) ?? null;
  pushSpec(buildDefaultSpec(mode));
  if (compareActive.value) void runCompare();
}

// ---- target actions --------------------------------------------------------

/** Switch to the engine that libsonare uses for the current target slot,
 *  then refresh the A/B against the current built-in voice. Slots voiced by a
 *  non-physical engine (FM electric piano, synth families) are out of this
 *  tool's scope, so the engine is left as-is — only the A/B original is refreshed
 *  so the contributor can still hear the real built-in voice. */
function refreshTarget(): void {
  if (targetMode.value === 'drum') {
    // Seed the model with the drum note's current built-in voicing so the
    // adjusted trace starts at "today's sound" (a snare from a snare, a hat
    // from a hat). Reseed only when the NOTE moves — a kit change keeps the
    // edited base patch and is applied at render time (see effectiveDrumKit).
    const seedKey = String(targetDrumNote.value);
    if (seedKey !== lastDrumSeedKey.value) {
      releaseAll();
      lastDrumSeedKey.value = seedKey;
      pushSpec(buildDrumSeedSpec(targetDrumNote.value));
    }
  } else {
    lastDrumSeedKey.value = '';
    if (targetCovered.value) {
      const eng = suggestedEngine.value;
      const { body, mix } = suggestedBody.value;
      if (eng !== engineMode.value) {
        releaseAll();
        // buildDefaultSpec seeds the engine's generic body; override it with the
        // one the specific GM program implies (e.g. a guitar corpus for a plucked
        // string, which the bare Karplus-Strong loop lacks).
        pushSpec({ ...buildDefaultSpec(eng), body, bodyMix: mix });
      } else if (spec.value.body !== body || spec.value.bodyMix !== mix) {
        pushSpec({ ...cloneSpec(spec.value), body, bodyMix: mix });
      }
    }
  }
  compareActive.value = true;
  void runCompare();
}

function toggleTarget(): void {
  targetActive.value = !targetActive.value;
  if (targetActive.value) refreshTarget();
  else void runCompare(); // revert the original trace to the engine baseline
}

function setTargetMode(mode: TargetMode): void {
  if (targetMode.value === mode) return;
  targetMode.value = mode;
  if (targetActive.value) refreshTarget();
}

function onTargetProgram(event: Event): void {
  targetProgram.value = Number((event.target as HTMLSelectElement).value);
  if (targetActive.value) refreshTarget();
}

/** Program chosen from the custom picker (physical slots only). */
function onProgramSelect(program: number): void {
  targetProgram.value = program;
  if (targetActive.value) refreshTarget();
}

function onTargetDrum(event: Event): void {
  targetDrumNote.value = Number((event.target as HTMLSelectElement).value);
  if (targetActive.value) refreshTarget();
}

// Switching standard re-renders the A/B: a GS drum target voices its current
// sound and adjusted trace under the selected kit (channel-10 program). A
// melodic GS variation (CC0) stays a label-only tag — the data-free fallback
// bank carries no melodic bank variations to render.
function setTargetStandard(std: TargetStandard): void {
  targetStandard.value = std;
  if (targetActive.value) refreshTarget();
}

function onTargetBank(event: Event): void {
  targetBankMsb.value = Number((event.target as HTMLSelectElement).value);
}

function onTargetKit(event: Event): void {
  targetDrumKit.value = Number((event.target as HTMLSelectElement).value);
  if (targetActive.value) refreshTarget();
}

/** Play the current built-in GM voice for the target slot. */
async function auditionCurrent(): Promise<void> {
  await ensureGmOriginal();
  playBuffer(originalBuf.value);
}

function selectBody(body: BodyType): void {
  editWrapper({ body });
}

/** Restore the body (and its mix) to the one the current slot implies. */
function resetBody(): void {
  const { body, mix } = suggestedBody.value;
  pushSpec({ ...cloneSpec(spec.value), body, bodyMix: mix });
}

function resetEngine(): void {
  releaseAll();
  // A drum target resets to the note's built-in seed, not the bare tom default.
  if (targetActive.value && targetMode.value === 'drum') {
    pushSpec(buildDrumSeedSpec(targetDrumNote.value));
  } else {
    pushSpec(buildDefaultSpec(engineMode.value));
  }
}

/** Format a knob readout from its descriptor's step + unit. */
function formatParam(ps: ParamSpec): string {
  const v = paramValue(ps.key);
  const digits = ps.step >= 1 ? 0 : ps.step >= 0.1 ? 1 : ps.step >= 0.01 ? 2 : 3;
  return `${v.toFixed(digits)}${ps.unit ? ` ${ps.unit}` : ''}`;
}

// ---- playback --------------------------------------------------------------

function noteOn(note: number, velocity = 100): void {
  if (!isReady.value) return;
  engine.noteOn(note, velocity);
  sceneRef.value?.pulse(Math.min(1, velocity / 110));
  recordNoteOn(note, velocity);
  const next = new Set(activeNotes.value);
  next.add(note);
  activeNotes.value = next;
}

/**
 * Key release: note-off on key-up. The worklet gives struck/plucked voices a
 * soft release (the amp envelope fades them out over a musical time instead of
 * the abrupt physical damper), while self-oscillating voices stop as they lift.
 * The lamp clears here; the sound tail fades on afterward, like a real key.
 */
function releaseKey(note: number): void {
  noteOff(note);
}

/**
 * Safety net for a voice that frees itself without a key-up (a stuck MIDI note,
 * or a decaying voice that rang to silence): the worklet reports it so the key
 * un-lights instead of staying visually stuck on.
 */
function onVoiceEnded(note: number): void {
  if (!activeNotes.value.has(note)) return;
  const next = new Set(activeNotes.value);
  next.delete(note);
  activeNotes.value = next;
}

function noteOff(note: number): void {
  recordNoteOff(note);
  if (!activeNotes.value.has(note)) return;
  engine.noteOff(note);
  const next = new Set(activeNotes.value);
  next.delete(note);
  activeNotes.value = next;
}

function releaseAll(): void {
  for (const note of activeNotes.value) engine.noteOff(note);
  activeNotes.value = new Set();
  releaseHeldPcNotes();
}

function shiftOctave(direction: -1 | 1): void {
  const next = baseNote.value + direction * 12;
  if (next < MIN_BASE_NOTE || next > maxBaseNote.value) return;
  releaseAll();
  baseNote.value = next;
}

function panic(): void {
  releaseAll();
  engine.panic();
}

let scaleTimers: ReturnType<typeof setTimeout>[] = [];

function playScale(): void {
  if (!isReady.value) return;
  engine.resume();
  for (const timer of scaleTimers) clearTimeout(timer);
  scaleTimers = [];
  const step = 300;
  SCALE_STEPS.forEach((semitone, i) => {
    const note = baseNote.value + semitone;
    scaleTimers.push(setTimeout(() => noteOn(note, 100), i * step));
    scaleTimers.push(setTimeout(() => noteOff(note), i * step + step * 0.85));
  });
}

const { onKeyDown, onKeyUp, releaseHeldPcNotes } = useSynthKeyboardInput({
  isReady,
  baseNote,
  noteOn,
  noteOff: releaseKey,
  shiftOctave,
});

// ---- MIDI phrase (record / import / export / play) -------------------------

const phrase = ref<PhraseNote[]>([]);
const recording = ref(false);
const showScore = ref(false);
const midiInputEl = shallowRef<HTMLInputElement | null>(null);
let recordStartMs = 0;
const recPending = new Map<number, { startSec: number; velocity: number }>();
let phraseTimers: ReturnType<typeof setTimeout>[] = [];

const midiInput = useMidiInput({
  onNoteOn: (note, velocity) => noteOn(note, velocity),
  onNoteOff: (note) => noteOff(note),
});

function recordNoteOn(note: number, velocity: number): void {
  if (!recording.value) return;
  recPending.set(note, { startSec: (performance.now() - recordStartMs) / 1000, velocity });
}

function recordNoteOff(note: number): void {
  if (!recording.value) return;
  const start = recPending.get(note);
  if (!start) return;
  recPending.delete(note);
  const endSec = (performance.now() - recordStartMs) / 1000;
  phrase.value = [
    ...phrase.value,
    {
      note,
      velocity: start.velocity,
      startSec: start.startSec,
      durSec: Math.max(0.05, endSec - start.startSec),
    },
  ].sort((a, b) => a.startSec - b.startSec);
}

function toggleRecord(): void {
  if (recording.value) {
    recording.value = false;
    recPending.clear();
    return;
  }
  phrase.value = [];
  recPending.clear();
  recordStartMs = performance.now();
  recording.value = true;
}

function clearPhrase(): void {
  phrase.value = [];
}

async function exportMidi(): Promise<void> {
  if (phrase.value.length === 0) return;
  const bytes = await exportPhraseSmf(phrase.value);
  downloadSmf(bytes, `${engineMode.value}-phrase.mid`);
}

function openMidiImport(): void {
  midiInputEl.value?.click();
}

async function onMidiFile(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    phrase.value = await importPhraseSmf(bytes);
  } catch {
    /* an unreadable MIDI file leaves the current phrase untouched */
  }
}

function playPhrase(): void {
  if (!isReady.value || phrase.value.length === 0) return;
  engine.resume();
  for (const timer of phraseTimers) clearTimeout(timer);
  phraseTimers = [];
  for (const n of phrase.value) {
    phraseTimers.push(setTimeout(() => noteOn(n.note, n.velocity), n.startSec * 1000));
    phraseTimers.push(setTimeout(() => noteOff(n.note), (n.startSec + n.durSec) * 1000));
  }
}

function connectMidi(): void {
  engine.resume();
  void midiInput.connect();
}

function toggleScore(): void {
  showScore.value = !showScore.value;
}

// ---- patch JSON ------------------------------------------------------------

function exportPatch(): void {
  downloadPatch(spec.value, currentTarget.value);
}

/** libsonare core repo — tuned patches are contributed here as issues. */
const CORE_REPO = 'https://github.com/libraz/libsonare';

/** A concise slot label for the issue title (GM/GS slot + name, or engine). */
function slotLabel(): string {
  const t = currentTarget.value;
  if (!t) return ENGINE_INFO[engineMode.value].label;
  if (t.kind === 'drum') {
    const kit = t.standard === 'GS' ? ` ${drumKitName.value}` : '';
    return `${t.standard} Drum ${t.drumNote} ${t.name}${kit}`;
  }
  const bank = t.bankMsb ? ` CC0 ${t.bankMsb}` : '';
  return `${t.standard} ${String(t.program).padStart(3, '0')} ${t.name}${bank}`;
}

/** Open a prefilled GitHub issue with the tuned patch JSON for the author. */
function shareViaIssue(): void {
  const json = JSON.stringify(specToJson(spec.value, currentTarget.value), null, 2);
  const title = `Physical-model patch: ${slotLabel()}`;
  const body = `${copy.value.patch.shareBody}\n\n\`\`\`json\n${json}\n\`\`\``;
  const url = `${CORE_REPO}/issues/new?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}

function openPatchImport(): void {
  patchInput.value?.click();
}

async function onPatchFile(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  importError.value = '';
  try {
    const parsed = JSON.parse(await file.text());
    releaseAll();
    // Restore the contribution target from the file (keeps the engine the file
    // specifies — don't force the suggested engine here).
    const t = targetFromJson(parsed);
    if (t) {
      targetActive.value = true;
      targetMode.value = t.kind;
      targetStandard.value = t.standard;
      if (t.kind === 'drum' && typeof t.drumNote === 'number') targetDrumNote.value = t.drumNote;
      if (t.kind === 'melodic' && typeof t.program === 'number') targetProgram.value = t.program;
      targetBankMsb.value = typeof t.bankMsb === 'number' ? t.bankMsb : 0;
      targetDrumKit.value = typeof t.drumKit === 'number' ? t.drumKit : 0;
      // Mark the imported drum note as already seeded so the model keeps the
      // file's spec (a later refresh reseeds only when the note moves).
      lastDrumSeedKey.value = t.kind === 'drum' ? String(targetDrumNote.value) : '';
    } else {
      targetActive.value = false;
    }
    pushSpec(jsonToSpec(parsed));
    compareActive.value = true;
    void runCompare();
  } catch {
    importError.value = copy.value.patch.importError;
  }
}

// ---- lifecycle -------------------------------------------------------------

async function startEngine(): Promise<void> {
  await engine.start(spec.value);
  // Render the first A/B comparison in the background once audio is armed — at
  // default params the original and adjusted overlap, doubling as a live parity
  // proof before the user has changed anything.
  void runCompare();
}

onMounted(() => {
  reduceMotion.value =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  engine.onVoiceEnded(onVoiceEnded);
  // Live-preview each improved candidate through the normal update path so the
  // knobs, worklet voice and adjusted trace converge on screen during a fit.
  autofit.onBestSpec((next) => pushSpec(next));
  void startEngine();
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', releaseAll);
});

watch(engine.faultEpoch, () => releaseAll());

onUnmounted(() => {
  window.removeEventListener('keydown', onKeyDown);
  window.removeEventListener('keyup', onKeyUp);
  window.removeEventListener('blur', releaseAll);
  for (const timer of scaleTimers) clearTimeout(timer);
  for (const timer of phraseTimers) clearTimeout(timer);
  if (adjustTimer) clearTimeout(adjustTimer);
  if (adjustIdle !== null && 'cancelIdleCallback' in window) window.cancelIdleCallback(adjustIdle);
  autofit.dispose();
  midiInput.disconnect();
  void engine.dispose();
});
</script>

<template>
  <ToolShell
    demo-id="tuner"
    hide-tabs
    :title="copy.title"
    :subtitle="copy.subtitle"
    :version="libVersion"
    :status="statusKind"
    :status-label="copy.localOnly"
    :docs-path="docsPath"
    :guide-title="copy.guide.title"
    :guide-body="copy.guide.body"
    :guide-link-label="copy.guide.docs"
    :opposite-locale-path="oppositeLocalePath"
  >
    <template #statusbar>
      <div class="tn-statusbar">
        <StatusIndicator :status="statusKind" :label="statusLabel" :pulse="isStarting" />
        <span class="tn-statusbar__field"><b>{{ copy.output.engine }}</b>{{ copy.engines[engineMode].label }}</span>
        <span class="tn-statusbar__field"><b>{{ copy.output.peak }}</b>{{ peakDb }}</span>
        <span v-if="engine.error.value" class="tn-error" :title="engine.error.value"
          >{{ copy.errors.start }}<template v-if="engine.error.value"> ({{ engine.error.value }})</template></span
        >
      </div>
    </template>

    <div class="tn-deck">
      <!-- ===== HERO + ENGINE PICKER ===== -->
      <div class="tn-hero">
        <div class="tn-scene">
          <TunerScene
            ref="sceneRef"
            :family="family"
            :level="sceneLevel"
            :is-dark="isDark"
            :reduce-motion="reduceMotion"
          />
          <div class="tn-scene__badge">
            <span class="tn-scene__model">{{ copy.deck.model }}</span>
            <span class="tn-scene__tagline">{{ copy.deck.tagline }}</span>
          </div>
        </div>

        <!-- PRIMARY: pick the GM/GS voice this patch fills in. -->
        <TechPanel :title="copy.sections.target" class="tn-tgcard">
          <div class="tn-tgcard__body">
            <div class="tn-tgcard__top">
              <p class="tn-tgcard__sub">{{ copy.target.subtitle }}</p>
              <button
                type="button"
                class="tn-toggle tn-toggle--sm"
                :class="{ 'tn-toggle--on': targetActive }"
                role="switch"
                :aria-checked="targetActive"
                @click="toggleTarget"
              >
                <span class="tn-toggle__dot"></span>
                <span class="tn-toggle__label">{{ copy.target.enable }}</span>
              </button>
            </div>

            <template v-if="targetActive">
              <div class="tn-tgcard__segs">
                <div class="tn-seg" role="tablist" :aria-label="copy.target.type">
                  <button
                    type="button" class="tn-seg__btn"
                    :class="{ 'tn-seg__btn--on': targetMode === 'melodic' }"
                    @click="setTargetMode('melodic')"
                  >{{ copy.target.modeMelodic }}</button>
                  <button
                    type="button" class="tn-seg__btn"
                    :class="{ 'tn-seg__btn--on': targetMode === 'drum' }"
                    @click="setTargetMode('drum')"
                  >{{ copy.target.modeDrum }}</button>
                </div>
                <div class="tn-seg" role="tablist" :aria-label="copy.target.standard">
                  <button
                    type="button" class="tn-seg__btn"
                    :class="{ 'tn-seg__btn--on': targetStandard === 'GM' }"
                    @click="setTargetStandard('GM')"
                  >GM</button>
                  <button
                    type="button" class="tn-seg__btn"
                    :class="{ 'tn-seg__btn--on': targetStandard === 'GS' }"
                    @click="setTargetStandard('GS')"
                  >GS</button>
                </div>
              </div>

              <div v-if="targetMode === 'melodic'" class="tn-tgcard__field">
                <span class="tn-sub-label">{{ copy.target.program }}</span>
                <TunerProgramPicker
                  :model-value="targetProgram"
                  :program-names="programNames"
                  :family-names="familyNames"
                  :synth-labels="copy.synthModes"
                  :out-of-scope-label="copy.target.optionOutOfScope"
                  :aria-label="copy.target.program"
                  @update:model-value="onProgramSelect"
                />
              </div>
              <label v-else class="tn-tgcard__field">
                <span class="tn-sub-label">{{ copy.target.drum }}</span>
                <select class="tn-select" :value="targetDrumNote" @change="onTargetDrum">
                  <option v-for="d in GM_DRUM_NOTES" :key="d.note" :value="d.note">
                    {{ d.note }} · {{ displayDrumName(d.note) }}
                  </option>
                </select>
              </label>

              <p
                v-if="targetMode === 'melodic' && targetSynthMode"
                class="tn-tgcard__scope"
              >{{ copy.target.outOfScope.replace('{engine}', synthModeLabel(targetSynthMode)) }}</p>

              <!-- GS-only slot address: variation bank (melodic) or drum kit. -->
              <label v-if="isGs && targetMode === 'melodic'" class="tn-tgcard__field">
                <span class="tn-sub-label">{{ copy.target.variation }}</span>
                <input
                  class="tn-select tn-num"
                  type="number" min="0" max="127" step="1"
                  :value="targetBankMsb" @input="onTargetBank"
                />
              </label>
              <label v-else-if="isGs" class="tn-tgcard__field">
                <span class="tn-sub-label">{{ copy.target.drumKit }}</span>
                <select class="tn-select" :value="targetDrumKit" @change="onTargetKit">
                  <option v-for="k in GS_DRUM_KITS" :key="k.program" :value="k.program">
                    {{ k.program }} · {{ displayKitName(k.program) }}
                  </option>
                </select>
              </label>
              <!-- Fixed-height slot: kit changes never resize the card. -->
              <p v-if="isGs && targetMode === 'drum'" class="tn-hint tn-hint--kit">{{ kitScopeHint }}</p>

              <div class="tn-tgcard__foot">
                <div class="tn-tgcard__slot">
                  <span class="tn-sub-label">{{ copy.target.slot }}</span>
                  <span class="tn-target__slot">{{ targetLabel }}</span>
                </div>
                <button type="button" class="tn-chip tn-chip--accent" @click="auditionCurrent">
                  ▶ {{ copy.target.hearCurrent }}
                </button>
              </div>
              <p class="tn-hint tn-hint--contribute">{{ copy.target.hint }}</p>
              <p v-if="isGs" class="tn-hint">{{ copy.target.gsNote }}</p>
            </template>
            <p v-else class="tn-hint">{{ copy.target.disabled }}</p>
          </div>
        </TechPanel>
      </div>

      <!-- ===== EXCITER MODEL ===== -->
      <section class="tn-sec tn-engines">
        <div class="tn-sec__head">
          <h3 class="tn-sec__title">{{ copy.sections.engine }}</h3>
        </div>

        <!-- The slot is voiced by a non-physical engine (FM electric piano, synth
             families): out of this tool's scope. Flag it instead of pretending a
             physical model fills it. -->
        <template v-if="targetActive && !targetCovered && targetSynthMode">
          <div class="tn-engines__locked">
            <span class="tn-engines__lockedname">{{ synthModeLabel(targetSynthMode) }}</span>
            <span class="tn-engines__badge tn-engines__badge--warn">{{ copy.engineLock.outOfScope }}</span>
          </div>
          <p class="tn-engines__warn">
            {{ copy.engineLock.outOfScopeHint }}
            <a :href="synthPath" class="tn-link">{{ copy.engineLock.synthLink }}</a>
          </p>
          <details class="tn-engines__override">
            <summary class="tn-advanced__summary">
              <span class="tn-advanced__title">{{ copy.engineLock.approxLabel }}</span>
              <span class="tn-advanced__chevron" aria-hidden="true">▾</span>
            </summary>
            <div class="tn-enginebar">
              <div v-for="group in familyGroups" :key="group.family" class="tn-egroup">
                <span class="tn-egroup__fam">{{ copy.families[group.family] }}</span>
                <div class="tn-egroup__chips">
                  <button
                    v-for="mode in group.modes"
                    :key="mode"
                    type="button"
                    class="tn-echip"
                    :class="{ 'tn-echip--active': mode === engineMode }"
                    :title="copy.engines[mode].blurb"
                    @click="selectEngine(mode)"
                  >{{ copy.engines[mode].label }}</button>
                </div>
              </div>
            </div>
            <p class="tn-enginebar__blurb">{{ copy.engines[engineMode].blurb }}</p>
          </details>
        </template>

        <!-- Under an active target the slot fixes the model: show it locked, with
             a deliberate override disclosure (open when the user has diverged). -->
        <template v-else-if="targetActive">
          <div class="tn-engines__locked">
            <span class="tn-engines__lockedname">{{ copy.engines[engineMode].label }}</span>
            <span
              v-if="engineMode === suggestedEngine"
              class="tn-engines__badge"
            >{{ copy.engineLock.slotModel }}</span>
            <span
              v-else
              class="tn-engines__badge tn-engines__badge--warn"
            >{{ copy.engineLock.diverged }}</span>
          </div>
          <p class="tn-enginebar__blurb">{{ copy.engines[engineMode].blurb }}</p>
          <details class="tn-engines__override" :open="engineMode !== suggestedEngine">
            <summary class="tn-advanced__summary">
              <span class="tn-advanced__title">{{ copy.engineLock.overrideLabel }}</span>
              <span class="tn-advanced__chevron" aria-hidden="true">▾</span>
            </summary>
            <p class="tn-engines__warn">{{ copy.engineLock.overrideWarn }}</p>
            <div class="tn-enginebar">
              <div v-for="group in familyGroups" :key="group.family" class="tn-egroup">
                <span class="tn-egroup__fam">{{ copy.families[group.family] }}</span>
                <div class="tn-egroup__chips">
                  <button
                    v-for="mode in group.modes"
                    :key="mode"
                    type="button"
                    class="tn-echip"
                    :class="{
                      'tn-echip--active': mode === engineMode,
                      'tn-echip--suggested': mode === suggestedEngine && mode !== engineMode,
                    }"
                    :title="copy.engines[mode].blurb"
                    @click="selectEngine(mode)"
                  >{{ copy.engines[mode].label }}</button>
                </div>
              </div>
            </div>
            <button
              v-if="engineMode !== suggestedEngine"
              type="button"
              class="tn-chip tn-engines__reset"
              @click="selectEngine(suggestedEngine)"
            >{{ copy.engineLock.reset }}</button>
          </details>
        </template>

        <!-- Free-tuning mode: no slot to honour, so pick any model directly. -->
        <template v-else>
          <div class="tn-enginebar">
            <div v-for="group in familyGroups" :key="group.family" class="tn-egroup">
              <span class="tn-egroup__fam">{{ copy.families[group.family] }}</span>
              <div class="tn-egroup__chips">
                <button
                  v-for="mode in group.modes"
                  :key="mode"
                  type="button"
                  class="tn-echip"
                  :class="{ 'tn-echip--active': mode === engineMode }"
                  :title="copy.engines[mode].blurb"
                  @click="selectEngine(mode)"
                >{{ copy.engines[mode].label }}</button>
              </div>
            </div>
          </div>
          <p class="tn-enginebar__blurb">{{ copy.engines[engineMode].blurb }}</p>
        </template>
      </section>

      <!-- ===== A/B COMPARISON ===== -->
      <section class="tn-sec">
        <div class="tn-sec__head"><h3 class="tn-sec__title">{{ copy.sections.compare }}</h3></div>
        <TunerCompare
          :original="originalBuf"
          :adjusted="adjustedBuf"
          :oracle="oracleBuf"
          :rms-error-pct="metrics.rmsErrorPct"
          :spec-sim-pct="metrics.specSimPct"
          :rendering="compareRendering"
          :has-data="hasCompareData"
          :labels="compareLabels"
          @compare="runCompare"
          @audition="audition"
        />

        <!-- Oracle (target sound) + auto-fit -->
        <div class="tn-oracle">
          <div class="tn-oracle__row">
            <button type="button" class="tn-chip" @click="openOracleImport">
              {{ copy.autofit.importOracle }}
            </button>
            <span v-if="oracleName" class="tn-oracle__file">
              {{ oracleName }}
              <button type="button" class="tn-oracle__clear" :aria-label="copy.oracle.clear" @click="clearOracle">✕</button>
            </span>
            <label v-if="oracleBuf" class="tn-oracle__note">
              <span class="tn-sub-label">{{ copy.autofit.oracleNote }}</span>
              <span class="tn-oracle__noterow">
                <input
                  class="tn-select tn-num tn-num--sm"
                  type="number" min="0" max="127" step="1"
                  :value="oracleNote" @input="onOracleNote"
                />
                <span class="tn-oracle__notename">{{ oracleNoteName }}</span>
              </span>
            </label>
            <input
              ref="oracleInput" type="file"
              accept=".wav,.mp3,.flac,.ogg,.mid,.midi,audio/*"
              class="tn-file" @change="onOracleFile"
            />
          </div>
          <p v-if="oracleError" class="tn-error">{{ oracleError }}</p>
          <p v-else class="tn-hint">{{ copy.autofit.hint }}</p>

          <template v-if="oracleBuf">
            <div v-if="autofit.running.value" class="tn-fit tn-fit--running">
              <div class="tn-fit__bar">
                <div class="tn-fit__fill" :style="{ width: `${Math.round(autofit.progress.value * 100)}%` }"></div>
              </div>
              <span class="tn-fit__stat">
                {{ copy.autofit.running }} · {{ copy.compare.specSim }} {{ Math.round(autofit.specSimPct.value) }}%
              </span>
              <button type="button" class="tn-chip" @click="cancelAutofit">{{ copy.autofit.cancel }}</button>
            </div>
            <div v-else class="tn-fit">
              <button type="button" class="tn-chip tn-chip--accent tn-chip--wide" @click="startAutofit">
                ✨ {{ copy.autofit.fit }}
              </button>
              <template v-if="fitResult">
                <span class="tn-fit__stat">
                  {{ copy.compare.specSim }} {{ Math.round(fitResult.specSimPct) }}% ·
                  {{ copy.compare.rmsError }} {{ Math.round(fitResult.rmsErrorPct) }}%
                </span>
                <button type="button" class="tn-chip tn-chip--accent" @click="keepFit">{{ copy.autofit.keep }}</button>
                <button type="button" class="tn-chip" @click="revertFit">{{ copy.autofit.revert }}</button>
              </template>
            </div>
            <p v-if="autofit.error.value" class="tn-error">{{ autofit.error.value }}</p>
            <p v-else-if="fitResult && fitResult.specSimPct < 55" class="tn-hint tn-hint--warn">
              {{ copy.autofit.poorMatch }}
            </p>
          </template>
        </div>
      </section>

      <!-- ===== SIGNAL CHAIN ===== -->
      <section class="tn-sec">
        <div class="tn-sec__head"><h3 class="tn-sec__title">{{ copy.sections.chain }}</h3></div>
        <TunerChain
          :exciter-label="copy.chain.exciter"
          :body-label="copy.chain.body"
          :amp-label="copy.chain.amp"
          :out-label="copy.chain.out"
          :engine-name="copy.engines[engineMode].label"
          :body-name="copy.bodies[spec.body]"
        />
        <div class="tn-chain-controls">
          <div class="tn-bodies">
            <span class="tn-sub-label tn-sub-label--info">
              {{ copy.sections.body }}
              <Tooltip v-bind="term('body')">
                <button type="button" class="tn-info" :aria-label="term('body').title">
                  <span aria-hidden="true">i</span>
                </button>
              </Tooltip>
            </span>
            <!-- Under a covered target the instrument fixes the resonator: show it
                 locked, with a deliberate override disclosure (open when diverged). -->
            <template v-if="bodyLocked">
              <div class="tn-engines__locked">
                <span class="tn-engines__lockedname">{{ copy.bodies[spec.body] }}</span>
                <span
                  v-if="!bodyDiverged"
                  class="tn-engines__badge"
                >{{ copy.bodyLock.slotBody }}</span>
                <span
                  v-else
                  class="tn-engines__badge tn-engines__badge--warn"
                >{{ copy.bodyLock.diverged }}</span>
              </div>
              <details class="tn-engines__override" :open="bodyDiverged">
                <summary class="tn-advanced__summary">
                  <span class="tn-advanced__title">{{ copy.bodyLock.overrideLabel }}</span>
                  <span class="tn-advanced__chevron" aria-hidden="true">▾</span>
                </summary>
                <p class="tn-engines__warn">{{ copy.bodyLock.overrideWarn }}</p>
                <div class="tn-bodies__row">
                  <button
                    v-for="b in BODY_TYPES"
                    :key="b"
                    type="button"
                    class="tn-chip"
                    :class="{
                      'tn-chip--active': b === spec.body,
                      'tn-chip--suggested': b === suggestedBody.body && b !== spec.body,
                    }"
                    @click="selectBody(b)"
                  >{{ copy.bodies[b] }}</button>
                </div>
                <button
                  v-if="bodyDiverged"
                  type="button"
                  class="tn-chip tn-engines__reset"
                  @click="resetBody"
                >{{ copy.bodyLock.reset }}</button>
              </details>
            </template>
            <div v-else class="tn-bodies__row">
              <button
                v-for="b in BODY_TYPES"
                :key="b"
                type="button"
                class="tn-chip"
                :class="{ 'tn-chip--active': b === spec.body }"
                @click="selectBody(b)"
              >{{ copy.bodies[b] }}</button>
            </div>
          </div>
          <div class="tn-knob-row">
            <RotaryKnob
              v-bind="term('bodyMix')"
              :model-value="spec.bodyMix" :min="0" :max="1" :step="0.01"
              :label="copy.chain.bodyMix" :display="`${Math.round(spec.bodyMix * 100)}%`"
              :size="48"
              @update:model-value="(v) => editWrapper({ bodyMix: v })"
            />
            <RotaryKnob
              v-bind="term('drive')"
              :model-value="spec.drive" :min="0" :max="1" :step="0.01"
              :label="copy.chain.drive" :display="`${Math.round(spec.drive * 100)}%`"
              :size="48" accent="var(--demo-cyan)"
              @update:model-value="(v) => editWrapper({ drive: v })"
            />
            <RotaryKnob
              v-bind="term('gain')"
              :model-value="spec.gain" :min="0" :max="1.5" :step="0.01"
              :label="copy.chain.gain" :display="`${Math.round(spec.gain * 100)}%`"
              :size="48" accent="var(--demo-amber)"
              @update:model-value="(v) => editWrapper({ gain: v })"
            />
          </div>
        </div>
      </section>

      <!-- ===== AMP ENVELOPE ===== -->
      <section class="tn-sec">
        <div class="tn-sec__head"><h3 class="tn-sec__title">{{ copy.sections.amp }}</h3></div>
        <div class="tn-knob-row">
          <RotaryKnob
            v-bind="term('ampAttack')"
            :model-value="spec.ampEnv.attackMs" :min="0" :max="500" :step="1"
            :label="copy.amp.attack" :display="`${Math.round(spec.ampEnv.attackMs)} ms`"
            :size="48"
            @update:model-value="(v) => editAmp('attackMs', v)"
          />
          <RotaryKnob
            v-bind="term('ampDecay')"
            :model-value="spec.ampEnv.decayMs" :min="10" :max="4000" :step="10"
            :label="copy.amp.decay" :display="`${Math.round(spec.ampEnv.decayMs)} ms`"
            :size="48"
            @update:model-value="(v) => editAmp('decayMs', v)"
          />
          <RotaryKnob
            v-bind="term('ampSustain')"
            :model-value="spec.ampEnv.sustain" :min="0" :max="1" :step="0.01"
            :label="copy.amp.sustain" :display="`${Math.round(spec.ampEnv.sustain * 100)}%`"
            :size="48"
            @update:model-value="(v) => editAmp('sustain', v)"
          />
          <RotaryKnob
            v-bind="term('ampRelease')"
            :model-value="spec.ampEnv.releaseMs" :min="10" :max="2000" :step="5"
            :label="copy.amp.release" :display="`${Math.round(spec.ampEnv.releaseMs)} ms`"
            :size="48" accent="var(--demo-cyan)"
            @update:model-value="(v) => editAmp('releaseMs', v)"
          />
        </div>
      </section>

      <!-- ===== SOUND SHAPING (perceptual macros) ===== -->
      <section v-if="macroDefs.length" class="tn-sec tn-sec--sound">
        <div class="tn-sec__head">
          <h3 class="tn-sec__title">{{ copy.macros.title }}</h3>
        </div>
        <p class="tn-macros__intro">{{ copy.macros.intro }}</p>
        <div class="tn-macros">
          <div v-for="(def, i) in macroDefs" :key="def.id" class="tn-macro">
            <div class="tn-macro__head">
              <span class="tn-macro__label">{{ macroLabel(def.id) }}</span>
              <span class="tn-macro__val">{{ Math.round(macroValues[i] * 100) }}%</span>
            </div>
            <input
              class="tn-macro__slider"
              type="range" min="0" max="1" step="0.01"
              :value="macroValues[i]"
              :aria-label="macroLabel(def.id)"
              @input="(e) => editMacro(def, Number((e.target as HTMLInputElement).value))"
            />
            <span class="tn-macro__hint">{{ macroHint(def.id) }}</span>
          </div>
        </div>
      </section>

      <!-- ===== MODEL PARAMETERS (grouped by physical layer) ===== -->
      <details class="tn-sec tn-advanced">
        <summary class="tn-advanced__summary">
          <span class="tn-advanced__title">{{ copy.sections.params }}</span>
          <span class="tn-sec__count">{{ paramSpecs.length }}</span>
          <span class="tn-advanced__chevron" aria-hidden="true">▾</span>
        </summary>
        <p class="tn-params__intro">{{ copy.paramsIntro }}</p>
        <div class="tn-layers">
          <div v-for="group in paramLayerGroups" :key="group.layer" class="tn-layer">
            <div class="tn-layer__head">
              <span class="tn-layer__name">{{ copy.layers[group.layer].label }}</span>
              <span class="tn-layer__blurb">{{ copy.layers[group.layer].blurb }}</span>
            </div>
            <div v-if="group.knobs.length" class="tn-params">
              <RotaryKnob
                v-for="ps in group.knobs"
                :key="ps.key"
                v-bind="term(ps.key)"
                label-wrap
                :model-value="paramValue(ps.key)"
                :min="ps.min" :max="ps.max" :step="ps.step"
                :label="ps.label" :display="formatParam(ps)"
                :size="46"
                @update:model-value="(v) => editParam(ps, v)"
              />
            </div>
            <div v-if="group.toggles.length" class="tn-toggles">
              <div v-for="ps in group.toggles" :key="ps.key" class="tn-toggle-wrap">
                <button
                  type="button"
                  class="tn-toggle"
                  :class="{ 'tn-toggle--on': boolValue(ps.key) }"
                  role="switch"
                  :aria-checked="boolValue(ps.key)"
                  @click="toggleBool(ps)"
                >
                  <span class="tn-toggle__dot"></span>
                  <span class="tn-toggle__label">{{ ps.label }}</span>
                </button>
                <Tooltip v-if="term(ps.key).body" v-bind="term(ps.key)">
                  <button type="button" class="tn-info" :aria-label="term(ps.key).title">
                    <span aria-hidden="true">i</span>
                  </button>
                </Tooltip>
              </div>
            </div>
          </div>
        </div>
      </details>

      <!-- ===== MIDI PHRASE / SCORE ===== -->
      <section class="tn-sec">
        <div class="tn-sec__head">
          <h3 class="tn-sec__title">{{ copy.sections.midi }}</h3>
          <span v-if="phrase.length" class="tn-sec__count">{{ phrase.length }} {{ copy.midi.count }}</span>
        </div>
        <div class="tn-actions">
          <button
            type="button" class="tn-chip tn-chip--wide"
            :disabled="!midiInput.supported.value || midiInput.connecting.value"
            @click="connectMidi"
          >
            {{ midiInput.connecting.value ? copy.midi.connecting : midiInput.connected.value ? copy.midi.connected : copy.midi.connect }}
          </button>
          <button
            type="button" class="tn-chip tn-chip--wide"
            :class="{ 'tn-chip--accent': recording }"
            :disabled="!isReady"
            @click="toggleRecord"
          >{{ recording ? copy.midi.stop : copy.midi.record }}</button>
          <button type="button" class="tn-chip tn-chip--wide" :disabled="!phrase.length" @click="playPhrase">{{ copy.midi.play }}</button>
          <button type="button" class="tn-chip tn-chip--wide" @click="openMidiImport">{{ copy.midi.importSmf }}</button>
          <button type="button" class="tn-chip tn-chip--wide" :disabled="!phrase.length" @click="exportMidi">{{ copy.midi.exportSmf }}</button>
          <button type="button" class="tn-chip tn-chip--wide" :disabled="!phrase.length" @click="clearPhrase">{{ copy.midi.clear }}</button>
          <button type="button" class="tn-chip tn-chip--wide" @click="toggleScore">{{ showScore ? copy.score.hide : copy.score.show }}</button>
          <input ref="midiInputEl" type="file" accept=".mid,.midi,audio/midi" class="tn-file" @change="onMidiFile" />
        </div>
        <p v-if="midiInput.error.value" class="tn-error">{{ midiInput.error.value }}</p>
        <p v-else-if="!midiInput.supported.value" class="tn-hint">{{ copy.midi.unavailable }}</p>
        <p v-else-if="!phrase.length" class="tn-hint">{{ copy.midi.empty }}</p>
        <TunerScore v-if="showScore" :phrase="phrase" :labels="copy.score" />
      </section>

      <!-- ===== PATCH JSON ===== -->
      <section class="tn-sec">
        <div class="tn-sec__head"><h3 class="tn-sec__title">{{ copy.sections.patch }}</h3></div>
        <div class="tn-actions">
          <button type="button" class="tn-chip tn-chip--wide" @click="exportPatch">{{ copy.patch.export }}</button>
          <button type="button" class="tn-chip tn-chip--wide" @click="openPatchImport">{{ copy.patch.import }}</button>
          <button type="button" class="tn-chip tn-chip--wide" @click="resetEngine">{{ copy.patch.reset }}</button>
          <button
            type="button"
            class="tn-chip tn-chip--wide tn-chip--accent"
            @click="shareViaIssue"
          >{{ copy.patch.share }}</button>
          <input
            ref="patchInput"
            type="file"
            accept="application/json,.json"
            class="tn-file"
            @change="onPatchFile"
          />
        </div>
        <p v-if="importError" class="tn-error">{{ importError }}</p>
        <p class="tn-hint">{{ copy.patch.hint }}</p>
        <p class="tn-hint tn-hint--contribute">{{ copy.patch.shareHint }}</p>
      </section>

      <!-- ===== KEYBED ===== -->
      <div class="tn-keys">
        <div class="tn-cheek">
          <span class="tn-cheek__label">{{ copy.controls.octave }}</span>
          <div class="tn-cheek__row">
            <button
              type="button" class="tn-chip tn-cheek__btn"
              :disabled="baseNote <= MIN_BASE_NOTE"
              :aria-label="copy.controls.octaveDown"
              @click="shiftOctave(-1)"
            >−</button>
            <span class="tn-cheek__value">{{ octaveLabel }}</span>
            <button
              type="button" class="tn-chip tn-cheek__btn"
              :disabled="baseNote >= maxBaseNote"
              :aria-label="copy.controls.octaveUp"
              @click="shiftOctave(1)"
            >+</button>
          </div>
          <button type="button" class="tn-chip tn-cheek__wide" @click="playScale">{{ copy.controls.playScale }}</button>
          <button type="button" class="tn-chip tn-cheek__wide" @click="panic">{{ copy.controls.panic }}</button>
        </div>
        <div class="tn-keybed">
          <SynthKeyboard
            :base-note="baseNote"
            :active="activeNotes"
            :octaves="keyboardOctaves"
            @note-on="noteOn"
            @note-off="releaseKey"
          />
        </div>
      </div>
      <p class="tn-hint">{{ copy.keyboardHint }}</p>
    </div>
  </ToolShell>
</template>

<style src="./tuner/TunerDemo.css"></style>
