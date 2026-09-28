import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';
import { buildProcessorSource } from '@/demos/mixing/useRealtimeMixer';

type WorkletPort = {
  onmessage: (event: { data: unknown }) => void;
  postMessage: (message: unknown) => void;
};

type Processor = {
  port: WorkletPort;
  process: (inputs: Float32Array[][], outputs: Float32Array[][]) => boolean;
};

function heapView(length: number) {
  return new Float32Array(length);
}

async function loadProcessor(
  source: string,
  module: unknown,
  processorOptions: unknown,
): Promise<Processor> {
  let Registered: (new (options: unknown) => Processor) | null = null;
  class AudioWorkletProcessor {
    port: WorkletPort = {
      onmessage: () => undefined,
      postMessage: () => undefined,
    };
  }

  runInNewContext(source.replace(/^\s*import createModule from .*$/m, ''), {
    AudioWorkletProcessor,
    createModule: () => Promise.resolve(module),
    registerProcessor: (_name: string, ctor: new (options: unknown) => Processor) => {
      Registered = ctor;
    },
  });

  const processor = new Registered!({ processorOptions });
  await new Promise((resolve) => setTimeout(resolve, 0));
  return processor;
}

describe('realtime mixer worklet source', () => {
  it('passes the processor sample rate to the native mixer', async () => {
    const createCalls: unknown[][] = [];
    const mixer = {
      inputLeftView: () => heapView(128),
      inputRightView: () => heapView(128),
      outputLeftView: () => heapView(128),
      outputRightView: () => heapView(128),
      processPreparedStereo() {},
      tailSamples: () => 0,
      latencySamples: () => 0,
      delete() {},
    };
    const processor = await loadProcessor(
      buildProcessorSource('/wasm/sonare.js'),
      {
        createMixerFromSceneJson: (...args: unknown[]) => {
          createCalls.push(args);
          return mixer;
        },
      },
      {
        sceneJson: '{"version":1}',
        sampleRate: 44_100,
        totalFrames: 128,
        strips: [{ left: new Float32Array(128), right: new Float32Array(128), offsetFrames: 0 }],
      },
    );

    expect(createCalls).toEqual([['{"version":1}', 44_100, 128]]);
    expect(processor).toBeDefined();
  });

  it('extends playback through the native graph tail and latency', async () => {
    let processCalls = 0;
    const messages: unknown[] = [];
    const outputLeft = heapView(128);
    const outputRight = heapView(128);
    const mixer = {
      inputLeftView: () => heapView(128),
      inputRightView: () => heapView(128),
      outputLeftView: () => outputLeft,
      outputRightView: () => outputRight,
      processPreparedStereo() {
        processCalls++;
        outputLeft.fill(processCalls > 2 ? 0.25 : 0);
        outputRight.fill(processCalls > 2 ? 0.25 : 0);
      },
      tailSamples: () => 200,
      latencySamples: () => 50,
      delete() {},
    };
    const processor = await loadProcessor(
      buildProcessorSource('/wasm/sonare.js'),
      { createMixerFromSceneJson: () => mixer },
      {
        sceneJson: '{"version":1}',
        sampleRate: 48_000,
        totalFrames: 200,
        strips: [{ left: new Float32Array(200), right: new Float32Array(200), offsetFrames: 0 }],
      },
    );
    processor.port.postMessage = (message) => messages.push(message);
    processor.port.onmessage({ data: { type: 'play' } });

    const output = () => [new Float32Array(128), new Float32Array(128)];
    processor.process([], [output()]);
    processor.process([], [output()]);
    const firstTailBlock = output();
    processor.process([], [firstTailBlock]);
    expect(messages).not.toContainEqual({ type: 'ended', frame: 200 });
    const finalBlock = output();
    processor.process([], [finalBlock]);

    expect(processCalls).toBe(4);
    expect(firstTailBlock[0][0]).toBeCloseTo(0.25);
    expect(firstTailBlock[1][0]).toBeCloseTo(0.25);
    expect(finalBlock[0][65]).toBeCloseTo(0.25);
    expect(finalBlock[1][65]).toBeCloseTo(0.25);
    expect(finalBlock[0][66]).toBe(0);
    expect(finalBlock[1][66]).toBe(0);
    expect(messages).toContainEqual({ type: 'ended', frame: 450 });
  });
});
