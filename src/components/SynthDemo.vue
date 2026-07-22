<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue';
import SynthDeckDisplay from '@/components/synth/SynthDeckDisplay.vue';
import SynthKeyboard from '@/components/synth/SynthKeyboard.vue';
import SynthMidiPanel from '@/components/synth/SynthMidiPanel.vue';
import SynthStatusBar from '@/components/synth/SynthStatusBar.vue';
import {
  DEFAULT_PRESET,
  enCopy,
  jaCopy,
  SYNTH_TERM_SLUGS,
  type SynthTermKey,
} from '@/components/synth/synthCopy';
import {
  ATTACK_MAX_MS,
  ATTACK_MIN_MS,
  buildSynthPatch,
  CUTOFF_MAX_HZ,
  CUTOFF_MIN_HZ,
  controlsFromPreset,
  logKnobHz,
  msLabel,
  RELEASE_MAX_MS,
  RELEASE_MIN_MS,
  type SynthPatchControls,
  type SynthTweakKey,
} from '@/components/synth/synthPatchState';
import { useSynthKeyboardInput } from '@/components/synth/useSynthKeyboardInput';
import ToolShell from '@/components/ToolShell.vue';
import { RotaryKnob, Tooltip } from '@/components/ui';
import { useI18n } from '@/composables/useI18n';
import { useSynthEngine } from '@/composables/useSynthEngine';
import { bootWasm } from '@/composables/useWasmBoot';
import { decayPeakHold, meterFillPercent } from '@/utils/scale';
import type { WebMidiBinding, WebMidiInputInfo } from '@/wasm/index';
import sonareJsUrl from '@/wasm/sonare.js?url';
import sonareWasmUrl from '@/wasm/sonare.wasm?url';

type WasmModule = typeof import('@/wasm/index.js');

const { locale, localizedPath, alternateLocalePath, localizedValue } = useI18n();
const copy = computed(() => localizedValue({ en: enCopy, ja: jaCopy }));
const engine = useSynthEngine(sonareJsUrl, sonareWasmUrl);

const libVersion = ref('');
const presetNames = ref<string[]>([DEFAULT_PRESET]);
const selectedPreset = ref(DEFAULT_PRESET);
const outputGain = ref(0.9);
const baseNote = ref(48); // C3 — two octaves up to B4
const activeNotes = ref<Set<number>>(new Set());
const peakHold = ref(0);

const MIN_BASE_NOTE = 24; // C1
const MAX_BASE_NOTE = 84; // C6 (top key reaches B7)
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

const wasmModule = shallowRef<WasmModule | null>(null);

/** Patch keys the user has touched; only these are sent as preset overrides. */
const dirtyTweaks = ref<Set<SynthTweakKey>>(new Set());
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

/** Short silk-screen labels for the filter models. */
const FILTER_LABELS: Record<string, string> = {
  default: 'AUTO',
  svf: 'SVF',
  'moog-ladder': 'MOOG',
  'diode-ladder': 'DIODE',
  'sallen-key': 'S-KEY',
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
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', releaseAll);
});

onUnmounted(() => {
  componentDisposed = true;
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
    const names = wasm.synthPresetNames();
    if (names.length > 0) presetNames.value = names;
    const tables = wasm.synthEnumTables();
    if (tables.waveforms?.length) waveforms.value = [...tables.waveforms];
    if (tables.filterModels?.length) filterModels.value = [...tables.filterModels];
    midiSupported.value = wasm.isWebMidiAvailable();
    loadPresetBase(selectedPreset.value);
  } catch (error) {
    console.warn('Failed to initialize WASM metadata:', error);
  }
}

