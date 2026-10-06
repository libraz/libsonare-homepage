// @vitest-environment node
/**
 * The shared engine-apply layer, rendered through the real worklet facade and
 * the real raw engine: continuous ops keep every tail, facade and raw adapters
 * render the same project identically, and a strip op that edits one insert
 * rebuilds the strip.
 */
import { afterEach, describe, expect, it } from 'vitest';
import {
  type AutomationParam,
  applyOps,
  createFacadeTarget,
  createRawTarget,
  diffBypass,
  diffEqBands,
  diffInsertParams,
  type EngineOp,
  type StripRef,
  type StripSpec,
  type TrackStripScalars,
} from '@/utils/engineApply';
import {
  createFacadeLoopback,
  createRawEngine,
  type FacadeLoopback,
  maxAbsDiff,
  noise,
  quantumFrames,
  RENDER_QUANTUM,
  rms,
  type StereoBuffer,
  sine,
} from '../wasm/support/engineHarness';

const SR = 48_000;
const REVERB_BUS = 1;
const PLAIN_BUS = 2;
const TAIL_LANE = 1;
const SEND_LANE = 2;
const TONE_LANE = 3;
const MASTER: StripRef = { kind: 'master' };
const tailStrip: StripRef = { kind: 'track', trackId: TAIL_LANE };
const toneStrip: StripRef = { kind: 'track', trackId: TONE_LANE };

const facades: FacadeLoopback[] = [];

afterEach(() => {
  for (const f of facades.splice(0)) f.dispose();
});

async function facade(): Promise<FacadeLoopback> {
  const created = await createFacadeLoopback();
  facades.push(created);
  return created;
}

function stereo(channel: Float32Array): Float32Array[] {
  return [channel, channel.slice()];
}

function maxDiffFrom(a: StereoBuffer, b: StereoBuffer, from: number): number {
  return Math.max(
    maxAbsDiff(a.left.subarray(from), b.left.subarray(from)),
    maxAbsDiff(a.right.subarray(from), b.right.subarray(from)),
  );
}

function concat(a: StereoBuffer, b: StereoBuffer): StereoBuffer {
  const join = (x: Float32Array, y: Float32Array) => {
    const out = new Float32Array(x.length + y.length);
    out.set(x);
    out.set(y, x.length);
    return out;
  };
  return { left: join(a.left, b.left), right: join(a.right, b.right) };
}

const eqBand = (gainDb: number) => ({
  type: 'Peak' as const,
  frequencyHz: 1000,
  gainDb,
  q: 1,
  enabled: true,
});

// ---------------------------------------------------------------------------
// Continuous ops keep state (facade adapter)
//
// Each op moves a control downstream of the state it must not disturb, or on
// another path: lane 1 is a burst into a plate reverb insert followed by the
// stateless inserts the ops move; lane 2 is a burst sent into a reverb bus;
// lane 3 is a steady tone with an EQ band and a send to a plain bus. A fresh
// engine built from the post-change state then has the same reverb content,
// so any reset shows up as a difference in the tail.

/** Every continuous control the tail test moves, at its pre-change value. */
interface TailState {
  faderDb: number;
  pan: number;
  scalars: TrackStripScalars;
  trim: Record<string, number>;
  width: Record<string, number>;
  bypassed: boolean[];
  eqGainDb: number;
  sendDb: number;
  ceiling: Record<string, number>;
}

const initialState = (): TailState => ({
  faderDb: 0,
  pan: 0,
  scalars: { panLaw: 0, panMode: 0, dualPan: { left: -1, right: 1 }, channelDelaySamples: 0 },
  trim: { levelDb: 0 },
  width: { width: 1 },
  bypassed: [false, false, false, false],
  eqGainDb: 0,
  sendDb: -6,
  ceiling: { ceilingDb: -1 },
});

const tailSpec = (s: TailState): StripSpec => ({
  inserts: [
    { slot: 'pre', processor: 'effects.reverb.plate', params: { decaySec: 2.5, dryWet: 1 } },
    { slot: 'pre', processor: 'utility.gain', params: s.trim },
    { slot: 'pre', processor: 'stereo.imager', params: s.width },
    { slot: 'pre', processor: 'utility.gain', params: { levelDb: -6 } },
  ],
});

