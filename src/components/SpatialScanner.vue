<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import RoomScene from '@/components/spatial/RoomScene.vue';
import {
  enCopy,
  jaCopy,
  PRESET_GEOMETRY,
  PRESET_ORDER,
  type PresetId,
  SPATIAL_TERM_SLUGS,
  type SpatialTermKey,
} from '@/components/spatial/spatialCopy';
import ToolShell from '@/components/ToolShell.vue';
import {
  AudioSource,
  MetricItem,
  StatusIndicator,
  TechPanel,
  TermLabel,
  Tooltip,
} from '@/components/ui';
import { useI18n } from '@/composables/useI18n';
import { useSpatialAudio } from '@/composables/useSpatialAudio';
import { useSpatialScanner } from '@/composables/useSpatialScanner';
import { useTheme } from '@/composables/useTheme';
import { useWasmBoot } from '@/composables/useWasmBoot';

const { locale, localizedPath, alternateLocalePath, localizedValue } = useI18n();
const { isDark } = useTheme();
const copy = computed(() => localizedValue({ en: enCopy, ja: jaCopy }));

// Create the audio engine first so the scanner can decode uploads through its single
// playback AudioContext instead of opening a second one.
const audio = useSpatialAudio();
const scanner = useSpatialScanner({ getAudioContext: audio.getContext });
const { status, progress, error, fileName, activePreset, result } = scanner;

const { version: libVersion } = useWasmBoot();
const treatAsIr = ref(false);
const autoRotate = ref(true);
const morphError = ref(false);
const uploadError = ref(false);

const docsPath = computed(() => localizedPath('/docs/acoustic-analysis'));
const glossaryBase = computed(() => localizedPath('/docs/glossary'));
const oppositeLocalePath = computed(() => alternateLocalePath('/spatial'));

/** Build rich-tooltip props for a metric/term from the copy table. */
function term(key: SpatialTermKey) {
  const t = copy.value.terms;
  const item = t.items[key];
  const slug = SPATIAL_TERM_SLUGS[key];
  return {
    eyebrow: t.eyebrow,
    title: item.title,
    body: item.body,
    tip: item.tip,
    tipLabel: t.tipLabel,
    href: slug ? `${glossaryBase.value}/${slug}` : docsPath.value,
    linkLabel: slug ? t.linkLabel : copy.value.help.docs,
  };
}

const sceneColors = computed(() =>
  isDark.value
    ? { accent: '#8B5CF6', cyan: '#22D3EE', amber: '#F59E0B', truth: '#34D399' }
    : { accent: '#7C3AED', cyan: '#0891B2', amber: '#B45309', truth: '#059669' },
);

const statusKind = computed<'idle' | 'active' | 'warning' | 'error'>(() => {
  if (status.value === 'error') return 'error';
  if (status.value === 'ready') return 'active';
  if (status.value === 'scanning' || status.value === 'decoding') return 'warning';
  return 'idle';
});
const statusLabel = computed(() => copy.value.status[status.value]);
const busy = computed(() => status.value === 'scanning' || status.value === 'decoding');
const hasUploadedSource = computed(() => !!fileName.value);
const canMorph = computed(() => !!sceneResult.value && !busy.value && !audio.isMorphing.value);

const rooms = computed(() =>
  PRESET_ORDER.map((id) => ({
    id,
    label: copy.value.rooms[id].label,
    hint: copy.value.rooms[id].hint,
  })),
);

const localError = computed(() => {
  if (morphError.value) return copy.value.errors.morph;
  if (uploadError.value) return copy.value.errors.decode;
  if (!error.value) return null;
  if (error.value === 'decode') return copy.value.errors.decode;
  return error.value;
});

const maxBandRt60 = computed(() => {
  const bands = result.value?.bands ?? [];
  return Math.max(0.1, ...bands.map((b) => b.rt60));
});

const sceneResult = computed(() => (result.value?.valid ? result.value : null));
const invalid = computed(() => !!result.value && !result.value.valid);
const showLowConfidence = computed(
  () =>
    !!result.value && result.value.valid && !result.value.truth && result.value.confidence < 0.35,
);

const sourceName = computed(() => {
  if (audio.contentLabel.value) return audio.contentLabel.value;
  if (fileName.value) return fileName.value;
  if (activePreset.value && audio.hasContent.value) {
    return `${copy.value.rooms[activePreset.value].label} · ${copy.value.audio.impulse}`;
  }
  return '';
});

