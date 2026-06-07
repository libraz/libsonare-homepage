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
import ToolShell from '@/components/ToolShell.vue';
import { RotaryKnob, StatusIndicator, Tooltip } from '@/components/ui';
import { useI18n } from '@/composables/useI18n';
import { useStudioEngine } from '@/composables/useStudioEngine';
import { meterFillPercent } from '@/utils/scale';

const { locale } = useI18n();
const copy = computed(() => (locale.value === 'ja' ? jaCopy : enCopy));
const engine = useStudioEngine();

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

const docsPath = computed(() =>
  locale.value === 'ja' ? '/ja/docs/project-editing' : '/docs/project-editing',
);
const oppositeLocalePath = computed(() => (locale.value === 'ja' ? '/studio' : '/ja/studio'));

const glossaryBase = computed(() =>
  locale.value === 'ja' ? '/ja/docs/glossary' : '/docs/glossary',
);

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

function drawWaveforms(views: { min: Float32Array; max: Float32Array }[]) {
  for (let i = 0; i < views.length; i++) {
    const canvas = canvases.value[i];
    const view = views[i];
    if (!canvas || !view) continue;
    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth || 240;
    const height = canvas.clientHeight || 30;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    const g = canvas.getContext('2d');
    if (!g) continue;
    g.scale(dpr, dpr);
    g.clearRect(0, 0, width, height);
    const style = getComputedStyle(canvas);
    g.fillStyle = style.color;
    const mid = height / 2;
    const buckets = view.min.length;
    const bucketWidth = width / buckets;
    for (let b = 0; b < buckets; b++) {
      const top = mid - view.max[b] * mid * 2.4;
      const bottom = mid - view.min[b] * mid * 2.4;
      g.fillRect(
        b * bucketWidth,
        Math.min(top, mid - 0.5),
        Math.max(0.5, bucketWidth - 0.5),
        Math.max(1, bottom - top),
      );
    }
  }
}

