import { type KeyboardLayout, keyCenterRatio, keyWidthRatio } from './keyboard';
import type { ParsedMidi } from './midiSmf';
import { HIT_RATIO, LOOKAHEAD_SEC, NOTE_WIDTH } from './rollConfig';

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export function noteLabel(midi: number): string {
  return `${NOTE_NAMES[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`;
}

export function sameSet(a: Set<number>, b: Set<number>): boolean {
  if (a.size !== b.size) return false;
  for (const value of a) if (!b.has(value)) return false;
  return true;
}

export function withAlpha(color: string, alpha: number): string {
  const c = color.trim();
  if (c.startsWith('#')) {
    const hex = c.slice(1);
    const full = hex.length === 3 ? hex.replace(/./g, (d) => d + d) : hex;
    const r = parseInt(full.slice(0, 2), 16);
    const g = parseInt(full.slice(2, 4), 16);
    const b = parseInt(full.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  if (c.startsWith('rgb')) {
    const nums = c.match(/[\d.]+/g) ?? [];
    return `rgba(${nums[0] ?? 0}, ${nums[1] ?? 0}, ${nums[2] ?? 0}, ${alpha})`;
  }
  return c;
}

export interface PracticeRollPaintOptions {
  canvas: HTMLCanvasElement | null;
  midi: ParsedMidi | null;
  layout: KeyboardLayout;
  keyByMidi: Map<number, KeyboardLayout['keys'][number]>;
  beatTimesSec: number[];
  barEveryBeats: number;
  posBase: number;
  activeNotes: Set<number>;
  reducedMotion: boolean;
  drawFx?: (posBase: number, activeNotes: Set<number>, isDark: boolean, animate: boolean) => void;
}

export function paintPracticeRoll(options: PracticeRollPaintOptions): void {
  const el = options.canvas;
  if (!el) return;
  const w = el.clientWidth;
  const h = el.clientHeight;
  if (w === 0 || h === 0) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  if (el.width !== Math.round(w * dpr) || el.height !== Math.round(h * dpr)) {
    el.width = Math.round(w * dpr);
    el.height = Math.round(h * dpr);
  }
  const ctx = el.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  const lay = options.layout;
  const whiteCount = lay.whiteCount;
  const span = Math.max(1, lay.highMidi - lay.lowMidi);
  const hitY = h * HIT_RATIO;
  const accent = cssVar(el, '--demo-accent', '#8b5cf6');
  const isDark =
    typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
  const yOf = (t: number): number => hitY * (1 - (t - options.posBase) / LOOKAHEAD_SEC);

  paintLaneBackground(ctx, lay, w, hitY, whiteCount, isDark);
  paintDepth(ctx, w, hitY, accent, isDark);
  paintBeatGrid(ctx, options.beatTimesSec, options.barEveryBeats, options.posBase, yOf, w, isDark);
  paintOctaveGrid(ctx, lay, whiteCount, w, hitY, isDark);
  paintNotes(ctx, options, yOf, w, hitY, span, whiteCount, isDark);
  paintStrikeLine(ctx, w, hitY, accent, isDark);

  options.drawFx?.(options.posBase, options.activeNotes, isDark, !options.reducedMotion);
}

function cssVar(canvas: HTMLCanvasElement, name: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  return getComputedStyle(canvas).getPropertyValue(name).trim() || fallback;
}

function noteHsl(pitchNorm: number, black: boolean, isDark: boolean, alpha: number): string {
  const hue = 262 - pitchNorm * 66;
  const sat = isDark ? 74 : 66;
  const light = (isDark ? 66 : 55) - (black ? 5 : 0);
  return `hsla(${hue}, ${sat}%, ${light}%, ${alpha})`;
}

function paintLaneBackground(
  ctx: CanvasRenderingContext2D,
  layout: KeyboardLayout,
  width: number,
  hitY: number,
  whiteCount: number,
  isDark: boolean,
): void {
  for (const key of layout.keys) {
    if (key.black) continue;
    if (Math.floor(key.midi / 12) % 2 === 0) {
      ctx.fillStyle = isDark ? 'rgba(139, 92, 246, 0.05)' : 'rgba(124, 58, 237, 0.04)';
      ctx.fillRect((key.whiteIndex / whiteCount) * width, 0, width / whiteCount, hitY);
    }
  }
}

function paintDepth(
  ctx: CanvasRenderingContext2D,
  width: number,
  hitY: number,
  accent: string,
  isDark: boolean,
): void {
  const depth = ctx.createLinearGradient(0, 0, 0, hitY);
  depth.addColorStop(0, isDark ? 'rgba(0, 0, 0, 0.34)' : 'rgba(40, 24, 90, 0.06)');
  depth.addColorStop(0.6, 'rgba(0, 0, 0, 0)');
  depth.addColorStop(1, withAlpha(accent, isDark ? 0.07 : 0.05));
  ctx.fillStyle = depth;
  ctx.fillRect(0, 0, width, hitY);
}

function paintBeatGrid(
  ctx: CanvasRenderingContext2D,
  beatTimesSec: number[],
  barEveryBeats: number,
  now: number,
  yOf: (time: number) => number,
  width: number,
  isDark: boolean,
): void {
  for (let beat = 0; beat < beatTimesSec.length; beat++) {
    const time = beatTimesSec[beat];
    if (time < now - 0.05 || time > now + LOOKAHEAD_SEC) continue;
    const y = yOf(time);
    const bar = beat % barEveryBeats === 0;
    ctx.strokeStyle = isDark
      ? `rgba(160, 132, 250, ${bar ? 0.16 : 0.06})`
      : `rgba(124, 58, 237, ${bar ? 0.14 : 0.05})`;
    ctx.lineWidth = bar ? 1.25 : 0.75;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
}

function paintOctaveGrid(
  ctx: CanvasRenderingContext2D,
  layout: KeyboardLayout,
  whiteCount: number,
  width: number,
  hitY: number,
  isDark: boolean,
): void {
  for (const key of layout.keys) {
    if (key.midi % 12 !== 0) continue;
    const x = keyCenterRatio(key, whiteCount) * width - width / whiteCount / 2;
    ctx.strokeStyle = isDark ? 'rgba(160, 132, 250, 0.14)' : 'rgba(124, 58, 237, 0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, hitY);
    ctx.stroke();
    ctx.fillStyle = isDark ? 'rgba(167, 139, 250, 0.5)' : 'rgba(124, 58, 237, 0.45)';
    ctx.font = '9px ui-monospace, "JetBrains Mono", monospace';
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    ctx.fillText(noteLabel(key.midi), x + 3, 4);
  }
}

function paintNotes(
  ctx: CanvasRenderingContext2D,
  options: PracticeRollPaintOptions,
  yOf: (time: number) => number,
  width: number,
  hitY: number,
  span: number,
  whiteCount: number,
  isDark: boolean,
): void {
  if (!options.midi) return;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, width, hitY);
  ctx.clip();
  for (const note of options.midi.notes) {
    if (note.endSec < options.posBase || note.startSec > options.posBase + LOOKAHEAD_SEC) continue;
    const laid = options.keyByMidi.get(note.midi);
    if (!laid) continue;
    const centerX = keyCenterRatio(laid, whiteCount) * width;
    const noteWidth = Math.max(3, keyWidthRatio(laid, whiteCount) * width * NOTE_WIDTH);
    const yBottom = yOf(note.startSec);
    const yTop = yOf(note.endSec);
    const top = Math.min(yBottom, yTop);
    const height = Math.max(5, yBottom - yTop);
    const striking = note.startSec <= options.posBase && options.posBase < note.endSec;
    const intensity = 0.62 + (note.velocity / 127) * 0.38;
    const appear = Math.min(
      1,
      (options.posBase + LOOKAHEAD_SEC - note.startSec) / (LOOKAHEAD_SEC * 0.14),
    );
    const pitchNorm = (note.midi - options.layout.lowMidi) / span;
    const x = centerX - noteWidth / 2;
    const radius = Math.min(5, noteWidth * 0.4);

    ctx.globalAlpha = appear;
    ctx.beginPath();
    if (height > radius * 2) ctx.roundRect(x, top, noteWidth, height, radius);
    else ctx.rect(x, top, noteWidth, height);
    const grad = ctx.createLinearGradient(0, top, 0, top + height);
    grad.addColorStop(0, noteHsl(pitchNorm, laid.black, isDark, intensity * 0.7));
    grad.addColorStop(1, noteHsl(pitchNorm, laid.black, isDark, intensity));
    ctx.fillStyle = grad;
    ctx.shadowColor = noteHsl(pitchNorm, laid.black, isDark, striking ? 0.95 : 0.45);
    ctx.shadowBlur = striking ? 20 : 9;
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.fillStyle = `rgba(255, 255, 255, ${laid.black ? 0.2 : 0.34})`;
    ctx.beginPath();
    ctx.roundRect(x + 1, top + 1, noteWidth - 2, Math.min(3, height), 1.5);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

function paintStrikeLine(
  ctx: CanvasRenderingContext2D,
  width: number,
  hitY: number,
  accent: string,
  isDark: boolean,
): void {
  const band = ctx.createLinearGradient(0, hitY - 16, 0, hitY);
  band.addColorStop(0, withAlpha(accent, 0));
  band.addColorStop(1, withAlpha(accent, isDark ? 0.16 : 0.1));
  ctx.fillStyle = band;
  ctx.fillRect(0, hitY - 16, width, 16);
  ctx.strokeStyle = withAlpha(accent, isDark ? 0.85 : 0.7);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, hitY);
  ctx.lineTo(width, hitY);
  ctx.stroke();
}