function onPreset(id: PresetId) {
  morphError.value = false;
  uploadError.value = false;
  scanner.scanPreset(id);
}
function onFile(file: File) {
  morphError.value = false;
  uploadError.value = false;
  void audio
    .setUpload(file)
    .then((buffer) => scanner.scanDecoded(buffer, file.name, treatAsIr.value))
    .catch((e) => {
      if (e instanceof DOMException && e.name === 'AbortError') return;
      console.warn('Could not decode uploaded audio', e);
      uploadError.value = true;
    });
}
function onClear() {
  morphError.value = false;
  uploadError.value = false;
  audio.clearSource();
  scanner.clear();
}

// Re-run the estimate when the "treat as impulse response" mode changes: it selects a
// different acoustic pipeline (isolated-impulse vs blind), so RT60/clarity must update.
watch(treatAsIr, () => scanner.rescan(treatAsIr.value));

async function onMorph() {
  const geometry = morphGeometry();
  if (!geometry) return;
  morphError.value = false;
  try {
    await audio.renderRoomMorph(geometry, {
      label: `${copy.value.audio.morphed} · ${activePreset.value ? copy.value.rooms[activePreset.value].label : fileName.value}`,
    });
  } catch (e) {
    console.warn('Room morph failed', e);
    morphError.value = true;
  }
}

// When a preset finishes scanning, audition its synthesized impulse response — the
// room's own acoustic signature, not an arbitrary music clip.
watch(result, (r) => {
  if (r?.rir && r.rirSampleRate) {
    audio.setRoomImpulse(r.rir, r.rirSampleRate);
  }
});

function fmtM(v: number) {
  return `${v.toFixed(1)} m`;
}
function fmtVol(v: number) {
  return `${v >= 100 ? Math.round(v) : v.toFixed(1)} m³`;
}
function fmtS(v: number) {
  return `${v.toFixed(2)} s`;
}
function fmtDb(v: number | null) {
  if (v === null || !Number.isFinite(v)) return '—';
  return `${v >= 0 ? '+' : ''}${v.toFixed(1)} dB`;
}
function fmtPct(v: number | null) {
  if (v === null || !Number.isFinite(v)) return '—';
  return `${Math.round(v * 100)}%`;
}

function morphGeometry() {
  if (!sceneResult.value) return null;
  if (activePreset.value) return PRESET_GEOMETRY[activePreset.value];
  const r = sceneResult.value;
  const absorptions = r.bands.map((band) => band.absorption).filter((v) => v > 0);
  const absorption =
    absorptions.length > 0
      ? absorptions.reduce((sum, value) => sum + value, 0) / absorptions.length
      : 0.18;
  const dspSource = r.dspSource ?? {
    x: Math.min(Math.max(r.source.x, 0.05), r.room.length - 0.05),
    y: Math.min(Math.max(r.source.y, 0.05), r.room.width - 0.05),
    z: Math.min(Math.max(r.source.z, 0.05), r.room.height - 0.05),
  };
  return {
    lengthM: r.room.length,
    widthM: r.room.width,
    heightM: r.room.height,
    absorption,
    sourceX: dspSource.x,
    sourceY: dspSource.y,
    sourceZ: dspSource.z,
    listenerX: r.listener.x,
    listenerY: r.listener.y,
    listenerZ: r.listener.z,
  };
}
</script>

