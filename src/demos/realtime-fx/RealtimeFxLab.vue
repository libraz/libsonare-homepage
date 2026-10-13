<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import ToolShell from '@/components/ToolShell.vue';
import ToolStatusBar, { type ToolStatusField } from '@/components/ToolStatusBar.vue';
import { DemoNotice, MetricItem, SegmentedControl, TechPanel, TermLabel } from '@/components/ui';
import { useI18n } from '@/composables/useI18n';
import { useWasmBoot } from '@/composables/useWasmBoot';
import { enCopy, jaCopy } from '@/demos/realtime-fx/realtimeFxCopy';
import {
  absoluteFormantInReach,
  type FormantMode,
  isVoicePresetId,
  useRealtimeFx,
  VOICE_PRESET_MACROS,
  VOICE_PRESET_ORDER,
} from '@/demos/realtime-fx/useRealtimeFx';
import { amplitudeToDb, formatDb } from '@/utils/audio';
import { decayPeakHold, meterFillPercent } from '@/utils/scale';
import type { VoicePresetId } from '@/wasm/index';
import sonareJsUrl from '@/wasm/sonare.js?url';
import sonareWasmUrl from '@/wasm/sonare.wasm?url';

const { locale, localizedPath, alternateLocalePath, localizedValue } = useI18n();
const copy = computed(() => localizedValue({ en: enCopy, ja: jaCopy }));
const fx = useRealtimeFx(sonareJsUrl, sonareWasmUrl);
const { version: libVersion } = useWasmBoot();
const isStarting = ref(false);
const selectedPreset = ref<VoicePresetId>('neutral-monitor');
const pitchSemitones = ref(0);
const formant = ref(1);
const brightness = ref(0.1);
const formantEngaged = ref(false);
const formantMode = ref<FormantMode>('relative');
const wet = ref(1);
const outputGain = ref(0.85);
const bypass = ref(false);

const PRESET_STORAGE_KEY = 'libsonare:fx:preset';
const CLIP_THRESHOLD = 0.997; // ≈ -0.03 dBFS

const isReady = fx.ready;
const isMonitoring = fx.monitoring;
const meter = fx.meter;
const latencyMs = fx.latencyMs;

const inputHold = ref(0);
const outputHold = ref(0);
const clipped = ref(false);

watch(meter, (value) => {
  inputHold.value = decayPeakHold(inputHold.value, value.inputPeak);
  outputHold.value = decayPeakHold(outputHold.value, value.outputPeak);
  if (value.outputPeak >= CLIP_THRESHOLD) clipped.value = true;
});
const localError = computed(() => {
  const code = fx.error.value;
  if (!code) return null;
  if (code === 'no-mic-api') return copy.value.errors.noMicApi;
  if (code === 'mic-denied') return copy.value.errors.micDenied;
  return copy.value.errors.startFailed;
});

const docsPath = computed(() => localizedPath('/docs/realtime-streaming'));
const oppositeLocalePath = computed(() => alternateLocalePath('/realtime-fx'));
const glossaryBase = computed(() => localizedPath('/docs/glossary'));

type TermKey = keyof typeof enCopy.terms.items;

const TERM_SLUGS: Record<TermKey, string | undefined> = {
  pitch: 'concepts/audio-basics',
  formant: 'editing/voice-formant',
  formantMode: 'editing/voice-formant',
  brightness: 'editing/voice-formant',
  wet: undefined,
  output: 'concepts/gain-staging',
  bypass: undefined,
  inputPeak: 'concepts/audio-basics',
  outputPeak: 'concepts/audio-basics',
  inputRms: 'concepts/audio-basics',
  outputRms: 'concepts/audio-basics',
  latency: 'concepts/browser-local-processing',
};

