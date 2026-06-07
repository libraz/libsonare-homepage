<script setup lang="ts">
/**
 * `transform` archetype: source audio → WASM spectral transform → 2D visualization.
 *
 * Renders an STFT magnitude spectrogram into the shared {@link DemoFrame} screen.
 * The audio source is either a generated test signal or a pre-rendered clip; the
 * reader can audition it, and a playback-synced playhead sweeps the screen.
 *
 * The WASM/data wiring is independent of presentation; the frame owns all chrome
 * and the playback visuals (beam, reveal, progress ring) via its props.
 */
import { computed, ref, watch } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { type MonoAudio, useSonareDemoAudio } from '@/composables/useSonareDemoAudio';
import { generateSignal } from '@/demos/signal';
import { localized, type SonareDemoDef } from '@/demos/types';
import DemoFrame from '../DemoFrame.vue';

const props = defineProps<{ def: SonareDemoDef; active: boolean }>();

const { locale } = useI18n();
const { ensureWasm, loadClip, play, playingId, progress } = useSonareDemoAudio();

const loc = computed<'en' | 'ja'>(() => (locale.value.startsWith('ja') ? 'ja' : 'en'));
const title = computed(() => localized(props.def.title, loc.value));
const caption = computed(() => localized(props.def.caption, loc.value));

const canvas = ref<HTMLCanvasElement | null>(null);
const status = ref<'idle' | 'loading' | 'ready' | 'error'>('idle');
const errorMsg = ref('');
const isPlaying = computed(() => playingId.value === props.def.id);

// ---- presentation-only derived values (no effect on data flow) -------------
const tone = computed(() => {
  if (status.value === 'error') return 'error' as const;
  if (status.value === 'loading') return 'loading' as const;
  if (isPlaying.value) return 'playing' as const;
  if (status.value === 'ready') return 'ready' as const;
  return 'idle' as const;
});
const stateLabel = computed(() => {
  if (status.value === 'loading') return 'ANALYZING';
  if (status.value === 'error') return 'ERROR';
  if (isPlaying.value) return `▸ ${Math.round(progress.value * 100)}%`;
  if (status.value === 'ready') return 'READY';
  return 'IDLE';
});

let audio: MonoAudio | null = null;

/** Resolve the demo's audio: generated in-browser, or decoded from a clip. */
async function resolveAudio(): Promise<MonoAudio> {
  if (props.def.source.kind === 'generate') {
    return generateSignal(props.def.source);
  }
  return loadClip(props.def.source.clip);
}

/** Map a normalized 0..1 magnitude to an RGB ramp (dark → warm → bright). */
function ramp(v: number, out: Uint8ClampedArray, o: number): void {
  const t = Math.max(0, Math.min(1, v));
  out[o] = Math.round(255 * Math.min(1, t * 1.6)); // R
  out[o + 1] = Math.round(255 * Math.max(0, t * 1.4 - 0.4)); // G
  out[o + 2] = Math.round(255 * Math.max(0, t * 1.2 - 0.7) + 40 * (1 - t)); // B
  out[o + 3] = 255;
}

/** Compute STFT and paint it as a spectrogram. */
async function run(): Promise<void> {
  status.value = 'loading';
  errorMsg.value = '';
  try {
    const wasm = await ensureWasm();
    audio = await resolveAudio();
    const cfg = props.def.config ?? {};
    const nFft = (cfg.nFft as number) ?? 1024;
    const hop = (cfg.hopLength as number) ?? 256;
    const r = wasm.stft(audio.samples, audio.sampleRate, nFft, hop);

    const { nBins, nFrames, magnitude } = r;
    const el = canvas.value;
    if (!el) return;
    el.width = nFrames;
    el.height = nBins;
    const ctx = el.getContext('2d');
    if (!ctx) return;

    // Normalize on a log (dB) scale for legibility.
    const img = ctx.createImageData(nFrames, nBins);
    const floorDb = -90;
    for (let bin = 0; bin < nBins; bin++) {
      for (let frame = 0; frame < nFrames; frame++) {
        const mag = magnitude[bin * nFrames + frame];
        const db = 20 * Math.log10(mag + 1e-9);
        const v = (db - floorDb) / -floorDb; // floorDb..0 → 0..1
        // Low frequencies at the bottom of the image.
        const y = nBins - 1 - bin;
        ramp(v, img.data, (y * nFrames + frame) * 4);
      }
    }
    ctx.putImageData(img, 0, 0);
    status.value = 'ready';
  } catch (e) {
    status.value = 'error';
    errorMsg.value = e instanceof Error ? e.message : String(e);
  }
}

async function onPlay(): Promise<void> {
  if (!audio) audio = await resolveAudio();
  await play(props.def.id, audio);
}

watch(
  () => props.active,
  (on) => {
    if (on && status.value === 'idle') run();
  },
  { immediate: true },
);
</script>

<template>
  <DemoFrame
    eyebrow="STFT · SPECTRAL"
    :title="title"
    :caption="caption"
    :state="stateLabel"
    :tone="tone"
    :playing="isPlaying"
    :progress="progress"
    :disabled="status === 'loading'"
    :error="status === 'error' ? errorMsg : null"
    loading-label="ANALYZING…"
    axis-freq="FREQ"
    axis-time="TIME →"
    @toggle="onPlay"
  >
    <template #screen>
      <canvas ref="canvas" class="td-canvas" />
    </template>
  </DemoFrame>
</template>

<style scoped>
/* Slotted into DemoFrame's screen; fills it. Frame owns all other styling. */
.td-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
  image-rendering: auto;
  opacity: 0.96;
}
</style>
