<script setup lang="ts">
/**
 * `hpss` archetype: split a mix into its harmonic and percussive layers and both
 * see and hear the separation.
 *
 * A clip with sustained pitched material and drum hits is run through `hpss`, which
 * uses median filtering on the spectrogram: sustained tones form **horizontal**
 * ridges, transient hits form **vertical** streaks, and the two are separated by
 * filtering along each axis. The view selects which layer to show as an STFT
 * spectrogram and to audition — Full has both, Harmonic keeps the horizontal ridges
 * (the tune, drums gone), Percussive keeps the vertical streaks (the drums, tune
 * gone). A playback-synced beam sweeps the spectrogram.
 */
import { computed, reactive, ref, watch } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { type MonoAudio, useSonareDemoAudio } from '@/composables/useSonareDemoAudio';
import { type DemoLocale, localized, type SonareDemoDef } from '@/demos/types';
import DemoControls from '../DemoControls.vue';
import DemoFrame from '../DemoFrame.vue';

const props = defineProps<{ def: SonareDemoDef; active: boolean }>();

const { locale } = useI18n();
const { ensureWasm, loadClip, play, playingId, progress } = useSonareDemoAudio();

const loc = computed<DemoLocale>(() => (locale.value.startsWith('ja') ? 'ja' : 'en'));
const title = computed(() => localized(props.def.title, loc.value));
const caption = computed(() => localized(props.def.caption, loc.value));

const canvas = ref<HTMLCanvasElement | null>(null);
const status = ref<'idle' | 'loading' | 'ready' | 'error'>('idle');
const errorMsg = ref('');
const isPlaying = computed(() => playingId.value === props.def.id);

// ---- reader-adjustable parameters ------------------------------------------
type ParamValue = number | string | boolean;
const values = reactive<Record<string, ParamValue>>({});
for (const p of props.def.params ?? []) values[p.key] = p.default;

function onParams(next: Record<string, ParamValue>): void {
  Object.assign(values, next);
}

type View = 'full' | 'harmonic' | 'percussive';
const view = computed<View>(() => (values.view as View) ?? 'full');
const clipName = computed(() => (props.def.source.kind === 'clip' ? props.def.source.clip : ''));
const EYEBROWS: Record<View, string> = {
  full: 'HPSS · FULL MIX',
  harmonic: 'HPSS · HARMONIC',
  percussive: 'HPSS · PERCUSSIVE',
};
const eyebrow = computed(() => EYEBROWS[view.value]);

const tone = computed(() => {
  if (status.value === 'error') return 'error' as const;
  if (status.value === 'loading') return 'loading' as const;
  if (isPlaying.value) return 'playing' as const;
  if (status.value === 'ready') return 'ready' as const;
  return 'idle' as const;
});
const stateLabel = computed(() => {
  if (status.value === 'loading') return 'SEPARATING';
  if (status.value === 'error') return 'ERROR';
  if (isPlaying.value) return `▸ ${Math.round(progress.value * 100)}%`;
  if (status.value === 'ready') return view.value.toUpperCase();
  return 'IDLE';
});

// ---- HPSS streams ----------------------------------------------------------
type WasmModule = Awaited<ReturnType<typeof ensureWasm>>;
let full: MonoAudio | null = null;
let harmonic: MonoAudio | null = null;
let percussive: MonoAudio | null = null;

function streamFor(v: View): MonoAudio | null {
  return v === 'harmonic' ? harmonic : v === 'percussive' ? percussive : full;
}

/** Map a normalized 0..1 magnitude to an RGB ramp (dark → warm → bright). */
function ramp(val: number, out: Uint8ClampedArray, o: number): void {
  const t = Math.max(0, Math.min(1, val));
  out[o] = Math.round(255 * Math.min(1, t * 1.6));
  out[o + 1] = Math.round(255 * Math.max(0, t * 1.4 - 0.4));
  out[o + 2] = Math.round(255 * Math.max(0, t * 1.2 - 0.7) + 40 * (1 - t));
  out[o + 3] = 255;
}

/** Paint an STFT magnitude spectrogram of one stream into the canvas. */
function paintStream(wasm: WasmModule, a: MonoAudio): void {
  const r = wasm.stft(a.samples, a.sampleRate, 1024, 256);
  const { nBins, nFrames, magnitude } = r;
  const el = canvas.value;
  if (!el) return;
  el.width = nFrames;
  el.height = nBins;
  const ctx = el.getContext('2d');
  if (!ctx) return;
  const img = ctx.createImageData(nFrames, nBins);
  const floorDb = -90;
  for (let bin = 0; bin < nBins; bin++) {
    const y = nBins - 1 - bin; // row 0 = low freq at the bottom
    for (let frame = 0; frame < nFrames; frame++) {
      const db = 20 * Math.log10(magnitude[bin * nFrames + frame] + 1e-9);
      ramp((db - floorDb) / -floorDb, img.data, (y * nFrames + frame) * 4);
    }
  }
  ctx.putImageData(img, 0, 0);
}

async function compute(): Promise<void> {
  try {
    if (status.value === 'idle') status.value = 'loading';
    const wasm = await ensureWasm();
    if (!full) {
      const clip = await loadClip(clipName.value);
      full = clip;
      const r = wasm.hpss(clip.samples, clip.sampleRate);
      harmonic = { samples: r.harmonic, sampleRate: r.sampleRate };
      percussive = { samples: r.percussive, sampleRate: r.sampleRate };
    }
    const stream = streamFor(view.value);
    if (stream) paintStream(wasm, stream);
    status.value = 'ready';
  } catch (e) {
    status.value = 'error';
    errorMsg.value = e instanceof Error ? e.message : String(e);
  }
}

async function onPlay(): Promise<void> {
  if (!full) await compute();
  const stream = streamFor(view.value);
  if (stream) await play(props.def.id, stream);
}

let pending = 0;
function scheduleCompute(): void {
  if (pending) return;
  pending = requestAnimationFrame(() => {
    pending = 0;
    compute();
  });
}

watch(view, () => {
  if (props.active && status.value !== 'idle') scheduleCompute();
});

watch(
  () => props.active,
  (on) => {
    if (on && status.value === 'idle') compute();
  },
  { immediate: true },
);
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
    loading-label="SEPARATING…"
    axis-freq="FREQ"
    axis-time="TIME →"
    @toggle="onPlay"
  >
    <template #screen>
      <canvas ref="canvas" class="hp-canvas" />
    </template>
    <template #controls>
      <DemoControls
        :model-value="values"
        :params="def.params ?? []"
        :locale="loc"
        :disabled="status === 'loading'"
        @update:model-value="onParams"
      />
    </template>
  </DemoFrame>
</template>

<style scoped>
.hp-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
  image-rendering: auto;
  opacity: 0.96;
}
</style>
