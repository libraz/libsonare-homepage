import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { compareArtifact } from '../../scripts/check-gs-data.mjs';
import { ARTIFACTS, sha256 } from '../../scripts/lib/gs-data-sources.mjs';

const workspaces: string[] = [];

afterEach(() => {
  for (const dir of workspaces.splice(0)) rmSync(dir, { recursive: true, force: true });
});

/** An engine checkout holding one source file, and an out dir for the artifact. */
function workspace(sourceText: string) {
  const root = mkdtempSync(path.join(tmpdir(), 'gs-data-'));
  workspaces.push(root);
  const engineDir = path.join(root, 'engine');
  const outDir = path.join(root, 'out');
  mkdirSync(path.join(engineDir, 'tools/gs'), { recursive: true });
  mkdirSync(outDir, { recursive: true });
  writeFileSync(path.join(engineDir, 'tools/gs/efx-tables.json'), sourceText);
  return { engineDir, outDir };
}

const SOURCE = 'tools/gs/efx-tables.json';
const entry = { file: 'efx-tables.json', engineRelative: [SOURCE] };

function writeArtifact(outDir: string, sources: Record<string, string>) {
  writeFileSync(path.join(outDir, entry.file), JSON.stringify({ _sources: sources, map: [] }));
}

/** The digest the generator would have recorded for the source as it stands. */
function currentDigest(engineDir: string): string {
  return sha256(path.join(engineDir, SOURCE));
}

describe('compareArtifact', () => {
  it('passes when the recorded digest matches the source on disk', () => {
    const { engineDir, outDir } = workspace('{"map":[]}');
    writeArtifact(outDir, { [SOURCE]: currentDigest(engineDir) });
    expect(compareArtifact(entry, outDir, engineDir)).toEqual({
      file: entry.file,
      missing: false,
      stale: [],
    });
  });

  it('reports the artifact as stale after the source changes', () => {
    const { engineDir, outDir } = workspace('{"map":[]}');
    const before = currentDigest(engineDir);
    writeArtifact(outDir, { [SOURCE]: before });
    writeFileSync(path.join(engineDir, SOURCE), '{"map":[1]}');

    const result = compareArtifact(entry, outDir, engineDir);
    expect(result.stale).toHaveLength(1);
    expect(result.stale[0].recorded).toBe(before);
    expect(result.stale[0].actual).not.toBe(before);
  });

  it('reports a source the artifact never recorded', () => {
    const { engineDir, outDir } = workspace('{"map":[]}');
    writeArtifact(outDir, {});
    expect(compareArtifact(entry, outDir, engineDir).stale[0].recorded).toBe('(not recorded)');
  });

  it('reports a missing artifact rather than treating it as fresh', () => {
    const { engineDir, outDir } = workspace('{"map":[]}');
    expect(compareArtifact(entry, outDir, engineDir).missing).toBe(true);
  });
});

describe('ARTIFACTS', () => {
  it('names a distinct output file per artifact', () => {
    const files = ARTIFACTS.map((a: { file: string }) => a.file);
    expect(new Set(files).size).toBe(files.length);
  });

  it('gives every artifact at least one input to follow', () => {
    for (const a of ARTIFACTS as { file: string; engineRelative: string[]; wasmMd5?: boolean }[]) {
      expect(a.engineRelative.length > 0 || a.wasmMd5 === true).toBe(true);
    }
  });
});

function translatedRow(overrides: Record<string, unknown> = {}) {
  return {
    type: '01 00',
    slot: 0,
    stage: 'utility.gain',
    class: 'gain',
    table: 'tone',
    key: 'levelDb',
    printed_name: 'Level',
    ...overrides,
  };
}

function designedRow(overrides: Record<string, unknown> = {}) {
  return translatedRow({
    slot: 1,
    class: undefined,
    table: undefined,
    designed: {
      basis: 'invented',
      law: 'd.unit',
      replaced_when: { stage_passed: '01 00' },
    },
    printed_values: '00–7F',
    ...overrides,
  });
}

function enablesRow(overrides: Record<string, unknown> = {}) {
  return {
    type: '01 00',
    slot: 2,
    printed_name: 'Effect Sw',
    enables: {
      stages: [{ stage: 'effects.modulation.chorus' }],
      on_states: [1],
      basis: 'invented',
      replaced_when: { model_binding: ['01 00', '40 03 05'] },
    },
    ...overrides,
  };
}

/** Run the shebang-bearing generator through Node, where its TS import works unchanged. */
function generatorValidationMessage(rows: unknown[]): string {
  const script = `
    import { validateEfxBindings } from './scripts/generate-gs-data.mjs';
    try {
      validateEfxBindings(JSON.parse(process.env.GS_BINDING_ROWS), 20);
      console.log('accepted');
    } catch (error) {
      console.log(error instanceof Error ? error.message : String(error));
    }
  `;
  return execFileSync(
    process.execPath,
    ['--experimental-strip-types', '--input-type=module', '-e', script],
    {
      cwd: process.cwd(),
      env: { ...process.env, GS_BINDING_ROWS: JSON.stringify(rows) },
      encoding: 'utf8',
    },
  ).trim();
}

describe('validateEfxBindings', () => {
  it('accepts the three 1.8 forms and keeps their explicit classification available', () => {
    expect(generatorValidationMessage([translatedRow(), designedRow(), enablesRow()])).toBe(
      'accepted',
    );
  });

  it('refuses obsolete form fields', () => {
    for (const field of ['state', 'unmapped', 'builder', 'unreadable']) {
      expect(generatorValidationMessage([translatedRow({ [field]: 'old' })])).toMatch(
        /obsolete form field/,
      );
    }
  });

  it('refuses conflicting, unknown, and mismatched forms', () => {
    expect(generatorValidationMessage([designedRow({ class: 'gain', table: 'tone' })])).toMatch(
      /designed and measured-law fields|conflicting/,
    );
    expect(
      generatorValidationMessage([enablesRow({ stage: 'effects.modulation.chorus' })]),
    ).toMatch(/enables row carries stage/);
    expect(generatorValidationMessage([translatedRow({ form: 'state' })])).toMatch(/unknown form/);
    expect(generatorValidationMessage([translatedRow({ form: 'designed' })])).toMatch(
      /declares designed/,
    );
  });
});
