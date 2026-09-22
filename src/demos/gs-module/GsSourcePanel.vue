<script setup lang="ts">
/**
 * What the module is playing, and the bytes that configure it.
 *
 * Two sources. On its own the module auditions the selected part with a short
 * built-in phrase. Drop a `.mid` and that file plays instead, imported exactly
 * as it arrived — the panel settings are carried on a separate track beside it,
 * so a file that sets up its own GS state keeps it.
 *
 * The scope shows the render that is actually on the output, so a setting that
 * changed the sound is visible before it is heard. The frame list beside it is
 * the point of the panel rather than a debug aid: it is the whole difference
 * between the module's power-on state and what is on screen, which is usually
 * a handful of bytes.
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { amplitudeToDb, type WaveformPeak } from '@/utils/audio';
import { prepareCanvas2D } from '@/utils/canvas';
import type { SmfEvent } from '@/utils/gsSysex';
import type { GsRenderStatus } from './useGsModule';

const props = defineProps<{
  frames: SmfEvent[];
  status: GsRenderStatus;
  droppedFile: { name: string; bytes: Uint8Array } | null;
  waveform: WaveformPeak[];
  /** How far through the render playback is, 0 to 1. */
  playhead: number;
  isPlaying: boolean;
}>();

const emit = defineEmits<{
  drop: [file: File];
  clearFile: [];
}>();

const { localizedValue } = useI18n();
const dragging = ref(false);
const canvasRef = ref<HTMLCanvasElement | null>(null);

const copy = computed(() =>
  localizedValue({
    en: {
      rendering: 'Rendering…',
      error: 'Render failed',
      idle: 'Press play to bounce and hear the module',
      builtIn: 'Built-in phrase — drop a .mid to play your own',
      dropHint: 'Release to load',
      clear: 'Remove',
      scope: 'The render on the output',
      peak: 'PEAK',
      framesNone: 'Nothing to send: every setting is at its power-on value.',
      framesSome: (n: number) => `${n} message${n === 1 ? '' : 's'} to send`,
      fileNote:
        'The file plays as it arrived. Any GS setup it carries is applied, and the panels above are sent alongside it.',
    },
    ja: {
      rendering: 'レンダリング中…',
      error: 'レンダリングに失敗しました',
      idle: '再生するとバウンスして音が出ます',
      builtIn: '内蔵フレーズ。.mid を落とすと自分のファイルを鳴らせます',
      dropHint: '離すと読み込みます',
      clear: '外す',
      scope: '出力されているレンダリング結果',
      peak: 'ピーク',
      framesNone: '送るものはありません。すべて電源投入時の値のままです。',
      framesSome: (n: number) => `送信するメッセージ ${n} 件`,
      fileNote:
        'ファイルはそのまま再生します。ファイルが持つ GS 設定はそのまま効き、上のパネルの設定は別トラックとして一緒に送られます。',
    },
  }),
);

/** What the scope says when it has no render to show. */
const emptyLabel = computed(() => {
  if (props.status === 'rendering') return copy.value.rendering;
  if (props.status === 'error') return copy.value.error;
  return copy.value.idle;
});

/**
 * The render's own peak. The scope draws against it rather than against full
 * scale, because a module at its power-on levels leaves a flat line there and
 * the shape of the sound is the point of the display. The figure is printed
 * beside it so the scaling is stated rather than implied — the meters on the
 * strips are what read absolute level.
 */
const peak = computed(() =>
  props.waveform.reduce((most, point) => Math.max(most, point.max, -point.min), 0),
);

const peakLabel = computed(() =>
  peak.value > 0 ? `${amplitudeToDb(peak.value).toFixed(1)} dBFS` : '',
);

function token(name: string, fallback: string): string {
  const element = canvasRef.value;
  if (!element) return fallback;
  return getComputedStyle(element).getPropertyValue(name).trim() || fallback;
}

