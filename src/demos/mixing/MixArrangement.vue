<script setup lang="ts">
/**
 * Transport and arrangement: one lane per track with its clip (drag to move,
 * edges to trim, top corners to fade), a ruler that seeks, the loop range, and
 * the selected track's automation lane (`MixAutomationLane.vue`). A clip edit re-sends the clip's audio
 * to the engine, so a clip drag is drawn locally and committed on release;
 * automation points are cheap and move live.
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { TermLabel } from '@/components/ui';
import EngineTransport, { type EngineTransportLoop } from '@/components/ui/EngineTransport.vue';
import MixAutomationLane from '@/demos/mixing/MixAutomationLane.vue';
import { useMixingCopy } from '@/demos/mixing/mixingCopy';
import {
  AUTOMATION_CURVES,
  AUTOMATION_PARAMS,
  type AutomationCurve,
  type AutomationParam,
  type ClipState,
  type MixTrackState,
} from '@/demos/mixing/mixingState';
import { useMixingTerm } from '@/demos/mixing/mixingTerms';
import { formatClock, rulerStep } from '@/demos/mixing/mixingUi';
import type { MixingController } from '@/demos/mixing/useMixingStudio';
import { fill } from '@/utils/template';

const props = defineProps<{ m: MixingController }>();

const copy = useMixingCopy();
const term = useMixingTerm();
const { m } = props;
const { view, selectedId, selectedTrack, trackInfo, sonare, duration, hasAudio, editLocked } = m;
const { position, playing } = sonare;

const ZOOMS = [2, 4, 8, 16, 32, 64, 128, 256];
const MIN_CLIP_SEC = 0.05;
const LANE_HEIGHT = 52;
const AUTO_HEIGHT = 72;

const scroller = ref<HTMLElement | null>(null);
const viewport = ref(800);
const pps = ref(8);
const param = ref<AutomationParam>('fader');
const curve = ref<AutomationCurve>('linear');

const span = computed(() => Math.max(duration.value, view.value.loop.endSec, 10) + 4);
const canvasWidth = computed(() => Math.max(viewport.value, Math.ceil(span.value * pps.value)));
const x = (sec: number) => sec * pps.value;

let observer: ResizeObserver | null = null;
onMounted(() => {
  const el = scroller.value;
  if (!el) return;
  viewport.value = el.clientWidth || 800;
  if (typeof ResizeObserver !== 'undefined') {
    observer = new ResizeObserver(() => {
      viewport.value = el.clientWidth || viewport.value;
    });
    observer.observe(el);
  }
});
onBeforeUnmount(() => observer?.disconnect());

function fitView(): void {
  pps.value = Math.max(1, (viewport.value - 16) / Math.max(10, duration.value + 2));
}

function zoom(direction: 1 | -1): void {
  const index = ZOOMS.findIndex((z) => z >= pps.value - 1e-6);
  const current = index === -1 ? ZOOMS.length - 1 : index;
  pps.value = ZOOMS[Math.min(ZOOMS.length - 1, Math.max(0, current + direction))];
}

// The first audio sets a zoom that shows the whole arrangement.
watch(duration, (next, prev) => {
  if (prev === 0 && next > 0) fitView();
});

// Keep the playhead in view while playing.
watch(position, (seconds) => {
  const el = scroller.value;
  if (!el || !playing.value) return;
  const px = x(seconds);
  if (px > el.scrollLeft + el.clientWidth - 40 || px < el.scrollLeft)
    el.scrollLeft = Math.max(0, px - 40);
});

const ticks = computed(() => {
  const step = rulerStep(pps.value);
  const out: Array<{ sec: number; left: number; label: string }> = [];
  for (let sec = 0; sec <= span.value; sec += step) {
    out.push({ sec, left: x(sec), label: formatClock(sec) });
  }
  return out;
});

const transportLoop = computed<EngineTransportLoop>(() => ({
  enabled: view.value.loop.enabled,
  start: view.value.loop.startSec,
  end: view.value.loop.endSec > view.value.loop.startSec ? view.value.loop.endSec : duration.value,
}));

function onLoop(loop: EngineTransportLoop): void {
  m.setLoop({ enabled: loop.enabled, startSec: loop.start, endSec: loop.end });
}

// ---------------------------------------------------------------------------
// Clips

type ClipDragMode = 'move' | 'start' | 'end' | 'fadeIn' | 'fadeOut';
interface ClipDrag {
  trackId: number;
  mode: ClipDragMode;
  x: number;
  clip: ClipState;
  played: number;
  source: number;
}
const drag = ref<ClipDrag | null>(null);
const draft = ref<{ trackId: number; clip: ClipState } | null>(null);

function playedOf(track: MixTrackState, clip: ClipState): number {
  const rest = Math.max(0, track.sourceDurationSec - clip.trimStartSec);
  return clip.lengthSec === null ? rest : Math.min(rest, clip.lengthSec);
}

function clipOf(track: MixTrackState): ClipState {
  return draft.value?.trackId === track.id ? draft.value.clip : track.clip;
}

function startClipDrag(event: PointerEvent, track: MixTrackState, mode: ClipDragMode): void {
  if (editLocked.value || event.button !== 0) return;
  event.preventDefault();
  event.stopPropagation();
  selectedId.value = track.id;
  (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
  drag.value = {
    trackId: track.id,
    mode,
    x: event.clientX,
    clip: { ...track.clip },
    played: playedOf(track, track.clip),
    source: track.sourceDurationSec,
  };
  draft.value = { trackId: track.id, clip: { ...track.clip } };
}

function moveClipDrag(event: PointerEvent): void {
  const d = drag.value;
  if (!d) return;
  const dt = (event.clientX - d.x) / pps.value;
  const c = { ...d.clip };
  const end = c.startSec + d.played;
  switch (d.mode) {
    case 'move':
      c.startSec = Math.max(0, d.clip.startSec + dt);
      break;
    case 'start': {
      const shift = Math.min(
        Math.max(dt, -d.clip.trimStartSec, -d.clip.startSec),
        d.played - MIN_CLIP_SEC,
      );
      c.startSec = d.clip.startSec + shift;
      c.trimStartSec = d.clip.trimStartSec + shift;
      c.lengthSec = end - c.startSec;
      break;
    }
    case 'end':
      c.lengthSec = Math.min(d.source - d.clip.trimStartSec, Math.max(MIN_CLIP_SEC, d.played + dt));
      break;
    case 'fadeIn':
      c.fadeInSec = Math.min(d.played - c.fadeOutSec, Math.max(0, d.clip.fadeInSec + dt));
      break;
    case 'fadeOut':
      c.fadeOutSec = Math.min(d.played - c.fadeInSec, Math.max(0, d.clip.fadeOutSec - dt));
      break;
  }
  draft.value = { trackId: d.trackId, clip: c };
}

function endClipDrag(event: PointerEvent): void {
  const d = drag.value;
  const next = draft.value?.clip;
  drag.value = null;
  draft.value = null;
  (event.currentTarget as HTMLElement).releasePointerCapture?.(event.pointerId);
  if (!d || !next) return;
  const before = d.clip;
  m.begin();
  if (next.startSec !== before.startSec) m.edit('moveClip', d.trackId, next.startSec);
  if (next.trimStartSec !== before.trimStartSec || next.lengthSec !== before.lengthSec) {
    m.edit('trimClip', d.trackId, next.trimStartSec, next.lengthSec);
  }
  if (next.fadeInSec !== before.fadeInSec || next.fadeOutSec !== before.fadeOutSec) {
    m.edit('setClipFades', d.trackId, next.fadeInSec, next.fadeOutSec);
  }
  m.end();
}

interface ClipView {
  track: MixTrackState;
  clip: ClipState;
  left: number;
  width: number;
  fadeIn: number;
  fadeOut: number;
  wave: string;
  loaded: boolean;
}

/** Min/max outline of the played part of the source, `columns` wide on a 0..columns × −1..1 box. */
function wavePath(track: MixTrackState, clip: ClipState, played: number, columns: number): string {
  const peaks = trackInfo.value.get(track.id)?.waveform;
  if (!peaks || peaks.length === 0 || track.sourceDurationSec <= 0 || columns < 1) return '';
  const perSec = peaks.length / track.sourceDurationSec;
  const top: string[] = [];
  const bottom: string[] = [];
  for (let c = 0; c < columns; c++) {
    const from = Math.floor((clip.trimStartSec + (c / columns) * played) * perSec);
    const to = Math.max(
      from + 1,
      Math.floor((clip.trimStartSec + ((c + 1) / columns) * played) * perSec),
    );
    let min = 0;
    let max = 0;
    for (let i = from; i < Math.min(to, peaks.length); i++) {
      min = Math.min(min, peaks[i].min);
      max = Math.max(max, peaks[i].max);
    }
    top.push(`${c} ${(-max).toFixed(3)}`);
    bottom.push(`${c} ${(-min).toFixed(3)}`);
  }
  return `M ${top.join(' L ')} L ${bottom.reverse().join(' L ')} Z`;
}

