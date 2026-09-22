import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SearchIndex, SearchSection } from '@/utils/searchIndex';
import {
  buildSearchIndex,
  createTokenizerTools,
  type SearchIndexOptions,
} from '../../.vitepress/search-index';

/**
 * The index generator is driven by five independent factors — locale, URL
 * style, which frontmatter a page declares, where the page sits in the route
 * tree, and what its headings look like. The cases below are a pairwise set
 * over those factors, so every pair of choices is exercised by some page.
 */

type Frontmatter = 'full' | 'title-only' | 'none';
type RouteKind = 'docs' | 'glossary' | 'demo' | 'index';
type Headings = 'unique' | 'duplicate' | 'fenced' | 'none';

type Case = {
  id: number;
  locale: 'en' | 'ja';
  frontmatter: Frontmatter;
  route: RouteKind;
  headings: Headings;
};

const CASES: Case[] = [
  { id: 1, locale: 'en', frontmatter: 'none', route: 'index', headings: 'fenced' },
  { id: 2, locale: 'ja', frontmatter: 'title-only', route: 'index', headings: 'none' },
  { id: 3, locale: 'ja', frontmatter: 'none', route: 'demo', headings: 'unique' },
  { id: 4, locale: 'en', frontmatter: 'full', route: 'glossary', headings: 'duplicate' },
  { id: 5, locale: 'ja', frontmatter: 'full', route: 'glossary', headings: 'none' },
  { id: 6, locale: 'en', frontmatter: 'title-only', route: 'docs', headings: 'unique' },
  { id: 7, locale: 'en', frontmatter: 'title-only', route: 'demo', headings: 'fenced' },
  { id: 8, locale: 'en', frontmatter: 'none', route: 'demo', headings: 'none' },
  { id: 9, locale: 'ja', frontmatter: 'title-only', route: 'glossary', headings: 'duplicate' },
  { id: 10, locale: 'ja', frontmatter: 'title-only', route: 'docs', headings: 'fenced' },
  { id: 11, locale: 'ja', frontmatter: 'full', route: 'glossary', headings: 'fenced' },
  { id: 12, locale: 'en', frontmatter: 'title-only', route: 'demo', headings: 'duplicate' },
  { id: 13, locale: 'ja', frontmatter: 'none', route: 'docs', headings: 'duplicate' },
  { id: 14, locale: 'ja', frontmatter: 'full', route: 'index', headings: 'unique' },
  { id: 15, locale: 'ja', frontmatter: 'none', route: 'glossary', headings: 'fenced' },
  { id: 16, locale: 'en', frontmatter: 'full', route: 'demo', headings: 'duplicate' },
  { id: 17, locale: 'en', frontmatter: 'full', route: 'glossary', headings: 'unique' },
  { id: 18, locale: 'ja', frontmatter: 'full', route: 'docs', headings: 'none' },
  { id: 19, locale: 'ja', frontmatter: 'none', route: 'index', headings: 'duplicate' },
];

/** Prose carrying a term unique to each page, so postings can be checked. */
const EN_PROSE = (id: number) =>
  `The mastering loudness pipeline explains marker${id} across the whole chain.`;
const JA_PROSE = (id: number) =>
  `マスタリングのラウドネスを推定し、marker${id} の値が下がった段を補正します。`;

/** Route below the locale prefix, unique per case. */
function routeFor(item: Case): string {
  switch (item.route) {
    case 'docs':
      return `docs/case-${item.id}`;
    case 'glossary':
      return `docs/glossary/case-${item.id}`;
    case 'demo':
      return `case-${item.id}`;
    case 'index':
      return `section-${item.id}/index`;
  }
}

function headingBlock(item: Case): string {
  switch (item.headings) {
    case 'unique':
      return '## Alpha Section\n\nAlpha prose.\n\n### Beta Section\n\nBeta prose.\n';
    case 'duplicate':
      return '## Repeat\n\nFirst.\n\n## Repeat\n\nSecond.\n';
    case 'fenced':
      return '```md\n## Fenced Heading\n```\n\n## Real Section\n\nReal prose.\n';
    case 'none':
      return '';
  }
}

/** Anchors the page is expected to expose, in document order. */
function expectedAnchors(item: Case): string[] {
  switch (item.headings) {
    case 'unique':
      return ['alpha-section', 'beta-section'];
    case 'duplicate':
      return ['repeat', 'repeat-1'];
    case 'fenced':
      return ['real-section'];
    case 'none':
      return [];
  }
}

function frontmatterBlock(item: Case): string {
  if (item.frontmatter === 'none') return '';
  const lines = [`title: Case ${item.id} Title`];
  if (item.frontmatter === 'full') {
    // A colon inside the value is the shape that a split-on-every-colon reader
    // truncates, and the site's own descriptions contain one.
    lines.push(`description: "Case ${item.id} summary: loudness and true peak"`);
  }
  return `---\n${lines.join('\n')}\n---\n\n`;
}

