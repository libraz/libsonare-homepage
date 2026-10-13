<script setup lang="ts">
/**
 * Piano Transcription — a piano recording turned back into notes.
 *
 * The recording's waveform sits above a piano roll on one time axis. The
 * visitor sets the detector and starts each run; a run transcribes in a worker,
 * draws its notes in against the previous run's (what appeared, what
 * disappeared), then renders them through the built-in acoustic piano so the
 * two can be heard against each other on one clock.
 */
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import ToolShell from '@/components/ToolShell.vue';
import ToolStatusBar, { type ToolStatusField } from '@/components/ToolStatusBar.vue';
import { DemoEmpty, DemoNotice, SegmentedControl } from '@/components/ui';
import { useCanvasRedraw } from '@/composables/useCanvasRedraw';
import { useI18n } from '@/composables/useI18n';
import { useTheme } from '@/composables/useTheme';
import { bootWasm } from '@/composables/useWasmBoot';
import { decodeAudioBuffer, downloadBlob, formatClipLength, formatDuration } from '@/utils/audio';
import { prepareCanvas2D } from '@/utils/canvas';
import { formatNoteName } from '@/utils/pitch';
import { fill } from '@/utils/template';
import { WorkerJobSuperseded } from '@/utils/workerRpc';
import {
  changedSettings,
  DEFAULT_SETTINGS,
  type DetectorMode,
  type DetectorSettings,
  formatDivision,
  formatKnob,
  type KnobKey,
  type NoteDivision,
  toTranscribeOptions,
  withMode,
} from './detectorSettings';
import {
  buildWaveBins,
  noteAt,
  paintRoll,
  type RollGeometry,
  type RollPalette,
  rollGeometry,
  secAtX,
  type WaveBins,
} from './rollPainter';
import TranscribePanel from './TranscribePanel.vue';
import { createTranscribeClient, type TranscribeClient } from './transcribeClient';
import {
  enCopy,
  jaCopy,
  LISTEN_MODES,
  type ListenMode,
  ZOOM_LEVELS,
  type ZoomLevel,
} from './transcribeCopy';
import {
  diffNotes,
  eventsToNotes,
  maxPolyphony,
  type NoteDiff,
  pitchSpan,
  type RollNote,
} from './transcribedNotes';
import { useAbPlayback } from './useAbPlayback';

const { localizedPath, alternateLocalePath, localizedValue } = useI18n();
const { isDark } = useTheme();
const copy = computed(() => localizedValue({ en: enCopy, ja: jaCopy }));

const SAMPLE_URL = '/transcribe/sample-piano.mp3';
/** Longest recording accepted; the polyphonic path holds ~0.75 MB per second. */
const MAX_SECONDS = 180;
/** One pass of the analysis sweep while the detector runs. */
const SCAN_PERIOD_MS = 1600;
/** How long a fresh result takes to draw in from the left. */
const REVEAL_MS = 650;

type Status = 'loading' | 'idle' | 'transcribing' | 'rendering' | 'ready' | 'error';
const status = ref<Status>('loading');
const errorMsg = ref('');
const libVersion = ref('');

interface SourceAudio {
  name: string;
  isSample: boolean;
  mono: Float32Array;
  sampleRate: number;
  durationSec: number;
}
const source = shallowRef<SourceAudio | null>(null);
const wave = shallowRef<WaveBins | null>(null);
const pianoWave = shallowRef<WaveBins | null>(null);
const smf = shallowRef<Uint8Array | null>(null);
/** Grid tempo detected on the first run over this recording. */
let detectedTempo: number | undefined;

const settings = ref<DetectorSettings>({ ...DEFAULT_SETTINGS });

interface Run {
  no: number;
  settings: DetectorSettings;
  notes: RollNote[];
  tempoBpm: number;
  tuning: number;
  detectMs: number;
}
const run = shallowRef<Run | null>(null);
const previousRun = shallowRef<Run | null>(null);
const diff = computed<NoteDiff | null>(() =>
  run.value ? diffNotes(previousRun.value?.notes ?? null, run.value.notes) : null,
);

const playback = useAbPlayback();
const isPlaying = playback.isPlaying;
const position = playback.position;
const listenMode = playback.mode;

const running = computed(() => status.value === 'transcribing' || status.value === 'rendering');

