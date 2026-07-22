/**
 * Tuner voice engine: wraps a physically-modeled exciter core in the shared
 * signal chain (exciter -> body resonator -> drive -> amp envelope -> gain),
 * mirroring `native_synth.cpp`'s per-voice render path. The chain runs both
 * offline (parity harness, WAV export) and in the AudioWorklet.
 *
 * The exciter core and its `*PatchParams` are the physical model the tuner
 * edits; the wrapper (envelope, body mix, drive, gain) is deliberately simple —
 * it exists so a tuned patch can be auditioned musically, not to reproduce the
 * host synth's full modulation matrix.
 */
import { BodyResonator, type BodyType } from './body-resonator';
import { type BowedStringPatchParams, BowedStringVoiceCore } from './bowed-voice';
import { type BrassPatchParams, BrassVoiceCore } from './brass-voice';
import { type FlutePatchParams, FluteVoiceCore } from './flute-voice';
import { type FreeReedPatchParams, FreeReedVoiceCore } from './free-reed-voice';
import { type KsPatchParams, KsVoiceCore } from './ks-voice';
import { type ModalPatchParams, ModalVoiceCore } from './modal-voice';
import {
  defaultBowedParams,
  defaultBrassParams,
  defaultFluteParams,
  defaultFreeReedParams,
  defaultKsParams,
  defaultModalParams,
  defaultPercussionParams,
  defaultPianoParams,
  defaultPipeOrganParams,
  defaultPluckedParams,
  defaultReedParams,
  defaultVocalParams,
  ENGINE_INFO,
  type PhysicalEngineMode,
} from './params';
import { type PercussionPatchParams, PercussionVoiceCore } from './percussion-voice';
import {
  PIANO_DIRECT_GAIN,
  type PianoPatchParams,
  PianoResonanceBank,
  PianoSoundboard,
  PianoVoiceCore,
} from './piano-voice';
import { type PipeOrganPatchParams, PipeOrganVoiceCore } from './pipe-organ-voice';
import { type PluckedStringPatchParams, PluckedStringVoiceCore } from './plucked-string-voice';
import { type ReedPatchParams, ReedVoiceCore } from './reed-voice';
import { type VocalPatchParams, VocalVoiceCore } from './vocal-voice';
import { voiceSeed } from './voice-random';

/** A simple ADSR amplitude envelope over the raw core output. */
export interface AmpEnvSpec {
  attackMs: number;
  decayMs: number;
  sustain: number;
  releaseMs: number;
}

/** The full model spec the tuner edits and serializes (wrapper + deep params). */
export interface ModelSpec {
  engineMode: PhysicalEngineMode;
  ks?: KsPatchParams;
  modal?: ModalPatchParams;
  bowed?: BowedStringPatchParams;
  reed?: ReedPatchParams;
  brass?: BrassPatchParams;
  flute?: FlutePatchParams;
  piano?: PianoPatchParams;
  pipeOrgan?: PipeOrganPatchParams;
  percussion?: PercussionPatchParams;
  pluckedString?: PluckedStringPatchParams;
  vocal?: VocalPatchParams;
  freeReed?: FreeReedPatchParams;
  body: BodyType;
  bodyMix: number;
  drive: number;
  ampEnv: AmpEnvSpec;
  gain: number;
}

/** The exciter-core surface the voice chain drives, common to all models. */
interface CoreHandle {
  render(pitchRatio: number): number;
  release(): void;
  kill(): void;
}

/** A near-transparent envelope for isolating the core (used by parity). */
export function transparentEnv(): AmpEnvSpec {
  return { attackMs: 1, decayMs: 100000, sustain: 1, releaseMs: 60 };
}

function noteToHz(note: number): number {
  return 440 * 2 ** ((note - 69) / 12);
}

type EnvStage = 'idle' | 'attack' | 'decay' | 'sustain' | 'release';

class AmpEnv {
  private stage: EnvStage = 'idle';
  private level = 0;
  private sampleRate: number;
  private attackInc = 0;
  private decayCoeff = 0;
  private releaseCoeff = 0;
  private sustainLevel = 0.8;

  constructor(sampleRate: number) {
    this.sampleRate = sampleRate;
  }

