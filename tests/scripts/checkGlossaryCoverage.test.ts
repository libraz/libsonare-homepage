import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  checkGlossaryCoverage,
  checkPublishedPage,
  glossaryEntries,
  listMarkdownFiles,
  parseFrontmatter,
} from '../../scripts/check-glossary-coverage.mjs';

const scriptPath = path.resolve('scripts/check-glossary-coverage.mjs');

let workspaces: string[] = [];

function createWorkspace() {
  const root = mkdtempSync(path.join(tmpdir(), 'check-glossary-coverage-'));
  workspaces.push(root);
  return root;
}

function writeFile(root: string, relativePath: string, content: string) {
  const filePath = path.join(root, relativePath);
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, content);
  return filePath;
}

function writeJson(root: string, relativePath: string, value: unknown) {
  writeFile(root, relativePath, JSON.stringify(value));
}

function manifest() {
  return {
    categories: [
      {
        id: 'concepts',
        entries: [
          {
            id: 'audio-basics',
            status: 'published',
            title: { en: 'Audio basics', ja: 'オーディオ基礎' },
          },
          {
            id: 'planned',
            status: 'planned',
            title: { en: 'Planned', ja: '予定' },
          },
          {
            id: 'custom',
            path: 'mixing/custom.md',
            status: 'published',
            title: { en: 'Custom', ja: 'カスタム' },
          },
        ],
      },
    ],
  };
}

function publishedPage(title: string) {
  const body = 'Long reviewed public body. '.repeat(80);
  const details = 'Implementation details stay concrete and useful for maintainers. '.repeat(3);
  return [
    '---',
    `title: "${title}"`,
    'description: "Detailed glossary page."',
    '---',
    `# ${title}`,
    '',
    body,
    '',
    'Related: [One](../one.md), [Two](../two.md)',
    '',
    '::: details Implementation notes',
    details,
    ':::',
  ].join('\n');
}

function writeValidProject(root: string) {
  const data = manifest();
  writeJson(root, 'scripts/glossary/manifest.json', data);
  for (const entry of glossaryEntries(data).filter((item) => item.status === 'published')) {
    writeFile(root, `src/docs/glossary/${entry.path}`, publishedPage(entry.title.en));
    writeFile(root, `src/ja/docs/glossary/${entry.path}`, publishedPage(entry.title.ja));
  }
  writeFile(
    root,
    'src/docs/glossary.md',
    ['./glossary/concepts/audio-basics.md', './glossary/mixing/custom.md'].join('\n'),
  );
  writeFile(
    root,
    'src/ja/docs/glossary.md',
    ['./glossary/concepts/audio-basics.md', './glossary/mixing/custom.md'].join('\n'),
  );
  writeFile(
    root,
    '.vitepress/config.ts',
    [
      "link: '/docs/glossary/concepts/audio-basics'",
      "link: '/ja/docs/glossary/concepts/audio-basics'",
      "link: '/docs/glossary/mixing/custom'",
      "link: '/ja/docs/glossary/mixing/custom'",
    ].join('\n'),
  );
}

