/**
 * Mixing project state to engine operations. {@link buildFull} constructs a
 * whole project; {@link diff} emits only what changed between two states, so
 * an edit, an undo and an A/B switch all reach the engine the same way. Both
 * the live facade and the export Worker's raw engine apply these ops.
 *
 * Page-side folding: solo is solved here (solo-in-place with solo-safe) and
 * sent as per-lane mute; a VCA gain is added to its members' faders and, where
 * a fader lane is automated, to every point of that lane. Width is the imager
 * in slot 5, automated through its insert parameter. A change to a parameter
 * the engine cannot take live (see {@link DISCRETE_PARAMS}) or to polarity is a
 * strip op, which rebuilds the strip, so the strip's live state is re-sent.
 * Channel delay is converted to samples at the track audio's rate, as clip
 * positions are, so it reaches the engine once the audio is loaded.
 */
import {
  AUTOMATION_CURVES,
  AUTOMATION_PARAMS,
  AUX_BUS_PROCESSORS,
  AUX_BUSES,
  type AutomationParam,
  type AuxBusName,
  arrangementEndSec,
  effectiveFaderDb,
  type InsertSlot,
  isTrackSilenced,
  MASTER_SLOT_PROCESSORS,
  MASTER_SLOTS,
  type MasterSlotName,
  type MixingState,
  type MixTrackState,
  SEND_OFF_DB,
  TRACK_SLOT_PROCESSORS,
  TRACK_SLOTS,
  type TrackSlotName,
} from '@/demos/mixing/mixingState';
import {
  type ClipSpec,
  diffBypass,
  diffEqBands,
  diffInsertParams,
  type AutomationParam as EngineAutomationParam,
  type EngineOp,
  type InsertSpec,
  type LaneSend,
  type StripRef,
  type StripSpec,
  type TrackStripScalars,
} from '@/utils/engineApply';
import type { EngineAutomationPoint, EngineBus, EqBand } from '@/wasm/index.js';

/** The engine tempo; a quarter note is one second, so ppq = seconds. */
export const MIX_TEMPO_BPM = 60;

export const AUX_BUS_IDS: Readonly<Record<AuxBusName, number>> = { reverb: 1, delay: 2 };

/** Insert index of each track slot (all pre-fader, in this order). */
export const TRACK_SLOT_INDEX: Readonly<Record<TrackSlotName, number>> = {
  trim: 0,
  gate: 1,
  comp: 2,
  deess: 3,
  duck: 4,
  width: 5,
};

/** Insert index of each master slot (post-fader, so the limiter is last). */
export const MASTER_SLOT_INDEX: Readonly<Record<MasterSlotName, number>> = { glue: 0, limiter: 1 };

/**
 * State parameters the engine takes only at construction (`rtSafe: false` in
 * `masteringInsertParamInfo`); a test pins this table against the engine.
 */
export const DISCRETE_PARAMS: Readonly<Record<string, readonly string[]>> = {
  'dynamics.gate': ['holdMs', 'closeThresholdDb', 'keyHpfHz'],
};

/** Decoded audio of one track; kept outside the project state. */
export interface MixAudio {
  channels: Float32Array[];
  sampleRate: number;
}

export type MixAudioRegistry = ReadonlyMap<number, MixAudio>;

/** Seconds to timeline quarter notes at {@link MIX_TEMPO_BPM}. */
export const secondsToPpq = (seconds: number): number => (seconds * MIX_TEMPO_BPM) / 60;

const MASTER: StripRef = { kind: 'master' };
const trackStrip = (trackId: number): StripRef => ({ kind: 'track', trackId });
const busStrip = (bus: AuxBusName): StripRef => ({ kind: 'bus', busId: AUX_BUS_IDS[bus] });

function discreteValues(processor: string, params: Readonly<Record<string, number>>): number[] {
  return (DISCRETE_PARAMS[processor] ?? []).map((name) => params[name]);
}

function liveParams(
  processor: string,
  params: Readonly<Record<string, number>>,
): Record<string, number> {
  const discrete = DISCRETE_PARAMS[processor] ?? [];
  return Object.fromEntries(Object.entries(params).filter(([name]) => !discrete.includes(name)));
}

