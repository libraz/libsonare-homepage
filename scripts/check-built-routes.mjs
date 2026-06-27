#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const siteUrl = 'https://sonare.libraz.net';

export function checkBuiltRoutes({
  root = process.cwd(),
  dist = path.join(root, '.vitepress/dist'),
  manifestPath = path.join(root, 'scripts/glossary/manifest.json'),
  localesDir = path.join(root, 'src/locales'),
  defaultLocale = 'en',
} = {}) {
  const failures = [];
  const locales = listLocaleNames(localesDir, defaultLocale);

  if (!fs.existsSync(dist)) {
    return {
      skipped: true,
      failures,
    };
  }

  for (const file of requiredDemoRoutes(locales, defaultLocale)) {
    if (!fs.existsSync(path.join(dist, file))) failures.push(`missing built route: ${file}`);
  }

  for (const file of localizedBuiltFiles('master', locales, defaultLocale)) {
    if (fs.existsSync(path.join(dist, file)))
      failures.push(`forbidden old built route exists: ${file}`);
  }

  const glossaryFiles = expectedGlossaryFiles(manifestPath, { locales, defaultLocale });
  for (const file of glossaryFiles) {
    if (!fs.existsSync(path.join(dist, file)))
      failures.push(`missing built glossary route: ${file}`);
  }

  checkSitemap(dist, glossaryFiles, failures, locales, defaultLocale);
  checkLlmsTxt(dist, failures, locales, defaultLocale);
  checkBuiltAssetBudgets(dist, failures);
  checkBrowserExternalShims(dist, failures);

  for (const file of listFiles(dist)) {
    const relativePath = path.relative(dist, file);
    if (
      /mastering\/parameters|(^|\/)master\.html$|(^|\/)master\/|master\?mode/.test(relativePath)
    ) {
      failures.push(`${relativePath}: forbidden old mastering path`);
    }
    if (!/\.(html|xml)$/.test(file)) continue;
    const content = fs.readFileSync(file, 'utf8');
    if (/mastering\/parameters|\/master\b|master\?mode|redirect|Redirect/.test(content)) {
      failures.push(
        `${relativePath} contains old mastering route, redirect, or parameter-page reference`,
      );
    }
    if (file.endsWith('.html')) checkInternalHrefs(dist, relativePath, content, failures);
  }

  return {
    skipped: false,
    failures,
  };
}

function requiredDemoRoutes(locales, defaultLocale) {
  return [
    'mastering',
    'analyzer',
    'music-analysis',
    'mixing',
    'realtime-fx',
    'spatial',
    'synth',
    'studio',
  ]
    .flatMap((route) => localizedBuiltFiles(route, locales, defaultLocale))
    .sort();
}

function checkSitemap(dist, glossaryFiles, failures, locales, defaultLocale) {
  const sitemapPath = path.join(dist, 'sitemap.xml');
  if (!fs.existsSync(sitemapPath)) {
    failures.push('missing built sitemap.xml');
    return;
  }

  const sitemap = fs.readFileSync(sitemapPath, 'utf8');
  const required = [...requiredDemoRoutes(locales, defaultLocale), ...glossaryFiles];

  for (const file of required) {
    const url = `${siteUrl}/${file}`;
    if (!sitemap.includes(`<loc>${url}</loc>`)) failures.push(`sitemap missing route: ${url}`);
  }
}

function checkLlmsTxt(dist, failures, locales, defaultLocale) {
  const llmsPath = path.join(dist, 'llms.txt');
  if (!fs.existsSync(llmsPath)) {
    failures.push('missing built llms.txt');
    return;
  }

  const content = fs.readFileSync(llmsPath, 'utf8');
  if (!content.startsWith('# libsonare')) {
    failures.push('llms.txt missing expected "# libsonare" heading');
  }
  if (!content.includes(`${siteUrl}/docs/introduction.html`)) {
    failures.push('llms.txt missing canonical docs links');
  }
  for (const locale of locales) {
    if (locale === defaultLocale) continue;
    const localizedDocs = `${siteUrl}/${locale}/docs/introduction.html`;
    const localizedDemos = `${siteUrl}/${locale}/demos.html`;
    if (!content.includes(localizedDocs) || !content.includes(localizedDemos)) {
      failures.push(`llms.txt missing localized links for ${locale}`);
    }
  }
}

