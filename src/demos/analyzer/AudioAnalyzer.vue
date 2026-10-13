<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import type { ToolStatusField } from '@/components/ToolStatusBar.vue';
import {
  DemoNotice,
  MetricItem,
  SignalLoader,
  TechPanel,
  TermLabel,
  Tooltip,
  TransportButton,
} from '@/components/ui';
import { useI18n } from '@/composables/useI18n';
import {
  ANALYZER_TERM_SLUGS,
  type AnalyzerTermKey,
  enCopy as analyzerEnCopy,
  jaCopy as analyzerJaCopy,
} from '@/demos/analyzer/analyzerCopy';
import {
  calculateNormalizationGain,
  splitMelBands,
} from '@/demos/analyzer/audioAnalyzerProcessing';
import { useAudioPlayer } from '@/demos/analyzer/useAudioPlayer';
import { useStreamAnalyzer } from '@/demos/analyzer/useStreamAnalyzer';
import DataConsole from './DataConsole.vue';
import DropZone from './DropZone.vue';
import SynesthesiaVisualizer from './SynesthesiaVisualizer.vue';
import WaveformVisualizer from './WaveformVisualizer.vue';

defineProps<{
  libVersion?: string;
}>();

/** What the page's status bar shows; the shell owning that slot renders it. */
export interface AnalyzerStatus {
  status: 'idle' | 'active' | 'warning' | 'error';
  label: string;
  pulse: boolean;
  fields: ToolStatusField[];
}

const emit = defineEmits<{ status: [status: AnalyzerStatus] }>();

const { t, localizedPath, localizedValue } = useI18n();

const copy = computed(() => localizedValue({ en: analyzerEnCopy, ja: analyzerJaCopy }));
const glossaryBase = computed(() => localizedPath('/docs/glossary'));

type WasmModule = typeof import('@/wasm/index.js');
type StageKey = keyof typeof analyzerEnCopy.stages;

/** Build rich-tooltip props for a metric from the copy + slug tables. */
function term(key: AnalyzerTermKey) {
  const c = copy.value;
  const item = c.items[key];
  const slug = ANALYZER_TERM_SLUGS[key];
  return {
    eyebrow: c.eyebrow,
    title: item.title,
    body: item.body,
    tip: item.tip,
    tipLabel: c.tipLabel,
    href: slug ? `${glossaryBase.value}/${slug}` : undefined,
    linkLabel: c.linkLabel,
  };
}
const isLoadingDemo = ref(false);
const hasVisualization = ref(false);
const analysisError = ref<string | null>(null);

const {
  audioBuffer,
  isPlaying,
  isPaused,
  currentTime,
  duration,
  decodeAudio,
  decodeAudioFromArrayBuffer,
  setAudioBuffer,
  resetAudio,
  play,
  pause,
  resume,
  stop,
  seek,
  formatTime,
  setProcessCallback,
  getAudioContext,
} = useAudioPlayer();

const {
  isInitialized: isStreamInitialized,
  estimate: streamEstimate,
  init: initStreamAnalyzer,
  reinit: reinitStreamAnalyzer,
  process: processAudioChunk,
  setExpectedDuration,
  setNormalizationGain,
  setTuningRefHz,
  reset: resetStreamAnalyzer,
} = useStreamAnalyzer({
  sampleRate: 44100, // Will be updated when audio is loaded
  nFft: 2048,
  hopLength: 512, // Changed from 1024 for better time resolution
  nMels: 128,
  computeMel: true,
  computeChroma: true,
  computeOnset: true,
});

const fileName = ref('');
const beats = ref<Float32Array | null>(null);
const rmsData = ref<Float32Array | null>(null);
const chromaData = ref<{ features: Float32Array; nFrames: number; nChroma: number } | null>(null);
const bandData = ref<{ low: Float32Array; high: Float32Array } | null>(null);
const sampleRate = ref(44100);
/** How far the loaded recording sits from A4 = 440 Hz, once estimated. */
const tuningCents = ref<number | null>(null);

