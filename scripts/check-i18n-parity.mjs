#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

export function checkI18nParity({
  root = process.cwd(),
  enLocalePath = path.join(root, 'src/locales/en.json'),
  jaLocalePath = path.join(root, 'src/locales/ja.json'),
} = {}) {
  const enLocale = JSON.parse(fs.readFileSync(enLocalePath, 'utf8'));
  const jaLocale = JSON.parse(fs.readFileSync(jaLocalePath, 'utf8'));
  const failures = [];

  compareKeySets(failures, 'locales', enLocale, jaLocale);
  checkLiteralLocaleUsage({ root, enLocale, failures });
  compareMirroredMarkdown(
    failures,
    'docs',
    path.join(root, 'src/docs'),
    path.join(root, 'src/ja/docs'),
  );

  return failures;
}

export function flattenKeys(value, prefix = '') {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return Object.entries(value).flatMap(([key, child]) =>
      flattenKeys(child, prefix ? `${prefix}.${key}` : key),
    );
  }
  return [prefix];
}

function compareKeySets(failures, name, left, right) {
  const leftKeys = new Set(flattenKeys(left));
  const rightKeys = new Set(flattenKeys(right));

  for (const key of [...leftKeys].sort()) {
    if (!rightKeys.has(key)) failures.push(`${name}: ja missing key ${key}`);
  }
  for (const key of [...rightKeys].sort()) {
    if (!leftKeys.has(key)) failures.push(`${name}: en missing key ${key}`);
  }
}

export function listMarkdownFiles(dir, baseDir = dir) {
  if (!fs.existsSync(dir)) return [];

  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...listMarkdownFiles(fullPath, baseDir));
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      out.push(path.relative(baseDir, fullPath));
    }
  }
  return out.sort();
}

function compareMirroredMarkdown(failures, label, enDir, jaDir) {
  const enFiles = new Set(listMarkdownFiles(enDir));
  const jaFiles = new Set(listMarkdownFiles(jaDir));

  for (const file of [...enFiles].sort()) {
    if (!jaFiles.has(file)) failures.push(`${label}: ja missing ${file}`);
  }
  for (const file of [...jaFiles].sort()) {
    if (!enFiles.has(file)) failures.push(`${label}: en missing ${file}`);
  }
}

export function getByPath(value, keyPath) {
  return keyPath.split('.').reduce((current, key) => {
    if (current && typeof current === 'object' && key in current) {
      return current[key];
    }
    return undefined;
  }, value);
}

export function listSourceFiles(dir) {
  if (!fs.existsSync(dir)) return [];

  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'wasm' || entry.name === 'public') continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...listSourceFiles(fullPath));
    } else if (entry.isFile() && /\.(vue|ts|js)$/.test(entry.name)) {
      out.push(fullPath);
    }
  }
  return out.sort();
}

function checkLiteralLocaleUsage({ root, enLocale, failures }) {
  const localeKeys = new Set(flattenKeys(enLocale));
  const tCallPattern = /\bt\(\s*['"]([^'"`$]+)['"]/g;

  for (const file of listSourceFiles(path.join(root, 'src'))) {
    const source = fs.readFileSync(file, 'utf8');
    for (const match of source.matchAll(tCallPattern)) {
      const key = match[1];
      if (!localeKeys.has(key) || getByPath(enLocale, key) === undefined) {
        failures.push(`locale usage: missing key ${key} in ${path.relative(root, file)}`);
      }
    }
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const failures = checkI18nParity();

  if (failures.length > 0) {
    console.error('i18n parity check failed:');
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }

  console.log('i18n parity check passed');
}
