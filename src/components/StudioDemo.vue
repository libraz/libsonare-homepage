<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import ChannelStrip from '@/components/studio/ChannelStrip.vue';
import StepRow from '@/components/studio/StepRow.vue';
import {
  defaultPattern,
  enCopy,
  jaCopy,
  STEP_COUNT,
  STUDIO_TERM_SLUGS,
  STUDIO_TRACKS,
  type StudioTermKey,
} from '@/components/studio/studioCopy';
import { drawStudioWaveforms, type StudioStemView } from '@/components/studio/studioWaveforms';
import ToolShell from '@/components/ToolShell.vue';
import { RotaryKnob, StatusIndicator, Tooltip } from '@/components/ui';
import { useI18n } from '@/composables/useI18n';
import { useStudioEngine } from '@/composables/useStudioEngine';
import { meterFillPercent } from '@/utils/scale';
import sonareJsUrl from '@/wasm/sonare.js?url';
import sonareWasmUrl from '@/wasm/sonare.wasm?url';

const { locale, localizedPath, alternateLocalePath, localizedValue } = useI18n();
const copy = computed(() => localizedValue({ en: enCopy, ja: jaCopy }));
const engine = useStudioEngine(sonareJsUrl, sonareWasmUrl);

const pattern = ref(defaultPattern());
const bpm = ref(120);
const trackGains = ref(STUDIO_TRACKS.map(() => 0.9));
const trackMutes = ref(STUDIO_TRACKS.map(() => false));
const masterGain = ref(0.9);
const downloading = ref(false);

const TRACK_HUES: Record<string, { fill: string; glow: string }> = {
  violet: { fill: 'var(--demo-accent)', glow: 'var(--demo-accent-dim)' },
  cyan: { fill: 'var(--demo-cyan)', glow: 'rgba(34, 211, 238, 0.3)' },
  amber: { fill: 'var(--demo-amber)', glow: 'rgba(245, 158, 11, 0.3)' },
};

const isReady = engine.ready;
const isStarting = engine.starting;
const isPlaying = engine.playing;

const statusKind = computed<'idle' | 'active' | 'warning' | 'error'>(() => {
  if (engine.error.value) return 'error';
  if (isPlaying.value) return 'active';
  if (isStarting.value) return 'warning';
  return 'idle';
});
const statusLabel = computed(() => {
  if (engine.error.value) return copy.value.status.error;
  if (isPlaying.value) return copy.value.status.playing;
  if (isStarting.value) return copy.value.status.starting;
  if (isReady.value) return copy.value.status.ready;
  return copy.value.status.idle;
});

const activeStep = computed(() =>
  isPlaying.value ? Math.floor(engine.position.value * STEP_COUNT) % STEP_COUNT : -1,
);
/** Bar.beat.sixteenth readout for the LCD (single-bar loop → bar is always 1). */
const positionLabel = computed(() => {
  if (!isPlaying.value) return '1.1.1';
  const beat = Math.floor(engine.position.value * 4) % 4;
  const sixteenth = Math.floor(engine.position.value * 16) % 4;
  return `1.${beat + 1}.${sixteenth + 1}`;
});

/** Master VU scale stops, positioned linearly in dB over the -60..0 range. */
const VU_MARKS = [-60, -40, -24, -12, -6, 0].map((db) => ({
  db,
  pct: ((db + 60) / 60) * 100,
}));
const masterVuPercent = computed(() =>
  isReady.value ? meterFillPercent(engine.masterLevel.value, -60, 0) : 0,
);

/** Exports render nothing when every audible track is empty or muted. */
const hasExportableNotes = computed(() =>
  STUDIO_TRACKS.some(
    (_, t) => !trackMutes.value[t] && pattern.value[t].some((row) => row.some(Boolean)),
  ),
);

const docsPath = computed(() => localizedPath('/docs/project-editing'));
const oppositeLocalePath = computed(() => alternateLocalePath('/studio'));
const glossaryBase = computed(() => localizedPath('/docs/glossary'));

/** Build the rich-tooltip props for a control from the copy + slug tables. */
function term(key: StudioTermKey) {
  const t = copy.value.terms;
  const item = t.items[key];
  const slug = STUDIO_TERM_SLUGS[key];
  return {
    eyebrow: t.eyebrow,
    title: item.title,
    body: item.body,
    tip: item.tip,
    tipLabel: t.tipLabel,
    defaultRationale: 'defaultRationale' in item ? item.defaultRationale : undefined,
    defaultLabel: t.resetLabel,
    href: slug ? `${glossaryBase.value}/${slug}` : undefined,
    linkLabel: t.linkLabel,
  };
}

