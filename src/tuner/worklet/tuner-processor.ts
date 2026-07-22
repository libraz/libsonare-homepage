/**
 * AudioWorklet processor hosting the pure-TypeScript physical-model tuner engine.
 *
 * Unlike the main synth demo (which runs libsonare's WASM `RealtimeEngine` in the
 * worklet), this processor renders the TS port of the twelve physical-model cores
 * directly — the whole point of the tuner is to drive parameters the WASM ABI
 * does not expose. It is bundled to a self-contained ES module by
 * `scripts/build-tuner-worklet.mjs` (esbuild) so no Vite client injection reaches
 * `AudioWorkletGlobalScope`.
 *
 * Message protocol (main thread -> processor):
 *   { type: 'spec', spec }         replace the active model spec
 *   { type: 'noteOn', note, velocity }
 *   { type: 'noteOff', note }
 *   { type: 'panic' }              silence all voices
 *   { type: 'gain', value }        output gain
 *
 * Message protocol (processor -> main thread):
 *   { type: 'ready' }
 *   { type: 'meter', peak }
 *   { type: 'voiceEnded', note }   a latched voice decayed to silence on its own
 */
import { buildDefaultSpec, type ModelSpec, PhysicalVoice } from '../dsp/engine';
import { PIANO_DIRECT_GAIN, PianoResonanceBank, PianoSoundboard } from '../dsp/piano-voice';

// AudioWorkletGlobalScope ambients (not in the default lib for this project).
declare const sampleRate: number;
declare function registerProcessor(name: string, ctor: unknown): void;
declare abstract class AudioWorkletProcessor {
  readonly port: MessagePort;
  process(
    inputs: Float32Array[][],
    outputs: Float32Array[][],
    parameters: Record<string, Float32Array>,
  ): boolean;
}

const MAX_VOICES = 8;
/** Below this linear peak a voice counts as inaudible for end detection. */
const SILENCE_THRESH = 1e-4;
/** How long (seconds) a voice must stay silent before it is declared ended. */
const SILENCE_HOLD_S = 0.3;
/** Struck/plucked engines get a soft key-up (amp-release fade, no hard damper). */
const DECAYING_ENGINES = new Set([
  'karplus-strong',
  'plucked-string',
  'piano',
  'modal',
  'percussion',
]);

interface WorkletMessage {
  type: string;
  spec?: ModelSpec;
  note?: number;
  velocity?: number;
  value?: number;
}

class TunerProcessor extends AudioWorkletProcessor {
  private voices: PhysicalVoice[] = [];
  private spec: ModelSpec = buildDefaultSpec('karplus-strong');
  private outputGain = 0.9;
  private age = 0n;
  private seq = 0;
  /** Per-voice block peak, reused each render block for end detection. */
  private vpeak: number[] = new Array(MAX_VOICES).fill(0);
  /** Per-voice consecutive silent-sample count (resets on any audible block). */
  private silent: number[] = new Array(MAX_VOICES).fill(0);
  private readonly silenceHold = Math.round(sampleRate * SILENCE_HOLD_S);
  /** Piano radiation is instrument-wide, matching NativeSynth: all dry voice
   * outputs feed one persistent soundboard and sympathetic bank. */
  private readonly pianoBoard = new PianoSoundboard();
  private readonly pianoBank = new PianoResonanceBank();
  private pianoRadiationReady = false;
  private pianoSoundboardMix = -1;

  constructor() {
    super();
    for (let i = 0; i < MAX_VOICES; ++i) this.voices.push(new PhysicalVoice(sampleRate, true));
    this.port.onmessage = (e: MessageEvent<WorkletMessage>) => this.onMessage(e.data);
    this.port.postMessage({ type: 'ready' });
  }

  private onMessage(msg: WorkletMessage): void {
    switch (msg.type) {
      case 'spec':
        if (msg.spec) {
          this.spec = msg.spec;
          this.preparePianoRadiation(false);
        }
        break;
      case 'noteOn':
        if (typeof msg.note === 'number') this.noteOn(msg.note, msg.velocity ?? 100);
        break;
      case 'noteOff':
        if (typeof msg.note === 'number') this.noteOff(msg.note);
        break;
      case 'panic':
        for (const v of this.voices) v.kill();
        this.preparePianoRadiation(true);
        break;
      case 'gain':
        if (typeof msg.value === 'number') this.outputGain = msg.value;
        break;
    }
  }

