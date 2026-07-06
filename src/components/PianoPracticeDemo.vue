<script setup lang="ts">
/**
 * Piano Practice — a falling-note ("rhythm game") player for single-track MIDI.
 *
 * A single melodic line scrolls down a vertical piano roll toward a strike line
 * sitting on a full-range keyboard; each key lights as its note lands. The audio
 * is rendered offline by the libsonare Project through its SoundFont player (a
 * public-domain acoustic grand), so the roll, the strike line, and the sound all
 * advance on one clock — the lit keys always match what you hear. A practice
 * speed control re-renders the passage slower without changing pitch, and any
 * single-track `.mid` can be loaded to practice your own part.
 *
 * Everything runs locally: the MIDI is parsed in the browser and the audio is
 * synthesized on-device — nothing is uploaded.
 */
import { computed, onBeforeUnmount, onMounted, reactive, ref, shallowRef } from 'vue';
import { createAudioBufferCache } from '@/components/practice/audioBufferCache';
import { GOLDBERG } from '@/components/practice/goldberg';
import { buildKeyboard, type KeyboardLayout } from '@/components/practice/keyboard';
import { type ParsedMidi, parseMidi } from '@/components/practice/midiSmf';
import PracticeKeyboard from '@/components/practice/PracticeKeyboard.vue';
import PracticeProgramBar from '@/components/practice/PracticeProgramBar.vue';
import PracticeRollFx from '@/components/practice/PracticeRollFx.vue';
import PracticeScore from '@/components/practice/PracticeScore.vue';
import PracticeTransport from '@/components/practice/PracticeTransport.vue';
import { enCopy, jaCopy, type SoundSource } from '@/components/practice/practiceCopy';
import { LEAD_IN_SEC } from '@/components/practice/rollConfig';
import { noteLabel, paintPracticeRoll, sameSet } from '@/components/practice/rollPainter';
import { useMidiInput } from '@/components/practice/useMidiInput';
import { type Judgment, useRhythmGame } from '@/components/practice/useRhythmGame';
import ToolShell from '@/components/ToolShell.vue';
import { StatusIndicator } from '@/components/ui';
import { useI18n } from '@/composables/useI18n';
import { ensureWasm } from '@/composables/useSonareDemoAudio';

type WasmModule = Awaited<ReturnType<typeof ensureWasm>>;

const { locale, localizedPath, alternateLocalePath, localizedValue } = useI18n();
const copy = computed(() => localizedValue({ en: enCopy, ja: jaCopy }));

// ---- constants -------------------------------------------------------------
const SR = 44100;
const SF2_URL = '/sf2/acoustic-grand.sf2';
// NativeSynth catalog preset for the built-in (synthesized) piano voice.
const SYNTH_PIANO_PRESET = 'acoustic-piano';
const TAIL_SEC = 1.6; // release tail captured past the last note-off
const reducedMotion =
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// ---- demo state ------------------------------------------------------------
type Status = 'idle' | 'loading' | 'rendering' | 'ready' | 'error';
const status = ref<Status>('loading');
const errorMsg = ref('');
const libVersion = ref('');

const midi = shallowRef<ParsedMidi | null>(null);
const layout = shallowRef<KeyboardLayout>(buildKeyboard(60, 71));
/** Index into {@link GOLDBERG} — the movement currently loaded. */
const currentMv = ref(0);

const isPlaying = ref(false);
// Playhead in 1x "score seconds". Starts at -LEAD_IN_SEC so the roll opens
// empty and the notes fall in from the top (the rhythm-game count-in).
const posBase = ref(-LEAD_IN_SEC);
const speed = ref<number>(1);
// Which engine renders the piano: libsonare's built-in NativeSynth physical-model
// piano ('synth', the default — no asset to fetch, so it plays instantly) or the
// bundled sampled SoundFont ('sf2', which loads its font on first use).
const soundSource = ref<SoundSource>('synth');
const volume = ref(0.85);
const muted = ref(false);

// ---- rhythm game ------------------------------------------------------------
const gameMode = ref(false);
const gameFinished = ref(false);
const lastJudge = ref<{ kind: Judgment; id: number } | null>(null);
let judgeSeq = 0;

/** Route a judgment to the effect layer (burst) and the HUD (pop + flash). */
function onJudge(kind: Judgment, note: number): void {
  rollFx.value?.hit(note, kind);
  lastJudge.value = { kind, id: ++judgeSeq };
}

