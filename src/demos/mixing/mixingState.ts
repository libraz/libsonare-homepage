/**
 * The /mixing project state (v2): a plain, structured-cloneable object that is
 * the single source the engine, the undo history and the saved project are
 * derived from. It holds no PCM and no class instances; decoded audio lives in a
 * registry keyed by track id beside it.
 *
 * Every strip has the fixed layout the engine is built with: six strip EQ bands
 * and six pre-fader insert slots (trim, gate, comp, de-ess, duck, width), two
 * aux buses (REVERB, DELAY) and a master with Glue and Limiter. Positions are
 * seconds; the engine runs at 60 bpm so a quarter note is one second.
 *
 * The UI changes the state only through the mutators listed in
 * {@link MIXING_MUTATORS}. Each is pure: it returns a new state and never
 * touches its argument, so a history snapshot can be passed in directly.
 */
import { MAX_DURATION_SECONDS, MAX_TRACKS, VCA_GROUP_IDS } from '@/demos/mixing/mixingConstants';
import type { EqBandType, SendTiming } from '@/wasm/index.js';

/** Project JSON version this module reads and writes. */
export const MIXING_PROJECT_VERSION = 2;
/** Combined length of every track's source audio the page accepts, in seconds. */
export const MAX_TOTAL_TRACK_SECONDS = 1200;
/** A send at or below this level is not routed at all. */
export const SEND_OFF_DB = -60;

export type VcaGroupId = (typeof VCA_GROUP_IDS)[number];
export type AutomationParam = 'fader' | 'pan' | 'width';
export type AutomationCurve = 'linear' | 'exponential' | 'hold' | 's-curve';
export type AuxBusName = 'reverb' | 'delay';
export type TrackSlotName = 'trim' | 'gate' | 'comp' | 'deess' | 'duck' | 'width';
export type MasterSlotName = 'glue' | 'limiter';

export const AUTOMATION_PARAMS: readonly AutomationParam[] = ['fader', 'pan', 'width'];
export const AUTOMATION_CURVES: readonly AutomationCurve[] = [
  'linear',
  'exponential',
  'hold',
  's-curve',
];
export const TRACK_SLOTS: readonly TrackSlotName[] = [
  'trim',
  'gate',
  'comp',
  'deess',
  'duck',
  'width',
];
export const MASTER_SLOTS: readonly MasterSlotName[] = ['glue', 'limiter'];
export const AUX_BUSES: readonly AuxBusName[] = ['reverb', 'delay'];

/** Processor of each fixed slot. */
export const TRACK_SLOT_PROCESSORS: Readonly<Record<TrackSlotName, string>> = {
  trim: 'utility.gain',
  gate: 'dynamics.gate',
  comp: 'dynamics.compressor',
  deess: 'dynamics.deesser',
  duck: 'dynamics.duckingProcessor',
  width: 'stereo.imager',
};
export const MASTER_SLOT_PROCESSORS: Readonly<Record<MasterSlotName, string>> = {
  glue: 'dynamics.compressor',
  limiter: 'maximizer.truePeakLimiter',
};
export const AUX_BUS_PROCESSORS: Readonly<Record<AuxBusName, string>> = {
  reverb: 'effects.reverb.plate',
  delay: 'effects.delay.stereo',
};

/** One automation breakpoint; the curve shapes the segment to the next point. */
export interface AutomationPoint {
  id: string;
  timeSec: number;
  value: number;
  curve: AutomationCurve;
}

/** One strip EQ band; every field is live on the engine. */
export interface StripEqBand {
  type: EqBandType;
  frequencyHz: number;
  gainDb: number;
  q: number;
  enabled: boolean;
}

export interface InsertSlot {
  bypassed: boolean;
  params: Record<string, number>;
}

export interface TrackSend {
  levelDb: number;
  timing: SendTiming;
}

/** The track's single clip: where it sits on the timeline and which part of the source plays. */
export interface ClipState {
  startSec: number;
  /** Skipped from the start of the source. */
  trimStartSec: number;
  /** Played length; `null` plays the rest of the source. */
  lengthSec: number | null;
  fadeInSec: number;
  fadeOutSec: number;
}

export interface MixTrackState {
  /** Engine track id; positive, unique, never reused within a project. */
  id: number;
  name: string;
  /** Length of the source audio; the audio itself is in the registry. */
  sourceDurationSec: number;
  clip: ClipState;
  faderDb: number;
  pan: number;
  panLaw: number;
  panMode: number;
  dualPanLeft: number;
  dualPanRight: number;
  channelDelayMs: number;
  polarityLeft: boolean;
  polarityRight: boolean;
  muted: boolean;
  soloed: boolean;
  soloSafe: boolean;
  vcaGroup: VcaGroupId | null;
  eq: StripEqBand[];
  slots: Record<TrackSlotName, InsertSlot>;
  /** Track whose signal keys the duck slot; `null` keys it from its own input. */
  duckKeyTrackId: number | null;
  sends: Record<AuxBusName, TrackSend>;
  automation: Record<AutomationParam, AutomationPoint[]>;
}

