<script setup lang="ts">
/**
 * Loudness fit and export. The export renders the state being heard; when the
 * fit no longer describes lane 1 it refits first and keeps the new drive, so
 * the preview and the file stay one render.
 */

import { computed, ref } from 'vue';
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
        <span class="export__badge" :class="{ 'is-warn': fitStale }" :title="fitStale ? copy.fit.badgeHint : undefined">
          {{ fitStale ? copy.fit.badge : `${copy.statusFields.target} ${formatNumber(targetLufs, 1)} LUFS` }}
        </span>
        <span class="export__fit-line">{{ fitLine }}</span>
        <span v-if="limitedLine" class="export__limited" role="note">{{ limitedLine }}</span>
      </div>
      <button type="button" class="export__secondary" :disabled="!canAct" @click="emit('fit')">
        {{ fit ? copy.fit.refit : copy.fit.button }}
      </button>
    </div>

    <div class="export__options">
      <div class="export__choice" role="radiogroup" :aria-label="copy.export.format">
        <span class="export__label">{{ copy.export.format }}</span>
        <div class="export__segments">
          <button
            v-for="option in WAV_FORMATS"
            :key="option"
            type="button"
            role="radio"
            :aria-checked="format === option"
            @click="format = option"
          >
            {{ copy.export.formats[option] }}
          </button>
        </div>
      </div>
      <div class="export__choice" role="radiogroup" :aria-label="copy.export.dither">
        <span class="export__label">{{ copy.export.dither }}</span>
        <div class="export__segments">
          <button
            v-for="option in WAV_DITHERS"
            :key="option"
            type="button"
            role="radio"
            :aria-checked="format !== 'float32' && dither === option"
            :disabled="format === 'float32'"
            @click="dither = option"
          >
            {{ copy.export.dithers[option] }}
          </button>
        </div>
        <span v-if="format === 'float32'" class="export__hint">{{ copy.export.noDither }}</span>
      </div>
    </div>

    <div class="export__actions">
      <button type="button" class="export__primary" :disabled="!canAct" @click="emit('export', format, dither)">
        {{ fitStale ? copy.export.refitAction : copy.export.action }}
      </button>
      <div v-if="busy && job" class="export__progress" role="status">
        <span>{{ copy.jobs[job.kind] }} {{ Math.round(job.progress * 100) }}%</span>
        <span class="export__bar" aria-hidden="true"><i :style="{ width: `${job.progress * 100}%` }"></i></span>
        <button type="button" class="export__secondary" @click="emit('cancel')">{{ copy.jobs.cancel }}</button>
      </div>
    </div>
    <p class="export__hint">{{ fitStale && hasProgram ? copy.export.refitNote : copy.export.sameRender }}</p>

    <div v-if="lastRender" class="export__result">
      <div class="export__result-head">
        <span>{{ renderedLine }}</span>
        <span class="export__links">
          <button type="button" class="export__link" @click="emit('download')">{{ copy.export.download }}</button>
          <button type="button" class="export__link" @click="emit('report')">{{ copy.export.report }}</button>
        </span>
      </div>
      <dl class="export__grid">
        <div v-for="item in results" :key="item.label">
          <dt>{{ item.label }}</dt>
          <dd>{{ item.value }}<small>{{ item.unit }}</small></dd>
        </div>
      </dl>
    </div>
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
  border-radius: 6px;
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
  color: var(--demo-text-muted);
  font-family: var(--font-mono);
  font-size: var(--demo-label-size);
  font-weight: var(--demo-label-weight);
  letter-spacing: var(--demo-label-tracking);
  text-transform: uppercase;
}

.export__badge.is-warn,
.export__limited {
  color: var(--demo-warn-text);
}

.export__fit-line {
  color: var(--demo-text-strong);
  font-family: var(--font-mono);
  font-size: 13px;
  font-variant-numeric: tabular-nums;
}

.export__limited {
  font-size: 12px;
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

.export__segments {
  display: flex;
  border: 1px solid var(--demo-border-strong);
  border-radius: 5px;
  overflow: hidden;
}

.export__segments button {
  flex: 1 1 0;
  padding: 6px 4px;
  border: 0;
  background: transparent;
  color: var(--demo-text);
  font-family: var(--font-mono);
  font-size: 11px;
  cursor: pointer;
}

.export__segments button + button {
  border-left: 1px solid var(--demo-border-strong);
}

.export__segments button[aria-checked='true'] {
  background: var(--demo-accent-subtle);
  color: var(--demo-accent);
  font-weight: 700;
}

.export__segments button:disabled {
  opacity: var(--demo-disabled-opacity);
  cursor: not-allowed;
}

.export__actions {
  display: grid;
  gap: 8px;
}

.export__primary {
  padding: 10px 14px;
  border: 1px solid var(--demo-accent);
  border-radius: 6px;
  background: var(--demo-accent);
  color: var(--demo-on-accent);
  font-family: var(--font-body);
  font-size: 13.5px;
  font-weight: 650;
  white-space: nowrap;
  cursor: pointer;
}

.export__secondary,
.export__link {
  padding: 5px 10px;
  border: 1px solid var(--demo-border-strong);
  border-radius: 4px;
  background: transparent;
  color: var(--demo-text);
  font-family: var(--font-mono);
  font-size: 11px;
  white-space: nowrap;
  cursor: pointer;
}

.export__link {
  border-color: transparent;
  color: var(--demo-accent);
}

.export__primary:disabled,
.export__secondary:disabled {
  opacity: var(--demo-disabled-opacity);
  cursor: not-allowed;
}

.export button:focus-visible {
  outline: 2px solid var(--demo-accent);
  outline-offset: 2px;
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
}

.export__hint {
  margin: 0;
  color: var(--demo-text-muted);
  font-size: 11.5px;
  line-height: 1.5;
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
