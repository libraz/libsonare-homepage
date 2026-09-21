<script setup lang="ts">
/**
 * The mastering chain as one rail: every slot the engine can run, in the
 * order it runs them.
 *
 * Reading order is signal order — left to right, then on to the next row.
 * Slots sit in family strips, and the repair strip is the one people ask
 * about: whatever subset is on, it runs declip, declick, decrackle, dehum,
 * denoise, dereverb, in that order. Filled slots are the ones the given
 * configuration enabled; the rest are still there, in place, and a preset
 * only decides which of them run — never where.
 */
import { computed } from 'vue';
import FigureFrame, { type FigureLegendItem } from './FigureFrame.vue';

const props = withDefaults(
  defineProps<{
    title?: string;
    caption?: string;
    /** Stage ids drawn as enabled, spelled as `MasteringChainResult.stages` reports them. */
    enabled?: string[];
    labels?: Partial<Record<Key, string>>;
  }>(),
  {
    enabled: () => [
      'repair.denoise',
      'repair.dereverb',
      'eq.tilt',
      'dynamics.compressor',
      'spectral.airBand',
      'stereo.imager',
      'stereo.monoMaker',
      'maximizer.truePeakLimiter',
      'loudness.optimize',
    ],
  },
);

type FamilyKey =
  | 'repair'
  | 'eq'
  | 'dynamics'
  | 'saturation'
  | 'spectral'
  | 'stereo'
  | 'maximizer'
  | 'loudness';

type Key = FamilyKey | 'output' | 'enabled' | 'available' | 'fixedOrder';

const DEFAULTS: Record<Key, string> = {
  repair: 'repair',
  eq: 'eq',
  dynamics: 'dynamics',
  saturation: 'saturation',
  spectral: 'spectral',
  stereo: 'stereo',
  maximizer: 'maximizer',
  loudness: 'loudness',
  output: 'output',
  enabled: 'enabled in this configuration',
  available: 'available, not enabled',
  fixedOrder: 'The order is fixed. A configuration chooses which slots run, never where.',
};

const label = (key: Key) => props.labels?.[key] ?? DEFAULTS[key];

const legend = computed<FigureLegendItem[]>(() => [
  { series: 1, shape: 'block', label: label('enabled') },
  { series: 0, shape: 'block', label: label('available') },
]);

/** Every slot per family, in engine run order; ids are the engine's own stage names. */
const CHAIN: Record<FamilyKey, string[]> = {
  repair: ['declip', 'declick', 'decrackle', 'dehum', 'denoise', 'dereverb'],
  eq: ['tilt'],
  dynamics: ['deesser', 'transientShaper', 'compressor', 'multibandComp'],
  saturation: ['tape', 'exciter'],
  spectral: ['airBand'],
  stereo: ['imager', 'monoMaker'],
  maximizer: ['truePeakLimiter'],
  loudness: ['optimize'],
};

/** Row breaks keep each family whole; families run left to right, rows top to bottom. */
const ROWS: FamilyKey[][] = [
  ['repair'],
  ['eq', 'dynamics'],
  ['saturation', 'spectral', 'stereo'],
  ['maximizer', 'loudness'],
];

const X0 = 12;
const SPINE_X = 5;
const TURN = 6;
const ROW0_TOP = 22;
const ROW_PITCH = 74;
// 100 px holds a 15-character id at 10 px mono, or ten CJK characters of heading.
const SLOT_W = 100;
const SLOT_H = 26;
const SLOT_GAP = 2;
const PLATE_PAD = 4;
const PLATE_H = SLOT_H + 2 * PLATE_PAD;
const FAMILY_GAP = 14;
const H = ROW0_TOP + (ROWS.length - 1) * ROW_PITCH + PLATE_H + 36;
const NOTE_Y = H - 12;

/** Arrowhead with its tip at (x, y), pointing right. */
const chevron = (x: number, y: number) => `M ${x - 4} ${y - 3.5} L ${x} ${y} L ${x - 4} ${y + 3.5}`;

