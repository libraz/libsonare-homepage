<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, shallowRef } from 'vue';
import { enCopy, jaCopy } from '@/components/analysis/musicAnalysisCopy';
import {
  chordLabel as buildChordLabel,
  chordStyleRich as buildChordStyleRich,
  markerStyle as buildMarkerStyle,
  sectionStyle as buildSectionStyle,
  sectionStyleRich as buildSectionStyleRich,
  waveformPath as buildWaveformPath,
  confidencePct,
  confidenceTone,
  decimateStereo,
  mergeChordSegments,
  formatSectionName as resolveSectionName,
} from '@/components/analysis/musicAnalysisViewModel';
import MatrixHeatmap from '@/components/MatrixHeatmap.vue';
import ToolShell from '@/components/ToolShell.vue';
import {
  AudioTransport,
  MetricItem,
  ScanLine,
  StatusIndicator,
  TechPanel,
  TermLabel,
} from '@/components/ui';
import { useI18n } from '@/composables/useI18n';
import {
  calculateCorrelation,
  calculatePeakRms,
  type DecodedStereoAudio,
  decodeAudioFile,
  downloadJson,
  downsampleWaveform,
  formatDb,
  formatDuration,
  formatSampleRate,
  mixToMono,
  type WaveformPeak,
} from '@/utils/audio';
import { buildTimeSeriesPath, invertedRangeToPercent } from '@/utils/scale';
import type { MusicAnalysisWorkerResult } from '@/workers/music-analysis.worker';

type WorkerMessage =
  | { type: 'progress'; id: number; progress: number; stage: string }
  | { type: 'done'; id: number; result: MusicAnalysisWorkerResult }
  | { type: 'error'; id: number; error: string; recoverable?: boolean }
  | { type: 'cancelled'; id: number };

type HeatmapKey = 'chroma' | 'mel' | 'cqt';

const { locale, localizedPath, alternateLocalePath, localizedValue } = useI18n();

const copy = computed(() => localizedValue({ en: enCopy, ja: jaCopy }));
const libVersion = ref('');
const localError = ref<string | null>(null);
const warning = ref<string | null>(null);
const decoded = shallowRef<DecodedStereoAudio | null>(null);
const waveform = ref<WaveformPeak[]>([]);
const result = shallowRef<MusicAnalysisWorkerResult | null>(null);
const isLoading = ref(false);
const isAnalyzing = ref(false);
const progress = ref(0);
const progressStage = ref('');
const activeHeatmap = ref<HeatmapKey>('chroma');
const fileInput = ref<HTMLInputElement | null>(null);
const mediaUrl = ref<string | null>(null);
const transport = ref<InstanceType<typeof AudioTransport> | null>(null);
const playFraction = ref(0);

let audioContext: AudioContext | null = null;
let worker: Worker | null = null;
let requestId = 0;
let reportUrl: string | null = null;

const docsPath = computed(() => localizedPath('/docs/glossary/concepts/mir-overview'));
const oppositeLocalePath = computed(() => alternateLocalePath('/music-analysis'));
const glossaryBase = computed(() => localizedPath('/docs/glossary'));

type TermKey = keyof typeof enCopy.terms.items;

const TERM_SLUGS: Record<TermKey, string | undefined> = {
  bpm: 'concepts/mir-overview',
  key: 'concepts/mir-overview',
  keyConfidence: 'concepts/mir-overview',
  time: 'concepts/mir-overview',
  lufs: 'lufs',
  lra: 'concepts/dynamic-range',
  dynamicRange: 'concepts/dynamic-range',
  crest: 'concepts/crest-factor',
  brightness: 'concepts/mir-overview',
  warmth: 'concepts/mir-overview',
  momentary: 'lufs',
  shortTerm: 'lufs',
  peak: 'concepts/audio-basics',
  rms: 'concepts/audio-basics',
  correlation: 'concepts/mono-compatibility',
  truePeak: 'true-peak',
  dcOffset: 'concepts/audio-basics',
  clipping: 'concepts/true-peak-safety',
  stereoWidth: 'concepts/mono-compatibility',
  vectorscope: 'concepts/mono-compatibility',
  pitchRange: 'concepts/mir-overview',
  pitchStability: 'concepts/mir-overview',
  meanPitch: 'concepts/mir-overview',
  vibrato: 'concepts/mir-overview',
  chroma: 'concepts/mir-overview',
  mel: 'concepts/mir-overview',
  cqt: 'concepts/mir-overview',
};

