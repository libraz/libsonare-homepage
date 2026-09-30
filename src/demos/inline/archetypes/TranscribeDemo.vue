<script setup lang="ts">
/**
 * `transcribe` archetype: recognize a monophonic audio line as MIDI and show
 * the detected notes on a piano roll. The original lead and the independent
 * piano resynthesis remain separate A/B playback targets; the roll always
 * describes the detector's result.
 */
import { computed, onBeforeUnmount, ref, shallowRef, watch } from 'vue';
import type { I18nText, SonareDemoDef } from '@/demos/inline/types';
import { localized } from '@/demos/inline/types';
import type { MonoAudio } from '@/demos/inline/useSonareDemoAudio';
import { useSonareDemoAudio as useDemoAudio } from '@/demos/inline/useSonareDemoAudio';
import { prepareCanvas2D } from '@/utils/canvas';
import { formatNoteName } from '@/utils/pitch';
import { useCanvasRedraw, useDemoChrome, useDemoParams, useDisposed } from '../composables';
import DemoControls from '../DemoControls.vue';
import DemoFrame from '../DemoFrame.vue';
import type { TranscriptionRender } from './transcribePipeline';
import { createTranscribeWorkerClient } from './transcribeWorkerClient';

const props = defineProps<{ def: SonareDemoDef; active: boolean }>();

const { loadClip, play, stop, playingId, progress } = useDemoAudio();

const canvas = ref<HTMLCanvasElement | null>(null);
const isPlaying = computed(() => playingId.value === props.def.id);
const {
  locale: loc,
  title,
  caption,
  status,
  errorMsg,
  tone,
  fail,
} = useDemoChrome(props.def, isPlaying);

const { values, updateParams } = useDemoParams(props.def);

type View = 'original' | 'notes';
const view = computed<View>(() => (values.view === 'original' ? 'original' : 'notes'));
const clipName = computed(() => (props.def.source.kind === 'clip' ? props.def.source.clip : ''));

const SIDE_LABELS: Record<View, I18nText> = {
  original: { en: 'Original', ja: 'オリジナル' },
  notes: { en: 'Detected notes', ja: '検出した音符' },
};
const EYEBROW_LABEL: I18nText = { en: 'AUDIO → MIDI', ja: '音声 → MIDI' };
const STATUS_LABELS = {
  loading: { en: 'TRANSCRIBING', ja: '解析中' },
  error: { en: 'ERROR', ja: 'エラー' },
  idle: { en: 'IDLE', ja: '待機中' },
} satisfies Record<string, I18nText>;
const LOADING_LABEL: I18nText = { en: 'TRANSCRIBING…', ja: '解析中…' };

const source = shallowRef<MonoAudio | null>(null);
const result = shallowRef<TranscriptionRender | null>(null);
const selectedAudio = computed<MonoAudio | null>(() => {
  if (view.value === 'original') return source.value;
  const piano = result.value?.piano;
  return piano ? { samples: piano, sampleRate: result.value?.sampleRate ?? 0 } : null;
});
const selectedDurationSec = computed(() => {
  const audio = selectedAudio.value;
  return audio && audio.sampleRate > 0 ? audio.samples.length / audio.sampleRate : 0;
});

const eyebrow = computed(() => {
  const base = localized(EYEBROW_LABEL, loc.value);
  return `${base} · ${localized(SIDE_LABELS[view.value], loc.value)}`;
});
const loadingLabel = computed(() => localized(LOADING_LABEL, loc.value));
const stateLabel = computed(() => {
  if (status.value === 'loading') return localized(STATUS_LABELS.loading, loc.value);
  if (status.value === 'error') return localized(STATUS_LABELS.error, loc.value);
  if (isPlaying.value) return `▸ ${Math.round(progress.value * 100)}%`;
  if (status.value !== 'ready' || !result.value) return localized(STATUS_LABELS.idle, loc.value);
  const notes = loc.value === 'ja' ? '音符' : 'NOTES';
  return `${result.value.noteCount} ${notes} · ${result.value.tempoBpm.toFixed(1)} BPM`;
});

const workerClient = createTranscribeWorkerClient();
const disposed = useDisposed();
let renderGeneration = 0;
let playbackRevision = 0;

