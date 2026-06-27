#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const DEFAULT_LOCALE = 'en';
const TODO_MARKER = '<!-- TODO(i18n): Translate this scaffolded page. -->';
const HELP_TEXT = `Usage: yarn add:locale <locale> [options]

Scaffold locale JSON and mirrored Markdown pages.

Options:
  --from <locale>          Source locale to copy from (default: en)
  --source-locale <locale> Alias for --from
  --dry-run                Show what would be created without writing files
  --force                  Overwrite existing target files
  --verbose                Print created/skipped file paths
  --help                   Show this help

Examples:
  yarn add:locale fr
  yarn add:locale fr-CA --from ja
  yarn add:locale de --dry-run --verbose`;

function isValidLocale(locale) {
  return /^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(locale);
}

function listFiles(dir, predicate, base = dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...listFiles(full, predicate, base));
    } else if (predicate(full)) {
      out.push(path.relative(base, full));
    }
  }
  return out.sort();
}

function listLocaleNames(localesDir) {
  if (!fs.existsSync(localesDir)) return [DEFAULT_LOCALE];
  return fs
    .readdirSync(localesDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => path.basename(entry.name, '.json'))
    .sort();
}

function routeForMarkdown(relativePath) {
  const withoutExtension = relativePath.replace(/\.md$/, '');
  if (withoutExtension === 'index') return '/';
  if (withoutExtension.endsWith('/index')) return `/${withoutExtension.replace(/\/index$/, '')}`;
  return `/${withoutExtension}`;
}

function sourceRootForLocale(srcDir, locale) {
  return locale === DEFAULT_LOCALE ? srcDir : path.join(srcDir, locale);
}

function routeCandidatesForHref(href) {
  const [withoutHash] = href.split('#');
  const [withoutQuery] = withoutHash.split('?');
  const normalized = withoutQuery.replace(/\/$/, '') || '/';
  return normalized.endsWith('.html') ? normalized.replace(/\.html$/, '') : normalized;
}

function localizeHref(href, locale, routeSet, knownLocales, sourceLocale) {
  if (!href.startsWith('/') || href.startsWith('//')) return href;
  const firstSegment = href.split('/')[1];
  let targetHref = href;
  if (firstSegment === locale) return href;
  if (sourceLocale !== DEFAULT_LOCALE && firstSegment === sourceLocale) {
    targetHref = href.replace(new RegExp(`^/${sourceLocale}`), '') || '/';
  } else if (knownLocales.includes(firstSegment)) {
    return href;
  }
  const candidate = routeCandidatesForHref(targetHref);
  if (!routeSet.has(candidate)) return href;
  return `/${locale}${targetHref}`;
}

export function localizeMarkdownLinks(
  content,
  locale,
  routeSet,
  knownLocales,
  sourceLocale = DEFAULT_LOCALE,
) {
  return content
    .replace(/\]\((\/[^)\s]*)\)/g, (_match, href) => {
      return `](${localizeHref(href, locale, routeSet, knownLocales, sourceLocale)})`;
    })
    .replace(/\bhref="(\/[^"]+)"/g, (_match, href) => {
      return `href="${localizeHref(href, locale, routeSet, knownLocales, sourceLocale)}"`;
    });
}

function scaffoldMarkdown(content, locale, routeSet, knownLocales, sourceLocale) {
  const localized = localizeMarkdownLinks(content, locale, routeSet, knownLocales, sourceLocale);
  return localized.startsWith(TODO_MARKER) ? localized : `${TODO_MARKER}\n\n${localized}`;
}

function writeFileIfNeeded(file, content, { force, dryRun, created, skipped }) {
  if (fs.existsSync(file) && !force) {
    skipped.push(file);
    return;
  }
  if (!dryRun) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content);
  }
  created.push(file);
}

function copyLocalizedValue(container, locale, sourceLocale) {
  if (!container || typeof container !== 'object') return false;
  if (container[locale] !== undefined) return false;
  const sourceValue = container[sourceLocale] ?? container[DEFAULT_LOCALE];
  if (sourceValue === undefined) return false;
  container[locale] = sourceValue;
  return true;
}

function scaffoldGlossaryManifest({ root, locale, sourceLocale, force, dryRun, created, skipped }) {
  const manifestPath = path.join(root, 'scripts/glossary/manifest.json');
  if (!fs.existsSync(manifestPath)) return;

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  let changed = false;
  for (const category of manifest.categories ?? []) {
    changed = copyLocalizedValue(category.label, locale, sourceLocale) || changed;
    for (const entry of category.entries ?? []) {
      changed = copyLocalizedValue(entry.title, locale, sourceLocale) || changed;
    }
  }
  if (!changed && !force) {
    skipped.push(manifestPath);
    return;
  }
  writeFileIfNeeded(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, {
    force: true,
    dryRun,
    created,
    skipped,
  });
}