// ---- transcription -----------------------------------------------------------
let client: TranscribeClient | null = null;
let runCount = 0;
/** When the current run started and when its notes arrived, for the step card. */
const runStartedAt = ref(0);
const notesAt = ref(0);
const now = ref(0);
let ticker: ReturnType<typeof setInterval> | null = null;
/** The step card stays up briefly after a run so both ticks can be read. */
const STEPS_LINGER_MS = 1200;
const stepsShown = ref(false);
let stepsTimer: ReturnType<typeof setTimeout> | null = null;

function showSteps(): void {
  if (stepsTimer) clearTimeout(stepsTimer);
  stepsTimer = null;
  stepsShown.value = true;
}
function hideStepsSoon(): void {
  if (stepsTimer) clearTimeout(stepsTimer);
  stepsTimer = setTimeout(() => {
    stepsTimer = null;
    stepsShown.value = false;
  }, STEPS_LINGER_MS);
}

function startTicker(): void {
  stopTicker();
  now.value = performance.now();
  ticker = setInterval(() => {
    now.value = performance.now();
  }, 100);
}
function stopTicker(): void {
  if (ticker) clearInterval(ticker);
  ticker = null;
  now.value = performance.now();
}

async function transcribe(): Promise<void> {
  const audio = source.value;
  if (!audio || running.value) return;
  client ??= createTranscribeClient();
  const requested = { ...settings.value };
  status.value = 'transcribing';
  errorMsg.value = '';
  runStartedAt.value = performance.now();
  notesAt.value = 0;
  showSteps();
  startTicker();
  startScan();
  const job = client.run(
    {
      // A copy: the original stays here for the next run.
      samples: audio.mono.slice(),
      sampleRate: audio.sampleRate,
      options: toTranscribeOptions(requested),
      tempoBpm: detectedTempo,
    },
    (result) => {
      if (source.value !== audio) return;
      detectedTempo ??= result.tempoBpm;
      previousRun.value = run.value;
      run.value = {
        no: ++runCount,
        settings: requested,
        notes: eventsToNotes(result.events, result.tempoBpm),
        tempoBpm: result.tempoBpm,
        tuning: result.tuning,
        detectMs: result.elapsedMs,
      };
      notesAt.value = performance.now();
      status.value = 'rendering';
      startReveal();
    },
  );
  try {
    const rendered = await job.result;
    if (source.value !== audio) return;
    libVersion.value = rendered.version;
    smf.value = rendered.smf;
    pianoWave.value = buildWaveBins(rendered.piano, audio.sampleRate);
    playback.setPiano(rendered.piano);
    status.value = 'ready';
  } catch (error) {
    if (error instanceof WorkerJobSuperseded) return;
    status.value = 'error';
    errorMsg.value = fill(copy.value.errors.run, {
      message: error instanceof Error ? error.message : String(error),
    });
  } finally {
    if (source.value === audio) {
      stopTicker();
      hideStepsSoon();
    }
    kick();
  }
}

function setMode(mode: DetectorMode): void {
  settings.value = withMode(settings.value, mode);
}
function setKnob(key: KnobKey, value: number): void {
  if (settings.value[key] === value) return;
  settings.value = { ...settings.value, [key]: value };
}
function setDivision(division: NoteDivision): void {
  if (settings.value.minNoteDivision === division) return;
  settings.value = { ...settings.value, minNoteDivision: division };
}
function setTuning(auto: boolean): void {
  if (settings.value.autoTuning === auto) return;
  settings.value = { ...settings.value, autoTuning: auto };
}
function resetSettings(): void {
  settings.value = withMode({ ...DEFAULT_SETTINGS }, settings.value.mode);
}

/** One changed setting, as `label before → after`. */
interface ChangeLine {
  key: string;
  label: string;
  before: string;
  after: string;
}

function settingValue(key: keyof DetectorSettings, value: DetectorSettings): string {
  const d = copy.value.detector;
  if (key === 'mode') return d.modes[value.mode];
  if (key === 'autoTuning') return value.autoTuning ? d.tuningAuto : d.tuningFixed;
  if (key === 'minNoteDivision') return formatDivision(value.minNoteDivision, d.division.off);
  return formatKnob(key, value[key], d.off);
}

function describeChanges(before: DetectorSettings, after: DetectorSettings): ChangeLine[] {
  const d = copy.value.detector;
  return changedSettings(before, after).map((key) => ({
    key,
    label:
      key === 'mode'
        ? d.mode
        : key === 'autoTuning'
          ? d.tuning
          : key === 'minNoteDivision'
            ? d.division.label
            : d.knobs[key as KnobKey].label,
    before: settingValue(key, before),
    after: settingValue(key, after),
  }));
}

