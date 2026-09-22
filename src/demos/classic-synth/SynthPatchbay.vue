<script setup lang="ts">
/**
 * The assign block: a source × destination grid over the shared voice, with the
 * depth of every routing beside it. Closed, it shows its legend, its routing
 * count and one line per routing; open, the whole grid. The page owns `open`
 * so the modulation chapter can raise it, and it stays where the reader last
 * left it otherwise.
 *
 * The grid has no `'none'` row or column, because the engine accepts a routing
 * from nowhere and renders no difference — a half-made routing must be
 * impossible to draw, not merely warned about. And a cell blocked by the
 * eight-routing cap keeps `aria-disabled` rather than `disabled`, so the reason
 * stays focusable and readable instead of the cell silently dropping out of the
 * tab order.
 */
import { computed, ref, watch } from 'vue';
import { useI18n } from '@/composables/useI18n';
import type { SynthModRouting } from '@/wasm/index';
import {
  formatValue,
  MOD_DESTINATION_NAMES,
  MOD_SOURCE_NAMES,
  PARAM_NAMES,
  REQUIREMENT_NOTES,
} from './classicSynthCopy';
import {
  type ClassicPatch,
  MAX_MOD_ROUTINGS,
  MOD_DESTINATIONS,
  MOD_SOURCES,
  type ModDestination,
  type ModDestinationName,
  type ModRequirement,
  type ModSourceName,
  unmetRequirement,
} from './classicSynthState';

const props = defineProps<{
  patch: ClassicPatch;
}>();

const emit = defineEmits<{
  /** Set fields on the shared voice: modRoutings, or the field a requirement fix needs. */
  update: [change: Partial<ClassicPatch>];
}>();

/** Whether the grid is unfolded. The page raises it on the modulation chapter. */
const open = defineModel<boolean>('open', { default: false });

const { isLocale, localizedValue } = useI18n();
const ja = computed(() => isLocale('ja'));

/** The field each requirement is satisfied through, and the value the fix sets. */
const REQUIREMENT_FIX: Readonly<
  Record<ModRequirement, { key: 'envToCutoffCents' | 'lfoToPitchCents'; value: number }>
> = {
  'filter-env': { key: 'envToCutoffCents', value: 2400 },
  'lfo1-audible': { key: 'lfoToPitchCents', value: 30 },
};

/** The two sources the voice answers only through the matrix. */
const MATRIX_ONLY_SOURCES: readonly ModSourceName[] = ['breath', 'aftertouch'];

const copy = computed(() =>
  localizedValue({
    en: {
      label: 'Assign',
      blockLabel: 'Mod matrix',
      open: 'Open',
      close: 'Close',
      gridLabel: 'Modulation matrix: sources by destinations',
      corner: 'Source → Destination',
      matrixOnly: 'matrix only',
      silent: 'silent',
      count: (n: number) => `${n} / ${MAX_MOD_ROUTINGS} routings`,
      capReached: 'Eight routings is the engine’s limit at bounce time. Clear one to add another.',
      cellRouted: (source: string, dest: string, depth: string) =>
        `${source} to ${dest}: routed, ${depth}`,
      cellEmpty: (source: string, dest: string) => `${source} to ${dest}: no routing`,
      cellFull: ', matrix full',
      cellSilent: ', destination silent until fixed',
      routings: 'Routings',
      none: 'No routings. Click a cell to add one.',
      noneClosed: 'No routings. Open the matrix to add one.',
      depthLabel: (source: string, dest: string) => `Depth, ${source} to ${dest}`,
      clear: 'Clear',
      clearNamed: (source: string, dest: string) => `Clear ${source} to ${dest}`,
      fix: (field: string, value: string) => `${field} → ${value}`,
      resonanceFloor: (q: string) =>
        `Resonance cannot go below the patch’s own resonance (now ${q}); from a low setting, negative depth has nothing to take away.`,
      unreachable: 'This voice cannot reach this destination; the routing renders no difference.',
    },
    ja: {
      label: 'Assign',
      blockLabel: 'モジュレーション行列',
      open: '開く',
      close: '閉じる',
      gridLabel: 'モジュレーション行列：ソース × デスティネーション',
      corner: 'ソース → デスティネーション',
      matrixOnly: '行列のみ',
      silent: '無音',
      count: (n: number) => `結線 ${n} / ${MAX_MOD_ROUTINGS}`,
      capReached:
        '結線は 8 本まで。エンジンがバウンス時に受け付ける上限です。追加するには 1 本消してください。',
      cellRouted: (source: string, dest: string, depth: string) =>
        `${source} → ${dest}：結線あり、${depth}`,
      cellEmpty: (source: string, dest: string) => `${source} → ${dest}：結線なし`,
      cellFull: '、行列は満杯',
      cellSilent: '、デスティネーションは設定まで無音',
      routings: '結線',
      none: '結線はありません。セルを押すと追加できます。',
      noneClosed: '結線はありません。行列を開くと追加できます。',
      depthLabel: (source: string, dest: string) => `深さ、${source} → ${dest}`,
      clear: '消す',
      clearNamed: (source: string, dest: string) => `${source} → ${dest} を消す`,
      fix: (field: string, value: string) => `${field} → ${value}`,
      resonanceFloor: (q: string) =>
        `レゾナンスはパッチ自身の値（現在 ${q}）より下には下がりません。低い設定からの負の深さには、削るものがありません。`,
      unreachable:
        'このボイスからは届かないデスティネーションです。結線してもレンダリングは変わりません。',
    },
  }),
);

