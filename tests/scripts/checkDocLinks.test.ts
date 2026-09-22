import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  checkDocLinks,
  countLines,
  DOMAIN_SIDEBAR_GROUPS,
  extractFigureNames,
  extractHeadingAnchors,
  extractMarkdownLinks,
  extractSidebarGroupLinks,
  frontMatterProblems,
  hasVisualComponent,
  PAGE_LINE_LIMIT,
  resolveTargetPath,
  shouldCheck,
  slugifyHeading,
  stripSplitIndexSections,
} from '../../scripts/check-doc-links.mjs';

const scriptPath = path.resolve('scripts/check-doc-links.mjs');
const [taskGroup, composeGroup] = DOMAIN_SIDEBAR_GROUPS;

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

type SidebarGroups = Record<string, string[]>;

function sidebarGroups(groups: SidebarGroups) {
  return Object.entries(groups)
    .map(([text, links]) => {
      const items = links.map((link) => `{ text: 'Page', link: '${link}' }`).join(', ');
      return `{ text: '${text}', items: [${items}] }`;
    })
    .join(', ');
}

/** Writes a config with every domain group present (empty unless given) plus the theme. */
function writeSiteConfig(
  root: string,
  {
    en = {},
    ja = {},
    extra = '',
    figures = ['StftFramingFigure'],
  }: { en?: SidebarGroups; ja?: SidebarGroups; extra?: string; figures?: string[] } = {},
) {
  const enGroups: SidebarGroups = {};
  const jaGroups: SidebarGroups = {};
  for (const group of DOMAIN_SIDEBAR_GROUPS) {
    enGroups[group.en] = en[group.en] ?? [];
    jaGroups[group.ja] = ja[group.ja] ?? [];
  }
  // Mirrors the real config's shape: the English tree is a named const the
  // sidebar key refers to, the ja tree is written inline under its own key, and
  // a demo menu above both reuses some of the same group labels. That decoy is
  // deliberate — a group label is not unique in the file, so a fixture without
  // one lets a whole-file label search pass here and read the wrong group live.
  // The decoy points at a real page carrying no visual, so scoping that breaks
  // shows up as a failure rather than as a silently wider page set.
  writeFile(root, 'src/decoy.md', '# Decoy');
  const decoy = DOMAIN_SIDEBAR_GROUPS.map(
    (group) => `{ text: '${group.en}', items: [{ link: '/decoy' }] }`,
  ).join(', ');
  writeFile(
    root,
    '.vitepress/config.ts',
    [
      `const enDemoMenu = [${decoy}];`,
      `const enDocsSidebar = [${sidebarGroups(enGroups)}];`,
      'export default {',
      '  nav: [{ text: "Demos", items: enDemoMenu }],',
      "  themeConfig: { sidebar: { '/docs/': enDocsSidebar } },",
      `  locales: { ja: { themeConfig: { sidebar: { '/ja/docs/': [${sidebarGroups(jaGroups)}] } } } },`,
      `  ${extra}`,
      '}',
    ].join('\n'),
  );
  writeFile(
    root,
    '.vitepress/theme/index.ts',
    `const FIGURES = [${figures.map((name) => `'${name}'`).join(', ')}] as const;`,
  );
}