  configure(spec: AmpEnvSpec): void {
    const sr = this.sampleRate;
    this.attackInc = 1 / Math.max(1, (spec.attackMs / 1000) * sr);
    // Per-sample exponential coefficient reaching ~-60 dB over the stage time.
    this.decayCoeff = Math.exp(-6.907755279 / Math.max(1, (spec.decayMs / 1000) * sr));
    this.releaseCoeff = Math.exp(-6.907755279 / Math.max(1, (spec.releaseMs / 1000) * sr));
    this.sustainLevel = Math.max(0, Math.min(1, spec.sustain));
  }

  trigger(): void {
    this.stage = 'attack';
    this.level = 0;
  }

  release(): void {
    if (this.stage !== 'idle') this.stage = 'release';
  }

  done(): boolean {
    return this.stage === 'idle' || (this.stage === 'release' && this.level < 1e-5);
  }

  next(): number {
    switch (this.stage) {
      case 'idle':
        return 0;
      case 'attack':
        this.level += this.attackInc;
        if (this.level >= 1) {
          this.level = 1;
          this.stage = 'decay';
        }
        return this.level;
      case 'decay':
        this.level = this.sustainLevel + (this.level - this.sustainLevel) * this.decayCoeff;
        if (this.level <= this.sustainLevel + 1e-4) {
          this.level = this.sustainLevel;
          this.stage = 'sustain';
        }
        return this.level;
      case 'sustain':
        return this.sustainLevel;
      case 'release':
        this.level *= this.releaseCoeff;
        if (this.level < 1e-5) {
          this.level = 0;
          this.stage = 'idle';
        }
        return this.level;
    }
  }
}

/**
 * One polyphonic voice: an exciter core + body + amp envelope. The twelve model
 * cores are created lazily (only the engines actually played allocate their
 * delay lines) and cached per voice, so switching instruments is allocation-free
 * after the first use of each.
 */
export class PhysicalVoice {
  private sampleRate: number;
  private ks?: KsVoiceCore;
  private modal?: ModalVoiceCore;
  private bowed?: BowedStringVoiceCore;
  private reed?: ReedVoiceCore;
  private brass?: BrassVoiceCore;
  private flute?: FluteVoiceCore;
  private piano?: PianoVoiceCore;
  private pipeOrgan?: PipeOrganVoiceCore;
  private percussion?: PercussionVoiceCore;
  private pluckedString?: PluckedStringVoiceCore;
  private vocal?: VocalVoiceCore;
  private freeReed?: FreeReedVoiceCore;
  private current: CoreHandle | null = null;
  private body = new BodyResonator();
  // Piano's host-owned radiation chain (instrument-wide in the C++ engine): the
  // modal soundboard and the pedal-gated sympathetic bank. Created lazily for
  // the piano engine and composed around the voice core in renderCore().
  private pianoBoard?: PianoSoundboard;
  private pianoBank?: PianoResonanceBank;
  private usePianoBoard = false;
  private env: AmpEnv;
  private drive = 0;
  private driveMakeup = 1;
  private gain = 1;
  active = false;
  note = -1;

  constructor(sampleRate: number) {
    this.sampleRate = sampleRate;
    this.env = new AmpEnv(sampleRate);
  }

  noteOn(spec: ModelSpec, note: number, velocity: number, voiceIndex: number, age: bigint): void {
    this.gain = spec.gain;
    this.drive = spec.drive;
    this.driveMakeup = spec.drive > 0 ? 1 / Math.tanh(1 + 3 * spec.drive) : 1;
    const sr = this.sampleRate;
    const seed = voiceSeed(voiceIndex, note, age);
    this.current = this.startCore(spec, note, velocity, seed);
    // Prepare the piano soundboard/sympathetic bank at the patch's soundboard
    // mix so `spec.piano.soundboard` reaches the radiated output.
    if (spec.engineMode === 'piano' && spec.piano) {
      this.pianoBoard ??= new PianoSoundboard();
      this.pianoBank ??= new PianoResonanceBank();
      this.pianoBoard.prepare(sr, spec.piano.soundboard);
      this.pianoBank.prepare(sr);
      this.usePianoBoard = true;
    } else {
      this.usePianoBoard = false;
    }
    this.body.start(spec.body, sr, noteToHz(note), spec.bodyMix);
    this.env.configure(spec.ampEnv);
    this.env.trigger();
    this.active = true;
    this.note = note;
  }

