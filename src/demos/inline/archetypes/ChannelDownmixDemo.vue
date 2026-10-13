<script setup lang="ts">
/**
 * `channel-downmix` archetype: a 5.1 bed folded by the engine's `downmix`.
 *
 * Six planar channels, each with its own roll-call sound and then one shared
 * in-phase sine, go through `downmix(channels, target)` unchanged. The meters
 * read the fold as the engine returns it, so an in-phase source visibly lands
 * above 0 dBFS; only the audition copy is normalized. The per-channel gains
 * drawn on the flow lines are measured from the engine with one unit channel
 * at a time, not written down here.
 */
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue';
import DemoNotice from '@/components/ui/DemoNotice.vue';
import { type I18nText, localized, type SonareDemoDef } from '@/demos/inline/types';
import { useSonareDemoAudio } from '@/demos/inline/useSonareDemoAudio';
import { prepareCanvas2D } from '@/utils/canvas';
import { useCanvasRedraw, useDemoChrome, useDemoParams, useDisposed } from '../composables';
import DemoControls from '../DemoControls.vue';
import DemoFrame from '../DemoFrame.vue';
import {
  buildSurroundSource,
  channelPeaks,
  DOWNMIX_SAMPLE_RATE,
  DOWNMIX_TARGETS,
  type DownmixTarget,
  normalizeForListening,
  peakEnvelope,
  SURROUND_51_ROLES,
  type SurroundTimeline,
  surroundTimeline,
  toDbfs,
} from './channelDownmixSignal';

const props = defineProps<{ def: SonareDemoDef; active: boolean }>();

const { ensureWasm, play, stop, playingId, progress } = useSonareDemoAudio();
const isDisposed = useDisposed();

const canvas = ref<HTMLCanvasElement | null>(null);
const isPlaying = computed(() => playingId.value === props.def.id);
const {
  locale: loc,
  title,
  caption,
  status,
  tone,
  errorMsg,
  fail,
} = useDemoChrome(props.def, isPlaying);
const { values, updateParams } = useDemoParams(props.def);

const BLOCK = 512;
const METER_MAX = 3;
/** Audition ceiling: -1 dBFS. */
const LISTEN_CEILING = 10 ** (-1 / 20);

const target = computed<DownmixTarget>(() => (values.target === 'mono' ? 'mono' : 'stereo'));
const levelDb = computed(() => Math.max(-24, Math.min(0, Number(values.level ?? 0))));
const level = computed(() => 10 ** (levelDb.value / 20));
const enabled = reactive<boolean[]>(SURROUND_51_ROLES.map(() => true));

const COPY = {
  hint: {
    en: 'Click a speaker to switch its channel on or off. Playback is normalized to −1 dBFS for listening; the meters show the fold as downmix returns it.',
    ja: 'スピーカーをクリックすると、そのチャンネルをオン／オフできます。再生は聴きやすいように −1 dBFS へ正規化しますが、メーターは downmix が返したままのピークを示します。',
  },
  on: { en: 'on', ja: 'オン' },
  off: { en: 'off', ja: 'オフ' },
  peak: { en: 'Folded peak', ja: 'ダウンミックス後のピーク' },
} satisfies Record<string, I18nText>;
const text = (key: keyof typeof COPY) => localized(COPY[key], loc.value);

// ---- engine results -------------------------------------------------------
interface FoldResult {
  target: DownmixTarget;
  folded: Float32Array[];
  peaks: number[];
  outEnvelopes: Float32Array[];
  inEnvelopes: Float32Array[];
  /** gains[input][output], measured from the engine with a unit channel. */
  gains: number[][];
}
const result = ref<FoldResult | null>(null);
const timeline: SurroundTimeline = surroundTimeline(DOWNMIX_SAMPLE_RATE);
const outputNames = computed(() => (target.value === 'mono' ? ['M'] : ['L', 'R']));
const peakMax = computed(() => Math.max(0, ...(result.value?.peaks ?? [0])));

const gainCache = new Map<DownmixTarget, number[][]>();
type Wasm = Awaited<ReturnType<typeof ensureWasm>>;
function measureGains(wasm: Wasm, layout: DownmixTarget): number[][] {
  const cached = gainCache.get(layout);
  if (cached) return cached;
  const gains = SURROUND_51_ROLES.map((_, input) => {
    const probe = SURROUND_51_ROLES.map((__, i) => new Float32Array(1).fill(i === input ? 1 : 0));
    return wasm.downmix(probe, DOWNMIX_TARGETS[layout]).map((plane) => plane[0]);
  });
  gainCache.set(layout, gains);
  return gains;
}

