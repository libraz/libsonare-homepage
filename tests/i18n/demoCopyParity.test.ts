import { describe, expect, it } from 'vitest';
import { enCopy as masteringEn, jaCopy as masteringJa } from '@/demos/mastering/masteringCopy';
import { enCopy as mixingEn, jaCopy as mixingJa } from '@/demos/mixing/mixingCopy';
import { MIXING_TERM_SLUGS } from '@/demos/mixing/mixingTerms';
import {
  enCopy as analysisEn,
  jaCopy as analysisJa,
} from '@/demos/music-analysis/musicAnalysisCopy';
import { enCopy as fxEn, jaCopy as fxJa } from '@/demos/realtime-fx/realtimeFxCopy';
import { MODEL_DESIGNATION } from '@/utils/modelNames';

function keyPaths(value: unknown, prefix = ''): string[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [prefix];

  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return keyPaths(child, path);
  });
}

/** Every string in a copy object, arrays included, with its path. */
function stringLeaves(value: unknown, prefix = ''): Array<[string, string]> {
  if (typeof value === 'string') return [[prefix, value]];
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
    stringLeaves(child, prefix ? `${prefix}.${key}` : key),
  );
}

function placeholders(text: string): string[] {
  return [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();
}

function expectSameLeafPaths(en: unknown, ja: unknown) {
  expect(keyPaths(ja).sort()).toEqual(keyPaths(en).sort());
}

function expectTermShape(copy: {
  terms: {
    items: Record<string, { title?: string; body?: string; tip?: string; default?: string }>;
  };
}) {
  for (const [key, term] of Object.entries(copy.terms.items)) {
    expect(term.title, `${key}.title`).toEqual(expect.any(String));
    expect(term.body, `${key}.body`).toEqual(expect.any(String));
    expect(term.tip, `${key}.tip`).toEqual(expect.any(String));
    expect(term.title).not.toBe('');
    expect(term.body).not.toBe('');
    expect(term.tip).not.toBe('');
  }
}

describe('demo copy parity', () => {
  it('keeps music-analysis English and Japanese copy structurally identical', () => {
    expectSameLeafPaths(analysisEn, analysisJa);
    expectTermShape(analysisEn);
    expectTermShape(analysisJa);
    expect(Object.keys(analysisEn.stages)).toEqual([
      'Preparing audio',
      'Optimizing long file',
      'Loading libsonare WASM',
      'Running musical analysis',
      'Finding alternate keys',
      'Detecting downbeats and sections',
      'Tracing melody',
      'Measuring loudness',
      'Metering signal',
      'Computing chroma',
      'Computing mel spectrogram',
      'Computing CQT',
      'Finalizing report',
    ]);
  });

  it('keeps realtime FX English and Japanese copy structurally identical', () => {
    expectSameLeafPaths(fxEn, fxJa);
    expectTermShape(fxEn);
    expectTermShape(fxJa);
    expect(Object.keys(fxEn.controls)).toEqual([
      'pitch',
      'formant',
      'brightness',
      'wet',
      'output',
      'bypass',
    ]);
  });

  it('keeps mixing copy parity and term glossary slug coverage aligned', () => {
    expectSameLeafPaths(mixingEn, mixingJa);
    expectTermShape(mixingEn);
    expectTermShape(mixingJa);

    expect(mixingJa.panModes).toHaveLength(mixingEn.panModes.length);
    expect(mixingJa.panLaws).toHaveLength(mixingEn.panLaws.length);
    expect(mixingJa.automationParams).toHaveLength(mixingEn.automationParams.length);
    expect(mixingJa.automationCurves).toHaveLength(mixingEn.automationCurves.length);

    expect(Object.keys(MIXING_TERM_SLUGS).sort()).toEqual(Object.keys(mixingEn.terms.items).sort());
    for (const slug of Object.values(MIXING_TERM_SLUGS)) {
      if (slug !== undefined) {
        expect(slug).toMatch(/^concepts\/[a-z0-9-]+$/);
      }
    }
  });

  it('keeps mastering copy parity, with the same placeholders in both languages', () => {
    expectSameLeafPaths(masteringEn, masteringJa);
    const ja = new Map(stringLeaves(masteringJa));
    for (const [path, text] of stringLeaves(masteringEn)) {
      expect(text.trim(), path).not.toBe('');
      expect(ja.get(path)?.trim(), path).not.toBe('');
      expect(placeholders(ja.get(path) ?? ''), path).toEqual(placeholders(text));
    }
    expect(masteringJa.eq.traces).toHaveLength(masteringEn.eq.traces.length);
  });

  it('prints no model designation anywhere in the mastering or mixing copy', () => {
    const copies = { masteringEn, masteringJa, mixingEn, mixingJa };
    for (const [name, copy] of Object.entries(copies)) {
      for (const [path, text] of stringLeaves(copy)) {
        expect(MODEL_DESIGNATION.test(text), `${name}.${path}: ${text}`).toBe(false);
      }
    }
  });
});
