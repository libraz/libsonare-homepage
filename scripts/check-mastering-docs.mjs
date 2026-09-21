#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

export const pythonApis = [
  'mastering_processor_names',
  'mastering_process',
  'mastering_process_stereo',
  'mastering_pair_processor_names',
  'mastering_pair_process',
  'mastering_pair_analysis_names',
  'mastering_pair_analyze',
  'mastering_stereo_analysis_names',
  'mastering_stereo_analyze',
];

export const cliCommands = [
  'mastering-processors',
  'mastering-processor',
  'mastering-pair-processors',
  'mastering-pair-processor',
  'mastering-pair-analyses',
  'mastering-pair-analyze',
  'mastering-stereo-analyses',
  'mastering-stereo-analyze',
];

// The JavaScript/WASM reference is one page family: a hub page carrying setup
// and a map, plus one sibling per subject. Anything that used to be required
// "somewhere in the JS API reference" is required somewhere in this list.
export const jsReferenceDocNames = [
  'js-api.md',
  'js-api-analysis.md',
  'js-api-effects.md',
  'js-api-mastering.md',
  'js-api-audio.md',
  'js-api-types.md',
];

// The sibling that owns the Mastering API section.
export const jsMasteringDocName = 'js-api-mastering.md';

export const glossaryLinks = [
  'glossary/mastering.md',
  'glossary/mastering/tone-air.md',
  'glossary/mastering/dynamics.md',
  'glossary/mastering/stereo-limiter-loudness.md',
  'glossary/mastering/reference-match.md',
  'glossary/mastering/delivery-targets.md',
  'glossary/mastering/meter-reading.md',
  'glossary/mastering/quality-checklist.md',
  'glossary/mastering/error-recovery.md',
  'glossary/concepts/browser-local-processing.md',
];

export function checkMasteringDocs({ root = process.cwd(), defaultLocale = 'en' } = {}) {
  const failures = [];
  const locales = listLocaleNames(path.join(root, 'src/locales'), defaultLocale);
  const jsApis = extractMasteringJsApis({ root, failures });

  checkWasmExports({ root, failures, jsApis });
  checkDocs({ root, failures, jsApis, locales, defaultLocale });
  checkHelpPanelUsesDocsAsSource({ root, failures });
  checkRoutes({ root, failures });
  checkRouteFiles({ root, failures, locales, defaultLocale });

  return failures;
}