let computeSeq = 0;
async function compute(): Promise<void> {
  const seq = ++computeSeq;
  if (!result.value) status.value = 'loading';
  try {
    const wasm = await ensureWasm();
    if (isDisposed() || seq !== computeSeq) return;
    const source = buildSurroundSource({ level: level.value, enabled: [...enabled] });
    const layout = target.value;
    const folded = wasm.downmix(source, DOWNMIX_TARGETS[layout]);
    result.value = {
      target: layout,
      folded,
      peaks: channelPeaks(folded),
      outEnvelopes: folded.map((plane) => peakEnvelope(plane, BLOCK)),
      inEnvelopes: source.map((plane) => peakEnvelope(plane, BLOCK)),
      gains: measureGains(wasm, layout),
    };
    status.value = 'ready';
    startMorph();
  } catch (error) {
    if (!isDisposed()) fail(error);
  }
}

// ---- presentation ---------------------------------------------------------
function dbLabel(linear: number): string {
  const db = toDbfs(linear);
  if (!Number.isFinite(db)) return '−∞ dBFS';
  const fixed = db.toFixed(2);
  const sign = db > 0.005 ? '+' : '';
  return `${sign}${fixed.startsWith('-') ? `−${fixed.slice(1)}` : fixed} dBFS`;
}

const stateLabel = computed(() => {
  if (isPlaying.value) return `▸ ${Math.round(progress.value * 100)}%`;
  if (status.value !== 'ready' || !result.value) return 'IDLE';
  return `PEAK ${dbLabel(peakMax.value)}`;
});

const readout = computed(() => {
  const r = result.value;
  if (!r) return '';
  const parts = r.peaks.map(
    (p, i) => `${outputNames.value[i] ?? i} ${p.toFixed(4)} (${dbLabel(p)})`,
  );
  return `${text('peak')}: ${parts.join(', ')}`;
});

/** Speaker positions as fractions of the screen box (16:6). */
// `sx` stretches the ring sideways so the three front speakers do not crowd.
const ROOM = { cx: 0.27, cy: 0.56, r: 0.4, sx: 1.55 };
const SPEAKER_ANGLE: Record<string, { deg: number; radius: number }> = {
  L: { deg: -30, radius: 1 },
  R: { deg: 30, radius: 1 },
  C: { deg: 0, radius: 1 },
  LFE: { deg: 24, radius: 0.5 },
  Ls: { deg: -110, radius: 1 },
  Rs: { deg: 110, radius: 1 },
};
const ASPECT = 16 / 6;
const speakers = SURROUND_51_ROLES.map((role) => {
  const { deg, radius } = SPEAKER_ANGLE[role];
  const a = (deg * Math.PI) / 180;
  return {
    role,
    fx: ROOM.cx + (ROOM.r * ROOM.sx * radius * Math.sin(a)) / ASPECT,
    fy: ROOM.cy - ROOM.r * radius * Math.cos(a),
  };
});
const SPEAKER_COLOR: Record<string, string> = {
  L: '#2dd4bf',
  R: '#a78bfa',
  C: '#fbbf24',
  LFE: '#94a3b8',
  Ls: '#38bdf8',
  Rs: '#f472b6',
};
const OUT_COLOR: Record<string, string> = { L: '#2dd4bf', R: '#a78bfa', M: '#fbbf24' };

function toggle(index: number): void {
  enabled[index] = !enabled[index];
}

// ---- morph + paint --------------------------------------------------------
const dispPeaks = [0, 0];
let morphRaf = 0;
function startMorph(): void {
  if (morphRaf) return;
  const step = () => {
    const peaks = result.value?.peaks ?? [];
    let delta = 0;
    for (let i = 0; i < 2; i++) {
      const goal = peaks[i] ?? 0;
      const d = goal - dispPeaks[i];
      dispPeaks[i] += d * 0.22;
      delta = Math.max(delta, Math.abs(d));
    }
    paint();
    if (delta > 0.0005) {
      morphRaf = requestAnimationFrame(step);
    } else {
      for (let i = 0; i < 2; i++) dispPeaks[i] = peaks[i] ?? 0;
      paint();
      morphRaf = 0;
    }
  };
  morphRaf = requestAnimationFrame(step);
}

let playRaf = 0;
watch(isPlaying, (on) => {
  if (on && !playRaf) {
    const step = () => {
      paint();
      playRaf = isPlaying.value ? requestAnimationFrame(step) : 0;
    };
    playRaf = requestAnimationFrame(step);
  } else if (!on) {
    paint();
  }
});

