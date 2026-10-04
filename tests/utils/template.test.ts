import { describe, expect, it } from 'vitest';
import { fill } from '@/utils/template';

describe('fill', () => {
  it('fills known placeholders and leaves unknown and inherited names as written', () => {
    expect(fill('{n} of {total}', { n: 3, total: 8 })).toBe('3 of 8');
    expect(fill('{missing} {constructor}', {})).toBe('{missing} {constructor}');
  });
});
