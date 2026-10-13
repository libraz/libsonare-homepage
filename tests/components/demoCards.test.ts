import { describe, expect, it } from 'vitest';
import { buildDemoCards, demoCardsCopy } from '@/components/demo-cards/demoCards';
import { LISTED_DEMOS } from '@/demos/manifest';

describe('demo card data helpers', () => {
  it('builds localized routes and copy for every demo card', () => {
    const cards = buildDemoCards(demoCardsCopy.en, (path) => `/ja${path}`);

    expect(cards).toHaveLength(LISTED_DEMOS.length);
    expect(cards[0]).toMatchObject({
      id: 'mastering',
      path: '/ja/mastering',
      title: 'Mastering Studio',
      cta: 'Open demo',
    });
    expect(cards.map((card) => card.id)).toContain('practice');
  });
});
