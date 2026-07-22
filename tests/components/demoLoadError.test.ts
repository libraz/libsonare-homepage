import { mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';

const lang = ref('en');

vi.mock('vitepress', () => ({
  useData: () => ({ lang }),
}));

import DemoLoadError from '@/components/demos/DemoLoadError.vue';

describe('DemoLoadError', () => {
  it('resolves recovery copy through the shared i18n catalog', async () => {
    lang.value = 'en';
    const wrapper = mount(DemoLoadError);
    expect(wrapper.text()).toContain('Failed to load this demo');

    lang.value = 'ja';
    await wrapper.vm.$nextTick();
    expect(wrapper.text()).toContain('デモの読み込みに失敗しました');
    expect(wrapper.find('button').text()).toBe('再読み込み');
  });
});
