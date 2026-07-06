import { describe, expect, it } from 'vitest';
import { implementedDemoArchetypes } from '@/components/demos/archetypes';
import { allDemos, demoIds, getDemo } from '@/demos/registry';
import type { DemoSource, I18nText, ParamDef, SonareDemoDef, VizKind } from '@/demos/types';

const ARCHETYPES = new Set([
  'transform',
  'detector',
  'ab-process',
  'meters',
  'param-sweep',
  'synth',
  'signal',
  'room',
  'contour',
  'lane-mixer',
  'spectral-edit',
  'piano-roll',
  'score',
  'compressor',
  'true-peak',
  'send-routing',
  'mono-fold',
  'comping',
  'hpss',
  'tempo-grid',
  'instrument-audition',
  'pitch-correct',
]);

const GENERATED_SIGNALS = new Set(['sine', 'saw', 'square', 'triangle', 'sweep', 'noise']);
const VIZ_KINDS = new Set<VizKind>([
  'waveform',
  'spectrogram',
  'chroma',
  'meters',
  'scope',
  'heatmap',
  'overlay',
]);
const ARCHETYPE_SOURCE_KINDS = {
  transform: ['generate', 'clip'],
  detector: ['clip'],
  'ab-process': ['clip'],
  meters: ['clip'],
  'param-sweep': ['clip'],
  synth: ['generate'],
  signal: ['generate'],
  room: ['generate'],
  contour: ['clip'],
  'lane-mixer': ['generate'],
  'spectral-edit': ['clip'],
  'piano-roll': ['generate'],
  score: ['generate'],
  compressor: ['generate'],
  'true-peak': ['generate'],
  'send-routing': ['generate'],
  'mono-fold': ['generate'],
  comping: ['clip'],
  hpss: ['clip'],
  'tempo-grid': ['generate'],
  'instrument-audition': ['generate'],
  'pitch-correct': ['generate'],
} satisfies Record<string, Array<DemoSource['kind']>>;
const TRANSFORMS = new Set(['stft', 'mel', 'chroma', 'mfcc']);
const PARAM_SWEEP_PROCESSORS = new Set([
  'pitch-shift',
  'time-stretch',
  'formant-shift',
  'griffin-lim',
  'tilt-eq',
]);

function expectBilingual(text: I18nText | undefined, where: string) {
  expect(text, `${where} missing`).toBeTruthy();
  expect(text?.en?.trim(), `${where}.en empty`).toBeTruthy();
  expect(text?.ja?.trim(), `${where}.ja empty`).toBeTruthy();
  for (const [locale, value] of Object.entries(text ?? {})) {
    expect(value.trim(), `${where}.${locale} empty`).toBeTruthy();
  }
}

function expectWellFormedParam(param: ParamDef, where: string) {
  expect(param.key, `${where}.key empty`).toMatch(/^[a-z][a-zA-Z0-9]*$/);

  if (param.kind === 'range') {
    expect(typeof param.default, `${where}.default must be a number`).toBe('number');
    expect(Number.isFinite(param.default), `${where}.default must be finite`).toBe(true);
    expect(typeof param.min, `${where}.min missing`).toBe('number');
    expect(typeof param.max, `${where}.max missing`).toBe('number');
    expect(param.min, `${where}.min must be below max`).toBeLessThan(param.max as number);
    expect(param.default, `${where}.default below min`).toBeGreaterThanOrEqual(param.min as number);
    expect(param.default, `${where}.default above max`).toBeLessThanOrEqual(param.max as number);
    if (param.step !== undefined) {
      expect(param.step, `${where}.step must be positive`).toBeGreaterThan(0);
    }
    if (typeof param.unit === 'object') {
      expectBilingual(param.unit, `${where}.unit`);
    }
    expect(param.options, `${where}.options not allowed on range`).toBeUndefined();
    return;
  }

  if (param.kind === 'select') {
    expect(typeof param.default, `${where}.default must be a string`).toBe('string');
    expect(param.options?.length, `${where}.options missing`).toBeGreaterThan(0);
    const values = param.options?.map((opt) => opt.value) ?? [];
    expect(new Set(values).size, `${where}.options duplicate values`).toBe(values.length);
    expect(values, `${where}.default missing from options`).toContain(param.default);
    expect(param.min, `${where}.min not allowed on select`).toBeUndefined();
    expect(param.max, `${where}.max not allowed on select`).toBeUndefined();
    expect(param.step, `${where}.step not allowed on select`).toBeUndefined();
    return;
  }

  expect(typeof param.default, `${where}.default must be boolean`).toBe('boolean');
  expect(param.options, `${where}.options not allowed on toggle`).toBeUndefined();
  expect(param.min, `${where}.min not allowed on toggle`).toBeUndefined();
  expect(param.max, `${where}.max not allowed on toggle`).toBeUndefined();
  expect(param.step, `${where}.step not allowed on toggle`).toBeUndefined();
}

