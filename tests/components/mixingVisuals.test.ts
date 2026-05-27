import { describe, expect, it } from 'vitest';
import type { MixTrack } from '@/components/mixing/mixingTypes';
import { goniometerPoints, meterHeight, waveformPath } from '@/components/mixing/mixingVisuals';

function trackWithWaveform(waveform: MixTrack['waveform']): MixTrack {
  return {
    id: 'track',
    name: 'Track',
    audio: {
      fileName: 'track.wav',
      sampleRate: 48_000,
      duration: 1,
      channels: 2,
      left: new Float32Array(1),
      right: new Float32Array(1),
    },
    waveform,
    offsetSeconds: 0,
    inputTrimDb: 0,
    faderDb: 0,
    pan: 0,
    width: 1,
    panLaw: 0,
    panMode: 0,
    dualPanLeft: -1,
    dualPanRight: 1,
    channelDelayMs: 0,
    eqEnabled: false,
    eqTiltDb: 0,
    eqAirDb: 0,
    reverbSendDb: -60,
    vcaGroup: '',
    automation: [],
    muted: false,
    soloed: false,
    soloSafe: false,
    polarityLeft: false,
    polarityRight: false,
  };
}

describe('mixing visual helpers', () => {
  it('maps dB values to clamped meter heights', () => {
    expect(meterHeight(-60)).toBe(0);
    expect(meterHeight(-30)).toBe(50);
    expect(meterHeight(0)).toBe(100);
    expect(meterHeight(12)).toBe(100);
    expect(meterHeight(-120)).toBe(0);
  });

  it('converts goniometer points to SVG polyline coordinates', () => {
    expect(goniometerPoints(undefined)).toBe('');
    expect(goniometerPoints([])).toBe('');
    expect(
      goniometerPoints([
        { left: 0, right: 0 },
        { left: 1, right: 1 },
        { left: 1, right: -1 },
      ]),
    ).toBe('50.0,50.0 50.0,4.0 96.0,50.0');
  });

  it('builds a closed waveform path from upper and lower envelopes', () => {
    expect(waveformPath(trackWithWaveform([]))).toBe('');

    const path = waveformPath(
      trackWithWaveform([
        { min: -0.5, max: 0.5, rms: 0.35 },
        { min: -1, max: 1, rms: 0.7 },
        { min: -0.25, max: 0.25, rms: 0.2 },
      ]),
    );

    expect(path).toBe(
      'M 0.000,9.000 L 50.000,0.000 L 100.000,13.500 L 100.000,22.500 L 50.000,36.000 L 0.000,27.000 Z',
    );
  });

  it('handles single-point waveforms without division by zero', () => {
    expect(waveformPath(trackWithWaveform([{ min: -1, max: 1, rms: 1 }]))).toBe(
      'M 0.000,0.000 L 0.000,36.000 Z',
    );
  });
});