export interface AuxBusState {
  gainDb: number;
  params: Record<string, number>;
}

export interface MasterState {
  faderDb: number;
  slots: Record<MasterSlotName, InsertSlot>;
}

export interface LoopState {
  enabled: boolean;
  startSec: number;
  endSec: number;
}

export interface MixingState {
  version: typeof MIXING_PROJECT_VERSION;
  tracks: MixTrackState[];
  buses: Record<AuxBusName, AuxBusState>;
  master: MasterState;
  vcaGains: Record<VcaGroupId, number>;
  loop: LoopState;
}

// ---------------------------------------------------------------------------
// Defaults

const BUTTERWORTH_Q = Math.SQRT1_2;

/** The six fixed EQ bands, all disabled. */
export function defaultEqBands(): StripEqBand[] {
  const band = (type: EqBandType, frequencyHz: number, q: number): StripEqBand => ({
    type,
    frequencyHz,
    gainDb: 0,
    q,
    enabled: false,
  });
  return [
    band('HighPass', 30, BUTTERWORTH_Q),
    band('LowShelf', 120, BUTTERWORTH_Q),
    band('Peak', 400, 1),
    band('Peak', 2500, 1),
    band('HighShelf', 8000, BUTTERWORTH_Q),
    band('LowPass', 18000, BUTTERWORTH_Q),
  ];
}

/** Slot parameters at the processors' own defaults; trim and width start active, the rest bypassed. */
export function defaultTrackSlots(): Record<TrackSlotName, InsertSlot> {
  return {
    trim: { bypassed: false, params: { levelDb: 0 } },
    gate: {
      bypassed: true,
      params: {
        thresholdDb: -50,
        attackMs: 2,
        releaseMs: 80,
        rangeDb: -80,
        holdMs: 0,
        closeThresholdDb: -50,
        keyHpfHz: 0,
      },
    },
    comp: {
      bypassed: true,
      params: {
        thresholdDb: -18,
        ratio: 2,
        attackMs: 10,
        releaseMs: 100,
        makeupGainDb: 0,
        kneeDb: 0,
        autoMakeup: 0,
      },
    },
    deess: {
      bypassed: true,
      params: {
        frequencyHz: 6000,
        thresholdDb: -24,
        ratio: 4,
        attackMs: 1,
        releaseMs: 60,
        rangeDb: 12,
        bandpassQ: 1.5,
      },
    },
    duck: {
      bypassed: true,
      params: { thresholdDb: -18, ratio: 8, attackMs: 2, releaseMs: 150, rangeDb: 18 },
    },
    width: { bypassed: false, params: { width: 1 } },
  };
}

export function defaultMasterSlots(): Record<MasterSlotName, InsertSlot> {
  return {
    glue: {
      bypassed: true,
      params: {
        thresholdDb: -18,
        ratio: 2,
        attackMs: 10,
        releaseMs: 100,
        makeupGainDb: 0,
        kneeDb: 0,
        autoMakeup: 0,
      },
    },
    limiter: { bypassed: true, params: { ceilingDb: -1, releaseMs: 50 } },
  };
}

/** Aux returns run fully wet; the rest are the processors' defaults. */
export function defaultBuses(): Record<AuxBusName, AuxBusState> {
  return {
    reverb: {
      gainDb: 0,
      params: { decay: plateDecayFromSeconds(2.2), damping: 0.5, preDelayMs: 20, dryWet: 1 },
    },
    delay: {
      gainDb: 0,
      params: { delayTimeLMs: 250, delayTimeRMs: 250, feedback: 0.25, pingPong: 0, dryWet: 1 },
    },
  };
}

export function createTrackState(
  id: number,
  name: string,
  sourceDurationSec: number,
): MixTrackState {
  return {
    id,
    name,
    sourceDurationSec,
    clip: { startSec: 0, trimStartSec: 0, lengthSec: null, fadeInSec: 0, fadeOutSec: 0 },
    faderDb: 0,
    pan: 0,
    panLaw: 0,
    panMode: 0,
    dualPanLeft: -1,
    dualPanRight: 1,
    channelDelayMs: 0,
    polarityLeft: false,
    polarityRight: false,
    muted: false,
    soloed: false,
    soloSafe: false,
    vcaGroup: null,
    eq: defaultEqBands(),
    slots: defaultTrackSlots(),
    duckKeyTrackId: null,
    sends: {
      reverb: { levelDb: SEND_OFF_DB, timing: 'postFader' },
      delay: { levelDb: SEND_OFF_DB, timing: 'postFader' },
    },
    automation: { fader: [], pan: [], width: [] },
  };
}

