/**
 * Stiff-string dispersion helpers for waveguide loops, ported from libsonare's
 * `src/rt/dispersion.h`.
 *
 * A stiff string stretches its partials sharp to the inharmonic law
 * f_n = n*f0*sqrt(1 + B*n^2). A cascade of first-order allpasses inside the loop
 * makes high frequencies travel faster and realizes that stretch. These helpers
 * solve the per-stage allpass coefficient from the inharmonicity coefficient B
 * and report the exact phase delays that keep the loop's tuning accurate. Used
 * by the piano string core and reused by Karplus-Strong for steel-string
 * inharmonicity.
 */

export const DISP_PI = Math.PI;
export const DISP_TWO_PI = 2 * Math.PI;

/**
 * Exact phase delay (samples) of the first-order allpass
 * H(z) = (a + z^-1)/(1 + a z^-1) at normalized frequency `w`.
 */
export function allpassPhaseDelay(a: number, w: number): number {
  const sinw = Math.sin(w);
  const cosw = Math.cos(w);
  const phi = Math.atan2(-sinw, a + cosw) - Math.atan2(-a * sinw, 1 + a * cosw);
  return -phi / Math.max(w, 1e-6);
}

/**
 * Phase delay (samples) of the one-pole loop lowpass y = (1-a)x + a*y^-1 at
 * normalized frequency `w`.
 */
export function onepolePhaseDelay(a: number, w: number): number {
  return Math.atan2(a * Math.sin(w), 1 - a * Math.cos(w)) / Math.max(w, 1e-6);
}

/**
 * First-order allpass coefficient a (<= 0) for a cascade of `stages` that
 * disperses the waveguide loop into the stiff-string law. Solved by bisection
 * against the stiff-string phase-delay differential, then clamped so the
 * per-stage delay still fits the loop budget. Endpoint-matched after Rauhala &
 * Valimaki (2006).
 */
export function dispersionAllpassA(
  bCoeff: number,
  w0: number,
  lpA: number,
  stages: number,
  phaseBudget: number,
): number {
  if (bCoeff <= 0 || stages <= 0) return 0;
  const nMax = (0.8 * DISP_PI) / Math.max(w0, 1e-6);
  let nRef = Math.min(12, Math.max(2, Math.trunc(nMax)));
  while (nRef > 2 && w0 * nRef * Math.sqrt(1 + bCoeff * nRef * nRef) >= 0.9 * DISP_PI) {
    --nRef;
  }
  const fr = nRef;
  const w1 = w0 * Math.sqrt(1 + bCoeff);
  const wr = w0 * fr * Math.sqrt(1 + bCoeff * fr * fr);
  if (wr >= 0.97 * DISP_PI) return 0;
  const period = DISP_TWO_PI / w0;
  const totalDiff = period * (1 / Math.sqrt(1 + bCoeff) - 1 / Math.sqrt(1 + bCoeff * fr * fr));
  const lpDiff = onepolePhaseDelay(lpA, w1) - onepolePhaseDelay(lpA, wr);
  const need = (totalDiff - lpDiff) / stages;
  if (need <= 0) return 0;

  // p_ap(w1;a) - p_ap(wr;a) increases monotonically as a -> -1.
  let lo = -0.999;
  let hi = 0;
  for (let it = 0; it < 40; ++it) {
    const a = 0.5 * (lo + hi);
    const diff = allpassPhaseDelay(a, w1) - allpassPhaseDelay(a, wr);
    if (diff > need) lo = a;
    else hi = a;
  }
  let a = 0.5 * (lo + hi);

  // Clamp so the per-stage phase delay at the fundamental fits the loop budget.
  const maxPap = phaseBudget / stages;
  if (maxPap > 1 && allpassPhaseDelay(a, w1) > maxPap) {
    let blo = a;
    let bhi = 0;
    for (let it = 0; it < 30; ++it) {
      const c = 0.5 * (blo + bhi);
      if (allpassPhaseDelay(c, w1) > maxPap) blo = c;
      else bhi = c;
    }
    a = bhi;
  }
  return a;
}

/**
 * First-order allpass H(z) = (a + z^-1)/(1 + a z^-1), the per-stage dispersion
 * unit used inside string loops: `y = a*x + state; state = x - a*y`.
 */
export class AllpassStage {
  private state = 0;
  a = 0;

  reset(): void {
    this.state = 0;
  }

  process(x: number): number {
    const y = this.a * x + this.state;
    this.state = x - this.a * y;
    return y;
  }
}