function term(key: TermKey) {
  const item = copy.value.terms.items[key];
  const slug = TERM_SLUGS[key];
  return {
    eyebrow: copy.value.terms.eyebrow,
    title: item.title,
    body: item.body,
    tip: item.tip,
    tipLabel: copy.value.terms.tipLabel,
    defaultValue: 'default' in item ? (item as { default?: string }).default : undefined,
    defaultLabel: copy.value.terms.defaultLabel,
    href: slug ? `${glossaryBase.value}/${slug}` : undefined,
    linkLabel: copy.value.terms.linkLabel,
  };
}
const statusKind = computed<'idle' | 'active' | 'warning' | 'error'>(() => {
  if (localError.value) return 'error';
  if (isMonitoring.value) return 'active';
  if (isStarting.value || isReady.value) return 'warning';
  return 'idle';
});
const statusLabel = computed(() => {
  if (isMonitoring.value) return copy.value.status.monitoring;
  if (isStarting.value) return copy.value.status.starting;
  if (isReady.value) return copy.value.status.ready;
  return copy.value.status.idle;
});
const inputPeakDb = computed(() => formatDb(amplitudeToDb(meter.value.inputPeak)));
const outputPeakDb = computed(() => formatDb(amplitudeToDb(meter.value.outputPeak)));
const inputRmsDb = computed(() => formatDb(amplitudeToDb(meter.value.inputRms)));
const outputRmsDb = computed(() => formatDb(amplitudeToDb(meter.value.outputRms)));

// dBFS gridlines for the meter scale. Position (% from bottom) matches
// meterFillPercent's -60..0 dB → 0..100% mapping, so ticks line up with the fill.
const dbTicks = [0, -6, -20, -40, -60].map((db) => ({ db, pct: ((db + 60) / 60) * 100 }));

const presets = computed(() =>
  VOICE_PRESET_ORDER.map((id) => ({ id, label: copy.value.presets[id].label })),
);
const activePresetHint = computed(() => copy.value.presets[selectedPreset.value].hint);

const statusFields = computed<ToolStatusField[]>(() => {
  const keys = copy.value.statusFields;
  return [
    { key: keys.character, value: copy.value.presets[selectedPreset.value].label, wide: true },
    { key: keys.input, value: inputPeakDb.value, divider: true },
    { key: keys.output, value: outputPeakDb.value },
    { key: keys.latency, value: latencyMs.value ? `${latencyMs.value} ms` : '-' },
  ];
});

const formantModeOptions = computed(() => [
  { id: 'relative', label: copy.value.formantModes.relative },
  { id: 'absolute', label: copy.value.formantModes.absolute },
]);
const formantOutOfReach = computed(
  () =>
    formantMode.value === 'absolute' &&
    !absoluteFormantInReach(pitchSemitones.value, formant.value),
);

onMounted(() => {
  restorePreset();
});

onUnmounted(() => {
  void fx.dispose();
});

async function startEngine() {
  if (isReady.value) return true;
  if (isStarting.value) return false;
  isStarting.value = true;
  const ok = await fx.start();
  if (ok) applyParams();
  isStarting.value = false;
  return ok;
}

function stopEngine() {
  void fx.dispose();
  inputHold.value = 0;
  outputHold.value = 0;
  clipped.value = false;
}

async function toggleMonitor() {
  if (!isReady.value) {
    const started = await startEngine();
    if (!started || !isReady.value) return;
  }
  await fx.toggleMonitor();
}

function applyPreset(id: VoicePresetId) {
  selectedPreset.value = id;
  const macros = VOICE_PRESET_MACROS[id];
  pitchSemitones.value = macros.pitchSemitones;
  formant.value = macros.formant;
  brightness.value = macros.brightness;
  formantEngaged.value = false;
  wet.value = macros.wet;
  applyParams();
  try {
    localStorage.setItem(PRESET_STORAGE_KEY, id);
  } catch {
    /* storage unavailable */
  }
}

function restorePreset() {
  let stored: string | null = null;
  try {
    stored = localStorage.getItem(PRESET_STORAGE_KEY);
  } catch {
    /* storage unavailable */
  }
  if (isVoicePresetId(stored)) applyPreset(stored);
}

function applyParams() {
  fx.setParams({
    preset: selectedPreset.value,
    pitchSemitones: pitchSemitones.value,
    formant: formant.value,
    brightness: brightness.value,
    formantEngaged: formantEngaged.value,
    formantMode: formantMode.value,
    wet: wet.value,
    outputGain: outputGain.value,
    bypass: bypass.value,
  });
}

function applyFormantParams() {
  formantEngaged.value = true;
  applyParams();
}

function setFormantMode(mode: string) {
  formantMode.value = mode as FormantMode;
  applyParams();
}
</script>

