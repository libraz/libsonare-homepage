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
} = {}) {
  const failures = [];

  if (!fs.existsSync(dist)) {
    return {
      skipped: true,
      failures,
    };
  }

  for (const file of requiredDemoRoutes()) {
    if (!fs.existsSync(path.join(dist, file))) failures.push(`missing built route: ${file}`);
  }

  for (const file of ['master.html', 'ja/master.html']) {
    if (fs.existsSync(path.join(dist, file)))
      failures.push(`forbidden old built route exists: ${file}`);
  }

  const glossaryFiles = expectedGlossaryFiles(manifestPath);
  for (const file of glossaryFiles) {
    if (!fs.existsSync(path.join(dist, file)))
      failures.push(`missing built glossary route: ${file}`);
  }

  checkSitemap(dist, glossaryFiles, failures);
  checkLlmsTxt(dist, failures);

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

function requiredDemoRoutes() {
  return [
    'mastering.html',
    'ja/mastering.html',
    'analyzer.html',
    'ja/analyzer.html',
    'music-analysis.html',
    'ja/music-analysis.html',
    'mixing.html',
    'ja/mixing.html',
    'realtime-fx.html',
    'ja/realtime-fx.html',
    'spatial.html',
    'ja/spatial.html',
    'synth.html',
    'ja/synth.html',
    'studio.html',
    'ja/studio.html',
  ];
}

function checkSitemap(dist, glossaryFiles, failures) {
  const sitemapPath = path.join(dist, 'sitemap.xml');
  if (!fs.existsSync(sitemapPath)) {
    failures.push('missing built sitemap.xml');
    return;
  }

  const sitemap = fs.readFileSync(sitemapPath, 'utf8');
  const required = [...requiredDemoRoutes(), ...glossaryFiles];

  for (const file of required) {
    const url = `${siteUrl}/${file}`;
    if (!sitemap.includes(`<loc>${url}</loc>`)) failures.push(`sitemap missing route: ${url}`);
  }
}

function checkLlmsTxt(dist, failures) {
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
}

export function expectedGlossaryFiles(manifestPath) {
  if (!fs.existsSync(manifestPath)) return [];
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const files = ['docs/glossary.html', 'ja/docs/glossary.html'];

  for (const category of manifest.categories) {
    for (const entry of category.entries) {
      if (entry.status !== 'published') continue;
      const mdPath = entry.path || `${category.id}/${entry.id}.md`;
      const htmlPath = mdPath.replace(/\.md$/, '.html');
      files.push(`docs/glossary/${htmlPath}`);
      files.push(`ja/docs/glossary/${htmlPath}`);
    }
  }

  return files.sort();
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