const game = useRhythmGame({ onJudge });
const midiInput = useMidiInput({ onNoteOn: playNote, onNoteOff: releaseNote });
// Top-level refs so the template auto-unwraps them (nested refs on the returned
// object would not be).
const midiSupported = midiInput.supported;
const midiConnected = midiInput.connected;
const midiConnecting = midiInput.connecting;

/** Flattened, reactive game snapshot for the HUD (avoids nested-ref unwrap). */
const gameView = computed(() => ({
  score: game.score.value,
  combo: game.combo.value,
  maxCombo: game.maxCombo.value,
  accuracy: game.accuracy(),
  rank: game.rank(),
  fullCombo: game.fullCombo(),
  counts: game.counts,
  total: game.total.value,
}));

const baseDuration = computed(() => midi.value?.durationSec ?? 0);
const progressRatio = computed(() =>
  baseDuration.value > 0 ? Math.max(0, Math.min(1, posBase.value / baseDuration.value)) : 0,
);

// Localized label + character tag for the current movement.
const movementLabel = computed(() => {
  const mv = GOLDBERG[currentMv.value];
  return localizedValue({ en: mv.labelEn, ja: mv.labelJa });
});
const movementTag = computed(() => {
  const mv = GOLDBERG[currentMv.value];
  return localizedValue({ en: mv.tagEn ?? '', ja: mv.tagJa ?? '' });
});

// Notes currently sounding (from playback) plus any keys held by pointer, merged
// for the lit-key state.
const activeNotes = ref<Set<number>>(new Set());
const manualNotes = reactive<Set<number>>(new Set());
// Keys whose note lands within the next short window — a faint pre-glow on the
// keyboard that guides the eye to what's coming (Synthesia-style anticipation).
const upcomingNotes = ref<Set<number>>(new Set());
const ANTICIPATE_SEC = 0.28;

/**
 * Recompute the lit and pre-glow key sets from the current playhead. In practice
 * mode a key is active while a note sounds at `posBase` (unioned with the
 * pointer/MIDI-held keys) and the next notes get a faint pre-glow while playing
 * (the Synthesia-style anticipation). In game mode the keyboard reflects ONLY the
 * player's own strikes — the falling roll is the chart to play, not a free answer
 * key — so the playback notes light nothing. Both sets are diffed against their
 * previous value so an unchanged frame doesn't trigger a needless reactive repaint.
 */
function syncActiveNotes(): void {
  const active = new Set<number>(manualNotes);
  const upcoming = new Set<number>();
  const notes = midi.value?.notes;
  if (notes && !gameMode.value) {
    const pos = posBase.value;
    const showUpcoming = isPlaying.value;
    for (const n of notes) {
      if (n.startSec <= pos) {
        if (pos < n.endSec) active.add(n.midi);
      } else if (showUpcoming && n.startSec <= pos + ANTICIPATE_SEC) {
        upcoming.add(n.midi);
      }
    }
  }
  // A key that's already lit doesn't also need the fainter pre-glow.
  for (const m of active) upcoming.delete(m);
  if (!sameSet(active, activeNotes.value)) activeNotes.value = active;
  if (!sameSet(upcoming, upcomingNotes.value)) upcomingNotes.value = upcoming;
}

// Non-reactive paint caches, rebuilt when a piece is applied.
let keyByMidi = new Map<number, ReturnType<typeof buildKeyboard>['keys'][number]>();
let beatTimesSec: number[] = []; // onset seconds of every beat, for the lane grid
let barEveryBeats = 4; // beats per bar (from the first time signature when present)

// ---- status presentation ---------------------------------------------------
// `starting` is true from the moment a play click is handled until the source
// actually starts, so the transport shows its loading state immediately — even
// during the brief AudioContext resume before the bounce flips `status` to
// 'rendering'. It also guards the play path against re-entry: the bounce blocks
// the main thread synchronously, so without this a user who clicks again while
// "preparing" would queue a click that lands right after playback starts and
// toggles it back to pause — the "I have to press play several times" symptom.
const starting = ref(false);
// Busy = an audio bounce or MIDI load is in flight; the transport can't start
// yet, so play and the piece/speed controls show a loading state and disable.
const isBusy = computed(
  () => starting.value || status.value === 'rendering' || status.value === 'loading',
);

const statusKind = computed<'idle' | 'active' | 'warning' | 'error'>(() => {
  if (status.value === 'error') return 'error';
  if (status.value === 'rendering' || status.value === 'loading') return 'warning';
  if (isPlaying.value) return 'active';
  return 'idle';
});
const statusLabel = computed(() => {
  const s = copy.value.status;
  if (status.value === 'error') return s.error;
  if (status.value === 'rendering') return s.rendering;
  if (status.value === 'loading') return s.loading;
  if (isPlaying.value) return s.playing;
  if (posBase.value > 0.01) return s.paused;
  if (midi.value) return s.ready;
  return s.idle;
});

