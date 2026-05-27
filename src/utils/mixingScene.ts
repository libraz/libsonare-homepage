export const REVERB_SEND_FLOOR = -60;

export interface ReverbConfig {
  enabled: boolean;
  decaySec: number;
  preDelayMs: number;
}

export interface VcaGroupConfig {
  id: string;
  gainDb: number;
}

/** Per-strip parameters needed to serialize a mixer scene (audio buffers excluded). */
export interface SceneStripInput {
  id: string;
  inputTrimDb: number;
  faderDb: number;
  pan: number;
  width: number;
  panLaw?: number;
  panMode?: number;
  dualPanLeft?: number;
  dualPanRight?: number;
  channelDelaySamples?: number;
  eqEnabled?: boolean;
  eqTiltDb?: number;
  eqAirDb?: number;
  reverbSendDb?: number;
  vcaGroup?: string;
  polarityLeft: boolean;
  polarityRight: boolean;
}

export function buildSceneJson(
  strips: SceneStripInput[],
  reverb?: ReverbConfig,
  vcaGroups?: VcaGroupConfig[],
): string {
  const reverbActive = Boolean(
    reverb?.enabled &&
      strips.some((strip) => (strip.reverbSendDb ?? REVERB_SEND_FLOOR) > REVERB_SEND_FLOOR),
  );

  const buses: Array<Record<string, unknown>> = [{ id: 'master', role: 'master' }];
  const connections: Array<{ source: string; destination: string }> = strips.map((strip) => ({
    source: strip.id,
    destination: 'master',
  }));

  if (reverbActive) {
    buses.push({
      id: 'verb',
      role: 'aux',
      inserts: [
        {
          slot: 'post',
          processor: 'effects.reverb.plate',
          params: JSON.stringify({ decaySec: reverb!.decaySec, preDelayMs: reverb!.preDelayMs }),
        },
      ],
    });
    connections.push({ source: 'verb', destination: 'master' });
  }

  const scene = {
    version: 1,
    strips: strips.map((strip) => ({
      id: strip.id,
      inputTrimDb: strip.inputTrimDb,
      faderDb: strip.faderDb,
      pan: strip.pan,
      width: strip.width,
      panLaw: strip.panLaw,
      panMode: strip.panMode ?? 0,
      dualPanLeft: strip.dualPanLeft ?? 0,
      dualPanRight: strip.dualPanRight ?? 0,
      channelDelaySamples: Math.max(0, Math.round(strip.channelDelaySamples ?? 0)),
      polarityInvertLeft: strip.polarityLeft,
      polarityInvertRight: strip.polarityRight,
      inserts: buildStripInserts(strip),
      sends: buildStripSends(strip, reverbActive),
    })),
    buses,
    vcaGroups: buildVcaGroups(strips, vcaGroups),
    connections,
  };
  return JSON.stringify(scene);
}

function buildStripInserts(strip: SceneStripInput) {
  if (!strip.eqEnabled) return [];
  const inserts: Array<{ slot: string; processor: string; params: string }> = [];
  if (strip.eqTiltDb) {
    inserts.push({
      slot: 'pre',
      processor: 'eq.tilt',
      params: JSON.stringify({ tiltDb: strip.eqTiltDb }),
    });
  }
  if (strip.eqAirDb && strip.eqAirDb > 0) {
    inserts.push({
      slot: 'pre',
      processor: 'spectral.airBand',
      params: JSON.stringify({ airDb: strip.eqAirDb }),
    });
  }
  return inserts;
}

function buildStripSends(strip: SceneStripInput, reverbActive: boolean) {
  if (!reverbActive) return [];
  const sendDb = strip.reverbSendDb ?? REVERB_SEND_FLOOR;
  if (sendDb <= REVERB_SEND_FLOOR) return [];
  return [{ id: `${strip.id}-verb`, destinationBusId: 'verb', sendDb, timing: 'post' }];
}

function buildVcaGroups(strips: SceneStripInput[], groups?: VcaGroupConfig[]) {
  if (!groups?.length) return [];
  return groups
    .map((group) => ({
      id: group.id,
      gainDb: group.gainDb,
      members: strips.filter((strip) => strip.vcaGroup === group.id).map((strip) => strip.id),
    }))
    .filter((group) => group.members.length > 0);
}