/** A home page linking every given page, so none of them reads as an orphan. */
function writeHome(root: string, links: string[]) {
  writeFile(root, 'src/index.md', ['# Home', ...links.map((link) => `[Page](${link})`)].join('\n'));
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

  it('leaves a Japanese anchor composed so a hand-written link can match it', () => {
    // NFKD splits dakuten off its kana and the combining-mark strip only covers
    // the Latin range, so without the recomposition the slug would carry
    // U+3099 and no link an author types would ever resolve in the browser.
    const slug = slugifyHeading('経路上の空気吸収');
    expect(slug).toBe('経路上の空気吸収');
    expect(slug.normalize('NFC')).toBe(slug);
    expect([...slug].some((c) => c === '゙' || c === '゚')).toBe(false);
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
        '[French](/fr/docs/guide#details)',
        '[External](https://example.test/ignored)',
        '[Mail](mailto:team@example.test)',
        '[With state](/docs/guide?preset=cello)',
        '[State and anchor](/docs/guide?preset=cello#details)',
      ].join('\n'),
    );
    writeFile(root, 'src/docs/guide.md', ['# Guide', '## Details'].join('\n'));
    writeFile(root, 'src/ja/docs/guide.md', ['# ガイド', '## 詳細'].join('\n'));
    writeFile(root, 'src/fr/docs/guide.md', ['# Guide', '## Details'].join('\n'));
    writeSiteConfig(root, { extra: "nav: [{ link: '/docs/guide#details' }]," });

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
    writeSiteConfig(root, { extra: "nav: [{ link: '/docs/guide#also-missing' }]," });

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
    writeFile(root, 'src/fr/docs/page.md', '# Page');

    expect(resolveTargetPath(root, sourcePath, './page')).toBe(path.join(root, 'src/docs/page.md'));
    expect(resolveTargetPath(root, sourcePath, '/ja/docs/page')).toBe(
      path.join(root, 'src/ja/docs/page.md'),
    );
    expect(resolveTargetPath(root, sourcePath, '/fr/docs/page')).toBe(
      path.join(root, 'src/fr/docs/page.md'),
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

describe('orphan page detector', () => {
  afterEach(() => {
    for (const workspace of workspaces) {
      rmSync(workspace, { recursive: true, force: true });
    }
    workspaces = [];
  });

  it('strips only the split-index sections, up to the next level-2 heading', () => {
    const stripped = stripSplitIndexSections(
      [
        '# Title',
        '[Kept](./a.md)',
        '## Where the sections went',
        '[Dropped](./b.md)',
        '### Sub',
        '[Dropped too](./c.md)',
        '## Next',
        '[Kept again](./d.md)',
        '## 各節の移動先',
        '[Dropped ja](./e.md)',
      ].join('\n'),
    );
    expect(extractMarkdownLinks(stripped).map((link) => link.href)).toEqual(['./a.md', './d.md']);
  });

  it('passes when every docs page has a prose link from another page', () => {
    const root = createWorkspace();
    writeHome(root, ['/docs/guide', '/ja/docs/guide']);
    writeFile(root, 'src/docs/guide.md', '# Guide\n[Leaf](./glossary/leaf.md)');
    writeFile(root, 'src/docs/glossary/leaf.md', '# Leaf');
    writeFile(root, 'src/docs/introduction.md', '# Intro');
    writeFile(root, 'src/ja/docs/guide.md', '# ガイド');
    writeFile(root, 'src/ja/docs/introduction.md', '# イントロ');
    writeSiteConfig(root);

    expect(checkDocLinks({ root })).toEqual([]);
  });

  it('reports pages linked only from the config, from themselves, or from a split index', () => {
    const root = createWorkspace();
    writeHome(root, ['/docs/hub']);
    writeFile(
      root,
      'src/docs/hub.md',
      ['# Hub', '[Self](#hub)', '## Where the sections went', '[Child](./child.md)'].join('\n'),
    );
    writeFile(root, 'src/docs/child.md', '# Child\n[Self](./child.md)');
    writeFile(root, 'src/docs/config-only.md', '# Config only');
    writeFile(root, 'src/ja/docs/lonely.md', '# ひとり');
    writeSiteConfig(root, { extra: "nav: [{ link: '/docs/config-only' }]," });

    expect(checkDocLinks({ root })).toEqual([
      'src/docs/child.md has no inbound prose link',
      'src/docs/config-only.md has no inbound prose link',
      'src/ja/docs/lonely.md has no inbound prose link',
    ]);
  });
});

describe('domain page visual detector', () => {
  afterEach(() => {
    for (const workspace of workspaces) {
      rmSync(workspace, { recursive: true, force: true });
    }
    workspaces = [];
  });

  it('reads figure names from the theme and recognises every visual kind', () => {
    expect(
      extractFigureNames("const FIGURES = [\n  'AFigure',\n  'BFigure',\n] as const;"),
    ).toEqual(['AFigure', 'BFigure']);
    expect(extractFigureNames('export default {}')).toBeNull();
    expect(hasVisualComponent('<AFigure :labels="x" />', ['AFigure'])).toBe(true);
    expect(hasVisualComponent('<FlowDiagram\n  :steps="s"\n/>', [])).toBe(true);
    expect(hasVisualComponent('<SonareDemo id="x" />', [])).toBe(true);
    expect(hasVisualComponent('<AFigureExtra />', ['AFigure'])).toBe(false);
    expect(hasVisualComponent('plain text', ['AFigure'])).toBe(false);
  });

  it('passes when every domain page on both sides carries a visual', () => {
    const root = createWorkspace();
    writeHome(root, ['/docs/figure', '/docs/flow', '/ja/docs/figure', '/ja/docs/flow']);
    writeFile(root, 'src/docs/figure.md', '# Figure\n<StftFramingFigure />');
    writeFile(root, 'src/docs/flow.md', '# Flow\n<FlowDiagram :steps="[]" />');
    writeFile(root, 'src/ja/docs/figure.md', '# 図\n<SonareDemo id="x" />');
    writeFile(root, 'src/ja/docs/flow.md', '# フロー\n<FlowDiagram :steps="[]" />');
    writeSiteConfig(root, {
      en: { [taskGroup.en]: ['/docs/figure'], [composeGroup.en]: ['/docs/flow'] },
      ja: { [taskGroup.ja]: ['/ja/docs/figure'], [composeGroup.ja]: ['/ja/docs/flow'] },
    });

    expect(checkDocLinks({ root })).toEqual([]);
  });

  it('reports domain pages without a visual on either side and leaves other groups alone', () => {
    const root = createWorkspace();
    writeHome(root, ['/docs/bare', '/ja/docs/bare', '/docs/other']);
    writeFile(root, 'src/docs/bare.md', '# Bare');
    writeFile(root, 'src/ja/docs/bare.md', '# 素');
    writeFile(root, 'src/docs/other.md', '# Other');
    writeSiteConfig(root, {
      en: { [taskGroup.en]: ['/docs/bare'] },
      ja: { [taskGroup.ja]: ['/ja/docs/bare'] },
      extra: "nav: [{ text: 'Other', items: [{ text: 'Other', link: '/docs/other' }] }],",
    });

    expect(checkDocLinks({ root })).toEqual([
      'src/docs/bare.md has no figure, FlowDiagram, or SonareDemo',
      'src/ja/docs/bare.md has no figure, FlowDiagram, or SonareDemo',
    ]);
  });

  it('fails loudly when a domain group or the FIGURES array is missing', () => {
    const root = createWorkspace();
    writeFile(root, 'src/index.md', '# Home');
    writeFile(root, '.vitepress/config.ts', 'export default { themeConfig: { sidebar: [] } }');
    writeFile(root, '.vitepress/theme/index.ts', 'export default {}');

    expect(checkDocLinks({ root })).toEqual([
      '.vitepress/theme/index.ts is missing or has no FIGURES array',
    ]);

    writeFile(root, '.vitepress/theme/index.ts', "const FIGURES = ['AFigure'] as const;");
    expect(checkDocLinks({ root })).toEqual(
      DOMAIN_SIDEBAR_GROUPS.flatMap((group) => [
        `.vitepress/config.ts has no sidebar group "${group.en}"`,
        `.vitepress/config.ts has no sidebar group "${group.ja}"`,
      ]),
    );
  });
});

describe('page size detector', () => {
  afterEach(() => {
    for (const workspace of workspaces) {
      rmSync(workspace, { recursive: true, force: true });
    }
    workspaces = [];
  });

  it('counts lines the way wc does, with or without a trailing newline', () => {
    expect(countLines('a\nb\n')).toBe(2);
    expect(countLines('a\nb')).toBe(2);
    expect(countLines('a\r\nb\r\n')).toBe(2);
    expect(countLines('')).toBe(0);
  });

  it('accepts a page at the limit and reports one past it, in docs dirs only', () => {
    const root = createWorkspace();
    const line = (n: number) => Array.from({ length: n }, (_, i) => `line ${i}`).join('\n');
    writeHome(root, ['/docs/limit', '/docs/over', '/ja/docs/over']);
    writeFile(root, 'src/docs/limit.md', `${line(PAGE_LINE_LIMIT)}\n`);
    writeFile(root, 'src/docs/over.md', `${line(PAGE_LINE_LIMIT + 1)}\n`);
    writeFile(root, 'src/ja/docs/over.md', `${line(PAGE_LINE_LIMIT + 40)}\n`);
    writeFile(root, 'src/demos/README.md', `${line(PAGE_LINE_LIMIT + 1)}\n`);
    writeSiteConfig(root);

    expect(checkDocLinks({ root })).toEqual([
      `src/docs/over.md is ${PAGE_LINE_LIMIT + 1} lines (limit ${PAGE_LINE_LIMIT})`,
      `src/ja/docs/over.md is ${PAGE_LINE_LIMIT + 40} lines (limit ${PAGE_LINE_LIMIT})`,
    ]);
  });
});

describe('domain sidebar parity detector', () => {
  afterEach(() => {
    for (const workspace of workspaces) {
      rmSync(workspace, { recursive: true, force: true });
    }
    workspaces = [];
  });

  it('scopes links to the named group, including nested items', () => {
    const config = [
      "{ text: 'Before', items: [{ text: 'X', link: '/docs/before' }] },",
      "{ text: 'Build & Ship', items: [",
      "  { text: 'A', link: '/docs/a' },",
      "  { text: 'B', link: '/docs/b', collapsed: true, items: [{ text: 'C', link: '/docs/c' }] },",
      '] },',
      "{ text: 'After', items: [{ text: 'Y', link: '/docs/after' }] },",
    ].join('\n');

    expect(extractSidebarGroupLinks(config, 'Build & Ship')).toEqual([
      '/docs/a',
      '/docs/b',
      '/docs/c',
    ]);
    expect(extractSidebarGroupLinks(config, 'Missing')).toBeNull();
  });

  it('passes when both sides link the same pages after stripping the ja prefix', () => {
    const root = createWorkspace();
    writeHome(root, ['/docs/a', '/docs/b', '/ja/docs/a', '/ja/docs/b']);
    for (const page of ['a', 'b']) {
      writeFile(root, `src/docs/${page}.md`, '# Page\n<SonareDemo id="x" />');
      writeFile(root, `src/ja/docs/${page}.md`, '# ページ\n<SonareDemo id="x" />');
    }
    writeSiteConfig(root, {
      en: { [taskGroup.en]: ['/docs/a', '/docs/b'] },
      ja: { [taskGroup.ja]: ['/ja/docs/b', '/ja/docs/a'] },
    });

    expect(checkDocLinks({ root })).toEqual([]);
  });

  it('names the side that lacks a page', () => {
    const root = createWorkspace();
    writeHome(root, ['/docs/a', '/docs/b', '/ja/docs/a', '/ja/docs/b']);
    for (const page of ['a', 'b']) {
      writeFile(root, `src/docs/${page}.md`, '# Page\n<SonareDemo id="x" />');
      writeFile(root, `src/ja/docs/${page}.md`, '# ページ\n<SonareDemo id="x" />');
    }
    writeSiteConfig(root, {
      en: { [taskGroup.en]: ['/docs/a'], [composeGroup.en]: ['/docs/b'] },
      ja: { [taskGroup.ja]: ['/ja/docs/b'], [composeGroup.ja]: ['/ja/docs/b'] },
    });

    expect(checkDocLinks({ root })).toEqual([
      `sidebar group "${taskGroup.en}": ja is missing /docs/a`,
      `sidebar group "${taskGroup.en}": en is missing /docs/b`,
    ]);
  });
});

describe('front matter detector', () => {
  it('flags an unquoted colon in a front matter value', () => {
    expect(frontMatterProblems('---\ntitle: Editing: MIDI and Save/Load\n---\n\n# X\n')).toEqual([
      'front matter `title` holds an unquoted colon: Editing: MIDI and Save/Load',
    ]);
  });

  it('accepts the value once it is quoted', () => {
    expect(frontMatterProblems('---\ntitle: "Editing: MIDI"\n---\n\n# X\n')).toEqual([]);
  });

  it('accepts a colon with no space after it, which YAML reads as a scalar', () => {
    expect(frontMatterProblems('---\ntitle: ratio 4:1 compression\n---\n\n# X\n')).toEqual([]);
  });

  it('flags an unterminated block', () => {
    expect(frontMatterProblems('---\ntitle: X\n\n# X\n')).toEqual([
      'has an unterminated front matter block',
    ]);
  });

  it('ignores a page with no front matter', () => {
    expect(frontMatterProblems('# X\n\nbody\n')).toEqual([]);
  });
});
