<script setup lang="ts">
/**
 * `score` archetype: a MIDI passage engraved as standard music notation.
 *
 * The same kind of phrase the piano roll shows as a grid, this archetype reads
 * as a grand staff: a melody over a bass line, with clefs, beamed eighths and a
 * time signature drawn by VexFlow. The notes, durations and pitches come from the
 * exact MIDI the engine plays — switching the instrument re-voices the identical
 * notes through a different NativeSynth preset, and the tempo restretches the
 * reading. Pressing play bounces the passage and lights each note the moment it
 * sounds, so the score reads back in time with the audio.
 *
 * The notation is a visual enhancement: if VexFlow fails to engrave (e.g. fonts
 * unavailable), the demo still renders and auditions the audio.
 */
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { useSonareDemoAudio } from '@/composables/useSonareDemoAudio';
import { type DemoLocale, localized, type SonareDemoDef } from '@/demos/types';
import DemoControls from '../DemoControls.vue';
import DemoFrame from '../DemoFrame.vue';

const props = defineProps<{ def: SonareDemoDef; active: boolean }>();

const { locale } = useI18n();
const { ensureWasm, play, playingId, progress } = useSonareDemoAudio();

const loc = computed<DemoLocale>(() => (locale.value.startsWith('ja') ? 'ja' : 'en'));
const title = computed(() => localized(props.def.title, loc.value));
const caption = computed(() => localized(props.def.caption, loc.value));

const host = ref<HTMLDivElement | null>(null);
const status = ref<'idle' | 'loading' | 'ready' | 'error'>('idle');
const errorMsg = ref('');
const isPlaying = computed(() => playingId.value === props.def.id);

// ---- reader-adjustable parameters -----------------------------------------
type ParamValue = number | string | boolean;
const values = reactive<Record<string, ParamValue>>({});
for (const p of props.def.params ?? []) values[p.key] = p.default;

function onParams(next: Record<string, ParamValue>): void {
  Object.assign(values, next);
}

const instrument = computed<string>(() => String(values.instrument ?? 'acoustic-piano'));
const tempo = computed<number>(() => Number(values.tempo ?? 96));

// ---- presentation state ----------------------------------------------------
const tone = computed(() => {
  if (status.value === 'error') return 'error' as const;
  if (status.value === 'loading') return 'loading' as const;
  if (isPlaying.value) return 'playing' as const;
  if (status.value === 'ready') return 'ready' as const;
  return 'idle' as const;
});
const stateLabel = computed(() => {
  if (status.value === 'loading') return 'ENGRAVING';
  if (status.value === 'error') return 'ERROR';
  if (isPlaying.value) return `▸ ${Math.round(progress.value * 100)}%`;
  if (status.value === 'ready') return `GRAND STAFF · ${tempo.value} BPM`;
  return 'IDLE';
});

// ---- the passage -----------------------------------------------------------
// A two-bar phrase in C major over a I–vi–IV–I bass: a singable melody on the
// treble staff, the chord roots beneath it on the bass staff. Authored once as
// notation (VexFlow key + duration) and read two ways — VexFlow engraves it, and
// the same notes are converted to MIDI for the engine to play.
const SR = 44100;
const BEATS = 8; // two 4/4 bars, in quarter notes
const GATE = 0.92; // note held for 92% of its slot, so repeats re-articulate
const TAIL_SEC = 1.2; // release tail captured past the last note-off
const INK = '#26211a'; // deep sepia — the engraved noteheads, stems and clefs
const STAFF_INK = '#6c6353'; // staff rules sit a touch lighter than the noteheads
const HILITE = '#b07410'; // amber — the note sounding now, lit like candlelight

/** One written note: a VexFlow key ("e/5") and a duration code ("q", "8", "h"). */
interface ScoreNote {
  key: string;
  dur: string;
}
interface ScoreStaff {
  clef: 'treble' | 'bass';
  velocity: number;
  notes: ScoreNote[];
}