export function expectedGlossaryFiles(
  manifestPath,
  { locales = ['en', 'ja'], defaultLocale = 'en' } = {},
) {
  if (!fs.existsSync(manifestPath)) return [];
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const files = localizedBuiltFiles('docs/glossary', locales, defaultLocale);

  for (const category of manifest.categories) {
    for (const entry of category.entries) {
      if (entry.status !== 'published') continue;
      const mdPath = entry.path || `${category.id}/${entry.id}.md`;
      const htmlPath = mdPath.replace(/\.md$/, '.html');
      files.push(
        ...localizedBuiltFiles(
          `docs/glossary/${htmlPath.replace(/\.html$/, '')}`,
          locales,
          defaultLocale,
        ),
      );
    }
  }

  return files.sort();
}

function listLocaleNames(localesDir, defaultLocale) {
  if (!fs.existsSync(localesDir)) return [defaultLocale, 'ja'];
  const locales = fs
    .readdirSync(localesDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => path.basename(entry.name, '.json'));
  return [...new Set([defaultLocale, ...locales])].sort();
}

function localizedBuiltFiles(route, locales, defaultLocale) {
  return locales.map((locale) =>
    locale === defaultLocale ? `${route}.html` : `${locale}/${route}.html`,
  );
}

function checkInternalHrefs(dist, relativePath, content, failures) {
  const hrefPattern = /\bhref="([^"]+)"/g;
  for (const match of content.matchAll(hrefPattern)) {
    const href = match[1];
    if (!href.startsWith('/')) continue;
    if (href.startsWith('//')) continue;

    const target = resolveBuiltHref(dist, href);
    if (!target) continue;
    if (!fs.existsSync(target)) {
      failures.push(`${relativePath} links to missing built asset or route: ${href}`);
    }
  }
}

export function resolveBuiltHref(dist, href) {
  const rawPath = href.split(/[?#]/)[0];
  if (!rawPath || rawPath === '/') return path.join(dist, 'index.html');

  const cleanPath = rawPath.replace(/^\//, '');
  const direct = path.join(dist, cleanPath);
  if (path.extname(cleanPath)) return direct;

  const html = path.join(dist, `${cleanPath}.html`);
  if (fs.existsSync(html)) return html;
  return path.join(dist, cleanPath, 'index.html');
}

export function listFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...listFiles(fullPath));
    } else if (entry.isFile()) {
      out.push(fullPath);
    }
  }
  return out.sort();
}

const KiB = 1024;
const MiB = 1024 * KiB;

const assetBudgets = [
  { pattern: /^assets\/chunks\/vexflow\./, maxBytes: 1.25 * MiB },
  { pattern: /^assets\/.*\.wasm$/, maxBytes: 3.25 * MiB },
];

function budgetForBuiltAsset(relativePath) {
  const matched = assetBudgets.find((budget) => budget.pattern.test(relativePath));
  if (matched) return matched.maxBytes;
  if (relativePath.endsWith('.js')) return 750 * KiB;
  if (relativePath.endsWith('.wasm')) return 3.25 * MiB;
  return null;
}

function formatBytes(bytes) {
  if (bytes >= MiB) return `${(bytes / MiB).toFixed(2)} MiB`;
  return `${(bytes / KiB).toFixed(1)} KiB`;
}

export function checkBuiltAssetBudgets(dist, failures) {
  for (const file of listFiles(dist)) {
    const relativePath = path.relative(dist, file).replaceAll(path.sep, '/');
    if (!/\.(js|wasm)$/.test(relativePath)) continue;

    const maxBytes = budgetForBuiltAsset(relativePath);
    if (maxBytes === null) continue;

    const size = fs.statSync(file).size;
    if (size > maxBytes) {
      failures.push(
        `${relativePath}: built asset ${formatBytes(size)} exceeds budget ${formatBytes(maxBytes)}`,
      );
    }
  }
}

export function checkBrowserExternalShims(dist, failures) {
  for (const file of listFiles(dist)) {
    const relativePath = path.relative(dist, file).replaceAll(path.sep, '/');
    if (!relativePath.endsWith('.js')) continue;
    if (/vite-browser-external|__vite-browser-external/.test(relativePath)) {
      failures.push(`${relativePath}: unexpected Vite browser external shim`);
      continue;
    }

    const content = fs.readFileSync(file, 'utf8');
    if (/vite-browser-external|__vite-browser-external/.test(content)) {
      failures.push(`${relativePath}: references unexpected Vite browser external shim`);
    }
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = checkBuiltRoutes();
  if (result.skipped) {
    console.log('built route check skipped: .vitepress/dist does not exist');
    process.exit(0);
  }

  if (result.failures.length > 0) {
    console.error('built route check failed:');
    for (const failure of result.failures) console.error(`- ${failure}`);
    process.exit(1);
  }

  console.log('built route check passed');
}
