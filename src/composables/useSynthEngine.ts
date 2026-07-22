import { ref, shallowRef } from 'vue';
import type { SynthPatch } from '@/wasm/index';

export interface SynthMeterState {
  /** Linear output peak (0..1+) over the most recent reporting window. */
  peak: number;
}

// AudioWorklet render quantum. The engine scratch is prepared for this size.
const BLOCK_SIZE = 128;
// Stereo output. The NativeSynth renders a stereo bus.
const CHANNELS = 2;
// UMP group / MIDI channel used for every note the demo plays.
export const SYNTH_GROUP = 0;
export const SYNTH_CHANNEL = 0;
// Realtime MIDI destination the synth instrument is bound to.
export const SYNTH_DESTINATION = 0;

/**
 * Build the AudioWorklet processor source. It runs libsonare's NativeSynth in
 * the audio thread with its own WASM heap (SAB-free): the emscripten module is
 * built from a transferred wasm binary, a raw `RealtimeEngine` is bound to the
 * patch-driven synth, and note/CC/patch commands arrive over the port. The
 * render path is allocation-free (`processPrepared` over prepared scratch).
 *
 * Mirrors the proven `useRealtimeFx` wiring: static-import the emscripten
 * factory from `sonare.js` (dynamic import is forbidden in worklet scope), then
 * drive the native embind `RealtimeEngine` directly. The native method argument
 * order differs from the high-level JS wrapper — notably `setSynthInstrument`
 * takes `(destinationId, patch)`.
 *
 * @param sonareUrl Absolute URL of the emscripten `sonare.js` factory module.
 * @returns ES-module source registering the `libsonare-synth` processor.
 */
export function buildSynthProcessorSource(sonareUrl: string): string {
  return `
import createModule from '${sonareUrl}';

const BLOCK = ${BLOCK_SIZE};
const CHANNELS = ${CHANNELS};
const DEST = ${SYNTH_DESTINATION};
const GROUP = ${SYNTH_GROUP};
const CHANNEL = ${SYNTH_CHANNEL};

class LibsonareSynthProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const o = options.processorOptions || {};
    this.ready = false;
    this.engine = null;
    this.channelBuffers = [];
    this.seq = 0;
    this.outputGain = 0.9;
    this.pendingPatch = o.patch || 'e-piano';

    this.port.onmessage = (e) => this.onMessage(e.data);
    createModule({ wasmBinary: o.wasmBinary, locateFile: () => 'sonare.wasm' })
      .then((mod) => {
        if (!mod.RealtimeEngine) throw new Error('RealtimeEngine is not available in this WASM build');
        this.engine = new mod.RealtimeEngine(sampleRate, BLOCK, 1024, 1024);
        this.engine.prepareChannels(CHANNELS, BLOCK);
        for (let ch = 0; ch < CHANNELS; ch++) {
          this.channelBuffers[ch] = this.engine.getChannelBuffer(ch, BLOCK);
        }
        // Native arg order is (destinationId, patch).
        this.engine.setSynthInstrument(DEST, this.pendingPatch);
        this.engine.setMidiInputSource(DEST);
        this.ready = true;
        this.port.postMessage({ type: 'ready' });
      })
      .catch((err) => this.port.postMessage({ type: 'error', error: String(err) }));
  }

  onMessage(msg) {
    if (!msg) return;
    if (msg.type === 'noteOn') {
      if (this.engine) this.engine.pushMidiInputNoteOn(GROUP, CHANNEL, msg.note, msg.velocity, 0);
    } else if (msg.type === 'noteOff') {
      if (this.engine) this.engine.pushMidiInputNoteOff(GROUP, CHANNEL, msg.note, 0, 0);
    } else if (msg.type === 'cc') {
      if (this.engine) this.engine.pushMidiInputCc(GROUP, CHANNEL, msg.controller, msg.value, 0);
    } else if (msg.type === 'panic') {
      if (this.engine) this.engine.pushMidiPanic(-1);
    } else if (msg.type === 'patch') {
      this.pendingPatch = msg.patch;
      if (this.engine) {
        try { this.engine.setSynthInstrument(DEST, msg.patch); this.engine.setMidiInputSource(DEST); }
        catch (err) { this.port.postMessage({ type: 'error', error: String(err) }); }
      }
    } else if (msg.type === 'gain') {
      this.outputGain = msg.value;
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
    // The synth is a generator; clear its input scratch before processing.
    for (let ch = 0; ch < CHANNELS; ch++) this.channelBuffers[ch].fill(0, 0, frames);
    this.engine.processPrepared(frames);

    const g = this.outputGain;
    let peak = 0;
    for (let ch = 0; ch < output.length; ch++) {
      const src = this.channelBuffers[ch] || this.channelBuffers[0];
      const dst = output[ch];
      for (let i = 0; i < frames; i++) {
        const s = src[i] * g;
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
    if (++this.seq % 6 !== 0) return;
    this.port.postMessage({ type: 'meter', peak });
  }
}

registerProcessor('libsonare-synth', LibsonareSynthProcessor);
`;
}

/**
 * SAB-free synthesizer engine: a dedicated AudioWorklet hosting libsonare's
 * native `RealtimeEngine` bound to the patch-driven NativeSynth. The main
 * thread sends note/CC/patch commands over the port; the audio thread renders.
 *
 * @param sonareUrl URL of the emscripten `sonare.js` factory module.
 * @param wasmUrl URL of the `sonare.wasm` binary.
 */
