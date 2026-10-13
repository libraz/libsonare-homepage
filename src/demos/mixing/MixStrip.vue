<script setup lang="ts">
/**
 * One channel strip in signal order: input meter, trim, EQ curve, the four
 * dynamics slots with the strip's gain reduction, two sends with their tap
 * point, pan, width, fader with its post-fader meter, then mute, solo,
 * solo-safe, polarity, output bus and VCA assignment. An automated control
 * follows its lane at the playhead and takes no edits.
 */
import { computed } from 'vue';
import GainReductionMeter from '@/components/meters/GainReductionMeter.vue';
import { METER_FLOOR_DB } from '@/components/meters/meterBallistics';
import PeakMeter from '@/components/meters/PeakMeter.vue';
import { Tooltip } from '@/components/ui';
import MixEqCurve from '@/demos/mixing/MixEqCurve.vue';
import MixFader from '@/demos/mixing/MixFader.vue';
import MixKnob from '@/demos/mixing/MixKnob.vue';
import { VCA_GROUP_IDS } from '@/demos/mixing/mixingConstants';
import { useMixingCopy } from '@/demos/mixing/mixingCopy';
import {
  AUX_BUSES,
  type AuxBusName,
  GROUP_BUSES,
  type GroupBusName,
  isTrackSilenced,
  type MixTrackState,
  SEND_OFF_DB,
  type VcaGroupId,
} from '@/demos/mixing/mixingState';
import {
  automationValueAt,
  DYNAMICS_SLOTS,
  type DynamicsSlot,
  formatFader,
  formatNumber,
  formatPan,
  PAN_CONTROL,
  SEND_CONTROL,
  TRIM_CONTROL,
  WIDTH_CONTROL,
} from '@/demos/mixing/mixingUi';
import type { StripReading } from '@/demos/mixing/useMixingMetering';
import type { MixingController } from '@/demos/mixing/useMixingStudio';
import { fill } from '@/utils/template';

const props = defineProps<{
  m: MixingController;
  track: MixTrackState;
  index: number;
  reading: StripReading | undefined;
}>();

const FLOOR: [number, number] = [METER_FLOOR_DB, METER_FLOOR_DB];

const copy = useMixingCopy();
const { m } = props;
const { view, editLocked, selectedId, rebuilt, sonare } = m;

const id = computed(() => props.track.id);
const name = computed(() => props.track.name);
const selected = computed(() => selectedId.value === id.value);
const silenced = computed(() => isTrackSilenced(view.value, props.track));
const reading = computed(() => props.reading);
const position = computed(() => sonare.position.value);

const faderAuto = computed(() => props.track.automation.fader.length > 0);
const panAuto = computed(() => props.track.automation.pan.length > 0);
const widthAuto = computed(() => props.track.automation.width.length > 0);
const faderValue = computed(() =>
  faderAuto.value
    ? automationValueAt(props.track.automation.fader, position.value, props.track.faderDb)
    : props.track.faderDb,
);
const panValue = computed(() =>
  panAuto.value
    ? automationValueAt(props.track.automation.pan, position.value, props.track.pan)
    : props.track.pan,
);
const widthValue = computed(() => {
  const fallback = props.track.slots.width.params.width;
  return widthAuto.value
    ? automationValueAt(props.track.automation.width, position.value, fallback)
    : fallback;
});
const trim = computed(() => props.track.slots.trim.params.levelDb);
const polarity = computed(() => props.track.polarityLeft || props.track.polarityRight);

const curve = computed(() => m.eqCurve(props.track.eq));
const eqActive = computed(() => props.track.eq.some((band) => band.enabled));

const meterLabels = computed(() => ({
  name: fill(copy.value.console.meter, { name: name.value }),
  clip: copy.value.console.clip,
  clearClip: copy.value.console.clearClip,
}));
const inputLabels = computed(() => ({
  ...meterLabels.value,
  name: fill(copy.value.console.inputMeter, { name: name.value }),
}));
const grLabels = computed(() => ({ name: `${name.value} ${copy.value.console.gr}` }));

