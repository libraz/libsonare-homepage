/**
 * Drives the oracle auto-fit worker for the physical-model tuner. Mirrors the
 * repo's worker-composable pattern (see `useMastering`): lazily spawns a module
 * worker, streams per-generation progress, and cancels by terminating it. The
 * `onBestSpec` hook feeds the best-so-far spec back to the page for live preview.
 */
import { readonly, ref, shallowRef } from 'vue';
import type { AutofitOptions, AutofitResult } from '@/tuner/dsp/autofit';
import { DEFAULT_AUTOFIT_OPTIONS } from '@/tuner/dsp/autofit';
import type { ModelSpec } from '@/tuner/dsp/engine';

interface StartArgs {
  spec: ModelSpec;
  oracle: Float32Array;
  note: number;
  velocity: number;
  sampleRate: number;
  frames: number;
  opts?: Partial<AutofitOptions>;
}

export function useTunerAutofit() {
  let worker: Worker | null = null;
  let bestSpecCb: ((spec: ModelSpec) => void) | null = null;
  /** Resolver for the in-flight start() promise, so a cancel/teardown settles it. */
  let pendingResolve: ((result: AutofitResult | null) => void) | null = null;

  const running = ref(false);
  const progress = ref(0);
  const specSimPct = ref(0);
  const rmsErrorPct = ref(0);
  const lastResult = shallowRef<AutofitResult | null>(null);
  const error = ref('');

  function onBestSpec(cb: (spec: ModelSpec) => void): void {
    bestSpecCb = cb;
  }

  function teardown(): void {
    worker?.terminate();
    worker = null;
    running.value = false;
    // Settle a start() awaiting this fit (cancel/dispose or a superseding start)
    // so its promise never hangs. A 'done' handler nulls this first and resolves
    // the real result itself.
    const resolve = pendingResolve;
    pendingResolve = null;
    resolve?.(null);
  }

  function start(args: StartArgs): Promise<AutofitResult | null> {
    teardown();
    running.value = true;
    progress.value = 0;
    specSimPct.value = 0;
    rmsErrorPct.value = 0;
    error.value = '';
    lastResult.value = null;

    worker = new Worker(new URL('../workers/autofit.worker.ts', import.meta.url), {
      type: 'module',
    });
    const active = worker;

    return new Promise((resolve) => {
      pendingResolve = resolve;
      active.onmessage = (event: MessageEvent) => {
        const msg = event.data;
        if (msg?.type === 'progress') {
          progress.value = msg.progress;
          specSimPct.value = msg.specSimPct;
          rmsErrorPct.value = msg.rmsErrorPct;
          if (msg.bestSpec) bestSpecCb?.(msg.bestSpec);
        } else if (msg?.type === 'done') {
          const result = msg as AutofitResult;
          lastResult.value = result;
          progress.value = 1;
          specSimPct.value = result.specSimPct;
          rmsErrorPct.value = result.rmsErrorPct;
          // Resolve with the real result; null the resolver so teardown()'s own
          // settle is a no-op.
          pendingResolve = null;
          teardown();
          resolve(result);
        } else if (msg?.type === 'error') {
          error.value = msg.message ?? 'autofit failed';
          teardown();
        }
      };
      active.onerror = () => {
        error.value = 'autofit worker crashed';
        teardown();
      };

      // De-proxy the reactive spec before posting (a Proxy fails structured clone).
      active.postMessage({
        type: 'start',
        spec: JSON.parse(JSON.stringify(args.spec)),
        oracle: args.oracle,
        note: args.note,
        velocity: args.velocity,
        sampleRate: args.sampleRate,
        frames: args.frames,
        opts: { ...DEFAULT_AUTOFIT_OPTIONS, ...args.opts },
      });
    });
  }

  /** Cancel a running fit (best-so-far already applied via live preview). */
  function cancel(): void {
    teardown();
  }

  function dispose(): void {
    teardown();
    bestSpecCb = null;
  }

  return {
    running: readonly(running),
    progress: readonly(progress),
    specSimPct: readonly(specSimPct),
    rmsErrorPct: readonly(rmsErrorPct),
    lastResult,
    error: readonly(error),
    onBestSpec,
    start,
    cancel,
    dispose,
  };
}