function sourceName(source: SynthModRouting['source']): string {
  const name = MOD_SOURCE_NAMES[source as ModSourceName];
  if (!name) return String(source);
  return ja.value ? name.ja : name.en;
}

function destinationName(destination: SynthModRouting['destination']): string {
  const name = MOD_DESTINATION_NAMES[destination as ModDestinationName];
  if (!name) return String(destination);
  return ja.value ? name.ja : name.en;
}

function fieldName(key: keyof typeof PARAM_NAMES): string {
  return ja.value ? PARAM_NAMES[key].ja : PARAM_NAMES[key].en;
}

function requirementNote(requirement: ModRequirement): string {
  const note = REQUIREMENT_NOTES[requirement];
  return ja.value ? note.ja : note.en;
}

function fixLabel(requirement: ModRequirement): string {
  const fix = REQUIREMENT_FIX[requirement];
  return copy.value.fix(fieldName(fix.key), formatValue(fix.value, 'cents'));
}

const routings = computed(() => props.patch.modRoutings);
const full = computed(() => routings.value.length >= MAX_MOD_ROUTINGS);

/** Which routing the depth editor is on. Cleared when the routing goes away. */
const selected = ref<number | null>(null);
watch(
  () => routings.value.length,
  (length) => {
    if (selected.value !== null && selected.value >= length) selected.value = null;
  },
);

function destinationFor(routing: SynthModRouting): ModDestination | null {
  return MOD_DESTINATIONS.find((candidate) => candidate.key === routing.destination) ?? null;
}

/* ---- grid ---------------------------------------------------------------- */

interface Column extends ModDestination {
  name: string;
  unmet: ModRequirement | null;
}

const columns = computed<Column[]>(() =>
  MOD_DESTINATIONS.map((destination) => ({
    ...destination,
    name: destinationName(destination.key),
    unmet: unmetRequirement(props.patch, destination),
  })),
);

const unmetColumns = computed(() => columns.value.filter((column) => column.unmet !== null));

/** Index of the routing at a cell, or -1. */
const cellIndex = computed(() => {
  const map = new Map<string, number>();
  routings.value.forEach((routing, index) => {
    map.set(`${routing.source}>${routing.destination}`, index);
  });
  return (source: ModSourceName, destination: ModDestinationName) =>
    map.get(`${source}>${destination}`) ?? -1;
});

interface Cell {
  column: Column;
  index: number;
  blocked: boolean;
  label: string;
  /** '+' or '−' for a filled cell, so a negative routing reads at a glance. */
  mark: string | null;
}

function cellLabel(source: ModSourceName, column: Column, index: number, blocked: boolean) {
  const sourceLabel = sourceName(source);
  let label =
    index >= 0
      ? copy.value.cellRouted(
          sourceLabel,
          column.name,
          formatValue(routings.value[index].depth, column.unit),
        )
      : copy.value.cellEmpty(sourceLabel, column.name);
  if (blocked) label += copy.value.cellFull;
  if (column.unmet) label += copy.value.cellSilent;
  return label;
}

