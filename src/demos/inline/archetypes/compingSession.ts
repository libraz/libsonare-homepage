/**
 * Pure timeline and audio assembly helpers for the comping demo.
 *
 * The three shipped takes are musical phrases, so the edit points follow the
 * phrase's eighth-note pairs (0, 0.5, 1.0, and 1.5 seconds) instead of dividing
 * the file into four equal pieces. The last interval owns the release tail.
 */

export const COMP_SEGMENT_START_SECONDS = [0, 0.5, 1, 1.5] as const;
export const COMP_SEGMENT_COUNT = COMP_SEGMENT_START_SECONDS.length;

export type CompingTake = 'a' | 'b' | 'c';
export type CompingTakes = Readonly<Record<CompingTake, Float32Array>>;

/** Return sample-frame edges for the phrase-aligned comp segments. */
export function compSegmentBoundaries(frameCount: number, sampleRate: number): number[] {
  if (!Number.isFinite(frameCount) || frameCount < 0) {
    throw new RangeError(`frameCount must be a non-negative finite number: ${frameCount}`);
  }
  if (!Number.isFinite(sampleRate) || sampleRate <= 0) {
    throw new RangeError(`sampleRate must be positive and finite: ${sampleRate}`);
  }

  const frames = Math.floor(frameCount);
  const edges = COMP_SEGMENT_START_SECONDS.map((seconds) =>
    Math.min(frames, Math.max(0, Math.round(seconds * sampleRate))),
  );
  edges.push(frames);

  // Very short clips can end before a musical edit point. Keep the edges
  // monotonic so the assembler remains safe for those inputs as well.
  for (let i = 1; i < edges.length; i++) {
    edges[i] = Math.max(edges[i], edges[i - 1]);
  }
  return edges;
}

/** Locate the segment containing a sample frame. */
export function compSegmentAtFrame(frame: number, edges: readonly number[]): number {
  if (edges.length < 2) return 0;
  const clamped = Math.max(edges[0], Math.min(edges[edges.length - 1] - 1, frame));
  for (let segment = 1; segment < edges.length - 1; segment++) {
    if (clamped < edges[segment]) return segment - 1;
  }
  return edges.length - 2;
}

/**
 * Assemble selected take regions into a fresh mono buffer.
 *
 * Inputs are read only. A short linear crossfade joins different takes. These
 * generated takes share note timing and phase, so equal-power weights would
 * amplify a correlated pair at the edit point. All takes are clipped to the
 * shortest input duration.
 */
export function assembleComp(
  takes: CompingTakes,
  selection: readonly CompingTake[],
  sampleRate: number,
  crossfadeMs = 8,
): Float32Array {
  if (selection.length !== COMP_SEGMENT_COUNT) {
    throw new RangeError(
      `selection must contain ${COMP_SEGMENT_COUNT} segments: ${selection.length}`,
    );
  }
  if (!Number.isFinite(crossfadeMs) || crossfadeMs < 0) {
    throw new RangeError(`crossfadeMs must be a non-negative finite number: ${crossfadeMs}`);
  }

  const frameCount = Math.min(takes.a.length, takes.b.length, takes.c.length);
  const edges = compSegmentBoundaries(frameCount, sampleRate);
  const output = new Float32Array(frameCount);

  for (let segment = 0; segment < COMP_SEGMENT_COUNT; segment++) {
    const source = takes[selection[segment]];
    for (let frame = edges[segment]; frame < edges[segment + 1]; frame++) {
      output[frame] = source[frame];
    }
  }

  const crossfadeFrames = Math.round((sampleRate * crossfadeMs) / 1000);
  for (let segment = 1; segment < COMP_SEGMENT_COUNT; segment++) {
    if (selection[segment] === selection[segment - 1] || crossfadeFrames === 0) continue;

    const edge = edges[segment];
    const left = Math.max(edges[segment - 1], edge - crossfadeFrames);
    const right = Math.min(edges[segment + 1], edge + crossfadeFrames, frameCount);
    const span = Math.max(1, right - left - 1);
    const previous = takes[selection[segment - 1]];
    const next = takes[selection[segment]];

    for (let frame = left; frame < right; frame++) {
      const t = (frame - left) / span;
      output[frame] = previous[frame] * (1 - t) + next[frame] * t;
    }
  }

  return output;
}