function sendDisplay(bus: AuxBusName): string {
  const level = props.track.sends[bus].levelDb;
  return level <= SEND_OFF_DB ? 'OFF' : formatNumber(level, 1);
}

function select(): void {
  selectedId.value = id.value;
}

function toggleSlot(slot: DynamicsSlot): void {
  m.edit('setSlotBypass', id.value, slot, !props.track.slots[slot].bypassed);
}

function slotLabel(slot: DynamicsSlot): string {
  const template = props.track.slots[slot].bypassed
    ? copy.value.console.slotOff
    : copy.value.console.slotOn;
  return fill(template, { slot: copy.value.slots[slot] });
}

function toggleTiming(bus: AuxBusName): void {
  const timing = props.track.sends[bus].timing === 'preFader' ? 'postFader' : 'preFader';
  m.edit('setSend', id.value, bus, { timing });
}

function togglePolarity(): void {
  // Both sides fold into one history entry.
  const next = !polarity.value;
  m.begin();
  m.edit('setPolarity', id.value, 'left', next);
  m.edit('setPolarity', id.value, 'right', next);
  m.end();
}

function rename(event: Event): void {
  const value = (event.target as HTMLTextAreaElement).value.trim();
  if (value && value !== name.value) m.edit('renameTrack', id.value, value);
  else (event.target as HTMLTextAreaElement).value = name.value;
}

function setVca(event: Event): void {
  const value = (event.target as HTMLSelectElement).value;
  m.edit('setVcaGroup', id.value, value ? (value as VcaGroupId) : null);
}

function setOutput(event: Event): void {
  const value = (event.target as HTMLSelectElement).value;
  m.edit('setOutputBus', id.value, value ? (value as GroupBusName) : null);
}
</script>

