<script setup lang="ts">
/**
 * The offline repair stages. Each change reruns the preprocess over the whole
 * file, so a dragged value is applied once, on release.
 */
import { reactive } from 'vue';
import MasterKnob from '@/demos/mastering/MasterKnob.vue';
import { useMasteringCopy } from '@/demos/mastering/masteringCopy';
import {
  MASTERING_REPAIR_STAGES,
  type MasteringRepair,
  type MasteringRepairStage,
} from '@/demos/mastering/masteringState';

const props = defineProps<{
  repair: MasteringRepair;
  /** Progress 0..1 while the preprocess runs, else null. */
  progress: number | null;
  failed: boolean;
  disabled?: boolean;
}>();

const emit = defineEmits<{
  enabled: [stage: MasteringRepairStage, enabled: boolean];
  param: [stage: MasteringRepairStage, name: string, value: number];
  retry: [];
  cancel: [];
}>();

const copy = useMasteringCopy();

type RepairParamName = keyof typeof copy.value.repair.params;

/** The one exposed control per stage; `start` is where an unset value is drawn. */
const CONTROLS: Partial<
  Record<
    MasteringRepairStage,
    { name: RepairParamName; min: number; max: number; step: number; unit: string; start: number }
  >
> = {
  declick: { name: 'threshold', min: 0.05, max: 0.6, step: 0.01, unit: '', start: 0.3 },
  denoise: { name: 'reductionDb', min: 0, max: 30, step: 0.5, unit: 'dB', start: 12 },
  dereverb: { name: 'attenuation', min: 0, max: 1, step: 0.01, unit: '', start: 0.3 },
};

const drafts = reactive<Partial<Record<MasteringRepairStage, number>>>({});
let dragging: MasteringRepairStage | null = null;

function stageValue(stage: MasteringRepairStage): number {
  const control = CONTROLS[stage];
  if (!control) return 0;
  const saved = props.repair[stage].params[control.name];
  return drafts[stage] ?? (typeof saved === 'number' ? saved : control.start);
}

function onUpdate(stage: MasteringRepairStage, value: number): void {
  const control = CONTROLS[stage];
  if (!control) return;
  if (dragging === stage) drafts[stage] = value;
  else emit('param', stage, control.name, value);
}

function onEnd(stage: MasteringRepairStage): void {
  dragging = null;
  const control = CONTROLS[stage];
  const value = drafts[stage];
  delete drafts[stage];
  if (control && value !== undefined) emit('param', stage, control.name, value);
}
</script>

<template>
  <div class="repair-editor">
    <p class="repair-editor__note">{{ copy.repair.note }}</p>
    <div v-if="progress !== null" class="repair-editor__progress" role="status">
      <span>{{ copy.jobs.prepare }} {{ Math.round(progress * 100) }}%</span>
      <span class="repair-editor__bar" aria-hidden="true"><i :style="{ width: `${progress * 100}%` }"></i></span>
      <button type="button" @click="emit('cancel')">{{ copy.jobs.cancel }}</button>
    </div>
    <p v-else-if="failed" class="repair-editor__failed" role="alert">
      {{ copy.repair.failed }}
      <button type="button" :disabled="disabled" @click="emit('retry')">{{ copy.repair.retry }}</button>
    </p>
    <ul class="repair-editor__stages">
      <li v-for="stage in MASTERING_REPAIR_STAGES" :key="stage" class="repair-stage">
        <label class="repair-stage__toggle">
          <input
            type="checkbox"
            :checked="repair[stage].enabled"
            :disabled="disabled"
            @change="emit('enabled', stage, ($event.target as HTMLInputElement).checked)"
          >
          <span>{{ copy.repair.stages[stage] }}</span>
        </label>
        <MasterKnob
          v-if="CONTROLS[stage] && repair[stage].enabled"
          :model-value="stageValue(stage)"
          :min="CONTROLS[stage]!.min"
          :max="CONTROLS[stage]!.max"
          :step="CONTROLS[stage]!.step"
          :unit="CONTROLS[stage]!.unit"
          :label="copy.repair.params[CONTROLS[stage]!.name]"
          :default="CONTROLS[stage]!.start"
          deferred
          :disabled="disabled"
          @begin="dragging = stage"
          @end="onEnd(stage)"
          @update:model-value="onUpdate(stage, $event)"
        />
      </li>
    </ul>
  </div>
</template>

<style scoped>
.repair-editor {
  display: grid;
  gap: 12px;
}

.repair-editor__note,
.repair-editor__failed {
  margin: 0;
  color: var(--demo-text);
  font-size: 12.5px;
  line-height: 1.55;
}

.repair-editor__failed {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border: 1px solid var(--demo-warn-border);
  border-radius: 6px;
  background: var(--demo-warn-bg);
  color: var(--demo-warn-text);
}

.repair-editor__progress {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 10px;
  font-family: var(--font-mono);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}

.repair-editor__bar {
  height: 3px;
  overflow: hidden;
  border-radius: 2px;
  background: var(--demo-border);
}

.repair-editor__bar i {
  display: block;
  height: 100%;
  background: var(--demo-accent);
}

.repair-editor button {
  padding: 4px 10px;
  border: 1px solid var(--demo-border-strong);
  border-radius: 4px;
  background: transparent;
  color: inherit;
  font-family: var(--font-mono);
  font-size: 11px;
  cursor: pointer;
}

.repair-editor button:focus-visible,
.repair-stage__toggle input:focus-visible {
  outline: 2px solid var(--demo-accent);
  outline-offset: 2px;
}

.repair-editor__stages {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.repair-stage {
  display: grid;
  gap: 8px;
  align-content: start;
  padding: 10px;
  border: 1px solid var(--demo-border);
  border-radius: 6px;
}

.repair-stage__toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--demo-text-strong);
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
}

.repair-stage__toggle input {
  accent-color: var(--demo-accent);
}
</style>