/** Settings moved since the last run, waiting for the next one. */
const pendingChanges = computed(() =>
  run.value ? describeChanges(run.value.settings, settings.value) : [],
);
/** What the last run changed against the one before it. */
const appliedChanges = computed(() =>
  run.value && previousRun.value
    ? describeChanges(previousRun.value.settings, run.value.settings)
    : [],
);
const canRun = computed(
  () =>
    Boolean(source.value) &&
    !running.value &&
    status.value !== 'loading' &&
    (!run.value || pendingChanges.value.length > 0),
);

// ---- audio input -------------------------------------------------------------
const fileInput = ref<HTMLInputElement | null>(null);
const dragging = ref(false);

async function loadAudio(file: File, isSample: boolean): Promise<void> {
  status.value = 'loading';
  errorMsg.value = '';
  try {
    const ctx = playback.ensureContext();
    const buffer = await decodeAudioBuffer(file, ctx, { maxDurationSeconds: MAX_SECONDS });
    const planes = Array.from({ length: buffer.numberOfChannels }, (_, c) =>
      buffer.getChannelData(c),
    );
    // The detector reads one channel: the engine's BS.775 fold keeps a 5.1 centre.
    const wasm = await bootWasm();
    libVersion.value ||= wasm.version();
    const [mono] = wasm.downmix(planes, 0);
    detectedTempo = undefined;
    run.value = null;
    previousRun.value = null;
    runCount = 0;
    stepsShown.value = false;
    pianoWave.value = null;
    smf.value = null;
    playback.setSource(buffer);
    wave.value = buildWaveBins(mono, buffer.sampleRate);
    source.value = {
      name: file.name,
      isSample,
      mono,
      sampleRate: buffer.sampleRate,
      durationSec: buffer.duration,
    };
    zoom.value = 1;
    viewStart.value = 0;
    status.value = 'idle';
    paint();
  } catch (error) {
    status.value = source.value ? 'idle' : 'error';
    const budget = error instanceof Error && error.name === 'AudioInputBudgetError';
    errorMsg.value = budget
      ? fill(copy.value.source.tooLong, { max: formatDuration(MAX_SECONDS) })
      : copy.value.source.decode;
  }
}

async function loadSample(): Promise<void> {
  status.value = 'loading';
  try {
    const response = await fetch(SAMPLE_URL);
    if (!response.ok) throw new Error(String(response.status));
    const blob = await response.blob();
    await loadAudio(new File([blob], 'sample-piano.mp3', { type: 'audio/mpeg' }), true);
  } catch {
    status.value = 'error';
    errorMsg.value = copy.value.source.decode;
  }
}

function openFile(): void {
  fileInput.value?.click();
}
function onFileChosen(event: Event): void {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (file) void loadAudio(file, false);
}
function onDrop(event: DragEvent): void {
  dragging.value = false;
  const file = event.dataTransfer?.files?.[0];
  if (file && !running.value) void loadAudio(file, false);
}

// ---- transport -----------------------------------------------------------------
async function togglePlay(): Promise<void> {
  if (isPlaying.value) {
    playback.pause();
    return;
  }
  try {
    await playback.play();
  } catch {
    errorMsg.value = copy.value.errors.audio;
  }
}
function restart(): void {
  playback.seek(0);
  viewStart.value = 0;
}
function setListen(mode: ListenMode): void {
  playback.setMode(mode);
}
function downloadMidi(): void {
  if (!smf.value) return;
  downloadBlob(
    new Blob([smf.value as Uint8Array<ArrayBuffer>], { type: 'audio/midi' }),
    copy.value.controls.downloadName,
  );
}

// ---- view: zoom, scroll, follow ---------------------------------------------------
const zoom = ref<ZoomLevel>(1);
const viewStart = ref(0);
const duration = computed(() => source.value?.durationSec ?? 0);
const viewSpan = computed(() => (duration.value > 0 ? duration.value / zoom.value : 1));

function clampStart(start: number): number {
  return Math.max(0, Math.min(Math.max(0, duration.value - viewSpan.value), start));
}
function setZoom(level: ZoomLevel): void {
  const centre = isPlaying.value ? position.value : viewStart.value + viewSpan.value / 2;
  zoom.value = level;
  viewStart.value = clampStart(centre - viewSpan.value / 2);
  paint();
}