/** Full construction of the tail project from `s`, the way a demo's applyFull would. */
function buildOps(s: TailState): EngineOp[] {
  return [
    {
      type: 'topology',
      buses: [{ busId: REVERB_BUS }, { busId: PLAIN_BUS }],
      lanes: [
        { trackId: TAIL_LANE, sends: [] },
        {
          trackId: SEND_LANE,
          sends: [{ busId: REVERB_BUS, levelDb: 0, sendTiming: 'postFader' }],
        },
        {
          trackId: TONE_LANE,
          sends: [{ busId: PLAIN_BUS, levelDb: s.sendDb, sendTiming: 'postFader' }],
        },
      ],
    },
    { type: 'strip', strip: tailStrip, spec: tailSpec(s) },
    {
      type: 'strip',
      strip: { kind: 'bus', busId: REVERB_BUS },
      spec: {
        inserts: [
          { slot: 'pre', processor: 'effects.reverb.plate', params: { decaySec: 2, dryWet: 1 } },
        ],
      },
    },
    { type: 'strip', strip: toneStrip, spec: { inserts: [], eqBands: [eqBand(s.eqGainDb)] } },
    {
      type: 'strip',
      strip: MASTER,
      spec: {
        inserts: [
          {
            slot: 'post',
            processor: 'maximizer.truePeakLimiter',
            params: { ...s.ceiling, releaseMs: 10 },
          },
        ],
      },
    },
    ...diffBypass(tailStrip, [], s.bypassed),
    { type: 'fader', target: TAIL_LANE, db: s.faderDb },
    { type: 'pan', target: TAIL_LANE, pan: s.pan },
    { type: 'stripScalars', trackId: TAIL_LANE, scalars: s.scalars },
    {
      type: 'clips',
      trackId: TAIL_LANE,
      clips: [{ channels: stereo(noise(0.3, 7, SR, 0.4)), startPpq: 0 }],
    },
    {
      type: 'clips',
      trackId: SEND_LANE,
      clips: [{ channels: stereo(noise(0.3, 9, SR, 0.4)), startPpq: 0 }],
    },
    {
      type: 'clips',
      trackId: TONE_LANE,
      clips: [{ channels: stereo(sine(1000, 1.4, SR, 0.25)), startPpq: 0 }],
    },
  ];
}

const LEAD_SECONDS = 0.6;
const TAIL_SECONDS = 0.6;
const SETTLE = quantumFrames(0.05);

interface ContinuousCase {
  name: string;
  change: (s: TailState) => TailState;
  ops: (prev: TailState, next: TailState) => EngineOp[];
}

const continuousCases: ContinuousCase[] = [
  {
    name: 'fader',
    change: (s) => ({ ...s, faderDb: -9 }),
    ops: (_p, n) => [{ type: 'fader', target: TAIL_LANE, db: n.faderDb }],
  },
  {
    name: 'pan',
    change: (s) => ({ ...s, pan: 0.6 }),
    ops: (_p, n) => [{ type: 'pan', target: TAIL_LANE, pan: n.pan }],
  },
  {
    name: 'pan law, pan mode and dual pan',
    change: (s) => ({
      ...s,
      scalars: { ...s.scalars, panLaw: 2, panMode: 2, dualPan: { left: -0.5, right: 0.7 } },
    }),
    ops: (_p, n) => [
      {
        type: 'stripScalars',
        trackId: TAIL_LANE,
        scalars: {
          panLaw: n.scalars.panLaw,
          panMode: n.scalars.panMode,
          dualPan: n.scalars.dualPan,
        },
      },
    ],
  },
  {
    name: 'utility.gain levelDb by name',
    change: (s) => ({ ...s, trim: { levelDb: -7 } }),
    ops: (p, n) => diffInsertParams(tailStrip, 1, p.trim, n.trim),
  },
  {
    name: 'stereo.imager width by name',
    change: (s) => ({ ...s, width: { width: 0.4 } }),
    ops: (p, n) => diffInsertParams(tailStrip, 2, p.width, n.width),
  },
  {
    name: 'EQ band',
    change: (s) => ({ ...s, eqGainDb: 6 }),
    ops: (p, n) => diffEqBands(toneStrip, [eqBand(p.eqGainDb)], [eqBand(n.eqGainDb)]),
  },
  {
    name: 'insert bypass on a stateless insert',
    change: (s) => ({ ...s, bypassed: [false, false, false, true] }),
    ops: (p, n) => diffBypass(tailStrip, p.bypassed, n.bypassed),
  },
  {
    name: 'send level',
    change: (s) => ({ ...s, sendDb: 0 }),
    ops: (_p, n) => [
      {
        type: 'sends',
        trackId: TONE_LANE,
        sends: [{ busId: PLAIN_BUS, levelDb: n.sendDb, sendTiming: 'postFader' }],
      },
    ],
  },
  {
    name: 'master limiter ceilingDb by name',
    change: (s) => ({ ...s, ceiling: { ceilingDb: -14 } }),
    ops: (p, n) => diffInsertParams(MASTER, 0, p.ceiling, n.ceiling),
  },
];