function envelopeAt(env: Float32Array | undefined, at: number): number {
  if (!env || env.length === 0) return 0;
  return env[Math.min(env.length - 1, Math.max(0, Math.floor(at * env.length)))];
}

function paint(): void {
  const frame = prepareCanvas2D(canvas.value);
  if (!frame) return;
  const { ctx, width, height } = frame;
  const r = result.value;
  const playing = isPlaying.value;
  const at = progress.value;
  const names = r ? (r.target === 'mono' ? ['M'] : ['L', 'R']) : outputNames.value;
  const mono = (font: number, weight = 600) =>
    `${weight} ${font}px "JetBrains Mono", ui-monospace, monospace`;

  // Room ring and listener.
  const cx = ROOM.cx * width;
  const cy = ROOM.cy * height;
  const ringR = ROOM.r * height;
  ctx.strokeStyle = 'rgba(186, 230, 224, 0.12)';
  ctx.setLineDash([3, 5]);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.ellipse(cx, cy, ringR * ROOM.sx, ringR, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = 'rgba(186, 230, 224, 0.35)';
  ctx.beginPath();
  ctx.arc(cx, cy, 3, 0, Math.PI * 2);
  ctx.fill();

  // Meter geometry.
  const mx0 = width * 0.6;
  const mx1 = width * 0.955;
  const mw = mx1 - mx0;
  const xOf = (v: number) => mx0 + (Math.min(METER_MAX, Math.max(0, v)) / METER_MAX) * mw;
  const barH = Math.max(10, height * 0.11);
  const rows = names.length === 1 ? [height * 0.42] : [height * 0.32, height * 0.54];

  // Flow lines from each enabled speaker to the outputs it feeds.
  speakers.forEach((sp, input) => {
    const sx = sp.fx * width;
    const sy = sp.fy * height;
    const activity = playing
      ? envelopeAt(r?.inEnvelopes[input], at) / Math.max(1e-6, level.value)
      : 0.45;
    names.forEach((_, out) => {
      const g = r?.gains[input]?.[out] ?? 0;
      if (!enabled[input] || g <= 0) return;
      ctx.strokeStyle = SPEAKER_COLOR[sp.role];
      ctx.globalAlpha = Math.min(0.85, 0.06 + 0.7 * g * activity);
      ctx.lineWidth = 0.6 + 2.2 * g;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      const ex = mx0 - 4;
      const ey = rows[out];
      ctx.bezierCurveTo(sx + (ex - sx) * 0.55, sy, ex - (ex - sx) * 0.25, ey, ex, ey);
      ctx.stroke();
    });
    ctx.globalAlpha = 1;
    // The gain each channel enters the fold with, read back from the engine.
    if (r) {
      const gains = r.gains[input] ?? [];
      const g = Math.max(0, ...gains);
      ctx.font = mono(width < 560 ? 7 : 9);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillStyle = enabled[input]
        ? g > 0
          ? 'rgba(226, 240, 238, 0.75)'
          : 'rgba(248, 113, 113, 0.85)'
        : 'rgba(148, 163, 184, 0.35)';
      const label = g > 0 ? `×${g.toFixed(3)}` : '×0';
      ctx.fillText(label, sx, sy + Math.max(14, height * 0.085));
    }
  });

  // Meter header and scale.
  ctx.font = mono(9);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = 'rgba(186, 230, 224, 0.6)';
  const layoutName = names.length === 1 ? 'MONO' : 'STEREO';
  const header = `DOWNMIX → ${layoutName} · PEAK, UNNORMALIZED`;
  // Narrow screens keep the part that names what the meter reads.
  const fits = ctx.measureText(header).width <= mx1 - mx0;
  ctx.fillText(fits ? header : `→ ${layoutName} · UNNORMALIZED`, mx0, height * 0.14);
  const zeroX = xOf(1);
  // Overshoot zone above full scale.
  ctx.fillStyle = 'rgba(248, 113, 113, 0.07)';
  ctx.fillRect(zeroX, rows[0] - barH, mx1 - zeroX, rows[rows.length - 1] - rows[0] + barH * 2);
  for (const tick of [0, 1, 2, 3]) {
    const x = xOf(tick);
    ctx.strokeStyle = tick === 1 ? 'rgba(251, 191, 36, 0.9)' : 'rgba(148, 163, 184, 0.25)';
    ctx.lineWidth = tick === 1 ? 1.5 : 1;
    ctx.beginPath();
    ctx.moveTo(x + 0.5, rows[0] - barH * 0.9);
    ctx.lineTo(x + 0.5, rows[rows.length - 1] + barH * 0.9);
    ctx.stroke();
  }
  ctx.font = mono(8);
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(251, 191, 36, 0.9)';
  ctx.fillText('0 dBFS', zeroX, rows[0] - barH * 0.95 - 2);
  ctx.fillStyle = 'rgba(148, 163, 184, 0.6)';
  ctx.fillText('×2', xOf(2), rows[0] - barH * 0.95 - 2);
  ctx.fillText('×3', xOf(3) - 6, rows[0] - barH * 0.95 - 2);

  // Bars: live level while playing, the held peak otherwise.
  names.forEach((name, out) => {
    const y = rows[out];
    const live = playing ? envelopeAt(r?.outEnvelopes[out], at) : dispPeaks[out];
    const peak = dispPeaks[out];
    ctx.fillStyle = 'rgba(148, 163, 184, 0.1)';
    ctx.fillRect(mx0, y - barH / 2, mw, barH);
    const within = Math.min(live, 1);
    ctx.fillStyle = OUT_COLOR[name];
    ctx.globalAlpha = 0.85;
    ctx.fillRect(mx0, y - barH / 2, xOf(within) - mx0, barH);
    if (live > 1) {
      ctx.fillStyle = '#f87171';
      ctx.fillRect(zeroX, y - barH / 2, xOf(live) - zeroX, barH);
    }
    ctx.globalAlpha = 1;
    // Peak-hold marker with its value.
    const px = xOf(peak);
    ctx.strokeStyle = peak > 1 ? '#fca5a5' : '#e2f0ee';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(px, y - barH / 2 - 3);
    ctx.lineTo(px, y + barH / 2 + 3);
    ctx.stroke();
    ctx.font = mono(10, 700);
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    // Dark on the filled bar, coloured on the empty track.
    ctx.fillStyle = xOf(live) - mx0 > 16 ? '#04060c' : OUT_COLOR[name];
    ctx.fillText(name, mx0 + 5, y + 0.5);
    ctx.font = mono(9);
    ctx.textBaseline = 'top';
    ctx.fillStyle = peak > 1 ? '#fca5a5' : 'rgba(226, 240, 238, 0.8)';
    const tag = `${(r?.peaks[out] ?? 0).toFixed(3)} · ${dbLabel(r?.peaks[out] ?? 0)}`;
    const tagW = ctx.measureText(tag).width;
    ctx.textAlign = px + tagW / 2 > mx1 ? 'right' : px - tagW / 2 < mx0 ? 'left' : 'center';
    const tx = ctx.textAlign === 'right' ? mx1 : ctx.textAlign === 'left' ? mx0 : px;
    ctx.fillText(tag, tx, y + barH / 2 + 4);
  });

  // Timeline strip: roll call, then all channels together, with the playhead.
  const ty = height * 0.82;
  const th = Math.max(8, height * 0.06);
  const total = timeline.frames;
  const segments = [
    ...timeline.slots.map((s, i) => ({
      label: s.role,
      start: s.start,
      end: s.end,
      on: enabled[i],
    })),
    { label: 'ALL', start: timeline.together.start, end: timeline.together.end, on: true },
  ];
  ctx.font = mono(8);
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  for (const seg of segments) {
    const x0 = mx0 + (seg.start / total) * mw + 1;
    const x1 = mx0 + (seg.end / total) * mw - 1;
    const lit = playing && at * total >= seg.start && at * total < seg.end;
    const color = SPEAKER_COLOR[seg.label] ?? '#fbbf24';
    ctx.fillStyle = lit
      ? color
      : seg.on
        ? 'rgba(148, 163, 184, 0.22)'
        : 'rgba(148, 163, 184, 0.07)';
    ctx.fillRect(x0, ty, Math.max(1, x1 - x0), th);
    ctx.fillStyle = lit
      ? '#04060c'
      : seg.on
        ? 'rgba(226, 240, 238, 0.7)'
        : 'rgba(148, 163, 184, 0.35)';
    ctx.fillText(seg.label, (x0 + x1) / 2, ty + th / 2 + 0.5);
  }
  if (playing) {
    const hx = mx0 + at * mw;
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(hx, ty - 4);
    ctx.lineTo(hx, ty + th + 4);
    ctx.stroke();
  }
}

useCanvasRedraw(canvas, paint);

/** Speaker glow while playing, from the input envelope at the playhead. */
function speakerGlow(index: number): number {
  if (!isPlaying.value || !result.value) return 0;
  return Math.min(1, envelopeAt(result.value.inEnvelopes[index], progress.value) / level.value);
}

// ---- audition -------------------------------------------------------------
async function onPlay(): Promise<void> {
  if (!result.value) await compute();
  const r = result.value;
  if (!r) return;
  const { channels } = normalizeForListening(r.folded, LISTEN_CEILING);
  const audio =
    channels.length === 1
      ? { samples: channels[0], sampleRate: DOWNMIX_SAMPLE_RATE }
      : { left: channels[0], right: channels[1], sampleRate: DOWNMIX_SAMPLE_RATE };
  await play(props.def.id, audio);
}

let pending = 0;
function scheduleCompute(): void {
  if (pending) return;
  pending = requestAnimationFrame(() => {
    pending = 0;
    void compute();
  });
}

watch([target, levelDb, () => [...enabled]], () => {
  if (!props.active || status.value === 'idle') return;
  // A sounding buffer cannot be retargeted; stop so the meters never describe
  // a different fold than the one being heard.
  if (isPlaying.value) stop();
  scheduleCompute();
});

watch(
  () => props.active,
  (on) => {
    if (on && status.value === 'idle') void compute();
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  if (morphRaf) cancelAnimationFrame(morphRaf);
  if (playRaf) cancelAnimationFrame(playRaf);
  if (pending) cancelAnimationFrame(pending);
});
</script>

<template>
  <DemoFrame
    eyebrow="5.1 · DOWNMIX"
    :title="title"
    :caption="caption"
    :state="stateLabel"
    :tone="tone"
    :playing="isPlaying"
    :progress="progress"
    :error="status === 'error' ? errorMsg : null"
    :show-playhead="false"
    @toggle="onPlay"
  >
    <template #screen>
      <canvas ref="canvas" class="cd-canvas" />
      <div class="cd-speakers" :class="{ 'cd-speakers--lifted': status === 'ready' }">
        <button
          v-for="(sp, i) in speakers"
          :key="sp.role"
          type="button"
          class="cd-speaker"
          :class="{ 'is-off': !enabled[i], 'is-lfe': sp.role === 'LFE' }"
          :style="{
            left: `${sp.fx * 100}%`,
            top: `${sp.fy * 100}%`,
            '--sp-color': SPEAKER_COLOR[sp.role],
            '--sp-glow': speakerGlow(i),
          }"
          :aria-pressed="enabled[i]"
          :aria-label="`${sp.role} ${enabled[i] ? text('on') : text('off')}`"
          :disabled="status !== 'ready'"
          @click="toggle(i)"
        >
          {{ sp.role }}
        </button>
      </div>
      <p class="demo-sr-only cd-readout" aria-live="polite">{{ readout }}</p>
    </template>
    <template #controls>
      <DemoControls
        :model-value="values"
        :params="def.params ?? []"
        :locale="loc"
        @update:model-value="updateParams"
      />
      <DemoNotice tone="hint" class="cd-hint">{{ text('hint') }}</DemoNotice>
    </template>
  </DemoFrame>
