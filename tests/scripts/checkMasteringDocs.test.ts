import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  checkMasteringDocs,
  checkRelatedGuideLine,
  cliCommands,
  extractMasteringJsApis,
  glossaryLinks,
  listFiles,
  pythonApis,
  requireMinimumGuideLinks,
  requireText,
} from '../../scripts/check-mastering-docs.mjs';

const scriptPath = path.resolve('scripts/check-mastering-docs.mjs');
const jsApis = ['masterAudioBuffer', 'masteringChainStereoWithProgress'];

let workspaces: string[] = [];

function createWorkspace() {
  const root = mkdtempSync(path.join(tmpdir(), 'check-mastering-docs-'));
  workspaces.push(root);
  return root;
}

function writeFile(root: string, relativePath: string, content: string) {
  const filePath = path.join(root, relativePath);
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, content);
  return filePath;
}

function relatedLine(locale: 'en' | 'ja') {
  const prefix = locale === 'ja' ? '関連するマスタリングガイド:' : 'Related mastering guides:';
  return `${prefix} [One](./glossary/mastering.md), [Two](./glossary/mastering/tone-air.md), [Three](./glossary/mastering/dynamics.md)`;
}

function docsBody(locale: 'en' | 'ja', extra = '') {
  return [
    relatedLine(locale),
    ...jsApis,
    ...pythonApis,
    ...cliCommands,
    ...glossaryLinks,
    '@libraz/libsonare',
    '@libraz/libsonare-native',
    'progress * 100',
    'stage',
    locale === 'ja' ? '/ja/mastering' : '/mastering',
    locale === 'ja' ? 'ブラウザ内マスタリング' : 'Browser Mastering',
    './mastering-implementation.md',
    'WASM Mastering ISP Guard',
    'mastering_isp_4x_stereo_1ms',
    extra,
  ].join('\n');
}

function implementationDoc(locale: 'en' | 'ja') {
  const title = locale === 'ja' ? 'マスタリング実装' : 'Mastering Implementation';
  return [
    '---',
    `title: ${title}`,
    '---',
    `# ${title}`,
    locale === 'ja' ? '/ja/mastering' : '/mastering',
    'Mastering worker',
    'libsonare WASM',
    'JSON report',
    './glossary/mastering/repair.md',
    './glossary/mastering/tone-air.md',
    './glossary/mastering/dynamics.md',
    './glossary/mastering/stereo-limiter-loudness.md',
    'masteringChainStereoWithProgress()',
    'yarn check:mastering-docs',
  ].join('\n');
}

function writeValidProject(root: string) {
  writeFile(
    root,
    'src/wasm/index.d.ts',
    [
      'declare function masterAudioBuffer(input: Float32Array): Float32Array;',
      'declare function masteringChainStereoWithProgress(left: Float32Array, right: Float32Array): Float32Array;',
      'export { masterAudioBuffer, masteringChainStereoWithProgress };',
    ].join('\n'),
  );

  for (const locale of ['en', 'ja'] as const) {
    const prefix = locale === 'ja' ? 'src/ja/docs' : 'src/docs';
    for (const file of [
      'js-api.md',
      'native-bindings.md',
      'python-api.md',
      'cli.md',
      'wasm.md',
      'benchmarks.md',
    ]) {
      writeFile(root, `${prefix}/${file}`, docsBody(locale));
    }
    writeFile(root, `${prefix}/mastering-implementation.md`, implementationDoc(locale));
  }

  writeFile(
    root,
    '.vitepress/config.ts',
    ["link: '/docs/mastering-implementation'", "link: '/ja/docs/mastering-implementation'"].join(
      '\n',
    ),
  );
  writeFile(
    root,
    'README.md',
    'Run yarn check before publishing. Open /mastering for the browser mastering demo.',
  );
  writeFile(
    root,
    'src/components/MasteringDemo.vue',
    [
      '<template><a href="/docs/glossary/mastering">Docs</a><a href="/ja/docs/glossary/mastering">Docs</a></template>',
    ].join('\n'),
  );
  writeFile(root, 'src/mastering.md', '# Mastering');
  writeFile(root, 'src/ja/mastering.md', '# マスタリング');
}

