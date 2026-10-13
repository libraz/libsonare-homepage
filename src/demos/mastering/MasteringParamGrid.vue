<script setup lang="ts">
/**
 * The controls of one insert slot, in the groups `MASTERING_SLOT_CONTROLS`
 * lists. A parameter the engine cannot change while running is applied once,
 * on release, because each change rebuilds the chain's inserts.
 */
import { computed, reactive } from 'vue';
import MasterKnob from '@/demos/mastering/MasterKnob.vue';
import { useMasteringCopy } from '@/demos/mastering/masteringCopy';
import { isRtSafeParam } from '@/demos/mastering/masteringEngine';
import {
  MASTERING_INSERT_LAYOUT,
  type MasteringInsert,
  type MasteringParamValue,
} from '@/demos/mastering/masteringState';
import {
  MASTERING_PARAM_ORDER,
  MASTERING_SLOT_CONTROLS,
  type MasteringParamControl,
  type MasteringParamSpec,
} from '@/demos/mastering/masteringUi';

const props = defineProps<{
  slotIndex: number;
  insert: MasteringInsert;
  disabled?: boolean;
}>();

const emit = defineEmits<{
  param: [name: string, value: MasteringParamValue];
  begin: [];
  end: [];
}>();

const copy = useMasteringCopy();
const entry = computed(() => MASTERING_INSERT_LAYOUT[props.slotIndex]);
const groups = computed(() => MASTERING_SLOT_CONTROLS[entry.value.id]);
/** Values of deferred parameters while their drag is in progress. */
const drafts = reactive<Record<string, number>>({});
let dragging: string | null = null;

const isToggle = (spec: MasteringParamSpec): spec is { name: string; toggle: true } =>
  'toggle' in spec;
const deferred = (name: string) => !isRtSafeParam(entry.value.processor, name);

function label(name: string): string {
  const leaf = name.includes('.') ? name.slice(name.indexOf('.') + 1) : name;
  return copy.value.params[leaf as keyof typeof copy.value.params] ?? leaf;
}

function currentValue(name: string): number {
  return drafts[name] ?? (props.insert.params[name] as number);
}

function onBegin(name: string): void {
  dragging = name;
  if (!deferred(name)) emit('begin');
}

function onUpdate(name: string, value: number): void {
  if (deferred(name) && dragging === name) drafts[name] = value;
  else emit('param', name, value);
}

function onEnd(name: string): void {
  dragging = null;
  if (deferred(name)) {
    const value = drafts[name];
    delete drafts[name];
    if (value !== undefined) emit('param', name, value);
  } else {
    emit('end');
  }
}

function defaultOf(spec: MasteringParamControl): number {
  return entry.value.params[spec.name] as number;
}

/** The control's travel, narrowed to keep it on its side of a sibling it is ordered against. */
function rangeOf(spec: MasteringParamControl): { min: number; max: number } {
  let { min, max } = spec;
  for (const order of MASTERING_PARAM_ORDER[entry.value.processor]?.[spec.name] ?? []) {
    const sibling = currentValue(order.key);
    if (order.relation === 'lt') max = Math.min(max, sibling - spec.step);
    else min = Math.max(min, sibling + spec.step);
  }
  return { min, max };
}
</script>

<template>
  <div class="param-grid">
    <fieldset
      v-for="group in groups"
      :key="group.group"
      class="param-grid__group"
      :disabled="disabled"
    >
      <legend v-if="groups.length > 1">{{ copy.groups[group.group] }}</legend>
      <div class="param-grid__controls">
        <template v-for="spec in group.params" :key="spec.name">
          <label v-if="isToggle(spec)" class="param-grid__toggle">
            <input
              type="checkbox"
              :checked="insert.params[spec.name] === true"
              :disabled="disabled"
              @change="emit('param', spec.name, ($event.target as HTMLInputElement).checked)"
            >
            <span>{{ label(spec.name) }}</span>
          </label>
          <MasterKnob
            v-else
            :model-value="currentValue(spec.name)"
            :min="rangeOf(spec).min"
            :max="rangeOf(spec).max"
            :step="spec.step"
            :unit="spec.unit"
            :scale="spec.scale"
            :label="label(spec.name)"
            :default="defaultOf(spec)"
            :deferred="deferred(spec.name)"
            :hint="deferred(spec.name) ? copy.editor.discrete : undefined"
            :disabled="disabled"
            @begin="onBegin(spec.name)"
            @end="onEnd(spec.name)"
            @update:model-value="onUpdate(spec.name, $event)"
          />
        </template>
      </div>
    </fieldset>
  </div>
</template>

<style scoped>
.param-grid {
  display: grid;
  gap: 14px;
}

.param-grid__group {
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
}

.param-grid__group legend {
  margin-bottom: 8px;
  padding: 0;
  color: var(--demo-text);
  font-family: var(--font-mono);
  font-size: var(--demo-label-size);
  font-weight: var(--demo-label-weight);
  letter-spacing: var(--demo-label-tracking);
  text-transform: uppercase;
}

.param-grid__controls {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 12px 18px;
}

.param-grid__toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--demo-text);
  font-family: var(--font-mono);
  font-size: 11px;
  cursor: pointer;
}

.param-grid__toggle input {
  accent-color: var(--demo-accent);
}

.param-grid__toggle input:focus-visible {
  outline: 2px solid var(--demo-accent);
  outline-offset: 2px;
}
</style>
