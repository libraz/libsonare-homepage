import { mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';

const lang = ref('en');
vi.mock('vitepress', () => ({ useData: () => ({ lang }) }));
vi.mock('@/wasm/index.js', () => ({
  init: vi.fn(async () => undefined),
  version: vi.fn(() => 'test-wasm'),
}));

import MixingStudio from '@/components/MixingStudio.vue';
import MusicAnalysisStudio from '@/components/MusicAnalysisStudio.vue';
import RealtimeFxLab from '@/components/RealtimeFxLab.vue';

// These mounts exercise the empty/initial render only: workers, AudioContext and
// WASM are created lazily on user action, so an empty-state mount stays headless.
describe('demo components mount in their empty state', () => {
  it('MusicAnalysisStudio renders inside ToolShell without a result', () => {
    lang.value = 'en';
    const wrapper = mount(MusicAnalysisStudio);
    expect(wrapper.find('.tool-page').exists()).toBe(true);
    expect(wrapper.find('.tool-page__title').text()).toBeTruthy();
    wrapper.unmount();
  });

  it('RealtimeFxLab renders and starts idle (engine not ready)', () => {
    lang.value = 'en';
    const wrapper = mount(RealtimeFxLab);
    expect(wrapper.find('.tool-page').exists()).toBe(true);
    // No monitoring before the user starts the engine.
    expect(wrapper.html()).not.toContain('Speaker off');
    wrapper.unmount();
  });

  it('MixingStudio renders the shell', () => {
    lang.value = 'en';
    const wrapper = mount(MixingStudio);
    expect(wrapper.find('.tool-page').exists()).toBe(true);
    wrapper.unmount();
  });

  it('renders Japanese chrome when lang is ja', () => {
    lang.value = 'ja';
    const wrapper = mount(MusicAnalysisStudio);
    const labels = wrapper.findAll('a').map((a) => a.text());
    expect(labels).toEqual(expect.arrayContaining(['楽曲分析']));
    wrapper.unmount();
  });
});
