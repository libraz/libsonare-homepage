// @vitest-environment node

import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';

// Execute the CLI module in Node so Vite's dynamic-import transform does not
// prepend a browser import ahead of its shebang.
function validateEfxBindings(rows: unknown[], slotCount: number) {
  const moduleUrl = pathToFileURL(path.resolve('scripts/generate-gs-data.mjs')).href;
  const script = `
    import { validateEfxBindings } from ${JSON.stringify(moduleUrl)};
    const [rows, slots] = JSON.parse(process.argv[1]);
    console.log(JSON.stringify(validateEfxBindings(rows, slots)));
  `;
  return JSON.parse(
    execFileSync(
      process.execPath,
      ['--input-type=module', '-e', script, JSON.stringify([rows, slotCount])],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    ),
  );
}

const target = {
  type: '01 10',
  slot: 0,
  printed_name: 'Drive',
  printed_values: '00–7F',
  stage: 'saturation.ampSim',
  key: 'inputDb',
};
const designed = {
  basis: 'invented',
  law: 'd.unit',
  replaced_when: { model_binding: ['01 10', '40 03 03'] },
};
const enables = {
  stages: [{ stage: 'saturation.ampSim' }],
  on_states: [1],
  basis: 'invented',
  replaced_when: { model_binding: ['01 10', '40 03 04'] },
};

describe('GS binding schema validation', () => {
  it('accepts measured controls, designed controls and stage switches', () => {
    const rows = [
      { ...target, class: 'gain', table: 'tone' },
      { ...target, slot: 1, designed },
      { type: '01 10', slot: 2, printed_name: 'Drive Sw', enables },
    ];
    expect(validateEfxBindings(rows, 20)).toEqual(rows);
  });

  it.each(['state', 'unmapped', 'builder', 'unreadable'])(
    'rejects obsolete %s bindings instead of publishing them',
    (form) => {
      expect(() => validateEfxBindings([{ ...target, [form]: 'unused' }], 20)).toThrow(/obsolete/);
    },
  );

  it('rejects rows with conflicting control and switch forms', () => {
    expect(() => validateEfxBindings([{ ...target, designed, enables }], 20)).toThrow(
      /conflicting/,
    );
    expect(() => validateEfxBindings([{ ...target, enables }], 20)).toThrow(/enables/);
    expect(() =>
      validateEfxBindings([{ ...target, designed, class: 'gain', table: 'tone' }], 20),
    ).toThrow(/measured-law/);
  });

  it('refuses an ungrounded translation and duplicate type/slot addresses', () => {
    expect(() => validateEfxBindings([target], 20)).toThrow(/class\/table/);
    const row = { ...target, class: 'gain', table: 'tone' };
    expect(() => validateEfxBindings([row, row], 20)).toThrow(/appears twice/);
  });
});