function insert(slot: 'pre' | 'post', processor: string, state: InsertSlot): InsertSpec {
  return { slot, processor, params: { ...state.params } };
}

function toEqBand(band: MixTrackState['eq'][number]): EqBand {
  return { ...band };
}

function trackStripSpec(track: MixTrackState): StripSpec {
  return {
    inserts: TRACK_SLOTS.map((name) =>
      insert('pre', TRACK_SLOT_PROCESSORS[name], track.slots[name]),
    ),
    eqBands: track.eq.map(toEqBand),
    polarityInvertLeft: track.polarityLeft,
    polarityInvertRight: track.polarityRight,
  };
}

function busStripSpec(state: MixingState, bus: AuxBusName): StripSpec {
  return {
    inserts: [
      { slot: 'pre', processor: AUX_BUS_PROCESSORS[bus], params: { ...state.buses[bus].params } },
    ],
  };
}

function masterStripSpec(state: MixingState): StripSpec {
  return {
    inserts: MASTER_SLOTS.map((name) =>
      insert('post', MASTER_SLOT_PROCESSORS[name], state.master.slots[name]),
    ),
  };
}

/** What only a strip op can change on a track strip. */
function trackDiscreteKey(track: MixTrackState): string {
  return JSON.stringify([
    track.polarityLeft,
    track.polarityRight,
    TRACK_SLOTS.map((name) =>
      discreteValues(TRACK_SLOT_PROCESSORS[name], track.slots[name].params),
    ),
  ]);
}

function laneSends(track: MixTrackState): LaneSend[] {
  return AUX_BUSES.filter((bus) => track.sends[bus].levelDb > SEND_OFF_DB).map((bus) => ({
    busId: AUX_BUS_IDS[bus],
    levelDb: track.sends[bus].levelDb,
    sendTiming: track.sends[bus].timing,
  }));
}

function topologyOp(state: MixingState): EngineOp {
  const buses: EngineBus[] = AUX_BUSES.map((bus) => ({
    busId: AUX_BUS_IDS[bus],
    gainDb: state.buses[bus].gainDb,
  }));
  return {
    type: 'topology',
    buses,
    lanes: state.tracks.map((track) => ({ trackId: track.id, sends: laneSends(track) })),
  };
}

function automationParam(trackId: number, param: AutomationParam): EngineAutomationParam {
  if (param === 'fader') return { kind: 'fader', target: trackId };
  if (param === 'pan') return { kind: 'pan', target: trackId };
  return {
    kind: 'insert',
    strip: trackStrip(trackId),
    insertIndex: TRACK_SLOT_INDEX.width,
    paramName: 'width',
  };
}

/** Engine points of one lane; fader points carry the track's VCA offset. */
function automationPoints(
  state: MixingState,
  track: MixTrackState,
  param: AutomationParam,
): EngineAutomationPoint[] {
  const offset = param === 'fader' ? effectiveFaderDb(state, track) - track.faderDb : 0;
  return track.automation[param].map((point) => ({
    ppq: secondsToPpq(point.timeSec),
    value: point.value + offset,
    // The curve list is in the engine's curveToNext order.
    curveToNext: AUTOMATION_CURVES.indexOf(point.curve),
  }));
}

/** The clip op of one track, or `null` while its audio is not loaded. */
export function trackClipOp(track: MixTrackState, audio: MixAudioRegistry): EngineOp | null {
  const source = audio.get(track.id);
  if (!source) return null;
  const toSamples = (sec: number) => Math.round(sec * source.sampleRate);
  const clip: ClipSpec = {
    channels: source.channels,
    startPpq: secondsToPpq(track.clip.startSec),
    clipOffsetSamples: toSamples(track.clip.trimStartSec),
    fadeInSamples: toSamples(track.clip.fadeInSec),
    fadeOutSamples: toSamples(track.clip.fadeOutSec),
    ...(track.clip.lengthSec === null ? {} : { lengthSamples: toSamples(track.clip.lengthSec) }),
  };
  return { type: 'clips', trackId: track.id, clips: [clip] };
}

