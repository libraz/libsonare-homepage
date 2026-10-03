<script setup lang="ts">
/**
 * The Quick macros: Tone, Width, Dynamics and Ceiling. Each one rewrites the
 * insert parameters it drives from the genre preset, so Studio shows the
 * resulting values.
 */
import MasterKnob from '@/demos/mastering/MasterKnob.vue';
import { useMasteringCopy } from '@/demos/mastering/masteringCopy';
import {
  MASTERING_MACROS,
  type MasteringMacroId,
  type MasteringMacros,
} from '@/demos/mastering/masteringMacros';

defineProps<{
  macros: MasteringMacros;
  disabled?: boolean;
}>();

const emit = defineEmits<{
  macro: [id: MasteringMacroId, value: number];
  begin: [];
  end: [];
}>();

const copy = useMasteringCopy();

const MACROS: Array<{ id: MasteringMacroId; unit: string; neutral: number }> = [
  { id: 'tone', unit: 'dB', neutral: 0 },
  { id: 'width', unit: '×', neutral: 1 },
  { id: 'dynamics', unit: '', neutral: 0 },
  { id: 'ceiling', unit: 'dBTP', neutral: -1 },
];
</script>

<template>
  <div class="fine-tune">
    <MasterKnob
      v-for="macro in MACROS"
      :key="macro.id"
      :model-value="macros[macro.id]"
      :min="MASTERING_MACROS[macro.id].min"
      :max="MASTERING_MACROS[macro.id].max"
      :step="MASTERING_MACROS[macro.id].step"
      :unit="macro.unit"
      :default="macro.neutral"
      :label="copy.quick.macros[macro.id].label"
      :hint="copy.quick.macros[macro.id].hint"
      :disabled="disabled"
      @begin="emit('begin')"
      @end="emit('end')"
      @update:model-value="emit('macro', macro.id, $event)"
    />
  </div>
</template>

<style scoped>
.fine-tune {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 14px 22px;
}
</style>