const STAVES: ScoreStaff[] = [
  {
    clef: 'treble',
    velocity: 104,
    notes: [
      // bar 1
      { key: 'e/5', dur: 'q' }, { key: 'g/5', dur: 'q' },
      { key: 'a/5', dur: '8' }, { key: 'g/5', dur: '8' }, { key: 'e/5', dur: 'q' },
      // bar 2
      { key: 'd/5', dur: 'q' }, { key: 'f/5', dur: 'q' }, { key: 'e/5', dur: 'h' },
    ],
  },
  {
    clef: 'bass',
    velocity: 80,
    notes: [
      // bar 1: C, A (minor)
      { key: 'c/3', dur: 'h' }, { key: 'a/2', dur: 'h' },
      // bar 2: F, C
      { key: 'f/2', dur: 'h' }, { key: 'c/3', dur: 'h' },
    ],
  },
];

/** Beats covered by one duration code (quarter = 1); a trailing "d" dots it (×1.5). */
function durBeats(dur: string): number {
  const dotted = dur.endsWith('d');
  const base = (() => {
    switch (dotted ? dur.slice(0, -1) : dur) {
      case 'w': return 4;
      case 'h': return 2;
      case '8': return 0.5;
      case '16': return 0.25;
      default: return 1;
    }
  })();
  return dotted ? base * 1.5 : base;
}

const STEP: Record<string, number> = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };
/** VexFlow key ("c/4") → MIDI note number (middle C, "c/4", is 60). */
function keyToMidi(key: string): number {
  const [name, octText] = key.split('/');
  const letter = name[0]?.toLowerCase() ?? 'c';
  let semitone = STEP[letter] ?? 0;
  if (name.includes('#')) semitone += 1;
  if (name.length > 1 && name.slice(1).includes('b')) semitone -= 1;
  return (Number(octText) + 1) * 12 + semitone;
}

/** Per-staff timed events: each note's MIDI, start beat and duration in beats. */
interface TimedNote {
  midi: number;
  startBeat: number;
  durBeat: number;
  velocity: number;
}
const STAFF_EVENTS: TimedNote[][] = STAVES.map((staff) => {
  let beat = 0;
  return staff.notes.map((n) => {
    const durBeat = durBeats(n.dur);
    const ev: TimedNote = { midi: keyToMidi(n.key), startBeat: beat, durBeat, velocity: staff.velocity };
    beat += durBeat;
    return ev;
  });
});
const FLAT_EVENTS: TimedNote[] = STAFF_EVENTS.flat();

// ---- engine render ---------------------------------------------------------
type WasmModule = Awaited<ReturnType<typeof ensureWasm>>;

interface ProjectMidiEvent {
  __brand?: 'midi';
}
interface ProjectLike {
  setSampleRate(sr: number): void;
  setTempoSegments(segments: Array<{ startPpq: number; bpm: number }>): void;
  addMidiClip(startPpq: number, lengthPpq: number): { trackId: number; clipId: number };
  setMidiEvents(clipId: number, events: ProjectMidiEvent[]): void;
  bounceWithSynthInstrument(
    instrument: string | Record<string, unknown>,
    options: { numChannels: number; sampleRate: number; totalFrames: number },
  ): Float32Array;
  delete(): void;
}
interface ProjectCtor {
  new (): ProjectLike;
  midiNoteOn(ppq: number, group: number, channel: number, note: number, velocity: number): ProjectMidiEvent;
  midiNoteOff(ppq: number, group: number, channel: number, note: number, velocity?: number): ProjectMidiEvent;
}

let lastAudio: { samples: Float32Array; sampleRate: number } | null = null;
/** Audio buffer duration in seconds (phrase + release tail), for highlight timing. */
let audioDur = 0;

/**
 * Sequence the passage and bounce it through the chosen preset to mono PCM.
 *
 * The Project MIDI API measures position in QUARTER NOTES, not ticks — `ppq: 1`
 * is one quarter note, so each note's beat maps to its position directly (no PPQ
 * multiply). Notes are gated slightly short so repeats re-articulate, and the
 * buffer is peak-normalized so every preset auditions at a comparable level.
 */
