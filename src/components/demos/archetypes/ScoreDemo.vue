<script setup lang="ts">
/**
 * `score` archetype: a MIDI passage engraved as standard music notation.
 *
 * The same phrase the piano roll shows as a grid, this archetype reads as a grand
 * staff: melody and a broken-chord accompaniment on the treble staff (two voices),
 * the bass on the bass staff, with clefs, beamed eighths and a time signature
 * drawn by VexFlow. The notes come from the SHARED phrase the engine plays (see
 * midiPhrase) — switching the instrument re-voices the identical notes through a
 * different NativeSynth preset, and the tempo restretches the reading. Pressing
 * play bounces the passage and lights every sounding note the moment it plays, so
 * the score reads back in time with the audio.
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
import {
  durationCode,
  midiToVexKey,
  PHRASE_BEATS,
  PHRASE_BEATS_PER_BAR,
  PHRASE_VOICES,
  type TimedNote,
  timedNotes,
} from './midiPhrase';

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
// The shared three-voice phrase (see midiPhrase) read as a grand staff: the
// melody and the broken-chord accompaniment on the treble staff (two voices),
// the chord roots on the bass staff. These are the EXACT notes the engine plays —
// the piano-roll demo shows the same phrase as a grid.
const SR = 44100;
const BEATS = PHRASE_BEATS; // two 4/4 bars, in quarter notes
const GATE = 0.92; // note held for 92% of its slot, so repeats re-articulate
const TAIL_SEC = 1.2; // release tail captured past the last note-off
const INK = '#26211a'; // deep sepia — the engraved noteheads, stems and clefs
const STAFF_INK = '#6c6353'; // staff rules sit a touch lighter than the noteheads
const HILITE = '#b07410'; // amber — the note sounding now, lit like candlelight

// Which clef each physical staff of the grand staff carries, top to bottom.
const STAFF_CLEFS = ['treble', 'bass'] as const;

// Every voice flattened to absolute-beat events for the engine bounce.
const FLAT_EVENTS: TimedNote[] = PHRASE_VOICES.flatMap((voice) => timedNotes(voice));

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
  midiNoteOn(
    ppq: number,
    group: number,
    channel: number,
    note: number,
    velocity: number,
  ): ProjectMidiEvent;
  midiNoteOff(
    ppq: number,
    group: number,
    channel: number,
    note: number,
    velocity?: number,
  ): ProjectMidiEvent;
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
      tagged.push({
        at: e.startBeat,
        key: 1,
        ev: Project.midiNoteOn(e.startBeat, 0, 0, e.midi, e.velocity),
      });
      tagged.push({ at: offBeat, key: 0, ev: Project.midiNoteOff(offBeat, 0, 0, e.midi, 0) });
    }
    tagged.sort((a, b) => a.at - b.at || a.key - b.key);
    project.setMidiEvents(
      clipId,
      tagged.map((t) => t.ev),
    );

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

  // Build every phrase voice into VexFlow notes. The two treble voices (melody +
  // accompaniment) share the treble staff with opposed stems; the bass has the
  // bass staff to itself. Barlines are added to just the first voice of each staff
  // so interior barlines are not drawn twice.
  const STEM = { up: VF.Stem.UP, down: VF.Stem.DOWN } as const;
  const barlinedStaves = new Set<number>();
  const voiceBuilds = PHRASE_VOICES.map((pv) => {
    const staveIndex = STAFF_CLEFS.indexOf(pv.clef);
    const wantBarlines = !barlinedStaves.has(staveIndex);
    barlinedStaves.add(staveIndex);
    const events = timedNotes(pv);
    const staveNotes: InstanceType<typeof VF.StaveNote>[] = [];
    const tickables: InstanceType<typeof VF.Note>[] = [];
    let beat = 0;
    for (const [midi, durBeat] of pv.notes) {
      if (wantBarlines && beat > 0 && beat % PHRASE_BEATS_PER_BAR === 0) {
        tickables.push(new VF.BarNote());
      }
      const note = new VF.StaveNote({
        clef: pv.clef,
        keys: [midiToVexKey(midi)],
        duration: durationCode(durBeat),
        // `autoStem` flips a lone voice's stems by pitch; the two treble voices
        // force opposed directions so melody and accompaniment never collide.
        autoStem: pv.stem === 'auto',
      });
      if (pv.stem !== 'auto') note.setStemDirection(STEM[pv.stem]);
      note.setStyle(ink);
      staveNotes.push(note);
      tickables.push(note);
      beat += durBeat;
    }
    const vfVoice = new VF.Voice({ numBeats: BEATS, beatValue: 4 });
    vfVoice.setMode(VF.VoiceMode.SOFT).addTickables(tickables);
    return { staveIndex, staveNotes, vfVoice, events };
  });
  const allVoices = voiceBuilds.map((vb) => vb.vfVoice);

  const formatter = new VF.Formatter();
  // Voices sharing a staff are joined so they share tick contexts and align.
  for (let s = 0; s < STAFF_CLEFS.length; s++) {
    const staffVoices = voiceBuilds.filter((vb) => vb.staveIndex === s).map((vb) => vb.vfVoice);
    if (staffVoices.length) formatter.joinVoices(staffVoices);
  }

  // Size the figure so dense notes never run past the stave: measure the clef +
  // time-signature block and the formatter's minimum note width, then grow the
  // stave if needed (the viewBox scales it back to the container).
  const probe = new VF.Stave(0, 0, 200);
  probe.addClef('treble');
  probe.addTimeSignature(TIME);
  const modifierWidth = probe.getNoteStartX() - probe.getX();
  const minNoteWidth = formatter.preCalculateMinTotalWidth(allVoices);
  const staveWidth = Math.max(
    BASE_WIDTH - LEFT - RIGHT,
    Math.ceil(modifierWidth + minNoteWidth + RIGHT_PAD),
  );
  const renderWidth = LEFT + staveWidth + RIGHT;

  const renderer = new VF.Renderer(target, VF.Renderer.Backends.SVG);
  renderer.resize(renderWidth, HEIGHT);
  const context = renderer.getContext();
  context.setFillStyle(INK);
  context.setStrokeStyle(INK);

  const tops = [TOP_TREBLE, TOP_BASS];
  const staves = STAFF_CLEFS.map((clef, i) => {
    const stave = new VF.Stave(LEFT, tops[i], staveWidth);
    stave.addClef(clef);
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
  formatter.format(allVoices, noteArea - RIGHT_PAD);

  voiceBuilds.forEach((vb) => {
    vb.vfVoice.draw(context, staves[vb.staveIndex]);
  });

  // Beam each voice's eighths (the accompaniment); quarters and halves are left
  // alone. maintainStemDirections keeps the inner voice's beamed stems pointing
  // down so they stay clear of the melody above.
  for (const vb of voiceBuilds) {
    for (const beam of VF.Beam.generateBeams(vb.staveNotes, { maintainStemDirections: true })) {
      beam.setStyle(ink);
      beam.setContext(context).draw();
    }
  }

  const svg = target.querySelector('svg');
  if (!svg) return;
  // Fit the viewBox tightly around what VexFlow ACTUALLY drew (notes sit well
  // above the treble and below the bass staff), then let preserveAspectRatio
  // "meet" contain it — so the engraving is always fully visible, never clipped.
  let cTop = Math.min(...staves.map((s) => s.getYForLine(0)));
  let cBot = Math.max(...staves.map((s) => s.getYForLine(4)));
  for (const vb of voiceBuilds) {
    for (const sn of vb.staveNotes) {
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

  // One hidden highlight mark per voice, so the melody, accompaniment and bass
  // notes sounding at a given instant all light at once. Built from the real
  // rendered notehead positions.
  marks = voiceBuilds.map((vb) => {
    const placed: PlacedNote[] = vb.staveNotes.map((sn, j) => ({
      x: sn.getAbsoluteX() + 6,
      y: sn.getYs()[0],
      startBeat: vb.events[j].startBeat,
      durBeat: vb.events[j].durBeat,
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
    return { el: mark, notes: placed };
  });
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
