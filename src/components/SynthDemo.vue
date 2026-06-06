<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue';
import ScopeDisplay from '@/components/synth/ScopeDisplay.vue';
import SynthKeyboard from '@/components/synth/SynthKeyboard.vue';
import { DEFAULT_PRESET, enCopy, jaCopy, KEY_LAYOUT } from '@/components/synth/synthCopy';
import ToolShell from '@/components/ToolShell.vue';
import { RotaryKnob, StatusIndicator } from '@/components/ui';
import { useI18n } from '@/composables/useI18n';
import { useSynthEngine } from '@/composables/useSynthEngine';
import { decayPeakHold, meterFillPercent } from '@/utils/scale';
import type { SynthPatch, WebMidiBinding, WebMidiInputInfo } from '@/wasm/index';
import sonareJsUrl from '@/wasm/sonare.js?url';
import sonareWasmUrl from '@/wasm/sonare.wasm?url';

type WasmModule = typeof import('@/wasm/index.js');

const { locale } = useI18n();
const copy = computed(() => (locale.value === 'ja' ? jaCopy : enCopy));
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

// Log-scaled knob ranges for the time/frequency parameters.
const CUTOFF_MIN_HZ = 80;
const CUTOFF_MAX_HZ = 16000;
const ATTACK_MIN_MS = 1;
const ATTACK_MAX_MS = 2000;
const RELEASE_MIN_MS = 10;
const RELEASE_MAX_MS = 5000;

const wasmModule = shallowRef<WasmModule | null>(null);

/** Patch keys the user has touched; only these are sent as preset overrides. */
type TweakKey =
  | 'waveform'
  | 'filterModel'
  | 'cutoffHz'
  | 'resonanceQ'
  | 'ampAttackMs'
  | 'ampReleaseMs'
  | 'glideMs'
  | 'stereoSpread';
const dirtyTweaks = ref<Set<TweakKey>>(new Set());
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
const midiInputs = ref<WebMidiInputInfo[]>([]);

const isReady = engine.ready;
const isStarting = engine.starting;
const isRunning = engine.running;
const meter = engine.meter;

watch(meter, (value) => {
  peakHold.value = decayPeakHold(peakHold.value, value.peak);
});

/** PC keyboard character → semitone offset above the range's base C. */
const pcKeyToSemitone = new Map<string, number>(
  KEY_LAYOUT.filter((k) => k.pc !== undefined).map((k) => [k.pc as string, k.semitone]),
);
/** Notes currently held from the PC keyboard, frozen at press-time pitch. */
const heldPcNotes = new Map<string, number>();

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

function logKnobHz(norm: number, min: number, max: number): number {
  return Math.round(min * (max / min) ** norm);
}

function hzToNorm(hz: number, min: number, max: number): number {
  return clamp(Math.log(hz / min) / Math.log(max / min), 0, 1);
}

const cutoffHz = computed(() => logKnobHz(cutoffNorm.value, CUTOFF_MIN_HZ, CUTOFF_MAX_HZ));
const cutoffLabel = computed(() =>
  cutoffHz.value >= 1000 ? `${(cutoffHz.value / 1000).toFixed(1)} kHz` : `${cutoffHz.value} Hz`,
);
const attackMs = computed(() => logKnobHz(attackNorm.value, ATTACK_MIN_MS, ATTACK_MAX_MS));
const releaseMs = computed(() => logKnobHz(releaseNorm.value, RELEASE_MIN_MS, RELEASE_MAX_MS));