</template>

<style scoped>
.cd-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
}

.cd-speakers {
  position: absolute;
  inset: 0;
  container-type: inline-size;
  pointer-events: none;
}

/* Above the screen's grid and brackets once ready; below the loading and
   error overlays otherwise. */
.cd-speakers--lifted {
  z-index: 3;
}

.cd-speaker {
  --size: clamp(24px, 7.5cqw, 38px);
  position: absolute;
  width: var(--size);
  height: var(--size);
  transform: translate(-50%, -50%);
  border-radius: 50%;
  border: 1.5px solid var(--sp-color);
  background: color-mix(
    in srgb,
    var(--sp-color) calc(14% + var(--sp-glow, 0) * 60%),
    #070a14
  );
  box-shadow: 0 0 calc(var(--sp-glow, 0) * 18px) var(--sp-color);
  color: #e2f0ee;
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.02em;
  cursor: pointer;
  pointer-events: auto;
  transition:
    opacity var(--demo-dur-fast, 0.15s) ease,
    border-color var(--demo-dur-fast, 0.15s) ease;
}

.cd-speaker.is-lfe {
  --size: clamp(20px, 6cqw, 30px);
  border-radius: 6px;
  font-size: 8px;
}

.cd-speaker.is-off {
  opacity: 0.35;
  border-style: dashed;
  box-shadow: none;
  background: #070a14;
  text-decoration: line-through;
}

.cd-speaker:disabled {
  cursor: default;
}

.cd-speaker:focus-visible {
  outline: 2px solid var(--demo-accent);
  outline-offset: 2px;
}

.cd-hint {
  margin-top: var(--space-2, 8px);
}

@media (prefers-reduced-motion: reduce) {
  .cd-speaker {
    transition: none;
  }
}
</style>