const clips = computed<ClipView[]>(() =>
  view.value.tracks.map((track) => {
    const clip = clipOf(track);
    const played = playedOf(track, clip);
    const width = Math.max(2, x(played));
    return {
      track,
      clip,
      left: x(clip.startSec),
      width,
      fadeIn: played > 0 ? (clip.fadeInSec / played) * 100 : 0,
      fadeOut: played > 0 ? (clip.fadeOutSec / played) * 100 : 0,
      wave: wavePath(track, clip, played, Math.min(800, Math.ceil(width / 2))),
      loaded: trackInfo.value.has(track.id),
    };
  }),
);

// The lane's point selection decides which point a curve choice reshapes.
const laneRef = ref<InstanceType<typeof MixAutomationLane> | null>(null);
const lanePoints = computed(() => selectedTrack.value?.automation[param.value] ?? []);

function chooseCurve(next: AutomationCurve): void {
  curve.value = next;
  laneRef.value?.applyCurve(next);
}

function seekAt(event: PointerEvent): void {
  if (!hasAudio.value) return;
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
  m.seek((event.clientX - rect.left) / pps.value);
}

const playheadLeft = computed(() => x(position.value));
const loopBox = computed(() => {
  const { loop } = view.value;
  if (loop.endSec <= loop.startSec) return null;
  return { left: x(loop.startSec), width: x(loop.endSec - loop.startSec), on: loop.enabled };
});
</script>

