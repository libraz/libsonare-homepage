<script setup lang="ts">
/**
 * The control strip: the knobs and the waveform keys, one section per stage.
 *
 * Knobs are ordered by signal flow — oscillator, filter, envelope, output —
 * rather than by any bench layout, and the silkscreen names the circuit role
 * each one reaches. TEMPO lives with the transport in the deck's top row.
 * CUTOFF travels logarithmically because its useful range
 * lives in its bottom decade; every other knob is linear in the unit printed
 * under it.
 */
import { computed } from 'vue';
import { RotaryKnob, Tooltip } from '@/components/ui';
import { type KnobHelpKey, SILKSCREEN, type StepBassCopy } from '@/demos/step-bass/stepBassCopy';
import { KNOB_RANGES, STEP_BASS_DEFAULT_KNOBS } from '@/demos/step-bass/stepBassPatch';
import type { Knobs, StepBassWaveform } from '@/demos/step-bass/stepBassTypes';

/** Every knob but the waveform keys, which are a choice rather than an amount. */
type NumericKnobKey = Exclude<keyof Knobs, 'waveform'>;

const props = defineProps<{
  knobs: Knobs;
  copy: StepBassCopy;
}>();

const emit = defineEmits<{
  knob: [key: NumericKnobKey, value: number];
  waveform: [value: StepBassWaveform];
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
</script>

<template>
  <div class="sb-controls" role="group" :aria-label="copy.sections.controls">
    <section class="sb-sec">
      <h3 class="sb-sec__title">{{ SILKSCREEN.oscillator }}</h3>
      <div class="sb-sec__body">
        <div class="sb-wave">
          <div class="sb-wave__keys" role="group" :aria-label="copy.knobs.vco.title">
            <button
              v-for="shape in WAVEFORMS"
              :key="shape"
              type="button"
              class="sb-wave__key"
              :class="{ 'sb-wave__key--on': knobs.waveform === shape }"
              :aria-pressed="knobs.waveform === shape"
              @click="emit('waveform', shape)"
            >
              <svg width="22" height="12" viewBox="0 0 20 11" aria-hidden="true">
                <path
                  :d="WAVE_PATHS[shape]" fill="none" stroke="currentColor" stroke-width="1.4"
                  stroke-linejoin="round"
                />
              </svg>
              <span>{{ shape === 'saw' ? SILKSCREEN.saw : SILKSCREEN.square }}</span>
            </button>
          </div>
          <Tooltip v-bind="term('vco')">
            <span class="sb-wave__legend" tabindex="0">{{ SILKSCREEN.vco }}</span>
          </Tooltip>
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
      </div>
    </section>

    <section class="sb-sec">
      <h3 class="sb-sec__title">{{ SILKSCREEN.filter }}</h3>
      <div class="sb-sec__body">
        <RotaryKnob
          :label="SILKSCREEN.cutoff"
          :model-value="cutoffTravel"
          :min="0"
          :max="1"
          :step="0.004"
          :default-value="cutoffDefault"
          :display="formatHz(knobs.cutoffHz)"
          :size="64"
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
          :size="64"
          v-bind="term('resonance')"
          @update:model-value="emit('knob', 'resonancePct', $event)"
        />
        <RotaryKnob
          :label="SILKSCREEN.envMod"
          :model-value="knobs.envModCents"
          :min="R.envModCents.min"
          :max="R.envModCents.max"
          :step="25"
          :default-value="STEP_BASS_DEFAULT_KNOBS.envModCents"
          :display="`${Math.round(knobs.envModCents)} ct`"
          accent="var(--demo-cyan)"
          v-bind="term('envMod')"
          @update:model-value="emit('knob', 'envModCents', $event)"
        />
      </div>
    </section>

    <section class="sb-sec">
      <h3 class="sb-sec__title">{{ SILKSCREEN.envelope }}</h3>
      <div class="sb-sec__body">
        <RotaryKnob
          :label="SILKSCREEN.decay"
          :model-value="knobs.decayMs"
          :min="R.decayMs.min"
          :max="R.decayMs.max"
          :step="10"
          :default-value="STEP_BASS_DEFAULT_KNOBS.decayMs"
          :display="formatMs(knobs.decayMs)"
          accent="var(--demo-cyan)"
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
          accent="var(--sb-accent-ink)"
          v-bind="term('accent')"
          @update:model-value="emit('knob', 'accent', $event)"
        />
      </div>
    </section>

    <section class="sb-sec">
      <h3 class="sb-sec__title">{{ SILKSCREEN.output }}</h3>
      <div class="sb-sec__body">
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
    </section>
  </div>
</template>