const isLoadingFile = ref(false);
const fileProgress = ref(0);
const fileProgressStage = ref<StageKey>('decoding');

// Every load (the bundled demo or a dropped file) runs under the generation it
// captured at its start. A newer load or the unmount bumps the counter, and each
// continuation re-checks it, so a superseded load never writes over the current one.
let loadGeneration = 0;

/** Drop the loaded audio and every derived view of it. */
function clearLoaded() {
  resetAudio();
  resetStreamAnalyzer();
  setProcessCallback(null);
  hasVisualization.value = false;
  rmsData.value = null;
  chromaData.value = null;
  bandData.value = null;
  beats.value = null;
  tuningCents.value = null;
}

/** Point the live key and chord readings at the reference pitch the recording sits at. */
function applyTuning(wasm: WasmModule, offsetSemitones: number) {
  const offset = Number.isFinite(offsetSemitones) ? offsetSemitones : 0;
  setTuningRefHz(wasm.tuningToReferenceHz(offset));
  tuningCents.value = Math.round(offset * 100);
}

/** One channel to analyze, folded by the engine's ITU-R BS.775 downmix. */
function monoSamples(wasm: WasmModule, buffer: AudioBuffer): Float32Array {
  const channels = Array.from({ length: buffer.numberOfChannels }, (_, channel) =>
    buffer.getChannelData(channel),
  );
  return wasm.downmix(channels, 0)[0];
}

/** Supersede any in-flight load and clear the previous source before any
 * asynchronous work, so a failed replacement can never leave the old file
 * behind under the new filename. */
function beginLoad(): number {
  loadGeneration += 1;
  clearLoaded();
  analysisError.value = null;
  return loadGeneration;
}

async function handleFile(file: File) {
  const generation = beginLoad();
  fileName.value = file.name;
  isLoadingFile.value = true;
  fileProgress.value = 0;
  fileProgressStage.value = 'decoding';
  let failurePhase: 'init' | 'decode' | 'processing' = 'init';

  try {
    // Initialize WASM and StreamAnalyzer if needed
    fileProgress.value = 5;
    await initStreamAnalyzer();
    if (generation !== loadGeneration) return;
    failurePhase = 'decode';
    await yieldToMain();
    if (generation !== loadGeneration) return;

    fileProgress.value = 15;
    fileProgressStage.value = 'decoding';
    const buffer = await decodeAudio(file);
    if (generation !== loadGeneration) return;
    failurePhase = 'processing';
    await yieldToMain();
    if (generation !== loadGeneration) return;

    fileProgress.value = 35;
    fileProgressStage.value = 'initializing';
    // Reinitialize stream analyzer with AudioContext sample rate
    const ctx = getAudioContext();
    sampleRate.value = ctx.sampleRate;
    await reinitStreamAnalyzer(ctx.sampleRate);
    if (generation !== loadGeneration) return;

    // Set expected duration for pattern lock timing
    setExpectedDuration(buffer.duration);

    // Set normalization gain for loud audio
    const normGain = calculateNormalizationGain(buffer);
    setNormalizationGain(normGain);

    // Set up streaming callback
    setProcessCallback((samples, sampleOffset) => {
      processAudioChunk(samples, sampleOffset);
    });
    await yieldToMain();
    if (generation !== loadGeneration) return;

    fileProgress.value = 45;
    fileProgressStage.value = 'extracting';
    // Pre-compute visualization data
    const wasm = await import('@/wasm/index.js');
    if (generation !== loadGeneration) return;
    const samples = monoSamples(wasm, buffer);
    applyTuning(wasm, wasm.estimateTuning(samples, buffer.sampleRate));
    await yieldToMain();
    if (generation !== loadGeneration) return;

    fileProgress.value = 55;
    fileProgressStage.value = 'rms';
    const rms = wasm.rmsEnergy(samples, buffer.sampleRate, 2048, 1024);
    await yieldToMain();
    if (generation !== loadGeneration) return;

    fileProgress.value = 62;
    fileProgressStage.value = 'beats';
    const beatTimes = wasm.detectBeats(samples, buffer.sampleRate);
    await yieldToMain();
    if (generation !== loadGeneration) return;

    fileProgress.value = 70;
    fileProgressStage.value = 'chroma';
    const chromaResult = wasm.chroma(samples, buffer.sampleRate, 2048, 1024);
    await yieldToMain();
    if (generation !== loadGeneration) return;

    fileProgress.value = 85;
    fileProgressStage.value = 'spectrogram';
    const melResult = wasm.melSpectrogram(samples, buffer.sampleRate, 2048, 1024, 128);
    await yieldToMain();
    if (generation !== loadGeneration) return;

    fileProgress.value = 95;
    fileProgressStage.value = 'finalizing';
    const bands = splitMelBands(melResult);

    setAudioBuffer(buffer);
    rmsData.value = rms;
    chromaData.value = {
      features: chromaResult.features,
      nFrames: chromaResult.nFrames,
      nChroma: chromaResult.nChroma,
    };
    bandData.value = {
      low: bands.low,
      high: bands.high,
    };
    beats.value = beatTimes;
    hasVisualization.value = true;

    fileProgress.value = 100;
  } catch (e) {
    if (generation !== loadGeneration) return;
    console.error('Failed to process audio:', e);
    // Surface the failure and roll back the upload state so the drop zone
    // reappears with an explanation instead of silently showing a bare zone.
    analysisError.value =
      failurePhase === 'init'
        ? copy.value.errors.init
        : failurePhase === 'decode'
          ? copy.value.errors.decode
          : copy.value.errors.processing;
    fileName.value = '';
    clearLoaded();
  } finally {
    if (generation === loadGeneration) isLoadingFile.value = false;
  }
}