/** Renders `before` to the change point, applies `changeOps`, renders the tail. */
async function renderWithChange(before: TailState, changeOps: EngineOp[], extra: EngineOp[] = []) {
  const live = await facade();
  const target = createFacadeTarget(live.engine);
  applyOps(target, [...buildOps(before), ...extra]);
  live.engine.transport.play();
  const lead = live.render(quantumFrames(LEAD_SECONDS));
  applyOps(target, changeOps);
  const tail = live.render(quantumFrames(TAIL_SECONDS));
  return { out: concat(lead, tail), changeAt: lead.left.length, syncErrors: live.syncErrors };
}

async function renderFresh(state: TailState, extra: EngineOp[] = []): Promise<StereoBuffer> {
  const f = await facade();
  applyOps(createFacadeTarget(f.engine), [...buildOps(state), ...extra]);
  f.engine.transport.play();
  return f.render(quantumFrames(LEAD_SECONDS + TAIL_SECONDS));
}

describe('continuous ops through the facade keep state', () => {
  it('the reverb tails are sounding where the comparison starts', async () => {
    // With the tone lane muted, what is left after the change point is the two
    // reverb tails; a reset of either would show in the comparisons below.
    const out = await renderFresh(initialState(), [
      { type: 'soloMute', trackId: TONE_LANE, solo: false, mute: true },
    ]);
    const from = quantumFrames(LEAD_SECONDS) + SETTLE;
    expect(rms(out.left, from)).toBeGreaterThan(5e-3);
  });

  it.each(continuousCases)('$name', async ({ change, ops }) => {
    const before = initialState();
    const after = change(before);
    const changeOps = ops(before, after);
    expect(changeOps.length).toBeGreaterThan(0);

    const live = await renderWithChange(before, changeOps);
    const reference = await renderFresh(after);

    expect(live.syncErrors).toEqual([]);
    expect(maxDiffFrom(live.out, reference, live.changeAt + SETTLE)).toBeLessThanOrEqual(1e-4);
    // The block right after the change still carries the mix.
    const firstBlock = rms(live.out.left, live.changeAt, live.changeAt + RENDER_QUANTUM);
    expect(firstBlock).toBeGreaterThan(1e-2);
  });

  it('channel delay shifts no other lane', async () => {
    // The tail lane's clip has ended at the change point, so delaying it moves
    // only silence: the tone and send lanes and the reverb tails must not move.
    const delay: EngineOp[] = [
      { type: 'stripScalars', trackId: TAIL_LANE, scalars: { channelDelaySamples: 37 } },
    ];
    const control = await renderWithChange(initialState(), []);
    const live = await renderWithChange(initialState(), delay);
    expect(live.syncErrors).toEqual([]);
    expect(maxDiffFrom(live.out, control.out, live.changeAt + SETTLE)).toBeLessThanOrEqual(1e-7);
    expect(rms(live.out.left, live.changeAt + SETTLE)).toBeGreaterThan(5e-3);
  });
});

// ---------------------------------------------------------------------------
// Facade and raw adapters render the same project identically

const parityLane: StripRef = { kind: 'track', trackId: 1 };

