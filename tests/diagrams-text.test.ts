import { describe, expect, it } from 'vitest';
import { wrapLabel } from '../.vitepress/theme/components/diagrams/text';

describe('wrapLabel', () => {
  it('breaks a camelCase API name at its word seam nearest the middle', () => {
    expect(wrapLabel('roomGeometryFromEstimate', 120, 11, true)).toEqual([
      'roomGeometry',
      'FromEstimate',
    ]);
  });

  it('keeps a lowercase word with no seam on one line', () => {
    expect(wrapLabel('synthesizerinputchannel', 60, 11, true)).toEqual(['synthesizerinputchannel']);
  });
});
