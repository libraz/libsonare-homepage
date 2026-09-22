// @vitest-environment node
import { beforeAll, describe, expect, it } from 'vitest';
import { applyCompiled } from '@/demos/step-bass/stepBassApply';
import {
  envFilterCurve,
  envOpenCutoffHz,
  type FilterCurvePoint,
  filterCurve,
} from '@/demos/step-bass/stepBassFilterCurve';
import {
  RENDER_NOW,
  STEP_BASS_ARTICULATION,
  STEP_BASS_BASE_PATCH,
  STEP_BASS_TRACK_ID,
} from '@/demos/step-bass/stepBassPatch';
import type { CompiledPattern } from '@/demos/step-bass/stepBassTypes';
import { masterLimiterStripJson } from '@/utils/masterLimiter';
import { noteOnWord } from '@/utils/ump';
import * as wasm from '@/wasm/index.js';

/**
 * The panel's filter curve is computed, not measured — the engine exposes no
 * filter-response API. This pins it against a rendered noise pass through the
 * actual patch instead of trusting the closed-form model on its own.
 */

const SAMPLE_RATE = 48_000;
const BLOCK = 128;
const BPM = 120;
const FRAMES_PER_PPQ = (SAMPLE_RATE * 60) / BPM;
/**
 * The filter envelope's own decay keeps moving the cutoff for longer than its
 * nominal length asks for, so the skip has to clear it with margin rather
 * than trust the requested envelope timing.
 */
const SKIP_FRAMES = 48_000;
const MEASURE_FRAMES = 96_000;
const RENDER_FRAMES = SKIP_FRAMES + MEASURE_FRAMES;
const LOOP_PPQ = Math.ceil(RENDER_FRAMES / FRAMES_PER_PPQ) + 1;
const LOOP_FRAMES = Math.round(FRAMES_PER_PPQ * LOOP_PPQ);
const TEST_NOTE = 45;

type Engine = InstanceType<typeof wasm.RealtimeEngine>;

function report(label: string, value: unknown): void {
  console.info(`  ${label}: ${typeof value === 'object' ? JSON.stringify(value) : value}`);
}

function pump(engine: Engine, frames: number): Float32Array {
  const out = new Float32Array(frames);
  let done = 0;
  while (done < frames) {
    const n = Math.min(BLOCK, frames - done);
    const left = engine.getChannelBuffer(0, BLOCK);
    const right = engine.getChannelBuffer(1, BLOCK);
    left.fill(0, 0, n);
    right.fill(0, 0, n);
    engine.processPrepared(n);
    out.set(left.subarray(0, n), done);
    done += n;
  }
  return out;
}

interface NoiseCase {
  cutoffHz: number;
  resonanceQ: number;
  envToCutoffCents?: number;
  filterSustain?: number;
}

/** A held note on a `'noise'` oscillator, so the render's spectrum is the filter's own shape. */
function noiseCompiled(opts: NoiseCase): CompiledPattern {
  const faderDb = -12;
  return {
    sampleRate: SAMPLE_RATE,
    bpm: BPM,
    patch: {
      ...STEP_BASS_BASE_PATCH,
      waveform: 'noise',
      cutoffHz: opts.cutoffHz,
      resonanceQ: opts.resonanceQ,
      envToCutoffCents: opts.envToCutoffCents ?? 0,
      filterAttackMs: 0,
      filterDecayMs: 0,
      filterSustain: opts.filterSustain ?? 0,
    },
    articulation: STEP_BASS_ARTICULATION,
    clip: {
      id: 1,
      trackId: STEP_BASS_TRACK_ID,
      destinationId: STEP_BASS_TRACK_ID,
      startSample: 0,
      startPpq: 0,
      lengthSamples: LOOP_FRAMES,
      events: [{ renderFrame: 0, word0: noteOnWord(TEST_NOTE, 100) }],
    },
    loop: { startPpq: 0, endPpq: LOOP_PPQ },
    lanes: [],
    knobs: {
      cutoffHz: opts.cutoffHz,
      resonanceQ: opts.resonanceQ,
      envToCutoffCents: opts.envToCutoffCents ?? 0,
      pitchOffsetCents: 0,
      faderDb,
    },
    masterStripJson: masterLimiterStripJson(faderDb),
  };
}

function renderNoise(opts: NoiseCase): Float32Array {
  const engine = new wasm.RealtimeEngine(SAMPLE_RATE, BLOCK, 1024, 1024);
  applyCompiled(engine, noiseCompiled(opts), 'facade');
  engine.play(RENDER_NOW);
  const out = pump(engine, RENDER_FRAMES);
  engine.destroy();
  return out.subarray(SKIP_FRAMES);
}