function togglePlayback() {
  if (isPlaying.value) {
    pause();
  } else if (isPaused.value) {
    resume();
  } else {
    play();
  }
}

function rewind() {
  seek(0);
  // Don't reset here - will reset when play is pressed at position 0
}

function handleSeek(time: number) {
  seek(time);
}

function resetFile() {
  loadGeneration += 1;
  clearLoaded();
  fileName.value = '';
}

const displayBpm = computed(() => streamEstimate.value.bpm);
const displayKey = computed(() => streamEstimate.value.key);
const displayBpmConfidence = computed(() => Math.round(streamEstimate.value.bpmConfidence * 100));
const displayKeyConfidence = computed(() => Math.round(streamEstimate.value.keyConfidence * 100));

// While streaming playback is running, the BPM/key estimators need a few
// seconds of audio before they produce a value. Surface that warm-up as a
// pending state instead of a bare "-", which reads as broken.
const bpmPending = computed(() => isPlaying.value && !displayBpm.value);
const keyPending = computed(() => isPlaying.value && displayKey.value === '-');

const displayTuning = computed(() => {
  const cents = tuningCents.value;
  if (cents === null) return '—';
  return `${cents > 0 ? '+' : cents < 0 ? '−' : '±'}${Math.abs(cents)}¢`;
});

const playLabel = computed(() => t(isPlaying.value ? 'demo.player.pause' : 'demo.player.play'));

const displayVotedPattern = computed(() => streamEstimate.value.votedPattern);
const displayDetectedPatternName = computed(() => streamEstimate.value.detectedPatternName);
const displayDetectedPatternScore = computed(() =>
  Math.round(streamEstimate.value.detectedPatternScore * 100),
);

const analyzerStatus = computed<AnalyzerStatus>(() => {
  const loading = isLoadingDemo.value || isLoadingFile.value;
  const c = copy.value;
  let status: AnalyzerStatus['status'] = 'idle';
  let label = c.status.idle;
  if (analysisError.value) {
    status = 'error';
    label = c.status.error;
  } else if (loading) {
    status = 'warning';
    label = c.status.loading;
  } else if (isPlaying.value) {
    status = 'active';
    label = c.status.playing;
  } else if (audioBuffer.value) {
    status = 'active';
    label = c.status.ready;
  }
  const loaded = Boolean(audioBuffer.value) && !loading;
  return {
    status,
    label,
    pulse: loading || isPlaying.value,
    fields: [
      { key: 'SRC', value: loaded ? fileName.value : '-', wide: true },
      { key: 'LEN', value: loaded ? formatTime(duration.value) : '--:--' },
      { key: 'RATE', value: loaded ? `${(sampleRate.value / 1000).toFixed(1)} kHz` : '-' },
      { key: 'BPM', value: displayBpm.value ? String(displayBpm.value) : '-', divider: true },
      { key: 'KEY', value: displayKey.value },
      { key: 'TUNE', value: displayTuning.value },
    ],
  };
});