/** The strip scalars of `track`; the channel delay only once its audio is loaded. */
function trackScalars(track: MixTrackState, audio: MixAudioRegistry): TrackStripScalars {
  const source = audio.get(track.id);
  return {
    panLaw: track.panLaw,
    panMode: track.panMode,
    dualPan: { left: track.dualPanLeft, right: track.dualPanRight },
    ...(source
      ? { channelDelaySamples: Math.round((track.channelDelayMs / 1000) * source.sampleRate) }
      : {}),
  };
}

/** The fields of `next` that differ from `prev`. */
function changedScalars(prev: TrackStripScalars, next: TrackStripScalars): TrackStripScalars {
  return Object.fromEntries(
    Object.entries(next).filter(
      ([key, value]) => !sameJson(prev[key as keyof TrackStripScalars], value),
    ),
  );
}

/** Everything live on a track strip, as a freshly built strip needs it. */
function trackLiveOps(
  state: MixingState,
  track: MixTrackState,
  audio: MixAudioRegistry,
): EngineOp[] {
  const strip = trackStrip(track.id);
  const ops: EngineOp[] = TRACK_SLOTS.map((name) => ({
    type: 'insertBypass',
    strip,
    insertIndex: TRACK_SLOT_INDEX[name],
    bypassed: track.slots[name].bypassed,
  }));
  if (track.duckKeyTrackId !== null) {
    ops.push({
      type: 'sidechain',
      trackId: track.id,
      insertIndex: TRACK_SLOT_INDEX.duck,
      sourceTrackId: track.duckKeyTrackId,
    });
  }
  for (const param of AUTOMATION_PARAMS) {
    if (track.automation[param].length > 0) {
      ops.push({
        type: 'automation',
        param: automationParam(track.id, param),
        points: automationPoints(state, track, param),
      });
    }
  }
  ops.push(
    { type: 'fader', target: track.id, db: effectiveFaderDb(state, track) },
    { type: 'pan', target: track.id, pan: track.pan },
    { type: 'stripScalars', trackId: track.id, scalars: trackScalars(track, audio) },
    { type: 'soloMute', trackId: track.id, solo: false, mute: isTrackSilenced(state, track) },
  );
  return ops;
}

function masterLiveOps(state: MixingState): EngineOp[] {
  return [
    ...MASTER_SLOTS.map(
      (name): EngineOp => ({
        type: 'insertBypass',
        strip: MASTER,
        insertIndex: MASTER_SLOT_INDEX[name],
        bypassed: state.master.slots[name].bypassed,
      }),
    ),
    { type: 'fader', target: 'master', db: state.master.faderDb },
  ];
}

/** Ops that construct `state` on a fresh engine; tracks without audio get no clip yet. */
export function buildFull(state: MixingState, audio: MixAudioRegistry): EngineOp[] {
  const ops: EngineOp[] = [topologyOp(state)];
  for (const track of state.tracks) {
    ops.push({ type: 'strip', strip: trackStrip(track.id), spec: trackStripSpec(track) });
  }
  for (const bus of AUX_BUSES) {
    ops.push({ type: 'strip', strip: busStrip(bus), spec: busStripSpec(state, bus) });
  }
  ops.push({ type: 'strip', strip: MASTER, spec: masterStripSpec(state) });
  for (const track of state.tracks) {
    const clip = trackClipOp(track, audio);
    if (clip) ops.push(clip);
  }
  for (const track of state.tracks) ops.push(...trackLiveOps(state, track, audio));
  for (const bus of AUX_BUSES) {
    ops.push({ type: 'busGain', busId: AUX_BUS_IDS[bus], db: state.buses[bus].gainDb });
  }
  ops.push(...masterLiveOps(state));
  return ops;
}

function slotParamOps(
  strip: StripRef,
  insertIndex: number,
  processor: string,
  prev: InsertSlot,
  next: InsertSlot,
): EngineOp[] {
  return diffInsertParams(
    strip,
    insertIndex,
    liveParams(processor, prev.params),
    liveParams(processor, next.params),
  );
}