// ---- piece metadata ---------------------------------------------------------
const lengthLabel = computed(() => {
  const sec = baseDuration.value;
  const mm = Math.floor(sec / 60);
  const ss = Math.round(sec % 60);
  return `${mm}:${String(ss).padStart(2, '0')}`;
});
const rangeLabel = computed(() => {
  const m = midi.value;
  return m ? `${noteLabel(m.lowestMidi)}–${noteLabel(m.highestMidi)}` : '—';
});
const tempoLabel = computed(() => {
  const segs = midi.value?.tempoSegments ?? [];
  if (segs.length === 0) return '—';
  const bpms = segs.map((s) => Math.round(s.bpm));
  const lo = Math.min(...bpms);
  const hi = Math.max(...bpms);
  return lo === hi ? `${lo} BPM` : `${lo}–${hi} BPM`;
});

// ---- on-roll playback readouts ---------------------------------------------
// During the empty lead-in the roll shows nothing yet, so a count-in reassures
// the player that playback is running and cues the first note; once notes are
// falling a small elapsed-time clock keeps confirming it advances (skipped in
// game mode, where the score HUD already owns the corners).
const showCountIn = computed(() => isPlaying.value && posBase.value < 0);
const countInNum = computed(() => Math.max(1, Math.min(3, Math.ceil(-posBase.value))));
const showClock = computed(() => isPlaying.value && !gameMode.value && posBase.value >= 0);
const clockLabel = computed(() => {
  const sec = Math.max(0, Math.floor(posBase.value));
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')} / ${lengthLabel.value}`;
});

// ---- canvas ----------------------------------------------------------------
const canvas = ref<HTMLCanvasElement | null>(null);
const stage = ref<HTMLElement | null>(null);
const rollFx = ref<InstanceType<typeof PracticeRollFx> | null>(null);
let resizeObs: ResizeObserver | null = null;
let rafId = 0;

function ensureLoop(): void {
  if (!rafId) rafId = requestAnimationFrame(loop);
}
function stopLoop(): void {
  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = 0;
  }
}

function loop(): void {
  if (isPlaying.value) tickPlayback();
  if (isPlaying.value && gameMode.value) game.update(posBase.value);
  syncActiveNotes();
  paint();
  rafId = isPlaying.value ? requestAnimationFrame(loop) : 0;
}

function paint(): void {
  paintPracticeRoll({
    canvas: canvas.value,
    midi: midi.value,
    layout: layout.value,
    keyByMidi,
    beatTimesSec,
    barEveryBeats,
    posBase: posBase.value,
    activeNotes: activeNotes.value,
    reducedMotion,
    drawFx: (pos, active, isDark, animate) => rollFx.value?.draw(pos, active, isDark, animate),
  });
}

// ---- audio engine ----------------------------------------------------------
let audioCtx: AudioContext | null = null;
let gainNode: GainNode | null = null;
let source: AudioBufferSourceNode | null = null;
let audioBuffer: AudioBuffer | null = null;
let bufferSpeed = 0; // speed the current buffer was rendered at (0 = none)
let ctxStart = 0; // ctx.currentTime mapped to buffer offset 0

// Rendered bounces are cached per (piece × sound source × speed) so revisiting a
// movement, flipping the source, or dropping speed back replays instantly instead
// of bouncing again. The piece key folds in the source so the two engines never
// share an entry.
const audioBuffers = createAudioBufferCache('mv0:synth', 6);
const bounceKey = (): string => `mv${currentMv.value}:${soundSource.value}`;

let sf2Bytes: Uint8Array | null = null;
let warmed = false;

async function ensureSf2(): Promise<Uint8Array> {
  if (sf2Bytes) return sf2Bytes;
  const res = await fetch(SF2_URL);
  if (!res.ok) throw new Error(`SF2 fetch failed (${res.status})`);
  sf2Bytes = new Uint8Array(await res.arrayBuffer());
  return sf2Bytes;
}

/**
 * Warm the WASM module, SoundFont and the current movement's bounce on first
 * intent (hover / focus / touch) so the play click doesn't pay the
 * multi-megabyte fetch + WASM init + synchronous bounce latency. Cheap to call
 * repeatedly; the fetches are cached and the bounce is a no-op once cached.
 */
