<script setup lang="ts">
/**
 * The shared insertion effect: which type is selected, what that type does in
 * this build, and what each of its twenty parameter slots does.
 *
 * The panel's job is to be honest about three different things a type can be.
 * Most of the sixty-five are adjustable. Twenty apply an effect whose
 * parameters this build does not read, so their sliders would be decoration.
 * Fourteen are received and held without changing the sound at all — which is
 * not the same as "their defaults happen to be flat", and must not be written
 * that way: no type in this build is flat-at-defaults-yet-adjustable.
 *
 * Every one of those statements is measured, by rendering the same chord
 * through the type and through Thru and comparing. The threshold is one float32
 * quantum, so "unchanged" means the two renders are the same render rather than
 * close.
 */
import { computed } from 'vue';
import { TechPanel } from '@/components/ui';
import { useI18n } from '@/composables/useI18n';
import {
  EFX_ARCHIVE_LIMITS,
  GS_EFX_TYPES as EFX_ENTRIES,
  efxStanding,
  efxStandingCounts,
  efxType,
  type GsEfxStanding,
  unusedConversions,
} from './gsEfx';
import { GS_EFX_TYPES as EFX_NAMES } from './gsNames';
import type { GsEfxState } from './gsState';

const props = defineProps<{ efx: GsEfxState }>();

const emit = defineEmits<{
  selectType: [type: number];
  updateSlot: [slot: number, value: number];
}>();

const { isLocale, localizedValue } = useI18n();

const copy = computed(() =>
  localizedValue({
    en: {
      title: 'Insertion effect',
      standing: {
        adjustable: 'Adjustable',
        fixed: 'Parameters inert',
        inert: 'No effect here',
      } as Record<GsEfxStanding, string>,
      explain: {
        adjustable: 'This type changes the sound, and the slots below change it further.',
        fixed:
          'This type changes the sound, but none of its twenty parameter slots does. The bytes are received and held.',
        inert:
          'This build does not act on this type. Its bytes are received and held, and the render is the same as Thru.',
      } as Record<GsEfxStanding, string>,
      summary: (a: number, f: number, i: number) =>
        `${a} adjustable · ${f} with inert parameters · ${i} with no effect here`,
      slots: 'Parameter slots that move the sound',
      held: (n: number) =>
        `The block is twenty bytes wide either way; the other ${n} are received and held.`,
      archived: 'archive has a conversion',
      distance: 'Distance from Thru',
      level: 'Level against Thru',
      unusedTitle: (n: number) => `${n} slots the archive measured and this build leaves alone`,
      limits: 'What the derivation cannot see',
    },
    ja: {
      title: 'インサーションエフェクト',
      standing: {
        adjustable: '調整できる',
        fixed: 'パラメータが効かない',
        inert: 'このビルドでは効かない',
      } as Record<GsEfxStanding, string>,
      explain: {
        adjustable: 'このタイプは音を変えます。下のスロットを動かすとさらに変わります。',
        fixed:
          'このタイプは音を変えますが、20 本のパラメータスロットはどれも効きません。バイトは受け取られ、保持されます。',
        inert:
          'このビルドはこのタイプを処理しません。バイトは受け取られて保持されますが、出音はスルーと同じです。',
      } as Record<GsEfxStanding, string>,
      summary: (a: number, f: number, i: number) =>
        `調整できる ${a} · パラメータが効かない ${f} · このビルドでは効かない ${i}`,
      slots: '音が変わるパラメータスロット',
      held: (n: number) =>
        `ブロックの幅はどちらにせよ 20 バイトで、残りの ${n} 本は受け取られて保持されるだけです。`,
      archived: 'アーカイブに変換式あり',
      distance: 'スルーとの距離',
      level: 'スルーに対する音量比',
      unusedTitle: (n: number) => `アーカイブが実測していて、このビルドが使わないスロット ${n} 本`,
      limits: '導出できていないこと',
    },
  }),
);

const ja = computed(() => isLocale('ja'));

function typeName(key: string): string {
  const name = EFX_NAMES[key];
  if (!name) return key;
  return ja.value ? name.ja : name.en;
}

const counts = computed(() => efxStandingCounts());

const current = computed(() => efxType(props.efx.type));
const standing = computed<GsEfxStanding>(() =>
  current.value ? efxStanding(current.value) : 'inert',
);
const unused = computed(() => (current.value ? unusedConversions(current.value) : []));
const liveSlots = computed(() => current.value?.slots.filter((slot) => slot.live) ?? []);
const heldCount = computed(() => (current.value?.slots.length ?? 0) - liveSlots.value.length);

/** Two decimals is the resolution a reader can act on; the raw figure is exact. */
function ratio(value: number): string {
  return value.toFixed(3);
}
</script>

