<script setup lang="ts">
/**
 * The deck's top row: the badge, the transport, the readout and the exports.
 *
 * RUN and STOP share one key, as on the bench, so the transport state is read
 * off the key itself. The run lights mark the steps that strike a note, so the
 * shape of the pattern stays visible while the playhead walks it.
 */
import { computed } from 'vue';
import { RotaryKnob } from '@/components/ui';
import { SILKSCREEN, type StepBassCopy } from '@/demos/step-bass/stepBassCopy';
import { DEFAULT_BPM, STEP_COUNT, TEMPO_RANGE } from '@/demos/step-bass/stepBassPatch';
import type { Step } from '@/demos/step-bass/stepBassTypes';

const props = defineProps<{
  copy: StepBassCopy;
  bpm: number;
  running: boolean;
  /** The engine is not accepting commands yet, or has failed. */
  offline: boolean;
  /** Step the transport is on, or -1 while it is stopped. */
  playhead: number;
  patternName: string;
  steps: readonly Step[];
  exporting: boolean;
}>();

const emit = defineEmits<{
  bpm: [value: number];
  run: [];
  stop: [];
  exportWav: [];
  exportMidi: [];
}>();

const stepReadout = computed(() =>
  props.playhead < 0 ? '--' : String(props.playhead + 1).padStart(2, '0'),
);

function onTransport(): void {
  if (props.running) emit('stop');
  else emit('run');
}

function term() {
  const item = props.copy.knobs.tempo;
  return {
    eyebrow: props.copy.help.eyebrow,
    title: item.title,
    body: item.body,
    tip: item.tip,
    tipLabel: props.copy.help.tipLabel,
  };
}
</script>

<template>
  <div class="sb-head">
    <div class="sb-brand">
      <span class="sb-brand__name">LIBSONARE</span>
      <span class="sb-brand__model">{{ SILKSCREEN.designation }}</span>
      <span class="sb-brand__tag">{{ SILKSCREEN.tagline }}</span>
    </div>

    <div class="sb-run">
      <button
        type="button"
        class="sb-run__key"
        :class="{ 'sb-run__key--on': running }"
        :aria-label="running ? copy.transport.stop : copy.transport.run"
        :aria-pressed="running"
        :disabled="offline"
        @click="onTransport"
      >
        <svg v-if="!running" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M8 5v14l11-7z" />
        </svg>
        <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M6 6h12v12H6z" />
        </svg>
      </button>
      <span class="sb-run__legend" aria-hidden="true">{{ SILKSCREEN.run }} / {{ SILKSCREEN.stop }}</span>
    </div>

    <div class="sb-lcd" role="status">
      <div class="sb-lcd__cell">
        <span class="sb-lcd__key">{{ SILKSCREEN.tempo }}</span>
        <span class="sb-lcd__value sb-lcd__value--big">{{ Math.round(bpm) }}</span>
      </div>
      <i class="sb-lcd__divider" aria-hidden="true"></i>
      <div class="sb-lcd__cell">
        <span class="sb-lcd__key">{{ SILKSCREEN.step }}</span>
        <span class="sb-lcd__value">{{ stepReadout }}<small>/{{ STEP_COUNT }}</small></span>
      </div>
      <i class="sb-lcd__divider" aria-hidden="true"></i>
      <div class="sb-lcd__cell sb-lcd__cell--wide">
        <span class="sb-lcd__key">{{ SILKSCREEN.pattern }}</span>
        <span class="sb-lcd__value sb-lcd__value--text">{{ patternName }}</span>
      </div>
      <i class="sb-lcd__dot" :class="{ 'sb-lcd__dot--on': running }" aria-hidden="true"></i>
    </div>

    <RotaryKnob
      :label="SILKSCREEN.tempo"
      :model-value="bpm"
      :min="TEMPO_RANGE.min"
      :max="TEMPO_RANGE.max"
      :step="1"
      :default-value="DEFAULT_BPM"
      :display="`${Math.round(bpm)} BPM`"
      :size="46"
      v-bind="term()"
      @update:model-value="emit('bpm', $event)"
    />

    <div class="sb-runlights" aria-hidden="true">
      <i
        v-for="(step, index) in steps"
        :key="index"
        class="sb-runlights__led"
        :class="{
          'sb-runlights__led--beat': index % 4 === 0,
          'sb-runlights__led--note': step.gate === 'note',
          'sb-runlights__led--on': index === playhead,
        }"
      ></i>
    </div>

    <div class="sb-exports">
      <button
        type="button"
        class="sb-export"
        :disabled="exporting"
        :aria-label="copy.transport.exportWavLabel"
        @click="emit('exportWav')"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M12 3v12m0 0l-5-5m5 5l5-5M4 21h16" />
        </svg>
        {{ exporting ? copy.transport.exporting : copy.transport.exportWav }}
      </button>
      <button
        type="button"
        class="sb-export sb-export--ghost"
        :aria-label="copy.transport.exportMidiLabel"
        @click="emit('exportMidi')"
      >{{ copy.transport.exportMidi }}</button>
    </div>
  </div>
</template>