export function createMixingState(): MixingState {
  return {
    version: MIXING_PROJECT_VERSION,
    tracks: [],
    buses: defaultBuses(),
    master: { faderDb: 0, slots: defaultMasterSlots() },
    vcaGains: Object.fromEntries(VCA_GROUP_IDS.map((id) => [id, 0])) as Record<VcaGroupId, number>,
    loop: { enabled: false, startSec: 0, endSec: 0 },
  };
}

// The plate's decaySec construction key maps a tail length onto its live
// `decay` feedback with this model (insert_factory.cpp); a test pins the two.
const PLATE_TANK_LOOP_SECONDS = 21589 / 29761;

/** Live plate `decay` that the construction-time `decaySec` alias would set. */
export function plateDecayFromSeconds(decaySec: number): number {
  const feedback = Math.exp(
    (-Math.log(1000) * PLATE_TANK_LOOP_SECONDS) / (4 * Math.max(0.05, decaySec)),
  );
  return Math.min(0.98, Math.max(0, feedback));
}

// ---------------------------------------------------------------------------
// Derived values

/** Source length the clip plays, in seconds. */
export function clipPlayedSec(track: MixTrackState): number {
  const rest = Math.max(0, track.sourceDurationSec - track.clip.trimStartSec);
  return track.clip.lengthSec === null ? rest : Math.min(rest, track.clip.lengthSec);
}

/** End of the last clip on the timeline, in seconds. */
export function arrangementEndSec(state: MixingState): number {
  return state.tracks.reduce(
    (end, track) => Math.max(end, track.clip.startSec + clipPlayedSec(track)),
    0,
  );
}

/** Whether a track is heard under solo-in-place: muted, or unsoloed while another solo is active and not solo-safe. */
export function isTrackSilenced(state: MixingState, track: MixTrackState): boolean {
  if (track.muted) return true;
  const soloActive = state.tracks.some((t) => t.soloed);
  return soloActive && !track.soloed && !track.soloSafe;
}

/** Fader level with the track's VCA group folded in. */
export function effectiveFaderDb(state: MixingState, track: MixTrackState): number {
  return track.faderDb + (track.vcaGroup ? state.vcaGains[track.vcaGroup] : 0);
}

// ---------------------------------------------------------------------------
// Audio budget

export type AudioBudgetVerdict =
  | { ok: true; remainingSec: number }
  | { ok: false; reason: 'tooManyTracks' | 'trackTooLong' | 'totalExceeded'; remainingSec: number };

/**
 * Whether a source of `candidateSec` may join tracks whose sources last
 * `loadedSec`: at most {@link MAX_TRACKS} tracks, each up to
 * {@link MAX_DURATION_SECONDS}, together up to {@link MAX_TOTAL_TRACK_SECONDS}.
 * `remainingSec` is what is left of the total before the candidate.
 */
export function checkAudioBudget(
  loadedSec: readonly number[],
  candidateSec: number,
): AudioBudgetVerdict {
  const used = loadedSec.reduce((sum, sec) => sum + sec, 0);
  const remainingSec = Math.max(0, MAX_TOTAL_TRACK_SECONDS - used);
  if (loadedSec.length >= MAX_TRACKS) return { ok: false, reason: 'tooManyTracks', remainingSec };
  if (candidateSec > MAX_DURATION_SECONDS)
    return { ok: false, reason: 'trackTooLong', remainingSec };
  if (candidateSec > remainingSec) return { ok: false, reason: 'totalExceeded', remainingSec };
  return { ok: true, remainingSec };
}

// ---------------------------------------------------------------------------
// Mutators

function mapTrack(
  state: MixingState,
  trackId: number,
  update: (track: MixTrackState) => MixTrackState,
): MixingState {
  if (!state.tracks.some((track) => track.id === trackId)) {
    throw new RangeError(`no track ${trackId}`);
  }
  return {
    ...state,
    tracks: state.tracks.map((track) => (track.id === trackId ? update(track) : track)),
  };
}

function sortedPoints(points: AutomationPoint[]): AutomationPoint[] {
  return [...points].sort((a, b) => a.timeSec - b.timeSec);
}

/** Appends a track with default settings; its id is one above the highest in use. */
export function addTrack(state: MixingState, name: string, sourceDurationSec: number): MixingState {
  const verdict = checkAudioBudget(
    state.tracks.map((track) => track.sourceDurationSec),
    sourceDurationSec,
  );
  if (!verdict.ok) throw new RangeError(`audio budget: ${verdict.reason}`);
  const id = state.tracks.reduce((max, track) => Math.max(max, track.id), 0) + 1;
  return { ...state, tracks: [...state.tracks, createTrackState(id, name, sourceDurationSec)] };
}

