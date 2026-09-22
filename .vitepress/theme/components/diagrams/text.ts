/**
 * Text metrics and path helpers shared by the diagram components. Both lay
 * out during SSR, so widths are estimated from the string rather than
 * measured in the DOM; the box padding absorbs the error.
 */

/** Width of a string at a given size. CJK advances ~1em; Latin is averaged. */
export function estText(s: string, size: number, mono = false): number {
  let w = 0;
  for (const ch of s) {
    const cp = ch.codePointAt(0) ?? 0;
    if (cp > 0x2e7f) w += 1;
    else if (mono) w += 0.62;
    else if (/[A-Z0-9@#%&_-]/.test(ch)) w += 0.68;
    else if (/[ijl.,:;'"!|()[\] ]/.test(ch)) w += 0.34;
    else w += 0.56;
  }
  return w * size;
}

const OPENERS = '([{（［「『【';
const CLOSERS = ')]}）］」』】、。,.・/';

/**
 * How good a break between two characters is, lower being better; negative
 * rules it out. A space-less label still breaks at a bracket, at a change of
 * script, or between two CJK characters — never inside a Latin word.
 */
function breakRank(a: string, b: string): number {
  if (CLOSERS.includes(b)) return -1;
  if (OPENERS.includes(b) || CLOSERS.includes(a)) return 0;
  const cjkA = (a.codePointAt(0) ?? 0) > 0x2e7f;
  const cjkB = (b.codePointAt(0) ?? 0) > 0x2e7f;
  if (cjkA !== cjkB) return 1;
  return cjkA ? 2 : -1;
}

/**
 * Break a label too wide for one line into two balanced lines: at the space
 * nearest its middle, or at the best character boundary when it has none.
 */
export function wrapLabel(s: string, limit: number, size: number, mono = false): string[] {
  if (estText(s, size, mono) <= limit) return [s];
  const parts = s.split(' ');
  if (parts.length < 2) {
    const chars = [...s];
    let best = -1;
    let bestCost = Number.POSITIVE_INFINITY;
    for (let i = 1; i < chars.length; i++) {
      const rank = breakRank(chars[i - 1], chars[i]);
      if (rank < 0) continue;
      const cost =
        rank * 1000 +
        Math.abs(
          estText(chars.slice(0, i).join(''), size, mono) -
            estText(chars.slice(i).join(''), size, mono),
        );
      if (cost < bestCost) {
        bestCost = cost;
        best = i;
      }
    }
    if (best < 0) return [s];
    return [chars.slice(0, best).join(''), chars.slice(best).join('')];
  }
  let best = 1;
  let bestDiff = Number.POSITIVE_INFINITY;
  for (let i = 1; i < parts.length; i++) {
    const diff = Math.abs(
      estText(parts.slice(0, i).join(' '), size, mono) -
        estText(parts.slice(i).join(' '), size, mono),
    );
    if (diff < bestDiff) {
      bestDiff = diff;
      best = i;
    }
  }
  return [parts.slice(0, best).join(' '), parts.slice(best).join(' ')];
}

const r2 = (v: number) => Math.round(v * 100) / 100;

/** Polyline through the given points with every corner rounded to radius r. */
export function roundedPath(pts: [number, number][], r: number): string {
  const p: [number, number][] = [];
  for (const q of pts) {
    const prev = p[p.length - 1];
    if (!prev || Math.abs(prev[0] - q[0]) > 0.5 || Math.abs(prev[1] - q[1]) > 0.5) p.push(q);
  }
  if (p.length < 2) return '';
  let d = `M ${r2(p[0][0])} ${r2(p[0][1])}`;
  for (let i = 1; i < p.length - 1; i++) {
    const [px, py] = p[i - 1];
    const [cx, cy] = p[i];
    const [nx, ny] = p[i + 1];
    const dIn = Math.hypot(cx - px, cy - py);
    const dOut = Math.hypot(nx - cx, ny - cy);
    const rr = Math.min(r, dIn / 2, dOut / 2);
    d +=
      ` L ${r2(cx + ((px - cx) / dIn) * rr)} ${r2(cy + ((py - cy) / dIn) * rr)}` +
      ` Q ${r2(cx)} ${r2(cy)}, ${r2(cx + ((nx - cx) / dOut) * rr)} ${r2(cy + ((ny - cy) / dOut) * rr)}`;
  }
  const end = p[p.length - 1];
  return `${d} L ${r2(end[0])} ${r2(end[1])}`;
}
