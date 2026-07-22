import { ref, shallowRef } from 'vue';
import type { ModelSpec } from '@/tuner/dsp/engine';
import { TUNER_WORKLET_VERSION } from '@/tuner/worklet/worklet-version';

/**
 * Realtime engine for the physical-model tuner: a dedicated AudioWorklet running
 * the pure-TypeScript port of libsonare's nine physical-model cores (SAB-free).
 * Unlike {@link useSynthEngine} it loads no WASM — the DSP is bundled into
 * `/tuner-worklet.js` (see scripts/build-tuner-worklet.mjs). The main thread
 * sends spec/note/gain messages over the port; the audio thread renders.
 *
 * Boot mirrors the proven synth wiring: the context starts suspended (safe
 * outside a gesture), the worklet loads and initializes, and the first
 * `noteOn`/`resume()` inside a gesture unlocks audio.
 */

const WORKLET_URL = `/tuner-worklet.js?v=${TUNER_WORKLET_VERSION}`;
const PROCESSOR = 'libsonare-tuner';
const CHANNELS = 2;

export interface TunerMeterState {
  /** Linear output peak (0..1+) over the most recent reporting window. */
  peak: number;
}

/**
 * Deep-clone a spec to a plain, structured-cloneable object. The page keeps the
 * spec in a Vue `ref`, so it reaches us as a reactive Proxy that `postMessage`
 * cannot clone (DataCloneError). The spec is pure data (numbers / strings /
 * booleans / arrays / nested objects), so a JSON round-trip strips the proxy
 * cleanly. structuredClone is used when available to preserve number fidelity.
 */
function toPlainSpec(spec: ModelSpec): ModelSpec {
  return JSON.parse(JSON.stringify(spec));
}

export function useTunerEngine() {
  const ready = ref(false);
  const starting = ref(false);
  const error = ref<string | null>(null);
  const running = ref(false);
  const meter = ref<TunerMeterState>({ peak: 0 });
  const faultEpoch = ref(0);

  const context = shallowRef<AudioContext | null>(null);
  const analyser = shallowRef<AnalyserNode | null>(null);
  let node: AudioWorkletNode | null = null;
  /** Set by dispose(); cancels an in-flight start() at its next await point. */
  let disposed = false;
  let terminallyDisposed = false;
  /** Rejects a start() still awaiting the worklet 'ready' when dispose() runs. */
  let rejectReady: ((err: Error) => void) | null = null;
  /** Notified when a latched voice decays to silence on its own (note number). */
  let voiceEndedCb: ((note: number) => void) | null = null;

  /** Register a callback for voices that ring out on their own while latched. */
  function onVoiceEnded(cb: (note: number) => void): void {
    voiceEndedCb = cb;
  }

  async function start(initialSpec: ModelSpec): Promise<boolean> {
    if (terminallyDisposed) return false;
    error.value = null;
    if (ready.value) {
      void context.value?.resume();
      return true;
    }
    if (starting.value) return false;
    starting.value = true;
    disposed = false;
    try {
      const ctx = new AudioContext({ latencyHint: 'interactive' });
      context.value = ctx;
      running.value = ctx.state === 'running';
      ctx.onstatechange = () => {
        running.value = ctx.state === 'running';
      };
      await ctx.audioWorklet.addModule(WORKLET_URL);
      // Bail out cleanly if the component unmounted while the module loaded.
      if (disposed) {
        await dispose();
        return false;
      }

      node = new AudioWorkletNode(ctx, PROCESSOR, {
        numberOfInputs: 0,
        numberOfOutputs: 1,
        outputChannelCount: [CHANNELS],
      });
      node.onprocessorerror = () => {
        error.value = 'Tuner audio processor failed';
        faultEpoch.value++;
        void teardown(false);
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
        // Let dispose() settle this promise so an unmount mid-boot never leaves
        // start() awaiting a 'ready' that dispose() has already unhooked.
        rejectReady = reject;
        node.port.onmessage = (event) => {
          const msg = event.data;
          if (msg?.type === 'ready') {
            ready.value = true;
            resolve();
          } else if (msg?.type === 'meter') {
            meter.value = { peak: msg.peak };
          } else if (msg?.type === 'voiceEnded') {
            if (typeof msg.note === 'number') voiceEndedCb?.(msg.note);
          } else if (msg?.type === 'error') {
            error.value = msg.error;
            reject(new Error(msg.error));
          }
        };
      });
      node.port.postMessage({ type: 'spec', spec: toPlainSpec(initialSpec) });
      void ctx.resume().catch(() => {
        /* resume re-attempted on the first gesture */
      });
      await readyPromise;
      if (disposed) return false;
      // Re-send the spec once ready in case it arrived before the handler bound.
      node.port.postMessage({ type: 'spec', spec: toPlainSpec(initialSpec) });
      return true;
    } catch (err) {
      error.value = err instanceof Error ? err.message : String(err);
      // Surface the real cause (e.g. a stale dev server not serving the freshly
      // built /tuner-worklet.js) — the UI only shows a generic message.
      console.error('[tuner] engine start failed:', err);
      await teardown(false);
      return false;
    } finally {
      rejectReady = null;
      starting.value = false;
    }
  }

  function resume(): void {
    const ctx = context.value;
    if (ctx && ctx.state !== 'running') void ctx.resume();
  }

  function setSpec(spec: ModelSpec): void {
    node?.port.postMessage({ type: 'spec', spec: toPlainSpec(spec) });
  }

  function noteOn(note: number, velocity = 100): void {
    resume();
    node?.port.postMessage({ type: 'noteOn', note, velocity });
  }

  function noteOff(note: number): void {
    node?.port.postMessage({ type: 'noteOff', note });
  }

  function panic(): void {
    node?.port.postMessage({ type: 'panic' });
  }

  function setGain(value: number): void {
    node?.port.postMessage({ type: 'gain', value });
  }

  async function teardown(permanent: boolean): Promise<void> {
    if (permanent) terminallyDisposed = true;
    disposed = true;
    ready.value = false;
    // Settle a start() still awaiting the worklet 'ready' so it unwinds (its
    // finally clears `starting`) instead of hanging on a dropped message.
    if (rejectReady) {
      rejectReady(new Error('disposed'));
      rejectReady = null;
    }
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
      try {
        await context.value.close();
      } catch {
        /* already closed */
      }
      context.value = null;
    }
    running.value = false;
    meter.value = { peak: 0 };
  }

  async function dispose(): Promise<void> {
    await teardown(true);
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
    setSpec,
    noteOn,
    noteOff,
    panic,
    setGain,
    onVoiceEnded,
    dispose,
  };
}