describe('check-mastering-docs script helpers', () => {
  afterEach(() => {
    for (const workspace of workspaces) {
      rmSync(workspace, { recursive: true, force: true });
    }
    workspaces = [];
  });

  it('extracts mastering JS APIs and verifies text helpers', () => {
    const root = createWorkspace();
    writeValidProject(root);
    const failures: string[] = [];

    expect(extractMasteringJsApis({ root, failures })).toEqual(jsApis);
    requireText(failures, 'doc.md', 'hello mastering', 'missing');
    requireMinimumGuideLinks(failures, 'guide.md', '[One](./glossary/a.md)', 2);
    checkRelatedGuideLine(failures, 'guide.md', relatedLine('en'), 'en');

    expect(failures).toEqual([
      'doc.md: missing missing',
      'guide.md: expected at least 2 glossary guide links, found 1',
    ]);
  });

  it('passes for a complete minimal mastering docs project', () => {
    const root = createWorkspace();
    writeValidProject(root);

    expect(checkMasteringDocs({ root })).toEqual([]);
  });

  it('reports missing API docs, route files, stale old routes and long-form help drift', () => {
    const root = createWorkspace();
    writeValidProject(root);
    writeFile(root, 'src/docs/js-api.md', docsBody('en').replace('masterAudioBuffer', ''));
    writeFile(root, 'src/somewhere.ts', 'export const old = "/master"');
    writeFile(root, 'src/master.md', '# Old route');
    rmSync(path.join(root, 'src/ja/mastering.md'), { force: true });
    writeFile(
      root,
      'src/data/masteringHelp.ts',
      [
        "sectionText: { en: 'Open the panel only', ja: 'パネルのみ' }",
        'Mastering works on the finished stereo mix',
      ].join('\n'),
    );

    expect(checkMasteringDocs({ root })).toEqual(
      expect.arrayContaining([
        'src/docs/js-api.md: missing masterAudioBuffer',
        'src/data/masteringHelp.ts: missing VitePress docs page is the source of truth',
        'src/data/masteringHelp.ts: in-app help appears to contain long-form docs prose: Mastering works on the finished stereo mix',
        'src/data/masteringHelp.ts: sectionText.en does not point to docs',
        'src/data/masteringHelp.ts: sectionText.ja does not point to docs',
        'src/somewhere.ts: contains old mastering route, redirect, or parameter-page reference',
        'missing required route file src/ja/mastering.md',
        'forbidden old route or parameter path exists: src/master.md',
      ]),
    );
  });

  it('lists checked source files while excluding wasm and public directories', () => {
    const root = createWorkspace();
    writeFile(root, 'src/App.vue', '<template />');
    writeFile(root, 'src/wasm/generated.js', 'export {}');
    writeFile(root, 'src/public/site.js', 'export {}');
    writeFile(root, 'scripts/check.mjs', 'export {}');
    writeFile(root, 'README.md', '# Readme');

    expect(listFiles(root, ['src', 'scripts', 'README.md'])).toEqual([
      'README.md',
      'scripts/check.mjs',
      'src/App.vue',
    ]);
  });

  it('keeps CLI success and failure output stable', () => {
    const passingRoot = createWorkspace();
    writeValidProject(passingRoot);

    const passing = spawnSync(process.execPath, [scriptPath], {
      cwd: passingRoot,
      encoding: 'utf8',
    });

    expect(passing.status).toBe(0);
    expect(passing.stdout).toContain('mastering docs check passed');
    expect(passing.stderr).toBe('');

    const failingRoot = createWorkspace();
    writeValidProject(failingRoot);
    writeFile(failingRoot, 'src/wasm/index.d.ts', 'export {};');

    const failing = spawnSync(process.execPath, [scriptPath], {
      cwd: failingRoot,
      encoding: 'utf8',
    });

    expect(failing.status).toBe(1);
    expect(failing.stdout).toBe('');
    expect(failing.stderr).toContain('mastering docs check failed:');
    expect(failing.stderr).toContain('src/wasm/index.d.ts: no mastering JS APIs found');
  });
});
