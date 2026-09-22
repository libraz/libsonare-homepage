import { describe, expect, it } from 'vitest';
import type { ScanResult } from '@/demos/spatial/spatial.worker';
import { exportStem, scanReport, slugify } from '@/demos/spatial/spatialExport';

function result(overrides: Partial<ScanResult> = {}): ScanResult {
  return {
    room: { length: 6.234, width: 4.111, height: 2.87, volume: 73.55 },
    drrDb: 3.4567,
    confidence: 0.61234,
    estimateConfidence: 0.6,
    isBlind: true,
    valid: true,
    acoustic: { rt60: 0.63421, edt: 0.51239, c50: 4.5678, c80: 8.1234, d50: 0.74123 },
    bands: [
      { freq: 125, label: '125', rt60: 0.81234, absorption: 0.14567 },
      { freq: 1000, label: '1k', rt60: 0.59876, absorption: 0.21234 },
    ],
    criticalDistance: 1.2345,
    sourceDistance: 2.3456,
    listener: { x: 3, y: 2, z: 1.2 },
    source: { x: 1, y: 1, z: 1.2 },
    dspSource: { x: 1, y: 1, z: 1.2 },
    truth: null,
    ...overrides,
  };
}

const context = { preset: null, fileName: 'clap.wav', engineVersion: '1.8.0' };

describe('slugify', () => {
  it('splits a camel-cased preset id on its humps', () => {
    expect(slugify('liveRoom')).toBe('live-room');
  });

  it('collapses everything a filename can carry into single hyphens', () => {
    expect(slugify('Hall  recording (take 2)')).toBe('hall-recording-take-2');
  });
});

describe('exportStem', () => {
  it('names the file after the sample room when one was picked', () => {
    expect(exportStem({ preset: 'cathedral', fileName: '' })).toBe('cathedral');
  });

  it('drops the upload extension', () => {
    expect(exportStem({ preset: null, fileName: 'church-clap.flac' })).toBe('church-clap');
  });

  it('falls back when a filename slugifies to nothing', () => {
    expect(exportStem({ preset: null, fileName: '教会.wav' })).toBe('room');
  });
});

describe('scanReport', () => {
  it('rounds every estimate to the precision it carries', () => {
    const report = scanReport(result(), context);
    expect(report.room).toEqual({ lengthM: 6.23, widthM: 4.11, heightM: 2.87, volumeM3: 73.6 });
    expect(report.sourceDistanceM).toBe(2.35);
    expect(report.drrDb).toBe(3.5);
    expect(report.acoustic.rt60Sec).toBe(0.634);
    expect(report.bands[0]).toEqual({ freqHz: 125, rt60Sec: 0.812, absorption: 0.146 });
  });

  /**
   * A mono scan resolves how far the source is and not which way, so a
   * coordinate in the file would claim a bearing the scan never had.
   */
  it('reports the source distance and no coordinates', () => {
    const json = JSON.stringify(scanReport(result(), context));
    expect(json).toContain('sourceDistanceM');
    expect(json).not.toContain('dspSource');
    expect(json).not.toContain('listener');
  });

  it('names the sample room rather than a file when a preset was scanned', () => {
    const report = scanReport(result(), { ...context, preset: 'hall', fileName: '' });
    expect(report.source).toEqual({ kind: 'preset', preset: 'hall' });
  });

  it('carries the known geometry a preset was synthesized from', () => {
    const report = scanReport(
      result({
        truth: {
          room: { length: 20, width: 14, height: 9 },
          source: { x: 4, y: 7, z: 1.5 },
          listener: { x: 14, y: 7, z: 1.2 },
        },
      }),
      { ...context, preset: 'hall' },
    );
    expect(report.groundTruth).toEqual({ lengthM: 20, widthM: 14, heightM: 9 });
  });

  it('writes null rather than a number for a metric the scan could not find', () => {
    const report = scanReport(
      result({ acoustic: { rt60: 0.5, edt: 0.4, c50: null, c80: null, d50: null } }),
      context,
    );
    expect(report.acoustic.c50Db).toBeNull();
    expect(report.acoustic.d50).toBeNull();
  });

  it('says which pipeline the numbers came from', () => {
    expect(scanReport(result({ isBlind: false }), context).mode).toBe('impulse-response');
    expect(scanReport(result(), context).mode).toBe('blind-estimate');
  });
});
