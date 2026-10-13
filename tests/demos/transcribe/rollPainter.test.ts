// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { KEY_GEOMETRY } from '@/components/keyboard/keyGeometry';
import { gutterKeyRect, rollGeometry } from '@/demos/transcribe/rollPainter';

describe('transcribe gutter keyboard', () => {
  const geo = rollGeometry(800, 600, { startSec: 0, spanSec: 10 }, { low: 48, high: 72 });

  it('sizes black keys from the shared key geometry against a white key', () => {
    const white = gutterKeyRect(geo, 60, false);
    const black = gutterKeyRect(geo, 61, true);
    // On its side: length runs across the gutter, width is the pitch row.
    expect(black.w / white.w).toBeCloseTo(KEY_GEOMETRY.blackLengthRatio);
    expect(black.h / geo.rowHeight).toBeCloseTo(KEY_GEOMETRY.blackWidthRatio);
  });

  it('anchors black keys at the roll side and centres them on their row', () => {
    const white = gutterKeyRect(geo, 61, false);
    const black = gutterKeyRect(geo, 61, true);
    expect(black.x + black.w).toBeCloseTo(white.x + white.w);
    expect(black.y + black.h / 2).toBeCloseTo(white.y - 0.5 + geo.rowHeight / 2);
  });
});
