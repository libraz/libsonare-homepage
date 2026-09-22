<script setup lang="ts">
/**
 * The front panel: the knobs, the waveform keys and the transport.
 *
 * Knobs are ordered by signal flow — oscillator, filter, envelope, output —
 * rather than by any bench layout, and the silkscreen names the circuit role
 * each one reaches. CUTOFF travels logarithmically because its useful range
 * lives in its bottom decade; every other knob is linear in the unit printed
 * under it.
 */
import { computed } from 'vue';
import { RotaryKnob, TransportButton } from '@/components/ui';
import { type KnobHelpKey, SILKSCREEN, type StepBassCopy } from '@/demos/step-bass/stepBassCopy';
import {
  DEFAULT_BPM,
  KNOB_RANGES,
  STEP_BASS_DEFAULT_KNOBS,
  TEMPO_RANGE,
} from '@/demos/step-bass/stepBassPatch';
import type { FactoryPattern } from '@/demos/step-bass/stepBassPatterns';
import type { Knobs, StepBassWaveform } from '@/demos/step-bass/stepBassTypes';

/** Every knob but the waveform keys, which are a choice rather than an amount. */
type NumericKnobKey = Exclude<keyof Knobs, 'waveform'>;

const props = defineProps<{
  knobs: Knobs;
  bpm: number;
  copy: StepBassCopy;
  running: boolean;
  /** The engine is not accepting commands yet, or has failed. */
  offline: boolean;
  patterns: readonly FactoryPattern[];
  patternId: string;
  exporting: boolean;
}>();

const emit = defineEmits<{
  knob: [key: NumericKnobKey, value: number];
  waveform: [value: StepBassWaveform];
  bpm: [value: number];
  run: [];
  stop: [];
  randomise: [];
  pattern: [id: string];
  exportWav: [];
  exportMidi: [];
}>();

const R = KNOB_RANGES;

const WAVEFORMS: StepBassWaveform[] = ['saw', 'square'];

/** Waveform keys drawn as the shape they name. */
const WAVE_PATHS: Record<StepBassWaveform, string> = {
  saw: 'M1 9 L7 2 V9 L13 2 V9 L19 2',
  square: 'M1 9 V2 H7 V9 H13 V2 H19',
};

// CUTOFF is the one log-travel knob: a linear throw would leave the whole
// usable low end inside a few degrees of rotation.
function cutoffNorm(hz: number): number {
  return Math.log(hz / R.cutoffHz.min) / Math.log(R.cutoffHz.max / R.cutoffHz.min);
}

function cutoffHz(norm: number): number {
  return R.cutoffHz.min * (R.cutoffHz.max / R.cutoffHz.min) ** norm;
}

const cutoffTravel = computed(() => cutoffNorm(props.knobs.cutoffHz));
const cutoffDefault = cutoffNorm(STEP_BASS_DEFAULT_KNOBS.cutoffHz);

function signed(value: number, digits = 0): string {
  return `${value >= 0 ? '+' : '−'}${Math.abs(value).toFixed(digits)}`;
}

function formatHz(hz: number): string {
  return hz >= 1000 ? `${(hz / 1000).toFixed(2)} kHz` : `${Math.round(hz)} Hz`;
}