function renderPassage(wasm: WasmModule): Float32Array {
  const Project = (wasm as unknown as { Project: ProjectCtor }).Project;
  const project = new Project();
  try {
    project.setSampleRate(SR);
    project.setTempoSegments([{ startPpq: 0, bpm: tempo.value }]);
    const { clipId } = project.addMidiClip(0, BEATS);

    // At a shared position, note-offs (key 0) sort before note-ons (key 1) so a
    // re-struck pitch is released before it is hit again.
    const tagged: Array<{ at: number; key: number; ev: ProjectMidiEvent }> = [];
    for (const e of FLAT_EVENTS) {
      const offBeat = e.startBeat + e.durBeat * GATE;
      tagged.push({ at: e.startBeat, key: 1, ev: Project.midiNoteOn(e.startBeat, 0, 0, e.midi, e.velocity) });
      tagged.push({ at: offBeat, key: 0, ev: Project.midiNoteOff(offBeat, 0, 0, e.midi, 0) });
    }
    tagged.sort((a, b) => a.at - b.at || a.key - b.key);
    project.setMidiEvents(clipId, tagged.map((t) => t.ev));

    const phraseSec = (BEATS * 60) / tempo.value;
    const totalFrames = Math.round(SR * (phraseSec + TAIL_SEC));
    audioDur = totalFrames / SR;
    const pcm = project.bounceWithSynthInstrument(instrument.value, {
      numChannels: 1,
      sampleRate: SR,
      totalFrames,
    });

    let peak = 1e-6;
    for (let i = 0; i < pcm.length; i++) peak = Math.max(peak, Math.abs(pcm[i]));
    const gain = 0.85 / peak;
    for (let i = 0; i < pcm.length; i++) pcm[i] *= gain;
    return pcm;
  } finally {
    project.delete();
  }
}

// ---- notation engraving (VexFlow) -----------------------------------------
/** A rendered notehead: its screen position and the beats it occupies. */
interface PlacedNote {
  x: number;
  y: number;
  startBeat: number;
  durBeat: number;
}
/** One staff's highlight mark and the notes it can light. */
interface StaffMark {
  el: SVGGElement;
  notes: PlacedNote[];
}
let marks: StaffMark[] = [];
let scoreRendered = false;

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * Engrave the passage onto a grand staff and stash, per staff, the rendered
 * notehead centers paired with their beats so the playback loop can light the
 * sounding note. Throws are caught by the caller — notation is non-essential.
 */
