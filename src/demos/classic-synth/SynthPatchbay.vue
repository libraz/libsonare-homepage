<script setup lang="ts">
/**
 * The patchbay: a source × destination grid over the shared voice, with the
 * depth of every routing beside it. It is a deck module, so it lives in a cell
 * of fixed height and scrolls inside that cell rather than growing it.
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
      label: 'Patchbay',
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
      depthLabel: (source: string, dest: string) => `Depth, ${source} to ${dest}`,
      clear: 'Clear',
      clearNamed: (source: string, dest: string) => `Clear ${source} to ${dest}`,
      fix: (field: string, value: string) => `${field} → ${value}`,
      resonanceFloor: (q: string) =>
        `Resonance cannot go below the patch’s own resonance (now ${q}); from a low setting, negative depth has nothing to take away.`,
      unreachable: 'This voice cannot reach this destination; the routing renders no difference.',
    },
    ja: {
      label: 'パッチベイ',
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
  <div class="cs-patchbay">
    <div class="cs-pb__head">
      <h3 class="cs-card__label cs-pb__label">{{ copy.label }}</h3>
      <span class="cs-pb__count" aria-live="polite">{{ copy.count(routings.length) }}</span>
    </div>

    <div class="cs-pb__body">
      <div class="cs-pb__scroll">
        <table class="cs-pb__grid" :aria-label="copy.gridLabel">
          <thead>
            <tr>
              <th scope="col" class="cs-pb__corner">
                <span class="cs-pb__sr">{{ copy.corner }}</span>
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
                  class="cs-pb__dot"
                  :class="{
                    'cs-pb__dot--on': cell.index >= 0,
                    'cs-pb__dot--selected': cell.index >= 0 && cell.index === selected,
                    'cs-pb__dot--blocked': cell.blocked,
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
              <span v-if="row.value !== null" class="cs-param__value">{{ row.value }}</span>
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
              class="cs-param__slider"
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
</template>

<style scoped>
/*
 * The module fills its deck cell and never grows it: the head takes its own
 * height, and the body below splits the rest between the grid and the routing
 * list, each of which scrolls on its own.
 */
.cs-patchbay {
  display: flex;
  flex-direction: column;
  gap: 8px;
  block-size: 100%;
  min-block-size: 0;
  container-type: inline-size;
}

.cs-pb__head {
  display: flex;
  flex: 0 0 auto;
  gap: 12px;
  align-items: center;
}

.cs-pb__label {
  flex: 1 1 auto;
  margin: 0;
}

.cs-pb__count {
  flex: 0 0 auto;
  color: var(--demo-text-muted);
  font-family: var(--demo-font-mono, monospace);
  font-size: 0.7rem;
  font-variant-numeric: tabular-nums;
}

.cs-pb__body {
  display: grid;
  flex: 1 1 auto;
  grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
  gap: 10px;
  min-block-size: 0;
}

/* Below the width where grid and list can share a row, they stack and split the height. */
@container (max-width: 42rem) {
  .cs-pb__body {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: minmax(0, 3fr) minmax(0, 2fr);
  }
}

/* ---- grid ---------------------------------------------------------------- */

/*
 * Twelve rows by eight columns fits neither the width nor the height of the
 * cell. The body scrolls both ways; the header row and the source column stay
 * put so a reader always knows which cell they are on.
 */
.cs-pb__scroll {
  min-block-size: 0;
  overflow: auto;
  border: 1px solid var(--demo-border);
  border-radius: 7px;
  background: var(--demo-control-bg);
}

.cs-pb__grid {
  inline-size: 100%;
  min-inline-size: 30rem;
  border-collapse: separate;
  border-spacing: 0;
  font-size: 0.68rem;
}

.cs-pb__grid th {
  font-weight: 500;
  text-align: start;
}

.cs-pb__grid thead th {
  position: sticky;
  inset-block-start: 0;
  z-index: 2;
  background: var(--demo-control-bg);
}

.cs-pb__corner,
.cs-pb__row {
  position: sticky;
  inset-inline-start: 0;
  z-index: 1;
  inline-size: 6.5rem;
  min-inline-size: 6.5rem;
  padding: 4px 8px;
  border-inline-end: 1px solid var(--demo-border);
  background: var(--demo-control-bg);
}

.cs-pb__grid thead .cs-pb__corner {
  z-index: 3;
}

.cs-pb__col {
  min-inline-size: 3.4rem;
  padding: 6px 3px 5px;
  border-block-end: 1px solid var(--demo-border);
  color: var(--demo-text);
  line-height: 1.3;
  text-align: center;
  vertical-align: bottom;
}