<template>
  <TechPanel :title="copy.title">
    <template #header-right>
      <span class="gs-value gs-efx__summary">
        {{ copy.summary(counts.adjustable, counts.fixed, counts.inert) }}
      </span>
    </template>

    <label class="gs-efx__picker">
      <select
        class="gs-efx__select"
        :value="props.efx.type"
        :aria-label="copy.title"
        @change="emit('selectType', Number(($event.target as HTMLSelectElement).value))"
      >
        <option v-for="entry in EFX_ENTRIES" :key="entry.key" :value="entry.type">
          {{ entry.key }} · {{ typeName(entry.key) }}
        </option>
      </select>
    </label>

    <div v-if="current" class="gs-efx__standing">
      <span class="gs-efx__badge" :class="`gs-efx__badge--${standing}`">
        {{ copy.standing[standing] }}
      </span>
      <dl v-if="current.changesSignal" class="gs-efx__figures">
        <div>
          <dt>{{ copy.distance }}</dt>
          <dd class="gs-value">{{ ratio(current.distance) }}</dd>
        </div>
        <div>
          <dt>{{ copy.level }}</dt>
          <dd class="gs-value">{{ ratio(current.levelRatio) }}</dd>
        </div>
      </dl>
    </div>

    <p class="gs-note">{{ copy.explain[standing] }}</p>

    <div v-if="current && liveSlots.length" class="gs-efx__slots">
      <span class="gs-efx__slots-label">{{ copy.slots }}</span>
      <label v-for="slot in liveSlots" :key="slot.slot" class="gs-efx__slot">
        <span class="gs-efx__slot-index gs-value">{{ slot.slot }}</span>
        <input
          type="range"
          min="0"
          max="127"
          :value="props.efx.params[slot.slot]"
          :aria-label="`${copy.slots} ${slot.slot}`"
          @input="emit('updateSlot', slot.slot, Number(($event.target as HTMLInputElement).value))"
        />
        <span class="gs-value gs-efx__slot-value">{{ props.efx.params[slot.slot] }}</span>
      </label>
      <p class="gs-note">{{ copy.held(heldCount) }}</p>
    </div>

    <template #footer>
      <details v-if="unused.length" class="gs-efx__details">
        <summary>{{ copy.unusedTitle(unused.length) }}</summary>
        <ul class="gs-efx__unused">
          <li v-for="slot in unused" :key="slot.slot">
            <span class="gs-value">{{ slot.slot }}</span>
            {{ slot.conversion?.conversion_class }} · {{ copy.archived }}
          </li>
        </ul>
      </details>

      <details class="gs-efx__details">
        <summary>{{ copy.limits }}</summary>
        <ul class="gs-efx__unused">
          <li v-for="limit in EFX_ARCHIVE_LIMITS" :key="limit">{{ limit }}</li>
        </ul>
      </details>
    </template>
  </TechPanel>
</template>

<style scoped>
.gs-efx__summary {
  font-size: 0.66rem;
}

.gs-efx__picker {
  display: block;
  margin-block-end: 8px;
}

.gs-efx__select {
  inline-size: 100%;
  padding: 5px 8px;
  border: 1px solid var(--demo-border);
  border-radius: 5px;
  background: var(--demo-control-bg);
  color: var(--demo-text);
  font-family: var(--demo-font-mono, monospace);
  font-size: 0.74rem;
}

.gs-efx__select:focus-visible {
  outline: 2px solid var(--demo-accent);
  outline-offset: 2px;
}

.gs-efx__standing {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-block-end: 6px;
}

.gs-efx__badge {
  padding: 2px 8px;
  border: 1px solid var(--demo-border);
  border-radius: 4px;
  font-size: 0.68rem;
}

.gs-efx__badge--adjustable {
  border-color: var(--demo-accent-border);
  background: var(--demo-accent-subtle);
  color: var(--demo-accent);
}

.gs-efx__badge--fixed,
.gs-efx__badge--inert {
  border-color: var(--demo-warn-border);
  background: var(--demo-warn-bg);
  color: var(--demo-warn-text);
}

.gs-efx__figures {
  display: flex;
  gap: 12px;
  margin: 0;
}

.gs-efx__figures dt {
  color: var(--demo-text-muted);
  font-size: 0.6rem;
}

.gs-efx__figures dd {
  margin: 0;
  font-size: 0.72rem;
}

.gs-efx__slots {
  display: grid;
  gap: 3px;
  margin-block-start: 8px;
  max-block-size: 13rem;
  overflow-y: auto;
}

.gs-efx__slots-label {
  color: var(--demo-text-muted);
  font-size: 0.66rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.gs-efx__slot {
  display: grid;
  align-items: center;
  gap: 6px;
  grid-template-columns: 1.4rem minmax(0, 1fr) 2rem;
}

.gs-efx__slot-index,
.gs-efx__slot-value {
  font-size: 0.66rem;
  text-align: end;
}

.gs-efx__details {
  color: var(--demo-text-muted);
  font-size: 0.7rem;
}

.gs-efx__details summary {
  cursor: pointer;
}

.gs-efx__unused {
  display: grid;
  gap: 3px;
  margin: 6px 0 0;
  padding-inline-start: 1.1rem;
  line-height: 1.5;
}
</style>