function sameJson(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function diffTrack(
  prevState: MixingState,
  nextState: MixingState,
  prev: MixTrackState,
  next: MixTrackState,
  audio: MixAudioRegistry,
): EngineOp[] {
  const strip = trackStrip(next.id);
  const ops: EngineOp[] = [];
  if (!sameJson(prev.clip, next.clip)) {
    const clip = trackClipOp(next, audio);
    if (clip) ops.push(clip);
  }
  if (trackDiscreteKey(prev) !== trackDiscreteKey(next)) {
    ops.push({ type: 'strip', strip, spec: trackStripSpec(next) });
    ops.push(...trackLiveOps(nextState, next, audio));
    return ops;
  }
  ops.push(...diffEqBands(strip, prev.eq.map(toEqBand), next.eq.map(toEqBand)));
  for (const name of TRACK_SLOTS) {
    ops.push(
      ...slotParamOps(
        strip,
        TRACK_SLOT_INDEX[name],
        TRACK_SLOT_PROCESSORS[name],
        prev.slots[name],
        next.slots[name],
      ),
    );
  }
  ops.push(
    ...diffBypass(
      strip,
      TRACK_SLOTS.map((name) => prev.slots[name].bypassed),
      TRACK_SLOTS.map((name) => next.slots[name].bypassed),
    ),
  );
  if (prev.duckKeyTrackId !== next.duckKeyTrackId) {
    ops.push({
      type: 'sidechain',
      trackId: next.id,
      insertIndex: TRACK_SLOT_INDEX.duck,
      sourceTrackId: next.duckKeyTrackId,
    });
  }
  const changedLanes = new Set<AutomationParam>();
  for (const param of AUTOMATION_PARAMS) {
    const points = automationPoints(nextState, next, param);
    if (!sameJson(automationPoints(prevState, prev, param), points)) {
      changedLanes.add(param);
      ops.push({ type: 'automation', param: automationParam(next.id, param), points });
    }
  }
  const fader = effectiveFaderDb(nextState, next);
  // A cleared lane leaves the parameter where automation put it, so the static value goes again.
  if (effectiveFaderDb(prevState, prev) !== fader || changedLanes.has('fader')) {
    ops.push({ type: 'fader', target: next.id, db: fader });
  }
  if (prev.pan !== next.pan || changedLanes.has('pan')) {
    ops.push({ type: 'pan', target: next.id, pan: next.pan });
  }
  const scalars = changedScalars(trackScalars(prev, audio), trackScalars(next, audio));
  if (Object.keys(scalars).length > 0) {
    ops.push({ type: 'stripScalars', trackId: next.id, scalars });
  }
  if (
    changedLanes.has('width') &&
    prev.slots.width.params.width === next.slots.width.params.width
  ) {
    ops.push({
      type: 'insertParam',
      strip,
      insertIndex: TRACK_SLOT_INDEX.width,
      name: 'width',
      value: next.slots.width.params.width,
    });
  }
  const mute = isTrackSilenced(nextState, next);
  if (isTrackSilenced(prevState, prev) !== mute) {
    ops.push({ type: 'soloMute', trackId: next.id, solo: false, mute });
  }
  return ops;
}

/** Ops that take an engine holding `prev` to `next`. */
export function diff(prev: MixingState, next: MixingState, audio: MixAudioRegistry): EngineOp[] {
  const ops: EngineOp[] = [];
  const prevById = new Map(prev.tracks.map((track) => [track.id, track]));
  const nextIds = new Set(next.tracks.map((track) => track.id));
  for (const track of prev.tracks) {
    if (!nextIds.has(track.id)) ops.push({ type: 'clips', trackId: track.id, clips: [] });
  }
  const sameLanes = sameJson(
    prev.tracks.map((track) => track.id),
    next.tracks.map((track) => track.id),
  );
  if (!sameLanes) ops.push(topologyOp(next));
  for (const track of next.tracks) {
    const before = prevById.get(track.id);
    if (!before) {
      ops.push({ type: 'strip', strip: trackStrip(track.id), spec: trackStripSpec(track) });
      const clip = trackClipOp(track, audio);
      if (clip) ops.push(clip);
      ops.push(...trackLiveOps(next, track, audio));
      continue;
    }
    if (sameLanes && !sameJson(laneSends(before), laneSends(track))) {
      ops.push({ type: 'sends', trackId: track.id, sends: laneSends(track) });
    }
    ops.push(...diffTrack(prev, next, before, track, audio));
  }
  for (const bus of AUX_BUSES) {
    const processor = AUX_BUS_PROCESSORS[bus];
    const before = prev.buses[bus];
    const after = next.buses[bus];
    if (
      !sameJson(discreteValues(processor, before.params), discreteValues(processor, after.params))
    ) {
      ops.push({ type: 'strip', strip: busStrip(bus), spec: busStripSpec(next, bus) });
    } else {
      ops.push(
        ...diffInsertParams(
          busStrip(bus),
          0,
          liveParams(processor, before.params),
          liveParams(processor, after.params),
        ),
      );
    }
    if (before.gainDb !== after.gainDb) {
      ops.push({ type: 'busGain', busId: AUX_BUS_IDS[bus], db: after.gainDb });
    }
  }
  const masterDiscrete = (state: MixingState) =>
    MASTER_SLOTS.map((name) =>
      discreteValues(MASTER_SLOT_PROCESSORS[name], state.master.slots[name].params),
    );
  if (!sameJson(masterDiscrete(prev), masterDiscrete(next))) {
    ops.push({ type: 'strip', strip: MASTER, spec: masterStripSpec(next) });
    ops.push(...masterLiveOps(next));
  } else {
    for (const name of MASTER_SLOTS) {
      ops.push(
        ...slotParamOps(
          MASTER,
          MASTER_SLOT_INDEX[name],
          MASTER_SLOT_PROCESSORS[name],
          prev.master.slots[name],
          next.master.slots[name],
        ),
      );
    }
    ops.push(
      ...diffBypass(
        MASTER,
        MASTER_SLOTS.map((name) => prev.master.slots[name].bypassed),
        MASTER_SLOTS.map((name) => next.master.slots[name].bypassed),
      ),
    );
    if (prev.master.faderDb !== next.master.faderDb) {
      ops.push({ type: 'fader', target: 'master', db: next.master.faderDb });
    }
  }
  return ops;
}

/** Latency and tail of one insert, as `masteringInsertTiming` reports them. */
export type InsertTiming = (
  processor: string,
  params: Record<string, number>,
  sampleRate: number,
) => { latencySamples: number; tailSamples: number };

/**
 * Frames an export needs: the end of the last clip, the longest aux-bus tail,
 * and the latency of the longest path (track inserts and channel delay, then a
 * bus, then master).
 */
export function exportFrames(state: MixingState, sampleRate: number, timing: InsertTiming): number {
  const chainLatency = (inserts: Array<[string, Record<string, number>]>) =>
    inserts.reduce(
      (sum, [processor, params]) => sum + timing(processor, params, sampleRate).latencySamples,
      0,
    );
  const trackLatency = Math.max(
    0,
    ...state.tracks.map(
      (track) =>
        chainLatency(
          TRACK_SLOTS.map((name) => [TRACK_SLOT_PROCESSORS[name], track.slots[name].params]),
        ) + Math.round((track.channelDelayMs / 1000) * sampleRate),
    ),
  );
  const busTimings = AUX_BUSES.map((bus) =>
    timing(AUX_BUS_PROCESSORS[bus], state.buses[bus].params, sampleRate),
  );
  const busLatency = Math.max(0, ...busTimings.map((t) => t.latencySamples));
  const tail = Math.max(0, ...busTimings.map((t) => t.tailSamples));
  const masterLatency = chainLatency(
    MASTER_SLOTS.map((name) => [MASTER_SLOT_PROCESSORS[name], state.master.slots[name].params]),
  );
  return (
    Math.ceil(arrangementEndSec(state) * sampleRate) +
    tail +
    trackLatency +
    busLatency +
    masterLatency
  );
}