function msLabel(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)} s` : `${Math.round(ms)} ms`;
}

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

const docsPath = computed(() =>
  locale.value === 'ja' ? '/ja/docs/native-synth' : '/docs/native-synth',
);
const midiDocsPath = computed(() =>
  locale.value === 'ja' ? '/ja/docs/midi-input' : '/docs/midi-input',
);
const oppositeLocalePath = computed(() => (locale.value === 'ja' ? '/synth' : '/ja/synth'));

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
    const wasm = await import('@/wasm/index.js');
    await wasm.init();
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

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Seed the tweak controls from the preset's resolved base patch. */
function loadPresetBase(preset: string) {
  const wasm = wasmModule.value;
  if (!wasm) return;
  try {
    const base = wasm.synthPresetPatch(preset);
    waveform.value = String(base.waveform ?? 'default');
    filterModel.value = String(base.filterModel ?? 'default');
    cutoffNorm.value = hzToNorm(base.cutoffHz ?? CUTOFF_MAX_HZ, CUTOFF_MIN_HZ, CUTOFF_MAX_HZ);
    resonanceQ.value = clamp(base.resonanceQ ?? 0.7, 0.5, 12);
    attackNorm.value = hzToNorm(
      clamp(base.ampAttackMs ?? 1, ATTACK_MIN_MS, ATTACK_MAX_MS),
      ATTACK_MIN_MS,
      ATTACK_MAX_MS,
    );
    releaseNorm.value = hzToNorm(
      clamp(base.ampReleaseMs ?? 300, RELEASE_MIN_MS, RELEASE_MAX_MS),
      RELEASE_MIN_MS,
      RELEASE_MAX_MS,
    );
    glideMs.value = clamp(base.glideMs ?? 0, 0, 300);
    stereoSpread.value = clamp(base.stereoSpread ?? 0, 0, 1);
    baseVals.value = {
      cutoffNorm: cutoffNorm.value,
      resonanceQ: resonanceQ.value,
      attackNorm: attackNorm.value,
      releaseNorm: releaseNorm.value,
      glideMs: glideMs.value,
      stereoSpread: stereoSpread.value,
    };
  } catch (error) {
    console.warn(`Failed to load base patch for ${preset}:`, error);
  }
}

/** Send the preset plus only the user-touched overrides to the audio thread. */
function sendPatch() {
  if (dirtyTweaks.value.size === 0) {
    engine.setPatch(selectedPreset.value);
    return;
  }
  const patch: SynthPatch = { preset: selectedPreset.value };
  for (const key of dirtyTweaks.value) {
    if (key === 'waveform') patch.waveform = waveform.value as SynthPatch['waveform'];
    else if (key === 'filterModel')
      patch.filterModel = filterModel.value as SynthPatch['filterModel'];
    else if (key === 'cutoffHz') patch.cutoffHz = cutoffHz.value;
    else if (key === 'resonanceQ') patch.resonanceQ = resonanceQ.value;
    else if (key === 'ampAttackMs') patch.ampAttackMs = attackMs.value;
    else if (key === 'ampReleaseMs') patch.ampReleaseMs = releaseMs.value;
    else if (key === 'glideMs') patch.glideMs = glideMs.value;
    else if (key === 'stereoSpread') patch.stereoSpread = stereoSpread.value;
  }
  engine.setPatch(patch);
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

function tweak(key: TweakKey) {
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

/** Release every sounding note (octave shifts, panic, window blur). */
function releaseAll() {
  for (const note of activeNotes.value) engine.noteOff(note);
  activeNotes.value = new Set();
  heldPcNotes.clear();
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

function isTypingTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName);
}

function onKeyDown(event: KeyboardEvent) {
  if (!isReady.value || event.repeat || event.metaKey || event.ctrlKey || event.altKey) return;
  if (isTypingTarget(event.target)) return;
  const key = event.key.toLowerCase();
  if (key === 'z') {
    shiftOctave(-1);
    event.preventDefault();
    return;
  }
  if (key === 'x') {
    shiftOctave(1);
    event.preventDefault();
    return;
  }
  const semitone = pcKeyToSemitone.get(key);
  if (semitone === undefined || heldPcNotes.has(key)) return;
  const note = baseNote.value + semitone;
  heldPcNotes.set(key, note);
  noteOn(note);
  event.preventDefault();
}

function onKeyUp(event: KeyboardEvent) {
  const key = event.key.toLowerCase();
  const note = heldPcNotes.get(key);
  if (note === undefined) return;
  heldPcNotes.delete(key);
  noteOff(note);
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
      <div class="sy-statusbar">
        <StatusIndicator :status="statusKind" :label="statusLabel" :pulse="isStarting" />
        <span class="sy-statusbar__field"><b>{{ copy.output.peak }}</b>{{ peakDb }}</span>
        <span class="sy-statusbar__field"><b>{{ copy.output.engine }}</b>{{ sampleRateLabel }}</span>
        <span v-if="engine.error.value" class="sy-error">{{ copy.errors.start }}</span>
      </div>
    </template>

    <div class="sy-deck">
      <!-- ===== DISPLAY ROW ===== -->
      <div class="sy-deck__display">
        <div class="sy-brand">
          <span class="sy-brand__name">LIBSONARE</span>
          <span class="sy-brand__model">{{ copy.deck.model }}</span>
          <span class="sy-brand__tag">{{ copy.deck.tagline }}</span>
          <span class="sy-brand__power">
            <i class="sy-led" :class="{ 'sy-led--on': isRunning }"></i>
            {{ copy.deck.power }}
          </span>
        </div>
        <ScopeDisplay :analyser="engine.analyser.value" class="sy-scope">
          <span class="sy-scope__osd sy-scope__osd--preset">{{ selectedPreset }}</span>
          <span class="sy-scope__osd sy-scope__osd--peak">{{ peakDb }}</span>
        </ScopeDisplay>
      </div>

      <!-- ===== CONTROL SECTIONS ===== -->
      <div class="sy-deck__controls">
        <section class="sy-sec sy-sec--program">
          <h3 class="sy-sec__title">{{ copy.sections.program }}</h3>
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
          <h3 class="sy-sec__title">{{ copy.sections.osc }}</h3>
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
          <h3 class="sy-sec__title">{{ copy.sections.filter }}</h3>
          <div class="sy-knob-row">
            <RotaryKnob
              :model-value="cutoffNorm"
              :min="0" :max="1" :step="0.005"
              :label="copy.patch.cutoff"
              :display="cutoffLabel"
              :default-value="baseVals.cutoffNorm"
              :size="48"
              @update:model-value="(v) => setTweak('cutoffHz', v)"
            />
            <RotaryKnob
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
              :model-value="glideMs"
              :min="0" :max="300" :step="1"
              :label="copy.patch.glide"
              :display="`${Math.round(glideMs)} ms`"
              :default-value="baseVals.glideMs"
              :size="48"
              @update:model-value="(v) => setTweak('glideMs', v)"
            />
            <RotaryKnob
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
              :model-value="outputGain"
              :min="0" :max="1.5" :step="0.01"
              :label="copy.output.gain"
              :display="`${Math.round(outputGain * 100)}%`"
              :default-value="0.9"
              :size="48"
              accent="var(--demo-amber)"
              @update:model-value="(v) => { outputGain = v; applyGain(); }"
            />
            <div class="sy-vmeter" :aria-label="copy.output.peak">
              <div class="sy-vmeter__track">
                <div class="sy-vmeter__fill" :style="{ height: `${meterFillPercent(meter.peak)}%` }"></div>
                <i
                  v-if="peakHold > 0"
                  class="sy-vmeter__hold"
                  :style="{ bottom: `${meterFillPercent(peakHold)}%` }"
                ></i>
              </div>
            </div>
          </div>
          <button type="button" class="sy-chipbtn sy-panic" @click="panic">
            {{ copy.controls.panic }}
          </button>
        </section>
      </div>

      <!-- ===== KEYBED ROW ===== -->
      <div class="sy-deck__keys">
        <div class="sy-cheek">
          <span class="sy-cheek__label">{{ copy.controls.octave }}</span>
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
      <div class="sy-deck__midi">
        <span class="sy-midi__title">
          <i class="sy-led" :class="{ 'sy-led--on': midiBinding && midiInputs.length > 0 }"></i>
          {{ copy.sections.midi }}
        </span>
        <p v-if="midiSupported === false" class="sy-midi__note">{{ copy.midi.unavailable }}</p>
        <template v-else>
          <button
            v-if="!midiBinding"
            type="button"
            class="sy-chipbtn"
            :disabled="midiConnecting || !wasmModule"
            @click="connectMidi"
          >
            {{ midiConnecting ? copy.midi.connecting : copy.midi.connect }}
          </button>
          <p v-if="midiError" class="sy-error">{{ copy.midi.error }}</p>
          <template v-if="midiBinding">
            <p v-if="midiInputs.length === 0" class="sy-midi__note">{{ copy.midi.none }}</p>
            <span
              v-for="input in midiInputs"
              :key="input.id"
              class="sy-midi__device"
            >
              <i class="sy-led" :class="{ 'sy-led--on': input.state === 'connected' }"></i>
              {{ input.name || input.id }}
            </span>
          </template>
        </template>
        <a :href="midiDocsPath" class="sy-midi__docs">{{ copy.midi.docs }}</a>
      </div>
    </div>
  </ToolShell>
</template>

<style scoped>
.sy-statusbar {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: 18px;
  padding: 8px 18px;
  border-bottom: 1px solid var(--demo-border);
  background: var(--demo-bg-overlay);
  backdrop-filter: blur(16px);
}

.sy-statusbar__field {
  display: inline-flex;
  align-items: baseline;
  gap: 6px;
  color: var(--demo-text-muted);
  font-family: 'JetBrains Mono', monospace;
  font-size: 10.5px;
  font-variant-numeric: tabular-nums;
}

.sy-statusbar__field b {
  color: var(--demo-text-faint);
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.1em;
}

.sy-error {
  margin: 0;
  color: var(--demo-danger);
  font-size: 12px;
}

/* ===== THE INSTRUMENT BODY ===== */
.sy-deck {
  max-width: 1120px;
  margin: 0 auto;
  border: 1px solid var(--demo-border-strong);
  border-radius: 14px;
  background:
    linear-gradient(180deg, var(--demo-bg-header) 0%, var(--demo-bg-elevated) 22%, var(--demo-bg-elevated) 100%);
  box-shadow:
    0 24px 48px -24px rgba(0, 0, 0, 0.5),
    inset 0 1px 0 rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(10px);
  overflow: hidden;
}

html:not(.dark) .sy-deck {
  box-shadow:
    0 20px 40px -24px rgba(80, 60, 140, 0.35),
    inset 0 1px 0 rgba(255, 255, 255, 0.7);
}

/* ===== DISPLAY ROW ===== */
.sy-deck__display {
  display: flex;
  gap: 14px;
  align-items: stretch;
  padding: 10px 16px 8px;
}

.sy-brand {
  display: grid;
  align-content: center;
  gap: 2px;
  min-width: 140px;
}

.sy-brand__name {
  color: var(--demo-text-strong);
  font-family: 'Space Grotesk', sans-serif;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.18em;
  line-height: 1.2;
}

.sy-brand__model {
  color: var(--demo-accent-light);
  font-family: 'JetBrains Mono', monospace;
  font-size: 22px;
  font-weight: 800;
  letter-spacing: 0.06em;
  line-height: 1.1;
}

.sy-brand__tag {
  color: var(--demo-text-faint);
  font-family: 'JetBrains Mono', monospace;
  font-size: 8px;
  font-weight: 700;
  letter-spacing: 0.16em;
  line-height: 1.3;
}

.sy-brand__power {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 3px;
  color: var(--demo-text-faint);
  font-size: 9px;
  line-height: 1.2;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.sy-led {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--demo-text-faint);
  opacity: 0.5;
  flex: 0 0 auto;
}

.sy-led--on {
  background: var(--demo-success);
  opacity: 1;
  box-shadow: 0 0 6px var(--demo-success);
}

.sy-scope {
  flex: 1;
  height: 64px;
  align-self: center;
}

.sy-scope__osd {
  position: absolute;
  top: 8px;
  color: var(--demo-text-muted);
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  pointer-events: none;
}

.sy-scope__osd--preset {
  left: 12px;
  color: var(--demo-accent-light);
}

.sy-scope__osd--peak {
  right: 12px;
  font-variant-numeric: tabular-nums;
}

/* ===== CONTROL SECTIONS ===== */
.sy-deck__controls {
  display: flex;
  flex-wrap: wrap;
  align-items: stretch;
  border-top: 1px solid var(--demo-border);
}

.sy-sec {
  display: flex;
  flex-direction: column;
  gap: 9px;
  padding: 10px 12px 12px;
  border-left: 1px solid var(--demo-border);
}

.sy-sec:first-child {
  border-left: none;
}

.sy-sec--program {
  flex: 1 1 250px;
}

.sy-sec__title {
  margin: 0;
  color: var(--demo-text-faint);
  font-family: 'JetBrains Mono', monospace;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.18em;
  line-height: 1.2;
  text-transform: uppercase;
}

.sy-knob-row {
  display: flex;
  gap: 10px;
  justify-content: center;
}

/* Program memory grid */
.sy-programs {
  display: grid;
  grid-template-columns: repeat(4, minmax(52px, 1fr));
  gap: 4px;
  align-content: start;
}

.sy-program {
  display: flex;
  align-items: baseline;
  gap: 5px;
  min-width: 0;
  padding: 4px 7px;
  line-height: 1.2;
  border: 1px solid var(--demo-border);
  border-radius: 6px;
  background: var(--demo-control-bg);
  cursor: pointer;
  text-align: left;
  transition: border-color 0.12s ease, background 0.12s ease;
}

.sy-program:hover {
  border-color: var(--demo-accent-border);
  background: var(--demo-accent-subtle);
}

.sy-program--active {
  border-color: var(--demo-accent);
  background: var(--demo-accent-subtle);
  box-shadow: inset 0 0 10px var(--demo-accent-subtle), 0 0 8px var(--demo-accent-dim);
}

.sy-program__no {
  flex: 0 0 auto;
  color: var(--demo-text-faint);
  font-family: 'JetBrains Mono', monospace;
  font-size: 8px;
  font-weight: 700;
  letter-spacing: 0.08em;
  line-height: 1.2;
}

.sy-program--active .sy-program__no {
  color: var(--demo-accent-light);
}

.sy-program__name {
  min-width: 0;
  overflow: hidden;
  color: var(--demo-text);
  font-family: 'JetBrains Mono', monospace;
  font-size: 9.5px;
  font-weight: 600;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sy-program--active .sy-program__name {
  color: var(--demo-text-strong);
}

/* Oscillator waveform buttons */
.sy-waves {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 5px;
}

.sy-wave {
  display: grid;
  gap: 2px;
  justify-items: center;
  padding: 5px 5px 4px;
  border: 1px solid var(--demo-border);
  border-radius: 6px;
  background: var(--demo-control-bg);
  cursor: pointer;
  transition: border-color 0.12s ease, background 0.12s ease;
}

.sy-wave:hover {
  border-color: var(--demo-accent-border);
}

.sy-wave--active {
  border-color: var(--demo-accent);
  background: var(--demo-accent-subtle);
  box-shadow: 0 0 8px var(--demo-accent-dim);
}

.sy-wave svg {
  width: 26px;
  height: 12px;
  fill: none;
  stroke: var(--demo-text-muted);
  stroke-width: 1.6;
  stroke-linejoin: round;
}

.sy-wave--active svg {
  stroke: var(--demo-accent-light);
  filter: drop-shadow(0 0 3px var(--demo-accent-dim));
}

.sy-wave__auto {
  display: inline-flex;
  align-items: center;
  height: 12px;
  color: var(--demo-text-muted);
  font-family: 'JetBrains Mono', monospace;
  font-size: 8px;
  font-weight: 800;
  letter-spacing: 0.12em;
}

.sy-wave--active .sy-wave__auto {
  color: var(--demo-accent-light);
}

.sy-wave__label {
  color: var(--demo-text-faint);
  font-family: 'JetBrains Mono', monospace;
  font-size: 7.5px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

/* Filter model chips */
.sy-filter-models {
  display: grid;
  grid-template-columns: repeat(3, auto);
  gap: 3px;
  justify-content: center;
}

.sy-chipbtn {
  padding: 4px 8px;
  border: 1px solid var(--demo-border);
  border-radius: 5px;
  background: var(--demo-control-bg);
  color: var(--demo-text-muted);
  font-family: 'JetBrains Mono', monospace;
  font-size: 8.5px;
  line-height: 1.3;
  font-weight: 700;
  letter-spacing: 0.08em;
  cursor: pointer;
  transition: all 0.12s ease;
}

.sy-chipbtn:hover:not(:disabled) {
  border-color: var(--demo-accent-border);
  color: var(--demo-text);
}

.sy-chipbtn:disabled {
  opacity: 0.4;
  cursor: default;
}

.sy-chipbtn--active {
  border-color: var(--demo-accent);
  background: var(--demo-accent-subtle);
  color: var(--demo-accent-light);
  box-shadow: 0 0 8px var(--demo-accent-dim);
}

/* Envelope shape readout */
.sy-env {
  width: 116px;
  height: 34px;
  margin: 0 auto;
  border: 1px solid var(--demo-border);
  border-radius: 5px;
  background: var(--demo-control-bg);
}

.sy-env__curve {
  fill: none;
  stroke: var(--demo-cyan);
  stroke-width: 1.6;
  stroke-linecap: round;
  filter: drop-shadow(0 0 3px var(--demo-cyan));
  transition: d 0.08s ease;
}

.sy-reset {
  margin: auto auto 0;
}

/* Output: gain knob + LED meter */
.sy-output {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: center;
}

.sy-vmeter__track {
  position: relative;
  width: 12px;
  height: 64px;
  border-radius: 3px;
  background: var(--demo-track-bg);
  overflow: hidden;
}

.sy-vmeter__fill {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: linear-gradient(0deg, var(--demo-success) 0%, var(--demo-success) 60%, var(--demo-amber) 82%, #ef4444 96%);
  /* LED segments */
  -webkit-mask-image: repeating-linear-gradient(0deg, #000 0 4px, transparent 4px 6px);
  mask-image: repeating-linear-gradient(0deg, #000 0 4px, transparent 4px 6px);
  transition: height 0.05s linear;
}

.sy-vmeter__hold {
  position: absolute;
  left: 0;
  right: 0;
  height: 2px;
  background: var(--demo-amber);
}

.sy-panic {
  margin: 0 auto;
  border-color: var(--demo-warn-border);
  color: var(--demo-warn-text);
}

.sy-panic:hover:not(:disabled) {
  border-color: var(--demo-warn);
  color: var(--demo-warn);
}

/* ===== KEYBED ROW ===== */
.sy-deck__keys {
  display: flex;
  gap: 12px;
  align-items: stretch;
  padding: 8px 16px 4px;
  border-top: 1px solid var(--demo-border);
}

.sy-cheek {
  display: grid;
  align-content: center;
  gap: 6px;
  justify-items: center;
  min-width: 104px;
  padding: 8px;
  border: 1px solid var(--demo-border);
  border-radius: 8px;
  background: var(--demo-control-bg);
}

.sy-cheek__label {
  color: var(--demo-text-faint);
  font-family: 'JetBrains Mono', monospace;
  font-size: 8.5px;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.sy-cheek__row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.sy-cheek__btn {
  width: 26px;
  padding: 5px 0;
  text-align: center;
  font-size: 12px;
  line-height: 1;
}

.sy-cheek__value {
  min-width: 34px;
  color: var(--demo-accent-light);
  font-family: 'JetBrains Mono', monospace;
  font-size: 15px;
  font-weight: 800;
  text-align: center;
}

.sy-cheek__zx {
  color: var(--demo-text-faint);
  font-family: 'JetBrains Mono', monospace;
  font-size: 8px;
  font-weight: 700;
  letter-spacing: 0.12em;
}

.sy-keybed {
  flex: 1;
  min-width: 0;
}

.sy-keyboard-hint {
  margin: 0;
  padding: 4px 16px 6px;
  color: var(--demo-text-faint);
  font-size: 10.5px;
  line-height: 1.45;
}

/* ===== MIDI ROW ===== */
.sy-deck__midi {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  padding: 7px 16px;
  border-top: 1px solid var(--demo-border);
  background: var(--demo-bg-header);
}

.sy-midi__title {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  color: var(--demo-text-muted);
  font-family: 'JetBrains Mono', monospace;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.sy-midi__note {
  margin: 0;
  color: var(--demo-text-faint);
  font-size: 11px;
  line-height: 1.5;
}

.sy-midi__device {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 4px 10px;
  border: 1px solid var(--demo-border);
  border-radius: 5px;
  background: var(--demo-control-bg);
  color: var(--demo-text);
  font-size: 11px;
}

.sy-midi__docs {
  margin-left: auto;
  color: var(--demo-accent-light);
  font-family: 'JetBrains Mono', monospace;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-decoration: none;
  text-transform: uppercase;
}

.sy-midi__docs:hover {
  color: var(--demo-accent);
}

/* ===== RESPONSIVE ===== */
@media (max-width: 1060px) {
  .sy-sec {
    flex: 1 1 200px;
    border-top: 1px solid var(--demo-border);
    margin-top: -1px;
  }
}

@media (max-width: 720px) {
  .sy-deck__display {
    flex-direction: column;
  }

  .sy-brand {
    grid-template-columns: auto auto 1fr;
    align-items: baseline;
    column-gap: 10px;
  }

  .sy-brand__power {
    grid-column: 1 / -1;
    margin-top: 2px;
  }

  .sy-deck__keys {
    flex-direction: column;
  }

  .sy-cheek {
    grid-template-columns: auto auto auto;
    justify-content: start;
    align-items: center;
  }

  .sy-midi__docs {
    margin-left: 0;
  }
}
</style>
