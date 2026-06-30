import { prepareCanvas2D } from '@/components/demos/canvas';

export interface StudioStemView {
  min: Float32Array;
  max: Float32Array;
}

export function drawStudioWaveforms(
  canvases: Array<HTMLCanvasElement | null>,
  views: StudioStemView[],
) {
  for (let i = 0; i < views.length; i++) {
    const canvas = canvases[i];
    const view = views[i];
    if (!canvas || !view) continue;

    const prepared = prepareCanvas2D(canvas, { fallbackWidth: 240, fallbackHeight: 30 });
    if (!prepared) continue;

    const { ctx, width, height } = prepared;
    ctx.clearRect(0, 0, width, height);
    const style = getComputedStyle(canvas);
    ctx.fillStyle = style.color;

    const mid = height / 2;
    const buckets = view.min.length;
    const bucketWidth = width / buckets;
    for (let b = 0; b < buckets; b++) {
      const top = mid - view.max[b] * mid * 2.4;
      const bottom = mid - view.min[b] * mid * 2.4;
      ctx.fillRect(
        b * bucketWidth,
        Math.min(top, mid - 0.5),
        Math.max(0.5, bucketWidth - 0.5),
        Math.max(1, bottom - top),
      );
    }
  }
}