const canvases = ref<(HTMLCanvasElement | null)[]>(STUDIO_TRACKS.map(() => null));

function setCanvas(index: number, el: HTMLCanvasElement | null) {
  canvases.value[index] = el;
}

// flush: 'post' so the canvases exist before the first draw.
watch(engine.stemViews, drawWaveforms, { flush: 'post' });

onMounted(() => {
  window.addEventListener('keydown', onKeyDown);
  void bootSession();
});

onUnmounted(() => {
  window.removeEventListener('keydown', onKeyDown);
  if (rebuildTimer) clearTimeout(rebuildTimer);
  void engine.dispose();
});

function isTypingTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName);
}

/** Space toggles the transport, like every DAW. */
function onKeyDown(event: KeyboardEvent) {
  if (event.code !== 'Space' || !isReady.value) return;
  if (isTypingTarget(event.target)) return;
  if (event.target instanceof HTMLButtonElement) event.target.blur();
  event.preventDefault();
  togglePlay();
}

/**
 * Boot the engine and pre-render the loop at mount. Playback stays stopped —
 * the Play button (a real gesture) starts sound.
 */
async function bootSession() {
  const ok = await engine.start();
  if (!ok) return;
  for (let i = 0; i < STUDIO_TRACKS.length; i++) {
    engine.setTrackGain(i, trackGains.value[i]);
    engine.setTrackMute(i, trackMutes.value[i]);
  }
  engine.setMasterGain(masterGain.value);
  engine.rebuild(pattern.value, bpm.value);
}

let rebuildTimer: ReturnType<typeof setTimeout> | null = null;

/** Debounce rapid grid edits / tempo drags into one offline re-render. */
function scheduleRebuild() {
  if (rebuildTimer) clearTimeout(rebuildTimer);
  rebuildTimer = setTimeout(() => {
    rebuildTimer = null;
    engine.rebuild(pattern.value, bpm.value);
  }, 120);
}

function toggleStep(track: number, row: number, step: number) {
  const next = pattern.value.map((t) => t.map((r) => r.slice()));
  const on = !next[track][row][step];
  next[track][row][step] = on;
  pattern.value = next;
  // Groovebox-style pad audition: hear the note as you arm it. While the
  // transport runs the loop itself plays it, so preview only when stopped.
  if (on && !isPlaying.value) engine.audition(track, row);
  scheduleRebuild();
}

function togglePlay() {
  if (isPlaying.value) engine.stop();
  else engine.play();
}

function setTempo(value: number) {
  bpm.value = Math.round(value);
  scheduleRebuild();
}

function setTrackGain(index: number, value: number) {
  const next = trackGains.value.slice();
  next[index] = value;
  trackGains.value = next;
  engine.setTrackGain(index, value);
}

function toggleMute(index: number) {
  const next = trackMutes.value.slice();
  next[index] = !next[index];
  trackMutes.value = next;
  engine.setTrackMute(index, next[index]);
}

function setMaster(value: number) {
  masterGain.value = value;
  engine.setMasterGain(value);
}

