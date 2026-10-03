/**
 * The JSON report saved beside an export: what was rendered (the project
 * state, without audio) and what the render measured.
 */
import type { MasteringState } from '@/demos/mastering/masteringState';
import { masteringTargetLufs } from '@/demos/mastering/masteringState';
import type { MasteringFileInfo, MasteringRenderRecord } from '@/demos/mastering/useMastering';

/** Version of the report layout. */
export const MASTERING_REPORT_VERSION = 2;

export interface MasteringReportInput {
  state: MasteringState;
  source: MasteringFileInfo | null;
  render: MasteringRenderRecord;
}

const round = (value: number, digits = 2) =>
  Number.isFinite(value) ? Number(value.toFixed(digits)) : null;

export function createMasteringReport({ state, source, render }: MasteringReportInput) {
  const { result } = render;
  return {
    version: MASTERING_REPORT_VERSION,
    renderedAt: new Date(render.at).toISOString(),
    source: source && {
      fileName: source.fileName,
      sampleRate: source.sampleRate,
      durationSec: round(source.duration, 3),
      channels: source.channels,
    },
    output: {
      fileName: render.fileName,
      format: render.format,
      dither: render.format === 'float32' ? 'none' : render.dither,
    },
    target: {
      platform: state.quick.platform,
      integratedLufs: masteringTargetLufs(state),
    },
    measured: {
      integratedLufs: round(result.integratedLufs),
      loudnessRangeLu: round(result.loudnessRange),
      truePeakDbtp: round(result.truePeakDb),
      plrDb: round(result.truePeakDb - result.integratedLufs),
      maxMomentaryLufs: round(result.maxMomentaryLufs),
      maxShortTermLufs: round(result.maxShortTermLufs),
    },
    loudnessFit: state.loudness.fit && {
      driveDb: round(state.loudness.fit.driveDb),
      residualLu: round(state.loudness.fit.residualLu),
      limited: state.loudness.fit.limited,
    },
    project: {
      preset: state.quick.preset,
      venue: state.quick.venue,
      repair: state.repair,
      eq: state.eq,
      inserts: state.inserts,
    },
  };
}