const gridRows = computed(() =>
  MOD_SOURCES.map((source) => ({
    source,
    name: sourceName(source),
    matrixOnly: MATRIX_ONLY_SOURCES.includes(source),
    cells: columns.value.map((column): Cell => {
      const index = cellIndex.value(source, column.key);
      const blocked = index < 0 && full.value;
      const depth = index >= 0 ? routings.value[index].depth : null;
      return {
        column,
        index,
        blocked,
        label: cellLabel(source, column, index, blocked),
        mark: depth === null ? null : depth < 0 ? '−' : '+',
      };
    }),
  })),
);

function roundToStep(value: number, step: number): number {
  return Number((Math.round(value / step) * step).toFixed(6));
}

/** A quarter of the positive range: audible on every destination, extreme on none. */
function defaultDepth(destination: ModDestination): number {
  return roundToStep(destination.max / 4, destination.step);
}

function cloneRoutings(): SynthModRouting[] {
  return routings.value.map((routing) => ({ ...routing }));
}

function pressCell(source: ModSourceName, cell: Cell) {
  if (cell.index >= 0) {
    selected.value = cell.index;
    return;
  }
  if (cell.blocked) return;
  const next = cloneRoutings();
  next.push({ source, destination: cell.column.key, depth: defaultDepth(cell.column) });
  emit('update', { modRoutings: next });
  selected.value = next.length - 1;
}

function fixRequirement(requirement: ModRequirement) {
  const fix = REQUIREMENT_FIX[requirement];
  const change: Partial<ClassicPatch> = {};
  change[fix.key] = fix.value;
  emit('update', change);
}

/* ---- routing list -------------------------------------------------------- */

const routeRows = computed(() =>
  routings.value.map((routing, index) => {
    const destination = destinationFor(routing);
    const sourceLabel = sourceName(routing.source);
    const destinationLabel = destinationName(routing.destination);
    return {
      index,
      routing,
      destination,
      sourceLabel,
      destinationLabel,
      value: destination ? formatValue(routing.depth, destination.unit) : null,
      unmet: destination ? unmetRequirement(props.patch, destination) : null,
      resonanceFloor: routing.destination === 'resonance-q' && routing.depth < 0,
      depthLabel: copy.value.depthLabel(sourceLabel, destinationLabel),
      clearLabel: copy.value.clearNamed(sourceLabel, destinationLabel),
    };
  }),
);

function setDepth(index: number, raw: number) {
  const routing = routings.value[index];
  const destination = routing ? destinationFor(routing) : null;
  if (!routing || !destination || !Number.isFinite(raw)) return;
  const next = cloneRoutings();
  next[index] = {
    ...next[index],
    depth: Math.min(destination.max, Math.max(destination.min, raw)),
  };
  emit('update', { modRoutings: next });
}

function removeRouting(index: number) {
  const next = cloneRoutings();
  next.splice(index, 1);
  emit('update', { modRoutings: next });
  if (selected.value === index) selected.value = null;
  else if (selected.value !== null && selected.value > index) selected.value -= 1;
}
</script>

