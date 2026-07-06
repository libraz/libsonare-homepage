// Generated from src/tuner/worklet/tuner-processor.ts by scripts/build-tuner-worklet.mjs. Do not edit.
"use strict";
(() => {
  // src/tuner/dsp/body-resonator.ts
  var MAX_MODES = 16;
  var TWO_PI = 6.28318530718;
  var T60_SEC_PER_Q_HZ = 2.19848;
  function qToT60(freqHz, q) {
    return T60_SEC_PER_Q_HZ * q / freqHz;
  }
  var VIOLIN_BANK = [
    { freqHz: 275, q: 24, weight: 0.9 },
    { freqHz: 405, q: 20, weight: 0.5 },
    { freqHz: 460, q: 22, weight: 0.85 },
    { freqHz: 550, q: 22, weight: 1 },
    { freqHz: 700, q: 15, weight: 0.55 },
    { freqHz: 870, q: 14, weight: 0.45 },
    { freqHz: 1100, q: 13, weight: 0.5 },
    { freqHz: 1350, q: 12, weight: 0.4 },
    { freqHz: 1600, q: 12, weight: 0.45 },
    { freqHz: 1950, q: 11, weight: 0.4 },
    { freqHz: 2350, q: 6, weight: 0.75 },
    { freqHz: 2750, q: 6, weight: 0.55 },
    { freqHz: 3400, q: 8, weight: 0.28 },
    { freqHz: 4200, q: 8, weight: 0.16 }
  ];
  var VIOLIN_LEVEL = 0.42;
  var BodyResonator = class {
    modes = Array.from({ length: MAX_MODES }, () => ({
      a1: 0,
      a2: 0,
      gain: 0,
      y1: 0,
      y2: 0
    }));
    x1 = 0;
    x2 = 0;
    numModes = 0;
    mix = 0;
    /** Configure the bank from an explicit mode list. */
    startSpecs(specs, sampleRate2, mix) {
      const sr = sampleRate2 > 0 ? sampleRate2 : 48e3;
      this.mix = clamp(mix, 0, 1);
      this.numModes = 0;
      if (this.mix <= 0 || specs.length === 0) return;
      const count = Math.min(specs.length, MAX_MODES);
      for (let k = 0; k < count; ++k) {
        const spec = specs[k];
        if (spec.freqHz <= 0 || spec.freqHz >= 0.45 * sr) continue;
        const mode = this.modes[this.numModes];
        const w = TWO_PI * spec.freqHz / sr;
        const r = Math.exp(-6.907755279 / (sr * spec.t60S));
        mode.a1 = 2 * r * Math.cos(w);
        mode.a2 = -r * r;
        const re = 1 - r * Math.cos(2 * w);
        const im = r * Math.sin(2 * w);
        mode.gain = spec.weight * (1 - r) * Math.sqrt(re * re + im * im) / (2 * Math.sin(w));
        mode.y1 = 0;
        mode.y2 = 0;
        ++this.numModes;
      }
      this.x1 = 0;
      this.x2 = 0;
    }
    /** Configure a named voicing. `noteHz` tracks the played note (wood-tube). */
    start(type, sampleRate2, noteHz, mix) {
      if (type === "none") {
        this.mix = clamp(mix, 0, 1);
        this.numModes = 0;
        return;
      }
      let specs = [];
      switch (type) {
        case "guitar":
          specs = [
            { freqHz: 100, t60S: 0.12, weight: 1 },
            { freqHz: 200, t60S: 0.08, weight: 0.7 },
            { freqHz: 400, t60S: 0.06, weight: 0.5 },
            { freqHz: 550, t60S: 0.05, weight: 0.35 }
          ];
          break;
        case "violin":
          specs = VIOLIN_BANK.map((m) => ({
            freqHz: m.freqHz,
            t60S: qToT60(m.freqHz, m.q),
            weight: m.weight * VIOLIN_LEVEL
          }));
          break;
        case "wood-tube": {
          const f = Math.max(20, noteHz);
          specs = [
            { freqHz: f, t60S: 0.08, weight: 1.2 },
            { freqHz: f * 4, t60S: 0.04, weight: 0.3 }
          ];
          break;
        }
        case "brass-bell":
          specs = [
            { freqHz: 1200, t60S: 0.014, weight: 1 },
            { freqHz: 2400, t60S: 0.01, weight: 0.6 },
            { freqHz: 3400, t60S: 8e-3, weight: 0.4 }
          ];
          break;
        case "vocal":
          specs = [
            { freqHz: 700, t60S: 0.03, weight: 1 },
            { freqHz: 1080, t60S: 0.024, weight: 0.7 },
            { freqHz: 2650, t60S: 0.014, weight: 0.45 },
            { freqHz: 3500, t60S: 0.01, weight: 0.3 }
          ];
          break;
      }
      this.startSpecs(specs, sampleRate2, mix);
    }
    active() {
      return this.numModes > 0;
    }
    /** One sample through the bank: dry + mixed body response. */
    process(x) {
      const bpIn = x - this.x2;
      this.x2 = this.x1;
      this.x1 = x;
      let body = 0;
      for (let k = 0; k < this.numModes; ++k) {
        const mode = this.modes[k];
        const y = mode.a1 * mode.y1 + mode.a2 * mode.y2 + mode.gain * bpIn;
        mode.y2 = mode.y1;
        mode.y1 = y;
        body += y;
      }
      return x + this.mix * body;
    }
    reset() {
      for (const mode of this.modes) {
        mode.y1 = 0;
        mode.y2 = 0;
      }
      this.x1 = 0;
      this.x2 = 0;
      this.numModes = 0;
    }
  };
  function clamp(x, lo, hi) {
    return x < lo ? lo : x > hi ? hi : x;
  }

  // src/tuner/dsp/frac-delay.ts
  var DelayLine = class _DelayLine {
    buf;
    /** Circular span actually in use (<= buffer capacity), matching `size_`. */
    active;
    write = 0;
    /**
     * @param capacity Buffer capacity in samples (must be > 0). The active span
     *   defaults to the full capacity and can be narrowed per note with `prime`.
     */
    constructor(capacity) {
      this.buf = new Float32Array(Math.max(1, capacity | 0));
      this.active = this.buf.length;
    }
    /** Buffer capacity in samples. */
    get capacity() {
      return this.buf.length;
    }
    /** Active circular span in samples. */
    get size() {
      return this.active;
    }
    /** Clear the whole buffer and reset the write head. */
    reset() {
      this.buf.fill(0);
      this.write = 0;
      this.active = this.buf.length;
    }
    /**
     * Set the active circular span for a note and zero it, mirroring the C++
     * cores that carve a used span (`size_`) out of a larger allocated slab.
     */
    prime(size) {
      this.active = Math.max(1, Math.min(this.buf.length, size | 0));
      this.buf.fill(0, 0, this.active);
      this.write = 0;
    }
    /** Circular read at an integer sample delay (>= 0), matching the C++ helper. */
    sampleAtDelay(delay) {
      const size = this.active;
      const d = delay > 0 ? delay : 0;
      const index = (this.write + size - d % size) % size;
      return this.buf[index];
    }
    static coeffs(mu, base) {
      if (base >= 1) {
        return [
          -mu * (mu - 1) * (mu - 2) / 6,
          (mu + 1) * (mu - 1) * (mu - 2) / 2,
          -(mu + 1) * mu * (mu - 2) / 2,
          (mu + 1) * mu * (mu - 1) / 6
        ];
      }
      return [
        -(mu - 1) * (mu - 2) * (mu - 3) / 6,
        mu * (mu - 2) * (mu - 3) / 2,
        -mu * (mu - 1) * (mu - 3) / 2,
        mu * (mu - 1) * (mu - 2) / 6
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
    processFractional(delaySamplesQ8, input) {
      this.buf[this.write] = input;
      const delay = (delaySamplesQ8 > 0 ? delaySamplesQ8 : 0) / 256;
      const base = Math.floor(delay);
      const mu = delay - base;
      let y0;
      let y1;
      let y2;
      let y3;
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
      const [c0, c1, c2, c3] = _DelayLine.coeffs(mu, base);
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
    readFractional(delaySamplesQ8) {
      const delay = (delaySamplesQ8 > 0 ? delaySamplesQ8 : 0) / 256;
      const base = Math.floor(delay);
      const mu = delay - base;
      let y0;
      let y1;
      let y2;
      let y3;
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
      const [c0, c1, c2, c3] = _DelayLine.coeffs(mu, base);
      return c0 * y0 + c1 * y1 + c2 * y2 + c3 * y3;
    }
  };

  // src/tuner/dsp/voice-random.ts
  var MASK64 = (1n << 64n) - 1n;
  var GAMMA = 0x9e3779b97f4a7c15n;
  var M1 = 0xbf58476d1ce4e5b9n;
  var M2 = 0x94d049bb133111ebn;
  var INV_2POW24 = 1 / 16777216;
  function voiceHash(seed) {
    let z = seed + GAMMA & MASK64;
    z = (z ^ z >> 30n) * M1 & MASK64;
    z = (z ^ z >> 27n) * M2 & MASK64;
    return z ^ z >> 31n;
  }
  function voiceSeed(voiceIndex, note, age) {
    return voiceHash((BigInt(voiceIndex) << 40n ^ BigInt(note) << 32n ^ age) & MASK64);
  }
  function voiceRandomUnipolar(seed) {
    return Number(voiceHash(seed) >> 40n) * INV_2POW24;
  }
  function voiceRandomBipolar(seed) {
    return 2 * voiceRandomUnipolar(seed) - 1;
  }
  var VoiceRandomSequence = class {
    seed = 0n;
    counter = 0n;
    constructor(seed = 0n) {
      this.seed = seed & MASK64;
    }
    reseed(voiceIndex, note, age) {
      this.seed = voiceSeed(voiceIndex, note, age);
      this.counter = 0n;
    }
    nextUnipolar() {
      return voiceRandomUnipolar((this.seed ^ this.counter++) & MASK64);
    }
    nextBipolar() {
      return voiceRandomBipolar((this.seed ^ this.counter++) & MASK64);
    }
    /** Random access without disturbing the stream position. */
    unipolarAt(index) {
      return voiceRandomUnipolar((this.seed ^ BigInt(index)) & MASK64);
    }
    bipolarAt(index) {
      return voiceRandomBipolar((this.seed ^ BigInt(index)) & MASK64);
    }
  };

  // src/tuner/dsp/bowed-voice.ts
  var PI = Math.PI;
  var TWO_PI2 = 2 * Math.PI;
  var BOWED_MIN_FUNDAMENTAL_HZ = 20;
  var BOW_VELOCITY_BASE = 0.03;
  var BOW_VELOCITY_SPAN = 0.14;
  var ROSIN_DEPTH = 0.15;
  var CONTROL_SMOOTH_MS = 8;
  var BOW_SLOPE_MAX = 5;
  var BOW_SLOPE_SPAN = 4;
  var EP_STRIBECK_BASE = 0.02;
  var EP_STRIBECK_SPAN = 0.1;
  var EP_Z_MAX = 0.25;
  var EP_BREAKAWAY_FRAC = 0.15;
  var EP_LOAD_TIME_MS = 0.15;
  var EP_ZSS_FLOOR = 0.1;
  var EP_HYST_OFFSET = 0.6;
  var SYMPATHETIC_MODES = 8;
  var SYMPATHETIC_NOTES = [28, 35, 42, 49, 55, 62, 69, 76];
  var SYMPATHETIC_RING_S = 1.2;
  var SYMPATHETIC_OUT_GAIN = 0.1;
  var POL_DETUNE_CENTS = 7;
  var POL_LOSS = 0.93;
  var POL_LP_POLE = 0.35;
  var POL_DRIVE = 0.35;
  var POL_COUPLE_MAX = 0.2;
  var POL_RADIATION = 0.25;
  function defaultBowedParams() {
    return {
      bowPosition: 0.13,
      bowForce: 0.5,
      bowSpeed: 0.5,
      velToSpeed: 0.6,
      brightness: 0.5,
      damping: 0.4,
      attackMs: 60,
      releaseMs: 120,
      rosin: 0,
      elastoPlastic: false,
      stribeck: 0.5,
      sympathetic: 0,
      polarization: 0
    };
  }
  function bowedBufferCapacity(sampleRate2) {
    const sr = sampleRate2 > 0 ? sampleRate2 : 48e3;
    return Math.trunc(sr / BOWED_MIN_FUNDAMENTAL_HZ) + 8;
  }
  function noteToHz(note) {
    return 440 * 2 ** (((note & 127) - 69) / 12);
  }
  function rampCoeff(ms, sampleRate2) {
    const t = Math.max(0.5, ms) * 1e-3 * sampleRate2;
    return 1 - Math.exp(-3 / Math.max(1, t));
  }
  function clamp2(x, lo, hi) {
    return x < lo ? lo : x > hi ? hi : x;
  }
  function emptySympatheticMode() {
    return { a1: 0, a2: 0, gain: 0, y1: 0, y2: 0 };
  }
  var BowedStringVoiceCore = class {
    neck;
    bridge;
    pol;
    neckSize = 0;
    bridgeSize = 0;
    neckOut = 0;
    bridgeOut = 0;
    // Tuning.
    basePeriod = 0;
    beta = 0.13;
    comp = 2;
    // Bridge reflection.
    lpAlpha = 1;
    lpState = 0;
    lossGain = 0.95;
    // Bow table.
    bowSlope = 3;
    bowOffset = 0;
    // Bow velocity contour.
    maxBowVelocity = 0.1;
    bowLevel = 0;
    attackCoeff = 0;
    releaseCoeff = 0;
    releasing = false;
    // Live-control smoothing.
    baseBowVelocity = 0.1;
    bowSpeedTarget = 0.1;
    slopeTarget = 3;
    betaTarget = 0.13;
    ctrlCoeff = 1;
    // Output trim.
    outputScale = 1.2;
    // Rosin texture.
    rosinLevel = 0;
    noise = new VoiceRandomSequence();
    driveIndex = 0;
    // Elasto-plastic friction.
    elastoPlastic = false;
    bristleZ = 0;
    epStribeckV = 0.1;
    epLoadRate = 0;
    epZBa = 0;
    epZMax = 0;
    // Sympathetic bank.
    sympathetic = Array.from(
      { length: SYMPATHETIC_MODES },
      emptySympatheticMode
    );
    sympatheticMix = 0;
    // Second (horizontal) polarization.
    polSize = 0;
    polOut = 0;
    polPeriod = 0;
    polLpState = 0;
    polLpAlpha = 1;
    polLoss = 0.95;
    polCouple = 0;
    polDrive = 0;
    constructor(sampleRate2) {
      const cap = bowedBufferCapacity(sampleRate2);
      this.neck = new DelayLine(cap);
      this.bridge = new DelayLine(cap);
      this.pol = new DelayLine(cap);
    }
    start(params, sampleRate2, note, velocity, seed) {
      const sr = sampleRate2 > 0 ? sampleRate2 : 48e3;
      this.noise = new VoiceRandomSequence(seed);
      this.driveIndex = 0;
      this.releasing = false;
      this.bowLevel = 0;
      this.lpState = 0;
      this.neckOut = 0;
      this.bridgeOut = 0;
      const f0 = noteToHz(note);
      this.basePeriod = sr / Math.max(1, f0);
      this.beta = clamp2(params.bowPosition, 0.02, 0.5);
      this.betaTarget = this.beta;
      const vel01 = (velocity & 127) / 127;
      const velToSpeed = clamp2(params.velToSpeed, 0, 1);
      const speed = clamp2((1 - velToSpeed) * params.bowSpeed + velToSpeed * vel01, 0, 1);
      this.baseBowVelocity = BOW_VELOCITY_BASE + BOW_VELOCITY_SPAN * speed;
      this.maxBowVelocity = this.baseBowVelocity;
      this.bowSpeedTarget = this.baseBowVelocity;
      const force = clamp2(params.bowForce, 0, 1);
      this.bowSlope = BOW_SLOPE_MAX - BOW_SLOPE_SPAN * force;
      this.slopeTarget = this.bowSlope;
      this.bowOffset = 0;
      this.ctrlCoeff = rampCoeff(CONTROL_SMOOTH_MS, sr);
      const a = (1 - clamp2(params.brightness, 0, 1)) * 0.7;
      this.lpAlpha = 1 - a;
      this.lossGain = clamp2(0.99 - 0.09 * clamp2(params.damping, 0, 1), 0.8, 0.999);
      const omega = TWO_PI2 / Math.max(1, this.basePeriod);
      const tauLp = Math.atan2(a * Math.sin(omega), 1 - a * Math.cos(omega)) / Math.max(omega, 1e-6);
      this.comp = 2 + tauLp;
      const eff = Math.max(2, this.basePeriod - this.comp);
      const fullSpan = Math.trunc(eff * 1.3) + 8;
      this.neckSize = Math.min(this.neck.capacity, Math.max(16, fullSpan));
      this.bridgeSize = Math.min(this.bridge.capacity, Math.max(16, fullSpan));
      this.neck.prime(this.neckSize);
      this.bridge.prime(this.bridgeSize);
      this.attackCoeff = rampCoeff(params.attackMs, sr);
      this.releaseCoeff = rampCoeff(params.releaseMs, sr);
      this.rosinLevel = clamp2(params.rosin, 0, 1) * ROSIN_DEPTH;
      this.elastoPlastic = params.elastoPlastic;
      this.bristleZ = 0;
      if (this.elastoPlastic) {
        const stribeck01 = clamp2(params.stribeck, 0, 1);
        this.epStribeckV = EP_STRIBECK_BASE + EP_STRIBECK_SPAN * stribeck01;
        this.epZMax = EP_Z_MAX;
        this.epZBa = EP_BREAKAWAY_FRAC * EP_Z_MAX;
        this.epLoadRate = rampCoeff(EP_LOAD_TIME_MS, sr);
      }
      const sympathetic = clamp2(params.sympathetic, 0, 1);
      this.sympatheticMix = sympathetic > 0 ? SYMPATHETIC_OUT_GAIN * sympathetic : 0;
      if (this.sympatheticMix > 0) {
        const srf = sr;
        const r = Math.exp(-6.907755279 / (srf * SYMPATHETIC_RING_S));
        for (let i = 0; i < SYMPATHETIC_MODES; ++i) {
          const m = this.sympathetic[i];
          const freq = noteToHz(SYMPATHETIC_NOTES[i]);
          m.y1 = 0;
          m.y2 = 0;
          if (freq >= 0.45 * srf) {
            m.a1 = 0;
            m.a2 = 0;
            m.gain = 0;
            continue;
          }
          const w = TWO_PI2 * freq / srf;
          m.a1 = 2 * r * Math.cos(w);
          m.a2 = -r * r;
          m.gain = 1 - r;
        }
      }
      const polarization = clamp2(params.polarization, 0, 1);
      this.polCouple = polarization > 0 ? POL_COUPLE_MAX * polarization : 0;
      this.polOut = 0;
      this.polLpState = 0;
      if (this.polCouple > 0) {
        this.polPeriod = this.basePeriod * 2 ** (POL_DETUNE_CENTS / 1200);
        this.polLpAlpha = 1 - POL_LP_POLE;
        this.polLoss = POL_LOSS;
        this.polDrive = POL_DRIVE;
        this.polSize = this.neckSize;
        this.pol.prime(this.polSize);
      }
    }
    render(pitchRatio) {
      if (this.neckSize < 8 || this.bridgeSize < 8) return 0;
      const ratio = pitchRatio > 0.01 ? pitchRatio : 0.01;
      this.maxBowVelocity += this.ctrlCoeff * (this.bowSpeedTarget - this.maxBowVelocity);
      this.bowSlope += this.ctrlCoeff * (this.slopeTarget - this.bowSlope);
      this.beta += this.ctrlCoeff * (this.betaTarget - this.beta);
      const target = this.releasing ? 0 : 1;
      const coeff = this.releasing ? this.releaseCoeff : this.attackCoeff;
      this.bowLevel += coeff * (target - this.bowLevel);
      let bowV = this.maxBowVelocity * this.bowLevel;
      if (this.rosinLevel > 0) {
        bowV += this.maxBowVelocity * this.rosinLevel * this.noise.bipolarAt(this.driveIndex);
      }
      this.lpState += this.lpAlpha * (this.bridgeOut - this.lpState);
      const bridgeRefl = -this.lossGain * this.lpState;
      const nutRefl = -this.neckOut;
      const stringPrimary = bridgeRefl + nutRefl;
      let stringV = stringPrimary;
      if (this.polCouple > 0) stringV += this.polCouple * this.polOut;
      const dv = bowV - stringV;
      let vInj;
      if (this.elastoPlastic) {
        const dvEp = this.polCouple > 0 ? bowV - stringPrimary : dv;
        vInj = this.elastoPlasticInjection(dvEp);
      } else {
        const s = this.bowSlope * dv + this.bowOffset;
        const base = Math.abs(s) + 0.75;
        const base2 = base * base;
        let bowCoeff = 1 / (base2 * base2);
        if (bowCoeff > 1) bowCoeff = 1;
        vInj = dv * bowCoeff;
      }
      const eff = Math.max(2, this.basePeriod / ratio - this.comp);
      const neckDelay = clamp2((1 - this.beta) * eff, 1, this.neckSize - 4);
      const bridgeDelay = clamp2(this.beta * eff, 1, this.bridgeSize - 4);
      this.neckOut = this.neck.processFractional(Math.trunc(neckDelay * 256), bridgeRefl + vInj);
      this.bridgeOut = this.bridge.processFractional(Math.trunc(bridgeDelay * 256), nutRefl + vInj);
      ++this.driveIndex;
      let dry = this.outputScale * this.bridgeOut;
      if (this.polCouple > 0) {
        this.polLpState += this.polLpAlpha * (this.polOut - this.polLpState);
        const polRefl = -this.polLoss * this.polLpState;
        const polDelay = clamp2(this.polPeriod / ratio - this.comp, 1, this.polSize - 4);
        this.polOut = this.pol.processFractional(
          Math.trunc(polDelay * 256),
          polRefl + this.polDrive * vInj
        );
        dry += this.outputScale * POL_RADIATION * this.polOut;
      }
      if (this.sympatheticMix > 0) return dry + this.sympatheticMix * this.sympatheticProcess(dry);
      return dry;
    }
    release() {
      this.releasing = true;
    }
    kill() {
      this.bowLevel = 0;
      this.lpState = 0;
      this.neckOut = 0;
      this.bridgeOut = 0;
      this.bristleZ = 0;
      this.polOut = 0;
      this.polLpState = 0;
      for (const m of this.sympathetic) {
        m.y1 = 0;
        m.y2 = 0;
      }
      this.releasing = true;
    }
    sympatheticProcess(x) {
      let sum = 0;
      for (const m of this.sympathetic) {
        const y = m.a1 * m.y1 + m.a2 * m.y2 + m.gain * x;
        m.y2 = m.y1;
        m.y1 = y;
        sum += y;
      }
      return sum;
    }
    elastoPlasticInjection(dv) {
      const v = dv;
      const ratio = v / this.epStribeckV;
      const g = Math.exp(-ratio * ratio);
      const zSs = (EP_ZSS_FLOOR + (1 - EP_ZSS_FLOOR) * g) * this.epZMax;
      const zSsSigned = v >= 0 ? zSs : -zSs;
      let alpha = 0;
      const az = Math.abs(this.bristleZ);
      if (v >= 0 === this.bristleZ >= 0 && az > this.epZBa) {
        if (az < zSs) {
          const x = (az - this.epZBa) / Math.max(zSs - this.epZBa, 1e-6);
          alpha = 0.5 * (1 - Math.cos(PI * x));
        } else {
          alpha = 1;
        }
      }
      const dz = this.epLoadRate * v * (1 - alpha * this.bristleZ / zSsSigned);
      this.bristleZ = clamp2(this.bristleZ + dz, -this.epZMax, this.epZMax);
      const s = this.bowSlope * (dv - EP_HYST_OFFSET * this.bristleZ) + this.bowOffset;
      const base = Math.abs(s) + 0.75;
      const base2 = base * base;
      let bowCoeff = 1 / (base2 * base2);
      if (bowCoeff > 1) bowCoeff = 1;
      return dv * bowCoeff;
    }
  };

  // src/tuner/dsp/brass-voice.ts
  var TWO_PI3 = 2 * Math.PI;
  var BRASS_MIN_FUNDAMENTAL_HZ = 20;
  var MOUTH_SCALE = 1;
  var BREATH_BASE = 0.72;
  var BREATH_SPAN = 0.28;
  var LIP_OFFSET = -0.1;
  var LIP_COUPLE = 4.5;
  var LIP_Q_MIN = 8;
  var LIP_Q_SPAN = 22;
  var LIP_TUNE_SPAN = 0.04;
  var PITCH_CORRECT = 1.0075;
  var LOSS_BASE = 0.995;
  var LOSS_SPAN = 0.08;
  var LOSS_FLOOR = 0.85;
  var LOSS_CEIL = 0.999;
  var BELL_POLE_SPAN = 0.7;
  var CONICAL_DARKEN = 0.12;
  var CONTROL_SMOOTH_MS2 = 8;
  var BREATH_NOISE_DEPTH = 0.08;
  var CHIFF_DEPTH = 0.5;
  var BORE_PREFILL = 0.03;
  var DC_CORNER_HZ = 10;
  var OUTPUT_TARGET_PEAK = 0.6;
  var PEAK_BASE = 2.33;
  var PEAK_TILT = 0.93;
  var PEAK_REF_HZ = 44;
  var CUIVRE_DYN_GAIN = 1.8;
  var CUIVRE_DRIVE = 9;
  var CUIVRE_ASYM = 0.5;
  var CUIVRE_DRIVE_REF_HZ = 175;
  var CUIVRE_DRIVE_RATIO_MAX = 2.3;
  var CUIVRE_MIX_MAX = 0.85;
  var MUTE_FORMANT_HZ = 1800;
  var MUTE_FORMANT_R = 0.9;
  var MUTE_FORMANT_GAIN = 3.5;
  var MUTE_SCOOP = 0.45;
  var MUTE_MIX_MAX = 0.9;
  var HALF_VALVE_LOSS_MAX = 0.05;
  var HALF_VALVE_DETUNE = 6e-3;
  var LIP2_MULT = 2;
  var LIP2_Q = 7;
  var LIP2_COUPLE = 1.5;
  var ADAA_DIVISOR_EPSILON = 1e-5;
  function defaultBrassParams() {
    return {
      breathPressure: 0.7,
      velToBreath: 0.6,
      lipTension: 0.5,
      lipDamping: 0.5,
      conical: false,
      brightness: 0.5,
      damping: 0.4,
      attackMs: 25,
      releaseMs: 90,
      breathNoise: 0.1,
      chiff: 0.35,
      chiffMs: 10,
      brassiness: 0,
      cuivreDynamics: 0,
      mute: 0,
      halfValve: 0,
      dynamicLip: 0
    };
  }
  function brassBufferCapacity(sampleRate2) {
    const sr = sampleRate2 > 0 ? sampleRate2 : 48e3;
    return Math.trunc(sr / BRASS_MIN_FUNDAMENTAL_HZ) + 8;
  }
  function noteToHz2(note) {
    return 440 * 2 ** (((note & 127) - 69) / 12);
  }
  function rampCoeff2(ms, sampleRate2) {
    const t = Math.max(0.5, ms) * 1e-3 * sampleRate2;
    return 1 - Math.exp(-3 / Math.max(1, t));
  }
  function clamp3(x, lo, hi) {
    return x < lo ? lo : x > hi ? hi : x;
  }
  function tanhAntiderivative(x) {
    const ax = Math.abs(x);
    return ax + Math.log1p(Math.exp(-2 * ax)) - Math.LN2;
  }
  var Adaa1Tanh = class {
    prevX = 0;
    prevF1 = tanhAntiderivative(0);
    process(x) {
      const f1x = tanhAntiderivative(x);
      const dx = x - this.prevX;
      const y = Math.abs(dx) > ADAA_DIVISOR_EPSILON ? (f1x - this.prevF1) / dx : Math.tanh(0.5 * (x + this.prevX));
      this.prevX = x;
      this.prevF1 = f1x;
      return y;
    }
    reset(x = 0) {
      this.prevX = x;
      this.prevF1 = tanhAntiderivative(x);
    }
  };
  var BrassVoiceCore = class {
    bore;
    boreSize = 0;
    boreOut = 0;
    // Tuning.
    borePeriod = 0;
    comp = 1;
    sign = 1;
    // Bell reflection loop lowpass + loss + in-loop DC blocker.
    lpAlpha = 1;
    lpState = 0;
    lossGain = 0.95;
    dcX1 = 0;
    dcY1 = 0;
    dcR = 0;
    // Lip valve (resonant DC-zeroed bandpass).
    lipB0 = 0;
    lipA1 = 0;
    lipA2 = 0;
    lipX1 = 0;
    lipX2 = 0;
    lipZ1 = 0;
    lipZ2 = 0;
    lipOffset = LIP_OFFSET;
    lipCouple = LIP_COUPLE;
    mouthScale = 1;
    // Breath contour.
    breathTarget = 0.7;
    breathLevel = 0;
    attackCoeff = 0;
    releaseCoeff = 0;
    releasing = false;
    // Live-control smoothing.
    ctrlCoeff = 1;
    breathCtrlTarget = 0.7;
    lpAlphaTarget = 1;
    // Breath turbulence + onset chiff.
    breathNoise = 0;
    chiffLevel = 0;
    chiffCoeff = 0;
    outputScale = 1;
    noise = new VoiceRandomSequence();
    driveIndex = 0;
    // 4a cuivré (inert when brassiness == 0).
    brassiness = 0;
    cuivreScale = 1;
    cuivreInvScale = 1;
    cuivreDrive = 0;
    cuivreInvTanh = 1;
    cuivreFcSq = 1;
    cuivreDynamics = 0;
    cuivreVel = 0;
    cuivreSeat = 0;
    cuivreAdaa = new Adaa1Tanh();
    // 4b mute (inert when mute == 0).
    mute = 0;
    mutePeakB0 = 0;
    mutePeakA1 = 0;
    mutePeakA2 = 0;
    muteX1 = 0;
    muteX2 = 0;
    muteY1 = 0;
    muteY2 = 0;
    // 4c half-valve (inert when halfValve == 0).
    halfValve = 0;
    halfValveLoss = 1;
    // 4d dynamic (2-DOF) lip (inert when dynamicLip == 0).
    dynLip = 0;
    lip2B0 = 0;
    lip2A1 = 0;
    lip2A2 = 0;
    lip2X1 = 0;
    lip2X2 = 0;
    lip2Z1 = 0;
    lip2Z2 = 0;
    lip2Couple = 0;
    constructor(sampleRate2) {
      this.bore = new DelayLine(brassBufferCapacity(sampleRate2));
    }
    start(params, sampleRate2, note, velocity, seed) {
      const sr = sampleRate2 > 0 ? sampleRate2 : 48e3;
      const srf = sr;
      this.noise = new VoiceRandomSequence(seed);
      this.driveIndex = 0;
      this.releasing = false;
      this.breathLevel = 0;
      this.lpState = 0;
      this.boreOut = 0;
      this.dcX1 = 0;
      this.dcY1 = 0;
      this.lipX1 = 0;
      this.lipX2 = 0;
      this.lipZ1 = 0;
      this.lipZ2 = 0;
      const f0 = noteToHz2(note);
      const period = srf / Math.max(1, f0);
      this.borePeriod = period * PITCH_CORRECT;
      this.sign = 1;
      const vel01 = (velocity & 127) / 127;
      const velToBreath = clamp3(params.velToBreath, 0, 1);
      const level = clamp3((1 - velToBreath) * params.breathPressure + velToBreath * vel01, 0, 1);
      this.breathTarget = BREATH_BASE + BREATH_SPAN * level;
      this.breathCtrlTarget = this.breathTarget;
      this.ctrlCoeff = rampCoeff2(CONTROL_SMOOTH_MS2, sr);
      this.mouthScale = MOUTH_SCALE;
      const damp = clamp3(params.lipDamping, 0, 1);
      const tension = clamp3(params.lipTension, 0, 1);
      const fLip = Math.min(f0 * (1 + LIP_TUNE_SPAN * (tension - 0.5)), 0.45 * srf);
      const q = LIP_Q_MIN + LIP_Q_SPAN * (1 - damp);
      let lipR = Math.exp(-Math.PI * (fLip / q) / srf);
      lipR = Math.min(lipR, 0.99995);
      const w = TWO_PI3 * fLip / srf;
      this.lipA1 = 2 * lipR * Math.cos(w);
      this.lipA2 = -lipR * lipR;
      this.lipB0 = 1 - lipR;
      this.lipOffset = LIP_OFFSET;
      this.lipCouple = LIP_COUPLE;
      let a = (1 - clamp3(params.brightness, 0, 1)) * BELL_POLE_SPAN;
      if (params.conical) a = Math.min(a + CONICAL_DARKEN, 0.95);
      this.lpAlpha = 1 - a;
      this.lpAlphaTarget = this.lpAlpha;
      this.lossGain = clamp3(
        LOSS_BASE - LOSS_SPAN * clamp3(params.damping, 0, 1),
        LOSS_FLOOR,
        LOSS_CEIL
      );
      this.dcR = 1 - TWO_PI3 * DC_CORNER_HZ / sr;
      const omega = TWO_PI3 / Math.max(1, this.borePeriod);
      const tauLp = Math.atan2(a * Math.sin(omega), 1 - a * Math.cos(omega)) / Math.max(omega, 1e-6);
      this.comp = 1 + tauLp;
      const eff = Math.max(2, this.borePeriod - this.comp);
      const span = Math.trunc(eff * 1.3) + 8;
      const size = Math.min(this.bore.capacity, Math.max(16, span));
      this.bore.prime(size);
      this.boreSize = this.bore.size;
      this.attackCoeff = rampCoeff2(params.attackMs, sr);
      this.releaseCoeff = rampCoeff2(params.releaseMs, sr);
      this.breathNoise = clamp3(params.breathNoise, 0, 1) * BREATH_NOISE_DEPTH;
      this.chiffLevel = clamp3(params.chiff, 0, 1) * CHIFF_DEPTH;
      this.chiffCoeff = rampCoeff2(params.chiffMs, sr);
      const peakEst = clamp3(PEAK_BASE + PEAK_TILT * Math.log2(f0 / PEAK_REF_HZ), 1.5, 9);
      this.outputScale = OUTPUT_TARGET_PEAK / peakEst;
      const prefill = BORE_PREFILL * this.breathTarget;
      for (let i = 0; i < this.boreSize; ++i) {
        this.bore.processFractional(256, prefill * this.noise.bipolarAt(i));
      }
      this.driveIndex = this.boreSize;
      this.brassiness = clamp3(params.brassiness, 0, 1);
      this.cuivreDynamics = clamp3(params.cuivreDynamics, 0, 1);
      this.cuivreVel = vel01;
      this.cuivreSeat = level;
      this.cuivreScale = peakEst;
      this.cuivreInvScale = 1 / Math.max(0.5, peakEst);
      const cuivreFc = clamp3(CUIVRE_DRIVE_REF_HZ / f0, 1, CUIVRE_DRIVE_RATIO_MAX);
      this.cuivreFcSq = cuivreFc * cuivreFc;
      this.cuivreDrive = (1 + CUIVRE_DRIVE * this.brassiness) * this.cuivreFcSq;
      this.cuivreInvTanh = 1 / Math.tanh(this.cuivreDrive);
      this.cuivreAdaa.reset(0);
      this.mute = clamp3(params.mute, 0, 1);
      this.muteX1 = 0;
      this.muteX2 = 0;
      this.muteY1 = 0;
      this.muteY2 = 0;
      if (this.mute > 0) {
        const fm = Math.min(MUTE_FORMANT_HZ, 0.45 * srf);
        const wm = TWO_PI3 * fm / srf;
        this.mutePeakA1 = 2 * MUTE_FORMANT_R * Math.cos(wm);
        this.mutePeakA2 = -MUTE_FORMANT_R * MUTE_FORMANT_R;
        this.mutePeakB0 = 1 - MUTE_FORMANT_R;
      }
      this.halfValve = clamp3(params.halfValve, 0, 1);
      this.halfValveLoss = 1 - HALF_VALVE_LOSS_MAX * this.halfValve;
      if (this.halfValve > 0) {
        this.borePeriod *= 1 + HALF_VALVE_DETUNE * this.halfValve;
      }
      this.dynLip = clamp3(params.dynamicLip, 0, 1);
      this.lip2X1 = 0;
      this.lip2X2 = 0;
      this.lip2Z1 = 0;
      this.lip2Z2 = 0;
      if (this.dynLip > 0) {
        const f2 = Math.min(fLip * LIP2_MULT, 0.45 * srf);
        let r2 = Math.exp(-Math.PI * (f2 / LIP2_Q) / srf);
        r2 = Math.min(r2, 0.99995);
        const w2 = TWO_PI3 * f2 / srf;
        this.lip2A1 = 2 * r2 * Math.cos(w2);
        this.lip2A2 = -r2 * r2;
        this.lip2B0 = 1 - r2;
        this.lip2Couple = LIP2_COUPLE * this.dynLip;
      }
    }
    lipResonator(dp) {
      const y = this.lipB0 * (dp - this.lipX2) + this.lipA1 * this.lipZ1 + this.lipA2 * this.lipZ2;
      this.lipX2 = this.lipX1;
      this.lipX1 = dp;
      this.lipZ2 = this.lipZ1;
      this.lipZ1 = y;
      return y;
    }
    lipResonator2(dp) {
      const y = this.lip2B0 * (dp - this.lip2X2) + this.lip2A1 * this.lip2Z1 + this.lip2A2 * this.lip2Z2;
      this.lip2X2 = this.lip2X1;
      this.lip2X1 = dp;
      this.lip2Z2 = this.lip2Z1;
      this.lip2Z1 = y;
      return y;
    }
    render(pitchRatio) {
      if (this.boreSize < 8) return 0;
      const ratio = pitchRatio > 0.01 ? pitchRatio : 0.01;
      this.breathTarget += this.ctrlCoeff * (this.breathCtrlTarget - this.breathTarget);
      this.lpAlpha += this.ctrlCoeff * (this.lpAlphaTarget - this.lpAlpha);
      const target = this.releasing ? 0 : 1;
      const coeff = this.releasing ? this.releaseCoeff : this.attackCoeff;
      this.breathLevel += coeff * (target - this.breathLevel);
      let breath = this.breathTarget * this.breathLevel;
      if (this.breathNoise > 0) {
        breath += breath * this.breathNoise * this.noise.bipolarAt(this.driveIndex);
      }
      if (this.chiffLevel > 1e-4) {
        breath += this.chiffLevel * this.breathTarget * this.noise.bipolarAt(this.driveIndex + 1);
        this.chiffLevel -= this.chiffCoeff * this.chiffLevel;
      }
      const mouth = this.mouthScale * breath;
      this.lpState += this.lpAlpha * (this.boreOut - this.lpState);
      let refl = this.sign * this.lossGain * this.lpState;
      if (this.halfValve > 0) refl *= this.halfValveLoss;
      const dp = refl - mouth;
      const x = this.lipResonator(dp);
      let lipCoeff = this.lipOffset - this.lipCouple * x;
      if (this.dynLip > 0) lipCoeff -= this.lip2Couple * this.lipResonator2(dp);
      if (lipCoeff < -1) lipCoeff = -1;
      if (lipCoeff > 1) lipCoeff = 1;
      const inj = mouth + dp * lipCoeff;
      const dc = inj - this.dcX1 + this.dcR * this.dcY1;
      this.dcX1 = inj;
      this.dcY1 = dc;
      const delay = clamp3(this.borePeriod / ratio - this.comp, 1, this.boreSize - 4);
      this.boreOut = this.bore.processFractional(Math.trunc(delay * 256), dc);
      ++this.driveIndex;
      let outp = this.boreOut;
      if (this.brassiness > 0) {
        let bEff = this.brassiness;
        let drive = this.cuivreDrive;
        let invTanh = this.cuivreInvTanh;
        if (this.cuivreDynamics > 0) {
          const live = clamp3(
            (this.breathTarget * this.breathLevel - BREATH_BASE) / BREATH_SPAN,
            0,
            1
          );
          const dyn = clamp3(
            this.cuivreVel * this.breathLevel + Math.max(0, live - this.cuivreSeat),
            0,
            1
          );
          const shapedDyn = dyn * dyn;
          bEff = clamp3(
            this.brassiness * (1 - this.cuivreDynamics + this.cuivreDynamics * CUIVRE_DYN_GAIN * shapedDyn),
            0,
            1
          );
          drive = (1 + CUIVRE_DRIVE * bEff) * this.cuivreFcSq;
          invTanh = 1 / Math.tanh(drive);
        }
        const xn = outp * this.cuivreInvScale;
        const xa = xn + CUIVRE_ASYM * xn * Math.abs(xn);
        const shaped = this.cuivreAdaa.process(drive * xa) * invTanh * this.cuivreScale;
        outp += bEff * CUIVRE_MIX_MAX * (shaped - outp);
      }
      if (this.mute > 0) {
        const peak = this.mutePeakB0 * (outp - this.muteX2) + this.mutePeakA1 * this.muteY1 + this.mutePeakA2 * this.muteY2;
        this.muteX2 = this.muteX1;
        this.muteX1 = outp;
        this.muteY2 = this.muteY1;
        this.muteY1 = peak;
        const muted = outp * (1 - MUTE_SCOOP) + peak * MUTE_FORMANT_GAIN;
        const wet = this.mute * MUTE_MIX_MAX;
        outp += wet * (muted - outp);
      }
      return this.outputScale * outp;
    }
    release() {
      this.releasing = true;
    }
    kill() {
      this.breathLevel = 0;
      this.lpState = 0;
      this.boreOut = 0;
      this.dcX1 = 0;
      this.dcY1 = 0;
      this.chiffLevel = 0;
      this.lipX1 = 0;
      this.lipX2 = 0;
      this.lipZ1 = 0;
      this.lipZ2 = 0;
      this.muteX1 = 0;
      this.muteX2 = 0;
      this.muteY1 = 0;
      this.muteY2 = 0;
      this.lip2X1 = 0;
      this.lip2X2 = 0;
      this.lip2Z1 = 0;
      this.lip2Z2 = 0;
      this.releasing = true;
    }
  };

  // src/tuner/dsp/flute-voice.ts
  var TWO_PI4 = 2 * Math.PI;
  var FLUTE_MIN_FUNDAMENTAL_HZ = 40;
  var FLUTE_BORE_LENGTH_PERIODS = 1;
  var BREATH_BASE2 = 0.8;
  var BREATH_SPAN2 = 0.35;
  var JET_RATIO_MIN = 0.38;
  var JET_RATIO_MAX = 0.62;
  var REFLECT_MAX = 0.62;
  var BELL_POLE_BASE = 0.8;
  var BELL_POLE_SPAN2 = 0.3;
  var LOSS_SPAN2 = 0.18;
  var PITCH_CORRECT2 = 1.0104;
  var CONTROL_SMOOTH_MS3 = 8;
  var BREATH_NOISE_DEPTH2 = 0.1;
  var CHIFF_DEPTH2 = 0.5;
  var BORE_PREFILL2 = 0.05;
  var DC_CORNER_HZ2 = 10;
  var VIB_PITCH_CENTS = 30;
  var VIB_AMP = 0.06;
  var OUTPUT_TARGET_PEAK2 = 0.5;
  var PEAK_BASE2 = 4;
  var PEAK_TILT2 = -0.65;
  var PEAK_REF_HZ2 = 261.63;
  var JET_ASYM = 0.5;
  var EVEN_PUMP_GAIN = 0.6;
  var EVEN_PUMP_DC_HZ = 30;
  function fluteBufferCapacity(sampleRate2) {
    const sr = sampleRate2 > 0 ? sampleRate2 : 48e3;
    return Math.trunc(FLUTE_BORE_LENGTH_PERIODS * sr / FLUTE_MIN_FUNDAMENTAL_HZ) + 8;
  }
  function defaultFluteParams() {
    return {
      breathPressure: 0.55,
      velToBreath: 0.5,
      jetRatio: 0.5,
      jetReflection: 0.5,
      endReflection: 0.5,
      brightness: 0.5,
      damping: 0.35,
      attackMs: 18,
      releaseMs: 90,
      breathNoise: 0.15,
      chiff: 0.4,
      chiffMs: 12,
      vibratoRateHz: 5,
      vibratoDepth: 0,
      overblow: 0,
      jetTurbulence: 0,
      edgeHysteresis: 0,
      vortex: 0
    };
  }
  function noteToHz3(note) {
    return 440 * 2 ** (((note & 127) - 69) / 12);
  }
  function rampCoeff3(ms, sampleRate2) {
    const t = Math.max(0.5, ms) * 1e-3 * sampleRate2;
    return 1 - Math.exp(-3 / Math.max(1, t));
  }
  function jetTable(x) {
    const y = x * (x * x - 1) + JET_ASYM * x * x;
    return y < -1 ? -1 : y > 1 ? 1 : y;
  }
  function clamp4(x, lo, hi) {
    return x < lo ? lo : x > hi ? hi : x;
  }
  var FluteVoiceCore = class {
    // Bore + jet delay lines: the travelling-wave air column and the jet
    // convection line.
    bore;
    jet;
    boreSize = 0;
    jetSize = 0;
    // Last bore delay-line output (the pressure returning to the mouth next sample).
    boreOut = 0;
    // Tuning: the bore loop period, the delay not carried in the line, and the jet
    // delay as a fraction of the bore line delay.
    borePeriod = 0;
    comp = 1;
    jetRatio = 0.4;
    // Open-end reflection: one-pole loss lowpass, a loss gain, and the two
    // feedback taps (jet / end reflection).
    lpAlpha = 1;
    lpState = 0;
    lossGain = 1;
    jetReflection = 0.5;
    endReflection = 0.5;
    // In-loop DC blocker on the jet output.
    dcX1 = 0;
    dcY1 = 0;
    dcR = 0;
    // Even-harmonic pump (the octave-dominant open-flue-pipe colour).
    evenGain = 0;
    evenState = 0;
    evenHpAlpha = 0;
    // Breath contour: a one-pole ramp of the mouth pressure toward the target.
    breathTarget = 0.55;
    breathLevel = 0;
    attackCoeff = 0;
    releaseCoeff = 0;
    releasing = false;
    // Live-control smoothing (initialised equal to the note-on values).
    ctrlCoeff = 1;
    breathCtrlTarget = 0.55;
    lpAlphaTarget = 1;
    // Jet turbulence (deterministic multiplicative mouth-pressure noise).
    breathNoise = 0;
    // Onset chiff (one-pole decaying noise burst).
    chiffLevel = 0;
    chiffCoeff = 0;
    // Voice-local vibrato LFO. depth == 0 -> skipped.
    vibDepth = 0;
    vibDepthTarget = 0;
    vibPhase = 0;
    vibInc = 0;
    // Output trim bringing the raw bore pressure up to a musical voice level.
    outputScale = 1;
    noise = new VoiceRandomSequence();
    driveIndex = 0;
    // Off-by-default advanced physics (skipped entirely when off).
    overblow = 0;
    jetTurb = 0;
    jetTurbState = 0;
    edgeHyst = 0;
    edgeHystState = 0;
    vortex = 0;
    constructor(sampleRate2) {
      const cap = fluteBufferCapacity(sampleRate2);
      this.bore = new DelayLine(cap);
      this.jet = new DelayLine(cap);
    }
    start(params, sampleRate2, note, velocity, seed) {
      const sr = sampleRate2 > 0 ? sampleRate2 : 48e3;
      this.noise = new VoiceRandomSequence(seed);
      this.driveIndex = 0;
      this.releasing = false;
      this.breathLevel = 0;
      this.lpState = 0;
      this.boreOut = 0;
      this.dcX1 = 0;
      this.dcY1 = 0;
      this.vibPhase = 0;
      const f0 = noteToHz3(note);
      const period = FLUTE_BORE_LENGTH_PERIODS * sr / Math.max(1, f0);
      this.borePeriod = period * PITCH_CORRECT2;
      this.jetRatio = clamp4(params.jetRatio, JET_RATIO_MIN, JET_RATIO_MAX);
      const vel01 = (velocity & 127) / 127;
      const velToBreath = clamp4(params.velToBreath, 0, 1);
      const level = clamp4((1 - velToBreath) * params.breathPressure + velToBreath * vel01, 0, 1);
      this.breathTarget = BREATH_BASE2 + BREATH_SPAN2 * level;
      this.breathCtrlTarget = this.breathTarget;
      this.ctrlCoeff = rampCoeff3(CONTROL_SMOOTH_MS3, sr);
      this.jetReflection = Math.min(clamp4(params.jetReflection, 0, 1), REFLECT_MAX);
      this.endReflection = Math.min(clamp4(params.endReflection, 0, 1), REFLECT_MAX);
      const a = clamp4(BELL_POLE_BASE - BELL_POLE_SPAN2 * clamp4(params.brightness, 0, 1), 0, 0.95);
      this.lpAlpha = 1 - a;
      this.lpAlphaTarget = this.lpAlpha;
      this.lossGain = clamp4(1 - LOSS_SPAN2 * clamp4(params.damping, 0, 1), 0.5, 1);
      this.dcR = 1 - TWO_PI4 * DC_CORNER_HZ2 / sr;
      this.evenGain = EVEN_PUMP_GAIN;
      this.evenState = 0;
      this.evenHpAlpha = clamp4(1 - Math.exp(-TWO_PI4 * EVEN_PUMP_DC_HZ / sr), 0, 1);
      const omega = TWO_PI4 * f0 / sr;
      const tauLp = Math.atan2(a * Math.sin(omega), 1 - a * Math.cos(omega)) / Math.max(omega, 1e-6);
      this.comp = 1 + tauLp;
      const eff = Math.max(2, this.borePeriod - this.comp);
      const span = Math.min(this.bore.capacity, Math.max(16, Math.trunc(eff * 1.15) + 8));
      this.boreSize = span;
      this.jetSize = span;
      this.bore.prime(span);
      this.jet.prime(span);
      this.attackCoeff = rampCoeff3(params.attackMs, sr);
      this.releaseCoeff = rampCoeff3(params.releaseMs, sr);
      this.breathNoise = clamp4(params.breathNoise, 0, 1) * BREATH_NOISE_DEPTH2;
      this.chiffLevel = clamp4(params.chiff, 0, 1) * CHIFF_DEPTH2;
      this.chiffCoeff = rampCoeff3(params.chiffMs, sr);
      this.vibDepth = clamp4(params.vibratoDepth, 0, 1);
      this.vibDepthTarget = this.vibDepth;
      const vibRate = clamp4(params.vibratoRateHz, 0.1, 12);
      this.vibInc = TWO_PI4 * vibRate / sr;
      const peakEst = clamp4(PEAK_BASE2 + PEAK_TILT2 * Math.log2(Math.max(1, f0) / PEAK_REF_HZ2), 0.8, 5);
      this.outputScale = OUTPUT_TARGET_PEAK2 / peakEst;
      const prefill = BORE_PREFILL2 * this.breathTarget;
      for (let i = 0; i < this.boreSize; ++i) {
        this.bore.processFractional(256, prefill * this.noise.bipolarAt(i));
      }
      this.driveIndex = this.boreSize;
      this.overblow = clamp4(params.overblow, 0, 1);
      this.jetTurb = clamp4(params.jetTurbulence, 0, 1);
      this.jetTurbState = 0;
      this.edgeHyst = clamp4(params.edgeHysteresis, 0, 1);
      this.edgeHystState = 0;
      this.vortex = clamp4(params.vortex, 0, 1);
    }
    render(pitchRatio) {
      if (this.boreSize < 8) return 0;
      let ratio = pitchRatio > 0.01 ? pitchRatio : 0.01;
      this.breathTarget += this.ctrlCoeff * (this.breathCtrlTarget - this.breathTarget);
      this.lpAlpha += this.ctrlCoeff * (this.lpAlphaTarget - this.lpAlpha);
      this.vibDepth += this.ctrlCoeff * (this.vibDepthTarget - this.vibDepth);
      const target = this.releasing ? 0 : 1;
      const coeff = this.releasing ? this.releaseCoeff : this.attackCoeff;
      this.breathLevel += coeff * (target - this.breathLevel);
      let breath = this.breathTarget * this.breathLevel;
      let vibGain = 1;
      if (this.vibDepth > 1e-4) {
        const v = Math.sin(this.vibPhase);
        this.vibPhase += this.vibInc;
        if (this.vibPhase >= TWO_PI4) this.vibPhase -= TWO_PI4;
        ratio *= 2 ** (VIB_PITCH_CENTS * this.vibDepth * v / 1200);
        vibGain = 1 + VIB_AMP * this.vibDepth * v;
      }
      if (this.breathNoise > 0) {
        let n = this.noise.bipolarAt(this.driveIndex);
        if (this.jetTurb > 0) {
          this.jetTurbState += 0.3 * (n - this.jetTurbState);
          n = (1 - this.jetTurb) * n + this.jetTurb * (this.jetTurbState + n) * (0.5 + 0.5 * this.breathLevel);
        }
        breath += breath * this.breathNoise * n;
      }
      if (this.chiffLevel > 1e-4) {
        breath += this.chiffLevel * this.breathTarget * this.noise.bipolarAt(this.driveIndex + 1);
        this.chiffLevel -= this.chiffCoeff * this.chiffLevel;
      }
      let jetRef = this.jetReflection;
      if (this.overblow > 0) {
        jetRef *= 1 + 0.5 * this.overblow * Math.max(0, this.breathLevel - 0.5);
      }
      if (this.edgeHyst > 0) {
        this.edgeHystState += 1e-3 * (this.breathLevel - this.edgeHystState);
        jetRef *= 1 + 0.2 * this.edgeHyst * (this.edgeHystState - 0.5);
      }
      this.lpState += this.lpAlpha * (this.boreOut - this.lpState);
      const temp = this.lossGain * this.lpState;
      let pd = breath - jetRef * temp;
      if (this.vortex > 0) {
        pd += this.vortex * 0.3 * this.breathLevel * this.breathLevel * this.noise.bipolarAt(this.driveIndex + 2);
      }
      const boreDelay = clamp4(this.borePeriod / ratio - this.comp, 1, this.boreSize - 4);
      const jetDelay = clamp4(this.jetRatio * boreDelay, 1, this.jetSize - 4);
      const pdJ = this.jet.processFractional(Math.trunc(jetDelay * 256), pd);
      const jetOut = jetTable(pdJ);
      const jetDc = jetOut - this.dcX1 + this.dcR * this.dcY1;
      this.dcX1 = jetOut;
      this.dcY1 = jetDc;
      let intoBore = jetDc + this.endReflection * temp;
      const rect = temp > 0 ? temp : 0;
      this.evenState += this.evenHpAlpha * (rect - this.evenState);
      let pump = this.evenGain * (rect - this.evenState);
      pump = pump < -1.5 ? -1.5 : pump > 1.5 ? 1.5 : pump;
      intoBore += pump;
      this.boreOut = this.bore.processFractional(Math.trunc(boreDelay * 256), intoBore);
      ++this.driveIndex;
      return this.outputScale * vibGain * this.boreOut;
    }
    /** Note-off: stop blowing (ramp the breath to zero); the bore rings down. */
    release() {
      this.releasing = true;
    }
    /** Immediate silence. */
    kill() {
      this.breathLevel = 0;
      this.lpState = 0;
      this.boreOut = 0;
      this.dcX1 = 0;
      this.dcY1 = 0;
      this.chiffLevel = 0;
      this.jetTurbState = 0;
      this.releasing = true;
    }
  };

  // src/tuner/dsp/free-reed-voice.ts
  var TWO_PI5 = 2 * Math.PI;
  var DETUNE_MIN_CENTS = 3;
  var DETUNE_SPAN_CENTS = 12;
  var ASYM_BASE = 0.15;
  var ASYM_SPAN = 0.45;
  var DRIVE_BASE = 1.2;
  var DRIVE_STIFF_SPAN = 2.4;
  var DRIVE_BREATH_SPAN = 1.2;
  var BODY_MIN_HZ = 600;
  var BODY_MAX_HZ = 9e3;
  var BREATH_NOISE_DEPTH3 = 0.12;
  var OUTPUT_MIN = 0.3;
  var OUTPUT_SPAN = 0.5;
  function defaultFreeReedParams() {
    return {
      brightness: 0.6,
      reedStiffness: 0.5,
      breathPressure: 0.7,
      velToBreath: 0.5,
      detune: 0.3,
      attackMs: 20,
      releaseMs: 80,
      breathNoise: 0.08
    };
  }
  function noteToHz4(note) {
    return 440 * 2 ** (((note & 127) - 69) / 12);
  }
  function clamp5(x, lo, hi) {
    return x < lo ? lo : x > hi ? hi : x;
  }
  function rampCoeff4(ms, sampleRate2) {
    const t = Math.max(0.5, ms) * 1e-3 * sampleRate2;
    return 1 - Math.exp(-3 / Math.max(1, t));
  }
  var FreeReedVoiceCore = class {
    // Two detuned tongue oscillators.
    phaseA = 0;
    phaseB = 0;
    incA = 0;
    incB = 0;
    dual = false;
    // Tongue nonlinearity.
    asymmetry = 0;
    drive = 1;
    // Body lowpass.
    bodyAlpha = 1;
    bodyState = 0;
    // Bellows level contour.
    levelTarget = 1;
    level = 0;
    attackCoeff = 0;
    releaseCoeff = 0;
    releasing = false;
    // Breath/air noise.
    breathNoise = 0;
    noise = new VoiceRandomSequence();
    driveIndex = 1;
    outputScale = 1;
    start(params, sampleRate2, note, velocity, seed) {
      const sr = sampleRate2 > 0 ? sampleRate2 : 48e3;
      this.noise = new VoiceRandomSequence(seed);
      this.driveIndex = 1;
      this.releasing = false;
      this.level = 0;
      this.levelTarget = 1;
      this.bodyState = 0;
      const baseFreq = noteToHz4(note);
      this.incA = baseFreq / sr;
      const detune = clamp5(params.detune, 0, 1);
      this.dual = detune > 0;
      this.phaseA = 0;
      if (this.dual) {
        const cents = DETUNE_MIN_CENTS + DETUNE_SPAN_CENTS * detune;
        this.incB = this.incA * 2 ** (cents / 1200);
        this.phaseB = this.noise.unipolarAt(0);
      } else {
        this.incB = 0;
        this.phaseB = 0;
      }
      const vel01 = (velocity & 127) / 127;
      const velToBreath = clamp5(params.velToBreath, 0, 1);
      const level = clamp5((1 - velToBreath) * params.breathPressure + velToBreath * vel01, 0, 1);
      const stiffness = clamp5(params.reedStiffness, 0, 1);
      this.asymmetry = ASYM_BASE + ASYM_SPAN * stiffness;
      this.drive = DRIVE_BASE + DRIVE_STIFF_SPAN * stiffness + DRIVE_BREATH_SPAN * level;
      const brightness = clamp5(params.brightness, 0, 1);
      const corner = Math.min(BODY_MIN_HZ * (BODY_MAX_HZ / BODY_MIN_HZ) ** brightness, 0.45 * sr);
      this.bodyAlpha = 1 - Math.exp(-TWO_PI5 * corner / sr);
      this.attackCoeff = rampCoeff4(params.attackMs, sr);
      this.releaseCoeff = rampCoeff4(params.releaseMs, sr);
      this.breathNoise = clamp5(params.breathNoise, 0, 1) * BREATH_NOISE_DEPTH3;
      this.outputScale = OUTPUT_MIN + OUTPUT_SPAN * level;
    }
    render(pitchRatio) {
      const ratio = pitchRatio > 0.01 ? pitchRatio : 0.01;
      const coeff = this.releasing ? this.releaseCoeff : this.attackCoeff;
      this.level += coeff * (this.levelTarget - this.level);
      this.phaseA += this.incA * ratio;
      this.phaseA -= Math.floor(this.phaseA);
      const sawA = 2 * this.phaseA - 1;
      const gainA = sawA >= 0 ? 1 + this.asymmetry : 1 - this.asymmetry;
      let tongue = Math.tanh(this.drive * gainA * sawA);
      if (this.dual) {
        this.phaseB += this.incB * ratio;
        this.phaseB -= Math.floor(this.phaseB);
        const sawB = 2 * this.phaseB - 1;
        const gainB = sawB >= 0 ? 1 + this.asymmetry : 1 - this.asymmetry;
        tongue = 0.5 * (tongue + Math.tanh(this.drive * gainB * sawB));
      }
      if (this.breathNoise > 0) tongue += this.breathNoise * this.noise.bipolarAt(this.driveIndex);
      ++this.driveIndex;
      this.bodyState += this.bodyAlpha * (tongue - this.bodyState);
      return this.bodyState * this.level * this.outputScale;
    }
    release() {
      this.releasing = true;
      this.levelTarget = 0;
    }
    kill() {
      this.level = 0;
      this.levelTarget = 0;
      this.bodyState = 0;
      this.phaseA = 0;
      this.phaseB = 0;
      this.releasing = true;
    }
  };

  // src/tuner/dsp/dispersion.ts
  var DISP_PI = Math.PI;
  var DISP_TWO_PI = 2 * Math.PI;
  function allpassPhaseDelay(a, w) {
    const sinw = Math.sin(w);
    const cosw = Math.cos(w);
    const phi = Math.atan2(-sinw, a + cosw) - Math.atan2(-a * sinw, 1 + a * cosw);
    return -phi / Math.max(w, 1e-6);
  }
  function onepolePhaseDelay(a, w) {
    return Math.atan2(a * Math.sin(w), 1 - a * Math.cos(w)) / Math.max(w, 1e-6);
  }
  function dispersionAllpassA(bCoeff, w0, lpA, stages, phaseBudget) {
    if (bCoeff <= 0 || stages <= 0) return 0;
    const nMax = 0.8 * DISP_PI / Math.max(w0, 1e-6);
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
    let lo = -0.999;
    let hi = 0;
    for (let it = 0; it < 40; ++it) {
      const a2 = 0.5 * (lo + hi);
      const diff = allpassPhaseDelay(a2, w1) - allpassPhaseDelay(a2, wr);
      if (diff > need) lo = a2;
      else hi = a2;
    }
    let a = 0.5 * (lo + hi);
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
  var AllpassStage = class {
    state = 0;
    a = 0;
    reset() {
      this.state = 0;
    }
    process(x) {
      const y = this.a * x + this.state;
      this.state = x - this.a * y;
      return y;
    }
  };

  // src/tuner/dsp/ks-voice.ts
  var TWO_PI6 = 2 * Math.PI;
  var KS_MIN_FUNDAMENTAL_HZ = 20;
  var KS_DISPERSION_STAGES = 2;
  var KS_TENSION_CENTS_AT_FULL = 55;
  var KS_TENSION_MAX_CENTS = 65;
  var KS_TENSION_RELAX_MS = 45;
  var NOISE_INDEX_BASE = 1 << 16;
  var KEYOFF_NOISE_INDEX_BASE = 1 << 20;
  var KS_KEYOFF_MS = 18;
  var KS_KEYOFF_CUTOFF_HZ = 2200;
  function ksBufferCapacity(sampleRate2) {
    const sr = sampleRate2 > 0 ? sampleRate2 : 48e3;
    return Math.trunc(sr / KS_MIN_FUNDAMENTAL_HZ) + 8;
  }
  function noteToHz5(note) {
    return 440 * 2 ** (((note & 127) - 69) / 12);
  }
  function loopGainFor(periodSamples, sampleRate2, t60S) {
    const loopsToT60 = sampleRate2 * Math.max(0.01, t60S) / Math.max(1, periodSamples);
    return Math.exp(-6.907755279 / loopsToT60);
  }
  function ksSteelInharmonicityB(note) {
    const n = note & 127;
    const bAtA4 = 12e-5;
    const betaPerSemitone = 0.0578;
    return Math.max(1e-5, bAtA4 * Math.exp(betaPerSemitone * (n - 69)));
  }
  function clamp6(x, lo, hi) {
    return x < lo ? lo : x > hi ? hi : x;
  }
  var KsVoiceCore = class {
    buffer;
    polLine;
    octLine;
    basePeriod = 0;
    loopComp = 1;
    loopAlpha = 1;
    lpState = 0;
    dispA = 0;
    dispStages = [new AllpassStage(), new AllpassStage()];
    loopGain = 0;
    releaseGain = 0;
    slapThreshold = 0;
    // Second (horizontal) polarization.
    polSize = 0;
    polPeriod = 0;
    polLoopComp = 1;
    polLoopAlpha = 1;
    polLpState = 0;
    polLoopGain = 0;
    polReleaseGain = 0;
    polCouple = 0;
    polExc = 0;
    coupleGain = 0;
    // Excitation burst.
    noise = new VoiceRandomSequence();
    excTotal = 0;
    excPos = 0;
    pickDelay = 0;
    excAlpha = 1;
    excLp1 = 0;
    excLp2 = 0;
    pluckStyle = 0;
    pluckContact = 0;
    // Magnetic pickup.
    pickupDepth = 0;
    pickupDelayQ8 = 0;
    pickupMag = 0;
    // Tension modulation.
    tensionRatioPeak = 0;
    tensionEnv = 0;
    tensionDecayCoeff = 0;
    // Octave-up 4' companion line.
    octSize = 0;
    octPeriod = 0;
    octLoopComp = 1;
    octLoopAlpha = 1;
    octLpState = 0;
    octLoopGain = 0;
    octReleaseGain = 0;
    octCouple = 0;
    octExc = 0;
    // Key-off / damper noise burst.
    keyoffAmount = 0;
    keyoffPos = 0;
    keyoffLen = 0;
    keyoffLp = 0;
    keyoffAlpha = 1;
    keyoffDecay = 0;
    keyoffEnv = 0;
    constructor(sampleRate2) {
      const cap = ksBufferCapacity(sampleRate2);
      this.buffer = new DelayLine(cap);
      this.polLine = new DelayLine(cap);
      this.octLine = new DelayLine(cap);
    }
    start(params, sampleRate2, note, velocity, seed) {
      const sr = sampleRate2 > 0 ? sampleRate2 : 48e3;
      this.noise = new VoiceRandomSequence(seed);
      const f0 = noteToHz5(note);
      this.basePeriod = sr / f0;
      const a = (1 - clamp6(params.brightness, 0, 1)) * 0.7;
      this.loopAlpha = 1 - a;
      this.lpState = 0;
      const omega = TWO_PI6 / this.basePeriod;
      const tauLp = Math.atan2(a * Math.sin(omega), 1 - a * Math.cos(omega)) / Math.max(omega, 1e-6);
      this.loopComp = 1 + tauLp;
      this.dispA = 0;
      for (const s of this.dispStages) s.reset();
      const dispersion = clamp6(params.dispersion, 0, 1);
      if (dispersion > 0) {
        const bCoeff = dispersion * ksSteelInharmonicityB(note);
        const phaseBudget = this.basePeriod - 4 - tauLp;
        this.dispA = dispersionAllpassA(bCoeff, omega, a, KS_DISPERSION_STAGES, phaseBudget);
        if (this.dispA !== 0) {
          this.loopComp += KS_DISPERSION_STAGES * allpassPhaseDelay(this.dispA, omega);
          for (const s of this.dispStages) s.a = this.dispA;
        }
      }
      const stretch = clamp6(params.decayStretch, 0, 1);
      const octavesBelowA4 = (69 - (note & 127)) / 12;
      const t60 = Math.max(0.05, params.decayS) * 2 ** (stretch * octavesBelowA4);
      this.loopGain = loopGainFor(this.basePeriod, sr, t60);
      this.releaseGain = loopGainFor(this.basePeriod, sr, Math.max(0.01, params.releaseDampS));
      const slap = clamp6(params.slap, 0, 1);
      this.slapThreshold = slap > 0 ? 0.55 - 0.35 * slap : 0;
      this.excTotal = Math.max(8, Math.trunc(this.basePeriod));
      this.excPos = 0;
      this.pickDelay = Math.trunc(clamp6(params.pickPosition, 0, 0.5) * this.basePeriod + 0.5);
      const vel01 = (velocity & 127) / 127;
      const velAmount = clamp6(params.velToBrightness, 0, 1);
      const bright = clamp6(params.excBrightness, 0, 1) * (1 - velAmount + velAmount * vel01);
      const excCutoff = 300 * 2 ** (5.3 * bright);
      this.excAlpha = clamp6(1 - Math.exp(-6.28318530718 * excCutoff / sr), 0.01, 1);
      this.excLp1 = 0;
      this.excLp2 = 0;
      this.pluckStyle = clamp6(params.pluckStyle, 0, 1);
      if (this.pluckStyle > 0) {
        const nail = clamp6(params.nail, 0, 1);
        const frac = 0.9 - 0.75 * nail;
        this.pluckContact = Math.max(4, Math.trunc(frac * this.excTotal));
      } else {
        this.pluckContact = 0;
      }
      const pickup = clamp6(params.pickupPos, 0, 0.5);
      if (pickup > 0) {
        const offset = clamp6((1 - pickup) * this.basePeriod, 4, this.basePeriod);
        this.pickupDelayQ8 = Math.trunc(offset * 256);
        this.pickupDepth = 0.85;
        this.pickupMag = 0.18;
      } else {
        this.pickupDelayQ8 = 0;
        this.pickupDepth = 0;
        this.pickupMag = 0;
      }
      const tension = clamp6(params.tensionMod, 0, 1);
      if (tension > 0) {
        const riseCents = Math.min(KS_TENSION_MAX_CENTS, tension * vel01 * KS_TENSION_CENTS_AT_FULL);
        this.tensionRatioPeak = 2 ** (riseCents / 1200) - 1;
        this.tensionEnv = 1;
        this.tensionDecayCoeff = Math.exp(-1 / Math.max(1, KS_TENSION_RELAX_MS * 1e-3 * sr));
      } else {
        this.tensionRatioPeak = 0;
        this.tensionEnv = 0;
        this.tensionDecayCoeff = 0;
      }
      const size = Math.min(this.buffer.capacity, Math.trunc(this.basePeriod * 1.3) + 8);
      this.buffer.prime(size);
      const polarization = clamp6(params.polarization, 0, 1);
      this.polLpState = 0;
      if (polarization > 0) {
        const kPolDetuneCents = 11;
        this.polPeriod = this.basePeriod / 2 ** (kPolDetuneCents / 1200);
        const a2 = Math.min(0.97, a + 0.12);
        this.polLoopAlpha = 1 - a2;
        const omega2 = TWO_PI6 / this.polPeriod;
        const tau2 = Math.atan2(a2 * Math.sin(omega2), 1 - a2 * Math.cos(omega2)) / Math.max(omega2, 1e-6);
        this.polLoopComp = 1 + tau2;
        this.polLoopGain = loopGainFor(this.polPeriod, sr, 0.55 * t60);
        this.polReleaseGain = this.releaseGain;
        this.polExc = 0.6;
        this.polCouple = polarization;
        this.polSize = Math.min(this.polLine.capacity, Math.trunc(this.polPeriod * 1.3) + 8);
        this.polLine.prime(this.polSize);
        const bc = clamp6(params.bodyCoupling, 0, 1);
        if (bc > 0) {
          const kLambdaMax = 0.999;
          const mean = 0.5 * (this.loopGain + this.polLoopGain);
          const halfDiff = 0.5 * (this.loopGain - this.polLoopGain);
          const room = kLambdaMax - mean;
          let epsMax = 0;
          if (room > 0) {
            const r2 = room * room - halfDiff * halfDiff;
            if (r2 > 0) epsMax = Math.sqrt(r2);
          }
          this.coupleGain = bc * epsMax;
        } else {
          this.coupleGain = 0;
        }
      } else {
        this.polCouple = 0;
        this.polLoopGain = 0;
        this.coupleGain = 0;
      }
      const octaveMix = clamp6(params.octaveMix, 0, 1);
      this.octLpState = 0;
      if (octaveMix > 0) {
        this.octPeriod = 0.5 * this.basePeriod;
        this.octLoopAlpha = this.loopAlpha;
        const omegaO = TWO_PI6 / this.octPeriod;
        const tauO = Math.atan2(a * Math.sin(omegaO), 1 - a * Math.cos(omegaO)) / Math.max(omegaO, 1e-6);
        this.octLoopComp = 1 + tauO;
        this.octLoopGain = loopGainFor(this.octPeriod, sr, t60);
        this.octReleaseGain = loopGainFor(this.octPeriod, sr, Math.max(0.01, params.releaseDampS));
        this.octExc = 0.7;
        this.octCouple = octaveMix;
        this.octSize = Math.min(this.octLine.capacity, Math.trunc(this.octPeriod * 1.3) + 8);
        this.octLine.prime(this.octSize);
      } else {
        this.octCouple = 0;
        this.octLoopGain = 0;
        this.octSize = 0;
      }
      this.keyoffAmount = clamp6(params.keyoffNoise, 0, 1);
      this.keyoffLen = Math.max(1, Math.trunc(KS_KEYOFF_MS * 1e-3 * sr));
      this.keyoffPos = this.keyoffLen;
      this.keyoffLp = 0;
      this.keyoffEnv = 0;
      this.keyoffAlpha = clamp6(1 - Math.exp(-TWO_PI6 * KS_KEYOFF_CUTOFF_HZ / sr), 0.01, 1);
      this.keyoffDecay = Math.exp(-4 / this.keyoffLen);
    }
    sourceAt(k) {
      const nz = this.noise.bipolarAt(NOISE_INDEX_BASE + k);
      if (this.pluckStyle <= 0) return nz;
      let pluck = 0;
      if (k < this.pluckContact) {
        const win = 0.5 * (1 - Math.cos(TWO_PI6 * (k + 1) / (this.pluckContact + 1)));
        pluck = k < this.pluckContact >> 1 ? win : -win;
      }
      return nz + this.pluckStyle * (pluck - nz);
    }
    render(pitchRatio) {
      if (this.buffer.size < 8) return 0;
      let exc = 0;
      if (this.excPos < this.excTotal + this.pickDelay) {
        let burst = this.excPos < this.excTotal ? this.sourceAt(this.excPos) : 0;
        if (this.pickDelay > 0 && this.excPos >= this.pickDelay) {
          burst -= this.sourceAt(this.excPos - this.pickDelay);
        }
        ++this.excPos;
        this.excLp1 += this.excAlpha * (burst - this.excLp1);
        this.excLp2 += this.excAlpha * (this.excLp1 - this.excLp2);
        exc = 0.7 * this.excLp2;
      }
      let ratio = pitchRatio > 0.01 ? pitchRatio : 0.01;
      if (this.tensionRatioPeak !== 0 && this.tensionEnv > 1e-4) {
        ratio *= 1 + this.tensionRatioPeak * this.tensionEnv;
        this.tensionEnv *= this.tensionDecayCoeff;
      }
      const delay = clamp6(this.basePeriod / ratio - this.loopComp, 1, this.buffer.size - 4);
      const delayQ8 = Math.trunc(delay * 256);
      let fb = this.loopGain * this.lpState;
      if (this.coupleGain !== 0) fb += this.coupleGain * this.polLpState;
      let loopIn = exc + fb;
      if (this.slapThreshold > 0) {
        const kReflect = 0.06;
        const th = this.slapThreshold;
        if (loopIn > th) loopIn = th + (loopIn - th) * kReflect;
        else if (loopIn < -th) loopIn = -th + (loopIn + th) * kReflect;
      }
      let pickupTap = 0;
      if (this.pickupDepth !== 0) {
        pickupTap = this.buffer.readFractional(this.pickupDelayQ8);
      }
      const out = this.buffer.processFractional(delayQ8, loopIn);
      let shaped = out;
      if (this.dispA !== 0) {
        for (const stage of this.dispStages) shaped = stage.process(shaped);
      }
      this.lpState += this.loopAlpha * (shaped - this.lpState);
      let result;
      if (this.polCouple > 0) {
        const polDelay = clamp6(this.polPeriod / ratio - this.polLoopComp, 1, this.polSize - 4);
        const polDelayQ8 = Math.trunc(polDelay * 256);
        let polIn = this.polExc * exc + this.polLoopGain * this.polLpState;
        if (this.coupleGain !== 0) polIn += this.coupleGain * this.lpState;
        const polOut = this.polLine.processFractional(polDelayQ8, polIn);
        this.polLpState += this.polLoopAlpha * (polOut - this.polLpState);
        result = out + this.polCouple * polOut;
      } else {
        result = out;
      }
      if (this.octCouple > 0) {
        const octDelay = clamp6(this.octPeriod / ratio - this.octLoopComp, 1, this.octSize - 4);
        const octDelayQ8 = Math.trunc(octDelay * 256);
        const octIn = this.octExc * exc + this.octLoopGain * this.octLpState;
        const octOut = this.octLine.processFractional(octDelayQ8, octIn);
        this.octLpState += this.octLoopAlpha * (octOut - this.octLpState);
        result += this.octCouple * octOut;
      }
      if (this.keyoffPos < this.keyoffLen) {
        const nz = this.noise.bipolarAt(KEYOFF_NOISE_INDEX_BASE + this.keyoffPos);
        this.keyoffLp += this.keyoffAlpha * (nz - this.keyoffLp);
        result += this.keyoffAmount * this.keyoffEnv * this.keyoffLp;
        this.keyoffEnv *= this.keyoffDecay;
        ++this.keyoffPos;
      }
      if (this.pickupDepth !== 0) {
        let y = result - this.pickupDepth * pickupTap;
        y += this.pickupMag * y * y;
        result = y;
      }
      return result;
    }
    release() {
      this.loopGain = Math.min(this.loopGain, this.releaseGain);
      if (this.polCouple > 0) this.polLoopGain = Math.min(this.polLoopGain, this.polReleaseGain);
      if (this.octCouple > 0) this.octLoopGain = Math.min(this.octLoopGain, this.octReleaseGain);
      if (this.keyoffAmount > 0) {
        this.keyoffPos = 0;
        this.keyoffLp = 0;
        this.keyoffEnv = 1;
      }
    }
    kill() {
      this.excPos = this.excTotal;
      this.loopGain = 0;
      this.lpState = 0;
      this.polLoopGain = 0;
      this.polLpState = 0;
      this.octLoopGain = 0;
      this.octLpState = 0;
      this.keyoffPos = this.keyoffLen;
    }
  };

  // src/tuner/dsp/modal-voice.ts
  var MAX_MODAL_MODES = 8;
  var TWO_PI7 = 2 * Math.PI;
  function noteToHz6(note) {
    return 440 * 2 ** (((note & 127) - 69) / 12);
  }
  function radiusFor(sampleRate2, t60S) {
    return Math.exp(-6.907755279 / (sampleRate2 * Math.max(0.01, t60S)));
  }
  function emptyMode() {
    return { omega: 0, r: 0, gain: 0, a1: 0, a2: 0, y1: 0, y2: 0 };
  }
  var ModalVoiceCore = class {
    modes = Array.from({ length: MAX_MODAL_MODES }, emptyMode);
    numModes = 0;
    sampleRate = 48e3;
    cachedRatio = 0;
    releaseR = 1;
    excite = false;
    start(params, sampleRate2, note, velocity, seed) {
      this.sampleRate = sampleRate2 > 0 ? sampleRate2 : 48e3;
      const f0 = noteToHz6(note);
      const vel01 = (velocity & 127) / 127;
      const velAmount = clamp7(params.velToBrightness, 0, 1);
      const hardness = clamp7(params.strikeBrightness, 0, 1) * (1 - velAmount + velAmount * vel01);
      const stretch = clamp7(params.decayStretch, 0, 1);
      const octavesBelowA4 = (69 - (note & 127)) / 12;
      const t60 = Math.max(0.01, params.decayS) * 2 ** (stretch * octavesBelowA4);
      const scatter = new VoiceRandomSequence(seed);
      this.numModes = Math.min(Math.max(params.numModes, 0), MAX_MODAL_MODES);
      const nyquistLimit = 0.45 * this.sampleRate;
      for (let k = 0; k < this.numModes; ++k) {
        const src = params.modes[k];
        const mode = this.modes[k];
        const freq = f0 * Math.max(0.01, src.ratio);
        mode.y1 = 0;
        mode.y2 = 0;
        if (freq >= nyquistLimit) {
          mode.omega = 0;
          mode.r = 0;
          mode.gain = 0;
          continue;
        }
        mode.omega = TWO_PI7 * freq / this.sampleRate;
        mode.r = radiusFor(this.sampleRate, t60 * Math.max(0.01, src.decayScale));
        const mallet = Math.exp(-(1 - hardness) * 1.5 * k);
        const jitter = 1 + 0.1 * scatter.bipolarAt(k);
        mode.gain = Math.max(0, src.gain) * mallet * jitter * Math.sin(mode.omega);
      }
      for (let k = this.numModes; k < MAX_MODAL_MODES; ++k) this.modes[k] = emptyMode();
      this.releaseR = radiusFor(this.sampleRate, Math.max(0.01, params.releaseDampS));
      this.cachedRatio = 0;
      this.excite = true;
    }
    refreshCoefficients(pitchRatio) {
      this.cachedRatio = pitchRatio;
      for (let k = 0; k < this.numModes; ++k) {
        const mode = this.modes[k];
        if (mode.gain === 0 && mode.r === 0) continue;
        const w = Math.min(mode.omega * pitchRatio, 0.95 * Math.PI);
        mode.a1 = 2 * mode.r * Math.cos(w);
        mode.a2 = -mode.r * mode.r;
      }
    }
    render(pitchRatio) {
      if (this.numModes <= 0) return 0;
      if (pitchRatio !== this.cachedRatio) this.refreshCoefficients(pitchRatio);
      const x = this.excite ? 1 : 0;
      this.excite = false;
      let mix = 0;
      for (let k = 0; k < this.numModes; ++k) {
        const mode = this.modes[k];
        const y = mode.a1 * mode.y1 + mode.a2 * mode.y2 + mode.gain * x;
        mode.y2 = mode.y1;
        mode.y1 = y;
        mix += y;
      }
      return mix;
    }
    release() {
      for (let k = 0; k < this.numModes; ++k) {
        const mode = this.modes[k];
        if (mode.r > this.releaseR) mode.r = this.releaseR;
      }
      this.cachedRatio = 0;
    }
    kill() {
      for (const mode of this.modes) {
        mode.y1 = 0;
        mode.y2 = 0;
        mode.gain = 0;
      }
      this.excite = false;
      this.numModes = 0;
    }
  };
  function clamp7(x, lo, hi) {
    return x < lo ? lo : x > hi ? hi : x;
  }

  // src/tuner/dsp/percussion-voice.ts
  var MAX_PERCUSSION_MODES = 6;
  var MAX_SHELL_MODES = 4;
  var TWO_PI8 = 2 * Math.PI;
  var NOISE_INDEX_BASE2 = 2 ** 20;
  var WIRE_INDEX_BASE = 2 ** 24;
  var SHIMMER_INDEX_BASE = 2 ** 28;
  var PHISEM_PROB_INDEX_BASE = 2 ** 30;
  var PHISEM_NOISE_INDEX_BASE = 2 ** 31;
  var PHISEM_COLLISION_RATE = 100;
  function defaultPercussionParams() {
    return {
      gmKit: false,
      exclusiveClass: 0,
      numModes: 0,
      modeRatios: [1, 1.59, 2.14, 2.3, 2.65, 0],
      modeDecayS: 0.3,
      toneGain: 1,
      baseFreqHz: 0,
      pitchDrop: 0,
      pitchDropMs: 40,
      strikeR: 0,
      strikeTheta: 0,
      modeM: [0, 1, 2, 0, 3, 0],
      modeAlpha: [2.4048, 3.8317, 5.1356, 5.5201, 6.3802, 0],
      noiseGain: 0,
      noiseDecayMs: 150,
      noiseCutoffHz: 2500,
      noiseQ: 1,
      noiseOutput: "bandpass",
      shellMix: 0,
      shellNumModes: 0,
      shellFreqHz: [0, 0, 0, 0],
      shellT60S: [0.08, 0.06, 0.05, 0.04],
      shellWeight: [1, 0.7, 0.5, 0.35],
      wireBuzz: 0,
      wireThreshold: 0.1,
      wireCutoffHz: 4e3,
      shimmer: 0,
      shimmerAttackMs: 40,
      shimmerCutoffHz: 8e3,
      phisemBeans: 0,
      phisemEnergyMs: 100,
      phisemSoundMs: 3,
      phisemResHz: 0,
      phisemResQ: 1,
      phisemScrapeHz: 0,
      phisemPitchGlide: 0
    };
  }
  function noteToHz7(note) {
    return 440 * 2 ** (((note & 127) - 69) / 12);
  }
  function radiusFor2(sampleRate2, t60S) {
    return Math.exp(-6.907755279 / (sampleRate2 * Math.max(5e-3, t60S)));
  }
  function besselJ(m, x) {
    const order = Math.abs(Math.trunc(m));
    const half = 0.5 * x;
    const halfSq = half * half;
    let term = 1;
    for (let i = 1; i <= order; ++i) term *= half / i;
    let sum = term;
    for (let k = 1; k <= 24; ++k) {
      term *= -halfSq / (k * (k + order));
      sum += term;
      if (Math.abs(term) < 1e-12 * Math.abs(sum)) break;
    }
    return sum;
  }
  var TptSvf = class {
    sampleRate = 48e3;
    cutoffHz = 1e3;
    qValue = Math.SQRT1_2;
    k = Math.SQRT2;
    a1 = 0;
    a2 = 0;
    a3 = 0;
    ic1 = 0;
    ic2 = 0;
    prepare(sampleRate2) {
      this.sampleRate = sampleRate2 > 0 ? sampleRate2 : 48e3;
      this.set(this.cutoffHz, this.qValue);
      this.reset();
    }
    /** Set cutoff (Hz, clamped to [10, 0.49 * sr]) and Q (clamped to [0.5, 100]). */
    set(cutoffHz, q) {
      this.cutoffHz = clamp8(cutoffHz, 10, 0.49 * this.sampleRate);
      this.qValue = clamp8(q, 0.5, 100);
      const g = Math.tan(Math.PI * this.cutoffHz / this.sampleRate);
      this.k = 1 / this.qValue;
      this.a1 = 1 / (1 + g * (g + this.k));
      this.a2 = g * this.a1;
      this.a3 = g * this.a2;
    }
    reset() {
      this.ic1 = 0;
      this.ic2 = 0;
    }
    /** Advance one sample; returns the simultaneous LP/BP/HP outputs. */
    process(x) {
      const v3 = x - this.ic2;
      const v1 = this.a1 * this.ic1 + this.a2 * v3;
      const v2 = this.ic2 + this.a2 * this.ic1 + this.a3 * v3;
      this.ic1 = 2 * v1 - this.ic1;
      this.ic2 = 2 * v2 - this.ic2;
      return { lp: v2, bp: v1, hp: x - this.k * v1 - v2 };
    }
  };
  function emptyMode2() {
    return { omega: 0, r: 0, gain: 0, a1: 0, a2: 0, y1: 0, y2: 0 };
  }
  var PercussionVoiceCore = class {
    modes = Array.from({ length: MAX_PERCUSSION_MODES }, emptyMode2);
    numModes = 0;
    toneGain = 1;
    // Descending pitch envelope: ratio = 1 + dropState (one-pole decay).
    dropState = 0;
    dropCoeff = 0;
    cachedRatio = 0;
    excite = false;
    noise = new VoiceRandomSequence();
    noiseIndex = 0;
    noiseLevel = 0;
    noiseCoeff = 0;
    noiseFilter = new TptSvf();
    noiseOutput = "bandpass";
    shell = new BodyResonator();
    // Snare wire rattle: gated, velocity-scaled high-passed noise driven by the
    // membrane displacement crossing wireThreshold.
    wireBuzz = 0;
    wireThreshold = 0.1;
    wireVel01 = 0;
    wireIndex = 0;
    wireFilter = new TptSvf();
    // Nonlinear cymbal shimmer: a high-passed wash whose level follows the
    // membrane energy (tone^2) through a slow attack, so it swells after the
    // strike. One-way pump => stable.
    shimmer = 0;
    shimmerEnv = 0;
    shimmerAttackCoeff = 0;
    shimmerIndex = 0;
    shimmerFilter = new TptSvf();
    // Stochastic particle excitation (PhISEM: shakers / scrapers). A single
    // noise source scaled by an energy that each bead/ridge collision bumps,
    // with the system energy decaying over the shake, optionally through a
    // gourd/shell resonance (with a cuica pitch glide).
    phisemBeans = 0;
    phisemShakeEnergy = 0;
    phisemSysDecay = 0;
    phisemSoundLevel = 0;
    phisemSoundDecay = 0;
    phisemRate = 0;
    phisemScrapePhase = 0;
    phisemScrapeInc = 0;
    phisemResHz = 0;
    phisemResQ = 1;
    phisemGlideState = 0;
    phisemGlideCoeff = 0;
    phisemSr = 48e3;
    phisemProbIndex = 0;
    phisemNoiseIndex = 0;
    phisemFilter = new TptSvf();
    constructor(sampleRate2) {
      this.phisemSr = sampleRate2 > 0 ? sampleRate2 : 48e3;
    }
    start(params, sampleRate2, note, velocity, seed) {
      const sr = sampleRate2 > 0 ? sampleRate2 : 48e3;
      this.noise = new VoiceRandomSequence(seed);
      this.noiseIndex = 0;
      const baseHz = params.baseFreqHz > 0 ? params.baseFreqHz : noteToHz7(note);
      const vel01 = (velocity & 127) / 127;
      this.numModes = clampInt(params.numModes, 0, MAX_PERCUSSION_MODES);
      this.toneGain = Math.max(0, params.toneGain);
      const nyquistLimit = 0.45 * sr;
      for (let k = 0; k < this.numModes; ++k) {
        const ratio = params.modeRatios[k];
        const freq = baseHz * Math.max(0.01, ratio);
        if (ratio <= 0 || freq >= nyquistLimit) {
          this.modes[k] = emptyMode2();
          continue;
        }
        const mode = this.modes[k];
        mode.y1 = 0;
        mode.y2 = 0;
        mode.omega = TWO_PI8 * freq / sr;
        mode.r = radiusFor2(sr, Math.max(5e-3, params.modeDecayS) / Math.max(1, ratio));
        const strike = k === 0 ? 1 : (0.4 + 0.4 * vel01) / (k + 1);
        let strikePos = 1;
        if (params.strikeR > 0) {
          const m = Math.trunc(params.modeM[k]);
          const arg = params.modeAlpha[k] * params.strikeR;
          strikePos = Math.abs(besselJ(m, arg) * Math.cos(m * params.strikeTheta));
        }
        mode.gain = strike * Math.sin(mode.omega) * strikePos;
      }
      for (let k = this.numModes; k < MAX_PERCUSSION_MODES; ++k) this.modes[k] = emptyMode2();
      this.dropState = Math.max(0, params.pitchDrop);
      this.dropCoeff = Math.exp(-1 / (Math.max(1, params.pitchDropMs) * 1e-3 * sr));
      this.cachedRatio = 0;
      this.excite = this.numModes > 0;
      this.noiseLevel = Math.max(0, params.noiseGain) * (0.6 + 0.4 * vel01);
      this.noiseCoeff = Math.exp(-1 / (Math.max(1, params.noiseDecayMs) * 1e-3 * sr));
      this.noiseOutput = params.noiseOutput;
      this.noiseFilter.prepare(sr);
      this.noiseFilter.set(params.noiseCutoffHz, Math.max(0.5, params.noiseQ));
      this.noiseFilter.reset();
      const shellCount = clampInt(params.shellNumModes, 0, MAX_SHELL_MODES);
      const shellSpecs = [];
      for (let k = 0; k < shellCount; ++k) {
        const specHz = params.shellFreqHz[k];
        shellSpecs.push({
          freqHz: specHz > 0 ? specHz : baseHz,
          t60S: Math.max(5e-3, params.shellT60S[k]),
          weight: params.shellWeight[k]
        });
      }
      this.shell.startSpecs(shellSpecs, sr, params.shellMix);
      this.wireBuzz = Math.max(0, params.wireBuzz);
      this.wireThreshold = Math.max(0, params.wireThreshold);
      this.wireVel01 = vel01;
      this.wireIndex = 0;
      this.wireFilter.prepare(sr);
      this.wireFilter.set(params.wireCutoffHz, 0.9);
      this.wireFilter.reset();
      this.shimmer = Math.max(0, params.shimmer);
      this.shimmerEnv = 0;
      this.shimmerAttackCoeff = 1 - Math.exp(-1 / (Math.max(1, params.shimmerAttackMs) * 1e-3 * sr));
      this.shimmerIndex = 0;
      this.shimmerFilter.prepare(sr);
      this.shimmerFilter.set(params.shimmerCutoffHz, 0.7);
      this.shimmerFilter.reset();
      this.phisemBeans = Math.max(0, params.phisemBeans);
      this.phisemSr = sr;
      this.phisemProbIndex = 0;
      this.phisemNoiseIndex = 0;
      this.phisemSoundLevel = 0;
      this.phisemScrapePhase = 0;
      this.phisemGlideState = 0;
      if (this.phisemBeans > 0) {
        this.phisemShakeEnergy = 0.3 + 0.7 * vel01;
        this.phisemSysDecay = Math.exp(-1 / (Math.max(1, params.phisemEnergyMs) * 1e-3 * sr));
        this.phisemSoundDecay = Math.exp(-1 / (Math.max(0.2, params.phisemSoundMs) * 1e-3 * sr));
        this.phisemRate = PHISEM_COLLISION_RATE / sr;
        this.phisemScrapeInc = params.phisemScrapeHz > 0 ? params.phisemScrapeHz / sr : 0;
        this.phisemResHz = params.phisemResHz;
        this.phisemResQ = Math.max(0.5, params.phisemResQ);
        this.phisemGlideState = params.phisemPitchGlide;
        this.phisemGlideCoeff = Math.exp(-1 / (Math.max(1, params.phisemEnergyMs) * 1e-3 * sr));
        this.phisemFilter.prepare(sr);
        if (this.phisemResHz > 0) {
          const c = this.phisemResHz * (1 + this.phisemGlideState);
          this.phisemFilter.set(clamp8(c, 20, 0.45 * sr), this.phisemResQ);
        }
        this.phisemFilter.reset();
      }
    }
    /**
     * Renders one sample; `pitchRatio` is the common per-sample pitch factor
     * (multiplied with the internal descending pitch envelope).
     */
    render(pitchRatio) {
      let mix = 0;
      if (this.numModes > 0) {
        const ratio = pitchRatio * (1 + this.dropState);
        if (this.dropState > 0) {
          this.dropState *= this.dropCoeff;
          if (this.dropState < 1e-3) this.dropState = 0;
        }
        if (ratio !== this.cachedRatio) {
          this.cachedRatio = ratio;
          for (let k = 0; k < this.numModes; ++k) {
            const mode = this.modes[k];
            if (mode.gain === 0 && mode.r === 0) continue;
            const w = Math.min(mode.omega * ratio, 0.95 * Math.PI);
            mode.a1 = 2 * mode.r * Math.cos(w);
            mode.a2 = -mode.r * mode.r;
          }
        }
        const x = this.excite ? 1 : 0;
        this.excite = false;
        let tone = 0;
        for (let k = 0; k < this.numModes; ++k) {
          const mode = this.modes[k];
          const y = mode.a1 * mode.y1 + mode.a2 * mode.y2 + mode.gain * x;
          mode.y2 = mode.y1;
          mode.y1 = y;
          tone += y;
        }
        mix += this.toneGain * tone;
        if (this.wireBuzz > 0) {
          const contact = Math.abs(tone) - this.wireThreshold;
          const gate = contact > 0 ? Math.min(contact * 8, 1) : 0;
          const n = this.noise.bipolarAt(WIRE_INDEX_BASE + this.wireIndex++) * gate * this.wireVel01 * this.wireBuzz;
          mix += this.wireFilter.process(n).hp;
        }
        if (this.shimmer > 0) {
          this.shimmerEnv += (tone * tone - this.shimmerEnv) * this.shimmerAttackCoeff;
          const n = this.noise.bipolarAt(SHIMMER_INDEX_BASE + this.shimmerIndex++);
          mix += this.shimmerFilter.process(n * this.shimmerEnv * this.shimmer).hp;
        }
      }
      if (this.noiseLevel > 1e-5) {
        const burst = this.noise.bipolarAt(NOISE_INDEX_BASE2 + this.noiseIndex++) * this.noiseLevel;
        this.noiseLevel *= this.noiseCoeff;
        const out = this.noiseFilter.process(burst);
        if (this.noiseOutput === "highpass") mix += out.hp;
        else if (this.noiseOutput === "lowpass") mix += out.lp;
        else mix += out.bp;
      }
      if (this.phisemBeans > 0) {
        this.phisemShakeEnergy *= this.phisemSysDecay;
        let collide = false;
        if (this.phisemScrapeInc > 0) {
          this.phisemScrapePhase += this.phisemScrapeInc;
          if (this.phisemScrapePhase >= 1) {
            this.phisemScrapePhase -= 1;
            collide = true;
          }
        }
        const p = this.phisemBeans * this.phisemShakeEnergy * this.phisemRate;
        if (this.noise.unipolarAt(PHISEM_PROB_INDEX_BASE + this.phisemProbIndex++) < p) {
          collide = true;
        }
        if (collide) {
          this.phisemSoundLevel = Math.min(this.phisemSoundLevel + this.phisemShakeEnergy * 0.6, 4);
        }
        let particle = this.noise.bipolarAt(PHISEM_NOISE_INDEX_BASE + this.phisemNoiseIndex++) * this.phisemSoundLevel;
        this.phisemSoundLevel *= this.phisemSoundDecay;
        if (this.phisemResHz > 0) {
          if (this.phisemGlideState !== 0) {
            this.phisemGlideState *= this.phisemGlideCoeff;
            if (Math.abs(this.phisemGlideState) < 1e-3) this.phisemGlideState = 0;
            const c = this.phisemResHz * (1 + this.phisemGlideState);
            this.phisemFilter.set(clamp8(c, 20, 0.45 * this.phisemSr), this.phisemResQ);
          }
          particle = this.phisemFilter.process(particle).bp;
        }
        mix += particle;
      }
      if (this.shell.active()) mix = this.shell.process(mix);
      return mix;
    }
    /**
     * Kit pieces play one-shot in the host (the patch's one_shot flag), so
     * note-off never chokes a strike; the C++ core has no release path either.
     */
    release() {
    }
    /** Immediate silence. */
    kill() {
      for (const mode of this.modes) {
        mode.y1 = 0;
        mode.y2 = 0;
        mode.gain = 0;
      }
      this.numModes = 0;
      this.noiseLevel = 0;
      this.excite = false;
      this.shell.reset();
      this.wireBuzz = 0;
      this.wireFilter.reset();
      this.shimmer = 0;
      this.shimmerEnv = 0;
      this.shimmerFilter.reset();
      this.phisemBeans = 0;
      this.phisemShakeEnergy = 0;
      this.phisemSoundLevel = 0;
      this.phisemFilter.reset();
    }
  };
  function clamp8(x, lo, hi) {
    return x < lo ? lo : x > hi ? hi : x;
  }
  function clampInt(x, lo, hi) {
    const t = Math.trunc(x);
    return t < lo ? lo : t > hi ? hi : t;
  }

  // src/tuner/dsp/piano-voice.ts
  var TWO_PI9 = 2 * Math.PI;
  var MAX_PIANO_STRINGS = 3;
  var PIANO_DISPERSION_STAGES = 4;
  var PIANO_MIN_FUNDAMENTAL_HZ = 26;
  var HAMMER_MF_VEL = 0.6;
  var HAMMER_DYN_BRIGHT_OCT = 1.5;
  var CONTACT_PERIODS_AT_C4 = 0.503038;
  var CONTACT_PERIODS_PER_OCT = 0.613525;
  var CONTACT_PERIODS_MAX = 2;
  var TREBLE_DECAY_OCT = 1.94164;
  var TWO_STAGE_WIDTH_OCT = 0.616718;
  var TREBLE_TAPER_OCT_CAP = 1.5;
  var TREBLE_BRIGHT_PER_OCT = 0.06;
  var BASS_DARK_PER_OCT = 0.15;
  var UNISON_STIFF_JITTER = 0.05;
  var UNISON_STRIKE_UNEVEN = 0.15;
  var UNISON_RAD_SPREAD = 0.6;
  var STRIKE_NOISE_GAIN = 0.6;
  var STRIKE_NOISE_TAU_MS = 8;
  var STRIKE_NOISE_MAX_MS = 30;
  var STRIKE_NOISE_CUTOFF_SCALE = 0.487539;
  var NOISE_CUTOFF_BASS_OCT = 0.5;
  var NOISE_STEEP_RATIO = 4;
  var HAMMER_WIDTH_HARMONICS = 2.69125;
  var STRIKE_NOISE_INJECT = 0.298027;
  var INJECT_TREBLE_TAPER_OCT = 0.654102;
  var INJECT_BASS_BOOST_OCT = 1.23607;
  var NOISE_TREBLE_TAPER_OCT = 1.08754;
  var KNOCK_GAIN = 2.6;
  var KNOCK_THUD_HZ = 350;
  var KNOCK_THUD_BASS_OCT = 0.7;
  var BLOOM_TAU_MS_C4 = 4.6604;
  var BLOOM_TAU_OCT = 0.9;
  var STRING_YIELD = 0.8;
  var INJ_TILT_DB_OCT = 3.5;
  var YIELD_TREBLE_OCT = 2;
  var KNOCK_BASS_BOOST_OCT = 1.3;
  var KNOCK_TREBLE_TAPER_OCT = 2;
  var WIDTH_BASS_OCT = -1.96668;
  var WIDTH_TREBLE_OCT = 0.81966;
  var STRIKE_POS_BASS_OCT = 0.556;
  var RADIATION_HP_HZ = 95;
  var RADIATION_HP_Q = 0.6;
  var BRIDGE_HILL_HZ = 1485.15;
  var BRIDGE_HILL_GAIN_DB = 9.91486;
  var BRIDGE_HILL_Q = 2.40983;
  var HAMMER_COMB_CAPACITY = 2048;
  function defaultPianoParams() {
    return {
      strings: 3,
      detuneCents: 1.6,
      decayFastS: 3,
      decaySlowS: 12,
      decayStretch: 0.7,
      brightness: 0.75,
      dispersion: 1,
      strikePosition: 0.085,
      hammerExponent: 2.5,
      hammerContactMs: 1.2,
      hammerDynamics: 0,
      soundboard: 0.25,
      releaseDampS: 0.1
    };
  }
  function pianoStringCapacity(sampleRate2) {
    const sr = sampleRate2 > 0 ? sampleRate2 : 48e3;
    return Math.trunc(sr / PIANO_MIN_FUNDAMENTAL_HZ) + 8;
  }
  function pianoInharmonicityB(note) {
    const n = note & 127;
    const bAtA4 = 7e-4;
    const betaPerSemitone = 0.091575;
    return Math.max(bAtA4 * Math.exp(betaPerSemitone * (n - 69)), 2e-5);
  }
  function pianoUnisonStrings(note) {
    const n = note & 127;
    if (n <= 29) return 1;
    if (n <= 47) return 2;
    return 3;
  }
  function pianoStretchCents(note) {
    const x = ((note & 127) - 69) / 39;
    return clamp9(14 * x * x * x, -22, 22);
  }
  function noteToHz8(note) {
    return 440 * 2 ** (((note & 127) - 69) / 12);
  }
  function loopGainFor2(periodSamples, sampleRate2, t60S) {
    const loopsToT60 = sampleRate2 * Math.max(0.01, t60S) / Math.max(1, periodSamples);
    return Math.exp(-6.907755279 / loopsToT60);
  }
  function clamp9(x, lo, hi) {
    return x < lo ? lo : x > hi ? hi : x;
  }
  var PianoVoiceCore = class {
    strings;
    numStrings = 0;
    loopAlpha = 1;
    bridge = 0;
    /** Damper loop-gain cap installed by release(). */
    releaseGain = 0;
    // Dynamic felt hammer: a unit mass on a nonlinear spring (F = k*x^p with a
    // hysteretic loss term) integrated per sample against the string's motion at
    // the strike point.
    hammerAmp = 0;
    hamOn = false;
    hamTtl = 0;
    hamY = 0;
    hamV = 0;
    hamK = 0;
    hamP = 2.5;
    hamMu = 0;
    hamForceNorm = 0;
    hamExit = -1;
    ys = 0;
    ysAdm = 0;
    lastForce = 0;
    combDelay = 0;
    combIdx = 0;
    combTail = 0;
    combHist = new Float32Array(HAMMER_COMB_CAPACITY);
    /** Strike-position comb history for the injected scrub noise. */
    noiseHist = new Float32Array(HAMMER_COMB_CAPACITY);
    knockGain = 0.6;
    knockLp = 0;
    knockLp2 = 0;
    knockLp3 = 0;
    knockLp3A = 0;
    knockLpA = 0;
    bloom = 1;
    bloomA = 1;
    excAlpha = 1;
    excLp = 0;
    excLp2 = 0;
    // Soundboard radiation highpass (biquad, b2 == b0).
    hpB0 = 1;
    hpB1 = 0;
    hpA1 = 0;
    hpA2 = 0;
    hpX1 = 0;
    hpX2 = 0;
    hpY1 = 0;
    hpY2 = 0;
    // Bridge-hill radiation emphasis (peaking biquad).
    bhB0 = 1;
    bhB1 = 0;
    bhB2 = 0;
    bhA1 = 0;
    bhA2 = 0;
    bhX1 = 0;
    bhX2 = 0;
    bhY1 = 0;
    bhY2 = 0;
    // Felt impact noise (broadband thump radiated with the knock at strike).
    noisePos = 0;
    noiseSamples = 0;
    noiseEnv = 0;
    noiseDecay = 0;
    noiseAlpha = 1;
    noiseInject = 0;
    noiseLp = 0;
    noiseLp2 = 0;
    noiseLp3 = 0;
    noiseAlpha3 = 1;
    noiseLow = 0;
    noiseHpA = 0;
    noiseRng = 1;
    constructor(sampleRate2) {
      const cap = pianoStringCapacity(sampleRate2);
      this.strings = Array.from({ length: MAX_PIANO_STRINGS }, () => ({
        line: new DelayLine(cap),
        basePeriod: 0,
        comp: 1,
        strikeWeight: 1,
        radiateWeight: 1,
        lpState: 0,
        ap: Array.from({ length: PIANO_DISPERSION_STAGES }, () => new AllpassStage()),
        gSlow: 0,
        gFast: 0
      }));
    }
    start(params, sampleRate2, note, velocity, seed) {
      const sr = sampleRate2 > 0 ? sampleRate2 : 48e3;
      const f0 = noteToHz8(note) * 2 ** (pianoStretchCents(note) / 1200);
      const period = sr / f0;
      const w0 = TWO_PI9 / period;
      const jitter = new VoiceRandomSequence(seed);
      const octavesAboveC4 = Math.min(Math.max(0, ((note & 127) - 60) / 12), TREBLE_TAPER_OCT_CAP);
      const octavesBelowC4 = Math.max(0, -((note & 127) - 60) / 12);
      const brightEff = clamp9(
        clamp9(params.brightness, 0, 1) - TREBLE_BRIGHT_PER_OCT * octavesAboveC4 - BASS_DARK_PER_OCT * octavesBelowC4,
        0.05,
        1
      );
      const lpA = (1 - brightEff) * 0.6;
      this.loopAlpha = 1 - lpA;
      const tauLp = onepolePhaseDelay(lpA, w0);
      const dispersion = clamp9(params.dispersion, 0, 1);
      const bCoeff = pianoInharmonicityB(note) * dispersion;
      const phaseBudget = period - 4 - tauLp;
      const apA = dispersionAllpassA(bCoeff, w0, lpA, PIANO_DISPERSION_STAGES, phaseBudget);
      const stretch = clamp9(params.decayStretch, 0, 1);
      const octavesBelowA4 = (69 - (note & 127)) / 12;
      const bassScale = 2 ** (stretch * octavesBelowA4);
      const slowScale = bassScale * 2 ** (-TREBLE_DECAY_OCT * octavesAboveC4);
      const t60Slow = Math.max(0.05, Math.max(params.decayFastS, params.decaySlowS) * slowScale);
      const octFromC4Signed = ((note & 127) - 60) / 12;
      const contrast = Math.exp(
        -(octFromC4Signed * octFromC4Signed) / (TWO_STAGE_WIDTH_OCT * TWO_STAGE_WIDTH_OCT)
      );
      const invFastFull = 1 / Math.max(0.05, params.decayFastS * bassScale);
      const invSlow = 1 / t60Slow;
      const t60Fast = Math.min(
        t60Slow,
        1 / (invSlow + contrast * Math.max(0, invFastFull - invSlow))
      );
      this.numStrings = clamp9(
        Math.min(params.strings, pianoUnisonStrings(note)),
        1,
        MAX_PIANO_STRINGS
      );
      const spread = Math.max(0, params.detuneCents);
      const strikeW = [];
      let strikeMean = 0;
      for (let i = 0; i < this.numStrings; ++i) {
        let w = 1;
        if (this.numStrings > 1) {
          w -= UNISON_STRIKE_UNEVEN * i / (this.numStrings - 1);
          w *= 1 + 0.1 * jitter.bipolarAt(16 + i);
        }
        strikeW.push(Math.max(w, 0.1));
        strikeMean += strikeW[i];
      }
      strikeMean /= this.numStrings;
      for (let i = 0; i < this.numStrings; ++i) {
        const s = this.strings[i];
        let offset = 0;
        if (this.numStrings > 1) {
          offset = spread * (i / (this.numStrings - 1) - 0.5);
          offset *= 1 + 0.2 * jitter.bipolarAt(i);
        }
        const detuneRatio = 2 ** (offset / 1200);
        s.basePeriod = period / detuneRatio;
        s.strikeWeight = strikeW[i] / strikeMean;
        s.radiateWeight = 1;
        if (this.numStrings > 1) {
          s.radiateWeight += UNISON_RAD_SPREAD * (i / (this.numStrings - 1) - 0.5) * (1 + 0.3 * jitter.bipolarAt(40 + i));
        }
        const apAJit = clamp9(apA * (1 + UNISON_STIFF_JITTER * jitter.bipolarAt(24 + i)), -0.998, 0);
        for (const stage of s.ap) {
          stage.a = apAJit;
          stage.reset();
        }
        s.lpState = 0;
        const tauAp = allpassPhaseDelay(apAJit, w0);
        s.comp = 1 + tauLp + PIANO_DISPERSION_STAGES * tauAp;
        const lpH1Gain = (1 - lpA) / Math.sqrt(Math.max(1e-9, 1 - 2 * lpA * Math.cos(w0) + lpA * lpA));
        const lpComp = Math.min(1 / Math.max(1e-3, lpH1Gain), 1 / 0.9);
        s.gSlow = Math.min(0.99997, loopGainFor2(s.basePeriod, sr, t60Slow) * lpComp);
        s.gFast = Math.min(s.gSlow, loopGainFor2(s.basePeriod, sr, t60Fast) * lpComp);
        s.line.prime(Math.min(s.line.capacity, Math.trunc(s.basePeriod * 1.3) + 8));
      }
      this.bridge = 0;
      const anchorLowNote = 48;
      const anchorHighNote = 60;
      const bassSpan = 20;
      const trebleSpan = 10;
      const bassGain = 0.4;
      const trebleGain = -0.45;
      const noteF = note & 127;
      let damperKeytrack = 1;
      if (noteF < anchorLowNote) {
        const x = clamp9((anchorLowNote - noteF) / bassSpan, 0, 1);
        damperKeytrack += bassGain * x * x * (3 - 2 * x);
      } else if (noteF > anchorHighNote) {
        const x = clamp9((noteF - anchorHighNote) / trebleSpan, 0, 1);
        damperKeytrack += trebleGain * x * x * (3 - 2 * x);
      }
      this.releaseGain = loopGainFor2(
        period,
        sr,
        Math.max(0.01, params.releaseDampS * damperKeytrack)
      );
      const vel01 = Math.max((velocity & 127) / 127, 0.02);
      const p = clamp9(params.hammerExponent, 1.5, 4);
      const ampExp = 2 * p / (p + 1);
      const dyn = clamp9(params.hammerDynamics, 0, 1);
      let contactMs = clamp9(params.hammerContactMs, 0.2, 10) * 2 ** (-((note & 127) - 69) / 13.1212);
      const octavesFromC4 = ((note & 127) - 60) / 12;
      const contactFloorPeriods = clamp9(
        CONTACT_PERIODS_AT_C4 + CONTACT_PERIODS_PER_OCT * octavesFromC4,
        0,
        CONTACT_PERIODS_MAX
      );
      contactMs = Math.max(contactMs, contactFloorPeriods * 1e3 * period / sr);
      const tauMf = Math.max(8, contactMs * 1e-3 * sr);
      const cP = 3.28 - 0.066 * p;
      this.hamP = p;
      this.hamK = (cP / tauMf) ** (p + 1);
      this.hamMu = 0.229431;
      this.hamY = 0;
      this.hamV = (vel01 / HAMMER_MF_VEL) ** (1 + 0.6 * dyn);
      this.hamOn = true;
      this.hamTtl = Math.trunc(3 * tauMf);
      const xMaxMf = (0.5 * (p + 1) / this.hamK) ** (1 / (p + 1));
      const fPeakMf = this.hamK * xMaxMf ** p;
      this.hammerAmp = 0.9 * vel01 ** ampExp;
      const mfLevel = 0.9 * HAMMER_MF_VEL ** ampExp;
      this.hamForceNorm = fPeakMf > 1e-12 ? mfLevel / fPeakMf : 0;
      this.hamForceNorm *= 2 ** (INJ_TILT_DB_OCT * clamp9(octavesFromC4, -1.25, 1.25) / 6.0206);
      const yieldKt = STRING_YIELD * 2 ** (-YIELD_TREBLE_OCT * Math.max(0, octavesFromC4));
      this.ysAdm = 0.5 * yieldKt * xMaxMf;
      this.ys = 0;
      this.lastForce = 0;
      this.hamExit = -xMaxMf;
      const strikePos = clamp9(params.strikePosition, 0, 0.5) * 2 ** (STRIKE_POS_BASS_OCT * Math.max(0, -octavesFromC4));
      this.combDelay = Math.trunc(Math.min(strikePos, 0.5) * period + 0.5);
      this.combDelay = Math.min(this.combDelay, HAMMER_COMB_CAPACITY - 1);
      this.combIdx = 0;
      this.combTail = 0;
      this.combHist.fill(0);
      this.noiseHist.fill(0);
      const dynBright = 2 ** (HAMMER_DYN_BRIGHT_OCT * dyn * (vel01 - HAMMER_MF_VEL));
      const excCutoff = 800 * 2 ** (3 * vel01) * dynBright;
      const widthHarm = HAMMER_WIDTH_HARMONICS * 2 ** (WIDTH_BASS_OCT * Math.max(0, -octavesFromC4) + WIDTH_TREBLE_OCT * Math.max(0, octavesFromC4));
      const widthCutoff = Math.min(excCutoff, widthHarm * f0 * dynBright);
      this.excAlpha = clamp9(1 - Math.exp(-TWO_PI9 * widthCutoff / sr), 0.01, 1);
      const noiseCutoff = STRIKE_NOISE_CUTOFF_SCALE * excCutoff * 2 ** (-NOISE_CUTOFF_BASS_OCT * Math.max(0, -octavesFromC4));
      this.noiseAlpha = clamp9(1 - Math.exp(-TWO_PI9 * noiseCutoff / sr), 0.01, 1);
      this.noiseAlpha3 = clamp9(
        1 - Math.exp(-TWO_PI9 * NOISE_STEEP_RATIO * noiseCutoff / sr),
        0.01,
        1
      );
      this.excLp = 0;
      this.excLp2 = 0;
      this.noiseEnv = STRIKE_NOISE_GAIN * this.hammerAmp * dynBright * 2 ** (-NOISE_TREBLE_TAPER_OCT * Math.max(0, octavesFromC4) + INJ_TILT_DB_OCT * clamp9(octavesFromC4, -1.25, 1.25) / 6.0206);
      this.knockGain = KNOCK_GAIN * 2 ** (KNOCK_BASS_BOOST_OCT * Math.max(0, -octavesFromC4) - KNOCK_TREBLE_TAPER_OCT * Math.max(0, octavesFromC4));
      this.knockLp = 0;
      this.knockLp2 = 0;
      this.knockLp3 = 0;
      const thudHz = KNOCK_THUD_HZ * 2 ** (-KNOCK_THUD_BASS_OCT * Math.max(0, -octavesFromC4));
      this.knockLpA = clamp9(1 - Math.exp(-TWO_PI9 * thudHz / sr), 0, 1);
      this.knockLp3A = clamp9(1 - Math.exp(-TWO_PI9 * NOISE_STEEP_RATIO * thudHz / sr), 0, 1);
      this.bloom = 0;
      const bloomTauS = BLOOM_TAU_MS_C4 * 1e-3 * 2 ** (-BLOOM_TAU_OCT * octavesFromC4);
      this.bloomA = clamp9(1 - Math.exp(-1 / (bloomTauS * sr)), 1e-4, 1);
      this.noiseDecay = Math.exp(-1e3 / (STRIKE_NOISE_TAU_MS * sr));
      this.noiseSamples = Math.trunc(STRIKE_NOISE_MAX_MS * 1e-3 * sr);
      this.noisePos = 0;
      this.noiseLp = 0;
      this.noiseLp2 = 0;
      this.noiseLp3 = 0;
      this.noiseLow = 0;
      this.noiseHpA = clamp9(1 - Math.exp(-TWO_PI9 * 1.2 * f0 / sr), 0, 1);
      this.noiseRng = (Number((seed ^ seed >> 32n ^ 0x9e3779b9n) & 0xffffffffn) | 1) >>> 0;
      this.noiseInject = STRIKE_NOISE_INJECT * 2 ** (-INJECT_TREBLE_TAPER_OCT * Math.max(0, octavesFromC4) + INJECT_BASS_BOOST_OCT * Math.max(0, -octavesFromC4));
      {
        const w = TWO_PI9 * RADIATION_HP_HZ / sr;
        const cw = Math.cos(w);
        const alpha = Math.sin(w) / (2 * RADIATION_HP_Q);
        const a0 = 1 + alpha;
        this.hpB0 = (1 + cw) * 0.5 / a0;
        this.hpB1 = -(1 + cw) / a0;
        this.hpA1 = -2 * cw / a0;
        this.hpA2 = (1 - alpha) / a0;
        this.hpX1 = 0;
        this.hpX2 = 0;
        this.hpY1 = 0;
        this.hpY2 = 0;
      }
      {
        const bigA = 10 ** (BRIDGE_HILL_GAIN_DB / 40);
        const w = TWO_PI9 * BRIDGE_HILL_HZ / sr;
        const cw = Math.cos(w);
        const alpha = Math.sin(w) / (2 * BRIDGE_HILL_Q);
        const a0 = 1 + alpha / bigA;
        this.bhB0 = (1 + alpha * bigA) / a0;
        this.bhB1 = -2 * cw / a0;
        this.bhB2 = (1 - alpha * bigA) / a0;
        this.bhA1 = -2 * cw / a0;
        this.bhA2 = (1 - alpha / bigA) / a0;
        this.bhX1 = 0;
        this.bhX2 = 0;
        this.bhY1 = 0;
        this.bhY2 = 0;
      }
    }
    render(pitchRatio) {
      if (this.numStrings <= 0) return 0;
      let exc = 0;
      let knock = 0;
      let thudIn = 0;
      let force = 0;
      let x = 0;
      if (this.hamOn) {
        const ysVel = this.ysAdm * this.lastForce;
        this.ys = Math.min(this.ys + ysVel, this.hamExit * -0.7);
        x = this.hamY - this.ys;
        if (x > 0) {
          const xdot = this.hamV - ysVel;
          force = this.hamK * x ** this.hamP * (1 + this.hamMu * xdot);
          force = Math.max(force, 0);
          this.hamV -= force;
        }
        this.hamY += this.hamV;
        if (x <= 0 && this.hamV < 0 && this.hamY - this.ys < this.hamExit || --this.hamTtl <= 0) {
          this.hamOn = false;
          this.combTail = this.combDelay;
        }
      }
      if (this.hamOn || this.combTail > 0) {
        if (!this.hamOn) --this.combTail;
        const tap = this.combHist[(this.combIdx - this.combDelay + HAMMER_COMB_CAPACITY) % HAMMER_COMB_CAPACITY];
        this.combHist[this.combIdx] = force;
        this.combIdx = (this.combIdx + 1) % HAMMER_COMB_CAPACITY;
        const combed = this.hamForceNorm * (force - tap);
        this.excLp += this.excAlpha * (combed - this.excLp);
        this.excLp2 += this.excAlpha * (this.excLp - this.excLp2);
        exc = this.excLp2 / this.numStrings;
        thudIn = this.excLp2;
        this.lastForce = force;
      }
      if (this.noisePos < this.noiseSamples) {
        ++this.noisePos;
        this.noiseRng = Math.imul(this.noiseRng, 1664525) + 1013904223 >>> 0;
        const white = (this.noiseRng >>> 8) * (1 / 8388608) - 1;
        this.noiseLp += this.noiseAlpha * (white - this.noiseLp);
        this.noiseLp2 += this.noiseAlpha * (this.noiseLp - this.noiseLp2);
        this.noiseLp3 += this.noiseAlpha3 * (this.noiseLp2 - this.noiseLp3);
        const noise = this.noiseEnv * this.noiseLp3;
        this.noiseEnv *= this.noiseDecay;
        thudIn += noise;
        this.noiseLow += this.noiseHpA * (noise - this.noiseLow);
        const scrub = this.noiseInject * (noise - this.noiseLow);
        const widx = (this.noisePos - 1) % HAMMER_COMB_CAPACITY;
        this.noiseHist[widx] = scrub;
        const tapI = this.noisePos - 1 - this.combDelay;
        const tap = tapI >= 0 ? this.noiseHist[tapI % HAMMER_COMB_CAPACITY] : 0;
        exc += (scrub - tap) / this.numStrings;
      }
      this.knockLp += this.knockLpA * (thudIn - this.knockLp);
      this.knockLp2 += this.knockLpA * (this.knockLp - this.knockLp2);
      this.knockLp3 += this.knockLp3A * (this.knockLp2 - this.knockLp3);
      knock += this.knockGain * this.knockLp3;
      const ratio = pitchRatio > 0.01 ? pitchRatio : 0.01;
      let sum = 0;
      let lpSum = 0;
      for (let i = 0; i < this.numStrings; ++i) {
        const s = this.strings[i];
        if (s.line.size < 8) continue;
        const fb = s.gSlow * s.lpState - (s.gSlow - s.gFast) * this.bridge;
        const delay = clamp9(s.basePeriod / ratio - s.comp, 1, s.line.size - 4);
        const out = s.line.processFractional(Math.trunc(delay * 256), exc * s.strikeWeight + fb);
        let v = out;
        for (const stage of s.ap) v = stage.process(v);
        s.lpState += this.loopAlpha * (v - s.lpState);
        lpSum += s.lpState;
        sum += out * s.radiateWeight;
      }
      this.bridge = lpSum / this.numStrings;
      this.bloom += this.bloomA * (1 - this.bloom);
      sum = sum * this.bloom + knock;
      const y = this.hpB0 * sum + this.hpB1 * this.hpX1 + this.hpB0 * this.hpX2 - this.hpA1 * this.hpY1 - this.hpA2 * this.hpY2;
      this.hpX2 = this.hpX1;
      this.hpX1 = sum;
      this.hpY2 = this.hpY1;
      this.hpY1 = y;
      const z = this.bhB0 * y + this.bhB1 * this.bhX1 + this.bhB2 * this.bhX2 - this.bhA1 * this.bhY1 - this.bhA2 * this.bhY2;
      this.bhX2 = this.bhX1;
      this.bhX1 = y;
      this.bhY2 = this.bhY1;
      this.bhY1 = z;
      return z;
    }
    /** Note-off: the damper caps both decay stages at releaseDampS. */
    release() {
      for (let i = 0; i < this.numStrings; ++i) {
        const s = this.strings[i];
        s.gSlow = Math.min(s.gSlow, this.releaseGain);
        s.gFast = Math.min(s.gFast, this.releaseGain);
      }
    }
    /** Immediate silence. */
    kill() {
      this.numStrings = 0;
      this.hammerAmp = 0;
      this.hamOn = false;
      this.noisePos = 0;
      this.noiseSamples = 0;
      this.noiseEnv = 0;
      this.noiseLp = 0;
      this.noiseLp2 = 0;
      this.noiseLp3 = 0;
      for (const s of this.strings) {
        s.lpState = 0;
        s.gSlow = 0;
        s.gFast = 0;
      }
      this.bridge = 0;
    }
  };

  // src/tuner/dsp/pipe-organ-voice.ts
  var TWO_PI10 = 2 * Math.PI;
  var MAX_PIPE_RANKS = 8;
  var PIPE_MIN_FUNDAMENTAL_HZ = 16;
  var BREATH_BASE3 = 0.8;
  var BREATH_SPAN3 = 0.35;
  var JET_RATIO_OPEN = 0.5;
  var REFLECT_MAX2 = 0.62;
  var REFLECT_CORNER_BASE = 1.6;
  var REFLECT_CORNER_SPAN = 3.4;
  var PITCH_CORRECT_OPEN = 1.0012;
  var DC_CORNER_HZ3 = 10;
  var EVEN_PUMP_GAIN2 = 0.62;
  var EVEN_PUMP_STOPPED = 0.08;
  var EVEN_PUMP_DC_HZ2 = 30;
  var REED_ASYM = 0.55;
  var REED_DRIVE = 0.5;
  var RADIATION_CORNER_HZ = 800;
  var RADIATION_LIFT = 2.5;
  var KEYTRACK_REF_NOTE = 60;
  var KEYTRACK_SLOPE = 1;
  var TIERCE_BASS_SLOPE = 6;
  var CHIFF_GAIN = 0.15;
  var CHIFF_CORNER_MULT = 3;
  var CHIFF_CORNER_MAX_HZ = 3e3;
  var BORE_PREFILL3 = 0.3;
  var SPEAK_PERIODS = 40;
  var SPEAK_BASS_PER_OCT = 1;
  var SPEAK_REF_HZ = 261.63;
  var FOOT_PRESSURE_FLOOR = 0.55;
  var SPEAK_MIN_MS = 160;
  var SPEAK_MAX_MS = 1300;
  var SPEAK_UPPERWORK_FLOOR = 0.25;
  var OUTPUT_TARGET_PEAK3 = 0.32;
  var PEAK_BASE3 = 4;
  var PEAK_TILT3 = -0.05;
  var PEAK_REF_HZ3 = 261.63;
  var PIPE_DETUNE_CENTS = 4;
  var DETUNE_TAPER_REF_HZ = 261.63;
  var JET_TURBULENCE = 0.035;
  var TURB_CORNER_MULT = 4;
  var TURB_CORNER_MAX_HZ = 3e3;
  var TONE_CORNER_MULT = 7.3;
  var RAD_TONE_SPAN = 1;
  var TONE_TREBLE_TAPER = 0.35;
  var CHIFF_INDEX_BASE = 1n << 24n;
  var TURB_INDEX_BASE = 1n << 32n;
  var RANK_NOISE_SHIFT = 48n;
  function defaultPipeOrganRank() {
    return { footageMult: 1, stopped: false, brightness: 0.5, level: 1, reed: 0, radiation: 0 };
  }
  function defaultPipeOrganParams() {
    return {
      stopped: false,
      brightness: 0.5,
      toneDecayS: 4,
      breath: 0.35,
      chiff: 0.5,
      chiffMs: 18,
      releaseDampS: 0.08,
      reed: 0,
      radiation: 0,
      keytrack: 0,
      rankCount: 0,
      ranks: Array.from({ length: MAX_PIPE_RANKS }, defaultPipeOrganRank),
      tremulantRateHz: 0,
      tremulantDepth: 0,
      windSag: 0,
      swell: 0
    };
  }
  function pipeOrganBufferCapacity(sampleRate2) {
    const sr = sampleRate2 > 0 ? sampleRate2 : 48e3;
    return Math.trunc(sr / PIPE_MIN_FUNDAMENTAL_HZ) + 8;
  }
  function noteToHz9(note) {
    return 440 * 2 ** (((note & 127) - 69) / 12);
  }
  function clamp10(x, lo, hi) {
    return x < lo ? lo : x > hi ? hi : x;
  }
  function pipeTuningError(note, rank) {
    let h = Math.imul(note, 2654435761) + Math.imul(rank, 40503) >>> 0;
    h = (h ^ h >>> 15) >>> 0;
    h = Math.imul(h, 2246822519) >>> 0;
    h = (h ^ h >>> 13) >>> 0;
    return (h & 16777215) * (2 / 16777215) - 1;
  }
  function rampCoeff5(ms, sampleRate2) {
    const t = Math.max(0.5, ms) * 1e-3 * sampleRate2;
    return 1 - Math.exp(-3 / Math.max(1, t));
  }
  function jetTable2(x, asym) {
    const y = x * (x * x - 1) + asym * x * x;
    return y < -1 ? -1 : y > 1 ? 1 : y;
  }
  function emptyRank(capacity) {
    return {
      bore: new DelayLine(capacity),
      jet: new DelayLine(capacity),
      boreOut: 0,
      borePeriod: 0,
      comp: 1,
      jetRatio: JET_RATIO_OPEN,
      lpAlpha: 1,
      lpState: 0,
      lossGain: 1,
      releaseLoss: 0,
      sign: 1,
      jetReflection: 0.5,
      endReflection: 0.5,
      jetAsym: 0.5,
      jetDrive: 1,
      dcX1: 0,
      dcY1: 0,
      dcR: 0,
      evenGain: 0,
      evenState: 0,
      evenHpAlpha: 0,
      breath: 0,
      wind: 0,
      speakCoeff: 0,
      turbAlpha: 1,
      turbState: 0,
      toneAlpha: 1,
      toneS1: 0,
      toneS2: 0,
      chiffLevel: 0,
      chiffCoeff: 0,
      chiffLpAlpha: 1,
      chiffLpState: 0,
      radGain: 0,
      radAlpha: 0,
      radState: 0,
      mix: 0,
      outputScale: 1,
      noiseOffset: 0n
    };
  }
  var PipeOrganVoiceCore = class {
    spanCapacity;
    ranks;
    rankCount = 0;
    // Breath contour shared by every rank (the wind gate).
    breathLevel = 0;
    attackCoeff = 0;
    releaseCoeff = 0;
    releasing = false;
    // Determinism: one seeded stream, drawn per rank at a high-bit offset.
    noise = new VoiceRandomSequence();
    driveIndex = 0;
    constructor(sampleRate2) {
      this.spanCapacity = pipeOrganBufferCapacity(sampleRate2);
      this.ranks = Array.from({ length: MAX_PIPE_RANKS }, () => emptyRank(this.spanCapacity));
    }
    start(params, sampleRate2, note, velocity, seed) {
      const sr = sampleRate2 > 0 ? sampleRate2 : 48e3;
      this.noise = new VoiceRandomSequence(seed);
      this.driveIndex = 0;
      this.releasing = false;
      this.breathLevel = 0;
      const implicit = {
        footageMult: 1,
        stopped: params.stopped,
        brightness: params.brightness,
        level: 1,
        reed: params.reed,
        radiation: params.radiation
      };
      let ranks = [implicit];
      let count = 1;
      if (params.rankCount > 0) {
        ranks = params.ranks;
        count = Math.min(params.rankCount, MAX_PIPE_RANKS);
      }
      this.rankCount = count;
      let power = 0;
      for (let r = 0; r < count; ++r) {
        const lvl = clamp10(ranks[r].level, 0, 1);
        power += lvl * lvl;
      }
      const norm = 1 / Math.sqrt(Math.max(1e-6, power));
      const baseF0 = noteToHz9(note);
      const keytrack = clamp10(params.keytrack, 0, 1);
      const octavesAbove = Math.max(0, ((note & 127) - KEYTRACK_REF_NOTE) / 12);
      const octavesBelow = Math.max(0, (KEYTRACK_REF_NOTE - (note & 127)) / 12);
      const vel01 = (velocity & 127) / 127;
      const level = clamp10(0.7 * clamp10(params.breath, 0, 1) + 0.3 * vel01, 0, 1);
      const mouth = BREATH_BASE3 + BREATH_SPAN3 * level;
      this.attackCoeff = rampCoeff5(8, sr);
      this.releaseCoeff = rampCoeff5(Math.max(0.01, params.releaseDampS) * 1e3, sr);
      const purity = clamp10(params.toneDecayS / 8, 0, 1);
      const lossGain = clamp10(0.945 + 0.05 * purity, 0.5, 0.998);
      const dcR = 1 - TWO_PI10 * DC_CORNER_HZ3 / sr;
      const evenHp = clamp10(1 - Math.exp(-TWO_PI10 * EVEN_PUMP_DC_HZ2 / sr), 0, 1);
      for (let r = 0; r < count; ++r) {
        const pipe = this.ranks[r];
        pipe.noiseOffset = BigInt(r) << RANK_NOISE_SHIFT;
        pipe.mix = clamp10(ranks[r].level, 0, 1) * norm;
        const stopped = ranks[r].stopped;
        const footage = ranks[r].footageMult > 0.01 ? ranks[r].footageMult : 1;
        const f0 = baseF0 * footage;
        if (keytrack > 0) {
          const footageOctaves = Math.max(0, Math.log2(Math.max(0.01, footage)));
          pipe.mix /= 1 + KEYTRACK_SLOPE * keytrack * octavesAbove * footageOctaves;
          if (footage > 4.01) {
            pipe.mix /= 1 + TIERCE_BASS_SLOPE * keytrack * octavesBelow;
          }
        }
        const period = sr / Math.max(1, f0);
        const detuneSpan = PIPE_DETUNE_CENTS / (1 + Math.max(0, Math.log2(f0 / DETUNE_TAPER_REF_HZ)));
        const detune = 2 ** (detuneSpan * pipeTuningError(note, r) / 1200);
        pipe.borePeriod = period * PITCH_CORRECT_OPEN / detune;
        pipe.sign = 1;
        pipe.jetRatio = JET_RATIO_OPEN;
        const reed = clamp10(ranks[r].reed, 0, 1);
        pipe.jetAsym = 0.5 + REED_ASYM * reed;
        pipe.jetDrive = 1 + REED_DRIVE * reed;
        pipe.jetReflection = Math.min(0.5 + 0.12 * reed, REFLECT_MAX2);
        pipe.endReflection = 0.5;
        pipe.lossGain = lossGain;
        const relT60 = Math.max(0.02, params.releaseDampS);
        const loopsToT60 = sr * relT60 / Math.max(1, period);
        pipe.releaseLoss = Math.min(lossGain, Math.exp(-6.907755279 / Math.max(1, loopsToT60)));
        let bright = clamp10(ranks[r].brightness + 0.3 * reed, 0, 1);
        if (stopped) bright = Math.min(bright, 0.35);
        const corner = (REFLECT_CORNER_BASE + REFLECT_CORNER_SPAN * bright) * f0;
        const alpha = clamp10(1 - Math.exp(-TWO_PI10 * corner / sr), 0.05, 1);
        const a = 1 - alpha;
        pipe.lpAlpha = alpha;
        pipe.lpState = 0;
        pipe.dcX1 = 0;
        pipe.dcY1 = 0;
        pipe.dcR = dcR;
        pipe.boreOut = 0;
        pipe.evenGain = stopped ? EVEN_PUMP_STOPPED : EVEN_PUMP_GAIN2;
        pipe.evenState = 0;
        pipe.evenHpAlpha = evenHp;
        const omega = TWO_PI10 * f0 / sr;
        const tauLp = Math.atan2(a * Math.sin(omega), 1 - a * Math.cos(omega)) / Math.max(omega, 1e-6);
        const phaseDc = Math.atan2(Math.sin(omega), 1 - Math.cos(omega)) - Math.atan2(dcR * Math.sin(omega), 1 - dcR * Math.cos(omega));
        const tauDc = phaseDc / Math.max(omega, 1e-6);
        pipe.comp = 1 + tauLp - tauDc;
        pipe.breath = mouth;
        pipe.chiffLevel = clamp10(params.chiff, 0, 1) * CHIFF_GAIN;
        pipe.chiffCoeff = Math.exp(-1 / Math.max(1, Math.max(0.5, params.chiffMs) * 1e-3 * sr));
        const chiffCorner = Math.min(CHIFF_CORNER_MULT * baseF0, CHIFF_CORNER_MAX_HZ);
        pipe.chiffLpAlpha = clamp10(1 - Math.exp(-TWO_PI10 * chiffCorner / sr), 0.01, 1);
        pipe.chiffLpState = 0;
        pipe.chiffLevel *= Math.sqrt((2 - pipe.chiffLpAlpha) / pipe.chiffLpAlpha);
        const radiation = clamp10(ranks[r].radiation, 0, 1);
        pipe.radGain = radiation * RADIATION_LIFT;
        pipe.radAlpha = clamp10(1 - Math.exp(-TWO_PI10 * RADIATION_CORNER_HZ / sr), 0, 1);
        pipe.radState = 0;
        const peakEst = clamp10(
          PEAK_BASE3 + PEAK_TILT3 * Math.log2(Math.max(1, f0) / PEAK_REF_HZ3),
          0.8,
          6
        );
        pipe.outputScale = OUTPUT_TARGET_PEAK3 / peakEst;
        const eff = Math.max(2, pipe.borePeriod - pipe.comp);
        const span = Math.min(this.spanCapacity, Math.max(16, Math.trunc(eff * 1.15) + 8));
        pipe.bore.prime(span);
        pipe.jet.prime(span);
        const turbCorner = Math.min(TURB_CORNER_MULT * f0, TURB_CORNER_MAX_HZ);
        pipe.turbAlpha = clamp10(1 - Math.exp(-TWO_PI10 * turbCorner / sr), 0.01, 1);
        pipe.turbState = 0;
        const toneMult = TONE_CORNER_MULT / (1 + TONE_TREBLE_TAPER * octavesAbove);
        pipe.toneAlpha = clamp10(
          1 - Math.exp(-TWO_PI10 * toneMult * (1 + RAD_TONE_SPAN * radiation) * f0 / sr),
          0.01,
          1
        );
        pipe.toneS1 = 0;
        pipe.toneS2 = 0;
        const periodMs = 1e3 * period / sr;
        const rankPeriods = SPEAK_PERIODS * (1 + SPEAK_BASS_PER_OCT * Math.max(0, Math.log2(SPEAK_REF_HZ / Math.max(1, f0))));
        const notePeriods = SPEAK_PERIODS * (1 + SPEAK_BASS_PER_OCT * Math.max(0, Math.log2(SPEAK_REF_HZ / Math.max(1, baseF0))));
        const noteSpeakMs = clamp10(
          notePeriods * 1e3 / Math.max(1, baseF0),
          SPEAK_MIN_MS,
          SPEAK_MAX_MS
        );
        const speakMs = Math.max(
          clamp10(rankPeriods * periodMs, SPEAK_MIN_MS, SPEAK_MAX_MS),
          SPEAK_UPPERWORK_FLOOR * noteSpeakMs
        );
        pipe.speakCoeff = rampCoeff5(speakMs, sr);
        pipe.wind = 0;
        const pf = BORE_PREFILL3 * mouth;
        const w = TWO_PI10 / Math.max(2, pipe.borePeriod);
        const phase = Math.PI * pipeTuningError(note, r + 8);
        for (let i = 0; i < span; ++i) {
          pipe.bore.processFractional(256, pf * Math.sin(w * i + phase));
        }
      }
      this.driveIndex = pipeOrganBufferCapacity(sr);
    }
    render(pitchRatio) {
      if (this.rankCount <= 0) return 0;
      const ratio = pitchRatio > 0.01 ? pitchRatio : 0.01;
      const target = this.releasing ? 0 : 1;
      const coeff = this.releasing ? this.releaseCoeff : this.attackCoeff;
      this.breathLevel += coeff * (target - this.breathLevel);
      const idx = BigInt(this.driveIndex);
      let mix = 0;
      for (let r = 0; r < this.rankCount; ++r) {
        const pipe = this.ranks[r];
        if (pipe.bore.size < 8) continue;
        pipe.wind += pipe.speakCoeff * (1 - pipe.wind);
        const breath = pipe.breath * this.breathLevel * (FOOT_PRESSURE_FLOOR + (1 - FOOT_PRESSURE_FLOOR) * pipe.wind);
        pipe.lpState += pipe.lpAlpha * (pipe.boreOut - pipe.lpState);
        const temp = pipe.sign * pipe.lossGain * pipe.lpState;
        pipe.turbState += pipe.turbAlpha * (this.noise.bipolarAt(TURB_INDEX_BASE + pipe.noiseOffset + idx) - pipe.turbState);
        const pd = breath - pipe.jetReflection * temp + JET_TURBULENCE * breath * pipe.turbState;
        const boreDelay = clamp10(pipe.borePeriod / ratio - pipe.comp, 1, pipe.bore.size - 4);
        const jetDelay = clamp10(pipe.jetRatio * boreDelay, 1, pipe.jet.size - 4);
        const pdJ = pipe.jet.processFractional(Math.trunc(jetDelay * 256), pd);
        const jetOut = jetTable2(pipe.jetDrive * pdJ, pipe.jetAsym);
        const jetDc = jetOut - pipe.dcX1 + pipe.dcR * pipe.dcY1;
        pipe.dcX1 = jetOut;
        pipe.dcY1 = jetDc;
        let into = jetDc + pipe.endReflection * temp;
        if (pipe.evenGain > 0) {
          const rect = temp > 0 ? temp : 0;
          pipe.evenState += pipe.evenHpAlpha * (rect - pipe.evenState);
          let pump = pipe.evenGain * pipe.wind * pipe.wind * (rect - pipe.evenState);
          pump = pump < -1.5 ? -1.5 : pump > 1.5 ? 1.5 : pump;
          into += pump;
        }
        pipe.boreOut = pipe.bore.processFractional(Math.trunc(boreDelay * 256), into);
        let radiated = pipe.boreOut;
        if (pipe.radGain > 0) {
          pipe.radState += pipe.radAlpha * (radiated - pipe.radState);
          radiated += pipe.radGain * (radiated - pipe.radState);
        }
        pipe.toneS1 += pipe.toneAlpha * (radiated - pipe.toneS1);
        pipe.toneS2 += pipe.toneAlpha * (pipe.toneS1 - pipe.toneS2);
        radiated = pipe.toneS2;
        let chiff = 0;
        if (pipe.chiffLevel > 1e-5) {
          pipe.chiffLpState += pipe.chiffLpAlpha * (this.noise.bipolarAt(CHIFF_INDEX_BASE + pipe.noiseOffset + idx) - pipe.chiffLpState);
          chiff = pipe.chiffLevel * this.breathLevel * pipe.chiffLpState;
          pipe.chiffLevel *= pipe.chiffCoeff;
        }
        const swell = pipe.wind * pipe.wind;
        mix += pipe.mix * pipe.outputScale * (swell * radiated + chiff);
      }
      ++this.driveIndex;
      return mix;
    }
    release() {
      this.releasing = true;
      for (let r = 0; r < this.rankCount; ++r) {
        const pipe = this.ranks[r];
        pipe.lossGain = Math.min(pipe.lossGain, pipe.releaseLoss);
      }
    }
    kill() {
      this.releasing = true;
      this.breathLevel = 0;
      for (let r = 0; r < this.rankCount; ++r) {
        const pipe = this.ranks[r];
        pipe.lpState = 0;
        pipe.boreOut = 0;
        pipe.dcX1 = 0;
        pipe.dcY1 = 0;
        pipe.chiffLevel = 0;
      }
    }
  };

  // src/tuner/dsp/plucked-string-voice.ts
  var TWO_PI11 = 2 * Math.PI;
  var PLUCKED_MIN_FUNDAMENTAL_HZ = 20;
  var NOISE_INDEX_BASE3 = 1 << 16;
  var BUZZ_SPAN_BASE = 0.35;
  var PLUCKED_OUTPUT_SCALE = 0.85;
  function defaultPluckedParams() {
    return {
      brightness: 0.7,
      decayS: 4,
      decayStretch: 0.5,
      pickPosition: 0.2,
      excBrightness: 0.85,
      velToBrightness: 0.6,
      releaseDampS: 0.12,
      buzz: 0
    };
  }
  function pluckedStringBufferCapacity(sampleRate2) {
    const sr = sampleRate2 > 0 ? sampleRate2 : 48e3;
    return Math.trunc(sr / PLUCKED_MIN_FUNDAMENTAL_HZ) + 8;
  }
  function noteToHz10(note) {
    return 440 * 2 ** (((note & 127) - 69) / 12);
  }
  function clamp11(x, lo, hi) {
    return x < lo ? lo : x > hi ? hi : x;
  }
  function loopGainFor3(periodSamples, sampleRate2, t60S) {
    const loopsToT60 = sampleRate2 * Math.max(0.01, t60S) / Math.max(1, periodSamples);
    return Math.exp(-6.907755279 / loopsToT60);
  }
  var PluckedStringVoiceCore = class {
    buffer;
    basePeriod = 0;
    loopComp = 1;
    loopAlpha = 1;
    lpState = 0;
    loopGain = 0;
    releaseGain = 0;
    buzzThreshold = 0;
    buzzAmount = 0;
    // Excitation burst.
    noise = new VoiceRandomSequence();
    excTotal = 0;
    excPos = 0;
    pickDelay = 0;
    excAlpha = 1;
    excLp = 0;
    outputScale = 1;
    constructor(sampleRate2) {
      this.buffer = new DelayLine(pluckedStringBufferCapacity(sampleRate2));
    }
    start(params, sampleRate2, note, velocity, seed) {
      const sr = sampleRate2 > 0 ? sampleRate2 : 48e3;
      this.noise = new VoiceRandomSequence(seed);
      const f0 = noteToHz10(note);
      this.basePeriod = sr / f0;
      const a = (1 - clamp11(params.brightness, 0, 1)) * 0.7;
      this.loopAlpha = 1 - a;
      this.lpState = 0;
      const omega = TWO_PI11 / this.basePeriod;
      const tauLp = Math.atan2(a * Math.sin(omega), 1 - a * Math.cos(omega)) / Math.max(omega, 1e-6);
      this.loopComp = 1 + tauLp;
      const stretch = clamp11(params.decayStretch, 0, 1);
      const octavesBelowA4 = (69 - (note & 127)) / 12;
      const t60 = Math.max(0.05, params.decayS) * 2 ** (stretch * octavesBelowA4);
      this.loopGain = loopGainFor3(this.basePeriod, sr, t60);
      this.releaseGain = loopGainFor3(this.basePeriod, sr, Math.max(0.01, params.releaseDampS));
      this.buzzAmount = clamp11(params.buzz, 0, 1);
      this.buzzThreshold = this.buzzAmount > 0 ? 0.6 - 0.4 * this.buzzAmount : 0;
      this.excTotal = Math.max(8, Math.trunc(this.basePeriod));
      this.excPos = 0;
      this.pickDelay = Math.trunc(clamp11(params.pickPosition, 0, 0.5) * this.basePeriod + 0.5);
      const vel01 = (velocity & 127) / 127;
      const velAmount = clamp11(params.velToBrightness, 0, 1);
      const bright = clamp11(params.excBrightness, 0, 1) * (1 - velAmount + velAmount * vel01);
      const excCutoff = 300 * 2 ** (5.3 * bright);
      this.excAlpha = clamp11(1 - Math.exp(-TWO_PI11 * excCutoff / sr), 0.01, 1);
      this.excLp = 0;
      this.outputScale = PLUCKED_OUTPUT_SCALE;
      const size = Math.min(this.buffer.capacity, Math.trunc(this.basePeriod * 1.3) + 8);
      this.buffer.prime(size);
    }
    render(pitchRatio) {
      if (this.buffer.size < 8) return 0;
      let exc = 0;
      if (this.excPos < this.excTotal + this.pickDelay) {
        let burst = this.excPos < this.excTotal ? this.noise.bipolarAt(NOISE_INDEX_BASE3 + this.excPos) : 0;
        if (this.pickDelay > 0 && this.excPos >= this.pickDelay) {
          burst -= this.noise.bipolarAt(NOISE_INDEX_BASE3 + (this.excPos - this.pickDelay));
        }
        ++this.excPos;
        this.excLp += this.excAlpha * (burst - this.excLp);
        exc = 0.7 * this.excLp;
      }
      const ratio = pitchRatio > 0.01 ? pitchRatio : 0.01;
      const delay = clamp11(this.basePeriod / ratio - this.loopComp, 1, this.buffer.size - 4);
      const delayQ8 = Math.trunc(delay * 256);
      let loopIn = exc + this.loopGain * this.lpState;
      if (this.buzzThreshold > 0 && loopIn > this.buzzThreshold) {
        const over = loopIn - this.buzzThreshold;
        const span = BUZZ_SPAN_BASE * (1 - 0.5 * this.buzzAmount);
        loopIn = this.buzzThreshold + span * over / (span + over);
      }
      const out = this.buffer.processFractional(delayQ8, loopIn);
      this.lpState += this.loopAlpha * (out - this.lpState);
      return out * this.outputScale;
    }
    release() {
      this.loopGain = Math.min(this.loopGain, this.releaseGain);
    }
    kill() {
      this.excPos = this.excTotal + this.pickDelay;
      this.loopGain = 0;
      this.lpState = 0;
      this.excLp = 0;
    }
  };

  // src/tuner/dsp/reed-voice.ts
  var TWO_PI12 = 2 * Math.PI;
  var REED_MIN_FUNDAMENTAL_HZ = 20;
  var BREATH_BASE4 = 0.82;
  var BREATH_SPAN4 = 0.08;
  var REED_OFFSET_MIN = 0.68;
  var REED_OFFSET_SPAN = 0.04;
  var REED_SLOPE_BASE = 0.25;
  var REED_SLOPE_SPAN = 0.05;
  var LOSS_BASE2 = 0.99;
  var LOSS_SPAN3 = 0.09;
  var LOSS_FLOOR2 = 0.8;
  var LOSS_CEIL2 = 0.999;
  var BELL_POLE_SPAN3 = 0.7;
  var CONTROL_SMOOTH_MS4 = 8;
  var BREATH_NOISE_DEPTH4 = 0.08;
  var CHIFF_DEPTH3 = 0.5;
  var BORE_PREFILL4 = 0.02;
  var HP_CORNER_FRAC_F0 = 0.06;
  var HP_CORNER_FLOOR_HZ = 10;
  var HP_COMP_SCALE = 0.5;
  var OUTPUT_SCALE = 0.9;
  var REED_RES_BASE_HZ = 1500;
  var REED_RES_SPAN_HZ = 2e3;
  var REED_RES_R = 0.985;
  var REED_COUPLE = 0.15;
  var REG_VENT_CORNER_HZ = 700;
  var REG_VENT_MAX = 0.7;
  var GROWL_RATE_HZ = 28;
  var GROWL_DEPTH_MAX = 0.5;
  var CONE_THROAT_MULT = 1.6;
  var CONE_GROWTH_GAIN = 1.4;
  var TONEHOLE_FRAC_CYLINDER = 0.5;
  var TONEHOLE_FRAC_CONE = 0.25;
  var TONEHOLE_GAIN_MAX = 0.5;
  function defaultReedParams() {
    return {
      breathPressure: 0.6,
      velToBreath: 0.6,
      reedStiffness: 0.5,
      reedOpening: 0.5,
      conical: false,
      brightness: 0.5,
      damping: 0.4,
      attackMs: 40,
      releaseMs: 80,
      breathNoise: 0.12,
      chiff: 0.4,
      chiffMs: 12,
      dynamicReed: false,
      reedResonance: 0.5,
      registerVent: 0,
      growl: 0,
      coneGrowth: 0,
      tonehole: 0
    };
  }
  function reedBufferCapacity(sampleRate2) {
    const sr = sampleRate2 > 0 ? sampleRate2 : 48e3;
    return Math.trunc(sr / REED_MIN_FUNDAMENTAL_HZ) + 8;
  }
  function noteToHz11(note) {
    return 440 * 2 ** (((note & 127) - 69) / 12);
  }
  function rampCoeff6(ms, sampleRate2) {
    const t = Math.max(0.5, ms) * 1e-3 * sampleRate2;
    return 1 - Math.exp(-3 / Math.max(1, t));
  }
  function clamp12(x, lo, hi) {
    return x < lo ? lo : x > hi ? hi : x;
  }
  var ReedVoiceCore = class {
    bore;
    // Tuning: the loop period (samples) and the delay not carried in the line.
    borePeriod = 0;
    comp = 1;
    // Feedback sign: -1 = cylinder (odd harmonics), +1 = cone (full harmonics).
    sign = -1;
    // Last delay-line output (the pressure returning to the reed next sample).
    boreOut = 0;
    // Bell reflection: one-pole loop lowpass, a loss gain, the topology sign.
    lpAlpha = 1;
    lpState = 0;
    lossGain = 0.95;
    // In-loop DC blocker.
    dcX1 = 0;
    dcY1 = 0;
    dcR = 0;
    // Reed table (memoryless valve): coeff = clamp(offset + slope*dp, -1, 1).
    reedOffset = 0.7;
    reedSlope = -0.3;
    // Breath contour.
    breathTarget = 0.6;
    breathLevel = 0;
    attackCoeff = 0;
    releaseCoeff = 0;
    releasing = false;
    // Live-control smoothing (initialised equal to note-on so an untouched note
    // renders exactly as the plain model).
    ctrlCoeff = 1;
    breathCtrlTarget = 0.6;
    lpAlphaTarget = 1;
    // Breath turbulence and onset chiff.
    breathNoise = 0;
    chiffLevel = 0;
    chiffCoeff = 0;
    outputScale = 1;
    noise = new VoiceRandomSequence();
    driveIndex = 0;
    // --- 4a dynamic (mass-spring) reed ---
    reedDyn = false;
    reedB0 = 0;
    reedA1 = 0;
    reedA2 = 0;
    reedZ1 = 0;
    reedZ2 = 0;
    reedCouple = 0;
    // --- 4b register vent ---
    regVent = 0;
    regLpAlpha = 0;
    regLpState = 0;
    // --- 4c growl ---
    growlDepth = 0;
    growlPhase = 0;
    growlInc = 0;
    // --- 4d growth cone ---
    throatGain = 0;
    throatPole = 0;
    throatState = 0;
    // --- 4e tonehole scattering ---
    holeGain = 0;
    holeDelaySamples = 0;
    holeRefl = 0;
    constructor(sampleRate2) {
      this.bore = new DelayLine(reedBufferCapacity(sampleRate2));
    }
    start(params, sampleRate2, note, velocity, seed) {
      const sr = sampleRate2 > 0 ? sampleRate2 : 48e3;
      this.noise = new VoiceRandomSequence(seed);
      this.driveIndex = 0;
      this.releasing = false;
      this.breathLevel = 0;
      this.lpState = 0;
      this.boreOut = 0;
      this.dcX1 = 0;
      this.dcY1 = 0;
      const f0 = noteToHz11(note);
      const period = sr / Math.max(1, f0);
      if (params.conical) {
        this.borePeriod = period;
        this.sign = 1;
      } else {
        this.borePeriod = 0.5 * period;
        this.sign = -1;
      }
      const vel01 = (velocity & 127) / 127;
      const velToBreath = clamp12(params.velToBreath, 0, 1);
      const level = clamp12((1 - velToBreath) * params.breathPressure + velToBreath * vel01, 0, 1);
      this.breathTarget = BREATH_BASE4 + BREATH_SPAN4 * level;
      this.breathCtrlTarget = this.breathTarget;
      this.ctrlCoeff = rampCoeff6(CONTROL_SMOOTH_MS4, sr);
      const stiffness = clamp12(params.reedStiffness, 0, 1);
      const opening = clamp12(params.reedOpening, 0, 1);
      this.reedOffset = REED_OFFSET_MIN + REED_OFFSET_SPAN * (1 - opening);
      this.reedSlope = -(REED_SLOPE_BASE + REED_SLOPE_SPAN * stiffness);
      const a = (1 - clamp12(params.brightness, 0, 1)) * BELL_POLE_SPAN3;
      this.lpAlpha = 1 - a;
      this.lpAlphaTarget = this.lpAlpha;
      this.lossGain = clamp12(
        LOSS_BASE2 - LOSS_SPAN3 * clamp12(params.damping, 0, 1),
        LOSS_FLOOR2,
        LOSS_CEIL2
      );
      const hpCorner = params.conical ? Math.max(HP_CORNER_FLOOR_HZ, HP_CORNER_FRAC_F0 * f0) : HP_CORNER_FLOOR_HZ;
      this.dcR = 1 - TWO_PI12 * hpCorner / sr;
      const omega = TWO_PI12 / Math.max(1, this.borePeriod);
      const tauLp = Math.atan2(a * Math.sin(omega), 1 - a * Math.cos(omega)) / Math.max(omega, 1e-6);
      const sw = Math.sin(omega);
      const cw = Math.cos(omega);
      const phaseHp = Math.atan2(sw, 1 - cw) - Math.atan2(this.dcR * sw, 1 - this.dcR * cw);
      const tauHp = phaseHp / Math.max(omega, 1e-6);
      this.comp = 1 + tauLp - HP_COMP_SCALE * tauHp;
      const eff = Math.max(2, this.borePeriod - this.comp);
      const span = Math.trunc(eff * 1.3) + 8;
      const boreSize = Math.min(this.bore.capacity, Math.max(16, span));
      this.bore.prime(boreSize);
      this.attackCoeff = rampCoeff6(params.attackMs, sr);
      this.releaseCoeff = rampCoeff6(params.releaseMs, sr);
      this.breathNoise = clamp12(params.breathNoise, 0, 1) * BREATH_NOISE_DEPTH4;
      this.chiffLevel = clamp12(params.chiff, 0, 1) * CHIFF_DEPTH3;
      this.chiffCoeff = rampCoeff6(params.chiffMs, sr);
      this.outputScale = OUTPUT_SCALE;
      const prefill = BORE_PREFILL4 * this.breathTarget;
      for (let i = 0; i < boreSize; ++i) {
        this.bore.processFractional(256, prefill * this.noise.bipolarAt(i));
      }
      this.driveIndex = boreSize;
      this.reedDyn = params.dynamicReed;
      this.reedZ1 = 0;
      this.reedZ2 = 0;
      if (this.reedDyn) {
        const res01 = clamp12(params.reedResonance, 0, 1);
        let fReed = REED_RES_BASE_HZ + REED_RES_SPAN_HZ * res01;
        fReed = Math.min(fReed, 0.45 * sr);
        const w = TWO_PI12 * fReed / sr;
        this.reedA1 = 2 * REED_RES_R * Math.cos(w);
        this.reedA2 = -REED_RES_R * REED_RES_R;
        this.reedB0 = 1 - REED_RES_R;
        this.reedCouple = REED_COUPLE;
      }
      this.regVent = clamp12(params.registerVent, 0, 1) * REG_VENT_MAX;
      this.regLpState = 0;
      if (this.regVent > 0) {
        this.regLpAlpha = 1 - Math.exp(-TWO_PI12 * REG_VENT_CORNER_HZ / sr);
      }
      this.growlDepth = clamp12(params.growl, 0, 1) * GROWL_DEPTH_MAX;
      this.growlPhase = 0;
      if (this.growlDepth > 0) {
        this.growlInc = TWO_PI12 * GROWL_RATE_HZ / sr;
      }
      this.throatGain = 0;
      this.throatState = 0;
      if (params.conical) {
        const grow = clamp12(params.coneGrowth, 0, 1);
        if (grow > 0) {
          this.throatGain = CONE_GROWTH_GAIN * grow;
          const corner = Math.min(CONE_THROAT_MULT * f0, 0.45 * sr);
          this.throatPole = Math.exp(-TWO_PI12 * corner / sr);
        }
      }
      this.holeGain = 0;
      this.holeDelaySamples = 0;
      this.holeRefl = 0;
      const hole = clamp12(params.tonehole, 0, 1);
      if (hole > 0) {
        this.holeGain = TONEHOLE_GAIN_MAX * hole;
        const frac = params.conical ? TONEHOLE_FRAC_CONE : TONEHOLE_FRAC_CYLINDER;
        const roundTrip = Math.trunc(2 * frac * this.borePeriod);
        this.holeDelaySamples = clamp12(roundTrip, 1, boreSize - 1);
      }
    }
    /**
     * Biquad bandpass reed resonator: a damped mass-spring reed driven by the
     * pressure difference, its output biasing the reed table's operating point.
     */
    reedResonator(dp) {
      const y = this.reedB0 * dp + this.reedA1 * this.reedZ1 + this.reedA2 * this.reedZ2;
      this.reedZ2 = this.reedZ1;
      this.reedZ1 = y;
      return y;
    }
    /** Renders one sample; `pitchRatio` is the per-sample pitch factor (1 = on pitch). */
    render(pitchRatio) {
      if (this.bore.size < 8) return 0;
      const ratio = pitchRatio > 0.01 ? pitchRatio : 0.01;
      this.breathTarget += this.ctrlCoeff * (this.breathCtrlTarget - this.breathTarget);
      this.lpAlpha += this.ctrlCoeff * (this.lpAlphaTarget - this.lpAlpha);
      const target = this.releasing ? 0 : 1;
      const coeff = this.releasing ? this.releaseCoeff : this.attackCoeff;
      this.breathLevel += coeff * (target - this.breathLevel);
      let breath = this.breathTarget * this.breathLevel;
      if (this.breathNoise > 0) {
        breath += breath * this.breathNoise * this.noise.bipolarAt(this.driveIndex);
      }
      if (this.chiffLevel > 1e-4) {
        breath += this.chiffLevel * this.breathTarget * this.noise.bipolarAt(this.driveIndex + 1);
        this.chiffLevel -= this.chiffCoeff * this.chiffLevel;
      }
      if (this.growlDepth > 0) {
        breath *= 1 + this.growlDepth * Math.sin(this.growlPhase);
        this.growlPhase += this.growlInc;
        if (this.growlPhase >= TWO_PI12) this.growlPhase -= TWO_PI12;
      }
      this.lpState += this.lpAlpha * (this.boreOut - this.lpState);
      let reflRaw = this.sign * this.lossGain * this.lpState;
      if (this.regVent > 0) {
        this.regLpState += this.regLpAlpha * (reflRaw - this.regLpState);
        reflRaw -= this.regVent * this.regLpState;
      }
      if (this.holeDelaySamples > 0) reflRaw += this.holeRefl;
      const dc = reflRaw - this.dcX1 + this.dcR * this.dcY1;
      this.dcX1 = reflRaw;
      this.dcY1 = dc;
      const refl = dc;
      const dp = refl - breath;
      let reed = this.reedOffset + this.reedSlope * dp;
      if (this.reedDyn) reed += this.reedCouple * this.reedResonator(dp);
      if (reed > 1) reed = 1;
      if (reed < -1) reed = -1;
      const inj = breath + dp * reed;
      const delay = clamp12(this.borePeriod / ratio - this.comp, 1, this.bore.size - 4);
      const delayQ8 = Math.trunc(delay * 256);
      this.boreOut = this.bore.processFractional(delayQ8, inj);
      ++this.driveIndex;
      if (this.holeDelaySamples > 0) {
        this.holeRefl = -this.holeGain * this.bore.readFractional((this.holeDelaySamples + 1) * 256);
      }
      if (this.throatGain > 0) {
        this.throatState += (1 - this.throatPole) * (this.boreOut - this.throatState);
        return this.outputScale * (this.boreOut + this.throatGain * this.throatState);
      }
      return this.outputScale * this.boreOut;
    }
    /** Note-off: tongue off (ramp the breath to zero); the bore rings down. */
    release() {
      this.releasing = true;
    }
    /** Immediate silence. */
    kill() {
      this.breathLevel = 0;
      this.lpState = 0;
      this.boreOut = 0;
      this.dcX1 = 0;
      this.dcY1 = 0;
      this.chiffLevel = 0;
      this.reedZ1 = 0;
      this.reedZ2 = 0;
      this.regLpState = 0;
      this.throatState = 0;
      this.holeRefl = 0;
      this.releasing = true;
    }
  };

  // src/tuner/dsp/vocal-voice.ts
  var TWO_PI13 = 2 * Math.PI;
  var VOCAL_FORMANTS = 5;
  var VOWEL_TABLE = [
    // /a/
    [
      { freqHz: 600, ampDb: 0, bwHz: 60 },
      { freqHz: 1040, ampDb: -7, bwHz: 70 },
      { freqHz: 2250, ampDb: -9, bwHz: 110 },
      { freqHz: 2450, ampDb: -9, bwHz: 120 },
      { freqHz: 2750, ampDb: -20, bwHz: 130 }
    ],
    // /e/
    [
      { freqHz: 400, ampDb: 0, bwHz: 40 },
      { freqHz: 1620, ampDb: -12, bwHz: 80 },
      { freqHz: 2400, ampDb: -9, bwHz: 100 },
      { freqHz: 2800, ampDb: -12, bwHz: 120 },
      { freqHz: 3100, ampDb: -18, bwHz: 120 }
    ],
    // /i/
    [
      { freqHz: 250, ampDb: 0, bwHz: 60 },
      { freqHz: 1750, ampDb: -30, bwHz: 90 },
      { freqHz: 2600, ampDb: -16, bwHz: 100 },
      { freqHz: 3050, ampDb: -22, bwHz: 120 },
      { freqHz: 3340, ampDb: -28, bwHz: 120 }
    ],
    // /o/
    [
      { freqHz: 400, ampDb: 0, bwHz: 40 },
      { freqHz: 750, ampDb: -11, bwHz: 80 },
      { freqHz: 2400, ampDb: -21, bwHz: 100 },
      { freqHz: 2600, ampDb: -20, bwHz: 120 },
      { freqHz: 2900, ampDb: -40, bwHz: 120 }
    ],
    // /u/
    [
      { freqHz: 350, ampDb: 0, bwHz: 40 },
      { freqHz: 600, ampDb: -20, bwHz: 60 },
      { freqHz: 2400, ampDb: -32, bwHz: 100 },
      { freqHz: 2675, ampDb: -28, bwHz: 120 },
      { freqHz: 2950, ampDb: -36, bwHz: 120 }
    ]
  ];
  var TILT_CORNER_BASE_HZ = 350;
  var TILT_CORNER_OCT_SPAN = 3;
  var BRIGHT_FORMANT_SPAN_DB = 12;
  var BREATH_DEPTH = 0.25;
  var VIBRATO_MAX_FRAC = 0.03;
  var OUTPUT_SCALE2 = 2;
  var VEL_FLOOR = 0.4;
  function defaultVocalParams() {
    return {
      vowel: 0,
      brightness: 0.5,
      breathNoise: 0.1,
      vibratoRateHz: 5.5,
      vibratoDepth: 0.3,
      attackMs: 30,
      releaseMs: 120
    };
  }
  function noteToHz12(note) {
    return 440 * 2 ** (((note & 127) - 69) / 12);
  }
  function clamp13(x, lo, hi) {
    return x < lo ? lo : x > hi ? hi : x;
  }
  function rampCoeff7(ms, sampleRate2) {
    const t = Math.max(0.5, ms) * 1e-3 * sampleRate2;
    return 1 - Math.exp(-3 / Math.max(1, t));
  }
  var VocalVoiceCore = class {
    // Glottal source.
    phase = 0;
    phaseInc = 0;
    tiltState = 0;
    tiltAlpha = 1;
    // Formant bank (Direct Form II transposed; a1/a2 stored negated).
    numFormants = 0;
    b0 = new Float64Array(VOCAL_FORMANTS);
    b2 = new Float64Array(VOCAL_FORMANTS);
    a1 = new Float64Array(VOCAL_FORMANTS);
    a2 = new Float64Array(VOCAL_FORMANTS);
    fgain = new Float64Array(VOCAL_FORMANTS);
    z1 = new Float64Array(VOCAL_FORMANTS);
    z2 = new Float64Array(VOCAL_FORMANTS);
    // Level contour.
    levelTarget = 1;
    level = 0;
    attackCoeff = 0;
    releaseCoeff = 0;
    releasing = false;
    // Voice-local vibrato.
    vibDepth = 0;
    vibPhase = 0;
    vibInc = 0;
    // Aspiration noise.
    breath = 0;
    noise = new VoiceRandomSequence();
    driveIndex = 0;
    outputScale = 1;
    start(params, sampleRate2, note, velocity, seed) {
      const sr = sampleRate2 > 0 ? sampleRate2 : 48e3;
      this.noise = new VoiceRandomSequence(seed);
      this.driveIndex = 0;
      const baseFreq = noteToHz12(note);
      this.phase = 0;
      this.phaseInc = baseFreq / sr;
      const bright = clamp13(params.brightness, 0, 1);
      const corner = Math.min(TILT_CORNER_BASE_HZ * 2 ** (TILT_CORNER_OCT_SPAN * bright), 0.45 * sr);
      this.tiltAlpha = 1 - Math.exp(-TWO_PI13 * corner / sr);
      this.tiltState = 0;
      const vowel = params.vowel >= 0 && params.vowel < 5 ? params.vowel : 0;
      this.numFormants = VOCAL_FORMANTS;
      for (let i = 0; i < VOCAL_FORMANTS; ++i) {
        const fm = VOWEL_TABLE[vowel][i];
        const f = Math.min(fm.freqHz, 0.45 * sr);
        const q = f / Math.max(1, fm.bwHz);
        const w = TWO_PI13 * f / sr;
        const alpha = Math.sin(w) / (2 * q);
        const a0 = 1 + alpha;
        this.b0[i] = alpha / a0;
        this.b2[i] = -this.b0[i];
        this.a1[i] = 2 * Math.cos(w) / a0;
        this.a2[i] = -(1 - alpha) / a0;
        const openDb = (bright - 0.5) * BRIGHT_FORMANT_SPAN_DB * (i / (VOCAL_FORMANTS - 1));
        this.fgain[i] = 10 ** ((fm.ampDb + openDb) / 20);
        this.z1[i] = 0;
        this.z2[i] = 0;
      }
      this.breath = clamp13(params.breathNoise, 0, 1) * BREATH_DEPTH;
      this.vibDepth = clamp13(params.vibratoDepth, 0, 1) * VIBRATO_MAX_FRAC;
      this.vibPhase = 0;
      this.vibInc = this.vibDepth > 0 ? TWO_PI13 * Math.max(0.1, params.vibratoRateHz) / sr : 0;
      this.level = 0;
      this.levelTarget = 1;
      this.releasing = false;
      this.attackCoeff = rampCoeff7(params.attackMs, sr);
      this.releaseCoeff = rampCoeff7(params.releaseMs, sr);
      const vel01 = (velocity & 127) / 127;
      this.outputScale = OUTPUT_SCALE2 * (VEL_FLOOR + (1 - VEL_FLOOR) * vel01);
    }
    render(pitchRatio) {
      const ratio = pitchRatio > 0.01 ? pitchRatio : 0.01;
      const coeff = this.releasing ? this.releaseCoeff : this.attackCoeff;
      this.level += coeff * (this.levelTarget - this.level);
      let vib = 1;
      if (this.vibDepth > 0) {
        vib = 1 + this.vibDepth * Math.sin(this.vibPhase);
        this.vibPhase += this.vibInc;
        if (this.vibPhase >= TWO_PI13) this.vibPhase -= TWO_PI13;
      }
      let inc = this.phaseInc * ratio * vib;
      if (inc > 0.45) inc = 0.45;
      this.phase += inc;
      this.phase -= Math.floor(this.phase);
      const saw = 2 * this.phase - 1;
      this.tiltState += this.tiltAlpha * (saw - this.tiltState);
      let exc = this.tiltState;
      if (this.breath > 0) exc += this.breath * this.noise.bipolarAt(this.driveIndex);
      ++this.driveIndex;
      let sum = 0;
      for (let i = 0; i < this.numFormants; ++i) {
        const y = this.b0[i] * exc + this.z1[i];
        this.z1[i] = this.a1[i] * y + this.z2[i];
        this.z2[i] = this.b2[i] * exc + this.a2[i] * y;
        sum += this.fgain[i] * y;
      }
      return sum * this.level * this.outputScale;
    }
    release() {
      this.releasing = true;
      this.levelTarget = 0;
    }
    kill() {
      this.level = 0;
      this.levelTarget = 0;
      this.releasing = true;
      this.phase = 0;
      this.tiltState = 0;
      this.vibPhase = 0;
      for (let i = 0; i < VOCAL_FORMANTS; ++i) {
        this.z1[i] = 0;
        this.z2[i] = 0;
      }
    }
  };

  // src/tuner/dsp/params.ts
  var ENGINE_INFO = {
    "karplus-strong": {
      mode: "karplus-strong",
      label: "Karplus-Strong",
      family: "string",
      blurb: "Plucked string \u2014 a damped delay loop.",
      defaultBody: "none",
      defaultBodyMix: 0,
      defaultGain: 0.8
    },
    "bowed-string": {
      mode: "bowed-string",
      label: "Bowed String",
      family: "string",
      blurb: "Friction-excited waveguide + corpus.",
      defaultBody: "violin",
      defaultBodyMix: 0.25,
      defaultGain: 0.7
    },
    piano: {
      mode: "piano",
      label: "Piano",
      family: "keyboard",
      blurb: "Stiff strings, felt hammer, soundboard.",
      defaultBody: "none",
      defaultBodyMix: 0,
      defaultGain: 0.8
    },
    modal: {
      mode: "modal",
      label: "Modal Mallet",
      family: "mallet",
      blurb: "Struck bar/bell \u2014 a resonator bank.",
      defaultBody: "none",
      defaultBodyMix: 0,
      defaultGain: 0.7
    },
    percussion: {
      mode: "percussion",
      label: "Percussion",
      family: "percussion",
      blurb: "Membrane modes + noise + shell.",
      defaultBody: "none",
      defaultBodyMix: 0,
      defaultGain: 0.8
    },
    "pipe-organ": {
      mode: "pipe-organ",
      label: "Pipe Organ",
      family: "wind",
      blurb: "Self-oscillating flue pipe, multi-rank.",
      defaultBody: "none",
      defaultBodyMix: 0,
      defaultGain: 0.7
    },
    reed: {
      mode: "reed",
      label: "Reed",
      family: "wind",
      blurb: "Single-reed valve on a bore.",
      defaultBody: "none",
      defaultBodyMix: 0,
      defaultGain: 0.7
    },
    brass: {
      mode: "brass",
      label: "Brass",
      family: "wind",
      blurb: "Lip-reed valve on a flaring bore.",
      defaultBody: "brass-bell",
      defaultBodyMix: 0.2,
      defaultGain: 0.7
    },
    flute: {
      mode: "flute",
      label: "Flute",
      family: "wind",
      blurb: "Air jet across an embouchure hole.",
      defaultBody: "none",
      defaultBodyMix: 0,
      defaultGain: 0.7
    },
    "plucked-string": {
      mode: "plucked-string",
      label: "Plucked String",
      family: "string",
      blurb: "Buzzing-bridge string \u2014 harp / koto / sitar.",
      defaultBody: "guitar",
      defaultBodyMix: 0.25,
      defaultGain: 0.8
    },
    vocal: {
      mode: "vocal",
      label: "Vocal",
      family: "vocal",
      blurb: "Glottal source through a formant bank.",
      defaultBody: "none",
      defaultBodyMix: 0,
      defaultGain: 0.7
    },
    "free-reed": {
      mode: "free-reed",
      label: "Free Reed",
      family: "wind",
      blurb: "Driven free-reed tongue \u2014 accordion / harmonica.",
      defaultBody: "none",
      defaultBodyMix: 0,
      defaultGain: 0.7
    }
  };
  function defaultKsParams() {
    return {
      brightness: 0.6,
      decayS: 3,
      decayStretch: 0.5,
      pickPosition: 0.18,
      excBrightness: 0.85,
      velToBrightness: 0.6,
      releaseDampS: 0.08,
      slap: 0,
      polarization: 0,
      bodyCoupling: 0,
      pluckStyle: 0,
      nail: 0,
      sympathetic: false,
      pickupPos: 0,
      dispersion: 0,
      tensionMod: 0,
      octaveMix: 0,
      keyoffNoise: 0
    };
  }
  function modalMode(ratio, gain, decayScale) {
    return { ratio, gain, decayScale };
  }
  function defaultModalParams() {
    return {
      numModes: 4,
      modes: [
        modalMode(1, 1, 1),
        modalMode(2.756, 0.6, 0.7),
        modalMode(5.404, 0.4, 0.5),
        modalMode(8.933, 0.25, 0.35),
        modalMode(1, 0, 1),
        modalMode(1, 0, 1),
        modalMode(1, 0, 1),
        modalMode(1, 0, 1)
      ],
      decayS: 2,
      decayStretch: 0.3,
      strikeBrightness: 0.7,
      velToBrightness: 0.6,
      releaseDampS: 0.15
    };
  }

  // src/tuner/dsp/engine.ts
  function noteToHz13(note) {
    return 440 * 2 ** ((note - 69) / 12);
  }
  var AmpEnv = class {
    stage = "idle";
    level = 0;
    sampleRate;
    attackInc = 0;
    decayCoeff = 0;
    releaseCoeff = 0;
    sustainLevel = 0.8;
    constructor(sampleRate2) {
      this.sampleRate = sampleRate2;
    }
    configure(spec) {
      const sr = this.sampleRate;
      this.attackInc = 1 / Math.max(1, spec.attackMs / 1e3 * sr);
      this.decayCoeff = Math.exp(-6.907755279 / Math.max(1, spec.decayMs / 1e3 * sr));
      this.releaseCoeff = Math.exp(-6.907755279 / Math.max(1, spec.releaseMs / 1e3 * sr));
      this.sustainLevel = Math.max(0, Math.min(1, spec.sustain));
    }
    trigger() {
      this.stage = "attack";
      this.level = 0;
    }
    release() {
      if (this.stage !== "idle") this.stage = "release";
    }
    done() {
      return this.stage === "idle" || this.stage === "release" && this.level < 1e-5;
    }
    next() {
      switch (this.stage) {
        case "idle":
          return 0;
        case "attack":
          this.level += this.attackInc;
          if (this.level >= 1) {
            this.level = 1;
            this.stage = "decay";
          }
          return this.level;
        case "decay":
          this.level = this.sustainLevel + (this.level - this.sustainLevel) * this.decayCoeff;
          if (this.level <= this.sustainLevel + 1e-4) {
            this.level = this.sustainLevel;
            this.stage = "sustain";
          }
          return this.level;
        case "sustain":
          return this.sustainLevel;
        case "release":
          this.level *= this.releaseCoeff;
          if (this.level < 1e-5) {
            this.level = 0;
            this.stage = "idle";
          }
          return this.level;
      }
    }
  };
  var PhysicalVoice = class {
    sampleRate;
    ks;
    modal;
    bowed;
    reed;
    brass;
    flute;
    piano;
    pipeOrgan;
    percussion;
    pluckedString;
    vocal;
    freeReed;
    current = null;
    body = new BodyResonator();
    env;
    drive = 0;
    driveMakeup = 1;
    gain = 1;
    active = false;
    note = -1;
    constructor(sampleRate2) {
      this.sampleRate = sampleRate2;
      this.env = new AmpEnv(sampleRate2);
    }
    noteOn(spec, note, velocity, voiceIndex, age) {
      this.gain = spec.gain;
      this.drive = spec.drive;
      this.driveMakeup = spec.drive > 0 ? 1 / Math.tanh(1 + 3 * spec.drive) : 1;
      const sr = this.sampleRate;
      const seed = voiceSeed(voiceIndex, note, age);
      this.current = this.startCore(spec, note, velocity, seed);
      this.body.start(spec.body, sr, noteToHz13(note), spec.bodyMix);
      this.env.configure(spec.ampEnv);
      this.env.trigger();
      this.active = true;
      this.note = note;
    }
    /** Lazily create + start the core for the spec's engine; returns its handle. */
    startCore(spec, note, velocity, seed) {
      const sr = this.sampleRate;
      switch (spec.engineMode) {
        case "karplus-strong":
          this.ks ??= new KsVoiceCore(sr);
          if (spec.ks) this.ks.start(spec.ks, sr, note, velocity, seed);
          return this.ks;
        case "modal":
          this.modal ??= new ModalVoiceCore();
          if (spec.modal) this.modal.start(spec.modal, sr, note, velocity, seed);
          return this.modal;
        case "bowed-string":
          this.bowed ??= new BowedStringVoiceCore(sr);
          if (spec.bowed) this.bowed.start(spec.bowed, sr, note, velocity, seed);
          return this.bowed;
        case "reed":
          this.reed ??= new ReedVoiceCore(sr);
          if (spec.reed) this.reed.start(spec.reed, sr, note, velocity, seed);
          return this.reed;
        case "brass":
          this.brass ??= new BrassVoiceCore(sr);
          if (spec.brass) this.brass.start(spec.brass, sr, note, velocity, seed);
          return this.brass;
        case "flute":
          this.flute ??= new FluteVoiceCore(sr);
          if (spec.flute) this.flute.start(spec.flute, sr, note, velocity, seed);
          return this.flute;
        case "piano":
          this.piano ??= new PianoVoiceCore(sr);
          if (spec.piano) this.piano.start(spec.piano, sr, note, velocity, seed);
          return this.piano;
        case "pipe-organ":
          this.pipeOrgan ??= new PipeOrganVoiceCore(sr);
          if (spec.pipeOrgan) this.pipeOrgan.start(spec.pipeOrgan, sr, note, velocity, seed);
          return this.pipeOrgan;
        case "percussion":
          this.percussion ??= new PercussionVoiceCore(sr);
          if (spec.percussion) this.percussion.start(spec.percussion, sr, note, velocity, seed);
          return this.percussion;
        case "plucked-string":
          this.pluckedString ??= new PluckedStringVoiceCore(sr);
          if (spec.pluckedString)
            this.pluckedString.start(spec.pluckedString, sr, note, velocity, seed);
          return this.pluckedString;
        case "vocal":
          this.vocal ??= new VocalVoiceCore();
          if (spec.vocal) this.vocal.start(spec.vocal, sr, note, velocity, seed);
          return this.vocal;
        case "free-reed":
          this.freeReed ??= new FreeReedVoiceCore();
          if (spec.freeReed) this.freeReed.start(spec.freeReed, sr, note, velocity, seed);
          return this.freeReed;
      }
    }
    /**
     * Release the note. `soft` skips the exciter core's physical damper (whose
     * time is the deep `releaseDampS`, often ~0.1 s and abrupt) and lets the amp
     * envelope's release be the whole fade — used live for struck/plucked voices
     * so a key-up rings out musically instead of snapping off. Offline renders
     * never release, so this only affects live playback.
     */
    noteOff(soft = false) {
      if (!this.active) return;
      if (!soft) this.current?.release();
      this.env.release();
    }
    kill() {
      this.current?.kill();
      this.active = false;
      this.note = -1;
    }
    renderCore() {
      return this.current ? this.current.render(1) : 0;
    }
    /** Render one sample; returns 0 and deactivates when the envelope finishes. */
    render() {
      if (!this.active) return 0;
      let s = this.renderCore();
      if (this.body.active()) s = this.body.process(s);
      if (this.drive > 0) s = Math.tanh((1 + 3 * this.drive) * s) * this.driveMakeup;
      s *= this.env.next() * this.gain;
      if (this.env.done()) {
        this.active = false;
        this.note = -1;
      }
      return s;
    }
  };
  function defaultEnvFor(mode) {
    switch (mode) {
      case "karplus-strong":
        return { attackMs: 2, decayMs: 1e5, sustain: 1, releaseMs: 300 };
      case "bowed-string":
        return { attackMs: 40, decayMs: 1e5, sustain: 1, releaseMs: 260 };
      case "piano":
        return { attackMs: 6, decayMs: 1e5, sustain: 1, releaseMs: 700 };
      case "modal":
        return { attackMs: 0.5, decayMs: 1e5, sustain: 1, releaseMs: 500 };
      case "percussion":
        return { attackMs: 0.5, decayMs: 1e5, sustain: 1, releaseMs: 300 };
      case "pipe-organ":
        return { attackMs: 14, decayMs: 1e5, sustain: 1, releaseMs: 220 };
      case "reed":
        return { attackMs: 40, decayMs: 1e5, sustain: 1, releaseMs: 170 };
      case "brass":
        return { attackMs: 25, decayMs: 1e5, sustain: 1, releaseMs: 170 };
      case "flute":
        return { attackMs: 18, decayMs: 1e5, sustain: 1, releaseMs: 170 };
      case "plucked-string":
        return { attackMs: 2, decayMs: 1e5, sustain: 1, releaseMs: 300 };
      case "vocal":
        return { attackMs: 30, decayMs: 1e5, sustain: 1, releaseMs: 200 };
      case "free-reed":
        return { attackMs: 20, decayMs: 1e5, sustain: 1, releaseMs: 180 };
    }
  }
  function buildDefaultSpec(mode) {
    const info = ENGINE_INFO[mode];
    const spec = {
      engineMode: mode,
      body: info.defaultBody,
      bodyMix: info.defaultBodyMix,
      drive: 0,
      ampEnv: defaultEnvFor(mode),
      gain: info.defaultGain
    };
    switch (mode) {
      case "karplus-strong":
        spec.ks = defaultKsParams();
        break;
      case "modal":
        spec.modal = defaultModalParams();
        break;
      case "bowed-string":
        spec.bowed = defaultBowedParams();
        break;
      case "reed":
        spec.reed = defaultReedParams();
        break;
      case "brass":
        spec.brass = defaultBrassParams();
        break;
      case "flute":
        spec.flute = defaultFluteParams();
        break;
      case "piano":
        spec.piano = defaultPianoParams();
        break;
      case "pipe-organ":
        spec.pipeOrgan = defaultPipeOrganParams();
        break;
      case "percussion": {
        const p = defaultPercussionParams();
        p.numModes = 5;
        p.strikeR = 0.35;
        p.modeDecayS = 0.5;
        spec.percussion = p;
        break;
      }
      case "plucked-string":
        spec.pluckedString = defaultPluckedParams();
        break;
      case "vocal":
        spec.vocal = defaultVocalParams();
        break;
      case "free-reed":
        spec.freeReed = defaultFreeReedParams();
        break;
    }
    return spec;
  }

  // src/tuner/worklet/tuner-processor.ts
  var MAX_VOICES = 8;
  var SILENCE_THRESH = 1e-4;
  var SILENCE_HOLD_S = 0.3;
  var DECAYING_ENGINES = /* @__PURE__ */ new Set([
    "karplus-strong",
    "plucked-string",
    "piano",
    "modal",
    "percussion"
  ]);
  var TunerProcessor = class extends AudioWorkletProcessor {
    voices = [];
    spec = buildDefaultSpec("karplus-strong");
    outputGain = 0.9;
    age = 0n;
    seq = 0;
    /** Per-voice block peak, reused each render block for end detection. */
    vpeak = new Array(MAX_VOICES).fill(0);
    /** Per-voice consecutive silent-sample count (resets on any audible block). */
    silent = new Array(MAX_VOICES).fill(0);
    silenceHold = Math.round(sampleRate * SILENCE_HOLD_S);
    constructor() {
      super();
      for (let i = 0; i < MAX_VOICES; ++i) this.voices.push(new PhysicalVoice(sampleRate));
      this.port.onmessage = (e) => this.onMessage(e.data);
      this.port.postMessage({ type: "ready" });
    }
    onMessage(msg) {
      switch (msg.type) {
        case "spec":
          if (msg.spec) this.spec = msg.spec;
          break;
        case "noteOn":
          if (typeof msg.note === "number") this.noteOn(msg.note, msg.velocity ?? 100);
          break;
        case "noteOff":
          if (typeof msg.note === "number") this.noteOff(msg.note);
          break;
        case "panic":
          for (const v of this.voices) v.kill();
          break;
        case "gain":
          if (typeof msg.value === "number") this.outputGain = msg.value;
          break;
      }
    }
    noteOn(note, velocity) {
      let slot = this.voices.findIndex((v) => !v.active);
      if (slot < 0) slot = 0;
      this.age += 1n;
      this.silent[slot] = 0;
      this.voices[slot].noteOn(this.spec, note, velocity, slot, this.age);
    }
    noteOff(note) {
      const soft = DECAYING_ENGINES.has(this.spec.engineMode);
      for (const v of this.voices) {
        if (v.active && v.note === note) v.noteOff(soft);
      }
    }
    process(_inputs, outputs) {
      const output = outputs[0];
      if (!output || output.length < 1) return true;
      const left = output[0];
      const right = output[1] ?? output[0];
      const n = left.length;
      const g = this.outputGain;
      const voices = this.voices;
      const vc = voices.length;
      let peak = 0;
      for (let vi = 0; vi < vc; ++vi) this.vpeak[vi] = 0;
      for (let i = 0; i < n; ++i) {
        let s = 0;
        for (let vi = 0; vi < vc; ++vi) {
          const v = voices[vi];
          if (!v.active) continue;
          const sv = v.render();
          s += sv;
          const av = sv < 0 ? -sv : sv;
          if (av > this.vpeak[vi]) this.vpeak[vi] = av;
        }
        s *= g;
        left[i] = s;
        if (right !== left) right[i] = s;
        const a = s < 0 ? -s : s;
        if (a > peak) peak = a;
      }
      this.detectEndedVoices(n);
      this.publishMeter(peak);
      return true;
    }
    /**
     * A latched voice (never note-off'd) on a decaying engine — plucked string,
     * piano, mallet, drum — keeps `active` true because its amp envelope sustains,
     * even after the physical core has rung out. Detect that the audible output
     * has stayed below {@link SILENCE_THRESH} for {@link SILENCE_HOLD_S}, free the
     * voice, and tell the main thread so it can un-light the held key. Self-
     * oscillating voices (bowed / wind / organ) never fall silent while held, so
     * this never fires for them.
     */
    detectEndedVoices(blockLen) {
      for (let vi = 0; vi < this.voices.length; ++vi) {
        const v = this.voices[vi];
        if (!v.active) {
          this.silent[vi] = 0;
          continue;
        }
        if (this.vpeak[vi] >= SILENCE_THRESH) {
          this.silent[vi] = 0;
          continue;
        }
        this.silent[vi] += blockLen;
        if (this.silent[vi] >= this.silenceHold) {
          const note = v.note;
          v.kill();
          this.silent[vi] = 0;
          this.port.postMessage({ type: "voiceEnded", note });
        }
      }
    }
    publishMeter(peak) {
      if (++this.seq % 6 !== 0) return;
      this.port.postMessage({ type: "meter", peak });
    }
  };
  registerProcessor("libsonare-tuner", TunerProcessor);
})();
