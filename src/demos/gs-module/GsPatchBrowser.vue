<script setup lang="ts">
/**
 * The sound the selected part plays: a family, a program inside it, and the
 * bank variations this build voices apart from the capital tone.
 *
 * The English names are the engine's own, so the label and the patch behind it
 * cannot drift. Only variations the engine reports as voiced apart are offered:
 * GS resolves a variation a module never had back to the capital tone, and a
 * row that plays exactly what the row above it plays is not a choice.
 *
 * The family list has no selection of its own — it follows the program, and
 * picking a family selects that family's first program. A second piece of
 * state for "the family being looked at" would let the panel show one family
 * while the part plays another.
 */
import { computed } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { GM_FAMILY_NAMES_JA, GM_FAMILY_SIZE, GM_PROGRAM_NAMES_JA, gmFamilyOf } from './gsNames';
import type { GmProgram } from './useGsModule';

const props = defineProps<{
  programs: GmProgram[];
  familyNames: string[];
  /** Bank values that give the current program a distinct variation. */
  variations: number[];
  program: number;
  bankMsb: number;
}>();

const emit = defineEmits<{
  select: [program: number];
  selectBank: [bank: number];
}>();

const { isLocale, localizedValue } = useI18n();

const copy = computed(() =>
  localizedValue({
    en: {
      title: 'Sound',
      loading: 'Asking the engine for the sound set…',
      families: 'Instrument families',
      programs: 'Programs in this family',
      capital: 'Capital',
      variations: 'Variations',
      none: 'No variation this build voices apart from the capital tone.',
      count: (n: number) => `${n} programs`,
      note: 'A variation is the same instrument voiced differently. The ones listed are the ones that actually sound different here; a bank this build does not voice apart resolves back to the capital tone, as GS intends.',
    },
    ja: {
      title: '音色',
      loading: 'エンジンに音色一覧を問い合わせています…',
      families: '楽器ファミリー',
      programs: 'このファミリーの音色',
      capital: 'カピタル',
      variations: 'バリエーション',
      none: 'このビルドがカピタルトーンと鳴らし分けるバリエーションはありません。',
      count: (n: number) => `${n} 音色`,
      note: 'バリエーションは同じ楽器の別の鳴らし方です。ここに出るのは実際に音が変わるものだけで、このビルドが鳴らし分けないバンクは GS の仕様どおりカピタルトーンに解決されます。',
    },
  }),
);

const ja = computed(() => isLocale('ja'));

const currentFamily = computed(() => gmFamilyOf(props.program));

function familyLabel(family: number): string {
  return ja.value ? GM_FAMILY_NAMES_JA[family] : (props.familyNames[family] ?? '');
}

function programLabel(program: number): string {
  if (ja.value) return GM_PROGRAM_NAMES_JA[program];
  return props.programs[program]?.name ?? '';
}

/** The eight programs of the family the current program belongs to. */
const familyPrograms = computed(() => {
  const first = currentFamily.value * GM_FAMILY_SIZE;
  return props.programs.slice(first, first + GM_FAMILY_SIZE);
});

/** Bank 0 is the capital tone, and always selectable; the rest are measured. */
const bankChoices = computed(() => [0, ...props.variations]);
</script>

<template>
  <section class="gs-rack" :aria-label="copy.title">
    <div class="gs-rack__head">
      <span class="gs-rack__title">{{ copy.title }}</span>
      <span v-if="props.programs.length" class="gs-rack__aside">
        {{ copy.count(props.programs.length) }}
      </span>
    </div>

    <p v-if="!props.programs.length" class="gs-note">{{ copy.loading }}</p>

    <div v-else class="gs-patch">
      <ul class="gs-patch__families" :aria-label="copy.families">
        <li v-for="(_, family) in props.familyNames" :key="family">
          <button
            type="button"
            class="gs-patch__row gs-patch__family"
            :class="{ 'gs-patch__row--selected': family === currentFamily }"
            :aria-pressed="family === currentFamily"
            @click="emit('select', family * GM_FAMILY_SIZE)"
          >{{ familyLabel(family) }}</button>
        </li>
      </ul>

      <div class="gs-patch__right">
        <ul class="gs-patch__programs" :aria-label="copy.programs">
          <li v-for="entry in familyPrograms" :key="entry.program">
            <button
              type="button"
              class="gs-patch__row gs-patch__program"
              :class="{ 'gs-patch__row--selected': entry.program === props.program }"
              :aria-pressed="entry.program === props.program"
              @click="emit('select', entry.program)"
            >
              <span class="gs-patch__number gs-value">{{ entry.program }}</span>
              <span class="gs-patch__name">{{ programLabel(entry.program) }}</span>
            </button>
          </li>
        </ul>

        <div class="gs-patch__variations">
          <span class="gs-rack__title">{{ copy.variations }}</span>
          <div v-if="props.variations.length" class="gs-patch__banks">
            <button
              v-for="bank in bankChoices"
              :key="bank"
              type="button"
              class="gs-patch__bank"
              :class="{ 'gs-patch__row--selected': bank === props.bankMsb }"
              :aria-pressed="bank === props.bankMsb"
              @click="emit('selectBank', bank)"
            >{{ bank === 0 ? copy.capital : bank }}</button>
          </div>
          <p v-else class="gs-note">{{ copy.none }}</p>
          <p class="gs-note gs-patch__note">{{ copy.note }}</p>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.gs-patch {
  display: grid;
  gap: 12px;
  grid-template-columns: minmax(0, 11rem) minmax(0, 1fr);
}

.gs-patch__families,
.gs-patch__programs {
  display: grid;
  align-content: start;
  gap: 1px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.gs-patch__right {
  display: grid;
  align-content: start;
  gap: 12px;
}

.gs-patch__row {
  inline-size: 100%;
  border: 1px solid transparent;
  border-radius: 5px;
  background: transparent;
  color: var(--demo-text);
  cursor: pointer;
  font-family: inherit;
  text-align: start;
}

.gs-patch__family {
  padding: 3px 8px;
  font-size: 12px;
  line-height: 1.5;
}

.gs-patch__program {
  display: grid;
  align-items: center;
  gap: 8px;
  grid-template-columns: 2rem minmax(0, 1fr);
  padding: 4px 8px;
  font-size: 13px;
}

.gs-patch__row:hover {
  border-color: var(--demo-border);
  background: var(--demo-control-bg-strong);
}

.gs-patch__row--selected {
  border-color: var(--demo-accent-border);
  background: var(--demo-accent-subtle);
  color: var(--demo-text-strong);
}

.gs-patch__number {
  font-size: 11px;
  text-align: end;
}

.gs-patch__name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.gs-patch__variations {
  display: grid;
  gap: 6px;
  padding-block-start: 10px;
  border-block-start: 1px solid var(--demo-border);
}

.gs-patch__banks {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.gs-patch__bank {
  padding: 3px 10px;
  border: 1px solid var(--demo-border);
  border-radius: 5px;
  background: transparent;
  color: var(--demo-text);
  cursor: pointer;
  font-family: var(--font-mono);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}

.gs-patch__bank:hover {
  border-color: var(--demo-border-strong);
}

.gs-patch__note {
  font-size: 10.5px;
}
</style>
