/**
 * AudioWorklet processor source for the step bass instrument. It hosts the
 * native embind `RealtimeEngine` in the audio thread with its own WASM heap
 * (SAB-free) and drives it from the transport rather than from a JS scheduler.
 *
 * The apply sequence is not written here: `applyCompiled` is embedded verbatim,
 * so the live path runs the same function body the WAV export imports.
 */

import { applyCompiled } from '@/demos/step-bass/stepBassApply';
import {
  MASTER_FADER_PARAM_ID,
  RENDER_NOW,
  STEP_BASS_CHANNEL,
} from '@/demos/step-bass/stepBassPatch';

/** AudioWorklet render quantum; the engine scratch is prepared for this size. */
const BLOCK_SIZE = 128;
/** Stereo output, matching the channels `applyCompiled` prepares. */
const CHANNELS = 2;

/** Registered name of the processor this source installs. */
export const STEP_BASS_PROCESSOR = 'libsonare-step-bass';

/** Meter cadence in render blocks: about 16 ms at 128 frames and 48 kHz. */
export const METER_BLOCK_INTERVAL = 6;

/** UMP channel-voice status nibble of a note-on. */
const NOTE_ON_STATUS = 0x9;

/**
 * Build the processor source. `applyCompiled` is embedded by `toString()` and
 * bound to a `const` of its own name, so a minified build whose function name
 * was mangled still resolves the call.
 *
 * @param sonareUrl Absolute URL of the emscripten `sonare.js` factory module.
 * @returns ES-module source registering the {@link STEP_BASS_PROCESSOR}.
 */
