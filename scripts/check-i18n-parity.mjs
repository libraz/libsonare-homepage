#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const I18N_TODO_MARKER = 'TODO(i18n): Translate this scaffolded page.';

export function checkI18nParity({
  root = process.cwd(),
  localesDir = path.join(root, 'src/locales'),
  defaultLocale = 'en',
} = {}) {
  const locales = readLocales(localesDir);
  const defaultMessages = locales.get(defaultLocale);
  const failures = [];

  if (!defaultMessages) {
    failures.push(`locales: missing default locale ${defaultLocale}`);
    return failures;
  }

  for (const [locale, messages] of [...locales.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    checkLocaleLeafValues(failures, locale, messages);
    if (locale === defaultLocale) continue;
    compareKeySets(failures, 'locales', defaultLocale, locale, defaultMessages, messages);
  }

  checkLiteralLocaleUsage({ root, defaultLocale: defaultMessages, failures });
  checkScaffoldedTranslationTodos({ root, failures });

  for (const locale of [...locales.keys()].sort()) {
    if (locale === defaultLocale) continue;
    compareMirroredMarkdown(
      failures,
      'docs',
      defaultLocale,
      locale,
      path.join(root, 'src/docs'),
      path.join(root, 'src', locale, 'docs'),
    );
  }

  return failures;
}

export function readLocales(localesDir) {
  const locales = new Map();
  if (!fs.existsSync(localesDir)) return locales;

  for (const entry of fs.readdirSync(localesDir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
    const locale = path.basename(entry.name, '.json');
    const fullPath = path.join(localesDir, entry.name);
    locales.set(locale, JSON.parse(fs.readFileSync(fullPath, 'utf8')));
  }

  return locales;
}

export function flattenKeys(value, prefix = '') {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return Object.entries(value).flatMap(([key, child]) =>
      flattenKeys(child, prefix ? `${prefix}.${key}` : key),
    );
  }
  return [prefix];
}

export function checkLocaleLeafValues(failures, locale, value, prefix = '') {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const [key, child] of Object.entries(value)) {
      checkLocaleLeafValues(failures, locale, child, prefix ? `${prefix}.${key}` : key);
    }
    return;
  }

  if (typeof value !== 'string') {
    failures.push(`locales: ${locale} key ${prefix} must be a string`);
    return;
  }

  if (value.trim().length === 0) {
    failures.push(`locales: ${locale} key ${prefix} is empty`);
  }
}

function compareKeySets(failures, name, leftName, rightName, left, right) {
  const leftKeys = new Set(flattenKeys(left));
  const rightKeys = new Set(flattenKeys(right));

  for (const key of [...leftKeys].sort()) {
    if (!rightKeys.has(key)) failures.push(`${name}: ${rightName} missing key ${key}`);
  }
  for (const key of [...rightKeys].sort()) {
    if (!leftKeys.has(key)) failures.push(`${name}: ${leftName} missing key ${key}`);
  }
}

export function listMarkdownFiles(dir, baseDir = dir) {
  if (!fs.existsSync(dir)) return [];

  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...listMarkdownFiles(fullPath, baseDir));
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      out.push(path.relative(baseDir, fullPath));
    }
  }
  return out.sort();
}

function compareMirroredMarkdown(failures, label, leftName, rightName, enDir, localizedDir) {
  const enFiles = new Set(listMarkdownFiles(enDir));
  const localizedFiles = new Set(listMarkdownFiles(localizedDir));

  for (const file of [...enFiles].sort()) {
    if (!localizedFiles.has(file)) failures.push(`${label}: ${rightName} missing ${file}`);
  }
  for (const file of [...localizedFiles].sort()) {
    if (!enFiles.has(file)) failures.push(`${label}: ${leftName} missing ${file}`);
  }

  for (const file of [...enFiles].sort()) {
    if (!localizedFiles.has(file)) continue;
    compareMarkdownStructure(
      failures,
      `${label}: ${file}`,
      readMarkdownStructure(path.join(enDir, file)),
      readMarkdownStructure(path.join(localizedDir, file)),
    );
  }
}

/**
 * The structural skeleton a translation must reproduce. Prose belongs to the
 * translator, but a heading, a fenced block, a table or a component present on one
 * side and absent on the other means the two pages no longer say the same things.
 */
