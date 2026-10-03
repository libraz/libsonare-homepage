/**
 * /mastering state → engine operations. One project is three lanes: lane 1
 * "After" (the program through the 13-slot insert column and strip EQ), lane 2
 * "Before" (the same program, no inserts) and lane 3 "Reference". A/B/R is
 * lane faders: the lane being heard sits at its loudness-match gain, the
 * others at the fader floor, so every lane keeps running and PDC keeps them
 * aligned. The export renders lane 1 alone at unity.
 *
 * `buildFull` constructs; `diff` turns one state change into the smallest op
 * list. A change to a parameter that is not rtSafe goes out as lane 1's strip
 * JSON, which rebuilds every insert on the strip; `diff` flags it as discrete.
 */
import { fitLoudness, type LoudnessFitResult } from '@/demos/mastering/masteringLoudnessFit';
import type {
  MasteringLane,
  MasteringRepair,
  MasteringState,
} from '@/demos/mastering/masteringState';
import {
  MASTERING_INSERT_LAYOUT,
  MASTERING_LANES,
  MASTERING_REPAIR_STAGES,
  MASTERING_SLOT,
  masteringMutators,
  masteringTargetLufs,
} from '@/demos/mastering/masteringState';
import {
  applyOps,
  createRawTarget,
  diffBypass,
  diffEqBands,
  type EngineOp,
  type StripRef,
  type StripSpec,
} from '@/utils/engineApply';
import type { MasteringChainConfig } from '@/wasm/index.js';

/** Engine track id of each lane, in lane order. */
export const MASTERING_LANE_TRACK: Readonly<Record<MasteringLane, number>> = {
  after: 1,
  before: 2,
  reference: 3,
};

/** Lane 1's strip, which carries the insert column and the strip EQ. */
export const AFTER_STRIP: StripRef = { kind: 'track', trackId: MASTERING_LANE_TRACK.after };

/** Fader of a lane not being heard; the engine's fader floor. */
export const LANE_OFF_DB = -120;

/**
 * Parameters of the lane-1 processors that are not rtSafe: construction-only,
 * so a change goes out as strip JSON. `tests/demos/mastering/enginePlayback.test.ts`
 * pins this table against `masteringInsertParamInfo`.
 */
export const MASTERING_NON_RT_PARAMS: Readonly<Record<string, readonly string[]>> = {
  'utility.gain': [],
  'eq.tilt': [],
  'dynamics.deesser': [],
  'dynamics.transientShaper': ['lookaheadMs'],
  'dynamics.compressor': [],
  'multiband.compressor': [
    'band0.kneeDb',
    'band1.kneeDb',
    'band2.kneeDb',
    'cutoff0Hz',
    'cutoff1Hz',
  ],
  'saturation.tape': ['oversampleFactor'],
  'saturation.exciter': ['aliasing'],
  'spectral.airBand': [],
  'stereo.imager': ['preserveEnergy'],
  'stereo.monoMaker': [],
  'maximizer.truePeakLimiter': ['applyGainAtInputRate', 'lookaheadMs', 'oversampleFactor'],
};

/** Whether `name` on `processor` can be set by name while audio runs. */
export function isRtSafeParam(processor: string, name: string): boolean {
  const table = MASTERING_NON_RT_PARAMS[processor];
  if (!table) throw new RangeError(`no rtSafe table for ${processor}`);
  return !table.includes(name);
}

/** A stereo clip in the page's audio registry, at the engine rate. */
export interface MasteringClip {
  left: Float32Array;
  right: Float32Array;
  sampleRate: number;
  /** Integrated loudness of the clip itself (`lufsInterleaved`). */
  integratedLufs: number;
}

/** What the lanes play: the program (source after repair) and the reference. */
export interface MasteringAudio {
  program: MasteringClip | null;
  reference: MasteringClip | null;
}

/** `preview` = the three-lane live project; `export` = lane 1 alone at unity. */
export type MasteringRenderVariant = 'preview' | 'export';