<template>
  <section class="arr" :aria-label="copy.arrange.title">
    <div
      class="arr__transport"
      @pointerdown.capture="m.begin"
      @pointerup.capture="m.end"
      @pointercancel.capture="m.end"
    >
      <EngineTransport
        :playing="playing"
        :position="position"
        :duration="Math.max(duration, 1)"
        :loop="transportLoop"
        :disabled="!hasAudio"
        :labels="copy.transport"
        @play="m.play"
        @stop="m.stop"
        @seek="m.seek"
        @to-home="m.seek(0)"
        @toggle-loop="m.toggleLoop"
        @update:loop="onLoop"
      />
    </div>

    <div class="arr__toolbar">
      <div class="arr__zoom" role="group" :aria-label="copy.arrange.title">
        <button type="button" :aria-label="copy.arrange.zoomOut" @click="zoom(-1)">−</button>
        <button type="button" :aria-label="copy.arrange.zoomIn" @click="zoom(1)">+</button>
        <button type="button" @click="fitView">{{ copy.arrange.fit }}</button>
      </div>
      <TermLabel v-bind="term('automation', true)">{{ copy.arrange.automation }}</TermLabel>
      <div class="arr__segment" role="group" :aria-label="copy.arrange.automation">
        <button
          v-for="(name, i) in AUTOMATION_PARAMS"
          :key="name"
          type="button"
          :aria-pressed="param === name"
          @click="param = name"
        >{{ copy.automationParams[i] }}</button>
      </div>
      <TermLabel v-bind="term('curve', true)">{{ copy.arrange.curve }}</TermLabel>
      <div class="arr__segment" role="group" :aria-label="copy.arrange.curve">
        <button
          v-for="(name, i) in AUTOMATION_CURVES"
          :key="name"
          type="button"
          :aria-pressed="curve === name"
          :disabled="editLocked"
          @click="chooseCurve(name)"
        >{{ copy.automationCurves[i] }}</button>
      </div>
      <button
        type="button"
        class="arr__clear"
        :disabled="editLocked || !selectedTrack || lanePoints.length === 0"
        @click="selectedTrack && m.edit('clearAutomation', selectedTrack.id, param)"
      >{{ copy.arrange.clear }}</button>
    </div>

    <div class="arr__body">
      <div class="arr__heads">
        <div class="arr__ruler-pad"></div>
        <button
          v-for="(clip, index) in clips"
          :key="clip.track.id"
          type="button"
          class="arr__head"
          :class="{ 'arr__head--selected': clip.track.id === selectedId }"
          :style="{ height: `${LANE_HEIGHT}px` }"
          :aria-label="fill(copy.console.select, { name: clip.track.name })"
          :aria-pressed="clip.track.id === selectedId"
          @click="selectedId = clip.track.id"
        >
          <span class="arr__index">{{ String(index + 1).padStart(2, '0') }}</span>
          <span class="arr__track-name">{{ clip.track.name }}</span>
          <span v-if="!clip.loaded" class="arr__missing">{{ copy.arrange.noAudio }}</span>
        </button>
        <div class="arr__head arr__head--auto" :style="{ height: `${AUTO_HEIGHT}px` }">
          <span class="arr__track-name">{{ copy.automationParams[AUTOMATION_PARAMS.indexOf(param)] }}</span>
          <span class="arr__index">{{ selectedTrack?.name ?? '—' }}</span>
        </div>
      </div>

      <div ref="scroller" class="arr__scroll">
        <div class="arr__canvas" :style="{ width: `${canvasWidth}px` }">
          <div class="arr__ruler" @pointerdown="seekAt">
            <div
              v-if="loopBox"
              class="arr__loop"
              :class="{ 'arr__loop--on': loopBox.on }"
              :style="{ left: `${loopBox.left}px`, width: `${loopBox.width}px` }"
            ></div>
            <span v-for="tick in ticks" :key="tick.sec" class="arr__tick" :style="{ left: `${tick.left}px` }">{{ tick.label }}</span>
          </div>

          <div
            v-for="item in clips"
            :key="item.track.id"
            class="arr__lane"
            :class="{ 'arr__lane--selected': item.track.id === selectedId }"
            :style="{ height: `${LANE_HEIGHT}px` }"
            @pointerdown="selectedId = item.track.id"
          >
            <div
              class="arr__clip"
              :class="{ 'arr__clip--muted': item.track.muted, 'arr__clip--empty': !item.loaded }"
              :style="{ left: `${item.left}px`, width: `${item.width}px` }"
              role="group"
              :aria-label="fill(copy.arrange.clip, { name: item.track.name })"
              @pointerdown="startClipDrag($event, item.track, 'move')"
              @pointermove="moveClipDrag"
              @pointerup="endClipDrag"
              @pointercancel="endClipDrag"
            >
              <svg
                v-if="item.wave"
                class="arr__wave"
                :viewBox="`0 -1 ${Math.min(800, Math.ceil(item.width / 2))} 2`"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <path :d="item.wave" />
              </svg>
              <svg class="arr__fades" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                <path v-if="item.fadeIn > 0" :d="`M 0 100 L 0 0 L ${item.fadeIn} 0 Z`" />
                <path v-if="item.fadeOut > 0" :d="`M 100 100 L 100 0 L ${100 - item.fadeOut} 0 Z`" />
              </svg>
              <span class="arr__clip-name">{{ item.track.name }}</span>
              <span
                class="arr__edge arr__edge--start"
                :aria-label="fill(copy.arrange.trimStart, { name: item.track.name })"
                @pointerdown="startClipDrag($event, item.track, 'start')"
                @pointermove="moveClipDrag"
                @pointerup="endClipDrag"
                @pointercancel="endClipDrag"
              ></span>
              <span
                class="arr__edge arr__edge--end"
                :aria-label="fill(copy.arrange.trimEnd, { name: item.track.name })"
                @pointerdown="startClipDrag($event, item.track, 'end')"
                @pointermove="moveClipDrag"
                @pointerup="endClipDrag"
                @pointercancel="endClipDrag"
              ></span>
              <span
                class="arr__fade arr__fade--in"
                :style="{ left: `${item.fadeIn}%` }"
                :aria-label="fill(copy.arrange.fadeIn, { name: item.track.name })"
                @pointerdown="startClipDrag($event, item.track, 'fadeIn')"
                @pointermove="moveClipDrag"
                @pointerup="endClipDrag"
                @pointercancel="endClipDrag"
              ></span>
              <span
                class="arr__fade arr__fade--out"
                :style="{ right: `${item.fadeOut}%` }"
                :aria-label="fill(copy.arrange.fadeOut, { name: item.track.name })"
                @pointerdown="startClipDrag($event, item.track, 'fadeOut')"
                @pointermove="moveClipDrag"
                @pointerup="endClipDrag"
                @pointercancel="endClipDrag"
              ></span>
            </div>
          </div>
          <p v-if="clips.length === 0" class="arr__empty">{{ copy.arrange.empty }}</p>

          <MixAutomationLane
            ref="laneRef"
            v-model:curve="curve"
            :m="m"
            :param="param"
            :pps="pps"
            :width="canvasWidth"
            :height="AUTO_HEIGHT"
          />

          <div class="arr__playhead" :style="{ left: `${playheadLeft}px` }" aria-hidden="true"></div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.arr {
  display: grid;
  gap: 10px;
  min-width: 0;
  padding: 10px 12px 12px;
  border: 1px solid var(--demo-border);
  border-radius: 6px;
  background: var(--demo-bg-elevated);
}

