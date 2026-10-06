<script setup lang="ts">
/**
 * The Studio signal-chain rack: repair, the strip EQ and the 13 inserts in
 * signal order. Each insert row carries its bypass switch and a one-line
 * readout; the dynamics rows each show their own gain reduction, and the
 * footer the chain's deepest.
 */
import { computed } from 'vue';
import GainReductionMeter from '@/components/meters/GainReductionMeter.vue';
import { useMasteringCopy } from '@/demos/mastering/masteringCopy';
import {
  MASTERING_INSERT_LAYOUT,
  MASTERING_REPAIR_STAGES,
  type MasteringParams,
  type MasteringSlotId,
  type MasteringState,
} from '@/demos/mastering/masteringState';
import {
  formatNumber,
  MASTERING_FIXED_SLOTS,
  MASTERING_GR_SLOTS,
  type MasteringModuleId,
} from '@/demos/mastering/masteringUi';
import { fill } from '@/utils/template';

const props = defineProps<{
  state: MasteringState;
  selected: MasteringModuleId;
  /** Lane 1's deepest gain reduction, dB ≤ 0. */
  grDb: number;
  /** Each insert's own gain reduction, dB ≤ 0, indexed by slot. */
  insertGrDb: readonly number[];
  /** Non-zero while a discrete edit's rebuild is being shown. */
  resetFlash: number;
  /** Repair progress 0..1 while it runs, else null. */
  repairProgress: number | null;
  repairFailed: boolean;
  disabled?: boolean;
}>();

const emit = defineEmits<{
  select: [id: MasteringModuleId];
  bypass: [slot: number, bypassed: boolean];
}>();

const copy = useMasteringCopy();

const num = (params: MasteringParams, name: string) => params[name] as number;
const khz = (hz: number) => (hz >= 1000 ? `${formatNumber(hz / 1000, 1)}k` : formatNumber(hz, 0));

/** The headline value of a slot, as the row shows it. */
function summary(id: MasteringSlotId, p: MasteringParams): string {
  switch (id) {
    case 'input':
    case 'drive':
      return `${formatNumber(num(p, 'levelDb'), 1, true)} dB`;
    case 'tone':
      return `${formatNumber(num(p, 'tiltDb'), 1, true)} dB · ${khz(num(p, 'pivotHz'))}`;
    case 'deesser':
      return `${khz(num(p, 'frequencyHz'))} · ${formatNumber(num(p, 'thresholdDb'), 0)}`;
    case 'transient':
      return `${formatNumber(num(p, 'attackGainDb'), 1, true)} / ${formatNumber(num(p, 'sustainGainDb'), 1, true)}`;
    case 'compressor':
      return `${formatNumber(num(p, 'thresholdDb'), 0)} dB · ${formatNumber(num(p, 'ratio'), 1)}:1`;
    case 'multiband':
      return `${khz(num(p, 'cutoff0Hz'))} / ${khz(num(p, 'cutoff1Hz'))}`;
    case 'tape':
      return `${formatNumber(num(p, 'driveDb'), 1)} dB`;
    case 'exciter':
    case 'air':
      return formatNumber(num(p, 'amount'), 2);
    case 'stereo':
      return `${formatNumber(num(p, 'width'), 2)}×`;
    case 'monoBass':
      return `< ${khz(num(p, 'frequencyHz'))}`;
    case 'limiter':
      return `${formatNumber(num(p, 'ceilingDb'), 1)} dBTP`;
  }
}

const rows = computed(() =>
  MASTERING_INSERT_LAYOUT.map((entry, slot) => {
    const insert = props.state.inserts[slot];
    return {
      id: entry.id,
      slot,
      index: String(slot + 1).padStart(2, '0'),
      name: copy.value.modules[entry.id],
      bypassed: insert.bypassed,
      fixed: MASTERING_FIXED_SLOTS.includes(entry.id),
      reportsGr: MASTERING_GR_SLOTS.includes(entry.id),
      grDb: props.insertGrDb[slot] ?? 0,
      summary: summary(entry.id, insert.params),
    };
  }),
);

