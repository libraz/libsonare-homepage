/**
 * The shared engine-apply layer for the engine-backed demos: an operation set
 * ({@link EngineOp}) that a demo derives from its project state, and two
 * adapters that interpret it — one over the live `SonareEngine` worklet facade,
 * one over the plain `RealtimeEngine` an export Worker bounces with. Applying
 * the same ops through both yields the same render, which is what makes the
 * preview and the export one thing.
 *
 * Continuous controls go through setters, rtSafe by-name insert params and EQ
 * bands, which keep insert state. Strip JSON is for construction and discrete
 * edits only: the engine rebuilds every insert on a strip when any insert in
 * its JSON changes. This module is the only place that sends strip JSON.
 */
import type {
  EngineAutomationPoint,
  EngineBus,
  EngineClip,
  EqBand,
  PanLaw,
  PanMode,
  RealtimeEngine,
  SendTiming,
} from '@/wasm/index.js';
import type { SonareEngine } from '@/wasm/worklet.js';

/** A track lane (by track id) or the master strip, as fader and pan address them. */
export type FaderTarget = number | 'master';

/** Any strip that carries EQ bands and inserts. */
export type StripRef =
  | { kind: 'track'; trackId: number }
  | { kind: 'master' }
  | { kind: 'bus'; busId: number };

/** One lane send. */
export interface LaneSend {
  busId: number;
  levelDb: number;
  sendTiming: SendTiming;
}

/** One track lane in the topology, in lane order. */
export interface LaneSpec {
  trackId: number;
  sends: readonly LaneSend[];
  /** Bus the lane sums into instead of the master; absent = master. */
  outputBusId?: number;
}

/** One audio clip on a track; positions are quarter notes, lengths samples. */
export interface ClipSpec {
  channels: Float32Array[];
  startPpq: number;
  clipOffsetSamples?: number;
  lengthSamples?: number;
  fadeInSamples?: number;
  fadeOutSamples?: number;
}

/** One strip insert as strip JSON constructs it. */
export interface InsertSpec {
  slot: 'pre' | 'post';
  processor: string;
  params: Readonly<Record<string, number | boolean>>;
}

/** Construction-time content of a strip. */
export interface StripSpec {
  inserts: readonly InsertSpec[];
  eqBands?: readonly EqBand[];
  polarityInvertLeft?: boolean;
  polarityInvertRight?: boolean;
}

/**
 * Track-strip controls with a dedicated live setter each; an absent field is
 * left as it is.
 */
export interface TrackStripScalars {
  panLaw?: PanLaw | number;
  panMode?: PanMode;
  dualPan?: { left: number; right: number };
  /** Inter-channel alignment delay in whole engine samples. */
  channelDelaySamples?: number;
}

/** A parameter an automation lane can drive. */
export type AutomationParam =
  | { kind: 'fader'; target: FaderTarget }
  | { kind: 'pan'; target: FaderTarget }
  | { kind: 'busGain'; busId: number }
  | { kind: 'insert'; strip: StripRef; insertIndex: number; paramName: string };

/** One engine operation; {@link applyOps} interprets a list of them in order. */
export type EngineOp =
  | { type: 'topology'; buses: readonly EngineBus[]; lanes: readonly LaneSpec[] }
  | { type: 'clips'; trackId: number; clips: readonly ClipSpec[] }
  | { type: 'fader'; target: FaderTarget; db: number }
  | { type: 'pan'; target: FaderTarget; pan: number }
  | { type: 'stripScalars'; trackId: number; scalars: TrackStripScalars }
  | { type: 'soloMute'; trackId: number; solo: boolean; mute: boolean }
  | { type: 'sends'; trackId: number; sends: readonly LaneSend[] }
  | { type: 'busGain'; busId: number; db: number }
  | { type: 'eqBand'; strip: StripRef; bandIndex: number; band: EqBand }
  | { type: 'insertBypass'; strip: StripRef; insertIndex: number; bypassed: boolean }
  | { type: 'insertParam'; strip: StripRef; insertIndex: number; name: string; value: number }
  | { type: 'automation'; param: AutomationParam; points: readonly EngineAutomationPoint[] }
  | { type: 'sidechain'; trackId: number; insertIndex: number; sourceTrackId: number | null }
  | { type: 'strip'; strip: StripRef; spec: StripSpec };