function prefetchEngine(): void {
  if (!warmed) {
    warmed = true;
    void ensureWasm().catch(() => {});
  }
  // The sampled voice needs the SoundFont; the built-in synth doesn't.
  if (soundSource.value === 'sf2') void ensureSf2().catch(() => {});
  void prewarmBuffer();
}

interface ProjectLike {
  setSampleRate(sr: number): void;
  setTempoSegments(segments: Array<{ startPpq: number; bpm: number }>): void;
  loadSoundFont(data: Uint8Array): void;
  addMidiClip(startPpq: number, lengthPpq: number): { clipId: number };
  setMidiEvents(clipId: number, events: unknown[]): void;
  bounceWithSf2Instrument(
    instrument: Record<string, unknown>,
    options: { numChannels: number; sampleRate: number; totalFrames: number },
  ): Float32Array;
  bounceWithSynthInstrument(
    instrument: string,
    options: { numChannels: number; sampleRate: number; totalFrames: number },
  ): Float32Array;
  delete(): void;
}
interface ProjectCtor {
  new (): ProjectLike;
  midiNoteOn(ppq: number, group: number, channel: number, note: number, velocity: number): unknown;
  midiNoteOff(
    ppq: number,
    group: number,
    channel: number,
    note: number,
    velocity?: number,
  ): unknown;
}

/** Bounce the loaded passage to a mono AudioBuffer at the given practice speed. */
async function renderBuffer(targetSpeed: number): Promise<void> {
  const m = midi.value;
  const ctx = audioCtx;
  if (!m || !ctx) return;
  const source = soundSource.value;
  const wasm = (await ensureWasm()) as WasmModule;
  const Project = (wasm as unknown as { Project: ProjectCtor }).Project;
  libVersion.value =
    (wasm as unknown as { version?: () => string }).version?.() ?? libVersion.value;

  const project = new Project();
  try {
    // The built-in synth needs no SoundFont; it synthesizes every note.
    if (source === 'sf2') project.loadSoundFont(await ensureSf2());
    project.setSampleRate(SR);
    // Scale every tempo segment by the practice speed; pitch is unaffected.
    project.setTempoSegments(
      m.tempoSegments.map((s) => ({ startPpq: s.startBeat, bpm: s.bpm * targetSpeed })),
    );
    const { clipId } = project.addMidiClip(0, m.durationBeats);

    const tagged: Array<{ at: number; key: number; ev: unknown }> = [];
    for (const n of m.notes) {
      tagged.push({
        at: n.startBeat,
        key: 1,
        ev: Project.midiNoteOn(n.startBeat, 0, 0, n.midi, n.velocity),
      });
      tagged.push({ at: n.endBeat, key: 0, ev: Project.midiNoteOff(n.endBeat, 0, 0, n.midi, 0) });
    }
    tagged.sort((a, b) => a.at - b.at || a.key - b.key);
    project.setMidiEvents(
      clipId,
      tagged.map((t) => t.ev),
    );

    const lengthSec = m.durationSec / targetSpeed + TAIL_SEC;
    const totalFrames = Math.round(SR * lengthSec);
    const options = { numChannels: 1, sampleRate: SR, totalFrames };
    const pcm =
      source === 'sf2'
        ? project.bounceWithSf2Instrument({ destinationId: 0, gain: 1 }, options)
        : project.bounceWithSynthInstrument(SYNTH_PIANO_PRESET, options);

    // The SoundFont renders at a low absolute level; normalize to a fixed headroom.
    let peak = 1e-6;
    for (let i = 0; i < pcm.length; i++) peak = Math.max(peak, Math.abs(pcm[i]));
    const gain = 0.9 / peak;
    const buffer = ctx.createBuffer(1, pcm.length, SR);
    const channel = buffer.getChannelData(0);
    for (let i = 0; i < pcm.length; i++) channel[i] = pcm[i] * gain;

    audioBuffer = buffer;
    bufferSpeed = targetSpeed;
    audioBuffers.set(targetSpeed, buffer);
  } finally {
    project.delete();
  }
}

function applyGain(): void {
  if (gainNode) gainNode.gain.value = muted.value ? 0 : volume.value;
}

/**
 * Start playback at a score-seconds offset. `leadSec` delays the audio so the
 * roll can scroll in from the top first — the rhythm-game count-in. During the
 * lead-in the playhead (`posBase`) runs negative, so notes fall from the top
 * before the first one reaches the strike line.
 */
function startSource(offsetBase: number, leadSec = 0): void {
  if (!audioCtx || !audioBuffer || !gainNode) return;
  source = audioCtx.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(gainNode);
  source.onended = onSourceEnded;
  const offsetInBuffer = offsetBase / bufferSpeed;
  const delay = Math.max(0, leadSec) / bufferSpeed;
  const startAt = audioCtx.currentTime + delay;
  ctxStart = startAt - offsetInBuffer;
  source.start(startAt, Math.max(0, offsetInBuffer));
}

