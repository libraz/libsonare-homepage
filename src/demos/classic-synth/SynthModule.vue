<script setup lang="ts">
/**
 * One module of the deck: the legends, switch banks and knobs of the parameter
 * groups printed inside it. The deck places it and dims it; the page footer
 * carries the transport. This component only edits the voice.
 *
 * Section membership comes from `CLASSIC_PARAMS`, so a field moved to another
 * group only needs the one declaration. An amount is a knob and a choice is a
 * switch, which is the one rule the layout follows.
 *
 * A logarithmic parameter rides a 0..1 normal through its knob — `min *
 * (max/min) ** norm` out, the inverse log in — because a linear cutoff control
 * spends most of its throw above 10 kHz.
 *
 * Two controls carry a measured caveat rather than being disabled outright.
 * `detuneCents` does nothing below unison 2, so it is dimmed and noted, not
 * locked — a reader may set it ahead of raising unison. `filterOutput` only
 * acts on the state-variable filter; its switch bank is disabled on the other
 * three models, with the reason printed where it can be reached.
 */
import { computed } from 'vue';
import { RotaryKnob } from '@/components/ui';
import { useI18n } from '@/composables/useI18n';
import type { DeckModule } from './classicSynthChapters';
import {
  BODY_NAMES,
  FILTER_MODEL_NAMES,
  FILTER_OUTPUT_NAMES,
  formatValue,
  GROUP_NAMES,
  type LocalizedName,
  PARAM_NAMES,
  WAVEFORM_NAMES,
} from './classicSynthCopy';
import {
  BODIES,
  type BodyName,
  CLASSIC_PARAMS,
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
  type ParamGroup,
  paramOf,
  WAVEFORMS,
  type WaveformName,
} from './classicSynthState';

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
      detuneMuted: 'No effect at unison 1 — raise unison to spread the stack.',
      outputStage: 'Output stage',
      filterOutputNote:
        'Only the state-variable filter offers a choice here. The three ladder models always answer through their own low-pass.',
    },
    ja: {
      detuneMuted: 'ユニゾン 1 では効果なし。スタックを広げるにはユニゾンを上げてください。',
      outputStage: '出力段',
      filterOutputNote:
        'ここで選べるのはステートバリアブルフィルタだけです。3 種のラダーフィルタは常に自身のローパスを通します。',
    },
  }),
);

/** The seven sections, in the order `CLASSIC_PARAMS` lists their fields. */
const GROUP_ORDER: readonly ParamGroup[] = (() => {
  const order: ParamGroup[] = [];
  for (const param of CLASSIC_PARAMS) {
    if (!order.includes(param.group)) order.push(param.group);
  }
  return order;
})();

const PARAMS_BY_GROUP: ReadonlyMap<ParamGroup, NumericParam[]> = (() => {
  const map = new Map<ParamGroup, NumericParam[]>();
  for (const group of GROUP_ORDER) map.set(group, []);
  for (const param of CLASSIC_PARAMS) map.get(param.group)?.push(param);
  return map;
})();

/** This module's groups, in parameter-table order rather than declaration order. */
const groups = computed<ParamGroup[]>(() =>
  GROUP_ORDER.filter((group) => (props.module.groups as readonly ParamGroup[]).includes(group)),
);

function paramsOf(group: ParamGroup): NumericParam[] {
  return PARAMS_BY_GROUP.get(group) ?? [];
}

const legendIds = computed(() => groups.value.map((group) => `csg-${group}`).join(' '));

const filterOutputEnabled = computed(() => offersFilterOutput(props.patch.filterModel));
const FILTER_OUTPUT_NOTE_ID = 'cs-filter-output-note';

const STARTING_PATCH = defaultPatch();

/**
 * What the knob is turned to. A logarithmic parameter rides a 0..1 normal so
 * its throw is even across the decades; everything else rides its own unit.
 */
function knobValue(param: NumericParam, value: number): number {
  if (!param.log) return value;
  return Math.log(value / param.min) / Math.log(param.max / param.min);
}

/** The knob's position, converted back to the parameter's own unit. */
function onKnob(param: NumericParam, raw: number) {
  const value = param.log ? param.min * (param.max / param.min) ** raw : raw;
  emit('update-param', param.key, value);
}

