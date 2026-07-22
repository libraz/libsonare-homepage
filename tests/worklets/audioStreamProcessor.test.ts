import { describe, expect, it } from 'vitest';
import processorSource from '@/public/audio-stream-processor.js?raw';

type ProcessorConstructor = new () => {
  bufferSize: number;
  bufferPool: Float32Array[];
  chunk: Float32Array;
  port: {
    onmessage: (event: { data: Record<string, unknown> }) => void;
    messages: Array<{ message: any; transfer?: ArrayBuffer[] }>;
  };
  process: (inputs: Float32Array[][], outputs: Float32Array[][]) => boolean;
};

function createProcessor() {
  let RegisteredProcessor: ProcessorConstructor | null = null;
  class AudioWorkletProcessorMock {
    port = {
      onmessage: (_event: { data: Record<string, unknown> }) => undefined,
      messages: [] as Array<{ message: any; transfer?: ArrayBuffer[] }>,
      postMessage: (message: any, transfer?: ArrayBuffer[]) => {
        this.port.messages.push({ message, transfer });
      },
    };
  }
  const registerProcessor = (_name: string, ctor: ProcessorConstructor) => {
    RegisteredProcessor = ctor;
  };
  new Function('AudioWorkletProcessor', 'registerProcessor', processorSource)(
    AudioWorkletProcessorMock,
    registerProcessor,
  );
  if (!RegisteredProcessor) throw new Error('processor was not registered');
  return new RegisteredProcessor();
}

describe('audio stream processor', () => {
  it('downmixes every input channel instead of analyzing the left channel only', () => {
    const processor = createProcessor();
    processor.port.onmessage({ data: { type: 'setBufferSize', bufferSize: 128 } });
    const left = new Float32Array(128);
    const right = new Float32Array(128).fill(1);
    const outLeft = new Float32Array(128);
    const outRight = new Float32Array(128);

    expect(processor.process([[left, right]], [[outLeft, outRight]])).toBe(true);

    const samples = processor.port.messages.at(-1)!.message.samples as Float32Array;
    expect(samples).toHaveLength(128);
    expect(samples.every((value) => value === 0.5)).toBe(true);
    expect(Array.from(outLeft)).toEqual(Array.from(left));
    expect(Array.from(outRight)).toEqual(Array.from(right));
  });

  it('flushes a partial tail on stop and rejects unsafe buffer sizes', () => {
    const processor = createProcessor();
    processor.port.onmessage({ data: { type: 'setBufferSize', bufferSize: 3 } });
    expect(processor.bufferSize).toBe(4096);

    processor.process([[new Float32Array([0.25, 0.5, 0.75])]], [[new Float32Array(3)]]);
    processor.port.onmessage({ data: { type: 'stop' } });

    const message = processor.port.messages.at(-1)!.message;
    expect(message.sampleOffset).toBe(0);
    expect(Array.from(message.samples)).toEqual([0.25, 0.5, 0.75]);
  });

  it('accepts transferred buffers back into a bounded reuse pool', () => {
    const processor = createProcessor();
    processor.port.onmessage({ data: { type: 'setBufferSize', bufferSize: 128 } });
    processor.process([[new Float32Array(128)]], [[new Float32Array(128)]]);
    const sent = processor.port.messages.at(-1)!.message.samples as Float32Array;

    processor.port.onmessage({ data: { type: 'recycle', samples: sent } });
    expect(processor.bufferPool).toContain(sent);
    processor.process([[new Float32Array(128)]], [[new Float32Array(128)]]);
    expect(processor.chunk).toBe(sent);
  });
});
