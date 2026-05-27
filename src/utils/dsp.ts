// Pure DSP primitives for the Realtime FX voice engine. These are the single
// source of truth for the audio-thread math: useRealtimeFx.ts injects their
// source text into the AudioWorklet (a blob worklet cannot import app modules),
// so the same code runs both here (tested) and in the worklet.

/** Symmetric Hann window of `length` samples. */
export function hannWindow(length: number): Float32Array {
  const win = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (length - 1));
  }
  return win;
}

/** Normalise an overlap-add accumulator by its window-sum, guarding near-zero. */
export function olaNormalize(accum: number, windowSum: number, threshold = 1e-6): number {
  return windowSum > threshold ? accum / windowSum : 0;
}

/** Ring-modulation blend: `amount` 0 = dry, 1 = fully modulated by `carrier`. */
export function ringModulate(sample: number, carrier: number, amount: number): number {
  return sample * (1 - amount) + sample * carrier * amount;
}

/** Advance a sine-carrier phase by one sample at `freqHz`, wrapped to [0, 2π). */
export function advancePhase(phase: number, freqHz: number, sampleRate: number): number {
  let next = phase + (2 * Math.PI * freqHz) / sampleRate;
  if (next > Math.PI * 2) next -= Math.PI * 2;
  return next;
}

/**
 * One-tap feedback reverb step. Returns the updated feedback state and the wet
 * output for `input`. `amount` 0 = dry/no tail, higher = longer, louder tail.
 */
export function reverbStep(
  state: number,
  input: number,
  amount: number,
): { state: number; output: number } {
  const nextState = state * (0.78 + amount * 0.17) + input * amount * 0.22;
  return { state: nextState, output: input + nextState * amount * 0.45 };
}
