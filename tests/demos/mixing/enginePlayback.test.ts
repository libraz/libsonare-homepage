// @vitest-environment node
/**
 * One three-track state synchronized through the live facade and the export
 * Worker must bounce sample for sample. Live worklet processing is separately
 * compared with the raw engine under the same rendering lifecycle. The state touches
 * every engine surface the mix uses: trimmed and faded clips, strip EQ, gate,
 * compressor, de-esser, keyed ducking, pre- and post-fader sends into the
 * reverb and delay buses, fader/pan/width automation, pan law, pan mode, dual
 * pan, channel delay, a VCA group, polarity, and the master Glue and Limiter.
 */
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { MixAudioTransfer } from '@/demos/mixing/mixing.worker';
import {
  buildFull,
  diff,
  exportFrames,
  MIX_TEMPO_BPM,
  type MixAudio,
} from '@/demos/mixing/mixingEngine';
import {
  addAutomationPoint,
  addTrack,
  arrangementEndSec,
  createMixingState,
  type MixingState,
  moveClip,
  setBusGain,
  setBusParam,
  setChannelDelay,
  setClipFades,
  setDualPan,
  setDuckKey,
  setEqBand,
  setFader,
  setMasterFader,
  setMasterSlotBypass,
  setMasterSlotParam,
  setPan,
  setPanLaw,
  setPanMode,
  setPolarity,
  setSend,
  setSlotBypass,
  setSlotParam,
  setSolo,
  setSoloSafe,
  setVcaGain,
  setVcaGroup,
  trimClip,
} from '@/demos/mixing/mixingState';
import { applyOps, createFacadeTarget, createRawTarget, type EngineOp } from '@/utils/engineApply';
import {
  createFacadeLoopback,
  createRawEngine,
  type FacadeLoopback,
  loadIndexModule,
  maxAbsDiff,
  noise,
  RENDER_QUANTUM,
  rms,
  type StereoBuffer,
  sine,
} from '../../wasm/support/engineHarness';

const SR = 48_000;
const SOURCE_SEC = 1;

let renderMixExport: typeof import('@/demos/mixing/mixing.worker').renderMixExport;

beforeAll(async () => {
  // The worker module installs its message handler on `self` when imported.
  Object.defineProperty(globalThis, 'self', {
    configurable: true,
    value: { postMessage() {} },
  });
  ({ renderMixExport } = await import('@/demos/mixing/mixing.worker'));
});

const facades: FacadeLoopback[] = [];
afterEach(() => {
  for (const f of facades.splice(0)) f.dispose();
});

function burst(seed: number): Float32Array {
  const out = noise(SOURCE_SEC, seed, SR, 0.6);
  for (let i = 0; i < out.length; i++) out[i] *= Math.exp(-((i % 12_000) / SR) * 18);
  return out;
}

function mixed(...parts: Float32Array[]): Float32Array {
  const out = new Float32Array(parts[0].length);
  for (const part of parts) for (let i = 0; i < out.length; i++) out[i] += part[i];
  return out;
}

function audio(): Map<number, MixAudio> {
  return new Map([
    [1, { channels: [burst(1), burst(2)], sampleRate: SR }],
    [
      2,
      {
        channels: [
          mixed(sine(82, SOURCE_SEC, SR, 0.4), sine(164, SOURCE_SEC, SR, 0.1)),
          mixed(sine(82, SOURCE_SEC, SR, 0.4), sine(246, SOURCE_SEC, SR, 0.1)),
        ],
        sampleRate: SR,
      },
    ],
    [
      3,
      {
        channels: [
          mixed(sine(220, SOURCE_SEC, SR, 0.3), noise(SOURCE_SEC, 5, SR, 0.05)),
          mixed(sine(330, SOURCE_SEC, SR, 0.25), noise(SOURCE_SEC, 6, SR, 0.05)),
        ],
        sampleRate: SR,
      },
    ],
  ]);
}