<template>
  <div class="cs-patchbay" :class="{ 'cs-patchbay--open': open }" :aria-label="copy.blockLabel">
    <header class="cs-block__head cs-pb__head">
      <span class="cs-lamp" aria-hidden="true" />
      <h3 class="cs-legend">{{ copy.label }}</h3>
      <span class="cs-pb__count" aria-live="polite">{{ copy.count(routings.length) }}</span>
      <button
        type="button"
        class="cs-key cs-key--inline cs-pb__toggle"
        :class="{ 'cs-key--on': open }"
        :aria-expanded="open"
        aria-controls="cs-pb-body"
        @click="open = !open"
      >
        <span class="cs-key__lamp" aria-hidden="true" />
        <span class="cs-key__text">{{ open ? copy.close : copy.open }}</span>
      </button>
    </header>

    <div id="cs-pb-body" class="cs-pb__fold">
      <!-- Closed: one printed line per routing, the way a panel lists its assignments. -->
      <ul v-if="!open" class="cs-pb__brief" :aria-label="copy.routings">
        <li v-if="!routeRows.length" class="cs-pb__brief-empty">{{ copy.noneClosed }}</li>
        <li
          v-for="row in routeRows"
          :key="`${row.index}:${row.routing.source}>${row.routing.destination}`"
          class="cs-pb__brief-row"
        >
          <span class="cs-pb__brief-name">
            {{ row.sourceLabel }}
            <span class="cs-pb__arrow" aria-hidden="true">→</span>
            {{ row.destinationLabel }}
          </span>
          <span v-if="row.value !== null" class="cs-pb__brief-value">{{ row.value }}</span>
        </li>
      </ul>

      <div v-else class="cs-pb__body">
        <div class="cs-pb__scroll">
          <table class="cs-pb__grid" :aria-label="copy.gridLabel">
            <thead>
              <tr>
                <th scope="col" class="cs-pb__corner">
                  <span class="cs-sr">{{ copy.corner }}</span>
                </th>
                <th
                  v-for="column in columns"
                  :key="column.key"
                  scope="col"
                  class="cs-pb__col"
                  :class="{ 'cs-pb__col--silent': column.unmet }"
                  :aria-describedby="column.unmet ? `cs-pb-req-${column.key}` : undefined"
                >
                  <span class="cs-pb__col-name">{{ column.name }}</span>
                  <span v-if="column.unmet" class="cs-pb__badge">{{ copy.silent }}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in gridRows" :key="row.source">
                <th scope="row" class="cs-pb__row">
                  <span class="cs-pb__row-name">{{ row.name }}</span>
                  <span v-if="row.matrixOnly" class="cs-pb__row-note">{{ copy.matrixOnly }}</span>
                </th>
                <td
                  v-for="cell in row.cells"
                  :key="cell.column.key"
                  class="cs-pb__cell"
                  :class="{ 'cs-pb__cell--silent': cell.column.unmet }"
                >
                  <button
                    type="button"
                    class="cs-pb__pin"
                    :class="{
                      'cs-pb__pin--on': cell.index >= 0,
                      'cs-pb__pin--selected': cell.index >= 0 && cell.index === selected,
                      'cs-pb__pin--blocked': cell.blocked,
                    }"
                    :aria-label="cell.label"
                    :aria-disabled="cell.blocked ? 'true' : undefined"
                    :aria-describedby="cell.blocked ? 'cs-pb-cap' : undefined"
                    @click="pressCell(row.source, cell)"
                  >
                    <span v-if="cell.mark" aria-hidden="true">{{ cell.mark }}</span>
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="cs-pb__side" :aria-label="copy.routings">
          <p v-if="full" id="cs-pb-cap" class="cs-pb__notice" role="status">{{ copy.capReached }}</p>

          <ul v-if="unmetColumns.length" class="cs-pb__requirements">
            <li
              v-for="column in unmetColumns"
              :id="`cs-pb-req-${column.key}`"
              :key="column.key"
              class="cs-pb__notice cs-pb__requirement"
            >
              <span class="cs-pb__requirement-text">
                <b>{{ column.name }}</b> — {{ requirementNote(column.unmet as ModRequirement) }}
              </span>
              <button
                type="button"
                class="cs-button cs-pb__fix"
                @click="fixRequirement(column.unmet as ModRequirement)"
              >
                {{ fixLabel(column.unmet as ModRequirement) }}
              </button>
            </li>
          </ul>

          <p v-if="!routeRows.length" class="cs-pb__empty">{{ copy.none }}</p>
          <ul v-else class="cs-pb__routings">
            <li
              v-for="row in routeRows"
              :key="`${row.index}:${row.routing.source}>${row.routing.destination}`"
              class="cs-pb__route"
              :class="{ 'cs-pb__route--on': row.index === selected }"
            >
              <div class="cs-pb__route-head">
                <button type="button" class="cs-pb__route-name" @click="selected = row.index">
                  {{ row.sourceLabel }}
                  <span class="cs-pb__arrow" aria-hidden="true">→</span>
                  {{ row.destinationLabel }}
                </button>
                <span v-if="row.value !== null" class="cs-pb__value">{{ row.value }}</span>
                <button
                  type="button"
                  class="cs-button cs-pb__clear"
                  :aria-label="row.clearLabel"
                  @click="removeRouting(row.index)"
                >
                  {{ copy.clear }}
                </button>
              </div>
              <input
                v-if="row.destination"
                type="range"
                class="cs-pb__depth"
                :min="row.destination.min"
                :max="row.destination.max"
                :step="row.destination.step"
                :value="row.routing.depth"
                :aria-label="row.depthLabel"
                :aria-valuetext="row.value ?? undefined"
                @input="setDepth(row.index, Number(($event.target as HTMLInputElement).value))"
                @focus="selected = row.index"
              />
              <p v-else class="cs-pb__route-note">{{ copy.unreachable }}</p>
              <p v-if="row.unmet" class="cs-pb__route-note cs-pb__route-note--silent">
                {{ requirementNote(row.unmet) }}
              </p>
              <p v-if="row.resonanceFloor" class="cs-pb__route-note">
                {{ copy.resonanceFloor(formatValue(patch.resonanceQ, 'ratio')) }}
              </p>
            </li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cs-patchbay {
  display: flex;
  flex-direction: column;
  min-inline-size: 0;
  container-type: inline-size;
}