function stopOwnPlayback(): void {
  if (playingId.value === props.def.id) stop();
}

async function compute(): Promise<void> {
  const run = ++renderGeneration;
  if (disposed()) return;
  if (isPlaying.value) stop();
  status.value = 'loading';

  try {
    if (!source.value) {
      source.value = await loadClip(clipName.value);
      if (disposed() || run !== renderGeneration) return;
    }
    const rendered = await workerClient.render(source.value.samples, source.value.sampleRate);
    if (disposed() || run !== renderGeneration) return;
    result.value = rendered;
    status.value = 'ready';
    paint();
  } catch (error) {
    if (disposed() || run !== renderGeneration) return;
    fail(error);
  }
}

// ---- piano roll -----------------------------------------------------------

const PAD_LEFT = 28;
const PAD_RIGHT = 12;
const PAD_TOP = 14;
const PAD_BOTTOM = 16;
const PITCH_PAD = 2;

interface RollBounds {
  minMidi: number;
  maxMidi: number;
  durationSec: number;
  tempoBpm: number;
}

function rollBounds(render: TranscriptionRender | null): RollBounds {
  const notes = render?.notes ?? [];
  const minNote = notes.reduce((min, note) => Math.min(min, note.midi), 60);
  const maxNote = notes.reduce((max, note) => Math.max(max, note.midi), 72);
  const endPpq = notes.reduce((max, note) => Math.max(max, note.endPpq), 0);
  const tempo = render?.tempoBpm ?? 120;
  const noteDuration = (endPpq * 60) / tempo;
  const duration = Math.max(
    render?.sourceDurationSec ?? 0,
    render?.pianoDurationSec ?? 0,
    noteDuration,
    1,
  );
  return {
    minMidi: Math.floor(minNote - PITCH_PAD),
    maxMidi: Math.ceil(maxNote + PITCH_PAD),
    durationSec: duration,
    tempoBpm: tempo,
  };
}

const isBlackKey = (midi: number): boolean => [1, 3, 6, 8, 10].includes(((midi % 12) + 12) % 12);

function noteColor(): string {
  return 'hsl(171 74% 62%)';
}

function paint(): void {
  const frame = prepareCanvas2D(canvas.value);
  if (!frame) return;
  const { ctx, width: w, height: h } = frame;
  const render = result.value;
  const bounds = rollBounds(render);
  const innerW = Math.max(1, w - PAD_LEFT - PAD_RIGHT);
  const innerH = Math.max(1, h - PAD_TOP - PAD_BOTTOM);
  const pitchRange = bounds.maxMidi - bounds.minMidi + 1;
  const laneH = innerH / pitchRange;
  const xAt = (seconds: number) => PAD_LEFT + (seconds / bounds.durationSec) * innerW;
  const yAt = (midi: number) => PAD_TOP + (bounds.maxMidi - midi) * laneH;

  for (let midi = bounds.minMidi; midi <= bounds.maxMidi; midi++) {
    const y = yAt(midi);
    ctx.fillStyle = isBlackKey(midi) ? 'rgba(0, 0, 0, 0.2)' : 'rgba(45, 212, 191, 0.025)';
    ctx.fillRect(PAD_LEFT, y, innerW, laneH);
    if (midi % 12 === 0) {
      ctx.strokeStyle = 'rgba(186, 230, 224, 0.16)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(PAD_LEFT, y);
      ctx.lineTo(PAD_LEFT + innerW, y);
      ctx.stroke();
    }
  }

  const beatSec = 60 / bounds.tempoBpm;
  for (let seconds = 0, beat = 0; seconds <= bounds.durationSec; seconds += beatSec, beat++) {
    const x = xAt(seconds);
    ctx.strokeStyle = beat % 4 === 0 ? 'rgba(186, 230, 224, 0.2)' : 'rgba(186, 230, 224, 0.08)';
    ctx.lineWidth = beat % 4 === 0 ? 1 : 0.5;
    ctx.beginPath();
    ctx.moveTo(x, PAD_TOP);
    ctx.lineTo(x, PAD_TOP + innerH);
    ctx.stroke();
  }

  const playSeconds = isPlaying.value ? progress.value * selectedDurationSec.value : -1;
  const notes = render?.notes ?? [];
  for (const note of notes) {
    const startSec = (note.startPpq * 60) / bounds.tempoBpm;
    const endSec = (note.endPpq * 60) / bounds.tempoBpm;
    const x = xAt(startSec);
    const noteW = Math.max(2, xAt(endSec) - x - 1);
    const y = yAt(note.midi) + 0.5;
    const noteH = Math.max(2, laneH - 1.5);
    const active = playSeconds >= 0 && startSec <= playSeconds;
    const alpha = playSeconds < 0 || active ? 0.88 : 0.38;
    ctx.fillStyle = noteColor();
    ctx.globalAlpha = alpha;
    ctx.shadowColor = active ? noteColor() : 'transparent';
    ctx.shadowBlur = active ? 8 : 0;
    ctx.beginPath();
    ctx.roundRect(x, y, noteW, noteH, Math.min(3, noteH * 0.4));
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  }

  ctx.font = '9px "JetBrains Mono", ui-monospace, monospace';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(186, 230, 224, 0.58)';
  for (let midi = bounds.minMidi; midi <= bounds.maxMidi; midi++) {
    if (midi % 12 === 0) ctx.fillText(formatNoteName(midi), 5, yAt(midi) + laneH / 2);
  }

  if (isPlaying.value && selectedDurationSec.value > 0) {
    const x = xAt(Math.min(bounds.durationSec, playSeconds));
    ctx.strokeStyle = '#2dd4bf';
    ctx.lineWidth = 2;
    ctx.shadowColor = '#2dd4bf';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.moveTo(x, PAD_TOP);
    ctx.lineTo(x, PAD_TOP + innerH);
    ctx.stroke();
    ctx.shadowBlur = 0;
  }
}

