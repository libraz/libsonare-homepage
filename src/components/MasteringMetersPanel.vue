<script setup lang="ts">
import { MetricItem, Tooltip } from '@/components/ui';
import { useI18n } from '@/composables/useI18n';
import type { RenderedMasteringAudio } from '@/composables/useMastering';

interface MeterReading {
  id: string;
  label: string;
  value: string;
  percent: number;
}

interface SignalMetrics {
  peak: string;
  crest: string;
  correlation: string;
}

const props = defineProps<{
  readings: MeterReading[];
  meterTargets: Record<string, string>;
  moduleGuideSlugs: Record<string, string>;
  activeModule: string;
  statusLabel: string;
  rendered: RenderedMasteringAudio | null;
  sourceMetrics: SignalMetrics | null;
  masterMetrics: SignalMetrics | null;
  targetLufs: number;
  phasePoints: Array<{ x: number; y: number; opacity: number }>;
  stereoImage: { width: string; label: string };
  glossaryBasePath: string;
}>();

const emit = defineEmits<{
  jump: [moduleId: string];
}>();

const { t } = useI18n();
const LED_SEGMENTS = 48;
const LED_PEAK_SEGMENTS = 5;
const LED_MAJOR_EVERY = 12;

function ledClass(percent: number, index: number, total: number): Record<string, boolean> {
  const fraction = (index / total) * 100;
  const on = fraction <= percent;
  const peakBand = index > total - LED_PEAK_SEGMENTS;
  const majorTick = index % LED_MAJOR_EVERY === 0;
  return {
    'led-meter__seg--on': on,
    'led-meter__seg--peak': on && peakBand,
    'led-meter__seg--major': majorTick,
  };
}

function docHref(slug: string | null | undefined): string | undefined {
  return slug ? `${props.glossaryBasePath}/${slug}` : undefined;
}

function jumpTo(moduleId: string | undefined) {
  if (moduleId) emit('jump', moduleId);
}
</script>

<template>
  <div class="meter-stack">
    <Tooltip
      v-for="reading in readings"
      :key="reading.id"
      :eyebrow="t('master.studio.meters')"
      :title="reading.label"
      :body="t(`master.meters.descriptions.${reading.id}`)"
      :tip="t(`master.meters.useWhen.${reading.id}`)"
      :tip-label="t('master.tips.useWhen')"
      :href="meterTargets[reading.id] ? docHref(moduleGuideSlugs[meterTargets[reading.id]]) : undefined"
      :link-label="t('master.glossary.moduleGuide')"
    >
      <button
        type="button"
        class="led-meter led-meter--jump"
        :class="{ 'led-meter--active': meterTargets[reading.id] && activeModule === meterTargets[reading.id] }"
        :disabled="!meterTargets[reading.id]"
        @click="jumpTo(meterTargets[reading.id])"
      >
        <header class="led-meter__head">
          <span>{{ reading.label }}</span>
          <strong>{{ reading.value }}</strong>
        </header>
        <div class="led-meter__leds" aria-hidden="true">
          <span
            v-for="i in LED_SEGMENTS"
            :key="i"
            class="led-meter__seg"
            :class="ledClass(reading.percent, i, LED_SEGMENTS)"
          />
        </div>
      </button>
    </Tooltip>

    <MetricItem :label="t('master.meters.status')" :value="statusLabel" variant="accent" />
    <button type="button" class="meter-jump" :title="`Open ${t('master.modules.input.name')} stage`" @click="jumpTo('input')">
      <MetricItem :label="t('master.meters.inputLufs')" :value="rendered ? rendered.inputLufs.toFixed(1) : '-'" />
    </button>
    <button type="button" class="meter-jump" :title="`Open ${t('master.modules.loudness.name')} stage`" @click="jumpTo('loudness')">
      <MetricItem :label="t('master.meters.outputLufs')" :value="rendered ? rendered.outputLufs.toFixed(1) : `${targetLufs}`" variant="success" />
    </button>
    <button type="button" class="meter-jump" :title="`Open ${t('master.modules.loudness.name')} stage`" @click="jumpTo('loudness')">
      <MetricItem :label="t('master.meters.gain')" :value="rendered ? `${rendered.appliedGainDb.toFixed(1)} dB` : '-'" />
    </button>
    <button type="button" class="meter-jump" :title="`Open ${t('master.modules.limiter.name')} stage`" @click="jumpTo('limiter')">
      <MetricItem :label="t('master.meters.peak')" :value="sourceMetrics?.peak || '-'" />
    </button>
    <button type="button" class="meter-jump" :title="`Open ${t('master.modules.dynamics.name')} stage`" @click="jumpTo('dynamics')">
      <MetricItem :label="t('master.meters.crest')" :value="masterMetrics?.crest || sourceMetrics?.crest || '-'" />
    </button>
    <button type="button" class="meter-jump" :title="`Open ${t('master.modules.stereo.name')} stage`" @click="jumpTo('stereo')">
      <MetricItem :label="t('master.meters.correlation')" :value="masterMetrics?.correlation || sourceMetrics?.correlation || '-'" />
    </button>

    <Tooltip
      :eyebrow="t('master.studio.meters')"
      :title="t('master.meters.stereoBalanced')"
      :body="t('master.meters.descriptions.phase')"
      :tip="t('master.meters.useWhen.phase')"
      :tip-label="t('master.tips.useWhen')"
      :href="docHref(moduleGuideSlugs.stereo)"
      :link-label="t('master.glossary.moduleGuide')"
    >
      <button type="button" class="meter-jump meter-jump--block" @click="jumpTo('stereo')">
        <div class="phase-scope" aria-hidden="true">
          <span
            v-for="(point, index) in phasePoints"
            :key="index"
            :style="{ left: `${point.x}%`, top: `${point.y}%`, opacity: point.opacity }"
          />
        </div>
        <MetricItem :label="t('master.meters.stereoImage')" :value="stereoImage.label" variant="accent" />
        <div class="stereo-field" aria-hidden="true">
          <span :style="{ width: stereoImage.width }"></span>
        </div>
      </button>
    </Tooltip>
  </div>
