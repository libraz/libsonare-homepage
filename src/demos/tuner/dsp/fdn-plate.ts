/**
 * Dense inharmonic plate resonator (Jot & Chaigne feedback delay network) for
 * the percussion voice — faithful port of libsonare's
 * `src/midi/synth/fdn_plate.h`.
 *
 * A modal bank spends one resonator per partial, so a few modes can only put
 * energy in a few places and more gain makes them louder rather than the field
 * denser — it reads as a tuned bar however it is voiced. An FDN buys the
 * density for the cost of its delay lines instead: N lines closed through a
 * lossless Householder matrix resonate at one pole per delay sample, so eight
 * lines of a few hundred samples put thousands of partials in the band for
 * eight multiply-accumulates. The lengths are prime, so no two share a period
 * and the partials land inharmonically. Decay follows Jot — a per-line gain
 * sets the low-frequency T60 independently of that line's length, and a
 * one-pole loss in each loop gives the top of the band its own.
 */

const TWO_PI = 2 * Math.PI;

/**
 * Delay lines in the network. Eight is the smallest count whose Householder
 * mixing reaches full echo density within one pass of the shortest line;
 * fewer leaves an audible flutter at the loop period.
 */
export const FDN_LINES = 8;

/**
 * Longest delay line, in samples. It sets the lowest partial the network can
 * place and, summed over the lines, the ceiling on how many partials it holds.
 */
export const FDN_MAX_DELAY = 1024;

/**
 * The smallest prime at least `n`, for the delay-line lengths. Prime lengths
 * are what keep the lines from sharing a period: two lines whose lengths have
 * a common factor place partials on top of each other, which spends taps
 * without buying density.
 */
function nextPrimeAtLeast(n: number): number {
  if (n <= 2) return 2;
  for (let c = n | 1; ; c += 2) {
    let prime = true;
    for (let d = 3; d * d <= c; d += 2) {
      if (c % d === 0) {
        prime = false;
        break;
      }
    }
    if (prime) return c;
  }
}

/**
 * The base line is the period of the lowest partial; the rest fan out above it
 * on incommensurate multiples, so the network's poles interleave instead of
 * clustering.
 */
const SPREAD = [1.0, 1.055, 1.11, 1.17, 1.23, 1.3, 1.37, 1.45];

// Orthogonal sign patterns: the excitation enters on one and the pickup reads
// on the other, so what leaves the network is not a copy of what entered it.
const INPUT_SIGN = [1, -1, 1, -1, 1, -1, 1, -1];
const OUTPUT_SIGN = [1, 1, -1, -1, 1, 1, -1, -1];

export class FdnPlate {
  private readonly lines: Float32Array[] = Array.from(
    { length: FDN_LINES },
    () => new Float32Array(FDN_MAX_DELAY),
  );
  private readonly len = new Int32Array(FDN_LINES);
  private readonly pos = new Int32Array(FDN_LINES);
  private readonly gain = new Float64Array(FDN_LINES);
  private readonly damp = new Float64Array(FDN_LINES);
  private readonly lp = new Float64Array(FDN_LINES);
  private readonly tap = new Float64Array(FDN_LINES);
  private airA = 0;
  private air1 = 0;
  private air2 = 0;
  private loA = 0;
  private lo1 = 0;
  private lo2 = 0;
  private bound = false;
  private isActive = false;