export function buildStepBassProcessorSource(sonareUrl: string): string {
  return `
import createModule from '${sonareUrl}';

const BLOCK = ${BLOCK_SIZE};
const CHANNELS = ${CHANNELS};
const CHANNEL = ${STEP_BASS_CHANNEL};
const FADER_ID = ${MASTER_FADER_PARAM_ID};
const METER_BLOCKS = ${METER_BLOCK_INTERVAL};
const NOTE_ON = ${NOTE_ON_STATUS};
const RENDER_NOW = ${RENDER_NOW};

const applyCompiled = ${applyCompiled.toString()};

/** Frames at which the clip speaks a new note, ascending. */
function noteOnFrames(clip) {
  const frames = [];
  for (const event of clip.events) {
    if (((event.word0 >>> 20) & 0xf) !== NOTE_ON) continue;
    if ((event.word0 & 0x7f) === 0) continue;
    frames.push(event.renderFrame);
  }
  frames.sort((a, b) => a - b);
  return frames;
}

class StepBassProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const o = options.processorOptions || {};
    this.ready = false;
    this.engine = null;
    this.channelBuffers = [];
    this.blocks = 0;
    this.paramIds = {};
    this.pendingCompiled = o.compiled || null;
    /** Waveform rebind waiting for a step boundary that speaks a note. */
    this.pendingPatch = null;
    this.destination = 0;
    this.articulation = 'poly';
    this.loopFrames = 0;
    this.noteOns = [];
    /** Transport intent, so re-applying a pattern cannot start a stopped loop. */
    this.playing = false;

    this.port.onmessage = (e) => this.onMessage(e.data);
    createModule({ wasmBinary: o.wasmBinary, locateFile: () => 'sonare.wasm' })
      .then((mod) => {
        if (!mod.RealtimeEngine) throw new Error('RealtimeEngine is not available in this WASM build');
        this.engine = new mod.RealtimeEngine(sampleRate, BLOCK, 1024, 1024);
        if (this.pendingCompiled) this.applyPattern(this.pendingCompiled);
        this.pendingCompiled = null;
        this.ready = true;
        this.port.postMessage({ type: 'ready' });
      })
      .catch((err) => this.port.postMessage({ type: 'error', error: String(err) }));
  }

  applyPattern(compiled) {
    this.paramIds = applyCompiled(this.engine, compiled, 'native');
    this.destination = compiled.clip.destinationId;
    this.articulation = compiled.articulation;
    this.loopFrames = compiled.clip.lengthSamples;
    this.noteOns = noteOnFrames(compiled.clip);
    this.pendingPatch = null;
    // applyCompiled acquired its own heap views; take ours from the same call.
    for (let ch = 0; ch < CHANNELS; ch++) {
      this.channelBuffers[ch] = this.engine.getChannelBuffer(ch, BLOCK);
    }
    // Applying leaves the transport alone, so state it here: a re-apply while
    // running keeps running, and the instrument boots stopped.
    if (this.playing) {
      this.engine.play(RENDER_NOW);
    } else {
      this.engine.stop(RENDER_NOW);
      this.engine.seekPpq(0, RENDER_NOW);
    }
  }

  installClip(clip) {
    this.engine.setMidiClips([clip]);
    this.loopFrames = clip.lengthSamples;
    this.noteOns = noteOnFrames(clip);
  }

  onMessage(msg) {
    if (!msg) return;
    if (msg.type === 'transport') this.playing = msg.action === 'play';
    if (!this.engine) {
      if (msg.type === 'apply') this.pendingCompiled = msg.compiled;
      return;
    }
    try {
      switch (msg.type) {
        case 'apply':
          this.applyPattern(msg.compiled);
          break;
        case 'param': {
          const id = this.paramIds[msg.param];
          if (id !== undefined) this.engine.setParameterSmoothed(id, msg.value, RENDER_NOW);
          break;
        }
        case 'fader':
          this.engine.setParameterSmoothed(FADER_ID, msg.faderDb, RENDER_NOW);
          break;
        case 'lanes':
          for (const lane of msg.lanes) {
            const id = this.paramIds[lane.param];
            if (id !== undefined) this.engine.setAutomationLane(id, lane.points);
          }
          break;
        case 'clip':
          this.installClip(msg.clip);
          break;
        case 'waveform':
          // Held until a boundary; rebinding mid-note would cut it short.
          this.pendingPatch = msg.patch;
          break;
        case 'tempo':
          this.engine.setTempoSegments([{ startPpq: 0, bpm: msg.bpm }]);
          this.installClip(msg.clip);
          this.engine.seekPpq(msg.seekPpq, RENDER_NOW);
          break;
        case 'transport':
          if (msg.action === 'play') {
            this.engine.play(RENDER_NOW);
          } else {
            this.engine.stop(RENDER_NOW);
            this.engine.pushMidiPanic(RENDER_NOW);
            this.engine.seekPpq(0, RENDER_NOW);
          }
          break;
        default:
          break;
      }
    } catch (err) {
      this.port.postMessage({ type: 'error', error: String(err) });
    }
  }

  /**
   * Rebind the instrument only in the block that reaches a note-on, so a tie or
   * a slide is never cut and the new shape speaks from that note onward. The
   * boundary is visible here and nowhere else: rAF stops in a background tab.
   */
  rebindAtBoundary(frames) {
    const state = this.engine.getTransportState();
    if (state.playing && this.loopFrames > 0 && this.noteOns.length > 0) {
      const position = state.samplePosition % this.loopFrames;
      let reached = false;
      for (const frame of this.noteOns) {
        if ((frame - position + this.loopFrames) % this.loopFrames < frames) {
          reached = true;
          break;
        }
      }
      if (!reached) return;
    }
    const patch = this.pendingPatch;
    this.pendingPatch = null;
    try {
      // Native arg order is (destinationId, patch).
      this.engine.setSynthInstrument(this.destination, patch);
      // Binding an instrument resets the articulation, so ask for it again.
      this.engine.setArticulation(this.destination, CHANNEL, this.articulation);
    } catch (err) {
      this.port.postMessage({ type: 'error', error: String(err) });
    }
  }

  process(_inputs, outputs) {
    const output = outputs[0];
    if (!output || output.length < 1) return true;
    const n = output[0].length;
    if (!this.ready || !this.engine) {
      for (const channel of output) channel.fill(0);
      return true;
    }

    // Re-acquire heap views if WASM memory growth detached them.
    if ((this.channelBuffers[0]?.byteLength ?? 0) === 0) {
      for (let ch = 0; ch < CHANNELS; ch++) {
        this.channelBuffers[ch] = this.engine.getChannelBuffer(ch, BLOCK);
      }
    }

    const frames = Math.min(n, BLOCK);
    if (this.pendingPatch) this.rebindAtBoundary(frames);
    // The instrument is a generator; clear its input scratch before processing.
    for (let ch = 0; ch < CHANNELS; ch++) this.channelBuffers[ch].fill(0, 0, frames);
    this.engine.processPrepared(frames);

    let peak = 0;
    for (let ch = 0; ch < output.length; ch++) {
      const src = this.channelBuffers[ch] || this.channelBuffers[0];
      const dst = output[ch];
      for (let i = 0; i < frames; i++) {
        const s = src[i];
        dst[i] = s;
        const a = s < 0 ? -s : s;
        if (a > peak) peak = a;
      }
      for (let i = frames; i < n; i++) dst[i] = 0;
    }
    this.publishMeter(peak);
    return true;
  }

  publishMeter(peak) {
    if (++this.blocks % METER_BLOCKS !== 0) return;
    const state = this.engine.getTransportState();
    // currentTime stamps the position so rAF can extrapolate instead of asking.
    this.port.postMessage({
      type: 'meter',
      peak,
      samplePosition: state.samplePosition,
      playing: state.playing,
      currentTime,
    });
  }
}

registerProcessor('${STEP_BASS_PROCESSOR}', StepBassProcessor);
`;
}
