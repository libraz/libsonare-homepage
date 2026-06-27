<script setup lang="ts">
/**
 * `true-peak` archetype: why a signal can clip on playback while every stored
 * sample sits under 0 dBFS.
 *
 * A sine is drawn as the continuous, band-limited waveform a converter actually
 * reconstructs, with the stored sample points marked on top. The samples are
 * aligned worst-case — the true peak falls exactly between two of them — so as the
 * frequency climbs toward Nyquist the samples land further down the slope and the
 * reconstructed curve rises higher above them. When the highest sample is pushed to
 * full scale, the inter-sample peak pokes above 0 dBFS: silent in the numbers, a
 * clip on playback. Everything is computed in-browser; no clip or WASM.
 */
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { useSonareDemoAudio } from '@/composables/useSonareDemoAudio';
import { type DemoLocale, localized, type SonareDemoDef } from '@/demos/types';
import DemoControls from '../DemoControls.vue';
import DemoFrame from '../DemoFrame.vue';

const props = defineProps<{ def: SonareDemoDef; active: boolean }>();

const { locale } = useI18n();
const { play, playingId, progress } = useSonareDemoAudio();

const loc = computed<DemoLocale>(() => locale.value);
const title = computed(() => localized(props.def.title, loc.value));
const caption = computed(() => localized(props.def.caption, loc.value));

const canvas = ref<HTMLCanvasElement | null>(null);
const status = ref<'idle' | 'ready' | 'error'>('idle');
const errorMsg = ref('');
const isPlaying = computed(() => playingId.value === props.def.id);

// ---- reader-adjustable parameters ------------------------------------------
type ParamValue = number | string | boolean;
const values = reactive<Record<string, ParamValue>>({});
for (const p of props.def.params ?? []) values[p.key] = p.default;
function onParams(next: Record<string, ParamValue>): void {
  Object.assign(values, next);
}

// `level` is the sample peak in dBFS (what a sample meter reads); `nyq` is the tone
// frequency as a fraction of Nyquist (closer to 1 → fewer samples per cycle).
const sampleDb = computed<number>(() => Number(values.level ?? -0.3));
const nyq = computed<number>(() => Number(values.nyquist ?? 0.4));

// Half the sample spacing in phase, i.e. the phase from a sample to the true peak
// under worst-case alignment. cos(theta) = sample peak / true peak.
const theta = computed<number>(() => (Math.PI / 2) * nyq.value);
const sampleLin = computed<number>(() => 10 ** (sampleDb.value / 20));
const trueLin = computed<number>(() => sampleLin.value / Math.max(1e-3, Math.cos(theta.value)));
const trueDb = computed<number>(() => 20 * Math.log10(trueLin.value));

// ---- presentation state ----------------------------------------------------
const tone = computed(() => {
  if (status.value === 'error') return 'error' as const;
  if (isPlaying.value) return 'playing' as const;
  if (status.value === 'ready') return 'ready' as const;
  return 'idle' as const;
});
const clips = computed(() => trueDb.value > 0);
const stateLabel = computed(() => {
  if (status.value === 'error') return 'ERROR';
  if (isPlaying.value) return `▸ ${Math.round(progress.value * 100)}%`;
  if (status.value === 'ready') {
    const sign = trueDb.value >= 0 ? '+' : '';
    return `TP ${sign}${trueDb.value.toFixed(1)} dBTP`;
  }
  return 'IDLE';
});

function markReady(): void {
  status.value = 'ready';
  startMorph();
}