function stopSource(): void {
  if (source) {
    // Detach the handler before stopping: stop() fires `onended` asynchronously,
    // so a transient flag would already be cleared by the time it runs and a
    // manual stop would be mistaken for a natural end.
    source.onended = null;
    try {
      source.stop();
    } catch {
      /* already stopped */
    }
    source.disconnect();
    source = null;
  }
}

function onSourceEnded(): void {
  // Reached the end naturally (manual stops detach this handler first).
  isPlaying.value = false;
  posBase.value = baseDuration.value;
  source = null;
  if (gameMode.value) {
    game.update(posBase.value); // sweep any final unplayed notes into misses
    gameFinished.value = true; // reveal the results card
  }
  syncActiveNotes();
  stopLoop();
  paint();
}

function tickPlayback(): void {
  if (!audioCtx) return;
  const elapsed = audioCtx.currentTime - ctxStart;
  posBase.value = Math.min(baseDuration.value, elapsed * bufferSpeed);
}

/** Create the AudioContext + gain (suspended is fine; no user gesture needed). */
function ensureCtx(): void {
  if (audioCtx) return;
  audioCtx = new (
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
  )();
  gainNode = audioCtx.createGain();
  gainNode.connect(audioCtx.destination);
}

async function ensureAudioReady(): Promise<void> {
  if (typeof window === 'undefined') return;
  ensureCtx();
  if (audioCtx?.state === 'suspended') await audioCtx.resume();
  applyGain();
  if (!audioBuffer || bufferSpeed !== speed.value) {
    const cached = audioBuffers.get(speed.value);
    if (cached) {
      audioBuffer = cached;
      bufferSpeed = speed.value;
    } else {
      status.value = 'rendering';
      // Paint the busy/disabled transport before the synchronous WASM bounce
      // freezes the main thread, so the button visibly switches to its loading
      // state instead of appearing unresponsive.
      await new Promise((r) => requestAnimationFrame(() => r(null)));
      await renderBuffer(speed.value);
    }
  }
}

/**
 * Render the current piece's audio ahead of the play click — kicked off when a
 * movement (or speed) is chosen, so the bounce happens while the user reads
 * rather than as a lag after pressing play. No-op if it's already cached.
 */
async function prewarmBuffer(): Promise<void> {
  if (typeof window === 'undefined' || !midi.value) return;
  if (audioBuffers.get(speed.value)) return; // already rendered for this piece × speed
  try {
    ensureCtx();
    status.value = 'rendering';
    // Yield once so the "preparing" overlay paints before the synchronous bounce.
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    // A play click during that yield may have already rendered + cached this
    // bounce; re-check so we don't redo the work.
    if (audioBuffers.get(speed.value)) {
      if (!isPlaying.value) status.value = 'ready';
      return;
    }
    await renderBuffer(speed.value);
    status.value = 'ready';
  } catch {
    status.value = 'ready'; // a real failure will surface on the play click
  }
}

// ---- transport actions ------------------------------------------------------
async function togglePlay(): Promise<void> {
  if (isPlaying.value) {
    pause();
    return;
  }
  if (starting.value) return;
  starting.value = true;
  try {
    if (posBase.value >= baseDuration.value) posBase.value = -LEAD_IN_SEC;
    await ensureAudioReady();
    status.value = 'ready';
    // At the head: music starts at buffer 0 but the playhead begins at
    // -LEAD_IN_SEC, so the roll counts in from empty. Mid-piece resumes instantly.
    const atHead = posBase.value <= 0;
    if (atHead && gameMode.value) startGame(0);
    startSource(atHead ? 0 : posBase.value, atHead ? LEAD_IN_SEC : 0);
    isPlaying.value = true;
    ensureLoop();
  } catch (e) {
    status.value = 'error';
    errorMsg.value = e instanceof Error ? e.message : copy.value.errors.render;
  } finally {
    starting.value = false;
  }
}

function pause(): void {
  if (!isPlaying.value) return;
  tickPlayback();
  stopSource();
  isPlaying.value = false;
  stopLoop();
  paint();
}

function restart(): void {
  const wasPlaying = isPlaying.value;
  stopSource();
  isPlaying.value = false;
  posBase.value = -LEAD_IN_SEC;
  gameFinished.value = false;
  if (gameMode.value) startGame(0);
  if (wasPlaying) void togglePlay();
  else {
    syncActiveNotes();
    paint();
  }
}

