#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const minimumPublishedBodyLength = 1600;
const minimumDetailsBodyLength = 120;

export function checkGlossaryCoverage({
  root = process.cwd(),
  manifestPath = path.join(root, 'scripts/glossary/manifest.json'),
  defaultLocale = 'en',
} = {}) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const failures = [];
  const locales = listLocaleNames(path.join(root, 'src/locales'), defaultLocale);
  const entries = glossaryEntries(manifest);
  const byPath = new Map(entries.map((entry) => [entry.path, entry]));
  const published = entries.filter((entry) => entry.status === 'published');
  const todo = entries.filter((entry) => entry.status !== 'published');

  for (const entry of entries) {
    if (!entry.id) failures.push(`${entry.category}: missing id`);
    for (const locale of locales) {
      if (!entry.title?.[locale]) failures.push(`${entry.id}: missing title.${locale}`);
    }
    if (!entry.status) failures.push(`${entry.id}: missing status`);
  }

  for (const entry of published) {
    for (const locale of locales) {
      const pagePath = path.join(glossaryDirFor(root, locale, defaultLocale), entry.path);
      if (!fs.existsSync(pagePath)) {
        failures.push(`published entry missing ${locale} page: ${entry.path}`);
      } else {
        checkPublishedPage(failures, `${locale} ${entry.path}`, pagePath);
      }
    }
  }

  for (const locale of locales) {
    for (const relativePath of listMarkdownFiles(glossaryDirFor(root, locale, defaultLocale))) {
      if (!byPath.has(relativePath)) {
        failures.push(`${locale} page not listed in manifest: ${relativePath}`);
      }
    }
  }

  checkGlossaryIndexes({ root, published, failures, locales, defaultLocale });
  checkMasteringSidebar({ root, published, failures, locales, defaultLocale });

  return { failures, publishedCount: published.length, plannedCount: todo.length };
}

export function glossaryEntries(manifest) {
  return manifest.categories.flatMap((category) =>
    category.entries.map((entry) => ({
      ...entry,
      category: category.id,
      path: entry.path || `${category.id}/${entry.id}.md`,
    })),
  );
}

function listLocaleNames(localesDir, defaultLocale) {
  if (!fs.existsSync(localesDir)) return [defaultLocale, 'ja'];
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

function glossaryDirFor(root, locale, defaultLocale) {
  return path.join(docsDirFor(root, locale, defaultLocale), 'glossary');
}

function localizedDocsLink(locale, defaultLocale, cleanPath) {
  return locale === defaultLocale
    ? `/docs/glossary/${cleanPath}`
    : `/${locale}/docs/glossary/${cleanPath}`;
}

export function checkPublishedPage(failures, label, filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const frontmatter = parseFrontmatter(content);
  const h1 = content.match(/^#\s+(.+)$/m)?.[1]?.trim();
  const body = content.replace(/^---[\s\S]*?---/, '').trim();

  if (!frontmatter) failures.push(`${label}: missing frontmatter`);
  if (!frontmatter?.title) failures.push(`${label}: missing frontmatter title`);
  if (!frontmatter?.description) failures.push(`${label}: missing frontmatter description`);
  if (!h1) failures.push(`${label}: missing H1`);
  if (body.length < minimumPublishedBodyLength) {
    failures.push(`${label}: body is too short for a reviewed public page`);
  }
  checkRelatedLinks(failures, label, content);
  const detailsBody = content
    .match(/^:{3,}\s+details\s+[^\n]*\n([\s\S]*?)\n:{3,}\s*$/m)?.[1]
    ?.trim();
  if (!detailsBody) {
    failures.push(`${label}: missing implementation details block`);
  } else if (detailsBody.length < minimumDetailsBodyLength) {
    failures.push(`${label}: implementation details block is too thin`);
  }
}

export function checkRelatedLinks(failures, label, content) {
  const related = content.match(/^(Related:|関連:)\s*(.+)$/m)?.[2] ?? '';
  const linkCount = (related.match(/\[[^\]]+\]\([^)]+\)/g) ?? []).length;
  if (linkCount < 2) {
    failures.push(`${label}: missing related links or too few related links`);
  }
}

function checkGlossaryIndexes({ root, published, failures, locales, defaultLocale }) {
  const indexes = new Map(
    locales.map((locale) => {
      const file = path.join(docsDirFor(root, locale, defaultLocale), 'glossary.md');
      return [locale, fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : ''];
    }),
  );

  for (const entry of published) {
    const link = `./glossary/${entry.path}`;
    for (const locale of locales) {
      if (!indexes.get(locale)?.includes(link)) {
        failures.push(`${locale} glossary index missing link: ${link}`);
      }
    }
  }
}

function checkMasteringSidebar({ root, published, failures, locales, defaultLocale }) {
  const config = fs.readFileSync(path.join(root, '.vitepress/config.ts'), 'utf8');

  for (const entry of published) {
    const cleanPath = entry.path.replace(/\.md$/, '');
    for (const locale of locales) {
      const link = localizedDocsLink(locale, defaultLocale, cleanPath);
      if (!config.includes(`link: '${link}'`)) {
        failures.push(`${locale} sidebar missing glossary link: ${link}`);
      }
    }
  }
}

export function parseFrontmatter(content) {
  const match = /^---\n([\s\S]*?)\n---/.exec(content);
  if (!match) return null;

  const data = {};
  for (const line of match[1].split(/\r?\n/)) {
    const pair = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
    if (!pair) continue;
    data[pair[1]] = pair[2].replace(/^['"]|['"]$/g, '').trim();
  }
  return data;
}

export function listMarkdownFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...listMarkdownFiles(fullPath).map((child) => path.join(entry.name, child)));
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      out.push(entry.name);
    }
  }
  return out.sort();
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = checkGlossaryCoverage();

  if (result.failures.length > 0) {
    console.error('glossary coverage check failed:');
    for (const failure of result.failures) console.error(`- ${failure}`);
    process.exit(1);
  }

  console.log(
    `glossary coverage check passed: ${result.publishedCount} published, ${result.plannedCount} planned`,
  );
}
