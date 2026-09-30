/**
 * Worker for the NMF component audition.
 *
 * NMF is a synchronous WASM operation. Keeping the factorisation in this
 * worker prevents a long clip from blocking the document thread while the
 * four listenable components are reconstructed.
 */

import type { DecomposeStemsResult } from '@/wasm/index.js';

export const NMF_COMPONENT_COUNT = 4;
export const NMF_N_FFT = 1024;
export const NMF_HOP_LENGTH = 256;
export const NMF_ITERATIONS = 30;

export interface NmfWorkerRequest {
  type: 'decompose';
  id: number;
  samples: Float32Array;
  sampleRate: number;
}

export type NmfWorkerResponse =
  | {
      type: 'done';
      id: number;
      components: Float32Array[];
      sampleRate: number;
    }
  | {
      type: 'error';
      id: number;
      error: string;
    };

type NmfDoneResponse = Extract<NmfWorkerResponse, { type: 'done' }>;

type NmfWasmModule = Pick<typeof import('@/wasm/index.js'), 'init' | 'decomposeStems'>;

let wasmModule: NmfWasmModule | null = null;
let wasmInit: Promise<NmfWasmModule> | null = null;

async function ensureWasm(): Promise<NmfWasmModule> {
  if (wasmModule) return wasmModule;
  if (!wasmInit) {
    wasmInit = (async () => {
      const module = (await import('@/wasm/index.js')) as NmfWasmModule;
      await module.init();
      wasmModule = module;
      return module;
    })().catch((error) => {
      wasmInit = null;
      throw error;
    });
  }
  return wasmInit;
}

function validateComponents(result: DecomposeStemsResult, sourceLength: number): Float32Array[] {
  if (
    result.components.length !== NMF_COMPONENT_COUNT ||
    result.components.some(
      (component) =>
        component.length !== sourceLength ||
        Array.from(component).some((sample) => !Number.isFinite(sample)),
    )
  ) {
    throw new Error('NMF returned an unexpected component shape');
  }
  return result.components;
}

/** Run one NMF request. Exported for a small adapter-focused unit test. */
export async function decomposeNmf(
  request: NmfWorkerRequest,
  module?: NmfWasmModule,
): Promise<NmfDoneResponse> {
  const wasm = module ?? (await ensureWasm());
  const result = wasm.decomposeStems({
    samples: request.samples,
    sampleRate: request.sampleRate,
    nComponents: NMF_COMPONENT_COUNT,
    nFft: NMF_N_FFT,
    hopLength: NMF_HOP_LENGTH,
    nIter: NMF_ITERATIONS,
  });
  const components = validateComponents(result, request.samples.length);
  return {
    type: 'done',
    id: request.id,
    components,
    sampleRate: result.sampleRate,
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

// The document-side adapter imports the pure `decomposeNmf` helper for tests;
// only install the message handler in the actual worker global.
if (typeof self !== 'undefined' && typeof document === 'undefined') {
  const workerScope = self as unknown as {
    onmessage: ((event: MessageEvent<NmfWorkerRequest>) => void) | null;
    postMessage: (message: NmfWorkerResponse, transfer?: Transferable[]) => void;
  };
  workerScope.onmessage = async (event: MessageEvent<NmfWorkerRequest>) => {
    const request = event.data;
    if (request.type !== 'decompose') return;
    try {
      const response = await decomposeNmf(request);
      workerScope.postMessage(
        response,
        response.components.map((component) => component.buffer as ArrayBuffer),
      );
    } catch (error) {
      workerScope.postMessage({
        type: 'error',
        id: request.id,
        error: errorMessage(error),
      } satisfies NmfWorkerResponse);
    }
  };
}
