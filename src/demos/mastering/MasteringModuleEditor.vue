<script setup lang="ts">
/**
 * The centre column of Studio: the selected rack module's editor, under a
 * header naming the module, its place in the chain and its bypass state.
 */
import { computed } from 'vue';
import { DemoNotice } from '@/components/ui';
import MasteringEqEditor from '@/demos/mastering/MasteringEqEditor.vue';
import MasteringParamGrid from '@/demos/mastering/MasteringParamGrid.vue';
import MasteringRepairEditor from '@/demos/mastering/MasteringRepairEditor.vue';
import type { MasteringRepairDetection } from '@/demos/mastering/mastering.worker';
import { useMasteringCopy } from '@/demos/mastering/masteringCopy';
import {
  MASTERING_SLOT,
  type MasteringEqBand,
  type MasteringParamValue,
  type MasteringRepairStage,
  type MasteringSlotId,
  type MasteringState,
} from '@/demos/mastering/masteringState';
import {
  formatNumber,
  MASTERING_MODULE_GUIDES,
  type MasteringModuleId,
} from '@/demos/mastering/masteringUi';

type Wasm = typeof import('@/wasm/index.js');

const props = defineProps<{
  module: MasteringModuleId;
  state: MasteringState;
  glossaryBase: string;
  freqs: Float32Array | null;
  outputDb: Float32Array | null;
  inputDb: Float32Array | null;
  wasm: Wasm | null;
  sampleRate: number;
  repairProgress: number | null;
  repairFailed: boolean;
  repairDetection: MasteringRepairDetection | null;
  repairDetecting: boolean;
  canDetect: boolean;
  disabled?: boolean;
}>();

const emit = defineEmits<{
  param: [slot: number, name: string, value: MasteringParamValue];
  bypass: [slot: number, bypassed: boolean];
  reset: [slot: number];
  band: [
    index: number,
    patch: Partial<Pick<MasteringEqBand, 'frequencyHz' | 'gainDb' | 'q' | 'enabled'>>,
  ];
  clearMatch: [];
  repairEnabled: [stage: MasteringRepairStage, enabled: boolean];
  repairParam: [stage: MasteringRepairStage, name: string, value: number];
  retryRepair: [];
  cancelRepair: [];
  detectRepair: [];
  applyRepairSuggestion: [];
  begin: [];
  end: [];
}>();

const copy = useMasteringCopy();

const slot = computed(() =>
  props.module === 'repair' || props.module === 'eq'
    ? null
    : MASTERING_SLOT[props.module as MasteringSlotId],
);
const insert = computed(() => (slot.value === null ? null : props.state.inserts[slot.value]));
const position = computed(() =>
  slot.value === null ? '' : `${String(slot.value + 1).padStart(2, '0')} / 13`,
);
const guideHref = computed(() => `${props.glossaryBase}/${MASTERING_MODULE_GUIDES[props.module]}`);
const driveText = computed(() =>
  props.module === 'drive' && insert.value
    ? `${formatNumber(insert.value.params.levelDb as number, 2, true)} dB`
    : '',
);
</script>

