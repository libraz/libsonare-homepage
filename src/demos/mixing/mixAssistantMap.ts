/**
 * Maps a `suggestMixScene` result onto the fixed mixing layout as a
 * {@link MixPatch}. Only values the engine takes live are mapped, so switching
 * between the user's mix and the proposal is setters only; everything else is
 * listed as unapplied with the reason. The assistant's source classes, mix
 * profile pass through for display: the classes are estimates.
 *
 * Topology: an aux bus is followed through its return strip to the REVERB or
 * DELAY bus by the processor the return carries; a subgroup bus and a VCA group
 * have no counterpart. The master bus's input trim lands on the master fader.
 * The plate's construction-only `decaySec` is converted to its live `decay`.
 */
import {
  AUX_BUS_PROCESSORS,
  type AuxBusName,
  duckKeyClosesCycle,
  type MixingState,
  type MixPatch,
  plateDecayFromSeconds,
  type StripEqBand,
  TRACK_SLOT_PROCESSORS,
  type TrackMixPatch,
  type TrackSlotName,
} from '@/demos/mixing/mixingState';
import type {
  EqBandType,
  MasteringInsertParamInfo,
  MixAssistantMixProfile,
  MixAssistantResult,
  MixSceneInsert,
  MixSceneStrip,
} from '@/wasm/index.js';

export type UnappliedReason =
  /** The fixed layout has no slot for this processor, bus or strip setting. */
  | 'noSlot'
  /** The slot exists but does not expose this parameter. */
  | 'notInLayout'
  /** The engine takes this parameter only at construction. */
  | 'notRealtimeSafe'
  /** Every strip EQ slot for this band type is taken. */
  | 'eqBandsFull'
  /** Group routing: the mix has no subgroup buses. */
  | 'subgroupBus'
  /** The mix has three fixed VCA groups the assistant does not address. */
  | 'vcaGroup'
  /** A strip that matches no track. */
  | 'unknownStrip';

export interface UnappliedItem {
  /** Assistant strip or bus id the item came from. */
  source: string;
  /** Processor, parameter or setting, e.g. `dynamics.vocalRider` or `dynamics.compressor.detector`. */
  name: string;
  reason: UnappliedReason;
}

export interface TrackClassification {
  trackId: number;
  source: string;
  confidence: number;
  usable: boolean;
}

export interface MixSuggestion {
  patch: MixPatch;
  unapplied: UnappliedItem[];
  classification: TrackClassification[];
  mix: MixAssistantMixProfile;
}

/** Parameter catalogue lookup, `masteringInsertParamInfo` in practice. */
export type ParamInfoLookup = (processor: string) => readonly MasteringInsertParamInfo[];

const SLOT_BY_PROCESSOR = new Map(
  Object.entries(TRACK_SLOT_PROCESSORS).map(([slot, processor]) => [
    processor,
    slot as TrackSlotName,
  ]),
);

const AUX_BY_PROCESSOR = new Map(
  Object.entries(AUX_BUS_PROCESSORS).map(([bus, processor]) => [processor, bus as AuxBusName]),
);

/** Strip EQ slots in layout order, by the band type each holds. */
const EQ_SLOT_TYPES: readonly EqBandType[] = [
  'HighPass',
  'LowShelf',
  'Peak',
  'Peak',
  'HighShelf',
  'LowPass',
];

const BAND_KEY = /^band(\d+)\.(.+)$/;

const toNumber = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value)
    ? value
    : typeof value === 'boolean'
      ? Number(value)
      : null;

/** `eq.parametric` type choice name (`lowShelf`) to strip EQ band type (`LowShelf`). */
function bandTypeName(choice: string): EqBandType {
  return (choice.charAt(0).toUpperCase() + choice.slice(1)) as EqBandType;
}

class Mapper {
  readonly unapplied: UnappliedItem[] = [];

  constructor(
    private readonly info: ParamInfoLookup,
    private readonly base: MixingState,
  ) {}

  skip(source: string, name: string, reason: UnappliedReason): void {
    this.unapplied.push({ source, name, reason });
  }

  /** Live params of `insert` that `layoutParams` exposes; the rest are listed. */
  liveParams(
    source: string,
    insert: MixSceneInsert,
    layoutParams: Readonly<Record<string, number>>,
  ): Record<string, number> {
    const catalogue = new Map(this.info(insert.processor).map((param) => [param.name, param]));
    const params: Record<string, number> = {};
    for (const [name, raw] of Object.entries(insert.params)) {
      const label = `${insert.processor}.${name}`;
      const value = toNumber(raw);
      if (insert.processor === AUX_BUS_PROCESSORS.reverb && name === 'decaySec' && value !== null) {
        params.decay = plateDecayFromSeconds(value);
      } else if (catalogue.get(name)?.rtSafe !== true) {
        this.skip(source, label, 'notRealtimeSafe');
      } else if (!(name in layoutParams) || value === null) {
        this.skip(source, label, 'notInLayout');
      } else {
        params[name] = value;
      }
    }
    return params;
  }

