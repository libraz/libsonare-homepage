<script setup lang="ts">
/**
 * The master section: Glue compressor and true-peak Limiter (post-fader, with
 * the master's summed gain reduction), the master fader with peak and true
 * peak, loudness (M/S/I live, LRA from the last bounce), correlation,
 * goniometer and spectrum of what is playing.
 */
import { computed } from 'vue';
import CorrelationMeter from '@/components/meters/CorrelationMeter.vue';
import GainReductionMeter from '@/components/meters/GainReductionMeter.vue';
import Goniometer from '@/components/meters/Goniometer.vue';
import LoudnessMeter from '@/components/meters/LoudnessMeter.vue';
import PeakMeter from '@/components/meters/PeakMeter.vue';
import SpectrumView from '@/components/meters/SpectrumView.vue';
import { TermLabel } from '@/components/ui';
import MixFader from '@/demos/mixing/MixFader.vue';
import MixParam from '@/demos/mixing/MixParam.vue';
import { useMixingCopy } from '@/demos/mixing/mixingCopy';
import { defaultMasterSlots, MASTER_SLOTS, type MasterSlotName } from '@/demos/mixing/mixingState';
import { useMixingTerm } from '@/demos/mixing/mixingTerms';
import { formatFader, MASTER_SLOT_CONTROLS } from '@/demos/mixing/mixingUi';
import type { MixingController } from '@/demos/mixing/useMixingStudio';

const props = defineProps<{ m: MixingController }>();

const copy = useMixingCopy();
const term = useMixingTerm();
const { m } = props;
const { view, editLocked, metering, lastRender } = m;
const { frame, spectrumFreqs, outputDb, scopeMid, scopeSide } = metering;
const defaults = defaultMasterSlots();

const master = computed(() => frame.value.master);
const lra = computed(() => lastRender.value?.result.loudnessRange ?? Number.NaN);
const termKey = (slot: MasterSlotName) => (slot === 'glue' ? 'glue' : 'limiter');

const peakLabels = computed(() => ({
  name: copy.value.master.peak,
  clip: copy.value.console.clip,
  clearClip: copy.value.console.clearClip,
}));
const grLabels = computed(() => ({ name: `${copy.value.master.title} ${copy.value.console.gr}` }));
const paramLabel = (name: string) =>
  copy.value.params[name as keyof typeof copy.value.params] ?? name;
</script>

<template>
  <section class="master" :aria-label="copy.master.title">
    <header class="master__head">
      <h3>{{ copy.master.title }}</h3>
    </header>

    <div class="master__chain">
      <div v-for="slot in MASTER_SLOTS" :key="slot" class="master__slot">
        <div class="master__slot-head">
          <button
            type="button"
            class="master__power"
            :aria-pressed="!view.master.slots[slot].bypassed"
            :disabled="editLocked"
            @click="m.edit('setMasterSlotBypass', slot, !view.master.slots[slot].bypassed)"
          >{{ view.master.slots[slot].bypassed ? copy.common.off : copy.common.on }}</button>
          <TermLabel v-bind="term(termKey(slot), true)">{{ copy.slots[slot] }}</TermLabel>
        </div>
        <details v-if="slot === 'glue'" class="master__details">
          <summary>{{ copy.inspector.dynamics }}</summary>
          <div class="master__params">
            <MixParam
              v-for="control in MASTER_SLOT_CONTROLS.glue"
              :key="control.name"
              :model-value="view.master.slots.glue.params[control.name]"
              :control="control"
              :label="paramLabel(control.name)"
              :default-value="defaults.glue.params[control.name]"
              :disabled="editLocked"
              @update:model-value="(v) => m.edit('setMasterSlotParam', 'glue', control.name, v)"
              @begin="m.begin"
              @end="m.end"
            />
          </div>
        </details>
        <div v-else class="master__params">
          <MixParam
            v-for="control in MASTER_SLOT_CONTROLS.limiter"
            :key="control.name"
            :model-value="view.master.slots.limiter.params[control.name]"
            :control="control"
            :label="paramLabel(control.name)"
            :default-value="defaults.limiter.params[control.name]"
            :disabled="editLocked"
            @update:model-value="(v) => m.edit('setMasterSlotParam', 'limiter', control.name, v)"
            @begin="m.begin"
            @end="m.end"
          />
        </div>
      </div>
      <div class="master__gr">
        <TermLabel v-bind="term('gainReduction', true)">{{ copy.console.gr }}</TermLabel>
        <GainReductionMeter orientation="horizontal" :gr-db="master.grDb" :range-db="12" :labels="grLabels" />
      </div>
    </div>

    <div class="master__levels">
      <div class="master__fader">
        <MixFader
          :model-value="view.master.faderDb"
          :label="copy.master.title"
          :disabled="editLocked"
          @update:model-value="(v) => m.edit('setMasterFader', v)"
          @begin="m.begin"
          @end="m.end"
        />
        <output>{{ formatFader(view.master.faderDb) }}</output>
      </div>
      <PeakMeter
        class="master__peak"
        :peak-db="master.peakDb"
        :rms-db="master.rmsDb"
        :true-peak-db="master.truePeakDb"
        :labels="peakLabels"
      />
      <LoudnessMeter
        class="master__loudness"
        :momentary-lufs="master.momentaryLufs"
        :short-term-lufs="master.shortTermLufs"
        :integrated-lufs="master.integratedLufs"
        :lra="lra"
        :true-peak-db="master.truePeakDb"
        :labels="copy.master.loudness"
      />
    </div>
    <p class="master__note">
      <TermLabel v-bind="term('lufs', true)">LUFS</TermLabel>
      <span>{{ copy.master.lraNote }}</span>
    </p>

    <CorrelationMeter :correlation="master.correlation" :labels="copy.master.correlation" />
    <div class="master__scopes">
      <Goniometer class="master__gonio" :mid="scopeMid" :side="scopeSide" :labels="copy.master.goniometer" />
      <SpectrumView
        class="master__spectrum"
        :freqs="spectrumFreqs"
        :spectra="[outputDb]"
        :labels="copy.master.spectrum"
      />
    </div>
  </section>
