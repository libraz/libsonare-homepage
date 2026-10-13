/**
 * Draws the source waveform above the piano roll on one time axis, so a note
 * can be read against the sound it came from.
 *
 * Geometry lives in {@link rollGeometry} so pointer hit-testing and painting
 * agree on where a note is. Colours come in as a palette resolved from the demo
 * tokens, which keeps the painter free of DOM access.
 */
import { KEY_GEOMETRY } from '@/components/keyboard/keyGeometry';
import type { NoteDiff, RollNote } from './transcribedNotes';

/** Min/max envelope at a fixed bin rate, so any zoom aggregates the same data. */
export interface WaveBins {
  binsPerSec: number;
  min: Float32Array;
  max: Float32Array;
}

export interface RollView {
  startSec: number;
  spanSec: number;
}

export interface RollPalette {
  text: string;
  muted: string;
  grid: string;
  gridMinor: string;
  wave: string;
  piano: string;
  kept: string;
  added: string;
  removed: string;
  playhead: string;
  whiteKey: string;
  blackKey: string;
  blackRow: string;
  scan: string;
}

export interface RollGeometry {
  gutter: number;
  width: number;
  waveTop: number;
  waveHeight: number;
  rulerTop: number;
  rollTop: number;
  rollHeight: number;
  low: number;
  high: number;
  rowHeight: number;
  view: RollView;
}

export const WAVE_BINS_PER_SEC = 400;
const GUTTER = 40;
const RULER = 20;

export function buildWaveBins(samples: Float32Array, sampleRate: number): WaveBins {
  const hop = sampleRate / WAVE_BINS_PER_SEC;
  const count = Math.max(1, Math.ceil(samples.length / hop));
  const min = new Float32Array(count);
  const max = new Float32Array(count);
  for (let bin = 0; bin < count; bin++) {
    const from = Math.floor(bin * hop);
    const to = Math.min(samples.length, Math.floor((bin + 1) * hop));
    let lo = 0;
    let hi = 0;
    for (let i = from; i < to; i++) {
      const value = samples[i];
      if (value < lo) lo = value;
      if (value > hi) hi = value;
    }
    min[bin] = lo;
    max[bin] = hi;
  }
  return { binsPerSec: WAVE_BINS_PER_SEC, min, max };
}

export function rollGeometry(
  width: number,
  height: number,
  view: RollView,
  span: { low: number; high: number },
): RollGeometry {
  const waveHeight = Math.round(Math.min(120, Math.max(64, height * 0.22)));
  const rulerTop = waveHeight;
  const rollTop = rulerTop + RULER;
  const rollHeight = Math.max(40, height - rollTop);
  const rows = span.high - span.low + 1;
  return {
    gutter: GUTTER,
    width,
    waveTop: 0,
    waveHeight,
    rulerTop,
    rollTop,
    rollHeight,
    low: span.low,
    high: span.high,
    rowHeight: rollHeight / rows,
    view,
  };
}

export function xOfSec(geo: RollGeometry, sec: number): number {
  return geo.gutter + ((sec - geo.view.startSec) / geo.view.spanSec) * (geo.width - geo.gutter);
}

export function secAtX(geo: RollGeometry, x: number): number {
  return geo.view.startSec + ((x - geo.gutter) / (geo.width - geo.gutter)) * geo.view.spanSec;
}

export function yOfPitch(geo: RollGeometry, pitch: number): number {
  return geo.rollTop + (geo.high - pitch) * geo.rowHeight;
}

/** The note under a point in the roll, or null. Short notes get a minimum hit width. */
export function noteAt<T extends RollNote>(
  geo: RollGeometry,
  notes: readonly T[],
  x: number,
  y: number,
): T | null {
  if (y < geo.rollTop || x < geo.gutter) return null;
  const pitch = geo.high - Math.floor((y - geo.rollTop) / geo.rowHeight);
  for (let i = notes.length - 1; i >= 0; i--) {
    const note = notes[i];
    if (note.pitch !== pitch) continue;
    const x0 = xOfSec(geo, note.startSec);
    const x1 = Math.max(x0 + 4, xOfSec(geo, note.endSec));
    if (x >= x0 && x <= x1) return note;
  }
  return null;
}

