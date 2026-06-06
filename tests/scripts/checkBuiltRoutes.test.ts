import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  checkBuiltRoutes,
  expectedGlossaryFiles,
  resolveBuiltHref,
} from '../../scripts/check-built-routes.mjs';

const demoRoutes = [
  'mastering.html',
  'ja/mastering.html',
  'analyzer.html',
  'ja/analyzer.html',
  'music-analysis.html',
  'ja/music-analysis.html',
  'mixing.html',
  'ja/mixing.html',
  'realtime-fx.html',
  'ja/realtime-fx.html',
  'spatial.html',
  'ja/spatial.html',
  'synth.html',
  'ja/synth.html',
  'studio.html',
  'ja/studio.html',
];

const siteUrl = 'https://sonare.libraz.net';
const scriptPath = path.resolve('scripts/check-built-routes.mjs');

let workspaces: string[] = [];

function createWorkspace() {
  const root = mkdtempSync(path.join(tmpdir(), 'check-built-routes-'));
  const dist = path.join(root, '.vitepress/dist');
  const manifestPath = path.join(root, 'scripts/glossary/manifest.json');
  mkdirSync(dist, { recursive: true });
  mkdirSync(path.dirname(manifestPath), { recursive: true });
  workspaces.push(root);
  return { root, dist, manifestPath };
}

function writeFile(
  root: string,
  relativePath: string,
  content = '<!doctype html><title>ok</title>',
) {
  const filePath = path.join(root, relativePath);
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, content);
}

function writeManifest(manifestPath: string) {
  writeFileSync(
    manifestPath,
    JSON.stringify({
      categories: [
        {
          id: 'concepts',
          entries: [
            { id: 'audio-basics', status: 'published' },
            { id: 'draft-topic', status: 'draft' },
            { id: 'custom-path', path: 'mixing/custom-path.md', status: 'published' },
          ],
        },
      ],
    }),
  );
}

function sitemap(files: string[]) {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...files.map((file) => `<url><loc>${siteUrl}/${file}</loc></url>`),
    '</urlset>',
  ].join('');
}

describe('check-built-routes script helpers', () => {
  afterEach(() => {
    for (const workspace of workspaces) {
      rmSync(workspace, { recursive: true, force: true });
    }
    workspaces = [];
  });

  it('skips the check when the built output directory is missing', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'check-built-routes-missing-'));
    workspaces.push(root);

    const result = checkBuiltRoutes({
      root,
      dist: path.join(root, '.vitepress/dist'),
      manifestPath: path.join(root, 'scripts/glossary/manifest.json'),
    });

    expect(result).toEqual({ skipped: true, failures: [] });
  });

  it('derives published glossary routes from the manifest only', () => {
    const { manifestPath } = createWorkspace();
    writeManifest(manifestPath);

    expect(expectedGlossaryFiles(manifestPath)).toEqual([
      'docs/glossary.html',
      'docs/glossary/concepts/audio-basics.html',
      'docs/glossary/mixing/custom-path.html',
      'ja/docs/glossary.html',
      'ja/docs/glossary/concepts/audio-basics.html',
      'ja/docs/glossary/mixing/custom-path.html',
    ]);
  });

  it('passes when required routes, glossary pages, sitemap entries and internal hrefs exist', () => {
    const { dist, manifestPath } = createWorkspace();
    writeManifest(manifestPath);
    const glossaryFiles = expectedGlossaryFiles(manifestPath);

    for (const file of [...demoRoutes, ...glossaryFiles]) writeFile(dist, file);
    writeFile(dist, 'index.html', '<a href="/mixing">Mixing</a><a href="/assets/app.js">Asset</a>');
    writeFile(dist, 'assets/app.js', 'console.log("ok")');
    writeFile(dist, 'sitemap.xml', sitemap([...demoRoutes, ...glossaryFiles]));

    const result = checkBuiltRoutes({ dist, manifestPath });

    expect(result).toEqual({ skipped: false, failures: [] });
  });

  it('reports missing routes, forbidden old mastering paths, stale content and broken links', () => {
    const { dist, manifestPath } = createWorkspace();
    writeManifest(manifestPath);
    const glossaryFiles = expectedGlossaryFiles(manifestPath);

    for (const file of [...demoRoutes, ...glossaryFiles]) {
      if (file === 'ja/realtime-fx.html') continue;
      writeFile(dist, file);
    }
    writeFile(dist, 'master.html');
    writeFile(dist, 'mastering.html', '<a href="/missing-route">Missing</a> /master redirect');
    writeFile(
      dist,
      'sitemap.xml',
      sitemap([...demoRoutes.filter((file) => file !== 'mixing.html'), ...glossaryFiles]),
    );

    const result = checkBuiltRoutes({ dist, manifestPath });

    expect(result.skipped).toBe(false);
    expect(result.failures).toEqual(
      expect.arrayContaining([
        'missing built route: ja/realtime-fx.html',
        'forbidden old built route exists: master.html',
        'master.html: forbidden old mastering path',
        'mastering.html contains old mastering route, redirect, or parameter-page reference',
        'mastering.html links to missing built asset or route: /missing-route',
        `${'sitemap missing route'}: ${siteUrl}/mixing.html`,
      ]),
    );
  });

  it('resolves root, extensionless routes and assets to built files', () => {
    const { dist } = createWorkspace();
    writeFile(dist, 'index.html');
    writeFile(dist, 'docs/page.html');
    writeFile(dist, 'assets/app.js');

    expect(resolveBuiltHref(dist, '/')).toBe(path.join(dist, 'index.html'));
    expect(resolveBuiltHref(dist, '/docs/page')).toBe(path.join(dist, 'docs/page.html'));
    expect(resolveBuiltHref(dist, '/assets/app.js?v=1')).toBe(path.join(dist, 'assets/app.js'));
    expect(resolveBuiltHref(dist, '//cdn.example.test/app.js')).toBe(
      path.join(dist, 'cdn.example.test/app.js'),
    );
  });

  it('keeps the CLI skip path non-failing when dist is absent', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'check-built-routes-cli-missing-'));
    workspaces.push(root);

    const result = spawnSync(process.execPath, [scriptPath], {
      cwd: root,
      encoding: 'utf8',
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('built route check skipped');
    expect(result.stderr).toBe('');
  });

  it('keeps the CLI failing with diagnostics when built output is incomplete', () => {
    const { root, dist } = createWorkspace();
    writeFile(dist, 'sitemap.xml', sitemap([]));

    const result = spawnSync(process.execPath, [scriptPath], {
      cwd: root,
      encoding: 'utf8',
    });

    expect(result.status).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain('built route check failed:');
    expect(result.stderr).toContain('missing built route: mastering.html');
    expect(result.stderr).toContain(`sitemap missing route: ${siteUrl}/mastering.html`);
  });
});