.arr__toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
}

.arr__zoom,
.arr__segment {
  display: inline-flex;
  border: 1px solid var(--demo-border-strong);
  border-radius: 4px;
  overflow: hidden;
}

.arr__zoom button,
.arr__segment button,
.arr__clear {
  min-width: 28px;
  padding: 3px 8px;
  border: 0;
  border-left: 1px solid var(--demo-border);
  background: var(--demo-control-bg);
  color: var(--demo-text-muted);
  font-family: var(--font-mono);
  font-size: 10.5px;
  cursor: pointer;
}

.arr__zoom button:first-child,
.arr__segment button:first-child {
  border-left: 0;
}

.arr__segment button[aria-pressed='true'] {
  background: var(--demo-accent-subtle);
  color: var(--demo-accent);
  font-weight: 600;
}

.arr__clear {
  border: 1px solid var(--demo-border-strong);
  border-radius: 4px;
}

.arr button:disabled {
  cursor: not-allowed;
  opacity: var(--demo-disabled-opacity);
}

.arr__body {
  display: grid;
  grid-template-columns: 132px minmax(0, 1fr);
  border: 1px solid var(--demo-border);
  border-radius: 4px;
  overflow: hidden;
}

.arr__heads {
  display: grid;
  grid-auto-rows: min-content;
  border-right: 1px solid var(--demo-border-strong);
  background: var(--demo-control-bg);
}

