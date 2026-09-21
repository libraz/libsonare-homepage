#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

export const PAGE_LINE_LIMIT = 600;

// Sidebar groups whose pages are task guides and must carry a visual. Each entry
// pairs the English label with its hand-written ja sidebar label. These two groups
// are about to be restructured into eight domain tracks; replace this list when
// the groups are renamed.
export const DOMAIN_SIDEBAR_GROUPS = [
  { en: 'Build By Task', ja: '作りたいもの別' },
  { en: 'Compose & Arrange', ja: '作曲・アレンジ' },
];

// Index sections a split page keeps. Links inside them do not count as inbound
// prose links, or every child of a split would look linked.
const SPLIT_INDEX_HEADINGS = ['Where the sections went', '各節の移動先'];

// Components that count as a visual on a task-guide page, besides the theme's figures.
const VISUAL_COMPONENTS = ['FlowDiagram', 'SonareDemo'];

// Pages that need no inbound link, relative to a locale's docs dir.
const ORPHAN_EXEMPT_PAGES = ['introduction.md'];

export function checkDocLinks({
  root = process.cwd(),
  markdownRoot = path.join(root, 'src'),
  configPath = path.join(root, '.vitepress/config.ts'),
  themePath = path.join(root, '.vitepress/theme/index.ts'),
} = {}) {
  const failures = [];

  for (const filePath of listMarkdownFiles(markdownRoot)) {
    checkFile({ root, filePath, failures });
  }
  checkVitePressConfigLinks({ root, configPath, failures });
  checkOrphanPages({ root, markdownRoot, failures });
  checkDomainPageVisuals({ root, configPath, themePath, failures });
  checkPageSizes({ root, markdownRoot, failures });
  checkDomainSidebarParity({ configPath, failures });

  return failures;
}

function checkFile({ root, filePath, failures }) {
  const content = fs.readFileSync(filePath, 'utf8');
  const links = extractMarkdownLinks(content);
  for (const link of links) {
    if (!shouldCheck(link.href)) continue;

    const targetPath = resolveTargetPath(root, filePath, link.href);
    if (!targetPath) continue;
    if (!fs.existsSync(targetPath)) {
      failures.push(`${relative(root, filePath)} links to missing page ${link.href}`);
      continue;
    }

    const [, rawHash] = link.href.split('#');
    if (rawHash && !targetHasAnchor(targetPath, rawHash)) {
      failures.push(`${relative(root, filePath)} links to missing anchor ${link.href}`);
    }
  }
}

function checkVitePressConfigLinks({ root, configPath, failures }) {
  if (!fs.existsSync(configPath)) return;

  const content = fs.readFileSync(configPath, 'utf8');
  for (const link of extractConfigLinks(content)) {
    if (!shouldCheck(link.href)) continue;

    const targetPath = resolveTargetPath(root, configPath, link.href);
    if (!targetPath) continue;
    if (!fs.existsSync(targetPath)) {
      failures.push(`${relative(root, configPath)} links to missing page ${link.href}`);
      continue;
    }

    const [, rawHash] = link.href.split('#');
    if (rawHash && !targetHasAnchor(targetPath, rawHash)) {
      failures.push(`${relative(root, configPath)} links to missing anchor ${link.href}`);
    }
  }
}

function checkOrphanPages({ root, markdownRoot, failures }) {
  const files = listMarkdownFiles(markdownRoot);
  const linked = new Set();

  for (const filePath of files) {
    const content = stripSplitIndexSections(fs.readFileSync(filePath, 'utf8'));
    for (const link of extractMarkdownLinks(content)) {
      if (!shouldCheck(link.href)) continue;
      const targetPath = resolveTargetPath(root, filePath, link.href);
      if (targetPath && targetPath !== filePath) linked.add(targetPath);
    }
  }

  for (const filePath of files) {
    const docsPath = docsRelativePath(markdownRoot, filePath);
    if (!docsPath || ORPHAN_EXEMPT_PAGES.includes(docsPath)) continue;
    if (!linked.has(filePath)) {
      failures.push(`${relative(root, filePath)} has no inbound prose link`);
    }
  }
}