describe('check-glossary-coverage script helpers', () => {
  afterEach(() => {
    for (const workspace of workspaces) {
      rmSync(workspace, { recursive: true, force: true });
    }
    workspaces = [];
  });

  it('normalizes manifest entries with default and custom paths', () => {
    expect(
      glossaryEntries(manifest()).map((entry) => ({
        category: entry.category,
        id: entry.id,
        path: entry.path,
        status: entry.status,
      })),
    ).toEqual([
      {
        category: 'concepts',
        id: 'audio-basics',
        path: 'concepts/audio-basics.md',
        status: 'published',
      },
      { category: 'concepts', id: 'planned', path: 'concepts/planned.md', status: 'planned' },
      { category: 'concepts', id: 'custom', path: 'mixing/custom.md', status: 'published' },
    ]);
  });

  it('parses quoted frontmatter and lists nested markdown files', () => {
    const root = createWorkspace();
    writeFile(root, 'src/docs/glossary/a.md', '# A');
    writeFile(root, 'src/docs/glossary/nested/b.md', '# B');

    expect(parseFrontmatter('---\ntitle: "Audio"\ndescription: Test\n---\n# Audio')).toEqual({
      title: 'Audio',
      description: 'Test',
    });
    expect(listMarkdownFiles(path.join(root, 'src/docs/glossary'))).toEqual([
      'a.md',
      'nested/b.md',
    ]);
  });

  it('passes for complete published glossary pages and reports published/planned counts', () => {
    const root = createWorkspace();
    writeValidProject(root);

    expect(checkGlossaryCoverage({ root })).toEqual({
      failures: [],
      publishedCount: 2,
      plannedCount: 1,
    });
  });

  it('reports thin published page content requirements', () => {
    const root = createWorkspace();
    const pagePath = writeFile(
      root,
      'src/docs/glossary/thin.md',
      ['---', 'title: Thin', '---', 'Short body without related links or details.'].join('\n'),
    );
    const failures: string[] = [];

    checkPublishedPage(failures, 'en thin.md', pagePath);

    expect(failures).toEqual([
      'en thin.md: missing frontmatter description',
      'en thin.md: missing H1',
      'en thin.md: body is too short for a reviewed public page',
      'en thin.md: missing related links or too few related links',
      'en thin.md: missing implementation details block',
    ]);
  });

  it('reports manifest, page listing, index and sidebar coverage gaps', () => {
    const root = createWorkspace();
    writeJson(root, 'scripts/glossary/manifest.json', {
      categories: [
        {
          id: 'concepts',
          entries: [
            { status: 'published', title: { en: 'Missing id', ja: 'IDなし' } },
            { id: 'missing-title', status: 'published', title: { en: 'Missing JA' } },
          ],
        },
      ],
    });
    writeFile(root, 'src/docs/glossary/orphan.md', publishedPage('Orphan'));
    writeFile(root, 'src/ja/docs/glossary.md', '');
    writeFile(root, 'src/docs/glossary.md', '');
    writeFile(root, '.vitepress/config.ts', '');

    expect(checkGlossaryCoverage({ root }).failures).toEqual(
      expect.arrayContaining([
        'concepts: missing id',
        'missing-title: missing title.en/title.ja',
        'published entry missing en page: concepts/undefined.md',
        'published entry missing ja page: concepts/undefined.md',
        'published entry missing en page: concepts/missing-title.md',
        'published entry missing ja page: concepts/missing-title.md',
        'en page not listed in manifest: orphan.md',
        'en glossary index missing link: ./glossary/concepts/undefined.md',
        'ja glossary index missing link: ./glossary/concepts/missing-title.md',
        'en sidebar missing glossary link: /docs/glossary/concepts/missing-title',
        'ja sidebar missing glossary link: /ja/docs/glossary/concepts/missing-title',
      ]),
    );
  });

  it('keeps CLI success and failure output stable', () => {
    const passingRoot = createWorkspace();
    writeValidProject(passingRoot);

    const passing = spawnSync(process.execPath, [scriptPath], {
      cwd: passingRoot,
      encoding: 'utf8',
    });

    expect(passing.status).toBe(0);
    expect(passing.stdout).toContain('glossary coverage check passed: 2 published, 1 planned');
    expect(passing.stderr).toBe('');

    const failingRoot = createWorkspace();
    writeJson(failingRoot, 'scripts/glossary/manifest.json', {
      categories: [
        {
          id: 'concepts',
          entries: [{ id: 'missing', status: 'published', title: { en: 'Missing', ja: '不足' } }],
        },
      ],
    });
    writeFile(failingRoot, 'src/docs/glossary.md', '');
    writeFile(failingRoot, 'src/ja/docs/glossary.md', '');
    writeFile(failingRoot, '.vitepress/config.ts', '');

    const failing = spawnSync(process.execPath, [scriptPath], {
      cwd: failingRoot,
      encoding: 'utf8',
    });

    expect(failing.status).toBe(1);
    expect(failing.stdout).toBe('');
    expect(failing.stderr).toContain('glossary coverage check failed:');
    expect(failing.stderr).toContain('published entry missing en page: concepts/missing.md');
  });
});
