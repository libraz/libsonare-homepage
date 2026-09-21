export interface Canvas2DFrame {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  dpr: number;
}

export interface Canvas2DOptions {
  maxDpr?: number;
  fallbackWidth?: number;
  fallbackHeight?: number;
}

/**
 * Prepare a canvas for crisp CSS-pixel drawing. Returns null while layout has no
 * size or the 2D context is unavailable, unless fallback dimensions are supplied.
 */
export function prepareCanvas2D(
  canvas: HTMLCanvasElement | null,
  options: number | Canvas2DOptions = 2,
): Canvas2DFrame | null {
  if (!canvas) return null;
  const config = typeof options === 'number' ? { maxDpr: options } : options;
  const width = canvas.clientWidth || config.fallbackWidth || 0;
  const height = canvas.clientHeight || config.fallbackHeight || 0;
  if (width === 0 || height === 0) return null;

  const dpr = Math.min(config.maxDpr ?? 2, window.devicePixelRatio || 1);
  const pixelWidth = Math.round(width * dpr);
  const pixelHeight = Math.round(height * dpr);
  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
  }

  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);
  return { ctx, width, height, dpr };
}
