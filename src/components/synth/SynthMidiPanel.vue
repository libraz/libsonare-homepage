<script setup lang="ts">
import { Tooltip } from '@/components/ui';
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
      <Tooltip v-bind="midiTerm">
        <button type="button" class="sy-sec__info" :aria-label="midiTerm.title">
          <span aria-hidden="true">i</span>
        </button>
      </Tooltip>
    </span>
    <p v-if="supported === false" class="sy-midi__note">{{ unavailableLabel }}</p>
    <template v-else>
      <button
        v-if="!connected"
        type="button"
        class="sy-chipbtn"
        :disabled="connecting || !wasmReady"
        @click="$emit('connect')"
      >
        {{ connecting ? connectingLabel : connectLabel }}
      </button>
      <p v-if="hasError" class="sy-error">{{ errorLabel }}</p>
      <template v-if="connected">
        <p v-if="inputs.length === 0" class="sy-midi__note">{{ emptyLabel }}</p>
        <span v-for="input in inputs" :key="input.id" class="sy-midi__device">
          <i class="sy-led" :class="{ 'sy-led--on': input.state === 'connected' }"></i>
          {{ input.name || input.id }}
        </span>
      </template>
    </template>
    <a :href="docsPath" class="sy-midi__docs">{{ docsLabel }}</a>
  </div>
</template>
