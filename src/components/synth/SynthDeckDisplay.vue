<script setup lang="ts">
import ScopeDisplay from '@/components/synth/ScopeDisplay.vue';

defineProps<{
  model: string;
  tagline: string;
  powerLabel: string;
  isRunning: boolean;
  analyser: AnalyserNode | null;
  selectedPreset: string;
  peakDb: string;
}>();
</script>

<template>
  <div class="sy-deck__display">
    <div class="sy-brand">
      <span class="sy-brand__name">LIBSONARE</span>
      <span class="sy-brand__model">{{ model }}</span>
      <span class="sy-brand__tag">{{ tagline }}</span>
      <span class="sy-brand__power">
        <i class="sy-led" :class="{ 'sy-led--on': isRunning }"></i>
        {{ powerLabel }}
      </span>
    </div>
    <ScopeDisplay :analyser="analyser" class="sy-scope">
      <span class="sy-scope__osd sy-scope__osd--preset">{{ selectedPreset }}</span>
      <span class="sy-scope__osd sy-scope__osd--peak">{{ peakDb }}</span>
    </ScopeDisplay>
  </div>
</template>
