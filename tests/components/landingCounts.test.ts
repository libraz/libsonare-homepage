// @vitest-environment node
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { LISTED_DEMOS } from '@/demos/manifest';

/**
 * The landing heading counted the demo cards in words — "Nine demos" — and two
 * demos were added under it without the sentence moving, so the page told a
 * visitor a number the grid below it contradicted. The copy now carries a
 * placeholder the layout fills from the manifest; this keeps it that way.
 */

const source = fs.readFileSync(
  path.join(process.cwd(), '.vitepress/theme/LandingLayout.vue'),
  'utf8',
);

/** Every `heading:` line inside a `demoSection:` block, one per locale. */
function demoSectionHeadings(): string[] {
  return [...source.matchAll(/demoSection:\s*\{[\s\S]*?heading:\s*'([^']*)'/g)].map(
    (match) => match[1],
  );
}

describe('the landing demo section', () => {
  it('has one heading per locale', () => {
    const headings = demoSectionHeadings();
    expect(headings.length).toBeGreaterThanOrEqual(2);
  });

  it('takes its count from the manifest rather than spelling one out', () => {
    for (const heading of demoSectionHeadings()) {
      // Requiring the placeholder is the whole guard: a heading that spells the
      // count out, in digits or in words, has to drop `{count}` to do it.
      expect(heading, `"${heading}" should interpolate the count`).toContain('{count}');
      expect(heading, `"${heading}" writes a number that will go stale`).not.toMatch(/\d/);
    }
  });

  it('counts demos a visitor can open', () => {
    expect(LISTED_DEMOS.length).toBeGreaterThan(0);
    for (const demo of LISTED_DEMOS) expect(demo.route).toMatch(/^\//);
  });
});
