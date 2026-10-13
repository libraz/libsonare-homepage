<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue';
import SynthKeyboard from '@/components/keyboard/SynthKeyboard.vue';
import { useSynthKeyboardInput } from '@/components/keyboard/useSynthKeyboardInput';
import ToolShell from '@/components/ToolShell.vue';
import ToolStatusBar, { type ToolStatusField } from '@/components/ToolStatusBar.vue';
import { DemoNotice, RotaryKnob, SegmentedControl, TermLabel, Tooltip } from '@/components/ui';
import { useI18n } from '@/composables/useI18n';
import { useUrlState } from '@/composables/useUrlState';
import { bootWasm } from '@/composables/useWasmBoot';
import SynthDeckDisplay from '@/demos/synth/SynthDeckDisplay.vue';
import SynthMidiPanel from '@/demos/synth/SynthMidiPanel.vue';
import {
  DEFAULT_PRESET,
  enCopy,
  jaCopy,
  SYNTH_TERM_SLUGS,
  type SynthTermKey,
} from '@/demos/synth/synthCopy';
import { createSynthMidiEngine } from '@/demos/synth/synthMidiEngine';
import {
  ATTACK_MAX_MS,
  ATTACK_MIN_MS,
  activeModelFields,
  baseVoiceEngine,
  baseVoiceId,
  buildSynthPatch,
  CUTOFF_MAX_HZ,
  CUTOFF_MIN_HZ,
  controlsFromPreset,
  type EngineGroup,
  fieldDefault,
  formatModelValue,
  GLIDE_MAX_MS,
  groupModelFields,
  groupPresetsByEngine,
  hasBaseVoice,
  inertTweaks,
  initPatchValues,
  LIVE_TWEAKS,
  logKnobHz,
  modelFieldStep,
  msLabel,
  RELEASE_MAX_MS,
  RELEASE_MIN_MS,
  RESONANCE_MAX,
  RESONANCE_MIN,
  type SynthPatchControls,
  type SynthTweakKey,
  tweakValue,
} from '@/demos/synth/synthPatchState';
import {
  SYNTH_OUTPUT_GAIN_DEFAULT,
  SYNTH_OUTPUT_GAIN_MAX,
  useSynthEngine,
} from '@/demos/synth/useSynthEngine';
import { formatNoteName } from '@/utils/pitch';
import { decayPeakHold, meterFillPercent } from '@/utils/scale';
import type {
  SynthEngineMode,
  SynthParamInfo,
  WebMidiBinding,
  WebMidiInputInfo,
} from '@/wasm/index';
import sonareJsUrl from '@/wasm/sonare.js?url';
import sonareWasmUrl from '@/wasm/sonare.wasm?url';

type WasmModule = typeof import('@/wasm/index.js');

const { locale, localizedPath, alternateLocalePath, localizedValue } = useI18n();
const copy = computed(() => localizedValue({ en: enCopy, ja: jaCopy }));
const engine = useSynthEngine(sonareJsUrl, sonareWasmUrl);

const libVersion = ref('');
const presetNames = ref<string[]>([DEFAULT_PRESET]);
const selectedPreset = ref(DEFAULT_PRESET);
/** Engine per preset name, read from each preset's own patch. */
const presetEngines = ref<Record<string, string>>({});
const engineModes = ref<string[]>([]);
/** The preset last chosen on each engine, so returning to an engine plays it again. */
const lastPresetByEngine = new Map<string, string>();
/** A preset named by the URL before the catalog arrived to check it against. */
let presetFromUrl: string | null = null;

/** The program as the URL carries it; setting it takes the same path as a click. */
const presetParam = computed<string>({
  get: () => selectedPreset.value,
  set: (name) => {
    if (Object.keys(presetEngines.value).length === 0) presetFromUrl = name;
    else if (isKnownProgram(name)) selectPreset(name);
  },
});

/** A catalog preset, or the base voice of an engine this build lists. */
function isKnownProgram(name: string): boolean {
  const engine = baseVoiceEngine(name);
  if (engine === null) return name in presetEngines.value;
  return engineModes.value.includes(engine) && hasBaseVoice(engine);
}

const url = useUrlState([
  {
    key: 'preset',
    state: presetParam,
    defaultValue: DEFAULT_PRESET,
    parse: (raw: string) => (/^[a-z0-9][a-z0-9:-]*$/.test(raw) ? raw : null),
  },
]);
const outputGain = ref(SYNTH_OUTPUT_GAIN_DEFAULT);
const baseNote = ref(48); // C3 — two octaves up to B4
const activeNotes = ref<Set<number>>(new Set());
const peakHold = ref(0);
/** Latched once any output sample reaches full scale; the CLIP chip resets it. */
const clipped = ref(false);
const CLIP_THRESHOLD = 0.997; // ≈ -0.03 dBFS