  private noteOn(note: number, velocity: number): void {
    // Prefer a free voice; else steal the oldest-sounding (lowest note is a
    // cheap, predictable heuristic for a tuning tool playing a few notes).
    let slot = this.voices.findIndex((v) => !v.active);
    if (slot < 0) slot = 0;
    this.age += 1n;
    this.silent[slot] = 0;
    this.voices[slot].noteOn(this.spec, note, velocity, slot, this.age);
  }

  private preparePianoRadiation(force: boolean): void {
    const piano = this.spec.engineMode === 'piano' ? this.spec.piano : undefined;
    if (!piano) return;
    if (!force && this.pianoRadiationReady && piano.soundboard === this.pianoSoundboardMix) return;
    this.pianoBoard.prepare(sampleRate, piano.soundboard);
    this.pianoBank.prepare(sampleRate);
    this.pianoSoundboardMix = piano.soundboard;
    this.pianoRadiationReady = true;
  }

  private noteOff(note: number): void {
    const soft = DECAYING_ENGINES.has(this.spec.engineMode);
    for (const v of this.voices) {
      if (v.active && v.note === note) v.noteOff(soft);
    }
  }

  process(_inputs: Float32Array[][], outputs: Float32Array[][]): boolean {
    const output = outputs[0];
    if (!output || output.length < 1) return true;
    const left = output[0];
    const right = output[1] ?? output[0];
    const n = left.length;
    const g = this.outputGain;
    const voices = this.voices;
    const vc = voices.length;
    let peak = 0;
    for (let vi = 0; vi < vc; ++vi) this.vpeak[vi] = 0;
    for (let i = 0; i < n; ++i) {
      let s = 0;
      for (let vi = 0; vi < vc; ++vi) {
        const v = voices[vi];
        if (!v.active) continue;
        const sv = v.render();
        s += sv;
        const av = sv < 0 ? -sv : sv;
        if (av > this.vpeak[vi]) this.vpeak[vi] = av;
      }
      if (this.spec.engineMode === 'piano' && this.pianoRadiationReady) {
        const board = this.pianoBoard.process(s);
        const sympathetic = this.pianoBank.process(this.pianoBoard.lastDiffused(), false);
        s = PIANO_DIRECT_GAIN * s + board + sympathetic;
      }
      s *= g;
      left[i] = s;
      if (right !== left) right[i] = s;
      const a = s < 0 ? -s : s;
      if (a > peak) peak = a;
    }
    this.detectEndedVoices(n);
    this.publishMeter(peak);
    return true;
  }

  /**
   * A latched voice (never note-off'd) on a decaying engine — plucked string,
   * piano, mallet, drum — keeps `active` true because its amp envelope sustains,
   * even after the physical core has rung out. Detect that the audible output
   * has stayed below {@link SILENCE_THRESH} for {@link SILENCE_HOLD_S}, free the
   * voice, and tell the main thread so it can un-light the held key. Self-
   * oscillating voices (bowed / wind / organ) never fall silent while held, so
   * this never fires for them.
   */
  private detectEndedVoices(blockLen: number): void {
    for (let vi = 0; vi < this.voices.length; ++vi) {
      const v = this.voices[vi];
      if (!v.active) {
        this.silent[vi] = 0;
        continue;
      }
      if (this.vpeak[vi] >= SILENCE_THRESH) {
        this.silent[vi] = 0;
        continue;
      }
      this.silent[vi] += blockLen;
      if (this.silent[vi] >= this.silenceHold) {
        const note = v.note;
        v.kill();
        this.silent[vi] = 0;
        this.port.postMessage({ type: 'voiceEnded', note });
      }
    }
  }

  private publishMeter(peak: number): void {
    if (++this.seq % 6 !== 0) return;
    this.port.postMessage({ type: 'meter', peak });
  }
}

registerProcessor('libsonare-tuner', TunerProcessor);
