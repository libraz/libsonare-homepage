<script setup lang="ts">
/**
 * The strip EQ editor: the response the engine's equalizer computes for the
 * current bands, over the input (program at the playhead) and output spectra,
 * with draggable band handles and an eight-column band table.
 */
import { computed, onBeforeUnmount, shallowRef, watch } from 'vue';
import SpectrumView, {
  type SpectrumBand,
  type SpectrumBandUpdate,
  type SpectrumOverlayPoint,
} from '@/components/meters/SpectrumView.vue';
import MasterKnob from '@/demos/mastering/MasterKnob.vue';
import { fill, useMasteringCopy } from '@/demos/mastering/masteringCopy';
import {
  MASTERING_MATCH_EQ_BANDS,
  type MasteringEqBand,
  type MasteringMatchEq,
} from '@/demos/mastering/masteringState';
import type { StreamingEqualizer } from '@/wasm/index.js';

type Wasm = typeof import('@/wasm/index.js');
type BandPatch = Partial<Pick<MasteringEqBand, 'frequencyHz' | 'gainDb' | 'q' | 'enabled'>>;

const props = defineProps<{
  bands: readonly MasteringEqBand[];
  matchEq: MasteringMatchEq | null;
  freqs: Float32Array | null;
  outputDb: Float32Array | null;
  inputDb: Float32Array | null;
  wasm: Wasm | null;
  sampleRate: number;
  disabled?: boolean;
}>();

const emit = defineEmits<{
  band: [index: number, patch: BandPatch];
  begin: [];
  end: [];
  clearMatch: [];
}>();

const copy = useMasteringCopy();
const RESPONSE_POINTS = 192;
const responseFreqs = new Float32Array(RESPONSE_POINTS).map(
  (_, i) => 20 * 1000 ** (i / (RESPONSE_POINTS - 1)),
);

/** Band types whose gain means nothing: the handle moves in frequency only. */
const passBand = (band: MasteringEqBand) => band.type === 'HighPass' || band.type === 'LowPass';

let equalizer: StreamingEqualizer | null = null;
const overlay = shallowRef<SpectrumOverlayPoint[] | null>(null);

function computeResponse(): void {
  const wasm = props.wasm;
  if (!wasm || !props.sampleRate) return;
  equalizer ??= new wasm.StreamingEqualizer({ sampleRate: props.sampleRate, maxBlockSize: 128 });
  props.bands.forEach((band, index) => {
    equalizer?.setBand(index, {
      type: band.type,
      frequencyHz: band.frequencyHz,
      gainDb: band.gainDb,
      q: band.q,
      enabled: band.enabled,
    });
  });
  const db = equalizer.magnitudeResponse(responseFreqs);
  overlay.value = Array.from(responseFreqs, (freqHz, i) => ({ freqHz, db: db[i] }));
}

watch(() => [props.bands, props.wasm, props.sampleRate] as const, computeResponse, {
  immediate: true,
});

onBeforeUnmount(() => {
  equalizer?.delete();
  equalizer = null;
});

const handles = computed<SpectrumBand[]>(() =>
  props.bands.flatMap((band, index) =>
    band.enabled
      ? [
          {
            id: String(index),
            label: `${fill(copy.value.eq.band, { n: index + 1 })} ${copy.value.eq.bandTypes[band.type]}`,
            freqHz: band.frequencyHz,
            gainDb: passBand(band) ? 0 : band.gainDb,
          },
        ]
      : [],
  ),
);

function onHandle(update: SpectrumBandUpdate): void {
  if (props.disabled) return;
  const index = Number(update.id);
  const band = props.bands[index];
  if (!band) return;
  const frequencyHz = Math.round(Math.min(20000, Math.max(20, update.freqHz)));
  const patch: BandPatch = passBand(band)
    ? { frequencyHz }
    : { frequencyHz, gainDb: Math.round(Math.min(18, Math.max(-18, update.gainDb)) * 10) / 10 };
  emit('band', index, patch);
}

const matchText = computed(() =>
  props.matchEq
    ? fill(copy.value.eq.matched, { pct: Math.round(props.matchEq.residualRatio * 100) })
    : '',
);

const spectrumLabels = computed(() => ({
  name: copy.value.eq.name,
  tilt: copy.value.eq.tilt,
  traces: copy.value.eq.traces,
}));
</script>