// ---- morph + paint ---------------------------------------------------------
// Only two scalars drive the picture, so the morph eases them rather than arrays.
let rafId = 0;
const dispTheta = ref(0);
const dispAmp = ref(0);
function startMorph(): void {
  if (rafId) return;
  const step = () => {
    const dt = theta.value - dispTheta.value;
    const da = trueLin.value - dispAmp.value;
    dispTheta.value += dt * 0.28;
    dispAmp.value += da * 0.28;
    paint();
    if (Math.abs(dt) > 0.0008 || Math.abs(da) > 0.0008) {
      rafId = requestAnimationFrame(step);
    } else {
      dispTheta.value = theta.value;
      dispAmp.value = trueLin.value;
      paint();
      rafId = 0;
    }
  };
  rafId = requestAnimationFrame(step);
}
function stopMorph(): void {
  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = 0;
  }
}

const CYCLES = 2.4; // cycles of the tone shown across the panel
const VRANGE = 1.18; // vertical half-range in linear amplitude (room above 0 dBFS)

function paint(): void {
  const el = canvas.value;
  if (!el) return;
  const w = el.clientWidth;
  const h = el.clientHeight;
  if (w === 0 || h === 0) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  if (el.width !== Math.round(w * dpr) || el.height !== Math.round(h * dpr)) {
    el.width = Math.round(w * dpr);
    el.height = Math.round(h * dpr);
  }
  const ctx = el.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  const padX = 18;
  const innerW = w - padX * 2;
  const mid = h / 2;
  const ampPx = (h / 2 - 10) / VRANGE;
  const yAt = (v: number): number => mid - v * ampPx;

  const th = dispTheta.value;
  const amp = dispAmp.value;
  // Phase span: CYCLES cycles centered on a peak (phase 0 at center).
  const halfSpan = CYCLES * Math.PI;
  const phaseAt = (x01: number): number => (x01 - 0.5) * 2 * halfSpan;

  // 0 dBFS ceiling/floor.
  ctx.strokeStyle = 'rgba(255, 184, 108, 0.55)';
  ctx.setLineDash([4, 3]);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padX, yAt(1));
  ctx.lineTo(padX + innerW, yAt(1));
  ctx.moveTo(padX, yAt(-1));
  ctx.lineTo(padX + innerW, yAt(-1));
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.font = '9px "JetBrains Mono", ui-monospace, monospace';
  ctx.fillStyle = 'rgba(255, 184, 108, 0.7)';
  ctx.textBaseline = 'bottom';
  ctx.fillText('0 dBFS', padX, yAt(1) - 2);

  // Continuous reconstructed waveform: amp * cos(phase). Highlight the overshoot
  // segments (where the curve rises above the highest stored sample).
  const sampleMax = amp * Math.cos(th);
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#2dd4bf';
  ctx.shadowColor = 'rgba(45, 212, 191, 0.6)';
  ctx.shadowBlur = 6;
  ctx.beginPath();
  const N = 260;
  for (let i = 0; i <= N; i++) {
    const x = padX + (i / N) * innerW;
    const v = amp * Math.cos(phaseAt(i / N));
    const y = yAt(v);
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Overshoot fill: the cap of each peak above the sample-peak line.
  ctx.fillStyle = clips.value ? 'rgba(248, 113, 113, 0.32)' : 'rgba(255, 184, 108, 0.28)';
  for (let c = -CYCLES; c <= CYCLES; c++) {
    const centerPhase = c * 2 * Math.PI;
    if (Math.abs(centerPhase) > halfSpan) continue;
    ctx.beginPath();
    let started = false;
    for (let i = 0; i <= N; i++) {
      const ph = phaseAt(i / N);
      const v = amp * Math.cos(ph);
      if (v >= sampleMax && Math.abs(ph - centerPhase) < Math.PI) {
        const x = padX + (i / N) * innerW;
        if (!started) {
          ctx.moveTo(x, yAt(sampleMax));
          started = true;
        }
        ctx.lineTo(x, yAt(v));
      }
    }
    if (started) {
      // close along the sample-peak line
      ctx.lineTo(padX + innerW, yAt(sampleMax));
      ctx.lineTo(padX, yAt(sampleMax));
      ctx.closePath();
      ctx.fill();
    }
  }

  // Stored samples: dots at t_k = (k + 0.5) sample offsets from the peak, so the
  // peak always falls midway between two of them (worst case).
  const samplePhaseStep = 2 * th; // phase between adjacent samples
  ctx.fillStyle = '#a78bfa';
  ctx.shadowColor = 'rgba(167, 139, 250, 0.8)';
  ctx.shadowBlur = 5;
  for (let k = -200; k <= 200; k++) {
    const ph = (k + 0.5) * samplePhaseStep;
    if (Math.abs(ph) > halfSpan) continue;
    const x01 = ph / (2 * halfSpan) + 0.5;
    const x = padX + x01 * innerW;
    const v = amp * Math.cos(ph);
    const y = yAt(v);
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fill();
    // stem to baseline
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(167, 139, 250, 0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, mid);
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.shadowBlur = 5;
  }
  ctx.shadowBlur = 0;

  // sample-peak guide
  ctx.strokeStyle = 'rgba(167, 139, 250, 0.5)';
  ctx.setLineDash([2, 3]);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padX, yAt(sampleMax));
  ctx.lineTo(padX + innerW, yAt(sampleMax));
  ctx.stroke();
  ctx.setLineDash([]);

  // labels
  ctx.textBaseline = 'top';
  ctx.fillStyle = 'rgba(186, 230, 224, 0.55)';
  ctx.fillText('RECONSTRUCTED WAVEFORM', padX, 6);
  ctx.textAlign = 'right';
  ctx.fillStyle = clips.value ? '#fca5a5' : 'rgba(186, 230, 224, 0.7)';
  ctx.fillText(
    `SAMPLE ${sampleDb.value.toFixed(1)} dBFS · TRUE ${trueDb.value >= 0 ? '+' : ''}${trueDb.value.toFixed(1)} dBTP`,
    padX + innerW,
    6,
  );
  ctx.textAlign = 'left';
}

