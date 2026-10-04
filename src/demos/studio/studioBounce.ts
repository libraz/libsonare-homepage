import { BAR_PPQ, STEP_COUNT, STUDIO_TRACKS, type StudioPattern } from '@/demos/studio/studioCopy';
import { applyOps, createRawTarget, type EngineOp, type StripSpec } from '@/utils/engineApply';
import { MASTER_LIMITER_CEILING_DB, MASTER_LIMITER_PROCESSOR } from '@/utils/masterLimiter';
import { noteOffWord, noteOnWord } from '@/utils/ump';

type WasmModule = typeof import('@/wasm/index.js');

/** Sample rate of the WAV export and the stem waveform views. */
export const EXPORT_SAMPLE_RATE = 48000;
/** The export repeats the one-bar pattern this many times. */
export const EXPORT_BARS = 2;
/** Room after the last bar for the instruments' release tails. */
export const EXPORT_TAIL_SECONDS = 1.6;
/** Render block size of the offline export engine. */
const EXPORT_BLOCK_SIZE = 128;

/** The master strip: the engine's true-peak limiter as its one post-fader insert. */
const MASTER_STRIP: StripSpec = {
  inserts: [
    {
      slot: 'post',
      processor: MASTER_LIMITER_PROCESSOR,
      params: { ceilingDb: MASTER_LIMITER_CEILING_DB },
    },
  ],
};

/** Mixer state the export applies: linear fader gains, mutes, master. */
export interface StudioMixSettings {
  gains: number[];
  mutes: boolean[];
  masterGain: number;
}

/** Linear fader value (0..~1.4) to dB for an engine strip fader. */
export function linearToDb(value: number): number {
  return value <= 0.0001 ? -100 : 20 * Math.log10(value);
}

/** Engine lane track ids are 1-based; destination id == track id. */
export function laneTrackId(index: number): number {
  return index + 1;
}

/** One bar of the loop, in engine-timeline samples at the given rate. */
export function barFrames(sampleRate: number, bpm: number): number {
  return Math.round((sampleRate * BAR_PPQ * 60) / bpm);
}

/** Frames of the WAV export: the repeated bars plus the release tail. */
export function exportFrames(bpm: number): number {
  return (
    barFrames(EXPORT_SAMPLE_RATE, bpm) * EXPORT_BARS +
    Math.round(EXPORT_SAMPLE_RATE * EXPORT_TAIL_SECONDS)
  );
}

/**
 * Compile the step pattern into one MIDI clip per track for the engine's lane
 * mixer. Each clip loops its one-bar content over `bars` bars. Event
 * `renderFrame`s are absolute engine-timeline samples; the fixed tempo map
 * (`startPpq: 0`) makes the conversion a plain ratio.
 */
export function buildLaneClips(
  pattern: StudioPattern,
  bpm: number,
  sampleRate: number,
  bars: number,
) {
  const frames = barFrames(sampleRate, bpm);
  const clips = [];
  for (let t = 0; t < STUDIO_TRACKS.length; t++) {
    const def = STUDIO_TRACKS[t];
    const events: { renderFrame: number; word0: number }[] = [];
    for (let row = 0; row < def.rows.length; row++) {
      for (let step = 0; step < STEP_COUNT; step++) {
        if (!pattern[t][row][step]) continue;
        const start = Math.round((step * frames) / STEP_COUNT);
        const end = Math.min(start + Math.round((def.gatePpq / BAR_PPQ) * frames), frames - 1);
        events.push({ renderFrame: start, word0: noteOnWord(def.rows[row].note, def.velocity) });
        events.push({ renderFrame: end, word0: noteOffWord(def.rows[row].note) });
      }
    }
    if (events.length === 0) continue;
    events.sort((a, b) => a.renderFrame - b.renderFrame);
    clips.push({
      id: laneTrackId(t),
      trackId: laneTrackId(t),
      destinationId: laneTrackId(t),
      startSample: 0,
      startPpq: 0,
      lengthSamples: frames * bars,
      loop: true,
      loopLengthSamples: frames,
      events,
    });
  }
  return clips;
}

