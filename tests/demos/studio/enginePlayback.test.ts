// @vitest-environment node
/**
 * Preview equals export: one studio session — pattern, tempo, faders, a mute
 * and the master fader — built with the page's own ops, rendered through the
 * live worklet facade and through the WAV export's raw-engine bounce, must
 * agree sample for sample. Live fader and mute edits mid-render must keep the
 * two adapters identical as well.
 */
import { afterEach, describe, expect, it } from 'vitest';
import {
  buildStudioOps,
  EXPORT_BARS,
  EXPORT_SAMPLE_RATE,
  exportFrames,
  masterFaderOp,
  renderStudioMix,
  type StudioMixSettings,
  trackFaderOp,
  trackMuteOp,
} from '@/demos/studio/studioBounce';
import { defaultPattern } from '@/demos/studio/studioCopy';
import { applyOps, createFacadeTarget, createRawTarget } from '@/utils/engineApply';
import {
  createFacadeLoopback,
  createRawEngine,
  type FacadeLoopback,
  loadIndexModule,
  maxAbsDiff,
  RENDER_QUANTUM,
  rms,
  type StereoBuffer,
} from '../../wasm/support/engineHarness';

const SR = EXPORT_SAMPLE_RATE;
const BPM = 132;

const facades: FacadeLoopback[] = [];
afterEach(() => {
  for (const f of facades.splice(0)) f.dispose();
});

function session(): StudioMixSettings {
  return { gains: [0.5, 1.2, 0.8], mutes: [false, true, false], masterGain: 1.3 };
}

async function facadeWith(settings: StudioMixSettings) {
  const f = await createFacadeLoopback({ sampleRate: SR });
  facades.push(f);
  f.engine.setTempoSegments([{ startPpq: 0, bpm: BPM }]);
  const target = createFacadeTarget(f.engine);
  applyOps(target, buildStudioOps(defaultPattern(), BPM, settings, SR, EXPORT_BARS));
  f.flush();
  return { f, target };
}

describe('studio preview and export render the same session', () => {
  it('facade-synchronized state matches the WAV export bounce sample for sample', async () => {
    const wasm = await loadIndexModule();
    const settings = session();
    const frames = exportFrames(BPM);
    const exported = renderStudioMix(wasm, defaultPattern(), BPM, settings);
    if (!exported) throw new Error('nothing rendered');
    expect(exported.length).toBe(frames * 2);
    const left = new Float32Array(frames);
    const right = new Float32Array(frames);
    for (let i = 0; i < frames; i++) {
      left[i] = exported[2 * i];
      right[i] = exported[2 * i + 1];
    }

    const { f } = await facadeWith(settings);
    f.engine.transport.play();
    f.flush();
    // Bounce primes itself without rendering, so the facade and the export Worker
    // share one lifecycle; live process() is compared with the raw engine below.
    const bounced = f.processor.engine.bounceOffline({
      totalFrames: frames,
      blockSize: RENDER_QUANTUM,
      numChannels: 2,
      dither: 0,
    }).interleaved;
    const live = {
      left: Float32Array.from({ length: frames }, (_, i) => bounced[i * 2]),
      right: Float32Array.from({ length: frames }, (_, i) => bounced[i * 2 + 1]),
    };
    expect(f.syncErrors).toEqual([]);

    expect(rms(left)).toBeGreaterThan(1e-2);
    const diff = Math.max(maxAbsDiff(live.left, left), maxAbsDiff(live.right, right));
    expect(diff).toBeLessThanOrEqual(1e-7);
  });

  it('live fader and mute edits mid-render keep facade and raw engine identical', async () => {
    const settings = session();
    const edit = [trackFaderOp(0, 1.1), trackMuteOp(1, false), masterFaderOp(0.7)];
    const lead = RENDER_QUANTUM * 150;
    const rest = RENDER_QUANTUM * 300;

    // Neither side renders a stopped quantum first: both start from the queued state.
    const { f, target } = await facadeWith(settings);
    f.engine.transport.play();
    const liveLead = f.render(lead);
    applyOps(target, edit);
    const liveRest = f.render(rest);
    expect(f.syncErrors).toEqual([]);

    const raw = await createRawEngine(SR);
    raw.setTempoSegments([{ startPpq: 0, bpm: BPM }]);
    const rawTarget = createRawTarget(raw);
    applyOps(rawTarget, buildStudioOps(defaultPattern(), BPM, settings, SR, EXPORT_BARS));
    const renderRaw = (frames: number): StereoBuffer => {
      // Chunks, not one-shot renders: a one-shot render releases every held note.
      const [left, right] = raw.renderOffline({
        channels: [new Float32Array(frames), new Float32Array(frames)],
        blockSize: RENDER_QUANTUM,
        finalize: false,
      });
      return { left, right };
    };
    raw.play();
    const rawLead = renderRaw(lead);
    applyOps(rawTarget, edit);
    const rawRest = renderRaw(rest);
    raw.destroy();

    expect(maxAbsDiff(liveLead.left, rawLead.left)).toBeLessThanOrEqual(1e-7);
    expect(maxAbsDiff(liveRest.left, rawRest.left)).toBeLessThanOrEqual(1e-7);
    expect(maxAbsDiff(liveRest.right, rawRest.right)).toBeLessThanOrEqual(1e-7);
    expect(rms(liveRest.left)).toBeGreaterThan(1e-3);
  });
});
