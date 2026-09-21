import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildDemoCards, demoCardsCopy } from '@/components/demo-cards/demoCards';
import { DEMO_MANIFEST, demoSourceUrl, LISTED_DEMOS, REPO_URL } from '@/demos/manifest';

const root = join(__dirname, '../..');

describe('demo manifest', () => {
  it('points every demo at a source directory that exists and holds its entry component', () => {
    for (const demo of DEMO_MANIFEST) {
      const dir = join(root, demo.dir);
      expect(existsSync(dir), `${demo.id}: ${demo.dir} is missing`).toBe(true);
      const entries = readdirSync(dir);
      expect(
        entries.some((name) => name.endsWith('.vue')),
        `${demo.id}: ${demo.dir} has no component`,
      ).toBe(true);
    }
  });

  it('keeps each demo directory self-contained — no imports from another demo', () => {
    for (const demo of DEMO_MANIFEST) {
      const foreign = sourceFiles(join(root, demo.dir)).flatMap((file) => {
        const source = readFileSync(file, 'utf8');
        return [...source.matchAll(/@\/demos\/([a-z-]+)/g)]
          .map((match) => match[1])
          .filter((slug) => slug !== demo.dir.replace('src/demos/', ''))
          .map((slug) => `${file.replace(`${root}/`, '')} -> @/demos/${slug}`);
      });
      expect(foreign, `${demo.id} reaches into another demo`).toEqual([]);
    }
  });

  it('gives every demo route a page in every locale', () => {
    for (const demo of DEMO_MANIFEST) {
      const page = `${demo.route.replace(/^\//, '')}.md`;
      expect(existsSync(join(root, 'src', page)), `missing src/${page}`).toBe(true);
      expect(existsSync(join(root, 'src/ja', page)), `missing src/ja/${page}`).toBe(true);
    }
  });

  it('builds one card per listed demo, in manifest order', () => {
    const cards = buildDemoCards(demoCardsCopy.en, (path) => path);
    expect(cards.map((card) => card.id)).toEqual(LISTED_DEMOS.map((demo) => demo.id));
    expect(cards.map((card) => card.path)).toEqual(LISTED_DEMOS.map((demo) => demo.route));
  });

  it('links a demo source directory inside this repository', () => {
    expect(demoSourceUrl('mastering')).toBe(`${REPO_URL}/tree/main/src/demos/mastering`);
  });
});

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.(ts|vue)$/.test(entry.name) ? [full] : [];
  });
}
