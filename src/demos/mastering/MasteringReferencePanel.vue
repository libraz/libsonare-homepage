<script setup lang="ts">
/**
 * Reference track: load it onto lane 3 (R), read how it differs from the
 * program, and fit the strip EQ's four Peak bands to the tonal difference.
 */
import { computed } from 'vue';
import { DemoNotice } from '@/components/ui';
import type { MasteringReferenceResult } from '@/demos/mastering/mastering.worker';
import { useMasteringCopy } from '@/demos/mastering/masteringCopy';
import { formatNumber } from '@/demos/mastering/masteringUi';
import type { MasteringFileInfo } from '@/demos/mastering/useMastering';

const props = defineProps<{
  info: MasteringFileInfo | null;
  ready: boolean;
  analysis: MasteringReferenceResult | null;
  hasProgram: boolean;
  analyzing: boolean;
  disabled?: boolean;
}>();

const emit = defineEmits<{
  load: [file: File];
  clear: [];
  applyMatch: [];
}>();

const copy = useMasteringCopy();

interface TonalBand {
  lowHz: number;
  highHz: number;
  deviationDb: number;
}

const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
const finite = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

const bands = computed<TonalBand[]>(() => {
  const raw = record(props.analysis?.tonalBalance).bands;
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((entry) => {
    const band = record(entry);
    const lowHz = finite(band.lowHz);
    const highHz = finite(band.highHz);
    const deviationDb = finite(band.deviationDb);
    return lowHz !== null && highHz !== null && deviationDb !== null
      ? [{ lowHz, highHz, deviationDb }]
      : [];
  });
});

const BAR_RANGE_DB = 12;
const hz = (value: number) =>
  value >= 1000 ? `${formatNumber(value / 1000, 1)}k` : formatNumber(value, 0);

const loudnessDelta = computed(() => {
  const gain = props.analysis?.loudness.gainToMatchDb;
  return gain === undefined ? '—' : `${formatNumber(gain, 1, true)} dB`;
});

const mono = computed(() => {
  const report = record(props.analysis?.monoCompatibility);
  const correlation = finite(report.correlation);
  if (correlation === null) return '—';
  const verdict =
    report.likelyMonoCompatible === false
      ? copy.value.reference.monoRisk
      : copy.value.reference.monoOk;
  return `${verdict} · r ${formatNumber(correlation, 2)}`;
});

function onFile(event: Event): void {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (file) emit('load', file);
}
</script>

<template>
  <section class="reference" :aria-label="copy.reference.title">
    <div class="reference__row">
      <label class="demo-btn demo-btn--sm reference__file" :class="{ 'is-disabled': !hasProgram || disabled }">
        <input type="file" accept="audio/*" :disabled="!hasProgram || disabled" @change="onFile">
        <span>{{ info ? copy.reference.replace : copy.reference.load }}</span>
      </label>
      <span v-if="info" class="reference__name">{{ info.fileName }}</span>
      <button v-if="info" type="button" class="demo-btn demo-btn--sm demo-btn--ghost" :disabled="disabled" @click="emit('clear')">
        {{ copy.reference.clear }}
      </button>
      <span class="reference__status" role="status">{{ analyzing ? copy.jobs.reference : '' }}</span>
    </div>
    <DemoNotice v-if="!info" tone="hint">{{ hasProgram ? copy.reference.hint : copy.reference.needSource }}</DemoNotice>
    <Transition name="demo-rise">
      <div v-if="analysis && ready" class="reference__result">
        <dl class="reference__facts">
          <div>
            <dt>{{ copy.reference.loudness }}</dt>
            <dd>{{ loudnessDelta }}</dd>
          </div>
          <div>
            <dt>{{ copy.reference.mono }}</dt>
            <dd>{{ mono }}</dd>
          </div>
        </dl>
        <figure v-if="bands.length" class="reference__tonal">
          <figcaption>{{ copy.reference.tonal }}</figcaption>
          <ol>
            <li v-for="band in bands" :key="band.lowHz">
              <span class="reference__bar" aria-hidden="true">
                <i
                  :class="{ 'is-cut': band.deviationDb < 0 }"
                  :style="{ height: `${Math.min(1, Math.abs(band.deviationDb) / BAR_RANGE_DB) * 50}%` }"
                ></i>
              </span>
              <span class="reference__band">{{ hz(band.lowHz) }}</span>
              <span class="reference__dev">{{ formatNumber(band.deviationDb, 1, true) }}</span>
            </li>
          </ol>
        </figure>
        <DemoNotice tone="hint">
          {{ copy.reference.matchHint }}
          <template #action>
            <button type="button" class="demo-btn demo-btn--sm demo-btn--primary" :disabled="disabled" @click="emit('applyMatch')">{{ copy.reference.apply }}</button>
          </template>
        </DemoNotice>
      </div>
    </Transition>
  </section>
</template>

<style scoped>
.reference,
.reference__result {
  display: grid;
  gap: 10px;
  min-width: 0;
}

.reference__row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
}

.reference__file {
  position: relative;
}

.reference__file input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}

.reference__file:focus-within {
  outline: 2px solid var(--demo-accent);
  outline-offset: 2px;
}

.reference__file.is-disabled {
  opacity: var(--demo-disabled-opacity);
  cursor: not-allowed;
}

.reference__name {
  flex: 1;
  min-width: 0;
  color: var(--demo-text);
  font-size: 12px;
  overflow-wrap: anywhere;
}

.reference__status {
  color: var(--demo-text-muted);
  font-family: var(--font-mono);
  font-size: 11px;
}

.reference__facts {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin: 0;
}

.reference__facts dt,
.reference__tonal figcaption {
  color: var(--demo-text-muted);
  font-family: var(--font-mono);
  font-size: var(--demo-label-size);
  letter-spacing: var(--demo-label-tracking);
  text-transform: uppercase;
}

.reference__facts dd {
  margin: 0;
  color: var(--demo-text-strong);
  font-family: var(--font-mono);
  font-size: 13px;
  font-variant-numeric: tabular-nums;
}

.reference__tonal {
  margin: 0;
}

.reference__tonal ol {
  display: flex;
  gap: 2px;
  margin: 6px 0 0;
  padding: 0;
  list-style: none;
}

.reference__tonal li {
  display: grid;
  flex: 1 1 0;
  justify-items: center;
  gap: 2px;
  min-width: 0;
}

.reference__bar {
  position: relative;
  width: 100%;
  height: 56px;
  background: linear-gradient(var(--demo-border), var(--demo-border)) center / 100% 1px no-repeat;
}

.reference__bar i {
  position: absolute;
  bottom: 50%;
  left: 20%;
  width: 60%;
  background: var(--demo-cyan);
}

.reference__bar i.is-cut {
  top: 50%;
  bottom: auto;
  background: var(--demo-amber);
}

.reference__band,
.reference__dev {
  color: var(--demo-text-muted);
  font-family: var(--font-mono);
  font-size: 9px;
  font-variant-numeric: tabular-nums;
}
</style>
