#!/usr/bin/env node
/**
 * Gate: inline `<SonareDemo>` widgets are well-formed and locale-parallel.
 *
 * Checks:
 *  1. every `id` referenced from markdown is defined in the demo registry;
 *  2. every registry definition is referenced from markdown at least once;
 *  3. mirrored locale docs reference the same set of ids (i18n parity for widgets);
 *  4. every clip referenced by the registry has a file under public/demo-clips/.
 *
 * Deep per-definition shape (localized labels have the expected fallback) is asserted by the
 * vitest test `test/demo-registry.test.ts`, which can import the TypeScript directly.
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const DEMO_TAG = /<SonareDemo\s+[^>]*\bid=["']([^"']+)["']/g;
const DEMO_TAG_FULL = /<SonareDemo\b([^>]*)\/?>/g;
const REGISTRY_ID = /\bid:\s*["']([^"']+)["']/g;
const REGISTRY_CLIP = /\bclip:\s*["']([^"']+)["']/g;
const TAG_ATTR = /(?:^|\s)(:?[\w-]+)(?:=(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
const DEMO_ID_FORMAT = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function listMarkdown(dir, base = dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listMarkdown(full, base));
    else if (entry.isFile() && entry.name.endsWith('.md')) out.push(path.relative(base, full));
  }
  return out.sort();
}

function listTopLevelMarkdown(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
    .map((entry) => entry.name)
    .sort();
}

function idsInFile(file) {
  const src = fs.readFileSync(file, 'utf8');
  const ids = new Set();
  for (const m of src.matchAll(DEMO_TAG)) ids.add(m[1]);
  return ids;
}

function validateDemoTagsInFile(file) {
  const src = fs.readFileSync(file, 'utf8');
  const failures = [];
  for (const tag of src.matchAll(DEMO_TAG_FULL)) {
    if (!tag[0].trimEnd().endsWith('/>')) {
      failures.push('SonareDemo tag must be self-closing');
    }
    const attrs = tag[1] ?? '';
    let idCount = 0;
    for (const attr of attrs.matchAll(TAG_ATTR)) {
      const name = attr[1];
      if (name === 'id') {
        idCount++;
        const value = attr[2] ?? attr[3] ?? attr[4];
        if (value === undefined) {
          failures.push('SonareDemo id attribute must have a value');
        } else if (value.trim().length === 0) {
          failures.push('SonareDemo id attribute must not be empty');
        } else if (!DEMO_ID_FORMAT.test(value)) {
          failures.push(`SonareDemo id "${value}" must be kebab-case`);
        }
      } else if (name) {
        failures.push(`unsupported SonareDemo attribute "${name}"`);
      }
    }
    if (idCount === 0) failures.push('SonareDemo is missing required id attribute');
    if (idCount > 1) failures.push('SonareDemo has duplicate id attributes');
  }
  return failures;
}

function collectFromRegistry(dir, pattern) {
  const found = new Set();
  if (!fs.existsSync(dir)) return found;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      for (const v of collectFromRegistry(full, pattern)) found.add(v);
    } else if (entry.isFile() && entry.name.endsWith('.ts')) {
      const src = fs.readFileSync(full, 'utf8');
      for (const m of src.matchAll(pattern)) found.add(m[1]);
    }
  }
  return found;
}

function listLocaleNames(localesDir, defaultLocale) {
  if (!fs.existsSync(localesDir)) return [defaultLocale];
  const locales = fs
    .readdirSync(localesDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => path.basename(entry.name, '.json'));
  return [...new Set([defaultLocale, ...locales])].sort();
}

function docsDirFor(root, locale, defaultLocale) {
  return locale === defaultLocale
    ? path.join(root, 'src/docs')
    : path.join(root, 'src', locale, 'docs');
}

function pagesDirFor(root, locale, defaultLocale) {
  return locale === defaultLocale ? path.join(root, 'src') : path.join(root, 'src', locale);
}

function compareLocaleIdUsage({
  failures,
  defaultLocale,
  locale,
  defaultDir,
  localizedDir,
  files,
}) {
  for (const rel of files) {
    const defaultFile = path.join(defaultDir, rel);
    const localizedFile = path.join(localizedDir, rel);
    const defaultIds = fs.existsSync(defaultFile) ? idsInFile(defaultFile) : new Set();
    const localizedIds = fs.existsSync(localizedFile) ? idsInFile(localizedFile) : new Set();

    for (const id of defaultIds) {
      if (!localizedIds.has(id)) {
        failures.push(`demos: id "${id}" used in ${defaultLocale} ${rel} but not ${locale}`);
      }
    }
    for (const id of localizedIds) {
      if (!defaultIds.has(id)) {
        failures.push(`demos: id "${id}" used in ${locale} ${rel} but not ${defaultLocale}`);
      }
    }
  }
}

export function checkDemos({ root = process.cwd(), defaultLocale = 'en' } = {}) {
  const failures = [];
  const srcDir = path.join(root, 'src');
  const localesDir = path.join(root, 'src/locales');
  const defaultDocsDir = docsDirFor(root, defaultLocale, defaultLocale);
  const registryDir = path.join(root, 'src/demos/registry');
  const clipsDir = path.join(root, 'src/public/demo-clips');
  const locales = listLocaleNames(localesDir, defaultLocale);

  const definedIds = collectFromRegistry(registryDir, REGISTRY_ID);
  const clipNames = collectFromRegistry(registryDir, REGISTRY_CLIP);

  // 1 + 2: all markdown references must resolve, and all definitions must be used.
  const referencedIds = new Set();
  for (const rel of listMarkdown(srcDir)) {
    for (const tagFailure of validateDemoTagsInFile(path.join(srcDir, rel))) {
      failures.push(`demos: ${tagFailure} in src/${rel}`);
    }
    for (const id of idsInFile(path.join(srcDir, rel))) {
      referencedIds.add(id);
      if (!definedIds.has(id)) {
        failures.push(`demos: unknown id "${id}" referenced in src/${rel}`);
      }
    }
  }
  for (const id of definedIds) {
    if (!referencedIds.has(id)) {
      failures.push(`demos: registry id "${id}" is not referenced from markdown`);
    }
  }

  // 3: per mirrored locale markdown file, compare id usage.
  for (const locale of locales) {
    if (locale === defaultLocale) continue;
    const localizedDocsDir = docsDirFor(root, locale, defaultLocale);
    compareLocaleIdUsage({
      failures,
      defaultLocale,
      locale,
      defaultDir: defaultDocsDir,
      localizedDir: localizedDocsDir,
      files: [
        ...new Set([...listMarkdown(defaultDocsDir), ...listMarkdown(localizedDocsDir)]),
      ].sort(),
    });

    const defaultPagesDir = pagesDirFor(root, defaultLocale, defaultLocale);
    const localizedPagesDir = pagesDirFor(root, locale, defaultLocale);
    compareLocaleIdUsage({
      failures,
      defaultLocale,
      locale,
      defaultDir: defaultPagesDir,
      localizedDir: localizedPagesDir,
      files: [
        ...new Set([
          ...listTopLevelMarkdown(defaultPagesDir),
          ...listTopLevelMarkdown(localizedPagesDir),
        ]),
      ].sort(),
    });
  }

  // 4: referenced clips exist.
  for (const name of clipNames) {
    const exists = ['opus', 'ogg', 'wav'].some((ext) =>
      fs.existsSync(path.join(clipsDir, `${name}.${ext}`)),
    );
    if (!exists) failures.push(`demos: clip "${name}" has no file under src/public/demo-clips/`);
  }

  return failures;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const failures = checkDemos();
  if (failures.length > 0) {
    console.error('demo check failed:');
    for (const f of failures) console.error(`- ${f}`);
    process.exit(1);
  }
  console.log('demo check passed');
}
