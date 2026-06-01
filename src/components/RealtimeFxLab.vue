<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { enCopy, jaCopy } from '@/components/realtime-fx/realtimeFxCopy';
import ToolShell from '@/components/ToolShell.vue';
import { MetricItem, StatusIndicator, TechPanel, TermLabel } from '@/components/ui';
import { useI18n } from '@/composables/useI18n';
import {
  isVoicePresetId,
  useRealtimeFx,
  VOICE_PRESET_MACROS,
  VOICE_PRESET_ORDER,
} from '@/composables/useRealtimeFx';
import { decayPeakHold, meterFillPercent } from '@/utils/scale';
import type { VoicePresetId } from '@/wasm/index';
import sonareJsUrl from '@/wasm/sonare.js?url';
import sonareWasmUrl from '@/wasm/sonare.wasm?url';

const { locale } = useI18n();
const copy = computed(() => (locale.value === 'ja' ? jaCopy : enCopy));
const fx = useRealtimeFx(sonareJsUrl, sonareWasmUrl);
const libVersion = ref('');
const isStarting = ref(false);
const selectedPreset = ref<VoicePresetId>('neutral-monitor');
const pitchSemitones = ref(0);
const formant = ref(1);
const brightness = ref(0.1);
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
  return code;
});

const docsPath = computed(() =>
  locale.value === 'ja' ? '/ja/docs/realtime-streaming' : '/docs/realtime-streaming',
);
const oppositeLocalePath = computed(() =>
  locale.value === 'ja' ? '/realtime-fx' : '/ja/realtime-fx',
);

const glossaryBase = computed(() =>
  locale.value === 'ja' ? '/ja/docs/glossary' : '/docs/glossary',
);

type TermKey = keyof typeof enCopy.terms.items;

const TERM_SLUGS: Record<TermKey, string | undefined> = {
  pitch: 'concepts/audio-basics',
  formant: 'editing/voice-formant',
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

onMounted(() => {
  const ric = (window as any).requestIdleCallback;
  if (ric) ric(initWasmVersion, { timeout: 2000 });
  else setTimeout(initWasmVersion, 100);
  restorePreset();
});

onUnmounted(() => {
  void fx.dispose();
});

async function initWasmVersion() {
  try {
    const wasm = await import('@/wasm/index.js');
    await wasm.init();
    libVersion.value = wasm.version();
  } catch (error) {
    console.warn('Failed to initialize WASM version:', error);
  }
}

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
    wet: wet.value,
    outputGain: outputGain.value,
    bypass: bypass.value,
  });
}

function amplitudeToDb(value: number): number {
  return value > 0 ? 20 * Math.log10(value) : -120;
}

