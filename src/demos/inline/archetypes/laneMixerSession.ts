/**
 * Engine session behind the `lane-mixer` archetype: three looping MIDI clips on
 * the realtime engine's lane mixer, rendered offline. Kept apart from the
 * component so the same boot, controls and render can be run headlessly.
 */
import { masterLimiterStripJson } from '@/utils/masterLimiter';

export const LANE_MIXER_SAMPLE_RATE = 44100;
export const LANE_MIXER_BPM = 120;
export const LANE_MIXER_BAR_PPQ = 4;
export const LANE_MIXER_BAR_FRAMES = Math.round(
  (LANE_MIXER_SAMPLE_RATE * LANE_MIXER_BAR_PPQ * 60) / LANE_MIXER_BPM,
);
/** Strip ids in lane order; lane index = position, track id = position + 1. */
export const LANE_MIXER_STRIP_IDS = ['lead', 'bass', 'drums'] as const;

// UMP MIDI 1.0 channel-voice words (group 0, channel 0).
const noteOn = (note: number, vel: number) =>
  ((0x2 << 28) | (0x9 << 20) | ((note & 0x7f) << 8) | (vel & 0x7f)) >>> 0;
const noteOff = (note: number) => ((0x2 << 28) | (0x8 << 20) | ((note & 0x7f) << 8)) >>> 0;

interface MidiEventLike {
  renderFrame: number;
  word0: number;
}

// The WASM `.d.ts` re-exports `RealtimeEngine` under an opaque alias, so the
// slice of its API used here is typed locally.
export interface LaneMixerEngine {
  setTempoSegments(segments: Array<{ startPpq: number; bpm: number }>): void;
  setLoop(startPpq: number, endPpq: number, enabled: boolean): boolean;
  setTrackLanes(lanes: number[]): void;
  setSynthInstrument(patch: string | Record<string, unknown>, destinationId: number): void;
  setMasterStripJson(sceneJson: string): void;
  setMidiClips(clips: Array<Record<string, unknown>>): void;
  setTrackStripJson(trackId: number, sceneJson: string): void;
  setSoloMute(laneIndex: number, solo: boolean, mute: boolean, renderFrame: number): void;
  renderOffline(channels: Float32Array[], blockSize?: number): Float32Array[];
  destroy(): void;
}

/** One quarter note of the one-bar loop, in samples. */
const Q = LANE_MIXER_BAR_FRAMES / 4;

function stepEvents(notes: Array<[beat: number, note: number, gate?: number]>): MidiEventLike[] {
  return notes
    .flatMap(([beat, note, gate = 0.45]) => [
      { renderFrame: Math.round(beat * Q), word0: noteOn(note, 100) },
      {
        renderFrame: Math.min(LANE_MIXER_BAR_FRAMES - 1, Math.round((beat + gate) * Q)),
        word0: noteOff(note),
      },
    ])
    .sort((a, b) => a.renderFrame - b.renderFrame);
}

function midiClip(trackId: number, events: MidiEventLike[]): Record<string, unknown> {
  return {
    id: trackId,
    trackId,
    destinationId: trackId, // instrument output routes to the lane whose track id matches
    startSample: 0,
    startPpq: 0,
    lengthSamples: LANE_MIXER_BAR_FRAMES,
    loop: true,
    loopLengthSamples: LANE_MIXER_BAR_FRAMES,
    events,
  };
}

/**
 * Build the session on a fresh engine: tempo, loop, three lanes with their
 * NativeSynth presets, the master strip's true-peak limiter, and the clips.
 */
export function createLaneMixerEngine(wasm: {
  RealtimeEngine: new (sampleRate: number, maxBlockSize: number) => unknown;
}): LaneMixerEngine {
  const e = new wasm.RealtimeEngine(LANE_MIXER_SAMPLE_RATE, 128) as LaneMixerEngine;
  e.setTempoSegments([{ startPpq: 0, bpm: LANE_MIXER_BPM }]);
  e.setLoop(0, LANE_MIXER_BAR_PPQ, true);
  e.setTrackLanes([1, 2, 3]);
  e.setSynthInstrument('saw-lead', 1);
  e.setSynthInstrument('sub-bass', 2);
  e.setSynthInstrument('drum-kit', 3);
  e.setMasterStripJson(masterLimiterStripJson());
  e.setMidiClips([
    midiClip(
      1,
      stepEvents([
        [0, 72],
        [1, 76],
        [2, 79],
        [3, 76],
      ]),
    ),
    midiClip(
      2,
      stepEvents([
        [0, 45, 0.9],
        [2, 43, 0.9],
      ]),
    ),
    midiClip(
      3,
      stepEvents([
        [0, 36, 0.2],
        [1, 38, 0.2],
        [2, 36, 0.2],
        [2.5, 36, 0.2],
        [3, 38, 0.2],
      ]),
    ),
  ]);
  return e;
}

/** Apply the reader's faders and mutes — these are the engine's own controls. */
export function applyLaneMixerControls(
  e: LaneMixerEngine,
  faderDb: readonly number[],
  muted: readonly boolean[],
): void {
  for (let t = 0; t < LANE_MIXER_STRIP_IDS.length; t++) {
    e.setTrackStripJson(
      t + 1,
      JSON.stringify({ strips: [{ id: LANE_MIXER_STRIP_IDS[t], faderDb: faderDb[t] }] }),
    );
    e.setSoloMute(t, false, muted[t], -1);
  }
}

/** Reused stereo render target — zeroed before each pass instead of reallocated. */
const renderChannels = [
  new Float32Array(LANE_MIXER_BAR_FRAMES),
  new Float32Array(LANE_MIXER_BAR_FRAMES),
];

/** Render one loop of the master mix, downmixed to mono for the shared player. */
export function renderLaneMixerLoop(e: LaneMixerEngine): Float32Array {
  for (const ch of renderChannels) ch.fill(0);
  const out = e.renderOffline(renderChannels);
  const mono = new Float32Array(LANE_MIXER_BAR_FRAMES);
  for (const ch of out)
    for (let i = 0; i < LANE_MIXER_BAR_FRAMES; i++) mono[i] += ch[i] / out.length;
  return mono;
}

/**
 * Share one in-flight boot between concurrent callers, but forget a boot that
 * rejected so the next call tries again instead of replaying the failure.
 */
export function createSharedBoot<T>(boot: () => Promise<T>): {
  ensure(): Promise<T>;
  reset(): void;
} {
  let pending: Promise<T> | null = null;
  return {
    ensure() {
      pending ??= boot().catch((error: unknown) => {
        pending = null;
        throw error;
      });
      return pending;
    },
    reset() {
      pending = null;
    },
  };
}