export function readMarkdownStructure(file) {
  const headings = [];
  const components = [];
  let fences = 0;
  let tables = 0;
  let insideFence = false;

  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    if (/^\s*(```|~~~)/.test(line)) {
      insideFence = !insideFence;
      fences += 1;
      continue;
    }
    if (insideFence) continue;

    const heading = line.match(/^(#{1,6})\s/);
    if (heading) headings.push(heading[1].length);
    // A separator row is the one part of a markdown table that cannot be translated away.
    if (/^\s*\|[-: |]+\|\s*$/.test(line)) tables += 1;
    for (const match of line.matchAll(/<([A-Z][A-Za-z0-9]*)/g)) components.push(match[1]);
    const container = line.match(/^:::\s*(\w+)/);
    if (container) components.push(`:${container[1]}`);
  }

  return { headings, fences, tables, components };
}

export function compareMarkdownStructure(failures, name, left, right) {
  if (left.headings.length !== right.headings.length) {
    failures.push(`${name}: heading count ${left.headings.length} vs ${right.headings.length}`);
  } else if (left.headings.join(',') !== right.headings.join(',')) {
    failures.push(`${name}: heading levels differ`);
  }
  if (left.fences !== right.fences) {
    failures.push(`${name}: code fence count ${left.fences} vs ${right.fences}`);
  }
  if (left.tables !== right.tables) {
    failures.push(`${name}: table count ${left.tables} vs ${right.tables}`);
  }
  if (left.components.join(',') !== right.components.join(',')) {
    failures.push(
      `${name}: components [${left.components.join(' ')}] vs [${right.components.join(' ')}]`,
    );
  }
}

export function checkScaffoldedTranslationTodos({ root, failures }) {
  const srcDir = path.join(root, 'src');
  for (const file of listMarkdownFiles(srcDir, srcDir)) {
    const fullPath = path.join(srcDir, file);
    const content = fs.readFileSync(fullPath, 'utf8');
    if (content.includes(I18N_TODO_MARKER)) {
      failures.push(`docs: remove scaffold translation TODO in src/${file}`);
    }
  }
}

export function getByPath(value, keyPath) {
  return keyPath.split('.').reduce((current, key) => {
    if (current && typeof current === 'object' && key in current) {
      return current[key];
    }
    return undefined;
  }, value);
}

export function listSourceFiles(dir) {
  if (!fs.existsSync(dir)) return [];

  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'wasm' || entry.name === 'public') continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...listSourceFiles(fullPath));
    } else if (entry.isFile() && /\.(vue|ts|js)$/.test(entry.name)) {
      out.push(fullPath);
    }
  }
  return out.sort();
}

function checkLiteralLocaleUsage({ root, defaultLocale, failures }) {
  const localeKeys = new Set(flattenKeys(defaultLocale));
  const tCallPattern = /\bt\(\s*['"]([^'"`$]+)['"]/g;
  const sourceDirs = [path.join(root, 'src'), path.join(root, '.vitepress/theme')];

  for (const sourceDir of sourceDirs) {
    for (const file of listSourceFiles(sourceDir)) {
      const source = fs.readFileSync(file, 'utf8');
      checkConditionalTranslateCalls({ root, file, source, failures });
      for (const match of source.matchAll(tCallPattern)) {
        const key = match[1];
        if (!localeKeys.has(key) || getByPath(defaultLocale, key) === undefined) {
          failures.push(`locale usage: missing key ${key} in ${path.relative(root, file)}`);
        }
      }
    }
  }
}

export function checkConditionalTranslateCalls({ root, file, source, failures }) {
  const relativePath = path.relative(root, file);
  let pendingTernaryLine = null;

  source.split(/\r?\n/).forEach((line, index) => {
    const lineNumber = index + 1;
    const hasQuestion = line.includes('?');
    const hasInlineTranslateBranch = hasQuestion && /[?:]\s*t\(/.test(line);
    const hasContinuedTranslateBranch =
      pendingTernaryLine !== null && /^\s*(?:[?:]\s*)?t\(/.test(line);
    const hasTranslateBranch = hasInlineTranslateBranch || hasContinuedTranslateBranch;

    if (hasQuestion && pendingTernaryLine === null) pendingTernaryLine = lineNumber;

    if (hasTranslateBranch) {
      failures.push(
        `locale usage: avoid ternary t() call in ${relativePath}:${pendingTernaryLine ?? lineNumber}`,
      );
      pendingTernaryLine = null;
      return;
    }

    if (pendingTernaryLine !== null && /[;}]/.test(line)) pendingTernaryLine = null;
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const failures = checkI18nParity();

  if (failures.length > 0) {
    console.error('i18n parity check failed:');
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }

  console.log('i18n parity check passed');
}
