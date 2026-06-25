<script setup lang="ts">
/**
 * `send-routing` archetype: the pre-fader vs post-fader send, the most common
 * routing mistake, made obvious.
 *
 * One channel feeds two sends and the main output. The reader drags the channel
 * fader: the POST-fader send and the MAIN output track it down, while the PRE-fader
 * send is tapped before the fader and stays put. The meters show it; pressing play
 * makes it audible — the dry signal (post-fader) fades with the fader while the
 * pre-fader send (standing in for a reverb/aux return) keeps sounding even with the
 * fader all the way down. Everything is synthesized in-browser; no clip or WASM.
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

const loc = computed<DemoLocale>(() => (locale.value.startsWith('ja') ? 'ja' : 'en'));
const title = computed(() => localized(props.def.title, loc.value));
const caption = computed(() => localized(props.def.caption, loc.value));

const canvas = ref<HTMLCanvasElement | null>(null);
const status = ref<'idle' | 'ready'>('idle');
const isPlaying = computed(() => playingId.value === props.def.id);

// ---- reader-adjustable parameters ------------------------------------------
type ParamValue = number | string | boolean;
const values = reactive<Record<string, ParamValue>>({});
for (const p of props.def.params ?? []) values[p.key] = p.default;
function onParams(next: Record<string, ParamValue>): void {
  Object.assign(values, next);
}

const faderDb = computed<number>(() => Number(values.fader ?? 0));
const faderLin = computed<number>(() => (faderDb.value <= -40 ? 0 : 10 ** (faderDb.value / 20)));

const SOURCE_LIN = 0.8; // the channel's pre-fader signal level (fixed)
const PRE_LIN = SOURCE_LIN * 0.7; // pre-fader send: tapped before the fader → fixed

// ---- presentation state ----------------------------------------------------
const tone = computed(() => {
  if (isPlaying.value) return 'playing' as const;
  if (status.value === 'ready') return 'ready' as const;
  return 'idle' as const;
});
const stateLabel = computed(() => {
  if (isPlaying.value) return `▸ ${Math.round(progress.value * 100)}%`;
  if (status.value === 'ready')
    return `FADER ${faderDb.value <= -40 ? '-∞' : `${faderDb.value} dB`}`;
  return 'IDLE';
});

// ---- morph + paint ---------------------------------------------------------
let rafId = 0;
const dispFader = ref(1);
function startMorph(): void {
  if (rafId) return;
  const step = () => {
    const d = faderLin.value - dispFader.value;
    dispFader.value += d * 0.3;
    paint();
    if (Math.abs(d) > 0.001) {
      rafId = requestAnimationFrame(step);
    } else {
      dispFader.value = faderLin.value;
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

interface Bar {
  label: string;
  level: number;
  fixed: boolean;
}

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
  ctx.font = '9px "JetBrains Mono", ui-monospace, monospace';

  const f = dispFader.value;
  const bars: Bar[] = [
    { label: 'PRE SEND', level: PRE_LIN, fixed: true },
    { label: 'POST SEND', level: SOURCE_LIN * f, fixed: false },
    { label: 'MAIN OUT', level: SOURCE_LIN * f, fixed: false },
  ];

  // Routing schematic on the left: channel → fader → main, with the two taps.
  const colX = w * 0.07;
  const top = 18;
  const bot = h - 22;
  ctx.strokeStyle = 'rgba(186, 230, 224, 0.4)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(colX, top);
  ctx.lineTo(colX, bot);
  ctx.stroke();
  // fader knob position along the channel
  const knobY = top + (1 - Math.max(0, Math.min(1, (faderDb.value + 40) / 46))) * (bot - top);
  ctx.fillStyle = '#2dd4bf';
  ctx.shadowColor = 'rgba(45, 212, 191, 0.8)';
  ctx.shadowBlur = 6;
  ctx.fillRect(colX - 9, knobY - 3, 18, 6);
  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(186, 230, 224, 0.55)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('CH', colX, bot + 4);
  // pre tap (above fader), post tap (below fader)
  ctx.fillStyle = 'rgba(167, 139, 250, 0.85)';
  ctx.beginPath();
  ctx.arc(colX, top + 6, 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(45, 212, 191, 0.85)';
  ctx.beginPath();
  ctx.arc(colX, bot - 6, 2.5, 0, Math.PI * 2);
  ctx.fill();

  // Meter bars on the right.
  const baseX = w * 0.26;
  const slotW = (w - baseX - 16) / bars.length;
  const barW = Math.min(58, slotW * 0.5);
  ctx.textBaseline = 'bottom';
  for (let i = 0; i < bars.length; i++) {
    const b = bars[i];
    const cx = baseX + slotW * (i + 0.5);
    const x = cx - barW / 2;
    const fillH = Math.max(0, Math.min(1, b.level / SOURCE_LIN)) * (bot - top);
    // track
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.fillRect(x, top, barW, bot - top);
    // fill
    const grad = ctx.createLinearGradient(0, bot, 0, top);
    if (b.fixed) {
      grad.addColorStop(0, 'rgba(124, 100, 220, 0.5)');
      grad.addColorStop(1, 'rgba(167, 139, 250, 0.95)');
    } else {
      grad.addColorStop(0, 'rgba(20, 130, 120, 0.5)');
      grad.addColorStop(1, 'rgba(45, 212, 191, 0.95)');
    }
    ctx.fillStyle = grad;
    ctx.fillRect(x, bot - fillH, barW, fillH);
    // outline
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, top + 0.5, barW - 1, bot - top - 1);
    // label + tag
    ctx.fillStyle = b.fixed ? 'rgba(167, 139, 250, 0.95)' : 'rgba(45, 212, 191, 0.95)';
    ctx.textAlign = 'center';
    ctx.fillText(b.label, cx, bot + 13);
    ctx.fillStyle = 'rgba(186, 230, 224, 0.5)';
    ctx.fillText(b.fixed ? 'fixed' : 'tracks fader', cx, top - 2);
  }
  ctx.textAlign = 'left';
}

// ---- audition: dry (post-fader) + a constant pre-fader send ----------------
function buildAudio(): { samples: Float32Array; sampleRate: number } {
  const sampleRate = 44100;
  const dur = 1.8;
  const n = Math.round(sampleRate * dur);
  const out = new Float32Array(n);
  const f = faderLin.value;
  for (let i = 0; i < n; i++) {
    const env = Math.min(1, i / 1200, (n - i) / 1200);
    const t = i / sampleRate;
    // Dry channel = a 220 Hz tone scaled by the fader (post-fader path).
    const dry = Math.sin(2 * Math.PI * 220 * t) * 0.5 * f;
    // Pre-fader send = a soft, constant detuned pad standing in for a reverb/aux
    // return; it does NOT scale with the fader.
    const pre =
      (Math.sin(2 * Math.PI * 330 * t) + Math.sin(2 * Math.PI * 332.5 * t)) *
      0.12 *
      (PRE_LIN / 0.56);
    out[i] = env * (dry + pre);
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
  () => faderDb.value,
  () => {
    if (props.active) scheduleCompute();
  },
);
watch(
  () => props.active,
  (on) => {
    if (on && status.value === 'idle') {
      dispFader.value = faderLin.value;
      status.value = 'ready';
      startMorph();
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
    eyebrow="MIXER · SENDS"
    :title="title"
    :caption="caption"
    :state="stateLabel"
    :tone="tone"
    :playing="isPlaying"
    :progress="progress"
    :show-playhead="isPlaying"
    @toggle="onPlay"
  >
    <template #screen>
      <canvas ref="canvas" class="sr-canvas" />
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
.sr-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
}
</style>