// Page the view along with the playhead once it nears the right edge.
watch(position, (sec) => {
  if (isPlaying.value && zoom.value > 1) {
    const end = viewStart.value + viewSpan.value;
    if (sec > end - viewSpan.value * 0.08 || sec < viewStart.value) {
      viewStart.value = clampStart(sec - viewSpan.value * 0.1);
    }
  }
  paint();
});

// ---- animation: the sweep while detecting, the draw-in when notes land -------------
let reduceMotion = false;
let frame = 0;
let scanFrom = 0;
let revealFrom = 0;
let scan: number | null = null;
let revealSec: number | null = null;

function startScan(): void {
  scanFrom = performance.now();
  kick();
}
function startReveal(): void {
  revealFrom = performance.now();
  kick();
}
function kick(): void {
  if (!frame && typeof requestAnimationFrame === 'function') frame = requestAnimationFrame(tick);
}
function tick(at: number): void {
  frame = 0;
  let more = false;
  scan = null;
  revealSec = null;
  if (!reduceMotion) {
    if (status.value === 'transcribing') {
      scan = ((at - scanFrom) % SCAN_PERIOD_MS) / SCAN_PERIOD_MS;
      more = true;
    }
    const k = (at - revealFrom) / REVEAL_MS;
    if (revealFrom && k < 1) {
      const eased = 1 - (1 - k) ** 3;
      revealSec = viewStart.value + eased * viewSpan.value;
      more = true;
    }
  }
  paint();
  if (more) kick();
}

// ---- canvas ------------------------------------------------------------------------
const root = ref<HTMLElement | null>(null);
const canvas = ref<HTMLCanvasElement | null>(null);
let geometry: RollGeometry | null = null;
let palette: RollPalette | null = null;
const hover = shallowRef<(RollNote & { change: string }) | null>(null);
const hoverPos = ref({ x: 0, y: 0 });

function readPalette(): RollPalette | null {
  if (!root.value) return null;
  const style = getComputedStyle(root.value);
  const v = (name: string) => style.getPropertyValue(name).trim();
  return {
    text: v('--demo-text-strong'),
    muted: v('--demo-text-muted'),
    grid: v('--tx-grid'),
    gridMinor: v('--tx-grid-minor'),
    wave: v('--tx-wave'),
    piano: v('--tx-piano'),
    kept: v('--tx-kept'),
    added: v('--tx-added'),
    removed: v('--tx-removed'),
    playhead: v('--demo-playhead'),
    whiteKey: v('--tx-white-key'),
    blackKey: v('--tx-black-key'),
    blackRow: v('--tx-black-row'),
    scan: v('--tx-scan'),
  };
}

watch(isDark, () => {
  palette = null;
  // Theme classes land on <html> before the next frame.
  requestAnimationFrame(paint);
});

const span = computed(() =>
  pitchSpan([...(run.value?.notes ?? []), ...(previousRun.value?.notes ?? [])]),
);

function paint(): void {
  const frame2d = prepareCanvas2D(canvas.value);
  if (!frame2d) return;
  palette ??= readPalette();
  if (!palette) return;
  geometry = rollGeometry(
    frame2d.width,
    frame2d.height,
    { startSec: viewStart.value, spanSec: viewSpan.value },
    span.value,
  );
  paintRoll({
    ctx: frame2d.ctx,
    geo: geometry,
    palette,
    wave: wave.value,
    piano: status.value === 'ready' || isPlaying.value ? pianoWave.value : null,
    diff: diff.value,
    playheadSec: position.value,
    hover: hover.value,
    revealSec,
    scan,
  });
}
useCanvasRedraw(canvas, paint);

let pointer: { id: number; x: number; start: number; moved: boolean } | null = null;

function localPoint(event: PointerEvent): { x: number; y: number } {
  const box = (event.currentTarget as HTMLElement).getBoundingClientRect();
  return { x: event.clientX - box.left, y: event.clientY - box.top };
}

