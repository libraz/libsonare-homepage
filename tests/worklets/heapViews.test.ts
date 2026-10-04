import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';
import { buildProcessorSource as voiceSource } from '@/demos/realtime-fx/useRealtimeFx';

/**
 * The voice changer worklet caches views onto the WASM heap. A view goes stale
 * two ways: heap growth detaches its buffer, and a re-prepare moves its scratch
 * buffers without detaching anything (it bumps `bufferGeneration` instead).
 * These run the processor source against a fake module and check that each
 * block reads and writes the live buffers.
 */

type Processor = {
  port: { onmessage: (e: { data: unknown }) => void };
  process: (inputs: Float32Array[][], outputs: Float32Array[][]) => boolean;
};

async function load(source: string, mod: unknown, processorOptions: unknown): Promise<Processor> {
  let Registered: (new (options: unknown) => Processor) | null = null;
  class AudioWorkletProcessor {
    port = { onmessage: (_e: { data: unknown }) => undefined, postMessage() {} };
  }
  runInNewContext(source.replace(/^\s*import createModule from .*$/m, ''), {
    AudioWorkletProcessor,
    registerProcessor: (_name: string, ctor: typeof Registered) => {
      Registered = ctor;
    },
    sampleRate: 48_000,
    createModule: () => Promise.resolve(mod),
  });
  const processor = new Registered!({ processorOptions });
  await new Promise((resolve) => setTimeout(resolve, 0));
  return processor;
}

/** A heap view that can be detached the way heap growth detaches one. */
function heapView(length: number) {
  const buffer = new ArrayBuffer(length * 4);
  return {
    view: new Float32Array(buffer),
    detach: () => structuredClone(buffer, { transfer: [buffer] }),
  };
}

describe('voice changer worklet heap views', () => {
  function fakeChanger() {
    const changer = {
      generation: 1,
      input: heapView(128),
      output: heapView(128),
      prepare() {},
      reset() {},
      latencySamples: () => 0,
      configJson: () => JSON.stringify({ dsp: { retune: {}, formant: { amount: 0 } } }),
      setConfig() {},
      bufferGeneration: () => changer.generation,
      getMonoInputBuffer: () => changer.input.view,
      getMonoOutputBuffer: () => changer.output.view,
      processPreparedMono(n: number) {
        for (let i = 0; i < n; i++) changer.output.view[i] = changer.input.view[i] * 2;
      },
    };
    return changer;
  }

  async function blockRunner(changer: ReturnType<typeof fakeChanger>) {
    const processor = await load(
      voiceSource('/sonare.js'),
      { createRealtimeVoiceChanger: () => changer },
      {},
    );
    return (input: number) => {
      const out = [new Float32Array(128), new Float32Array(128)];
      processor.process([[new Float32Array(128).fill(input)]], [out]);
      return out[0][0];
    };
  }

  // Doubled by the fake chain, then the default 0.85 monitor gain.
  const expected = (input: number) => input * 2 * 0.85;

  it('processes through the prepared buffers', async () => {
    const block = await blockRunner(fakeChanger());
    expect(block(0.25)).toBeCloseTo(expected(0.25), 6);
  });

  it('re-acquires after heap growth detaches the views', async () => {
    const changer = fakeChanger();
    const block = await blockRunner(changer);
    block(0.25);
    changer.input.detach();
    changer.output.detach();
    changer.input = heapView(128);
    changer.output = heapView(128);
    expect(block(0.1)).toBeCloseTo(expected(0.1), 6);
  });

  it('re-acquires after a re-prepare moves the buffers without detaching them', async () => {
    const changer = fakeChanger();
    const block = await blockRunner(changer);
    block(0.25);
    changer.input = heapView(128);
    changer.output = heapView(128);
    changer.generation = 2;
    expect(block(0.1)).toBeCloseTo(expected(0.1), 6);
  });
});
