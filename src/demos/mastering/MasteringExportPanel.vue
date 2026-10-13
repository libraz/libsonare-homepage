<script setup lang="ts">
/**
 * Loudness fit and export. The export renders the state being heard; when the
 * fit no longer describes lane 1 it refits first and keeps the new drive, so
 * the preview and the file stay one render.
 */
import { computed, ref } from 'vue';
import { DemoNotice, SegmentedControl, Tooltip } from '@/components/ui';
import { useMasteringCopy } from '@/demos/mastering/masteringCopy';
import type { MasteringLoudnessFitRecord } from '@/demos/mastering/masteringState';
import { formatNumber } from '@/demos/mastering/masteringUi';
import type { MasteringJobState, MasteringRenderRecord } from '@/demos/mastering/useMastering';
import { WAV_DITHERS, WAV_FORMATS, type WavDither, type WavFormat } from '@/utils/audio';
import { fill } from '@/utils/template';

const props = defineProps<{
  fit: MasteringLoudnessFitRecord | null;
  fitStale: boolean;
  targetLufs: number;
  hasProgram: boolean;
  job: MasteringJobState | null;
  lastRender: MasteringRenderRecord | null;
  disabled?: boolean;
}>();

const emit = defineEmits<{
  fit: [];
  export: [format: WavFormat, dither: WavDither];
  download: [];
  report: [];
  cancel: [];
}>();

const copy = useMasteringCopy();
const format = ref<WavFormat>('pcm24');
const dither = ref<WavDither>('tpdf');

const busy = computed(
  () => props.job !== null && (props.job.kind === 'fit' || props.job.kind === 'export'),
);
const canAct = computed(() => props.hasProgram && !props.disabled && props.job === null);

const fitLine = computed(() => {
  const fit = props.fit;
  if (!fit) return copy.value.fit.noFit;
  const drive = fill(copy.value.fit.drive, { db: formatNumber(fit.driveDb, 1, true) });
  const measured = fill(copy.value.fit.fitted, { lufs: formatNumber(fit.measuredLufs, 1) });
  return `${measured} · ${drive}`;
});
const limitedLine = computed(() =>
  props.fit?.limited && !props.fitStale
    ? fill(copy.value.fit.limitedNote, { lu: formatNumber(Math.abs(props.fit.residualLu), 1) })
    : '',
);

const results = computed(() => {
  const render = props.lastRender?.result;
  if (!render) return [];
  const text = copy.value.export.results;
  return [
    { label: text.integrated, value: formatNumber(render.integratedLufs, 1), unit: 'LUFS' },
    { label: text.truePeak, value: formatNumber(render.truePeakDb, 1), unit: 'dBTP' },
    { label: text.lra, value: formatNumber(render.loudnessRange, 1), unit: 'LU' },
    {
      label: text.plr,
      value: formatNumber(render.truePeakDb - render.integratedLufs, 1),
      unit: 'dB',
    },
    { label: text.maxMomentary, value: formatNumber(render.maxMomentaryLufs, 1), unit: 'LUFS' },
    { label: text.maxShortTerm, value: formatNumber(render.maxShortTermLufs, 1), unit: 'LUFS' },
  ];
});

const formatOptions = computed(() =>
  WAV_FORMATS.map((id) => ({ id, label: copy.value.export.formats[id] })),
);
const ditherOptions = computed(() =>
  WAV_DITHERS.map((id) => ({
    id,
    label: copy.value.export.dithers[id],
    disabled: format.value === 'float32',
  })),
);

const renderedLine = computed(() => {
  const render = props.lastRender;
  if (!render) return '';
  const text = copy.value.export;
  return fill(text.rendered, {
    format: text.formats[render.format],
    dither: render.format === 'float32' ? text.dithers.none : text.dithers[render.dither],
  });
});
</script>