function term(key: TermKey) {
  const item = copy.value.terms.items[key];
  const slug = TERM_SLUGS[key];
  return {
    eyebrow: copy.value.terms.eyebrow,
    title: item.title,
    body: item.body,
    tip: item.tip,
    tipLabel: copy.value.terms.tipLabel,
    href: slug ? `${glossaryBase.value}/${slug}` : undefined,
    linkLabel: copy.value.terms.linkLabel,
  };
}

const statusLabel = computed(() => {
  if (isAnalyzing.value) return copy.value.status.analyzing;
  if (decoded.value) return copy.value.status.ready;
  return copy.value.status.idle;
});

const statusKind = computed<'idle' | 'active' | 'warning' | 'error'>(() => {
  if (localError.value) return 'error';
  if (warning.value) return 'warning';
  if (decoded.value || isAnalyzing.value) return 'active';
  return 'idle';
});

const sourceMetrics = computed(() => {
  if (!decoded.value) return null;
  const levels = calculatePeakRms(decoded.value.left, decoded.value.right);
  return {
    peak: formatDb(levels.peakDb),
    rms: formatDb(levels.rmsDb),
    correlation: calculateCorrelation(decoded.value.left, decoded.value.right).toFixed(2),
  };
});

// Decimated stereo frame budget sent to the worker for the goniometer / stereo
// meters — dense enough for a representative cloud, small enough to transfer.
const METER_STEREO_FRAMES = 8192;

const meteringSummary = computed(() => {
  const m = result.value?.metering;
  if (!m) return null;
  const clipped = m.clipping.clippedSamples;
  return {
    truePeak: `${formatDb(m.truePeakDb)}TP`,
    dcOffset: `${(m.dcOffset * 100).toFixed(3)} %`,
    clipped: clipped > 0,
    clipping:
      clipped > 0
        ? `${clipped.toLocaleString()} · ${(m.clipping.clippingRatio * 100).toFixed(2)}%`
        : copy.value.metering.clean,
    stereoWidth: m.stereo.available ? m.stereo.width.toFixed(2) : '-',
  };
});

// Goniometer cloud: rotate so mono (mid) sits on the vertical axis and the
// stereo difference (side) spreads horizontally — L upper-left, R upper-right.
const vectorscope = computed(() => {
  const stereo = result.value?.metering?.stereo;
  if (!stereo?.available || !stereo.mid.length) return null;
  let maxRadius = 1e-6;
  for (let i = 0; i < stereo.mid.length; i++) {
    const radius = Math.hypot(stereo.mid[i], stereo.side[i]);
    if (radius > maxRadius) maxRadius = radius;
  }
  const scale = 46 / maxRadius;
  const points = stereo.mid.map((mid, index) => ({
    x: 50 - stereo.side[index] * scale,
    y: 50 - mid * scale,
  }));
  return { points, correlation: stereo.correlation };
});

const activeHeatmapData = computed(() => result.value?.heatmaps[activeHeatmap.value] || null);

// Per-frame chord detections repeat the same chord across many short frames,
// which crams unreadable overlapping labels onto the timeline. Merge consecutive
// runs of the same chord into one time-spanning block (its confidence = the run's
// peak) so each label gets the width of the chord it actually represents.
const chordSegments = computed(() => {
  const chords = result.value?.chords ?? [];
  return mergeChordSegments(chords);
});

const LOUDNESS_FLOOR = -40;

const loudnessY = (value: number) => invertedRangeToPercent(value, LOUDNESS_FLOOR, 0);

// LUFS gridline labels for the loudness chart, aligned to the 25% background bands.
const loudnessTicks = [0, -10, -20, -30, -40].map((lufs) => ({ lufs, top: loudnessY(lufs) }));

const loudnessChart = computed(() => {
  const data = result.value?.loudness;
  if (!data) return null;
  const duration = result.value!.duration || 1;
  const integrated = result.value!.summary.integratedLufs;
  return {
    momentary: buildTimeSeriesPath(data.momentary, duration, loudnessY),
    shortTerm: buildTimeSeriesPath(data.shortTerm, duration, loudnessY),
    integrated,
    integratedY: Number.isFinite(integrated) ? loudnessY(integrated) : null,
  };
});

const statusFields = computed(() => {
  const audio = decoded.value;
  return [
    { key: 'SRC', value: audio?.fileName || '-' },
    { key: 'LEN', value: audio ? formatDuration(audio.duration) : '--:--' },
    { key: 'SR', value: audio ? formatSampleRate(audio.sampleRate) : '-' },
    { key: 'CH', value: audio ? String(audio.channels) : '-' },
    { key: 'BPM', value: result.value ? result.value.summary.bpm.toFixed(1) : '-' },
    { key: 'KEY', value: result.value?.summary.keyName || '-' },
    { key: 'LUFS', value: result.value ? result.value.summary.integratedLufs.toFixed(1) : '-' },
  ];
});