// ---- audition: play the tone at the stored sample level (safe, ≤ 0 dBFS) ----
function buildAudio(): { samples: Float32Array; sampleRate: number } {
  const sampleRate = 44100;
  const dur = 1.4;
  const n = Math.round(sampleRate * dur);
  const out = new Float32Array(n);
  const f = 660; // a comfortable audible tone; the overshoot itself is inaudible
  const a = sampleLin.value;
  for (let i = 0; i < n; i++) {
    const env = Math.min(1, i / 600, (n - i) / 600);
    out[i] = a * env * Math.sin((2 * Math.PI * f * i) / sampleRate);
  }
  return { samples: out, sampleRate };
}
async function onPlay(): Promise<void> {
  await play(props.def.id, buildAudio());
}

let pending = 0;
function scheduleCompute(): void {
  if (pending) return;
  pending = requestAnimationFrame(() => {
    pending = 0;
    if (status.value === 'idle') status.value = 'ready';
    startMorph();
  });
}

watch(
  () => [sampleDb.value, nyq.value],
  () => {
    if (props.active) scheduleCompute();
  },
);
watch(
  () => props.active,
  (on) => {
    if (on && status.value === 'idle') {
      dispTheta.value = theta.value;
      dispAmp.value = trueLin.value;
      markReady();
    }
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  stopMorph();
  if (pending) cancelAnimationFrame(pending);
});
</script>

<template>
  <DemoFrame
    eyebrow="LOUDNESS · TRUE PEAK"
    :title="title"
    :caption="caption"
    :state="stateLabel"
    :tone="tone"
    :playing="isPlaying"
    :progress="progress"
    :error="status === 'error' ? errorMsg : null"
    :show-playhead="isPlaying"
    @toggle="onPlay"
  >
    <template #screen>
      <canvas ref="canvas" class="tp-canvas" />
    </template>
    <template #controls>
      <DemoControls
        :model-value="values"
        :params="def.params ?? []"
        :locale="loc"
        @update:model-value="onParams"
      />
    </template>
  </DemoFrame>
</template>

<style scoped>
.tp-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
}
</style>