.arr__ruler-pad {
  height: 22px;
  border-bottom: 1px solid var(--demo-border);
}

.arr__head {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-content: center;
  gap: 2px 6px;
  padding: 0 8px;
  border: 0;
  border-bottom: 1px solid var(--demo-border);
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.arr__head--selected {
  background: var(--demo-accent-subtle);
}

.arr__head--auto {
  cursor: default;
  grid-template-columns: 1fr;
}

.arr__index,
.arr__missing {
  color: var(--demo-text-faint);
  font-family: var(--font-mono);
  font-size: var(--demo-label-size);
  font-variant-numeric: tabular-nums;
}

.arr__missing {
  grid-column: 2;
  color: var(--demo-warn-text);
}

.arr__track-name {
  overflow: hidden;
  color: var(--demo-text-strong);
  font-size: 12px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.arr__scroll {
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: thin;
}

.arr__canvas {
  position: relative;
}

.arr__ruler {
  position: relative;
  height: 22px;
  border-bottom: 1px solid var(--demo-border);
  cursor: pointer;
}

.arr__tick {
  position: absolute;
  top: 0;
  bottom: 0;
  padding: 5px 0 0 4px;
  border-left: 1px solid var(--demo-border-strong);
  color: var(--demo-text-muted);
  font-family: var(--font-mono);
  font-size: 9.5px;
  font-variant-numeric: tabular-nums;
  pointer-events: none;
}

.arr__loop {
  position: absolute;
  top: 0;
  bottom: 0;
  background: var(--demo-border);
  pointer-events: none;
}

.arr__loop--on {
  background: var(--demo-accent-dim);
}

.arr__lane {
  position: relative;
  border-bottom: 1px solid var(--demo-border);
  background: var(--demo-track-bg);
}

.arr__lane--selected {
  background: var(--demo-accent-subtle);
}

.arr__clip {
  position: absolute;
  top: 4px;
  bottom: 4px;
  overflow: hidden;
  border: 1px solid var(--demo-accent-border);
  border-radius: 3px;
  background: var(--demo-clip-base);
  cursor: grab;
  touch-action: none;
}

.arr__lane--selected .arr__clip {
  border-color: var(--demo-accent);
}

.arr__clip--muted {
  opacity: 0.5;
}

.arr__clip--empty {
  border-style: dashed;
}

.arr__wave {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.arr__wave path {
  fill: var(--demo-accent-dim);
  stroke: none;
}

.arr__fades {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.arr__fades path {
  fill: var(--demo-bg-overlay);
  opacity: 0.7;
}

.arr__clip-name {
  position: absolute;
  top: 2px;
  left: 6px;
  color: var(--demo-text-strong);
  font-size: 10.5px;
  font-weight: 600;
  text-shadow: 0 0 3px var(--demo-clip-label-shadow);
  pointer-events: none;
}

.arr__edge {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 6px;
  cursor: ew-resize;
}

.arr__edge--start {
  left: 0;
}

.arr__edge--end {
  right: 0;
}

.arr__edge:hover {
  background: var(--demo-accent-dim);
}

.arr__fade {
  position: absolute;
  top: 0;
  width: 8px;
  height: 8px;
  margin: 0 -4px;
  border: 1px solid var(--demo-accent);
  border-radius: 1px;
  background: var(--demo-bg);
  cursor: ew-resize;
}

.arr__empty {
  margin: 0;
  padding: 18px 12px;
  color: var(--demo-text-muted);
  font-size: 12px;
}

.arr__playhead {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 1px;
  background: var(--demo-playhead);
  pointer-events: none;
}
</style>
