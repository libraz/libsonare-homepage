<script setup lang="ts">
/**
 * The three displays: the output scope, the filter's measured response, and
 * the output meter.
 *
 * The filter curve is computed — the engine returns no response of its own —
 * so it is labelled as the measured response it was fitted to rather than as
 * the CUTOFF reading, which it deliberately does not follow: the audible
 * corner sits below that number, further below the lower the resonance.
 *
 * The meter is peak only. The limiter's gain reduction is not published by the
 * engine, and a display with nothing behind it would be the worse of the two.
 */
import { computed, onMounted, ref, watch } from 'vue';
import { MetricItem } from '@/components/ui';
import ScopeDisplay from '@/components/ui/ScopeDisplay.vue';
import { useCanvasRedraw } from '@/composables/useCanvasRedraw';
import { useTheme } from '@/composables/useTheme';
import { SILKSCREEN, type StepBassCopy } from '@/demos/step-bass/stepBassCopy';
import {
  CURVE_MAX_HZ,
  CURVE_MIN_HZ,
  envFilterCurve,
  envOpenCutoffHz,
  type FilterCurvePoint,
  filterCurve,
} from '@/demos/step-bass/stepBassFilterCurve';
import { amplitudeToDb, formatSampleRate } from '@/utils/audio';
import { prepareCanvas2D } from '@/utils/canvas';

const props = defineProps<{
  copy: StepBassCopy;
  analyser: AnalyserNode | null;
  cutoffHz: number;
  resonanceQ: number;
  envModCents: number;
  /** Output peak as a linear amplitude. */
  peak: number;
  sampleRate: number;
  /** All three displays stand at once; below this the switcher shows one. */
  wide: boolean;
}>();

type ViewId = 'scope' | 'filter' | 'output';

const VIEWS: { id: ViewId; legend: string }[] = [
  { id: 'scope', legend: SILKSCREEN.scope },
  { id: 'filter', legend: SILKSCREEN.filter },
  { id: 'output', legend: SILKSCREEN.output },
];

const active = ref<ViewId>('scope');

/** Wide: every display stands. Narrow: the one the switcher points at. */
function visible(id: ViewId): boolean {
  return props.wide || active.value === id;
}

// ----------------------------------------------------------- filter curve

/** Plotted magnitude window. */
const CURVE_MAX_DB = 12;
const CURVE_MIN_DB = -48;
/** Decade gridlines, and the corner the curve is read at. */
const GRID_HZ = [100, 1000, 10_000];
const CORNER_DROP_DB = 3;

const curveCanvas = ref<HTMLCanvasElement | null>(null);
const { isDark } = useTheme();

const mainCurve = computed(() => filterCurve(props.cutoffHz, props.resonanceQ));
const openCurve = computed(() =>
  props.envModCents > 0
    ? envFilterCurve(props.cutoffHz, props.resonanceQ, props.envModCents)
    : null,
);

/** Where the plotted response has fallen 3 dB from its passband. */
const cornerHz = computed(() => {
  const points = mainCurve.value;
  const passband = points[0].db;
  const found = points.find((point) => point.db <= passband - CORNER_DROP_DB);
  return found ? found.freqHz : props.cutoffHz;
});

function formatHz(hz: number): string {
  return hz >= 1000 ? `${(hz / 1000).toFixed(2)} kHz` : `${Math.round(hz)} Hz`;
}

function plotX(hz: number, width: number): number {
  return (Math.log(hz / CURVE_MIN_HZ) / Math.log(CURVE_MAX_HZ / CURVE_MIN_HZ)) * width;
}

function plotY(db: number, height: number): number {
  return ((CURVE_MAX_DB - db) / (CURVE_MAX_DB - CURVE_MIN_DB)) * height;
}

