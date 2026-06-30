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
  waveformPath,
} from '@/components/analysis/musicAnalysisViewModel';

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
});
