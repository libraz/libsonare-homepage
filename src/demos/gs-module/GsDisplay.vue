<script setup lang="ts">
/**
 * The module's display: which part is being edited, what it plays, and what
 * the shared insertion effect is set to.
 *
 * It holds no state. Every figure on it is read from the one module state the
 * panels below write, so the display and the panels cannot disagree about what
 * the module is set to.
 */
import { computed } from 'vue';
import { useI18n } from '@/composables/useI18n';

const props = defineProps<{
  /** Zero-based MIDI channel of the selected part. */
  channel: number;
  isRhythm: boolean;
  patchName: string;
  program: number;
  bankMsb: number;
  /** The effect type as the data files spell it, e.g. `01 10`. */
  efxKey: string;
  efxName: string;
  /** What the bundled build does with that type, already localized. */
  efxStanding: string;
  /** True when the build acts on neither the type nor any of its slots. */
  efxInert: boolean;
}>();

const { localizedValue } = useI18n();

const copy = computed(() =>
  localizedValue({
    en: {
      part: 'Part',
      rhythm: 'RHYTHM',
      sound: 'Sound',
      program: 'PGM',
      bank: 'BANK',
      efx: 'Insertion effect',
    },
    ja: {
      part: 'パート',
      rhythm: 'リズム',
      sound: '音色',
      program: 'プログラム',
      bank: 'バンク',
      efx: 'インサーションエフェクト',
    },
  }),
);
</script>

<template>
  <div class="gs-lcd">
    <div class="gs-lcd__cell">
      <span class="gs-lcd__label">{{ copy.part }}</span>
      <span class="gs-lcd__part">
        {{ props.channel + 1 }}
        <span v-if="props.isRhythm" class="gs-lcd__role">{{ copy.rhythm }}</span>
      </span>
    </div>

    <div class="gs-lcd__cell">
      <span class="gs-lcd__label">{{ copy.sound }}</span>
      <span class="gs-lcd__patch" :title="props.patchName">{{ props.patchName }}</span>
      <span class="gs-lcd__sub">
        <span>{{ copy.program }} {{ props.program }}</span>
        <span>{{ copy.bank }} {{ props.bankMsb }}</span>
      </span>
    </div>

    <div class="gs-lcd__cell gs-lcd__cell--efx">
      <span class="gs-lcd__label">{{ copy.efx }}</span>
      <span class="gs-lcd__efx" :title="props.efxName">
        {{ props.efxKey }} · {{ props.efxName }}
      </span>
      <span class="gs-lcd__sub">
        <span class="gs-badge" :class="props.efxInert ? 'gs-badge--inert' : 'gs-badge--on'">
          {{ props.efxStanding }}
        </span>
      </span>
    </div>
  </div>
</template>
