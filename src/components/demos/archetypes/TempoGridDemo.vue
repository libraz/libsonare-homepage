<script setup lang="ts">
/**
 * `tempo-grid` archetype: see and hear how tempo maps musical time onto seconds.
 *
 * The seconds axis is fixed. The bar/beat grid is computed from the BPM and the
 * beats-per-bar, so dragging the tempo slides the grid: faster tempo packs more bars
 * into the same six seconds, slower tempo spreads them out. The readout shows the
 * derived durations — one bar, one beat, and one tick at a fixed PPQ of 480, the
 * resolution libsonare uses for MIDI timing. Pressing play auditions a metronome at
 * the chosen tempo (accented downbeats), so the grid you see is the click you hear.
 *
 * Pure JS — no WASM. The lesson is the tempo→seconds mapping, not a transform.
 */
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useSonareDemoAudio } from '@/composables/useSonareDemoAudio';
import { type TempoGrid, tempoGrid } from '@/demos/audio/processors';
import type { SonareDemoDef } from '@/demos/types';
import { prepareCanvas2D } from '../canvas';
import { useDemoChrome, useDemoParams } from '../composables';
import DemoControls from '../DemoControls.vue';
import DemoFrame from '../DemoFrame.vue';

const props = defineProps<{ def: SonareDemoDef; active: boolean }>();

const { play, playingId, progress } = useSonareDemoAudio();

const canvas = ref<HTMLCanvasElement | null>(null);
const isPlaying = computed(() => playingId.value === props.def.id);
const { locale: loc, title, caption, status, tone } = useDemoChrome(props.def, isPlaying);

// ---- reader-adjustable parameters ------------------------------------------
const { values, updateParams } = useDemoParams(props.def);

const PPQ = 480; // libsonare's pulses-per-quarter resolution for MIDI timing
const SPAN_SEC = 6; // fixed width of the seconds axis

const bpm = computed<number>(() => Number(values.bpm ?? 120));
const grid = computed<TempoGrid>(() => tempoGrid(bpm.value, String(values.beats ?? '4')));
const beatsPerBar = computed<number>(() => grid.value.beatsPerBar);
const secPerBeat = computed<number>(() => grid.value.secPerBeat);
const secPerBar = computed<number>(() => grid.value.secPerBar);

const stateLabel = computed(() => {
  if (isPlaying.value) return `▸ ${Math.round(progress.value * 100)}%`;
  if (status.value !== 'ready') return 'IDLE';
  return `${secPerBar.value.toFixed(2)} s/bar`;
});

// ---- grid morph (ease the beat spacing so a tempo change slides) -----------
const SR = 44100;
let dispSpb = 0.5; // displayed seconds-per-beat, eased toward the target
const reveal = ref(0);

function compute(): void {
  if (dispSpb <= 0) dispSpb = secPerBeat.value;
  status.value = 'ready';
  startMorph();
}

let rafId = 0;
function startMorph(): void {
  if (rafId) return;
  const step = () => {
    let delta = 0;
    if (reveal.value < 1) {
      reveal.value = Math.min(1, reveal.value + 0.1);
      delta = Math.max(delta, 1 - reveal.value);
    }
    const d = secPerBeat.value - dispSpb;
    dispSpb += d * 0.26;
    delta = Math.max(delta, Math.abs(d) / SPAN_SEC);
    paint();
    if (delta > 0.0008) {
      rafId = requestAnimationFrame(step);
    } else {
      dispSpb = secPerBeat.value;
      paint();
      rafId = 0;
    }
  };
  rafId = requestAnimationFrame(step);
}

let playRaf = 0;
watch(isPlaying, (on) => {
  if (on && !playRaf) {
    const stepFn = () => {
      paint();
      playRaf = isPlaying.value ? requestAnimationFrame(stepFn) : 0;
    };
    playRaf = requestAnimationFrame(stepFn);
  }
});

