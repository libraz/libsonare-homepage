import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { slugifyHeading } from '../scripts/slugify-heading.mjs';
import {
  type SearchEntry,
  type SearchIndex,
  type SearchSection,
  searchIndexRoute,
} from '../src/utils/searchIndex';
import {
  type Analyzer,
  type Stemmer,
  type TokenizerTools,
  tokenizeText,
} from '../src/utils/searchTokens';

/**
 * Build-time generator for the full-text search index, one JSON file per
 * locale.
 *
 * The site ships an inverted index rather than a search service: every page is
 * tokenised here with the same rules the browser applies to a query, so the two
 * can only agree. Japanese goes through suzume's morphological analysis and
 * every other locale through a Porter stemmer.
 *
 * Each entry also carries its headings and their tokens, which is what lets a
 * hit inside a long page link to the section it matched instead of the top of
 * the page.
 */

export type SearchIndexOptions = {
  /** Absolute path to the content source directory (`src`). */
  srcDir: string;
  /** Whether the site drops the `.html` extension (`siteConfig.cleanUrls`). */
  cleanUrls?: boolean;
  /** Every locale the site carries, default locale included. */
  locales: string[];
  /** The locale served from the site root. */
  defaultLocale: string;
};

/** Files that live next to the content but are not public routes. */
const EXCLUDED_BASENAMES = new Set(['README.md']);

/** Longest description synthesised from a page's opening prose. */
const MAX_DERIVED_DESCRIPTION = 200;

