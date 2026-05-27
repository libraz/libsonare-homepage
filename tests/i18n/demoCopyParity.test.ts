import { describe, expect, it } from 'vitest';
import {
  enCopy as analysisEn,
  jaCopy as analysisJa,
} from '@/components/analysis/musicAnalysisCopy';
import { enCopy as mixingEn, jaCopy as mixingJa } from '@/components/mixing/mixingCopy';
import { MIXING_TERM_SLUGS } from '@/components/mixing/mixingTerms';
import { enCopy as fxEn, jaCopy as fxJa } from '@/components/realtime-fx/realtimeFxCopy';

function keyPaths(value: unknown, prefix = ''): string[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [prefix];

  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return keyPaths(child, path);
  });
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
      'wet',
      'robot',
      'reverb',
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
});
