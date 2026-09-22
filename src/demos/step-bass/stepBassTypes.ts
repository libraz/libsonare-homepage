/**
 * Data contracts for the step bass instrument: the pattern a visitor edits, the
 * knob positions, the engine-ready form both the live worklet and the WAV
 * export apply, and the messages between the main thread and the processor.
 *
 * `CompiledPattern` is structured-cloneable JSON and nothing else — no
 * functions, no class instances, and no automation ids, because an automation
 * id belongs to one engine instance. Lanes travel by parameter name and each
 * surface resolves its own ids.
 */

import type { SynthPatch } from '@/wasm/index';

/** The two oscillator shapes the panel offers. */
export type StepBassWaveform = 'saw' | 'square';

/**
 * What a step does with its pitch: speak a new note, hold the previous one, or
 * stay quiet. `tie` and `slide` are different things — a tie extends the note
 * already sounding, a slide glides into the note the *next* step speaks.
 */
export type StepGate = 'note' | 'tie' | 'rest';

export interface Step {
  gate: StepGate;
  /** MIDI note number; read only when `gate` is `'note'`. */
  note: number;
  accent: boolean;
  /** Glide into the next step. Meaningful only when that step is a `'note'`. */
  slide: boolean;
}

export interface Pattern {
  /** Exactly `STEP_COUNT` steps. */
  steps: Step[];
  /** MIDI note the factory patterns and the generator build around. */
  root: number;
}

/** Panel knob positions, in the units the panel shows rather than engine units. */
export interface Knobs {
  waveform: StepBassWaveform;
  tuningCents: number;
  cutoffHz: number;
  /** Resonance as panel travel, 0..1; the engine `resonanceQ` derives from it. */
  resonancePct: number;
  envModCents: number;
  decayMs: number;
  /** Accent amount, 0..1; scales every accent effect at once, to nothing at 0. */
  accent: number;
  /** Master fader position in dB. */
  faderDb: number;
}

/** One automation breakpoint, in ppq on the transport timeline. */
export interface CompiledLanePoint {
  ppq: number;
  value: number;
}

/**
 * Continuous instrument parameters a step sequences. Each is latched into
 * per-voice state at note-on, so a lane on one of them is per-step rather than
 * per-block.
 */
export type LaneParam = 'glideMs' | 'filterDecayMs';

/**
 * Instrument parameters a knob moves under a sounding note, plus the master
 * fader. The fader is addressed by a reserved id rather than resolved.
 * `velToCutoffCents` is here because ACCENT and RESONANCE both recompute it and
 * it applies to the whole patch, so it moves as a parameter rather than a lane.
 */
export type LiveParam =
  | 'cutoffHz'
  | 'resonanceQ'
  | 'envToCutoffCents'
  | 'pitchOffsetCents'
  | 'velToCutoffCents';

export interface CompiledLane {
  param: LaneParam;
  /** A step function: two points per held value, so nothing ramps between steps. */
  points: CompiledLanePoint[];
}

/** One MIDI event of the compiled clip, at an absolute frame inside the clip. */
export interface CompiledMidiEvent {
  renderFrame: number;
  word0: number;
}

export interface CompiledClip {
  id: number;
  trackId: number;
  destinationId: number;
  startSample: number;
  startPpq: number;
  lengthSamples: number;
  events: CompiledMidiEvent[];
}

/** Transport loop bounds, in ppq. The transport loops; the clip does not. */
export interface CompiledLoop {
  startPpq: number;
  endPpq: number;
}

/** Knob positions already converted to the engine units a parameter takes. */
export interface CompiledKnobs {
  cutoffHz: number;
  resonanceQ: number;
  envToCutoffCents: number;
  pitchOffsetCents: number;
  faderDb: number;
}

/**
 * Everything the engine needs to play one pattern, as plain JSON. The live path
 * posts this to the processor and the export path passes the same value to the
 * same apply function, which is what makes the two paths one path.
 */
export interface CompiledPattern {
  sampleRate: number;
  bpm: number;
  patch: SynthPatch;
  articulation: 'mono-legato';
  clip: CompiledClip;
  loop: CompiledLoop;
  lanes: CompiledLane[];
  knobs: CompiledKnobs;
  masterStripJson: string;
}

/** Which argument order `setSynthInstrument` takes on the engine object at hand. */
export type EngineSurface = 'native' | 'facade';

/**
 * The engine methods the apply sequence calls, structurally — the native embind
 * object and the JS facade both satisfy it, and they differ only in the
 * `setSynthInstrument` argument order.
 */
export interface StepBassEngine {
  prepareChannels(numChannels: number, maxFrames: number): void;
  getChannelBuffer(channel: number, numFrames: number): Float32Array;
  setMasterStripJson(sceneJson: string): void;
  setTrackLanes(lanes: number[]): void;
  setSynthInstrument(a: SynthPatch | number, b: SynthPatch | number): void;
  setArticulation(destinationId: number, channel: number, articulation: string): void;
  setTempoSegments(segments: { startPpq: number; bpm: number }[]): void;
  setMidiClips(clips: CompiledClip[]): void;
  resolveInstrumentAutomationId(destinationId: number, paramName: string): number;
  setAutomationLane(paramId: number, points: CompiledLanePoint[]): void;
  setLoop(startPpq: number, endPpq: number, enabled?: boolean): void;
  /**
   * `renderFrame` is required here even though the JS facade defaults it: the
   * native embind object has no default and throws on a zero-argument call, so
   * the shared type is the thing that keeps one out of the worklet.
   */
  play(renderFrame: number): void;
}

/** Automation ids the apply sequence resolved, keyed by parameter name. */
export type ResolvedParamIds = Partial<Record<LaneParam | LiveParam, number>>;

/** Main thread to processor. */
export type StepBassCommand =
  /** Full apply: boot, or a new pattern. The transport is left to `transport`. */
  | { type: 'apply'; compiled: CompiledPattern }
  /** A knob moved under a sounding note; the processor smooths it immediately. */
  | { type: 'param'; param: LiveParam; value: number }
  /** Master fader; addressed by the reserved id rather than a resolved one. */
  | { type: 'fader'; faderDb: number }
  /** Lane re-send: DECAY and ACCENT change what the steps carry. */
  | { type: 'lanes'; lanes: CompiledLane[] }
  /** Clip re-send: ACCENT changes the step velocities. */
  | { type: 'clip'; clip: CompiledClip }
  /** Waveform change; the processor rebinds at a step boundary, not on arrival. */
  | { type: 'waveform'; patch: SynthPatch }
  /** Tempo change: new clip at the new frame mapping, then seek to keep phase. */
  | { type: 'tempo'; bpm: number; clip: CompiledClip; seekPpq: number }
  | { type: 'transport'; action: 'play' | 'stop' };

/** Processor to main thread. */
export type StepBassEvent =
  | { type: 'ready' }
  | { type: 'error'; error: string }
  | {
      type: 'meter';
      /** Linear output peak over the reporting window. */
      peak: number;
      /** Transport position in samples when the block was rendered. */
      samplePosition: number;
      playing: boolean;
      /** The worklet's `currentTime` at that block, for extrapolation on rAF. */
      currentTime: number;
    };