async function setSpeed(s: number): Promise<void> {
  if (s === speed.value) return;
  const wasPlaying = isPlaying.value;
  if (wasPlaying) pause();
  speed.value = s;
  // Reuse a cached render at the new tempo if there is one; else drop the buffer.
  const cached = audioBuffers.get(s);
  audioBuffer = cached ?? null;
  bufferSpeed = cached ? s : 0;
  if (wasPlaying) await togglePlay();
  else void prewarmBuffer();
}

async function setSource(s: SoundSource): Promise<void> {
  if (s === soundSource.value) return;
  const wasPlaying = isPlaying.value;
  if (wasPlaying) pause();
  soundSource.value = s;
  // Re-point the cache at this source's entries, reusing an existing render at
  // the current speed if one exists; otherwise drop the buffer so it re-bounces.
  audioBuffers.setPieceKey(bounceKey());
  const cached = audioBuffers.get(speed.value);
  audioBuffer = cached ?? null;
  bufferSpeed = cached ? speed.value : 0;
  if (wasPlaying) await togglePlay();
  else void prewarmBuffer();
}

function toggleMute(): void {
  muted.value = !muted.value;
  applyGain();
}

function onVolume(e: Event): void {
  volume.value = Number((e.target as HTMLInputElement).value);
  if (muted.value && volume.value > 0) muted.value = false;
  applyGain();
}

function seekToRatio(ratio: number): void {
  const target = Math.max(0, Math.min(1, ratio)) * baseDuration.value;
  const wasPlaying = isPlaying.value;
  // Seeking re-arms the chart from the new position, so the score reflects only
  // what was actually played from here.
  if (gameMode.value) {
    gameFinished.value = false;
    startGame(target);
  }
  if (wasPlaying) {
    stopSource();
    posBase.value = target;
    startSource(posBase.value);
  } else {
    posBase.value = target;
    syncActiveNotes();
    paint();
  }
}

const progressTrack = ref<HTMLElement | null>(null);
function onSeekClick(e: MouseEvent): void {
  const el = progressTrack.value;
  if (!el || baseDuration.value === 0) return;
  const rect = el.getBoundingClientRect();
  seekToRatio((e.clientX - rect.left) / rect.width);
}

// ---- movement loading -------------------------------------------------------
function applyMidi(parsed: ParsedMidi): void {
  // Reset playback for the new movement.
  stopSource();
  isPlaying.value = false;
  posBase.value = -LEAD_IN_SEC;
  // Identify the movement for the bounce cache, then reuse a cached render if
  // it (at the current speed) has already been bounced.
  audioBuffers.setPieceKey(bounceKey());
  const cached = audioBuffers.get(speed.value);
  audioBuffer = cached ?? null;
  bufferSpeed = cached ? speed.value : 0;
  manualNotes.clear();
  midi.value = parsed;
  const lay = buildKeyboard(parsed.lowestMidi, parsed.highestMidi);
  layout.value = lay;
  keyByMidi = new Map(lay.keys.map((k) => [k.midi, k]));
  beatTimesSec = computeBeatTimes(parsed);
  barEveryBeats = Math.max(1, Math.round(parsed.beatsPerBar));
  errorMsg.value = '';
  status.value = 'ready';
  gameFinished.value = false;
  if (gameMode.value) startGame(0);
  syncActiveNotes();
  requestAnimationFrame(paint);
}

/** Onset seconds of every integer beat, integrated through the tempo map. */
function computeBeatTimes(parsed: ParsedMidi): number[] {
  const segs = [...parsed.tempoSegments].sort((a, b) => a.startBeat - b.startBeat);
  if (segs.length === 0 || segs[0].startBeat > 0) segs.unshift({ startBeat: 0, bpm: 120 });
  const times: number[] = [];
  const totalBeats = Math.ceil(parsed.durationBeats) + 1;
  let sec = 0;
  let prevBeat = 0;
  let si = 0;
  for (let beat = 0; beat <= totalBeats; beat++) {
    while (si + 1 < segs.length && segs[si + 1].startBeat <= beat) {
      // Advance accumulated time up to this segment boundary before switching bpm.
      sec += ((segs[si + 1].startBeat - prevBeat) * 60) / segs[si].bpm;
      prevBeat = segs[si + 1].startBeat;
      si++;
    }
    sec += ((beat - prevBeat) * 60) / segs[si].bpm;
    prevBeat = beat;
    times.push(sec);
  }
  return times;
}

