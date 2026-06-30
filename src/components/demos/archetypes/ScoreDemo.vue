<script setup lang="ts">
/**
 * `score` archetype: a MIDI passage engraved as standard music notation.
 *
 * The same phrase the piano roll shows as a grid, this archetype reads as a grand
 * staff: melody and a broken-chord accompaniment on the treble staff (two voices),
 * the bass on the bass staff, with clefs, beamed eighths and a time signature
 * drawn by VexFlow. The notes come from the SHARED phrase the engine plays (see
 * midiPhrase) — switching the instrument re-voices the identical notes through a
 * different NativeSynth preset, and the tempo restretches the reading. Pressing
 * play bounces the passage and lights every sounding note the moment it plays, so
 * the score reads back in time with the audio.
 *
 * The notation is a visual enhancement: if VexFlow fails to engrave (e.g. fonts
 * unavailable), the demo still renders and auditions the audio.
 */
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useSonareDemoAudio } from '@/composables/useSonareDemoAudio';
import type { SonareDemoDef } from '@/demos/types';
import { useDemoChrome, useDemoParams } from '../composables';
import DemoControls from '../DemoControls.vue';
import DemoFrame from '../DemoFrame.vue';
import { renderScoreEngraving, type ScoreStaffMark, updateScoreHighlight } from './scoreEngraving';
import { renderScorePassage } from './scorePassage';

const props = defineProps<{ def: SonareDemoDef; active: boolean }>();

const { ensureWasm, play, playingId, progress } = useSonareDemoAudio();

const host = ref<HTMLDivElement | null>(null);
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

// ---- reader-adjustable parameters ------------------------------------------
const { values, updateParams } = useDemoParams(props.def);

const instrument = computed<string>(() => String(values.instrument ?? 'acoustic-piano'));
const tempo = computed<number>(() => Number(values.tempo ?? 96));

// ---- presentation state ----------------------------------------------------
const stateLabel = computed(() => {
  if (status.value === 'loading') return 'ENGRAVING';
  if (status.value === 'error') return 'ERROR';
  if (isPlaying.value) return `▸ ${Math.round(progress.value * 100)}%`;
  if (status.value === 'ready') return `GRAND STAFF · ${tempo.value} BPM`;
  return 'IDLE';
});

type WasmModule = Awaited<ReturnType<typeof ensureWasm>>;

let lastAudio: { samples: Float32Array; sampleRate: number } | null = null;
let audioDur = 0;
let marks: ScoreStaffMark[] = [];
let scoreRendered = false;

function updateHighlight(): void {
  updateScoreHighlight(marks, {
    playing: isPlaying.value,
    progress: progress.value,
    duration: audioDur,
    tempo: tempo.value,
  });
}

// ---- lifecycle -------------------------------------------------------------
let disposed = false;

async function compute(): Promise<void> {
  if (disposed) return;
  try {
    if (status.value === 'idle') status.value = 'loading';
    const wasm = await ensureWasm();
    if (disposed) return;
    const rendered = renderScorePassage(wasm as WasmModule, {
      instrument: instrument.value,
      tempo: tempo.value,
    });
    lastAudio = { samples: rendered.samples, sampleRate: rendered.sampleRate };
    audioDur = rendered.duration;
    // Engrave once — the notation does not change with instrument or tempo. A
    // render failure is non-fatal: the audio still plays.
    if (!scoreRendered && host.value) {
      try {
        marks = await renderScoreEngraving(host.value);
        scoreRendered = marks.length > 0;
      } catch (e) {
        console.warn('[ScoreDemo] notation render failed; audio only', e);
      }
    }
    if (disposed) return;
    status.value = 'ready';
  } catch (e) {
    if (disposed) return;
    fail(e);
  }
}

async function onPlay(): Promise<void> {
  if (!lastAudio) await compute();
  if (lastAudio) await play(props.def.id, lastAudio);
}

// Coalesce rapid changes (slider drags) into one re-bounce per frame. The score
// itself is engraved only once, so only the audio is re-rendered here.
let pending = 0;
function scheduleCompute(): void {
  if (pending) return;
  pending = requestAnimationFrame(() => {
    pending = 0;
    compute();
  });
}

watch(
  () => [instrument.value, tempo.value],
  () => {
    if (props.active) scheduleCompute();
  },
);

