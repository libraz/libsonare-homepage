<script setup lang="ts">
import { StatusIndicator } from '@/components/ui';

defineProps<{
  status: 'idle' | 'active' | 'warning' | 'error';
  label: string;
  pulse: boolean;
  peakLabel: string;
  peakDb: string;
  rateLabel: string;
  sampleRateLabel: string;
  errorMessage?: string;
}>();
</script>

<template>
  <div class="sy-statusbar">
    <StatusIndicator :status="status" :label="label" :pulse="pulse" />
    <span class="sy-statusbar__field"><b>{{ peakLabel }}</b>{{ peakDb }}</span>
    <span class="sy-statusbar__field"><b>{{ rateLabel }}</b>{{ sampleRateLabel }}</span>
    <span v-if="errorMessage" class="sy-error">{{ errorMessage }}</span>
  </div>
</template>