function expectPositiveNumber(value: number | undefined, where: string) {
  if (value === undefined) return;
  expect(Number.isFinite(value), `${where} must be finite`).toBe(true);
  expect(value, `${where} must be positive`).toBeGreaterThan(0);
}

function expectWellFormedSource(source: DemoSource, where: string) {
  if (source.kind === 'clip') {
    expect(source.clip, `${where}.clip must be kebab-case`).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    return;
  }

  expect(GENERATED_SIGNALS.has(source.signal), `${where}.signal unsupported`).toBe(true);
  expectPositiveNumber(source.freq, `${where}.freq`);
  expectPositiveNumber(source.freqEnd, `${where}.freqEnd`);
  expectPositiveNumber(source.duration, `${where}.duration`);
  expectPositiveNumber(source.sampleRate, `${where}.sampleRate`);
  if (source.gain !== undefined) {
    expect(Number.isFinite(source.gain), `${where}.gain must be finite`).toBe(true);
    expect(source.gain, `${where}.gain below 0`).toBeGreaterThanOrEqual(0);
    expect(source.gain, `${where}.gain above 1`).toBeLessThanOrEqual(1);
  }
  if (source.signal === 'sweep') {
    expect(source.freq, `${where}.freq required for sweep`).toBeGreaterThan(0);
    expect(source.freqEnd, `${where}.freqEnd required for sweep`).toBeGreaterThan(0);
  }
}

function expectWellFormedConfig(def: SonareDemoDef) {
  const config = def.config ?? {};
  for (const [key, value] of Object.entries(config)) {
    if (typeof value === 'number') {
      expect(Number.isFinite(value), `${def.id}.config.${key} must be finite`).toBe(true);
      expect(value, `${def.id}.config.${key} must be positive`).toBeGreaterThan(0);
    }
  }

  if (def.archetype === 'transform' && config.transform !== undefined) {
    expect(TRANSFORMS.has(String(config.transform)), `${def.id}.config.transform unsupported`).toBe(
      true,
    );
  }

  if (def.archetype === 'param-sweep' && config.processor !== undefined) {
    expect(
      PARAM_SWEEP_PROCESSORS.has(String(config.processor)),
      `${def.id}.config.processor unsupported`,
    ).toBe(true);
  }
}

describe('demo registry', () => {
  it('has unique kebab-case ids', () => {
    const ids = demoIds();
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it('has a component implementation for every referenced archetype', () => {
    const implemented = new Set(implementedDemoArchetypes());
    for (const archetype of new Set(allDemos.map((def) => def.archetype))) {
      expect(implemented.has(archetype), `${archetype} has no dispatcher component`).toBe(true);
    }
  });

  it.each(allDemos)('def "$id" is well-formed and bilingual', (def: SonareDemoDef) => {
    expect(ARCHETYPES.has(def.archetype)).toBe(true);
    expect(ARCHETYPE_SOURCE_KINDS[def.archetype], `${def.id}.archetype source contract`).toContain(
      def.source.kind,
    );
    if (def.viz) expect(VIZ_KINDS.has(def.viz), `${def.id}.viz unsupported`).toBe(true);
    expectBilingual(def.title, `${def.id}.title`);
    if (def.caption) expectBilingual(def.caption, `${def.id}.caption`);

    const paramKeys = def.params?.map((param) => param.key) ?? [];
    expect(new Set(paramKeys).size, `${def.id}.params duplicate keys`).toBe(paramKeys.length);
    for (const param of def.params ?? []) {
      expectBilingual(param.label, `${def.id}.param[${param.key}].label`);
      expectWellFormedParam(param, `${def.id}.param[${param.key}]`);
      for (const opt of param.options ?? []) {
        expectBilingual(opt.label, `${def.id}.param[${param.key}].option[${opt.value}].label`);
      }
    }

    expectWellFormedSource(def.source, `${def.id}.source`);
    expectWellFormedConfig(def);

    expect(getDemo(def.id)).toBe(def);
  });
});
