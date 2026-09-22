// @vitest-environment node
import { describe, expect, it } from 'vitest';
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
  it('describes a stage/key pair the bundled engine carries', async () => {
    await wasm.init();
    const meta = paramMetaOf(wasm);
    expect(meta.size).toBeGreaterThan(0);
    const gain = meta.get(paramMetaKey('eq.parametric', 'band1.gainDb'));
    expect(gain).toBeDefined();
  });

  it('is ordinarily absent for a stage this build predates, not an error', async () => {
    await wasm.init();
    const meta = paramMetaOf(wasm);
    expect(meta.get(paramMetaKey('utility.gain', 'levelDb'))).toBeUndefined();
  });

  it('caches across calls rather than re-parsing the catalog', async () => {
    await wasm.init();
    expect(paramMetaOf(wasm)).toBe(paramMetaOf(wasm));
  });
});