function spectrumPoints(samples: Float32Array): FilterCurvePoint[] {
  const spectrum = wasm.meteringSpectrum(samples, SAMPLE_RATE, { nFft: 8192 });
  const points: FilterCurvePoint[] = [];
  // Bin 0 is DC; skip it.
  for (let i = 1; i < spectrum.frequencies.length; i++) {
    points.push({ freqHz: spectrum.frequencies[i], db: spectrum.db[i] });
  }
  return points;
}

/** Average level well below cutoff, as the 0 dB reference the -3 dB point is measured from. */
function passbandDb(points: FilterCurvePoint[], cutoffHz: number): number {
  const lo = Math.max(20, cutoffHz / 16);
  const hi = Math.max(lo + 1, cutoffHz / 4);
  const band = points.filter((p) => p.freqHz >= lo && p.freqHz <= hi);
  const set = band.length > 0 ? band : points.slice(0, 5);
  return set.reduce((sum, p) => sum + p.db, 0) / set.length;
}

/** A fixed low-frequency reference, for comparing two renders whose own corners differ. */
function lowFixedRefDb(points: FilterCurvePoint[]): number {
  const band = points.filter((p) => p.freqHz >= 20 && p.freqHz <= 50);
  const set = band.length > 0 ? band : points.slice(0, 5);
  return set.reduce((sum, p) => sum + p.db, 0) / set.length;
}

/** First descending crossing below `refDb - 3`, searched from the curve's peak onward. */
function minus3dbHz(points: FilterCurvePoint[], refDb: number): number {
  let peakIndex = 0;
  for (let i = 1; i < points.length; i++) {
    if (points[i].db > points[peakIndex].db) peakIndex = i;
  }
  const threshold = refDb - 3;
  for (let i = peakIndex; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    if (a.db >= threshold && b.db < threshold) {
      const t = (threshold - a.db) / (b.db - a.db);
      const logA = Math.log2(a.freqHz);
      const logB = Math.log2(b.freqHz);
      return 2 ** (logA + t * (logB - logA));
    }
  }
  return points[points.length - 1].freqHz;
}

/** Least-squares slope of dB against log2(freq), in dB/octave. */
function slopeDbPerOctave(points: FilterCurvePoint[], fromHz: number, toHz: number): number {
  const band = points.filter((p) => p.freqHz >= fromHz && p.freqHz <= toHz);
  const n = band.length;
  if (n < 2) return 0;
  const xs = band.map((p) => Math.log2(p.freqHz));
  const ys = band.map((p) => p.db);
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - meanX) * (ys[i] - meanY);
    den += (xs[i] - meanX) * (xs[i] - meanX);
  }
  return den === 0 ? 0 : num / den;
}

/**
 * Peak within a window past the passband reference, not the whole spectrum —
 * a whole-spectrum max is dominated by near-DC bin noise at low resonance,
 * where there is no real resonance feature to find.
 */
function peakNearCutoff(
  points: FilterCurvePoint[],
  cutoffHz: number,
): { db: number; freqHz: number } {
  const lo = Math.max(20, cutoffHz / 4);
  const hi = cutoffHz * 6;
  let best = { db: -Infinity, freqHz: 0 };
  for (const p of points) {
    if (p.freqHz < lo || p.freqHz > hi) continue;
    if (p.db > best.db) best = { db: p.db, freqHz: p.freqHz };
  }
  return best;
}

function centsBetween(a: number, b: number): number {
  return 1200 * Math.log2(a / b);
}

beforeAll(async () => {
  await wasm.init();
}, 60_000);

