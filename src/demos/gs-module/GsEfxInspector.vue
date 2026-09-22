<script setup lang="ts">
/**
 * The shared insertion effect: which type is selected, what that type does in
 * this build, and what each of its parameter slots is.
 *
 * A slot is three claims from three sources, and they are worth showing apart
 * rather than reconciling. The binding tree says which control the byte
 * reaches — `Chorus · Rate`, not "slot 3". The conversion archive says the law
 * it follows and the values the machine printed for it. The audibility pass
 * says whether this build's render actually moves when the byte moves, found
 * by rendering rather than declared.
 *
 * Where the first two disagree with the third, the slot is named and marked as
 * one this build does not act on. That is the honest reading: the byte has a
 * meaning, and this engine does not carry it yet.
 */
import { computed } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { bindingLabel, bindingReason } from './gsBindingText';
import {
  EFX_ARCHIVE_LIMITS,
  GS_EFX_TYPES as EFX_ENTRIES,
  efxStanding,
  efxStandingCounts,
  efxType,
  type GsEfxSlot,
  type GsEfxStanding,
} from './gsEfx';
import { GS_EFX_TYPES as EFX_NAMES, GS_EFX_STANDINGS } from './gsNames';
import type { GsParamMeta } from './gsParamMeta';
import { paramMetaKey } from './gsParamMeta';
import type { GsEfxState } from './gsState';

const props = defineProps<{
  efx: GsEfxState;
  /** What the engine says about each control a slot can reach. */
  paramMeta: Map<string, GsParamMeta>;
}>();

const emit = defineEmits<{
  selectType: [type: number];
  updateSlot: [slot: number, value: number];
}>();

const { isLocale, localizedValue } = useI18n();

