import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  checkI18nParity,
  flattenKeys,
  getByPath,
  listMarkdownFiles,
  listSourceFiles,
} from '../../scripts/check-i18n-parity.mjs';

const scriptPath = path.resolve('scripts/check-i18n-parity.mjs');

let workspaces: string[] = [];

function createWorkspace() {
  const root = mkdtempSync(path.join(tmpdir(), 'check-i18n-parity-'));
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

function writeValidProject(root: string) {
  writeJson(root, 'src/locales/en.json', {
    common: { save: 'Save', cancel: 'Cancel' },
    demo: { title: 'Demo' },
  });
  writeJson(root, 'src/locales/ja.json', {
    common: { save: '保存', cancel: 'キャンセル' },
    demo: { title: 'デモ' },
  });
  writeFile(root, 'src/App.vue', '<script setup>const label = t("common.save")</script>');
  writeFile(root, 'src/docs/guide.md', '# Guide');
  writeFile(root, 'src/ja/docs/guide.md', '# ガイド');
}

describe('check-i18n-parity script helpers', () => {
  afterEach(() => {
    for (const workspace of workspaces) {
      rmSync(workspace, { recursive: true, force: true });
    }
    workspaces = [];
  });

  it('flattens nested locale keys and resolves values by key path', () => {
    const locale = {
      common: { save: 'Save' },
      demo: { panels: { meter: 'Meter' } },
    };

    expect(flattenKeys(locale)).toEqual(['common.save', 'demo.panels.meter']);
    expect(getByPath(locale, 'demo.panels.meter')).toBe('Meter');
    expect(getByPath(locale, 'demo.panels.missing')).toBeUndefined();
  });

  it('passes when locale keys, literal t() usage and docs mirrors match', () => {
    const root = createWorkspace();
    writeValidProject(root);

    expect(checkI18nParity({ root })).toEqual([]);
  });

  it('reports asymmetric locale keys, missing literal t() keys and docs mirror gaps', () => {
    const root = createWorkspace();
    writeJson(root, 'src/locales/en.json', {
      common: { save: 'Save' },
      demo: { title: 'Demo' },
    });
    writeJson(root, 'src/locales/ja.json', {
      common: { cancel: 'キャンセル' },
      demo: { title: 'デモ' },
    });
    writeFile(root, 'src/App.vue', '<script setup>const label = t("demo.missing")</script>');
    writeFile(root, 'src/docs/en-only.md', '# English only');
    writeFile(root, 'src/ja/docs/ja-only.md', '# Japanese only');

    expect(checkI18nParity({ root })).toEqual([
      'locales: ja missing key common.save',
      'locales: en missing key common.cancel',
      'locale usage: missing key demo.missing in src/App.vue',
      'docs: ja missing en-only.md',
      'docs: en missing ja-only.md',
    ]);
  });

  it('lists markdown and source files while excluding wasm and public source assets', () => {
    const root = createWorkspace();
    writeFile(root, 'src/docs/a.md', '# A');
    writeFile(root, 'src/docs/nested/b.md', '# B');
    writeFile(root, 'src/App.vue', '<template />');
    writeFile(root, 'src/utils/demo.ts', 'export const demo = true');
    writeFile(root, 'src/wasm/generated.js', 'export {}');
    writeFile(root, 'src/public/site.js', 'export {}');

    expect(listMarkdownFiles(path.join(root, 'src/docs'))).toEqual(['a.md', 'nested/b.md']);
    expect(
      listSourceFiles(path.join(root, 'src')).map((file) => path.relative(root, file)),
    ).toEqual(['src/App.vue', 'src/utils/demo.ts']);
  });

  it('keeps the CLI output and exit code stable on success and failure', () => {
    const passingRoot = createWorkspace();
    writeValidProject(passingRoot);

    const passing = spawnSync(process.execPath, [scriptPath], {
      cwd: passingRoot,
      encoding: 'utf8',
    });

    expect(passing.status).toBe(0);
    expect(passing.stdout).toContain('i18n parity check passed');
    expect(passing.stderr).toBe('');

    const failingRoot = createWorkspace();
    writeJson(failingRoot, 'src/locales/en.json', { common: { save: 'Save' } });
    writeJson(failingRoot, 'src/locales/ja.json', { common: {} });

    const failing = spawnSync(process.execPath, [scriptPath], {
      cwd: failingRoot,
      encoding: 'utf8',
    });

    expect(failing.status).toBe(1);
    expect(failing.stdout).toBe('');
    expect(failing.stderr).toContain('i18n parity check failed:');
    expect(failing.stderr).toContain('locales: ja missing key common.save');
  });
});