/**
 * Draw the render and the playhead over it. The waveform is redrawn with the
 * playhead rather than cached beside it — at this width it is nine hundred
 * strokes, which costs less than keeping two canvases in step.
 */
function draw(): void {
  const frame = prepareCanvas2D(canvasRef.value);
  if (!frame) return;
  const { ctx, width, height } = frame;
  ctx.clearRect(0, 0, width, height);

  const peaks = props.waveform;
  if (peaks.length === 0) return;

  const middle = height / 2;
  ctx.strokeStyle = token('--demo-border', 'rgba(128,128,128,0.3)');
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, middle);
  ctx.lineTo(width, middle);
  ctx.stroke();

  const scale = peak.value > 0 ? (middle * 0.94) / peak.value : middle;
  ctx.strokeStyle = token('--demo-accent', '#8B5CF6');
  ctx.lineWidth = Math.max(1, width / peaks.length - 0.4);
  ctx.beginPath();
  for (let i = 0; i < peaks.length; i++) {
    const x = ((i + 0.5) / peaks.length) * width;
    const top = middle - peaks[i].max * scale;
    const bottom = middle - peaks[i].min * scale;
    ctx.moveTo(x, top);
    ctx.lineTo(x, Math.max(bottom, top + 0.7));
  }
  ctx.stroke();

  if (!props.isPlaying) return;
  const x = props.playhead * width;
  ctx.strokeStyle = token('--demo-playhead', '#F59E0B');
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x, 0);
  ctx.lineTo(x, height);
  ctx.stroke();
}

let observer: ResizeObserver | null = null;

onMounted(() => {
  draw();
  if (typeof ResizeObserver === 'undefined' || !canvasRef.value) return;
  observer = new ResizeObserver(() => draw());
  observer.observe(canvasRef.value);
});

onBeforeUnmount(() => {
  observer?.disconnect();
  observer = null;
});

watch(() => [props.waveform, props.playhead, props.isPlaying], draw);

function onDrop(payload: DragEvent) {
  dragging.value = false;
  const file = payload.dataTransfer?.files?.[0];
  if (file) emit('drop', file);
}

/** A frame as the hex a reader can compare against the address table. */
function spell(event: SmfEvent): string {
  const bytes = event.sysex ? [0xf0, ...event.sysex] : (event.bytes ?? []);
  return bytes.map((byte) => byte.toString(16).toUpperCase().padStart(2, '0')).join(' ');
}
</script>

<template>
  <div class="gs-source">
    <div class="gs-scope">
      <canvas ref="canvasRef" class="gs-scope__canvas" :aria-label="copy.scope" role="img"></canvas>
      <span v-if="!props.waveform.length" class="gs-scope__empty">{{ emptyLabel }}</span>
      <span v-else class="gs-scope__peak">
        <b>{{ copy.peak }}</b>{{ peakLabel }}
      </span>
    </div>

    <div class="gs-source__side">
      <div
        class="gs-drop"
        :class="{ 'gs-drop--over': dragging }"
        @dragover.prevent="dragging = true"
        @dragleave="dragging = false"
        @drop.prevent="onDrop"
      >
        <template v-if="props.droppedFile">
          <span class="gs-drop__file">{{ props.droppedFile.name }}</span>
          <button type="button" class="gs-button" @click="emit('clearFile')">
            {{ copy.clear }}
          </button>
        </template>
        <span v-else class="gs-note">{{ dragging ? copy.dropHint : copy.builtIn }}</span>
      </div>

      <p v-if="props.droppedFile" class="gs-note">{{ copy.fileNote }}</p>

      <details v-if="props.frames.length" class="gs-details">
        <summary>{{ copy.framesSome(props.frames.length) }}</summary>
        <ol class="gs-details__list">
          <li v-for="(frame, index) in props.frames" :key="index" class="gs-value">
            {{ spell(frame) }}
          </li>
        </ol>
      </details>
      <p v-else class="gs-note">{{ copy.framesNone }}</p>
    </div>
  </div>
</template>
