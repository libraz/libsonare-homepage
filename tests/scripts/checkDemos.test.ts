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
  it('passes when ids are defined and en/ja parallel', () => {
    const root = createWorkspace();
    seedRegistry(root, ['stft-basics']);
    write(root, 'src/docs/intro.md', '# A\n<SonareDemo id="stft-basics" />\n');
    write(root, 'src/ja/docs/intro.md', '# あ\n<SonareDemo id="stft-basics" />\n');
    expect(checkDemos({ root })).toEqual([]);
  });

  it('flags an unknown id', () => {
    const root = createWorkspace();
    seedRegistry(root, []);
    write(root, 'src/docs/intro.md', '<SonareDemo id="ghost" />');
    write(root, 'src/ja/docs/intro.md', '<SonareDemo id="ghost" />');
    expect(checkDemos({ root })).toContainEqual(expect.stringContaining('unknown id "ghost"'));
  });

  it('flags en/ja id mismatch in mirrored files', () => {
    const root = createWorkspace();
    seedRegistry(root, ['stft-basics']);
    write(root, 'src/docs/intro.md', '<SonareDemo id="stft-basics" />');
    write(root, 'src/ja/docs/intro.md', '# no widget here');
    expect(checkDemos({ root })).toContainEqual(
      expect.stringContaining('used in en intro.md but not ja'),
    );
  });

  it('flags a clip with no asset file', () => {
    const root = createWorkspace();
    seedRegistry(root, [], ['band']);
    expect(checkDemos({ root })).toContainEqual(expect.stringContaining('clip "band"'));
  });
});