<template>
  <section
    class="strip"
    :class="{
      'strip--selected': selected,
      'strip--silenced': silenced,
      'strip--rebuilt': rebuilt.has(id),
    }"
    :aria-label="name"
    @pointerdown.capture="select"
    @focusin="select"
  >
    <header class="strip__head">
      <span class="strip__index">{{ String(index + 1).padStart(2, '0') }}</span>
      <textarea
        class="strip__name"
        rows="2"
        :value="name"
        :title="name"
        :aria-label="fill(copy.console.name, { n: index + 1 })"
        :disabled="editLocked"
        maxlength="40"
        @change="rename"
        @keydown.enter.prevent="($event.target as HTMLTextAreaElement).blur()"
      />
      <button
        type="button"
        class="strip__remove"
        :aria-label="fill(copy.console.remove, { name })"
        :disabled="editLocked"
        @click="m.removeTrack(id)"
      >×</button>
    </header>

    <div class="strip__row strip__input">
      <span class="strip__tag">{{ copy.console.input }}</span>
      <PeakMeter
        orientation="horizontal"
        :peak-db="reading?.inputPeakDb ?? FLOOR"
        :labels="inputLabels"
      />
    </div>

    <MixKnob
      :model-value="trim"
      :control="TRIM_CONTROL"
      :label="`${name} ${copy.slots.trim}`"
      :display="`${formatNumber(trim, 1, true)} dB`"
      :caption="copy.slots.trim"
      :default-value="0"
      :disabled="editLocked"
      @update:model-value="(v) => m.edit('setSlotParam', id, 'trim', 'levelDb', v)"
      @begin="m.begin"
      @end="m.end"
    />

    <button
      type="button"
      class="strip__eq"
      :class="{ 'strip__eq--on': eqActive }"
      :aria-label="`${name} ${copy.console.eq}`"
      @click="select"
    >
      <MixEqCurve :points="curve" :range-db="18" />
      <span class="strip__tag">{{ copy.console.eq }}</span>
    </button>

    <div class="strip__slots">
      <button
        v-for="slot in DYNAMICS_SLOTS"
        :key="slot"
        type="button"
        class="strip__slot"
        :class="{ 'strip__slot--on': !track.slots[slot].bypassed }"
        :aria-pressed="!track.slots[slot].bypassed"
        :aria-label="slotLabel(slot)"
        :disabled="editLocked"
        @click="toggleSlot(slot)"
      >{{ copy.slotsShort[slot] }}</button>
      <GainReductionMeter
        class="strip__gr"
        orientation="horizontal"
        :gr-db="reading?.grDb ?? 0"
        :range-db="24"
        :labels="grLabels"
      />
    </div>

    <div class="strip__sends">
      <div v-for="bus in AUX_BUSES" :key="bus" class="strip__send">
        <MixKnob
          :model-value="track.sends[bus].levelDb"
          :control="SEND_CONTROL"
          :label="`${name} ${copy.buses[bus]}`"
          :display="sendDisplay(bus)"
          :default-value="SEND_OFF_DB"
          :disabled="editLocked"
          @update:model-value="(v) => m.edit('setSend', id, bus, { levelDb: v })"
          @begin="m.begin"
          @end="m.end"
        />
        <div class="strip__send-meta">
          <span class="strip__tag">{{ copy.sends[bus] }}</span>
          <button
            type="button"
            class="strip__tap"
            :class="{ 'strip__tap--pre': track.sends[bus].timing === 'preFader' }"
            :aria-pressed="track.sends[bus].timing === 'preFader'"
            :aria-label="`${name} ${copy.buses[bus]} ${copy.console.pre}`"
            :disabled="editLocked"
            @click="toggleTiming(bus)"
          >{{ track.sends[bus].timing === 'preFader' ? copy.console.pre : copy.console.post }}</button>
        </div>
      </div>
    </div>

    <div class="strip__pair">
      <MixKnob
        :model-value="panValue"
        :control="PAN_CONTROL"
        :label="`${name} ${copy.params.pan}`"
        :display="formatPan(panValue)"
        :caption="copy.params.pan"
        :default-value="0"
        :disabled="editLocked"
        :locked="panAuto"
        :locked-hint="copy.console.automated"
        @update:model-value="(v) => m.edit('setPan', id, v)"
        @begin="m.begin"
        @end="m.end"
      />
      <MixKnob
        :model-value="widthValue"
        :control="WIDTH_CONTROL"
        :label="`${name} ${copy.params.width}`"
        :display="`${Math.round(widthValue * 100)}%`"
        :caption="copy.params.width"
        :default-value="1"
        :disabled="editLocked"
        :locked="widthAuto"
        :locked-hint="copy.console.automated"
        @update:model-value="(v) => m.edit('setSlotParam', id, 'width', 'width', v)"
        @begin="m.begin"
        @end="m.end"
      />
    </div>

    <div class="strip__fader">
      <MixFader
        :model-value="faderValue"
        :label="`${name} ${copy.params.fader}`"
        :disabled="editLocked"
        :locked="faderAuto"
        :scale="false"
        @update:model-value="(v) => m.edit('setFader', id, v)"
        @begin="m.begin"
        @end="m.end"
      />
      <PeakMeter
        class="strip__meter"
        :peak-db="reading?.peakDb ?? FLOOR"
        :rms-db="reading?.rmsDb ?? null"
        :labels="meterLabels"
      />
    </div>
    <div class="strip__readout">
      <output>{{ formatFader(faderValue) }}</output>
      <Tooltip
        v-if="faderAuto"
        :title="`${name} ${copy.params.fader}`"
        :body="copy.console.automated"
      />
    </div>

    <div class="strip__buttons">
      <button
        type="button"
        class="strip__btn strip__btn--mute"
        :aria-pressed="track.muted"
        :aria-label="fill(copy.console.mutePressed, { name })"
        :disabled="editLocked"
        @click="m.edit('setMute', id, !track.muted)"
      >{{ copy.console.mute }}</button>
      <button
        type="button"
        class="strip__btn strip__btn--solo"
        :aria-pressed="track.soloed"
        :aria-label="fill(copy.console.soloPressed, { name })"
        :disabled="editLocked"
        @click="m.edit('setSolo', id, !track.soloed)"
      >{{ copy.console.solo }}</button>
      <button
        type="button"
        class="strip__btn"
        :aria-pressed="track.soloSafe"
        :aria-label="fill(copy.console.safePressed, { name })"
        :disabled="editLocked"
        @click="m.edit('setSoloSafe', id, !track.soloSafe)"
      >{{ copy.console.safe }}</button>
      <button
        type="button"
        class="strip__btn"
        :aria-pressed="polarity"
        :aria-label="fill(copy.console.polarityPressed, { name })"
        :disabled="editLocked"
        @click="togglePolarity"
      >{{ copy.console.polarity }}</button>
    </div>

    <label class="strip__select">
      <span class="strip__tag">{{ copy.console.output }}</span>
      <select class="demo-field" :value="track.outputBus ?? ''" :disabled="editLocked" @change="setOutput">
        <option value="">{{ copy.console.outputMaster }}</option>
        <option v-for="group in GROUP_BUSES" :key="group" :value="group">{{ copy.groups[group] }}</option>
      </select>
    </label>
    <label class="strip__select">
      <span class="strip__tag">{{ copy.console.vca }}</span>
      <select class="demo-field" :value="track.vcaGroup ?? ''" :disabled="editLocked" @change="setVca">
        <option value="">{{ copy.console.vcaNone }}</option>
        <option v-for="group in VCA_GROUP_IDS" :key="group" :value="group">{{ group }}</option>
      </select>
    </label>

    <Transition name="demo-fade">
      <p v-if="rebuilt.has(id)" class="strip__flash" role="status">{{ copy.console.rebuilt }}</p>
    </Transition>
  </section>