</template>

<style scoped>
.meter-stack {
  display: grid;
  gap: 14px;
  padding: 14px;
}

.meter-stack > :deep(.tt-trigger),
.meter-stack > :deep(.tt-trigger > button) {
  display: block;
  width: 100%;
}

.led-meter {
  display: grid;
  gap: 6px;
}

button.led-meter,
.meter-jump {
  margin: 0;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  font: inherit;
  color: inherit;
  text-align: left;
  cursor: pointer;
  transition: border-color 0.18s ease, background-color 0.18s ease, box-shadow 0.18s ease;
}

button.led-meter {
  padding: 8px 10px;
}

button.led-meter:disabled {
  cursor: default;
}

.meter-jump {
  display: block;
  padding: 4px 8px;
}

button.led-meter:not(:disabled):hover,
button.led-meter:not(:disabled):focus-visible,
.meter-jump:hover,
.meter-jump:focus-visible {
  outline: none;
  border-color: var(--demo-accent-border);
  background: color-mix(in srgb, var(--demo-accent) 8%, transparent);
}

.led-meter--active {
  border-color: var(--demo-accent) !important;
  background: color-mix(in srgb, var(--demo-accent) 12%, transparent) !important;
}

.meter-jump--block {
  display: grid;
  gap: 10px;
  padding: 8px;
}

.led-meter__head {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  color: var(--demo-text-muted);
  font-family: var(--font-mono);
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.led-meter__head strong {
  color: var(--demo-text-strong);
  font-weight: 800;
}

.led-meter__leds {
  display: grid;
  grid-template-columns: repeat(48, minmax(2px, 1fr));
  gap: 2px;
}

.led-meter__seg {
  height: 12px;
  border-radius: 2px;
  background: var(--master-surface-strong);
  transition: background-color 0.16s ease, box-shadow 0.16s ease;
}

.led-meter__seg--major {
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--demo-text-muted) 28%, transparent);
}

.led-meter__seg--on {
  background: var(--demo-cyan);
  box-shadow: 0 0 8px color-mix(in srgb, var(--demo-cyan) 55%, transparent);
}

.led-meter__seg--peak {
  background: var(--demo-warn);
  box-shadow: 0 0 8px color-mix(in srgb, var(--demo-warn) 62%, transparent);
}

.phase-scope {
  position: relative;
  height: 140px;
  border: 1px solid var(--demo-border);
  border-radius: 8px;
  background:
    linear-gradient(90deg, transparent 49.5%, var(--demo-border) 50%, transparent 50.5%),
    linear-gradient(0deg, transparent 49.5%, var(--demo-border) 50%, transparent 50.5%),
    var(--master-surface);
  overflow: hidden;
}

.phase-scope::before,
.phase-scope::after {
  content: '';
  position: absolute;
  inset: 18px;
  border: 1px solid var(--demo-border);
  border-radius: 50%;
}

.phase-scope::after {
  inset: 42px;
}

.phase-scope span {
  position: absolute;
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: var(--demo-cyan);
  transform: translate(-50%, -50%);
  /* Glide between readings instead of teleporting on re-render. */
  transition: left 0.1s linear, top 0.1s linear, opacity 0.1s linear;
}

.stereo-field {
  height: 8px;
  border-radius: 999px;
  background: var(--master-surface-strong);
  overflow: hidden;
}

.stereo-field span {
  display: block;
  height: 100%;
  margin: 0 auto;
  border-radius: inherit;
  background: linear-gradient(90deg, var(--demo-cyan), var(--demo-accent));
}

/* Staggered reveal so the meter stack composes in with the result panels. */
.meter-stack > * {
  animation: meter-rise 0.35s ease both;
}

.meter-stack > *:nth-child(2) { animation-delay: 0.05s; }
.meter-stack > *:nth-child(3) { animation-delay: 0.1s; }
.meter-stack > *:nth-child(4) { animation-delay: 0.15s; }
.meter-stack > *:nth-child(5) { animation-delay: 0.2s; }
.meter-stack > *:nth-child(6) { animation-delay: 0.25s; }
.meter-stack > *:nth-child(7) { animation-delay: 0.3s; }
.meter-stack > *:nth-child(n + 8) { animation-delay: 0.35s; }

@keyframes meter-rise {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: none; }
}

@media (prefers-reduced-motion: reduce) {
  .phase-scope span {
    transition: none;
  }

  .meter-stack > * {
    animation: none;
  }
}
</style>
