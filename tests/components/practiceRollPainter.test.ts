import { describe, expect, it } from 'vitest';
import { noteLabel, sameSet, withAlpha } from '@/components/practice/rollPainter';

describe('practice roll painter helpers', () => {
  it('formats MIDI notes as pitch names', () => {
    expect(noteLabel(60)).toBe('C4');
    expect(noteLabel(61)).toBe('C#4');
    expect(noteLabel(59)).toBe('B3');
  });

  it('compares sets without depending on insertion order', () => {
    expect(sameSet(new Set([60, 64]), new Set([64, 60]))).toBe(true);
    expect(sameSet(new Set([60]), new Set([60, 64]))).toBe(false);
  });

  it('applies alpha to hex and rgb colors', () => {
    expect(withAlpha('#8b5cf6', 0.25)).toBe('rgba(139, 92, 246, 0.25)');
    expect(withAlpha('rgb(1, 2, 3)', 0.5)).toBe('rgba(1, 2, 3, 0.5)');
    expect(withAlpha('var(--x)', 0.5)).toBe('var(--x)');
  });
});