<template>
  <ToolShell
    demo-id="fx"
    :title="copy.title"
    :subtitle="copy.subtitle"
    :version="libVersion"
    :status="statusKind"
    :status-label="copy.localOnly"
    :docs-path="docsPath"
    :guide-title="copy.guide.title"
    :guide-body="copy.guide.body"
    :guide-link-label="copy.help.docs"
    :opposite-locale-path="oppositeLocalePath"
  >
    <template #statusbar>
      <ToolStatusBar
        :status="statusKind"
        :label="statusLabel"
        :pulse="isStarting || isMonitoring"
        :fields="statusFields"
      />
    </template>

    <div class="rt-lab">
      <aside class="rt-lab__left">
        <TechPanel :title="copy.panels.input">
          <div class="rt-input">
            <DemoNotice tone="warn" :title="copy.safety.title">{{ copy.safety.body }}</DemoNotice>
            <div class="rt-input__badge" aria-hidden="true">MIC</div>
            <div class="rt-actions">
              <button type="button" class="demo-btn demo-btn--primary" :disabled="isStarting || isReady" @click="startEngine">{{ copy.actions.start }}</button>
              <button type="button" class="demo-btn" :disabled="!isReady && !isStarting" @click="stopEngine">{{ copy.actions.stop }}</button>
            </div>
            <button
              type="button"
              class="demo-btn rt-monitor"
              :class="{ 'rt-monitor--active demo-anim-loop': isMonitoring }"
              :disabled="isStarting"
              :aria-pressed="isMonitoring"
              @click="toggleMonitor"
            >
              <svg v-if="isMonitoring" class="rt-monitor__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M11 5 6 9H3v6h3l5 4V5Z" />
                <path d="M15.5 8.5a5 5 0 0 1 0 7" />
                <path d="M18.5 5.5a9 9 0 0 1 0 13" />
              </svg>
              <svg v-else class="rt-monitor__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M11 5 6 9H3v6h3l5 4V5Z" />
                <path d="m16 9 5 5" />
                <path d="m21 9-5 5" />
              </svg>
              {{ copy.actions.speaker }}
            </button>
            <DemoNotice v-if="localError" tone="error">{{ localError }}</DemoNotice>
          </div>
        </TechPanel>

        <TechPanel :title="copy.panels.presets">
          <div class="rt-presets">
            <button
              v-for="preset in presets"
              :key="preset.id"
              type="button"
              class="demo-btn rt-preset"
              :aria-pressed="selectedPreset === preset.id"
              @click="applyPreset(preset.id)"
            >
              {{ preset.label }}
            </button>
          </div>
          <div class="rt-preset-hint">
            <DemoNotice :key="selectedPreset" tone="hint">{{ activePresetHint }}</DemoNotice>
          </div>
        </TechPanel>
      </aside>

      <section class="rt-lab__center">
        <TechPanel :title="copy.panels.voice">
          <div class="rt-controls">
            <label class="rt-slider">
              <span><TermLabel v-bind="term('pitch')">{{ copy.controls.pitch }}</TermLabel> <b>{{ pitchSemitones.toFixed(1) }} st</b></span>
              <input v-model.number="pitchSemitones" class="demo-range" type="range" min="-12" max="12" step="0.1" @input="applyParams">
            </label>
            <label class="rt-slider">
              <span><TermLabel v-bind="term('formant')">{{ copy.controls.formant }}</TermLabel> <b>{{ formant.toFixed(2) }}</b></span>
              <input v-model.number="formant" class="demo-range" type="range" min="0.55" max="1.65" step="0.01" @input="applyFormantParams">
            </label>
            <div class="rt-mode">
              <TermLabel v-bind="term('formantMode')">{{ copy.formantModes.label }}</TermLabel>
              <SegmentedControl
                :model-value="formantMode"
                :options="formantModeOptions"
                :ariaLabel="copy.formantModes.label"
                size="sm"
                fill
                @update:model-value="setFormantMode"
              />
              <DemoNotice v-if="formantOutOfReach" tone="warn">{{ copy.notes.outOfReach }}</DemoNotice>
            </div>
            <label class="rt-slider">
              <span><TermLabel v-bind="term('brightness')">{{ copy.controls.brightness }}</TermLabel> <b>{{ brightness.toFixed(2) }}</b></span>
              <input v-model.number="brightness" class="demo-range" type="range" min="-1" max="1" step="0.01" @input="applyFormantParams">
            </label>
            <label class="rt-slider">
              <span><TermLabel v-bind="term('wet')">{{ copy.controls.wet }}</TermLabel> <b>{{ Math.round(wet * 100) }}%</b></span>
              <input v-model.number="wet" class="demo-range" type="range" min="0" max="1" step="0.01" @input="applyParams">
            </label>
            <label class="rt-slider">
              <span><TermLabel v-bind="term('output')">{{ copy.controls.output }}</TermLabel> <b>{{ Math.round(outputGain * 100) }}%</b></span>
              <input v-model.number="outputGain" class="demo-range" type="range" min="0" max="1" step="0.01" @input="applyParams">
            </label>
            <label class="rt-bypass">
              <input v-model="bypass" type="checkbox" @change="applyParams">
              <TermLabel v-bind="term('bypass')">{{ copy.controls.bypass }}</TermLabel>
            </label>
          </div>
        </TechPanel>
      </section>

      <aside class="rt-lab__right">
        <TechPanel :title="copy.panels.meters">
          <div class="rt-meters">
            <div class="rt-scale" aria-hidden="true">
              <span v-for="t in dbTicks" :key="t.db" class="rt-scale__tick" :style="{ bottom: `${t.pct}%` }">{{ t.db }}</span>
            </div>
            <div class="rt-meter">
              <div class="rt-meter__track">
                <div class="rt-meter__fill" :style="{ clipPath: `inset(${100 - meterFillPercent(meter.inputRms)}% 0 0 0)` }"></div>
                <i v-if="meter.inputPeak > 0" class="rt-meter__peak" :style="{ bottom: `${meterFillPercent(meter.inputPeak)}%` }"></i>
                <i v-if="inputHold > 0" class="rt-meter__hold" :style="{ bottom: `${meterFillPercent(inputHold)}%` }"></i>
              </div>
              <b>{{ copy.meters.input }}</b>
            </div>
            <div class="rt-meter">
              <div class="rt-meter__track">
                <button
                  type="button"
                  class="rt-clip"
                  :class="{ 'rt-clip--lit': clipped }"
                  :disabled="!clipped"
                  :aria-label="copy.metrics.clip"
                  @click="clipped = false"
                >{{ copy.meters.clip }}</button>
                <div class="rt-meter__fill" :style="{ clipPath: `inset(${100 - meterFillPercent(meter.outputRms)}% 0 0 0)` }"></div>
                <i v-if="meter.outputPeak > 0" class="rt-meter__peak" :style="{ bottom: `${meterFillPercent(meter.outputPeak)}%` }"></i>
                <i v-if="outputHold > 0" class="rt-meter__hold" :style="{ bottom: `${meterFillPercent(outputHold)}%` }"></i>
              </div>
              <b>{{ copy.meters.output }}</b>
            </div>
          </div>
          <div class="rt-metric-list">
            <MetricItem :value="inputPeakDb">
              <template #label><TermLabel v-bind="term('inputPeak')">{{ copy.metrics.inputPeak }}</TermLabel></template>
            </MetricItem>
            <MetricItem :value="outputPeakDb">
              <template #label><TermLabel v-bind="term('outputPeak')">{{ copy.metrics.outputPeak }}</TermLabel></template>
            </MetricItem>
            <MetricItem :value="inputRmsDb">
              <template #label><TermLabel v-bind="term('inputRms')">{{ copy.metrics.inputRms }}</TermLabel></template>
            </MetricItem>
            <MetricItem :value="outputRmsDb">
              <template #label><TermLabel v-bind="term('outputRms')">{{ copy.metrics.outputRms }}</TermLabel></template>
            </MetricItem>
            <MetricItem :value="latencyMs ? `${latencyMs} ms` : '-'">
              <template #label><TermLabel v-bind="term('latency')">{{ copy.metrics.latency }}</TermLabel></template>
            </MetricItem>
          </div>
        </TechPanel>
      </aside>
    </div>
  </ToolShell>
</template>

<style scoped src="./realtimeFxLayout.css"></style>
<style scoped src="./realtimeFxMeters.css"></style>
<style scoped src="./realtimeFxResponsive.css"></style>
