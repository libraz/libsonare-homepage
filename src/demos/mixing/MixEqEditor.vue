<script setup lang="ts">
/**
 * The selected strip's six EQ bands: the response the engine's equalizer
 * computes, over the track's source spectrum at the playhead, with draggable
 * handles and the selected band's frequency, gain and Q. Band types are the
 * fixed layout's; every field changes live.
 */
import { computed, ref } from 'vue';
import SpectrumView, {
  type SpectrumBand,
  type SpectrumBandUpdate,
} from '@/components/meters/SpectrumView.vue';
import MixParam from '@/demos/mixing/MixParam.vue';
import { useMixingCopy } from '@/demos/mixing/mixingCopy';
import { defaultEqBands, type MixTrackState, type StripEqBand } from '@/demos/mixing/mixingState';
import type { ParamControl } from '@/demos/mixing/mixingUi';
import type { MixingController } from '@/demos/mixing/useMixingStudio';
import { fill } from '@/utils/template';

const props = defineProps<{ m: MixingController; track: MixTrackState }>();

const copy = useMixingCopy();
const { m } = props;
const { editLocked, metering } = m;
const { spectrumFreqs, trackDb } = metering;
const defaults = defaultEqBands();

const FREQ: ParamControl = {
  name: 'frequencyHz',
  min: 20,
  max: 20000,
  step: 1,
  unit: 'Hz',
  scale: 'log',
};
const GAIN: ParamControl = { name: 'gainDb', min: -18, max: 18, step: 0.1, unit: 'dB' };
const Q: ParamControl = { name: 'q', min: 0.1, max: 10, step: 0.01, unit: '', scale: 'log' };

const selected = ref(2);
const band = computed(() => props.track.eq[selected.value]);
const passBand = (b: StripEqBand) => b.type === 'HighPass' || b.type === 'LowPass';

const overlay = computed(() => m.eqCurve(props.track.eq));
const handles = computed<SpectrumBand[]>(() =>
  props.track.eq.flatMap((b, index) =>
    b.enabled
      ? [
          {
            id: String(index),
            label: `${fill(copy.value.inspector.band, { n: index + 1 })} ${copy.value.inspector.bandTypes[b.type]}`,
            freqHz: b.frequencyHz,
            gainDb: passBand(b) ? 0 : b.gainDb,
          },
        ]
      : [],
  ),
);

function setBand(index: number, patch: Partial<StripEqBand>): void {
  m.edit('setEqBand', props.track.id, index, patch);
}

function onHandle(update: SpectrumBandUpdate): void {
  const index = Number(update.id);
  const current = props.track.eq[index];
  if (!current || editLocked.value) return;
  selected.value = index;
  const frequencyHz = Math.round(Math.min(20000, Math.max(20, update.freqHz)));
  setBand(
    index,
    passBand(current)
      ? { frequencyHz }
      : { frequencyHz, gainDb: Math.round(Math.max(-18, Math.min(18, update.gainDb)) * 10) / 10 },
  );
}

const spectrumLabels = computed(() => copy.value.inspector.spectrum);
</script>

<template>
  <div class="eq">
    <SpectrumView
      class="eq__plot"
      :freqs="spectrumFreqs"
      :spectra="[trackDb]"
      :overlay="overlay"
      :bands="editLocked ? null : handles"
      :labels="spectrumLabels"
      @update:band="onHandle"
      @band-drag-start="m.begin"
      @band-drag-end="m.end"
    />
    <div class="eq__bands" role="tablist" :aria-label="copy.inspector.eq">
      <div
        v-for="(b, index) in track.eq"
        :key="index"
        class="eq__band"
        :class="{ 'eq__band--selected': index === selected, 'eq__band--on': b.enabled }"
      >
        <button
          type="button"
          class="eq__power"
          :aria-pressed="b.enabled"
          :aria-label="`${fill(copy.inspector.band, { n: index + 1 })} ${b.enabled ? copy.common.on : copy.common.off}`"
          :disabled="editLocked"
          @click="setBand(index, { enabled: !b.enabled })"
        ></button>
        <button
          type="button"
          role="tab"
          class="eq__select"
          :aria-selected="index === selected"
          :title="copy.inspector.bandTypes[b.type]"
          @click="selected = index"
        >{{ copy.inspector.bandShort[index] }}</button>
      </div>
    </div>
    <div v-if="band" class="eq__params">
      <MixParam
        :model-value="band.frequencyHz"
        :control="FREQ"
        :label="copy.inspector.freq"
        :default-value="defaults[selected].frequencyHz"
        :disabled="editLocked"
        @update:model-value="(v) => setBand(selected, { frequencyHz: v })"
        @begin="m.begin"
        @end="m.end"
      />
      <MixParam
        :model-value="band.gainDb"
        :control="GAIN"
        :label="copy.inspector.gain"
        :default-value="0"
        :disabled="editLocked || passBand(band)"
        @update:model-value="(v) => setBand(selected, { gainDb: v })"
        @begin="m.begin"
        @end="m.end"
      />
      <MixParam
        :model-value="band.q"
        :control="Q"
        :label="copy.inspector.q"
        :default-value="defaults[selected].q"
        :disabled="editLocked"
        @update:model-value="(v) => setBand(selected, { q: v })"
        @begin="m.begin"
        @end="m.end"
      />
    </div>
  </div>
</template>

<style scoped>
.eq {
  display: grid;
  gap: 8px;
}

.eq__plot {
  min-height: 170px;
}

.eq__bands {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 3px;
}

.eq__band {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  border: 1px solid var(--demo-border);
  border-radius: 4px;
  background: var(--demo-control-bg);
}

.eq__band--selected {
  border-color: var(--demo-accent-border);
  background: var(--demo-accent-subtle);
}

.eq__power {
  width: 14px;
  height: 14px;
  margin-left: 4px;
  padding: 0;
  border: 1px solid var(--demo-border-strong);
  border-radius: 50%;
  background: transparent;
  cursor: pointer;
}

.eq__power[aria-pressed='true'] {
  border-color: var(--demo-accent);
  background: var(--demo-accent);
}

.eq__power:disabled {
  cursor: not-allowed;
}

.eq__select {
  overflow: hidden;
  padding: 5px 4px;
  border: 0;
  background: transparent;
  color: var(--demo-text-muted);
  font-family: var(--font-mono);
  font-size: 9.5px;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
}

.eq__band--on .eq__select {
  color: var(--demo-text-strong);
}

.eq__params {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}
</style>
