import { BAR_PPQ, STEP_COUNT, STUDIO_TRACKS, type StudioPattern } from '@/demos/studio/studioCopy';
import { masterLimiterStripJson } from '@/utils/masterLimiter';
import { noteOffWord, noteOnWord } from '@/utils/ump';

type WasmModule = typeof import('@/wasm/index.js');

/** Sample rate of the WAV export and the stem waveform views. */
export const EXPORT_SAMPLE_RATE = 48000;
/** The export repeats the one-bar pattern this many times. */
export const EXPORT_BARS = 2;
/** Room after the last bar for the instruments' release tails. */
export const EXPORT_TAIL_SECONDS = 1.6;

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

/**
 * Render the session the way the live engine plays it — the same lane strips,
 * mutes, master fader and master limiter — but offline and deterministic, as
 * interleaved stereo at {@link EXPORT_SAMPLE_RATE}. Returns null when nothing
 * would sound (every track muted or empty).
 */
export function renderStudioMix(
  mod: WasmModule,
  pattern: StudioPattern,
  bpm: number,
  settings: StudioMixSettings,
): Float32Array | null {
  const clips = buildLaneClips(pattern, bpm, EXPORT_SAMPLE_RATE, EXPORT_BARS).filter(
    (clip) => !settings.mutes[clip.trackId - 1],
  );
  if (clips.length === 0) return null;
  const total = exportFrames(bpm);
  const engine = new mod.RealtimeEngine(EXPORT_SAMPLE_RATE, 128);
  try {
    engine.setTempoSegments([{ startPpq: 0, bpm }]);
    engine.setTrackLanes(STUDIO_TRACKS.map((_, i) => laneTrackId(i)));
    for (let i = 0; i < STUDIO_TRACKS.length; i++) {
      const def = STUDIO_TRACKS[i];
      engine.setSynthInstrument(def.preset, laneTrackId(i));
      engine.setTrackStripJson(
        laneTrackId(i),
        JSON.stringify({ strips: [{ id: def.id, faderDb: linearToDb(settings.gains[i]) }] }),
      );
      engine.setSoloMute(i, false, settings.mutes[i]);
    }
    engine.setMasterStripJson(masterLimiterStripJson(linearToDb(settings.masterGain)));
    engine.setMidiClips(clips);
    const planes = engine.renderOffline([new Float32Array(total), new Float32Array(total)]);
    const interleaved = new Float32Array(total * 2);
    for (let f = 0; f < total; f++) {
      interleaved[2 * f] = planes[0][f];
      interleaved[2 * f + 1] = planes[1][f];
    }
    return interleaved;
  } finally {
    engine.destroy();
  }
}