/** The engine surface {@link applyOps} drives; one adapter per engine kind. */
export interface EngineTarget {
  /** Declares buses, then lanes (a lane can only send to a declared bus). */
  setTopology(buses: readonly EngineBus[], lanes: readonly LaneSpec[]): void;
  /** Replaces every clip on one track. */
  setTrackClips(trackId: number, clips: readonly ClipSpec[]): void;
  setFader(target: FaderTarget, db: number): void;
  setPan(target: FaderTarget, pan: number): void;
  setTrackStripScalars(trackId: number, scalars: TrackStripScalars): void;
  setSoloMute(trackId: number, solo: boolean, mute: boolean): void;
  setSends(trackId: number, sends: readonly LaneSend[]): void;
  setBusGain(busId: number, db: number): void;
  setEqBand(strip: StripRef, bandIndex: number, band: EqBand): void;
  setInsertBypassed(strip: StripRef, insertIndex: number, bypassed: boolean): void;
  setInsertParam(strip: StripRef, insertIndex: number, name: string, value: number): void;
  /** Reserved automation id of `param`, or -1 when the engine does not know it. */
  resolveAutomationId(param: AutomationParam): number;
  setAutomation(param: AutomationParam, points: readonly EngineAutomationPoint[]): void;
  setLaneSidechain(trackId: number, insertIndex: number, sourceTrackId: number | null): void;
  /** Replaces a strip from its scene JSON; rebuilds every insert if any changed. */
  setStripJson(strip: StripRef, json: string): void;
}

/**
 * Scene JSON for one strip. Track and master strips go in `strips`, a bus in
 * `buses`; the engine reads the first entry only.
 */
export function buildStripJson(strip: StripRef, spec: StripSpec): string {
  const entry: Record<string, unknown> = {
    id:
      strip.kind === 'track'
        ? String(strip.trackId)
        : strip.kind === 'bus'
          ? String(strip.busId)
          : 'master',
    inserts: spec.inserts.map((insert) => ({
      slot: insert.slot,
      processor: insert.processor,
      params: { ...insert.params },
    })),
  };
  // A JSON band without `enabled` is disabled; EqBand callers state it explicitly.
  if (spec.eqBands) entry.eq = { enabled: true, bands: spec.eqBands.map((band) => ({ ...band })) };
  if (spec.polarityInvertLeft !== undefined) entry.polarityInvertLeft = spec.polarityInvertLeft;
  if (spec.polarityInvertRight !== undefined) entry.polarityInvertRight = spec.polarityInvertRight;
  return JSON.stringify(
    strip.kind === 'bus' ? { version: 1, buses: [entry] } : { version: 1, strips: [entry] },
  );
}

/** Applies `ops` to `target` in order. */
export function applyOps(target: EngineTarget, ops: readonly EngineOp[]): void {
  for (const op of ops) {
    switch (op.type) {
      case 'topology':
        target.setTopology(op.buses, op.lanes);
        break;
      case 'clips':
        target.setTrackClips(op.trackId, op.clips);
        break;
      case 'fader':
        target.setFader(op.target, op.db);
        break;
      case 'pan':
        target.setPan(op.target, op.pan);
        break;
      case 'stripScalars':
        target.setTrackStripScalars(op.trackId, op.scalars);
        break;
      case 'soloMute':
        target.setSoloMute(op.trackId, op.solo, op.mute);
        break;
      case 'sends':
        target.setSends(op.trackId, op.sends);
        break;
      case 'busGain':
        target.setBusGain(op.busId, op.db);
        break;
      case 'eqBand':
        target.setEqBand(op.strip, op.bandIndex, op.band);
        break;
      case 'insertBypass':
        target.setInsertBypassed(op.strip, op.insertIndex, op.bypassed);
        break;
      case 'insertParam':
        target.setInsertParam(op.strip, op.insertIndex, op.name, op.value);
        break;
      case 'automation':
        target.setAutomation(op.param, op.points);
        break;
      case 'sidechain':
        target.setLaneSidechain(op.trackId, op.insertIndex, op.sourceTrackId);
        break;
      case 'strip':
        target.setStripJson(op.strip, buildStripJson(op.strip, op.spec));
        break;
    }
  }
}

