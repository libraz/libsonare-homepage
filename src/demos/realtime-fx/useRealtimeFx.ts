import { ref, shallowRef } from 'vue';
import type { VoicePresetId } from '@/wasm/index';

export interface RealtimeFxParams {
  /** Library character preset that supplies the full DSP chain. */
  preset: VoicePresetId;
  /** Retune in semitones, layered over the preset (−12..+12). */
  pitchSemitones: number;
  /** Formant scale factor, layered over the preset (0.55..1.65). */
  formant: number;
  /** Formant brightness tilt, layered over the preset (−1..1). */
  brightness: number;
  /** Whether the formant stage is explicitly engaged by the user. */
  formantEngaged: boolean;
  /** Wet/dry mix handed to the native chain (0..1). */
  wet: number;
  /** Post-chain monitor gain applied in the worklet, capped at unity to stay
   * under the native −1 dBTP limiter (0..1). */
  outputGain: number;
  bypass: boolean;
}

export interface FxMeterState {
  inputPeak: number;
  outputPeak: number;
  inputRms: number;
  outputRms: number;
}

/**
 * Headline macro values for each library character preset, mirrored from
 * `realtimeVoiceChangerPresetJson(...)` so the UI sliders can show truthful
 * starting positions before the audio engine (and its WASM) is even running.
 * The worklet still loads the *full* preset chain by id; these only seed the
 * four live macros the demo exposes.
 */
export interface VoicePresetMacros {
  pitchSemitones: number;
  formant: number;
  brightness: number;
  wet: number;
}

export const VOICE_PRESET_ORDER: VoicePresetId[] = [
  'neutral-monitor',
  'bright-idol',
  'soft-whisper',
  'deep-narrator',
  'robot-mascot',
  'dark-villain',
];

export const VOICE_PRESET_MACROS: Record<VoicePresetId, VoicePresetMacros> = {
  'neutral-monitor': { pitchSemitones: 0, formant: 1.0, brightness: 0.1, wet: 1 },
  'bright-idol': { pitchSemitones: 4, formant: 1.18, brightness: 0.7, wet: 1 },
  'soft-whisper': { pitchSemitones: 2, formant: 1.1, brightness: 0.25, wet: 1 },
  'deep-narrator': { pitchSemitones: -5, formant: 0.84, brightness: -0.25, wet: 1 },
  'robot-mascot': { pitchSemitones: 7, formant: 1.3, brightness: 0.75, wet: 1 },
  'dark-villain': { pitchSemitones: -9, formant: 0.72, brightness: -0.7, wet: 1 },
};

/** Type guard for persisted/untrusted preset ids (e.g. from localStorage). */
export function isVoicePresetId(value: unknown): value is VoicePresetId {
  return typeof value === 'string' && Object.hasOwn(VOICE_PRESET_MACROS, value);
}

// AudioWorklet render quantum. The native voice changer is prepared for this
// block size and its zero-copy heap views are sized to match.
const MAX_BLOCK = 128;