const hasPlayback = computed(() => Boolean(mediaUrl.value));

// One transport drives every time-aligned visual: its 0..1 position is exposed as
// a CSS var so the timeline, loudness, waveform, and melody overlays share a playhead.
const playheadStyle = computed(() => ({ '--play': String(playFraction.value) }));

onMounted(() => {
  const ric = (window as any).requestIdleCallback;
  if (ric) ric(initWasmVersion, { timeout: 2000 });
  else setTimeout(initWasmVersion, 100);
});

onUnmounted(() => {
  worker?.terminate();
  if (reportUrl) URL.revokeObjectURL(reportUrl);
  if (mediaUrl.value) URL.revokeObjectURL(mediaUrl.value);
  audioContext?.close();
  audioContext = null;
});

async function initWasmVersion() {
  if (libVersion.value || typeof window === 'undefined') return;
  try {
    const wasm = await import('@/wasm/index.js');
    await wasm.init();
    libVersion.value = wasm.version();
  } catch (error) {
    console.warn('Failed to initialize WASM version:', error);
  }
}

function chooseFile() {
  fileInput.value?.click();
}

async function handleInput(event: Event) {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (file) await handleFile(file);
  target.value = '';
}

async function handleDrop(event: DragEvent) {
  event.preventDefault();
  const file = event.dataTransfer?.files?.[0];
  if (file) await handleFile(file);
}

async function loadDemo() {
  isLoading.value = true;
  localError.value = null;
  try {
    const response = await fetch('/demo.mp3');
    const blob = await response.blob();
    const file = new File([blob], 'demo.mp3', { type: blob.type || 'audio/mpeg' });
    await handleFile(file);
  } catch (error) {
    console.error(error);
    localError.value = copy.value.errors.demoFailed;
  } finally {
    isLoading.value = false;
  }
}

async function handleFile(file: File) {
  isLoading.value = true;
  localError.value = null;
  warning.value = null;
  result.value = null;
  progress.value = 0;
  progressStage.value = copy.value.progress.decoding;

  try {
    const context = getAudioContext();
    const audio = await decodeAudioFile(file, context);
    if (audio.duration > 10 * 60) {
      warning.value = copy.value.warnings.longFile;
    }
    decoded.value = audio;
    if (mediaUrl.value) URL.revokeObjectURL(mediaUrl.value);
    mediaUrl.value = URL.createObjectURL(file);
    playFraction.value = 0;
    waveform.value = downsampleWaveform(audio.left, audio.right, 900);
    await analyzeCurrent();
  } catch (error) {
    console.error(error);
    localError.value = copy.value.errors.loadFailed;
  } finally {
    isLoading.value = false;
  }
}

async function analyzeCurrent() {
  const audio = decoded.value;
  if (!audio) return;

  if (!worker) {
    worker = new Worker(new URL('../workers/music-analysis.worker.ts', import.meta.url), {
      type: 'module',
    });
  }

  const id = ++requestId;
  const mono = mixToMono(audio.left, audio.right);
  const meter = decimateStereo(audio.left, audio.right, METER_STEREO_FRAMES);
  isAnalyzing.value = true;
  localError.value = null;
  progress.value = 0.01;
  progressStage.value = copy.value.progress.queued;

  await new Promise<void>((resolve, reject) => {
    const onMessage = (event: MessageEvent<WorkerMessage>) => {
      const message = event.data;
      if (message.id !== id) return;

      if (message.type === 'progress') {
        progress.value = message.progress;
        progressStage.value = formatStage(message.stage);
        return;
      }

      worker?.removeEventListener('message', onMessage);
      worker?.removeEventListener('error', onError);

      if (message.type === 'done') {
        result.value = message.result;
        libVersion.value = message.result.version || libVersion.value;
        progress.value = 1;
        progressStage.value = copy.value.progress.complete;
        resolve();
      } else if (message.type === 'cancelled') {
        reject(new Error('cancelled'));
      } else {
        reject(new Error(message.error));
      }
    };

    const onError = (event: ErrorEvent) => {
      worker?.removeEventListener('message', onMessage);
      worker?.removeEventListener('error', onError);
      reject(event.error || new Error(event.message));
    };

    worker!.addEventListener('message', onMessage);
    worker!.addEventListener('error', onError);
    worker!.postMessage(
      {
        type: 'analyze',
        id,
        samples: mono,
        sampleRate: audio.sampleRate,
        meterLeft: meter.left,
        meterRight: meter.right,
      },
      [mono.buffer, meter.left.buffer, meter.right.buffer],
    );
  })
    .catch((error) => {
      if (String(error?.message || error) !== 'cancelled') {
        console.error(error);
        localError.value = copy.value.errors.analysisFailed;
        worker?.terminate();
        worker = null;
      }
    })
    .finally(() => {
      isAnalyzing.value = false;
    });
}