function pageSource(item: Case): string {
  const prose = item.locale === 'ja' ? JA_PROSE(item.id) : EN_PROSE(item.id);
  const h1 = item.frontmatter === 'none' ? `# Case ${item.id} Heading\n\n` : '';
  return `${frontmatterBlock(item)}${h1}${prose}\n\n${headingBlock(item)}`;
}

function expectedTitle(item: Case): string {
  return item.frontmatter === 'none' ? `Case ${item.id} Heading` : `Case ${item.id} Title`;
}

function expectedSection(item: Case): SearchSection {
  if (item.route === 'glossary') return 'glossary';
  if (item.route === 'docs') return 'doc';
  return 'demo';
}

/** Written out rather than reusing the generator's own route rule. */
function expectedLink(item: Case, cleanUrls: boolean): string {
  const prefix = item.locale === 'en' ? '' : `/${item.locale}`;
  if (item.route === 'index') return `${prefix}/section-${item.id}/`;
  return `${prefix}/${routeFor(item)}${cleanUrls ? '' : '.html'}`;
}

let workspace: string;
let options: SearchIndexOptions;
let indexes: Record<string, Record<'clean' | 'html', SearchIndex>>;

beforeAll(async () => {
  workspace = mkdtempSync(path.join(tmpdir(), 'search-index-'));
  for (const item of CASES) {
    const relative = item.locale === 'en' ? routeFor(item) : `${item.locale}/${routeFor(item)}`;
    const file = path.join(workspace, `${relative}.md`);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, pageSource(item), 'utf8');
  }
  // A search page must never appear in its own results.
  writeFileSync(path.join(workspace, 'search.md'), '---\ntitle: Search\n---\n', 'utf8');

  options = { srcDir: workspace, locales: ['en', 'ja'], defaultLocale: 'en' };
  const { tools, dispose } = await createTokenizerTools(['en', 'ja']);
  try {
    indexes = {
      en: {
        clean: buildSearchIndex({ ...options, cleanUrls: true }, 'en', tools),
        html: buildSearchIndex({ ...options, cleanUrls: false }, 'en', tools),
      },
      ja: {
        clean: buildSearchIndex({ ...options, cleanUrls: true }, 'ja', tools),
        html: buildSearchIndex({ ...options, cleanUrls: false }, 'ja', tools),
      },
    };
  } finally {
    dispose();
  }
}, 60_000);

afterAll(() => {
  rmSync(workspace, { recursive: true, force: true });
});

describe('buildSearchIndex', () => {
  it('splits pages between the root locale and the prefixed one', () => {
    expect(indexes.en.clean.pages).toHaveLength(CASES.filter((c) => c.locale === 'en').length);
    expect(indexes.ja.clean.pages).toHaveLength(CASES.filter((c) => c.locale === 'ja').length);
  });

  it('leaves the search page itself out of the index', () => {
    const titles = indexes.en.clean.pages.map((page) => page.t);
    expect(titles).not.toContain('Search');
  });

  it.each(CASES.map((item) => [`case ${item.id}`, item] as const))('indexes %s', (_name, item) => {
    const clean = indexes[item.locale].clean;
    const html = indexes[item.locale].html;
    const entry = clean.pages.find((page) => page.l === expectedLink(item, true));
    expect(entry, `no entry for ${expectedLink(item, true)}`).toBeDefined();
    if (!entry) return;

    expect(entry.t).toBe(expectedTitle(item));
    expect(entry.s).toBe(expectedSection(item));
    expect(entry.h.map((heading) => heading.a)).toEqual(expectedAnchors(item));

    if (item.frontmatter === 'full') {
      expect(entry.d).toBe(`Case ${item.id} summary: loudness and true peak`);
    } else {
      // Derived from the body, which starts with the page's own prose.
      expect(entry.d).toContain(`marker${item.id}`);
    }

    expect(html.pages.map((page) => page.l)).toContain(expectedLink(item, false));

    const marker = `marker${item.id}`;
    const postings = clean.index[marker];
    expect(postings, `${marker} is not in the index`).toBeDefined();
    expect(postings).toEqual([clean.pages.indexOf(entry)]);
  });

  it('keeps a heading that only exists inside a code fence out of the anchors', () => {
    const anchors = indexes.en.clean.pages.flatMap((page) => page.h.map((heading) => heading.a));
    expect(anchors).not.toContain('fenced-heading');
  });

  it('tokenises Japanese prose into base forms rather than raw substrings', () => {
    // 下がった is indexed under 下がる, so the dictionary form finds the page.
    expect(Object.keys(indexes.ja.clean.index)).toContain('下がる');
    expect(Object.keys(indexes.ja.clean.index)).toContain('マスタリング');
  });

  it('stems English prose so a query can be written in another inflection', () => {
    expect(Object.keys(indexes.en.clean.index)).toContain('master');
    expect(Object.keys(indexes.en.clean.index)).not.toContain('the');
  });
});
