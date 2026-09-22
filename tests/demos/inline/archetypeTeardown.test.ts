import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';

const lang = ref('en');
vi.mock('vitepress', () => ({ useData: () => ({ lang }) }));

// The archetypes reach the engine and their clips through the shared audio
// helper; a controllable stub lets a test settle those loads after unmount.
const audioMock = vi.hoisted(() => ({
  ensureWasm: vi.fn(),
  loadClip: vi.fn(),
}));

vi.mock('@/demos/inline/useSonareDemoAudio', async () => {
  const { readonly, ref } = await vi.importActual<typeof import('vue')>('vue');
  const playingId = ref<string | null>(null);
  const progress = ref(0);
  const wasmReady = ref(false);
  return {
    ensureWasm: audioMock.ensureWasm,
    useSonareDemoAudio: () => ({
      ensureWasm: audioMock.ensureWasm,
      loadClip: audioMock.loadClip,
      play: vi.fn(async () => undefined),
      stop: vi.fn(),
      playingId: readonly(playingId),
      progress: readonly(progress),
      wasmReady: readonly(wasmReady),
    }),
  };
});

import CompingDemo from '@/demos/inline/archetypes/CompingDemo.vue';
import DetectorDemo from '@/demos/inline/archetypes/DetectorDemo.vue';
import { getDemo } from '@/demos/inline/registry';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function demo(id: string) {
  const def = getDemo(id);
  if (!def) throw new Error(`${id} not registered`);
  return def;
}

const clip = () => ({ samples: new Float32Array(3200), sampleRate: 32_000 });

describe('inline archetype teardown during a load', () => {
  let raf: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    audioMock.ensureWasm.mockReset();
    audioMock.loadClip.mockReset();
    raf = vi.fn(() => 1);
    vi.stubGlobal('requestAnimationFrame', raf);
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('comping: clips that arrive after unmount arm no animation frame', async () => {
    const takes = [deferred<unknown>(), deferred<unknown>(), deferred<unknown>()];
    let call = 0;
    audioMock.loadClip.mockImplementation(() => takes[call++].promise);

    const wrapper = mount(CompingDemo, { props: { def: demo('comping'), active: true } });
    await flushPromises();
    expect(audioMock.loadClip).toHaveBeenCalledTimes(3);
    expect(wrapper.find('figure.td--loading').exists()).toBe(true);

    wrapper.unmount();
    raf.mockClear();
    for (const take of takes) take.resolve(clip());
    await flushPromises();

    expect(raf).not.toHaveBeenCalled();
  });

  it('comping: a clip failure after unmount is dropped without a late error', async () => {
    const take = deferred<unknown>();
    audioMock.loadClip.mockImplementation(() => take.promise);

    const wrapper = mount(CompingDemo, { props: { def: demo('comping'), active: true } });
    await flushPromises();
    wrapper.unmount();
    take.reject(new Error('demo clip not found'));
    await flushPromises();

    expect(raf).not.toHaveBeenCalled();
  });

  it('detector: a demo torn down while the engine loads never fetches its clip', async () => {
    const wasm = deferred<unknown>();
    audioMock.ensureWasm.mockImplementation(() => wasm.promise);

    const wrapper = mount(DetectorDemo, { props: { def: demo('beat-tracking'), active: true } });
    await flushPromises();
    expect(audioMock.ensureWasm).toHaveBeenCalledTimes(1);

    wrapper.unmount();
    raf.mockClear();
    wasm.resolve({});
    await flushPromises();

    expect(audioMock.loadClip).not.toHaveBeenCalled();
    expect(raf).not.toHaveBeenCalled();
  });

  it('detector: a clip that lands after unmount arms no reveal loop', async () => {
    const take = deferred<unknown>();
    audioMock.ensureWasm.mockResolvedValue({});
    audioMock.loadClip.mockImplementation(() => take.promise);

    const wrapper = mount(DetectorDemo, { props: { def: demo('beat-tracking'), active: true } });
    await flushPromises();
    expect(audioMock.loadClip).toHaveBeenCalledTimes(1);

    wrapper.unmount();
    raf.mockClear();
    take.resolve(clip());
    await flushPromises();

    expect(raf).not.toHaveBeenCalled();
  });
});