function threeTrackState(): MixingState {
  let s = createMixingState();
  s = addTrack(s, 'drums', SOURCE_SEC);
  s = addTrack(s, 'bass', SOURCE_SEC);
  s = addTrack(s, 'vox', SOURCE_SEC);

  // Drums: trimmed, faded clip; HPF + peak; gate and comp; pre-fader reverb send; automated fader in VCA A; −6 dB pan law, channel delay.
  s = moveClip(s, 1, 0.05);
  s = trimClip(s, 1, 0.02, 0.7);
  s = setClipFades(s, 1, 0.01, 0.05);
  s = setEqBand(s, 1, 0, { frequencyHz: 80, enabled: true });
  s = setEqBand(s, 1, 2, { frequencyHz: 1000, gainDb: 4, enabled: true });
  s = setSlotBypass(s, 1, 'gate', false);
  s = setSlotParam(s, 1, 'gate', 'thresholdDb', -40);
  s = setSlotBypass(s, 1, 'comp', false);
  s = setSlotParam(s, 1, 'comp', 'thresholdDb', -24);
  s = setSlotParam(s, 1, 'comp', 'ratio', 4);
  s = setSend(s, 1, 'reverb', { levelDb: -10, timing: 'preFader' });
  s = addAutomationPoint(s, 1, 'fader', { id: 'f0', timeSec: 0, value: -2, curve: 'linear' });
  s = addAutomationPoint(s, 1, 'fader', { id: 'f1', timeSec: 0.5, value: -8, curve: 'linear' });
  s = setVcaGroup(s, 1, 'A');
  s = setPanLaw(s, 1, 2);
  s = setChannelDelay(s, 1, 0.75);

  // Bass: ducked from the drums; post-fader delay send; automated width; stereo-panned, linear law; in VCA A.
  s = setSlotBypass(s, 2, 'duck', false);
  s = setSlotParam(s, 2, 'duck', 'thresholdDb', -30);
  s = setSlotParam(s, 2, 'duck', 'rangeDb', 12);
  s = setDuckKey(s, 2, 1);
  s = setSend(s, 2, 'delay', { levelDb: -12 });
  s = addAutomationPoint(s, 2, 'width', { id: 'w0', timeSec: 0.1, value: 0.3, curve: 's-curve' });
  s = addAutomationPoint(s, 2, 'width', { id: 'w1', timeSec: 0.8, value: 1.6, curve: 'linear' });
  s = setPan(s, 2, -0.3);
  s = setPanMode(s, 2, 1);
  s = setPanLaw(s, 2, 3);
  s = setFader(s, 2, -3);
  s = setVcaGroup(s, 2, 'A');

  // Vox: de-esser, left polarity flipped, trim, post-fader reverb send, dual pan, automated pan.
  s = setSlotBypass(s, 3, 'deess', false);
  s = setSlotParam(s, 3, 'deess', 'thresholdDb', -36);
  s = setSlotParam(s, 3, 'trim', 'levelDb', 2);
  s = setPolarity(s, 3, 'left', true);
  s = setSend(s, 3, 'reverb', { levelDb: -8 });
  s = setPanMode(s, 3, 2);
  s = setDualPan(s, 3, -0.6, 0.4);
  s = addAutomationPoint(s, 3, 'pan', { id: 'p0', timeSec: 0, value: -0.8, curve: 'exponential' });
  s = addAutomationPoint(s, 3, 'pan', { id: 'p1', timeSec: 0.6, value: 0.8, curve: 'hold' });

  s = setBusParam(s, 'reverb', 'decay', 0.6);
  s = setBusGain(s, 'reverb', -2);
  s = setBusParam(s, 'delay', 'feedback', 0.35);
  s = setBusParam(s, 'delay', 'delayTimeLMs', 120);
  s = setBusParam(s, 'delay', 'delayTimeRMs', 180);
  s = setBusGain(s, 'delay', -4);
  s = setMasterSlotBypass(s, 'glue', false);
  s = setMasterSlotParam(s, 'glue', 'thresholdDb', -20);
  s = setMasterSlotBypass(s, 'limiter', false);
  s = setMasterSlotParam(s, 'limiter', 'ceilingDb', -1);
  s = setMasterFader(s, -1);
  s = setVcaGain(s, 'A', -3);
  return s;
}

