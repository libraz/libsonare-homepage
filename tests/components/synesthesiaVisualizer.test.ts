import { mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SynesthesiaVisualizer from '@/components/SynesthesiaVisualizer.vue';

describe('SynesthesiaVisualizer', () => {
  let getContextSpy: ReturnType<typeof vi.spyOn>;
  let clientWidthSpy: ReturnType<typeof vi.spyOn>;
  let clientHeightSpy: ReturnType<typeof vi.spyOn>;
  let rafCallback: FrameRequestCallback | null;
  let ctx: Record<string, any>;
  let calls: Array<{
    method: string;
    args: unknown[];
    fillStyle?: unknown;
    strokeStyle?: unknown;
    lineWidth?: number;
  }>;

  beforeEach(() => {
    calls = [];
    rafCallback = null;
    ctx = {
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 0,
      lineCap: '',
      font: '',
      textAlign: '',
      textBaseline: '',
      globalAlpha: 1,
      globalCompositeOperation: 'source-over',
      filter: '',
      clearRect: vi.fn((...args: unknown[]) => calls.push({ method: 'clearRect', args })),
      fillRect: vi.fn(function (this: any, ...args: unknown[]) {
        calls.push({ method: 'fillRect', args, fillStyle: this.fillStyle });
      }),
      beginPath: vi.fn(() => calls.push({ method: 'beginPath', args: [] })),
      arc: vi.fn((...args: unknown[]) => calls.push({ method: 'arc', args })),
      moveTo: vi.fn((...args: unknown[]) => calls.push({ method: 'moveTo', args })),
      lineTo: vi.fn((...args: unknown[]) => calls.push({ method: 'lineTo', args })),
      stroke: vi.fn(function (this: any) {
        calls.push({
          method: 'stroke',
          args: [],
          strokeStyle: this.strokeStyle,
          lineWidth: this.lineWidth,
        });
      }),
      fill: vi.fn(function (this: any) {
        calls.push({ method: 'fill', args: [], fillStyle: this.fillStyle });
      }),
      fillText: vi.fn(function (this: any, ...args: unknown[]) {
        calls.push({ method: 'fillText', args, fillStyle: this.fillStyle });
      }),
      save: vi.fn(() => calls.push({ method: 'save', args: [] })),
      restore: vi.fn(() => calls.push({ method: 'restore', args: [] })),
      scale: vi.fn((...args: unknown[]) => calls.push({ method: 'scale', args })),
      createLinearGradient: vi.fn(() => ({
        addColorStop: vi.fn(),
      })),
      createRadialGradient: vi.fn(() => ({
        addColorStop: vi.fn(),
      })),
    };

    getContextSpy = vi
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockReturnValue(ctx as unknown as CanvasRenderingContext2D);
    clientWidthSpy = vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(520);
    clientHeightSpy = vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(584);
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn((callback: FrameRequestCallback) => {
        rafCallback = callback;
        return 1;
      }),
    );
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    vi.spyOn(Date, 'now').mockReturnValue(10_000);
    vi.spyOn(Math, 'random').mockReturnValue(0);
  });

  afterEach(() => {
    getContextSpy.mockRestore();
    clientWidthSpy.mockRestore();
    clientHeightSpy.mockRestore();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  function props(overrides: Partial<InstanceType<typeof SynesthesiaVisualizer>['$props']> = {}) {
    const features = new Float32Array(36);
    for (let frame = 0; frame < 3; frame++) {
      features[frame * 12] = 0.85;
      features[frame * 12 + 4] = 0.5;
      features[frame * 12 + 9] = 0.65;
    }
    return {
      chromaData: { features, nFrames: 3, nChroma: 12 },
      rmsData: new Float32Array([0.7, 0.8, 0.6]),
      bandData: {
        low: new Float32Array([0.8, 0.75, 0.7]),
        high: new Float32Array([0.65, 0.7, 0.6]),
      },
      currentTime: 1,
      duration: 3,
      isPlaying: true,
      ...overrides,
    };
  }

  it('sets up a square canvas and renders the active chroma scope', () => {
    const wrapper = mount(SynesthesiaVisualizer, { props: props() });

    expect(getContextSpy).toHaveBeenCalledWith('2d');
    expect(wrapper.find('canvas').element.width).toBe(520);
    expect(wrapper.find('canvas').element.height).toBe(520);
    expect(calls.some((call) => call.method === 'scale' && call.args[0] === 1)).toBe(true);
    expect(ctx.createRadialGradient).toHaveBeenCalled();
    expect(ctx.createLinearGradient).toHaveBeenCalled();
    expect(calls.filter((call) => call.method === 'fillText')).toHaveLength(12);
    expect(
      calls.some((call) => call.method === 'stroke' && typeof call.strokeStyle === 'object'),
    ).toBe(true);

    wrapper.unmount();
    expect(cancelAnimationFrame).toHaveBeenCalledWith(1);
  });

  it('renders the idle scope when playback has not started', () => {
    mount(SynesthesiaVisualizer, {
      props: props({ currentTime: 0, isPlaying: false }),
    });

    expect(ctx.createLinearGradient).not.toHaveBeenCalled();
    expect(calls.filter((call) => call.method === 'stroke' && call.lineWidth === 6)).toHaveLength(
      12,
    );
    expect(calls.some((call) => call.method === 'fillText')).toBe(false);
  });

  it('fully clears the canvas on the first frame after playback stops', async () => {
    const wrapper = mount(SynesthesiaVisualizer, { props: props() });
    calls.length = 0;

    await wrapper.setProps({ isPlaying: false });
    await Promise.resolve();
    expect(rafCallback).toBeTruthy();
    rafCallback?.(16);

    expect(calls.some((call) => call.method === 'clearRect')).toBe(true);
  });
});
