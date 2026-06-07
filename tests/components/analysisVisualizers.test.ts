import { mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import MatrixHeatmap from '@/components/MatrixHeatmap.vue';
import WaveformVisualizer from '@/components/WaveformVisualizer.vue';

function audioBuffer(channels: Float32Array[]): AudioBuffer {
  return {
    length: channels[0]?.length ?? 0,
    numberOfChannels: channels.length,
    getChannelData: (channel: number) => channels[channel],
  } as unknown as AudioBuffer;
}

describe('analysis visualizer components', () => {
  let getBoundingClientRectSpy: ReturnType<typeof vi.spyOn>;
  let getContextSpy: ReturnType<typeof vi.spyOn>;
  let ctx: Record<string, any>;
  let calls: Array<{ method: string; args: unknown[]; fillStyle?: string; strokeStyle?: string }>;

  beforeEach(() => {
    calls = [];
    ctx = {
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 0,
      clearRect: vi.fn((...args: unknown[]) => calls.push({ method: 'clearRect', args })),
      fillRect: vi.fn(function (this: any, ...args: unknown[]) {
        calls.push({ method: 'fillRect', args, fillStyle: this.fillStyle });
      }),
      beginPath: vi.fn(() => calls.push({ method: 'beginPath', args: [] })),
      roundRect: vi.fn((...args: unknown[]) => calls.push({ method: 'roundRect', args })),
      fill: vi.fn(function (this: any) {
        calls.push({ method: 'fill', args: [], fillStyle: this.fillStyle });
      }),
      moveTo: vi.fn((...args: unknown[]) => calls.push({ method: 'moveTo', args })),
      lineTo: vi.fn((...args: unknown[]) => calls.push({ method: 'lineTo', args })),
      stroke: vi.fn(function (this: any) {
        calls.push({ method: 'stroke', args: [], strokeStyle: this.strokeStyle });
      }),
      scale: vi.fn((...args: unknown[]) => calls.push({ method: 'scale', args })),
      createLinearGradient: vi.fn(() => ({
        addColorStop: vi.fn(),
      })),
    };

    getBoundingClientRectSpy = vi
      .spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect')
      .mockReturnValue({
        width: 120,
        height: 60,
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        right: 120,
        bottom: 60,
        toJSON: () => ({}),
      });

    getContextSpy = vi
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockReturnValue(ctx as unknown as CanvasRenderingContext2D);

    vi.stubGlobal(
      'ResizeObserver',
      vi.fn().mockImplementation(function (callback: ResizeObserverCallback) {
        return {
          observe: vi.fn(() => callback([], {} as ResizeObserver)),
          disconnect: vi.fn(),
        };
      }),
    );
  });

  afterEach(() => {
    getBoundingClientRectSpy.mockRestore();
    getContextSpy.mockRestore();
    vi.unstubAllGlobals();
    vi.useRealTimers();
    document.documentElement.classList.remove('dark');
  });

  it('draws MatrixHeatmap cells, overlay and accessible label', async () => {
    // The heatmap colormap is theme-aware; assert the dark-mode palette + overlay.
    document.documentElement.classList.add('dark');
    const wrapper = mount(MatrixHeatmap, {
      props: {
        rows: 2,
        columns: 3,
        values: new Float32Array([0, 0.25, 0.5, 0.75, 1, 1.25]),
        min: 0,
        max: 1,
        label: 'Chroma intensity',
      },
    });

    const canvas = wrapper.find('canvas');
    expect(canvas.attributes('aria-label')).toBe('Chroma intensity');
    expect(getContextSpy).toHaveBeenCalledWith('2d');
    expect(calls.filter((call) => call.method === 'fillRect')).toHaveLength(7);
    expect(calls.some((call) => call.method === 'clearRect')).toBe(true);
    expect(calls.some((call) => call.fillStyle === 'hsl(194 85% 12%)')).toBe(true);
    expect(calls.some((call) => call.fillStyle === 'hsl(272 85% 66%)')).toBe(true);

    calls.length = 0;
    await wrapper.setProps({ max: 2 });
    expect(calls.filter((call) => call.method === 'fillRect')).toHaveLength(7);
  });

  it('renders WaveformVisualizer progress and emits seek times from clicks', async () => {
    const wrapper = mount(WaveformVisualizer, {
      props: {
        audioBuffer: audioBuffer([
          new Float32Array([0, 0.2, -0.4, 0.8, -1, 0.5, 0.25, -0.1]),
          new Float32Array([0, -0.2, 0.4, -0.8, 1, -0.5, -0.25, 0.1]),
        ]),
        beats: new Float32Array([0.25, 0.75]),
        currentTime: 2,
        duration: 8,
      },
    });

    expect(wrapper.find('.waveform__playhead').attributes('style')).toContain('left: 25%');
    expect(calls.some((call) => call.method === 'roundRect')).toBe(true);

    await wrapper.setProps({
      beats: new Float32Array([0.25, 0.75]),
      currentTime: 3,
    });
    expect(
      calls.some(
        (call) => call.method === 'stroke' && call.strokeStyle === 'rgba(236, 72, 153, 0.5)',
      ),
    ).toBe(true);

    await wrapper.find('.waveform').trigger('click', { clientX: 90 });
    expect(wrapper.emitted('seek')).toEqual([[6]]);

    await wrapper.setProps({ currentTime: 4 });
    expect(wrapper.find('.waveform__playhead').attributes('style')).toContain('left: 50%');
  });
});