function exportReport() {
  if (!decoded.value || !result.value) return;
  if (reportUrl) {
    URL.revokeObjectURL(reportUrl);
    reportUrl = null;
  }
  reportUrl = downloadJson(`${baseName(decoded.value.fileName)}-analysis.json`, {
    source: {
      fileName: decoded.value.fileName,
      duration: decoded.value.duration,
      sampleRate: decoded.value.sampleRate,
      channels: decoded.value.channels,
    },
    result: result.value,
  });
}

function getAudioContext(): AudioContext {
  if (!audioContext) audioContext = new AudioContext();
  return audioContext;
}

function baseName(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, '') || 'audio';
}

function formatStage(stage: string): string {
  return copy.value.stages[stage] || stage;
}

function formatSectionName(name: string): string {
  return resolveSectionName(name, Object.keys(enCopy.sections), (key) => {
    return copy.value.sections[key as keyof typeof enCopy.sections];
  });
}

function sectionStyle(start: number, end: number) {
  return buildSectionStyle(start, end, result.value?.duration || 1);
}

function markerStyle(time: number) {
  return buildMarkerStyle(time, result.value?.duration || 1);
}

// Click anywhere on a time-aligned visual to scrub there: map the click X within
// the element's own box to a 0..1 fraction and hand it to the transport.
function seekFromEvent(event: MouseEvent) {
  const el = event.currentTarget as HTMLElement | null;
  if (!el) return;
  const rect = el.getBoundingClientRect();
  if (rect.width <= 0) return;
  const fraction = (event.clientX - rect.left) / rect.width;
  transport.value?.seekFraction(Math.max(0, Math.min(1, fraction)));
}

// Step size for keyboard scrubbing on time-aligned visuals.
const KEYBOARD_SEEK_SECONDS = 2;

// Nudge the transport by a number of seconds, mapped to the shared 0..1 position.
function seekRelative(deltaSeconds: number) {
  const total = result.value?.duration || 0;
  if (total <= 0) return;
  const next = playFraction.value + deltaSeconds / total;
  transport.value?.seekFraction(Math.max(0, Math.min(1, next)));
}

// Keyboard scrubbing for the time-aligned surfaces: arrows nudge by a fixed
// step, Home/End jump to the edges, and Enter seeks to the start of the clip.
function seekFromKey(event: KeyboardEvent) {
  if (!hasPlayback.value) return;
  switch (event.key) {
    case 'ArrowLeft':
      event.preventDefault();
      seekRelative(-KEYBOARD_SEEK_SECONDS);
      break;
    case 'ArrowRight':
      event.preventDefault();
      seekRelative(KEYBOARD_SEEK_SECONDS);
      break;
    case 'Home':
      event.preventDefault();
      transport.value?.seekFraction(0);
      break;
    case 'End':
      event.preventDefault();
      transport.value?.seekFraction(1);
      break;
    case 'Enter':
    case ' ':
      event.preventDefault();
      transport.value?.seekFraction(0);
      break;
    default:
      break;
  }
}

// Current playback position in whole seconds, for aria-valuenow on seek sliders.
const playSeconds = computed(() => Math.round((result.value?.duration || 0) * playFraction.value));

// Section block: position + width, dimmed by detection confidence, with the
// detected energy exposed as a CSS var so the fill intensity reflects loudness.
function sectionStyleRich(section: {
  start: number;
  end: number;
  confidence: number;
  energyLevel: number;
}) {
  return buildSectionStyleRich(section, result.value?.duration || 1);
}

// Chord label: position + width, faded for low-confidence detections.
function chordStyleRich(chord: { start: number; end: number; confidence: number }) {
  return buildChordStyleRich(chord, result.value?.duration || 1);
}

// Only label chord blocks wide enough to hold the text; narrower blocks stay as
// coloured segments (the name is still in the hover title) so labels never collide.
function chordLabel(chord: { start: number; end: number; name: string }): string {
  return buildChordLabel(chord, result.value?.duration || 1);
}

function waveformPath(): string {
  return buildWaveformPath(waveform.value);
}
</script>

