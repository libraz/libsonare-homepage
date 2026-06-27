import { describe, expect, it } from 'vitest';

describe('test setup browser API mocks', () => {
  it('provides a minimal canvas 2d context in jsdom', () => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    expect(ctx).toBeTruthy();
    expect(ctx?.measureText('abc').width).toBeGreaterThan(0);
    expect(ctx?.getImageData(0, 0, 1, 1).data).toHaveLength(4);
  });
});
