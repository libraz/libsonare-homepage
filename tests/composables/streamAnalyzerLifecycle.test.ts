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

import { useStreamAnalyzer } from '@/composables/useStreamAnalyzer';

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
});