.cs-pb__col-name {
  display: block;
  hyphens: auto;
}

.cs-pb__col--silent .cs-pb__col-name {
  color: var(--demo-warn-text);
}

.cs-pb__badge {
  display: inline-block;
  margin-block-start: 2px;
  padding: 0 5px;
  border: 1px solid var(--demo-warn-border);
  border-radius: 4px;
  background: var(--demo-warn-bg);
  color: var(--demo-warn-text);
  font-size: 0.58rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.cs-pb__row-name {
  display: block;
  color: var(--demo-text);
}

.cs-pb__row-note {
  display: block;
  color: var(--demo-text-faint);
  font-size: 0.58rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.cs-pb__cell {
  padding: 2px;
  text-align: center;
}

.cs-pb__cell--silent {
  background: var(--demo-warn-bg);
}

.cs-pb__dot {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  inline-size: 100%;
  min-inline-size: 26px;
  block-size: 26px;
  padding: 0;
  border: 1px solid var(--demo-border);
  border-radius: 5px;
  background: var(--demo-bg-elevated);
  color: var(--demo-on-accent);
  font-family: var(--demo-font-mono, monospace);
  font-size: 0.78rem;
  line-height: 1;
  cursor: pointer;
  transition: background 0.12s ease, border-color 0.12s ease, box-shadow 0.12s ease;
}

.cs-pb__dot:hover:not(.cs-pb__dot--blocked) {
  border-color: var(--demo-border-strong);
}

.cs-pb__dot:focus-visible {
  outline: 2px solid var(--demo-accent);
  outline-offset: 1px;
}

.cs-pb__dot--on {
  border-color: var(--demo-accent-border);
  background: var(--demo-accent);
}

.cs-pb__cell--silent .cs-pb__dot--on {
  border-color: var(--demo-warn-border);
  background: var(--demo-warn);
}

.cs-pb__dot--selected {
  box-shadow:
    0 0 0 2px var(--demo-bg-elevated),
    0 0 0 4px var(--demo-accent);
}

.cs-pb__dot--blocked {
  opacity: var(--demo-disabled-opacity, 0.45);
  cursor: not-allowed;
}

.cs-pb__sr {
  position: absolute;
  inline-size: 1px;
  block-size: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}

/* ---- side: cap, requirements, routings ----------------------------------- */

.cs-pb__side {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-block-size: 0;
  overflow-y: auto;
  padding-inline-end: 2px;
}

.cs-pb__notice {
  flex: 0 0 auto;
  margin: 0;
  padding: 6px 10px;
  border: 1px solid var(--demo-warn-border);
  border-radius: 6px;
  background: var(--demo-warn-bg);
  color: var(--demo-warn-text);
  font-size: 0.72rem;
  line-height: 1.5;
}

.cs-pb__requirements {
  display: grid;
  flex: 0 0 auto;
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
  font-size: 0.7rem;
}

.cs-pb__empty {
  margin: 0;
  color: var(--demo-text-muted);
  font-size: 0.76rem;
}

.cs-pb__routings {
  display: grid;
  flex: 0 0 auto;
  gap: 4px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.cs-pb__route {
  padding: 5px 8px 7px;
  border: 1px solid var(--demo-border);
  border-radius: 6px;
  background: var(--demo-control-bg);
}

.cs-pb__route--on {
  border-color: var(--demo-accent-border);
  background: var(--demo-accent-subtle);
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
  color: var(--demo-text);
  font-family: inherit;
  font-size: 0.74rem;
  text-align: start;
  cursor: pointer;
}

.cs-pb__route-name:focus-visible {
  border-radius: 3px;
  outline: 2px solid var(--demo-accent);
  outline-offset: 2px;
}

.cs-pb__arrow {
  margin-inline: 4px;
  color: var(--demo-text-faint);
}

.cs-pb__clear {
  padding: 3px 8px;
  font-size: 0.68rem;
}

.cs-pb__route .cs-param__slider {
  display: block;
  margin-block-start: 3px;
}

.cs-pb__route-note {
  margin: 3px 0 0;
  color: var(--demo-text-muted);
  font-size: 0.7rem;
  line-height: 1.5;
}

.cs-pb__route-note--silent {
  color: var(--demo-warn-text);
}

@media (prefers-reduced-motion: reduce) {
  .cs-pb__dot {
    transition: none;
  }
}
</style>