/** Lane 1's strip as strip JSON constructs it. */
export function afterStripSpec(state: MasteringState): StripSpec {
  return {
    inserts: MASTERING_INSERT_LAYOUT.map((entry, slot) => ({
      slot: 'pre',
      processor: entry.processor,
      params: { ...state.inserts[slot].params },
    })),
    eqBands: state.eq.map((band) => ({ ...band })),
  };
}

/** Integrated loudness of each lane, where it is known. */
function laneLoudness(state: MasteringState, audio: MasteringAudio): Record<MasteringLane, number> {
  return {
    after: state.loudness.fit?.measuredLufs ?? Number.NaN,
    before: audio.program?.integratedLufs ?? Number.NaN,
    reference: audio.reference?.integratedLufs ?? Number.NaN,
  };
}

/**
 * Loudness-match gain of each lane: every lane with a known loudness comes
 * down to the quietest one, so a gain is never above 0 dB. A lane whose
 * loudness is unknown, or any lane with matching off, stays at 0 dB.
 */
export function laneMatchGains(
  state: MasteringState,
  audio: MasteringAudio,
): Record<MasteringLane, number> {
  const loudness = laneLoudness(state, audio);
  const present = MASTERING_LANES.filter((lane) => Number.isFinite(loudness[lane]));
  const floor = Math.min(...present.map((lane) => loudness[lane]));
  const gain = (lane: MasteringLane) =>
    state.monitor.matchLoudness && present.includes(lane) ? floor - loudness[lane] : 0;
  return { after: gain('after'), before: gain('before'), reference: gain('reference') };
}

/** Fader of each lane: the monitored lane at its match gain, the others off. */
export function laneFaders(
  state: MasteringState,
  audio: MasteringAudio,
): Record<MasteringLane, number> {
  const gains = laneMatchGains(state, audio);
  const fader = (lane: MasteringLane) => (lane === state.monitor.lane ? gains[lane] : LANE_OFF_DB);
  return { after: fader('after'), before: fader('before'), reference: fader('reference') };
}

function lanesFor(variant: MasteringRenderVariant): MasteringLane[] {
  return variant === 'export' ? ['after'] : [...MASTERING_LANES];
}

/** Clip ops for the lanes of `variant`; call again whenever the audio registry changes. */
export function clipOps(
  audio: MasteringAudio,
  variant: MasteringRenderVariant = 'preview',
): EngineOp[] {
  const clip = (source: MasteringClip | null) =>
    source ? [{ channels: [source.left, source.right], startPpq: 0 }] : [];
  const byLane: Record<MasteringLane, ReturnType<typeof clip>> = {
    after: clip(audio.program),
    before: clip(audio.program),
    reference: clip(audio.reference),
  };
  return lanesFor(variant).map((lane) => ({
    type: 'clips',
    trackId: MASTERING_LANE_TRACK[lane],
    clips: byLane[lane],
  }));
}

/** Fader ops of the A/B/R lanes for the current monitor selection and loudness. */
export function laneFaderOps(state: MasteringState, audio: MasteringAudio): EngineOp[] {
  const faders = laneFaders(state, audio);
  return MASTERING_LANES.map((lane) => ({
    type: 'fader',
    target: MASTERING_LANE_TRACK[lane],
    db: faders[lane],
  }));
}

function bypassFlags(state: MasteringState): boolean[] {
  return state.inserts.map((insert) => insert.bypassed);
}

/** Strip JSON for lane 1 plus the bypass flags a rebuild clears. */
function stripOps(state: MasteringState): EngineOp[] {
  return [
    { type: 'strip', strip: AFTER_STRIP, spec: afterStripSpec(state) },
    ...diffBypass(
      AFTER_STRIP,
      state.inserts.map(() => false),
      bypassFlags(state),
    ),
  ];
}

/** Every op that constructs the project for `variant`. */
export function buildFull(
  state: MasteringState,
  audio: MasteringAudio,
  variant: MasteringRenderVariant = 'preview',
): EngineOp[] {
  return [
    {
      type: 'topology',
      buses: [],
      lanes: lanesFor(variant).map((lane) => ({ trackId: MASTERING_LANE_TRACK[lane], sends: [] })),
    },
    ...stripOps(state),
    ...clipOps(audio, variant),
    ...(variant === 'preview' ? laneFaderOps(state, audio) : []),
  ];
}