  /**
   * Configures the network. `lowHz` is the lowest partial (it scales every
   * line), `t60S` the reverberation time at the bottom of the band,
   * `hfRatio` the reverberation time at Nyquist as a fraction of it (1 leaves
   * the top of the band undamped), and `airHz` the top of the band the plate
   * responds in at all (0 = up to Nyquist). A `t60S` at or below zero leaves
   * the plate inactive.
   */
  start(sampleRate: number, lowHz: number, t60S: number, hfRatio: number, airHz: number): void {
    const sr = sampleRate > 0 ? sampleRate : 48000;
    this.isActive = t60S > 0;
    if (!this.isActive) {
      this.pos.fill(0);
      return;
    }
    const t60Dc = Math.max(0.01, t60S);
    const hf = clamp(hfRatio, 0.01, 1);
    const t60Hf = t60Dc * hf;

    // Band bounds on the excitation rather than on the output: the two are the
    // same signal through a linear network, and bounding what goes in means the
    // poles outside the band are never rung in the first place. Each is two
    // cascaded one-poles, because one leaves a 6 dB/octave skirt that is most
    // of what there was to remove. The floor is not optional: a delay line of
    // length L is a comb whose first peak is at DC, so an unbounded network
    // answers a broadband strike with a burst of sub-audio that decays over the
    // whole t60, where a plate radiates nothing at all.
    this.loA = 1 - Math.exp((-TWO_PI * Math.min(lowHz, 0.45 * sr)) / sr);
    this.lo1 = 0;
    this.lo2 = 0;
    this.bound = airHz > 0;
    if (this.bound) {
      const f = Math.min(airHz, 0.45 * sr);
      this.airA = 1 - Math.exp((-TWO_PI * f) / sr);
      this.air1 = 0;
      this.air2 = 0;
    }

    // The whole fan is scaled to fit rather than each line being clipped to the
    // array: clipping collapses every line that overruns onto the same length,
    // and lines of equal length are one comb repeated, which is a ringing tube
    // and not a plate. Scaling loses the requested pitch and keeps the network.
    //
    // The prime search steps up from each length, so the fan stops short of the
    // array end by more than any prime gap below FDN_MAX_DELAY.
    const headroom = (FDN_MAX_DELAY - 32) / SPREAD[FDN_LINES - 1];
    const base = Math.min(sr / Math.max(20, lowHz), headroom);
    for (let i = 0; i < FDN_LINES; ++i) {
      const want = clampInt(Math.trunc(base * SPREAD[i]), 8, FDN_MAX_DELAY - 32);
      const len = Math.min(nextPrimeAtLeast(want), FDN_MAX_DELAY);
      this.len[i] = len;

      // Jot: the round-trip gain that reaches t60 after len samples, so every
      // line decays at the same rate however long it is.
      const exponent = (-3 * len) / sr;
      this.gain[i] = 10 ** (exponent / t60Dc);
      // The loop loss needed at Nyquist for the top of the band to reach its
      // own (shorter) t60, realized as a one-pole whose Nyquist magnitude is
      // (1 - a) / (1 + a).
      const nyquistGain = Math.min(1, 10 ** (exponent / t60Hf) / Math.max(1e-12, this.gain[i]));
      this.damp[i] = (1 - nyquistGain) / (1 + nyquistGain);
      this.lp[i] = 0;

      // Each line is its own ring, so only the samples it uses need clearing —
      // a strike does not inherit the previous one's tail, and the note-on cost
      // follows the tuning rather than the array size.
      this.lines[i].fill(0, 0, len);
      this.pos[i] = 0;
    }
  }

  /** Feeds one sample of excitation in and returns one sample of plate. */
  process(input: number): number {
    if (!this.isActive) return 0;
    this.lo1 += (input - this.lo1) * this.loA;
    let x = input - this.lo1;
    this.lo2 += (x - this.lo2) * this.loA;
    x -= this.lo2;
    if (this.bound) {
      this.air1 += (x - this.air1) * this.airA;
      this.air2 += (this.air1 - this.air2) * this.airA;
      x = this.air2;
    }

    // In a ring of len samples the value sitting at the write position is the
    // one written len samples ago, so reading before writing is the delay.
    let sum = 0;
    for (let i = 0; i < FDN_LINES; ++i) {
      this.tap[i] = this.lines[i][this.pos[i]];
      sum += this.tap[i];
    }

    // Householder mixing, H = I - (2/N) * 1 * 1^T. Orthogonal, so the matrix
    // itself is lossless and every decay in the network comes from the per-line
    // gain and loss below it rather than from the mixing.
    const shared = sum * (2 / FDN_LINES);
    let out = 0;
    for (let i = 0; i < FDN_LINES; ++i) {
      let v = (this.tap[i] - shared) * this.gain[i];
      this.lp[i] = v * (1 - this.damp[i]) + this.lp[i] * this.damp[i];
      v = this.lp[i];
      this.lines[i][this.pos[i]] = v + x * INPUT_SIGN[i];
      if (++this.pos[i] >= this.len[i]) this.pos[i] = 0;
      out += this.tap[i] * OUTPUT_SIGN[i];
    }
    return out * (1 / Math.sqrt(FDN_LINES));
  }

  reset(): void {
    this.isActive = false;
    this.bound = false;
    this.air1 = 0;
    this.air2 = 0;
    this.lo1 = 0;
    this.lo2 = 0;
    this.pos.fill(0);
    this.lp.fill(0);
  }

  active(): boolean {
    return this.isActive;
  }
}

function clamp(x: number, lo: number, hi: number): number {
  return x < lo ? lo : x > hi ? hi : x;
}

function clampInt(x: number, lo: number, hi: number): number {
  return x < lo ? lo : x > hi ? hi : x;
}
