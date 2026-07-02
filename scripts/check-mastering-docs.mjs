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
  // Function declarations and the public export list live in index.d.ts.
  // The worklet entry is now a narrower AudioWorklet bridge and does not carry
  // the full high-level mastering API surface.
  const indexDts = read(root, 'src/wasm/index.d.ts');
  const exportLine = (indexDts.match(/^export \{.*\}(?: from '[^']+')?;$/gm) ?? []).join('\n');
  for (const api of jsApis) {
    requireText(failures, 'src/wasm/index.d.ts', indexDts, `declare function ${api}(`);
    requireText(failures, 'src/wasm/index.d.ts export list', exportLine, api);
  }
}

export function extractMasteringJsApis({ root, failures = [] }) {
  const dts = read(root, 'src/wasm/index.d.ts');
  const apis = [...dts.matchAll(/^declare function ((?:mastering|masterAudio)[A-Za-z0-9]*)\(/gm)]
    .map((match) => match[1])
    .sort();
  if (apis.length === 0) failures.push('src/wasm/index.d.ts: no mastering JS APIs found');
  return apis;
}

function checkDocs({ root, failures, jsApis, locales, defaultLocale }) {
  for (const locale of locales) {
    const prefix = docsPrefix(locale, defaultLocale);

    const jsDoc = read(root, `${prefix}/js-api.md`);
    for (const api of jsApis) requireText(failures, `${prefix}/js-api.md`, jsDoc, api);
    requireText(failures, `${prefix}/js-api.md`, jsDoc, 'progress * 100');
    requireText(failures, `${prefix}/js-api.md`, jsDoc, 'stage');
    checkRelatedGuideLine(failures, `${prefix}/js-api.md`, jsDoc, locale, defaultLocale);

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

  const runtimeDocNames = ['js-api.md', 'python-api.md', 'cli.md', 'native-bindings.md', 'wasm.md'];
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
  const demoFile = 'src/components/MasteringDemo.vue';
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
