#!/usr/bin/env node
/**
 * Flag committed GS reference data that no longer matches what it was
 * generated from. Each artifact records the digest of every input, so drift is
 * a comparison rather than a regeneration.
 *
 * The two derived artifacts follow engine sources and are only checkable next
 * to a sibling checkout, which a deploy build does not have — that half skips.
 * The measured artifact follows the bundled WASM and is always checkable, which
 * is the one that matters most: refreshing the engine silently invalidates it.
 *
 * Refresh with `yarn generate:gs-data`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ARTIFACTS, digestSources, ENGINE_DIR, OUT_DIR } from './lib/gs-data-sources.mjs';

/** `{ file, missing, stale: [{ source, recorded, actual }] }` for one artifact. */
export function compareArtifact(entry, outDir = OUT_DIR, engineDir = ENGINE_DIR) {
  const target = path.join(outDir, entry.file);
  if (!fs.existsSync(target)) return { file: entry.file, missing: true, stale: [] };

  const recorded = JSON.parse(fs.readFileSync(target, 'utf8'))._sources ?? {};
  const actual = digestSources(entry, engineDir);
  const stale = Object.entries(actual)
    .filter(([source, digest]) => recorded[source] !== digest)
    .map(([source, digest]) => ({
      source,
      recorded: recorded[source] ?? '(not recorded)',
      actual: digest,
    }));
  return { file: entry.file, missing: false, stale };
}

function main() {
  const hasEngine = fs.existsSync(ENGINE_DIR);
  const checkable = ARTIFACTS.filter((entry) => hasEngine || entry.engineRelative.length === 0);
  const skipped = ARTIFACTS.length - checkable.length;

  let failed = false;
  for (const entry of checkable) {
    const result = compareArtifact(entry);
    if (result.missing) {
      console.error(`❌ ${result.file} is missing`);
      failed = true;
      continue;
    }
    for (const { source, recorded, actual } of result.stale) {
      console.error(`❌ ${result.file} was generated from an older ${source}`);
      console.error(`   recorded ${recorded.slice(0, 12)} · now ${actual.slice(0, 12)}`);
      failed = true;
    }
  }

  if (failed) {
    console.error('\n   Run: yarn generate:gs-data');
    process.exit(1);
  }
  const note = skipped > 0 ? ` (${skipped} skipped — no libsonare checkout beside this repo)` : '';
  console.log(`check:gs-data — ${checkable.length} artifacts match their sources${note}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