function strokeCurve(
  g: CanvasRenderingContext2D,
  points: FilterCurvePoint[],
  width: number,
  height: number,
): void {
  g.beginPath();
  points.forEach((point, index) => {
    const x = plotX(point.freqHz, width);
    const y = plotY(point.db, height);
    if (index === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  });
  g.stroke();
}

function drawCurve(): void {
  const canvas = curveCanvas.value;
  const frame = prepareCanvas2D(canvas);
  if (!canvas || !frame) return;
  const { ctx: g, width, height } = frame;
  const style = getComputedStyle(canvas);
  const accent = style.getPropertyValue('--demo-accent').trim() || '#7C3AED';
  const dashed = style.getPropertyValue('--demo-cyan').trim() || '#0891B2';
  const ink = style.color;

  g.save();
  g.strokeStyle = ink;
  g.globalAlpha = isDark.value ? 0.14 : 0.16;
  g.lineWidth = 1;
  g.beginPath();
  for (const hz of GRID_HZ) {
    const x = plotX(hz, width);
    g.moveTo(x, 0);
    g.lineTo(x, height);
  }
  for (const db of [0, -24]) {
    const y = plotY(db, height);
    g.moveTo(0, y);
    g.lineTo(width, y);
  }
  g.stroke();
  g.restore();

  const open = openCurve.value;
  if (open) {
    g.save();
    g.strokeStyle = dashed;
    g.lineWidth = 1.4;
    g.setLineDash([4, 3]);
    strokeCurve(g, open, width, height);
    g.restore();
  }

  g.save();
  g.strokeStyle = accent;
  g.lineWidth = 2;
  g.lineJoin = 'round';
  strokeCurve(g, mainCurve.value, width, height);
  g.restore();

  // The corner is marked where the curve actually turns, not at the knob.
  g.save();
  g.strokeStyle = accent;
  g.globalAlpha = 0.6;
  g.lineWidth = 1;
  g.setLineDash([2, 3]);
  const cornerX = plotX(cornerHz.value, width);
  g.beginPath();
  g.moveTo(cornerX, 0);
  g.lineTo(cornerX, height);
  g.stroke();
  g.restore();
}

useCanvasRedraw(curveCanvas, drawCurve);
onMounted(drawCurve);
watch([mainCurve, openCurve, isDark, active, () => props.wide], drawCurve, { flush: 'post' });

// ------------------------------------------------------------------ meter

/** Meter floor; the scale runs from here to full scale. */
const METER_FLOOR_DB = -60;
/** Where the master limiter holds the output. */
const CEILING_DB = -1;

const peakDb = computed(() => amplitudeToDb(props.peak));
const peakPercent = computed(() => {
  const span = 0 - METER_FLOOR_DB;
  return Math.min(100, Math.max(0, ((peakDb.value - METER_FLOOR_DB) / span) * 100));
});
const ceilingPercent = meterPercent(CEILING_DB);
const peakReadout = computed(() =>
  peakDb.value <= METER_FLOOR_DB ? '-∞ dB' : `${peakDb.value.toFixed(1)} dB`,
);
/** Scale marks under the meter. */
const METER_MARKS_DB = [-60, -48, -36, -24, -12, -6, 0];

function meterPercent(db: number): number {
  return ((db - METER_FLOOR_DB) / (0 - METER_FLOOR_DB)) * 100;
}
</script>

<template>
  <section class="step-views" :aria-label="copy.sections.views">
    <div v-if="!wide" class="step-views__switch" role="tablist" :aria-label="copy.views.switcher">
      <button
        v-for="view in VIEWS"
        :key="view.id"
        type="button"
        class="step-views__switch-button"
        :class="{ 'step-views__switch-button--on': active === view.id }"
        role="tab"
        :aria-selected="active === view.id"
        @click="active = view.id"
      >{{ view.legend }}</button>
    </div>

    <div class="step-views__panels">
      <article v-if="visible('scope')" class="step-views__panel">
        <header class="step-views__head">
          <span class="step-views__legend">{{ SILKSCREEN.scope }}</span>
        </header>
        <ScopeDisplay class="step-views__scope" :analyser="analyser" />
        <p class="step-views__caption">{{ copy.views.scope.caption }}</p>
      </article>

      <article v-if="visible('filter')" class="step-views__panel">
        <header class="step-views__head">
          <span class="step-views__legend">{{ SILKSCREEN.filter }}</span>
          <span class="step-views__readouts">
            <span class="step-views__readout">
              <b>{{ copy.views.filter.corner }}</b>{{ formatHz(cornerHz) }}
            </span>
            <span class="step-views__readout step-views__readout--env">
              <b>{{ copy.views.filter.envOpen }}</b>{{ formatHz(envOpenCutoffHz(cutoffHz, envModCents)) }}
            </span>
          </span>
        </header>
        <div class="step-views__screen">
          <canvas ref="curveCanvas" class="step-views__canvas" aria-hidden="true"></canvas>
        </div>
        <p class="step-views__caption">{{ copy.views.filter.caption }}</p>
      </article>

      <article v-if="visible('output')" class="step-views__panel">
        <header class="step-views__head">
          <span class="step-views__legend">{{ SILKSCREEN.output }}</span>
        </header>
        <div class="step-views__meter">
          <div class="step-views__peak">
            <span class="step-views__peak-key">{{ SILKSCREEN.peak }}</span>
            <span class="step-views__peak-value">{{ peakReadout }}</span>
          </div>
          <div
            class="step-views__meter-bar"
            role="meter"
            :aria-label="SILKSCREEN.peak"
            :aria-valuemin="METER_FLOOR_DB"
            :aria-valuemax="0"
            :aria-valuenow="Math.max(METER_FLOOR_DB, peakDb)"
            :aria-valuetext="peakReadout"
          >
            <div class="step-views__meter-fill" :style="{ width: `${peakPercent}%` }"></div>
            <span
              class="step-views__meter-ceiling"
              :style="{ left: `${ceilingPercent}%` }"
              :title="copy.views.output.ceiling"
            ></span>
          </div>
          <div class="step-views__scale" aria-hidden="true">
            <span
              v-for="mark in METER_MARKS_DB"
              :key="mark"
              class="step-views__mark"
              :style="{ left: `${meterPercent(mark)}%` }"
            >{{ mark }}</span>
          </div>
          <div class="step-views__metrics">
            <MetricItem
              layout="column"
              :label="copy.views.output.ceiling"
              :value="`${CEILING_DB} dBTP`"
            />
            <MetricItem
              layout="column"
              :label="copy.views.output.rate"
              :value="formatSampleRate(sampleRate)"
            />
          </div>
        </div>
        <p class="step-views__caption">{{ copy.views.output.caption }}</p>
      </article>
    </div>
  </section>
</template>
