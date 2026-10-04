<script setup lang="ts">
/**
 * Gate, compressor, de-esser and ducker of the selected strip, one at a time.
 * A parameter the engine only takes at construction rebuilds every insert on
 * the strip, so it is held while dragging and applied once on release.
 */
import { computed, reactive, ref } from 'vue';
import { TermLabel } from '@/components/ui';
import MixParam from '@/demos/mixing/MixParam.vue';
import { useMixingCopy } from '@/demos/mixing/mixingCopy';
import { defaultTrackSlots, type MixTrackState } from '@/demos/mixing/mixingState';
import { type MixingTermKey, useMixingTerm } from '@/demos/mixing/mixingTerms';
import {
  DYNAMICS_SLOTS,
  type DynamicsSlot,
  isDiscreteParam,
  TRACK_SLOT_CONTROLS,
  trackSlotProcessor,
} from '@/demos/mixing/mixingUi';
import type { MixingController } from '@/demos/mixing/useMixingStudio';

const props = defineProps<{ m: MixingController; track: MixTrackState }>();

const copy = useMixingCopy();
const term = useMixingTerm();
const { m } = props;
const { view, editLocked } = m;
const defaults = defaultTrackSlots();

const SLOT_TERMS: Record<DynamicsSlot, MixingTermKey> = {
  gate: 'gate',
  comp: 'compressor',
  deess: 'deesser',
  duck: 'ducking',
};

const slot = ref<DynamicsSlot>('comp');
const state = computed(() => props.track.slots[slot.value]);
const controls = computed(() => TRACK_SLOT_CONTROLS[slot.value]);
const keyOptions = computed(() => view.value.tracks.filter((t) => t.id !== props.track.id));

/** Values of construction-only parameters while their drag is in progress. */
const drafts = reactive<Record<string, number>>({});
let dragging: string | null = null;

const deferred = (name: string) => isDiscreteParam(trackSlotProcessor(slot.value), name);
const value = (name: string) => drafts[name] ?? state.value.params[name];
const label = (name: string) => copy.value.params[name as keyof typeof copy.value.params] ?? name;

function onBegin(name: string): void {
  dragging = name;
  if (!deferred(name)) m.begin();
}

function onUpdate(name: string, next: number): void {
  if (deferred(name) && dragging === name) drafts[name] = next;
  else m.edit('setSlotParam', props.track.id, slot.value, name, next);
}

function onEnd(name: string): void {
  dragging = null;
  if (!deferred(name)) {
    m.end();
    return;
  }
  const next = drafts[name];
  delete drafts[name];
  if (next !== undefined) m.edit('setSlotParam', props.track.id, slot.value, name, next);
}

function setKey(event: Event): void {
  const raw = (event.target as HTMLSelectElement).value;
  m.edit('setDuckKey', props.track.id, raw ? Number(raw) : null);
}
</script>

<template>
  <div class="dyn">
    <div class="dyn__tabs" role="tablist" :aria-label="copy.inspector.dynamics">
      <button
        v-for="name in DYNAMICS_SLOTS"
        :key="name"
        type="button"
        role="tab"
        class="dyn__tab"
        :class="{ 'dyn__tab--on': !track.slots[name].bypassed }"
        :aria-selected="slot === name"
        @click="slot = name"
      >{{ copy.slots[name] }}</button>
    </div>
    <div class="dyn__head">
      <TermLabel v-bind="term(SLOT_TERMS[slot])">{{ copy.slots[slot] }}</TermLabel>
      <button
        type="button"
        class="dyn__power"
        :aria-pressed="!state.bypassed"
        :disabled="editLocked"
        @click="m.edit('setSlotBypass', track.id, slot, !state.bypassed)"
      >{{ state.bypassed ? copy.common.off : copy.common.on }}</button>
    </div>
    <div class="dyn__params">
      <MixParam
        v-for="control in controls"
        :key="`${slot}-${control.name}`"
        :model-value="value(control.name)"
        :control="control"
        :label="label(control.name)"
        :default-value="defaults[slot].params[control.name]"
        :disabled="editLocked"
        :deferred="deferred(control.name)"
        :hint="deferred(control.name) ? copy.inspector.discrete : undefined"
        @update:model-value="(v) => onUpdate(control.name, v)"
        @begin="onBegin(control.name)"
        @end="onEnd(control.name)"
      />
    </div>
    <label v-if="slot === 'duck'" class="dyn__key">
      <span>{{ copy.inspector.key }}</span>
      <select :value="track.duckKeyTrackId ?? ''" :disabled="editLocked" @change="setKey">
        <option value="">{{ copy.inspector.keySelf }}</option>
        <option v-for="option in keyOptions" :key="option.id" :value="option.id">{{ option.name }}</option>
      </select>
    </label>
  </div>
</template>

<style scoped>
.dyn {
  display: grid;
  gap: 8px;
}

.dyn__tabs {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 3px;
}

.dyn__tab {
  padding: 5px 0;
  border: 1px solid var(--demo-border);
  border-radius: 4px;
  background: var(--demo-control-bg);
  color: var(--demo-text-muted);
  font-family: var(--font-mono);
  font-size: 10px;
  cursor: pointer;
}

.dyn__tab--on {
  color: var(--demo-accent);
}

.dyn__tab[aria-selected='true'] {
  border-color: var(--demo-accent-border);
  background: var(--demo-accent-subtle);
  color: var(--demo-text-strong);
}

.dyn__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.dyn__power {
  min-width: 38px;
  padding: 2px 8px;
  border: 1px solid var(--demo-border-strong);
  border-radius: 3px;
  background: var(--demo-control-bg);
  color: var(--demo-text-muted);
  font-family: var(--font-mono);
  font-size: 10px;
  cursor: pointer;
}

.dyn__power[aria-pressed='true'] {
  border-color: var(--demo-accent);
  background: var(--demo-accent);
  color: var(--demo-on-accent);
}

.dyn__power:disabled,
.dyn__key select:disabled {
  cursor: not-allowed;
  opacity: var(--demo-disabled-opacity);
}

.dyn__params {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px 14px;
}

.dyn__key {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 8px;
  color: var(--demo-text-muted);
  font-family: var(--font-mono);
  font-size: 10px;
}

.dyn__key select {
  padding: 3px 4px;
  border: 1px solid var(--demo-border-strong);
  border-radius: 3px;
  background: var(--demo-control-bg);
  color: var(--demo-text-strong);
  font-family: var(--font-body);
  font-size: 12px;
}
</style>
