import { ref, shallowRef } from 'vue';

export interface RealtimeStripInput {
  left: Float32Array;
  right: Float32Array;
  offsetFrames: number;
}

export interface RealtimeStartPayload {
  sceneJson: string;
  sampleRate: number;
  masterGain: number;
  startFrame: number;
  totalFrames: number;
  strips: RealtimeStripInput[];
  gates: boolean[];
}

// AudioWorklet processor source. Runs the libsonare WASM Mixer in the audio thread
// with its own heap (SAB-free): static-import the emscripten factory, init from a
// passed wasm binary, and bypass index.js (its init() uses dynamic import, which is
// disallowed in WorkletGlobalScope). See memory: wasm-in-audioworklet.
function buildProcessorSource(sonareUrl: string): string {
  return `
import createModule from '${sonareUrl}';

const BLOCK = 128;

class LibsonareRtMixer extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const o = options.processorOptions;
    this.ready = false;
    this.playing = false;
    this.playhead = o.startFrame || 0;
    this.totalFrames = o.totalFrames || 0;
    this.masterGain = o.masterGain ?? 1;
    this.strips = o.strips || [];
    this.gates = o.gates || this.strips.map(() => true);
    this.reportCounter = 0;
    this.port.onmessage = (e) => this.onMessage(e.data);
    createModule({ wasmBinary: o.wasmBinary, locateFile: () => 'sonare.wasm' })
      .then((mod) => { this.mod = mod; this.buildMixer(o.sceneJson); this.ready = true; this.port.postMessage({ type: 'ready' }); })
      .catch((err) => this.port.postMessage({ type: 'error', error: String(err) }));
  }

  buildMixer(sceneJson) {
    if (this.mixer) { try { this.mixer.delete(); } catch (e) {} this.mixer = null; }
    this.mixer = this.mod.createMixerFromSceneJson(sceneJson, sampleRate, BLOCK);
    this.inL = []; this.inR = [];
    for (let i = 0; i < this.strips.length; i++) {
      this.inL.push(this.mixer.inputLeftView(i));
      this.inR.push(this.mixer.inputRightView(i));
    }
    this.outL = this.mixer.outputLeftView();
    this.outR = this.mixer.outputRightView();
  }

  onMessage(msg) {
    if (msg.type === 'play') this.playing = true;
    else if (msg.type === 'stop') this.playing = false;
    else if (msg.type === 'seek') this.playhead = msg.frame | 0;
    else if (msg.type === 'gates') this.gates = msg.gates;
    else if (msg.type === 'masterGain') this.masterGain = msg.value;
    else if (msg.type === 'scene' && this.ready) { try { this.buildMixer(msg.sceneJson); } catch (e) {} }
  }

  process(_inputs, outputs) {
    const out = outputs[0];
    if (!out || out.length < 2) return true;
    const outA = out[0], outB = out[1];
    if (!this.ready || !this.playing) { outA.fill(0); outB.fill(0); return true; }

    const pos = this.playhead;
    for (let s = 0; s < this.strips.length; s++) {
      const vl = this.inL[s], vr = this.inR[s];
      const audible = this.gates[s];
      const strip = this.strips[s];
      const start = pos - strip.offsetFrames;
      const buf = strip.left, bufR = strip.right, len = buf.length;
      for (let i = 0; i < BLOCK; i++) {
        const idx = start + i;
        if (audible && idx >= 0 && idx < len) { vl[i] = buf[idx]; vr[i] = bufR[idx]; }
        else { vl[i] = 0; vr[i] = 0; }
      }
    }

    this.mixer.processPreparedStereo(BLOCK);
    const g = this.masterGain;
    for (let i = 0; i < BLOCK; i++) { outA[i] = this.outL[i] * g; outB[i] = this.outR[i] * g; }

    this.playhead += BLOCK;
    if (++this.reportCounter >= 8) { this.reportCounter = 0; this.port.postMessage({ type: 'position', frame: this.playhead }); }
    if (this.totalFrames && this.playhead >= this.totalFrames) {
      this.playing = false;
      this.port.postMessage({ type: 'ended', frame: this.playhead });
    }
    return true;
  }
}

registerProcessor('libsonare-rt-mixer', LibsonareRtMixer);
`;
}