function checkDomainPageVisuals({ root, configPath, themePath, failures }) {
  if (!fs.existsSync(configPath)) return;

  const figures = fs.existsSync(themePath)
    ? extractFigureNames(fs.readFileSync(themePath, 'utf8'))
    : null;
  if (!figures) {
    failures.push(`${relative(root, themePath)} is missing or has no FIGURES array`);
    return;
  }

  const config = fs.readFileSync(configPath, 'utf8');
  const pages = new Set();
  for (const group of DOMAIN_SIDEBAR_GROUPS) {
    for (const label of [group.en, group.ja]) {
      const links = extractSidebarGroupLinks(config, label);
      if (!links) {
        failures.push(`${relative(root, configPath)} has no sidebar group "${label}"`);
        continue;
      }
      for (const href of links) {
        const targetPath = resolveTargetPath(root, configPath, href);
        if (targetPath && fs.existsSync(targetPath)) pages.add(targetPath);
      }
    }
  }

  for (const filePath of [...pages].sort()) {
    if (!hasVisualComponent(fs.readFileSync(filePath, 'utf8'), figures)) {
      failures.push(`${relative(root, filePath)} has no figure, FlowDiagram, or SonareDemo`);
    }
  }
}

function checkPageSizes({ root, markdownRoot, failures }) {
  for (const filePath of listMarkdownFiles(markdownRoot)) {
    if (!docsRelativePath(markdownRoot, filePath)) continue;
    const lines = countLines(fs.readFileSync(filePath, 'utf8'));
    if (lines > PAGE_LINE_LIMIT) {
      failures.push(`${relative(root, filePath)} is ${lines} lines (limit ${PAGE_LINE_LIMIT})`);
    }
  }
}

function checkDomainSidebarParity({ configPath, failures }) {
  if (!fs.existsSync(configPath)) return;

  const config = fs.readFileSync(configPath, 'utf8');
  for (const group of DOMAIN_SIDEBAR_GROUPS) {
    const en = extractSidebarGroupLinks(config, group.en);
    const ja = extractSidebarGroupLinks(config, group.ja);
    // A missing group is already reported by the visuals check.
    if (!en || !ja) continue;

    const enPages = new Set(en.map(stripJaPrefix));
    const jaPages = new Set(ja.map(stripJaPrefix));
    for (const page of enPages) {
      if (!jaPages.has(page)) {
        failures.push(`sidebar group "${group.en}": ja is missing ${page}`);
      }
    }
    for (const page of jaPages) {
      if (!enPages.has(page)) {
        failures.push(`sidebar group "${group.en}": en is missing ${page}`);
      }
    }
  }
}

// Returns the path relative to its locale's docs dir, or null outside a docs dir.
function docsRelativePath(markdownRoot, filePath) {
  const parts = path.relative(markdownRoot, filePath).split(path.sep);
  const docsIndex = parts[0] === 'docs' ? 0 : parts[1] === 'docs' ? 1 : -1;
  if (docsIndex < 0 || parts.length <= docsIndex + 1) return null;
  return parts.slice(docsIndex + 1).join('/');
}

function stripJaPrefix(href) {
  return href.replace(/^\/ja(?=\/)/, '');
}

export function stripSplitIndexSections(content) {
  const kept = [];
  let skipping = false;
  for (const line of content.split(/\r?\n/)) {
    const heading = line.match(/^(#{1,2})\s+(.+?)\s*#*\s*$/);
    if (heading) {
      skipping = heading[1].length === 2 && SPLIT_INDEX_HEADINGS.includes(heading[2]);
    }
    if (!skipping) kept.push(line);
  }
  return kept.join('\n');
}

// Links inside the sidebar group object whose `text:` equals `label`, scanned by
// brace depth from the label to the group's closing brace. Null when no such group.
export function extractSidebarGroupLinks(content, label) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = content.match(new RegExp(`\\btext:\\s*(['"])${escaped}\\1`));
  if (!match) return null;

  const start = match.index + match[0].length;
  let depth = 1;
  let end = start;
  while (end < content.length && depth > 0) {
    if (content[end] === '{') depth++;
    else if (content[end] === '}') depth--;
    end++;
  }
  return extractConfigLinks(content.slice(start, end)).map((link) => link.href);
}

export function extractFigureNames(themeContent) {
  const match = themeContent.match(/\bFIGURES\s*=\s*\[([^\]]*)\]/);
  if (!match) return null;
  return [...match[1].matchAll(/['"]([^'"]+)['"]/g)].map((name) => name[1]);
}

