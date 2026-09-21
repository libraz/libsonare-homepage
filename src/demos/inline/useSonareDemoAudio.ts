/**
 * Shared runtime engine for inline documentation demos (`<SonareDemo />`).
 *
 * Responsibilities, all shared across every demo widget on a page:
 * - lazily initialize the libsonare WASM module exactly once (page-wide singleton);
 * - own a single {@link AudioContext}, created/resumed inside a user gesture;
 * - coordinate playback so at most one demo sounds at a time;
 * - decode pre-rendered demo clips to mono PCM for analysis + playback.
 *
 * Heavy/offline processing should still be routed through the existing Web Workers;
 * this composable is for the cheap (<~100ms) inline calls and playback plumbing.
 */

import { readonly, ref } from 'vue';

type WasmModule = typeof import('@/wasm/index');

/** Mono PCM plus its sample rate — the common currency for analysis + playback. */
export interface MonoAudio {
  samples: Float32Array;
  sampleRate: number;
}

// ---- page-wide singletons -------------------------------------------------

let wasmModule: WasmModule | null = null;
let wasmInit: Promise<WasmModule> | null = null;

let audioContext: AudioContext | null = null;
let currentSource: AudioBufferSourceNode | null = null;

const clipCache = new Map<string, Promise<MonoAudio>>();

/** Id of the demo currently sounding, or '' when silent. Shared across widgets. */
const playingId = ref('');

/**
 * Normalized playback position 0..1 of the currently sounding demo, updated each
 * animation frame. Archetypes read this to drive a synced playhead / highlight so
 * the explanation animates in step with the audio.
 */
const progress = ref(0);

/** True once the WASM module has finished initializing. */
const wasmReady = ref(false);

let rafId = 0;
let playStart = 0;
let playDuration = 0;

function stopProgressLoop(): void {
  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = 0;
  }
}

function startProgressLoop(): void {
  stopProgressLoop();
  const tick = () => {
    if (!audioContext || !currentSource) {
      progress.value = 0;
      rafId = 0;
      return;
    }
    const elapsed = audioContext.currentTime - playStart;
    progress.value = playDuration > 0 ? Math.min(1, Math.max(0, elapsed / playDuration)) : 0;
    rafId = requestAnimationFrame(tick);
  };
  rafId = requestAnimationFrame(tick);
}

function clearPlaybackState(): void {
  currentSource = null;
  stopProgressLoop();
  progress.value = 0;
  playingId.value = '';
}

function assertPlayableAudio(audio: MonoAudio): void {
  if (audio.samples.length === 0) {
    throw new Error('demo audio is empty');
  }
  if (!Number.isFinite(audio.sampleRate) || audio.sampleRate <= 0) {
    throw new Error(`demo audio has invalid sample rate: ${audio.sampleRate}`);
  }
}

function isAudioResponseType(type: string): boolean {
  const normalized = type.split(';', 1)[0]?.trim().toLowerCase() ?? '';
  return normalized.startsWith('audio/') || normalized === 'application/octet-stream';
}

/** Initialize the WASM module once; concurrent callers share the same promise. */
export async function ensureWasm(): Promise<WasmModule> {
  if (wasmModule) return wasmModule;
  if (!wasmInit) {
    wasmInit = (async () => {
      const mod = await import('@/wasm/index.js');
      await mod.init();
      wasmModule = mod;
      wasmReady.value = true;
      return mod;
    })().catch((error) => {
      wasmInit = null;
      wasmReady.value = false;
      throw error;
    });
  }
  return wasmInit;
}

/** Lazily create the shared AudioContext. Must be reached from a user gesture. */
function getAudioContext(): AudioContext {
  if (!audioContext) {
    const Ctor = window.AudioContext || (window as any).webkitAudioContext;
    audioContext = new Ctor();
  }
  return audioContext;
}

/** Stop whatever is currently playing and clear the shared `playingId`. */
function stop(): void {
  if (currentSource) {
    try {
      currentSource.onended = null;
      currentSource.stop();
    } catch {
      // already stopped
    }
  }
  clearPlaybackState();
}

export function useSonareDemoAudio() {
  /**
   * Decode a pre-rendered clip from `/demo-clips/<name>.*` to mono PCM.
   * Results are cached per name for the page lifetime.
   */
  async function loadClip(name: string): Promise<MonoAudio> {
    const cached = clipCache.get(name);
    if (cached) return cached;

    const promise = (async () => {
      const ctx = getAudioContext();
      // The generator emits wav, so probe it first — the compressed names stay
      // as fallbacks for hand-supplied assets without 404ing on every load.
      const candidates = [
        `/demo-clips/${name}.wav`,
        `/demo-clips/${name}.opus`,
        `/demo-clips/${name}.ogg`,
      ];
      let buf: ArrayBuffer | null = null;
      for (const url of candidates) {
        try {
          const res = await fetch(url);
          // A missing file can resolve to the SPA fallback (200 text/html) under the
          // dev server; only accept a response that is actually an audio payload.
          const type = res.headers.get('content-type') ?? '';
          if (res.ok && isAudioResponseType(type)) {
            buf = await res.arrayBuffer();
            break;
          }
        } catch {
          // Try the next available encoding.
        }
      }
      if (!buf) throw new Error(`demo clip not found: ${name}`);
      const decoded = await ctx.decodeAudioData(buf);
      // Downmix to mono for analysis.
      const mono = new Float32Array(decoded.length);
      for (let ch = 0; ch < decoded.numberOfChannels; ch++) {
        const data = decoded.getChannelData(ch);
        for (let i = 0; i < data.length; i++) mono[i] += data[i];
      }
      if (decoded.numberOfChannels > 1) {
        for (let i = 0; i < mono.length; i++) mono[i] /= decoded.numberOfChannels;
      }
      return { samples: mono, sampleRate: decoded.sampleRate };
    })().catch((error) => {
      clipCache.delete(name);
      throw error;
    });

    clipCache.set(name, promise);
    return promise;
  }

  /**
   * Play mono PCM through the shared context. Stops any other sounding demo first.
   * Resumes the context (autoplay policy) — must be called from a user gesture.
   */
  async function play(id: string, audio: MonoAudio): Promise<void> {
    assertPlayableAudio(audio);
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') await ctx.resume();

    if (playingId.value === id) {
      stop();
      return;
    }
    stop();

    const buffer = ctx.createBuffer(1, audio.samples.length, audio.sampleRate);
    buffer.copyToChannel(audio.samples, 0);
    const node = ctx.createBufferSource();
    node.buffer = buffer;
    node.connect(ctx.destination);
    node.onended = () => {
      if (currentSource === node) clearPlaybackState();
    };
    currentSource = node;
    playingId.value = id;
    playStart = ctx.currentTime;
    playDuration = buffer.duration;
    node.start();
    startProgressLoop();
  }

  return {
    ensureWasm,
    loadClip,
    play,
    stop,
    playingId: readonly(playingId),
    progress: readonly(progress),
    wasmReady: readonly(wasmReady),
  };
}
