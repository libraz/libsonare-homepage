import { mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';

const lang = ref('en');

vi.mock('vitepress', () => ({
  useData: () => ({ lang }),
}));

import DemoFrame from '@/components/demos/DemoFrame.vue';

describe('DemoFrame', () => {
  function mountFrame(playing = false) {
    return mount(DemoFrame, {
      props: {
        eyebrow: 'SIGNAL',
        title: 'Demo title',
        state: playing ? 'PLAYING' : 'READY',
        tone: playing ? 'playing' : 'ready',
        playing,
        progress: 0.25,
      },
      slots: {
        screen: '<canvas class="test-screen" />',
      },
    });
  }

  it('labels the transport in English by default', async () => {
    lang.value = 'en';
    const wrapper = mountFrame();

    expect(wrapper.find('.td__play').attributes('aria-label')).toBe('Play');
    expect(wrapper.find('.td__play').attributes('aria-pressed')).toBe('false');
    await wrapper.find('.td__play').trigger('click');
    expect(wrapper.emitted('toggle')).toHaveLength(1);
  });

  it('localizes the transport label on Japanese pages', () => {
    lang.value = 'ja';
    const stopped = mountFrame();
    expect(stopped.find('.td__play').attributes('aria-label')).toBe('再生');
    stopped.unmount();

    const playing = mountFrame(true);
    expect(playing.find('.td__play').attributes('aria-label')).toBe('停止');
    expect(playing.find('.td__play').attributes('aria-pressed')).toBe('true');
  });

  it('announces state, loading and error overlays accessibly', () => {
    lang.value = 'en';
    const loading = mount(DemoFrame, {
      props: {
        eyebrow: 'SIGNAL',
        title: 'Demo title',
        state: 'ANALYZING',
        tone: 'loading',
        loadingLabel: 'ANALYZING...',
      },
      slots: { screen: '<canvas />' },
    });

    expect(loading.find('.td__state').attributes('role')).toBe('status');
    expect(loading.find('.td__state').attributes('aria-live')).toBe('polite');
    expect(loading.find('.td__overlay').attributes('role')).toBe('status');
    loading.unmount();

    const errored = mount(DemoFrame, {
      props: {
        eyebrow: 'SIGNAL',
        title: 'Demo title',
        state: 'ERROR',
        tone: 'error',
        error: 'decode failed',
      },
      slots: { screen: '<canvas />' },
    });

    expect(errored.find('.td__overlay--error').attributes('role')).toBe('alert');
    expect(errored.text()).toContain('Signal error');
    expect(errored.text()).toContain('decode failed');
  });

  it('localizes the error overlay label on Japanese pages', () => {
    lang.value = 'ja';
    const errored = mount(DemoFrame, {
      props: {
        eyebrow: 'SIGNAL',
        title: 'Demo title',
        state: 'ERROR',
        tone: 'error',
        error: 'decode failed',
      },
      slots: { screen: '<canvas />' },
    });

    expect(errored.text()).toContain('信号エラー');
    expect(errored.text()).toContain('decode failed');
  });
});
