import { ref, shallowRef } from 'vue';
import {
  buildStepBassProcessorSource,
  STEP_BASS_PROCESSOR,
} from '@/demos/step-bass/stepBassProcessor';
import type {
  CompiledClip,
  CompiledLane,
  CompiledPattern,
  LiveParam,
  StepBassCommand,
  StepBassEvent,
} from '@/demos/step-bass/stepBassTypes';
import type { SynthPatch } from '@/wasm/index';

/** Stereo output, matching the channels the processor renders. */
const CHANNELS = 2;

/** The meter reading the processor publishes, as the UI holds it. */
export type StepBassMeter = Omit<Extract<StepBassEvent, { type: 'meter' }>, 'type'>;

const SILENT_METER: StepBassMeter = {
  peak: 0,
  samplePosition: 0,
  playing: false,
  currentTime: 0,
};

/**
 * The step bass instrument on the main thread: it boots the worklet that owns
 * the engine, sends panel changes as commands, and taps an analyser off the
 * worklet node for the scope and spectrum views.
 *
 * Nothing here schedules a step. The transport inside the worklet plays the
 * pattern; the playhead the UI draws is extrapolated from the meter message
 * rather than asked for per frame.
 *
 * @param sonareUrl URL of the emscripten `sonare.js` factory module.
 * @param wasmUrl URL of the `sonare.wasm` binary.
 */
export function useStepBassEngine(sonareUrl: string, wasmUrl: string) {
  const ready = ref(false);
  const starting = ref(false);
  const error = ref<string | null>(null);
  /** True while the AudioContext is actually running (resumed by a gesture). */
  const running = ref(false);
  const meter = ref<StepBassMeter>(SILENT_METER);
  const faultEpoch = ref(0);

  const context = shallowRef<AudioContext | null>(null);
  /** Post-worklet analyser tap, for the scope and spectrum views. */
  const analyser = shallowRef<AnalyserNode | null>(null);
  let node: AudioWorkletNode | null = null;
  let moduleUrl: string | null = null;
  let wasmBinary: ArrayBuffer | null = null;
  /** Set by dispose(); cancels an in-flight start() at its next await point. */
  let disposed = false;
  /** Resolver for the in-flight ready wait, so dispose() can settle it. */
  let resolveReady: (() => void) | null = null;

  function send(command: StepBassCommand): void {
    node?.port.postMessage(command);
  }

  /**
   * Boot the AudioContext and the worklet, applying `compiled` as the pattern
   * the instrument opens with. Safe to call outside a user gesture: the context
   * boots suspended and the transport stays stopped until RUN.
   */
  async function start(compiled: CompiledPattern): Promise<boolean> {
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
          new Blob([buildStepBassProcessorSource(absoluteSonareUrl)], { type: 'text/javascript' }),
        );
      }
      await ctx.audioWorklet.addModule(moduleUrl);
      if (disposed) return false;
      if (!wasmBinary) wasmBinary = await (await fetch(wasmUrl)).arrayBuffer();
      if (disposed) return false;

      node = new AudioWorkletNode(ctx, STEP_BASS_PROCESSOR, {
        numberOfInputs: 0,
        numberOfOutputs: 1,
        outputChannelCount: [CHANNELS],
        processorOptions: { wasmBinary, compiled },
      });
      node.onprocessorerror = () => {
        error.value = 'Step bass audio processor failed';
        faultEpoch.value++;
        void dispose();
      };
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
          const msg = event.data as StepBassEvent | undefined;
          if (msg?.type === 'ready') {
            ready.value = true;
            resolve();
          } else if (msg?.type === 'meter') {
            meter.value = {
              peak: msg.peak,
              samplePosition: msg.samplePosition,
              playing: msg.playing,
              currentTime: msg.currentTime,
            };
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

  /** Install a pattern: boot-time, or after an edit that recompiles. */
  function apply(compiled: CompiledPattern): void {
    send({ type: 'apply', compiled });
  }

  /** A knob under a sounding note. Applied on arrival — a re-send cannot click. */
  function setParam(param: LiveParam, value: number): void {
    send({ type: 'param', param, value });
  }

  function setFader(faderDb: number): void {
    send({ type: 'fader', faderDb });
  }

  /** DECAY, ACCENT and RESONANCE change what the steps carry, not the knobs. */
  function setLanes(lanes: CompiledLane[]): void {
    send({ type: 'lanes', lanes });
  }

  function setClip(clip: CompiledClip): void {
    send({ type: 'clip', clip });
  }

  /** The processor rebinds at a step boundary that speaks a note, not here. */
  function setWaveform(patch: SynthPatch): void {
    send({ type: 'waveform', patch });
  }

  /** Tempo keeps its phase: a clip at the new frame mapping, then a seek. */
  function setTempo(bpm: number, clip: CompiledClip, seekPpq: number): void {
    send({ type: 'tempo', bpm, clip, seekPpq });
  }

  function play(): void {
    resume();
    send({ type: 'transport', action: 'play' });
  }

  function stop(): void {
    send({ type: 'transport', action: 'stop' });
  }

  /**
   * Transport position now, extrapolated from the last meter stamp. The output
   * latency is subtracted because the meter reports what was rendered, not what
   * has reached the speaker.
   */
  function playheadSamples(): number {
    const ctx = context.value;
    const last = meter.value;
    if (!ctx || !last.playing) return last.samplePosition;
    const latency = typeof ctx.outputLatency === 'number' ? ctx.outputLatency : 0;
    const elapsed = ctx.currentTime - last.currentTime - latency;
    return last.samplePosition + Math.max(0, elapsed) * ctx.sampleRate;
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
        node.port.postMessage({ type: 'transport', action: 'stop' });
      } catch {
        /* node already gone */
      }
      try {
        node.disconnect();
      } catch {
        /* already disconnected */
      }
      node.port.onmessage = null;
      node.onprocessorerror = null;
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
      context.value.onstatechange = null;
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
    meter.value = SILENT_METER;
  }

  return {
    ready,
    starting,
    error,
    running,
    meter,
    faultEpoch,
    context,
    analyser,
    start,
    resume,
    apply,
    setParam,
    setFader,
    setLanes,
    setClip,
    setWaveform,
    setTempo,
    play,
    stop,
    playheadSamples,
    dispose,
  };
}