watch(progress, updateHighlight);
watch(isPlaying, (on) => {
  if (!on) updateHighlight();
});

watch(
  () => props.active,
  (on) => {
    if (on && status.value === 'idle') compute();
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  disposed = true;
  if (pending) cancelAnimationFrame(pending);
});
</script>

<template>
  <DemoFrame
    eyebrow="MIDI · SCORE"
    :title="title"
    :caption="caption"
    :state="stateLabel"
    :tone="tone"
    :playing="isPlaying"
    :progress="progress"
    :disabled="status === 'loading'"
    :error="status === 'error' ? errorMsg : null"
    loading-label="ENGRAVING…"
    :show-playhead="false"
    @toggle="onPlay"
  >
    <template #screen>
      <!-- The sheet is lifted above the screen's grid/scanlines/brackets, but kept
           below them while loading or on error so those overlays still read. -->
      <div class="sc-paper" :class="{ 'sc-paper--lifted': status !== 'loading' && status !== 'error' }">
        <span class="sc-tempo" aria-hidden="true">&#9833; = {{ tempo }}</span>
        <div ref="host" class="sc-engrave" role="img" :aria-label="title" />
      </div>
    </template>
    <template #controls>
      <DemoControls
        :model-value="values"
        :params="def.params ?? []"
        :locale="loc"
        :disabled="status === 'loading'"
        @update:model-value="updateParams"
      />
    </template>
  </DemoFrame>
</template>

<style scoped>
/* A sheet of warm manuscript paper set into the dark instrument screen — the
   engraving reads as printed sheet music rather than a glowing readout. */
.sc-paper {
  position: absolute;
  inset: 0;
  box-sizing: border-box;
  background:
    radial-gradient(120% 130% at 50% -10%, rgba(255, 253, 246, 0.95), rgba(255, 253, 246, 0) 58%),
    radial-gradient(150% 150% at 50% 125%, rgba(120, 92, 44, 0.12), rgba(120, 92, 44, 0) 55%),
    linear-gradient(180deg, #f7f2e6 0%, #f1e9d8 100%);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.7),
    inset 0 0 0 1px rgba(58, 46, 28, 0.10),
    inset 0 -22px 46px -30px rgba(72, 54, 24, 0.55);
}
/* Lift the page above the screen's grid, scanlines and corner brackets. */
.sc-paper--lifted {
  z-index: 3;
}
/* Faint laid-paper grain. */
.sc-paper::before {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  background-image: repeating-linear-gradient(90deg, rgba(80, 60, 30, 0.035) 0 1px, transparent 1px 3px);
  opacity: 0.6;
  mix-blend-mode: multiply;
}
/* A thin engraver's keyline just inside the page edge. */
.sc-paper::after {
  content: '';
  position: absolute;
  inset: 7px;
  pointer-events: none;
  border: 1px solid rgba(58, 46, 28, 0.13);
  border-radius: 2px;
}
.sc-tempo {
  position: absolute;
  top: 8px;
  left: 18px;
  z-index: 2;
  font-family: var(--font-reading), Georgia, serif;
  font-style: italic;
  font-size: clamp(11px, 1.5vw, 14px);
  letter-spacing: 0.02em;
  color: #5c4f37;
}
/* A definite box below the tempo marking; the SVG fills it and preserveAspectRatio
   "meet" (the default) scales the engraving to fit fully — never clipped. */
.sc-engrave {
  position: absolute;
  top: 28px;
  left: 18px;
  right: 18px;
  bottom: 14px;
  z-index: 1;
}
.sc-engrave :deep(svg) {
  width: 100%;
  height: 100%;
  display: block;
  /* Soft fade-in once the engraving is in place, unless the reader opts out. */
  animation: sc-fade 560ms ease both;
}
/* Gentle breathing glow on the sounding-note halo. */
.sc-engrave :deep(.sc-glow) {
  animation: sc-breathe 1.5s ease-in-out infinite;
  transform-box: fill-box;
  transform-origin: center;
}
@keyframes sc-fade {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes sc-breathe {
  0%, 100% { opacity: 0.55; }
  50% { opacity: 1; }
}
@media (prefers-reduced-motion: reduce) {
  .sc-engrave :deep(svg),
  .sc-engrave :deep(.sc-glow) {
    animation: none;
  }
}
</style>