<template>
  <div class="eq-editor">
    <SpectrumView
      class="eq-editor__plot"
      :freqs="freqs"
      :spectra="[outputDb, inputDb]"
      :overlay="overlay"
      :bands="disabled ? null : handles"
      :labels="spectrumLabels"
      @update:band="onHandle"
      @band-drag-start="emit('begin')"
      @band-drag-end="emit('end')"
    />
    <p v-if="matchEq" class="eq-editor__match">
      <span>{{ matchText }}</span>
      <button type="button" :disabled="disabled" @click="emit('clearMatch')">{{ copy.eq.clearMatch }}</button>
    </p>
    <div class="eq-editor__bands" role="group" :aria-label="copy.modules.eq">
      <fieldset
        v-for="(band, index) in bands"
        :key="index"
        class="eq-band"
        :class="{
          'eq-band--off': !band.enabled,
          'eq-band--match': matchEq && MASTERING_MATCH_EQ_BANDS.includes(index),
        }"
        :disabled="disabled"
      >
        <legend class="eq-band__head">
          <label>
            <input
              type="checkbox"
              :checked="band.enabled"
              @change="emit('band', index, { enabled: ($event.target as HTMLInputElement).checked })"
            >
            <span class="eq-band__index">{{ index + 1 }}</span>
            <span class="eq-band__type">{{ copy.eq.bandTypes[band.type] }}</span>
          </label>
        </legend>
        <MasterKnob
          :model-value="band.frequencyHz"
          :min="20"
          :max="20000"
          :step="1"
          unit="Hz"
          scale="log"
          :label="copy.eq.freq"
          :disabled="disabled"
          @begin="emit('begin')"
          @end="emit('end')"
          @update:model-value="emit('band', index, { frequencyHz: $event })"
        />
        <MasterKnob
          v-if="!passBand(band)"
          :model-value="band.gainDb"
          :min="-18"
          :max="18"
          :step="0.1"
          unit="dB"
          :default="0"
          :label="copy.eq.gain"
          :disabled="disabled"
          @begin="emit('begin')"
          @end="emit('end')"
          @update:model-value="emit('band', index, { gainDb: $event })"
        />
        <MasterKnob
          :model-value="band.q"
          :min="0.1"
          :max="10"
          :step="0.01"
          scale="log"
          :label="copy.eq.q"
          :default="band.type === 'Peak' ? 1 : Math.SQRT1_2"
          :disabled="disabled"
          @begin="emit('begin')"
          @end="emit('end')"
          @update:model-value="emit('band', index, { q: $event })"
        />
      </fieldset>
    </div>
  </div>
</template>

<style scoped>
.eq-editor {
  display: grid;
  gap: 12px;
  min-width: 0;
}

.eq-editor__plot {
  min-height: 240px;
}

.eq-editor__match {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin: 0;
  color: var(--demo-text);
  font-size: 12px;
}

.eq-editor__match button {
  padding: 4px 10px;
  border: 1px solid var(--demo-border-strong);
  border-radius: 4px;
  background: transparent;
  color: var(--demo-text);
  font-family: var(--font-mono);
  font-size: 11px;
  cursor: pointer;
}

.eq-editor__bands {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}

.eq-band {
  display: grid;
  gap: 8px;
  min-width: 0;
  margin: 0;
  padding: 8px 10px 10px;
  border: 1px solid var(--demo-border);
  border-radius: 6px;
}

.eq-band--match {
  border-color: var(--demo-accent-border);
}

.eq-band--off :deep(.knob) {
  opacity: 0.55;
}

.eq-band__head {
  padding: 0 4px;
}

.eq-band__head label {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
}

.eq-band__head input {
  accent-color: var(--demo-accent);
}

.eq-band__head input:focus-visible,
.eq-editor__match button:focus-visible {
  outline: 2px solid var(--demo-accent);
  outline-offset: 2px;
}

.eq-band__index {
  color: var(--demo-text-faint);
  font-family: var(--font-mono);
  font-size: 10px;
}

.eq-band__type {
  color: var(--demo-text-strong);
  font-family: var(--font-mono);
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: 0.04em;
}

@media (max-width: 1280px) {
  .eq-editor__bands {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
