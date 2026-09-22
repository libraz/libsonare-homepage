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
import { TechPanel } from '@/components/ui';
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
      none: 'This program has no variation this build voices apart from the capital tone.',
      note: 'A variation is the same instrument voiced differently. The ones listed are the ones that actually sound different here; a bank this build does not voice apart resolves back to the capital tone, as GS intends.',
    },
    ja: {
      title: '音色',
      loading: 'エンジンに音色一覧を問い合わせています…',
      families: '楽器ファミリー',
      programs: 'このファミリーの音色',
      capital: 'カピタル',
      variations: 'バリエーション',
      none: 'このプログラムには、このビルドがカピタルトーンと鳴らし分けるバリエーションがありません。',
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
  <TechPanel :title="copy.title">
    <template #header-right>
      <span v-if="props.programs.length" class="gs-value gs-patch__current">
        {{ props.program }} · {{ programLabel(props.program) }}
      </span>
    </template>

    <p v-if="!props.programs.length" class="gs-note">{{ copy.loading }}</p>

    <div v-else class="gs-patch">
      <ul class="gs-patch__families" :aria-label="copy.families">
        <li v-for="(_, family) in props.familyNames" :key="family">
          <button
            type="button"
            class="gs-patch__family"
            :class="{ 'gs-patch__family--selected': family === currentFamily }"
            :aria-pressed="family === currentFamily"
            @click="emit('select', family * GM_FAMILY_SIZE)"
          >
            {{ familyLabel(family) }}
          </button>
        </li>
      </ul>

      <div class="gs-patch__right">
        <ul class="gs-patch__programs" :aria-label="copy.programs">
          <li v-for="entry in familyPrograms" :key="entry.program">
            <button
              type="button"
              class="gs-patch__program"
              :class="{ 'gs-patch__program--selected': entry.program === props.program }"
              :aria-pressed="entry.program === props.program"
              @click="emit('select', entry.program)"
            >
              <span class="gs-patch__number gs-value">{{ entry.program }}</span>
              <span class="gs-patch__name">{{ programLabel(entry.program) }}</span>
            </button>
          </li>
        </ul>

        <div class="gs-patch__variations">
          <span class="gs-patch__variations-label">{{ copy.variations }}</span>
          <div v-if="props.variations.length" class="gs-patch__banks">
            <button
              v-for="bank in bankChoices"
              :key="bank"
              type="button"
              class="gs-patch__bank"
              :class="{ 'gs-patch__bank--selected': bank === props.bankMsb }"
              :aria-pressed="bank === props.bankMsb"
              @click="emit('selectBank', bank)"
            >
              {{ bank === 0 ? copy.capital : bank }}
            </button>
          </div>
          <p v-else class="gs-note">{{ copy.none }}</p>
        </div>
      </div>
    </div>

    <template #footer>
      <p class="gs-note">{{ copy.note }}</p>
    </template>
  </TechPanel>
</template>

<style scoped>
.gs-patch {
  display: grid;
  gap: 10px;
  grid-template-columns: minmax(0, 11rem) minmax(0, 1fr);
}

.gs-patch__current {
  font-size: 0.7rem;
}

.gs-patch__families,
.gs-patch__programs {
  display: grid;
  gap: 2px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.gs-patch__families {
  align-content: start;
  max-block-size: 17rem;
  overflow-y: auto;
}

.gs-patch__right {
  display: grid;
  align-content: start;
  gap: 10px;
}

.gs-patch__family,
.gs-patch__program,
.gs-patch__bank {
  border: 1px solid transparent;
  border-radius: 5px;
  background: transparent;
  color: var(--demo-text);
  cursor: pointer;
  font-family: inherit;
  text-align: start;
}

.gs-patch__family {
  inline-size: 100%;
  padding: 5px 8px;
  font-size: 0.74rem;
}

.gs-patch__program {
  display: grid;
  align-items: center;
  gap: 8px;
  grid-template-columns: 2rem minmax(0, 1fr);
  inline-size: 100%;
  padding: 5px 8px;
  font-size: 0.78rem;
}

.gs-patch__family:hover,
.gs-patch__program:hover,
.gs-patch__bank:hover {
  border-color: var(--demo-border);
  background: var(--demo-control-bg);
}

.gs-patch__family--selected,
.gs-patch__program--selected,
.gs-patch__bank--selected {
  border-color: var(--demo-accent-border);
  background: var(--demo-accent-subtle);
  color: var(--demo-text-strong);
}

.gs-patch__family:focus-visible,
.gs-patch__program:focus-visible,
.gs-patch__bank:focus-visible {
  outline: 2px solid var(--demo-accent);
  outline-offset: 2px;
}

.gs-patch__number {
  font-size: 0.7rem;
  text-align: end;
}

.gs-patch__name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.gs-patch__variations {
  display: grid;
  gap: 5px;
  padding-block-start: 8px;
  border-block-start: 1px solid var(--demo-border);
}

.gs-patch__variations-label {
  color: var(--demo-text-muted);
  font-size: 0.66rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.gs-patch__banks {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.gs-patch__bank {
  padding: 3px 9px;
  border-color: var(--demo-border);
  font-family: var(--demo-font-mono, monospace);
  font-size: 0.7rem;
  font-variant-numeric: tabular-nums;
}
</style>