/** Load a Goldberg movement by catalog index (0 = Aria … 31 = Aria da capo). */
async function loadMovement(no: number): Promise<void> {
  const mv = GOLDBERG[Math.max(0, Math.min(GOLDBERG.length - 1, no))];
  status.value = 'loading';
  try {
    const res = await fetch(mv.file);
    if (!res.ok) throw new Error(`MIDI fetch failed (${res.status})`);
    const bytes = new Uint8Array(await res.arrayBuffer());
    const parsed = parseMidi(bytes);
    currentMv.value = mv.no;
    applyMidi(parsed);
  } catch (e) {
    status.value = 'error';
    errorMsg.value = e instanceof Error ? e.message : copy.value.errors.parse;
  }
}

/** Load a movement, then bounce it in the background so play is lag-free. */
function loadAndPrewarm(no: number): void {
  void loadMovement(no).then(() => {
    if (status.value !== 'error') void prewarmBuffer();
  });
}
function selectMovement(no: number): void {
  if (no === currentMv.value) return;
  loadAndPrewarm(no);
}
function stepMovement(delta: number): void {
  loadAndPrewarm(Math.max(0, Math.min(GOLDBERG.length - 1, currentMv.value + delta)));
}

// ---- game controls ----------------------------------------------------------
/** Arm a fresh chart from the current piece, ignoring notes before `fromSec`. */
function startGame(fromSec: number): void {
  game.reset(midi.value, fromSec);
  lastJudge.value = null;
}

function toggleGame(): void {
  gameMode.value = !gameMode.value;
  gameFinished.value = false;
  if (gameMode.value) startGame(isPlaying.value ? posBase.value : 0);
  syncActiveNotes();
  if (!isPlaying.value) paint();
}

function exitResults(): void {
  gameFinished.value = false;
}

/** From the results card: re-arm and play the chart again from the top. */
function replayGame(): void {
  gameFinished.value = false;
  stopSource();
  isPlaying.value = false;
  posBase.value = -LEAD_IN_SEC;
  void togglePlay();
}

function connectMidi(): void {
  void midiInput.connect();
}

// ---- note input (on-screen keys, mouse/touch, or a MIDI keyboard) ----------
/** A struck key: light it, and in game mode grade it against the chart. */
function playNote(midiNote: number): void {
  manualNotes.add(midiNote);
  if (gameMode.value && isPlaying.value) game.press(midiNote, posBase.value);
  syncActiveNotes();
  if (!isPlaying.value) paint();
}
function releaseNote(midiNote: number): void {
  manualNotes.delete(midiNote);
  syncActiveNotes();
  if (!isPlaying.value) paint();
}

// ---- lifecycle --------------------------------------------------------------
onMounted(() => {
  // The default built-in synth needs no asset fetch, so warm its bounce right
  // away: the render happens while the page settles and the intro is read, and
  // the first play starts instantly instead of waiting on a fresh bounce.
  loadAndPrewarm(0);
  if (stage.value && typeof ResizeObserver !== 'undefined') {
    resizeObs = new ResizeObserver(() => paint());
    resizeObs.observe(stage.value);
  }
  requestAnimationFrame(paint);
});

onBeforeUnmount(() => {
  stopLoop();
  stopSource();
  resizeObs?.disconnect();
  if (audioCtx) void audioCtx.close();
  audioCtx = null;
});

// ---- shell wiring -----------------------------------------------------------
const docsPath = computed(() => localizedPath('/docs/soundfont-player'));
const otherLocalePath = computed(() => alternateLocalePath('/practice'));
</script>

