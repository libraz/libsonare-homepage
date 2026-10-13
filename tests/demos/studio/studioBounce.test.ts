// @vitest-environment node
import { beforeAll, describe, expect, it } from 'vitest';
import {
  barFrames,
  buildStudioOps,
  EXPORT_BARS,
  EXPORT_SAMPLE_RATE,
  exportFrames,
  renderStudioMix,
} from '@/demos/studio/studioBounce';
import {
  defaultPattern,
  STUDIO_FADER_MAX,
  STUDIO_MASTER_GAIN,
  STUDIO_TRACKS,
} from '@/demos/studio/studioCopy';
import { applyOps, createRawTarget } from '@/utils/engineApply';
import { MASTER_LIMITER_CEILING } from '@/utils/masterLimiter';
import * as wasm from '@/wasm/index.js';

/**
 * The bounce is the engine's own lane mix rendered offline, so these pin what a
 * visitor gets from the download button against the engine rather than a mock:
 * a two-bar file of the stated length, a balance where no stem dominates, and
 * no clipping anywhere inside the faders' own range.
 */

const BPM = 120;

function peakOf(samples: Float32Array): number {
  let peak = 0;
  for (let i = 0; i < samples.length; i++) {
    const a = Math.abs(samples[i]);
    if (a > peak) peak = a;
  }
  return peak;
}

function rmsDb(samples: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
  return 20 * Math.log10(Math.sqrt(sum / samples.length));
}

function defaults() {
  return {
    gains: STUDIO_TRACKS.map((track) => track.gain),
    mutes: STUDIO_TRACKS.map(() => false),
    masterGain: STUDIO_MASTER_GAIN,
  };
}

function render(settings = defaults()): Float32Array {
  const mix = renderStudioMix(wasm, defaultPattern(), BPM, settings);
  if (!mix) throw new Error('nothing rendered');
  return mix;
}

beforeAll(async () => {
  await wasm.init();
}, 30_000);

describe('renderStudioMix', () => {
  it('writes exactly the two bars plus the release tail, not the auto-derived length', () => {
    const mix = render();
    expect(mix.length).toBe(exportFrames(BPM) * 2);
    // 2 bars at 120 BPM is 4 s; the tail keeps the file well under 10 s.
    expect(exportFrames(BPM) / 48_000).toBeLessThan(6);
  });

  it('the fixed release tail outlasts what the instruments actually ring', () => {
    // tailSamples() is a conservative upper bound (~2.4 s for the closed hat
    // against a decay under 0.8 s), so the export keeps its own tail; this pins
    // that the render is silent to −100 dBFS before the file ends.
    const engine = new wasm.RealtimeEngine(EXPORT_SAMPLE_RATE, 128);
    const end = barFrames(EXPORT_SAMPLE_RATE, BPM) * EXPORT_BARS;
    try {
      engine.setTempoSegments([{ startPpq: 0, bpm: BPM }]);
      applyOps(
        createRawTarget(engine),
        buildStudioOps(defaultPattern(), BPM, defaults(), EXPORT_SAMPLE_RATE, EXPORT_BARS),
      );
      engine.play();
      const long = engine.bounceOffline({
        totalFrames: end + EXPORT_SAMPLE_RATE * 4,
        blockSize: 128,
        numChannels: 2,
        dither: 0,
      }).interleaved;
      let last = 0;
      for (let i = 0; i < long.length; i++) if (Math.abs(long[i]) > 1e-5) last = i >> 1;
      expect(last).toBeGreaterThan(end);
      expect(last).toBeLessThan(exportFrames(BPM));
      // The engine's bound never truncates what actually rings.
      expect(engine.tailSamples()).toBeGreaterThanOrEqual(last - end);
    } finally {
      engine.destroy();
    }
  });

  it('mixes at the defaults without clipping and at a usable level', () => {
    const peak = peakOf(render());
    expect(peak).toBeLessThan(1);
    expect(peak).toBeGreaterThan(0.1);
  });

  it('balances the three stems so none dominates at the defaults', () => {
    const levels = STUDIO_TRACKS.map((_, soloed) =>
      rmsDb(render({ ...defaults(), mutes: STUDIO_TRACKS.map((_, i) => i !== soloed) })),
    );
    const spread = Math.max(...levels) - Math.min(...levels);
    expect(spread).toBeLessThan(8);
  });

  it('cannot clip with every fader at its maximum: the master limiter holds the ceiling', () => {
    const maxed = render({
      gains: STUDIO_TRACKS.map(() => STUDIO_FADER_MAX),
      mutes: STUDIO_TRACKS.map(() => false),
      masterGain: STUDIO_FADER_MAX,
    });
    const peak = peakOf(maxed);
    expect(peak).toBeLessThan(1);
    expect(peak).toBeLessThanOrEqual(MASTER_LIMITER_CEILING * 1.02);
  });

  it('renders nothing when every track is muted', () => {
    expect(
      renderStudioMix(wasm, defaultPattern(), BPM, {
        ...defaults(),
        mutes: STUDIO_TRACKS.map(() => true),
      }),
    ).toBeNull();
  });
});