function transfers(registry: Map<number, MixAudio>): MixAudioTransfer[] {
  return [...registry].map(([trackId, entry]) => ({ trackId, ...entry }));
}

async function facadeWith(state: MixingState, registry: Map<number, MixAudio>) {
  const f = await createFacadeLoopback({ sampleRate: SR });
  facades.push(f);
  f.engine.transport.setTempo(MIX_TEMPO_BPM);
  const target = createFacadeTarget(f.engine);
  applyOps(target, buildFull(state, registry, SR));
  f.flush();
  return { f, target };
}

describe('mixing preview and export render the same state', () => {
  it('facade-synchronized state matches the export bounce sample for sample', async () => {
    const wasm = await loadIndexModule();
    const state = threeTrackState();
    const registry = audio();

    const frames = exportFrames(state, SR, (processor, params, rate) =>
      wasm.masteringInsertTiming(processor, params, rate),
    );
    const exported = renderMixExport(wasm, state, transfers(registry), SR, { dither: 0 });
    expect(exported.left.length).toBe(frames);

    const { f } = await facadeWith(state, registry);
    f.engine.transport.play();
    f.flush();
    // Bounce adopts lane controls and automation before settling, without rendering
    // a stopped quantum. Compare the facade and Worker under that same lifecycle;
    // the live process path is compared with raw renderOffline below.
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

    expect(rms(live.left)).toBeGreaterThan(1e-2);
    expect(rms(exported.right)).toBeGreaterThan(1e-2);
    const diffL = maxAbsDiff(live.left, exported.left);
    const diffR = maxAbsDiff(live.right, exported.right);
    expect(Math.max(diffL, diffR)).toBeLessThanOrEqual(1e-7);
  });

  it('the export runs past the last clip by the bus tails', async () => {
    const wasm = await loadIndexModule();
    const state = threeTrackState();
    const exported = renderMixExport(wasm, state, transfers(audio()), SR, { dither: 0 });
    const clipEnd = Math.ceil(arrangementEndSec(state) * SR);
    const plateTail = wasm.masteringInsertTiming(
      'effects.reverb.plate',
      state.buses.reverb.params,
      SR,
    ).tailSamples;
    expect(exported.left.length).toBeGreaterThanOrEqual(clipEnd + plateTail);
    // The reverb is still ringing after the last clip ends.
    expect(rms(exported.left, clipEnd, clipEnd + SR / 4)).toBeGreaterThan(1e-5);
    expect(Number.isFinite(exported.integratedLufs)).toBe(true);
    expect(exported.truePeakDb).toBeLessThanOrEqual(-1 + 0.2);
  });

  it('a diff applied mid-render keeps facade and raw engine identical', async () => {
    const before = threeTrackState();
    let after = setVcaGain(before, 'A', -6);
    after = setSlotParam(after, 1, 'comp', 'thresholdDb', -30);
    after = setSend(after, 1, 'reverb', { timing: 'postFader' });
    after = setSlotParam(after, 1, 'gate', 'holdMs', 20);
    after = setEqBand(after, 3, 4, { gainDb: 3, enabled: true });
    after = setSlotBypass(after, 2, 'duck', true);
    after = setBusParam(after, 'reverb', 'dryWet', 0.8);
    after = setChannelDelay(after, 1, 1.5);
    after = setDualPan(after, 3, 0.1, 0.9);
    after = setPanLaw(after, 2, 1);
    const registry = audio();
    const edit = diff(before, after, registry, SR);
    expect(edit.some((op) => op.type === 'strip')).toBe(true);
    expect(edit.filter((op) => op.type === 'stripScalars').map((op) => op.trackId)).toEqual([
      1, 2, 3,
    ]);

    const lead = RENDER_QUANTUM * 150;
    const rest = RENDER_QUANTUM * 300;

    const { f, target } = await facadeWith(before, registry);
    f.engine.transport.play();
    const liveLead = f.render(lead);
    applyOps(target, edit);
    const liveRest = f.render(rest);
    expect(f.syncErrors).toEqual([]);

    const raw = await createRawEngine(SR);
    raw.setTempo(MIX_TEMPO_BPM);
    const rawTarget = createRawTarget(raw);
    applyOps(rawTarget, buildFull(before, registry, SR));
    const renderRaw = (frames: number): StereoBuffer => {
      const [left, right] = raw.renderOffline(
        [new Float32Array(frames), new Float32Array(frames)],
        RENDER_QUANTUM,
      );
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

describe('page-side folding in the ops', () => {
  const ops = (state: MixingState) => buildFull(state, new Map(), SR);
  const ofType = <T extends EngineOp['type']>(list: EngineOp[], type: T) =>
    list.filter((op): op is Extract<EngineOp, { type: T }> => op.type === type);

  it('solo is solved per lane and honours solo-safe', () => {
    let s = threeTrackState();
    s = setSolo(s, 1, true);
    s = setSoloSafe(s, 2, true);
    expect(ofType(ops(s), 'soloMute').map((op) => [op.trackId, op.solo, op.mute])).toEqual([
      [1, false, false],
      [2, false, false],
      [3, false, true],
    ]);
    const unsolo = diff(s, setSolo(s, 1, false), new Map(), SR);
    expect(ofType(unsolo, 'soloMute').map((op) => [op.trackId, op.mute])).toEqual([[3, false]]);
  });

  it('a VCA gain lands on member faders and on their fader automation points', () => {
    const s = threeTrackState();
    const faders = new Map(ofType(ops(s), 'fader').map((op) => [op.target, op.db]));
    expect(faders.get(1)).toBe(0 - 3);
    expect(faders.get(2)).toBe(-3 - 3);
    expect(faders.get(3)).toBe(0);
    const faderLane = ofType(ops(s), 'automation').find((op) => op.param.kind === 'fader');
    expect(faderLane?.points.map((p) => p.value)).toEqual([-2 - 3, -8 - 3]);

    const changed = diff(s, setVcaGain(s, 'A', 0), new Map(), SR);
    expect(ofType(changed, 'fader').map((op) => [op.target, op.db])).toEqual([
      [1, 0],
      [2, -3],
    ]);
    expect(ofType(changed, 'automation').map((op) => op.points.map((p) => p.value))).toEqual([
      [-2, -8],
    ]);
  });

  it('width automation drives the imager slot by name', () => {
    const lane = ofType(ops(threeTrackState()), 'automation').find(
      (op) => op.param.kind === 'insert',
    );
    expect(lane?.param).toEqual({
      kind: 'insert',
      strip: { kind: 'track', trackId: 2 },
      insertIndex: 5,
      paramName: 'width',
    });
    expect(lane?.points.map((p) => [p.ppq, p.value, p.curveToNext])).toEqual([
      [0.1, 0.3, 3],
      [0.8, 1.6, 0],
    ]);
  });

  it('a live param is a by-name set; a construction-only one rebuilds the strip and re-sends it', () => {
    const s = threeTrackState();
    const live = diff(s, setSlotParam(s, 2, 'duck', 'ratio', 4), new Map(), SR);
    expect(live).toEqual([
      {
        type: 'insertParam',
        strip: { kind: 'track', trackId: 2 },
        insertIndex: 4,
        name: 'ratio',
        value: 4,
      },
    ]);
    const discrete = diff(s, setSlotParam(s, 2, 'gate', 'holdMs', 15), new Map(), SR);
    expect(discrete[0].type).toBe('strip');
    expect(ofType(discrete, 'insertBypass')).toHaveLength(6);
    expect(ofType(discrete, 'sidechain')).toEqual([
      { type: 'sidechain', trackId: 2, insertIndex: 4, sourceTrackId: 1 },
    ]);
    expect(ofType(discrete, 'automation')).toHaveLength(1);
    expect(ofType(discrete, 'fader')).toHaveLength(1);
  });

  it('an unchanged state diffs to nothing', () => {
    const s = threeTrackState();
    expect(diff(s, structuredClone(s), audio(), SR)).toEqual([]);
  });
});
