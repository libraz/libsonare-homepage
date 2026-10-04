import { mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';

const lang = ref('ja');
const frontmatter = ref({ title: 'libsonare GS 音源モジュール' });
vi.mock('vitepress', () => ({ useData: () => ({ lang, frontmatter }) }));

import DemoPagePending from '@/components/DemoPagePending.vue';

describe('DemoPagePending', () => {
  it('keeps the site shell and the demo tabs on screen while the demo chunk loads', () => {
    const wrapper = mount(DemoPagePending, { props: { demoId: 'gs-module' } });
    expect(wrapper.find('.tool-page__title').text()).toBe('GS 音源モジュール');
    expect(wrapper.find('[aria-current="page"]').text()).toContain('GS 音源');
    expect(wrapper.find('.signal-loader').exists()).toBe(true);
    wrapper.unmount();
  });
});