<template>
  <ToolShell
    demo-id="analysis"
    :title="copy.title"
    :subtitle="copy.subtitle"
    :version="libVersion"
    :status="statusKind"
    :status-label="copy.localOnly"
    :docs-path="docsPath"
    :guide-title="copy.help.title"
    :guide-body="copy.help.body"
    :guide-link-label="copy.help.docs"
    :opposite-locale-path="oppositeLocalePath"
  >
    <template #statusbar>
      <div class="analysis-statusbar" role="status" aria-live="polite">
        <StatusIndicator :status="statusKind" :label="statusLabel" :pulse="isAnalyzing" />
        <span v-for="field in statusFields" :key="field.key" class="analysis-statusbar__field">
          <span class="analysis-statusbar__key">{{ field.key }}</span>
          <span class="analysis-statusbar__value">{{ field.value }}</span>
        </span>
      </div>
    </template>

    <div class="analysis-studio" @drop="handleDrop" @dragover.prevent>
      <aside class="analysis-studio__left">
        <TechPanel :title="copy.import.title">
          <div class="analysis-drop" @click="chooseFile">
            <input ref="fileInput" class="analysis-drop__input" type="file" accept="audio/*" @change="handleInput">
            <span class="analysis-drop__icon">MIR</span>
            <strong>{{ decoded?.fileName || copy.import.dropTitle }}</strong>
            <span>{{ copy.import.dropBody }}</span>
            <ScanLine />
          </div>
          <div class="analysis-actions">
            <button class="analysis-button analysis-button--primary" :disabled="isLoading || isAnalyzing" @click="chooseFile">
              {{ copy.import.choose }}
            </button>
            <button class="analysis-button" :disabled="isLoading || isAnalyzing" @click="loadDemo">
              {{ copy.import.demo }}
            </button>
          </div>
        </TechPanel>

        <TechPanel :title="copy.panels.source">
          <div class="analysis-list">
            <MetricItem :value="sourceMetrics?.peak || '-'">
              <template #label><TermLabel v-bind="term('peak')">{{ copy.metrics.peak }}</TermLabel></template>
            </MetricItem>
            <MetricItem :value="sourceMetrics?.rms || '-'">
              <template #label><TermLabel v-bind="term('rms')">{{ copy.metrics.rms }}</TermLabel></template>
            </MetricItem>
            <MetricItem :value="sourceMetrics?.correlation || '-'">
              <template #label><TermLabel v-bind="term('correlation')">{{ copy.metrics.correlation }}</TermLabel></template>
            </MetricItem>
          </div>
          <div v-if="waveform.length" class="waveform-mini">
            <div
              class="waveform-plot"
              :class="{ 'is-seekable': hasPlayback }"
              :style="playheadStyle"
              @click="seekFromEvent"
            >
              <svg viewBox="0 0 100 72" preserveAspectRatio="none" aria-label="Waveform">
                <path :d="waveformPath()" />
              </svg>
              <div v-if="hasPlayback" class="playhead playhead--wave" aria-hidden="true"></div>
            </div>
          </div>
        </TechPanel>

        <TechPanel :title="copy.panels.metering">
          <div v-if="meteringSummary" class="analysis-list">
            <MetricItem :value="meteringSummary.truePeak">
              <template #label><TermLabel v-bind="term('truePeak')">{{ copy.metrics.truePeak }}</TermLabel></template>
            </MetricItem>
            <MetricItem :value="meteringSummary.dcOffset">
              <template #label><TermLabel v-bind="term('dcOffset')">{{ copy.metrics.dcOffset }}</TermLabel></template>
            </MetricItem>
            <MetricItem :value="meteringSummary.clipping" :variant="meteringSummary.clipped ? 'accent' : 'success'">
              <template #label><TermLabel v-bind="term('clipping')">{{ copy.metrics.clipping }}</TermLabel></template>
            </MetricItem>
            <MetricItem :value="meteringSummary.stereoWidth">
              <template #label><TermLabel v-bind="term('stereoWidth')">{{ copy.metrics.stereoWidth }}</TermLabel></template>
            </MetricItem>
          </div>
          <div v-if="vectorscope" class="vectorscope">
            <svg class="vectorscope__svg" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" :aria-label="copy.terms.items.vectorscope.title">
              <g class="vectorscope__grid">
                <circle cx="50" cy="50" r="46" />
                <line x1="50" y1="4" x2="50" y2="96" />
                <line x1="4" y1="50" x2="96" y2="50" />
                <line x1="17" y1="17" x2="83" y2="83" />
                <line x1="83" y1="17" x2="17" y2="83" />
              </g>
              <circle
                v-for="(point, index) in vectorscope.points"
                :key="index"
                class="vectorscope__point"
                :cx="point.x"
                :cy="point.y"
                r="0.55"
              />
            </svg>
            <div class="vectorscope__axes" aria-hidden="true">
              <span class="vectorscope__axis vectorscope__axis--l">L</span>
              <span class="vectorscope__axis vectorscope__axis--m">M</span>
              <span class="vectorscope__axis vectorscope__axis--r">R</span>
            </div>
            <p class="vectorscope__caption">
              <TermLabel v-bind="term('vectorscope')" tone="strong">{{ copy.terms.items.vectorscope.title }}</TermLabel>
            </p>
          </div>
          <div v-else-if="!result" class="analysis-empty analysis-empty--compact">{{ copy.empty.metering }}</div>
        </TechPanel>
      </aside>

      <section class="analysis-studio__center">
        <div v-if="isAnalyzing || isLoading" class="analysis-progress">
          <div class="analysis-progress__top">
            <span>{{ progressStage }}</span>
            <span>{{ Math.round(progress * 100) }}%</span>
          </div>
          <div class="analysis-progress__bar"><span :style="{ width: `${progress * 100}%` }"></span></div>
        </div>

        <div v-if="localError" class="analysis-message analysis-message--error">{{ localError }}</div>
        <div v-else-if="warning" class="analysis-message analysis-message--warning">{{ warning }}</div>

        <TechPanel :title="copy.panels.overview">
          <div v-if="result" class="analysis-metrics">
            <MetricItem layout="column" variant="accent">
              <template #label><TermLabel v-bind="term('bpm')">{{ copy.metrics.bpm }}</TermLabel></template>
              <span class="metric-inline">
                {{ result.summary.bpm.toFixed(1) }}
                <i
                  class="conf-chip"
                  :class="confidenceTone(result.summary.bpmConfidence)"
                  :title="`${copy.metrics.bpmConfidence}: ${confidencePct(result.summary.bpmConfidence)}%`"
                >{{ confidencePct(result.summary.bpmConfidence) }}%</i>
              </span>
            </MetricItem>
            <MetricItem :value="result.summary.keyName" layout="column" variant="accent">
              <template #label><TermLabel v-bind="term('key')">{{ copy.metrics.key }}</TermLabel></template>
            </MetricItem>
            <MetricItem :value="`${Math.round(result.summary.keyConfidence * 100)}%`" layout="column">
              <template #label><TermLabel v-bind="term('keyConfidence')">{{ copy.metrics.keyConfidence }}</TermLabel></template>
            </MetricItem>
            <MetricItem :value="result.summary.timeSignature" layout="column">
              <template #label><TermLabel v-bind="term('time')">{{ copy.metrics.time }}</TermLabel></template>
            </MetricItem>
            <MetricItem :value="result.summary.integratedLufs.toFixed(1)" layout="column" variant="success">
              <template #label><TermLabel v-bind="term('lufs')">{{ copy.metrics.lufs }}</TermLabel></template>
            </MetricItem>
            <MetricItem :value="formatDb(result.summary.loudnessRange)" layout="column">
              <template #label><TermLabel v-bind="term('lra')">{{ copy.metrics.lra }}</TermLabel></template>
            </MetricItem>
            <MetricItem :value="formatDb(result.summary.dynamicRangeDb)" layout="column">
              <template #label><TermLabel v-bind="term('dynamicRange')">{{ copy.metrics.dynamicRange }}</TermLabel></template>
            </MetricItem>
            <MetricItem :value="formatDb(result.summary.crestFactor)" layout="column">
              <template #label><TermLabel v-bind="term('crest')">{{ copy.metrics.crest }}</TermLabel></template>
            </MetricItem>
            <MetricItem :value="result.summary.brightness.toFixed(2)" layout="column">
              <template #label><TermLabel v-bind="term('brightness')">{{ copy.metrics.brightness }}</TermLabel></template>
            </MetricItem>
            <MetricItem :value="result.summary.warmth.toFixed(2)" layout="column">
              <template #label><TermLabel v-bind="term('warmth')">{{ copy.metrics.warmth }}</TermLabel></template>
            </MetricItem>
          </div>
          <div v-else class="analysis-empty">
            <strong>{{ copy.empty.title }}</strong>
            <span>{{ copy.empty.body }}</span>
          </div>
        </TechPanel>

        <TechPanel :title="copy.panels.timeline">
          <div v-if="mediaUrl" class="analysis-transport">
            <AudioTransport
              ref="transport"
              :key="mediaUrl"
              :src="mediaUrl"
              @progress="playFraction = $event"
            />
          </div>
          <div v-if="result" class="analysis-timeline">
            <div
              class="timeline-rows"
              :class="{ 'is-seekable': hasPlayback }"
              :style="playheadStyle"
              :role="hasPlayback ? 'slider' : undefined"
              :tabindex="hasPlayback ? 0 : undefined"
              :aria-label="hasPlayback ? copy.panels.timeline : undefined"
              :aria-valuemin="hasPlayback ? 0 : undefined"
              :aria-valuemax="hasPlayback ? Math.round(result.duration) : undefined"
              :aria-valuenow="hasPlayback ? playSeconds : undefined"
              @click="seekFromEvent"
              @keydown="seekFromKey"
            >
              <div class="timeline-row timeline-row--sections">
                <span
                  v-for="section in result.sections"
                  :key="`${section.name}-${section.start}`"
                  class="timeline-section"
                  :style="sectionStyleRich(section)"
                  :title="`${formatSectionName(section.name)} ${formatDuration(section.start)} - ${formatDuration(section.end)} · ${copy.timeline.confidence} ${confidencePct(section.confidence)}% · ${copy.timeline.energy} ${confidencePct(section.energyLevel)}%`"
                >
                  {{ formatSectionName(section.name) }}
                </span>
              </div>
              <div class="timeline-row timeline-row--chords">
                <span
                  v-for="chord in chordSegments"
                  :key="`${chord.name}-${chord.start}`"
                  class="timeline-chord"
                  :style="chordStyleRich(chord)"
                  :title="`${chord.name} ${formatDuration(chord.start)} – ${formatDuration(chord.end)} · ${copy.timeline.confidence} ${confidencePct(chord.confidence)}%`"
                >
                  {{ chordLabel(chord) }}
                </span>
              </div>
              <div class="timeline-row timeline-row--beats">
                <span v-for="beat in result.beats.slice(0, 260)" :key="beat" class="timeline-beat" :style="markerStyle(beat)"></span>
                <span v-for="beat in result.downbeats.slice(0, 80)" :key="`d-${beat}`" class="timeline-downbeat" :style="markerStyle(beat)"></span>
              </div>
              <div v-if="hasPlayback" class="playhead playhead--timeline" aria-hidden="true"></div>
            </div>
          </div>
          <div v-else class="analysis-empty analysis-empty--compact">{{ copy.empty.timeline }}</div>
        </TechPanel>

        <TechPanel v-if="loudnessChart" :title="copy.panels.loudness">
          <div class="loudness-chart">
            <div class="loudness-scale" aria-hidden="true">
              <span v-for="t in loudnessTicks" :key="t.lufs" class="loudness-scale__tick" :style="{ top: `${t.top}%` }">{{ t.lufs }}</span>
            </div>
            <div
              class="loudness-plot"
              :class="{ 'is-seekable': hasPlayback }"
              :style="playheadStyle"
              @click="seekFromEvent"
            >
              <svg class="loudness-chart__svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-label="Loudness timeline">
                <line
                  v-if="loudnessChart.integratedY !== null"
                  class="loudness-chart__ref"
                  x1="0"
                  :y1="loudnessChart.integratedY"
                  x2="100"
                  :y2="loudnessChart.integratedY"
                />
                <path class="loudness-chart__short" :d="loudnessChart.shortTerm" />
                <path class="loudness-chart__moment" :d="loudnessChart.momentary" />
              </svg>
              <div v-if="hasPlayback" class="playhead playhead--loud" aria-hidden="true"></div>
            </div>
          </div>
          <div class="loudness-legend">
            <span class="loudness-legend__item loudness-legend__item--moment">
              <TermLabel v-bind="term('momentary')">{{ copy.loudness.momentary }}</TermLabel>
            </span>
            <span class="loudness-legend__item loudness-legend__item--short">
              <TermLabel v-bind="term('shortTerm')">{{ copy.loudness.shortTerm }}</TermLabel>
            </span>
            <span class="loudness-legend__item loudness-legend__item--int">
              {{ copy.loudness.integrated }}
              <b>{{ Number.isFinite(loudnessChart.integrated) ? `${loudnessChart.integrated.toFixed(1)} LUFS` : '-' }}</b>
            </span>
          </div>
        </TechPanel>

        <TechPanel :title="copy.panels.spectrum">
          <template #header-right>
            <div class="heatmap-tabs">
              <button
                v-for="key in (['chroma', 'mel', 'cqt'] as HeatmapKey[])"
                :key="key"
                :class="{ 'heatmap-tabs__button--active': activeHeatmap === key }"
                class="heatmap-tabs__button"
                @click="activeHeatmap = key"
              >
                {{ copy.heatmaps[key] }}
              </button>
            </div>
          </template>
          <MatrixHeatmap
            v-if="activeHeatmapData"
            :rows="activeHeatmapData.rows"
            :columns="activeHeatmapData.columns"
            :values="activeHeatmapData.values"
            :min="activeHeatmapData.min"
            :max="activeHeatmapData.max"
            :label="copy.heatmaps[activeHeatmap]"
          />
          <p v-if="activeHeatmapData" class="heatmap-caption">
            <TermLabel v-bind="term(activeHeatmap)" tone="strong">{{ copy.terms.items[activeHeatmap].title }}</TermLabel>
            <span>{{ copy.terms.items[activeHeatmap].body }}</span>
          </p>
          <div v-if="!activeHeatmapData" class="analysis-empty analysis-empty--compact">{{ copy.empty.spectrum }}</div>
        </TechPanel>
      </section>

      <aside class="analysis-studio__right">
        <TechPanel :title="copy.panels.harmony">
          <div v-if="result" class="analysis-table">
            <div
              v-for="candidate in result.keyCandidates"
              :key="candidate.name"
              class="analysis-table__row"
              :title="`${candidate.name} · ${copy.metrics.confidence} ${confidencePct(candidate.confidence)}%`"
            >
              <span class="analysis-table__name">{{ candidate.name }}</span>
              <span class="analysis-table__meter">
                <i :class="confidenceTone(candidate.correlation)" :style="{ width: `${confidencePct(candidate.correlation)}%` }"></i>
              </span>
              <strong>{{ confidencePct(candidate.correlation) }}%</strong>
            </div>
          </div>
          <div v-else class="analysis-empty analysis-empty--compact">{{ copy.empty.harmony }}</div>
        </TechPanel>

        <TechPanel :title="copy.panels.melody">
          <div v-if="result" class="analysis-list">
            <MetricItem :value="`${result.melody.pitchRangeOctaves.toFixed(2)} oct`">
              <template #label><TermLabel v-bind="term('pitchRange')">{{ copy.metrics.pitchRange }}</TermLabel></template>
            </MetricItem>
            <MetricItem :value="`${Math.round(result.melody.pitchStability * 100)}%`">
              <template #label><TermLabel v-bind="term('pitchStability')">{{ copy.metrics.pitchStability }}</TermLabel></template>
            </MetricItem>
            <MetricItem :value="`${result.melody.meanFrequency.toFixed(1)} Hz`">
              <template #label><TermLabel v-bind="term('meanPitch')">{{ copy.metrics.meanPitch }}</TermLabel></template>
            </MetricItem>
            <MetricItem :value="`${result.melody.vibratoRate.toFixed(1)} Hz`">
              <template #label><TermLabel v-bind="term('vibrato')">{{ copy.metrics.vibrato }}</TermLabel></template>
            </MetricItem>
          </div>
          <div
            v-if="result"
            class="melody-cloud"
            :class="{ 'is-seekable': hasPlayback }"
            :style="playheadStyle"
            @click="seekFromEvent"
          >
            <span
              v-for="point in result.melody.points"
              :key="`${point.time}-${point.frequency}`"
              class="melody-cloud__point"
              :style="{
                left: `${(point.time / result.duration) * 100}%`,
                bottom: `${Math.min(100, Math.max(0, (Math.log2(point.frequency / 55) / 6) * 100))}%`,
                opacity: `${Math.max(0.25, point.confidence)}`,
              }"
            ></span>
            <div v-if="hasPlayback" class="playhead playhead--melody" aria-hidden="true"></div>
          </div>
          <div v-if="!result" class="analysis-empty analysis-empty--compact">{{ copy.empty.melody }}</div>
        </TechPanel>

        <TechPanel title="EXPORT">
          <div class="analysis-actions analysis-actions--stack">
            <button class="analysis-button analysis-button--primary" :disabled="!result" @click="exportReport">
              {{ copy.actions.export }}
            </button>
            <button class="analysis-button" :disabled="!decoded || isAnalyzing" @click="analyzeCurrent">
              {{ copy.actions.rerun }}
            </button>
          </div>
        </TechPanel>
      </aside>
    </div>
  </ToolShell>
</template>

<style scoped src="./analysis/musicAnalysisBase.css"></style>
<style scoped src="./analysis/musicAnalysisTimeline.css"></style>
<style scoped src="./analysis/musicAnalysisCharts.css"></style>
<style scoped src="./analysis/musicAnalysisResponsive.css"></style>
