import { describe, expect, it } from 'vitest';
import {
  chordLabel,
  confidencePct,
  confidenceTone,
  decimateStereo,
  formatSectionName,
  markerStyle,
  mergeChordSegments,
  sectionStyle,
  spanAt,
  tempoAt,
  tempoLane,
  waveformPath,
} from '@/demos/music-analysis/musicAnalysisViewModel';

describe('music analysis view-model helpers', () => {
  it('merges adjacent chord frames', () => {
    expect(
      mergeChordSegments([
        { name: 'C', start: 0, end: 1, confidence: 0.5 },
        { name: 'C', start: 1, end: 2, confidence: 0.8 },
        { name: 'G', start: 2, end: 3, confidence: 0.4 },
      ]),
    ).toEqual([
      { name: 'C', start: 0, end: 2, confidence: 0.8 },
      { name: 'G', start: 2, end: 3, confidence: 0.4 },
    ]);
  });

  it('formats sections and timeline styles', () => {
    expect(formatSectionName('pre chorus', ['Intro', 'PreChorus'], (key) => `x:${key}`)).toBe(
      'x:PreChorus',
    );
    expect(sectionStyle(2, 5, 10)).toEqual({ left: '20%', width: '30%' });
    expect(markerStyle(12, 10)).toEqual({ left: '100%' });
  });

  it('formats confidence and labels only wide chord blocks', () => {
    expect(confidencePct(1.4)).toBe(100);
    expect(confidenceTone(0.7)).toBe('is-high');
    expect(confidenceTone(0.5)).toBe('is-mid');
    expect(confidenceTone(0.2)).toBe('is-low');
    expect(chordLabel({ name: 'Am', start: 0, end: 1 }, 100)).toBe('');
    expect(chordLabel({ name: 'Am', start: 0, end: 3 }, 100)).toBe('Am');
  });

  it('decimates stereo pairs and builds waveform paths', () => {
    const decimated = decimateStereo(
      new Float32Array([1, 2, 3, 4]),
      new Float32Array([4, 3, 2, 1]),
      2,
    );

    expect(Array.from(decimated.left)).toEqual([1, 3]);
    expect(Array.from(decimated.right)).toEqual([4, 2]);
    expect(
      waveformPath([
        { min: -0.5, max: 0.5 },
        { min: -0.25, max: 0.25 },
      ]),
    ).toContain('M 0.000,18.000');
  });

  it('keeps the Roman numeral of a merged chord run', () => {
    expect(
      mergeChordSegments([
        { name: 'G', start: 0, end: 1, confidence: 0.5, romanNumeral: 'V' },
        { name: 'G', start: 1, end: 2, confidence: 0.7, romanNumeral: 'V' },
      ]),
    ).toEqual([{ name: 'G', start: 0, end: 2, confidence: 0.7, romanNumeral: 'V' }]);
  });

  it('finds the span and the local tempo under a time', () => {
    const spans = [
      { start: 0, end: 2 },
      { start: 2, end: 4 },
    ];
    expect(spanAt(spans, 2.5)).toBe(spans[1]);
    expect(spanAt(spans, 4)).toBeNull();
    const curve = [
      { time: 0.5, bpm: 120 },
      { time: 1, bpm: 121 },
    ];
    expect(tempoAt(curve, 0)).toBe(120);
    expect(tempoAt(curve, 0.9)).toBe(120);
    expect(tempoAt(curve, 3)).toBe(121);
    expect(tempoAt([], 1)).toBeNull();
  });

  it('centres the tempo lane on the global tempo with a floor on its span', () => {
    const steady = tempoLane(
      [
        { time: 0, bpm: 119.9 },
        { time: 2, bpm: 120.1 },
      ],
      2,
      120,
    )!;
    expect(steady.referenceY).toBe(50);
    // ±0.1 BPM on a 4% span stays near the centre line instead of filling the lane.
    expect(steady.path).toBe('M 0.00,51.75 L 100.00,48.25');
    expect(tempoLane([{ time: 0, bpm: 120 }], 2, 120)).toBeNull();
  });
});
