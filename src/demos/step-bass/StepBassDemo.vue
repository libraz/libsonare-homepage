<script setup lang="ts">
/**
 * A sixteen-step monophonic bass machine, played by the engine's own transport.
 *
 * Nothing here schedules a step. The pattern and the knobs compile to one
 * plain-JSON value; the worklet applies it and runs the transport, and this
 * component only sends what changed — a parameter under a sounding note, a
 * lane, a clip — by the route that reaches the engine soonest for that control.
 *
 * The playhead is extrapolated from the meter message rather than asked for
 * each frame, and the one animation loop lives here so a reduced-motion
 * preference has a single place to stop it.
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import ToolShell from '@/components/ToolShell.vue';
import { StatusIndicator, TransportButton } from '@/components/ui';
import { useI18n } from '@/composables/useI18n';
import { useUrlState } from '@/composables/useUrlState';
import { bootWasm, useWasmBoot } from '@/composables/useWasmBoot';
import StepBassHead from '@/demos/step-bass/StepBassHead.vue';
import StepBassPanel from '@/demos/step-bass/StepBassPanel.vue';
import StepBassViews from '@/demos/step-bass/StepBassViews.vue';
import StepGrid from '@/demos/step-bass/StepGrid.vue';
import { compile, LOOP_PPQ } from '@/demos/step-bass/stepBassCompile';
import { SILKSCREEN, STEP_BASS_COPY } from '@/demos/step-bass/stepBassCopy';
import { exportStepBassSmf, exportStepBassWav } from '@/demos/step-bass/stepBassExport';
import {
  accentBrightnessCents,
  DEFAULT_BPM,
  resonanceQ,
  STEP_BASS_DEFAULT_KNOBS,
  STEP_COUNT,
} from '@/demos/step-bass/stepBassPatch';
import {
  encodeKnobsQuery,
  encodePatternQuery,
  FACTORY_PATTERNS,
  parseKnobsQuery,
  parsePatternQuery,
  randomise,
} from '@/demos/step-bass/stepBassPatterns';
import type { Knobs, Pattern, Step } from '@/demos/step-bass/stepBassTypes';
import { useStepBassEngine } from '@/demos/step-bass/useStepBassEngine';
import { downloadBlob } from '@/utils/audio';
import sonareJsUrl from '@/wasm/sonare.js?url';
import sonareWasmUrl from '@/wasm/sonare.wasm?url';
import '@/demos/step-bass/stepBass.css';

/** Rate the first compile assumes; the boot re-applies at the context's own. */
const FALLBACK_SAMPLE_RATE = 48_000;

/** All three displays stand side by side above this width. */
const WIDE_QUERY = '(min-width: 900px)';
/** Sixteen cells across stop being touchable below this, so the grid folds. */
const FOLD_QUERY = '(max-width: 700px)';
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/** Peak meter fall per frame, so a transient stays readable. */
const PEAK_FALL = 0.92;

const { localizedPath, alternateLocalePath, localizedValue } = useI18n();
const copy = computed(() => localizedValue(STEP_BASS_COPY));
const { version: libVersion } = useWasmBoot();

const FACTORY_DEFAULT = FACTORY_PATTERNS[0];

function clonePattern(source: Pattern): Pattern {
  return { root: source.root, steps: source.steps.map((step) => ({ ...step })) };
}

const pattern = ref<Pattern>(clonePattern(FACTORY_DEFAULT.pattern));
const knobs = ref<Knobs>({ ...STEP_BASS_DEFAULT_KNOBS, faderDb: FACTORY_DEFAULT.faderDb });
const bpm = ref(DEFAULT_BPM);
const sampleRate = ref(FALLBACK_SAMPLE_RATE);

const compiled = computed(() => compile(pattern.value, knobs.value, sampleRate.value, bpm.value));

