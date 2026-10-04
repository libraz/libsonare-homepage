<script setup lang="ts">
/**
 * The bounce (WAV word length and dither, Worker render with progress and
 * cancel, the last render's loudness) and the project file (save, open v1/v2).
 */

import { computed, ref } from 'vue';
import { TermLabel } from '@/components/ui';
import { useMixingCopy } from '@/demos/mixing/mixingCopy';
import { useMixingTerm } from '@/demos/mixing/mixingTerms';
import { formatNumber } from '@/demos/mixing/mixingUi';
import type { MixingController } from '@/demos/mixing/useMixingStudio';
import { WAV_DITHERS, WAV_FORMATS, type WavDither, type WavFormat } from '@/utils/audio';

const props = defineProps<{ m: MixingController }>();

const copy = useMixingCopy();
const term = useMixingTerm();
const { m } = props;
const { job, hasAudio, editLocked, lastRender, state } = m;

const format = ref<WavFormat>('pcm24');
const dither = ref<WavDither>('tpdf');
const projectInput = ref<HTMLInputElement | null>(null);
const exporting = computed(() => job.value?.kind === 'export');
const isFloat = computed(() => format.value === 'float32');

async function onProject(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (file) await m.importProject(file);
}
</script>

<template>
  <section class="export" :aria-label="copy.export.title">
    <h3>{{ copy.export.title }}</h3>
    <div class="export__field">
      <span class="export__label">{{ copy.export.format }}</span>
      <div class="export__segment" role="group" :aria-label="copy.export.format">
        <button
          v-for="option in WAV_FORMATS"
          :key="option"
          type="button"
          :aria-pressed="format === option"
          @click="format = option"
        >{{ copy.export.formats[option] }}</button>
      </div>
    </div>
    <div class="export__field">
      <TermLabel v-bind="term('dither')">{{ copy.export.dither }}</TermLabel>
      <div class="export__segment" role="group" :aria-label="copy.export.dither">
        <button
          v-for="option in WAV_DITHERS"
          :key="option"
          type="button"
          :aria-pressed="!isFloat && dither === option"
          :disabled="isFloat"
          @click="dither = option"
        >{{ copy.export.dithers[option] }}</button>
      </div>
      <small v-if="isFloat" class="export__note">{{ copy.export.floatNote }}</small>
    </div>

    <button
      type="button"
      class="export__bounce"
      :disabled="!hasAudio || editLocked"
      @click="m.exportMix(format, dither)"
    >{{ copy.export.bounce }}</button>

    <div v-if="exporting && job" class="export__job" role="status">
      <span>{{ copy.jobs.stages[job.stage] }} {{ Math.round(job.progress * 100) }}%</span>
      <span class="export__bar" aria-hidden="true"><i :style="{ width: `${job.progress * 100}%` }"></i></span>
      <button type="button" @click="m.cancelJob">{{ copy.common.cancel }}</button>
    </div>

    <div v-if="lastRender" class="export__render">
      <span class="export__label">{{ copy.export.lastRender }}</span>
      <dl>
        <div><dt>{{ copy.export.integrated }}</dt><dd>{{ formatNumber(lastRender.result.integratedLufs, 1) }} LUFS</dd></div>
        <div><dt>{{ copy.export.truePeak }}</dt><dd>{{ formatNumber(lastRender.result.truePeakDb, 1) }} dBTP</dd></div>
        <div><dt>{{ copy.export.lra }}</dt><dd>{{ formatNumber(lastRender.result.loudnessRange, 1) }} LU</dd></div>
      </dl>
      <button type="button" @click="m.downloadRender">{{ copy.export.download }}</button>
    </div>

    <div class="export__project">
      <span class="export__label">{{ copy.export.project }}</span>
      <div class="export__row">
        <button type="button" :disabled="state.tracks.length === 0" @click="m.exportProject">{{ copy.export.saveProject }}</button>
        <button type="button" :disabled="editLocked" @click="projectInput?.click()">{{ copy.export.openProject }}</button>
        <input ref="projectInput" class="export__file" type="file" accept="application/json,.json" @change="onProject">
      </div>
      <small class="export__note">{{ copy.export.projectNote }}</small>
    </div>
  </section>
</template>

<style scoped>
.export {
  display: grid;
  align-content: start;
  gap: 10px;
  min-width: 0;
  padding: 10px 12px 12px;
  border: 1px solid var(--demo-border);
  border-radius: 6px;
  background: var(--demo-bg-elevated);
}

.export h3,
.export__label {
  margin: 0;
  color: var(--demo-text-muted);
  font-family: var(--font-mono);
  font-size: var(--demo-label-size);
  font-weight: var(--demo-label-weight);
  letter-spacing: var(--demo-label-tracking);
  text-transform: uppercase;
}

.export__field,
.export__project {
  display: grid;
  gap: 4px;
}

.export__segment {
  display: flex;
  width: 100%;
  border: 1px solid var(--demo-border-strong);
  border-radius: 4px;
  overflow: hidden;
}

.export__segment button {
  flex: 1 1 0;
  min-width: 0;
  padding: 5px 2px;
  border: 0;
  border-left: 1px solid var(--demo-border);
  background: var(--demo-control-bg);
  color: var(--demo-text-muted);
  font-family: var(--font-mono);
  font-size: 10.5px;
  cursor: pointer;
}

.export__segment button:first-child {
  border-left: 0;
}

.export__segment button[aria-pressed='true'] {
  background: var(--demo-accent-subtle);
  color: var(--demo-accent);
  font-weight: 600;
}

.export__row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.export__row button,
.export__render button,
.export__job button,
.export__bounce {
  padding: 5px 10px;
  border: 1px solid var(--demo-border-strong);
  border-radius: 4px;
  background: var(--demo-control-bg);
  color: var(--demo-text);
  font-family: var(--font-mono);
  font-size: 11px;
  cursor: pointer;
}

.export__bounce {
  border-color: var(--demo-accent);
  background: var(--demo-accent);
  color: var(--demo-on-accent);
  font-weight: 600;
}

.export button:disabled {
  cursor: not-allowed;
  opacity: var(--demo-disabled-opacity);
}

.export__note {
  color: var(--demo-text-muted);
  font-size: 11px;
}

.export__file {
  display: none;
}

.export__job {
  display: grid;
  grid-template-columns: auto minmax(60px, 1fr) auto;
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

.export__render {
  display: grid;
  gap: 6px;
  padding-top: 8px;
  border-top: 1px solid var(--demo-border);
}

.export__render dl {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
  margin: 0;
}

.export__render dt {
  color: var(--demo-text-muted);
  font-size: 10.5px;
}

.export__render dd {
  margin: 0;
  color: var(--demo-text-strong);
  font-family: var(--font-mono);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}

.export__project {
  padding-top: 8px;
  border-top: 1px solid var(--demo-border);
}
</style>
