/**
 * Tokenisation rules shared by the build-time index generator and the
 * in-browser query path.
 *
 * Both sides must emit the same token for the same word or a query never
 * matches what was indexed, so the rules live here once rather than being
 * mirrored in two places. The stemmer and the Japanese analyser are passed in
 * rather than imported: the generator resolves them from node_modules while the
 * browser loads them lazily, and neither should be pulled into this module's
 * dependents.
 */

/** Per-entry cap on the keyword list used as a term-frequency surrogate. */
export const MAX_KEYWORDS = 25;

/** Shortest token worth indexing, in characters. */
export const MIN_TOKEN_LENGTH = 2;

/** English Porter stemmer, `stemmer`'s default export. */
export type Stemmer = (word: string) => string;

/** The subset of a suzume morpheme this module reads. */
export type Morpheme = {
  pos: string;
  baseForm: string;
  /** Formal/light noun (こと, もの, ため...) — carries no topical meaning. */
  isFormalNoun?: boolean;
  /** Low-information token suzume already flags as not worth weighting. */
  isLowInfo?: boolean;
};

/** The subset of a suzume instance this module reads. */
export type Analyzer = {
  analyze(text: string): Morpheme[];
};

/** Tokens to index, plus the entry's most frequent terms in surface form. */
export type TokenResult = {
  unique: Set<string>;
  keywords: string[];
};

/**
 * English function words. Dropped from both the index and the query so a
 * search for "the mastering chain" ranks on the two words that carry meaning.
 */
export const EN_STOP_WORDS: ReadonlySet<string> = new Set([
  'about',
  'above',
  'after',
  'again',
  'against',
  'all',
  'also',
  'am',
  'an',
  'and',
  'any',
  'are',
  'as',
  'at',
  'be',
  'because',
  'been',
  'before',
  'being',
  'below',
  'between',
  'both',
  'but',
  'by',
  'can',
  'cannot',
  'could',
  'did',
  'do',
  'does',
  'doing',
  'done',
  'down',
  'during',
  'each',
  'even',
  'few',
  'for',
  'from',
  'further',
  'get',
  'gets',
  'had',
  'has',
  'have',
  'having',
  'he',
  'her',
  'here',
  'hers',
  'herself',
  'him',
  'himself',
  'his',
  'how',
  'however',
  'if',
  'in',
  'into',
  'is',
  'it',
  'its',
  'itself',
  'just',
  'let',
  'like',
  'made',
  'make',
  'many',
  'may',
  'me',
  'might',
  'more',
  'most',
  'much',
  'must',
  'my',
  'myself',
  'need',
  'no',
  'nor',
  'not',
  'now',
  'of',
  'off',
  'on',
  'once',
  'one',
  'only',
  'or',
  'other',
  'others',
  'ought',
  'our',
  'ours',
  'ourselves',
  'out',
  'over',
  'own',
  'per',
  'same',
  'shall',
  'she',
  'should',
  'since',
  'so',
  'some',
  'such',
  'than',
  'that',
  'the',
  'their',
  'theirs',
  'them',
  'themselves',
  'then',
  'there',
  'these',
  'they',
  'this',
  'those',
  'through',
  'to',
  'too',
  'under',
  'until',
  'up',
  'upon',
  'us',
  'use',
  'used',
  'using',
  'very',
  'was',
  'we',
  'were',
  'what',
  'when',
  'where',
  'whether',
  'which',
  'while',
  'who',
  'whom',
  'why',
  'will',
  'with',
  'within',
  'without',
  'would',
  'you',
  'your',
  'yours',
  'yourself',
]);

/** Parts of speech that carry topical meaning in Japanese text. */
export const JA_CONTENT_POS: ReadonlySet<string> = new Set(['NOUN', 'VERB', 'ADJ', 'ADV']);

/** A single CJK ideograph is a real search term even though it is one character. */
const RE_KANJI = /[一-鿿]/;

/** Non-alphanumeric runs separate English words. */
const RE_EN_SEPARATOR = /[^a-zA-Z0-9]+/;

