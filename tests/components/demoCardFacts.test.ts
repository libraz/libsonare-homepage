// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { buildDemoCards, demoCardsCopy } from '@/components/demo-cards/demoCards';
import * as wasm from '@/wasm/index.js';

/**
 * A card chip that counts something is a claim about the engine, and a number
 * typed once beside a picture is the kind that goes quietly stale — the synth
 * card said fifteen engines and sixty-nine presets against an engine that has
 * seventeen and seventy. These pin the counted chips to the engine itself.
 */
const cards = buildDemoCards(demoCardsCopy.en, (path) => path);

function chipsOf(id: string): string[] {
  const card = cards.find((entry) => entry.id === id);
  if (!card) throw new Error(`no card for ${id}`);
  return card.chips;
}

/** The leading integer of the one chip ending in `word`. */
function countedChip(id: string, word: string): number {
  const chip = chipsOf(id).find((text) => text.endsWith(word));
  expect(chip, `${id} has no "${word}" chip`).toBeDefined();
  const digits = (chip as string).match(/^(\d+)/);
  expect(digits, `${chip} does not start with a number`).not.toBeNull();
  return Number((digits as RegExpMatchArray)[1]);
}

describe('the synth card counts what the engine actually ships', () => {
  it('counts the engines a visitor can reach, not the ones the type lists', async () => {
    await wasm.init();
    // The page plays engines by loading presets, so an engine with no preset is not
    // reachable from it. `sample` is one: it needs a sample bank the page never loads.
    const reachable = new Set(
      wasm.synthPresetNames().map((name) => wasm.synthPresetPatch(name).engineMode),
    );
    reachable.delete('default');
    reachable.delete(undefined);
    expect(countedChip('synth', 'ENGINES')).toBe(reachable.size);
    expect(reachable.size).toBeLessThan(
      wasm.SYNTH_ENGINE_MODES.filter((mode) => mode !== 'default').length,
    );
  });

  it('counts the presets', async () => {
    await wasm.init();
    expect(countedChip('synth', 'PRESETS')).toBe(wasm.synthPresetNames().length);
  });
});

describe('the GS card counts what the format has', () => {
  it('counts the parts a GS module addresses', () => {
    expect(countedChip('gs-module', 'PARTS')).toBe(16);
  });
});

describe('the classic-synth card counts what its own page offers', () => {
  it('counts the filter models', async () => {
    const { FILTER_MODELS } = await import('@/demos/classic-synth/classicSynthState');
    expect(countedChip('classic-synth', 'FILTERS')).toBe(FILTER_MODELS.length);
  });

  it('sizes the matrix chip by the axes the page actually offers', async () => {
    const { MOD_SOURCES, MOD_DESTINATIONS } = await import(
      '@/demos/classic-synth/classicSynthState'
    );
    const chip = chipsOf('classic-synth').find((text) => text.includes('MATRIX'));
    expect(chip).toBe(`${MOD_SOURCES.length} × ${MOD_DESTINATIONS.length} MATRIX`);
  });
});

describe('every card', () => {
  it('carries chips, and none of them is empty', () => {
    for (const card of cards) {
      expect(card.chips.length, `${card.id} has no chips`).toBeGreaterThan(0);
      for (const chip of card.chips) expect(chip.trim().length).toBeGreaterThan(0);
    }
  });
});