export function hasVisualComponent(content, figures) {
  return [...figures, ...VISUAL_COMPONENTS].some((name) => new RegExp(`<${name}\\b`).test(content));
}

export function countLines(content) {
  const lines = content.split(/\r?\n/);
  if (lines.at(-1) === '') lines.pop();
  return lines.length;
}

export function extractMarkdownLinks(content) {
  const links = [];
  const inlineLinkPattern = /(?<!!)\[[^\]\n]+\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
  for (const match of content.matchAll(inlineLinkPattern)) {
    links.push({ href: match[1] });
  }
  return links;
}

export function extractConfigLinks(content) {
  const links = [];
  const linkPropertyPattern = /\blink:\s*['"]([^'"]+)['"]/g;
  for (const match of content.matchAll(linkPropertyPattern)) {
    links.push({ href: match[1] });
  }
  return links;
}

export function shouldCheck(href) {
  return (
    !href.startsWith('http://') &&
    !href.startsWith('https://') &&
    !href.startsWith('mailto:') &&
    !href.startsWith('tel:')
  );
}

export function resolveTargetPath(root, sourcePath, href) {
  const [rawPath] = href.split('#');
  if (!rawPath) return sourcePath;

  const base = rawPath.startsWith('/')
    ? path.join(root, 'src', rawPath.replace(/^\//, ''))
    : path.resolve(path.dirname(sourcePath), rawPath);

  if (path.extname(base) === '.md') return base;
  const candidates = [`${base}.md`, path.join(base, 'index.md'), base];
  return (
    candidates.find(
      (candidate) => candidate.startsWith(path.join(root, 'src')) && fs.existsSync(candidate),
    ) || candidates[0]
  );
}

export function targetHasAnchor(targetPath, rawHash) {
  const expected = decodeURIComponent(rawHash).normalize('NFC');
  const anchors = extractHeadingAnchors(fs.readFileSync(targetPath, 'utf8'));
  return anchors.has(expected);
}

export function extractHeadingAnchors(content) {
  const anchors = new Set();
  const used = new Map();

  for (const line of content.split(/\r?\n/)) {
    const match = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
    if (!match) continue;

    const base = slugifyHeading(match[2]);
    const count = used.get(base) || 0;
    used.set(base, count + 1);
    anchors.add(count === 0 ? base : `${base}-${count}`);
  }

  return anchors;
}

// Mirrors the slugifier VitePress actually uses (@mdit-vue/shared). The NFKD
// normalization is what makes fullwidth CJK punctuation behave like its ASCII
// counterpart, so a Japanese heading such as `CLI（コマンドライン）` anchors as
// `cli-コマンドライン`. Diverging from it here would let dead anchors pass.
// The upstream slugifier also strips C0 control characters; heading text read
// line by line can never carry them, so that pass is omitted here.
const RE_SPECIAL = /[\s~`!@#$%^&*()\-_+=[\]{}|\\;:"'“”<>,.?/]+/g;
const RE_COMBINING = /[\u0300-\u036f]/g;

export function slugifyHeading(value) {
  return (
    value
      .replace(/<[^>]*>/g, '')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .trim()
      .normalize('NFKD')
      .replace(RE_COMBINING, '')
      .replace(RE_SPECIAL, '-')
      .replace(/-{2,}/g, '-')
      .replace(/^-+|-+$/g, '')
      .replace(/^(\d)/, '_$1')
      .toLowerCase()
      // Recompose: the NFKD pass above splits dakuten off its kana, so a link
      // written the normal way would never match a Japanese heading otherwise.
      .normalize('NFC')
  );
}

export function listMarkdownFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...listMarkdownFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      out.push(fullPath);
    }
  }
  return out.sort();
}

function relative(root, filePath) {
  return path.relative(root, filePath);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const failures = checkDocLinks();

  if (failures.length > 0) {
    console.error('doc link check failed:');
    for (const failure of failures) console.error(`- ${failure}`);
    process.exit(1);
  }

  console.log('doc link check passed');
}