watch(analyzerStatus, (value) => emit('status', value), { immediate: true });

// Yield to main thread for animation
const yieldToMain = () => new Promise((resolve) => setTimeout(resolve, 0));

async function loadDemoFile() {
  const generation = beginLoad();
  isLoadingDemo.value = true;

  try {
    // Wait for loading animation to render
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    if (generation !== loadGeneration) return;

    // Initialize WASM and StreamAnalyzer
    await initStreamAnalyzer();
    if (generation !== loadGeneration) return;
    await yieldToMain();
    if (generation !== loadGeneration) return;

    const response = await fetch('/demo.mp3');
    if (!response.ok) {
      throw new Error('Failed to load demo file');
    }
    const arrayBuffer = await response.arrayBuffer();
    if (generation !== loadGeneration) return;
    await yieldToMain();
    if (generation !== loadGeneration) return;

    fileName.value = 'demo.mp3';

    const buffer = await decodeAudioFromArrayBuffer(arrayBuffer.slice(0));
    if (generation !== loadGeneration) return;
    await yieldToMain();
    if (generation !== loadGeneration) return;

    // Reinitialize stream analyzer with AudioContext sample rate
    // (AnalyserNode outputs at AudioContext rate, not buffer rate)
    const ctx = getAudioContext();
    sampleRate.value = ctx.sampleRate;
    await reinitStreamAnalyzer(ctx.sampleRate);
    if (generation !== loadGeneration) return;

    // Set expected duration for pattern lock timing
    setExpectedDuration(buffer.duration);

    // Set normalization gain for loud audio
    const normGain = calculateNormalizationGain(buffer);
    setNormalizationGain(normGain);

    // Set up streaming callback
    setProcessCallback((samples, sampleOffset) => {
      processAudioChunk(samples, sampleOffset);
    });

    // Pre-compute initial visualization data for immediate display
    // (streaming will update this in real-time during playback)
    const wasm = await import('@/wasm/index.js');
    if (generation !== loadGeneration) return;
    const samples = monoSamples(wasm, buffer);
    applyTuning(wasm, wasm.estimateTuning(samples, buffer.sampleRate));
    await yieldToMain();
    if (generation !== loadGeneration) return;

    const rms = wasm.rmsEnergy(samples, buffer.sampleRate, 2048, 1024);
    await yieldToMain();
    if (generation !== loadGeneration) return;

    const beatTimes = wasm.detectBeats(samples, buffer.sampleRate);
    await yieldToMain();
    if (generation !== loadGeneration) return;

    const chromaResult = wasm.chroma(samples, buffer.sampleRate, 2048, 1024);
    await yieldToMain();
    if (generation !== loadGeneration) return;

    const melResult = wasm.melSpectrogram(samples, buffer.sampleRate, 2048, 1024, 128);
    await yieldToMain();
    if (generation !== loadGeneration) return;

    const bands = splitMelBands(melResult);

    setAudioBuffer(buffer);
    rmsData.value = rms;
    chromaData.value = {
      features: chromaResult.features,
      nFrames: chromaResult.nFrames,
      nChroma: chromaResult.nChroma,
    };
    bandData.value = {
      low: bands.low,
      high: bands.high,
    };
    beats.value = beatTimes;
    hasVisualization.value = true;
  } catch (e) {
    if (generation !== loadGeneration) return;
    console.error('Failed to load demo file:', e);
  } finally {
    // Only the demo load owns this flag, so a superseded run clears it too.
    isLoadingDemo.value = false;
  }
}