function onPointerDown(event: PointerEvent): void {
  if (!geometry || !source.value || event.button !== 0) return;
  (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  pointer = { id: event.pointerId, x: event.clientX, start: viewStart.value, moved: false };
}

function onPointerMove(event: PointerEvent): void {
  if (!geometry) return;
  if (pointer && pointer.id === event.pointerId) {
    const dx = event.clientX - pointer.x;
    if (Math.abs(dx) > 3) pointer.moved = true;
    if (pointer.moved && zoom.value > 1) {
      const secPerPx = viewSpan.value / (geometry.width - geometry.gutter);
      viewStart.value = clampStart(pointer.start - dx * secPerPx);
      paint();
    }
    return;
  }
  const point = localPoint(event);
  const hit = diff.value ? noteAt(geometry, diff.value.current, point.x, point.y) : null;
  if (hit !== hover.value) {
    hover.value = hit;
    paint();
  }
  hoverPos.value = point;
}

function onPointerUp(event: PointerEvent): void {
  if (!pointer || pointer.id !== event.pointerId || !geometry) return;
  const moved = pointer.moved;
  pointer = null;
  if (moved) return;
  const point = localPoint(event);
  if (point.x < geometry.gutter) return;
  playback.seek(secAtX(geometry, point.x));
}

function onPointerLeave(): void {
  if (hover.value) {
    hover.value = null;
    paint();
  }
}

function onKeydown(event: KeyboardEvent): void {
  if (!source.value) return;
  if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
    event.preventDefault();
    const step = event.shiftKey ? 5 : 1;
    playback.seek(position.value + (event.key === 'ArrowRight' ? step : -step));
  } else if (event.key === ' ') {
    event.preventDefault();
    void togglePlay();
  }
}

const hoverLabel = computed(() => {
  const note = hover.value;
  if (!note) return '';
  return fill(copy.value.result.hover, {
    note: formatNoteName(note.pitch),
    start: formatClock(note.startSec),
    length: `${Math.round((note.endSec - note.startSec) * 1000)} ms`,
    velocity: String(note.velocity),
  });
});
const hoverStyle = computed(() => {
  const box = canvas.value?.clientWidth ?? 0;
  const flip = hoverPos.value.x > box - 220;
  return {
    left: `${hoverPos.value.x + (flip ? -12 : 12)}px`,
    top: `${hoverPos.value.y + 14}px`,
    transform: flip ? 'translateX(-100%)' : undefined,
  };
});

// ---- readouts ------------------------------------------------------------------------
function formatClock(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec - m * 60;
  return `${m}:${s.toFixed(1).padStart(4, '0')}`;
}
function formatSeconds(ms: number): string {
  return `${(ms / 1000).toFixed(1)} s`;
}

/** The two worker stages, timed as they actually ran. */
const steps = computed(() => {
  const s = copy.value.run.steps;
  const detectDone = notesAt.value > 0;
  const renderDone = status.value === 'ready';
  return [
    {
      key: 'detect',
      label: s.detect,
      state: detectDone ? 'done' : 'active',
      time: formatSeconds((detectDone ? notesAt.value : now.value) - runStartedAt.value),
    },
    {
      key: 'render',
      label: s.render,
      state: renderDone ? 'done' : detectDone ? 'active' : 'pending',
      time: detectDone ? formatSeconds(now.value - notesAt.value) : '',
    },
  ];
});

const stats = computed(() => {
  const current = run.value;
  return [
    {
      key: 'notes',
      label: copy.value.result.notes,
      value: current ? String(current.notes.length) : '—',
    },
    {
      key: 'voices',
      label: copy.value.result.voices,
      value: current ? String(maxPolyphony(current.notes)) : '—',
    },
    {
      key: 'tempo',
      label: copy.value.result.tempo,
      value: current ? `${current.tempoBpm.toFixed(1)}` : '—',
      unit: 'BPM',
    },
    {
      key: 'tuning',
      label: copy.value.result.tuning,
      value: current ? `${current.tuning >= 0 ? '+' : ''}${Math.round(current.tuning * 100)}` : '—',
      unit: 'ct',
    },
    {
      key: 'time',
      label: copy.value.result.time,
      value: current ? `${Math.round(current.detectMs)}` : '—',
      unit: 'ms',
    },
  ];
});
const timeLabel = computed(() => `${formatClock(position.value)} / ${formatClock(duration.value)}`);