<template>
  <section class="module-editor" :aria-labelledby="`module-editor-${module}`">
    <header class="module-editor__head">
      <div class="module-editor__title">
        <span v-if="position" class="module-editor__pos">{{ position }}</span>
        <h3 :id="`module-editor-${module}`">{{ copy.modules[module] }}</h3>
        <a class="module-editor__guide" :href="guideHref">{{ copy.editor.guide }}</a>
      </div>
      <div v-if="insert && slot !== null && module !== 'drive'" class="module-editor__actions">
        <button
          type="button"
          class="demo-btn demo-btn--sm module-editor__bypass"
          :aria-pressed="!insert.bypassed"
          :disabled="disabled"
          @click="emit('bypass', slot, !insert.bypassed)"
        >
          {{ insert.bypassed ? copy.editor.off : copy.editor.on }}
        </button>
        <button type="button" class="demo-btn demo-btn--sm module-editor__reset" :disabled="disabled" @click="emit('reset', slot)">
          {{ copy.editor.reset }}
        </button>
      </div>
    </header>
    <DemoNotice tone="hint">
      {{ copy.moduleNotes[module] }}
      <template v-if="slot !== null && module !== 'drive'"> {{ copy.editor.knobHint }}</template>
    </DemoNotice>
    <DemoNotice v-if="insert?.bypassed" tone="warn">{{ copy.editor.bypassed }}</DemoNotice>

    <MasteringEqEditor
      v-if="module === 'eq'"
      :bands="state.eq"
      :match-eq="state.matchEq"
      :freqs="freqs"
      :output-db="outputDb"
      :input-db="inputDb"
      :wasm="wasm"
      :sample-rate="sampleRate"
      :disabled="disabled"
      @band="(index, patch) => emit('band', index, patch)"
      @begin="emit('begin')"
      @end="emit('end')"
      @clear-match="emit('clearMatch')"
    />
    <MasteringRepairEditor
      v-else-if="module === 'repair'"
      :repair="state.repair"
      :progress="repairProgress"
      :failed="repairFailed"
      :detection="repairDetection"
      :detecting="repairDetecting"
      :can-detect="canDetect"
      :disabled="disabled"
      @enabled="(stage, on) => emit('repairEnabled', stage, on)"
      @param="(stage, name, value) => emit('repairParam', stage, name, value)"
      @retry="emit('retryRepair')"
      @cancel="emit('cancelRepair')"
      @detect="emit('detectRepair')"
      @apply-suggestion="emit('applyRepairSuggestion')"
    />
    <div v-else-if="module === 'drive'" class="module-editor__drive">
      <span>{{ copy.editor.driveValue }}</span>
      <strong>{{ driveText }}</strong>
      <em>{{ copy.rack.driveNote }}</em>
    </div>
    <MasteringParamGrid
      v-else-if="slot !== null && insert"
      :key="module"
      :slot-index="slot"
      :insert="insert"
      :disabled="disabled"
      @param="(name, value) => emit('param', slot!, name, value)"
      @begin="emit('begin')"
      @end="emit('end')"
    />
  </section>
</template>

<style scoped>
.module-editor {
  display: grid;
  align-content: start;
  gap: 12px;
  min-width: 0;
  padding: 12px 14px 16px;
  border: 1px solid var(--demo-border);
  border-radius: var(--demo-radius-md);
  background: var(--demo-bg-elevated);
}

.module-editor__head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.module-editor__title {
  display: flex;
  align-items: baseline;
  gap: 10px;
}

.module-editor__title h3 {
  margin: 0;
  color: var(--demo-text-strong);
  font-family: var(--font-body);
  font-size: 17px;
  font-weight: 650;
  letter-spacing: 0;
}

.module-editor__pos {
  color: var(--demo-text-faint);
  font-family: var(--font-mono);
  font-size: 10.5px;
  font-variant-numeric: tabular-nums;
}

.module-editor__guide {
  color: var(--demo-accent);
  font-family: var(--font-mono);
  font-size: 10.5px;
  text-decoration: none;
}

.module-editor__guide:hover {
  text-decoration: underline;
}

.module-editor__actions {
  display: flex;
  gap: 6px;
}

.module-editor__bypass[aria-pressed='true'] {
  border-color: color-mix(in srgb, var(--demo-success) 55%, var(--demo-border));
  color: var(--demo-success);
}

.module-editor__guide:focus-visible {
  outline: 2px solid var(--demo-accent);
  outline-offset: 2px;
}

.module-editor__drive {
  display: flex;
  align-items: baseline;
  gap: 12px;
  font-family: var(--font-mono);
}

.module-editor__drive span,
.module-editor__drive em {
  color: var(--demo-text-muted);
  font-size: 11px;
  font-style: normal;
}

.module-editor__drive strong {
  color: var(--demo-text-strong);
  font-size: 22px;
  font-variant-numeric: tabular-nums;
}
</style>
