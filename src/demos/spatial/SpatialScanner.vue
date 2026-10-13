<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import ToolShell from '@/components/ToolShell.vue';
import ToolStatusBar, { type ToolStatusField } from '@/components/ToolStatusBar.vue';
import {
  AudioSource,
  DemoEmpty,
  DemoNotice,
  MetricItem,
  TechPanel,
  TermLabel,
  Tooltip,
} from '@/components/ui';
import { useI18n } from '@/composables/useI18n';
import { useTheme } from '@/composables/useTheme';
import { useWasmBoot } from '@/composables/useWasmBoot';
import RoomScene from '@/demos/spatial/RoomScene.vue';
import {
  enCopy,
  jaCopy,
  PRESET_GEOMETRY,
  PRESET_ORDER,
  type PresetId,
  SPATIAL_TERM_SLUGS,
  type SpatialTermKey,
} from '@/demos/spatial/spatialCopy';
import { exportStem, scanReport } from '@/demos/spatial/spatialExport';
import { useSpatialAudio } from '@/demos/spatial/useSpatialAudio';
import { useSpatialScanner } from '@/demos/spatial/useSpatialScanner';
import { downloadBlob, jsonBlob } from '@/utils/audio';

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
const canSaveAudio = computed(() => !!audio.renderedKind.value && !audio.isMorphing.value);
const canSaveReport = computed(() => !!sceneResult.value && !busy.value);

const statusFields = computed<ToolStatusField[]>(() => {
  const r = sceneResult.value;
  const fields: ToolStatusField[] = [
    fileName.value
      ? { key: 'FILE', value: fileName.value, wide: true }
      : {
          key: 'ROOM',
          value: activePreset.value ? copy.value.rooms[activePreset.value].label : '-',
        },
    {
      key: 'MODE',
      value: result.value
        ? result.value.isBlind
          ? copy.value.metrics.modeBlind
          : copy.value.metrics.modeIr
        : '-',
    },
    { key: 'VOL', value: r ? fmtVol(r.room.volume) : '-', divider: true },
    { key: 'RT60', value: r ? fmtS(r.acoustic.rt60) : '-' },
    { key: 'CONF', value: r ? fmtPct(r.confidence) : '-' },
  ];
  if (busy.value) fields.push({ key: 'SCAN', value: `${Math.round(progress.value * 100)}%` });
  return fields;
});

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
    audio.setRoomImpulse(r.rir, r.rirSampleRate, r.rirNotes);
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

const renderNoteText = computed(() =>
  audio.renderNotes.value.map((note) => {
    if (note.kind === 'engine') return note.message;
    if (note.kind !== 'tailCut') return copy.value.renderNotes[note.kind];
    return copy.value.renderNotes.tailCut
      .replace('{seconds}', note.seconds.toFixed(1))
      .replace('{decay}', String(Math.round(note.decayDb)));
  }),
);

const reportContext = computed(() => ({
  preset: activePreset.value,
  fileName: fileName.value,
  engineVersion: libVersion.value,
}));

function onSaveAudio() {
  const blob = audio.renderedWav();
  if (!blob) return;
  const suffix = audio.renderedKind.value === 'morph' ? 'room-morph' : 'impulse';
  downloadBlob(blob, `libsonare-${exportStem(reportContext.value)}-${suffix}.wav`);
}

function onSaveReport() {
  if (!sceneResult.value) return;
  downloadBlob(
    jsonBlob(scanReport(sceneResult.value, reportContext.value)),
    `libsonare-${exportStem(reportContext.value)}-room-estimate.json`,
  );
}