/** Lanes, one NativeSynth per lane, and the limited master strip. */
export function studioSetupOps(): EngineOp[] {
  return [
    {
      type: 'topology',
      buses: [],
      lanes: STUDIO_TRACKS.map((_, i) => ({ trackId: laneTrackId(i), sends: [] })),
    },
    ...STUDIO_TRACKS.map(
      (def, i): EngineOp => ({
        type: 'synthInstrument',
        destinationId: laneTrackId(i),
        preset: def.preset,
      }),
    ),
    // The scene installs only the limiter; the master fader op comes after it.
    { type: 'strip', strip: { kind: 'master' }, spec: MASTER_STRIP },
  ];
}

/** One track's fader, from its linear UI value. */
export function trackFaderOp(index: number, gain: number): EngineOp {
  return { type: 'fader', target: laneTrackId(index), db: linearToDb(gain) };
}

/** One track's mute; the studio has no solo. */
export function trackMuteOp(index: number, muted: boolean): EngineOp {
  return { type: 'soloMute', trackId: laneTrackId(index), solo: false, mute: muted };
}

/** The master fader, from its linear UI value. */
export function masterFaderOp(gain: number): EngineOp {
  return { type: 'fader', target: 'master', db: linearToDb(gain) };
}

/** The pattern's MIDI clip schedule, replacing the previous one. */
export function studioClipsOp(
  pattern: StudioPattern,
  bpm: number,
  sampleRate: number,
  bars: number,
): EngineOp {
  return { type: 'midiClips', clips: buildLaneClips(pattern, bpm, sampleRate, bars) };
}

/**
 * The whole session as engine ops: setup, every fader and mute, the master
 * fader, then the clip schedule. Tempo is a transport setting and stays out.
 */
export function buildStudioOps(
  pattern: StudioPattern,
  bpm: number,
  settings: StudioMixSettings,
  sampleRate: number,
  bars: number,
): EngineOp[] {
  return [
    ...studioSetupOps(),
    ...STUDIO_TRACKS.flatMap((_, i) => [
      trackFaderOp(i, settings.gains[i]),
      trackMuteOp(i, settings.mutes[i]),
    ]),
    masterFaderOp(settings.masterGain),
    studioClipsOp(pattern, bpm, sampleRate, bars),
  ];
}

/** Whether any unmuted track has an active step. */
function audible(pattern: StudioPattern, mutes: readonly boolean[]): boolean {
  return STUDIO_TRACKS.some((_, t) => !mutes[t] && pattern[t].some((row) => row.some(Boolean)));
}

/**
 * Render the session the way the live engine plays it — the same ops on a raw
 * engine — but offline and deterministic, as interleaved stereo at
 * {@link EXPORT_SAMPLE_RATE}. Returns null when nothing would sound (every
 * track muted or empty).
 */
export function renderStudioMix(
  mod: WasmModule,
  pattern: StudioPattern,
  bpm: number,
  settings: StudioMixSettings,
): Float32Array | null {
  if (!audible(pattern, settings.mutes)) return null;
  const engine = new mod.RealtimeEngine(EXPORT_SAMPLE_RATE, EXPORT_BLOCK_SIZE);
  try {
    engine.setTempoSegments([{ startPpq: 0, bpm }]);
    applyOps(
      createRawTarget(engine),
      buildStudioOps(pattern, bpm, settings, EXPORT_SAMPLE_RATE, EXPORT_BARS),
    );
    engine.play();
    // The bounce primes one stopped block and settles every ramp before the first audible one.
    return engine.bounceOffline({
      totalFrames: exportFrames(bpm),
      blockSize: EXPORT_BLOCK_SIZE,
      numChannels: 2,
      dither: 0,
    }).interleaved;
  } finally {
    engine.destroy();
  }
}