/** Removes a track; ducks it keyed fall back to their own input. */
export function removeTrack(state: MixingState, trackId: number): MixingState {
  return {
    ...state,
    tracks: state.tracks
      .filter((track) => track.id !== trackId)
      .map((track) =>
        track.duckKeyTrackId === trackId ? { ...track, duckKeyTrackId: null } : track,
      ),
  };
}

export function renameTrack(state: MixingState, trackId: number, name: string): MixingState {
  return mapTrack(state, trackId, (track) => ({ ...track, name }));
}

export function moveClip(state: MixingState, trackId: number, startSec: number): MixingState {
  return mapTrack(state, trackId, (track) => ({
    ...track,
    clip: { ...track.clip, startSec: Math.max(0, startSec) },
  }));
}

export function trimClip(
  state: MixingState,
  trackId: number,
  trimStartSec: number,
  lengthSec: number | null,
): MixingState {
  return mapTrack(state, trackId, (track) => {
    const start = Math.min(Math.max(0, trimStartSec), track.sourceDurationSec);
    const rest = track.sourceDurationSec - start;
    return {
      ...track,
      clip: {
        ...track.clip,
        trimStartSec: start,
        lengthSec: lengthSec === null ? null : Math.min(Math.max(0, lengthSec), rest),
      },
    };
  });
}

export function setClipFades(
  state: MixingState,
  trackId: number,
  fadeInSec: number,
  fadeOutSec: number,
): MixingState {
  return mapTrack(state, trackId, (track) => ({
    ...track,
    clip: { ...track.clip, fadeInSec: Math.max(0, fadeInSec), fadeOutSec: Math.max(0, fadeOutSec) },
  }));
}

export function setFader(state: MixingState, trackId: number, db: number): MixingState {
  return mapTrack(state, trackId, (track) => ({ ...track, faderDb: db }));
}

export function setPan(state: MixingState, trackId: number, pan: number): MixingState {
  return mapTrack(state, trackId, (track) => ({ ...track, pan }));
}

export function setPanLaw(state: MixingState, trackId: number, panLaw: number): MixingState {
  return mapTrack(state, trackId, (track) => ({ ...track, panLaw }));
}

export function setPanMode(state: MixingState, trackId: number, panMode: number): MixingState {
  return mapTrack(state, trackId, (track) => ({ ...track, panMode }));
}

export function setDualPan(
  state: MixingState,
  trackId: number,
  left: number,
  right: number,
): MixingState {
  return mapTrack(state, trackId, (track) => ({
    ...track,
    dualPanLeft: left,
    dualPanRight: right,
  }));
}

export function setChannelDelay(state: MixingState, trackId: number, delayMs: number): MixingState {
  return mapTrack(state, trackId, (track) => ({ ...track, channelDelayMs: Math.max(0, delayMs) }));
}

export function setPolarity(
  state: MixingState,
  trackId: number,
  side: 'left' | 'right',
  inverted: boolean,
): MixingState {
  return mapTrack(state, trackId, (track) =>
    side === 'left' ? { ...track, polarityLeft: inverted } : { ...track, polarityRight: inverted },
  );
}

export function setMute(state: MixingState, trackId: number, muted: boolean): MixingState {
  return mapTrack(state, trackId, (track) => ({ ...track, muted }));
}

export function setSolo(state: MixingState, trackId: number, soloed: boolean): MixingState {
  return mapTrack(state, trackId, (track) => ({ ...track, soloed }));
}

export function setSoloSafe(state: MixingState, trackId: number, soloSafe: boolean): MixingState {
  return mapTrack(state, trackId, (track) => ({ ...track, soloSafe }));
}

export function setVcaGroup(
  state: MixingState,
  trackId: number,
  group: VcaGroupId | null,
): MixingState {
  return mapTrack(state, trackId, (track) => ({ ...track, vcaGroup: group }));
}

export function setEqBand(
  state: MixingState,
  trackId: number,
  bandIndex: number,
  band: Partial<StripEqBand>,
): MixingState {
  return mapTrack(state, trackId, (track) => {
    if (!track.eq[bandIndex]) throw new RangeError(`no EQ band ${bandIndex}`);
    return {
      ...track,
      eq: track.eq.map((current, i) => (i === bandIndex ? { ...current, ...band } : current)),
    };
  });
}

export function setSlotBypass(
  state: MixingState,
  trackId: number,
  slot: TrackSlotName,
  bypassed: boolean,
): MixingState {
  return mapTrack(state, trackId, (track) => ({
    ...track,
    slots: { ...track.slots, [slot]: { ...track.slots[slot], bypassed } },
  }));
}

