import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h, ref } from 'vue';

const lang = ref('en');
const wasm = vi.hoisted(() => ({
  init: vi.fn(),
  version: vi.fn(),
}));

vi.mock('vitepress', () => ({
  useData: () => ({ lang }),
}));

vi.mock('@/wasm/index.js', () => wasm);

vi.mock('@/components/AudioAnalyzer.vue', () => ({
  default: defineComponent({
    name: 'AudioAnalyzerStub',
    props: { libVersion: String },
    setup(props) {
      return () =>
        h(
          'div',
          {
            class: 'audio-analyzer-stub',
            'data-version': props.libVersion,
          },
          'AudioAnalyzer',
        );
    },
  }),
}));

import AnalyzerDemo from '@/components/AnalyzerDemo.vue';

describe('AnalyzerDemo shell', () => {
  beforeEach(() => {
    lang.value = 'en';
    wasm.init.mockReset();
    wasm.version.mockReset();
    wasm.init.mockResolvedValue(undefined);
    wasm.version.mockReturnValue('1.2.3-test');
    vi.stubGlobal('requestIdleCallback', (callback: IdleRequestCallback) => {
      callback({ didTimeout: false, timeRemaining: () => 10 } as IdleDeadline);
      return 1;
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('initializes wasm version during idle time and passes it to the analyzer', async () => {
    const wrapper = mount(AnalyzerDemo);
    await flushPromises();

    expect(wasm.init).toHaveBeenCalledTimes(1);
    expect(wrapper.find('.tool-page__title').text()).toBe('Visual Player');
    expect(wrapper.find('.tool-page__version').text()).toBe('v1.2.3-test');
    expect(wrapper.find('.audio-analyzer-stub').attributes('data-version')).toBe('1.2.3-test');
    expect(wrapper.find('.tool-page__guide').text()).toContain('Visual player');

    wrapper.unmount();
  });

  it('localizes Japanese shell copy and keeps rendering if wasm version init fails', async () => {
    lang.value = 'ja';
    wasm.init.mockRejectedValueOnce(new Error('init failed'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    try {
      const wrapper = mount(AnalyzerDemo);
      await flushPromises();

      expect(warn).toHaveBeenCalled();
      expect(wrapper.find('.tool-page__title').text()).toBe('ビジュアルプレイヤー');
      expect(wrapper.find('.tool-page__lang-switch').text()).toBe('EN');
      expect(wrapper.find('.audio-analyzer-stub').exists()).toBe(true);
      expect(wrapper.find('.tool-page__version').text()).toContain('v');
      // WASM init failure surfaces an error status, not a hardcoded 'active'.
      expect(wrapper.find('.status-indicator--error').exists()).toBe(true);
      expect(wrapper.find('.status-indicator__label').text()).toBe('エンジンエラー');

      wrapper.unmount();
    } finally {
      warn.mockRestore();
    }
  });
});