async function downloadWav() {
  if (downloading.value) return;
  downloading.value = true;
  try {
    // Yield a frame so the button label updates before the offline render.
    await new Promise((resolve) => setTimeout(resolve, 30));
    const blob = engine.exportWav(pattern.value, bpm.value);
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `libsonare-studio-${bpm.value}bpm.wav`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  } finally {
    downloading.value = false;
  }
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

        <Tooltip v-bind="term('bounce')" class="st-bounce-tip">
          <button
            type="button"
            class="st-bounce"
            :disabled="downloading || !isReady"
            @click="downloadWav"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M12 3v12m0 0l-5-5m5 5l5-5M4 21h16" />
            </svg>
            {{ downloading ? copy.transport.downloading : copy.transport.download }}
          </button>
        </Tooltip>
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
              <span class="st-vu__legend">PROJECT ENGINE · OFFLINE BOUNCE · 48K</span>
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

<style scoped>
.st-statusbar {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: 18px;
  padding: 8px 18px;
  border-bottom: 1px solid var(--demo-border);
  background: var(--demo-bg-overlay);
  backdrop-filter: blur(16px);
}

.st-statusbar__field {
  display: inline-flex;
  align-items: baseline;
  gap: 6px;
  color: var(--demo-text-muted);
  font-family: 'JetBrains Mono', monospace;
  font-size: 10.5px;
  font-variant-numeric: tabular-nums;
}

.st-statusbar__field b {
  color: var(--demo-text-faint);
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.1em;
}

.st-error {
  color: var(--demo-danger);
  font-size: 11px;
}

/* ===== THE GROOVEBOX BODY ===== */
.st-deck {
  max-width: 1120px;
  margin: 0 auto;
  border: 1px solid var(--demo-border-strong);
  border-radius: 14px;
  /* Recessed corner screws over the brushed face. */
  background:
    radial-gradient(circle at 13px 13px, var(--demo-border-strong) 0 2px, transparent 3px),
    radial-gradient(circle at calc(100% - 13px) 13px, var(--demo-border-strong) 0 2px, transparent 3px),
    radial-gradient(circle at 13px calc(100% - 13px), var(--demo-border-strong) 0 2px, transparent 3px),
    radial-gradient(circle at calc(100% - 13px) calc(100% - 13px), var(--demo-border-strong) 0 2px, transparent 3px),
    linear-gradient(180deg, var(--demo-bg-header) 0%, var(--demo-bg-elevated) 22%, var(--demo-bg-elevated) 100%);
  box-shadow:
    0 24px 48px -24px rgba(0, 0, 0, 0.5),
    inset 0 1px 0 rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(10px);
  overflow: hidden;
}

html:not(.dark) .st-deck {
  box-shadow:
    0 20px 40px -24px rgba(80, 60, 140, 0.35),
    inset 0 1px 0 rgba(255, 255, 255, 0.7);
}

/* ===== TRANSPORT ===== */
.st-deck__transport {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 18px;
  padding: 16px 20px;
}

.st-brand {
  display: grid;
  gap: 1px;
  min-width: 140px;
}

.st-brand__name {
  color: var(--demo-text-strong);
  font-family: 'Space Grotesk', sans-serif;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.18em;
}

.st-brand__model {
  color: var(--demo-accent-light);
  font-family: 'JetBrains Mono', monospace;
  font-size: 22px;
  font-weight: 800;
  letter-spacing: 0.06em;
  line-height: 1.1;
}

html:not(.dark) .st-brand__model {
  color: var(--demo-accent);
}

.st-brand__tag {
  color: var(--demo-text-faint);
  font-family: 'JetBrains Mono', monospace;
  font-size: 7.5px;
  font-weight: 700;
  letter-spacing: 0.14em;
}

.st-play {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 50px;
  height: 50px;
  padding: 0;
  border: 1px solid var(--demo-accent-border);
  border-radius: 50%;
  background: var(--demo-accent-subtle);
  color: var(--demo-accent-light);
  cursor: pointer;
  transition: all 0.15s ease;
}

html:not(.dark) .st-play:not(.st-play--on) {
  border-color: var(--demo-accent-dim);
  color: var(--demo-accent);
}

.st-play:hover:not(:disabled) {
  border-color: var(--demo-accent);
  background: var(--demo-accent-dim);
}

.st-play:focus-visible {
  outline: 2px solid var(--demo-accent);
  outline-offset: 2px;
}

.st-play:disabled {
  opacity: 0.5;
  cursor: default;
}

.st-play--on {
  border-color: var(--demo-accent);
  background: var(--demo-accent);
  color: #fff;
  box-shadow: 0 0 18px var(--demo-accent-dim);
  animation: st-play-pulse 1.4s ease-in-out infinite;
}

/* Keep the playing button solid on hover (the generic hover rule would
   otherwise win on specificity and fade it back to translucent). */
.st-play--on:hover:not(:disabled) {
  border-color: var(--demo-accent-light);
  background: var(--demo-accent-light);
  color: #fff;
}

@keyframes st-play-pulse {
  0%, 100% { box-shadow: 0 0 10px var(--demo-accent-dim); }
  50% { box-shadow: 0 0 22px var(--demo-accent-dim); }
}

@media (prefers-reduced-motion: reduce) {
  .st-play--on {
    animation: none;
  }
}

.st-lcd {
  position: relative;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 8px 16px;
  border: 1px solid var(--demo-border);
  border-radius: 8px;
  background: var(--demo-control-bg-strong);
  box-shadow: inset 0 2px 6px rgba(0, 0, 0, 0.18);
}

html:not(.dark) .st-lcd {
  box-shadow: inset 0 2px 5px rgba(80, 60, 140, 0.12);
}

.st-lcd__cell {
  display: grid;
  gap: 0;
  justify-items: start;
}

.st-lcd__key {
  color: var(--demo-text-faint);
  font-family: 'JetBrains Mono', monospace;
  font-size: 7.5px;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.st-lcd__value {
  color: var(--demo-accent-light);
  font-family: 'JetBrains Mono', monospace;
  font-size: 15px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  line-height: 1.2;
  text-shadow: 0 0 8px var(--demo-accent-dim);
}

html:not(.dark) .st-lcd__value {
  color: var(--demo-accent);
  text-shadow: 0 0 6px var(--demo-accent-subtle);
}

.st-lcd__value--big {
  font-size: 21px;
}

.st-lcd__divider {
  width: 1px;
  align-self: stretch;
  background: var(--demo-border);
}

.st-lcd__dot {
  position: absolute;
  top: 7px;
  right: 8px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--demo-text-faint);
  opacity: 0.4;
}

.st-lcd__dot--on {
  background: var(--demo-success);
  opacity: 1;
  box-shadow: 0 0 6px var(--demo-success);
}

/* 16-step run lights: the classic groovebox position indicator. */
.st-runlights {
  display: flex;
  flex: 1;
  justify-content: center;
  gap: 5px;
  min-width: 0;
}

.st-runlights__led {
  width: 8px;
  height: 16px;
  border: 1px solid var(--demo-border);
  border-radius: 2px;
  background: var(--demo-track-bg);
  transition: background-color 0.05s linear, box-shadow 0.05s linear, border-color 0.05s linear;
}

.st-runlights__led--beat {
  border-color: var(--demo-accent-border);
}

.st-runlights__led--beat:not(:first-child) {
  margin-left: 8px;
}

.st-runlights__led--on {
  border-color: var(--demo-accent);
  background: var(--demo-accent);
  box-shadow: 0 0 8px var(--demo-accent-dim);
}

@media (prefers-reduced-motion: reduce) {
  .st-runlights__led {
    transition: none;
  }
}

@media (max-width: 1060px) {
  .st-runlights {
    display: none;
  }
}

.st-bounce-tip {
  margin-left: auto;
}

.st-bounce {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 9px 16px;
  border: 1px solid var(--demo-accent-border);
  border-radius: 6px;
  background: var(--demo-accent-subtle);
  color: var(--demo-text);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.05em;
  cursor: pointer;
  transition: all 0.2s ease;
}

.st-bounce:hover:not(:disabled) {
  border-color: var(--demo-accent);
  color: var(--demo-accent);
  background: var(--demo-accent-dim);
}

.st-bounce:focus-visible {
  outline: 2px solid var(--demo-accent);
  outline-offset: 2px;
}

.st-bounce:disabled {
  opacity: 0.5;
  cursor: default;
}

/* ===== SEQUENCER ===== */
.st-deck__seq {
  padding: 14px 20px 16px;
  border-top: 1px solid var(--demo-border);
}

.st-sec-head {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 12px;
}

.st-sec-title {
  margin: 0;
  color: var(--demo-text-faint);
  font-family: 'JetBrains Mono', monospace;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.st-sec-info {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  padding: 0;
  border: 1px solid var(--demo-border);
  border-radius: 50%;
  background: var(--demo-bg);
  color: var(--demo-text-muted);
  cursor: pointer;
  transition: color 0.18s ease, border-color 0.18s ease, background-color 0.18s ease;
}

.st-sec-info > span {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 8px;
  font-style: italic;
  font-weight: 700;
  line-height: 1;
  transform: translateY(-0.5px);
}

.st-sec-info:hover,
.st-sec-info:focus-visible {
  color: var(--demo-accent);
  border-color: var(--demo-accent);
  background: var(--demo-accent-subtle);
  outline: none;
}

/* Step-number ruler. Mirrors StepRow's metrics (34px gutter + 10px gap,
   16-column grid with 5px gap and a 7px beat-group inset) so the numbers
   sit exactly over the pads. */
.st-ruler {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}

.st-ruler__gutter {
  flex: 0 0 34px;
}

.st-ruler__cells {
  display: grid;
  flex: 1;
  grid-template-columns: repeat(16, 1fr);
  gap: 5px;
}

.st-ruler__cell {
  color: var(--demo-text-faint);
  font-family: 'JetBrains Mono', monospace;
  font-size: 8px;
  font-weight: 700;
  letter-spacing: 0.08em;
  opacity: 0.55;
  text-align: center;
}

.st-ruler__cell--beat {
  color: var(--demo-text-muted);
  font-size: 9px;
  opacity: 1;
}

.st-ruler__cell--beat:not(:first-child) {
  margin-left: 7px;
}

.st-lane {
  padding: 12px 0;
  border-top: 1px solid var(--demo-border);
}

.st-lane__head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}

.st-lane__cap {
  width: 4px;
  height: 16px;
  border-radius: 2px;
  background: var(--track-hue);
  box-shadow: 0 0 6px var(--track-hue-glow);
}

.st-lane__name {
  color: var(--demo-text-strong);
  font-family: 'Space Grotesk', sans-serif;
  font-size: 12.5px;
  font-weight: 700;
  letter-spacing: 0.04em;
}

.st-lane__preset {
  padding: 2px 7px;
  border: 1px solid var(--demo-border);
  border-radius: 4px;
  color: var(--demo-text-faint);
  font-family: 'JetBrains Mono', monospace;
  font-size: 8.5px;
  font-weight: 700;
  letter-spacing: 0.08em;
}

.st-lane__wave {
  position: relative;
  flex: 0 1 220px;
  margin-left: auto;
  height: 30px;
  border: 1px solid var(--demo-border);
  border-radius: 4px;
  background: var(--demo-control-bg);
  overflow: hidden;
}

/* Scope baseline behind the rendered min/max waveform. */
.st-lane__wave::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 0;
  right: 0;
  height: 1px;
  background: color-mix(in srgb, var(--track-hue, var(--demo-accent)) 28%, transparent);
}

