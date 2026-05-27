import { ref, shallowRef } from 'vue';
import { advancePhase, ringModulate } from '@/utils/dsp';

export interface RealtimeFxParams {
  pitchSemitones: number;
  formant: number;
  wet: number;
  robot: number;
  reverb: number;
  outputGain: number;
  bypass: boolean;
}

export interface FxMeterState {
  inputPeak: number;
  outputPeak: number;
  inputRms: number;
  outputRms: number;
}

export type PresetId = 'natural' | 'low' | 'bright' | 'robot' | 'room' | 'hall';

export const FX_PRESETS: Record<PresetId, RealtimeFxParams> = {
  natural: {
    pitchSemitones: 0,
    formant: 1,
    wet: 0.72,
    robot: 0,
    reverb: 0.08,
    outputGain: 0.74,
    bypass: false,
  },
  low: {
    pitchSemitones: -7,
    formant: 0.7,
    wet: 0.9,
    robot: 0,
    reverb: 0.1,
    outputGain: 0.72,
    bypass: false,
  },
  bright: {
    pitchSemitones: 6,
    formant: 1.45,
    wet: 0.88,
    robot: 0,
    reverb: 0.08,
    outputGain: 0.68,
    bypass: false,
  },
  robot: {
    pitchSemitones: -1,
    formant: 0.92,
    wet: 0.92,
    robot: 0.9,
    reverb: 0.16,
    outputGain: 0.62,
    bypass: false,
  },
  room: {
    pitchSemitones: 0,
    formant: 1,
    wet: 0.82,
    robot: 0,
    reverb: 0.55,
    outputGain: 0.68,
    bypass: false,
  },
  hall: {
    pitchSemitones: 0,
    formant: 1,
    wet: 0.86,
    robot: 0,
    reverb: 0.9,
    outputGain: 0.58,
    bypass: false,
  },
};

/** Type guard for persisted/untrusted preset ids (e.g. from localStorage). */
export function isPresetId(value: unknown): value is PresetId {
  return typeof value === 'string' && Object.hasOwn(FX_PRESETS, value);
}

// The native StreamingRetune derives a ~46 ms grain by default. Keep this value
// in sync with libsonare's StreamingRetuneConfig default for latency reporting.
const RETUNE_GRAIN_SECONDS = 2048 / 44100;
const RETUNE_MAX_BLOCK = 2048;