const copy = computed(() =>
  localizedValue({
    en: {
      title: 'Insertion effect',
      explain: {
        adjustable: 'This type changes the sound, and the slots below change it further.',
        fixed:
          'This type changes the sound, but none of its parameter slots does. The bytes are received and held.',
        inert:
          'This build does not act on this type. Its bytes are received and held, and the render is the same as Thru.',
      } as Record<GsEfxStanding, string>,
      summary: (a: number, f: number, i: number) => `${a} adjustable · ${f} inert · ${i} silent`,
      slots: 'Parameters',
      slotCount: (named: number, live: number) => `${named} named · ${live} move the sound`,
      distance: 'Distance from Thru',
      level: 'Level against Thru',
      held: 'Received and held — this build does not move with it',
      limits: 'What the derivation cannot see',
      none: 'This type prints no parameters.',
    },
    ja: {
      title: 'インサーションエフェクト',
      explain: {
        adjustable: 'このタイプは音を変えます。下のスロットを動かすとさらに変わります。',
        fixed:
          'このタイプは音を変えますが、パラメータスロットはどれも効きません。バイトは受け取られ、保持されます。',
        inert:
          'このビルドはこのタイプを処理しません。バイトは受け取られて保持されますが、出音はスルーと同じです。',
      } as Record<GsEfxStanding, string>,
      summary: (a: number, f: number, i: number) => `調整できる ${a} · 効かない ${f} · 無音 ${i}`,
      slots: 'パラメータ',
      slotCount: (named: number, live: number) => `名前あり ${named} · 音が変わる ${live}`,
      distance: 'スルーとの距離',
      level: 'スルーに対する音量比',
      held: '受け取られますが、このビルドの出音は動きません',
      limits: '導出できていないこと',
      none: 'このタイプにはパラメータが印字されていません。',
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
const standingLabel = computed(() => {
  const name = GS_EFX_STANDINGS[standing.value];
  return ja.value ? name.ja : name.en;
});

/** One slot as the panel prints it, with every side of it already resolved. */
interface SlotRow {
  slot: number;
  live: boolean;
  stage: string | null;
  param: string | null;
  unit: string | null;
  reason: string | null;
}

/** The unit the engine gives the control this slot reaches, if it carries one. */
function unitOf(slot: GsEfxSlot): string | null {
  const binding = slot.binding;
  if (!binding?.stage || binding.keys.length === 0) return null;
  return props.paramMeta.get(paramMetaKey(binding.stage, binding.keys[0]))?.unit ?? null;
}

/**
 * Every slot the machine prints on this type, adjudicated or not. A slot with
 * no row at all is one the machine does not have, so it is not a control that
 * is missing — there is nothing there to show.
 */
const rows = computed<SlotRow[]>(() =>
  (current.value?.slots ?? [])
    .filter((slot) => slot.binding !== null)
    .map((slot) => {
      const label = slot.binding ? bindingLabel(slot.binding, ja.value) : null;
      return {
        slot: slot.slot,
        live: slot.live,
        stage: label?.stage ?? null,
        param: label?.param ?? null,
        unit: unitOf(slot),
        reason: slot.binding ? bindingReason(slot.binding, ja.value) : null,
      };
    }),
);

const namedCount = computed(() => rows.value.filter((row) => row.param !== null).length);
const liveCount = computed(() => rows.value.filter((row) => row.live).length);

/** Two decimals is the resolution a reader can act on; the raw figure is exact. */
function ratio(value: number): string {
  return value.toFixed(3);
}
</script>

<template>
  <section class="gs-rack" :aria-label="copy.title">
    <div class="gs-rack__head">
      <span class="gs-rack__title">{{ copy.title }}</span>
      <span class="gs-rack__aside">
        {{ copy.summary(counts.adjustable, counts.fixed, counts.inert) }}
      </span>
    </div>

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

    <div v-if="current" class="gs-efx__standing">
      <span class="gs-badge" :class="standing === 'adjustable' ? 'gs-badge--on' : 'gs-badge--inert'">
        {{ standingLabel }}
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

    <div class="gs-efx__slots-head">
      <span class="gs-rack__title">{{ copy.slots }}</span>
      <span class="gs-rack__aside">{{ copy.slotCount(namedCount, liveCount) }}</span>
    </div>

    <p v-if="!rows.length" class="gs-note">{{ copy.none }}</p>

    <ul v-else class="gs-efx__slots">
      <li v-for="row in rows" :key="row.slot" class="gs-efx__slot" :class="{ 'gs-efx__slot--held': !row.live }">
        <span class="gs-efx__slot-index gs-value">{{ row.slot }}</span>

        <span class="gs-efx__slot-name">
          <template v-if="row.param">
            <span class="gs-efx__slot-stage">{{ row.stage }}</span>
            <span class="gs-efx__slot-param">
              {{ row.param }}
              <small v-if="row.unit">{{ row.unit }}</small>
            </span>
          </template>
          <span v-else class="gs-efx__slot-reason" :title="row.reason ?? undefined">
            {{ row.reason }}
          </span>
        </span>

        <input
          v-if="row.live"
          type="range"
          min="0"
          max="127"
          :value="props.efx.params[row.slot]"
          :aria-label="row.param ? `${row.stage} ${row.param}` : `${copy.slots} ${row.slot}`"
          @input="emit('updateSlot', row.slot, Number(($event.target as HTMLInputElement).value))"
        />
        <span v-else class="gs-efx__slot-held" :title="copy.held">—</span>

        <span class="gs-value gs-efx__slot-value">{{ props.efx.params[row.slot] }}</span>
      </li>
    </ul>

    <details class="gs-details gs-efx__limits">
      <summary>{{ copy.limits }}</summary>
      <ul class="gs-details__list">
        <li v-for="limit in EFX_ARCHIVE_LIMITS" :key="limit">{{ limit }}</li>
      </ul>
    </details>
  </section>
</template>

<style scoped>
.gs-efx__select {
  inline-size: 100%;
  padding: 6px 8px;
  border: 1px solid var(--demo-border-strong);
  border-radius: 6px;
  background: var(--demo-control-bg-strong);
  color: var(--demo-text-strong);
  font-family: var(--font-mono);
  font-size: 12px;
}

.gs-efx__standing {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.gs-efx__figures {
  display: flex;
  gap: 14px;
  margin: 0;
}

.gs-efx__figures dt {
  color: var(--demo-text-faint);
  font-family: var(--font-mono);
  font-size: 8px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.gs-efx__figures dd {
  margin: 0;
  font-size: 11px;
}

.gs-efx__slots-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  padding-block-start: 8px;
  border-block-start: 1px solid var(--demo-border);
}

.gs-efx__slots {
  display: grid;
  align-content: start;
  gap: 2px;
  margin: 0;
  padding: 0;
  max-block-size: 17rem;
  overflow-y: auto;
  list-style: none;
}

.gs-efx__slot {
  display: grid;
  align-items: center;
  gap: 8px;
  grid-template-columns: 1.5rem minmax(0, 1fr) 6rem 2rem;
  padding: 3px 2px;
  border-radius: 4px;
}

.gs-efx__slot--held {
  opacity: 0.66;
}

.gs-efx__slot-index {
  font-size: 10px;
  text-align: end;
}

.gs-efx__slot-name {
  display: grid;
  gap: 0;
  min-inline-size: 0;
}

.gs-efx__slot-stage {
  color: var(--demo-text-faint);
  font-family: var(--font-mono);
  font-size: 8px;
  font-weight: 700;
  letter-spacing: 0.1em;
  overflow: hidden;
  text-overflow: ellipsis;
  text-transform: uppercase;
  white-space: nowrap;
}

.gs-efx__slot-param {
  color: var(--demo-text);
  font-size: 11.5px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.gs-efx__slot-param small {
  margin-inline-start: 4px;
  color: var(--demo-text-faint);
  font-family: var(--font-mono);
  font-size: 8.5px;
}

/* A reason runs to a sentence, and a sentence per row would set the rhythm of
   the list by its longest entry. Two lines, with the whole of it on hover. */
.gs-efx__slot-reason {
  display: -webkit-box;
  overflow: hidden;
  color: var(--demo-text-muted);
  font-size: 10px;
  line-height: 1.3;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.gs-efx__slot-held {
  color: var(--demo-text-faint);
  font-family: var(--font-mono);
  font-size: 11px;
  text-align: center;
}

.gs-efx__slot-value {
  font-size: 10.5px;
  text-align: end;
}

.gs-efx__limits {
  padding-block-start: 8px;
  border-block-start: 1px solid var(--demo-border);
}
</style>
