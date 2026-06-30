import { describe, expect, it } from 'vitest';
import { createAudioBufferCache } from '@/components/practice/audioBufferCache';

describe('practice audio buffer cache', () => {
  it('stores buffers by piece and speed', () => {
    const cache = createAudioBufferCache<{ id: string }>('mv0', 4);
    const first = { id: 'first' };
    const second = { id: 'second' };

    cache.set(1, first);
    cache.setPieceKey('mv1');
    cache.set(1, second);

    expect(cache.get(1)).toBe(second);
    cache.setPieceKey('mv0');
    expect(cache.get(1)).toBe(first);
  });

  it('evicts the least recently used entry', () => {
    const cache = createAudioBufferCache<{ id: string }>('mv0', 2);
    const one = { id: 'one' };
    const half = { id: 'half' };
    const quarter = { id: 'quarter' };

    cache.set(1, one);
    cache.set(0.5, half);
    expect(cache.get(1)).toBe(one);
    cache.set(0.25, quarter);

    expect(cache.get(0.5)).toBeUndefined();
    expect(cache.get(1)).toBe(one);
    expect(cache.get(0.25)).toBe(quarter);
  });
});