function parityOps(): EngineOp[] {
  return [
    {
      type: 'topology',
      buses: [{ busId: REVERB_BUS }],
      lanes: [
        { trackId: 1, sends: [{ busId: REVERB_BUS, levelDb: -8, sendTiming: 'postFader' }] },
        { trackId: 2, sends: [{ busId: REVERB_BUS, levelDb: -12, sendTiming: 'preFader' }] },
      ],
    },
    {
      type: 'strip',
      strip: parityLane,
      spec: {
        inserts: [
          {
            slot: 'pre',
            processor: 'dynamics.compressor',
            params: { thresholdDb: -24, ratio: 4, attackMs: 5, releaseMs: 80 },
          },
          { slot: 'pre', processor: 'utility.gain', params: { levelDb: 2 } },
        ],
        eqBands: [eqBand(-4)],
        polarityInvertLeft: true,
      },
    },
    {
      type: 'strip',
      strip: { kind: 'bus', busId: REVERB_BUS },
      spec: {
        inserts: [
          { slot: 'pre', processor: 'effects.reverb.plate', params: { decaySec: 1.5, dryWet: 1 } },
        ],
      },
    },
    {
      type: 'strip',
      strip: MASTER,
      spec: {
        inserts: [
          {
            slot: 'post',
            processor: 'maximizer.truePeakLimiter',
            params: { ceilingDb: -1, releaseMs: 50 },
          },
        ],
      },
    },
    {
      type: 'clips',
      trackId: 1,
      clips: [
        {
          channels: stereo(noise(0.8, 3, SR, 0.5)),
          startPpq: 0.05,
          clipOffsetSamples: 480,
          lengthSamples: 24_000,
          fadeInSamples: 240,
          fadeOutSamples: 960,
        },
      ],
    },
    {
      type: 'clips',
      trackId: 2,
      clips: [
        { channels: stereo(sine(330, 0.5, SR, 0.3)), startPpq: 0 },
        { channels: stereo(sine(550, 0.3, SR, 0.3)), startPpq: 0.6 },
      ],
    },
    { type: 'eqBand', strip: parityLane, bandIndex: 1, band: { ...eqBand(3), frequencyHz: 4000 } },
    { type: 'insertParam', strip: parityLane, insertIndex: 0, name: 'thresholdDb', value: -30 },
    { type: 'fader', target: 2, db: -3 },
    { type: 'fader', target: 'master', db: -2 },
    { type: 'pan', target: 2, pan: -0.4 },
    {
      type: 'stripScalars',
      trackId: 1,
      scalars: {
        panLaw: 1,
        panMode: 2,
        dualPan: { left: -0.6, right: 0.3 },
        channelDelaySamples: 24,
      },
    },
    { type: 'stripScalars', trackId: 2, scalars: { panLaw: 3, panMode: 1 } },
    { type: 'busGain', busId: REVERB_BUS, db: -2 },
    {
      type: 'automation',
      param: { kind: 'fader', target: 1 },
      points: [
        { ppq: 0, value: 0 },
        { ppq: 0.8, value: -12 },
      ],
    },
  ];
}

/** Applied to both engines mid-render. */
function parityEditOps(): EngineOp[] {
  return [
    {
      type: 'sends',
      trackId: 2,
      sends: [{ busId: REVERB_BUS, levelDb: -4, sendTiming: 'postFader' }],
    },
    { type: 'fader', target: 2, db: -9 },
    { type: 'insertBypass', strip: parityLane, insertIndex: 1, bypassed: true },
    {
      type: 'stripScalars',
      trackId: 1,
      scalars: { panLaw: 2, dualPan: { left: 0.2, right: 0.9 }, channelDelaySamples: 60 },
    },
    { type: 'soloMute', trackId: 2, solo: false, mute: true },
  ];
}

describe('facade and raw adapters render the same state', () => {
  const first = quantumFrames(0.4);
  const second = quantumFrames(0.8);

  it('match sample for sample, including an edit mid-render', async () => {
    const f = await facade();
    const facadeTarget = createFacadeTarget(f.engine);
    applyOps(facadeTarget, parityOps());
    f.engine.transport.play();
    const facadeLead = f.render(first);
    applyOps(facadeTarget, parityEditOps());
    const facadeOut = concat(facadeLead, f.render(second));
    expect(f.syncErrors).toEqual([]);

    const raw = await createRawEngine(SR);
    const rawTarget = createRawTarget(raw);
    const renderRaw = (frames: number): StereoBuffer => {
      const [left, right] = raw.renderOffline(
        [new Float32Array(frames), new Float32Array(frames)],
        RENDER_QUANTUM,
      );
      return { left, right };
    };
    applyOps(rawTarget, parityOps());
    raw.play();
    const rawLead = renderRaw(first);
    applyOps(rawTarget, parityEditOps());
    const rawOut = concat(rawLead, renderRaw(second));

    expect(rms(facadeOut.left)).toBeGreaterThan(1e-2);
    expect(maxDiffFrom(facadeOut, rawOut, 0)).toBeLessThanOrEqual(1e-7);
  });

  it('resolve the same automation ids', async () => {
    const f = await facade();
    const facadeTarget = createFacadeTarget(f.engine);
    const rawTarget = createRawTarget(await createRawEngine(SR));
    for (const target of [facadeTarget, rawTarget]) applyOps(target, parityOps().slice(0, 4));
    const params: AutomationParam[] = [
      { kind: 'fader', target: 1 },
      { kind: 'fader', target: 2 },
      { kind: 'fader', target: 'master' },
      { kind: 'pan', target: 2 },
      { kind: 'pan', target: 'master' },
      { kind: 'busGain', busId: REVERB_BUS },
      { kind: 'insert', strip: parityLane, insertIndex: 1, paramName: 'levelDb' },
      {
        kind: 'insert',
        strip: { kind: 'bus', busId: REVERB_BUS },
        insertIndex: 0,
        paramName: 'dryWet',
      },
      { kind: 'insert', strip: MASTER, insertIndex: 0, paramName: 'ceilingDb' },
    ];
    for (const param of params) {
      const id = facadeTarget.resolveAutomationId(param);
      expect(id, JSON.stringify(param)).toBeGreaterThanOrEqual(0);
      expect(rawTarget.resolveAutomationId(param), JSON.stringify(param)).toBe(id);
    }
  });
});