useCanvasRedraw(canvas, paint);

let paintRaf = 0;
function startPaintLoop(): void {
  if (paintRaf) return;
  const loop = () => {
    paint();
    paintRaf = isPlaying.value ? requestAnimationFrame(loop) : 0;
  };
  paintRaf = requestAnimationFrame(loop);
}

watch(isPlaying, (playing) => {
  if (playing) startPaintLoop();
  else paint();
});

watch(view, () => {
  playbackRevision++;
  stopOwnPlayback();
  paint();
});

watch(
  () => props.active,
  (active) => {
    if (active && status.value === 'idle') void compute();
  },
  { immediate: true },
);

async function onPlay(): Promise<void> {
  if (isPlaying.value) {
    playbackRevision++;
    stopOwnPlayback();
    return;
  }
  const requestedView = view.value;
  const run = ++playbackRevision;
  const expectedRender = renderGeneration + 1;
  if (!source.value || !result.value) {
    await compute();
    if (
      disposed() ||
      run !== playbackRevision ||
      requestedView !== view.value ||
      renderGeneration !== expectedRender
    ) {
      return;
    }
  }
  if (disposed() || run !== playbackRevision || requestedView !== view.value) return;
  const audio = selectedAudio.value;
  if (!audio) return;
  await play(props.def.id, audio);
  if (disposed() || run !== playbackRevision || requestedView !== view.value) {
    stopOwnPlayback();
  }
}

onBeforeUnmount(() => {
  renderGeneration++;
  playbackRevision++;
  stopOwnPlayback();
  workerClient.dispose();
  if (paintRaf) cancelAnimationFrame(paintRaf);
});
</script>

<template>
  <DemoFrame
    :eyebrow="eyebrow"
    :title="title"
    :caption="caption"
    :state="stateLabel"
    :tone="tone"
    :playing="isPlaying"
    :progress="progress"
    :disabled="status === 'loading'"
    :error="status === 'error' ? errorMsg : null"
    :loading-label="loadingLabel"
    axis-freq="MIDI NOTE"
    axis-time="TIME →"
    :show-playhead="false"
    @toggle="onPlay"
  >
    <template #screen>
      <canvas ref="canvas" class="tr-canvas" />
    </template>
    <template #controls>
      <DemoControls
        :disabled="status === 'loading'"
        :model-value="values"
        :params="def.params ?? []"
        :locale="loc"
        @update:model-value="updateParams"
      />
    </template>
  </DemoFrame>
</template>

<style scoped>
.tr-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
}
</style>