async function renderScore(target: HTMLDivElement): Promise<void> {
  target.replaceChildren();
  marks = [];

  const VF = await import('vexflow');
  // VexFlow draws glyphs in the Bravura font and measures them to place stems and
  // noteheads; rendering before the face loads measures with the fallback font and
  // pushes stems off the heads. Wait for it when the Font Loading API is present.
  if (typeof document !== 'undefined' && 'fonts' in document) {
    await Promise.all([
      document.fonts.load('30pt Bravura'),
      document.fonts.load('30pt Academico'),
    ]).catch(() => undefined);
  }

  const TIME = '4/4';
  const TOP_TREBLE = 24;
  const TOP_BASS = 104;
  // Generous initial canvas; the real bounds are measured after drawing and the
  // viewBox is fitted to them below (notes sit well above/below the staves).
  const HEIGHT = 230;
  // The grand-staff brace is drawn to the LEFT of the stave, so the stave needs a
  // left inset or the brace falls outside the viewBox and the screen clips it.
  const LEFT = 30;
  const RIGHT = 18; // room for the final (thin-then-thick) barline
  const RIGHT_PAD = 22;
  const BASE_WIDTH = 500;

  const ink = { fillStyle: INK, strokeStyle: INK };
  const staffInk = { fillStyle: INK, strokeStyle: STAFF_INK };

  /** Build a staff's StaveNotes (with dots) plus barlines between bars. */
  const buildStaff = (staff: ScoreStaff) => {
    const staveNotes: InstanceType<typeof VF.StaveNote>[] = [];
    const tickables: InstanceType<typeof VF.Note>[] = [];
    let beat = 0;
    for (const n of staff.notes) {
      if (beat > 0 && beat % 4 === 0) tickables.push(new VF.BarNote());
      const dotted = n.dur.endsWith('d');
      // `autoStem` flips each stem by the note's position — without it VexFlow
      // stems every note up, which points the high treble stems the wrong way.
      const note = new VF.StaveNote({ clef: staff.clef, keys: [n.key], duration: n.dur, autoStem: true });
      if (dotted) VF.Dot.buildAndAttach([note], { all: true });
      note.setStyle(ink);
      staveNotes.push(note);
      tickables.push(note);
      beat += durBeats(n.dur);
    }
    return { staveNotes, tickables };
  };

  const built = STAVES.map(buildStaff);
  const voices = built.map((b) => {
    const voice = new VF.Voice({ numBeats: BEATS, beatValue: 4 });
    voice.setMode(VF.VoiceMode.SOFT).addTickables(b.tickables);
    return voice;
  });

  const formatter = new VF.Formatter();
  voices.forEach((voice) => formatter.joinVoices([voice]));

  // Size the figure so dense notes never run past the stave: measure the clef +
  // time-signature block and the formatter's minimum note width, then grow the
  // stave if needed (the viewBox scales it back to the container).
  const probe = new VF.Stave(0, 0, 200);
  probe.addClef('treble');
  probe.addTimeSignature(TIME);
  const modifierWidth = probe.getNoteStartX() - probe.getX();
  const minNoteWidth = formatter.preCalculateMinTotalWidth(voices);
  const staveWidth = Math.max(BASE_WIDTH - LEFT - RIGHT, Math.ceil(modifierWidth + minNoteWidth + RIGHT_PAD));
  const renderWidth = LEFT + staveWidth + RIGHT;

  const renderer = new VF.Renderer(target, VF.Renderer.Backends.SVG);
  renderer.resize(renderWidth, HEIGHT);
  const context = renderer.getContext();
  context.setFillStyle(INK);
  context.setStrokeStyle(INK);

  const tops = [TOP_TREBLE, TOP_BASS];
  const staves = STAVES.map((staff, i) => {
    const stave = new VF.Stave(LEFT, tops[i], staveWidth);
    stave.addClef(staff.clef);
    stave.addTimeSignature(TIME);
    // A thin-then-thick final barline closes the piece like printed sheet music.
    stave.setEndBarType(VF.Barline.type.END);
    stave.setStyle(staffInk);
    stave.setContext(context).draw();
    return stave;
  });

  // Brace + opening barline tie the two staves into one grand staff; each stave's
  // own END barline closes the right edge.
  for (const type of [VF.StaveConnector.type.BRACE, VF.StaveConnector.type.SINGLE_LEFT]) {
    const connector = new VF.StaveConnector(staves[0], staves[1]);
    connector.setType(type);
    connector.setStyle(ink);
    connector.setContext(context).draw();
  }

  const noteArea = Math.min(...staves.map((s) => s.getNoteEndX() - s.getNoteStartX()));
  formatter.format(voices, noteArea - RIGHT_PAD);

  voices.forEach((voice, i) => voice.draw(context, staves[i]));

  // Beam consecutive eighths (and shorter); generateBeams leaves quarters/halves
  // alone, so the only beam here joins the two eighth notes in bar 1.
  for (const b of built) {
    for (const beam of VF.Beam.generateBeams(b.staveNotes)) {
      beam.setStyle(ink);
      beam.setContext(context).draw();
    }
  }

  const svg = target.querySelector('svg');
  if (!svg) return;
  // Fit the viewBox tightly around what VexFlow ACTUALLY drew. Notes can sit well
  // below the bass staff (and above the treble), past the nominal canvas height —
  // measuring the drawn extent and letting preserveAspectRatio "meet" contain it
  // means the engraving is always fully visible, never clipped by the screen.
  let cTop = Math.min(staves[0].getYForLine(0), staves[1].getYForLine(0));
  let cBot = Math.max(staves[0].getYForLine(4), staves[1].getYForLine(4));
  for (const b of built) {
    for (const sn of b.staveNotes) {
      for (const y of sn.getYs()) {
        cTop = Math.min(cTop, y);
        cBot = Math.max(cBot, y);
      }
    }
  }
  const VB_PAD = 16;
  svg.setAttribute('viewBox', `0 ${cTop - VB_PAD} ${renderWidth} ${cBot - cTop + VB_PAD * 2}`);
  svg.style.width = '';
  svg.style.height = '';

  // One hidden highlight mark per staff; the playback loop moves it to the
  // sounding note. Built from the real rendered notehead positions.
  for (let i = 0; i < STAVES.length; i++) {
    const placed: PlacedNote[] = built[i].staveNotes.map((sn, j) => ({
      x: sn.getAbsoluteX() + 6,
      y: sn.getYs()[0],
      startBeat: STAFF_EVENTS[i][j].startBeat,
      durBeat: STAFF_EVENTS[i][j].durBeat,
    }));
    const mark = document.createElementNS(SVG_NS, 'g');
    mark.style.visibility = 'hidden';
    // A soft candlelight halo under a crisp amber ring, sized to sit over a notehead.
    const glow = document.createElementNS(SVG_NS, 'circle');
    glow.setAttribute('class', 'sc-glow');
    glow.setAttribute('r', '15');
    glow.setAttribute('fill', 'rgba(200, 138, 30, 0.16)');
    const halo = document.createElementNS(SVG_NS, 'circle');
    halo.setAttribute('r', '10.5');
    halo.setAttribute('fill', 'rgba(214, 158, 54, 0.22)');
    const ring = document.createElementNS(SVG_NS, 'circle');
    ring.setAttribute('r', '9.5');
    ring.setAttribute('fill', 'none');
    ring.setAttribute('stroke', HILITE);
    ring.setAttribute('stroke-width', '1.6');
    mark.appendChild(glow);
    mark.appendChild(halo);
    mark.appendChild(ring);
    svg.appendChild(mark);
    marks.push({ el: mark, notes: placed });
  }
}