.st-lane__wave-canvas {
  display: block;
  width: 100%;
  height: 100%;
  color: var(--track-hue, var(--demo-accent));
}

.st-lane__playhead {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 1.5px;
  background: var(--demo-text-strong);
  opacity: 0.7;
}

.st-lane__grid {
  display: grid;
  gap: 6px;
}

.st-hint {
  margin: 12px 0 0;
  color: var(--demo-text-faint);
  font-size: 11px;
  line-height: 1.5;
}

/* ===== MIXER ===== */
.st-deck__mixer {
  padding: 14px 20px 18px;
  border-top: 1px solid var(--demo-border);
  background: var(--demo-bg-header);
}

.st-mix-row {
  display: flex;
  gap: 22px;
  align-items: stretch;
}

.st-strips {
  display: flex;
  gap: 12px;
  align-items: stretch;
}

/* Hardware master section: fills the right of the mixer with the real
   master level on a dB-linear scale. */
.st-vu {
  display: flex;
  flex: 1;
  flex-direction: column;
  justify-content: center;
  gap: 9px;
  min-width: 0;
  padding: 0 6px;
}

.st-vu__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}

.st-vu__title {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--demo-text-muted);
  font-family: 'JetBrains Mono', monospace;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.16em;
}

.st-vu__legend {
  overflow: hidden;
  color: var(--demo-text-faint);
  font-family: 'JetBrains Mono', monospace;
  font-size: 7.5px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.st-vu__meter {
  position: relative;
  height: 22px;
  overflow: hidden;
  border: 1px solid var(--demo-border);
  border-radius: 4px;
  background: var(--demo-track-bg);
  box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.25);
}

