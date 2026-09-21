import { onBeforeUnmount, onMounted, type Ref, watch } from 'vue';

/**
 * Redraw a demo canvas whenever its box changes size.
 *
 * Archetypes draw once, in response to activation or a parameter change, and
 * `prepareCanvas2D` bails out (returning `null`) when the canvas has no layout
 * box yet. Without this, two things go wrong and neither ever recovers:
 *
 * - a demo that becomes active while its box is still zero-sized — inside a
 *   `<details>` that has just been opened, or during a layout shift — skips its
 *   only draw and stays an empty black screen for good;
 * - resizing the window leaves the old bitmap stretched or squashed into the new
 *   box, because the backing store is only ever sized during a draw.
 *
 * Observing the canvas fixes both: the first non-zero box triggers the draw that
 * was skipped, and every later resize re-renders at the new resolution.
 */
export function useCanvasRedraw(canvas: Ref<HTMLCanvasElement | null>, redraw: () => void): void {
  let observer: ResizeObserver | null = null;
  let lastWidth = 0;
  let lastHeight = 0;
  let frame = 0;

  function schedule(): void {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      redraw();
    });
  }

  function observe(el: HTMLCanvasElement | null): void {
    observer?.disconnect();
    if (!el || typeof ResizeObserver === 'undefined') return;
    observer = new ResizeObserver(() => {
      const width = el.clientWidth;
      const height = el.clientHeight;
      if (width === 0 || height === 0) {
        // Losing the box drops whatever was drawn, so forget the last size:
        // coming back at the *same* size still has to trigger a repaint.
        lastWidth = 0;
        lastHeight = 0;
        return;
      }
      if (width === lastWidth && height === lastHeight) return;
      lastWidth = width;
      lastHeight = height;
      schedule();
    });
    observer.observe(el);
  }

  onMounted(() => observe(canvas.value));
  watch(canvas, (el) => observe(el));

  onBeforeUnmount(() => {
    observer?.disconnect();
    observer = null;
    if (frame) cancelAnimationFrame(frame);
  });
}