/** `insertParam` ops for every key whose value differs between `prev` and `next`. */
export function diffInsertParams(
  strip: StripRef,
  insertIndex: number,
  prev: Readonly<Record<string, number>>,
  next: Readonly<Record<string, number>>,
): EngineOp[] {
  return Object.entries(next)
    .filter(([name, value]) => prev[name] !== value)
    .map(([name, value]) => ({ type: 'insertParam', strip, insertIndex, name, value }));
}

/** `eqBand` ops for every band that differs; bands dropped from `next` are disabled. */
export function diffEqBands(
  strip: StripRef,
  prev: readonly EqBand[],
  next: readonly EqBand[],
): EngineOp[] {
  const ops: EngineOp[] = [];
  for (let i = 0; i < Math.max(prev.length, next.length); i++) {
    const band = next[i] ?? { ...prev[i], enabled: false };
    if (JSON.stringify(prev[i]) !== JSON.stringify(band)) {
      ops.push({ type: 'eqBand', strip, bandIndex: i, band });
    }
  }
  return ops;
}

/** `insertBypass` ops for every insert whose bypass flag differs. */
export function diffBypass(
  strip: StripRef,
  prev: readonly boolean[],
  next: readonly boolean[],
): EngineOp[] {
  const ops: EngineOp[] = [];
  next.forEach((bypassed, insertIndex) => {
    if (prev[insertIndex] !== bypassed) {
      ops.push({ type: 'insertBypass', strip, insertIndex, bypassed });
    }
  });
  return ops;
}

type ScalarSetters = Pick<
  RealtimeEngine,
  | 'setTrackStripPanLaw'
  | 'setTrackStripPanMode'
  | 'setTrackStripDualPan'
  | 'setTrackStripChannelDelaySamples'
>;

/** Sends each present field through its setter; both engines address the strip by track id. */
function applyScalars(engine: ScalarSetters, trackId: number, scalars: TrackStripScalars): void {
  const { panLaw, panMode, dualPan, channelDelaySamples } = scalars;
  if (panLaw !== undefined) engine.setTrackStripPanLaw(trackId, panLaw);
  if (panMode !== undefined) engine.setTrackStripPanMode(trackId, panMode);
  if (dualPan) engine.setTrackStripDualPan(trackId, dualPan.left, dualPan.right);
  if (channelDelaySamples !== undefined) {
    engine.setTrackStripChannelDelaySamples(trackId, channelDelaySamples);
  }
}

function toEngineSends(sends: readonly LaneSend[]) {
  return sends.map((send) => ({ ...send }));
}

function toEngineClip(trackId: number, clip: ClipSpec): EngineClip {
  return { ...clip, trackId };
}

/**
 * Adapter over the live `SonareEngine` facade. Fader, pan and bus gain are its
 * smoothed setters; a track's clips are replaced with one removeClip/addClip
 * pass, since every facade clip call re-marshals all clips into its mirror.
 */