/** Which factory pattern is on the bench, or '' once it has been edited. */
const patternId = computed(() => {
  const current = JSON.stringify(pattern.value);
  return FACTORY_PATTERNS.find((item) => JSON.stringify(item.pattern) === current)?.id ?? '';
});
const patternName = computed(
  () =>
    FACTORY_PATTERNS.find((item) => item.id === patternId.value)?.name ??
    copy.value.transport.custom,
);

// ------------------------------------------------------------------ engine

const engine = useStepBassEngine(sonareJsUrl, sonareWasmUrl);
const supported = ref(true);
const transportOn = ref(false);

const offline = computed(() => !supported.value || !engine.ready.value);

async function boot(): Promise<void> {
  const started = await engine.start(compiled.value);
  if (!started) return;
  const rate = engine.context.value?.sampleRate;
  if (!rate || rate === sampleRate.value) return;
  // The clip's frame mapping is built for one rate, and the context picks its own.
  sampleRate.value = rate;
  engine.apply(compiled.value);
}

watch(
  () => knobs.value.cutoffHz,
  (value) => engine.setParam('cutoffHz', value),
);
watch(
  () => knobs.value.tuningCents,
  (value) => engine.setParam('pitchOffsetCents', value),
);
watch(
  () => knobs.value.envModCents,
  (value) => engine.setParam('envToCutoffCents', value),
);
watch(
  () => knobs.value.resonancePct,
  (value) => {
    const q = resonanceQ(value);
    engine.setParam('resonanceQ', q);
    // Resonance sets how far the plain steps sink under the accented ones.
    engine.setParam('velToCutoffCents', accentBrightnessCents(knobs.value.accent, q));
  },
);
watch(
  () => knobs.value.decayMs,
  () => engine.setLanes(compiled.value.lanes),
);
watch(
  () => knobs.value.accent,
  (value) => {
    const q = resonanceQ(knobs.value.resonancePct);
    engine.setParam('velToCutoffCents', accentBrightnessCents(value, q));
    engine.setClip(compiled.value.clip);
    engine.setLanes(compiled.value.lanes);
  },
);
watch(
  () => knobs.value.faderDb,
  (value) => engine.setFader(value),
);
watch(
  () => knobs.value.waveform,
  () => engine.setWaveform(compiled.value.patch),
);
watch(pattern, () => engine.apply(compiled.value), { deep: true });
watch(bpm, (next, previous) => engine.setTempo(next, compiled.value.clip, phasePpq(previous)));

/** Where in the loop the transport is, measured against the tempo it was at. */
function phasePpq(atBpm: number): number {
  const framesPerPpq = (sampleRate.value * 60) / atBpm;
  const ppq = engine.playheadSamples() / framesPerPpq;
  return ((ppq % LOOP_PPQ) + LOOP_PPQ) % LOOP_PPQ;
}

function onRun(): void {
  transportOn.value = true;
  engine.play();
}

function onStop(): void {
  transportOn.value = false;
  engine.stop();
}

// --------------------------------------------------------------- transport

const playhead = ref(-1);
const peak = ref(0);

function sampleTransport(): void {
  const reading = engine.meter.value;
  const length = compiled.value.clip.lengthSamples;
  if (!reading.playing || length <= 0) {
    playhead.value = -1;
    return;
  }
  const position = engine.playheadSamples() % length;
  playhead.value = Math.min(STEP_COUNT - 1, Math.floor((position / length) * STEP_COUNT));
}

let frame = 0;

function tick(): void {
  frame = requestAnimationFrame(tick);
  sampleTransport();
  peak.value = Math.max(engine.meter.value.peak, peak.value * PEAK_FALL);
}

/** Reduced motion: the meter message drives the readouts, and no loop runs. */
function onMeterMessage(): void {
  sampleTransport();
  peak.value = engine.meter.value.peak;
}

let stopMeterWatch: (() => void) | null = null;

