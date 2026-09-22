#!/usr/bin/env node
/**
 * Gate: bilingual doc prose uses the canonical spelling for terms that split
 * across the corpus (e.g. デフォルト vs 既定値, real-time vs Realtime).
 *
 * Rules live in terms.json, one entry per term family:
 *  - `correct`: the canonical spelling, or `null` when the split is genuinely
 *    unresolved. A null-correct entry is reported separately as "unresolved"
 *    and never fails the build — that is the difference between a decided
 *    rule and one still awaiting a style call.
 *  - `forbidden`: spellings to flag. An empty array is valid and matches
 *    nothing; it is how a guard entry (a term that is correct in a narrow
 *    context, recorded so a future ban does not fire there) or a placeholder
 *    entry (rule pending a name that does not exist yet) is represented.
 *  - `reason`: required and non-empty. An entry without one fails the gate,
 *    the same way an unjustified allow-list entry would.
 *  - `locale`: which doc tree(s) the entry applies to (`ja`, `en`, `both`).
 *  - `exceptions`: repo-relative file paths or directory prefixes exempted
 *    from every forbidden spelling in the entry.
 *
 * Matching skips fenced code blocks, inline code spans, HTML comments, and
 * link/image URLs, so an identifier or a path never trips a prose rule. It
 * also skips a reading gloss — the canonical spelling followed by the variant
 * in parentheses — which introduces a term rather than competing with it.
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const DEFAULT_TERMS_PATH = 'scripts/terms.json';

const CODE_FENCE = /^(`{3,}|~{3,}).*$[\s\S]*?^\1\s*$/gm;
const HTML_COMMENT = /<!--[\s\S]*?-->/g;
const INLINE_CODE = /`[^`\n]+`/g;
const LINK_URL = /\]\(([^)\n]*)\)/g;
const AUTOLINK = /<https?:\/\/[^>\n]*>/g;
const REFERENCE_LINK_DEFINITION = /^(\s*\[[^\]\n]+\]:\s*)(\S+)/gm;

/** Replaces every non-newline character with a space, keeping line numbers stable. */
function blank(str) {
  return str.replace(/[^\n]/g, ' ');
}

/**
 * Masks the markdown regions a prose term rule must not see: fenced code
 * blocks, inline code spans, HTML comments, and link/image URLs. Line
 * structure is preserved so reported line numbers stay accurate.
 */
export function maskNonProse(content) {
  return content
    .replace(CODE_FENCE, blank)
    .replace(HTML_COMMENT, blank)
    .replace(INLINE_CODE, blank)
    .replace(LINK_URL, (_match, url) => `](${blank(url)})`)
    .replace(AUTOLINK, blank)
    .replace(REFERENCE_LINK_DEFINITION, (_match, prefix, url) => prefix + blank(url));
}

/** Escapes a literal for embedding in a RegExp source. */
function escapeRegExp(literal) {
  return literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Masks a reading gloss: the canonical spelling immediately followed by the
 * variant in parentheses, as in `True Peak（トゥルーピーク）`.
 *
 * A gloss is not a competing spelling — it introduces the canonical term to a
 * reader meeting it for the first time, and the page then uses the canonical
 * form throughout. Flagging it would leave a page no way to introduce an
 * English term to a Japanese reader except by dropping the reading, which is
 * the opposite of what the rule is for.
 */
export function maskGloss(line, correct, term) {
  if (typeof correct !== 'string' || correct.length === 0) return line;
  const pattern = new RegExp(
    `${escapeRegExp(correct)}\\s*[（(]\\s*${escapeRegExp(term)}\\s*[）)]`,
    'g',
  );
  return line.replace(pattern, blank);
}

/** True when `relPath` exactly matches, or falls under, one of `exceptions`. */
export function pathMatchesException(relPath, exceptions) {
  return exceptions.some((exception) => {
    if (relPath === exception) return true;
    const prefix = exception.endsWith('/') ? exception : `${exception}/`;
    return relPath.startsWith(prefix);
  });
}

function listMarkdownFiles(dir, base = dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listMarkdownFiles(full, base));
    else if (entry.isFile() && entry.name.endsWith('.md')) out.push(path.relative(base, full));
  }
  return out;
}

function listTopLevelMarkdownFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
    .map((entry) => entry.name);
}

/** Every doc page under `root`, tagged with the locale a term rule matches it by. */
export function collectDocFiles(root) {
  const files = [];
  for (const [locale, docsDir, pagesDir] of [
    ['en', 'src/docs', 'src'],
    ['ja', 'src/ja/docs', 'src/ja'],
  ]) {
    for (const rel of listMarkdownFiles(path.join(root, docsDir))) {
      files.push({ locale, relPath: path.join(docsDir, rel) });
    }
    for (const name of listTopLevelMarkdownFiles(path.join(root, pagesDir))) {
      files.push({ locale, relPath: path.join(pagesDir, name) });
    }
  }
  return files.sort((a, b) => a.relPath.localeCompare(b.relPath));
}