<template>
  <ToolShell
    demo-id="spatial"
    :title="copy.title"
    :subtitle="copy.subtitle"
    :version="libVersion"
    :status="statusKind"
    :status-label="copy.localOnly"
    :docs-path="docsPath"
    :guide-title="copy.guide.title"
    :guide-body="copy.guide.body"
    :guide-link-label="copy.guide.docs"
    :opposite-locale-path="oppositeLocalePath"
  >
    <template #statusbar>
      <div class="sp-statusbar">
        <StatusIndicator :status="statusKind" :label="statusLabel" :pulse="busy" />
        <span v-if="fileName" class="sp-statusbar__field"><b>FILE</b>{{ fileName }}</span>
        <span v-else-if="activePreset" class="sp-statusbar__field"><b>ROOM</b>{{ copy.rooms[activePreset].label }}</span>
        <span v-if="result" class="sp-statusbar__field">
          <b>MODE</b>{{ result.isBlind ? copy.metrics.modeBlind : copy.metrics.modeIr }}
        </span>
        <span v-if="busy" class="sp-statusbar__progress" aria-hidden="true">
          <i :style="{ width: `${Math.round(progress * 100)}%` }"></i>
        </span>
      </div>
    </template>

    <div class="sp-lab">
      <!-- LEFT: source + sample rooms -->
      <aside class="sp-lab__left">
        <TechPanel :title="copy.panels.input">
          <AudioSource
            class="sp-source"
            :drop-title="copy.audio.dropTitle"
            :drop-hint="copy.audio.dropHint"
            :formats="copy.audio.formats"
            :source-name="sourceName"
            :playable="audio.hasContent.value"
            :is-playing="audio.isPlaying.value"
            :progress="audio.progress.value"
            :current-time="audio.currentTime.value"
            :duration="audio.duration.value"
            :busy="busy"
            @file="onFile"
            @clear="onClear"
            @playpause="audio.toggle"
            @seek="audio.seek"
          />
          <label class="sp-toggle">
            <input v-model="treatAsIr" type="checkbox" />
            <span>
              <b>{{ copy.actions.irToggle }}</b>
              <small>{{ copy.actions.irHint }}</small>
            </span>
          </label>
          <button
            type="button"
            class="sp-morph"
            :disabled="!canMorph"
            @click="onMorph"
          >
            <span>{{ audio.isMorphing.value ? copy.actions.morphing : hasUploadedSource ? copy.actions.morphUpload : copy.actions.morph }}</span>
            <i :style="{ width: `${Math.round(audio.morphProgress.value * 100)}%` }" aria-hidden="true"></i>
          </button>
          <p v-if="sceneResult" class="sp-hint">{{ copy.notes.morph }}</p>
          <p v-if="localError" class="sp-error">{{ localError }}</p>
        </TechPanel>

        <TechPanel :title="copy.panels.rooms">
          <div class="sp-rooms">
            <button
              v-for="room in rooms"
              :key="room.id"
              class="sp-room"
              :class="{ 'sp-room--active': activePreset === room.id }"
              :disabled="busy"
              @click="onPreset(room.id)"
            >
              <span class="sp-room__label">{{ room.label }}</span>
              <span class="sp-room__hint">{{ room.hint }}</span>
            </button>
          </div>
        </TechPanel>
      </aside>

      <!-- CENTER: 3D reconstruction -->
      <section class="sp-lab__center">
        <TechPanel :title="copy.panels.scene" variant="transparent">
          <template #header-right>
            <label class="sp-rotate">
              <input v-model="autoRotate" type="checkbox" />
              <span>{{ copy.scene.autoRotate }}</span>
            </label>
          </template>
          <div class="sp-scene">
            <RoomScene
              :result="sceneResult"
              :is-dark="isDark"
              :auto-rotate="autoRotate"
              :level="audio.level.value"
              :accent="sceneColors.accent"
              :cyan="sceneColors.cyan"
              :amber="sceneColors.amber"
              :truth="sceneColors.truth"
            />
            <div v-if="!result" class="sp-scene__placeholder">
              <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M12 2 2 7l10 5 10-5-10-5Z" />
                <path d="m2 17 10 5 10-5" />
                <path d="m2 12 10 5 10-5" />
              </svg>
              <p>{{ copy.scene.placeholder }}</p>
            </div>
            <div v-else-if="invalid" class="sp-scene__placeholder sp-scene__placeholder--warn">
              <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
                <path d="M12 9v4" /><path d="M12 17h.01" />
              </svg>
              <p>{{ copy.notes.invalid }}</p>
            </div>
            <div v-if="sceneResult" class="sp-scene__hud" aria-hidden="true">{{ copy.scene.drag }}</div>
            <div v-if="busy" class="sp-scene__scan" aria-hidden="true">
              <span class="sp-scene__scan-line"></span>
              <span class="sp-scene__scan-label">{{ statusLabel }}</span>
            </div>
          </div>

          <ul class="sp-legend">
            <li><i class="sp-dot" style="--c: var(--demo-accent)"></i>{{ copy.legend.room }}</li>
            <li><i class="sp-dot sp-dot--listener"></i>{{ copy.legend.listener }}</li>
            <li><i class="sp-dot" style="--c: var(--demo-amber)"></i>{{ copy.legend.source }}</li>
            <li><i class="sp-dot sp-dot--ring" style="--c: var(--demo-amber)"></i>{{ copy.legend.shell }}</li>
            <li><i class="sp-dot sp-dot--ring" style="--c: var(--demo-cyan)"></i>{{ copy.legend.critical }}</li>
            <template v-if="result?.truth">
              <li><i class="sp-dot sp-dot--ring" :style="{ '--c': sceneColors.truth }"></i>{{ copy.legend.truthRoom }}</li>
              <li><i class="sp-dot" :style="{ '--c': sceneColors.truth }"></i>{{ copy.legend.truthSource }}</li>
            </template>
          </ul>
        </TechPanel>
      </section>

      <!-- RIGHT: estimated metrics -->
      <aside class="sp-lab__right">
        <TechPanel :title="copy.panels.geometry">
          <template #header-right>
            <Tooltip v-if="sceneResult" v-bind="term('confidence')">
              <span class="sp-conf" :class="{ 'sp-conf--low': sceneResult.confidence < 0.35 }">
                <i aria-hidden="true"></i>{{ copy.metrics.confidence }} {{ fmtPct(sceneResult.confidence) }}
              </span>
            </Tooltip>
          </template>
          <div v-if="sceneResult" class="sp-metrics">
            <MetricItem :value="`${result.room.length.toFixed(1)} × ${result.room.width.toFixed(1)} × ${result.room.height.toFixed(1)} m`" variant="accent">
              <template #label><TermLabel v-bind="term('dimensions')">{{ copy.metrics.dimensions }}</TermLabel></template>
            </MetricItem>
            <MetricItem :value="fmtVol(result.room.volume)">
              <template #label><TermLabel v-bind="term('volume')">{{ copy.metrics.volume }}</TermLabel></template>
            </MetricItem>
            <MetricItem :value="fmtM(result.sourceDistance)" variant="accent">
              <template #label><TermLabel v-bind="term('sourceDistance')">{{ copy.metrics.sourceDistance }}</TermLabel></template>
            </MetricItem>
            <MetricItem :value="fmtM(result.criticalDistance)">
              <template #label><TermLabel v-bind="term('criticalDistance')">{{ copy.metrics.criticalDistance }}</TermLabel></template>
            </MetricItem>
            <MetricItem :value="fmtDb(result.drrDb)">
              <template #label><TermLabel v-bind="term('drr')">{{ copy.metrics.drr }}</TermLabel></template>
            </MetricItem>
            <MetricItem :value="result.isBlind ? copy.metrics.modeBlind : copy.metrics.modeIr" variant="muted">
              <template #label><TermLabel v-bind="term('mode')">{{ copy.metrics.mode }}</TermLabel></template>
            </MetricItem>
          </div>
          <p v-else-if="invalid" class="sp-empty">{{ copy.notes.invalid }}</p>
          <p v-else class="sp-empty">{{ copy.scene.placeholder }}</p>
        </TechPanel>

        <TechPanel v-if="sceneResult" :title="copy.panels.acoustics">
          <div class="sp-metrics">
            <MetricItem :value="fmtS(result.acoustic.rt60)" variant="accent">
              <template #label><TermLabel v-bind="term('rt60')">{{ copy.metrics.rt60 }}</TermLabel></template>
            </MetricItem>
            <MetricItem :value="fmtS(result.acoustic.edt)">
              <template #label><TermLabel v-bind="term('edt')">{{ copy.metrics.edt }}</TermLabel></template>
            </MetricItem>
            <MetricItem :value="fmtDb(result.acoustic.c50)">
              <template #label><TermLabel v-bind="term('c50')">{{ copy.metrics.c50 }}</TermLabel></template>
            </MetricItem>
            <MetricItem :value="fmtDb(result.acoustic.c80)">
              <template #label><TermLabel v-bind="term('c80')">{{ copy.metrics.c80 }}</TermLabel></template>
            </MetricItem>
            <MetricItem :value="fmtPct(result.acoustic.d50)">
              <template #label><TermLabel v-bind="term('d50')">{{ copy.metrics.d50 }}</TermLabel></template>
            </MetricItem>
          </div>
        </TechPanel>

        <TechPanel v-if="sceneResult && sceneResult.bands.length" :title="copy.panels.bands">
          <div class="sp-bands">
            <div class="sp-bands__head">
              <span><TermLabel v-bind="term('band')">{{ copy.bands.freq }}</TermLabel></span>
              <span><TermLabel v-bind="term('rt60')">{{ copy.bands.rt60 }}</TermLabel></span>
              <span><TermLabel v-bind="term('absorption')">{{ copy.bands.absorption }}</TermLabel></span>
            </div>
            <div v-for="band in result.bands" :key="band.freq" class="sp-band">
              <span class="sp-band__freq">{{ band.label }}<small>{{ copy.bands.hz }}</small></span>
              <span class="sp-band__bar">
                <i :style="{ width: `${Math.min(100, (band.rt60 / maxBandRt60) * 100)}%` }"></i>
                <em>{{ band.rt60.toFixed(2) }}</em>
              </span>
              <span class="sp-band__abs">{{ fmtPct(band.absorption) }}</span>
            </div>
          </div>
        </TechPanel>

        <div v-if="invalid" class="sp-note sp-note--warn">{{ copy.notes.invalid }}</div>
        <div v-else-if="result?.truth" class="sp-note sp-note--info">{{ copy.notes.truth }}</div>
        <div v-else-if="showLowConfidence" class="sp-note sp-note--warn">{{ copy.notes.lowConfidence }}</div>
        <div v-else-if="result?.isBlind" class="sp-note">{{ copy.notes.blind }}</div>
      </aside>
    </div>
  </ToolShell>
</template>

<style scoped src="./spatial/spatialLayout.css"></style>