function formatDb(value: number): string {
  return `${Math.max(-120, value).toFixed(1)} dB`;
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
    :guide-title="copy.safety.title"
    :guide-body="copy.safety.body"
    :guide-link-label="copy.help.docs"
    :opposite-locale-path="oppositeLocalePath"
  >
    <template #statusbar>
      <div class="rt-statusbar">
        <StatusIndicator :status="statusKind" :label="statusLabel" :pulse="isStarting || isMonitoring" />
        <span class="rt-statusbar__field"><b>IN</b>{{ inputPeakDb }}</span>
        <span class="rt-statusbar__field"><b>OUT</b>{{ outputPeakDb }}</span>
        <span class="rt-statusbar__field"><b>LAT</b>{{ latencyMs || '-' }} ms</span>
      </div>
    </template>

    <div class="rt-lab">
      <aside class="rt-lab__left">
        <TechPanel :title="copy.panels.input">
          <div class="rt-input">
            <div class="rt-input__badge">MIC</div>
            <div class="rt-actions">
              <button class="rt-button rt-button--primary" :disabled="isStarting || isReady" @click="startEngine">{{ copy.actions.start }}</button>
              <button class="rt-button" :disabled="!isReady && !isStarting" @click="stopEngine">{{ copy.actions.stop }}</button>
            </div>
            <button
              class="rt-monitor"
              :class="{ 'rt-monitor--active': isMonitoring }"
              :disabled="isStarting"
              :aria-label="isMonitoring ? copy.actions.monitorOff : copy.actions.monitorOn"
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
              {{ isMonitoring ? copy.actions.monitorOff : copy.actions.monitorOn }}
            </button>
            <p v-if="localError" class="rt-error">{{ localError }}</p>
          </div>
        </TechPanel>

        <TechPanel :title="copy.panels.presets">
          <div class="rt-presets">
            <button
              v-for="preset in presets"
              :key="preset.id"
              class="rt-preset"
              :class="{ 'rt-preset--active': selectedPreset === preset.id }"
              @click="applyPreset(preset.id)"
            >
              {{ preset.label }}
            </button>
          </div>
          <p class="rt-preset-hint">{{ activePresetHint }}</p>
        </TechPanel>
      </aside>

      <section class="rt-lab__center">
        <TechPanel :title="copy.panels.voice">
          <div class="rt-controls">
            <label class="rt-slider">
              <span><TermLabel v-bind="term('pitch')">{{ copy.controls.pitch }}</TermLabel> <b>{{ pitchSemitones.toFixed(1) }} st</b></span>
              <input v-model.number="pitchSemitones" type="range" min="-12" max="12" step="0.1" @input="applyParams">
            </label>
            <label class="rt-slider">
              <span><TermLabel v-bind="term('formant')">{{ copy.controls.formant }}</TermLabel> <b>{{ formant.toFixed(2) }}</b></span>
              <input v-model.number="formant" type="range" min="0.55" max="1.65" step="0.01" @input="applyParams">
            </label>
            <label class="rt-slider">
              <span><TermLabel v-bind="term('brightness')">{{ copy.controls.brightness }}</TermLabel> <b>{{ brightness.toFixed(2) }}</b></span>
              <input v-model.number="brightness" type="range" min="-1" max="1" step="0.01" @input="applyParams">
            </label>
            <label class="rt-slider">
              <span><TermLabel v-bind="term('wet')">{{ copy.controls.wet }}</TermLabel> <b>{{ Math.round(wet * 100) }}%</b></span>
              <input v-model.number="wet" type="range" min="0" max="1" step="0.01" @input="applyParams">
            </label>
            <label class="rt-slider">
              <span><TermLabel v-bind="term('output')">{{ copy.controls.output }}</TermLabel> <b>{{ Math.round(outputGain * 100) }}%</b></span>
              <input v-model.number="outputGain" type="range" min="0" max="2" step="0.01" @input="applyParams">
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
                <div class="rt-meter__fill" :style="{ height: `${meterFillPercent(meter.inputRms)}%` }">
                  <span class="rt-meter__zones"></span>
                </div>
                <i v-if="meter.inputPeak > 0" class="rt-meter__peak" :style="{ bottom: `${meterFillPercent(meter.inputPeak)}%` }"></i>
                <i v-if="inputHold > 0" class="rt-meter__hold" :style="{ bottom: `${meterFillPercent(inputHold)}%` }"></i>
              </div>
              <b>IN</b>
            </div>
            <div class="rt-meter">
              <div class="rt-meter__track">
                <button
                  class="rt-clip"
                  :class="{ 'rt-clip--lit': clipped }"
                  :title="copy.metrics.clip"
                  @click="clipped = false"
                >CLIP</button>
                <div class="rt-meter__fill" :style="{ height: `${meterFillPercent(meter.outputRms)}%` }">
                  <span class="rt-meter__zones"></span>
                </div>
                <i v-if="meter.outputPeak > 0" class="rt-meter__peak" :style="{ bottom: `${meterFillPercent(meter.outputPeak)}%` }"></i>
                <i v-if="outputHold > 0" class="rt-meter__hold" :style="{ bottom: `${meterFillPercent(outputHold)}%` }"></i>
              </div>
              <b>OUT</b>
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

<style scoped src="./realtime-fx/realtimeFxLayout.css"></style>
<style scoped src="./realtime-fx/realtimeFxMeters.css"></style>
<style scoped src="./realtime-fx/realtimeFxResponsive.css"></style>
