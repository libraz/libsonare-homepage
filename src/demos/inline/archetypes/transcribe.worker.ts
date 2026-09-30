/**
 * Worker for audio-to-MIDI recognition and piano resynthesis.
 *
 * Both operations are synchronous WASM calls. Keeping them together means the
 * document thread never stalls while the lead clip is analyzed or bounced.
 */

import {
  renderTranscription,
  type TranscriptionRender,
  type TranscriptionWasm,
} from './transcribePipeline';

export interface TranscribeRequest {
  id: number;
  samples: Float32Array;
  sampleRate: number;
}

export type TranscribeResponse =
  | ({ id: number; type: 'done' } & Omit<TranscriptionRender, 'piano'> & { piano: Float32Array })
  | { id: number; type: 'error'; error: string };

type TranscribeDoneResponse = Extract<TranscribeResponse, { type: 'done' }>;
type TranscribeWasmModule = TranscriptionWasm & { init: () => Promise<void> };

let wasmModule: TranscriptionWasm | null = null;
let wasmBoot: Promise<TranscriptionWasm> | null = null;

async function ensureWasm(): Promise<TranscriptionWasm> {
  if (wasmModule) return wasmModule;
  if (!wasmBoot) {
    wasmBoot = (async () => {
      const module = (await import('@/wasm/index.js')) as unknown as TranscribeWasmModule;
      await module.init();
      // Publish only after init succeeds. A failed boot can be retried by the
      // next request, and parallel requests share this one in-flight promise.
      wasmModule = module;
      return module;
    })().finally(() => {
      wasmBoot = null;
    });
  }
  return wasmBoot;
}

async function transcribe(request: TranscribeRequest): Promise<TranscribeDoneResponse> {
  const result = renderTranscription(await ensureWasm(), request.samples, request.sampleRate);
  return {
    id: request.id,
    type: 'done',
    events: result.events,
    notes: result.notes,
    noteCount: result.noteCount,
    tempoBpm: result.tempoBpm,
    sampleRate: result.sampleRate,
    sourceDurationSec: result.sourceDurationSec,
    pianoDurationSec: result.pianoDurationSec,
    piano: result.piano,
  };
}

const workerScope = self as unknown as {
  onmessage: ((event: MessageEvent<TranscribeRequest>) => void) | null;
  postMessage: (message: TranscribeResponse, transfer?: Transferable[]) => void;
};

workerScope.onmessage = async (event: MessageEvent<TranscribeRequest>) => {
  const request = event.data;
  try {
    const response = await transcribe(request);
    workerScope.postMessage(response, [response.piano.buffer as ArrayBuffer]);
  } catch (error) {
    workerScope.postMessage({
      id: request.id,
      type: 'error',
      error: error instanceof Error ? error.message : String(error),
    } satisfies TranscribeResponse);
  }
};