// AudioWorklet processor source. Runs libsonare's native RealtimeVoiceChanger in
// the audio thread with its own heap (SAB-free): static-import the emscripten
// factory, init from a passed wasm binary, and drive the zero-copy mono path.
// Exported for tests/composables/realtimeFxWorklet.test.ts.
export function buildProcessorSource(sonareUrl: string): string {
  return `
import createModule from '${sonareUrl}';

const MAX_BLOCK = ${MAX_BLOCK};

class LibsonareVoiceProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const o = options.processorOptions || {};
    this.ready = false;
    this.enabled = true;
    this.preset = 'neutral-monitor';
    this.pitch = 0; this.formant = 1; this.brightness = 0.1; this.wet = 1;
    this.formantEngaged = false; this.baseFormantAmount = 0;
    this.outputGain = 0.85; this.bypass = false;

    this.vc = null; this.base = null;
    this.seq = 0;
    this.wasProcessing = false;
    this.inView = null; this.outView = null;

    this.port.onmessage = (e) => this.onMessage(e.data);
    createModule({ wasmBinary: o.wasmBinary, locateFile: () => 'sonare.wasm' })
      .then((mod) => {
        this.mod = mod;
        if (!mod.createRealtimeVoiceChanger) throw new Error('RealtimeVoiceChanger is not available in this WASM build');
        this.vc = mod.createRealtimeVoiceChanger(this.preset);
        this.vc.prepare(sampleRate, MAX_BLOCK, 1);
        this.loadBase();
        this.applyConfig();
        this.ready = true;
        this.port.postMessage({ type: 'ready', latencySamples: this.vc.latencySamples() });
      })
      .catch((err) => this.port.postMessage({ type: 'error', error: String(err) }));
  }

  loadBase() {
    try {
      this.base = JSON.parse(this.vc.configJson());
      this.baseFormantAmount = Number(this.base && this.base.dsp && this.base.dsp.formant
        ? this.base.dsp.formant.amount
        : 0);
    }
    catch (e) { this.base = null; }
  }

  // Layer the four live macros over the preset's full chain (eq, gate,
  // compressor, de-esser, reverb, limiter all survive untouched).
  applyConfig() {
    if (!this.vc) return;
    if (!this.base) this.loadBase();
    const dsp = this.base && this.base.dsp;
    if (!dsp) return;
    dsp.retune.semitones = this.pitch;
    dsp.retune.mix = Math.abs(this.pitch) > 0.05 ? 1 : 0;
    dsp.formant.factor = this.formant;
    dsp.formant.brightness = this.brightness;
    // Preserve the preset's authored blend until the user actually moves a
    // formant macro. A preset can intentionally use a fractional amount.
    dsp.formant.amount = this.formantEngaged ? 1 : this.baseFormantAmount;
    dsp.wetMix = this.wet;
    try { this.vc.setConfig(this.base); } catch (e) { /* keep last good config */ }
  }

  onMessage(msg) {
    if (msg.type === 'params') {
      const p = msg.params;
      // Record the preset id even before the engine exists: params can arrive
      // ahead of module init, and the stored id seeds createRealtimeVoiceChanger
      // so a preset chosen during startup is never dropped.
      if (p.preset && p.preset !== this.preset) {
        this.preset = p.preset;
        if (this.vc) {
          try { this.vc.setConfig(this.preset); this.loadBase(); }
          catch (e) { /* preset id rejected; keep current */ }
        }
      }
      this.pitch = p.pitchSemitones; this.formant = p.formant;
      this.brightness = p.brightness; this.wet = p.wet;
      this.formantEngaged = Boolean(p.formantEngaged);
      this.outputGain = p.outputGain; this.bypass = Boolean(p.bypass);
      this.applyConfig();
    } else if (msg.type === 'setEnabled') {
      this.enabled = Boolean(msg.enabled);
      if (!this.enabled && this.vc) this.vc.reset();
    }
  }

  process(inputs, outputs) {
    const output = outputs[0];
    if (!output || output.length < 1) return true;
    const outL = output[0];
    const outR = output[1] || output[0];
    const n = outL.length;
    const input = inputs[0];
    const inL = input && input[0] ? input[0] : null;
    const inR = input && input[1] ? input[1] : inL;

    let inputPeak = 0, inputSum = 0, outputPeak = 0, outputSum = 0;

    // Direct passthrough when bypassed or not yet ready.
    if (this.bypass || !this.ready || !this.enabled) {
      const g = this.outputGain;
      for (let i = 0; i < n; i++) {
        const l = inL ? inL[i] : 0;
        const r = inR ? inR[i] : l;
        const ol = l * g;
        const or = r * g;
        outL[i] = ol; outR[i] = or;
        const ain = Math.max(Math.abs(l), Math.abs(r));
        if (ain > inputPeak) inputPeak = ain;
        inputSum += (l * l + r * r) * 0.5;
        const aout = Math.max(Math.abs(ol), Math.abs(or));
        if (aout > outputPeak) outputPeak = aout;
        outputSum += (ol * ol + or * or) * 0.5;
      }
      // Leaving the processed path. The next processing block flushes stale
      // native state once (transition reset below), so skip a per-block reset
      // that would memset the whole voice changer every render quantum.
      this.wasProcessing = false;
      this.publishMeter(n, inputPeak, outputPeak, inputSum, outputSum);
      return true;
    }

    const m = Math.min(n, MAX_BLOCK);
    try {
      // Flush the native chain once on the transition back into processing so a
      // resumed stream starts clean, without the tail left over from bypass.
      if (!this.wasProcessing) { this.vc.reset(); this.wasProcessing = true; }

      const inView = this.inputView();
      for (let i = 0; i < m; i++) {
        const l = inL ? inL[i] : 0;
        const r = inR ? inR[i] : l;
        const mono = (l + r) * 0.5;
        inView[i] = mono;
        const a = Math.abs(mono);
        if (a > inputPeak) inputPeak = a;
        inputSum += mono * mono;
      }

      // The native chain (retune + formant + eq/gate/comp/deesser/reverb/limiter)
      // runs in place on already-on-heap samples — no per-block JS↔C++ copy.
      this.vc.processPreparedMono(m);

      const outView = this.outputView();
      const g = this.outputGain;
      for (let i = 0; i < m; i++) {
        const wet = outView[i];
        const ol = wet * g;
        const or = ol;
        outL[i] = ol; outR[i] = or;
        const aout = Math.abs(ol);
        if (aout > outputPeak) outputPeak = aout;
        outputSum += ol * ol;
      }
      // Fill any tail beyond MAX_BLOCK (defensive; render quantum is 128).
      for (let i = m; i < n; i++) { outL[i] = 0; outR[i] = 0; }
    } catch (e) {
      // A native fault must not wedge the graph in silence: surface it, drop to
      // dry passthrough, and let the main thread tear the engine down.
      this.ready = false;
      this.wasProcessing = false;
      this.port.postMessage({ type: 'error', error: String(e) });
      const g = this.outputGain;
      for (let i = 0; i < n; i++) {
        const l = inL ? inL[i] : 0;
        outL[i] = l * g; outR[i] = (inR ? inR[i] : l) * g;
      }
      this.publishMeter(n, inputPeak, outputPeak, inputSum, outputSum);
      return true;
    }

    this.publishMeter(m, inputPeak, outputPeak, inputSum, outputSum);
    return true;
  }

  // Cached zero-copy heap views. Re-acquire only when Emscripten heap growth has
  // detached the backing ArrayBuffer (its byteLength drops to 0).
  inputView() {
    if (!this.inView || this.inView.buffer.byteLength === 0) {
      this.inView = this.vc.getMonoInputBuffer(MAX_BLOCK);
    }
    return this.inView;
  }

  outputView() {
    if (!this.outView || this.outView.buffer.byteLength === 0) {
      this.outView = this.vc.getMonoOutputBuffer(MAX_BLOCK);
    }
    return this.outView;
  }

  publishMeter(n, inputPeak, outputPeak, inputSum, outputSum) {
    if (++this.seq % 8 !== 0) return;
    this.port.postMessage({
      type: 'meter',
      inputPeak,
      outputPeak,
      inputRms: Math.sqrt(inputSum / n),
      outputRms: Math.sqrt(outputSum / n),
    });
  }
}

registerProcessor('libsonare-voice', LibsonareVoiceProcessor);
`;
}

