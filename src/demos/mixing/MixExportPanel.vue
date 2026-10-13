<script setup lang="ts">
/**
 * The bounce (WAV word length and dither, Worker render with progress and
 * cancel, the last render's loudness) and the project file (save, open v1/v2).
 */

import { computed, ref } from 'vue';
import { DemoNotice, SegmentedControl, TermLabel } from '@/components/ui';
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

const formatOptions = computed(() =>
  WAV_FORMATS.map((id) => ({ id, label: copy.value.export.formats[id] })),
);
// Float output takes no dither, so the picker shows no choice there.
const ditherOptions = computed(() =>
  WAV_DITHERS.map((id) => ({ id, label: copy.value.export.dithers[id], disabled: isFloat.value })),
);

async function onProject(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (file) await m.importProject(file);
}
</script>

<template>
  <section class="export" :aria-label="copy.export.title">
    <h3><TermLabel v-bind="term('bounce')">{{ copy.export.title }}</TermLabel></h3>
    <div class="export__field">
      <span class="export__label">{{ copy.export.format }}</span>
      <SegmentedControl
        :model-value="format"
        :options="formatOptions"
        :ariaLabel="copy.export.format"
        size="sm"
        @update:model-value="(id) => (format = id as WavFormat)"
      />
    </div>
    <div class="export__field">
      <TermLabel v-bind="term('dither')">{{ copy.export.dither }}</TermLabel>
      <SegmentedControl
        :model-value="isFloat ? '' : dither"
        :options="ditherOptions"
        :ariaLabel="copy.export.dither"
        size="sm"
        @update:model-value="(id) => (dither = id as WavDither)"
      />
      <DemoNotice v-if="isFloat" tone="hint">{{ copy.export.floatNote }}</DemoNotice>
    </div>

    <button
      type="button"
      class="demo-btn demo-btn--primary"
      :disabled="!hasAudio || editLocked"
      @click="m.exportMix(format, dither)"
    >{{ copy.export.bounce }}</button>

    <Transition name="demo-fade">
      <div v-if="exporting && job" class="export__job">
        <span role="status">{{ copy.jobs.stages[job.stage] }}</span>
        <span
          class="export__bar"
          role="progressbar"
          :aria-label="copy.jobs.export"
          aria-valuemin="0"
          aria-valuemax="100"
          :aria-valuenow="Math.round(job.progress * 100)"
        ><i :style="{ transform: `scaleX(${job.progress})` }"></i></span>
        <span aria-hidden="true">{{ Math.round(job.progress * 100) }}%</span>
        <button type="button" class="demo-btn demo-btn--sm" @click="m.cancelJob">{{ copy.common.cancel }}</button>
      </div>
    </Transition>

    <Transition name="demo-rise">
      <div v-if="lastRender" class="export__render">
        <span class="export__label">{{ copy.export.lastRender }}</span>
        <dl>
          <div><dt>{{ copy.export.integrated }}</dt><dd>{{ formatNumber(lastRender.result.integratedLufs, 1) }} LUFS</dd></div>
          <div><dt>{{ copy.export.truePeak }}</dt><dd>{{ formatNumber(lastRender.result.truePeakDb, 1) }} dBTP</dd></div>
          <div><dt>{{ copy.export.lra }}</dt><dd>{{ formatNumber(lastRender.result.loudnessRange, 1) }} LU</dd></div>
        </dl>
        <button type="button" class="demo-btn demo-btn--sm" @click="m.downloadRender">{{ copy.export.download }}</button>
      </div>
    </Transition>

    <div class="export__project">
      <span class="export__label">{{ copy.export.project }}</span>
      <div class="export__row">
        <button type="button" class="demo-btn demo-btn--sm" :disabled="state.tracks.length === 0" @click="m.exportProject">{{ copy.export.saveProject }}</button>
        <button type="button" class="demo-btn demo-btn--sm" :disabled="editLocked" @click="projectInput?.click()">{{ copy.export.openProject }}</button>
        <input ref="projectInput" class="export__file" type="file" accept="application/json,.json" @change="onProject">
      </div>
      <DemoNotice tone="hint">{{ copy.export.projectNote }}</DemoNotice>
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
  border-radius: var(--demo-radius-md);
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
  gap: 6px;
}

.export__row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.export__file {
  display: none;
}

.export__job {
  display: grid;
  grid-template-columns: auto minmax(60px, 1fr) auto auto;
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
  transition: transform var(--demo-dur-fast) linear;
}

.export__render {
  display: grid;
  justify-items: start;
  gap: 6px;
  padding-top: 8px;
  border-top: 1px solid var(--demo-border);
}

.export__render dl {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
  width: 100%;
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