</template>

<style scoped>
.strip {
  position: relative;
  display: grid;
  grid-auto-rows: min-content;
  justify-items: stretch;
  gap: 7px;
  width: 104px;
  padding: 8px 7px 9px;
  border: 1px solid var(--demo-border);
  border-radius: var(--demo-radius-sm);
  background: var(--demo-bg-elevated);
  transition:
    background-color var(--demo-dur-slow) var(--demo-ease-standard),
    border-color var(--demo-dur-fast) var(--demo-ease-standard),
    opacity var(--demo-dur-fast) var(--demo-ease-standard);
}

.strip--selected {
  border-color: var(--demo-accent-border);
  background: var(--demo-accent-subtle);
}

.strip--silenced {
  opacity: 0.62;
}

.strip--rebuilt {
  background: var(--demo-warn-bg);
  transition: none;
}

.strip__head {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 4px;
}

.strip__index,
.strip__tag {
  color: var(--demo-text-faint);
  font-family: var(--font-mono);
  font-size: var(--demo-label-size);
  font-weight: var(--demo-label-weight);
  letter-spacing: var(--demo-label-tracking);
  font-variant-numeric: tabular-nums;
}

.strip__name {
  min-width: 0;
  padding: 2px 3px;
  border: 1px solid transparent;
  border-radius: 3px;
  background: transparent;
  color: var(--demo-text-strong);
  font-family: var(--font-body);
  font-size: 11.5px;
  font-weight: 600;
  line-height: 1.25;
  overflow: hidden;
  overflow-wrap: anywhere;
  resize: none;
}

.strip__name:hover,
.strip__name:focus {
  border-color: var(--demo-border-strong);
  background: var(--demo-control-bg);
  outline: none;
}

.strip__remove {
  width: 16px;
  height: 16px;
  padding: 0;
  border: 0;
  border-radius: 3px;
  background: transparent;
  color: var(--demo-text-faint);
  font-size: 13px;
  line-height: 1;
  cursor: pointer;
}

.strip__remove:hover:not(:disabled) {
  color: var(--demo-danger);
}

.strip__row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 4px;
}

.strip__input :deep(.peak-meter__clip) {
  display: none;
}

.strip__eq {
  display: grid;
  gap: 1px;
  padding: 3px 3px 2px;
  border: 1px solid var(--demo-border);
  border-radius: 4px;
  background: var(--demo-control-bg);
  color: inherit;
  cursor: pointer;
}

