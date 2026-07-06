/**
 * Web Worker host for the oracle auto-fit optimizer. The DSP is pure TS, so a
 * standard module worker bundles it without the AudioWorklet esbuild step. The
 * main thread starts a run and cancels by terminating the worker (stateless —
 * no cooperative flag needed inside the hot loop).
 */
import {
  type AutofitOptions,
  type AutofitProgress,
  type AutofitResult,
  runAutofit,
} from '../tuner/dsp/autofit';
import type { ModelSpec } from '../tuner/dsp/engine';

interface StartRequest {
  type: 'start';
  spec: ModelSpec;
  oracle: Float32Array;
  note: number;
  velocity: number;
  sampleRate: number;
  frames: number;
  opts: AutofitOptions;
}

type WorkerMessage =
  | ({ type: 'progress' } & AutofitProgress)
  | ({ type: 'done' } & AutofitResult)
  | { type: 'error'; message: string };

self.onmessage = async (event: MessageEvent<StartRequest>) => {
  const req = event.data;
  if (req.type !== 'start') return;
  try {
    const gen = runAutofit(
      req.spec,
      req.oracle,
      req.note,
      req.velocity,
      req.sampleRate,
      req.frames,
      req.opts,
    );
    let step = await gen.next();
    while (!step.done) {
      self.postMessage({ type: 'progress', ...step.value } satisfies WorkerMessage);
      step = await gen.next();
    }
    self.postMessage({ type: 'done', ...step.value } satisfies WorkerMessage);
  } catch (err) {
    self.postMessage({
      type: 'error',
      message: err instanceof Error ? err.message : 'autofit failed',
    } satisfies WorkerMessage);
  }
};
