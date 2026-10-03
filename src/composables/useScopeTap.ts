import { getCurrentScope, onScopeDispose, type ShallowRef, shallowRef } from 'vue';
import type { meteringPhaseScope, meteringSpectrumFrame } from '@/wasm/index';

/** The two engine metering functions the tap calls; pass the loaded WASM module. */
export interface ScopeTapWasm {
  meteringSpectrumFrame: typeof meteringSpectrumFrame;
  meteringPhaseScope: typeof meteringPhaseScope;
}

/** Options for {@link useScopeTap}. */
export interface ScopeTapOptions {
  /** Loaded WASM module (after `init()`). */
  wasm: ScopeTapWasm;
  /** `mid` analyses (L + R) / 2 once; `stereo` analyses L and R separately. Default `mid`. */
  spectrum?: 'mid' | 'stereo';
}

/** Latest spectrum frame: one dB array for `mid`, `[L, R]` for `stereo`. */
export interface ScopeTapSpectrum {
  freqs: Float32Array;
  db: Float32Array[];
}

/** Latest phase-scope frame from `meteringPhaseScope`. */
export interface ScopeTapScope {
  mid: Float32Array;
  side: Float32Array;
  correlation: number;
}

/** Reactive outputs of {@link useScopeTap}. */
export interface ScopeTap {
  spectrum: ShallowRef<ScopeTapSpectrum | null>;
  scope: ShallowRef<ScopeTapScope | null>;
  /** Stop the loop and disconnect the analysers; safe to call twice. */
  dispose: () => void;
}

/** Analysis window, matching the engine spectrum frame size. */
export const SCOPE_TAP_FFT_SIZE = 4096;
/** Points per goniometer frame. */
export const SCOPE_TAP_MAX_POINTS = 512;
/** Frame interval under `prefers-reduced-motion` (4 Hz). */
export const SCOPE_TAP_REDUCED_INTERVAL_MS = 250;

/**
 * Tap a node's stereo output and analyse it with the engine every animation frame.
 *
 * The source feeds a ChannelSplitter and two AnalyserNodes; each frame reads
 * their time-domain windows and hands them to `meteringSpectrumFrame` and
 * `meteringPhaseScope`. The loop pauses while the document is hidden and runs
 * at 4 Hz under `prefers-reduced-motion`. Inside a component or effect scope
 * the tap disposes itself with that scope.
 *
 * @param context The context that owns `source`.
 * @param source Stereo node to observe; its other connections are left alone.
 * @param options WASM module and spectrum mode.
 */
export function useScopeTap(
  context: BaseAudioContext,
  source: AudioNode,
  options: ScopeTapOptions,
): ScopeTap {
  const { wasm } = options;
  const stereo = options.spectrum === 'stereo';
  const sampleRate = context.sampleRate;

  const splitter = context.createChannelSplitter(2);
  const analysers = [context.createAnalyser(), context.createAnalyser()] as const;
  analysers.forEach((analyser, channel) => {
    analyser.fftSize = SCOPE_TAP_FFT_SIZE;
    splitter.connect(analyser, channel);
  });
  source.connect(splitter);

  const left = new Float32Array(SCOPE_TAP_FFT_SIZE);
  const right = new Float32Array(SCOPE_TAP_FFT_SIZE);
  const mono = new Float32Array(SCOPE_TAP_FFT_SIZE);

  const spectrum = shallowRef<ScopeTapSpectrum | null>(null);
  const scope = shallowRef<ScopeTapScope | null>(null);

  const reduceMotion =
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)')
      : null;
  let frame = 0;
  let lastMs = Number.NEGATIVE_INFINITY;
  let disposed = false;

  function spectrumOf(samples: Float32Array) {
    return wasm.meteringSpectrumFrame({
      samples,
      sampleRate,
      nFft: SCOPE_TAP_FFT_SIZE,
      frameOffset: 0,
    });
  }

  function analyse(): void {
    analysers[0].getFloatTimeDomainData(left);
    analysers[1].getFloatTimeDomainData(right);

    if (stereo) {
      const l = spectrumOf(left);
      const r = spectrumOf(right);
      spectrum.value = { freqs: l.frequencies, db: [l.db, r.db] };
    } else {
      for (let i = 0; i < SCOPE_TAP_FFT_SIZE; i++) mono[i] = 0.5 * (left[i] + right[i]);
      const m = spectrumOf(mono);
      spectrum.value = { freqs: m.frequencies, db: [m.db] };
    }

    const phase = wasm.meteringPhaseScope({
      left,
      right,
      sampleRate,
      maxPoints: SCOPE_TAP_MAX_POINTS,
    });
    scope.value = { mid: phase.mid, side: phase.side, correlation: phase.correlation };
  }

  function onFrame(nowMs: number): void {
    frame = 0;
    if (disposed || document.hidden) return;
    frame = requestAnimationFrame(onFrame);
    if (reduceMotion?.matches && nowMs - lastMs < SCOPE_TAP_REDUCED_INTERVAL_MS) return;
    lastMs = nowMs;
    analyse();
  }

  function start(): void {
    if (disposed || frame || document.hidden) return;
    frame = requestAnimationFrame(onFrame);
  }

  function onVisibility(): void {
    if (document.hidden) {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
    } else {
      start();
    }
  }

  function dispose(): void {
    if (disposed) return;
    disposed = true;
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    document.removeEventListener('visibilitychange', onVisibility);
    source.disconnect(splitter);
    splitter.disconnect();
    for (const analyser of analysers) analyser.disconnect();
  }

  document.addEventListener('visibilitychange', onVisibility);
  start();
  if (getCurrentScope()) onScopeDispose(dispose);

  return { spectrum, scope, dispose };
}
