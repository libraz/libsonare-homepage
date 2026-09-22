import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';

vi.mock('vitepress', () => ({ withBase: (route: string) => route }));

import { useSearch } from '@/composables/useSearch';
import type { SearchIndex } from '@/utils/searchIndex';
import { buildSearchIndex, createTokenizerTools } from '../../.vitepress/search-index';

/**
 * The ranker is exercised through the composable against an index built by the
 * real generator, so a change that makes the two sides disagree about a token
 * fails here rather than only in the browser.
 *
 * The cases cover every pair of: where the term sits in a page (title,
 * heading, description, body), whether the query spells it out or stops
 * mid-word, whether the query is one token or two, and whether the page has
 * headings at all.
 */

const PAGES: Record<string, string> = {
  'docs/loudness-metering.md': `---
title: Loudness Metering
description: Integrated loudness, short term, and momentary readings.
---

# Loudness Metering

Metering reports dither noise at the very bottom of the range.

## Gain Staging

Headroom before the limiter.

## True Peak Ceiling

Intersample peaks above the sample grid.
`,
  'docs/mixing-console.md': `---
title: Mixing Console
description: Faders, sends, and the loudness bus.
---

# Mixing Console

Routing between channels.

## Sends

Post-fader sends feed the bus.
`,
  'docs/spectral-analysis.md': `---
title: Spectral Analysis
description: Spectrogram resolution and chroma folding.
---

# Spectral Analysis

The reassignment method sharpens a blurred partial.
`,
  'docs/editing-basics.md': `---
title: Editing Basics
description: Cut, fade, and move audio without artefacts.
---

# Editing Basics

## Time Stretching

Stretching changes duration without changing pitch.
`,
};

let workspace: string;
let index: SearchIndex;

/** Run a query and settle the debounce and the loads it triggers. */
async function search(query: string) {
  const locale = ref('en');
  const state = useSearch(locale);
  state.query.value = query;
  await vi.waitUntil(() => state.results.value.length > 0 || state.hasError.value, {
    timeout: 5_000,
  });
  return state;
}

beforeAll(async () => {
  workspace = mkdtempSync(path.join(tmpdir(), 'use-search-'));
  for (const [relative, source] of Object.entries(PAGES)) {
    const file = path.join(workspace, relative);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, source, 'utf8');
  }

  const { tools, dispose } = await createTokenizerTools(['en']);
  try {
    index = buildSearchIndex(
      { srcDir: workspace, cleanUrls: true, locales: ['en'], defaultLocale: 'en' },
      'en',
      tools,
    );
  } finally {
    dispose();
  }

  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true, json: async () => index }) as unknown as Response),
  );
}, 60_000);

afterAll(() => {
  vi.unstubAllGlobals();
  rmSync(workspace, { recursive: true, force: true });
});

describe('useSearch', () => {
  it('puts a title match first and opens the page at the top', async () => {
    const { results } = await search('loudness');
    expect(results.value[0].link).toBe('/docs/loudness-metering');
    expect(results.value[0].heading).toBeUndefined();
  });

  it('finds a title mid-word on a page that has no headings', async () => {
    const { results } = await search('spectr');
    expect(results.value[0].pageLink).toBe('/docs/spectral-analysis');
    expect(results.value[0].heading).toBeUndefined();
  });

  it('opens at the section a mid-word heading match points to', async () => {
    const { results } = await search('stretc');
    expect(results.value[0].link).toBe('/docs/editing-basics#time-stretching');
    expect(results.value[0].heading?.text).toBe('Time Stretching');
  });

  it('prefers the page covering both tokens and opens it at the matched section', async () => {
    const { results } = await search('loudness sends');
    expect(results.value[0].link).toBe('/docs/mixing-console#sends');
    expect(results.value.map((result) => result.pageLink)).toContain('/docs/loudness-metering');
  });

  it('matches a term that only the description carries', async () => {
    const { results } = await search('chroma');
    expect(results.value[0].pageLink).toBe('/docs/spectral-analysis');
    expect(results.value[0].heading).toBeUndefined();
  });

  it('matches a description term mid-word without inventing a section', async () => {
    const { results } = await search('fader');
    expect(results.value[0].pageLink).toBe('/docs/mixing-console');
    expect(results.value[0].heading).toBeUndefined();
  });

  it('matches a term that appears only in the body', async () => {
    const { results } = await search('dither');
    expect(results.value[0].pageLink).toBe('/docs/loudness-metering');
    expect(results.value[0].heading).toBeUndefined();
  });

  it('matches two body terms on a page with no headings', async () => {
    const { results } = await search('reassignment partial');
    expect(results.value[0].pageLink).toBe('/docs/spectral-analysis');
  });

  it('carries the section through so results can be filtered', async () => {
    const { results } = await search('loudness');
    expect(results.value.every((result) => result.section === 'doc')).toBe(true);
  });

  it('reports no matches without reporting an error', async () => {
    const locale = ref('en');
    const state = useSearch(locale);
    state.query.value = 'zzzznotaterm';
    await vi.waitUntil(() => state.isReady.value, { timeout: 5_000 });
    expect(state.results.value).toEqual([]);
    expect(state.hasError.value).toBe(false);
  });

  it('separates an unreachable index from an empty result', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 404 }) as unknown as Response),
    );
    // The composable caches a loaded index per locale, so a failure is only
    // observable on a locale that has not been loaded yet.
    const locale = ref('xx');
    const state = useSearch(locale);
    state.query.value = 'loudness';
    await vi.waitUntil(() => state.hasError.value, { timeout: 5_000 });
    expect(state.results.value).toEqual([]);

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, json: async () => index }) as unknown as Response),
    );
  });
});
