import type { MixTrack } from '@/components/mixing/mixingTypes';
import { clamp } from '@/utils/scale';
import type { GoniometerPoint } from '@/wasm/index';

export function meterHeight(db: number): number {
  return clamp(((db + 60) / 60) * 100, 0, 100);
}

export function goniometerPoints(points: GoniometerPoint[] | undefined): string {
  if (!points?.length) return '';
  const radius = 46;
  return points
    .map((point) => {
      const x = 50 + (point.left - point.right) * 0.5 * radius;
      const y = 50 - (point.left + point.right) * 0.5 * radius;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

export function waveformPath(track: MixTrack): string {
  if (!track.waveform.length) return '';
  const height = 36;
  const mid = height / 2;
  const step = 100 / Math.max(1, track.waveform.length - 1);
  const upper = track.waveform.map(
    (point, index) => `${(index * step).toFixed(3)},${(mid - point.max * mid).toFixed(3)}`,
  );
  const lower = track.waveform
    .slice()
    .reverse()
    .map((point, reverseIndex) => {
      const index = track.waveform.length - 1 - reverseIndex;
      return `${(index * step).toFixed(3)},${(mid - point.min * mid).toFixed(3)}`;
    });
  return `M ${upper.join(' L ')} L ${lower.join(' L ')} Z`;
}
