import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Strip JSON rebuilds every insert on a strip, so the engine-backed demos send
 * it from one place: `src/utils/engineApply.ts`. The scan covers that file and
 * the code the mastering and mixing demos are built from — their directories
 * and the shared composables and components. /studio's bounce, the inline
 * demos and the other demos drive the engine on their own terms and are out of
 * scope.
 */
const root = join(__dirname, '../..');
const SCOPE = [
  'src/utils/engineApply.ts',
  'src/demos/mastering',
  'src/demos/mixing',
  'src/composables',
  'src/components',
];
const OWNER = 'src/utils/engineApply.ts';
const STRIP_JSON_CALL = /setTrackStripJson|setMasterStripJson|setBusStripJson|setStripInserts/;

function sourceFiles(path: string): string[] {
  if (!existsSync(path)) return [];
  if (!statSync(path).isDirectory()) return /\.(ts|vue)$/.test(path) ? [path] : [];
  return readdirSync(path).flatMap((name) => sourceFiles(join(path, name)));
}

describe('strip JSON call site', () => {
  const files = SCOPE.flatMap((entry) => sourceFiles(join(root, entry))).map((file) =>
    relative(root, file),
  );
  const hits = files.filter((file) => STRIP_JSON_CALL.test(readFileSync(join(root, file), 'utf8')));

  it('scans a non-empty set that includes the owner', () => {
    expect(files).toContain(OWNER);
    expect(files.length).toBeGreaterThan(1);
  });

  it('sends strip JSON only from engineApply.ts', () => {
    expect(hits).toContain(OWNER);
    expect(hits.filter((file) => file !== OWNER)).toEqual([]);
  });
});
