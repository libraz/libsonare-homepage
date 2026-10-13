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
import { SegmentedControl } from '@/components/ui';
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
const bandOptions = computed(() =>
  copy.value.inspector.bandShort.map((label, index) => ({ id: String(index), label })),
);
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
    <SegmentedControl
      :model-value="String(selected)"
      :options="bandOptions"
      :ariaLabel="copy.inspector.eq"
      size="sm"
      @update:model-value="(id) => (selected = Number(id))"
    />
    <div v-if="band" class="eq__head">
      <span class="eq__type">{{ fill(copy.inspector.band, { n: selected + 1 }) }} · {{ copy.inspector.bandTypes[band.type] }}</span>
      <button
        type="button"
        class="demo-btn demo-btn--sm eq__power"
        :aria-pressed="band.enabled"
        :aria-label="`${fill(copy.inspector.band, { n: selected + 1 })} ${band.enabled ? copy.common.on : copy.common.off}`"
        :disabled="editLocked"
        @click="setBand(selected, { enabled: !band.enabled })"
      >{{ band.enabled ? copy.common.on : copy.common.off }}</button>
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

.eq__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.eq__type {
  color: var(--demo-text-muted);
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.04em;
}

.eq__power {
  min-width: 38px;
}

.eq__power[aria-pressed='true'],
.eq__power[aria-pressed='true']:hover:not(:disabled) {
  border-color: var(--demo-accent);
  background: var(--demo-accent);
  color: var(--demo-on-accent);
}

.eq__params {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}
</style>
