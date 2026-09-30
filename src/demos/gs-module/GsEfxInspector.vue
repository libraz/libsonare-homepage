<script setup lang="ts">
/**
 * The modern insertion-effect mapping for the selected GS type.
 *
 * Each row keeps the binding form and law beside its localized target. A
 * translated row carries a measured class/table, a designed row carries the
 * law chosen for that target, and an enables row shows the stages it switches.
 * Classic realization uses the same wire bytes but a separate whole-type
 * model; this panel describes the modern mapping only.
 */
import { computed } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { bindingLabels, localizedOrdinalName, localizedStageName } from './gsBindingText';
import {
  bindingTargets,
  EFX_ARCHIVE_LIMITS,
  GS_EFX_TYPES as EFX_ENTRIES,
  efxStanding,
  efxStandingCounts,
  efxType,
  type GsEfxBinding,
  type GsEfxStanding,
} from './gsEfx';
import { GS_EFX_TYPES as EFX_NAMES, GS_EFX_STANDINGS } from './gsNames';
import type { GsParamMeta } from './gsParamMeta';
import { paramMetaKey } from './gsParamMeta';
import type { GsEfxState } from './gsState';

const props = defineProps<{
  efx: GsEfxState;
  /** What the engine says about each modern control a slot can reach. */
  paramMeta: Map<string, GsParamMeta>;
  /** The selected realization; both modes share the modern mapping display. */
  realization?: 'modern' | 'classic';
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
      modernMapping:
        'Modern mapping: targets below name the controls in the modern insert chain. Classic uses a dedicated whole-type model.',
      explain: {
        adjustable: 'This type changes the sound, and the slots below change it further.',
        fixed:
          'This type changes the sound, but no parameter slot changed the default-state probe. Other settings may make controls active.',
        inert:
          'This build does not change this type in the default-state probe. Other settings may make controls active.',
      } as Record<GsEfxStanding, string>,
      summary: (a: number, f: number, i: number) =>
        `${a} adjustable · ${f} fixed · ${i} unchanged at defaults`,
      slots: 'Parameters',
      slotCount: (named: number, live: number) => `${named} named · ${live} move the sound`,
      distance: 'Distance from Thru',
      level: 'Level against Thru',
      held: 'No audible difference in the default-state probe; other settings may make this control active.',
      limits: 'What the derivation cannot see',
      none: 'This type prints no parameters.',
      measured: 'Measured',
      translated: 'Translated',
      rangeDerived: 'range-derived',
      designed: 'Designed',
      carried: 'carried',
      invented: 'invented',
      switch: 'Switch',
      enabled: 'Enabled',
      disabled: 'Off',
      switched: 'Switched to',
      noSelection: 'No stage for this value',
    },
    ja: {
      title: 'インサーションエフェクト',
      modernMapping:
        'モダンのマッピング：下のターゲットはモダンのインサートチェーンの制御先です。クラシックはタイプ全体を専用モデルで処理します。',
      explain: {
        adjustable: 'このタイプは音を変えます。下のスロットを動かすとさらに変わります。',
        fixed:
          'このタイプは音を変えますが、既定状態の試聴ではどのスロットも差を生みませんでした。ほかの設定で音に反映される場合があります。',
        inert:
          'このビルドは既定状態の試聴でこのタイプの差を検出しませんでした。ほかの設定で音に反映される場合があります。',
      } as Record<GsEfxStanding, string>,
      summary: (a: number, f: number, i: number) =>
        `調整できる ${a} · 固定 ${f} · 既定値では変化なし ${i}`,
      slots: 'パラメータ',
      slotCount: (named: number, live: number) => `名前あり ${named} · 音が変わる ${live}`,
      distance: 'スルーとの距離',
      level: 'スルーに対する音量比',
      held: '既定状態の試聴では差が出ませんでした。ほかの設定で音に反映される場合があります。',
      limits: '導出できていないこと',
      none: 'このタイプには表示するパラメータがありません。',
      measured: '測定',
      translated: '変換',
      rangeDerived: '範囲から導出',
      designed: '設計',
      carried: '引き継ぎ',
      invented: '新規',
      switch: 'スイッチ',
      enabled: '有効',
      disabled: 'オフ',
      switched: '切り替え先',
      noSelection: 'この値に対応する段はありません',
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

function formLabel(binding: GsEfxBinding): string {
  if (binding.form === 'translated') {
    const basis = binding.range ? copy.value.rangeDerived : copy.value.measured;
    return `${copy.value.translated} · ${basis}`;
  }
  if (binding.form === 'enables') return copy.value.switch;
  return copy.value.designed;
}

function lawLabel(binding: GsEfxBinding, law: string | null): string | null {
  if (binding.form === 'enables' || law === null) return null;
  if (binding.form === 'translated') {
    const basis = binding.range ? copy.value.rangeDerived : copy.value.measured;
    return `${copy.value.translated} · ${basis} · ${law}`;
  }
  const basis = binding.basis === 'carried' ? copy.value.carried : copy.value.invented;
  return `${copy.value.designed} · ${basis} · ${law}`;
}

function unitOf(target: { stage: string; keys: readonly string[] }): string | null {
  if (target.keys.length === 0) return null;
  return props.paramMeta.get(paramMetaKey(target.stage, target.keys[0]))?.unit ?? null;
}

function enableStageName(stage: { stage: string; ordinal: number }): string {
  return localizedOrdinalName(localizedStageName(stage.stage, ja.value), stage.ordinal, ja.value);
}

interface TargetRow {
  stage: string;
  param: string;
  unit: string | null;
  law: string | null;
}

interface SlotRow {
  slot: number;
  live: boolean;
  binding: GsEfxBinding;
  form: string;
  targets: TargetRow[];
  enableStages: string[];
  enableState: string | null;
}

function enableState(binding: GsEfxBinding, value: number): string | null {
  const enables = binding.enables;
  if (!enables) return null;
  if (enables.mode === 'select') {
    const selected = enables.stages[value];
    return selected
      ? `${copy.value.switched}: ${enableStageName(selected)}`
      : `${copy.value.switched}: ${copy.value.noSelection}`;
  }
  return enables.onStates.includes(value) ? copy.value.enabled : copy.value.disabled;
}

/** One slot as the panel prints it, with form, targets and current switch state. */
const rows = computed<SlotRow[]>(() =>
  (current.value?.slots ?? [])
    .filter((slot) => slot.binding !== null)
    .map((slot) => {
      const binding = slot.binding!;
      const targets = bindingTargets(binding);
      const labels = bindingLabels(binding, ja.value);
      const targetRows = targets.map((target, index) => ({
        stage: labels[index]?.stage ?? target.stage,
        param: labels[index]?.param ?? '',
        unit: unitOf(target),
        law: lawLabel(binding, target.law),
      }));
      const enableStages = binding.enables?.stages.map(enableStageName) ?? [];
      return {
        slot: slot.slot,
        live: slot.live,
        binding,
        form: formLabel(binding),
        targets: targetRows,
        enableStages,
        enableState: enableState(binding, props.efx.params[slot.slot]),
      };
    }),
);

const namedCount = computed(
  () => rows.value.filter((row) => row.targets.length > 0 || row.enableStages.length > 0).length,
);
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

    <p class="gs-efx__mapping">{{ copy.modernMapping }}</p>

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
      <li v-for="row in rows" :key="row.slot" class="gs-efx__slot" :class="{ 'gs-efx__slot--probe-inert': !row.live }">
        <span class="gs-efx__slot-index gs-value">{{ row.slot }}</span>

        <span class="gs-efx__slot-name">
          <template v-if="row.targets.length">
            <span v-for="(target, targetIndex) in row.targets" :key="`${row.slot}/${targetIndex}`" class="gs-efx__target">
              <span class="gs-efx__slot-stage">{{ target.stage }}</span>
              <span class="gs-efx__slot-param">
                {{ target.param }}
                <small v-if="target.unit">{{ target.unit }}</small>
              </span>
              <small v-if="target.law" class="gs-efx__law">{{ target.law }}</small>
            </span>
          </template>
          <template v-else>
            <span class="gs-efx__slot-stage">{{ row.enableStages.join(' / ') }}</span>
            <span class="gs-efx__slot-param">{{ row.enableState }}</span>
          </template>
          <small class="gs-efx__form">{{ row.form }}</small>
        </span>

        <input
          type="range"
          min="0"
          max="127"
          :value="props.efx.params[row.slot]"
          :title="row.live ? undefined : copy.held"
          :aria-label="row.targets.length ? row.targets.map((target) => `${target.stage} ${target.param}`).join(' / ') : `${copy.slots} ${row.slot}`"
          @input="emit('updateSlot', row.slot, Number(($event.target as HTMLInputElement).value))"
        />

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

.gs-efx__mapping {
  margin: 8px 0 0;
  color: var(--demo-text-muted);
  font-size: 10px;
  line-height: 1.35;
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

.gs-efx__slot--probe-inert {
  opacity: 0.82;
}

.gs-efx__slot-index {
  font-size: 10px;
  text-align: end;
}

.gs-efx__slot-name {
  display: grid;
  gap: 2px;
  min-inline-size: 0;
}

.gs-efx__target {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  row-gap: 1px;
  min-inline-size: 0;
}

.gs-efx__slot-stage {
  grid-column: 1;
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
  grid-column: 1;
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

.gs-efx__law {
  grid-column: 1;
  grid-row: auto;
  color: var(--demo-text-muted);
  font-family: var(--font-mono);
  font-size: 8px;
  overflow-wrap: anywhere;
}

.gs-efx__form {
  color: var(--demo-text-faint);
  font-family: var(--font-mono);
  font-size: 8px;
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