export function createFacadeTarget(engine: SonareEngine): EngineTarget {
  const clipIds = new Map<number, number[]>();
  const target: EngineTarget = {
    setTopology(buses, lanes) {
      engine.setTrackBuses(buses.map((bus) => ({ ...bus })));
      engine.setTrackLanes(
        lanes.map((lane) => ({
          trackId: lane.trackId,
          sends: toEngineSends(lane.sends),
          outputBusId: lane.outputBusId ?? 0,
        })),
      );
    },
    setTrackClips(trackId, clips) {
      for (const id of clipIds.get(trackId) ?? []) engine.removeClip(id);
      clipIds.set(
        trackId,
        clips.map(({ channels, startPpq, ...opts }) =>
          engine.addClip(trackId, channels, startPpq, opts),
        ),
      );
    },
    setFader: (t, db) => void engine.setStripGain(t, db),
    setPan: (t, pan) => void engine.setStripPan(t, pan),
    setTrackStripScalars: (trackId, scalars) => applyScalars(engine, trackId, scalars),
    setSoloMute: (trackId, solo, mute) => void engine.setSoloMute(trackId, solo, mute),
    setSends: (trackId, sends) => engine.setSends(trackId, toEngineSends(sends)),
    setBusGain: (busId, db) => void engine.setBusGain(busId, db),
    setEqBand(strip, bandIndex, band) {
      if (strip.kind === 'track') engine.setTrackStripEqBand(strip.trackId, bandIndex, band);
      else if (strip.kind === 'master') engine.setMasterStripEqBand(bandIndex, band);
      else engine.setBusStripEqBand(strip.busId, bandIndex, band);
    },
    setInsertBypassed(strip, insertIndex, bypassed) {
      if (strip.kind === 'track')
        engine.setTrackStripInsertBypassed(strip.trackId, insertIndex, bypassed);
      else if (strip.kind === 'master') engine.setMasterStripInsertBypassed(insertIndex, bypassed);
      else engine.setBusStripInsertBypassed(strip.busId, insertIndex, bypassed);
    },
    setInsertParam(strip, insertIndex, name, value) {
      if (strip.kind === 'track')
        engine.setTrackStripInsertParamByName(strip.trackId, insertIndex, name, value);
      else if (strip.kind === 'master')
        engine.setMasterStripInsertParamByName(insertIndex, name, value);
      else engine.setBusStripInsertParamByName(strip.busId, insertIndex, name, value);
    },
    resolveAutomationId(param) {
      switch (param.kind) {
        case 'fader':
          return engine.automationParamId(param.target, 'faderDb');
        case 'pan':
          return engine.automationParamId(param.target, 'pan');
        case 'busGain':
          return engine.busAutomationParamId(param.busId);
        case 'insert':
          return resolveInsertId(engine, param);
      }
    },
    setAutomation(param, points) {
      engine.setAutomationLane(requireId(target, param), points);
    },
    setLaneSidechain: (trackId, insertIndex, source) =>
      engine.setLaneSidechain(trackId, insertIndex, source),
    setStripJson(strip, json) {
      if (strip.kind === 'track') engine.setTrackStripJson(strip.trackId, json);
      else if (strip.kind === 'master') engine.setMasterStripJson(json);
      else engine.setBusStripJson(strip.busId, json);
    },
  };
  return target;
}

// Reserved mixer parameter ids, the formula the facade's automationParamId
// uses; the raw engine has no resolver for them.
const MIXER_PARAM_BASE = 0x4d580000;
const MIXER_PARAM_FADER_DB = 1;
const MIXER_PARAM_PAN = 2;
const MIXER_MASTER_SELECTOR = 0xff;

function mixerParamId(selector: number, kind: number): number {
  return MIXER_PARAM_BASE | ((selector & 0xff) << 8) | (kind & 0xff);
}

/**
 * Adapter over a plain `RealtimeEngine` (the export Worker's). It keeps the
 * topology so it can address lanes and buses by declaration index the way the
 * facade does: fader, pan and bus gain are smoothed sets of the reserved mixer
 * ids, solo/mute takes the lane index, sends re-declare the lanes, and clips
 * are replaced with one `setClips` of every track's clips.
 */
