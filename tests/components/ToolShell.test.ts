import { mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';

const lang = ref('en');
vi.mock('vitepress', () => ({ useData: () => ({ lang }) }));

import ToolShell from '@/components/ToolShell.vue';

function mountShell(props: Record<string, unknown> = {}, slots: Record<string, string> = {}) {
  return mount(ToolShell, {
    props: { demoId: 'analysis', title: 'Music Analysis Studio', ...props },
    slots: { default: '<p class="slot-body">demo body</p>', ...slots },
  });
}

describe('ToolShell', () => {
  it('renders the title and default slot content', () => {
    lang.value = 'en';
    const wrapper = mountShell({ subtitle: 'Sub' });
    expect(wrapper.find('.tool-page__title').text()).toBe('Music Analysis Studio');
    expect(wrapper.find('.tool-page__subtitle').text()).toBe('Sub');
    expect(wrapper.find('.slot-body').exists()).toBe(true);
  });

  it('renders all five demo tabs and marks the active one', () => {
    lang.value = 'en';
    const wrapper = mountShell({ demoId: 'analysis' });
    const tabLabels = wrapper.findAll('a').map((a) => a.text());
    expect(tabLabels).toEqual(
      expect.arrayContaining(['Visual Player', 'Mastering', 'Analysis', 'Mixing', 'Realtime FX']),
    );
  });

  it('shows the version with a v prefix and a fallback when absent', () => {
    lang.value = 'en';
    expect(mountShell({ version: '1.2.0' }).find('.tool-page__version').text()).toBe('v1.2.0');
    expect(mountShell().find('.tool-page__version').text()).toContain('v');
  });

  it('localises chrome labels for ja', () => {
    lang.value = 'ja';
    const wrapper = mountShell();
    const labels = wrapper.findAll('a').map((a) => a.text());
    expect(labels).toEqual(
      expect.arrayContaining([
        'ビジュアルプレイヤー',
        'マスタリング',
        '楽曲分析',
        'ミキシング',
        'リアルタイムFX',
      ]),
    );
    // The locale switch should offer EN when currently in ja.
    expect(wrapper.find('.tool-page__lang-switch').text()).toBe('EN');
  });

  it('passes status through to the privacy indicator', () => {
    lang.value = 'en';
    const wrapper = mountShell({ status: 'active', statusLabel: 'LOCAL ONLY' });
    expect(wrapper.find('.tool-page__privacy').text()).toContain('LOCAL ONLY');
  });
});