<template>
  <ToolShell
    demo-id="practice"
    :title="copy.title"
    :subtitle="copy.subtitle"
    :version="libVersion"
    :status="statusKind"
    :status-label="statusLabel"
    :docs-path="docsPath"
    :guide-title="copy.guideTitle"
    :guide-body="copy.guideBody"
    :guide-link-label="copy.guideLink"
    :opposite-locale-path="otherLocalePath"
  >
    <div class="practice">
      <div class="practice__intro">
        <span class="practice__eyebrow demo-label">{{ copy.eyebrow }}</span>
        <h1 class="practice__heading">{{ copy.heading }}</h1>
        <p class="practice__lead">{{ copy.intro }}</p>
      </div>

      <div ref="stage" class="practice__stage" @pointerdown="prefetchEngine">
        <div class="practice__roll">
          <canvas ref="canvas" class="practice__canvas"></canvas>
          <PracticeRollFx ref="rollFx" :layout="layout" :midi="midi" />
          <PracticeScore
            :visible="gameMode"
            :score="gameView.score"
            :combo="gameView.combo"
            :max-combo="gameView.maxCombo"
            :accuracy="gameView.accuracy"
            :counts="gameView.counts"
            :total="gameView.total"
            :judge="lastJudge"
            :finished="gameFinished"
            :rank="gameView.rank"
            :full-combo="gameView.fullCombo"
            :labels="copy.game"
            @retry="replayGame"
            @exit="exitResults"
          />
          <!-- Count-in over the empty lead-in, then a small elapsed clock. -->
          <div v-if="showCountIn" class="practice__countin" aria-hidden="true">
            <span class="practice__countin-label">{{ copy.countdown }}</span>
            <span :key="countInNum" class="practice__countin-num">{{ countInNum }}</span>
          </div>
          <div v-else-if="showClock" class="practice__clock" aria-hidden="true">
            {{ clockLabel }}
          </div>
          <div v-if="status === 'loading' || status === 'rendering'" class="practice__overlay">
            <span class="practice__spinner" aria-hidden="true"></span>
            <span class="practice__overlay-label">{{ copy.preparing }}</span>
            <span class="practice__overlay-note">{{ copy.preparingNote }}</span>
          </div>
        </div>
        <PracticeKeyboard
          :layout="layout"
          :active="activeNotes"
          :upcoming="upcomingNotes"
          @note-on="playNote"
          @note-off="releaseNote"
        />
      </div>

      <!-- Program bar: movement selector + game / MIDI -->
      <PracticeProgramBar
        :copy="copy"
        :movements="GOLDBERG"
        :locale="locale"
        :current-movement="currentMv"
        :is-busy="isBusy"
        :game-mode="gameMode"
        :midi-supported="midiSupported"
        :midi-connected="midiConnected"
        :midi-connecting="midiConnecting"
        @previous="stepMovement(-1)"
        @next="stepMovement(1)"
        @select="selectMovement"
        @toggle-game="toggleGame"
        @connect-midi="connectMidi"
      />

      <p v-if="gameMode && !gameFinished" class="practice__game-hint">{{ copy.game.hint }}</p>

      <!-- Seek / progress -->
      <div
        ref="progressTrack"
        class="practice__seek"
        role="slider"
        :aria-valuenow="Math.round(progressRatio * 100)"
        aria-valuemin="0"
        aria-valuemax="100"
        :aria-label="copy.meta.length"
        @click="onSeekClick"
      >
        <div class="practice__seek-fill" :style="{ width: `${progressRatio * 100}%` }"></div>
        <div class="practice__seek-head" :style="{ left: `${progressRatio * 100}%` }"></div>
      </div>

      <!-- Transport -->
      <PracticeTransport
        :copy="copy"
        :is-busy="isBusy"
        :has-midi="Boolean(midi)"
        :is-playing="isPlaying"
        :speed="speed"
        :source="soundSource"
        :muted="muted"
        :volume="volume"
        @prefetch="prefetchEngine"
        @play="togglePlay"
        @restart="restart"
        @speed="setSpeed"
        @source="setSource"
        @mute="toggleMute"
        @volume="onVolume"
      />

      <p v-if="status === 'error'" class="practice__error" role="alert">{{ errorMsg }}</p>

      <!-- Piece metadata -->
      <dl class="practice__meta">
        <div class="practice__meta-item practice__meta-item--piece">
          <dt class="demo-label">{{ copy.meta.piece }}</dt>
          <dd>
            <em>{{ copy.composer }}</em> · {{ copy.work }} · {{ movementLabel }}<template v-if="movementTag"> · {{ movementTag }}</template>
          </dd>
        </div>
        <div class="practice__meta-item">
          <dt class="demo-label">{{ copy.meta.notes }}</dt>
          <dd>{{ midi?.notes.length ?? '—' }}</dd>
        </div>
        <div class="practice__meta-item">
          <dt class="demo-label">{{ copy.meta.length }}</dt>
          <dd>{{ lengthLabel }}</dd>
        </div>
        <div class="practice__meta-item">
          <dt class="demo-label">{{ copy.meta.range }}</dt>
          <dd>{{ rangeLabel }}</dd>
        </div>
        <div class="practice__meta-item">
          <dt class="demo-label">{{ copy.meta.tempo }}</dt>
          <dd>{{ tempoLabel }}</dd>
        </div>
      </dl>
    </div>

    <template #statusbar>
      <StatusIndicator :status="statusKind" :label="statusLabel" />
      <span class="practice__statusnote">{{ copy.attribution }}</span>
    </template>
  </ToolShell>
</template>

<style src="./practice/PianoPracticeDemo.css"></style>
