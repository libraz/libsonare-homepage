import { mount } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { defineComponent } from 'vue';
import { useSpatialScanner } from '@/demos/spatial/useSpatialScanner';

function audioBuffer(channels: Float32Array[], sampleRate = 48_000): AudioBuffer {
  const length = channels[0]?.length ?? 0;
  return {
    length,
    duration: length / sampleRate,
    sampleRate,
    numberOfChannels: channels.length,
    getChannelData: (channel: number) => channels[channel],
  } as unknown as AudioBuffer;
}

class WorkerMock {
  static instances: WorkerMock[] = [];
  readonly messages: Array<{ message: any; transfer?: Transferable[] }> = [];
  onmessage: ((event: MessageEvent) => void) | null = null;
  terminate = vi.fn();

  constructor(..._args: unknown[]) {
    WorkerMock.instances.push(this);
  }

  postMessage(message: any, transfer?: Transferable[]) {
    this.messages.push({ message, transfer });
  }
}

function mountScanner() {
  let scanner!: ReturnType<typeof useSpatialScanner>;
  const wrapper = mount(
    defineComponent({
      setup() {
        scanner = useSpatialScanner();
        return () => null;
      },
    }),
  );
  return { scanner, wrapper };
}

describe('useSpatialScanner mono preparation', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    WorkerMock.instances = [];
  });

  it.each([false, true])(
    'keeps an anti-phase %s scan audible in the posted worker payload',
    (isIR) => {
      vi.stubGlobal('Worker', WorkerMock);
      const { scanner, wrapper } = mountScanner();
      try {
        const left = new Float32Array([0.3, -0.6, 0.15, -0.2]);
        const right = new Float32Array([-0.3, 0.6, -0.15, 0.2]);

        scanner.scanDecoded(audioBuffer([left, right]), 'anti-phase.wav', isIR);

        const posted = WorkerMock.instances[0].messages.at(-1)!;
        expect(posted.message).toMatchObject({ type: 'scan', isIR, sampleRate: 48_000 });
        expect(posted.message.samples).toEqual(left);
        expect(posted.message.samples.some((sample: number) => Math.abs(sample) > 0)).toBe(true);
        expect(posted.transfer).toEqual([posted.message.samples.buffer]);
      } finally {
        wrapper.unmount();
      }
    },
  );

  it('keeps the coherent stereo average in the posted worker payload', () => {
    vi.stubGlobal('Worker', WorkerMock);
    const { scanner, wrapper } = mountScanner();
    try {
      const left = new Float32Array([0.6, -0.2, 0.1, -0.4]);
      const right = new Float32Array([0.3, -0.1, 0.05, -0.2]);

      scanner.scanDecoded(audioBuffer([left, right]), 'coherent.wav', true);

      const posted = WorkerMock.instances[0].messages[0];
      expect(posted.message).toMatchObject({ type: 'scan', isIR: true, sampleRate: 48_000 });
      for (let i = 0; i < left.length; i++) {
        expect(posted.message.samples[i]).toBeCloseTo((left[i] + right[i]) / 2, 6);
      }
    } finally {
      wrapper.unmount();
    }
  });

  it('keeps independent four-channel content in the mono average', () => {
    vi.stubGlobal('Worker', WorkerMock);
    const { scanner, wrapper } = mountScanner();
    try {
      const channels = Array.from({ length: 4 }, (_, channel) =>
        Float32Array.from({ length: 4 }, (_, frame) => (frame === channel ? 1 : 0)),
      );

      scanner.scanDecoded(audioBuffer(channels), 'multichannel.wav', false);

      const samples = WorkerMock.instances[0].messages[0].message.samples as Float32Array;
      expect(Array.from(samples)).toEqual([0.25, 0.25, 0.25, 0.25]);
    } finally {
      wrapper.unmount();
    }
  });
});