export function setSlotParam(
  state: MixingState,
  trackId: number,
  slot: TrackSlotName,
  name: string,
  value: number,
): MixingState {
  return mapTrack(state, trackId, (track) => {
    if (!(name in track.slots[slot].params)) throw new RangeError(`no ${slot} param ${name}`);
    return {
      ...track,
      slots: {
        ...track.slots,
        [slot]: { ...track.slots[slot], params: { ...track.slots[slot].params, [name]: value } },
      },
    };
  });
}

/** Whether keying `trackId` from `keyTrackId` would key a track from itself, directly or through a chain of keys. */
export function duckKeyClosesCycle(
  tracks: readonly MixTrackState[],
  trackId: number,
  keyTrackId: number,
): boolean {
  const keyOf = new Map(tracks.map((t) => [t.id, t.duckKeyTrackId]));
  const seen = new Set<number>();
  for (let id: number | null | undefined = keyTrackId; id != null; id = keyOf.get(id)) {
    if (id === trackId) return true;
    if (seen.has(id)) return false;
    seen.add(id);
  }
  return false;
}

export function setDuckKey(
  state: MixingState,
  trackId: number,
  keyTrackId: number | null,
): MixingState {
  if (
    keyTrackId !== null &&
    (!state.tracks.some((t) => t.id === keyTrackId) ||
      duckKeyClosesCycle(state.tracks, trackId, keyTrackId))
  ) {
    throw new RangeError(`track ${keyTrackId} cannot key track ${trackId}`);
  }
  return mapTrack(state, trackId, (track) => ({ ...track, duckKeyTrackId: keyTrackId }));
}

export function setSend(
  state: MixingState,
  trackId: number,
  bus: AuxBusName,
  send: Partial<TrackSend>,
): MixingState {
  return mapTrack(state, trackId, (track) => ({
    ...track,
    sends: { ...track.sends, [bus]: { ...track.sends[bus], ...send } },
  }));
}

export function addAutomationPoint(
  state: MixingState,
  trackId: number,
  param: AutomationParam,
  point: AutomationPoint,
): MixingState {
  return mapTrack(state, trackId, (track) => ({
    ...track,
    automation: {
      ...track.automation,
      [param]: sortedPoints([
        ...track.automation[param],
        { ...point, timeSec: Math.max(0, point.timeSec) },
      ]),
    },
  }));
}

export function moveAutomationPoint(
  state: MixingState,
  trackId: number,
  param: AutomationParam,
  pointId: string,
  timeSec: number,
  value: number,
): MixingState {
  return mapTrack(state, trackId, (track) => ({
    ...track,
    automation: {
      ...track.automation,
      [param]: sortedPoints(
        track.automation[param].map((point) =>
          point.id === pointId ? { ...point, timeSec: Math.max(0, timeSec), value } : point,
        ),
      ),
    },
  }));
}

export function setAutomationCurve(
  state: MixingState,
  trackId: number,
  param: AutomationParam,
  pointId: string,
  curve: AutomationCurve,
): MixingState {
  return mapTrack(state, trackId, (track) => ({
    ...track,
    automation: {
      ...track.automation,
      [param]: track.automation[param].map((point) =>
        point.id === pointId ? { ...point, curve } : point,
      ),
    },
  }));
}

export function removeAutomationPoint(
  state: MixingState,
  trackId: number,
  param: AutomationParam,
  pointId: string,
): MixingState {
  return mapTrack(state, trackId, (track) => ({
    ...track,
    automation: {
      ...track.automation,
      [param]: track.automation[param].filter((point) => point.id !== pointId),
    },
  }));
}

export function clearAutomation(
  state: MixingState,
  trackId: number,
  param: AutomationParam,
): MixingState {
  return mapTrack(state, trackId, (track) => ({
    ...track,
    automation: { ...track.automation, [param]: [] },
  }));
}

export function setBusGain(state: MixingState, bus: AuxBusName, db: number): MixingState {
  return { ...state, buses: { ...state.buses, [bus]: { ...state.buses[bus], gainDb: db } } };
}

export function setBusParam(
  state: MixingState,
  bus: AuxBusName,
  name: string,
  value: number,
): MixingState {
  if (!(name in state.buses[bus].params)) throw new RangeError(`no ${bus} param ${name}`);
  return {
    ...state,
    buses: {
      ...state.buses,
      [bus]: { ...state.buses[bus], params: { ...state.buses[bus].params, [name]: value } },
    },
  };
}

export function setMasterFader(state: MixingState, db: number): MixingState {
  return { ...state, master: { ...state.master, faderDb: db } };
}

export function setMasterSlotBypass(
  state: MixingState,
  slot: MasterSlotName,
  bypassed: boolean,
): MixingState {
  return {
    ...state,
    master: {
      ...state.master,
      slots: { ...state.master.slots, [slot]: { ...state.master.slots[slot], bypassed } },
    },
  };
}