const eqOn = computed(() => props.state.eq.filter((band) => band.enabled).length);
const repairOn = computed(
  () => MASTERING_REPAIR_STAGES.filter((stage) => props.state.repair[stage].enabled).length,
);
const repairSummary = computed(() => {
  if (props.repairProgress !== null) return `${Math.round(props.repairProgress * 100)}%`;
  if (props.repairFailed) return copy.value.prep.failed;
  return repairOn.value
    ? fill(copy.value.rack.repairSummary, { n: repairOn.value })
    : copy.value.prep.off;
});
</script>

<template>
  <section
    class="rack"
    :class="{ 'rack--rebuilt': resetFlash > 0 }"
    :aria-label="copy.rack.title"
  >
    <header class="rack__head">
      <h3>{{ copy.rack.title }}</h3>
      <span class="rack__rebuilt" role="status">{{ resetFlash > 0 ? copy.rack.rebuilt : '' }}</span>
    </header>
    <ol class="rack__list">
      <li class="rack__row rack__row--pre" :class="{ 'is-selected': selected === 'repair' }">
        <span class="rack__index">R</span>
        <button
          type="button"
          class="rack__select"
          :aria-current="selected === 'repair' ? 'true' : undefined"
          :aria-label="fill(copy.rack.select, { name: copy.modules.repair })"
          @click="emit('select', 'repair')"
        >
          <span class="rack__name">{{ copy.modules.repair }}</span>
          <span class="rack__summary" :class="{ 'is-warn': repairFailed }">{{ repairSummary }}</span>
        </button>
        <span class="rack__tag">{{ copy.rack.offline }}</span>
      </li>
      <li class="rack__row rack__row--pre" :class="{ 'is-selected': selected === 'eq' }">
        <span class="rack__index">EQ</span>
        <button
          type="button"
          class="rack__select"
          :aria-current="selected === 'eq' ? 'true' : undefined"
          :aria-label="fill(copy.rack.select, { name: copy.modules.eq })"
          @click="emit('select', 'eq')"
        >
          <span class="rack__name">{{ copy.modules.eq }}</span>
          <span class="rack__summary">{{ fill(copy.rack.eqSummary, { n: eqOn }) }}</span>
        </button>
        <span class="rack__tag"></span>
      </li>
      <li
        v-for="row in rows"
        :key="row.id"
        class="rack__row"
        :class="{ 'is-selected': selected === row.id, 'is-bypassed': row.bypassed }"
      >
        <span class="rack__index">{{ row.index }}</span>
        <button
          type="button"
          class="rack__select"
          :aria-current="selected === row.id ? 'true' : undefined"
          :aria-label="fill(copy.rack.select, { name: row.name })"
          @click="emit('select', row.id)"
        >
          <span class="rack__name">{{ row.name }}</span>
          <span class="rack__summary" :title="row.fixed ? copy.rack.driveNote : undefined">{{ row.summary }}</span>
        </button>
        <GainReductionMeter
          v-if="row.reportsGr"
          class="rack__gr"
          :gr-db="row.grDb"
          orientation="horizontal"
          :range-db="12"
          :labels="{ ...copy.meters.gr, name: `${row.name} · ${copy.meters.gr.name}` }"
        />
        <button
          v-if="!row.fixed"
          type="button"
          class="rack__power"
          :aria-pressed="!row.bypassed"
          :aria-label="fill(row.bypassed ? copy.rack.enable : copy.rack.bypass, { name: row.name })"
          :disabled="disabled"
          @click="emit('bypass', row.slot, !row.bypassed)"
        >
          <span aria-hidden="true"></span>
        </button>
        <span v-else class="rack__power rack__power--fixed" aria-hidden="true"></span>
      </li>
    </ol>
    <footer class="rack__foot">
      <span class="rack__foot-label">{{ copy.rack.gr }}</span>
      <GainReductionMeter
        :gr-db="grDb"
        orientation="horizontal"
        :range-db="12"
        :labels="copy.meters.gr"
      />
    </footer>
  </section>