function startAnimation(): void {
  if (frame || stopMeterWatch) return;
  if (reducedMotion.value) stopMeterWatch = watch(engine.meter, onMeterMessage);
  else frame = requestAnimationFrame(tick);
}

function stopAnimation(): void {
  if (frame) cancelAnimationFrame(frame);
  frame = 0;
  stopMeterWatch?.();
  stopMeterWatch = null;
}

// ------------------------------------------------------------- breakpoints

const wide = ref(true);
const folded = ref(false);
const reducedMotion = ref(false);

const cleanups: (() => void)[] = [];

function bindQuery(query: string, apply: (matches: boolean) => void): void {
  const list = window.matchMedia(query);
  const handler = () => apply(list.matches);
  apply(list.matches);
  list.addEventListener('change', handler);
  cleanups.push(() => list.removeEventListener('change', handler));
}

// -------------------------------------------------------------- URL state

const patternParam = computed({
  get: () => encodePatternQuery(pattern.value),
  set: (raw: string) => {
    const parsed = parsePatternQuery(raw);
    if (parsed) pattern.value = parsed;
  },
});

const knobsParam = computed({
  get: () => encodeKnobsQuery(knobs.value),
  set: (raw: string) => {
    const parsed = parseKnobsQuery(raw);
    if (parsed) knobs.value = parsed;
  },
});

const url = useUrlState([
  {
    key: 'p',
    state: patternParam,
    defaultValue: encodePatternQuery(FACTORY_DEFAULT.pattern),
    parse: (raw: string) => (parsePatternQuery(raw) ? raw : null),
  },
  {
    key: 'k',
    state: knobsParam,
    defaultValue: encodeKnobsQuery({
      ...STEP_BASS_DEFAULT_KNOBS,
      faderDb: FACTORY_DEFAULT.faderDb,
    }),
    parse: (raw: string) => (parseKnobsQuery(raw) ? raw : null),
  },
]);

// ------------------------------------------------------------------ edits

function onKnob(key: Exclude<keyof Knobs, 'waveform'>, value: number): void {
  knobs.value = { ...knobs.value, [key]: value };
}

function onStepUpdate(index: number, step: Step): void {
  const steps = pattern.value.steps.map((item, at) => (at === index ? step : item));
  pattern.value = { ...pattern.value, steps };
}

function onPattern(id: string): void {
  const found = FACTORY_PATTERNS.find((item) => item.id === id);
  if (!found) return;
  pattern.value = clonePattern(found.pattern);
  knobs.value = { ...knobs.value, faderDb: found.faderDb };
}

function onPatternSelect(event: Event): void {
  onPattern((event.target as HTMLSelectElement).value);
}

function onRandomise(): void {
  pattern.value = randomise(pattern.value.root, Math.random);
}

// ----------------------------------------------------------------- export

const exporting = ref(false);
const exportFailed = ref(false);

async function onExportWav(): Promise<void> {
  exporting.value = true;
  exportFailed.value = false;
  try {
    const wasm = await bootWasm();
    downloadBlob(exportStepBassWav(wasm, compiled.value), 'step-bass.wav');
  } catch {
    exportFailed.value = true;
  } finally {
    exporting.value = false;
  }
}

function onExportMidi(): void {
  try {
    downloadBlob(exportStepBassSmf(pattern.value), 'step-bass.mid');
  } catch {
    exportFailed.value = true;
  }
}

// ----------------------------------------------------------------- status

const statusKind = computed<'idle' | 'active' | 'warning' | 'error'>(() => {
  if (!supported.value || engine.error.value) return 'error';
  if (!engine.ready.value) return 'idle';
  if (transportOn.value && engine.running.value) return 'active';
  return engine.running.value ? 'idle' : 'warning';
});

const statusText = computed(() => {
  const status = copy.value.status;
  if (!supported.value) return status.unsupported;
  if (engine.error.value) return status.failed;
  if (!engine.ready.value) return status.booting;
  if (!engine.running.value) return status.suspended;
  return transportOn.value ? status.running : status.stopped;
});

