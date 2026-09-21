import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  checkTerms,
  collectDocFiles,
  maskGloss,
  maskNonProse,
  pathMatchesException,
  validateReason,
} from '../../scripts/check-terms.mjs';

const scriptPath = path.resolve('scripts/check-terms.mjs');

let workspaces: string[] = [];

function createWorkspace() {
  const root = mkdtempSync(path.join(tmpdir(), 'check-terms-'));
  workspaces.push(root);
  return root;
}

function writeFile(root: string, relativePath: string, content: string) {
  const filePath = path.join(root, relativePath);
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, content);
  return filePath;
}

const fixtureEntries = [
  {
    correct: 'canonical',
    forbidden: ['oldspelling'],
    reason: 'oldspelling and canonical name the same referent.',
    locale: 'en',
    exceptions: ['src/docs/excepted.md'],
  },
  {
    correct: null,
    forbidden: ['undecidedterm'],
    reason: 'Split not yet settled.',
    locale: 'en',
    exceptions: [],
  },
  {
    correct: 'x',
    forbidden: [],
    reason: 'Placeholder, filled in once the replacement spellings exist.',
    locale: 'en',
    exceptions: [],
  },
  {
    correct: 'y',
    forbidden: ['shouldfail'],
    locale: 'en',
    exceptions: [],
  },
  {
    correct: 'canonical2',
    forbidden: ['vendorterm'],
    reason: 'vendorterm is only correct under the vendored directory.',
    locale: 'en',
    exceptions: ['src/docs/vendor'],
  },
];

function writeFixtureProject(root: string) {
  writeFile(root, 'scripts/terms.json', JSON.stringify(fixtureEntries));
  writeFile(root, 'src/docs/prose.md', 'This page uses oldspelling in prose.\n');
  writeFile(root, 'src/docs/fenced.md', ['# Title', '```', 'oldspelling', '```', ''].join('\n'));
  writeFile(root, 'src/docs/inline.md', 'Use `oldspelling` as an identifier.\n');
  writeFile(root, 'src/docs/link.md', 'See [docs](./oldspelling-page.md) for more.\n');
  writeFile(root, 'src/docs/excepted.md', 'This exempted page mentions oldspelling anyway.\n');
  writeFile(root, 'src/docs/vendor/thing.md', 'Vendored prose repeats vendorterm here.\n');
  writeFile(root, 'src/docs/other.md', 'Non-vendor prose uses vendorterm too.\n');
  writeFile(root, 'src/docs/undecided.md', 'This page mentions undecidedterm somewhere.\n');
  writeFile(root, 'src/docs/shouldfail.md', 'This page contains shouldfail spelled out.\n');
}