export function addLocale({
  root = process.cwd(),
  locale,
  sourceLocale = DEFAULT_LOCALE,
  force = false,
  dryRun = false,
} = {}) {
  if (!locale) throw new Error('Missing locale. Usage: yarn add:locale <locale>');
  if (!isValidLocale(locale)) throw new Error(`Invalid locale: ${locale}`);
  if (locale === sourceLocale) throw new Error(`Locale ${locale} is already the source locale`);

  const srcDir = path.join(root, 'src');
  const localesDir = path.join(srcDir, 'locales');
  const sourceJson = path.join(localesDir, `${sourceLocale}.json`);
  const targetJson = path.join(localesDir, `${locale}.json`);
  if (!fs.existsSync(sourceJson)) throw new Error(`Missing source locale JSON: ${sourceJson}`);

  const existingLocales = listLocaleNames(localesDir);
  const knownLocales = [...new Set([...existingLocales, locale])];
  const sourceRoot = sourceRootForLocale(srcDir, sourceLocale);
  const markdownFiles = listFiles(
    sourceRoot,
    (file) =>
      file.endsWith('.md') &&
      !knownLocales.includes(path.relative(sourceRoot, file).split(path.sep)[0]),
  );
  const routeSet = new Set(markdownFiles.map(routeForMarkdown));
  const created = [];
  const skipped = [];

  writeFileIfNeeded(targetJson, fs.readFileSync(sourceJson, 'utf8'), {
    force,
    dryRun,
    created,
    skipped,
  });

  for (const relativePath of markdownFiles) {
    const sourceFile = path.join(sourceRoot, relativePath);
    const targetFile = path.join(srcDir, locale, relativePath);
    const content = scaffoldMarkdown(
      fs.readFileSync(sourceFile, 'utf8'),
      locale,
      routeSet,
      knownLocales,
      sourceLocale,
    );
    writeFileIfNeeded(targetFile, content, { force, dryRun, created, skipped });
  }

  scaffoldGlossaryManifest({ root, locale, sourceLocale, force, dryRun, created, skipped });

  return { locale, created, skipped };
}

function parseArgs(argv) {
  const flags = new Set();
  const positional = [];
  let sourceLocale = DEFAULT_LOCALE;

  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg === '--help' || arg === '-h') return { help: true };
    if (arg === '--from' || arg === '--source-locale') {
      sourceLocale = argv[index + 1];
      if (!sourceLocale || sourceLocale.startsWith('--')) {
        throw new Error(
          'Missing value for --from. Usage: yarn add:locale <locale> --from <locale>',
        );
      }
      index++;
      continue;
    }
    if (arg.startsWith('--from=') || arg.startsWith('--source-locale=')) {
      sourceLocale = arg.slice(arg.indexOf('=') + 1);
      if (!sourceLocale) {
        throw new Error(
          'Missing value for --from. Usage: yarn add:locale <locale> --from <locale>',
        );
      }
      continue;
    }
    if (['--force', '--dry-run', '--verbose'].includes(arg)) {
      flags.add(arg);
      continue;
    }
    if (arg.startsWith('--')) throw new Error(`Unknown option: ${arg}`);
    positional.push(arg);
  }

  if (positional.length > 1) {
    throw new Error(`Expected one locale, received: ${positional.join(', ')}`);
  }

  return {
    locale: positional[0],
    sourceLocale,
    force: flags.has('--force'),
    dryRun: flags.has('--dry-run'),
    verbose: flags.has('--verbose'),
  };
}

function relativeList(root, files) {
  return files.map((file) => `  - ${path.relative(root, file)}`).join('\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) {
      console.log(HELP_TEXT);
      process.exit(0);
    }
    const result = addLocale(options);
    const action = options.dryRun ? 'would create' : 'created';
    console.log(
      `locale ${result.locale}: ${action} ${result.created.length}, skipped ${result.skipped.length}`,
    );
    if (options.verbose) {
      if (result.created.length > 0) {
        console.log(
          `\n${options.dryRun ? 'Would create' : 'Created'}:\n${relativeList(process.cwd(), result.created)}`,
        );
      }
      if (result.skipped.length > 0) {
        console.log(`\nSkipped:\n${relativeList(process.cwd(), result.skipped)}`);
      }
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