describe('computed curve vs a rendered noise pass', () => {
  const cases: NoiseCase[] = [
    { cutoffHz: 700, resonanceQ: 2 },
    { cutoffHz: 700, resonanceQ: 4 },
  ];

  it.each(cases)(
    'matches the -3 dB point and slope for cutoff $cutoffHz Hz, Q $resonanceQ',
    (testCase) => {
      const rendered = spectrumPoints(renderNoise(testCase));
      const renderedRef = passbandDb(rendered, testCase.cutoffHz);
      const renderedMinus3 = minus3dbHz(rendered, renderedRef);
      const renderedSlope = slopeDbPerOctave(rendered, renderedMinus3, renderedMinus3 * 4);

      const curve = filterCurve(testCase.cutoffHz, testCase.resonanceQ);
      const curveRef = passbandDb(curve, testCase.cutoffHz);
      const curveMinus3 = minus3dbHz(curve, curveRef);
      const curveSlope = slopeDbPerOctave(curve, curveMinus3, curveMinus3 * 4);

      const centsError = centsBetween(curveMinus3, renderedMinus3);
      const slopeError = curveSlope - renderedSlope;
      report('rendered -3dB Hz / curve -3dB Hz', [renderedMinus3, curveMinus3]);
      report('rendered slope dB/oct / curve slope dB/oct', [renderedSlope, curveSlope]);
      report('-3dB error (cents) / slope error (dB/oct)', [centsError, slopeError]);

      expect(Math.abs(centsError)).toBeLessThanOrEqual(200);
      expect(Math.abs(slopeError)).toBeLessThanOrEqual(6);
    },
    120_000,
  );
});

describe('resonance shapes the peak', () => {
  const cutoffHz = 700;
  // Spans the panel's resonanceQ travel (0.5..12); at the low end there is no
  // peak at all — the render keeps rolling off past the passband window.
  const qValues = [0.5, 6, 8, 10, 12];

  it.each(qValues)(
    'matches the peak height and location at Q %s',
    (resonanceQ) => {
      const renderedPoints = spectrumPoints(renderNoise({ cutoffHz, resonanceQ }));
      const renderedPassband = passbandDb(renderedPoints, cutoffHz);
      const renderedPeak = peakNearCutoff(renderedPoints, cutoffHz);
      const renderedBump = renderedPeak.db - renderedPassband;

      const curvePoints = filterCurve(cutoffHz, resonanceQ);
      const curvePassband = passbandDb(curvePoints, cutoffHz);
      const curvePeak = peakNearCutoff(curvePoints, cutoffHz);
      const curveBump = curvePeak.db - curvePassband;

      const bumpError = curveBump - renderedBump;
      const peakFreqError = centsBetween(curvePeak.freqHz, renderedPeak.freqHz);
      report('rendered bump dB / curve bump dB', [renderedBump, curveBump]);
      report('rendered peak Hz / curve peak Hz', [renderedPeak.freqHz, curvePeak.freqHz]);
      report('bump error (dB) / peak location error (cents)', [bumpError, peakFreqError]);

      expect(Math.abs(bumpError)).toBeLessThanOrEqual(2);
      expect(Math.abs(peakFreqError)).toBeLessThanOrEqual(200);
    },
    120_000,
  );
});

describe('envelope-mod overlay', () => {
  it('sits at the cutoff scaled by the cents ratio', () => {
    const cutoffHz = 700;
    const envModCents = 1200;
    const resonanceQ = 2;
    const expectedOpenHz = envOpenCutoffHz(cutoffHz, envModCents);

    // A fixed low-frequency reference, since the base and envelope-open
    // renders have different corners and neither reference should chase it.
    const base = spectrumPoints(renderNoise({ cutoffHz, resonanceQ }));
    const baseMinus3 = minus3dbHz(base, lowFixedRefDb(base));

    // Instant, fully-open filter envelope holds the shifted cutoff for the whole note.
    const open = spectrumPoints(
      renderNoise({ cutoffHz, resonanceQ, envToCutoffCents: envModCents, filterSustain: 1 }),
    );
    const openMinus3 = minus3dbHz(open, lowFixedRefDb(open));
    const renderedShiftCents = centsBetween(openMinus3, baseMinus3);

    const overlayBase = filterCurve(cutoffHz, resonanceQ);
    const overlayBaseMinus3 = minus3dbHz(overlayBase, passbandDb(overlayBase, cutoffHz));
    const overlay = envFilterCurve(cutoffHz, resonanceQ, envModCents);
    const overlayMinus3 = minus3dbHz(overlay, passbandDb(overlay, cutoffHz));
    const overlayShiftCents = centsBetween(overlayMinus3, overlayBaseMinus3);

    report('expected open Hz (parameter space)', expectedOpenHz);
    report('base -3dB Hz / open -3dB Hz (rendered)', [baseMinus3, openMinus3]);
    report('rendered shift (cents) / overlay shift (cents), target 1200', [
      renderedShiftCents,
      overlayShiftCents,
    ]);

    expect(Math.abs(overlayShiftCents - envModCents)).toBeLessThanOrEqual(200);
    expect(Math.abs(renderedShiftCents - envModCents)).toBeLessThanOrEqual(200);
  }, 120_000);
});