const BLACK = new Set([1, 3, 6, 8, 10]);
/** Inset of the gutter keyboard from the canvas edge and from the roll. */
const KEY_INSET = 4;

export interface KeyRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * One key of the gutter keyboard, which lies on its side: a key's length runs
 * across the gutter and its width is the pitch row. Black keys take the shared
 * {@link KEY_GEOMETRY} ratios against a white key.
 */
export function gutterKeyRect(geo: RollGeometry, pitch: number, black: boolean): KeyRect {
  const y = yOfPitch(geo, pitch);
  const whiteLength = geo.gutter - 2 * KEY_INSET;
  if (!black) return { x: KEY_INSET, y: y + 0.5, w: whiteLength, h: geo.rowHeight - 1 };
  const length = whiteLength * KEY_GEOMETRY.blackLengthRatio;
  const width = geo.rowHeight * KEY_GEOMETRY.blackWidthRatio;
  return {
    x: KEY_INSET + whiteLength - length,
    y: y + (geo.rowHeight - width) / 2,
    w: length,
    h: width,
  };
}

/** Tick spacing that leaves at least `minPx` between labels. */
function tickStep(geo: RollGeometry, minPx: number): number {
  const pxPerSec = (geo.width - geo.gutter) / geo.view.spanSec;
  for (const step of [0.25, 0.5, 1, 2, 5, 10, 15, 30, 60]) {
    if (step * pxPerSec >= minPx) return step;
  }
  return 120;
}

/** `m:ss`, with hundredths only when the tick falls between seconds. */
export function formatTick(sec: number): string {
  const centis = Math.round(sec * 100);
  const m = Math.floor(centis / 6000);
  const rest = centis - m * 6000;
  const s = String(Math.floor(rest / 100)).padStart(2, '0');
  const frac = rest % 100;
  return frac === 0 ? `${m}:${s}` : `${m}:${s}.${String(frac).padStart(2, '0').replace(/0$/, '')}`;
}

/**
 * One envelope in the wave lane: `full` mirrors min and max about the centre,
 * `upper`/`lower` draw the peak on one side, so two signals can face each other.
 */
function drawEnvelope(
  ctx: CanvasRenderingContext2D,
  geo: RollGeometry,
  bins: WaveBins,
  side: 'full' | 'upper' | 'lower',
): void {
  const mid = geo.waveTop + geo.waveHeight / 2;
  const half = geo.waveHeight / 2 - 4;
  const left = geo.gutter;
  const columns = Math.max(1, Math.floor(geo.width - left));
  const binsPerPx = (geo.view.spanSec * bins.binsPerSec) / columns;
  const startBin = geo.view.startSec * bins.binsPerSec;
  const tops: number[] = [];
  const bottoms: number[] = [];
  for (let px = 0; px < columns; px++) {
    const from = Math.floor(startBin + px * binsPerPx);
    const to = Math.max(from + 1, Math.floor(startBin + (px + 1) * binsPerPx));
    let lo = 0;
    let hi = 0;
    for (let b = Math.max(0, from); b < Math.min(bins.min.length, to); b++) {
      if (bins.min[b] < lo) lo = bins.min[b];
      if (bins.max[b] > hi) hi = bins.max[b];
    }
    const peak = Math.min(1, Math.max(hi, -lo));
    if (side === 'full') {
      tops.push(mid - Math.min(1, hi) * half);
      bottoms.push(mid - Math.max(-1, lo) * half);
    } else {
      tops.push(side === 'upper' ? mid - peak * half : mid);
      bottoms.push(side === 'upper' ? mid : mid + peak * half);
    }
  }
  ctx.beginPath();
  ctx.moveTo(left, tops[0]);
  for (let px = 1; px < columns; px++) ctx.lineTo(left + px, tops[px]);
  for (let px = columns - 1; px >= 0; px--) ctx.lineTo(left + px, bottoms[px]);
  ctx.closePath();
  ctx.fill();
}