/** Seed the tweak controls from the preset's resolved base patch. */
function loadPresetBase(preset: string) {
  const wasm = wasmModule.value;
  if (!wasm) return;
  try {
    const { controls, baseValues } = controlsFromPreset(wasm.synthPresetPatch(preset));
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

/** Send the preset plus only the user-touched overrides to the audio thread. */
function sendPatch() {
  const controls: SynthPatchControls = {
    waveform: waveform.value,
    filterModel: filterModel.value,
    cutoffNorm: cutoffNorm.value,
    resonanceQ: resonanceQ.value,
    attackNorm: attackNorm.value,
    releaseNorm: releaseNorm.value,
    glideMs: glideMs.value,
    stereoSpread: stereoSpread.value,
  };
  engine.setPatch(buildSynthPatch(selectedPreset.value, dirtyTweaks.value, controls));
}

/**
 * Apply the patch and retrigger held notes: rebinding the synth instrument
 * cuts its sounding voices, so without the retrigger a held key goes silent.
 */
function sendPatchNow() {
  sendPatch();
  for (const note of activeNotes.value) engine.noteOn(note, 100);
}

let patchSendTimer: ReturnType<typeof setTimeout> | null = null;

/** Debounce knob drags so a drag becomes one rebind+retrigger, not dozens. */
function schedulePatchSend() {
  if (patchSendTimer) clearTimeout(patchSendTimer);
  patchSendTimer = setTimeout(() => {
    patchSendTimer = null;
    sendPatchNow();
  }, 90);
}

function tweak(key: SynthTweakKey) {
  const next = new Set(dirtyTweaks.value);
  next.add(key);
  dirtyTweaks.value = next;
  schedulePatchSend();
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

function resetTweaks() {
  dirtyTweaks.value = new Set();
  loadPresetBase(selectedPreset.value);
  sendPatchNow();
}

/**
 * Main-thread stand-in for the audio-thread engine: `bindWebMidi` only calls
 * the MIDI push methods, which we forward over the worklet port (lighting up
 * the on-screen keys on the way through).
 */
const midiEngineProxy = {
  setMidiInputSource: () => {
    /* the worklet already bound the input source at startup */
  },
  clearMidiInputSource: () => {
    /* called by binding.close() on unmount; engine.dispose() handles the panic */
  },
  bindMidiCc: () => {
    /* no CC-to-parameter bindings in this demo */
  },
  pushMidiInputNoteOn: (_group: number, _channel: number, note: number, velocity: number) =>
    noteOn(note, velocity),
  pushMidiInputNoteOff: (_group: number, _channel: number, note: number) => noteOff(note),
  pushMidiInputCc: (_group: number, _channel: number, controller: number, value: number) =>
    engine.controlChange(controller, value),
};

async function connectMidi() {
  const wasm = wasmModule.value;
  if (!wasm || midiBinding.value || midiConnecting.value) return;
  midiConnecting.value = true;
  midiError.value = false;
  engine.resume();
  try {
    const binding = await wasm.bindWebMidi(midiEngineProxy as never, {
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
  const ok = await engine.start(selectedPreset.value);
  if (!ok) return;
  engine.setGain(outputGain.value);
  // Apply any tweaks made while the engine was still booting.
  if (dirtyTweaks.value.size > 0) sendPatch();
}

function noteOn(note: number, velocity = 100) {
  if (!isReady.value) return;
  engine.noteOn(note, velocity);
  const next = new Set(activeNotes.value);
  next.add(note);
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
  dirtyTweaks.value = new Set();
  loadPresetBase(name);
  sendPatchNow();
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
      <SynthStatusBar
        :status="statusKind"
        :label="statusLabel"
        :pulse="isStarting"
        :peak-label="copy.output.peak"
        :peak-db="peakDb"
        :engine-label="copy.output.engine"
        :sample-rate-label="sampleRateLabel"
        :error-message="engine.error.value ? copy.errors.start : undefined"
      />
    </template>

    <div class="sy-deck">
      <!-- ===== DISPLAY ROW ===== -->
      <SynthDeckDisplay
        :model="copy.deck.model"
        :tagline="copy.deck.tagline"
        :power-label="copy.deck.power"
        :is-running="isRunning"
        :analyser="engine.analyser.value"
        :selected-preset="selectedPreset"
        :peak-db="peakDb"
      />

      <!-- ===== CONTROL SECTIONS ===== -->
      <div class="sy-deck__controls">
        <section class="sy-sec sy-sec--program">
          <div class="sy-sec__head">
            <h3 class="sy-sec__title">{{ copy.sections.program }}</h3>
            <Tooltip v-bind="term('program')">
              <button type="button" class="sy-sec__info" :aria-label="term('program').title">
                <span aria-hidden="true">i</span>
              </button>
            </Tooltip>
          </div>
          <div class="sy-programs">
            <button
              v-for="(name, i) in presetNames"
              :key="name"
              type="button"
              class="sy-program"
              :class="{ 'sy-program--active': name === selectedPreset }"
              @click="selectPreset(name)"
            >
              <span class="sy-program__no">{{ String(i + 1).padStart(2, '0') }}</span>
              <span class="sy-program__name">{{ name }}</span>
            </button>
          </div>
        </section>

        <section class="sy-sec">
          <div class="sy-sec__head">
            <h3 class="sy-sec__title">{{ copy.sections.osc }}</h3>
            <Tooltip v-bind="term('waveform')">
              <button type="button" class="sy-sec__info" :aria-label="term('waveform').title">
                <span aria-hidden="true">i</span>
              </button>
            </Tooltip>
          </div>
          <div class="sy-waves">
            <button
              v-for="w in waveforms"
              :key="w"
              type="button"
              class="sy-wave"
              :class="{ 'sy-wave--active': w === waveform }"
              :title="w"
              @click="selectWaveform(w)"
            >
              <svg v-if="WAVE_ICONS[w]" viewBox="0 0 26 12" aria-hidden="true">
                <path :d="WAVE_ICONS[w]" />
              </svg>
              <span v-else class="sy-wave__auto">AUTO</span>
              <span class="sy-wave__label">{{ w === 'default' ? 'auto' : w }}</span>
            </button>
          </div>
        </section>

        <section class="sy-sec">
          <div class="sy-sec__head">
            <h3 class="sy-sec__title">{{ copy.sections.filter }}</h3>
            <Tooltip v-bind="term('filterModel')">
              <button type="button" class="sy-sec__info" :aria-label="term('filterModel').title">
                <span aria-hidden="true">i</span>
              </button>
            </Tooltip>
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
              @update:model-value="(v) => setTweak('cutoffHz', v)"
            />
            <RotaryKnob
              v-bind="term('resonance')"
              :model-value="resonanceQ"
              :min="0.5" :max="12" :step="0.05"
              :label="copy.patch.resonance"
              :display="resonanceQ.toFixed(2)"
              :default-value="baseVals.resonanceQ"
              :size="48"
              @update:model-value="(v) => setTweak('resonanceQ', v)"
            />
          </div>
          <div class="sy-filter-models">
            <button
              v-for="f in filterModels"
              :key="f"
              type="button"
              class="sy-chipbtn"
              :class="{ 'sy-chipbtn--active': f === filterModel }"
              :title="f"
              @click="selectFilterModel(f)"
            >{{ FILTER_LABELS[f] ?? f }}</button>
          </div>
        </section>

        <section class="sy-sec">
          <h3 class="sy-sec__title">{{ copy.sections.envelope }}</h3>
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
              @update:model-value="(v) => setTweak('ampReleaseMs', v)"
            />
          </div>
          <svg class="sy-env" viewBox="0 0 116 34" aria-hidden="true">
            <path class="sy-env__curve" :d="envPath" />
          </svg>
        </section>

        <section class="sy-sec">
          <h3 class="sy-sec__title">{{ copy.sections.voice }}</h3>
          <div class="sy-knob-row">
            <RotaryKnob
              v-bind="term('glide')"
              :model-value="glideMs"
              :min="0" :max="300" :step="1"
              :label="copy.patch.glide"
              :display="`${Math.round(glideMs)} ms`"
              :default-value="baseVals.glideMs"
              :size="48"
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
              @update:model-value="(v) => setTweak('stereoSpread', v)"
            />
          </div>
          <button
            type="button"
            class="sy-chipbtn sy-reset"
            :disabled="dirtyTweaks.size === 0"
            @click="resetTweaks"
          >
            {{ copy.patch.reset }}
          </button>
        </section>

        <section class="sy-sec sy-sec--output">
          <h3 class="sy-sec__title">{{ copy.sections.output }}</h3>
          <div class="sy-output">
            <RotaryKnob
              v-bind="term('gain')"
              :model-value="outputGain"
              :min="0" :max="1.5" :step="0.01"
              :label="copy.output.gain"
              :display="`${Math.round(outputGain * 100)}%`"
              :default-value="0.9"
              :size="48"
              accent="var(--demo-amber)"
              @update:model-value="(v) => { outputGain = v; applyGain(); }"
            />
            <Tooltip v-bind="term('peak')">
              <div class="sy-vmeter" :aria-label="copy.output.peak" tabindex="0">
                <div class="sy-vmeter__track">
                  <div class="sy-vmeter__fill" :style="{ height: `${meterFillPercent(meter.peak)}%` }"></div>
                  <i
                    v-if="peakHold > 0"
                    class="sy-vmeter__hold"
                    :style="{ bottom: `${meterFillPercent(peakHold)}%` }"
                  ></i>
                </div>
              </div>
            </Tooltip>
          </div>
          <Tooltip v-bind="term('panic')">
            <button type="button" class="sy-chipbtn sy-panic" @click="panic">
              {{ copy.controls.panic }}
            </button>
          </Tooltip>
        </section>
      </div>

      <!-- ===== KEYBED ROW ===== -->
      <div class="sy-deck__keys">
        <div class="sy-cheek">
          <span class="sy-cheek__label">
            {{ copy.controls.octave }}
            <Tooltip v-bind="term('octave')">
              <button type="button" class="sy-sec__info" :aria-label="term('octave').title">
                <span aria-hidden="true">i</span>
              </button>
            </Tooltip>
          </span>
          <div class="sy-cheek__row">
            <button
              type="button"
              class="sy-chipbtn sy-cheek__btn"
              :disabled="baseNote <= MIN_BASE_NOTE"
              :aria-label="copy.controls.octaveDown"
              @click="shiftOctave(-1)"
            >−</button>
            <span class="sy-cheek__value">{{ octaveLabel }}</span>
            <button
              type="button"
              class="sy-chipbtn sy-cheek__btn"
              :disabled="baseNote >= MAX_BASE_NOTE"
              :aria-label="copy.controls.octaveUp"
              @click="shiftOctave(1)"
            >+</button>
          </div>
          <span class="sy-cheek__zx">Z / X</span>
        </div>
        <div class="sy-keybed">
          <SynthKeyboard
            :base-note="baseNote"
            :active="activeNotes"
            @note-on="noteOn"
            @note-off="noteOff"
          />
        </div>
      </div>
      <p class="sy-keyboard-hint">{{ copy.keyboardHint }}</p>

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

<style src="./synth/SynthDemo.css"></style>