/** Headings deep enough to be a useful link target. */
const RE_HEADING = /^(#{1,3})\s+(.+?)\s*#*\s*$/;

const RE_FENCE = /^\s*(```|~~~)/;

const RE_FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

const RE_QUOTED = /^(["'])([\s\S]*)\1$/;

// ---------------------------------------------------------------------------
// Markdown reading
// ---------------------------------------------------------------------------

/** Split a page into its frontmatter fields and its body. */
function parsePage(raw: string): { data: Record<string, string>; body: string } {
  const matched = raw.match(RE_FRONTMATTER);
  if (!matched) return { data: {}, body: raw };

  const data: Record<string, string> = {};
  for (const line of matched[1].split(/\r?\n/)) {
    // Only top-level scalars are read. Nested blocks (`head:` and its list)
    // are indented, so skipping indented lines skips them wholesale.
    if (!line || /^\s/.test(line)) continue;
    const separator = line.indexOf(':');
    if (separator < 0) continue;
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    if (value) data[key] = unquote(value);
  }
  return { data, body: raw.slice(matched[0].length) };
}

function unquote(value: string): string {
  const quoted = value.match(RE_QUOTED);
  return quoted ? quoted[2] : value;
}

/** Remove the inline markup a heading may carry, leaving its reading text. */
function plainHeading(value: string): string {
  return value
    .replace(/<[^>]*>/g, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .trim();
}

/**
 * Reduce markdown to the prose a reader sees. Code blocks go entirely: an
 * identifier is searchable through the prose that introduces it, and indexing
 * every sample would drown the vocabulary that distinguishes one page from
 * another.
 */
function stripMarkdown(body: string): string {
  return body
    .replace(/^```[\s\S]*?^```/gm, ' ')
    .replace(/^~~~[\s\S]*?^~~~/gm, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]*>/g, ' ')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s{0,3}>\s?/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/^\s*[-*_]{3,}\s*$/gm, ' ')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/\|/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Collect the headings a result can deep-link to, numbering repeats the way
 * the rendered page does so the anchors resolve.
 */
function collectHeadings(body: string): { anchor: string; text: string; level: number }[] {
  const headings: { anchor: string; text: string; level: number }[] = [];
  const used = new Map<string, number>();
  let fence: string | null = null;

  for (const line of body.split(/\r?\n/)) {
    const fenced = line.match(RE_FENCE);
    if (fenced) {
      if (!fence) fence = fenced[1];
      else if (line.trim().startsWith(fence)) fence = null;
      continue;
    }
    if (fence) continue;

    const matched = line.match(RE_HEADING);
    if (!matched) continue;

    const text = plainHeading(matched[2]);
    if (!text) continue;
    const base = slugifyHeading(matched[2]);
    const seen = used.get(base) ?? 0;
    used.set(base, seen + 1);
    headings.push({
      anchor: seen === 0 ? base : `${base}-${seen}`,
      text,
      level: matched[1].length,
    });
  }
  return headings;
}

/** First stretch of prose, for a page that declares no description. */
function deriveDescription(text: string): string {
  if (text.length <= MAX_DERIVED_DESCRIPTION) return text;
  const cut = text.slice(0, MAX_DERIVED_DESCRIPTION);
  const lastSpace = cut.lastIndexOf(' ');
  return `${lastSpace > MAX_DERIVED_DESCRIPTION / 2 ? cut.slice(0, lastSpace) : cut}…`;
}

// ---------------------------------------------------------------------------
// Route discovery
// ---------------------------------------------------------------------------

/** A markdown source file together with the route it becomes. */
type SourcePage = {
  file: string;
  /** Path below the locale prefix, e.g. `docs/introduction`. */
  route: string;
};

function listMarkdown(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) listMarkdown(full, out);
    else if (entry.name.endsWith('.md') && !EXCLUDED_BASENAMES.has(entry.name)) out.push(full);
  }
  return out;
}

/**
 * The markdown a locale owns. The default locale is everything that is not
 * under another locale's directory; every other locale is its own directory.
 */
export function localePages(options: SearchIndexOptions, locale: string): SourcePage[] {
  const { srcDir, defaultLocale, locales } = options;
  const root = locale === defaultLocale ? srcDir : join(srcDir, locale);
  const otherPrefixes = locales.filter((other) => other !== defaultLocale);

  const pages: SourcePage[] = [];
  for (const file of listMarkdown(root)) {
    const route = relative(root, file).split(sep).join('/').replace(/\.md$/, '');
    if (
      locale === defaultLocale &&
      otherPrefixes.some((prefix) => route.startsWith(`${prefix}/`))
    ) {
      continue;
    }
    pages.push({ file, route });
  }
  // Page order decides the index's posting numbers, so it is sorted by route
  // rather than left to the order the filesystem happens to report.
  return pages.sort((a, b) => a.route.localeCompare(b.route));
}

function sectionFor(route: string): SearchSection {
  if (route.startsWith('docs/glossary')) return 'glossary';
  if (route.startsWith('docs/')) return 'doc';
  return 'demo';
}

function routeToLink(
  route: string,
  locale: string,
  defaultLocale: string,
  cleanUrls: boolean,
): string {
  const prefix = locale === defaultLocale ? '' : `/${locale}`;
  if (route === 'index') return `${prefix}/`;
  if (route.endsWith('/index')) return `${prefix}/${route.slice(0, -'index'.length)}`;
  return `${prefix}/${route}${cleanUrls ? '' : '.html'}`;
}

// ---------------------------------------------------------------------------
// Index building
// ---------------------------------------------------------------------------

/**
 * What tokenising one page produced, keyed by the file it came from.
 *
 * Morphological analysis costs roughly 25µs per character, which puts a full
 * Japanese pass in the tens of seconds. Reusing the result for a file that has
 * not been touched keeps a rebuild proportional to the edit rather than to the
 * site.
 */
export type PageCache = Map<
  string,
  { mtimeMs: number; size: number; entry: SearchEntry; tokens: string[] }
>;

/** Tokenise one page, or return what a previous pass made of it. */
function readEntry(
  file: string,
  route: string,
  locale: string,
  tools: TokenizerTools,
  cache: PageCache | undefined,
): { entry: SearchEntry; tokens: string[] } {
  const stats = statSync(file);
  const cached = cache?.get(file);
  if (cached && cached.mtimeMs === stats.mtimeMs && cached.size === stats.size) {
    return { entry: cached.entry, tokens: cached.tokens };
  }

  const { data, body } = parsePage(readFileSync(file, 'utf8'));
  const headings = collectHeadings(body);
  const text = stripMarkdown(body);
  const title = data.title ?? headings.find((heading) => heading.level === 1)?.text ?? route;
  const description = data.description ?? deriveDescription(text);

  const tokenize = (value: string) => tokenizeText(value, locale, tools);
  const full = tokenize(`${title} ${description} ${text}`);

  const entry: SearchEntry = {
    // Filled in by the caller, which knows the locale's route prefix.
    l: '',
    t: title,
    d: description,
    s: sectionFor(route),
    k: full.keywords,
    tt: [...tokenize(title).unique],
    dt: [...tokenize(description).unique],
    h: headings
      .filter((heading) => heading.level > 1)
      .map((heading) => ({
        a: heading.anchor,
        t: heading.text,
        k: [...tokenize(heading.text).unique],
      })),
  };
  const tokens = [...full.unique];
  cache?.set(file, { mtimeMs: stats.mtimeMs, size: stats.size, entry, tokens });
  return { entry, tokens };
}

/** Build one locale's index. `tools` must carry an analyzer for Japanese. */
export function buildSearchIndex(
  options: SearchIndexOptions,
  locale: string,
  tools: TokenizerTools,
  cache?: PageCache,
): SearchIndex {
  const pages: SearchEntry[] = [];
  const inverted = new Map<string, Set<number>>();

  for (const source of localePages(options, locale)) {
    // The search page indexes nothing: it has no prose, and a result linking
    // to the search itself is noise in every query.
    if (source.route === 'search' || source.route.endsWith('/search')) continue;

    const { entry, tokens } = readEntry(source.file, source.route, locale, tools, cache);
    const position = pages.length;
    pages.push({
      ...entry,
      l: routeToLink(source.route, locale, options.defaultLocale, options.cleanUrls === true),
    });

    for (const token of tokens) {
      let postings = inverted.get(token);
      if (!postings) {
        postings = new Set<number>();
        inverted.set(token, postings);
      }
      postings.add(position);
    }
  }

  const index: Record<string, number[]> = {};
  for (const token of [...inverted.keys()].sort()) {
    index[token] = [...(inverted.get(token) as Set<number>)].sort((a, b) => a - b);
  }
  return { pages, index };
}

/** Read a page cache written by an earlier run, discarding an unreadable one. */
export function loadPageCache(cacheFile: string): PageCache {
  try {
    const raw = JSON.parse(readFileSync(cacheFile, 'utf8')) as Record<
      string,
      { mtimeMs: number; size: number; entry: SearchEntry; tokens: string[] }
    >;
    return new Map(Object.entries(raw));
  } catch {
    return new Map();
  }
}

/** Persist a page cache, dropping files that no longer exist. */
export function savePageCache(cacheFile: string, cache: PageCache): void {
  const live = [...cache.entries()].filter(([file]) => existsSync(file));
  mkdirSync(dirname(cacheFile), { recursive: true });
  writeFileSync(cacheFile, JSON.stringify(Object.fromEntries(live)));
}

/** Resolve the stemmer and, when a Japanese index is wanted, suzume. */
export async function createTokenizerTools(locales: string[]): Promise<{
  tools: TokenizerTools;
  dispose: () => void;
}> {
  const { stemmer } = await import('stemmer');
  const stem = stemmer as Stemmer;
  if (!locales.includes('ja')) return { tools: { stem }, dispose: () => {} };

  const { Suzume } = await import('@libraz/suzume');
  const wasmPath = fileURLToPath(import.meta.resolve('@libraz/suzume/wasm'));
  const suzume = await Suzume.create({ wasmPath });
  return {
    tools: { stem, analyzer: suzume as unknown as Analyzer },
    dispose: () => suzume.destroy(),
  };
}

/** Where the per-page token cache lives inside a VitePress cache directory. */
function pageCacheFile(cacheDir: string): string {
  return join(cacheDir, 'search-pages.json');
}

/** Write one index per locale into the build output. */
export async function generateSearchIndexes(
  options: SearchIndexOptions & { outDir: string; cacheDir?: string },
): Promise<void> {
  const { tools, dispose } = await createTokenizerTools(options.locales);
  const cacheFile = options.cacheDir ? pageCacheFile(options.cacheDir) : null;
  const cache = cacheFile ? loadPageCache(cacheFile) : undefined;
  try {
    for (const locale of options.locales) {
      const index = buildSearchIndex(options, locale, tools, cache);
      const file = join(options.outDir, searchIndexRoute(locale).slice(1));
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, JSON.stringify(index));
    }
    if (cacheFile && cache) savePageCache(cacheFile, cache);
  } finally {
    dispose();
  }
}

// ---------------------------------------------------------------------------
// Dev server
// ---------------------------------------------------------------------------

type DevServerLike = {
  config: { vitepress?: { srcDir: string; cleanUrls?: boolean; cacheDir?: string } };
  middlewares: {
    use(handler: (req: { url?: string }, res: DevResponse, next: () => void) => void): void;
  };
};

type DevResponse = {
  setHeader(name: string, value: string): void;
  end(body: string): void;
};

/**
 * Serve the index in `vitepress dev`, where nothing has been written to an
 * output directory yet. Every request rebuilds, which is cheap because the
 * page cache means only the files edited since the last one are re-read.
 */
export function searchIndexDevPlugin(
  options: Pick<SearchIndexOptions, 'locales' | 'defaultLocale'>,
) {
  let pending: Promise<{ tools: TokenizerTools; dispose: () => void }> | null = null;
  let cache: PageCache | null = null;

  return {
    name: 'search-index-dev',
    apply: 'serve' as const,
    configureServer(server: DevServerLike) {
      server.middlewares.use((req, res, next) => {
        const path = (req.url ?? '').split('?')[0];
        const locale = options.locales.find((entry) => path === searchIndexRoute(entry));
        const siteConfig = server.config.vitepress;
        if (!locale || !siteConfig) return next();

        const cacheFile = siteConfig.cacheDir ? pageCacheFile(siteConfig.cacheDir) : null;
        cache ??= cacheFile ? loadPageCache(cacheFile) : new Map();

        pending ??= createTokenizerTools(options.locales);
        void pending.then(({ tools }) => {
          const index = buildSearchIndex(
            {
              srcDir: siteConfig.srcDir,
              cleanUrls: siteConfig.cleanUrls,
              locales: options.locales,
              defaultLocale: options.defaultLocale,
            },
            locale,
            tools,
            cache ?? undefined,
          );
          if (cacheFile && cache) savePageCache(cacheFile, cache);
          res.setHeader('content-type', 'application/json; charset=utf-8');
          res.end(JSON.stringify(index));
        });
      });
    },
  };
}