  /** Lazily create + start the core for the spec's engine; returns its handle. */
  private startCore(
    spec: ModelSpec,
    note: number,
    velocity: number,
    seed: bigint,
  ): CoreHandle | null {
    const sr = this.sampleRate;
    switch (spec.engineMode) {
      case 'karplus-strong':
        this.ks ??= new KsVoiceCore(sr);
        if (spec.ks) this.ks.start(spec.ks, sr, note, velocity, seed);
        return this.ks;
      case 'modal':
        this.modal ??= new ModalVoiceCore();
        if (spec.modal) this.modal.start(spec.modal, sr, note, velocity, seed);
        return this.modal;
      case 'bowed-string':
        this.bowed ??= new BowedStringVoiceCore(sr);
        if (spec.bowed) this.bowed.start(spec.bowed, sr, note, velocity, seed);
        return this.bowed;
      case 'reed':
        this.reed ??= new ReedVoiceCore(sr);
        if (spec.reed) this.reed.start(spec.reed, sr, note, velocity, seed);
        return this.reed;
      case 'brass':
        this.brass ??= new BrassVoiceCore(sr);
        if (spec.brass) this.brass.start(spec.brass, sr, note, velocity, seed);
        return this.brass;
      case 'flute':
        this.flute ??= new FluteVoiceCore(sr);
        if (spec.flute) this.flute.start(spec.flute, sr, note, velocity, seed);
        return this.flute;
      case 'piano':
        this.piano ??= new PianoVoiceCore(sr);
        if (spec.piano) this.piano.start(spec.piano, sr, note, velocity, seed);
        return this.piano;
      case 'pipe-organ':
        this.pipeOrgan ??= new PipeOrganVoiceCore(sr);
        if (spec.pipeOrgan) this.pipeOrgan.start(spec.pipeOrgan, sr, note, velocity, seed);
        return this.pipeOrgan;
      case 'percussion':
        this.percussion ??= new PercussionVoiceCore(sr);
        if (spec.percussion) this.percussion.start(spec.percussion, sr, note, velocity, seed);
        return this.percussion;
      case 'plucked-string':
        this.pluckedString ??= new PluckedStringVoiceCore(sr);
        if (spec.pluckedString)
          this.pluckedString.start(spec.pluckedString, sr, note, velocity, seed);
        return this.pluckedString;
      case 'vocal':
        this.vocal ??= new VocalVoiceCore();
        if (spec.vocal) this.vocal.start(spec.vocal, sr, note, velocity, seed);
        return this.vocal;
      case 'free-reed':
        this.freeReed ??= new FreeReedVoiceCore();
        if (spec.freeReed) this.freeReed.start(spec.freeReed, sr, note, velocity, seed);
        return this.freeReed;
    }
  }

  /**
   * Release the note. `soft` skips the exciter core's physical damper (whose
   * time is the deep `releaseDampS`, often ~0.1 s and abrupt) and lets the amp
   * envelope's release be the whole fade — used live for struck/plucked voices
   * so a key-up rings out musically instead of snapping off. Offline renders
   * never release, so this only affects live playback.
   */
  noteOff(soft = false): void {
    if (!this.active) return;
    if (!soft) this.current?.release();
    this.env.release();
  }

  kill(): void {
    this.current?.kill();
    this.active = false;
    this.note = -1;
  }

  private renderCore(): number {
    if (!this.current) return 0;
    const dry = this.current.render(1);
    if (!this.usePianoBoard || !this.pianoBoard) return dry;
    // Compose the host piano radiation chain around the voice, exactly as
    // NativeSynth (and the parity harness) does for a single voice: the direct
    // share, the modal soundboard's phase-diffused complement, and the
    // sympathetic bank fed from the board's diffused tap (dampers closed — the
    // tuner has no sustain pedal).
    const board = this.pianoBoard.process(dry);
    const symp = this.pianoBank ? this.pianoBank.process(this.pianoBoard.lastDiffused(), false) : 0;
    return PIANO_DIRECT_GAIN * dry + board + symp;
  }

  /** Render one sample; returns 0 and deactivates when the envelope finishes. */
  render(): number {
    if (!this.active) return 0;
    let s = this.renderCore();
    if (this.body.active()) s = this.body.process(s);
    if (this.drive > 0) s = Math.tanh((1 + 3 * this.drive) * s) * this.driveMakeup;
    s *= this.env.next() * this.gain;
    if (this.env.done()) {
      this.active = false;
      this.note = -1;
    }
    return s;
  }
}

/** Default amp envelope per engine — the core supplies the decay; the wrapper
 * mostly provides attack + release and sustains everything in between. */
