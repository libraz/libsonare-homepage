#!/usr/bin/env node
/**
 * Gate: inline `<SonareDemo>` widgets are well-formed and en/ja-parallel.
 *
 * Checks:
 *  1. every `id` referenced from markdown is defined in the demo registry;
 *  2. mirrored en/ja docs reference the same set of ids (i18n parity for widgets);
 *  3. every clip referenced by the registry has a file under public/demo-clips/.
 *
 * Deep per-definition shape (both locales present on every label) is asserted by the
 * vitest test `test/demo-registry.test.ts`, which can import the TypeScript directly.
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const DEMO_TAG = /<SonareDemo\s+[^>]*\bid=["']([^"']+)["']/g;
const REGISTRY_ID = /\bid:\s*["']([^"']+)["']/g;
const REGISTRY_CLIP = /\bclip:\s*["']([^"']+)["']/g;

function listMarkdown(dir, base = dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listMarkdown(full, base));
    else if (entry.isFile() && entry.name.endsWith('.md')) out.push(path.relative(base, full));
  }
  return out.sort();
}

function idsInFile(file) {
  const src = fs.readFileSync(file, 'utf8');
  const ids = new Set();
  for (const m of src.matchAll(DEMO_TAG)) ids.add(m[1]);
  return ids;
}

function collectFromRegistry(dir, pattern) {
  const found = new Set();
  if (!fs.existsSync(dir)) return found;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      for (const v of collectFromRegistry(full, pattern)) found.add(v);
    } else if (entry.isFile() && entry.name.endsWith('.ts')) {
      const src = fs.readFileSync(full, 'utf8');
      for (const m of src.matchAll(pattern)) found.add(m[1]);
    }
  }
  return found;
}

export function checkDemos({ root = process.cwd() } = {}) {
  const failures = [];
  const enDir = path.join(root, 'src/docs');
  const jaDir = path.join(root, 'src/ja/docs');
  const registryDir = path.join(root, 'src/demos/registry');
  const clipsDir = path.join(root, 'src/public/demo-clips');

  const definedIds = collectFromRegistry(registryDir, REGISTRY_ID);
  const clipNames = collectFromRegistry(registryDir, REGISTRY_CLIP);

  // 1 + 2: per mirrored markdown file, compare id usage.
  const files = new Set([...listMarkdown(enDir), ...listMarkdown(jaDir)]);
  for (const rel of [...files].sort()) {
    const enFile = path.join(enDir, rel);
    const jaFile = path.join(jaDir, rel);
    const enIds = fs.existsSync(enFile) ? idsInFile(enFile) : new Set();
    const jaIds = fs.existsSync(jaFile) ? idsInFile(jaFile) : new Set();

    for (const id of new Set([...enIds, ...jaIds])) {
      if (!definedIds.has(id)) {
        failures.push(`demos: unknown id "${id}" referenced in ${rel}`);
      }
    }
    for (const id of enIds) {
      if (!jaIds.has(id)) failures.push(`demos: id "${id}" used in en ${rel} but not ja`);
    }
    for (const id of jaIds) {
      if (!enIds.has(id)) failures.push(`demos: id "${id}" used in ja ${rel} but not en`);
    }
  }

  // 3: referenced clips exist.
  for (const name of clipNames) {
    const exists = ['opus', 'ogg', 'wav'].some((ext) =>
      fs.existsSync(path.join(clipsDir, `${name}.${ext}`)),
    );
    if (!exists) failures.push(`demos: clip "${name}" has no file under src/public/demo-clips/`);
  }

  return failures;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const failures = checkDemos();
  if (failures.length > 0) {
    console.error('demo check failed:');
    for (const f of failures) console.error(`- ${f}`);
    process.exit(1);
  }
  console.log('demo check passed');
}