const statusKind = computed<'idle' | 'active' | 'warning' | 'error'>(() => {
  if (status.value === 'error') return 'error';
  if (running.value || status.value === 'loading') return 'warning';
  return isPlaying.value ? 'active' : 'idle';
});
const statusLabel = computed(() =>
  isPlaying.value && !running.value ? copy.value.status.playing : copy.value.status[status.value],
);
const statusFields = computed<ToolStatusField[]>(() => {
  const keys = copy.value.statusFields;
  const audio = source.value;
  return [
    {
      key: keys.source,
      value: audio ? (audio.isSample ? copy.value.attribution : audio.name) : '—',
      wide: true,
    },
    { key: keys.length, value: audio ? formatClipLength(audio.durationSec) : '—' },
    { key: keys.notes, value: run.value ? String(run.value.notes.length) : '—' },
    { key: keys.tempo, value: run.value ? run.value.tempoBpm.toFixed(1) : '—' },
  ];
});
const canPlay = computed(() => Boolean(source.value) && status.value !== 'loading');
const listenOptions = computed(() =>
  LISTEN_MODES.map((mode) => ({
    id: mode,
    label: copy.value.controls.listenModes[mode],
    disabled: mode !== 'source' && !hasPiano.value,
  })),
);
const zoomOptions = computed(() =>
  ZOOM_LEVELS.map((level) => ({
    id: String(level),
    label: level === 1 ? copy.value.controls.fit : `${level}×`,
    disabled: !source.value,
  })),
);
const hasPiano = computed(() => Boolean(pianoWave.value) && status.value === 'ready');

// ---- lifecycle -----------------------------------------------------------------------
onMounted(() => {
  reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  void loadSample();
});

onBeforeUnmount(() => {
  stopTicker();
  if (stepsTimer) clearTimeout(stepsTimer);
  stepsTimer = null;
  if (frame) cancelAnimationFrame(frame);
  frame = 0;
  client?.dispose();
  client = null;
});

const docsPath = computed(() => localizedPath('/docs/audio-to-notes'));
const otherLocalePath = computed(() => alternateLocalePath('/transcribe'));
</script>

