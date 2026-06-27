import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { addLocale, localizeMarkdownLinks } from '../../scripts/add-locale.mjs';
import { checkI18nParity } from '../../scripts/check-i18n-parity.mjs';

const scriptPath = path.resolve('scripts/add-locale.mjs');

let workspaces: string[] = [];

function createWorkspace() {
  const root = mkdtempSync(path.join(tmpdir(), 'add-locale-'));
  workspaces.push(root);
  return root;
}

function write(root: string, relativePath: string, content: string) {
  const file = path.join(root, relativePath);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, content);
}

function read(root: string, relativePath: string) {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

afterEach(() => {
  for (const root of workspaces) rmSync(root, { recursive: true, force: true });
  workspaces = [];
});

describe('addLocale', () => {
  it('scaffolds locale messages and mirrored markdown without overwriting existing files', () => {
    const root = createWorkspace();
    write(root, 'src/locales/en.json', '{"common":{"save":"Save"}}\n');
    write(root, 'src/locales/ja.json', '{}\n');
    write(
      root,
      'src/index.md',
      '[Docs](/docs/introduction) [Asset](/demo-clips/example.wav) <a href="/demos">Demos</a>',
    );
    write(root, 'src/demos.md', '# Demos');
    write(root, 'src/docs/introduction.md', '[Home](/) [CLI](/docs/cli#usage)');
    write(root, 'src/docs/cli.md', '# CLI');
    write(root, 'src/ja/docs/introduction.md', '# Japanese page');

    const result = addLocale({ root, locale: 'fr' });

    expect(result.created.map((file) => path.relative(root, file)).sort()).toEqual([
      'src/fr/demos.md',
      'src/fr/docs/cli.md',
      'src/fr/docs/introduction.md',
      'src/fr/index.md',
      'src/locales/fr.json',
    ]);
    expect(read(root, 'src/locales/fr.json')).toBe('{"common":{"save":"Save"}}\n');
    expect(read(root, 'src/fr/index.md')).toContain('[Docs](/fr/docs/introduction)');
    expect(read(root, 'src/fr/index.md')).toContain('TODO(i18n): Translate this scaffolded page.');
    expect(read(root, 'src/fr/index.md')).toContain('[Asset](/demo-clips/example.wav)');
    expect(read(root, 'src/fr/index.md')).toContain('href="/fr/demos"');
    expect(read(root, 'src/fr/docs/introduction.md')).toContain('[Home](/fr/)');
    expect(read(root, 'src/fr/docs/introduction.md')).toContain('[CLI](/fr/docs/cli#usage)');

    write(root, 'src/fr/docs/cli.md', '# Translated CLI');
    const second = addLocale({ root, locale: 'fr' });
    expect(second.skipped.map((file) => path.relative(root, file))).toContain('src/fr/docs/cli.md');
    expect(read(root, 'src/fr/docs/cli.md')).toBe('# Translated CLI');
  });

  it('creates scaffolds that fail i18n checks until TODO markers are removed', () => {
    const root = createWorkspace();
    write(root, 'src/locales/en.json', '{"common":{"save":"Save"}}\n');
    write(root, 'src/index.md', '# Home');
    write(root, 'src/docs/guide.md', '# Guide');

    addLocale({ root, locale: 'fr' });

    expect(checkI18nParity({ root })).toEqual(
      expect.arrayContaining([
        'docs: remove scaffold translation TODO in src/fr/docs/guide.md',
        'docs: remove scaffold translation TODO in src/fr/index.md',
      ]),
    );
  });

  it('supports dry-run without writing files', () => {
    const root = createWorkspace();
    write(root, 'src/locales/en.json', '{}\n');
    write(root, 'src/index.md', '# Home');

    const result = addLocale({ root, locale: 'de', dryRun: true });

    expect(result.created.map((file) => path.relative(root, file)).sort()).toEqual([
      'src/de/index.md',
      'src/locales/de.json',
    ]);
    expect(() => read(root, 'src/locales/de.json')).toThrow();
  });

  it('can scaffold from an existing non-default locale', () => {
    const root = createWorkspace();
    write(root, 'src/locales/en.json', '{}\n');
    write(root, 'src/locales/ja.json', '{"common":{"save":"保存"}}\n');
    write(root, 'src/index.md', '[Intro](/docs/introduction)');
    write(root, 'src/docs/introduction.md', '# English');
    write(root, 'src/ja/index.md', '[Intro](/ja/docs/introduction)');
    write(root, 'src/ja/docs/introduction.md', '[Home](/ja/)');

    const result = addLocale({ root, locale: 'fr-CA', sourceLocale: 'ja' });

    expect(result.created.map((file) => path.relative(root, file)).sort()).toEqual([
      'src/fr-CA/docs/introduction.md',
      'src/fr-CA/index.md',
      'src/locales/fr-CA.json',
    ]);
    expect(read(root, 'src/locales/fr-CA.json')).toBe('{"common":{"save":"保存"}}\n');
    expect(read(root, 'src/fr-CA/index.md')).toContain('[Intro](/fr-CA/docs/introduction)');
    expect(read(root, 'src/fr-CA/docs/introduction.md')).toContain('[Home](/fr-CA/)');
  });

  it('fills glossary manifest labels and titles for the new locale', () => {
    const root = createWorkspace();
    write(root, 'src/locales/en.json', '{}\n');
    write(root, 'src/locales/ja.json', '{}\n');
    write(root, 'src/index.md', '# Home');
    write(
      root,
      'scripts/glossary/manifest.json',
      JSON.stringify({
        categories: [
          {
            id: 'concepts',
            label: { en: 'Concepts', ja: '概念' },
            entries: [
              {
                id: 'audio-basics',
                status: 'published',
                title: { en: 'Audio Basics', ja: 'オーディオ基礎' },
              },
            ],
          },
        ],
      }),
    );

    const result = addLocale({ root, locale: 'fr', sourceLocale: 'ja' });
    const manifest = JSON.parse(read(root, 'scripts/glossary/manifest.json'));

    expect(result.created.map((file) => path.relative(root, file))).toContain(
      'scripts/glossary/manifest.json',
    );
    expect(manifest.categories[0].label.fr).toBe('概念');
    expect(manifest.categories[0].entries[0].title.fr).toBe('オーディオ基礎');
  });

  it('rejects invalid or source locales', () => {
    const root = createWorkspace();
    write(root, 'src/locales/en.json', '{}\n');

    expect(() => addLocale({ root, locale: 'English' })).toThrow('Invalid locale');
    expect(() => addLocale({ root, locale: 'en' })).toThrow('already the source locale');
  });
});

describe('localizeMarkdownLinks', () => {
  it('only prefixes links that point to known markdown routes', () => {
    const routeSet = new Set(['/', '/docs/intro']);
    const content = '[Intro](/docs/intro) [File](/assets/app.js) [External](https://example.com)';

    expect(localizeMarkdownLinks(content, 'fr', routeSet, ['en', 'ja', 'fr'])).toBe(
      '[Intro](/fr/docs/intro) [File](/assets/app.js) [External](https://example.com)',
    );
  });

  it('rewrites source-locale-prefixed links when scaffolding from a localized source', () => {
    const routeSet = new Set(['/', '/docs/intro']);
    const content = '[Intro](/ja/docs/intro) [Japanese](/ja-only)';

    expect(localizeMarkdownLinks(content, 'fr', routeSet, ['en', 'ja', 'fr'], 'ja')).toBe(
      '[Intro](/fr/docs/intro) [Japanese](/ja-only)',
    );
  });
});

describe('add-locale CLI', () => {
  it('prints help text', () => {
    const result = spawnSync(process.execPath, [scriptPath, '--help'], {
      encoding: 'utf8',
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Usage: yarn add:locale <locale>');
    expect(result.stdout).toContain('yarn add:locale fr-CA --from ja');
  });

  it('prints verbose dry-run file paths', () => {
    const root = createWorkspace();
    write(root, 'src/locales/en.json', '{}\n');
    write(root, 'src/index.md', '# Home');

    const result = spawnSync(process.execPath, [scriptPath, 'it', '--dry-run', '--verbose'], {
      cwd: root,
      encoding: 'utf8',
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('locale it: would create 2, skipped 0');
    expect(result.stdout).toContain('Would create:');
    expect(result.stdout).toContain('src/locales/it.json');
    expect(result.stdout).toContain('src/it/index.md');
  });

  it('accepts --from=value syntax', () => {
    const root = createWorkspace();
    write(root, 'src/locales/en.json', '{}\n');
    write(root, 'src/locales/ja.json', '{"common":{"save":"保存"}}\n');
    write(root, 'src/ja/index.md', '# ホーム');

    const result = spawnSync(process.execPath, [scriptPath, 'fr', '--from=ja', '--dry-run'], {
      cwd: root,
      encoding: 'utf8',
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('locale fr: would create 2, skipped 0');
  });

  it('fails when --from has no value', () => {
    const result = spawnSync(process.execPath, [scriptPath, 'fr', '--from'], {
      encoding: 'utf8',
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Missing value for --from');
  });

  it('fails on unknown options and extra locale arguments', () => {
    const unknown = spawnSync(process.execPath, [scriptPath, 'fr', '--unknown'], {
      encoding: 'utf8',
    });
    expect(unknown.status).toBe(1);
    expect(unknown.stderr).toContain('Unknown option: --unknown');

    const extra = spawnSync(process.execPath, [scriptPath, 'fr', 'de'], {
      encoding: 'utf8',
    });
    expect(extra.status).toBe(1);
    expect(extra.stderr).toContain('Expected one locale, received: fr, de');
  });
});
