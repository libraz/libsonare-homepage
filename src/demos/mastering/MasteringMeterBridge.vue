<script setup lang="ts">
/**
 * The meter bridge: input and output peak, loudness (M/S/I with true peak),
 * chain gain reduction, correlation, goniometer and output spectrum. Live
 * values come from engine telemetry and describe the lane being heard; LRA
 * comes from the last export render and says so.
 */
import { computed } from 'vue';
import CorrelationMeter from '@/components/meters/CorrelationMeter.vue';
import GainReductionMeter from '@/components/meters/GainReductionMeter.vue';
import Goniometer from '@/components/meters/Goniometer.vue';
import LoudnessMeter from '@/components/meters/LoudnessMeter.vue';
import PeakMeter from '@/components/meters/PeakMeter.vue';
import SpectrumView from '@/components/meters/SpectrumView.vue';
import { useMasteringCopy } from '@/demos/mastering/masteringCopy';
import type { MasteringLane } from '@/demos/mastering/masteringState';
import type { MasteringMeterReading } from '@/demos/mastering/useMasteringMetering';
import { fill } from '@/utils/template';

const props = withDefaults(
  defineProps<{
    reading: MasteringMeterReading;
    lane: MasteringLane;
    targetLufs: number;
    /** Loudness range of the last render, NaN before one; the loudness meter shows it. */
    lra: number;
    scopeMid: Float32Array | null;
    scopeSide: Float32Array | null;
    freqs: Float32Array | null;
    outputDb: Float32Array | null;
    /** `strip` drops the scope and spectrum for the Quick result pane. */
    variant?: 'bridge' | 'strip';
  }>(),
  { variant: 'bridge' },
);

const copy = useMasteringCopy();
const laneName = computed(() => copy.value.monitor[props.lane]);
const spectrumLabels = computed(() => copy.value.meters.spectrum);
</script>

<template>
  <section
    class="meter-bridge"
    :class="`meter-bridge--${variant}`"
    :aria-label="copy.meters.title"
  >
    <header class="meter-bridge__head">
      <h3>{{ copy.meters.title }}</h3>
      <span class="meter-bridge__lane">{{ fill(copy.meters.hearing, { lane: laneName }) }}</span>
    </header>
    <div class="meter-bridge__col">
      <div class="meter-bridge__levels">
        <div class="meter-bridge__cell">
          <span class="meter-bridge__cap">{{ copy.meters.inShort }}</span>
          <PeakMeter :peak-db="reading.inputPeakDb" :labels="copy.meters.input" />
        </div>
        <div class="meter-bridge__cell">
          <span class="meter-bridge__cap">{{ copy.meters.outShort }}</span>
          <PeakMeter
            :peak-db="reading.peakDb"
            :rms-db="reading.rmsDb"
            :true-peak-db="reading.truePeakDb"
            :labels="copy.meters.output"
          />
        </div>
        <div class="meter-bridge__cell">
          <span class="meter-bridge__cap">{{ copy.rack.gr }}</span>
          <GainReductionMeter :gr-db="reading.grDb" :range-db="12" :labels="copy.meters.gr" />
        </div>
      </div>
      <LoudnessMeter
        class="meter-bridge__loudness"
        :momentary-lufs="reading.momentaryLufs"
        :short-term-lufs="reading.shortTermLufs"
        :integrated-lufs="reading.integratedLufs"
        :lra="lra"
        :true-peak-db="reading.truePeakDb"
        :target-lufs="targetLufs"
        :labels="copy.meters.loudness"
      />
      <p class="meter-bridge__render">{{ copy.meters.lastRender }}</p>
    </div>
    <div class="meter-bridge__col">
      <CorrelationMeter :correlation="reading.correlation" :labels="copy.meters.correlation" />
      <template v-if="variant === 'bridge'">
        <Goniometer class="meter-bridge__gonio" :mid="scopeMid" :side="scopeSide" :labels="copy.meters.goniometer" />
        <SpectrumView
          class="meter-bridge__spectrum"
          :freqs="freqs"
          :spectra="[outputDb]"
          :labels="spectrumLabels"
        />
      </template>
    </div>
  </section>
</template>

<style scoped>
.meter-bridge {
  display: grid;
  align-content: start;
  gap: 12px;
  min-width: 0;
  padding: 10px 12px 12px;
  border: 1px solid var(--demo-border);
  border-radius: 6px;
  background: var(--demo-bg-elevated);
}

.meter-bridge__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}

.meter-bridge__head h3,
.meter-bridge__cap {
  margin: 0;
  color: var(--demo-text-muted);
  font-family: var(--font-mono);
  font-size: var(--demo-label-size);
  font-weight: var(--demo-label-weight);
  letter-spacing: var(--demo-label-tracking);
  text-transform: uppercase;
}

.meter-bridge__lane {
  color: var(--demo-text);
  font-family: var(--font-mono);
  font-size: 10.5px;
}

.meter-bridge__levels {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  height: 230px;
  margin-bottom: 6px;
}

.meter-bridge__cell {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  justify-items: center;
  gap: 4px;
  min-height: 0;
}

.meter-bridge__loudness {
  min-height: 200px;
}

.meter-bridge__render {
  margin: -4px 0 0;
  color: var(--demo-text-muted);
  font-family: var(--font-mono);
  font-size: 10px;
  text-align: right;
}

.meter-bridge__gonio {
  width: min(100%, 220px);
  justify-self: center;
}

.meter-bridge__spectrum {
  min-height: 140px;
}

.meter-bridge--strip .meter-bridge__levels {
  height: 210px;
}

/* Columns only exist once there is room for two; otherwise the bridge is one stack. */
.meter-bridge__col {
  display: contents;
}

@container (min-width: 640px) {
  .meter-bridge--bridge {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    column-gap: 20px;
  }

  .meter-bridge--bridge .meter-bridge__head {
    grid-column: 1 / -1;
  }

  .meter-bridge--bridge .meter-bridge__col {
    display: grid;
    align-content: start;
    gap: 12px;
    min-width: 0;
  }
}
</style>