const docsPath = computed(() => localizedPath('/docs/native-synth'));
const oppositeLocalePath = computed(() => alternateLocalePath('/step-bass'));

onMounted(() => {
  bindQuery(WIDE_QUERY, (matches) => {
    wide.value = matches;
  });
  bindQuery(FOLD_QUERY, (matches) => {
    folded.value = matches;
  });
  bindQuery(REDUCED_MOTION_QUERY, (matches) => {
    reducedMotion.value = matches;
    stopAnimation();
    startAnimation();
  });

  url.applyFromUrl();
  url.enable();

  supported.value = typeof window.AudioContext === 'function';
  if (supported.value) void boot();
});

onBeforeUnmount(() => {
  stopAnimation();
  url.disable();
  for (const cleanup of cleanups) cleanup();
  cleanups.length = 0;
  void engine.dispose();
});
</script>

<template>
  <ToolShell
    demo-id="step-bass"
    :title="copy.title"
    :subtitle="copy.subtitle"
    :version="libVersion"
    :status="statusKind"
    :status-label="copy.localOnly"
    :docs-path="docsPath"
    :guide-title="copy.guideTitle"
    :guide-body="copy.guideBody"
    :guide-link-label="copy.guideLink"
    :opposite-locale-path="oppositeLocalePath"
  >
    <template #statusbar>
      <StatusIndicator :status="statusKind" :label="statusText" />
    </template>

    <div class="step-bass demo-deck">
      <StepBassHead
        :copy="copy"
        :bpm="bpm"
        :running="transportOn"
        :offline="offline"
        :playhead="playhead"
        :pattern-name="patternName"
        :steps="pattern.steps"
        :exporting="exporting"
        @bpm="bpm = $event"
        @run="onRun"
        @stop="onStop"
        @export-wav="onExportWav"
        @export-midi="onExportMidi"
      />

      <p v-if="!supported || exportFailed" class="step-bass__notice" role="status">
        {{ supported ? copy.transport.exportFailed : copy.status.unsupported }}
      </p>
      <p v-else-if="!engine.running.value && engine.ready.value" class="step-bass__notice">
        {{ copy.transport.gesture }}
      </p>

      <StepBassPanel
        :knobs="knobs"
        :copy="copy"
        @knob="onKnob"
        @waveform="knobs = { ...knobs, waveform: $event }"
      />

      <section class="step-bass__seq" :aria-label="copy.sections.sequencer">
        <div class="step-bass__seq-head">
          <h3 class="step-bass__title">{{ SILKSCREEN.sequencer }}</h3>
          <label class="step-bass__field">
            <span class="step-bass__field-label">{{ copy.transport.patterns }}</span>
            <select
              class="step-bass__select"
              :value="patternId"
              :aria-label="copy.transport.patternsLabel"
              @change="onPatternSelect"
            >
              <option v-if="patternId === ''" value="" disabled>{{ copy.transport.custom }}</option>
              <option v-for="item in FACTORY_PATTERNS" :key="item.id" :value="item.id">
                {{ item.name }}
              </option>
            </select>
          </label>
          <TransportButton size="sm" @click="onRandomise">
            <span :aria-label="copy.transport.randomiseLabel">{{ copy.transport.randomise }}</span>
          </TransportButton>
        </div>

        <StepGrid
          :steps="pattern.steps"
          :copy="copy"
          :playhead="playhead"
          :folded="folded"
          @update="onStepUpdate"
        />
      </section>

      <StepBassViews
        :copy="copy"
        :analyser="engine.analyser.value"
        :cutoff-hz="compiled.knobs.cutoffHz"
        :resonance-q="compiled.knobs.resonanceQ"
        :env-mod-cents="compiled.knobs.envToCutoffCents"
        :peak="peak"
        :sample-rate="sampleRate"
        :wide="wide"
      />
    </div>
  </ToolShell>
</template>
