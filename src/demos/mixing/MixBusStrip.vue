<script setup lang="ts">
/**
 * An aux return strip: the bus effect's live parameters, its return level on a
 * fader and the bus meter. The plate's `decay` feedback is edited as the tail
 * length it gives.
 */
import { computed } from 'vue';
import PeakMeter from '@/components/meters/PeakMeter.vue';
import MixFader from '@/demos/mixing/MixFader.vue';
import MixKnob from '@/demos/mixing/MixKnob.vue';
import { useMixingCopy } from '@/demos/mixing/mixingCopy';
import { type AuxBusName, defaultBuses, plateDecayFromSeconds } from '@/demos/mixing/mixingState';
import {
  BUS_CONTROLS,
  formatFader,
  formatParam,
  type ParamControl,
  PLATE_DECAY_SECONDS,
  plateSecondsFromDecay,
} from '@/demos/mixing/mixingUi';
import type { StripReading } from '@/demos/mixing/useMixingMetering';
import type { MixingController } from '@/demos/mixing/useMixingStudio';
import { fill } from '@/utils/template';

const props = defineProps<{
  m: MixingController;
  bus: AuxBusName;
  reading: StripReading;
}>();

const copy = useMixingCopy();
const { m } = props;
const { view, editLocked } = m;
const defaults = defaultBuses();

const busState = computed(() => view.value.buses[props.bus]);
const name = computed(() => copy.value.buses[props.bus]);
const controls = computed(() => BUS_CONTROLS[props.bus]);

function value(control: ParamControl): number {
  const raw = busState.value.params[control.name];
  return control === PLATE_DECAY_SECONDS ? plateSecondsFromDecay(raw) : raw;
}

function defaultOf(control: ParamControl): number {
  const raw = defaults[props.bus].params[control.name];
  return control === PLATE_DECAY_SECONDS ? plateSecondsFromDecay(raw) : raw;
}

function display(control: ParamControl): string {
  const text = formatParam(value(control), control);
  return control.percent ? `${text}%` : `${text} ${control.unit}`;
}

function update(control: ParamControl, next: number): void {
  const raw = control === PLATE_DECAY_SECONDS ? plateDecayFromSeconds(next) : next;
  m.edit('setBusParam', props.bus, control.name, raw);
}

const pingPong = computed(() => props.bus === 'delay' && busState.value.params.pingPong >= 0.5);

const meterLabels = computed(() => ({
  name: fill(copy.value.console.meter, { name: name.value }),
  clip: copy.value.console.clip,
  clearClip: copy.value.console.clearClip,
}));
</script>

<template>
  <section class="bus" :aria-label="name">
    <header class="bus__head">
      <span class="bus__name">{{ name }}</span>
    </header>
    <div class="bus__params">
      <MixKnob
        v-for="control in controls"
        :key="control.name"
        :model-value="value(control)"
        :control="control"
        :label="`${name} ${copy.params[control.name as keyof typeof copy.params]}`"
        :display="display(control)"
        :caption="copy.params[control.name as keyof typeof copy.params]"
        :default-value="defaultOf(control)"
        :disabled="editLocked"
        @update:model-value="(v) => update(control, v)"
        @begin="m.begin"
        @end="m.end"
      />
      <button
        v-if="bus === 'delay'"
        type="button"
        class="bus__toggle"
        :aria-pressed="pingPong"
        :disabled="editLocked"
        @click="m.edit('setBusParam', 'delay', 'pingPong', pingPong ? 0 : 1)"
      >{{ copy.buses.pingPong }}</button>
    </div>
    <div class="bus__fader">
      <MixFader
        :model-value="busState.gainDb"
        :label="`${name} ${copy.params.gainDb}`"
        :disabled="editLocked"
        :scale="false"
        @update:model-value="(v) => m.edit('setBusGain', bus, v)"
        @begin="m.begin"
        @end="m.end"
      />
      <PeakMeter :peak-db="reading.peakDb" :rms-db="reading.rmsDb" :labels="meterLabels" />
    </div>
    <output class="bus__readout">{{ formatFader(busState.gainDb) }}</output>
  </section>
</template>

<style scoped>
.bus {
  display: grid;
  grid-template-rows: auto 1fr auto auto;
  gap: 7px;
  width: 104px;
  padding: 8px 7px 9px;
  border: 1px solid var(--demo-border);
  border-radius: 6px;
  background: var(--demo-bg-elevated);
}

.bus__name {
  color: var(--demo-cyan);
  font-family: var(--font-mono);
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: var(--demo-label-tracking);
  text-transform: uppercase;
}

.bus__params {
  display: grid;
  align-content: start;
  gap: 6px;
}

.bus__toggle {
  padding: 3px 0;
  border: 1px solid var(--demo-border-strong);
  border-radius: 3px;
  background: var(--demo-control-bg);
  color: var(--demo-text-muted);
  font-family: var(--font-mono);
  font-size: 9.5px;
  cursor: pointer;
}

.bus__toggle[aria-pressed='true'] {
  border-color: var(--demo-cyan);
  color: var(--demo-cyan);
}

.bus__toggle:disabled {
  cursor: not-allowed;
  opacity: var(--demo-disabled-opacity);
}

.bus__fader {
  display: grid;
  grid-template-columns: 26px minmax(0, 1fr);
  gap: 4px;
  height: 172px;
}

.bus__fader :deep(.fader) {
  --fader-height: 172px;
  grid-template-columns: 22px;
}

.bus__fader :deep(.peak-meter__readout) {
  display: none;
}

.bus__readout {
  color: var(--demo-text-strong);
  font-family: var(--font-mono);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  text-align: center;
}
</style>