</template>

<style scoped>
.rack {
  display: grid;
  grid-template-rows: auto 1fr auto;
  min-width: 0;
  border: 1px solid var(--demo-border);
  border-radius: 6px;
  background: var(--demo-bg-elevated);
}

.rack__head,
.rack__foot {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
}

.rack__head {
  justify-content: space-between;
  border-bottom: 1px solid var(--demo-border);
}

.rack__head h3 {
  margin: 0;
  color: var(--demo-text-muted);
  font-family: var(--font-mono);
  font-size: var(--demo-label-size);
  font-weight: var(--demo-label-weight);
  letter-spacing: var(--demo-label-tracking);
  text-transform: uppercase;
}

.rack__rebuilt {
  color: var(--demo-amber);
  font-family: var(--font-mono);
  font-size: 10px;
}

.rack__list {
  margin: 0;
  padding: 4px 0;
  list-style: none;
}

.rack__row {
  display: grid;
  grid-template-columns: 22px minmax(0, 1fr) auto 22px;
  align-items: center;
  gap: 6px;
  min-height: 30px;
  padding: 0 8px 0 10px;
  border-top: 1px solid transparent;
  transition: background-color 0.4s ease;
}

.rack__row + .rack__row {
  border-top-color: var(--demo-border);
}

.rack__row.is-selected {
  background: var(--demo-accent-subtle);
}

.rack__row--pre:nth-child(2) {
  border-bottom: 1px solid var(--demo-border-strong);
}

.rack--rebuilt .rack__row:not(.rack__row--pre) {
  background: var(--demo-warn-bg);
  transition: none;
}

.rack__index {
  color: var(--demo-text-faint);
  font-family: var(--font-mono);
  font-size: 10px;
  font-variant-numeric: tabular-nums;
}

.rack__select {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  min-width: 0;
  padding: 6px 2px;
  border: 0;
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.rack__select:focus-visible,
.rack__power:focus-visible {
  outline: 2px solid var(--demo-accent);
  outline-offset: 1px;
}

.rack__name {
  overflow: hidden;
  color: var(--demo-text-strong);
  font-family: var(--font-body);
  font-size: 12.5px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.is-selected .rack__name {
  color: var(--demo-accent);
}

.is-bypassed .rack__name,
.is-bypassed .rack__summary {
  color: var(--demo-text-faint);
  text-decoration: line-through;
  text-decoration-thickness: 1px;
}

.rack__summary {
  flex-shrink: 0;
  color: var(--demo-text-muted);
  font-family: var(--font-mono);
  font-size: 10.5px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.rack__summary.is-warn {
  color: var(--demo-warn-text);
}

.rack__tag {
  color: var(--demo-text-faint);
  font-family: var(--font-mono);
  font-size: 9px;
  text-transform: uppercase;
}

.rack__power {
  display: grid;
  place-items: center;
  width: 20px;
  height: 20px;
  padding: 0;
  border: 1px solid var(--demo-border-strong);
  border-radius: 50%;
  background: transparent;
  cursor: pointer;
}

.rack__power span {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--demo-text-faint);
}

.rack__power[aria-pressed='true'] {
  border-color: color-mix(in srgb, var(--demo-success) 55%, var(--demo-border));
}

.rack__power[aria-pressed='true'] span {
  background: var(--demo-success);
}

.rack__power--fixed {
  border-style: dashed;
  cursor: default;
}

.rack__power:disabled {
  opacity: var(--demo-disabled-opacity);
  cursor: not-allowed;
}

.rack__foot {
  border-top: 1px solid var(--demo-border);
}

.rack__row :deep(.rack__gr) {
  width: 72px;
}

.rack__foot :deep(.gr-meter) {
  flex: 1;
}

.rack__foot-label {
  color: var(--demo-text-muted);
  font-family: var(--font-mono);
  font-size: 10px;
  font-variant-numeric: tabular-nums;
}

@media (prefers-reduced-motion: reduce) {
  .rack__row {
    transition: none;
  }
}
</style>