const geom = computed(() => {
  const on = new Set(props.enabled);
  const rows = ROWS.map((families, r) => {
    const plateTop = ROW0_TOP + r * ROW_PITCH;
    const yMid = plateTop + PLATE_H / 2;
    let cursor = X0;
    const plates = families.map((family) => {
      const ids = CHAIN[family];
      const x = cursor;
      const w = ids.length * SLOT_W + (ids.length - 1) * SLOT_GAP + 2 * PLATE_PAD;
      const slots = ids.map((id, i) => ({
        id,
        x: x + PLATE_PAD + i * (SLOT_W + SLOT_GAP),
        on: on.has(`${family}.${id}`),
      }));
      cursor = x + w + FAMILY_GAP;
      return { family, x, w, slots };
    });
    return { plateTop, yMid, plates, xEnd: cursor - FAMILY_GAP };
  });

  const joins = rows.flatMap((row) =>
    row.plates.slice(1).map((p, i) => ({
      d: `M ${row.plates[i].x + row.plates[i].w} ${row.yMid} H ${p.x} ${chevron(p.x, row.yMid)}`,
    })),
  );

  // Carriage return: out the right end, along the row gap, down the left spine, into the next row.
  const returns = rows.slice(0, -1).map((row, r) => {
    const next = rows[r + 1];
    const yRun = row.plateTop + PLATE_H + (ROW_PITCH - PLATE_H) / 2;
    return {
      d: `M ${row.xEnd} ${row.yMid} H ${row.xEnd + TURN} V ${yRun} H ${SPINE_X} V ${next.yMid} H ${X0} ${chevron(X0, next.yMid)}`,
    };
  });

  const first = rows[0];
  const last = rows[rows.length - 1];
  return {
    rows,
    joins,
    returns,
    entry: `M ${SPINE_X} ${first.yMid} H ${X0} ${chevron(X0, first.yMid)}`,
    exit: `M ${last.xEnd} ${last.yMid} H ${last.xEnd + 16} ${chevron(last.xEnd + 16, last.yMid)}`,
    outputX: last.xEnd + 22,
    outputY: last.yMid,
  };
});
</script>

<template>
  <FigureFrame
    :title="props.title"
    :caption="props.caption"
    :view-box="`0 0 640 ${H}`"
    :width="640"
    :legend="legend"
  >
    <!-- Signal rail -->
    <path class="fx-axis" :d="geom.entry" />
    <path v-for="(j, i) in geom.joins" :key="`join-${i}`" class="fx-axis" :d="j.d" />
    <path v-for="(r, i) in geom.returns" :key="`ret-${i}`" class="fx-axis" :d="r.d" />
    <path class="fx-axis" :d="geom.exit" />
    <text class="fx-axis-label" :x="geom.outputX" :y="geom.outputY" dy="0.35em">
      {{ label('output') }}
    </text>

    <!-- Family strips and their slots -->
    <g v-for="(row, r) in geom.rows" :key="`row-${r}`">
      <g v-for="p in row.plates" :key="p.family">
        <rect class="fx-lane" :x="p.x" :y="row.plateTop" :width="p.w" :height="PLATE_H" rx="5" />
        <text class="fx-axis-label" :x="p.x + 2" :y="row.plateTop - 6">{{ label(p.family) }}</text>
        <g v-for="s in p.slots" :key="`${p.family}.${s.id}`">
          <rect
            :class="s.on ? 'fx-block' : 'fx-block fx-block--muted'"
            :x="s.x"
            :y="row.plateTop + PLATE_PAD"
            :width="SLOT_W"
            :height="SLOT_H"
            rx="3"
          />
          <text class="fx-value" :x="s.x + SLOT_W / 2" :y="row.yMid" dy="0.35em" text-anchor="middle">
            {{ s.id }}
          </text>
        </g>
      </g>
    </g>

    <text class="fx-note" :x="X0" :y="NOTE_Y">{{ label('fixedOrder') }}</text>
  </FigureFrame>
</template>