/** The ops for one state change; `discrete` when lane 1's inserts were rebuilt. */
export interface MasteringDiff {
  ops: EngineOp[];
  discrete: boolean;
}

/** Ops that take the live preview from `prev` to `next`. */
export function diff(
  prev: MasteringState,
  next: MasteringState,
  audio: MasteringAudio,
): MasteringDiff {
  const ops: EngineOp[] = [];
  const paramOps: EngineOp[] = [];
  let discrete = false;
  MASTERING_INSERT_LAYOUT.forEach((entry, slot) => {
    const before = prev.inserts[slot].params;
    const after = next.inserts[slot].params;
    for (const [name, value] of Object.entries(after)) {
      if (before[name] === value) continue;
      if (!isRtSafeParam(entry.processor, name)) {
        discrete = true;
        continue;
      }
      paramOps.push({
        type: 'insertParam',
        strip: AFTER_STRIP,
        insertIndex: slot,
        name,
        value: typeof value === 'boolean' ? Number(value) : value,
      });
    }
  });
  if (discrete) {
    ops.push(...stripOps(next));
  } else {
    ops.push(
      ...paramOps,
      ...diffBypass(AFTER_STRIP, bypassFlags(prev), bypassFlags(next)),
      ...diffEqBands(AFTER_STRIP, prev.eq, next.eq),
    );
  }
  const before = laneFaders(prev, audio);
  const after = laneFaders(next, audio);
  for (const lane of MASTERING_LANES) {
    if (before[lane] !== after[lane]) {
      ops.push({ type: 'fader', target: MASTERING_LANE_TRACK[lane], db: after[lane] });
    }
  }
  return { ops, discrete };
}

// ---------------------------------------------------------------------------
// Offline render of the export variant on a plain RealtimeEngine

type Wasm = typeof import('@/wasm/index.js');

/** The parts of `index.js` an offline render needs; the Worker and the gate pass the module. */
export type MasteringRenderApi = Pick<
  Wasm,
  'RealtimeEngine' | 'masteringInsertTiming' | 'lufsInterleaved'
>;

export interface MasteringRenderOptions {
  /** 0 none, 1 RPDF, 2 TPDF, 3 noise-shaped. */
  dither?: 0 | 1 | 2 | 3;
  ditherBits?: number;
  ditherSeed?: number;
}

/** A rendered master, aligned with the program (latency removed). */
export interface MasteringRender {
  left: Float32Array;
  right: Float32Array;
  sampleRate: number;
}

/** Engine render quantum, also the offline block size. */
export const MASTERING_BLOCK_SIZE = 128;

/** Lane 1's plugin delay, which every lane is compensated to. */
export function masteringLatencySamples(
  api: Pick<MasteringRenderApi, 'masteringInsertTiming'>,
  state: MasteringState,
  sampleRate: number,
): number {
  return MASTERING_INSERT_LAYOUT.reduce(
    (sum, entry, slot) =>
      sum +
      api.masteringInsertTiming(entry.processor, state.inserts[slot].params, sampleRate)
        .latencySamples,
    0,
  );
}

/**
 * Renders the export variant of `state` over `program` on a fresh engine, so
 * every render starts from the same insert state the live preview starts from.
 */
export function renderMasteringState(
  api: MasteringRenderApi,
  state: MasteringState,
  program: Pick<MasteringClip, 'left' | 'right' | 'sampleRate'>,
  options: MasteringRenderOptions = {},
): MasteringRender {
  const { sampleRate } = program;
  const frames = Math.min(program.left.length, program.right.length);
  const latency = masteringLatencySamples(api, state, sampleRate);
  const engine = new api.RealtimeEngine(sampleRate, MASTERING_BLOCK_SIZE);
  try {
    applyOps(
      createRawTarget(engine),
      buildFull(
        state,
        { program: { ...program, integratedLufs: Number.NaN }, reference: null },
        'export',
      ),
    );
    engine.settleParameters();
    engine.play();
    const bounce = engine.bounceOffline({
      totalFrames: frames + latency,
      numChannels: 2,
      ...(options.dither ? { dither: options.dither, ditherBits: options.ditherBits ?? 16 } : {}),
      ...(options.ditherSeed === undefined ? {} : { ditherSeed: options.ditherSeed }),
    });
    const left = new Float32Array(frames);
    const right = new Float32Array(frames);
    for (let i = 0; i < frames; i++) {
      left[i] = bounce.interleaved[(i + latency) * 2];
      right[i] = bounce.interleaved[(i + latency) * 2 + 1];
    }
    return { left, right, sampleRate };
  } finally {
    engine.destroy();
  }
}

