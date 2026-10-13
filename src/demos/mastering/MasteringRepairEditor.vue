<script setup lang="ts">
/**
 * The offline repair stages. Detect asks the engine which stages the source
 * needs (`masteringRepairAnalyze`) and shows what it measured per stage; Apply
 * turns on exactly those, with their settings. Each change reruns the
 * preprocess over the whole file, so a dragged value is applied once, on release.
 */
import { computed, reactive } from 'vue';
import { DemoNotice } from '@/components/ui';
import MasterKnob from '@/demos/mastering/MasterKnob.vue';
import type { MasteringRepairDetection } from '@/demos/mastering/mastering.worker';
import { useMasteringCopy } from '@/demos/mastering/masteringCopy';
import {
  MASTERING_REPAIR_STAGES,
  type MasteringRepair,
  type MasteringRepairStage,
} from '@/demos/mastering/masteringState';
import { formatNumber } from '@/demos/mastering/masteringUi';
import { fill } from '@/utils/template';

const props = defineProps<{
  repair: MasteringRepair;
  /** Progress 0..1 while the preprocess runs, else null. */
  progress: number | null;
  failed: boolean;
  /** The last detection of the current source, or null. */
  detection: MasteringRepairDetection | null;
  detecting: boolean;
  /** A source is loaded, so there is something to detect on. */
  canDetect: boolean;
  disabled?: boolean;
}>();

const emit = defineEmits<{
  enabled: [stage: MasteringRepairStage, enabled: boolean];
  param: [stage: MasteringRepairStage, name: string, value: number];
  retry: [];
  cancel: [];
  detect: [];
  applySuggestion: [];
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

const hasSuggestion = computed(
  () => props.detection !== null && Object.keys(props.detection.recommended).length > 0,
);

/** What the detection measured for `stage`, in the stage's own terms. */
function finding(stage: MasteringRepairStage): string {
  const detection = props.detection;
  if (!detection) return '';
  const d = detection.defects;
  const text = copy.value.repair.detect;
  if (stage === 'declip' && !detection.declipThresholdSafe && d.clipFlatRunCount > 0) {
    return text.withheld;
  }
  const n = {
    declip: String(d.clipRunCount),
    declick: formatNumber(d.clickPerSecond, 1),
    decrackle: formatNumber(d.crackleSampleFraction * 100, 2),
    dehum: d.humFundamentalHz > 0 ? formatNumber(d.humFundamentalHz, 0) : '—',
    denoise: formatNumber(d.noiseFloorDbfs, 0),
    dereverb: formatNumber(d.lateDecayRatioDb, 1),
  }[stage];
  return fill(text.figures[stage], { n });
}

const suggested = (stage: MasteringRepairStage) =>
  props.detection?.recommended[stage] !== undefined;
</script>

<template>
  <div class="repair-editor">
    <DemoNotice tone="hint">{{ copy.repair.note }} {{ copy.repair.detect.hint }}</DemoNotice>
    <div class="repair-editor__detect">
      <button
        type="button"
        class="demo-btn demo-btn--sm"
        :disabled="!canDetect || detecting || disabled"
        @click="emit('detect')"
      >
        {{ detection ? copy.repair.detect.again : copy.repair.detect.button }}
      </button>
      <span class="repair-editor__detecting" role="status">{{ detecting ? copy.jobs.detect : '' }}</span>
      <Transition name="demo-rise">
        <button
          v-if="hasSuggestion"
          type="button"
          class="demo-btn demo-btn--sm demo-btn--primary"
          :disabled="disabled"
          @click="emit('applySuggestion')"
        >
          {{ copy.repair.detect.apply }}
        </button>
      </Transition>
    </div>
    <DemoNotice v-if="detection && !hasSuggestion" tone="success">{{ copy.repair.detect.none }}</DemoNotice>
    <div v-if="progress !== null" class="repair-editor__progress">
      <span>{{ copy.jobs.prepare }} {{ Math.round(progress * 100) }}%</span>
      <span
        class="repair-editor__bar"
        role="progressbar"
        :aria-label="copy.jobs.prepare"
        aria-valuemin="0"
        aria-valuemax="100"
        :aria-valuenow="Math.round(progress * 100)"
      ><i :style="{ transform: `scaleX(${progress})` }"></i></span>
      <button type="button" class="demo-btn demo-btn--sm" @click="emit('cancel')">{{ copy.jobs.cancel }}</button>
    </div>
    <DemoNotice v-else-if="failed" tone="error">
      {{ copy.repair.failed }}
      <template #action>
        <button type="button" class="demo-btn demo-btn--sm" :disabled="disabled" @click="emit('retry')">{{ copy.repair.retry }}</button>
      </template>
    </DemoNotice>
    <ul class="repair-editor__stages">
      <li
        v-for="stage in MASTERING_REPAIR_STAGES"
        :key="stage"
        class="repair-stage"
        :class="{ 'is-suggested': suggested(stage) }"
      >
        <label class="repair-stage__toggle">
          <input
            type="checkbox"
            :checked="repair[stage].enabled"
            :disabled="disabled"
            @change="emit('enabled', stage, ($event.target as HTMLInputElement).checked)"
          >
          <span>{{ copy.repair.stages[stage] }}</span>
        </label>
        <Transition name="demo-rise">
          <p v-if="detection" class="repair-stage__finding">
            <span class="repair-stage__verdict">{{ suggested(stage) ? copy.repair.detect.suggested : copy.repair.detect.clean }}</span>
            {{ finding(stage) }}
          </p>
        </Transition>
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

.repair-editor__detect {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.repair-editor__detecting {
  color: var(--demo-text-muted);
  font-family: var(--font-mono);
  font-size: 10.5px;
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
  transform-origin: left;
  transition: transform var(--demo-dur-base) var(--demo-ease-standard);
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
  border-radius: var(--demo-radius-sm);
  transition: border-color var(--demo-dur-base) var(--demo-ease-standard);
}

.repair-stage.is-suggested {
  border-color: var(--demo-accent-border);
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

.repair-stage__toggle input:focus-visible {
  outline: 2px solid var(--demo-accent);
  outline-offset: 2px;
}

.repair-stage__finding {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px 8px;
  margin: 0;
  color: var(--demo-text-muted);
  font-family: var(--font-mono);
  font-size: 10.5px;
  font-variant-numeric: tabular-nums;
  line-height: 1.4;
}

.repair-stage__verdict {
  color: var(--demo-text-faint);
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.is-suggested .repair-stage__verdict {
  color: var(--demo-accent);
}
</style>
