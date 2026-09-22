// @vitest-environment node
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { LISTED_DEMOS } from '@/demos/manifest';

const ROOT = path.resolve(__dirname, '..');
const SITE = 'https://libsonare.libraz.net';

/**
 * The two READMEs carry a demo index, and an index written by hand drifts. The
 * manifest is the one table binding a demo to its route, so the index is
 * checked against it rather than maintained beside it.
 */
const READMES = [
  { file: 'README.md', prefix: '' },
  { file: 'README_ja.md', prefix: '/ja' },
];

function read(file: string): string {
  return fs.readFileSync(path.join(ROOT, file), 'utf8');
}

describe.each(READMES)('$file', ({ file, prefix }) => {
  const text = read(file);

  it('links every demo the switcher lists, exactly once', () => {
    for (const demo of LISTED_DEMOS) {
      const url = `${SITE}${prefix}${demo.route}`;
      const hits = text.split(`(${url})`).length - 1;
      expect(hits, `${demo.id} should be linked once`).toBe(1);
    }
  });

  it('links no demo route the manifest does not carry', () => {
    const listed = new Set(LISTED_DEMOS.map((demo) => `${prefix}${demo.route}`));
    const linked = [...text.matchAll(new RegExp(`\\(${SITE}(/[a-z0-9/-]*)\\)`, 'g'))].map(
      (match) => match[1],
    );
    for (const route of linked) {
      // The site root is the project's own home page, not a demo.
      if (route === '' || route === '/' || route === '/ja') continue;
      expect(listed.has(route), `${route} is linked but not in the manifest`).toBe(true);
    }
  });

  it('lists the demos in manifest order', () => {
    const positions = LISTED_DEMOS.map((demo) => text.indexOf(`${SITE}${prefix}${demo.route})`));
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });
});

describe('the README pair', () => {
  it('keeps both languages, and neither links across to the other', () => {
    for (const { file } of READMES) {
      expect(fs.existsSync(path.join(ROOT, file))).toBe(true);
    }
    expect(read('README.md')).not.toContain('README_ja.md');
    expect(read('README_ja.md')).not.toContain('README.md');
  });

  it('names the same set of checks in both', () => {
    const gates = (text: string) =>
      new Set([...text.matchAll(/yarn (check:[a-z-]+)/g)].map((match) => match[1]));
    expect(gates(read('README_ja.md'))).toEqual(gates(read('README.md')));
  });
});