<template>
  <ToolShell
    demo-id="transcribe"
    :title="copy.title"
    :subtitle="copy.subtitle"
    :version="libVersion"
    :status="statusKind"
    :status-label="statusLabel"
    :docs-path="docsPath"
    :guide-title="copy.guideTitle"
    :guide-body="copy.guideBody"
    :guide-link-label="copy.guideLink"
    :opposite-locale-path="otherLocalePath"
  >
    <template #statusbar>
      <ToolStatusBar
        :status="statusKind"
        :label="statusLabel"
        :pulse="running || status === 'loading'"
        :fields="statusFields"
      />
    </template>

    <div ref="root" class="tx">
      <div class="tx__intro">
        <span class="tx__eyebrow demo-label">{{ copy.eyebrow }}</span>
        <h1 class="tx__heading">{{ copy.heading }}</h1>
        <p class="tx__lead">{{ copy.intro }}</p>
      </div>

      <div class="tx__layout">
        <!-- Console: audio, detector, run -->
        <aside class="tx__console">
          <section class="tx-card tx-source" :aria-label="copy.source.label">
            <span class="demo-label tx-card__label">{{ copy.source.label }}</span>
            <div class="tx-source__name">
              <template v-if="status === 'loading' && !source">{{ copy.source.loading }}</template>
              <template v-else-if="source?.isSample">{{ copy.source.sample }}</template>
              <template v-else-if="source">{{ source.name }}</template>
              <template v-else>—</template>
            </div>
            <div v-if="source" class="tx-source__meta">
              <span v-if="source.isSample">{{ copy.sampleCredit }}</span>
              <span class="tx-source__len">{{ formatClipLength(source.durationSec) }}</span>
              <span class="tx-source__len">{{ (source.sampleRate / 1000).toFixed(1) }} kHz</span>
            </div>
            <div class="tx-source__actions">
              <button type="button" class="demo-btn" :disabled="running || status === 'loading'" @click="openFile">
                {{ copy.source.own }}
              </button>
              <button
                v-if="source && !source.isSample"
                type="button"
                class="demo-btn demo-btn--ghost"
                :disabled="running || status === 'loading'"
                @click="loadSample"
              >
                {{ copy.source.backToSample }}
              </button>
              <input
                ref="fileInput"
                class="tx__file"
                type="file"
                accept="audio/*"
                tabindex="-1"
                aria-hidden="true"
                @change="onFileChosen"
              />
            </div>
            <DemoNotice tone="hint">{{ copy.source.dropHint }}</DemoNotice>
          </section>

          <TranscribePanel
            class="tx-card"
            :copy="copy"
            :settings="settings"
            :disabled="running"
            @mode="setMode"
            @knob="setKnob"
            @tuning="setTuning"
            @division="setDivision"
            @reset="resetSettings"
          />

          <section class="tx-card tx-run" :class="{ 'is-pending': run && pendingChanges.length > 0 }">
            <button type="button" class="demo-btn demo-btn--primary tx-run__btn" :disabled="!canRun" @click="transcribe">
              <svg v-if="!running" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M2 12h3l3-8 4 16 3-8h7" />
              </svg>
              <span v-else class="tx-run__spinner" aria-hidden="true"></span>
              {{ running ? copy.run.running : copy.run.button }}
            </button>
            <div aria-live="polite">
              <DemoNotice tone="hint">
                <template v-if="!run">{{ copy.run.firstHint }}</template>
                <template v-else-if="pendingChanges.length">
                  <span class="tx-run__note-head">{{ fill(copy.run.pending, { n: String(run.no) }) }}</span>
                  <ul class="tx-changes">
                    <li v-for="change in pendingChanges" :key="change.key">
                      <span class="tx-changes__label">{{ change.label }}</span>
                      <span class="tx-changes__value">{{ change.before }} → <b>{{ change.after }}</b></span>
                    </li>
                  </ul>
                </template>
                <template v-else>{{ fill(copy.run.clean, { n: String(run.no) }) }}</template>
              </DemoNotice>
            </div>
          </section>
        </aside>

        <!-- Main: stage, transport, result -->
        <div class="tx__main">
          <div
            class="tx__stage"
            :class="{ 'is-dragging': dragging }"
            @dragover.prevent="dragging = true"
            @dragleave="dragging = false"
            @drop.prevent="onDrop"
          >
            <div class="tx-stagebar">
              <ul class="tx-stagebar__lanes">
                <li><i class="tx-swatch tx-swatch--wave" aria-hidden="true"></i>{{ copy.legend.wave }}</li>
                <li :class="{ 'is-off': !hasPiano }">
                  <i class="tx-swatch tx-swatch--piano" aria-hidden="true"></i>{{ copy.legend.piano }}
                </li>
              </ul>
              <ul class="tx-stagebar__diff" :aria-label="copy.result.legendAria">
                <li>
                  <i class="tx-swatch tx-swatch--kept" aria-hidden="true"></i>{{ copy.result.kept }}
                  <b>{{ diff ? diff.kept : '—' }}</b>
                </li>
                <li :class="{ 'is-off': !previousRun }">
                  <i class="tx-swatch tx-swatch--added" aria-hidden="true"></i>{{ copy.result.added }}
                  <b>{{ previousRun && diff ? `+${diff.added}` : '—' }}</b>
                </li>
                <li :class="{ 'is-off': !previousRun }">
                  <i class="tx-swatch tx-swatch--removed" aria-hidden="true"></i>{{ copy.result.removed }}
                  <b>{{ previousRun && diff ? `−${diff.removed.length}` : '—' }}</b>
                </li>
              </ul>
            </div>
            <div class="tx__screen">
              <canvas
                ref="canvas"
                class="tx__canvas"
                :class="{ 'is-pannable': zoom > 1 }"
                tabindex="0"
                role="img"
                :aria-label="copy.lanes.rollAria"
                @pointerdown="onPointerDown"
                @pointermove="onPointerMove"
                @pointerup="onPointerUp"
                @pointercancel="onPointerUp"
                @pointerleave="onPointerLeave"
                @keydown="onKeydown"
              ></canvas>
              <div v-if="hover" class="tx__hover" :style="hoverStyle" aria-hidden="true">
                {{ hoverLabel }}
              </div>

              <Transition name="demo-rise">
                <div v-if="!run && !running && source" class="tx-overlay">
                  <DemoEmpty :title="copy.empty.title">
                    {{ copy.empty.body }}
                    <template #action>
                      <button type="button" class="demo-btn demo-btn--primary tx-run__btn" :disabled="!canRun" @click="transcribe">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                          <path d="M2 12h3l3-8 4 16 3-8h7" />
                        </svg>
                        {{ copy.run.button }}
                      </button>
                    </template>
                  </DemoEmpty>
                </div>
              </Transition>

              <Transition name="demo-fade">
                <ol
                  v-if="stepsShown"
                  class="tx-steps"
                  role="status"
                  :aria-label="copy.run.stepsAria"
                >
                  <li v-for="step in steps" :key="step.key" class="tx-steps__item" :class="`is-${step.state}`">
                    <span class="tx-steps__mark" aria-hidden="true"></span>
                    <span class="tx-steps__label">{{ step.label }}</span>
                    <span class="tx-steps__time">{{ step.time }}</span>
                  </li>
                </ol>
              </Transition>

              <Transition name="demo-fade">
                <div v-if="dragging" class="tx__drop" aria-hidden="true">{{ copy.source.drop }}</div>
              </Transition>
              <Transition name="demo-rise">
                <div v-if="run && run.notes.length === 0 && !running" class="tx-overlay tx-overlay--quiet">
                  <DemoEmpty compact :title="copy.result.noNotes" />
                </div>
              </Transition>
            </div>
          </div>

          <!-- Transport -->
          <div class="tx__controls">
            <div class="tx__transport">
              <button
                type="button"
                class="demo-btn demo-btn--primary demo-btn--icon tx__play"
                :disabled="!canPlay"
                :aria-label="isPlaying ? copy.controls.pause : copy.controls.play"
                @click="togglePlay"
              >
                <svg v-if="!isPlaying" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M8 5v14l11-7z" />
                </svg>
                <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M6 5h4v14H6zM14 5h4v14h-4z" />
                </svg>
              </button>
              <button
                type="button"
                class="demo-btn demo-btn--icon tx__icon-btn"
                :aria-label="copy.controls.restart"
                :title="copy.controls.restart"
                :disabled="!canPlay"
                @click="restart"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M3 2v6h6" />
                  <path d="M3 13a9 9 0 1 0 3-7.7L3 8" />
                </svg>
              </button>
              <span class="tx__time">{{ timeLabel }}</span>
            </div>
            <div class="tx__group tx__group--listen">
              <span class="tx__group-label demo-label">{{ copy.controls.listen }}</span>
              <SegmentedControl
                class="tx__listen"
                :model-value="listenMode"
                :options="listenOptions"
                :ariaLabel="copy.controls.listenAria"
                @update:model-value="setListen($event as ListenMode)"
              />
            </div>
            <div class="tx__group">
              <span class="tx__group-label demo-label">{{ copy.controls.zoom }}</span>
              <SegmentedControl
                :model-value="String(zoom)"
                :options="zoomOptions"
                :ariaLabel="copy.controls.zoomAria"
                :fill="false"
                @update:model-value="setZoom(Number($event) as ZoomLevel)"
              />
            </div>
            <button
              type="button"
              class="demo-btn tx__download"
              :disabled="!smf || !hasPiano"
              @click="downloadMidi"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M12 3v12" />
                <path d="m7 10 5 5 5-5" />
                <path d="M5 21h14" />
              </svg>
              {{ copy.controls.download }}
            </button>
          </div>

          <DemoNotice v-if="errorMsg" tone="error" class="tx__error">{{ errorMsg }}</DemoNotice>

          <!-- Result of the latest run -->
          <section class="tx-card tx-result" :aria-label="copy.result.legendAria">
            <header v-if="run" class="tx-result__head">
              <span class="tx-result__run">
                {{ fill(copy.result.run, { n: String(run.no) }) }}
              </span>
              <span v-if="previousRun" class="tx-result__against">
                {{ fill(copy.result.against, { n: String(previousRun.no) }) }}
              </span>
            </header>
            <dl class="tx-result__stats">
              <div v-for="stat in stats" :key="stat.key">
                <dt class="demo-label">{{ stat.label }}</dt>
                <dd>{{ stat.value }}<small v-if="stat.unit && run">{{ stat.unit }}</small></dd>
              </div>
            </dl>
            <div class="tx-result__changes">
              <template v-if="!run || !previousRun">{{ copy.result.firstRun }}</template>
              <template v-else-if="appliedChanges.length === 0">{{ copy.result.sameSettings }}</template>
              <ul v-else class="tx-changes tx-changes--inline">
                <li v-for="change in appliedChanges" :key="change.key">
                  <span class="tx-changes__label">{{ change.label }}</span>
                  <span class="tx-changes__value">{{ change.before }} → <b>{{ change.after }}</b></span>
                </li>
              </ul>
            </div>
          </section>
        </div>
      </div>
    </div>
  </ToolShell>
</template>

<style src="./transcribe.css"></style>