/** Returns a failure message when `entry` has no usable reason, else `null`. */
export function validateReason(entry, index) {
  if (typeof entry.reason === 'string' && entry.reason.trim().length > 0) return null;
  return `${DEFAULT_TERMS_PATH}: entry ${index} (correct=${JSON.stringify(entry.correct)}) is missing a required reason`;
}

export function checkTerms({
  root = process.cwd(),
  termsPath = path.join(root, DEFAULT_TERMS_PATH),
} = {}) {
  const failures = [];
  const unresolved = [];

  let entries;
  try {
    entries = JSON.parse(fs.readFileSync(termsPath, 'utf8'));
  } catch (error) {
    failures.push(`${DEFAULT_TERMS_PATH}: failed to parse - ${error.message}`);
    return { failures, unresolved };
  }
  if (!Array.isArray(entries)) {
    failures.push(`${DEFAULT_TERMS_PATH}: must be a JSON array of entries`);
    return { failures, unresolved };
  }

  const docFiles = collectDocFiles(root);
  const maskedLinesCache = new Map();
  function maskedLinesFor(relPath) {
    if (!maskedLinesCache.has(relPath)) {
      const content = fs.readFileSync(path.join(root, relPath), 'utf8');
      maskedLinesCache.set(relPath, maskNonProse(content).split('\n'));
    }
    return maskedLinesCache.get(relPath);
  }

  entries.forEach((entry, index) => {
    const reasonFailure = validateReason(entry, index);
    if (reasonFailure) {
      failures.push(reasonFailure);
      return;
    }

    const forbidden = Array.isArray(entry.forbidden) ? entry.forbidden : [];
    if (forbidden.length === 0) return;

    const exceptions = Array.isArray(entry.exceptions) ? entry.exceptions : [];
    const expected = entry.correct === null ? 'undecided' : entry.correct;
    for (const file of docFiles) {
      if (entry.locale !== 'both' && file.locale !== entry.locale) continue;
      if (pathMatchesException(file.relPath, exceptions)) continue;

      const lines = maskedLinesFor(file.relPath);
      lines.forEach((rawLine, lineIndex) => {
        for (const term of forbidden) {
          const line = maskGloss(rawLine, entry.correct, term);
          if (!line.includes(term)) continue;
          const message = `${file.relPath}:${lineIndex + 1} uses "${term}", expected "${expected}"`;
          if (entry.correct === null) unresolved.push(message);
          else failures.push(message);
        }
      });
    }
  });

  return { failures, unresolved };
}

/**
 * The shape of a hardware model designation: a short letter cluster bound to a
 * number, hyphenated or not. The same structural test the demo runtime and the
 * data generator apply to engine-supplied strings — those guards only see what
 * the engine hands to a screen, so the prose beside them is swept here.
 *
 * The letter cluster must carry a capital, which is what separates a product
 * name from ordinary hyphenated prose ("first-10", "up-to-16").
 */
const DESIGNATION_SHAPE =
  /\b([A-Za-z]{2,5})-(\d{2,5}[A-Za-z]{0,3})\b|\b([A-Za-z]{2,5})(\d{3,5}[A-Za-z]{0,3})\b/g;

/**
 * Clusters that take the designation shape without naming a machine, each with
 * the reason it is not one. A standard, an algorithm and a language edition are
 * all named this way, and the docs have to be able to cite them.
 */
const NOT_A_DESIGNATION = {
  'DAFx-19': 'conference proceedings the dispersion filter design is cited from',
  'SHA-256': 'the hash the build pins artifacts with',
  'Bank-128': 'a MIDI bank number, written out in prose',
  ES2017: 'the ECMAScript edition a browser requirement is stated against',
};

/**
 * Sweeps doc prose for anything shaped like a hardware model designation.
 *
 * A designation the engine returns is rewritten before it reaches a screen, but
 * nothing stops one being typed into a sentence, and a guarded demo beside a
 * page that spells the name out is not guarded. The check is structural rather
 * than a list of names, since a list would spell out exactly what it excludes.
 */
export function checkDesignations({ root = process.cwd() } = {}) {
  const failures = [];
  for (const file of collectDocFiles(root)) {
    const content = fs.readFileSync(path.join(root, file.relPath), 'utf8');
    maskNonProse(content)
      .split('\n')
      .forEach((line, lineIndex) => {
        for (const match of line.matchAll(DESIGNATION_SHAPE)) {
          const cluster = match[1] ?? match[3];
          if (!/[A-Z]/.test(cluster)) continue;
          if (Object.hasOwn(NOT_A_DESIGNATION, match[0])) continue;
          failures.push(
            `${file.relPath}:${lineIndex + 1} reads as a model designation: "${match[0]}"`,
          );
        }
      });
  }
  return failures;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { failures, unresolved } = checkTerms();
  failures.push(...checkDesignations());

  if (unresolved.length > 0) {
    console.log('unresolved terms (not fatal):');
    for (const item of unresolved) console.log(`- ${item}`);
  }

  if (failures.length > 0) {
    console.error('terminology check failed:');
    for (const failure of failures) console.error(`- ${failure}`);
    process.exit(1);
  }
  console.log('terminology check passed');
}