  /** Bands of an `eq.parametric` insert, in band order, as strip EQ bands. */
  parametricBands(insert: MixSceneInsert): StripEqBand[] {
    const typeChoices = this.info(insert.processor).find(
      (param) => param.name === 'band0.type',
    )?.choices;
    const bands = new Map<number, Record<string, unknown>>();
    for (const [key, value] of Object.entries(insert.params)) {
      const match = key.match(BAND_KEY);
      if (!match) continue;
      const index = Number(match[1]);
      bands.set(index, { ...bands.get(index), [match[2]]: value });
    }
    return [...bands.entries()]
      .sort(([a], [b]) => a - b)
      .map(([, band]) => {
        const choice = typeChoices?.find((c) => c.value === band.type)?.name ?? 'peak';
        return {
          type: bandTypeName(choice),
          frequencyHz: toNumber(band.frequencyHz) ?? 1000,
          gainDb: toNumber(band.gainDb) ?? 0,
          q: toNumber(band.q) ?? Math.SQRT1_2,
          enabled: band.enabled !== false,
        };
      });
  }

  /** Places bands into the slots whose layout type matches; a band with no free slot is listed. */
  placeBands(source: string, bands: readonly StripEqBand[], patch: TrackMixPatch): void {
    const eq: Partial<Record<number, StripEqBand>> = { ...patch.eq };
    for (const band of bands) {
      const slot = EQ_SLOT_TYPES.findIndex((type, i) => type === band.type && eq[i] === undefined);
      if (slot < 0) {
        this.skip(source, `eq.${band.type}@${Math.round(band.frequencyHz)}Hz`, 'eqBandsFull');
      } else {
        eq[slot] = band;
      }
    }
    patch.eq = eq;
  }

  /** Strip settings with no live setter, listed when they differ from the track's. */
  nonLiveSettings(strip: MixSceneStrip, trackId: number): void {
    const track = this.base.tracks.find((t) => t.id === trackId);
    if (!track) return;
    const checks: Array<[string, boolean]> = [
      ['polarityInvertLeft', strip.polarityInvertLeft !== track.polarityLeft],
      ['polarityInvertRight', strip.polarityInvertRight !== track.polarityRight],
      ['panLaw', strip.panLaw !== track.panLaw],
      ['panMode', strip.panMode !== track.panMode],
      [
        'dualPan',
        strip.dualPanLeft !== track.dualPanLeft || strip.dualPanRight !== track.dualPanRight,
      ],
      ['channelDelaySamples', strip.channelDelaySamples !== 0],
    ];
    for (const [name, differs] of checks) if (differs) this.skip(strip.id, name, 'noSlot');
    if (strip.vcaOffsetDb !== 0) this.skip(strip.id, 'vcaOffsetDb', 'vcaGroup');
  }
}

/**
 * Maps `result` onto `base`'s tracks. Assistant strip ids are track ids as
 * strings (what the worker sends); `info` is the engine's parameter catalogue.
 */