/**
 * English: stem every non-stop word, and keep the shortest surface spelling of
 * each stem as its display form so the keyword list reads as words rather than
 * as stems.
 */
export function tokenizeEnglish(text: string, stem: Stemmer): TokenResult {
  const unique = new Set<string>();
  const freq = new Map<string, { display: string; count: number }>();

  for (const word of text.toLowerCase().split(RE_EN_SEPARATOR)) {
    if (word.length < MIN_TOKEN_LENGTH || EN_STOP_WORDS.has(word)) continue;
    const stemmed = stem(word);
    unique.add(stemmed);

    const seen = freq.get(stemmed);
    if (seen) {
      seen.count += 1;
      if (word.length < seen.display.length) seen.display = word;
    } else {
      freq.set(stemmed, { display: word, count: 1 });
    }
  }

  const keywords = [...freq.values()]
    .filter((entry) => entry.display.length >= 3)
    .sort((a, b) => b.count - a.count)
    .slice(0, MAX_KEYWORDS)
    .map((entry) => entry.display);

  return { unique, keywords };
}

/**
 * Japanese: index the base form of every content-part-of-speech morpheme, so a
 * search for 推定 matches 推定する. Latin morphemes are lowercased to meet the
 * English side of the same index (`WASM` and `wasm` are one token).
 *
 * Keyword extraction asks suzume which nouns are formal or low-information
 * rather than keeping a stop list beside it — a second copy would drift from
 * the analyser's own judgement.
 */
export function tokenizeJapanese(analyzer: Analyzer, text: string): TokenResult {
  const unique = new Set<string>();
  const nounFreq = new Map<string, number>();

  for (const morpheme of analyzer.analyze(text)) {
    const normalized = morpheme.baseForm.toLowerCase();
    const isContent = JA_CONTENT_POS.has(morpheme.pos);

    if (isContent && normalized.length >= MIN_TOKEN_LENGTH) unique.add(normalized);
    if (morpheme.pos === 'NOUN' && normalized.length === 1 && RE_KANJI.test(normalized)) {
      unique.add(normalized);
    }

    const isKeywordNoun =
      morpheme.pos === 'NOUN' &&
      morpheme.baseForm.length >= MIN_TOKEN_LENGTH &&
      !morpheme.isFormalNoun &&
      !morpheme.isLowInfo &&
      !EN_STOP_WORDS.has(normalized);
    if (isKeywordNoun) nounFreq.set(morpheme.baseForm, (nounFreq.get(morpheme.baseForm) ?? 0) + 1);
  }

  const keywords = [...nounFreq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_KEYWORDS)
    .map(([word]) => word);

  return { unique, keywords };
}

/** The analysers a locale needs; only the one its language uses is consulted. */
export type TokenizerTools = {
  stem: Stemmer;
  analyzer?: Analyzer;
};

/**
 * Tokenise for a locale. Japanese needs morphological analysis; every other
 * locale the site carries is written in a space-separated script, so the
 * English path is the general one rather than a special case.
 */
export function tokenizeText(text: string, locale: string, tools: TokenizerTools): TokenResult {
  if (locale === 'ja') {
    if (!tools.analyzer) throw new Error('Japanese tokenisation needs an analyzer');
    return tokenizeJapanese(tools.analyzer, text);
  }
  return tokenizeEnglish(text, tools.stem);
}

/**
 * Tokens a query contributes. Unlike indexing this keeps duplicates out but
 * preserves order, because the ranker treats the last token as the one still
 * being typed.
 */
export function tokenizeQuery(query: string, locale: string, tools: TokenizerTools): string[] {
  const tokens = [...tokenizeText(query, locale, tools).unique];
  if (tokens.length > 0) return tokens;

  // Half-typed input is often classified as something the rules above drop.
  // Fall back to the raw text so prefix expansion still has a stem to grow
  // from — the index keeps katakana and Latin terms verbatim.
  const raw = query.trim().toLowerCase();
  return raw ? [raw] : [];
}
