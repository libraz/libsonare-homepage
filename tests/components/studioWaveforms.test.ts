import { describe, expect, it, vi } from 'vitest';
import { drawStudioWaveforms } from '@/components/studio/studioWaveforms';

describe('studio waveform helpers', () => {
  it('draws min/max buckets into prepared canvases', () => {
    const canvas = document.createElement('canvas');
    Object.defineProperty(canvas, 'clientWidth', { configurable: true, value: 0 });
    Object.defineProperty(canvas, 'clientHeight', { configurable: true, value: 0 });
    const ctx = {
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      set fillStyle(_value: string) {},
      setTransform: vi.fn(),
    } as unknown as CanvasRenderingContext2D;
    vi.spyOn(canvas, 'getContext').mockReturnValue(ctx);
    vi.spyOn(window, 'getComputedStyle').mockReturnValue({ color: '#fff' } as CSSStyleDeclaration);

    drawStudioWaveforms(
      [canvas],
      [
        {
          min: new Float32Array([-0.2, -0.4]),
          max: new Float32Array([0.3, 0.5]),
        },
      ],
    );

    expect(canvas.width).toBe(240);
    expect(canvas.height).toBe(30);
    expect(ctx.setTransform).toHaveBeenCalled();
    expect(ctx.clearRect).toHaveBeenCalledWith(0, 0, 240, 30);
    expect(ctx.fillRect).toHaveBeenCalledTimes(2);
  });
});
