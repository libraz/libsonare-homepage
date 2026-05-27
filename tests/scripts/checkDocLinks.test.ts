import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  checkDocLinks,
  extractHeadingAnchors,
  extractMarkdownLinks,
  resolveTargetPath,
  shouldCheck,
  slugifyHeading,
} from '../../scripts/check-doc-links.mjs';

const scriptPath = path.resolve('scripts/check-doc-links.mjs');

let workspaces: string[] = [];

function createWorkspace() {
  const root = mkdtempSync(path.join(tmpdir(), 'check-doc-links-'));
  workspaces.push(root);
  return root;
}

function writeFile(root: string, relativePath: string, content: string) {
  const filePath = path.join(root, relativePath);
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, content);
  return filePath;
}

describe('check-doc-links script helpers', () => {
  afterEach(() => {
    for (const workspace of workspaces) {
      rmSync(workspace, { recursive: true, force: true });
    }
    workspaces = [];
  });

  it('extracts inline markdown links while ignoring images', () => {
    expect(
      extractMarkdownLinks(
        [
          '[Guide](./guide.md)',
          '![Image](./image.png)',
          '[With title](./target "Title")',
          '[External](https://example.test)',
        ].join('\n'),
      ),
    ).toEqual([{ href: './guide.md' }, { href: './target' }, { href: 'https://example.test' }]);
  });

  it('matches VitePress-style heading anchors including duplicates and inline code', () => {
    expect(slugifyHeading('Using `Audio` <span>API</span>!')).toBe('using-audio-api');
    expect([
      ...extractHeadingAnchors(
        ['# Intro', '## Using `Audio` <span>API</span>!', '## Intro'].join('\n'),
      ),
    ]).toEqual(['intro', 'using-audio-api', 'intro-1']);
  });

  it('passes for existing relative links, root links, anchors and VitePress config links', () => {
    const root = createWorkspace();
    writeFile(
      root,
      'src/index.md',
      [
        '# Home',
        '[Guide](./docs/guide.md#details)',
        '[Japanese](/ja/docs/guide#詳細)',
        '[External](https://example.test/ignored)',
        '[Mail](mailto:team@example.test)',
      ].join('\n'),
    );
    writeFile(root, 'src/docs/guide.md', ['# Guide', '## Details'].join('\n'));
    writeFile(root, 'src/ja/docs/guide.md', ['# ガイド', '## 詳細'].join('\n'));
    writeFile(
      root,
      '.vitepress/config.ts',
      "export default { themeConfig: { nav: [{ link: '/docs/guide#details' }] } }",
    );

    expect(checkDocLinks({ root })).toEqual([]);
  });

  it('reports missing pages and missing anchors from markdown and config links', () => {
    const root = createWorkspace();
    writeFile(
      root,
      'src/index.md',
      [
        '# Home',
        '[Missing](./docs/missing.md)',
        '[Bad anchor](./docs/guide.md#missing-anchor)',
      ].join('\n'),
    );
    writeFile(root, 'src/docs/guide.md', ['# Guide', '## Existing Anchor'].join('\n'));
    writeFile(
      root,
      '.vitepress/config.ts',
      "export default { themeConfig: { sidebar: [{ link: '/docs/guide#also-missing' }] } }",
    );

    expect(checkDocLinks({ root })).toEqual([
      'src/index.md links to missing page ./docs/missing.md',
      'src/index.md links to missing anchor ./docs/guide.md#missing-anchor',
      '.vitepress/config.ts links to missing anchor /docs/guide#also-missing',
    ]);
  });

  it('resolves root and extensionless links under src only', () => {
    const root = createWorkspace();
    const sourcePath = writeFile(root, 'src/docs/source.md', '# Source');
    writeFile(root, 'src/docs/page.md', '# Page');
    writeFile(root, 'src/ja/docs/page.md', '# Page');

    expect(resolveTargetPath(root, sourcePath, './page')).toBe(path.join(root, 'src/docs/page.md'));
    expect(resolveTargetPath(root, sourcePath, '/ja/docs/page')).toBe(
      path.join(root, 'src/ja/docs/page.md'),
    );
    expect(resolveTargetPath(root, sourcePath, '../outside')).toBe(
      path.join(root, 'src/outside.md'),
    );
    expect(shouldCheck('tel:+8100000000')).toBe(false);
    expect(shouldCheck('/docs/page')).toBe(true);
  });

  it('keeps the CLI output and exit code stable on failure', () => {
    const root = createWorkspace();
    writeFile(root, 'src/index.md', '# Home\n[Missing](./missing.md)');

    const result = spawnSync(process.execPath, [scriptPath], {
      cwd: root,
      encoding: 'utf8',
    });

    expect(result.status).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain('doc link check failed:');
    expect(result.stderr).toContain('src/index.md links to missing page ./missing.md');
  });
});