.strip__eq--on {
  border-color: var(--demo-accent-border);
}

.strip__slots {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 3px;
}

.strip__slot,
.strip__btn,
.strip__tap {
  min-width: 0;
  padding: 3px 0;
  border: 1px solid var(--demo-border-strong);
  border-radius: 3px;
  background: var(--demo-control-bg);
  color: var(--demo-text-muted);
  font-family: var(--font-mono);
  font-size: 9.5px;
  letter-spacing: 0.02em;
  cursor: pointer;
  transition:
    background-color var(--demo-dur-fast) var(--demo-ease-standard),
    border-color var(--demo-dur-fast) var(--demo-ease-standard),
    color var(--demo-dur-fast) var(--demo-ease-standard),
    transform var(--demo-dur-instant) var(--demo-ease-standard);
}

.strip__slot:hover:not(:disabled),
.strip__btn:hover:not(:disabled),
.strip__tap:hover:not(:disabled) {
  border-color: var(--demo-accent);
}

.strip__slot:active:not(:disabled),
.strip__btn:active:not(:disabled),
.strip__tap:active:not(:disabled) {
  transform: scale(0.97);
}

.strip__slot:focus-visible,
.strip__btn:focus-visible,
.strip__tap:focus-visible,
.strip__eq:focus-visible,
.strip__remove:focus-visible {
  outline: 2px solid var(--demo-accent);
  outline-offset: 1px;
}

.strip__slot--on {
  border-color: var(--demo-accent);
  background: var(--demo-accent-subtle);
  color: var(--demo-accent);
}

.strip__gr {
  grid-column: 1 / -1;
}

.strip__sends {
  display: grid;
  gap: 4px;
}

.strip__send {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 4px;
}

.strip__send-meta {
  display: grid;
  gap: 3px;
  justify-items: stretch;
}

.strip__tap {
  padding: 1px 0;
  font-size: 8.5px;
}

.strip__tap--pre {
  border-color: var(--demo-amber);
  color: var(--demo-warn-text);
}

.strip__pair {
  display: grid;
  grid-template-columns: 1fr 1fr;
}

.strip__fader {
  display: grid;
  grid-template-columns: 26px minmax(0, 1fr);
  align-items: stretch;
  gap: 4px;
  height: 172px;
}

.strip__fader :deep(.fader) {
  --fader-height: 172px;
  grid-template-columns: 22px;
}

.strip__meter {
  min-height: 0;
}

.strip__meter :deep(.peak-meter__readout) {
  display: none;
}

.strip__meter :deep(.peak-meter__clip) {
  font-size: 8px;
}

.strip__readout {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  color: var(--demo-text-strong);
  font-family: var(--font-mono);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}

.strip__buttons {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 3px;
}

.strip__btn[aria-pressed='true'] {
  border-color: var(--demo-accent);
  background: var(--demo-accent);
  color: var(--demo-on-accent);
}

.strip__btn--mute[aria-pressed='true'] {
  border-color: var(--demo-amber);
  background: var(--demo-amber);
}

.strip__btn--solo[aria-pressed='true'] {
  border-color: var(--demo-status-ok);
  background: var(--demo-status-ok);
}

.strip__select {
  display: grid;
  grid-template-columns: 26px minmax(0, 1fr);
  align-items: center;
  gap: 4px;
}

.strip__select .demo-field {
  height: 22px;
  padding: 0 18px 0 4px;
  font-size: 9.5px;
  background-position: calc(100% - 10px) 50%, calc(100% - 6px) 50%;
}

.strip button:disabled {
  cursor: not-allowed;
  opacity: var(--demo-disabled-opacity);
}

.strip__flash {
  position: absolute;
  inset: auto 4px 4px;
  margin: 0;
  padding: 2px 4px;
  border-radius: 3px;
  background: var(--demo-warn-bg);
  color: var(--demo-warn-text);
  font-family: var(--font-mono);
  font-size: 9px;
  text-align: center;
}

</style>