export function setMasterSlotParam(
  state: MixingState,
  slot: MasterSlotName,
  name: string,
  value: number,
): MixingState {
  const current = state.master.slots[slot];
  if (!(name in current.params)) throw new RangeError(`no ${slot} param ${name}`);
  return {
    ...state,
    master: {
      ...state.master,
      slots: {
        ...state.master.slots,
        [slot]: { ...current, params: { ...current.params, [name]: value } },
      },
    },
  };
}

export function setVcaGain(state: MixingState, group: VcaGroupId, db: number): MixingState {
  return { ...state, vcaGains: { ...state.vcaGains, [group]: db } };
}

export function setLoop(state: MixingState, loop: Partial<LoopState>): MixingState {
  return { ...state, loop: { ...state.loop, ...loop } };
}

/** The mix settings an external proposal (the mix assistant) may set on a track. */
export interface TrackMixPatch {
  faderDb?: number;
  pan?: number;
  eq?: Partial<Record<number, StripEqBand>>;
  slots?: Partial<Record<TrackSlotName, Partial<InsertSlot>>>;
  duckKeyTrackId?: number | null;
  sends?: Partial<Record<AuxBusName, TrackSend>>;
}

/** A whole-mix proposal; tracks not named keep their settings. */
export interface MixPatch {
  tracks: Record<number, TrackMixPatch>;
  buses?: Partial<Record<AuxBusName, Partial<AuxBusState>>>;
  masterFaderDb?: number;
}

/** Applies a {@link MixPatch} on top of `state`; entries for unknown tracks are ignored. */
export function applyMixPatch(state: MixingState, patch: MixPatch): MixingState {
  const tracks = state.tracks.map((track) => {
    const p = patch.tracks[track.id];
    if (!p) return track;
    const slots = { ...track.slots };
    for (const name of TRACK_SLOTS) {
      const slotPatch = p.slots?.[name];
      if (!slotPatch) continue;
      slots[name] = {
        bypassed: slotPatch.bypassed ?? slots[name].bypassed,
        params: { ...slots[name].params, ...slotPatch.params },
      };
    }
    return {
      ...track,
      faderDb: p.faderDb ?? track.faderDb,
      pan: p.pan ?? track.pan,
      eq: track.eq.map((band, i) => p.eq?.[i] ?? band),
      slots,
      duckKeyTrackId: p.duckKeyTrackId === undefined ? track.duckKeyTrackId : p.duckKeyTrackId,
      sends: { ...track.sends, ...p.sends },
    };
  });
  const buses = { ...state.buses };
  for (const name of AUX_BUSES) {
    const busPatch = patch.buses?.[name];
    if (!busPatch) continue;
    buses[name] = {
      gainDb: busPatch.gainDb ?? buses[name].gainDb,
      params: { ...buses[name].params, ...busPatch.params },
    };
  }
  return {
    ...state,
    tracks,
    buses,
    master: { ...state.master, faderDb: patch.masterFaderDb ?? state.master.faderDb },
  };
}

/** Every function allowed to change the project state. */
export const MIXING_MUTATORS = {
  addTrack,
  removeTrack,
  renameTrack,
  moveClip,
  trimClip,
  setClipFades,
  setFader,
  setPan,
  setPanLaw,
  setPanMode,
  setDualPan,
  setChannelDelay,
  setPolarity,
  setMute,
  setSolo,
  setSoloSafe,
  setVcaGroup,
  setEqBand,
  setSlotBypass,
  setSlotParam,
  setDuckKey,
  setSend,
  addAutomationPoint,
  moveAutomationPoint,
  setAutomationCurve,
  removeAutomationPoint,
  clearAutomation,
  setBusGain,
  setBusParam,
  setMasterFader,
  setMasterSlotBypass,
  setMasterSlotParam,
  setVcaGain,
  setLoop,
  applyMixPatch,
} as const;

// ---------------------------------------------------------------------------
// Project JSON

/** The project file: the state as JSON (it carries no audio). */
export function serializeMixingState(state: MixingState): string {
  return JSON.stringify(state);
}

type Json = Record<string, unknown>;

