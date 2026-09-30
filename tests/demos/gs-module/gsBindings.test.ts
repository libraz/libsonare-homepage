// @vitest-environment node
import { describe, expect, it } from 'vitest';
import efxBindings from '@/demos/gs-module/data/efx-bindings.json';
import {
  bindingTargets,
  EFX_BINDING_COUNTS,
  GS_EFX_TYPES,
  type GsBindingForm,
  slotBinding,
} from '@/demos/gs-module/gsEfx';
import { GS_EFX_PARAMS, GS_EFX_STAGES } from '@/demos/gs-module/gsNames';

const BINDING_FORMS: readonly GsBindingForm[] = ['translated', 'designed', 'enables'];
const KNOWN_TYPES = new Set(GS_EFX_TYPES.map((entry) => entry.key));
const rows = efxBindings.rows as readonly Record<string, any>[];

function keysOf(row: Record<string, any>): string[] {
  return row.keys ?? (row.key === undefined ? [] : [row.key]);
}

function leafOf(key: string): string {
  return key.includes('.') ? key.slice(key.lastIndexOf('.') + 1) : key;
}

describe('efx-bindings.json rows', () => {
  it('contains the 770 rows in the three explicit schema forms', () => {
    expect(rows).toHaveLength(770);
    const counted = Object.fromEntries(
      BINDING_FORMS.map((form) => [form, rows.filter((row) => row.form === form).length]),
    );
    expect(counted).toEqual({ translated: 379, designed: 362, enables: 29 });
    expect(efxBindings.counts).toEqual(counted);
    expect(EFX_BINDING_COUNTS).toEqual(counted);
    for (const row of rows) expect(BINDING_FORMS).toContain(row.form);
  });

  it('preserves the inspector fields and publishes no authoring notes', () => {
    const obsolete = ['state', 'unmapped', 'builder', 'unreadable', 'note', 'named_by'];
    for (const row of rows) {
      expect(row.printed_name).toEqual(expect.any(String));
      expect(row.form).toEqual(expect.any(String));
      for (const field of obsolete) expect(row[field]).toBeUndefined();
      if (row.form === 'enables') {
        expect(row.enables).toEqual(expect.any(Object));
      } else {
        expect(row.stage).toEqual(expect.any(String));
        expect(keysOf(row).length).toBeGreaterThan(0);
      }
    }
  });

  it('joins onto a known effect type, or onto one through the 03 00 alias', () => {
    const unknownTypes = new Set(
      rows.map((row) => row.type).filter((type) => !KNOWN_TYPES.has(type)),
    );
    expect(unknownTypes).toEqual(new Set(['02 0C']));
    expect(slotBinding('03 00', 0)).toEqual(slotBinding('02 0C', 0));
  });

  it('keeps all designed and enables law metadata required by the panel', () => {
    for (const row of rows) {
      if (row.form === 'designed') {
        expect(row.designed).toEqual(
          expect.objectContaining({
            basis: expect.stringMatching(/^(carried|invented)$/),
            law: expect.any(String),
          }),
        );
        expect(row.printed_values).toEqual(expect.any(String));
      }
      if (row.form === 'enables') {
        expect(row.enables.basis).toBe('invented');
        expect(row.enables.replaced_when).toEqual(expect.any(Object));
        expect(row.enables.stages ?? row.enables.select).toEqual(expect.any(Array));
      }
    }
  });

  it('retains alternatives and ordinal lists as addressable targets', () => {
    expect(rows.some((row) => Array.isArray(row.ordinal))).toBe(true);
    expect(rows.some((row) => Array.isArray(row.alternatives) && row.alternatives.length > 0)).toBe(
      true,
    );
    for (const row of rows) {
      const binding = slotBinding(row.type, row.slot);
      expect(binding).not.toBeNull();
      if (row.form === 'enables') continue;
      const targets = bindingTargets(binding!);
      expect(targets.length).toBeGreaterThan(0);
      if (Array.isArray(row.ordinal))
        expect(targets.length).toBeGreaterThanOrEqual(row.ordinal.length);
      if (row.alternatives) expect(targets.length).toBeGreaterThan(1);
    }
  });
});

describe('localized modern target names', () => {
  it('names every primary, alternative, and enables stage in English and Japanese', () => {
    for (const row of rows) {
      const binding = slotBinding(row.type, row.slot);
      expect(binding).not.toBeNull();
      const stages = [
        ...(binding ? bindingTargets(binding).map((target) => target.stage) : []),
        ...(binding?.enables?.stages.map((target) => target.stage) ?? []),
      ];
      for (const stage of stages) {
        expect(GS_EFX_STAGES[stage], `stage ${stage} has no bilingual label`).toEqual(
          expect.objectContaining({ en: expect.any(String), ja: expect.any(String) }),
        );
      }
      for (const target of binding ? bindingTargets(binding) : []) {
        for (const key of target.keys) {
          const leaf = leafOf(key);
          if (/^band\d+GainDb$/.test(leaf)) continue;
          expect(GS_EFX_PARAMS[leaf], `key ${leaf} has no bilingual label`).toEqual(
            expect.objectContaining({ en: expect.any(String), ja: expect.any(String) }),
          );
        }
      }
    }
  });
});

describe('measured audibility metadata', () => {
  it('keeps a measured status for every effect type without a realised flag', () => {
    expect(GS_EFX_TYPES).toHaveLength(65);
    for (const entry of GS_EFX_TYPES) {
      expect(entry.slots).toHaveLength(20);
      expect(entry).not.toHaveProperty('realised');
      expect(entry).toHaveProperty('changesSignal');
    }
  });
});