/** Interleaves a stereo pair (to the shorter channel). */
export function interleave(left: Float32Array, right: Float32Array): Float32Array {
  const frames = Math.min(left.length, right.length);
  const out = new Float32Array(frames * 2);
  for (let i = 0; i < frames; i++) {
    out[2 * i] = left[i];
    out[2 * i + 1] = right[i];
  }
  return out;
}

/** Integrated loudness of a stereo pair, the measure every lane is matched by. */
export function measureLufs(
  api: Pick<MasteringRenderApi, 'lufsInterleaved'>,
  left: Float32Array,
  right: Float32Array,
  sampleRate: number,
): number {
  return api.lufsInterleaved(interleave(left, right), 2, sampleRate).integratedLufs;
}

/** `state` with the drive slot at `driveDb` and the limiter bypassed or as set. */
function fitBounceState(state: MasteringState, driveDb: number, limiterBypassed: boolean) {
  const withDrive = masteringMutators.setInsertParam(
    state,
    MASTERING_SLOT.drive,
    'levelDb',
    driveDb,
  );
  return limiterBypassed
    ? masteringMutators.setInsertBypassed(withDrive, MASTERING_SLOT.limiter, true)
    : withDrive;
}

/**
 * The loudness fit with real renders of the export variant; `beforeBounce`
 * runs before each one (the Worker checkpoints there).
 */
export function fitMasteringLoudness(
  api: MasteringRenderApi,
  state: MasteringState,
  program: Pick<MasteringClip, 'left' | 'right' | 'sampleRate'>,
  beforeBounce: (index: number) => void | Promise<void> = () => {},
): Promise<LoudnessFitResult> {
  let index = 0;
  return fitLoudness({
    targetLufs: masteringTargetLufs(state),
    bounce: async ({ driveDb, limiterBypassed }) => {
      await beforeBounce(index++);
      const render = renderMasteringState(
        api,
        fitBounceState(state, driveDb, limiterBypassed),
        program,
      );
      return measureLufs(api, render.left, render.right, render.sampleRate);
    },
  });
}

/** Chain config enabling only the repair stages that are on; null when none is. */
export function repairChainConfig(repair: MasteringRepair): MasteringChainConfig | null {
  const stages = MASTERING_REPAIR_STAGES.filter((stage) => repair[stage].enabled);
  if (stages.length === 0) return null;
  return {
    repair: Object.fromEntries(
      stages.map((stage) => [stage, { ...repair[stage].params, enabled: true }]),
    ),
  } as MasteringChainConfig;
}

/** The program lanes 1 and 2 play: the source through the enabled repair stages. */
export function prepareProgram(
  api: Pick<Wasm, 'masteringChainStereoWithProgress' | 'lufsInterleaved'>,
  source: MasteringClip,
  repair: MasteringRepair,
  onProgress: (progress: number) => void = () => {},
): { program: MasteringClip; stages: string[] } {
  const config = repairChainConfig(repair);
  if (!config) {
    const integratedLufs = measureLufs(api, source.left, source.right, source.sampleRate);
    return { program: { ...source, integratedLufs }, stages: [] };
  }
  const result = api.masteringChainStereoWithProgress(
    source.left,
    source.right,
    source.sampleRate,
    config,
    (progress: number) => onProgress(progress),
  );
  const integratedLufs = measureLufs(api, result.left, result.right, source.sampleRate);
  return {
    program: {
      left: result.left,
      right: result.right,
      sampleRate: source.sampleRate,
      integratedLufs,
    },
    stages: result.stages,
  };
}
