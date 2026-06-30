import type { WaveformPeak } from '@/utils/audio';

export interface ChordFrame {
  name: string;
  start: number;
  end: number;
  confidence: number;
}

export interface SectionFrame {
  start: number;
  end: number;
  confidence: number;
  energyLevel: number;
}

export function mergeChordSegments(chords: ChordFrame[]): ChordFrame[] {
  const segments: ChordFrame[] = [];
  for (const chord of chords) {
    const last = segments[segments.length - 1];
    if (last && last.name === chord.name) {
      last.end = chord.end;
      last.confidence = Math.max(last.confidence, chord.confidence);
    } else {
      segments.push({ ...chord });
    }
  }
  return segments;
}

export function formatSectionName(
  name: string,
  sectionKeys: string[],
  localize: (key: string) => string,
): string {
  const normalized = name.replace(/[\s_-]+/g, '').replace(/^prechorus$/i, 'PreChorus');
  const key = sectionKeys.find(
    (sectionKey) => sectionKey.toLowerCase() === normalized.toLowerCase(),
  );
  return key ? localize(key) : name;
}

export function sectionStyle(start: number, end: number, duration: number) {
  const total = duration || 1;
  return {
    left: `${Math.max(0, (start / total) * 100)}%`,
    width: `${Math.max(0.4, ((end - start) / total) * 100)}%`,
  };
}

export function markerStyle(time: number, duration: number) {
  const total = duration || 1;
  return {
    left: `${Math.max(0, Math.min(100, (time / total) * 100))}%`,
  };
}

export function confidencePct(value: number): number {
  return Math.round(Math.max(0, Math.min(1, value)) * 100);
}

export function confidenceTone(value: number): 'is-low' | 'is-mid' | 'is-high' {
  if (value >= 0.66) return 'is-high';
  if (value >= 0.4) return 'is-mid';
  return 'is-low';
}

export function sectionStyleRich(section: SectionFrame, duration: number) {
  return {
    ...sectionStyle(section.start, section.end, duration),
    opacity: `${Math.max(0.45, Math.min(1, section.confidence))}`,
    '--energy': `${Math.max(0, Math.min(1, section.energyLevel))}`,
  };
}

export function chordStyleRich(chord: ChordFrame, duration: number) {
  return {
    ...sectionStyle(chord.start, chord.end, duration),
    opacity: `${Math.max(0.35, Math.min(1, chord.confidence))}`,
  };
}

export function chordLabel(
  chord: Pick<ChordFrame, 'start' | 'end' | 'name'>,
  duration: number,
): string {
  const total = duration || 1;
  return ((chord.end - chord.start) / total) * 100 >= 2 ? chord.name : '';
}

export function decimateStereo(left: Float32Array, right: Float32Array, frames: number) {
  if (left.length <= frames) {
    return { left: left.slice(), right: right.slice() };
  }
  const outLeft = new Float32Array(frames);
  const outRight = new Float32Array(frames);
  const step = left.length / frames;
  for (let i = 0; i < frames; i++) {
    const index = Math.floor(i * step);
    outLeft[i] = left[index];
    outRight[i] = right[index] ?? left[index];
  }
  return { left: outLeft, right: outRight };
}

export function waveformPath(waveform: WaveformPeak[]): string {
  if (!waveform.length) return '';
  const height = 72;
  const mid = height / 2;
  const step = 100 / Math.max(1, waveform.length - 1);
  const upper = waveform.map(
    (point, index) => `${(index * step).toFixed(3)},${(mid - point.max * mid).toFixed(3)}`,
  );
  const lower = waveform
    .slice()
    .reverse()
    .map((point, reverseIndex) => {
      const index = waveform.length - 1 - reverseIndex;
      return `${(index * step).toFixed(3)},${(mid - point.min * mid).toFixed(3)}`;
    });
  return `M ${upper.join(' L ')} L ${lower.join(' L ')} Z`;
}