function defaultEnvFor(mode: PhysicalEngineMode): AmpEnvSpec {
  // Release times are audition-only (not part of the exported *PatchParams) and
  // are set to sound natural on key-up: struck/plucked engines get a long tail
  // (they mostly ring out on their own), sustained engines a smooth, quick fade
  // so releasing a held wind/organ/bow note stops without an abrupt gate.
  switch (mode) {
    case 'karplus-strong':
      return { attackMs: 2, decayMs: 100000, sustain: 1, releaseMs: 300 };
    case 'bowed-string':
      return { attackMs: 40, decayMs: 100000, sustain: 1, releaseMs: 260 };
    case 'piano':
      return { attackMs: 6, decayMs: 100000, sustain: 1, releaseMs: 700 };
    case 'modal':
      return { attackMs: 0.5, decayMs: 100000, sustain: 1, releaseMs: 500 };
    case 'percussion':
      return { attackMs: 0.5, decayMs: 100000, sustain: 1, releaseMs: 300 };
    case 'pipe-organ':
      return { attackMs: 14, decayMs: 100000, sustain: 1, releaseMs: 220 };
    case 'reed':
      return { attackMs: 40, decayMs: 100000, sustain: 1, releaseMs: 170 };
    case 'brass':
      return { attackMs: 25, decayMs: 100000, sustain: 1, releaseMs: 170 };
    case 'flute':
      return { attackMs: 18, decayMs: 100000, sustain: 1, releaseMs: 170 };
    case 'plucked-string':
      return { attackMs: 2, decayMs: 100000, sustain: 1, releaseMs: 300 };
    case 'vocal':
      return { attackMs: 30, decayMs: 100000, sustain: 1, releaseMs: 200 };
    case 'free-reed':
      return { attackMs: 20, decayMs: 100000, sustain: 1, releaseMs: 180 };
  }
}

/** Build a full, playable default spec for an engine (deep params + wrapper). */
export function buildDefaultSpec(mode: PhysicalEngineMode): ModelSpec {
  const info = ENGINE_INFO[mode];
  const spec: ModelSpec = {
    engineMode: mode,
    body: info.defaultBody,
    bodyMix: info.defaultBodyMix,
    drive: 0,
    ampEnv: defaultEnvFor(mode),
    gain: info.defaultGain,
  };
  switch (mode) {
    case 'karplus-strong':
      spec.ks = defaultKsParams();
      break;
    case 'modal':
      spec.modal = defaultModalParams();
      break;
    case 'bowed-string':
      spec.bowed = defaultBowedParams();
      break;
    case 'reed':
      spec.reed = defaultReedParams();
      break;
    case 'brass':
      spec.brass = defaultBrassParams();
      break;
    case 'flute':
      spec.flute = defaultFluteParams();
      break;
    case 'piano':
      spec.piano = defaultPianoParams();
      break;
    case 'pipe-organ':
      spec.pipeOrgan = defaultPipeOrganParams();
      break;
    case 'percussion': {
      // The raw struct default has numModes=0 (silent). Seed a playable pitched
      // membrane (a tom-like Rayleigh mode set) so the engine default rings,
      // mirroring how the modal default seeds a bar table.
      const p = defaultPercussionParams();
      p.numModes = 5;
      p.strikeR = 0.35;
      p.modeDecayS = 0.5;
      spec.percussion = p;
      break;
    }
    case 'plucked-string':
      spec.pluckedString = defaultPluckedParams();
      break;
    case 'vocal':
      spec.vocal = defaultVocalParams();
      break;
    case 'free-reed':
      spec.freeReed = defaultFreeReedParams();
      break;
  }
  return spec;
}

/**
 * Render a single note offline to mono PCM, for the parity harness and WAV
 * export. Releases the note at `releaseFrame` (default: sustain through the
 * whole buffer, then the tail is whatever the core rings out).
 */
export function renderNoteOffline(
  spec: ModelSpec,
  note: number,
  velocity: number,
  sampleRate: number,
  frames: number,
  releaseFrame = frames,
): Float32Array {
  const voice = new PhysicalVoice(sampleRate);
  voice.noteOn(spec, note, velocity, 0, 0n);
  const out = new Float32Array(frames);
  for (let i = 0; i < frames; ++i) {
    if (i === releaseFrame) voice.noteOff();
    out[i] = voice.render();
  }
  return out;
}
