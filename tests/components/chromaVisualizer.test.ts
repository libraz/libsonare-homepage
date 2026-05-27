import { mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ChromaVisualizer from '@/components/ChromaVisualizer.vue';

describe('ChromaVisualizer', () => {
  let ctx: Record<string, any>;
  let calls: Array<{ method: string; args: unknown[]; fillStyle?: string; strokeStyle?: string }>;
  let getContextSpy: ReturnType<typeof vi.spyOn>;
  let getBoundingClientRectSpy: ReturnType<typeof vi.spyOn>;
  let rafCallback: FrameRequestCallback | null;

  beforeEach(() => {
    document.documentElement.classList.add('dark');
    calls = [];
    rafCallback = null;
    ctx = {
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 0,
      globalAlpha: 1,
      font: '',
      textAlign: '',
      textBaseline: '',
      fillRect: vi.fn(function (this: any, ...args: unknown[]) {
        calls.push({ method: 'fillRect', args, fillStyle: this.fillStyle });
      }),
      beginPath: vi.fn(() => calls.push({ method: 'beginPath', args: [] })),
      moveTo: vi.fn((...args: unknown[]) => calls.push({ method: 'moveTo', args })),
      lineTo: vi.fn((...args: unknown[]) => calls.push({ method: 'lineTo', args })),
      stroke: vi.fn(function (this: any) {
        calls.push({ method: 'stroke', args: [], strokeStyle: this.strokeStyle });
      }),
      fillText: vi.fn((...args: unknown[]) => calls.push({ method: 'fillText', args })),
      scale: vi.fn((...args: unknown[]) => calls.push({ method: 'scale', args })),
    };

    getContextSpy = vi
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockReturnValue(ctx as unknown as CanvasRenderingContext2D);
    getBoundingClientRectSpy = vi
      .spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect')
      .mockReturnValue({
        width: 120,
        height: 60,
        left: 0,
        top: 0,
        right: 120,
        bottom: 60,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      });
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn((callback: FrameRequestCallback) => {
        rafCallback = callback;
        return 11;
      }),
    );
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    vi.stubGlobal(
      'MutationObserver',
      vi.fn().mockImplementation(function () {
        return {
          observe: vi.fn(),
          disconnect: vi.fn(),
        };
      }),
    );
  });

  afterEach(() => {
    document.documentElement.classList.remove('dark');
    getContextSpy.mockRestore();
    getBoundingClientRectSpy.mockRestore();
    vi.unstubAllGlobals();
  });

  function chromaData(energy = 0.5) {
    const features = new Float32Array(12 * 4);
    for (let frame = 0; frame < 4; frame++) {
      features[frame * 12] = energy;
      features[frame * 12 + 7] = energy * 0.8;
      features[frame * 12 + 11] = energy * 0.6;
    }
    return { features, nFrames: 4, nChroma: 12 };
  }

  it('sets up canvas dimensions and draws chroma cells, playhead and note labels', () => {
    const wrapper = mount(ChromaVisualizer, {
      props: {
        chromaData: chromaData(),
        currentTime: 1,
        duration: 4,
      },
    });

    const canvas = wrapper.find('canvas').element;
    expect(getContextSpy).toHaveBeenCalledWith('2d');
    expect(canvas.width).toBe(120);
    expect(canvas.height).toBe(60);
    expect(calls).toContainEqual({ method: 'scale', args: [1, 1] });
    expect(calls.filter((call) => call.method === 'fillRect').length).toBeGreaterThanOrEqual(49);
    expect(calls.some((call) => call.fillStyle === 'rgba(10, 10, 15, 0.95)')).toBe(true);
    expect(calls.some((call) => call.fillStyle === '#ff6b6b')).toBe(true);
    expect(calls.some((call) => call.method === 'moveTo' && call.args[0] === 30)).toBe(true);
    expect(calls.some((call) => call.method === 'stroke' && call.strokeStyle === '#fff')).toBe(
      true,
    );
    expect(calls.filter((call) => call.method === 'fillText').length).toBeGreaterThanOrEqual(12);
  });

  it('redraws when chroma data changes and on animation frames', async () => {
    const wrapper = mount(ChromaVisualizer, {
      props: {
        chromaData: chromaData(0.2),
        currentTime: 0,
        duration: 4,
      },
    });
    calls.length = 0;

    await wrapper.setProps({ chromaData: chromaData(0.9), currentTime: 2 });
    expect(calls.filter((call) => call.method === 'fillRect')).toHaveLength(49);
    expect(calls.some((call) => call.method === 'moveTo' && call.args[0] === 60)).toBe(true);

    calls.length = 0;
    expect(rafCallback).toBeTruthy();
    rafCallback?.(16);
    expect(calls.filter((call) => call.method === 'fillText')).toHaveLength(12);
  });

  it('skips data drawing without chroma data and cleans up listeners on unmount', () => {
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    const wrapper = mount(ChromaVisualizer, {
      props: {
        chromaData: null,
        currentTime: 0,
        duration: 0,
      },
    });

    expect(calls.filter((call) => call.method === 'fillRect')).toHaveLength(0);

    wrapper.unmount();
    expect(cancelAnimationFrame).toHaveBeenCalledWith(11);
    expect(removeSpy).toHaveBeenCalledWith('resize', expect.any(Function));
    removeSpy.mockRestore();
  });
});