export function mapMixSuggestion(
  result: MixAssistantResult,
  base: MixingState,
  info: ParamInfoLookup,
): MixSuggestion {
  const mapper = new Mapper(info, base);
  const { scene } = result;
  const trackIds = new Map(base.tracks.map((track) => [String(track.id), track.id]));
  const busRole = new Map(scene.buses.map((bus) => [bus.id, bus.role]));
  // Aux bus -> return strip -> the REVERB/DELAY bus its effect corresponds to.
  const auxOfBus = new Map<string, AuxBusName>();
  const returnStrips = new Map<string, AuxBusName>();
  for (const connection of scene.connections) {
    if (busRole.get(connection.source) !== 'aux') continue;
    const strip = scene.strips.find((s) => s.id === connection.destination);
    const aux = strip?.inserts
      .map((i) => AUX_BY_PROCESSOR.get(i.processor))
      .find((name) => name !== undefined);
    if (strip && aux) {
      auxOfBus.set(connection.source, aux);
      returnStrips.set(strip.id, aux);
    }
  }

  const patch: MixPatch = { tracks: {} };
  for (const strip of scene.strips) {
    const aux = returnStrips.get(strip.id);
    if (aux) {
      const busParams: Record<string, number> = {};
      for (const insert of strip.inserts) {
        if (AUX_BY_PROCESSOR.get(insert.processor) === aux) {
          Object.assign(busParams, mapper.liveParams(strip.id, insert, base.buses[aux].params));
        } else {
          mapper.skip(strip.id, insert.processor, 'noSlot');
        }
      }
      patch.buses = { ...patch.buses, [aux]: { gainDb: strip.faderDb, params: busParams } };
      continue;
    }
    const trackId = trackIds.get(strip.id);
    const track = base.tracks.find((t) => t.id === trackId);
    if (trackId === undefined || !track) {
      mapper.skip(strip.id, 'strip', 'unknownStrip');
      continue;
    }
    const slots: NonNullable<TrackMixPatch['slots']> = {
      trim: { bypassed: false, params: { levelDb: strip.inputTrimDb } },
      width: { bypassed: false, params: { width: strip.width } },
    };
    const trackPatch: TrackMixPatch = { faderDb: strip.faderDb, pan: strip.pan, slots };
    mapper.nonLiveSettings(strip, trackId);
    if (strip.eq?.bands.length) {
      mapper.placeBands(
        strip.id,
        strip.eq.bands.map((band) => ({
          type: band.type ?? 'Peak',
          frequencyHz: band.frequencyHz ?? 1000,
          gainDb: band.gainDb ?? 0,
          q: band.q ?? Math.SQRT1_2,
          enabled: band.enabled === true,
        })),
        trackPatch,
      );
    }
    for (const insert of strip.inserts) {
      if (insert.processor === 'eq.parametric') {
        mapper.placeBands(strip.id, mapper.parametricBands(insert), trackPatch);
        continue;
      }
      const slot = SLOT_BY_PROCESSOR.get(insert.processor);
      if (!slot || slot === 'trim' || slot === 'width') {
        mapper.skip(strip.id, insert.processor, 'noSlot');
        continue;
      }
      slots[slot] = {
        bypassed: false,
        params: mapper.liveParams(strip.id, insert, track.slots[slot].params),
      };
      if (slot === 'duck' && insert.sidechainKey !== undefined) {
        const key = trackIds.get(insert.sidechainKey);
        if (key === undefined || key === trackId) {
          mapper.skip(strip.id, `${insert.processor}.sidechainKey`, 'noSlot');
        } else {
          trackPatch.duckKeyTrackId = key;
        }
      }
    }
    for (const send of strip.sends) {
      const target = auxOfBus.get(send.destinationBusId);
      if (!target) {
        mapper.skip(strip.id, `send:${send.destinationBusId}`, 'noSlot');
        continue;
      }
      trackPatch.sends = {
        ...trackPatch.sends,
        [target]: {
          levelDb: send.sendDb,
          timing: send.timing === 'pre' ? 'preFader' : 'postFader',
        },
      };
    }
    patch.tracks[trackId] = trackPatch;
  }

  // The engine refuses a key that closes a cycle with the keys already in place.
  let keyed = base.tracks;
  for (const strip of scene.strips) {
    const trackId = trackIds.get(strip.id);
    const key = trackId === undefined ? undefined : patch.tracks[trackId]?.duckKeyTrackId;
    if (trackId === undefined || key == null) continue;
    if (duckKeyClosesCycle(keyed, trackId, key)) {
      delete patch.tracks[trackId].duckKeyTrackId;
      mapper.skip(strip.id, `${TRACK_SLOT_PROCESSORS.duck}.sidechainKey`, 'noSlot');
    } else {
      keyed = keyed.map((t) => (t.id === trackId ? { ...t, duckKeyTrackId: key } : t));
    }
  }

  for (const bus of scene.buses) {
    if (bus.role === 'master') {
      if (bus.inputTrimDb !== undefined) {
        patch.masterFaderDb = base.master.faderDb + bus.inputTrimDb;
      }
      for (const insert of bus.inserts) mapper.skip(bus.id, insert.processor, 'noSlot');
    } else if (bus.role === 'subgroup') {
      mapper.skip(bus.id, 'bus', 'subgroupBus');
    } else if (!auxOfBus.has(bus.id)) {
      mapper.skip(bus.id, 'bus', 'noSlot');
    }
  }
  for (const group of scene.vcaGroups) mapper.skip(group.id, 'vcaGroup', 'vcaGroup');

  return {
    patch,
    unapplied: mapper.unapplied,
    classification: result.tracks.flatMap((profile) => {
      const trackId = trackIds.get(profile.stripId);
      return trackId === undefined
        ? []
        : [
            {
              trackId,
              source: profile.source,
              confidence: profile.sourceConfidence,
              usable: profile.usable,
            },
          ];
    }),
    mix: result.mix,
  };
}

/**
 * Monitor gains that level-match A and B: the louder side is lowered by the
 * difference, so both are ≤ 0 dB and one is 0. A non-finite loudness (silence)
 * leaves both untouched.
 */
export function abMatchGains(aLufs: number, bLufs: number): { aDb: number; bDb: number } {
  if (!Number.isFinite(aLufs) || !Number.isFinite(bLufs)) return { aDb: 0, bDb: 0 };
  const diff = aLufs - bLufs;
  return diff > 0 ? { aDb: -diff, bDb: 0 } : { aDb: 0, bDb: diff };
}
