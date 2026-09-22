import { withBase } from 'vitepress';
import { type Ref, ref, watch } from 'vue';
import {
  type SearchEntry,
  type SearchIndex,
  type SearchSection,
  searchIndexRoute,
} from '@/utils/searchIndex';
import {
  type Analyzer,
  type Stemmer,
  type TokenizerTools,
  tokenizeQuery,
} from '@/utils/searchTokens';

/**
 * In-browser query side of the full-text search.
 *
 * The index holds whole tokens, so the query is tokenised with the same rules
 * the generator used and then scored with a TF-IDF variant: rarer terms count
 * for more, a hit in a title or a heading counts for more than one in prose,
 * and a page matching every term of the query beats one matching half of them.
 * The last term is treated as still being typed and is allowed to match by
 * prefix, which is what makes results appear before a word is finished.
 *
 * Nothing is loaded until the reader types: suzume's WebAssembly, the stemmer
 * and the index itself are all fetched on the first query and then cached for
 * the session.
 */

/** A page the query matched, ranked. */
export type SearchResult = {
  /** Where the result navigates, including the section anchor when there is one. */
  link: string;
  /** The page itself, without an anchor. */
  pageLink: string;
  title: string;
  description: string;
  section: SearchSection;
  /** The section the query matched, when it is not simply the whole page. */
  heading?: { anchor: string; text: string };
  score: number;
};

/** A term in a title outranks the same term in prose. */
const TITLE_BOOST = 3;
/** A section heading is nearly as strong a signal as the page title. */
const HEADING_BOOST = 2.2;
/** The description is the page's own summary of itself. */
const DESC_BOOST = 1.7;
/** The term is among the page's most frequent, standing in for term frequency. */
const KEYWORD_BOOST = 1.6;
/** A completion of what was typed counts for less than the word itself. */
const PREFIX_WEIGHT = 0.55;
/** Ceiling on how far one prefix may expand. */
const MAX_PREFIX_TERMS = 16;
/** Keystrokes settle before a query runs. */
const DEBOUNCE_MS = 180;

type LocaleCache = {
  index?: SearchIndex;
  /** `Object.keys(index.index)`, scanned on every keystroke for prefixes. */
  terms?: string[];
  keywordSets?: Set<string>[];
  headingSets?: Set<string>[];
};

const caches = new Map<string, LocaleCache>();
let stemmerPromise: Promise<Stemmer> | null = null;
let analyzerPromise: Promise<Analyzer> | null = null;

function cacheFor(locale: string): LocaleCache {
  let cache = caches.get(locale);
  if (!cache) {
    cache = {};
    caches.set(locale, cache);
  }
  return cache;
}

async function loadStemmer(): Promise<Stemmer> {
  stemmerPromise ??= import('stemmer').then(({ stemmer }) => stemmer as Stemmer);
  return stemmerPromise;
}

async function loadAnalyzer(): Promise<Analyzer> {
  analyzerPromise ??= (async () => {
    const [{ Suzume }, { default: wasmPath }] = await Promise.all([
      import('@libraz/suzume'),
      // Vite resolves this to the hashed asset URL the WebAssembly is served from.
      import('@libraz/suzume/wasm?url'),
    ]);
    return (await Suzume.create({ wasmPath })) as unknown as Analyzer;
  })();
  return analyzerPromise;
}

async function loadTokenizerTools(locale: string): Promise<TokenizerTools> {
  const stem = await loadStemmer();
  if (locale !== 'ja') return { stem };
  return { stem, analyzer: await loadAnalyzer() };
}

async function loadIndex(locale: string): Promise<SearchIndex> {
  const cache = cacheFor(locale);
  if (cache.index) return cache.index;

  const response = await fetch(withBase(searchIndexRoute(locale)));
  if (!response.ok) throw new Error(`Search index unavailable: ${response.status}`);
  const index = (await response.json()) as SearchIndex;
  cache.index = index;
  cache.terms = Object.keys(index.index);
  return index;
}

/**
 * The index carries no term frequencies, so each page's most frequent terms
 * stand in for them. They are stored in surface form and have to be normalised
 * into the same space as the index keys before they can be compared.
 */
async function loadKeywordSets(locale: string, index: SearchIndex): Promise<Set<string>[]> {
  const cache = cacheFor(locale);
  if (cache.keywordSets) return cache.keywordSets;

  const normalize = locale === 'ja' ? (word: string) => word.toLowerCase() : await loadStemmer();
  cache.keywordSets = index.pages.map((page) => new Set(page.k.map(normalize)));
  return cache.keywordSets;
}

/** Every heading token of a page, flattened, for the field boost. */
function loadHeadingSets(locale: string, index: SearchIndex): Set<string>[] {
  const cache = cacheFor(locale);
  cache.headingSets ??= index.pages.map((page) => new Set(page.h.flatMap((heading) => heading.k)));
  return cache.headingSets;
}

type Expansion = {
  term: string;
  postings: number[];
  weight: number;
};

/**
 * The postings a query token reaches: the token itself, plus the shortest
 * indexed terms it is a prefix of. The shortest completions come first because
 * they are the likeliest reading of a half-typed word.
 */
function expand(
  index: SearchIndex,
  terms: string[],
  token: string,
  allowPrefix: boolean,
): Expansion[] {
  const out: Expansion[] = [];
  const exact = index.index[token];
  if (exact) out.push({ term: token, postings: exact, weight: 1 });
  if (!allowPrefix) return out;

  const prefixed = terms.filter((term) => term.length > token.length && term.startsWith(token));
  prefixed.sort((a, b) => a.length - b.length || (a < b ? -1 : 1));
  for (const term of prefixed.slice(0, MAX_PREFIX_TERMS)) {
    out.push({ term, postings: index.index[term], weight: PREFIX_WEIGHT });
  }
  return out;
}