// Reset stream analyzer when starting fresh playback from the beginning
watch(isPlaying, (playing, wasPlaying) => {
  if (playing && !wasPlaying && currentTime.value === 0) {
    // Starting new playback from beginning - reset analyzer
    resetStreamAnalyzer();
  }
});

onMounted(() => {
  loadDemoFile();
});

onUnmounted(() => {
  loadGeneration += 1;
});
</script>

<template>
  <div class="analyzer">
    <DemoNotice v-if="analysisError" tone="error" class="analyzer__error">{{ analysisError }}</DemoNotice>

    <SignalLoader
      v-if="isLoadingDemo || isLoadingFile"
      class="analyzer__loading"
      :stage="isLoadingFile ? copy.stages[fileProgressStage] : copy.stages.starting"
      :progress="isLoadingFile ? fileProgress : undefined"
    />

    <!-- Drop Zone (no file) -->
    <DropZone v-else-if="!audioBuffer" @file="handleFile" />

    <!-- Main Interface -->
    <Transition v-else name="demo-fade" appear>
      <div v-if="hasVisualization" class="analyzer__main">
        <!-- Left Panel: Metrics -->
        <aside class="analyzer__sidebar analyzer__sidebar--left">
          <TechPanel :title="t('demo.panel.title')" class="analyzer__metrics">
            <div class="analyzer__metrics-body">
              <!-- Primary Analysis Results -->
              <div class="analyzer__metric-hero">
                <span class="analyzer__metric-hero-label">
                  {{ t('demo.panel.bpm') }}
                  <Tooltip v-bind="term('bpm')" />
                </span>
                <span class="analyzer__metric-hero-value">
                  <span v-if="bpmPending" class="analyzer__metric-pending" role="status" :aria-label="t('demo.analyzing')">
                    <i class="demo-anim-loop"></i><i class="demo-anim-loop"></i><i class="demo-anim-loop"></i>
                  </span>
                  <template v-else>{{ displayBpm || '-' }}</template>
                </span>
                <span v-if="bpmPending" class="analyzer__metric-hero-conf analyzer__metric-hero-conf--pending demo-anim-loop">{{ t('demo.analyzing') }}</span>
                <span v-else-if="displayBpmConfidence > 0" class="analyzer__metric-hero-conf">{{ displayBpmConfidence }}%</span>
              </div>
              <div class="analyzer__metric-hero">
                <span class="analyzer__metric-hero-label">
                  {{ t('demo.panel.key') }}
                  <Tooltip v-bind="term('key')" />
                </span>
                <span class="analyzer__metric-hero-value">
                  <span v-if="keyPending" class="analyzer__metric-pending" role="status" :aria-label="t('demo.analyzing')">
                    <i class="demo-anim-loop"></i><i class="demo-anim-loop"></i><i class="demo-anim-loop"></i>
                  </span>
                  <template v-else>{{ displayKey }}</template>
                </span>
                <span v-if="keyPending" class="analyzer__metric-hero-conf analyzer__metric-hero-conf--pending demo-anim-loop">{{ t('demo.analyzing') }}</span>
                <span v-else-if="displayKeyConfidence > 0" class="analyzer__metric-hero-conf">{{ displayKeyConfidence }}%</span>
              </div>
              <!-- Chord progression pattern voted by the engine -->
              <Transition name="demo-rise">
                <div v-if="displayVotedPattern.length >= 4" class="analyzer__pattern">
                  <div class="analyzer__pattern-header">
                    <span class="analyzer__pattern-label">
                      {{ t('demo.panel.pattern') }}
                      <Tooltip v-bind="term('pattern')" />
                    </span>
                    <span v-if="displayDetectedPatternName" class="analyzer__pattern-name">{{ displayDetectedPatternName }}</span>
                  </div>
                  <div class="analyzer__pattern-chords">
                    {{ displayVotedPattern.join('→') }}
                  </div>
                  <span v-if="displayDetectedPatternName && displayDetectedPatternScore > 0" class="analyzer__pattern-score">{{ displayDetectedPatternScore }}%</span>
                </div>
              </Transition>
              <div class="analyzer__metrics-divider"></div>
              <!-- Secondary Info -->
              <MetricItem :value="formatTime(duration)">
                <template #label><TermLabel v-bind="term('duration')">{{ t('demo.panel.duration') }}</TermLabel></template>
              </MetricItem>
              <MetricItem :value="`${(sampleRate / 1000).toFixed(1)}kHz`">
                <template #label><TermLabel v-bind="term('rate')">{{ t('demo.panel.rate') }}</TermLabel></template>
              </MetricItem>
              <MetricItem :value="displayTuning">
                <template #label><TermLabel v-bind="term('tuning')">{{ t('demo.panel.tuning') }}</TermLabel></template>
              </MetricItem>
              <div class="analyzer__metrics-divider"></div>
              <!-- Source -->
              <MetricItem :value="fileName" variant="success">
                <template #label><TermLabel v-bind="term('source')">{{ t('demo.panel.source') }}</TermLabel></template>
              </MetricItem>
            </div>
          </TechPanel>
        </aside>

        <!-- Central Oscilloscope Area -->
        <div class="analyzer__center">
          <div class="analyzer__scope-container">
            <SynesthesiaVisualizer
              :chroma-data="chromaData"
              :rms-data="rmsData"
              :band-data="bandData"
              :current-time="currentTime"
              :duration="duration"
              :is-playing="isPlaying"
            />
            <Tooltip v-bind="term('visualizer')" class="analyzer__overlay-tip" />
          </div>

          <!-- Waveform & Transport -->
          <div class="analyzer__transport">
            <Tooltip v-bind="term('waveform')" class="analyzer__overlay-tip" />
            <WaveformVisualizer
              :audio-buffer="audioBuffer"
              :beats="beats ?? undefined"
              :current-time="currentTime"
              :duration="duration"
              @seek="handleSeek"
            />

            <div class="analyzer__controls">
              <div class="analyzer__controls-left">
                <TransportButton size="sm" :aria-label="copy.controls.rewind" @click="rewind">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M11 18V6l-8.5 6 8.5 6zm.5-6l8.5 6V6l-8.5 6z"/>
                  </svg>
                </TransportButton>
                <TransportButton variant="primary" round :aria-label="playLabel" @click="togglePlayback">
                  <svg v-if="!isPlaying" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M8 5v14l11-7z"/>
                  </svg>
                  <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
                  </svg>
                </TransportButton>
                <TransportButton size="sm" :aria-label="t('demo.player.stop')" @click="stop">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M6 6h12v12H6z"/>
                  </svg>
                </TransportButton>
              </div>

              <div class="analyzer__time">
                <span class="analyzer__time-current">{{ formatTime(currentTime) }}</span>
                <span class="analyzer__time-sep">/</span>
                <span class="analyzer__time-total">{{ formatTime(duration) }}</span>
              </div>

              <div class="analyzer__controls-right">
                <TransportButton size="sm" :aria-label="copy.controls.changeFile" @click="resetFile">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                    <path d="M3 15v4c0 1.1.9 2 2 2h14a2 2 0 002-2v-4M17 8l-5-5-5 5M12 3v12"/>
                  </svg>
                  <span>{{ copy.controls.file }}</span>
                </TransportButton>
              </div>
            </div>
          </div>
        </div>

        <!-- Right Panel: Data Console -->
        <aside class="analyzer__sidebar analyzer__sidebar--right">
          <DataConsole
            :chroma-data="chromaData"
            :rms-data="rmsData"
            :band-data="bandData"
            :current-time="currentTime"
            :duration="duration"
            :is-playing="isPlaying"
            :sample-rate="sampleRate"
          />
        </aside>
      </div>
    </Transition>
  </div>
</template>

<style scoped src="./audioAnalyzerLoading.css"></style>
<style scoped src="./audioAnalyzerLayout.css"></style>
<style scoped src="./audioAnalyzerMetrics.css"></style>
<style scoped src="./audioAnalyzerResponsive.css"></style>

<style scoped src="./audioAnalyzerTooltips.css"></style>