<template>
  <section class="export" :aria-label="copy.export.title">
    <div class="export__fit" :class="{ 'is-stale': fitStale && hasProgram }">
      <div class="export__fit-text">
        <span class="export__badge" :class="{ 'is-warn': fitStale }">
          {{ fitStale ? copy.fit.badge : `${copy.statusFields.target} ${formatNumber(targetLufs, 1)} LUFS` }}
          <Tooltip v-if="fitStale" :title="copy.fit.badge" :body="copy.fit.badgeHint" :aria-label="copy.fit.badge" />
        </span>
        <span class="export__fit-line">{{ fitLine }}</span>
      </div>
      <button type="button" class="demo-btn demo-btn--sm" :disabled="!canAct" @click="emit('fit')">
        {{ fit ? copy.fit.refit : copy.fit.button }}
      </button>
    </div>
    <DemoNotice v-if="limitedLine" tone="warn">{{ limitedLine }}</DemoNotice>

    <div class="export__options">
      <div class="export__choice">
        <span class="export__label">{{ copy.export.format }}</span>
        <SegmentedControl
          :model-value="format"
          :options="formatOptions"
          :ariaLabel="copy.export.format"
          size="sm"
          @update:model-value="(next: string) => (format = next as WavFormat)"
        />
      </div>
      <div class="export__choice">
        <span class="export__label">{{ copy.export.dither }}</span>
        <SegmentedControl
          :model-value="format === 'float32' ? '' : dither"
          :options="ditherOptions"
          :ariaLabel="copy.export.dither"
          size="sm"
          @update:model-value="(next: string) => (dither = next as WavDither)"
        />
      </div>
    </div>
    <DemoNotice v-if="format === 'float32'" tone="hint">{{ copy.export.noDither }}</DemoNotice>

    <div class="export__actions">
      <button type="button" class="demo-btn demo-btn--primary export__primary" :disabled="!canAct" @click="emit('export', format, dither)">
        {{ fitStale ? copy.export.refitAction : copy.export.action }}
      </button>
      <Transition name="demo-rise">
        <div v-if="busy && job" class="export__progress">
          <span>{{ copy.jobs[job.kind] }} {{ Math.round(job.progress * 100) }}%</span>
          <span
            class="export__bar"
            role="progressbar"
            :aria-label="copy.jobs[job.kind]"
            aria-valuemin="0"
            aria-valuemax="100"
            :aria-valuenow="Math.round(job.progress * 100)"
          ><i :style="{ transform: `scaleX(${job.progress})` }"></i></span>
          <button type="button" class="demo-btn demo-btn--sm" @click="emit('cancel')">{{ copy.jobs.cancel }}</button>
        </div>
      </Transition>
    </div>
    <DemoNotice tone="hint">{{ fitStale && hasProgram ? copy.export.refitNote : copy.export.sameRender }}</DemoNotice>

    <Transition name="demo-rise">
      <div v-if="lastRender" class="export__result">
        <div class="export__result-head">
          <span>{{ renderedLine }}</span>
          <span class="export__links">
            <button type="button" class="demo-btn demo-btn--sm demo-btn--ghost" @click="emit('download')">{{ copy.export.download }}</button>
            <button type="button" class="demo-btn demo-btn--sm demo-btn--ghost" @click="emit('report')">{{ copy.export.report }}</button>
          </span>
        </div>
        <dl class="export__grid">
          <div v-for="item in results" :key="item.label">
            <dt>{{ item.label }}</dt>
            <dd>{{ item.value }}<small>{{ item.unit }}</small></dd>
          </div>
        </dl>
      </div>
    </Transition>
  </section>
</template>

<style scoped>
.export {
  display: grid;
  gap: 12px;
  min-width: 0;
}

.export__fit {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid var(--demo-border);
  border-radius: var(--demo-radius-sm);
  transition:
    border-color var(--demo-dur-base) var(--demo-ease-standard),
    background-color var(--demo-dur-base) var(--demo-ease-standard);
}

.export__fit.is-stale {
  border-color: var(--demo-warn-border);
  background: var(--demo-warn-bg);
}

.export__fit-text {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.export__badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--demo-text-muted);
  font-family: var(--font-mono);
  font-size: var(--demo-label-size);
  font-weight: var(--demo-label-weight);
  letter-spacing: var(--demo-label-tracking);
  text-transform: uppercase;
}

.export__badge.is-warn {
  color: var(--demo-warn-text);
}

.export__fit-line {
  color: var(--demo-text-strong);
  font-family: var(--font-mono);
  font-size: 13px;
  font-variant-numeric: tabular-nums;
}

.export__options {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 10px 16px;
}

.export__choice {
  display: grid;
  gap: 4px;
}

.export__label {
  color: var(--demo-text-muted);
  font-family: var(--font-mono);
  font-size: var(--demo-label-size);
  font-weight: var(--demo-label-weight);
  letter-spacing: var(--demo-label-tracking);
  text-transform: uppercase;
}

.export__actions {
  display: grid;
  gap: 8px;
}

.export__primary {
  --demo-btn-h: 40px;

  font-family: var(--font-body);
  font-size: 13.5px;
  letter-spacing: 0;
}

.export__progress {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 10px;
  font-family: var(--font-mono);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}

.export__bar {
  height: 3px;
  overflow: hidden;
  border-radius: 2px;
  background: var(--demo-border);
}

.export__bar i {
  display: block;
  height: 100%;
  background: var(--demo-accent);
  transform-origin: left;
  transition: transform var(--demo-dur-base) var(--demo-ease-standard);
}

.export__result {
  display: grid;
  gap: 8px;
  padding-top: 10px;
  border-top: 1px solid var(--demo-border);
}

.export__result-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  color: var(--demo-text);
  font-family: var(--font-mono);
  font-size: 11px;
}

.export__links {
  display: inline-flex;
  gap: 4px;
}

.export__links .demo-btn {
  color: var(--demo-accent);
}

.export__grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px 12px;
  margin: 0;
}

.export__grid dt {
  color: var(--demo-text-muted);
  font-family: var(--font-mono);
  font-size: var(--demo-label-size);
  letter-spacing: var(--demo-label-tracking);
  text-transform: uppercase;
}

.export__grid dd {
  margin: 0;
  color: var(--demo-text-strong);
  font-family: var(--font-mono);
  font-size: 14px;
  font-variant-numeric: tabular-nums;
}

.export__grid small {
  margin-left: 3px;
  color: var(--demo-text-muted);
  font-size: 9.5px;
}
</style>