export interface RollPaintInput {
  ctx: CanvasRenderingContext2D;
  geo: RollGeometry;
  palette: RollPalette;
  wave: WaveBins | null;
  piano: WaveBins | null;
  diff: NoteDiff | null;
  playheadSec: number;
  hover: RollNote | null;
  /** Notes starting after this time are not drawn yet; null draws them all. */
  revealSec: number | null;
  /** Position of the analysis sweep as a share of the view, or null when idle. */
  scan: number | null;
}

export function paintRoll(input: RollPaintInput): void {
  const { ctx, geo, palette } = input;
  const right = geo.width;
  const rollBottom = geo.rollTop + geo.rollHeight;

  // Pitch rows: black-key rows shaded, a line under every C.
  for (let pitch = geo.low; pitch <= geo.high; pitch++) {
    const y = yOfPitch(geo, pitch);
    if (BLACK.has(pitch % 12)) {
      ctx.fillStyle = palette.blackRow;
      ctx.fillRect(geo.gutter, y, right - geo.gutter, geo.rowHeight);
    }
    if (pitch % 12 === 0) {
      ctx.fillStyle = palette.grid;
      ctx.fillRect(geo.gutter, y + geo.rowHeight - 0.5, right - geo.gutter, 1);
    }
  }

  // Time grid through both lanes, labelled on the ruler.
  const step = tickStep(geo, 72);
  const minor = step / 4;
  const first = Math.ceil(geo.view.startSec / minor) * minor;
  ctx.font = '10px var(--font-mono, ui-monospace, monospace)';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  for (let t = first; t <= geo.view.startSec + geo.view.spanSec + 1e-9; t += minor) {
    const x = Math.round(xOfSec(geo, t)) + 0.5;
    const major = Math.abs(t / step - Math.round(t / step)) < 1e-6;
    ctx.fillStyle = major ? palette.grid : palette.gridMinor;
    ctx.fillRect(x - 0.5, geo.waveTop, 1, geo.waveHeight);
    ctx.fillRect(x - 0.5, geo.rollTop, 1, geo.rollHeight);
    if (major) {
      ctx.fillRect(x - 0.5, geo.rulerTop + RULER - 6, 1, 6);
      ctx.fillStyle = palette.muted;
      ctx.fillText(formatTick(t), x + 4, geo.rulerTop + RULER / 2);
    }
  }
  ctx.fillStyle = palette.grid;
  ctx.fillRect(geo.gutter, geo.rulerTop, right - geo.gutter, 1);
  ctx.fillRect(geo.gutter, geo.rollTop - 0.5, right - geo.gutter, 1);

  // Waveform lane: the source alone, or the source above and the rendered
  // piano mirrored below it.
  if (input.wave) {
    ctx.fillStyle = palette.wave;
    drawEnvelope(ctx, geo, input.wave, input.piano ? 'upper' : 'full');
  }
  if (input.piano) {
    ctx.fillStyle = palette.piano;
    ctx.globalAlpha = 0.42;
    drawEnvelope(ctx, geo, input.piano, 'lower');
    ctx.globalAlpha = 1;
    ctx.fillStyle = palette.grid;
    ctx.fillRect(geo.gutter, Math.round(geo.waveTop + geo.waveHeight / 2), right - geo.gutter, 1);
  }

  // Notes. Removed ones are outlines only, so they read as absent.
  ctx.save();
  ctx.beginPath();
  ctx.rect(geo.gutter, geo.rollTop, right - geo.gutter, geo.rollHeight);
  ctx.clip();
  const viewEnd = geo.view.startSec + geo.view.spanSec;
  const h = Math.max(2, geo.rowHeight - 1);
  const inset = geo.rowHeight > 4 ? 0.5 : 0;
  const radius = geo.rowHeight >= 6 ? 1.5 : 0;
  const shown = (note: RollNote) =>
    note.endSec >= geo.view.startSec &&
    note.startSec <= viewEnd &&
    (input.revealSec === null || note.startSec <= input.revealSec);
  // A re-run in progress greys the result it is about to replace.
  const fade = input.scan === null ? 1 : 0.35;
  if (input.diff) {
    ctx.setLineDash([3, 2]);
    ctx.strokeStyle = palette.removed;
    ctx.fillStyle = palette.removed;
    ctx.lineWidth = 1.5;
    for (const note of input.diff.removed) {
      if (!shown(note)) continue;
      const x0 = xOfSec(geo, note.startSec);
      const x1 = Math.max(x0 + 5, xOfSec(geo, note.endSec));
      const y = yOfPitch(geo, note.pitch) + inset;
      ctx.globalAlpha = 0.16 * fade;
      ctx.fillRect(x0, y, x1 - x0, h);
      ctx.globalAlpha = fade;
      ctx.strokeRect(x0 + 0.75, y + 0.75, x1 - x0 - 1.5, h - 1.5);
    }
    ctx.globalAlpha = 1;
    ctx.setLineDash([]);
    for (const note of input.diff.current) {
      if (!shown(note)) continue;
      const x0 = xOfSec(geo, note.startSec);
      const x1 = Math.max(x0 + 3, xOfSec(geo, note.endSec));
      const y = yOfPitch(geo, note.pitch) + inset;
      ctx.globalAlpha = (0.45 + 0.55 * (note.velocity / 127)) * fade;
      ctx.fillStyle = note.change === 'added' ? palette.added : palette.kept;
      ctx.beginPath();
      ctx.roundRect(x0, y, x1 - x0, h, radius);
      ctx.fill();
      ctx.globalAlpha = 1;
      if (note === input.hover) {
        ctx.strokeStyle = palette.text;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(x0 - 0.75, y - 0.75, x1 - x0 + 1.5, h + 1.5);
      }
    }
  }
  ctx.restore();

  // Gutter: a keyboard down the roll and the lane captions. White runs under
  // every row; a black key sits on top of its row from the roll side.
  for (let pitch = geo.low; pitch <= geo.high; pitch++) {
    const y = yOfPitch(geo, pitch);
    const white = gutterKeyRect(geo, pitch, false);
    ctx.fillStyle = palette.whiteKey;
    ctx.fillRect(white.x, white.y, white.w, white.h);
    if (BLACK.has(pitch % 12)) {
      const black = gutterKeyRect(geo, pitch, true);
      ctx.fillStyle = palette.blackKey;
      ctx.fillRect(black.x, black.y, black.w, black.h);
    }
    if (pitch % 12 === 0 && geo.rowHeight * 12 >= 40) {
      ctx.fillStyle = palette.muted;
      ctx.textAlign = 'left';
      ctx.font = '9px var(--font-mono, ui-monospace, monospace)';
      ctx.fillText(`C${pitch / 12 - 1}`, 6, y + geo.rowHeight / 2);
    }
  }

  // Analysis sweep: a band trailing a bright edge across both lanes.
  if (input.scan !== null) {
    const x = geo.gutter + input.scan * (right - geo.gutter);
    const band = Math.min(160, (right - geo.gutter) * 0.18);
    const glow = ctx.createLinearGradient(x - band, 0, x, 0);
    glow.addColorStop(0, 'transparent');
    glow.addColorStop(1, palette.scan);
    ctx.save();
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = glow;
    ctx.fillRect(
      Math.max(geo.gutter, x - band),
      geo.waveTop,
      Math.min(band, x - geo.gutter),
      rollBottom - geo.waveTop,
    );
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = palette.scan;
    ctx.fillRect(x - 1, geo.waveTop, 2, rollBottom - geo.waveTop);
    ctx.restore();
  }

  // The edge of a result being drawn in.
  if (input.revealSec !== null && input.revealSec < viewEnd) {
    const x = xOfSec(geo, input.revealSec);
    if (x > geo.gutter) {
      ctx.fillStyle = palette.scan;
      ctx.globalAlpha = 0.8;
      ctx.fillRect(x - 1, geo.rollTop, 2, geo.rollHeight);
      ctx.globalAlpha = 1;
    }
  }

  // Playhead through both lanes.
  if (input.playheadSec >= geo.view.startSec && input.playheadSec <= viewEnd) {
    const x = Math.round(xOfSec(geo, input.playheadSec)) + 0.5;
    ctx.fillStyle = palette.playhead;
    ctx.fillRect(x - 0.75, geo.waveTop, 1.5, rollBottom - geo.waveTop);
  }
}