function drawWaveforms(views: StudioStemView[]) {
  drawStudioWaveforms(canvases.value, views);
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

async function downloadWav() {
  if (downloading.value) return;
  downloading.value = true;
  try {
    // Yield a frame so the button label updates before the offline render.
    await new Promise((resolve) => setTimeout(resolve, 30));
    const blob = engine.exportWav(pattern.value, bpm.value);
    if (blob) triggerDownload(blob, `libsonare-studio-${bpm.value}bpm.wav`);
  } finally {
    downloading.value = false;
  }
}

function downloadMidi() {
  const blob = engine.exportMidi(pattern.value, bpm.value);
  if (blob) triggerDownload(blob, `libsonare-studio-${bpm.value}bpm.mid`);
}
</script>

<template>
  <ToolShell
    demo-id="studio"
    :title="copy.title"
    :subtitle="copy.subtitle"
    :version="engine.libVersion.value"
    :status="statusKind"
    :status-label="copy.localOnly"
    :docs-path="docsPath"
    :guide-title="copy.guide.title"
    :guide-body="copy.guide.body"
    :guide-link-label="copy.guide.docs"
    :opposite-locale-path="oppositeLocalePath"
  >
    <template #statusbar>
      <div class="st-statusbar">
        <StatusIndicator :status="statusKind" :label="statusLabel" :pulse="isPlaying || isStarting" />
        <span class="st-statusbar__field"><b>{{ copy.statusbar.pos }}</b>{{ positionLabel }}</span>
        <span class="st-statusbar__field"><b>{{ copy.statusbar.bpm }}</b>{{ bpm }}</span>
        <span v-if="engine.error.value" class="st-error">{{ copy.errors.start }}</span>
      </div>
    </template>

    <div class="st-deck">
      <!-- ===== TRANSPORT ===== -->
      <div class="st-deck__transport">
        <div class="st-brand">
          <span class="st-brand__name">LIBSONARE</span>
          <span class="st-brand__model">{{ copy.deck.model }}</span>
          <span class="st-brand__tag">{{ copy.deck.tagline }}</span>
        </div>

        <Tooltip v-bind="term('transport')">
          <button
            type="button"
            class="st-play"
            :class="{ 'st-play--on': isPlaying }"
            :aria-label="isPlaying ? copy.transport.stop : copy.transport.play"
            :disabled="!isReady"
            @click="togglePlay"
          >
            <svg v-if="!isPlaying" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M8 5v14l11-7z" />
            </svg>
            <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M6 6h12v12H6z" />
            </svg>
          </button>
        </Tooltip>

        <Tooltip v-bind="term('position')">
        <div class="st-lcd" role="status" tabindex="0">
          <div class="st-lcd__cell">
            <span class="st-lcd__key">{{ copy.statusbar.bpm }}</span>
            <span class="st-lcd__value st-lcd__value--big">{{ bpm }}</span>
          </div>
          <div class="st-lcd__divider"></div>
          <div class="st-lcd__cell">
            <span class="st-lcd__key">{{ copy.statusbar.pos }}</span>
            <span class="st-lcd__value">{{ positionLabel }}</span>
          </div>
          <i class="st-lcd__dot" :class="{ 'st-lcd__dot--on': isPlaying }"></i>
        </div>
        </Tooltip>

        <RotaryKnob
          v-bind="term('tempo')"
          :model-value="bpm"
          :min="80" :max="160" :step="1"
          :label="copy.transport.tempo"
          :display="`${bpm}`"
          :default-value="120"
          :size="48"
          @update:model-value="setTempo"
        />

        <div class="st-runlights" aria-hidden="true">
          <i
            v-for="n in STEP_COUNT"
            :key="n"
            class="st-runlights__led"
            :class="{
              'st-runlights__led--beat': (n - 1) % 4 === 0,
              'st-runlights__led--on': n - 1 === activeStep,
            }"
          ></i>
        </div>

        <div class="st-exports">
          <Tooltip v-bind="term('bounce')">
            <button
              type="button"
              class="st-bounce"
              :disabled="downloading || !isReady || !hasExportableNotes"
              @click="downloadWav"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M12 3v12m0 0l-5-5m5 5l5-5M4 21h16" />
              </svg>
              {{ downloading ? copy.transport.downloading : copy.transport.download }}
            </button>
          </Tooltip>
          <Tooltip v-bind="term('midi')">
            <button
              type="button"
              class="st-bounce st-bounce--ghost"
              :disabled="!isReady || !hasExportableNotes"
              @click="downloadMidi"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M9 18V6l10-2v12" />
                <circle cx="6.5" cy="18" r="2.5" />
                <circle cx="16.5" cy="16" r="2.5" />
              </svg>
              {{ copy.transport.midi }}
            </button>
          </Tooltip>
        </div>
      </div>

      <!-- ===== SEQUENCER ===== -->
      <div class="st-deck__seq">
        <div class="st-sec-head">
          <h3 class="st-sec-title">{{ copy.sections.sequencer }}</h3>
          <Tooltip v-bind="term('step')">
            <button type="button" class="st-sec-info" :aria-label="term('step').title">
              <span aria-hidden="true">i</span>
            </button>
          </Tooltip>
        </div>
        <div class="st-ruler" aria-hidden="true">
          <span class="st-ruler__gutter"></span>
          <div class="st-ruler__cells">
            <span
              v-for="n in STEP_COUNT"
              :key="n"
              class="st-ruler__cell"
              :class="{ 'st-ruler__cell--beat': (n - 1) % 4 === 0 }"
            >{{ (n - 1) % 4 === 0 ? n : '·' }}</span>
          </div>
        </div>
        <div
          v-for="(track, t) in STUDIO_TRACKS"
          :key="track.id"
          class="st-lane"
          :style="{
            '--track-hue': TRACK_HUES[track.hue].fill,
            '--track-hue-glow': TRACK_HUES[track.hue].glow,
          }"
        >
          <div class="st-lane__head">
            <span class="st-lane__cap" aria-hidden="true"></span>
            <span class="st-lane__name">{{ copy.tracks[track.id] }}</span>
            <span class="st-lane__preset">{{ track.preset }}</span>
            <div class="st-lane__wave" aria-hidden="true">
              <canvas
                :ref="(el) => setCanvas(t, el as HTMLCanvasElement | null)"
                class="st-lane__wave-canvas"
              ></canvas>
              <i
                v-if="isPlaying"
                class="st-lane__playhead"
                :style="{ left: `${engine.position.value * 100}%` }"
              ></i>
            </div>
          </div>
          <div class="st-lane__grid">
            <StepRow
              v-for="(row, r) in track.rows"
              :key="row.note"
              :label="row.label"
              :cells="pattern[t][r]"
              :active-step="activeStep"
              @toggle="(step) => toggleStep(t, r, step)"
            />
          </div>
        </div>
        <p class="st-hint">{{ copy.hint }}</p>
      </div>

      <!-- ===== MIXER ===== -->
      <div class="st-deck__mixer">
        <div class="st-sec-head">
          <h3 class="st-sec-title">{{ copy.sections.mixer }}</h3>
          <Tooltip v-bind="term('mixer')">
            <button type="button" class="st-sec-info" :aria-label="term('mixer').title">
              <span aria-hidden="true">i</span>
            </button>
          </Tooltip>
        </div>
        <div class="st-mix-row">
          <div class="st-strips">
          <ChannelStrip
            v-for="(track, t) in STUDIO_TRACKS"
            :key="track.id"
            :label="copy.tracks[track.id]"
            :gain="trackGains[t]"
            :level="engine.levels.value[t]"
            :help="term('level')"
            mutable
            :muted="trackMutes[t]"
            :mute-label="copy.mixer.mute"
            :unmute-label="copy.mixer.unmute"
            :style="{
              '--track-hue': TRACK_HUES[track.hue].fill,
              '--track-hue-glow': TRACK_HUES[track.hue].glow,
            }"
            @update:gain="(v) => setTrackGain(t, v)"
            @toggle-mute="toggleMute(t)"
          />
          <div class="st-strips__divider" aria-hidden="true"></div>
          <ChannelStrip
            :label="copy.mixer.master"
            :gain="masterGain"
            :level="engine.masterLevel.value"
            :help="term('master')"
            class="st-strips__master"
            @update:gain="setMaster"
          />
          </div>

          <!-- Decorative hardware "master section": real master level on a dB scale. -->
          <div class="st-vu" aria-hidden="true">
            <div class="st-vu__head">
              <span class="st-vu__title">
                MASTER OUT
                <Tooltip v-bind="term('vu')">
                  <button type="button" class="st-sec-info" :aria-label="term('vu').title">
                    <span aria-hidden="true">i</span>
                  </button>
                </Tooltip>
              </span>
              <span class="st-vu__legend">REALTIME ENGINE · LANE MIXER · MIDI CLIPS</span>
            </div>
            <div class="st-vu__meter">
              <i
                v-for="mark in VU_MARKS.slice(1, -1)"
                :key="mark.db"
                class="st-vu__tick"
                :style="{ left: `${mark.pct}%` }"
              ></i>
              <div
                class="st-vu__fill"
                :style="{ clipPath: `inset(0 ${100 - masterVuPercent}% 0 0)` }"
              ></div>
            </div>
            <div class="st-vu__scale">
              <span
                v-for="mark in VU_MARKS"
                :key="mark.db"
                class="st-vu__mark"
                :style="{ left: `${mark.pct}%` }"
              >{{ mark.db === 0 ? '0dB' : mark.db }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </ToolShell>
</template>

<style src="./studio/StudioDemo.css"></style>
