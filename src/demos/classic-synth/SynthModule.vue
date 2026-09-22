<script setup lang="ts">
/**
 * One section of the voice deck: its legend and lamp in the header row, its
 * rows of choice keys, and its fader bank. The deck places it and dims it; this
 * component only edits the voice.
 *
 * An amount is a fader and a choice is a key, which is the one rule the layout
 * follows. Banks are bottom-aligned across the deck so every cap rides the same
 * line whether or not keys sit above it.
 *
 * A logarithmic parameter rides a 0..1 normal through its fader — `min *
 * (max/min) ** norm` out, the inverse log in — because a linear cutoff control
 * spends most of its throw above 10 kHz.
 *
 * Two controls carry a measured caveat rather than being disabled outright.
 * `detuneCents` does nothing below unison 2, so it is dimmed and noted, not
 * locked. `filterOutput` only acts on the state-variable filter; its keys are
 * disabled on the other three models, with the reason reachable from each key.
 */
import { computed } from 'vue';
import { useI18n } from '@/composables/useI18n';
import type { DeckModule } from './classicSynthChapters';
import {
  BODY_NAMES,
  FILTER_MODEL_NAMES,
  FILTER_OUTPUT_NAMES,
  formatValue,
  type LocalizedName,
  MODULE_NAMES,
  PANEL_CAPTIONS,
  PARAM_NAMES,
  WAVEFORM_NAMES,
} from './classicSynthCopy';
import {
  BODIES,
  type BodyName,
  type ClassicPatch,
  defaultPatch,
  detuneHasEffect,
  FILTER_MODELS,
  FILTER_OUTPUTS,
  type FilterModelName,
  type FilterOutputName,
  type NumericParam,
  type NumericParamKey,
  offersFilterOutput,
  paramOf,
  WAVEFORMS,
  type WaveformName,
} from './classicSynthState';
import SynthFader from './SynthFader.vue';

const props = defineProps<{
  module: DeckModule;
  patch: ClassicPatch;
}>();

const emit = defineEmits<{
  (e: 'update-param', key: NumericParamKey, value: number): void;
  (e: 'update-waveform', value: WaveformName): void;
  (e: 'update-filter-model', value: FilterModelName): void;
  (e: 'update-filter-output', value: FilterOutputName): void;
  (e: 'update-body', value: BodyName): void;
}>();

const { isLocale, localizedValue } = useI18n();
const ja = computed(() => isLocale('ja'));

/** Pick the display string of one of the plain `{ en, ja }` copy entries. */
function name(entry: LocalizedName): string {
  return ja.value ? entry.ja : entry.en;
}

const copy = computed(() =>
  localizedValue({
    en: {
      waveform: 'Waveform',
      filterModel: 'Filter model',
      outputStage: 'Output stage',
      svfOnly: 'SVF only',
      body: 'Body type',
      detuneMuted: 'No effect at unison 1 — raise unison to spread the stack.',
      filterOutputNote:
        'Only the state-variable filter offers a choice here. The three ladder models always answer through their own low-pass.',
    },
    ja: {
      waveform: '波形',
      filterModel: 'フィルタモデル',
      outputStage: '出力段',
      svfOnly: 'SVF のみ',
      body: 'ボディの種類',
      detuneMuted: 'ユニゾン 1 では効果なし。スタックを広げるにはユニゾンを上げる。',
      filterOutputNote:
        'ここで選べるのはステートバリアブルフィルタだけ。3 種のラダーフィルタは常に自身のローパスを通す。',
    },
  }),
);

/** Waveform glyphs, one period across an 18 × 10 box, printed on the keys. */
const WAVEFORM_GLYPHS: Readonly<Record<WaveformName, string>> = {
  sine: 'M1 5 C 3.5 0, 6.5 0, 9 5 S 14.5 10, 17 5',
  saw: 'M1 9 L 9 1 L 9 9 L 17 1',
  square: 'M1 9 L 1 1 L 9 1 L 9 9 L 17 9 L 17 1',
  triangle: 'M1 9 L 5 1 L 13 9 L 17 1',
  noise: 'M1 5 L 3 2 L 5 8 L 7 3 L 9 7 L 11 1 L 13 9 L 15 4 L 17 6',
};

const faders = computed<NumericParam[]>(() => props.module.faders.map((key) => paramOf(key)));

const filterOutputEnabled = computed(() => offersFilterOutput(props.patch.filterModel));
const FILTER_OUTPUT_NOTE_ID = 'cs-filter-output-note';
const DETUNE_NOTE_ID = 'cs-detune-note';

const STARTING_PATCH = defaultPatch();

/**
 * Where the cap sits. A logarithmic parameter rides a 0..1 normal so its
 * travel is even across the decades; everything else rides its own unit.
 */
function faderValue(param: NumericParam, value: number): number {
  if (!param.log) return value;
  return Math.log(value / param.min) / Math.log(param.max / param.min);
}

/** The cap's position, converted back to the parameter's own unit. */
function onFader(param: NumericParam, raw: number) {
  const value = param.log ? param.min * (param.max / param.min) ** raw : raw;
  emit('update-param', param.key, value);
}