export function useSynthEngine(sonareUrl: string, wasmUrl: string) {
  const ready = ref(false);
  const starting = ref(false);
  const error = ref<string | null>(null);
  /** True while the AudioContext is actually running (resumed by a gesture). */
  const running = ref(false);
  const meter = ref<SynthMeterState>({ peak: 0 });

  const context = shallowRef<AudioContext | null>(null);
  /** Post-worklet analyser tap, for the scope/spectrum display. */
  const analyser = shallowRef<AnalyserNode | null>(null);
  let node: AudioWorkletNode | null = null;
  let moduleUrl: string | null = null;
  let wasmBinary: ArrayBuffer | null = null;
  /** Set by dispose(); cancels an in-flight start() at its next await point. */
  let disposed = false;
  /** Resolver for the in-flight ready wait, so dispose() can settle it. */
  let resolveReady: (() => void) | null = null;

  /**
   * Boot the AudioContext + worklet. Safe to call without a user gesture: the
   * context boots suspended, the worklet still loads and initializes its WASM
   * heap, and the first `noteOn`/`resume()` inside a gesture unlocks audio.
   * Resolves once the synth is ready to render.
   */
  async function start(initialPatch: SynthPatch | string): Promise<boolean> {
    error.value = null;
    if (ready.value) {
      void context.value?.resume();
      return true;
    }
    if (starting.value) return false;
    starting.value = true;
    // A fresh boot attempt clears a prior teardown's cancellation flag.
    disposed = false;
    try {
      const ctx = new AudioContext({ latencyHint: 'interactive' });
      context.value = ctx;
      running.value = ctx.state === 'running';
      ctx.onstatechange = () => {
        running.value = ctx.state === 'running';
      };
      if (!moduleUrl) {
        // The worklet loads from a blob: URL, so the static import specifier
        // must be absolute — a root-relative path cannot resolve against the
        // opaque blob base.
        const absoluteSonareUrl = new URL(sonareUrl, location.href).href;
        moduleUrl = URL.createObjectURL(
          new Blob([buildSynthProcessorSource(absoluteSonareUrl)], { type: 'text/javascript' }),
        );
      }
      await ctx.audioWorklet.addModule(moduleUrl);
      if (disposed) return false;
      if (!wasmBinary) wasmBinary = await (await fetch(wasmUrl)).arrayBuffer();
      if (disposed) return false;

      node = new AudioWorkletNode(ctx, 'libsonare-synth', {
        numberOfInputs: 0,
        numberOfOutputs: 1,
        outputChannelCount: [CHANNELS],
        processorOptions: { wasmBinary, patch: initialPatch },
      });
      const tap = ctx.createAnalyser();
      tap.fftSize = 2048;
      tap.smoothingTimeConstant = 0.75;
      node.connect(tap);
      tap.connect(ctx.destination);
      analyser.value = tap;

      const readyPromise = new Promise<void>((resolve, reject) => {
        if (!node) {
          reject(new Error('worklet-node-missing'));
          return;
        }
        // dispose() settles this via resolveReady if the worklet's 'ready'
        // never arrives (its onmessage is nulled during teardown).
        resolveReady = resolve;
        node.port.onmessage = (event) => {
          const msg = event.data;
          if (msg?.type === 'ready') {
            ready.value = true;
            resolve();
          } else if (msg?.type === 'meter') {
            meter.value = { peak: msg.peak };
          } else if (msg?.type === 'error') {
            error.value = msg.error;
            reject(new Error(msg.error));
          }
        };
      });
      // Outside a gesture this stays pending until the user interacts — don't
      // await it; worklet construction and WASM init proceed while suspended.
      void ctx.resume().catch(() => {
        /* resume re-attempted on the first gesture */
      });
      await readyPromise;
      if (disposed) return false;
      return true;
    } catch (err) {
      error.value = err instanceof Error ? err.message : String(err);
      await dispose();
      return false;
    } finally {
      starting.value = false;
    }
  }

  /** Resume the suspended context; call from inside a user-gesture handler. */
  function resume(): void {
    const ctx = context.value;
    if (ctx && ctx.state !== 'running') void ctx.resume();
  }

  function noteOn(note: number, velocity = 100): void {
    resume();
    node?.port.postMessage({ type: 'noteOn', note, velocity });
  }

  function noteOff(note: number): void {
    node?.port.postMessage({ type: 'noteOff', note });
  }

  function controlChange(controller: number, value: number): void {
    node?.port.postMessage({ type: 'cc', controller, value });
  }

  function panic(): void {
    node?.port.postMessage({ type: 'panic' });
  }

  function setPatch(patch: SynthPatch | string): void {
    node?.port.postMessage({ type: 'patch', patch });
  }

  function setGain(value: number): void {
    node?.port.postMessage({ type: 'gain', value });
  }

  async function dispose(): Promise<void> {
    disposed = true;
    // Settle an in-flight start()'s ready wait so its await returns and the
    // starting flag clears — nulling node.port.onmessage below drops 'ready'.
    resolveReady?.();
    resolveReady = null;
    ready.value = false;
    if (node) {
      try {
        node.port.postMessage({ type: 'panic' });
      } catch {
        /* node already gone */
      }
      try {
        node.disconnect();
      } catch {
        /* already disconnected */
      }
      node.port.onmessage = null;
      node = null;
    }
    if (analyser.value) {
      try {
        analyser.value.disconnect();
      } catch {
        /* already disconnected */
      }
      analyser.value = null;
    }
    if (context.value) {
      try {
        await context.value.close();
      } catch {
        /* already closed */
      }
      context.value = null;
    }
    if (moduleUrl) {
      URL.revokeObjectURL(moduleUrl);
      moduleUrl = null;
    }
    running.value = false;
    meter.value = { peak: 0 };
  }

  return {
    ready,
    starting,
    error,
    running,
    meter,
    context,
    analyser,
    start,
    resume,
    noteOn,
    noteOff,
    controlChange,
    panic,
    setPatch,
    setGain,
    dispose,
  };
}
