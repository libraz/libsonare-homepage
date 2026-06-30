import { describe, expect, it } from 'vitest';
import { buildDemoCards, demoCardsCopy } from '@/components/demos/demoCards';

describe('demo card data helpers', () => {
  it('builds localized routes and copy for every demo card', () => {
    const cards = buildDemoCards(demoCardsCopy.en, (path) => `/ja${path}`);

    expect(cards).toHaveLength(9);
    expect(cards[0]).toMatchObject({
      id: 'analyzer',
      path: '/ja/analyzer',
      title: 'Visual Player',
      cta: 'Open demo',
    });
    expect(cards.map((card) => card.id)).toContain('practice');
  });
});