// AudioWorklet processor source. Runs libsonare's native StreamingRetune in the
// audio thread with its own heap (SAB-free): static-import the emscripten
// factory, init from a passed wasm binary, and bypass index.js.
// Exported for tests/components/realtimeFxWorklet.test.ts.
export function buildProcessorSource(sonareUrl: string): string {
  return `
import createModule from '${sonareUrl}';

const RETUNE_MAX_BLOCK = ${RETUNE_MAX_BLOCK};

// DSP primitives injected from src/utils/dsp.ts (a blob worklet cannot import app
// modules). They are the single tested source of truth; see tests/utils/dsp.test.ts.
const ringModulate = ${ringModulate.toString()};
const advancePhase = ${advancePhase.toString()};

class LibsonareFxProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const o = options.processorOptions || {};
    this.ready = false;
    this.enabled = true;
    this.pitch = 0; this.formant = 1; this.wet = 0.72;
    this.robot = 0; this.reverb = 0.08; this.outputGain = 0.74; this.bypass = false;

    this.robotPhase = 0; this.rev = 0; this.seq = 0; this.toneLow = 0;
    this.revA = new Float32Array(1499); this.revB = new Float32Array(2111); this.revC = new Float32Array(2633);
    this.revAi = 0; this.revBi = 0; this.revCi = 0;
    this.retune = null;
    this.monoBlock = new Float32Array(128);

    this.port.onmessage = (e) => this.onMessage(e.data);
    createModule({ wasmBinary: o.wasmBinary, locateFile: () => 'sonare.wasm' })
      .then((mod) => {
        this.mod = mod;
        if (!mod.createStreamingRetune) throw new Error('StreamingRetune is not available in this WASM build');
        this.retune = mod.createStreamingRetune({ semitones: this.pitch, mix: 1, grainSize: 0 });
        this.retune.prepare(sampleRate, RETUNE_MAX_BLOCK);
        this.ready = true;
        this.port.postMessage({ type: 'ready' });
      })
      .catch((err) => this.port.postMessage({ type: 'error', error: String(err) }));
  }

  onMessage(msg) {
    if (msg.type === 'params') {
      const p = msg.params;
      this.pitch = p.pitchSemitones; this.formant = p.formant; this.wet = p.wet;
      this.robot = p.robot; this.reverb = p.reverb; this.outputGain = p.outputGain;
      this.bypass = Boolean(p.bypass);
      if (this.retune) this.retune.setConfig({ semitones: this.pitch, mix: 1, grainSize: 0 });
    } else if (msg.type === 'setEnabled') {
      this.enabled = Boolean(msg.enabled);
      if (!this.enabled && this.retune) this.retune.reset();
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
        const ol = (this.bypass ? l : l) * g;
        const or = (this.bypass ? r : r) * g;
        outL[i] = ol; outR[i] = or;
        const ain = Math.max(Math.abs(l), Math.abs(r));
        if (ain > inputPeak) inputPeak = ain;
        inputSum += (l * l + r * r) * 0.5;
        const aout = Math.max(Math.abs(ol), Math.abs(or));
        if (aout > outputPeak) outputPeak = aout;
        outputSum += (ol * ol + or * or) * 0.5;
      }
      if (this.retune) this.retune.reset();
      this.publishMeter(n, inputPeak, outputPeak, inputSum, outputSum);
      return true;
    }

    if (this.monoBlock.length !== n) this.monoBlock = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const l = inL ? inL[i] : 0;
      const r = inR ? inR[i] : l;
      const mono = (l + r) * 0.5;
      this.monoBlock[i] = mono;
      const a = Math.abs(mono);
      if (a > inputPeak) inputPeak = a;
      inputSum += mono * mono;
    }

    let retuned = this.monoBlock;
    if (this.retune && Math.abs(this.pitch) > 0.05) {
      try { retuned = this.retune.processMono(this.monoBlock); }
      catch (e) { retuned = this.monoBlock; }
    }

    for (let i = 0; i < n; i++) {
      const dl = inL ? inL[i] : 0;
      const dr = inR ? inR[i] : dl;
      const wetMono = retuned[i] || this.monoBlock[i];

      // Robot ring-mod + color + reverb on the wet (mono) path.
      this.robotPhase = advancePhase(this.robotPhase, 55, sampleRate);
      const carrier = Math.sin(this.robotPhase);
      let proc = ringModulate(wetMono, carrier, this.robot);

      // Extra realtime color makes formant moves obvious even when the retune
      // stage is mainly shifting pitch.
      this.toneLow += (proc - this.toneLow) * 0.08;
      const low = this.toneLow;
      const high = proc - low;
      const tilt = Math.max(-1, Math.min(1, (this.formant - 1) * 1.7 + this.pitch / 24));
      proc = tilt >= 0
        ? proc + high * tilt * 1.6 - low * tilt * 0.25
        : proc + low * -tilt * 1.2 - high * -tilt * 0.7;

      // Small feedback-delay reverb. The one-tap ambience was too subtle to read
      // as reverb on live mic input, so use three short decorrelated delays.
      const wetA = this.revA[this.revAi];
      const wetB = this.revB[this.revBi];
      const wetC = this.revC[this.revCi];
      const rv = (wetA + wetB + wetC) / 3;
      const fb = 0.28 + this.reverb * 0.58;
      const send = proc * (0.18 + this.reverb * 0.55);
      this.revA[this.revAi] = send + wetB * fb * 0.62;
      this.revB[this.revBi] = send + wetC * fb * 0.56;
      this.revC[this.revCi] = send + wetA * fb * 0.5;
      this.revAi = (this.revAi + 1) % this.revA.length;
      this.revBi = (this.revBi + 1) % this.revB.length;
      this.revCi = (this.revCi + 1) % this.revC.length;
      proc = proc * (1 - this.reverb * 0.22) + rv * this.reverb * 1.35;

      const g = this.outputGain;
      const ol = (dl * (1 - this.wet) + proc * this.wet) * g;
      const or = (dr * (1 - this.wet) + proc * this.wet) * g;
      outL[i] = ol; outR[i] = or;
      const aout = Math.max(Math.abs(ol), Math.abs(or));
      if (aout > outputPeak) outputPeak = aout;
      outputSum += (ol * ol + or * or) * 0.5;
    }

    this.publishMeter(n, inputPeak, outputPeak, inputSum, outputSum);
    return true;
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

registerProcessor('libsonare-fx', LibsonareFxProcessor);
`;
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

  async function start(): Promise<boolean> {
    error.value = null;
    if (ready.value) return true;
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
      await ctx.audioWorklet.addModule(moduleUrl);
      if (!wasmBinary) wasmBinary = await (await fetch(wasmUrl)).arrayBuffer();

      node = new AudioWorkletNode(ctx, 'libsonare-fx', {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [2],
        processorOptions: { wasmBinary },
      });
      silentGain = ctx.createGain();
      silentGain.gain.value = 0;
      mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
      sourceNode = ctx.createMediaStreamSource(mediaStream);
      sourceNode.connect(node);
      node.connect(silentGain);
      silentGain.connect(ctx.destination);
      node.port.onmessage = (event) => {
        const msg = event.data;
        if (msg?.type === 'ready') ready.value = true;
        else if (msg?.type === 'meter') meter.value = msg;
        else if (msg?.type === 'error') error.value = msg.error;
      };
      // Processing latency (OLA warmup) plus the device output buffer.
      latencyMs.value = Math.round((RETUNE_GRAIN_SECONDS + (ctx.baseLatency || 0)) * 1000);
      ready.value = true;
      return true;
    } catch (err) {
      error.value = err instanceof Error ? err.message : String(err);
      await dispose();
      return false;
    }
  }

  function setParams(params: RealtimeFxParams) {
    node?.port.postMessage({ type: 'params', params });
  }

  async function toggleMonitor(): Promise<boolean> {
    const ctx = context.value;
    if (!ctx || !node) return false;
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

  async function dispose() {
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
    meter.value = { inputPeak: 0, outputPeak: 0, inputRms: 0, outputRms: 0 };
  }

  return { ready, monitoring, error, latencyMs, meter, start, setParams, toggleMonitor, dispose };
}
