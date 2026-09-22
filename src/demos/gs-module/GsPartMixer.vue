<script setup lang="ts">
/**
 * The sixteen parts, as a row of strips.
 *
 * Every control here writes one GS address, and the range each one accepts is
 * the range the table declares rather than a number chosen for the slider — so
 * pan starts at 1 rather than 0, because that is where the parameter starts.
 */
import { computed } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { addressRow } from './gsAddress';
import { type GsPartState, RHYTHM_CHANNEL } from './gsState';

const props = defineProps<{
  parts: GsPartState[];
  selectedChannel: number;
  /** Display name of each part's current sound, indexed by channel. */
  patchNames: string[];
}>();

const emit = defineEmits<{
  select: [channel: number];
  update: [channel: number, patch: Partial<GsPartState>];
}>();

const { localizedValue } = useI18n();

const copy = computed(() =>
  localizedValue({
    en: {
      title: 'Parts',
      rhythm: 'RHY',
      level: 'Level',
      pan: 'Pan',
      reverbSend: 'Reverb send',
      chorusSend: 'Chorus send',
      efx: 'Route through the insertion effect',
    },
    ja: {
      title: 'パート',
      rhythm: 'リズム',
      level: 'レベル',
      pan: 'パン',
      reverbSend: 'リバーブ送り',
      chorusSend: 'コーラス送り',
      efx: 'インサーションエフェクトを経由させる',
    },
  }),
);

/** Slider bounds taken from the address the control writes. */
const bounds = computed(() => ({
  level: addressRow('kPartLevel', 'part'),
  pan: addressRow('kPartPanpot', 'part'),
  reverbSend: addressRow('kPartReverbSend', 'part'),
  chorusSend: addressRow('kPartChorusSend', 'part'),
}));

/**
 * The strip labels stay in the mixer's own shorthand rather than being
 * translated: at this width a translated word does not fit, and PAN/REV/CHO
 * is what the control is called in front of either audience. The spoken label
 * is localized instead.
 */
const SENDS = [
  { key: 'pan', short: 'PAN' },
  { key: 'reverbSend', short: 'REV' },
  { key: 'chorusSend', short: 'CHO' },
] as const;

function set(channel: number, key: keyof GsPartState, raw: string) {
  emit('update', channel, { [key]: Number(raw) } as Partial<GsPartState>);
}
</script>

<template>
  <div class="gs-mixer" role="group" :aria-label="copy.title">
    <div
      v-for="part in props.parts"
      :key="part.channel"
      class="gs-strip"
      :class="{ 'gs-strip--selected': part.channel === props.selectedChannel }"
      role="button"
      tabindex="0"
      :aria-pressed="part.channel === props.selectedChannel"
      @click="emit('select', part.channel)"
      @keydown.enter.prevent="emit('select', part.channel)"
      @keydown.space.prevent="emit('select', part.channel)"
    >
      <div class="gs-strip__head">
        <span class="gs-strip__channel">{{ part.channel + 1 }}</span>
        <span v-if="part.channel === RHYTHM_CHANNEL" class="gs-strip__role">{{ copy.rhythm }}</span>
      </div>

      <span class="gs-strip__patch" :title="props.patchNames[part.channel]">
        {{ props.patchNames[part.channel] }}
      </span>

      <input
        class="gs-strip__level"
        type="range"
        :min="bounds.level.lo"
        :max="bounds.level.hi"
        :value="part.level"
        :aria-label="`${copy.level} ${part.channel + 1}`"
        @click.stop
        @input="set(part.channel, 'level', ($event.target as HTMLInputElement).value)"
      />

      <div class="gs-strip__sends">
        <label v-for="send in SENDS" :key="send.key" class="gs-send">
          <span class="gs-send__label" aria-hidden="true">{{ send.short }}</span>
          <input
            type="range"
            :min="bounds[send.key].lo"
            :max="bounds[send.key].hi"
            :value="part[send.key]"
            :aria-label="`${copy[send.key]} ${part.channel + 1}`"
            @click.stop
            @input="set(part.channel, send.key, ($event.target as HTMLInputElement).value)"
          />
        </label>
      </div>

      <button
        type="button"
        class="gs-strip__efx"
        :class="{ 'gs-strip__efx--on': part.efxAssigned }"
        :aria-pressed="part.efxAssigned"
        :aria-label="`${copy.efx} ${part.channel + 1}`"
        @click.stop="emit('update', part.channel, { efxAssigned: !part.efxAssigned })"
      >
        EFX
      </button>
    </div>
  </div>
</template>