const MIN_BASE_NOTE = 24; // C1
// C5: the fitted keybed shows up to four octaves in the deck, so its top C is 120.
const MAX_BASE_NOTE = 72;
const MAX_MIDI_NOTE = 127;

const wasmModule = shallowRef<WasmModule | null>(null);

/** Patch keys the user has touched; only these are sent as preset overrides. */
const dirtyTweaks = ref<Set<SynthTweakKey>>(new Set());
/** The patch wrapper fields as the engine describes them (`synthPatchParamInfo`). */
const patchInfo = shallowRef<SynthParamInfo[]>([]);
/** Model-section fields the user has moved, by `engineParams` key. */
const modelValues = ref<Record<string, number>>({});
const modelGroupId = ref('');
const waveforms = ref<string[]>(['default', 'sine', 'saw', 'square', 'triangle', 'noise']);
const filterModels = ref<string[]>(['default', 'svf', 'moog-ladder', 'diode-ladder', 'sallen-key']);
const waveform = ref('default');
const filterModel = ref('default');
const cutoffNorm = ref(1);
const resonanceQ = ref(0.7);
const attackNorm = ref(0);
const releaseNorm = ref(0.5);
const glideMs = ref(0);
const stereoSpread = ref(0);

/** Preset base positions, used as the knobs' double-click reset targets. */
const baseVals = ref({
  cutoffNorm: 1,
  resonanceQ: 0.7,
  attackNorm: 0,
  releaseNorm: 0.5,
  glideMs: 0,
  stereoSpread: 0,
});

/** Mini waveshape icons silk-screened on the oscillator buttons. */
const WAVE_ICONS: Record<string, string> = {
  sine: 'M1 6 Q4 0 7 6 T13 6 T19 6 T25 6',
  saw: 'M1 10 L9 2 V10 L17 2 V10 L25 2',
  square: 'M1 10 V2 H9 V10 H17 V2 H25',
  triangle: 'M1 10 L7 2 L13 10 L19 2 L25 10',
  noise: 'M1 6 L3 3 L5 9 L7 2 L9 8 L11 4 L13 10 L15 3 L17 8 L19 5 L21 9 L23 3 L25 6',
};

// MIDI state
const midiSupported = ref<boolean | null>(null);
const midiConnecting = ref(false);
const midiError = ref(false);
const midiBinding = shallowRef<WebMidiBinding | null>(null);
let componentDisposed = false;
const midiInputs = ref<WebMidiInputInfo[]>([]);

const isReady = engine.ready;
const isStarting = engine.starting;
const isRunning = engine.running;
const meter = engine.meter;