/** How many of the query's tokens a set of page tokens answers. */
function coverage(tokens: string[], reached: string[][]): number {
  return reached.filter((alternatives) => alternatives.some((term) => tokens.includes(term)))
    .length;
}

/**
 * The section a result should open at: the heading answering the most of the
 * query, but only when it is a better answer than the page as a whole. A page
 * whose title already covers the query opens at the top.
 *
 * Matching is against the terms each query token actually reached rather than
 * the token itself, so a half-typed word points at the same section the
 * finished one would.
 */
function bestHeading(page: SearchEntry, reached: string[][]): SearchEntry['h'][number] | null {
  let best: SearchEntry['h'][number] | null = null;
  let bestMatches = coverage(page.tt, reached);

  for (const heading of page.h) {
    const matches = coverage(heading.k, reached);
    if (matches > bestMatches) {
      best = heading;
      bestMatches = matches;
    }
  }
  return best;
}

function rank(
  index: SearchIndex,
  terms: string[],
  keywordSets: Set<string>[],
  headingSets: Set<string>[],
  queryTokens: string[],
): SearchResult[] {
  const total = index.pages.length;
  if (queryTokens.length === 0 || total === 0) return [];

  // Page index to its best score for each query token.
  const perToken = new Map<number, number[]>();
  // The indexed terms each query token reached, in query order.
  const reached: string[][] = queryTokens.map(() => []);

  queryTokens.forEach((token, position) => {
    // The last token is the one still being typed, so it always expands; the
    // earlier ones fall back to prefixes only when nothing matched exactly.
    const isLast = position === queryTokens.length - 1;
    const exact = index.index[token];
    // A completion must never outscore the word actually typed.
    const cap = exact ? Math.log(1 + total / exact.length) : Number.POSITIVE_INFINITY;

    for (const { term, postings, weight } of expand(index, terms, token, isLast || !exact)) {
      reached[position].push(term);
      const idf = Math.min(Math.log(1 + total / postings.length), cap);
      for (const page of postings) {
        const entry = index.pages[page];
        const field = entry.tt.includes(term)
          ? TITLE_BOOST
          : headingSets[page]?.has(term)
            ? HEADING_BOOST
            : entry.dt.includes(term)
              ? DESC_BOOST
              : 1;
        const frequent = keywordSets[page]?.has(term) ? KEYWORD_BOOST : 1;
        const score = idf * weight * field * frequent;

        let row = perToken.get(page);
        if (!row) {
          row = new Array(queryTokens.length).fill(0);
          perToken.set(page, row);
        }
        // Best, not sum: one token cannot out-shout the rest of the query.
        if (score > row[position]) row[position] = score;
      }
    }
  });

  const scored: { page: number; score: number }[] = [];
  for (const [page, row] of perToken) {
    let sum = 0;
    let matched = 0;
    for (const score of row) {
      if (score > 0) {
        sum += score;
        matched += 1;
      }
    }
    // Coverage: a page matching every token outranks one matching half.
    scored.push({ page, score: sum * (matched / row.length) ** 2 });
  }
  scored.sort((a, b) => b.score - a.score || a.page - b.page);

  return scored.map(({ page, score }) => {
    const entry = index.pages[page];
    const heading = bestHeading(entry, reached);
    return {
      link: heading ? `${entry.l}#${heading.a}` : entry.l,
      pageLink: entry.l,
      title: entry.t,
      description: entry.d,
      section: entry.s,
      heading: heading ? { anchor: heading.a, text: heading.t } : undefined,
      score,
    };
  });
}

/**
 * Reactive search bound to a locale. `hasError` is kept apart from an empty
 * result list: a query that found nothing and a query that could not run read
 * very differently to whoever typed it.
 */
export function useSearch(locale: Ref<string>) {
  const query = ref('');
  const results = ref<SearchResult[]>([]);
  const isLoading = ref(false);
  const isReady = ref(false);
  const hasError = ref(false);
  let debounce: ReturnType<typeof setTimeout> | null = null;

  async function run(value: string) {
    if (!value.trim()) {
      results.value = [];
      return;
    }
    isLoading.value = true;
    hasError.value = false;
    try {
      const current = locale.value;
      const index = await loadIndex(current);
      const tools = await loadTokenizerTools(current);
      const tokens = tokenizeQuery(value, current, tools);
      const keywordSets = await loadKeywordSets(current, index);
      const headingSets = loadHeadingSets(current, index);
      isReady.value = true;

      // The locale can change while the WebAssembly loads; a stale run would
      // overwrite the newer locale's results with the old language's.
      if (locale.value !== current || query.value !== value) return;
      results.value = rank(index, cacheFor(current).terms ?? [], keywordSets, headingSets, tokens);
    } catch (error) {
      console.error('Search failed:', error);
      hasError.value = true;
      results.value = [];
    } finally {
      isLoading.value = false;
    }
  }

  watch(query, (value) => {
    if (debounce) clearTimeout(debounce);
    if (!value.trim()) {
      results.value = [];
      hasError.value = false;
      return;
    }
    debounce = setTimeout(() => run(value), DEBOUNCE_MS);
  });

  watch(locale, () => {
    if (query.value.trim()) run(query.value);
  });

  return { query, results, isLoading, isReady, hasError };
}
