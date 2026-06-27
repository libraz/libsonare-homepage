import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  checkConditionalTranslateCalls,
  checkI18nParity,
  checkLocaleLeafValues,
  checkScaffoldedTranslationTodos,
  flattenKeys,
  getByPath,
  listMarkdownFiles,
  listSourceFiles,
  readLocales,
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

  it('discovers every locale json file and checks its docs mirror', () => {
    const root = createWorkspace();
    writeValidProject(root);
    writeJson(root, 'src/locales/fr.json', {
      common: { save: 'Enregistrer', cancel: 'Annuler' },
      demo: { title: 'Démo' },
    });
    writeFile(root, 'src/fr/docs/guide.md', '# Guide');

    expect([...readLocales(path.join(root, 'src/locales')).keys()].sort()).toEqual([
      'en',
      'fr',
      'ja',
    ]);
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

  it('reports empty or non-string locale leaves', () => {
    const failures: string[] = [];
    checkLocaleLeafValues(failures, 'ja', {
      common: {
        save: '   ',
        count: 3,
      },
    });

    expect(failures).toEqual([
      'locales: ja key common.save is empty',
      'locales: ja key common.count must be a string',
    ]);
  });

  it('reports invalid locale leaves through the full parity check', () => {
    const root = createWorkspace();
    writeJson(root, 'src/locales/en.json', {
      common: { save: 'Save', cancel: 'Cancel' },
    });
    writeJson(root, 'src/locales/ja.json', {
      common: { save: '', cancel: 1 },
    });

    expect(checkI18nParity({ root })).toEqual(
      expect.arrayContaining([
        'locales: ja key common.save is empty',
        'locales: ja key common.cancel must be a string',
      ]),
    );
  });

  it('reports scaffolded translation TODO markers in markdown', () => {
    const root = createWorkspace();
    writeValidProject(root);
    writeJson(root, 'src/locales/fr.json', {
      common: { save: 'Enregistrer', cancel: 'Annuler' },
      demo: { title: 'Démo' },
    });
    writeFile(
      root,
      'src/fr/docs/guide.md',
      '<!-- TODO(i18n): Translate this scaffolded page. -->\n\n# Guide',
    );

    expect(checkI18nParity({ root })).toContain(
      'docs: remove scaffold translation TODO in src/fr/docs/guide.md',
    );
  });

  it('exposes the scaffolded translation TODO helper', () => {
    const root = createWorkspace();
    const failures: string[] = [];
    writeFile(root, 'src/docs/guide.md', '# Guide');
    writeFile(
      root,
      'src/fr/docs/guide.md',
      '<!-- TODO(i18n): Translate this scaffolded page. -->\n\n# Guide',
    );

    checkScaffoldedTranslationTodos({ root, failures });

    expect(failures).toEqual(['docs: remove scaffold translation TODO in src/fr/docs/guide.md']);
  });

  it('reports ternary t() calls through the full parity check', () => {
    const root = createWorkspace();
    writeValidProject(root);
    writeFile(
      root,
      'src/App.vue',
      ['<template>', "  {{ ready ? t('common.save') : t('common.cancel') }}", '</template>'].join(
        '\n',
      ),
    );

    expect(checkI18nParity({ root })).toContain(
      'locale usage: avoid ternary t() call in src/App.vue:2',
    );
  });

  it('checks literal t() usage in VitePress theme files', () => {
    const root = createWorkspace();
    writeValidProject(root);
    writeFile(
      root,
      '.vitepress/theme/Layout.vue',
      [
        '<template>{{ ready ? t("common.save") : t("common.cancel") }}</template>',
        '<script setup>',
        'const missing = t("theme.missing")',
        '</script>',
      ].join('\n'),
    );

    expect(checkI18nParity({ root })).toEqual(
      expect.arrayContaining([
        'locale usage: avoid ternary t() call in .vitepress/theme/Layout.vue:1',
        'locale usage: missing key theme.missing in .vitepress/theme/Layout.vue',
      ]),
    );
  });

  it('flags ternary branches that call t() directly', () => {
    const root = createWorkspace();
    const failures: string[] = [];
    checkConditionalTranslateCalls({
      root,
      file: path.join(root, 'src/App.vue'),
      source: [
        '<template>',
        "  {{ ready ? t('common.ready') : t('common.idle') }}",
        '  {{',
        '    busy',
        '      ?',
        "        t('common.busy')",
        "      : 'idle'",
        '  }}',
        '</template>',
        '<script setup>',
        "const label = computed(() => { if (ready.value) return t('common.ready'); return t('common.idle'); })",
        '</script>',
      ].join('\n'),
      failures,
    });

    expect(failures).toEqual([
      'locale usage: avoid ternary t() call in src/App.vue:2',
      'locale usage: avoid ternary t() call in src/App.vue:5',
    ]);
  });

  it('does not flag ordinary t() calls after TypeScript generics or object labels', () => {
    const root = createWorkspace();
    const failures: string[] = [];
    checkConditionalTranslateCalls({
      root,
      file: path.join(root, 'src/App.vue'),
      source: [
        '<script setup lang="ts">',
        'const modeOptions = computed<ToolModeOption[]>(() => [',
        "  { id: 'quick', label: t('common.save') },",
        "  { id: 'studio', label: t('common.cancel') },",
        ']);',
        "const label = item?.name || t('demo.title');",
        '</script>',
      ].join('\n'),
      failures,
    });

    expect(failures).toEqual([]);
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