export function useRealtimeMixer(sonareUrl: string, wasmUrl: string) {
  const playing = ref(false);
  const positionSec = ref(0);
  const ready = ref(false);
  const error = ref<string | null>(null);

  const context = shallowRef<AudioContext | null>(null);
  let node: AudioWorkletNode | null = null;
  let moduleUrl: string | null = null;
  let wasmBinary: ArrayBuffer | null = null;
  let sampleRate = 48000;
  let onEnded: (() => void) | null = null;

  async function ensureContext(sr: number): Promise<AudioContext> {
    if (context.value && context.value.sampleRate === sr) return context.value;
    if (context.value) await dispose();
    const ctx = new AudioContext({ sampleRate: sr });
    if (!moduleUrl) {
      // The worklet runs from a blob: URL, so the static import specifier must be
      // absolute — a root-relative path can't resolve against an opaque blob base.
      const absoluteSonareUrl = new URL(sonareUrl, location.href).href;
      moduleUrl = URL.createObjectURL(
        new Blob([buildProcessorSource(absoluteSonareUrl)], { type: 'text/javascript' }),
      );
    }
    await ctx.audioWorklet.addModule(moduleUrl);
    context.value = ctx;
    sampleRate = sr;
    return ctx;
  }

  async function start(payload: RealtimeStartPayload, endedCallback?: () => void) {
    error.value = null;
    onEnded = endedCallback || null;
    const ctx = await ensureContext(payload.sampleRate);
    if (ctx.state === 'suspended') await ctx.resume();
    if (!wasmBinary) wasmBinary = await (await fetch(wasmUrl)).arrayBuffer();

    teardownNode();
    ready.value = false;
    node = new AudioWorkletNode(ctx, 'libsonare-rt-mixer', {
      numberOfInputs: 0,
      numberOfOutputs: 1,
      outputChannelCount: [2],
      processorOptions: {
        wasmBinary,
        sceneJson: payload.sceneJson,
        sampleRate: payload.sampleRate,
        masterGain: payload.masterGain,
        startFrame: payload.startFrame,
        totalFrames: payload.totalFrames,
        strips: payload.strips,
        gates: payload.gates,
      },
    });
    node.port.onmessage = (event) => {
      const msg = event.data;
      if (msg.type === 'ready') {
        ready.value = true;
        node?.port.postMessage({ type: 'play' });
        playing.value = true;
      } else if (msg.type === 'position') positionSec.value = msg.frame / sampleRate;
      else if (msg.type === 'ended') {
        playing.value = false;
        onEnded?.();
      } else if (msg.type === 'error') {
        error.value = msg.error;
        playing.value = false;
      }
    };
    node.connect(ctx.destination);
  }

  function stop() {
    node?.port.postMessage({ type: 'stop' });
    playing.value = false;
  }

  function seek(frame: number) {
    node?.port.postMessage({ type: 'seek', frame });
    positionSec.value = frame / sampleRate;
  }

  function updateScene(sceneJson: string) {
    node?.port.postMessage({ type: 'scene', sceneJson });
  }

  function updateGates(gates: boolean[]) {
    node?.port.postMessage({ type: 'gates', gates });
  }

  function updateMasterGain(value: number) {
    node?.port.postMessage({ type: 'masterGain', value });
  }

  function teardownNode() {
    if (node) {
      try {
        node.disconnect();
      } catch {
        /* already disconnected */
      }
      node.port.onmessage = null;
      node = null;
    }
  }

  async function dispose() {
    teardownNode();
    playing.value = false;
    ready.value = false;
    positionSec.value = 0;
    if (context.value) {
      try {
        await context.value.close();
      } catch {
        /* already closed */
      }
      context.value = null;
    }
  }

  return {
    playing,
    positionSec,
    ready,
    error,
    start,
    stop,
    seek,
    updateScene,
    updateGates,
    updateMasterGain,
    dispose,
  };
}
