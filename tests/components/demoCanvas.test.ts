import { describe, expect, it, vi } from 'vitest';
import { prepareCanvas2D } from '@/components/demos/canvas';

function sizeCanvas(canvas: HTMLCanvasElement, width: number, height: number): void {
  Object.defineProperty(canvas, 'clientWidth', { configurable: true, value: width });
  Object.defineProperty(canvas, 'clientHeight', { configurable: true, value: height });
}

describe('demo canvas helpers', () => {
  it('returns null when the canvas is missing or has no layout size', () => {
    expect(prepareCanvas2D(null)).toBeNull();

    const canvas = document.createElement('canvas');
    sizeCanvas(canvas, 0, 120);

    expect(prepareCanvas2D(canvas)).toBeNull();
  });

  it('sizes backing pixels by DPR and resets the 2D context transform', () => {
    vi.stubGlobal('devicePixelRatio', 3);
    const canvas = document.createElement('canvas');
    const ctx = {
      clearRect: vi.fn(),
      setTransform: vi.fn(),
    } as unknown as CanvasRenderingContext2D;
    sizeCanvas(canvas, 200, 80);
    vi.spyOn(canvas, 'getContext').mockReturnValue(ctx);

    const frame = prepareCanvas2D(canvas);

    expect(frame?.width).toBe(200);
    expect(frame?.height).toBe(80);
    expect(frame?.dpr).toBe(2);
    expect(canvas.width).toBe(400);
    expect(canvas.height).toBe(160);
    expect(ctx.setTransform).toHaveBeenCalledWith(2, 0, 0, 2, 0, 0);
    expect(ctx.clearRect).toHaveBeenCalledWith(0, 0, 200, 80);

    vi.unstubAllGlobals();
  });

  it('uses fallback dimensions when requested before layout settles', () => {
    const canvas = document.createElement('canvas');
    const ctx = {
      clearRect: vi.fn(),
      setTransform: vi.fn(),
    } as unknown as CanvasRenderingContext2D;
    sizeCanvas(canvas, 0, 0);
    vi.spyOn(canvas, 'getContext').mockReturnValue(ctx);

    const frame = prepareCanvas2D(canvas, { fallbackWidth: 240, fallbackHeight: 30 });

    expect(frame?.width).toBe(240);
    expect(frame?.height).toBe(30);
    expect(canvas.width).toBe(240);
    expect(canvas.height).toBe(30);
  });
});
