/**
 * Where the /gs-module demo's committed reference data comes from, shared by
 * the generator and the staleness gate.
 *
 * Kept apart from the generator so the gate does not have to load it: the
 * generator imports a TypeScript module and a Vue-free WASM build, and neither
 * belongs in a check that only compares hashes.
 */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export const ENGINE_DIR = path.resolve(ROOT, '../libsonare');
export const OUT_DIR = path.join(ROOT, 'src/demos/gs-module/data');
export const WASM_META = path.join(ROOT, 'src/wasm/meta.json');

export const EFX_BINDINGS_DIR = 'tools/gs/efx-bindings';

/**
 * The binding files, listed from the checkout rather than written down: the
 * tree holds one per effect-type MSB, and a new MSB has to be picked up rather
 * than silently skipped. Without a checkout there is nothing to hash and
 * nothing to compare, which is the one case the gate already sits out.
 */
const EFX_BINDING_FILES = fs.existsSync(path.join(ENGINE_DIR, EFX_BINDINGS_DIR))
  ? fs
      .readdirSync(path.join(ENGINE_DIR, EFX_BINDINGS_DIR))
      .filter((name) => name.endsWith('.json'))
      .sort()
  : [];

/**
 * One row per artifact: the file it writes and the inputs whose hashes it
 * records. `engineRelative` inputs are resolved inside the sibling checkout;
 * `wasmMd5` means the artifact was measured against the bundled engine build
 * and follows that instead.
 */
export const ARTIFACTS = [
  {
    file: 'address-table.json',
    engineRelative: [
      'tools/gs/dump_address_table.cpp',
      'src/midi/synth/gs_address_table.h',
      'src/midi/synth/gs_address_table.cpp',
    ],
  },
  {
    file: 'efx-tables.json',
    engineRelative: ['tools/gs/efx-tables.json'],
  },
  {
    file: 'efx-bindings.json',
    engineRelative: EFX_BINDING_FILES.map((name) => `${EFX_BINDINGS_DIR}/${name}`),
  },
  {
    file: 'efx-audibility.json',
    engineRelative: [],
    wasmMd5: true,
  },
];

export function artifact(file) {
  const found = ARTIFACTS.find((entry) => entry.file === file);
  if (!found) throw new Error(`Unknown GS data artifact: ${file}`);
  return found;
}

export function sha256(file) {
  return createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

/** The `_sources` block an artifact records: `{ <input>: <digest> }`. */
export function digestSources(entry, engineDir = ENGINE_DIR) {
  const sources = Object.fromEntries(
    entry.engineRelative.map((rel) => [rel, sha256(path.join(engineDir, rel))]),
  );
  if (entry.wasmMd5) {
    sources['src/wasm/sonare.wasm'] = JSON.parse(fs.readFileSync(WASM_META, 'utf8')).md5;
  }
  return sources;
}