function formatMs(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(2)} s` : `${Math.round(ms)} ms`;
}

function percent(value: number): string {
  return `${Math.round(value * 100)} %`;
}

/** Rich-tooltip props for a knob, spread straight onto it. */
function term(key: KnobHelpKey) {
  const item = props.copy.knobs[key];
  return {
    eyebrow: props.copy.help.eyebrow,
    title: item.title,
    body: item.body,
    tip: item.tip,
    tipLabel: props.copy.help.tipLabel,
  };
}

function onPattern(event: Event): void {
  emit('pattern', (event.target as HTMLSelectElement).value);
}
</script>

<template>
  <section class="step-bass__plate" :aria-label="copy.sections.transport">
    <div class="step-bass__masthead">
      <span class="step-bass__designation">{{ SILKSCREEN.designation }}</span>
      <p class="step-bass__masthead-note">{{ copy.subtitle }}</p>
    </div>

    <div class="step-bass__groups">
      <div class="step-bass__group">
        <span class="step-bass__group-legend">{{ copy.sections.voice }}</span>
        <div class="step-bass__knobs">
          <div class="step-bass__wave">
            <span class="step-bass__wave-head">{{ SILKSCREEN.vco }}</span>
            <div class="step-bass__wave-keys" role="group" :aria-label="copy.knobs.vco.title">
              <button
                v-for="shape in WAVEFORMS"
                :key="shape"
                type="button"
                class="step-bass__wave-key"
                :class="{ 'step-bass__wave-key--on': knobs.waveform === shape }"
                :aria-pressed="knobs.waveform === shape"
                @click="emit('waveform', shape)"
              >
                <svg width="20" height="11" viewBox="0 0 20 11" aria-hidden="true">
                  <path
                    :d="WAVE_PATHS[shape]" fill="none" stroke="currentColor" stroke-width="1.4"
                    stroke-linejoin="round"
                  />
                </svg>
                {{ shape === 'saw' ? SILKSCREEN.saw : SILKSCREEN.square }}
              </button>
            </div>
            <p class="step-bass__wave-hint">{{ copy.knobs.vco.tip }}</p>
          </div>

          <RotaryKnob
            :label="SILKSCREEN.tuning"
            :model-value="knobs.tuningCents"
            :min="R.tuningCents.min"
            :max="R.tuningCents.max"
            :step="10"
            :default-value="STEP_BASS_DEFAULT_KNOBS.tuningCents"
            :display="`${signed(knobs.tuningCents)} ct`"
            v-bind="term('tuning')"
            @update:model-value="emit('knob', 'tuningCents', $event)"
          />
          <RotaryKnob
            :label="SILKSCREEN.cutoff"
            :model-value="cutoffTravel"
            :min="0"
            :max="1"
            :step="0.004"
            :default-value="cutoffDefault"
            :display="formatHz(knobs.cutoffHz)"
            v-bind="term('cutoff')"
            @update:model-value="emit('knob', 'cutoffHz', cutoffHz($event))"
          />
          <RotaryKnob
            :label="SILKSCREEN.resonance"
            :model-value="knobs.resonancePct"
            :min="R.resonancePct.min"
            :max="R.resonancePct.max"
            :step="0.01"
            :default-value="STEP_BASS_DEFAULT_KNOBS.resonancePct"
            :display="percent(knobs.resonancePct)"
            v-bind="term('resonance')"
            @update:model-value="emit('knob', 'resonancePct', $event)"
          />
        </div>
      </div>

      <div class="step-bass__group">
        <span class="step-bass__group-legend">{{ copy.sections.envelope }}</span>
        <div class="step-bass__knobs">
          <RotaryKnob
            :label="SILKSCREEN.envMod"
            label-wrap
            :model-value="knobs.envModCents"
            :min="R.envModCents.min"
            :max="R.envModCents.max"
            :step="25"
            :default-value="STEP_BASS_DEFAULT_KNOBS.envModCents"
            :display="`${Math.round(knobs.envModCents)} ct`"
            v-bind="term('envMod')"
            @update:model-value="emit('knob', 'envModCents', $event)"
          />
          <RotaryKnob
            :label="SILKSCREEN.decay"
            :model-value="knobs.decayMs"
            :min="R.decayMs.min"
            :max="R.decayMs.max"
            :step="10"
            :default-value="STEP_BASS_DEFAULT_KNOBS.decayMs"
            :display="formatMs(knobs.decayMs)"
            v-bind="term('decay')"
            @update:model-value="emit('knob', 'decayMs', $event)"
          />
          <RotaryKnob
            :label="SILKSCREEN.accent"
            :model-value="knobs.accent"
            :min="R.accent.min"
            :max="R.accent.max"
            :step="0.01"
            :default-value="STEP_BASS_DEFAULT_KNOBS.accent"
            :display="percent(knobs.accent)"
            v-bind="term('accent')"
            @update:model-value="emit('knob', 'accent', $event)"
          />
        </div>
      </div>

      <div class="step-bass__group">
        <span class="step-bass__group-legend">{{ copy.sections.output }}</span>
        <div class="step-bass__knobs">
          <RotaryKnob
            :label="SILKSCREEN.tempo"
            :model-value="bpm"
            :min="TEMPO_RANGE.min"
            :max="TEMPO_RANGE.max"
            :step="1"
            :default-value="DEFAULT_BPM"
            :display="`${Math.round(bpm)} BPM`"
            v-bind="term('tempo')"
            @update:model-value="emit('bpm', $event)"
          />
          <RotaryKnob
            :label="SILKSCREEN.volume"
            :model-value="knobs.faderDb"
            :min="R.faderDb.min"
            :max="R.faderDb.max"
            :step="0.5"
            :default-value="STEP_BASS_DEFAULT_KNOBS.faderDb"
            :display="`${signed(knobs.faderDb, 1)} dB`"
            v-bind="term('volume')"
            @update:model-value="emit('knob', 'faderDb', $event)"
          />
        </div>
      </div>
    </div>

    <div class="step-bass__transport">
      <TransportButton
        variant="primary"
        :disabled="offline || running"
        @click="emit('run')"
      >
        <span :aria-label="copy.transport.run">{{ SILKSCREEN.run }}</span>
      </TransportButton>
      <TransportButton :disabled="offline || !running" @click="emit('stop')">
        <span :aria-label="copy.transport.stop">{{ SILKSCREEN.stop }}</span>
      </TransportButton>

      <label class="step-bass__field">
        <span class="step-bass__field-label">{{ copy.transport.patterns }}</span>
        <select
          class="step-bass__select"
          :value="patternId"
          :aria-label="copy.transport.patternsLabel"
          @change="onPattern"
        >
          <option v-if="patternId === ''" value="" disabled>{{ copy.transport.custom }}</option>
          <option v-for="item in patterns" :key="item.id" :value="item.id">{{ item.name }}</option>
        </select>
      </label>

      <TransportButton size="sm" @click="emit('randomise')">
        <span :aria-label="copy.transport.randomiseLabel">{{ copy.transport.randomise }}</span>
      </TransportButton>

      <span class="step-bass__spacer" aria-hidden="true"></span>

      <TransportButton size="sm" :disabled="exporting" @click="emit('exportWav')">
        <span :aria-label="copy.transport.exportWavLabel">
          {{ exporting ? copy.transport.exporting : copy.transport.exportWav }}
        </span>
      </TransportButton>
      <TransportButton size="sm" @click="emit('exportMidi')">
        <span :aria-label="copy.transport.exportMidiLabel">{{ copy.transport.exportMidi }}</span>
      </TransportButton>
    </div>
  </section>
</template>