/** Double-clicking a knob returns it to the voice a reader started with. */
function knobDefault(param: NumericParam): number {
  return knobValue(param, STARTING_PATCH[param.key]);
}

/** A control the current settings make inaudible, and the reason to print. */
function inertNote(param: NumericParam): string | null {
  if (param.key === 'detuneCents' && !detuneHasEffect(props.patch)) return copy.value.detuneMuted;
  return null;
}
</script>

<template>
  <section class="cs-module" :aria-labelledby="legendIds">
    <div v-for="group in groups" :key="group" class="cs-card">
      <h3 :id="`csg-${group}`" class="cs-card__label">{{ name(GROUP_NAMES[group]) }}</h3>

      <div v-if="group === 'osc'" class="cs-seg" role="group" :aria-labelledby="`csg-${group}`">
        <button
          v-for="waveform in WAVEFORMS"
          :key="waveform"
          type="button"
          class="cs-seg__item"
          :class="{ 'cs-seg__item--on': props.patch.waveform === waveform }"
          :aria-pressed="props.patch.waveform === waveform"
          @click="emit('update-waveform', waveform)"
        >
          {{ name(WAVEFORM_NAMES[waveform]) }}
        </button>
      </div>

      <div v-if="group === 'filter'" class="cs-seg" role="group" :aria-labelledby="`csg-${group}`">
        <button
          v-for="model in FILTER_MODELS"
          :key="model"
          type="button"
          class="cs-seg__item"
          :class="{ 'cs-seg__item--on': props.patch.filterModel === model }"
          :aria-pressed="props.patch.filterModel === model"
          @click="emit('update-filter-model', model)"
        >
          {{ name(FILTER_MODEL_NAMES[model]) }}
        </button>
      </div>

      <template v-if="group === 'filter'">
        <span id="cs-filter-output-label" class="cs-card__label cs-card__label--sub">
          {{ copy.outputStage }}
        </span>
        <div class="cs-seg" role="group" aria-labelledby="cs-filter-output-label">
          <button
            v-for="output in FILTER_OUTPUTS"
            :key="output"
            type="button"
            class="cs-seg__item"
            :class="{ 'cs-seg__item--on': props.patch.filterOutput === output }"
            :disabled="!filterOutputEnabled"
            :aria-pressed="props.patch.filterOutput === output"
            :aria-describedby="filterOutputEnabled ? undefined : FILTER_OUTPUT_NOTE_ID"
            @click="emit('update-filter-output', output)"
          >
            {{ name(FILTER_OUTPUT_NAMES[output]) }}
          </button>
        </div>
        <p v-if="!filterOutputEnabled" :id="FILTER_OUTPUT_NOTE_ID" class="cs-card__aside">
          {{ copy.filterOutputNote }}
        </p>
      </template>

      <div v-if="group === 'body'" class="cs-seg" role="group" :aria-labelledby="`csg-${group}`">
        <button
          v-for="body in BODIES"
          :key="body"
          type="button"
          class="cs-seg__item"
          :class="{ 'cs-seg__item--on': props.patch.body === body }"
          :aria-pressed="props.patch.body === body"
          @click="emit('update-body', body)"
        >
          {{ name(BODY_NAMES[body]) }}
        </button>
      </div>

      <div class="cs-knobs">
        <RotaryKnob
          v-for="param in paramsOf(group)"
          :key="param.key"
          class="cs-knob"
          :class="{ 'cs-knob--inert': inertNote(param) !== null }"
          :model-value="knobValue(param, props.patch[param.key])"
          :min="param.log ? 0 : param.min"
          :max="param.log ? 1 : param.max"
          :step="param.log ? 0.005 : param.step"
          :default-value="knobDefault(param)"
          :label="name(PARAM_NAMES[param.key])"
          :display="formatValue(props.patch[param.key], param.unit)"
          :size="46"
          label-wrap
          @update:model-value="onKnob(param, $event)"
        />
        <p v-if="group === 'osc' && inertNote(paramOf('detuneCents'))" class="cs-knobs__note">
          {{ copy.detuneMuted }}
        </p>
      </div>
    </div>
  </section>
</template>