</template>

<style scoped>
.master {
  display: grid;
  align-content: start;
  gap: 10px;
  min-width: 0;
  padding: 10px 12px 12px;
  border: 1px solid var(--demo-border-strong);
  border-radius: 6px;
  background: var(--demo-bg-elevated);
}

.master__head h3 {
  margin: 0;
  color: var(--demo-text-strong);
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: var(--demo-label-tracking);
  text-transform: uppercase;
}

.master__chain {
  display: grid;
  gap: 8px;
}

.master__slot {
  display: grid;
  gap: 6px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--demo-border);
}

.master__slot-head {
  display: flex;
  align-items: center;
  gap: 8px;
}

.master__power {
  min-width: 34px;
  padding: 2px 6px;
  border: 1px solid var(--demo-border-strong);
  border-radius: 3px;
  background: var(--demo-control-bg);
  color: var(--demo-text-muted);
  font-family: var(--font-mono);
  font-size: 9.5px;
  cursor: pointer;
}

.master__power[aria-pressed='true'] {
  border-color: var(--demo-accent);
  background: var(--demo-accent);
  color: var(--demo-on-accent);
}

.master__power:disabled {
  cursor: not-allowed;
  opacity: var(--demo-disabled-opacity);
}

.master__details summary {
  color: var(--demo-text-muted);
  font-family: var(--font-mono);
  font-size: 10px;
  cursor: pointer;
}

.master__params {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px 12px;
  padding-top: 4px;
}

.master__gr {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 8px;
}

.master__levels {
  display: grid;
  grid-template-columns: auto minmax(64px, 0.8fr) minmax(0, 1.4fr);
  gap: 10px;
  height: 230px;
}

.master__fader {
  display: grid;
  grid-template-rows: 1fr auto;
  justify-items: center;
  gap: 4px;
}

.master__fader :deep(.fader) {
  --fader-height: 206px;
}

.master__fader output {
  color: var(--demo-text-strong);
  font-family: var(--font-mono);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}

.master__peak {
  min-width: 64px;
}

.master__loudness {
  min-width: 0;
}

.master__note {
  display: flex;
  gap: 8px;
  margin: 0;
  color: var(--demo-text-muted);
  font-family: var(--font-mono);
  font-size: 10px;
}

.master__scopes {
  display: grid;
  gap: 10px;
}

.master__gonio {
  justify-self: center;
  width: min(100%, 180px);
  aspect-ratio: 1;
}

.master__spectrum {
  min-height: 140px;
}
</style>
