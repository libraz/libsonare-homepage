<script setup lang="ts">
/**
 * The rhythm sets this build defines, asked for rather than listed.
 *
 * Which programs carry a set, and which of those are voiced apart instead of
 * falling back to Standard, are both engine queries. Hardcoding either would
 * put the demo one engine release away from lying, and the fallback set is
 * exactly what a reader is most likely to mistake for a broken kit.
 */
import { computed } from 'vue';
import { useI18n } from '@/composables/useI18n';
import type { GsDrumKit } from './useGsModule';

const props = defineProps<{
  kits: GsDrumKit[];
  selectedProgram: number;
}>();

const emit = defineEmits<{ select: [program: number] }>();

const { localizedValue } = useI18n();

const copy = computed(() =>
  localizedValue({
    en: {
      title: 'Rhythm sets',
      loading: 'Asking the engine which sets it defines…',
      fallback: 'Standard',
      count: (defined: number, apart: number) =>
        `${defined} sets defined, ${apart} voiced apart from Standard`,
      note: 'A set marked Standard is named and selectable, but the sample-free fallback voices it the same as Standard. With a SoundFont loaded it plays that font’s own set.',
    },
    ja: {
      title: 'リズムセット',
      loading: 'このビルドが持つセットをエンジンに問い合わせています…',
      fallback: 'Standard と同じ',
      count: (defined: number, apart: number) =>
        `定義されているセット ${defined} 種。うち Standard と鳴らし分けがあるのは ${apart} 種`,
      note: '「Standard と同じ」と付いたセットは、名前も選択もできますが、サンプルを持たないフォールバックでは Standard と同じ音で鳴ります。SoundFont を読み込めばそのフォントのセットが鳴ります。',
    },
  }),
);

const apartCount = computed(() => props.kits.filter((kit) => kit.voicedApart).length);
</script>

<template>
  <section class="gs-rack" :aria-label="copy.title">
    <div class="gs-rack__head">
      <span class="gs-rack__title">{{ copy.title }}</span>
      <span v-if="props.kits.length" class="gs-rack__aside">
        {{ copy.count(props.kits.length, apartCount) }}
      </span>
    </div>

    <p v-if="!props.kits.length" class="gs-note">{{ copy.loading }}</p>

    <ul v-else class="gs-kits">
      <li v-for="kit in props.kits" :key="kit.program">
        <button
          type="button"
          class="gs-kits__item"
          :class="{ 'gs-kits__item--selected': kit.program === props.selectedProgram }"
          :aria-pressed="kit.program === props.selectedProgram"
          @click="emit('select', kit.program)"
        >
          <span class="gs-kits__program gs-value">{{ kit.program }}</span>
          <span class="gs-kits__name">{{ kit.name }}</span>
          <span v-if="!kit.voicedApart" class="gs-badge gs-badge--inert gs-kits__tag">
            {{ copy.fallback }}
          </span>
        </button>
      </li>
    </ul>

    <p class="gs-note gs-kits__note">{{ copy.note }}</p>
  </section>
</template>

<style scoped>
.gs-kits {
  display: grid;
  align-content: start;
  gap: 1px;
  margin: 0;
  padding: 0;
  max-block-size: 19rem;
  overflow-y: auto;
  list-style: none;
}

.gs-kits__item {
  display: grid;
  align-items: center;
  gap: 8px;
  grid-template-columns: 2rem minmax(0, 1fr) auto;
  inline-size: 100%;
  padding: 4px 8px;
  border: 1px solid transparent;
  border-radius: 5px;
  background: transparent;
  color: var(--demo-text);
  cursor: pointer;
  font-family: inherit;
  font-size: 13px;
  text-align: start;
}

.gs-kits__item:hover {
  border-color: var(--demo-border);
  background: var(--demo-control-bg-strong);
}

.gs-kits__item--selected {
  border-color: var(--demo-accent-border);
  background: var(--demo-accent-subtle);
  color: var(--demo-text-strong);
}

.gs-kits__item:focus-visible {
  outline: 2px solid var(--demo-accent);
  outline-offset: 2px;
}

.gs-kits__program {
  font-size: 11px;
  text-align: end;
}

.gs-kits__name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.gs-kits__tag {
  padding: 1px 6px;
  font-size: 8.5px;
}

.gs-kits__note {
  padding-block-start: 10px;
  border-block-start: 1px solid var(--demo-border);
  font-size: 10.5px;
}
</style>