function isRecord(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

class InvalidProject extends Error {}

function invalid(path: string): never {
  throw new InvalidProject(path);
}

function num(source: Json, key: string, fallback: number, path: string): number {
  if (!(key in source)) return fallback;
  return isFiniteNumber(source[key]) ? source[key] : invalid(`${path}.${key}`);
}

function bool(source: Json, key: string, fallback: boolean, path: string): boolean {
  if (!(key in source)) return fallback;
  return typeof source[key] === 'boolean' ? source[key] : invalid(`${path}.${key}`);
}

function record(source: Json, key: string, path: string): Json {
  if (!(key in source)) return {};
  return isRecord(source[key]) ? source[key] : invalid(`${path}.${key}`);
}

function oneOf<T extends string>(
  source: Json,
  key: string,
  allowed: readonly T[],
  fallback: T,
  path: string,
): T {
  if (!(key in source)) return fallback;
  return allowed.includes(source[key] as T) ? (source[key] as T) : invalid(`${path}.${key}`);
}

/** Known params keep their defaults when absent; unknown keys are rejected. */
function readSlot(source: unknown, defaults: InsertSlot, path: string): InsertSlot {
  if (source === undefined) return defaults;
  if (!isRecord(source)) invalid(path);
  const params = record(source, 'params', path);
  for (const key of Object.keys(params)) {
    if (!(key in defaults.params)) invalid(`${path}.params.${key}`);
  }
  return {
    bypassed: bool(source, 'bypassed', defaults.bypassed, path),
    params: Object.fromEntries(
      Object.entries(defaults.params).map(([key, value]) => [
        key,
        num(params, key, value, `${path}.params`),
      ]),
    ),
  };
}

const EQ_TYPES: readonly EqBandType[] = [
  'Peak',
  'LowShelf',
  'HighShelf',
  'LowPass',
  'HighPass',
  'BandPass',
  'Notch',
  'TiltShelf',
  'FlatTilt',
  'AllPass',
];

function readTrack(source: unknown, path: string): MixTrackState {
  if (!isRecord(source)) invalid(path);
  const id = source.id;
  if (typeof id !== 'number' || !Number.isSafeInteger(id) || id <= 0) invalid(`${path}.id`);
  if (typeof source.name !== 'string') invalid(`${path}.name`);
  const defaults = createTrackState(id, source.name, num(source, 'sourceDurationSec', 0, path));
  const clip = record(source, 'clip', path);
  const clipLength = clip.lengthSec;
  if (clipLength !== undefined && clipLength !== null && !isFiniteNumber(clipLength)) {
    invalid(`${path}.clip.lengthSec`);
  }
  const eqSource = source.eq ?? defaults.eq;
  if (!Array.isArray(eqSource) || eqSource.length !== defaults.eq.length) invalid(`${path}.eq`);
  const eq = eqSource.map((band: unknown, i): StripEqBand => {
    if (!isRecord(band)) invalid(`${path}.eq.${i}`);
    const base = defaults.eq[i];
    return {
      type: oneOf(band, 'type', EQ_TYPES, base.type, `${path}.eq.${i}`),
      frequencyHz: num(band, 'frequencyHz', base.frequencyHz, `${path}.eq.${i}`),
      gainDb: num(band, 'gainDb', base.gainDb, `${path}.eq.${i}`),
      q: num(band, 'q', base.q, `${path}.eq.${i}`),
      enabled: bool(band, 'enabled', base.enabled, `${path}.eq.${i}`),
    };
  });
  const slots = record(source, 'slots', path);
  const sends = record(source, 'sends', path);
  const automation = record(source, 'automation', path);
  const vca = source.vcaGroup ?? null;
  if (vca !== null && !VCA_GROUP_IDS.includes(vca as VcaGroupId)) invalid(`${path}.vcaGroup`);
  const duckKey = source.duckKeyTrackId ?? null;
  if (duckKey !== null && !Number.isSafeInteger(duckKey)) invalid(`${path}.duckKeyTrackId`);
  return {
    ...defaults,
    clip: {
      startSec: num(clip, 'startSec', 0, `${path}.clip`),
      trimStartSec: num(clip, 'trimStartSec', 0, `${path}.clip`),
      lengthSec: (clipLength as number | null | undefined) ?? null,
      fadeInSec: num(clip, 'fadeInSec', 0, `${path}.clip`),
      fadeOutSec: num(clip, 'fadeOutSec', 0, `${path}.clip`),
    },
    faderDb: num(source, 'faderDb', defaults.faderDb, path),
    pan: num(source, 'pan', defaults.pan, path),
    panLaw: num(source, 'panLaw', defaults.panLaw, path),
    panMode: num(source, 'panMode', defaults.panMode, path),
    dualPanLeft: num(source, 'dualPanLeft', defaults.dualPanLeft, path),
    dualPanRight: num(source, 'dualPanRight', defaults.dualPanRight, path),
    channelDelayMs: num(source, 'channelDelayMs', defaults.channelDelayMs, path),
    polarityLeft: bool(source, 'polarityLeft', false, path),
    polarityRight: bool(source, 'polarityRight', false, path),
    muted: bool(source, 'muted', false, path),
    soloed: bool(source, 'soloed', false, path),
    soloSafe: bool(source, 'soloSafe', false, path),
    vcaGroup: vca as VcaGroupId | null,
    eq,
    slots: Object.fromEntries(
      TRACK_SLOTS.map((name) => [
        name,
        readSlot(slots[name], defaults.slots[name], `${path}.slots.${name}`),
      ]),
    ) as Record<TrackSlotName, InsertSlot>,
    duckKeyTrackId: duckKey as number | null,
    sends: Object.fromEntries(
      AUX_BUSES.map((bus) => {
        const send = record(sends, bus, `${path}.sends`);
        return [
          bus,
          {
            levelDb: num(send, 'levelDb', SEND_OFF_DB, `${path}.sends.${bus}`),
            timing: oneOf(
              send,
              'timing',
              ['preFader', 'postFader'] as const,
              'postFader',
              `${path}.sends.${bus}`,
            ),
          },
        ];
      }),
    ) as Record<AuxBusName, TrackSend>,
    automation: Object.fromEntries(
      AUTOMATION_PARAMS.map((param) => {
        const points = automation[param] ?? [];
        if (!Array.isArray(points)) invalid(`${path}.automation.${param}`);
        return [
          param,
          sortedPoints(
            points.map((point: unknown, i): AutomationPoint => {
              const at = `${path}.automation.${param}.${i}`;
              if (!isRecord(point) || typeof point.id !== 'string') invalid(at);
              return {
                id: point.id,
                timeSec: num(point, 'timeSec', 0, at),
                value: num(point, 'value', 0, at),
                curve: oneOf(point, 'curve', AUTOMATION_CURVES, 'linear', at),
              };
            }),
          ),
        ];
      }),
    ) as Record<AutomationParam, AutomationPoint[]>,
  };
}

/**
 * Reads a v2 project (parsed JSON or text). Absent fields take their defaults;
 * a present field of the wrong type, an unknown slot parameter or a duplicate
 * track id rejects the whole file. Returns `null` for anything that is not a
 * valid v2 project.
 */
export function parseMixingState(value: unknown): MixingState | null {
  try {
    const source = typeof value === 'string' ? JSON.parse(value) : value;
    if (!isRecord(source) || source.version !== MIXING_PROJECT_VERSION) return null;
    const base = createMixingState();
    const tracksSource = source.tracks ?? [];
    if (!Array.isArray(tracksSource) || tracksSource.length > MAX_TRACKS) invalid('tracks');
    const tracks = tracksSource.map((track, i) => readTrack(track, `tracks.${i}`));
    const ids = new Set(tracks.map((track) => track.id));
    if (ids.size !== tracks.length) invalid('tracks.id');
    for (const track of tracks) {
      if (track.duckKeyTrackId !== null && !ids.has(track.duckKeyTrackId)) {
        invalid(`tracks.${track.id}.duckKeyTrackId`);
      }
    }
    for (const track of tracks) {
      if (
        track.duckKeyTrackId !== null &&
        duckKeyClosesCycle(tracks, track.id, track.duckKeyTrackId)
      ) {
        invalid(`tracks.${track.id}.duckKeyTrackId`);
      }
    }
    const busesSource = record(source, 'buses', '');
    const master = record(source, 'master', '');
    const masterSlots = record(master, 'slots', 'master');
    const vca = record(source, 'vcaGains', '');
    const loop = record(source, 'loop', '');
    return {
      version: MIXING_PROJECT_VERSION,
      tracks,
      buses: Object.fromEntries(
        AUX_BUSES.map((bus) => {
          const busSource = record(busesSource, bus, 'buses');
          const slot = readSlot(
            { bypassed: false, params: busSource.params ?? {} },
            { bypassed: false, params: base.buses[bus].params },
            `buses.${bus}`,
          );
          return [
            bus,
            { gainDb: num(busSource, 'gainDb', 0, `buses.${bus}`), params: slot.params },
          ];
        }),
      ) as Record<AuxBusName, AuxBusState>,
      master: {
        faderDb: num(master, 'faderDb', 0, 'master'),
        slots: Object.fromEntries(
          MASTER_SLOTS.map((name) => [
            name,
            readSlot(masterSlots[name], base.master.slots[name], `master.slots.${name}`),
          ]),
        ) as Record<MasterSlotName, InsertSlot>,
      },
      vcaGains: Object.fromEntries(
        VCA_GROUP_IDS.map((id) => [id, num(vca, id, 0, 'vcaGains')]),
      ) as Record<VcaGroupId, number>,
      loop: {
        enabled: bool(loop, 'enabled', false, 'loop'),
        startSec: num(loop, 'startSec', 0, 'loop'),
        endSec: num(loop, 'endSec', 0, 'loop'),
      },
    };
  } catch (error) {
    if (error instanceof InvalidProject || error instanceof SyntaxError) return null;
    throw error;
  }
}