// ---------------------------------------------------------------------------
// A strip op is a discrete edit: one changed insert rebuilds the strip

describe('a strip op is a discrete edit', () => {
  const reverbSpec = (gainDb: number): StripSpec => ({
    inserts: [
      { slot: 'pre', processor: 'effects.reverb.plate', params: { decaySec: 2.5, dryWet: 1 } },
      { slot: 'pre', processor: 'utility.gain', params: { levelDb: gainDb } },
    ],
  });

  async function tailRmsAfter(edit: EngineOp[]): Promise<number> {
    const f = await facade();
    const target = createFacadeTarget(f.engine);
    applyOps(target, [
      { type: 'topology', buses: [], lanes: [{ trackId: TAIL_LANE, sends: [] }] },
      { type: 'strip', strip: tailStrip, spec: reverbSpec(0) },
      {
        type: 'clips',
        trackId: TAIL_LANE,
        clips: [{ channels: stereo(noise(0.3, 11, SR, 0.4)), startPpq: 0 }],
      },
    ]);
    f.engine.transport.play();
    f.render(quantumFrames(0.55));
    applyOps(target, edit);
    return rms(f.render(quantumFrames(0.6)).left, SETTLE);
  }

  it('the same spec again keeps the reverb tail', async () => {
    const control = await tailRmsAfter([]);
    const same = await tailRmsAfter([{ type: 'strip', strip: tailStrip, spec: reverbSpec(0) }]);
    expect(control).toBeGreaterThan(1e-3);
    expect(Math.abs(same / control - 1)).toBeLessThan(0.01);
  });

  it('changing only the downstream gain rebuilds the reverb as well', async () => {
    const control = await tailRmsAfter([]);
    const edited = await tailRmsAfter([{ type: 'strip', strip: tailStrip, spec: reverbSpec(-6) }]);
    expect(control).toBeGreaterThan(1e-3);
    expect(edited / control).toBeLessThan(0.01);
  });
});

// ---------------------------------------------------------------------------
// Diff helpers

describe('diff helpers', () => {
  it('emit ops only for what changed', () => {
    expect(diffInsertParams(MASTER, 0, { a: 1, b: 2 }, { a: 1, b: 3 })).toEqual([
      { type: 'insertParam', strip: MASTER, insertIndex: 0, name: 'b', value: 3 },
    ]);
    expect(diffBypass(MASTER, [false, true], [false, false])).toEqual([
      { type: 'insertBypass', strip: MASTER, insertIndex: 1, bypassed: false },
    ]);
    expect(diffEqBands(MASTER, [eqBand(0), eqBand(1)], [eqBand(0), eqBand(2)])).toEqual([
      { type: 'eqBand', strip: MASTER, bandIndex: 1, band: eqBand(2) },
    ]);
  });

  it('disable an EQ band dropped from the next state', () => {
    expect(diffEqBands(MASTER, [eqBand(0), eqBand(1)], [eqBand(0)])).toEqual([
      { type: 'eqBand', strip: MASTER, bandIndex: 1, band: { ...eqBand(1), enabled: false } },
    ]);
  });
});