/** Move each staff's highlight onto the note sounding at the current position. */
function updateHighlight(): void {
  if (!marks.length) return;
  if (!isPlaying.value) {
    for (const m of marks) m.el.style.visibility = 'hidden';
    return;
  }
  // progress is 0..1 over the whole buffer; convert to beats via the tempo.
  const beat = progress.value * audioDur * (tempo.value / 60);
  for (const m of marks) {
    const note = m.notes.find((n) => n.startBeat <= beat && beat < n.startBeat + n.durBeat);
    if (note) {
      m.el.setAttribute('transform', `translate(${note.x} ${note.y})`);
      m.el.style.visibility = 'visible';
    } else {
      m.el.style.visibility = 'hidden';
    }
  }
}

// ---- lifecycle -------------------------------------------------------------
let disposed = false;

async function compute(): Promise<void> {
  if (disposed) return;
  try {
    if (status.value === 'idle') status.value = 'loading';
    const wasm = await ensureWasm();
    if (disposed) return;
    const pcm = renderPassage(wasm);
    lastAudio = { samples: pcm, sampleRate: SR };
    // Engrave once — the notation does not change with instrument or tempo. A
    // render failure is non-fatal: the audio still plays.
    if (!scoreRendered && host.value) {
      try {
        await renderScore(host.value);
        scoreRendered = true;
      } catch (e) {
        console.warn('[ScoreDemo] notation render failed; audio only', e);
      }
    }
    if (disposed) return;
    status.value = 'ready';
  } catch (e) {
    if (disposed) return;
    status.value = 'error';
    errorMsg.value = e instanceof Error ? e.message : String(e);
  }
}

async function onPlay(): Promise<void> {
  if (!lastAudio) await compute();
  if (lastAudio) await play(props.def.id, lastAudio);
}

// Coalesce rapid changes (slider drags) into one re-bounce per frame. The score
// itself is engraved only once, so only the audio is re-rendered here.
let pending = 0;
function scheduleCompute(): void {
  if (pending) return;
  pending = requestAnimationFrame(() => {
    pending = 0;
    compute();
  });
}

watch(
  () => [instrument.value, tempo.value],
  () => {
    if (props.active) scheduleCompute();
  },
);

watch(progress, updateHighlight);
watch(isPlaying, (on) => {
  if (!on) updateHighlight();
});