function checkWasmExports({ root, failures, jsApis }) {
  // The worklet entry is now a narrower AudioWorklet bridge and does not carry
  // the full high-level mastering API surface, so this only checks index.d.ts.
  // Old bundles declared each function locally (`declare function foo(`); new
  // bundles re-export it as a value from a per-module chunk
  // (`export { foo } from './effects_mastering';`). Either counts as "exported".
  const indexDts = read(root, 'src/wasm/index.d.ts');
  const exportedNames = extractValueExportNames(indexDts);
  const declaredNames = new Set(
    [...indexDts.matchAll(/(?:^|\n)\s*(?:export\s+)?declare function ([A-Za-z0-9_]+)\(/g)].map(
      (match) => match[1],
    ),
  );
  for (const api of jsApis) {
    if (!exportedNames.has(api) && !declaredNames.has(api)) {
      failures.push(`src/wasm/index.d.ts: missing exported API ${api}`);
    }
  }
}

// Splits every `export { ... }` / `export type { ... }` block in a generated
// .d.ts bundle into its comma-separated entries. Multi-line-safe (an entry
// list may wrap across lines) and tolerant of an optional trailing `from
// '...'` clause, so it covers both the old flat-declaration bundle shape and
// the new re-export-barrel shape.
function parseExportBlocks(dts) {
  return [...dts.matchAll(/export\s+(type\s+)?\{([\s\S]*?)\}(?:\s*from\s*'[^']+')?;/g)].map(
    ([, typeOnlyBlock, body]) => ({
      typeOnlyBlock: Boolean(typeOnlyBlock),
      entries: body
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean),
    }),
  );
}

// The set of runtime (value) export names visible on the imported module.
// Entries from an `export type { ... }` block are excluded entirely; an
// inline `type X` / `type X as Y` entry is excluded from an otherwise mixed
// value block. An aliased entry (`X as Y`) resolves to the exported name `Y`.
function extractValueExportNames(dts) {
  const names = new Set();
  for (const { typeOnlyBlock, entries } of parseExportBlocks(dts)) {
    if (typeOnlyBlock) continue;
    for (const entry of entries) {
      if (entry.startsWith('type ')) continue;
      const aliasMatch = entry.match(/^(\S+)\s+as\s+(\S+)$/);
      names.add(aliasMatch ? aliasMatch[2] : entry);
    }
  }
  return names;
}

export function extractMasteringJsApis({ root, failures = [] }) {
  const dts = read(root, 'src/wasm/index.d.ts');
  const apiPattern = /^(?:mastering|masterAudio)[A-Za-z0-9]*$/;
  const barrelNames = [...extractValueExportNames(dts)];
  const declaredNames = [
    ...dts.matchAll(
      /(?:^|\n)\s*(?:export\s+)?declare function ((?:mastering|masterAudio)[A-Za-z0-9]*)\(/g,
    ),
  ].map((match) => match[1]);
  const apis = [...new Set([...barrelNames, ...declaredNames])]
    .filter((name) => apiPattern.test(name))
    .sort();
  if (apis.length === 0) failures.push('src/wasm/index.d.ts: no mastering JS APIs found');
  return apis;
}

function checkDocs({ root, failures, jsApis, locales, defaultLocale }) {
  for (const locale of locales) {
    const prefix = docsPrefix(locale, defaultLocale);

    // Mastering API names and the related-guide line are required on the page
    // that owns the Mastering API section, not merely somewhere in the family.
    const jsMasteringLabel = `${prefix}/${jsMasteringDocName}`;
    const jsMasteringDoc = read(root, jsMasteringLabel);
    for (const api of jsApis) requireText(failures, jsMasteringLabel, jsMasteringDoc, api);
    checkRelatedGuideLine(failures, jsMasteringLabel, jsMasteringDoc, locale, defaultLocale);

    // The progress-callback example lives on whichever sibling documents the
    // call it demonstrates, so it is required across the reference family —
    // the same text the reference carried while it was a single page.
    const jsReferenceLabel = `${prefix}/{${jsReferenceDocNames.join(',')}}`;
    const jsReference = jsReferenceDocNames
      .map((file) => read(root, `${prefix}/${file}`))
      .join('\n');
    requireText(failures, jsReferenceLabel, jsReference, 'progress * 100');
    requireText(failures, jsReferenceLabel, jsReference, 'stage');

    const nativeDoc = read(root, `${prefix}/native-bindings.md`);
    for (const api of jsApis) requireText(failures, `${prefix}/native-bindings.md`, nativeDoc, api);
    requireText(failures, `${prefix}/native-bindings.md`, nativeDoc, '@libraz/libsonare');
    requireText(failures, `${prefix}/native-bindings.md`, nativeDoc, '@libraz/libsonare-native');
    requireText(failures, `${prefix}/native-bindings.md`, nativeDoc, 'progress * 100');
    requireText(failures, `${prefix}/native-bindings.md`, nativeDoc, 'stage');
    checkRelatedGuideLine(
      failures,
      `${prefix}/native-bindings.md`,
      nativeDoc,
      locale,
      defaultLocale,
    );

    const pythonDoc = read(root, `${prefix}/python-api.md`);
    for (const api of pythonApis) requireText(failures, `${prefix}/python-api.md`, pythonDoc, api);
    checkRelatedGuideLine(failures, `${prefix}/python-api.md`, pythonDoc, locale, defaultLocale);

    const cliDoc = read(root, `${prefix}/cli.md`);
    for (const command of cliCommands) requireText(failures, `${prefix}/cli.md`, cliDoc, command);
    checkRelatedGuideLine(failures, `${prefix}/cli.md`, cliDoc, locale, defaultLocale);

    const wasmDoc = read(root, `${prefix}/wasm.md`);
    requireText(
      failures,
      `${prefix}/wasm.md`,
      wasmDoc,
      localizedRoute(locale, defaultLocale, '/mastering'),
    );
    const browserTitle = browserMasteringTitle(locale, defaultLocale);
    if (browserTitle) requireText(failures, `${prefix}/wasm.md`, wasmDoc, browserTitle);
    requireText(failures, `${prefix}/wasm.md`, wasmDoc, './mastering-implementation.md');
    requireMinimumGuideLinks(failures, `${prefix}/wasm.md`, wasmDoc, 3);

    const benchmarks = read(root, `${prefix}/benchmarks.md`);
    requireText(failures, `${prefix}/benchmarks.md`, benchmarks, 'WASM Mastering ISP Guard');
    requireText(failures, `${prefix}/benchmarks.md`, benchmarks, 'mastering_isp_4x_stereo_1ms');
  }

  const runtimeDocNames = [
    ...jsReferenceDocNames,
    'python-api.md',
    'cli.md',
    'native-bindings.md',
    'wasm.md',
  ];
  const allDocs = locales.flatMap((locale) =>
    runtimeDocNames.map((file) => {
      const docsFile = `${docsPrefix(locale, defaultLocale)}/${file}`;
      return [docsFile, read(root, docsFile)];
    }),
  );

  for (const link of glossaryLinks) {
    if (!allDocs.some(([, content]) => content.includes(link))) {
      failures.push(`runtime docs missing glossary link ${link}`);
    }
  }

  const readme = read(root, 'README.md');
  requireText(failures, 'README.md', readme, '/mastering');
  requireText(failures, 'README.md', readme, 'yarn check');

  checkImplementationDocs({ root, failures, locales, defaultLocale });
}

function checkImplementationDocs({ root, failures, locales, defaultLocale }) {
  const config = read(root, '.vitepress/config.ts');

  const pages = locales.map((locale) => ({
    locale,
    file: `${docsPrefix(locale, defaultLocale)}/mastering-implementation.md`,
    title: implementationTitle(locale, defaultLocale),
    sidebarLink: localizedRoute(locale, defaultLocale, '/docs/mastering-implementation'),
    required: implementationRequiredTerms(locale, defaultLocale),
  }));

  for (const page of pages) {
    if (!fs.existsSync(path.join(root, page.file))) {
      failures.push(`missing implementation docs page ${page.file}`);
      continue;
    }
    const content = read(root, page.file);
    if (page.title) {
      requireText(failures, page.file, content, `title: ${page.title}`);
      requireText(failures, page.file, content, `# ${page.title}`);
    } else {
      requireFrontmatterTitleMatchesH1(failures, page.file, content);
    }
    requireText(failures, '.vitepress/config.ts', config, page.sidebarLink);
    for (const item of page.required) requireText(failures, page.file, content, item);
  }
}

function checkRoutes({ root, failures }) {
  const sources = ['src', '.vitepress/config.ts', 'scripts', 'package.json', 'README.md'];

  for (const file of listFiles(root, sources)) {
    if (file === 'scripts/check-mastering-docs.mjs') continue;
    if (file === 'scripts/check-built-routes.mjs') continue;
    const content = read(root, file);
    if (/mastering\/parameters|\/master\b|master\?mode|redirect|Redirect/.test(content)) {
      failures.push(`${file}: contains old mastering route, redirect, or parameter-page reference`);
    }
  }
}

function checkRouteFiles({ root, failures, locales, defaultLocale }) {
  const required = locales.map((locale) =>
    locale === defaultLocale ? 'src/mastering.md' : `src/${locale}/mastering.md`,
  );
  const forbidden = [
    'src/master.md',
    'src/ja/master.md',
    'src/docs/glossary/mastering/parameters',
    'src/ja/docs/glossary/mastering/parameters',
  ];

  for (const file of required) {
    if (!fs.existsSync(path.join(root, file))) failures.push(`missing required route file ${file}`);
  }
  for (const file of forbidden) {
    if (fs.existsSync(path.join(root, file)))
      failures.push(`forbidden old route or parameter path exists: ${file}`);
  }
}

function checkHelpPanelUsesDocsAsSource({ root, failures }) {
  const demoFile = 'src/demos/mastering/MasteringDemo.vue';
  const demoContent = read(root, demoFile);
  requireText(failures, demoFile, demoContent, "localizedPath('/docs/glossary/mastering')");

  const file = 'src/data/masteringHelp.ts';
  if (!fs.existsSync(path.join(root, file))) return;
  const content = read(root, file);

  requireText(failures, file, content, 'VitePress docs page is the source of truth');
  requireText(
    failures,
    file,
    content,
    'Long-form explanation, implementation notes, and related links are maintained in VitePress docs.',
  );
  requireText(
    failures,
    file,
    content,
    '長い解説、実装メモ、関連リンクは VitePress docs を正本として管理します。',
  );

  const forbiddenLongFormBlocks = [
    'Mastering works on the finished stereo mix',
    'What it cannot fix',
    'The five controls',
    'デジタルサンプル間で発生し得る',
    'リードボーカルが埋もれている',
  ];
  for (const phrase of forbiddenLongFormBlocks) {
    if (content.includes(phrase))
      failures.push(`${file}: in-app help appears to contain long-form docs prose: ${phrase}`);
  }

  for (const match of content.matchAll(
    /sectionText:\s*\{\s*en:\s*'([^']+)'\s*,\s*ja:\s*'([^']+)'/g,
  )) {
    const [, enText, jaText] = match;
    if (!/(docs|VitePress)/i.test(enText))
      failures.push(`${file}: sectionText.en does not point to docs`);
    if (!/(docs|VitePress|正本)/i.test(jaText))
      failures.push(`${file}: sectionText.ja does not point to docs`);
    if (enText.length > 260)
      failures.push(`${file}: sectionText.en is too long for an in-app index`);
    if (jaText.length > 160)
      failures.push(`${file}: sectionText.ja is too long for an in-app index`);
  }
}

export function requireText(failures, label, content, needle) {
  if (!content.includes(needle)) failures.push(`${label}: missing ${needle}`);
}

export function checkRelatedGuideLine(failures, label, content, locale, defaultLocale = 'en') {
  const heading = relatedGuideHeading(locale, defaultLocale);
  const prefix = heading ? `${heading}:` : null;
  const line = prefix
    ? content.split(/\r?\n/).find((item) => item.startsWith(prefix))
    : content
        .split(/\r?\n/)
        .find((item) => (item.match(/\.\/glossary\/[^)]+\.md/g) ?? []).length >= 3);
  if (!line) {
    failures.push(`${label}: missing ${prefix ?? 'related glossary guide line'}`);
    return;
  }
  requireMinimumGuideLinks(failures, label, line, 3);
}

function listLocaleNames(localesDir, defaultLocale) {
  if (!fs.existsSync(localesDir)) return [defaultLocale, 'ja'];
  const locales = fs
    .readdirSync(localesDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => path.basename(entry.name, '.json'));
  return [...new Set([defaultLocale, ...locales])].sort();
}

function docsPrefix(locale, defaultLocale) {
  return locale === defaultLocale ? 'src/docs' : `src/${locale}/docs`;
}

function localizedRoute(locale, defaultLocale, route) {
  return locale === defaultLocale ? route : `/${locale}${route}`;
}

function shouldRequireLocalizedPhrase(locale, defaultLocale) {
  return locale === defaultLocale || locale === 'ja';
}

function relatedGuideHeading(locale, defaultLocale = 'en') {
  if (!shouldRequireLocalizedPhrase(locale, defaultLocale)) return null;
  return locale === 'ja' ? '関連するマスタリングガイド' : 'Related mastering guides';
}

function browserMasteringTitle(locale, defaultLocale = 'en') {
  if (!shouldRequireLocalizedPhrase(locale, defaultLocale)) return null;
  return locale === 'ja' ? 'ブラウザ内マスタリング' : 'Browser Mastering';
}

function implementationTitle(locale, defaultLocale = 'en') {
  if (!shouldRequireLocalizedPhrase(locale, defaultLocale)) return null;
  return locale === 'ja' ? 'マスタリング実装' : 'Mastering Implementation';
}

function implementationRequiredTerms(locale, defaultLocale) {
  const shared = [
    localizedRoute(locale, defaultLocale, '/mastering'),
    './glossary/mastering/repair.md',
    './glossary/mastering/tone-air.md',
    './glossary/mastering/dynamics.md',
    './glossary/mastering/stereo-limiter-loudness.md',
    'masteringChainStereoWithProgress()',
    'yarn check:mastering-docs',
  ];
  if (!shouldRequireLocalizedPhrase(locale, defaultLocale)) return shared;
  return ['Mastering worker', 'libsonare WASM', 'JSON report', ...shared];
}

function requireFrontmatterTitleMatchesH1(failures, label, content) {
  const title = content.match(/^title:\s*(.+)$/m)?.[1]?.trim();
  const h1 = content.match(/^#\s+(.+)$/m)?.[1]?.trim();
  if (!title) failures.push(`${label}: missing frontmatter title`);
  if (!h1) failures.push(`${label}: missing h1 title`);
  if (title && h1 && title !== h1) failures.push(`${label}: frontmatter title does not match h1`);
}

export function requireMinimumGuideLinks(failures, label, content, minimum) {
  const guideLinkCount = (content.match(/\.\/glossary\/[^)]+\.md/g) ?? []).length;
  if (guideLinkCount < minimum) {
    failures.push(
      `${label}: expected at least ${minimum} glossary guide links, found ${guideLinkCount}`,
    );
  }
}

export function read(root, relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

export function listFiles(root, inputs) {
  const out = [];
  for (const input of inputs) {
    const fullPath = path.join(root, input);
    if (!fs.existsSync(fullPath)) continue;
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      for (const entry of fs.readdirSync(fullPath, { withFileTypes: true })) {
        if (entry.name === 'wasm' || entry.name === 'public') continue;
        out.push(...listFiles(root, [path.join(input, entry.name)]));
      }
    } else if (stat.isFile() && /\.(md|ts|js|mjs|json|vue)$/.test(input)) {
      out.push(input);
    }
  }
  return out.sort();
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const failures = checkMasteringDocs();

  if (failures.length > 0) {
    console.error('mastering docs check failed:');
    for (const failure of failures) console.error(`- ${failure}`);
    process.exit(1);
  }

  console.log('mastering docs check passed');
}