export function createRawTarget(engine: RealtimeEngine): EngineTarget {
  let buses: EngineBus[] = [];
  let lanes: LaneSpec[] = [];
  const clips = new Map<number, EngineClip[]>();

  const laneIndex = (trackId: number): number => {
    const index = lanes.findIndex((lane) => lane.trackId === trackId);
    if (index < 0) throw new RangeError(`track ${trackId} is not in the topology`);
    return index;
  };
  const busIndex = (busId: number): number => {
    const index = buses.findIndex((bus) => bus.busId === busId);
    if (index < 0) throw new RangeError(`bus ${busId} is not in the topology`);
    return index;
  };
  const stripParamId = (t: FaderTarget, kind: number): number =>
    mixerParamId(t === 'master' ? MIXER_MASTER_SELECTOR : laneIndex(t), kind);
  const busGainId = (busId: number): number =>
    mixerParamId(0xfe - busIndex(busId), MIXER_PARAM_FADER_DB);
  const declareLanes = () =>
    engine.setTrackLanes(
      lanes.map((lane) => ({
        trackId: lane.trackId,
        sends: toEngineSends(lane.sends),
        outputBusId: lane.outputBusId ?? 0,
      })),
    );

  const target: EngineTarget = {
    setTopology(nextBuses, nextLanes) {
      buses = nextBuses.map((bus) => ({ ...bus }));
      lanes = nextLanes.map((lane) => ({ ...lane }));
      engine.setTrackBuses(buses.map((bus) => ({ ...bus })));
      declareLanes();
    },
    setTrackClips(trackId, trackClips) {
      clips.delete(trackId);
      clips.set(
        trackId,
        trackClips.map((clip) => toEngineClip(trackId, clip)),
      );
      engine.setClips([...clips.values()].flat());
    },
    setFader: (t, db) => engine.setParameterSmoothed(stripParamId(t, MIXER_PARAM_FADER_DB), db),
    setPan: (t, pan) => engine.setParameterSmoothed(stripParamId(t, MIXER_PARAM_PAN), pan),
    setTrackStripScalars: (trackId, scalars) => applyScalars(engine, trackId, scalars),
    setSoloMute: (trackId, solo, mute) => engine.setSoloMute(laneIndex(trackId), solo, mute),
    setSends(trackId, sends) {
      lanes[laneIndex(trackId)] = { ...lanes[laneIndex(trackId)], sends: [...sends] };
      declareLanes();
    },
    setBusGain(busId, db) {
      buses[busIndex(busId)] = { ...buses[busIndex(busId)], gainDb: db };
      engine.setParameterSmoothed(busGainId(busId), db);
    },
    setEqBand(strip, bandIndex, band) {
      if (strip.kind === 'track') engine.setTrackStripEqBand(strip.trackId, bandIndex, band);
      else if (strip.kind === 'master') engine.setMasterStripEqBand(bandIndex, band);
      else engine.setBusStripEqBand(strip.busId, bandIndex, band);
    },
    setInsertBypassed(strip, insertIndex, bypassed) {
      if (strip.kind === 'track')
        engine.setTrackStripInsertBypassed(strip.trackId, insertIndex, bypassed);
      else if (strip.kind === 'master') engine.setMasterStripInsertBypassed(insertIndex, bypassed);
      else engine.setBusStripInsertBypassed(strip.busId, insertIndex, bypassed);
    },
    setInsertParam(strip, insertIndex, name, value) {
      if (strip.kind === 'track')
        engine.setTrackStripInsertParamByName(strip.trackId, insertIndex, name, value);
      else if (strip.kind === 'master')
        engine.setMasterStripInsertParamByName(insertIndex, name, value);
      else engine.setBusStripInsertParamByName(strip.busId, insertIndex, name, value);
    },
    resolveAutomationId(param) {
      switch (param.kind) {
        case 'fader':
          return stripParamId(param.target, MIXER_PARAM_FADER_DB);
        case 'pan':
          return stripParamId(param.target, MIXER_PARAM_PAN);
        case 'busGain':
          return busGainId(param.busId);
        case 'insert':
          return resolveInsertId(engine, param);
      }
    },
    setAutomation(param, points) {
      engine.setAutomationLane(requireId(target, param), [...points]);
    },
    setLaneSidechain: (trackId, insertIndex, source) =>
      engine.setLaneSidechain(trackId, insertIndex, source ?? 0),
    setStripJson(strip, json) {
      if (strip.kind === 'track') engine.setTrackStripJson(strip.trackId, json);
      else if (strip.kind === 'master') engine.setMasterStripJson(json);
      else engine.setBusStripJson(strip.busId, json);
    },
  };
  return target;
}

type InsertResolver = Pick<
  RealtimeEngine,
  'resolveMasterInsertAutomationId' | 'resolveBusInsertAutomationId'
> & {
  resolveTrackInsertAutomationId(trackId: number, insertIndex: number, paramName: string): number;
};

function resolveInsertId(
  engine: InsertResolver,
  param: Extract<AutomationParam, { kind: 'insert' }>,
): number {
  const { strip, insertIndex, paramName } = param;
  if (strip.kind === 'track')
    return engine.resolveTrackInsertAutomationId(strip.trackId, insertIndex, paramName);
  if (strip.kind === 'master')
    return engine.resolveMasterInsertAutomationId(insertIndex, paramName);
  return engine.resolveBusInsertAutomationId(strip.busId, insertIndex, paramName);
}

function requireId(target: EngineTarget, param: AutomationParam): number {
  const id = target.resolveAutomationId(param);
  if (id < 0) throw new RangeError(`no automation id for ${JSON.stringify(param)}`);
  return id;
}