describe('check-terms script', () => {
  afterEach(() => {
    for (const workspace of workspaces) {
      rmSync(workspace, { recursive: true, force: true });
    }
    workspaces = [];
  });

  it('flags prose, skips masked regions and excepted paths, and separates unresolved hits', () => {
    const root = createWorkspace();
    writeFixtureProject(root);

    expect(checkTerms({ root, termsPath: path.join(root, 'scripts/terms.json') })).toEqual({
      failures: [
        'src/docs/prose.md:1 uses "oldspelling", expected "canonical"',
        'scripts/terms.json: entry 3 (correct="y") is missing a required reason',
        'src/docs/other.md:1 uses "vendorterm", expected "canonical2"',
      ],
      unresolved: ['src/docs/undecided.md:1 uses "undecidedterm", expected "undecided"'],
    });
  });

  it('masks fenced code blocks, inline code spans, HTML comments, and link URLs', () => {
    const masked = maskNonProse(
      [
        '```js',
        'const term = "hideme";',
        '```',
        'Use `hideme` inline.',
        '<!-- hideme in a comment -->',
        '[label](./hideme.md)',
        'hideme in prose.',
      ].join('\n'),
    );

    expect(masked.split('\n').filter((line) => line.includes('hideme'))).toEqual([
      'hideme in prose.',
    ]);
  });

  it('masks a first-use reading gloss but still flags the bare variant beside it', () => {
    expect(
      maskGloss('True Peak（トゥルーピーク）はサンプル間ピーク', 'True Peak', 'トゥルーピーク'),
    ).not.toContain('トゥルーピーク');
    expect(maskGloss('True Peak (トゥルーピーク) は', 'True Peak', 'トゥルーピーク')).not.toContain(
      'トゥルーピーク',
    );
    // The gloss is masked; a second, bare mention on the same line is not.
    expect(
      maskGloss(
        'True Peak（トゥルーピーク）と、後半のトゥルーピーク',
        'True Peak',
        'トゥルーピーク',
      ),
    ).toContain('トゥルーピーク');
    // A parenthetical that is not preceded by the canonical form is a variant.
    expect(maskGloss('ラウドネス（トゥルーピーク）', 'True Peak', 'トゥルーピーク')).toContain(
      'トゥルーピーク',
    );
    // Line length is preserved so reported columns and lengths stay meaningful.
    const line = 'True Peak（トゥルーピーク）は';
    expect(maskGloss(line, 'True Peak', 'トゥルーピーク')).toHaveLength(line.length);
  });

  it('leaves a line untouched when the entry has no canonical spelling', () => {
    const line = 'サンプリングレート（トゥルーピーク）';
    expect(maskGloss(line, null, 'トゥルーピーク')).toBe(line);
  });

  it('matches an exact exception path but not an unrelated file', () => {
    expect(pathMatchesException('src/docs/excepted.md', ['src/docs/excepted.md'])).toBe(true);
    expect(pathMatchesException('src/docs/other.md', ['src/docs/excepted.md'])).toBe(false);
  });

  it('matches a directory-prefix exception', () => {
    expect(pathMatchesException('src/docs/vendor/thing.md', ['src/docs/vendor'])).toBe(true);
    expect(pathMatchesException('src/docs/vendor/nested/thing.md', ['src/docs/vendor'])).toBe(true);
    expect(pathMatchesException('src/docs/vendored-other.md', ['src/docs/vendor'])).toBe(false);
  });

  it('requires a non-empty reason on every entry', () => {
    expect(validateReason({ correct: 'a', reason: 'because' }, 0)).toBeNull();
    expect(validateReason({ correct: 'a', reason: '   ' }, 1)).toContain('entry 1');
    expect(validateReason({ correct: 'a' }, 2)).toContain('entry 2');
  });

  it('tags doc pages with en/ja by directory and finds nested files', () => {
    const root = createWorkspace();
    writeFile(root, 'src/docs/top.md', '# Top');
    writeFile(root, 'src/docs/nested/deep.md', '# Deep');
    writeFile(root, 'src/mastering.md', '# Mastering');
    writeFile(root, 'src/ja/docs/top.md', '# トップ');
    writeFile(root, 'src/ja/mastering.md', '# マスタリング');

    expect(collectDocFiles(root)).toEqual([
      { locale: 'en', relPath: 'src/docs/nested/deep.md' },
      { locale: 'en', relPath: 'src/docs/top.md' },
      { locale: 'ja', relPath: 'src/ja/docs/top.md' },
      { locale: 'ja', relPath: 'src/ja/mastering.md' },
      { locale: 'en', relPath: 'src/mastering.md' },
    ]);
  });

  it('keeps CLI success and failure output stable', () => {
    const passingRoot = createWorkspace();
    writeFile(passingRoot, 'scripts/terms.json', JSON.stringify([]));
    writeFile(passingRoot, 'src/docs/clean.md', 'Nothing to flag here.\n');

    const passing = spawnSync(process.execPath, [scriptPath], {
      cwd: passingRoot,
      encoding: 'utf8',
    });

    expect(passing.status).toBe(0);
    expect(passing.stdout).toContain('terminology check passed');
    expect(passing.stderr).toBe('');

    const failingRoot = createWorkspace();
    writeFixtureProject(failingRoot);

    const failing = spawnSync(process.execPath, [scriptPath], {
      cwd: failingRoot,
      encoding: 'utf8',
    });

    expect(failing.status).toBe(1);
    expect(failing.stdout).toContain('unresolved terms (not fatal):');
    expect(failing.stderr).toContain('terminology check failed:');
    expect(failing.stderr).toContain('src/docs/prose.md:1 uses "oldspelling"');
  });
});