function morphGeometry() {
  if (!sceneResult.value) return null;
  if (activePreset.value) return PRESET_GEOMETRY[activePreset.value];
  const r = sceneResult.value;
  // The worker rebuilds the room with roomGeometryFromEstimate; the page keeps
  // the source placement, which encodes the estimated distance.
  return {
    estimate: {
      lengthM: r.room.length,
      widthM: r.room.width,
      heightM: r.room.height,
      bandAbsorption: r.bands.map((band) => band.absorption),
    },
    source: r.dspSource ?? {
      x: Math.min(Math.max(r.source.x, 0.05), r.room.length - 0.05),
      y: Math.min(Math.max(r.source.y, 0.05), r.room.width - 0.05),
      z: Math.min(Math.max(r.source.z, 0.05), r.room.height - 0.05),
    },
    listener: r.listener,
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
      <ToolStatusBar :status="statusKind" :label="statusLabel" :pulse="busy" :fields="statusFields" />
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
            class="demo-btn demo-btn--primary sp-morph"
            :disabled="!canMorph"
            :aria-busy="audio.isMorphing.value"
            @click="onMorph"
          >
            <span>{{ audio.isMorphing.value ? copy.actions.morphing : hasUploadedSource ? copy.actions.morphUpload : copy.actions.morph }}</span>
            <i :style="{ transform: `scaleX(${audio.morphProgress.value})` }" aria-hidden="true"></i>
          </button>
          <div class="sp-exports">
            <button
              type="button"
              class="demo-btn sp-export"
              :disabled="!canSaveAudio"
              @click="onSaveAudio"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M12 3v12m0 0l-5-5m5 5l5-5M4 21h16" />
              </svg>
              <span>{{ audio.renderedKind.value === 'morph' ? copy.actions.saveMorph : copy.actions.saveImpulse }}</span>
            </button>
            <button
              type="button"
              class="demo-btn sp-export"
              :disabled="!canSaveReport"
              @click="onSaveReport"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M12 3v12m0 0l-5-5m5 5l5-5M4 21h16" />
              </svg>
              <span>{{ copy.actions.saveReport }}</span>
            </button>
          </div>
          <div class="sp-notices">
            <DemoNotice v-if="localError" tone="error">{{ localError }}</DemoNotice>
            <DemoNotice v-for="note in renderNoteText" :key="note" tone="warn">{{ note }}</DemoNotice>
            <DemoNotice v-if="sceneResult" tone="hint">{{ copy.notes.morph }}</DemoNotice>
            <DemoNotice v-if="audio.renderedKind.value === 'impulse'" tone="hint">{{ copy.notes.exports }}</DemoNotice>
          </div>
        </TechPanel>

        <TechPanel :title="copy.panels.rooms">
          <div class="sp-rooms" role="group" :aria-label="copy.panels.rooms">
            <button
              v-for="room in rooms"
              :key="room.id"
              type="button"
              class="sp-room"
              :class="{ 'sp-room--active': activePreset === room.id }"
              :aria-pressed="activePreset === room.id"
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
            />
            <div v-if="!result" class="sp-scene__placeholder">
              <svg class="demo-anim-loop" viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
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
            <Transition name="demo-fade">
              <div v-if="busy" class="sp-scene__scan" aria-hidden="true">
                <span class="sp-scene__scan-line demo-anim-loop"></span>
                <span class="sp-scene__scan-label demo-anim-loop">{{ statusLabel }}</span>
              </div>
            </Transition>
          </div>

          <ul class="sp-legend">
            <li><i class="sp-dot" style="--c: var(--demo-accent)"></i>{{ copy.legend.room }}</li>
            <li><i class="sp-dot sp-dot--listener"></i>{{ copy.legend.listener }}</li>
            <li><i class="sp-dot" style="--c: var(--demo-amber)"></i>{{ copy.legend.source }}</li>
            <li><i class="sp-dot sp-dot--ring" style="--c: var(--demo-amber)"></i>{{ copy.legend.shell }}</li>
            <li><i class="sp-dot sp-dot--ring" style="--c: var(--demo-cyan)"></i>{{ copy.legend.critical }}</li>
            <template v-if="result?.truth">
              <li><i class="sp-dot sp-dot--ring" style="--c: var(--demo-success)"></i>{{ copy.legend.truthRoom }}</li>
              <li><i class="sp-dot" style="--c: var(--demo-success)"></i>{{ copy.legend.truthSource }}</li>
            </template>
          </ul>
        </TechPanel>
      </section>

      <!-- RIGHT: estimated metrics -->
      <aside class="sp-lab__right">
        <TechPanel :title="copy.panels.geometry">
          <template #header-right>
            <Tooltip v-if="sceneResult" v-bind="term('confidence')">
              <template #default="{ describedBy, expanded, controls }">
                <button
                  type="button"
                  class="sp-conf"
                  :class="{ 'sp-conf--low': sceneResult.confidence < 0.35 }"
                  :aria-describedby="describedBy"
                  :aria-expanded="expanded"
                  :aria-controls="controls"
                >
                  <i aria-hidden="true"></i>{{ copy.metrics.confidence }} {{ fmtPct(sceneResult.confidence) }}
                </button>
              </template>
            </Tooltip>
          </template>
          <Transition name="demo-fade" mode="out-in">
            <div v-if="sceneResult" :key="sceneResult.room.volume" class="sp-metrics">
              <MetricItem :value="`${sceneResult.room.length.toFixed(1)} × ${sceneResult.room.width.toFixed(1)} × ${sceneResult.room.height.toFixed(1)} m`" variant="accent">
                <template #label><TermLabel v-bind="term('dimensions')">{{ copy.metrics.dimensions }}</TermLabel></template>
              </MetricItem>
              <MetricItem :value="fmtVol(sceneResult.room.volume)">
                <template #label><TermLabel v-bind="term('volume')">{{ copy.metrics.volume }}</TermLabel></template>
              </MetricItem>
              <MetricItem :value="fmtM(sceneResult.sourceDistance)" variant="accent">
                <template #label><TermLabel v-bind="term('sourceDistance')">{{ copy.metrics.sourceDistance }}</TermLabel></template>
              </MetricItem>
              <MetricItem :value="fmtM(sceneResult.criticalDistance)">
                <template #label><TermLabel v-bind="term('criticalDistance')">{{ copy.metrics.criticalDistance }}</TermLabel></template>
              </MetricItem>
              <MetricItem :value="fmtDb(sceneResult.drrDb)">
                <template #label><TermLabel v-bind="term('drr')">{{ copy.metrics.drr }}</TermLabel></template>
              </MetricItem>
              <MetricItem :value="sceneResult.isBlind ? copy.metrics.modeBlind : copy.metrics.modeIr" variant="muted">
                <template #label><TermLabel v-bind="term('mode')">{{ copy.metrics.mode }}</TermLabel></template>
              </MetricItem>
            </div>
            <DemoEmpty v-else-if="invalid" compact :title="copy.scene.noRoom" />
            <DemoEmpty v-else compact :title="copy.scene.noRoom">{{ copy.scene.placeholder }}</DemoEmpty>
          </Transition>
        </TechPanel>

        <Transition name="demo-rise">
          <TechPanel v-if="sceneResult" :title="copy.panels.acoustics">
            <div class="sp-metrics">
              <MetricItem :value="fmtS(sceneResult.acoustic.rt60)" variant="accent">
                <template #label><TermLabel v-bind="term('rt60')">{{ copy.metrics.rt60 }}</TermLabel></template>
              </MetricItem>
              <MetricItem :value="fmtS(sceneResult.acoustic.edt)">
                <template #label><TermLabel v-bind="term('edt')">{{ copy.metrics.edt }}</TermLabel></template>
              </MetricItem>
              <MetricItem :value="fmtDb(sceneResult.acoustic.c50)">
                <template #label><TermLabel v-bind="term('c50')">{{ copy.metrics.c50 }}</TermLabel></template>
              </MetricItem>
              <MetricItem :value="fmtDb(sceneResult.acoustic.c80)">
                <template #label><TermLabel v-bind="term('c80')">{{ copy.metrics.c80 }}</TermLabel></template>
              </MetricItem>
              <MetricItem :value="fmtPct(sceneResult.acoustic.d50)">
                <template #label><TermLabel v-bind="term('d50')">{{ copy.metrics.d50 }}</TermLabel></template>
              </MetricItem>
            </div>
          </TechPanel>
        </Transition>

        <Transition name="demo-rise">
          <TechPanel v-if="sceneResult && sceneResult.bands.length" :title="copy.panels.bands">
            <div class="sp-bands">
              <div class="sp-bands__head">
                <span><TermLabel v-bind="term('band')">{{ copy.bands.freq }}</TermLabel></span>
                <span><TermLabel v-bind="term('rt60')">{{ copy.bands.rt60 }}</TermLabel></span>
                <span><TermLabel v-bind="term('absorption')">{{ copy.bands.absorption }}</TermLabel></span>
              </div>
              <div v-for="band in sceneResult.bands" :key="band.freq" class="sp-band">
                <span class="sp-band__freq">{{ band.label }}<small>{{ copy.bands.hz }}</small></span>
                <span class="sp-band__bar">
                  <span class="sp-band__track">
                    <i :style="{ transform: `scaleX(${Math.min(1, band.rt60 / maxBandRt60)})` }"></i>
                  </span>
                  <em>{{ band.rt60.toFixed(2) }}</em>
                </span>
                <span class="sp-band__abs">{{ fmtPct(band.absorption) }}</span>
              </div>
            </div>
          </TechPanel>
        </Transition>

        <DemoNotice v-if="result?.truth" tone="info">{{ copy.notes.truth }}</DemoNotice>
        <DemoNotice v-else-if="showLowConfidence" tone="warn">{{ copy.notes.lowConfidence }}</DemoNotice>
        <DemoNotice v-else-if="sceneResult?.isBlind" tone="hint">{{ copy.notes.blind }}</DemoNotice>
      </aside>
    </div>
  </ToolShell>
</template>

<style scoped src="./spatialLayout.css"></style>