/** Double-clicking a cap returns it to the voice a reader started with. */
function faderDefault(param: NumericParam): number {
  return faderValue(param, STARTING_PATCH[param.key]);
}

/** True for a control the current settings make inaudible. */
function isInert(param: NumericParam): boolean {
  return param.key === 'detuneCents' && !detuneHasEffect(props.patch);
}

function describedBy(param: NumericParam): string | undefined {
  return isInert(param) ? DETUNE_NOTE_ID : undefined;
}
</script>

<template>
  <section
    class="cs-module"
    :data-area="props.module.area"
    :style="{ '--span': props.module.faders.length }"
    :aria-label="name(MODULE_NAMES[props.module.id])"
  >
    <header class="cs-module__head">
      <span class="cs-lamp" aria-hidden="true" />
      <h3 class="cs-legend">{{ props.module.legend }}</h3>
    </header>

    <div class="cs-module__body">
      <div
        v-if="props.module.id === 'dco'"
        class="cs-keys cs-keys--3"
        role="group"
        :aria-label="copy.waveform"
      >
        <button
          v-for="waveform in WAVEFORMS"
          :key="waveform"
          type="button"
          class="cs-key"
          :class="{ 'cs-key--on': props.patch.waveform === waveform }"
          :aria-pressed="props.patch.waveform === waveform"
          :aria-label="name(WAVEFORM_NAMES[waveform])"
          @click="emit('update-waveform', waveform)"
        >
          <span class="cs-key__lamp" aria-hidden="true" />
          <svg class="cs-key__glyph" viewBox="0 0 18 10" aria-hidden="true">
            <path :d="WAVEFORM_GLYPHS[waveform]" />
          </svg>
        </button>
      </div>

      <template v-if="props.module.id === 'vcf'">
        <div class="cs-keys cs-keys--2" role="group" :aria-label="copy.filterModel">
          <button
            v-for="model in FILTER_MODELS"
            :key="model"
            type="button"
            class="cs-key"
            :class="{ 'cs-key--on': props.patch.filterModel === model }"
            :aria-pressed="props.patch.filterModel === model"
            @click="emit('update-filter-model', model)"
          >
            <span class="cs-key__lamp" aria-hidden="true" />
            <span class="cs-key__text">{{ name(FILTER_MODEL_NAMES[model]) }}</span>
          </button>
        </div>
        <div class="cs-keys cs-keys--3" role="group" :aria-label="copy.outputStage">
          <button
            v-for="output in FILTER_OUTPUTS"
            :key="output"
            type="button"
            class="cs-key"
            :class="{ 'cs-key--on': props.patch.filterOutput === output }"
            :disabled="!filterOutputEnabled"
            :aria-pressed="props.patch.filterOutput === output"
            :aria-describedby="filterOutputEnabled ? undefined : FILTER_OUTPUT_NOTE_ID"
            @click="emit('update-filter-output', output)"
          >
            <span class="cs-key__lamp" aria-hidden="true" />
            <span class="cs-key__text">{{ name(FILTER_OUTPUT_NAMES[output]) }}</span>
          </button>
        </div>
        <p class="cs-module__print">
          <span aria-hidden="true">{{ copy.svfOnly }}</span>
          <span :id="FILTER_OUTPUT_NOTE_ID" class="cs-sr">{{ copy.filterOutputNote }}</span>
        </p>
      </template>

      <div
        v-if="props.module.id === 'body'"
        class="cs-keys cs-keys--2"
        role="group"
        :aria-label="copy.body"
      >
        <button
          v-for="body in BODIES"
          :key="body"
          type="button"
          class="cs-key"
          :class="{ 'cs-key--on': props.patch.body === body }"
          :aria-pressed="props.patch.body === body"
          @click="emit('update-body', body)"
        >
          <span class="cs-key__lamp" aria-hidden="true" />
          <span class="cs-key__text">{{ name(BODY_NAMES[body]) }}</span>
        </button>
      </div>

      <!-- The line is reserved above the bank so the note appearing moves no cap. -->
      <p v-if="props.module.id === 'dco'" :id="DETUNE_NOTE_ID" class="cs-module__note">
        {{ isInert(paramOf('detuneCents')) ? copy.detuneMuted : '' }}
      </p>

      <div class="cs-bank">
        <SynthFader
          v-for="param in faders"
          :key="param.key"
          class="cs-fader"
          :class="{ 'cs-fader--inert': isInert(param) }"
          :model-value="faderValue(param, props.patch[param.key])"
          :min="param.log ? 0 : param.min"
          :max="param.log ? 1 : param.max"
          :step="param.log ? 0.005 : param.step"
          :default-value="faderDefault(param)"
          :label="name(PARAM_NAMES[param.key])"
          :caption="name(PANEL_CAPTIONS[param.key])"
          :display="formatValue(props.patch[param.key], param.unit)"
          :described-by="describedBy(param)"
          @update:model-value="onFader(param, $event)"
        />
      </div>
    </div>
  </section>
</template>