.cs-pb__head {
  gap: 10px;
}

.cs-pb__count {
  flex: 1 1 auto;
  color: var(--plate-ink-dim);
  font-family: var(--font-mono);
  font-size: var(--plate-value-size);
  font-variant-numeric: tabular-nums;
  text-align: end;
}

.cs-pb__toggle {
  flex: 0 0 auto;
  min-inline-size: 4.5rem;
  margin-inline-end: -4px;
}

.cs-pb__fold {
  padding: 10px 12px 12px;
}

/* ---- closed: the printed assignment list --------------------------------- */

.cs-pb__brief {
  display: grid;
  gap: 4px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.cs-pb__brief-empty,
.cs-pb__brief-row {
  display: flex;
  gap: 10px;
  align-items: baseline;
  justify-content: space-between;
  min-inline-size: 0;
  color: var(--plate-ink-dim);
  font-size: 0.74rem;
  line-height: 1.5;
}

.cs-pb__brief-name {
  min-inline-size: 0;
  overflow: hidden;
  color: var(--plate-ink);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cs-pb__brief-value,
.cs-pb__value {
  flex: 0 0 auto;
  color: var(--plate-ink);
  font-family: var(--font-mono);
  font-size: 0.7rem;
  font-variant-numeric: tabular-nums;
}

/* ---- open: grid beside the routing list ---------------------------------- */

.cs-pb__body {
  display: grid;
  grid-template-columns: minmax(0, 3fr) minmax(0, 2fr);
  gap: 12px;
  min-block-size: 0;
}

/* Below the width where grid and list can share a row, they stack. */
@container (max-width: 44rem) {
  .cs-pb__body {
    grid-template-columns: minmax(0, 1fr);
  }
}

/*
 * Twelve rows by eight columns is wider than the block at most sizes. The body
 * scrolls sideways; the source column stays put so a reader always knows which
 * row they are on.
 */
.cs-pb__scroll {
  overflow: auto;
  border: 1px solid var(--plate-groove);
  border-radius: 3px;
  background: var(--plate-recess);
  box-shadow: inset 0 1px 3px var(--plate-groove);
}

.cs-pb__grid {
  inline-size: 100%;
  min-inline-size: 26rem;
  border-collapse: separate;
  border-spacing: 0;
  font-size: 0.66rem;
}

.cs-pb__grid th {
  font-weight: 500;
  text-align: start;
}

.cs-pb__grid thead th {
  position: sticky;
  inset-block-start: 0;
  z-index: 2;
  background: var(--plate-recess-solid);
}

.cs-pb__corner,
.cs-pb__row {
  position: sticky;
  inset-inline-start: 0;
  z-index: 1;
  inline-size: 5.75rem;
  min-inline-size: 5.75rem;
  padding: 3px 8px;
  border-inline-end: 1px solid var(--plate-groove);
  background: var(--plate-recess-solid);
}

.cs-pb__grid thead .cs-pb__corner {
  z-index: 3;
}

.cs-pb__col {
  min-inline-size: 2.8rem;
  padding: 6px 2px 5px;
  border-block-end: 1px solid var(--plate-groove);
  color: var(--plate-ink-dim);
  font-family: var(--font-mono);
  font-size: 0.58rem;
  letter-spacing: 0.04em;
  line-height: 1.3;
  text-align: center;
  text-transform: uppercase;
  vertical-align: bottom;
}

.cs-pb__col-name {
  display: block;
  hyphens: auto;
}

.cs-pb__col--silent .cs-pb__col-name {
  color: var(--plate-lamp);
}

.cs-pb__badge {
  display: inline-block;
  margin-block-start: 2px;
  padding: 0 4px;
  border: 1px solid var(--plate-lamp-dim);
  border-radius: 2px;
  color: var(--plate-lamp);
  font-size: 0.55rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.cs-pb__row-name {
  display: block;
  color: var(--plate-ink);
}

.cs-pb__row-note {
  display: block;
  color: var(--plate-ink-faint);
  font-family: var(--font-mono);
  font-size: 0.55rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.cs-pb__cell {
  padding: 2px;
  text-align: center;
}

.cs-pb__cell--silent {
  background: var(--plate-lamp-tint);
}

/* A pin: a small dark key that lights when a routing is patched through it. */
.cs-pb__pin {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  inline-size: 100%;
  min-inline-size: 24px;
  block-size: 24px;
  padding: 0;
  border: 1px solid var(--plate-key-edge);
  border-radius: 2px;
  background: var(--plate-key);
  color: var(--plate-key-ink);
  font-family: var(--font-mono);
  font-size: 0.78rem;
  line-height: 1;
  cursor: pointer;
  transition: background 0.12s ease, border-color 0.12s ease, box-shadow 0.12s ease;
}

.cs-pb__pin:hover:not(.cs-pb__pin--blocked) {
  border-color: var(--plate-ink-dim);
}

.cs-pb__pin:focus-visible {
  outline: 2px solid var(--plate-focus);
  outline-offset: 1px;
}

.cs-pb__pin--on {
  border-color: var(--plate-lamp);
  background: var(--plate-lamp);
  color: var(--plate-on-lamp);
  box-shadow: 0 0 6px var(--plate-lamp-dim);
}

.cs-pb__pin--selected {
  box-shadow:
    0 0 0 2px var(--plate-recess-solid),
    0 0 0 3px var(--plate-ink);
}

.cs-pb__pin--blocked {
  opacity: var(--demo-disabled-opacity, 0.45);
  cursor: not-allowed;
}

/* ---- side: cap, requirements, routings ----------------------------------- */

.cs-pb__side {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-inline-size: 0;
}

.cs-pb__notice {
  margin: 0;
  padding: 6px 10px;
  border: 1px solid var(--plate-lamp-dim);
  border-radius: 3px;
  background: var(--plate-lamp-tint);
  color: var(--plate-ink);
  font-size: 0.72rem;
  line-height: 1.5;
}

.cs-pb__requirements {
  display: grid;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.cs-pb__requirement {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 4px 10px;
}

.cs-pb__requirement-text {
  flex: 1 1 10rem;
}

.cs-pb__fix {
  flex: 0 0 auto;
  padding: 4px 10px;
  font-size: 0.66rem;
}

.cs-pb__empty {
  margin: 0;
  color: var(--plate-ink-dim);
  font-size: 0.76rem;
}

.cs-pb__routings {
  display: grid;
  gap: 4px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.cs-pb__route {
  padding: 5px 8px 7px;
  border: 1px solid var(--plate-groove);
  border-radius: 3px;
  background: var(--plate-recess);
}

.cs-pb__route--on {
  border-color: var(--plate-lamp-dim);
}

.cs-pb__route-head {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 6px;
}

.cs-pb__route-name {
  min-inline-size: 0;
  padding: 2px 0;
  border: none;
  background: none;
  color: var(--plate-ink);
  font-family: inherit;
  font-size: 0.74rem;
  text-align: start;
  cursor: pointer;
}

.cs-pb__route-name:focus-visible {
  border-radius: 3px;
  outline: 2px solid var(--plate-focus);
  outline-offset: 2px;
}

.cs-pb__arrow {
  margin-inline: 4px;
  color: var(--plate-ink-faint);
}

.cs-pb__clear {
  padding: 3px 8px;
  font-size: 0.64rem;
}

/* Depth is the one horizontal control on the panel; it keeps the lamp colour. */
.cs-pb__depth {
  display: block;
  inline-size: 100%;
  margin-block-start: 4px;
  accent-color: var(--plate-lamp);
}

.cs-pb__depth:focus-visible {
  outline: 2px solid var(--plate-focus);
  outline-offset: 2px;
}

.cs-pb__route-note {
  margin: 3px 0 0;
  color: var(--plate-ink-dim);
  font-size: 0.7rem;
  line-height: 1.5;
}

.cs-pb__route-note--silent {
  color: var(--plate-lamp);
}

@media (prefers-reduced-motion: reduce) {
  .cs-pb__pin {
    transition: none;
  }
}
</style>

