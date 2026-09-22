/**
 * What a scan can be taken away as. The audio leaves as WAV through the audio
 * engine; this module shapes the numbers and names the files.
 *
 * The report deliberately reports the source *distance* and no coordinates: one
 * channel resolves how far the source is, not which way, so a point in the room
 * would read as a bearing the scan never had. The scene draws a shell for the
 * same reason.
 */

import type { ScanResult } from '@/demos/spatial/spatial.worker';

export interface ScanReportContext {
  /** Sample-room id when one was picked, otherwise null. */
  preset: string | null;
  /** Uploaded file name when there was one. */
  fileName: string;
  /** Engine version the estimate came from. */
  engineVersion: string;
}

/** A filename stem for whatever the scan was of: the sample room, or the upload. */
export function exportStem(context: Pick<ScanReportContext, 'preset' | 'fileName'>): string {
  if (context.preset) return slugify(context.preset);
  return slugify(context.fileName.replace(/\.[^.]+$/, '')) || 'room';
}

export function slugify(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function scanReport(result: ScanResult, context: ScanReportContext) {
  return {
    engine: { name: 'libsonare', version: context.engineVersion },
    source: context.preset
      ? { kind: 'preset', preset: context.preset }
      : { kind: 'recording', file: context.fileName },
    mode: result.isBlind ? 'blind-estimate' : 'impulse-response',
    confidence: round(result.confidence, 3),
    room: {
      lengthM: round(result.room.length, 2),
      widthM: round(result.room.width, 2),
      heightM: round(result.room.height, 2),
      volumeM3: round(result.room.volume, 1),
    },
    sourceDistanceM: round(result.sourceDistance, 2),
    criticalDistanceM: round(result.criticalDistance, 2),
    drrDb: round(result.drrDb, 1),
    acoustic: {
      rt60Sec: round(result.acoustic.rt60, 3),
      edtSec: round(result.acoustic.edt, 3),
      c50Db: round(result.acoustic.c50, 1),
      c80Db: round(result.acoustic.c80, 1),
      d50: round(result.acoustic.d50, 3),
    },
    bands: result.bands.map((band) => ({
      freqHz: band.freq,
      rt60Sec: round(band.rt60, 3),
      absorption: round(band.absorption, 3),
    })),
    groundTruth: result.truth
      ? {
          lengthM: result.truth.room.length,
          widthM: result.truth.room.width,
          heightM: result.truth.room.height,
        }
      : null,
  };
}

/** These are estimates, so the file reports them at the precision they carry. */
function round(value: number | null, digits: number): number | null {
  if (value === null || !Number.isFinite(value)) return null;
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}
