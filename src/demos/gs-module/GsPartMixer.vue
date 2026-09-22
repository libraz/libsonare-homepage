<script setup lang="ts">
/**
 * The sixteen parts, as strips across the bottom of the front panel.
 *
 * Every control here writes one GS address, and the range each one accepts is
 * the range the address table declares rather than a number chosen for the
 * control — so pan starts at 1, because that is where the parameter starts,
 * and the fader rests where the module powers up rather than at full.
 *
 * The meter carries the part's own signal and nothing else. A part is
 * auditioned on its own, so the only strip that can be metered truthfully is
 * the one being played; a dropped file is never parsed, so nothing about it is
 * metered at all.
 */
import { computed } from 'vue';
import { ChannelStrip, RotaryKnob } from '@/components/ui';
import { useI18n } from '@/composables/useI18n';
import { addressRow } from './gsAddress';
import { defaultPartState, type GsPartState, RHYTHM_CHANNEL } from './gsState';

const props = defineProps<{
  parts: GsPartState[];
  selectedChannel: number;
  /** Display name of each part's current sound, indexed by channel. */
  patchNames: string[];
  /** Peak of what each part is putting out right now, linear, indexed by channel. */
  activity: number[];
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
      rhythmTab: 'RHY',
      level: 'Level',
      pan: 'Pan',
      reverbSend: 'Reverb send',
      chorusSend: 'Chorus send',
      efx: 'Route through the insertion effect',
      select: 'Edit this part',
    },
    ja: {
      title: 'パート',
      // The tab is as narrow as the strip; the shorthand fits where a word does not.
      rhythmTab: 'RHY',
      level: 'レベル',
      pan: 'パン',
      reverbSend: 'リバーブ送り',
      chorusSend: 'コーラス送り',
      efx: 'インサーションエフェクトを経由させる',
      select: 'このパートを編集する',
    },
  }),
);

/**
 * The knob captions stay in the panel's own shorthand rather than being
 * translated: at this width a translated word does not fit, and PAN/REV/CHO is
 * what the control is called in front of either audience. The spoken label is
 * localized instead, through each knob's accessible name.
 */
const SENDS = [
  { key: 'reverbSend', short: 'REV' },
  { key: 'chorusSend', short: 'CHO' },
] as const;

/** Control bounds taken from the address each one writes. */
const bounds = computed(() => ({
  level: addressRow('kPartLevel', 'part'),
  pan: addressRow('kPartPanpot', 'part'),
  reverbSend: addressRow('kPartReverbSend', 'part'),
  chorusSend: addressRow('kPartChorusSend', 'part'),
}));

/**
 * Where each control rests at power-on, which is where a double click returns
 * it. Asked per channel rather than once: a resting value is a property of the
 * address, and a part block is addressed by its own channel.
 */
const resting = computed(() => props.parts.map((part) => defaultPartState(part.channel)));

/** The centre of the pan throw, which GS puts at the middle of the byte. */
const PAN_CENTRE = 64;

/**
 * Pan as a player prints it: a distance either side of centre rather than the
 * raw byte, which reads as a position instead of a number.
 */
function panLabel(value: number): string {
  if (value === PAN_CENTRE) return 'C';
  return value < PAN_CENTRE ? `L${PAN_CENTRE - value}` : `R${value - PAN_CENTRE}`;
}

/**
 * What is printed on the strip's tab. The rhythm part carries its role there
 * rather than beside the patch name, where at this width it would take the
 * room the name needs — and the part number is what identifies the strip.
 */
function stripLabel(channel: number): string {
  const number = `${channel + 1}`;
  return channel === RHYTHM_CHANNEL ? `${number} ${copy.value.rhythmTab}` : number;
}

function set(channel: number, key: keyof GsPartState, value: number) {
  emit('update', channel, { [key]: value } as Partial<GsPartState>);
}
</script>

<template>
  <div class="gs-parts" role="group" :aria-label="copy.title">
    <div
      v-for="part in props.parts"
      :key="part.channel"
      class="gs-part"
      :class="{ 'gs-part--selected': part.channel === props.selectedChannel }"
      @pointerdown="emit('select', part.channel)"
    >
      <ChannelStrip
        :label="stripLabel(part.channel)"
        :aria-label="`${copy.level} ${part.channel + 1}`"
        :gain="part.level"
        :level="props.activity[part.channel] ?? 0"
        :min="bounds.level.lo"
        :max="bounds.level.hi"
        :default-gain="resting[part.channel].level"
        :display="`${part.level}`"
        unit=""
        :quantum="1"
        :nudge="1"
        :coarse="10"
        @update:gain="set(part.channel, 'level', $event)"
      >
        <template #subtitle>
          <span class="gs-part__head">
            <button
              type="button"
              class="gs-part__select"
              :aria-pressed="part.channel === props.selectedChannel"
              :title="`${copy.select} — ${props.patchNames[part.channel]}`"
              @click="emit('select', part.channel)"
            >{{ props.patchNames[part.channel] }}</button>
          </span>
        </template>

        <template #controls>
          <div class="gs-part__knobs">
            <RotaryKnob
              label="PAN"
              :model-value="part.pan"
              :min="bounds.pan.lo"
              :max="bounds.pan.hi"
              :step="1"
              :size="34"
              :display="panLabel(part.pan)"
              :default-value="resting[part.channel].pan"
              :aria-label="`${copy.pan} ${part.channel + 1}`"
              @update:model-value="set(part.channel, 'pan', $event)"
            />
            <div class="gs-part__sends">
              <RotaryKnob
                v-for="send in SENDS"
                :key="send.key"
                :label="send.short"
                :model-value="part[send.key]"
                :min="bounds[send.key].lo"
                :max="bounds[send.key].hi"
                :step="1"
                :size="28"
                :display="`${part[send.key]}`"
                :default-value="resting[part.channel][send.key]"
                :aria-label="`${copy[send.key]} ${part.channel + 1}`"
                @update:model-value="set(part.channel, send.key, $event)"
              />
            </div>
            <button
              type="button"
              class="gs-part__efx"
              :class="{ 'gs-part__efx--on': part.efxAssigned }"
              :aria-pressed="part.efxAssigned"
              :aria-label="`${copy.efx} ${part.channel + 1}`"
              @click="emit('update', part.channel, { efxAssigned: !part.efxAssigned })"
            >EFX</button>
          </div>
        </template>
      </ChannelStrip>
    </div>
  </div>
</template>
