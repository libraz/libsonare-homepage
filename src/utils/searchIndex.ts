/**
 * Wire format of the search index.
 *
 * The generator in `.vitepress/search-index.ts` writes it and the browser
 * reads it, so the shape lives in `src/` where both can import it without the
 * client pulling in anything from the build side.
 */

/** Which part of the site a page belongs to, used for the result filters. */
export type SearchSection = 'doc' | 'glossary' | 'demo';

/** Every section a result can be filtered to, in the order the tabs show. */
export const SEARCH_SECTIONS: readonly SearchSection[] = ['doc', 'glossary', 'demo'];

/** One heading in a page: its anchor, its display text, and its tokens. */
export type SearchHeading = {
  a: string;
  t: string;
  k: string[];
};

/** One indexed page. Field names are short because they repeat per page. */
export type SearchEntry = {
  /** Route, already carrying `.html` when the site does not use clean URLs. */
  l: string;
  /** Page title. */
  t: string;
  /** Page description, shown under the title in a result. */
  d: string;
  /** Section the page belongs to. */
  s: SearchSection;
  /** Most frequent terms, used as a term-frequency surrogate by the ranker. */
  k: string[];
  /** Tokens of the title, so a headline hit can outrank one buried in prose. */
  tt: string[];
  /** Tokens of the description. */
  dt: string[];
  /** Headings, in document order. */
  h: SearchHeading[];
};

/** The artifact served at `/search-index-<locale>.json`. */
export type SearchIndex = {
  pages: SearchEntry[];
  /** Token to the indices of the pages containing it, ascending. */
  index: Record<string, number[]>;
};

/** Route the index for a locale is served from. */
export function searchIndexRoute(locale: string): string {
  return `/search-index-${locale}.json`;
}