/**
 * Map a caught start-up error to a stable code the UI localizes, so a raw
 * browser message never reaches the user. A missing API and a mic-permission
 * denial each get dedicated copy; anything else is a generic start failure.
 */
function toErrorCode(err: unknown): string {
  if (err instanceof Error) {
    if (err.message === 'no-mic-api') return 'no-mic-api';
    if (err.message === 'engine-error') return 'engine-error';
    if (err.name === 'NotAllowedError' || err.name === 'SecurityError') return 'mic-denied';
  }
  return 'start-failed';
}

export function useRealtimeFx(sonareUrl: string, wasmUrl: string) {
  const ready = ref(false);
  const monitoring = ref(false);
  const error = ref<string | null>(null);
  const latencyMs = ref(0);
  const meter = ref<FxMeterState>({ inputPeak: 0, outputPeak: 0, inputRms: 0, outputRms: 0 });

  const context = shallowRef<AudioContext | null>(null);
  let node: AudioWorkletNode | null = null;
  let sourceNode: MediaStreamAudioSourceNode | null = null;
  let silentGain: GainNode | null = null;
  let mediaStream: MediaStream | null = null;
  let moduleUrl: string | null = null;
  let wasmBinary: ArrayBuffer | null = null;
  let generation = 0;
  let startTask: Promise<boolean> | null = null;
  let cleanupTask: Promise<void> | null = null;
  let cancelStartup: (() => void) | null = null;

  async function start(): Promise<boolean> {
    if (ready.value) return true;
    if (startTask) return startTask;

    const task = runStart();
    startTask = task;
    try {
      return await task;
    } finally {
      if (startTask === task) startTask = null;
    }
  }

  async function runStart(): Promise<boolean> {
    if (cleanupTask) await cleanupTask;
    error.value = null;
    const currentGeneration = ++generation;
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('no-mic-api');
      }
      const ctx = new AudioContext({ latencyHint: 'interactive' });
      context.value = ctx;
      if (!moduleUrl) {
        // The worklet runs from a blob: URL, so the static import specifier must be
        // absolute — a root-relative path can't resolve against an opaque blob base.
        const absoluteSonareUrl = new URL(sonareUrl, location.href).href;
        moduleUrl = URL.createObjectURL(
          new Blob([buildProcessorSource(absoluteSonareUrl)], { type: 'text/javascript' }),
        );
      }
      const workletUrl = moduleUrl;
      await ctx.audioWorklet.addModule(workletUrl);
      if (currentGeneration !== generation) throw new Error('cancelled');
      if (!wasmBinary) wasmBinary = await (await fetch(wasmUrl)).arrayBuffer();
      if (currentGeneration !== generation) throw new Error('cancelled');

      node = new AudioWorkletNode(ctx, 'libsonare-voice', {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [2],
        processorOptions: { wasmBinary },
      });
      silentGain = ctx.createGain();
      silentGain.gain.value = 0;
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
      if (currentGeneration !== generation) {
        stream.getTracks().forEach((track) => {
          track.stop();
        });
        throw new Error('cancelled');
      }
      mediaStream = stream;
      sourceNode = ctx.createMediaStreamSource(mediaStream);
      sourceNode.connect(node);
      node.connect(silentGain);
      silentGain.connect(ctx.destination);
      return await new Promise<boolean>((resolve, reject) => {
        let startupSettled = false;
        const finishStartup = (value: boolean) => {
          if (startupSettled) return;
          startupSettled = true;
          cancelStartup = null;
          resolve(value);
        };
        cancelStartup = () => finishStartup(false);
        node!.port.onmessage = (event) => {
          if (currentGeneration !== generation) return;
          const msg = event.data;
          if (msg?.type === 'ready') {
            ready.value = true;
            // Native processing latency (grain warmup) plus the device output buffer.
            const procSeconds = (msg.latencySamples || 0) / ctx.sampleRate;
            latencyMs.value = Math.round((procSeconds + (ctx.baseLatency || 0)) * 1000);
            finishStartup(true);
          } else if (msg?.type === 'meter') meter.value = msg;
          else if (msg?.type === 'error') {
            error.value = 'engine-error';
            if (!startupSettled) reject(new Error('engine-error'));
            else void failEngine(currentGeneration);
          }
        };
        node!.onprocessorerror = () => {
          if (currentGeneration !== generation) return;
          error.value = 'engine-error';
          if (!startupSettled) reject(new Error('engine-error'));
          else void failEngine(currentGeneration);
        };
      });
    } catch (err) {
      if (currentGeneration !== generation) return false;
      error.value = toErrorCode(err);
      generation += 1;
      cancelStartup?.();
      cancelStartup = null;
      await beginCleanup();
      return false;
    }
  }

  async function failEngine(currentGeneration: number) {
    if (currentGeneration !== generation) return;
    error.value = 'engine-error';
    generation += 1;
    cancelStartup?.();
    cancelStartup = null;
    await beginCleanup();
  }

  function setParams(params: RealtimeFxParams) {
    node?.port.postMessage({ type: 'params', params });
  }

  async function toggleMonitor(): Promise<boolean> {
    const ctx = context.value;
    if (!ready.value || !ctx || !node) return false;
    if (ctx.state === 'suspended') await ctx.resume();
    monitoring.value = !monitoring.value;
    node.disconnect();
    if (monitoring.value) {
      node.connect(ctx.destination);
    } else if (silentGain) {
      node.connect(silentGain);
    }
    node.port.postMessage({ type: 'setEnabled', enabled: monitoring.value });
    return monitoring.value;
  }

  async function cleanupResources() {
    monitoring.value = false;
    ready.value = false;
    latencyMs.value = 0;
    try {
      node?.disconnect();
    } catch {
      /* already disconnected */
    }
    try {
      sourceNode?.disconnect();
    } catch {
      /* already disconnected */
    }
    try {
      silentGain?.disconnect();
    } catch {
      /* already disconnected */
    }
    if (node) node.port.onmessage = null;
    if (node) node.onprocessorerror = null;
    node = null;
    sourceNode = null;
    silentGain = null;
    mediaStream?.getTracks().forEach((track) => {
      track.stop();
    });
    mediaStream = null;
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
    meter.value = { inputPeak: 0, outputPeak: 0, inputRms: 0, outputRms: 0 };
  }

  function beginCleanup(): Promise<void> {
    if (cleanupTask) return cleanupTask;
    const task = cleanupResources();
    cleanupTask = task;
    void task.finally(() => {
      if (cleanupTask === task) cleanupTask = null;
    });
    return task;
  }

  async function dispose() {
    generation += 1;
    cancelStartup?.();
    cancelStartup = null;
    await beginCleanup();
  }

  return { ready, monitoring, error, latencyMs, meter, start, setParams, toggleMonitor, dispose };
}
