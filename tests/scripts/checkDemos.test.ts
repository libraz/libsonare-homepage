import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { checkDemos } from '../../scripts/check-demos.mjs';

let workspaces: string[] = [];

function createWorkspace() {
  const root = mkdtempSync(path.join(tmpdir(), 'check-demos-'));
  workspaces.push(root);
  return root;
}

function write(root: string, rel: string, content: string) {
  const full = path.join(root, rel);
  mkdirSync(path.dirname(full), { recursive: true });
  writeFileSync(full, content);
}

function seedLocales(root: string, locales = ['en', 'ja']) {
  for (const locale of locales) {
    write(root, `src/locales/${locale}.json`, '{}');
  }
}

function seedRegistry(root: string, ids: string[], clips: string[] = []) {
  const defs = [
    ...ids.map((id) => `{ id: '${id}', archetype: 'transform' }`),
    ...clips.map((c) => `{ id: 'clip-${c}', clip: '${c}' }`),
  ].join(',\n');
  write(root, 'src/demos/registry/analysis.ts', `export const analysisDemos = [\n${defs}\n];\n`);
}

afterEach(() => {
  for (const root of workspaces) rmSync(root, { recursive: true, force: true });
  workspaces = [];
});

describe('checkDemos', () => {
  it('passes when ids are defined and registered locales are parallel', () => {
    const root = createWorkspace();
    seedLocales(root);
    seedRegistry(root, ['stft-basics']);
    write(root, 'src/docs/intro.md', '# A\n<SonareDemo id="stft-basics" />\n');
    write(root, 'src/ja/docs/intro.md', '# あ\n<SonareDemo id="stft-basics" />\n');
    expect(checkDemos({ root })).toEqual([]);
  });

  it('checks every locale listed in src/locales', () => {
    const root = createWorkspace();
    seedLocales(root, ['en', 'ja', 'fr']);
    seedRegistry(root, ['stft-basics']);
    write(root, 'src/docs/intro.md', '<SonareDemo id="stft-basics" />');
    write(root, 'src/ja/docs/intro.md', '<SonareDemo id="stft-basics" />');
    write(root, 'src/fr/docs/intro.md', '# no widget here');

    expect(checkDemos({ root })).toContainEqual(
      expect.stringContaining('used in en intro.md but not fr'),
    );
  });

  it('flags an unknown id', () => {
    const root = createWorkspace();
    seedRegistry(root, []);
    write(root, 'src/docs/intro.md', '<SonareDemo id="ghost" />');
    write(root, 'src/ja/docs/intro.md', '<SonareDemo id="ghost" />');
    expect(checkDemos({ root })).toContainEqual(expect.stringContaining('unknown id "ghost"'));
  });

  it('flags unsupported SonareDemo attributes in markdown', () => {
    const root = createWorkspace();
    seedLocales(root);
    seedRegistry(root, ['stft-basics']);
    write(root, 'src/docs/intro.md', '<SonareDemo id="stft-basics" eager />');
    write(root, 'src/ja/docs/intro.md', '<SonareDemo id="stft-basics" />');

    expect(checkDemos({ root })).toContainEqual(
      expect.stringContaining('unsupported SonareDemo attribute "eager"'),
    );
  });

  it('flags SonareDemo tags without exactly one id', () => {
    const root = createWorkspace();
    seedLocales(root);
    seedRegistry(root, ['stft-basics']);
    write(root, 'src/docs/intro.md', '<SonareDemo />\n<SonareDemo id="stft-basics" id="extra" />');
    write(root, 'src/ja/docs/intro.md', '<SonareDemo id="stft-basics" />');

    const failures = checkDemos({ root });
    expect(failures).toContainEqual(expect.stringContaining('missing required id attribute'));
    expect(failures).toContainEqual(expect.stringContaining('duplicate id attributes'));
  });

  it('flags SonareDemo id attributes with missing, empty or invalid values', () => {
    const root = createWorkspace();
    seedLocales(root);
    seedRegistry(root, ['stft-basics']);
    write(
      root,
      'src/docs/intro.md',
      ['<SonareDemo id />', '<SonareDemo id="" />', '<SonareDemo id="Bad_Id" />'].join('\n'),
    );
    write(root, 'src/ja/docs/intro.md', '<SonareDemo id="stft-basics" />');

    const failures = checkDemos({ root });
    expect(failures).toContainEqual(expect.stringContaining('id attribute must have a value'));
    expect(failures).toContainEqual(expect.stringContaining('id attribute must not be empty'));
    expect(failures).toContainEqual(expect.stringContaining('id "Bad_Id" must be kebab-case'));
  });

  it('flags non-self-closing SonareDemo tags', () => {
    const root = createWorkspace();
    seedLocales(root);
    seedRegistry(root, ['stft-basics']);
    write(root, 'src/docs/intro.md', '<SonareDemo id="stft-basics"></SonareDemo>');
    write(root, 'src/ja/docs/intro.md', '<SonareDemo id="stft-basics" />');

    expect(checkDemos({ root })).toContainEqual(
      expect.stringContaining('SonareDemo tag must be self-closing'),
    );
  });

  it('flags locale id mismatches in mirrored files', () => {
    const root = createWorkspace();
    seedLocales(root);
    seedRegistry(root, ['stft-basics']);
    write(root, 'src/docs/intro.md', '<SonareDemo id="stft-basics" />');
    write(root, 'src/ja/docs/intro.md', '# no widget here');
    expect(checkDemos({ root })).toContainEqual(
      expect.stringContaining('used in en intro.md but not ja'),
    );
  });

  it('flags locale mismatches in top-level markdown pages', () => {
    const root = createWorkspace();
    seedLocales(root);
    seedRegistry(root, ['waveform-harmonics']);
    write(root, 'src/analyzer.md', '<SonareDemo id="waveform-harmonics" />');
    write(root, 'src/ja/analyzer.md', '# no widget here');

    expect(checkDemos({ root })).toContainEqual(
      expect.stringContaining('used in en analyzer.md but not ja'),
    );
  });

  it('flags a registry id that is never referenced from markdown', () => {
    const root = createWorkspace();
    seedRegistry(root, ['unused-demo']);
    expect(checkDemos({ root })).toContainEqual(
      expect.stringContaining('registry id "unused-demo" is not referenced'),
    );
  });

  it('flags a clip with no asset file', () => {
    const root = createWorkspace();
    seedRegistry(root, [], ['band']);
    expect(checkDemos({ root })).toContainEqual(expect.stringContaining('clip "band"'));
  });
});