watch(meter, (value) => {
  peakHold.value = decayPeakHold(peakHold.value, value.peak);
  if (value.peak >= CLIP_THRESHOLD) clipped.value = true;
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
const statusFields = computed<ToolStatusField[]>(() => {
  const keys = copy.value.statusbar;
  return [
    { key: keys.program, value: programLabel(selectedPreset.value), wide: true },
    { key: keys.engine, value: currentEngine.value || '-' },
    { key: keys.octave, value: octaveLabel.value, divider: true },
    { key: keys.peak, value: peakDb.value },
    { key: keys.rate, value: sampleRateLabel.value },
  ];
});

const octaveLabel = computed(() => formatNoteName(baseNote.value));
/** Below this the decaying tail is numerically present but inaudible; it reads as silence. */
const PEAK_FLOOR_DB = -96;
const peakDb = computed(() => {
  const db = 20 * Math.log10(meter.value.peak);
  return db > PEAK_FLOOR_DB ? `${db.toFixed(1)} dB` : '-∞ dB';
});
const sampleRateLabel = computed(() => {
  const ctx = engine.context.value;
  return ctx ? `${(ctx.sampleRate / 1000).toFixed(1)} kHz` : '-';
});

const cutoffHz = computed(() => logKnobHz(cutoffNorm.value, CUTOFF_MIN_HZ, CUTOFF_MAX_HZ));
const cutoffLabel = computed(() =>
  cutoffHz.value >= 1000 ? `${(cutoffHz.value / 1000).toFixed(1)} kHz` : `${cutoffHz.value} Hz`,
);
const attackMs = computed(() => logKnobHz(attackNorm.value, ATTACK_MIN_MS, ATTACK_MAX_MS));
const releaseMs = computed(() => logKnobHz(releaseNorm.value, RELEASE_MIN_MS, RELEASE_MAX_MS));

/** Attack / release silhouette drawn next to the envelope knobs. */
const envPath = computed(() => {
  const w = 116;
  const h = 34;
  const p = 3;
  const ax = p + attackNorm.value * (w * 0.36);
  const hx = ax + w * 0.12;
  const rw = 10 + releaseNorm.value * (w * 0.42);
  const rx = Math.min(w - p, hx + rw);
  return [
    `M ${p} ${h - p}`,
    `L ${ax.toFixed(1)} ${p}`,
    `L ${hx.toFixed(1)} ${p}`,
    `Q ${(hx + rw * 0.22).toFixed(1)} ${h - p} ${rx.toFixed(1)} ${h - p}`,
  ].join(' ');
});

const engineGroups = computed(() =>
  groupPresetsByEngine(
    presetNames.value,
    (name) => presetEngines.value[name] ?? '',
    engineModes.value,
  ),
);
const currentEngine = computed(
  () => baseVoiceEngine(selectedPreset.value) ?? presetEngines.value[selectedPreset.value] ?? '',
);
const isBaseVoice = computed(() => baseVoiceEngine(selectedPreset.value) !== null);
const currentGroup = computed(
  () => engineGroups.value.find((group) => group.engine === currentEngine.value) ?? null,
);
const inert = computed(() => inertTweaks(currentEngine.value));
const engineNote = computed(() => {
  if (inert.value.size === 0) return '';
  if (inert.value.has('cutoffHz')) return copy.value.engineNotes.kit;
  return copy.value.engineNotes.noOscillator.replace('{engine}', currentEngine.value);
});

/** The selected engine's own section, as the engine describes it. */
const modelGroups = computed(() => {
  const wasm = wasmModule.value;
  if (!wasm || !currentEngine.value) return [];
  try {
    const info = wasm.synthEngineParamInfo(currentEngine.value as SynthEngineMode);
    return groupModelFields(activeModelFields(info, modelValues.value));
  } catch {
    return [];
  }
});
const modelGroup = computed(
  () => modelGroups.value.find((group) => group.id === modelGroupId.value) ?? modelGroups.value[0],
);
const modelGroupOptions = computed(() =>
  modelGroups.value.map((group) => ({
    id: group.id,
    label: `${group.id || copy.value.model.main} (${group.fields.length})`,
  })),
);
watch(currentEngine, () => {
  modelGroupId.value = '';
});

/** A field's value: the user's, else the engine base preset's (booleans arrive as true/false). */
function modelValue(field: SynthParamInfo): number {
  return modelValues.value[field.name] ?? fieldDefault(field);
}

function programLabel(name: string): string {
  const engine = baseVoiceEngine(name);
  return engine === null ? name : `${engine} ${copy.value.patch.baseVoice}`;
}

const filterOptions = computed(() =>
  filterModels.value.map((id) => ({
    id,
    label: copy.value.patch.filterLabels[id] ?? id,
    disabled: inert.value.has('filterModel'),
  })),
);

const glossaryBase = computed(() => localizedPath('/docs/glossary'));

/** Build the rich-tooltip props for a control from the copy + slug tables. */
function term(key: SynthTermKey) {
  const t = copy.value.terms;
  const item = t.items[key];
  const slug = SYNTH_TERM_SLUGS[key];
  return {
    eyebrow: t.eyebrow,
    title: item.title,
    body: item.body,
    tip: item.tip,
    tipLabel: t.tipLabel,
    defaultRationale: 'defaultRationale' in item ? item.defaultRationale : undefined,
    defaultLabel: t.resetLabel,
    href: slug ? `${glossaryBase.value}/${slug}` : undefined,
    linkLabel: t.linkLabel,
  };
}

const docsPath = computed(() => localizedPath('/docs/native-synth'));
const midiDocsPath = computed(() => localizedPath('/docs/midi-input'));
const oppositeLocalePath = computed(() => alternateLocalePath('/synth'));

onMounted(() => {
  const ric = (window as { requestIdleCallback?: (cb: () => void, opts?: object) => void })
    .requestIdleCallback;
  if (ric) ric(initWasmMeta, { timeout: 2000 });
  else setTimeout(initWasmMeta, 100);
  void startEngine();
  url.applyFromUrl();
  url.enable();
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', releaseAll);
});

onUnmounted(() => {
  componentDisposed = true;
  url.disable();
  window.removeEventListener('keydown', onKeyDown);
  window.removeEventListener('keyup', onKeyUp);
  window.removeEventListener('blur', releaseAll);
  if (patchSendTimer) clearTimeout(patchSendTimer);
  midiBinding.value?.close();
  midiBinding.value = null;
  void engine.dispose();
});

/** Load version, preset catalog, and enum tables from the main-thread WASM module. */
async function initWasmMeta() {
  try {
    const wasm = await bootWasm();
    wasmModule.value = wasm;
    libVersion.value = wasm.version();
    // A bare preset name resolves to the first catalog match, so a repeated
    // name would render an unselectable duplicate button — keep one entry per
    // name even though the current catalog has no collisions.
    const names = [...new Set(wasm.synthPresetNames())];
    if (names.length > 0) presetNames.value = names;
    presetEngines.value = Object.fromEntries(
      names.map((name) => [name, String(wasm.synthPresetPatch(name).engineMode ?? '')]),
    );
    const tables = wasm.synthEnumTables();
    if (tables.waveforms?.length) waveforms.value = [...tables.waveforms];
    if (tables.filterModels?.length) filterModels.value = [...tables.filterModels];
    if (tables.engineModes?.length) engineModes.value = [...tables.engineModes];
    patchInfo.value = wasm.synthPatchParamInfo();
    if (presetFromUrl) {
      presetParam.value = presetFromUrl;
      presetFromUrl = null;
      // A name the catalog does not have was dropped; stop the URL claiming it.
      url.replaceInUrl();
    }
    midiSupported.value = wasm.isWebMidiAvailable();
    loadPresetBase(selectedPreset.value);
  } catch (error) {
    console.warn('Failed to initialize WASM metadata:', error);
  }
}

/** Seed the tweak controls from the program's base patch: the preset's, or the init patch's for a base voice. */
function loadPresetBase(preset: string) {
  const wasm = wasmModule.value;
  if (!wasm) return;
  try {
    const base =
      baseVoiceEngine(preset) === null
        ? wasm.synthPresetPatch(preset)
        : initPatchValues(patchInfo.value);
    const { controls, baseValues } = controlsFromPreset(base);
    waveform.value = controls.waveform;
    filterModel.value = controls.filterModel;
    cutoffNorm.value = controls.cutoffNorm;
    resonanceQ.value = controls.resonanceQ;
    attackNorm.value = controls.attackNorm;
    releaseNorm.value = controls.releaseNorm;
    glideMs.value = controls.glideMs;
    stereoSpread.value = controls.stereoSpread;
    baseVals.value = baseValues;
  } catch (error) {
    console.warn(`Failed to load base patch for ${preset}:`, error);
  }
}

function currentControls(): SynthPatchControls {
  return {
    waveform: waveform.value,
    filterModel: filterModel.value,
    cutoffNorm: cutoffNorm.value,
    resonanceQ: resonanceQ.value,
    attackNorm: attackNorm.value,
    releaseNorm: releaseNorm.value,
    glideMs: glideMs.value,
    stereoSpread: stereoSpread.value,
  };
}

/** The program plus only the user-touched overrides, as the engine takes it. */
function currentPatch() {
  return buildSynthPatch(
    selectedPreset.value,
    dirtyTweaks.value,
    currentControls(),
    modelValues.value,
  );
}

function sendPatch() {
  engine.setPatch(currentPatch());
}

let patchSendTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Rebind the instrument and strike held notes again: the engine fades out the
 * voices of the patch it replaces, so without the retrigger a held key goes silent.
 */
function sendPatchNow() {
  if (patchSendTimer) clearTimeout(patchSendTimer);
  patchSendTimer = null;
  sendPatch();
  for (const note of activeNotes.value) engine.noteOn(note, 100);
}

/** Debounce model-knob drags so a drag becomes one rebind+retrigger, not dozens. */
function schedulePatchSend() {
  if (patchSendTimer) clearTimeout(patchSendTimer);
  patchSendTimer = setTimeout(() => {
    patchSendTimer = null;
    sendPatchNow();
  }, 90);
}

/**
 * Mark a control as touched and send it. A continuous field moves the sounding
 * voices through its automation id; a structural one rebinds the instrument.
 */
function tweak(key: SynthTweakKey) {
  const next = new Set(dirtyTweaks.value);
  next.add(key);
  dirtyTweaks.value = next;
  if (LIVE_TWEAKS.has(key)) engine.setParam(key, tweakValue(key, currentControls()) as number);
  else sendPatchNow();
}

/** Knob value refs by tweak key (template args auto-unwrap refs, so look up here). */
const knobTargets = {
  cutoffHz: cutoffNorm,
  resonanceQ: resonanceQ,
  ampAttackMs: attackNorm,
  ampReleaseMs: releaseNorm,
  glideMs: glideMs,
  stereoSpread: stereoSpread,
} as const;

/** Knob/value update + dirty-flag in one step, for the template bindings. */
function setTweak(key: keyof typeof knobTargets, value: number) {
  knobTargets[key].value = value;
  tweak(key);
}

function selectWaveform(value: string) {
  waveform.value = value;
  tweak('waveform');
}

function selectFilterModel(value: string) {
  filterModel.value = value;
  tweak('filterModel');
}

function setModelParam(name: string, value: number) {
  modelValues.value = { ...modelValues.value, [name]: value };
  schedulePatchSend();
}

function resetTweaks() {
  dirtyTweaks.value = new Set();
  modelValues.value = {};
  loadPresetBase(selectedPreset.value);
  sendPatchNow();
}

const midiEngineProxy = createSynthMidiEngine(engine, { noteOn, noteOff, mark: markNote });

async function connectMidi() {
  const wasm = wasmModule.value;
  if (!wasm || midiBinding.value || midiConnecting.value) return;
  midiConnecting.value = true;
  midiError.value = false;
  engine.resume();
  try {
    const binding = await wasm.bindWebMidi(midiEngineProxy, {
      destinationId: 0,
      onInputsChanged: (inputs) => {
        midiInputs.value = inputs;
      },
    });
    if (componentDisposed) {
      binding.close();
      return;
    }
    midiBinding.value = binding;
    midiInputs.value = binding.inputs();
  } catch (error) {
    console.warn('Failed to bind Web MIDI:', error);
    midiError.value = true;
  } finally {
    midiConnecting.value = false;
  }
}

/** Boot the worklet at mount; the context stays suspended until a gesture. */
async function startEngine() {
  clipped.value = false;
  const bootPatch = currentPatch();
  const ok = await engine.start(bootPatch);
  if (!ok) return;
  engine.setGain(outputGain.value);
  // A program or tweak chosen while the engine was booting had no node to reach.
  if (JSON.stringify(currentPatch()) !== JSON.stringify(bootPatch)) sendPatch();
}

function noteOn(note: number, velocity = 100) {
  if (!isReady.value || note > MAX_MIDI_NOTE) return;
  engine.noteOn(note, velocity);
  const next = new Set(activeNotes.value);
  next.add(note);
  activeNotes.value = next;
}

function markNote(note: number, on: boolean) {
  const next = new Set(activeNotes.value);
  if (on) next.add(note);
  else next.delete(note);
  activeNotes.value = next;
}

function noteOff(note: number) {
  if (!activeNotes.value.has(note)) return;
  engine.noteOff(note);
  const next = new Set(activeNotes.value);
  next.delete(note);
  activeNotes.value = next;
}

const { onKeyDown, onKeyUp, releaseHeldPcNotes } = useSynthKeyboardInput({
  isReady,
  baseNote,
  noteOn,
  noteOff,
  shiftOctave,
});

watch(engine.faultEpoch, () => releaseAll());

/** Release every sounding note (octave shifts, panic, window blur). */
function releaseAll() {
  for (const note of activeNotes.value) engine.noteOff(note);
  activeNotes.value = new Set();
  releaseHeldPcNotes();
}

function shiftOctave(direction: -1 | 1) {
  const next = baseNote.value + direction * 12;
  if (next < MIN_BASE_NOTE || next > MAX_BASE_NOTE) return;
  releaseAll();
  baseNote.value = next;
}

function panic() {
  releaseAll();
  engine.panic();
}

function selectPreset(name: string) {
  if (selectedPreset.value === name) return;
  selectedPreset.value = name;
  lastPresetByEngine.set(baseVoiceEngine(name) ?? presetEngines.value[name] ?? '', name);
  dirtyTweaks.value = new Set();
  modelValues.value = {};
  loadPresetBase(name);
  sendPatchNow();
}

function selectEngine(group: EngineGroup) {
  selectPreset(lastPresetByEngine.get(group.engine) ?? group.presets[0]);
}

function applyGain() {
  engine.setGain(outputGain.value);
}
</script>

<template>
  <ToolShell
    demo-id="synth"
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
      <ToolStatusBar :status="statusKind" :label="statusLabel" :pulse="isStarting" :fields="statusFields" />
    </template>

    <DemoNotice v-if="engine.error.value" tone="error" class="sy-alert">{{ copy.errors.start }}</DemoNotice>

    <div class="sy-deck demo-deck">
      <!-- ===== DISPLAY ROW ===== -->
      <SynthDeckDisplay
        :model="copy.deck.model"
        :tagline="copy.deck.tagline"
        :power-label="copy.deck.power"
        :is-running="isRunning"
        :analyser="engine.analyser.value"
        :selected-preset="programLabel(selectedPreset)"
        :peak-db="peakDb"
      />

      <!-- ===== CONTROL SECTIONS ===== -->
      <div class="sy-deck__controls">
        <section class="sy-sec sy-sec--program">
          <div class="sy-sec__head">
            <h3 class="sy-sec__title">{{ copy.sections.program }}</h3>
            <Tooltip v-bind="term('program')" />
          </div>
          <div class="sy-programs">
            <ul class="sy-engines" :aria-label="copy.patch.engine">
              <li v-for="group in engineGroups" :key="group.engine">
                <button
                  type="button"
                  class="sy-engine"
                  :class="{ 'sy-engine--active': group.engine === currentEngine }"
                  :aria-pressed="group.engine === currentEngine"
                  @click="selectEngine(group)"
                >
                  <span class="sy-engine__name">{{ group.engine || copy.sections.program }}</span>
                  <span class="sy-engine__count">{{ group.presets.length }}</span>
                </button>
              </li>
            </ul>
            <ul class="sy-presets" :aria-label="copy.sections.program">
              <li v-for="name in currentGroup?.presets ?? presetNames" :key="name">
                <button
                  type="button"
                  class="sy-program"
                  :class="{
                    'sy-program--active': name === selectedPreset,
                    'sy-program--base': baseVoiceEngine(name) !== null,
                  }"
                  :aria-pressed="name === selectedPreset"
                  @click="selectPreset(name)"
                >
                  <span class="sy-program__name">{{ baseVoiceEngine(name) === null ? name : copy.patch.baseVoice }}</span>
                </button>
              </li>
            </ul>
          </div>
        </section>

        <section class="sy-sec sy-sec--osc">
          <div class="sy-sec__head">
            <h3 class="sy-sec__title">{{ copy.sections.osc }}</h3>
            <Tooltip v-bind="term('waveform')" />
          </div>
          <div class="sy-waves" role="group" :aria-label="copy.patch.waveform">
            <button
              v-for="w in waveforms"
              :key="w"
              type="button"
              class="sy-wave"
              :class="{ 'sy-wave--active': !inert.has('waveform') && w === waveform }"
              :aria-pressed="!inert.has('waveform') && w === waveform"
              :disabled="inert.has('waveform')"
              @click="selectWaveform(w)"
            >
              <svg v-if="WAVE_ICONS[w]" viewBox="0 0 26 12" aria-hidden="true">
                <path :d="WAVE_ICONS[w]" />
              </svg>
              <span v-else class="sy-wave__auto" aria-hidden="true">{{ copy.patch.auto }}</span>
              <span class="sy-wave__label">{{ w === 'default' ? copy.patch.auto : w }}</span>
            </button>
          </div>
          <div class="sy-engine-note">
            <DemoNotice v-if="engineNote" tone="hint">{{ engineNote }}</DemoNotice>
          </div>
        </section>

        <section class="sy-sec sy-sec--filter">
          <div class="sy-sec__head">
            <h3 class="sy-sec__title">{{ copy.sections.filter }}</h3>
            <Tooltip v-bind="term('filterModel')" />
          </div>
          <div class="sy-knob-row">
            <RotaryKnob
              v-bind="term('cutoff')"
              :model-value="cutoffNorm"
              :min="0" :max="1" :step="0.005"
              :label="copy.patch.cutoff"
              :display="cutoffLabel"
              :default-value="baseVals.cutoffNorm"
              :size="48"
              :disabled="inert.has('cutoffHz')"
              @update:model-value="(v) => setTweak('cutoffHz', v)"
            />
            <RotaryKnob
              v-bind="term('resonance')"
              :model-value="resonanceQ"
              :min="RESONANCE_MIN" :max="RESONANCE_MAX" :step="0.05"
              :label="copy.patch.resonance"
              :display="resonanceQ.toFixed(2)"
              :default-value="baseVals.resonanceQ"
              :size="48"
              :disabled="inert.has('resonanceQ')"
              @update:model-value="(v) => setTweak('resonanceQ', v)"
            />
          </div>
          <SegmentedControl
            :model-value="inert.has('filterModel') ? '' : filterModel"
            :options="filterOptions"
            :ariaLabel="copy.patch.filterModel"
            :fill="false"
            size="sm"
            class="sy-filter-models"
            @update:model-value="selectFilterModel"
          />
        </section>

        <section class="sy-sec">
          <div class="sy-sec__head">
            <h3 class="sy-sec__title">{{ copy.sections.envelope }}</h3>
            <Tooltip v-bind="term('envelope')" />
          </div>
          <div class="sy-knob-row">
            <RotaryKnob
              v-bind="term('attack')"
              :model-value="attackNorm"
              :min="0" :max="1" :step="0.005"
              :label="copy.patch.attack"
              :display="msLabel(attackMs)"
              :default-value="baseVals.attackNorm"
              :size="48"
              accent="var(--demo-cyan)"
              :disabled="inert.has('ampAttackMs')"
              @update:model-value="(v) => setTweak('ampAttackMs', v)"
            />
            <RotaryKnob
              v-bind="term('release')"
              :model-value="releaseNorm"
              :min="0" :max="1" :step="0.005"
              :label="copy.patch.release"
              :display="msLabel(releaseMs)"
              :default-value="baseVals.releaseNorm"
              :size="48"
              accent="var(--demo-cyan)"
              :disabled="inert.has('ampReleaseMs')"
              @update:model-value="(v) => setTweak('ampReleaseMs', v)"
            />
          </div>
          <svg
            class="sy-env"
            :class="{ 'sy-env--inert': inert.has('ampAttackMs') }"
            viewBox="0 0 116 34"
            aria-hidden="true"
          >
            <path class="sy-env__curve" :d="envPath" />
          </svg>
        </section>

        <section class="sy-sec">
          <div class="sy-sec__head">
            <h3 class="sy-sec__title">{{ copy.sections.voice }}</h3>
            <Tooltip v-bind="term('voice')" />
          </div>
          <div class="sy-knob-row">
            <RotaryKnob
              v-bind="term('glide')"
              :model-value="glideMs"
              :min="0" :max="GLIDE_MAX_MS" :step="1"
              :label="copy.patch.glide"
              :display="`${Math.round(glideMs)} ms`"
              :default-value="baseVals.glideMs"
              :size="48"
              :disabled="inert.has('glideMs')"
              @update:model-value="(v) => setTweak('glideMs', v)"
            />
            <RotaryKnob
              v-bind="term('spread')"
              :model-value="stereoSpread"
              :min="0" :max="1" :step="0.01"
              :label="copy.patch.spread"
              :display="`${Math.round(stereoSpread * 100)}%`"
              :default-value="baseVals.stereoSpread"
              :size="48"
              :disabled="inert.has('stereoSpread')"
              @update:model-value="(v) => setTweak('stereoSpread', v)"
            />
          </div>
          <button
            type="button"
            class="demo-btn demo-btn--sm sy-reset"
            :disabled="dirtyTweaks.size === 0 && Object.keys(modelValues).length === 0"
            @click="resetTweaks"
          >
            {{ copy.patch.reset }}
          </button>
        </section>

        <section class="sy-sec sy-sec--output">
          <div class="sy-sec__head">
            <h3 class="sy-sec__title">{{ copy.sections.output }}</h3>
            <Tooltip v-bind="term('output')" />
          </div>
          <div class="sy-output">
            <RotaryKnob
              v-bind="term('gain')"
              :model-value="outputGain"
              :min="0" :max="SYNTH_OUTPUT_GAIN_MAX" :step="0.01"
              :label="copy.output.gain"
              :display="`${Math.round(outputGain * 100)}%`"
              :default-value="SYNTH_OUTPUT_GAIN_DEFAULT"
              :size="48"
              accent="var(--demo-amber)"
              @update:model-value="(v) => { outputGain = v; applyGain(); }"
            />
            <div class="sy-vmeter">
              <button
                type="button"
                class="sy-clip"
                :class="{ 'sy-clip--lit': clipped }"
                :aria-label="copy.output.clip"
                :title="copy.output.clip"
                @click="clipped = false"
              >CLIP</button>
              <div
                class="sy-vmeter__track"
                aria-hidden="true"
                :style="{ '--fill': `${meterFillPercent(meter.peak)}%`, '--hold': meterFillPercent(peakHold) / 100 }"
              >
                <div class="sy-vmeter__fill"></div>
                <i v-if="peakHold > 0" class="sy-vmeter__hold"></i>
              </div>
              <TermLabel v-bind="term('peak')" :label="copy.output.peak" compact />
            </div>
          </div>
          <Tooltip v-bind="term('panic')">
            <button type="button" class="demo-btn demo-btn--sm demo-btn--danger sy-panic" @click="panic">
              {{ copy.controls.panic }}
            </button>
          </Tooltip>
        </section>
      </div>

      <!-- ===== MODEL ROW: the engine's own section, from synthEngineParamInfo() ===== -->
      <section class="sy-model">
        <div class="sy-model__head">
          <div class="sy-sec__head">
            <h3 class="sy-sec__title">{{ copy.sections.model }}<span class="sy-model__engine">{{ currentEngine }}</span></h3>
            <Tooltip v-bind="term('model')" />
          </div>
          <SegmentedControl
            v-if="isBaseVoice && modelGroups.length > 1"
            :model-value="modelGroup?.id ?? ''"
            :options="modelGroupOptions"
            :ariaLabel="copy.model.group"
            :fill="false"
            size="sm"
            class="sy-model__groups"
            @update:model-value="(id) => (modelGroupId = id)"
          />
        </div>
        <DemoNotice v-if="modelGroups.length === 0" tone="hint">{{ copy.model.none }}</DemoNotice>
        <DemoNotice v-else-if="!isBaseVoice" tone="hint">
          {{ copy.model.locked }}
          <template v-if="hasBaseVoice(currentEngine)" #action>
            <button type="button" class="demo-btn demo-btn--sm" @click="selectPreset(baseVoiceId(currentEngine))">
              {{ copy.model.openBase }}
            </button>
          </template>
        </DemoNotice>
        <template v-else-if="modelGroup">
          <Transition name="demo-fade" mode="out-in">
            <div :key="`${currentEngine}/${modelGroup.id}`">
              <!-- Fields the engine gates on other values rise in as those values open them. -->
              <TransitionGroup name="demo-rise" tag="div" class="sy-model__knobs">
                <template v-for="field in modelGroup.fields" :key="field.info.name">
                <div v-if="field.info.type === 'boolean'" class="sy-model__switch">
                  <span class="sy-model__switch-label">{{ field.label }}</span>
                  <button
                    type="button"
                    class="demo-btn demo-btn--sm"
                    :class="{ 'demo-btn--primary': modelValue(field.info) !== 0 }"
                    :aria-label="field.info.name"
                    :aria-pressed="modelValue(field.info) !== 0"
                    @click="setModelParam(field.info.name, modelValue(field.info) !== 0 ? 0 : 1)"
                  >
                    {{ modelValue(field.info) !== 0 ? copy.model.on : copy.model.off }}
                  </button>
                </div>
                <RotaryKnob
                  v-else
                  :model-value="modelValue(field.info)"
                  :min="field.info.min ?? 0"
                  :max="field.info.max ?? 1"
                  :step="modelFieldStep(field.info)"
                  :label="field.label"
                  :aria-label="field.info.name"
                  :display="formatModelValue(modelValue(field.info), field.info)"
                  :default-value="fieldDefault(field.info)"
                  :size="40"
                  accent="var(--demo-cyan)"
                  label-wrap
                  @update:model-value="(v) => setModelParam(field.info.name, field.info.integer ? Math.round(v) : v)"
                />
                </template>
              </TransitionGroup>
            </div>
          </Transition>
          <DemoNotice v-if="currentEngine === 'percussion'" tone="hint">{{ copy.model.kit }}</DemoNotice>
          <DemoNotice tone="hint">{{ copy.model.rebind }}</DemoNotice>
        </template>
      </section>

      <!-- ===== KEYBED ROW ===== -->
      <div class="sy-deck__keys">
        <div class="sy-keys__bar">
          <div class="sy-keys__octave">
            <span class="sy-sec__title">{{ copy.controls.octave }}</span>
            <Tooltip v-bind="term('octave')" />
            <button
              type="button"
              class="demo-btn demo-btn--sm demo-btn--icon"
              :disabled="baseNote <= MIN_BASE_NOTE"
              :aria-label="copy.controls.octaveDown"
              @click="shiftOctave(-1)"
            >−</button>
            <span class="sy-keys__value">{{ octaveLabel }}</span>
            <button
              type="button"
              class="demo-btn demo-btn--sm demo-btn--icon"
              :disabled="baseNote >= MAX_BASE_NOTE"
              :aria-label="copy.controls.octaveUp"
              @click="shiftOctave(1)"
            >+</button>
          </div>
          <DemoNotice tone="hint" class="sy-keys__hint">
            {{ copy.keyboard.touch }}
            {{ copy.keyboard.play }}
            <span class="sy-keys__kbds"><kbd v-for="key in copy.keyboard.keys.split(' ')" :key="key" class="demo-kbd">{{ key }}</kbd></span>
            · <kbd class="demo-kbd">Z</kbd> / <kbd class="demo-kbd">X</kbd> {{ copy.keyboard.octave }}
          </DemoNotice>
        </div>
        <div class="sy-keybed">
          <SynthKeyboard
            fit
            :base-note="baseNote"
            :active="activeNotes"
            @note-on="noteOn"
            @note-off="noteOff"
          />
        </div>
      </div>

      <!-- ===== MIDI ROW ===== -->
      <SynthMidiPanel
        :title="copy.sections.midi"
        :unavailable-label="copy.midi.unavailable"
        :connecting-label="copy.midi.connecting"
        :connect-label="copy.midi.connect"
        :empty-label="copy.midi.none"
        :error-label="copy.midi.error"
        :docs-label="copy.midi.docs"
        :docs-path="midiDocsPath"
        :supported="midiSupported"
        :connecting="midiConnecting"
        :has-error="midiError"
        :connected="Boolean(midiBinding)"
        :wasm-ready="Boolean(wasmModule)"
        :inputs="midiInputs"
        :midi-term="term('midi')"
        @connect="connectMidi"
      />
    </div>
  </ToolShell>
</template>

<style src="./SynthDemo.css"></style>
