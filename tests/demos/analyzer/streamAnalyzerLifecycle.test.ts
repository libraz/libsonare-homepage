import { mount } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { defineComponent } from 'vue';

const wasmMock = vi.hoisted(() => {
  const instances: Array<{ dispose: ReturnType<typeof vi.fn>; reset: ReturnType<typeof vi.fn> }> =
    [];
  class StreamAnalyzerMock {
    dispose = vi.fn();
    reset = vi.fn();
    constructor(public config: unknown) {
      instances.push(this);
    }
  }
  return {
    instances,
    StreamAnalyzerMock,
    init: vi.fn(async () => undefined),
  };
});

vi.mock('@/wasm/index', () => ({
  init: wasmMock.init,
  StreamAnalyzer: wasmMock.StreamAnalyzerMock,
}));

import { useStreamAnalyzer } from '@/demos/analyzer/useStreamAnalyzer';

describe('useStreamAnalyzer lifecycle', () => {
  afterEach(() => {
    wasmMock.instances.length = 0;
    wasmMock.init.mockClear();
  });

  function mountAnalyzer() {
    let api!: ReturnType<typeof useStreamAnalyzer>;
    const wrapper = mount(
      defineComponent({
        setup() {
          api = useStreamAnalyzer({ sampleRate: 44100 });
          return () => null;
        },
      }),
    );
    return { wrapper, api };
  }

  it('disposes the native analyzer on destroy so it does not leak on route leave', async () => {
    const { wrapper, api } = mountAnalyzer();

    await api.init();
    expect(wasmMock.instances).toHaveLength(1);
    const analyzer = wasmMock.instances[0];

    api.destroy();

    expect(analyzer.dispose).toHaveBeenCalledTimes(1);
    expect(api.isInitialized.value).toBe(false);

    wrapper.unmount();
  });

  it('disposes the native analyzer when the component unmounts', async () => {
    const { wrapper, api } = mountAnalyzer();

    await api.init();
    const analyzer = wasmMock.instances[0];

    wrapper.unmount();

    expect(analyzer.dispose).toHaveBeenCalledTimes(1);
  });

  it('rejects init when the engine fails to load, and reinit reports the same cause', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    wasmMock.init.mockRejectedValue(new Error('wasm gone'));
    const { wrapper, api } = mountAnalyzer();

    try {
      await expect(api.init()).rejects.toThrow('wasm gone');
      expect(api.isInitialized.value).toBe(false);
      expect(api.error.value).toContain('Failed to initialize StreamAnalyzer');
      expect(wasmMock.instances).toHaveLength(0);

      // A later reinit retries the load and surfaces the load failure itself,
      // not a null dereference of the module that never arrived.
      await expect(api.reinit(48_000)).rejects.toThrow('wasm gone');
      expect(wasmMock.instances).toHaveLength(0);
    } finally {
      wasmMock.init.mockReset();
      wasmMock.init.mockResolvedValue(undefined);
      consoleError.mockRestore();
      wrapper.unmount();
    }
  });
});
