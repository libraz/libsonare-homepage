<script setup lang="ts">
import { DemoNotice, Tooltip } from '@/components/ui';
import type { WebMidiInputInfo } from '@/wasm/index';

interface TermTooltip {
  eyebrow: string;
  title: string;
  body: string;
  tip: string;
  tipLabel: string;
  defaultRationale?: string;
  defaultLabel: string;
  href?: string;
  linkLabel: string;
}

defineProps<{
  title: string;
  unavailableLabel: string;
  connectingLabel: string;
  connectLabel: string;
  emptyLabel: string;
  errorLabel: string;
  docsLabel: string;
  docsPath: string;
  supported: boolean | null;
  connecting: boolean;
  hasError: boolean;
  connected: boolean;
  wasmReady: boolean;
  inputs: WebMidiInputInfo[];
  midiTerm: TermTooltip;
}>();

defineEmits<{
  connect: [];
}>();
</script>

<template>
  <div class="sy-deck__midi">
    <span class="sy-midi__title">
      <i class="sy-led" :class="{ 'sy-led--on': connected && inputs.length > 0 }"></i>
      {{ title }}
      <Tooltip v-bind="midiTerm" />
    </span>
    <DemoNotice v-if="supported === false" tone="warn">{{ unavailableLabel }}</DemoNotice>
    <template v-else>
      <button
        v-if="!connected"
        type="button"
        class="demo-btn demo-btn--sm"
        :disabled="connecting || !wasmReady"
        @click="$emit('connect')"
      >
        {{ connecting ? connectingLabel : connectLabel }}
      </button>
      <DemoNotice v-if="hasError" tone="error">{{ errorLabel }}</DemoNotice>
      <template v-if="connected">
        <DemoNotice v-if="inputs.length === 0" tone="hint">{{ emptyLabel }}</DemoNotice>
        <span v-for="input in inputs" :key="input.id" class="sy-midi__device">
          <i class="sy-led" :class="{ 'sy-led--on': input.state === 'connected' }"></i>
          {{ input.name || input.id }}
        </span>
      </template>
    </template>
    <a :href="docsPath" class="sy-midi__docs">{{ docsLabel }}</a>
  </div>
</template>