html:not(.dark) .st-vu__meter {
  box-shadow: inset 0 1px 3px rgba(80, 60, 140, 0.12);
}

.st-vu__tick {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 1px;
  background: var(--demo-border);
}

/* Full-width gradient clipped from the right, so the amber/red zone stays
   anchored to the top of the dB scale instead of riding the fill edge. */
.st-vu__fill {
  position: absolute;
  inset: 2px 0;
  border-radius: 2px;
  background: linear-gradient(90deg, var(--demo-accent) 0%, var(--demo-accent) 80%, var(--demo-amber) 90%, #ef4444 98%);
  -webkit-mask-image: repeating-linear-gradient(90deg, #000 0 4px, transparent 4px 6px);
  mask-image: repeating-linear-gradient(90deg, #000 0 4px, transparent 4px 6px);
  transition: clip-path 0.06s linear;
}

.st-vu__scale {
  position: relative;
  height: 12px;
  margin: 0 1px;
}

.st-vu__mark {
  position: absolute;
  top: 0;
  transform: translateX(-50%);
  color: var(--demo-text-faint);
  font-family: 'JetBrains Mono', monospace;
  font-size: 7.5px;
  font-weight: 700;
  letter-spacing: 0.06em;
}

.st-vu__mark:first-child {
  transform: none;
}

.st-vu__mark:last-child {
  transform: translateX(-100%);
}

@media (max-width: 880px) {
  .st-vu {
    display: none;
  }
}

.st-strips__divider {
  width: 1px;
  background: var(--demo-border);
}

.st-strips__master {
  --track-hue: var(--demo-accent);
  --track-hue-glow: var(--demo-accent-dim);
}

@media (max-width: 720px) {
  .st-deck__transport {
    gap: 12px;
  }

  .st-bounce-tip {
    margin-left: 0;
  }

  .st-lane__head {
    flex-wrap: wrap;
  }

  .st-lane__wave {
    flex: 1 1 100%;
    margin-left: 0;
    order: 4;
  }

  .st-strips {
    flex-wrap: wrap;
  }
}
</style>