watch(
  () => props.active,
  (on) => {
    if (on && status.value === 'idle') compute();
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  disposed = true;
  if (pending) cancelAnimationFrame(pending);
});
</script>

<template>
  <DemoFrame
    eyebrow="MIDI · SCORE"
    :title="title"
    :caption="caption"
    :state="stateLabel"
    :tone="tone"
    :playing="isPlaying"
    :progress="progress"
    :disabled="status === 'loading'"
    :error="status === 'error' ? errorMsg : null"
    loading-label="ENGRAVING…"
    :show-playhead="false"
    @toggle="onPlay"
  >
    <template #screen>
      <!-- The sheet is lifted above the screen's grid/scanlines/brackets, but kept
           below them while loading or on error so those overlays still read. -->
      <div class="sc-paper" :class="{ 'sc-paper--lifted': status !== 'loading' && status !== 'error' }">
        <span class="sc-tempo" aria-hidden="true">&#9833; = {{ tempo }}</span>
        <div ref="host" class="sc-engrave" role="img" :aria-label="title" />
      </div>
    </template>
    <template #controls>
      <DemoControls
        :model-value="values"
        :params="def.params ?? []"
        :locale="loc"
        :disabled="status === 'loading'"
        @update:model-value="onParams"
      />
    </template>
  </DemoFrame>
</template>

<style scoped>
/* A sheet of warm manuscript paper set into the dark instrument screen — the
   engraving reads as printed sheet music rather than a glowing readout. */
.sc-paper {
  position: absolute;
  inset: 0;
  box-sizing: border-box;
  background:
    radial-gradient(120% 130% at 50% -10%, rgba(255, 253, 246, 0.95), rgba(255, 253, 246, 0) 58%),
    radial-gradient(150% 150% at 50% 125%, rgba(120, 92, 44, 0.12), rgba(120, 92, 44, 0) 55%),
    linear-gradient(180deg, #f7f2e6 0%, #f1e9d8 100%);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.7),
    inset 0 0 0 1px rgba(58, 46, 28, 0.10),
    inset 0 -22px 46px -30px rgba(72, 54, 24, 0.55);
}
/* Lift the page above the screen's grid, scanlines and corner brackets. */
.sc-paper--lifted {
  z-index: 3;
}
/* Faint laid-paper grain. */
.sc-paper::before {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  background-image: repeating-linear-gradient(90deg, rgba(80, 60, 30, 0.035) 0 1px, transparent 1px 3px);
  opacity: 0.6;
  mix-blend-mode: multiply;
}
/* A thin engraver's keyline just inside the page edge. */
.sc-paper::after {
  content: '';
  position: absolute;
  inset: 7px;
  pointer-events: none;
  border: 1px solid rgba(58, 46, 28, 0.13);
  border-radius: 2px;
}
.sc-tempo {
  position: absolute;
  top: 8px;
  left: 18px;
  z-index: 2;
  font-family: var(--font-reading), Georgia, serif;
  font-style: italic;
  font-size: clamp(11px, 1.5vw, 14px);
  letter-spacing: 0.02em;
  color: #5c4f37;
}
/* A definite box below the tempo marking; the SVG fills it and preserveAspectRatio
   "meet" (the default) scales the engraving to fit fully — never clipped. */
.sc-engrave {
  position: absolute;
  top: 28px;
  left: 18px;
  right: 18px;
  bottom: 14px;
  z-index: 1;
}
.sc-engrave :deep(svg) {
  width: 100%;
  height: 100%;
  display: block;
  /* Soft fade-in once the engraving is in place, unless the reader opts out. */
  animation: sc-fade 560ms ease both;
}
/* Gentle breathing glow on the sounding-note halo. */
.sc-engrave :deep(.sc-glow) {
  animation: sc-breathe 1.5s ease-in-out infinite;
  transform-box: fill-box;
  transform-origin: center;
}
@keyframes sc-fade {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes sc-breathe {
  0%, 100% { opacity: 0.55; }
  50% { opacity: 1; }
}
@media (prefers-reduced-motion: reduce) {
  .sc-engrave :deep(svg),
  .sc-engrave :deep(.sc-glow) {
    animation: none;
  }
}
</style>
