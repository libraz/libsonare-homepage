import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { flushPromises, mount } from '@vue/test-utils';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';

vi.mock('vitepress', () => ({ useData: () => ({ lang: ref('en') }) }));
vi.mock('@/demos/inline/useSonareDemoAudio', async () => {
  const engine = await vi.importActual<typeof import('@/wasm/index.js')>('@/wasm/index.js');
  const { readonly, ref } = await import('vue');
  const playingId = ref('');
  return {
    useSonareDemoAudio: () => ({
      ensureWasm: async () => engine,
      loadClip: async () => {
        throw new Error('no clips');
      },
      play: async (id: string) => {
        playingId.value = id;
      },
      stop: () => {
        playingId.value = '';
      },
      playingId: readonly(playingId),
      progress: readonly(ref(0)),
      wasmReady: readonly(ref(true)),
    }),
  };
});

import ClaritySplitDemo from '@/demos/inline/archetypes/ClaritySplitDemo.vue';
import {
  type ClarityRoom,
  renderClarityRoom,
  splitEnergy,
} from '@/demos/inline/archetypes/clarityMath';
import { getDemo } from '@/demos/inline/registry';
import * as wasm from '@/wasm/index.js';

const DEF = getDemo('clarity-split');
if (!DEF) throw new Error('clarity-split not registered');

beforeAll(async () => {
  await wasm.init({ wasmBinary: readFileSync(join(process.cwd(), 'src/wasm/sonare.wasm')) });
}, 30_000);

function measure(room: ClarityRoom) {
  const { rir, sampleRate } = renderClarityRoom(wasm, room);
  return { rir, sampleRate, engine: wasm.analyzeImpulseResponse(rir, sampleRate) };
}

describe('early/late split behind the clarity-split caption', () => {
  it.each(['small', 'medium', 'hall'] as const)(
    'reproduces the engine C50, C80 and D50 at the 50 and 80 ms marks (%s)',
    (room) => {
      const { rir, sampleRate, engine } = measure(room);
      expect(engine.confidence).toBeGreaterThan(0.9);
      expect(splitEnergy(rir, sampleRate, 50).clarityDb).toBeCloseTo(engine.c50, 1);
      expect(splitEnergy(rir, sampleRate, 80).clarityDb).toBeCloseTo(engine.c80, 1);
      expect(splitEnergy(rir, sampleRate, 50).earlyFraction).toBeCloseTo(engine.d50, 2);
    },
    30_000,
  );

  it('matches the caption figures for the medium room and the large hall', () => {
    const medium = measure('medium').engine;
    expect(medium.c50).toBeCloseTo(1.0, 0);
    expect(medium.c80).toBeCloseTo(4.0, 0);
    const hall = measure('hall').engine;
    expect(hall.c50).toBeCloseTo(-5.1, 0);
    expect(hall.c80).toBeCloseTo(-2.9, 0);
    expect(hall.c80).toBeLessThan(0);
  }, 30_000);

  it('climbs monotonically as the boundary moves later', () => {
    const { rir, sampleRate } = measure('medium');
    let last = Number.NEGATIVE_INFINITY;
    for (const ms of [10, 20, 50, 80, 120, 200]) {
      const c = splitEnergy(rir, sampleRate, ms).clarityDb;
      expect(c).toBeGreaterThan(last);
      last = c;
    }
  }, 30_000);
});

describe('clarity-split demo', () => {
  it('reads C50 at the default boundary and follows a room change', async () => {
    const wrapper = mount(ClaritySplitDemo, { props: { def: DEF, active: true } });
    const state = () => wrapper.find('.td__state').text();
    const waitFor = async (re: RegExp) => {
      const t0 = Date.now();
      while (!re.test(state()) && Date.now() - t0 < 20_000) {
        await flushPromises();
        await new Promise((resolve) => setTimeout(resolve, 5));
      }
    };
    await waitFor(/^C50 /);
    expect(state()).toBe('C50 +1.0 dB · EARLY 56%');
    await wrapper
      .findAll('.dc__seg-btn')
      .find((b) => b.text() === 'Large hall')
      ?.trigger('click');
    await waitFor(/−5\.1/);
    expect(state()).toBe('C50 −5.1 dB · EARLY 24%');
    wrapper.unmount();
  }, 30_000);
});