function paint(): void {
  const frame = prepareCanvas2D(canvas.value);
  if (!frame) return;
  const { ctx, width: w, height: h } = frame;

  const padX = 16;
  const innerW = w - padX * 2;
  const xOf = (sec: number) => padX + (sec / SPAN_SEC) * innerW;
  const mono = '9px "JetBrains Mono", ui-monospace, monospace';

  // --- top lane: fixed SECONDS axis (the constant reference) ---
  const secY = h * 0.2;
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.45)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padX, secY + 0.5);
  ctx.lineTo(padX + innerW, secY + 0.5);
  ctx.stroke();
  ctx.font = mono;
  ctx.fillStyle = 'rgba(186, 230, 224, 0.55)';
  ctx.textBaseline = 'bottom';
  ctx.textAlign = 'left';
  for (let s = 0; s <= SPAN_SEC; s++) {
    const x = xOf(s);
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.45)';
    ctx.beginPath();
    ctx.moveTo(x, secY - 4);
    ctx.lineTo(x, secY + 4);
    ctx.stroke();
    ctx.textAlign = s === SPAN_SEC ? 'right' : 'left';
    ctx.fillText(`${s}s`, s === SPAN_SEC ? x : x + 3, secY - 5);
  }
  ctx.textAlign = 'left';

  // --- middle lane: MUSICAL GRID derived from tempo (bars + beats) ---
  const gridTop = h * 0.34;
  const gridBot = h * 0.74;
  const spb = dispSpb;
  const beats = beatsPerBar.value;
  const spbar = spb * beats;

  // Alternating bar blocks with bar numbers.
  let bar = 0;
  for (let t = 0; t < SPAN_SEC - 1e-6; t += spbar) {
    const x0 = xOf(t);
    const x1 = xOf(Math.min(SPAN_SEC, t + spbar));
    if (bar % 2 === 1) {
      ctx.fillStyle = 'rgba(45, 212, 191, 0.07)';
      ctx.fillRect(x0, gridTop, x1 - x0, gridBot - gridTop);
    }
    ctx.fillStyle = 'rgba(94, 234, 212, 0.8)';
    ctx.font = mono;
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    if (x1 - x0 > 14) ctx.fillText(`${bar + 1}`, x0 + 3, gridTop + 3);
    bar++;
  }

  // Beat lines: bar starts thick/teal, inner beats thin/slate.
  let beatIndex = 0;
  for (let t = 0; t < SPAN_SEC + 1e-6; t += spb) {
    const x = xOf(Math.min(SPAN_SEC, t));
    const onBar = beatIndex % beats === 0;
    ctx.strokeStyle = onBar ? 'rgba(45, 212, 191, 0.8)' : 'rgba(148, 163, 184, 0.32)';
    ctx.lineWidth = onBar ? 1.8 : 1;
    ctx.beginPath();
    ctx.moveTo(x, gridTop);
    ctx.lineTo(x, gridBot);
    ctx.stroke();
    beatIndex++;
  }

  // Reveal fade: dim the grid in on first show.
  if (reveal.value < 1) {
    ctx.fillStyle = `rgba(17, 24, 39, ${1 - reveal.value})`;
    ctx.fillRect(padX, gridTop, innerW, gridBot - gridTop);
  }

  // Playhead beam over the fixed seconds axis during playback.
  if (isPlaying.value) {
    const bx = xOf(progress.value * SPAN_SEC);
    ctx.strokeStyle = 'rgba(94, 234, 212, 0.9)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(bx, secY - 6);
    ctx.lineTo(bx, gridBot);
    ctx.stroke();
  }

  // --- lane labels + derived readout ---
  ctx.font = mono;
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(186, 230, 224, 0.5)';
  ctx.fillText('SECONDS', padX, 4);
  ctx.fillStyle = 'rgba(94, 234, 212, 0.7)';
  ctx.fillText(`MUSICAL GRID · ${grid.value.label}`, padX, gridTop - 13);

  // A tick is 1/PPQ of a quarter note, independent of the beat unit.
  const tickUs = (grid.value.secPerQuarter / PPQ) * 1e6;
  ctx.fillStyle = 'rgba(186, 230, 224, 0.62)';
  ctx.fillText(
    `1 bar = ${secPerBar.value.toFixed(2)} s   1 beat = ${(secPerBeat.value * 1000).toFixed(0)} ms   1 tick = ${tickUs.toFixed(0)} µs   PPQ ${PPQ}`,
    padX,
    gridBot + 8,
  );
}

// ---- audition: a metronome at the chosen tempo -----------------------------
function buildClicks(): Float32Array {
  const out = new Float32Array(Math.round(SR * SPAN_SEC));
  const spb = secPerBeat.value;
  const beats = beatsPerBar.value;
  const clickLen = Math.round(0.05 * SR);
  let beatIndex = 0;
  for (let t = 0; t < SPAN_SEC - 1e-6; t += spb) {
    const accent = beatIndex % beats === 0;
    const f = accent ? 1760 : 1175; // A6 downbeat vs D6 beat
    const amp = accent ? 0.8 : 0.42;
    const start = Math.round(t * SR);
    for (let i = 0; i < clickLen && start + i < out.length; i++) {
      const env = Math.exp(-i / (SR * 0.012)); // ~12 ms decay
      out[start + i] += amp * env * Math.sin(2 * Math.PI * f * (i / SR));
    }
    beatIndex++;
  }
  return out;
}

async function onPlay(): Promise<void> {
  await play(props.def.id, { samples: buildClicks(), sampleRate: SR });
}

let pending = 0;
function scheduleCompute(): void {
  if (pending) return;
  pending = requestAnimationFrame(() => {
    pending = 0;
    compute();
  });
}

watch([bpm, beatsPerBar], () => {
  if (props.active && status.value !== 'idle') scheduleCompute();
});

watch(
  () => props.active,
  (on) => {
    if (on && status.value === 'idle') compute();
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  if (rafId) cancelAnimationFrame(rafId);
  if (playRaf) cancelAnimationFrame(playRaf);
  if (pending) cancelAnimationFrame(pending);
});
</script>

<template>
  <DemoFrame
    eyebrow="TIMING · TEMPO GRID"
    :title="title"
    :caption="caption"
    :state="stateLabel"
    :tone="tone"
    :playing="isPlaying"
    :progress="progress"
    :show-playhead="false"
    @toggle="onPlay"
  >
    <template #screen>
      <canvas ref="canvas" class="tg-canvas" />
    </template>
    <template #controls>
      <DemoControls
        :disabled="isPlaying"
        :model-value="values"
        :params="def.params ?? []"
        :locale="loc"
        @update:model-value="updateParams"
      />
    </template>
  </DemoFrame>
</template>

<style scoped>
.tg-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
}
</style>
