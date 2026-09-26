// @vitest-environment node
import { beforeAll, describe, expect, it } from 'vitest';
import { paramMetaKey, paramMetaOf } from '@/demos/gs-module/gsParamMeta';
import * as wasm from '@/wasm/index.js';

describe('paramMetaKey', () => {
  it('joins stage and key with a slash', () => {
    expect(paramMetaKey('eq.parametric', 'band1.frequencyHz')).toBe(
      'eq.parametric/band1.frequencyHz',
    );
  });
});

describe('paramMetaOf', () => {
  let meta: ReturnType<typeof paramMetaOf>;
  beforeAll(async () => {
    await wasm.init();
    meta = paramMetaOf(wasm);
  }, 30_000);

  it('describes a stage/key pair the bundled engine carries', () => {
    expect(meta.size).toBeGreaterThan(0);
    const gain = meta.get(paramMetaKey('eq.parametric', 'band1.gainDb'));
    expect(gain).toBeDefined();
  });

  it('describes the utility gain control carried by the current catalog', () => {
    expect(meta.get(paramMetaKey('utility.gain', 'levelDb'))).toEqual({
      unit: 'dB',
      min: null,
      max: null,
      default: 0,
    });
  });

  it('caches across calls rather than re-parsing the catalog', () => {
    expect(paramMetaOf(wasm)).toBe(meta);
  });
});
