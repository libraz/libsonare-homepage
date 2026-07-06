/**
 * Shared 3rd-order Lagrange fractional-sample delay line.
 *
 * Faithful TypeScript port of libsonare's `src/rt/fractional_delay.h`. The delay
 * is expressed in Q8.8 fixed-point samples (256 == one sample). For the normal
 * case (integer part `base >= 1`) a CENTRED stencil {base-1, base, base+1,
 * base+2} is used — the most accurate 4-point Lagrange. The degenerate
 * sub-sample case (`base == 0`) falls back to the strictly causal stencil
 * {0, 1, 2, 3} so no future/clamped tap corrupts the interpolation.
 *
 * The reference core computes in 32-bit `float`; this port uses JavaScript
 * doubles throughout. Bit-exactness is not the contract — the parity harness
 * validates the port against the WASM core within a spectral/RMS tolerance.
 */
export class DelayLine {
  private readonly buf: Float32Array;
  /** Circular span actually in use (<= buffer capacity), matching `size_`. */
  private active: number;
  private write = 0;

  /**
   * @param capacity Buffer capacity in samples (must be > 0). The active span
   *   defaults to the full capacity and can be narrowed per note with `prime`.
   */
  constructor(capacity: number) {
    this.buf = new Float32Array(Math.max(1, capacity | 0));
    this.active = this.buf.length;
  }

  /** Buffer capacity in samples. */
  get capacity(): number {
    return this.buf.length;
  }

  /** Active circular span in samples. */
  get size(): number {
    return this.active;
  }

  /** Clear the whole buffer and reset the write head. */
  reset(): void {
    this.buf.fill(0);
    this.write = 0;
    this.active = this.buf.length;
  }

  /**
   * Set the active circular span for a note and zero it, mirroring the C++
   * cores that carve a used span (`size_`) out of a larger allocated slab.
   */
  prime(size: number): void {
    this.active = Math.max(1, Math.min(this.buf.length, size | 0));
    this.buf.fill(0, 0, this.active);
    this.write = 0;
  }

  /** Circular read at an integer sample delay (>= 0), matching the C++ helper. */
  private sampleAtDelay(delay: number): number {
    const size = this.active;
    const d = delay > 0 ? delay : 0;
    const index = (this.write + size - (d % size)) % size;
    return this.buf[index];
  }

  private static coeffs(mu: number, base: number): [number, number, number, number] {
    if (base >= 1) {
      // Centred stencil over delays {base-1, base, base+1, base+2}.
      return [
        (-mu * (mu - 1) * (mu - 2)) / 6,
        ((mu + 1) * (mu - 1) * (mu - 2)) / 2,
        (-(mu + 1) * mu * (mu - 2)) / 2,
        ((mu + 1) * mu * (mu - 1)) / 6,
      ];
    }
    // Sub-sample causal stencil over delays {0, 1, 2, 3}.
    return [
      (-(mu - 1) * (mu - 2) * (mu - 3)) / 6,
      (mu * (mu - 2) * (mu - 3)) / 2,
      (-mu * (mu - 1) * (mu - 3)) / 2,
      (mu * (mu - 1) * (mu - 2)) / 6,
    ];
  }

  /**
   * Push `input` into the buffer and read back a fractionally delayed sample,
   * advancing the write head by one.
   *
   * @param delaySamplesQ8 Requested delay in Q8.8 samples (negatives clamp to 0).
   * @param input New input sample to push into the buffer.
   * @returns The fractionally delayed output sample.
   */
  processFractional(delaySamplesQ8: number, input: number): number {
    this.buf[this.write] = input;
    const delay = (delaySamplesQ8 > 0 ? delaySamplesQ8 : 0) / 256;
    const base = Math.floor(delay);
    const mu = delay - base;

    let y0: number;
    let y1: number;
    let y2: number;
    let y3: number;
    if (base >= 1) {
      y0 = this.sampleAtDelay(base - 1);
      y1 = this.sampleAtDelay(base);
      y2 = this.sampleAtDelay(base + 1);
      y3 = this.sampleAtDelay(base + 2);
    } else {
      y0 = this.sampleAtDelay(0);
      y1 = this.sampleAtDelay(1);
      y2 = this.sampleAtDelay(2);
      y3 = this.sampleAtDelay(3);
    }
    const [c0, c1, c2, c3] = DelayLine.coeffs(mu, base);

    this.write = (this.write + 1) % this.active;
    return c0 * y0 + c1 * y1 + c2 * y2 + c3 * y3;
  }

  /**
   * Read-only 3rd-order Lagrange tap: a fractionally delayed sample WITHOUT
   * writing or advancing the buffer (e.g. a pickup-position tap of a string
   * loop another call already writes). Read at a delay of at least one sample.
   *
   * @param delaySamplesQ8 Requested delay in Q8.8 samples (negatives clamp to 0).
   * @returns The fractionally delayed output sample.
   */
  readFractional(delaySamplesQ8: number): number {
    const delay = (delaySamplesQ8 > 0 ? delaySamplesQ8 : 0) / 256;
    const base = Math.floor(delay);
    const mu = delay - base;

    let y0: number;
    let y1: number;
    let y2: number;
    let y3: number;
    if (base >= 1) {
      y0 = this.sampleAtDelay(base - 1);
      y1 = this.sampleAtDelay(base);
      y2 = this.sampleAtDelay(base + 1);
      y3 = this.sampleAtDelay(base + 2);
    } else {
      y0 = this.sampleAtDelay(0);
      y1 = this.sampleAtDelay(1);
      y2 = this.sampleAtDelay(2);
      y3 = this.sampleAtDelay(3);
    }
    const [c0, c1, c2, c3] = DelayLine.coeffs(mu, base);
    return c0 * y0 + c1 * y1 + c2 * y2 + c3 * y3;
  }
}
