import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick, ref } from 'vue';

const lang = ref('en');
const go = vi.fn();
vi.mock('vitepress', () => ({ useData: () => ({ lang }), useRouter: () => ({ go }) }));

const query = ref('');
const results = ref<
  {
    link: string;
    pageLink: string;
    title: string;
    description: string;
    section: string;
    score: number;
  }[]
>([]);
const isLoading = ref(false);
const isReady = ref(false);
const hasError = ref(false);

vi.mock('@/composables/useSearch', () => ({
  useSearch: () => ({ query, results, isLoading, isReady, hasError }),
}));

import SearchBox from '@/components/search/SearchBox.vue';
import en from '@/locales/en.json';

/**
 * The field's own behaviour, with the ranker stubbed out: which rows reach the
 * dropdown, what the combobox reports to assistive technology, and where the
 * keyboard moves. The cases below are a pairwise set over the field's variant,
 * its inline and section props, how many results the query found, and whether
 * the search is loading, failed, or done.
 */

type Section = 'doc' | 'glossary' | 'demo';

function makeResults(count: number, section: Section = 'doc') {
  return Array.from({ length: count }, (_, i) => ({
    link: `/docs/page-${i}`,
    pageLink: `/docs/page-${i}`,
    title: `Page ${i}`,
    description: `Description ${i}`,
    section,
    score: count - i,
  }));
}

function render(props: Record<string, unknown> = {}) {
  return mount(SearchBox, { props, attachTo: document.body });
}

beforeEach(() => {
  query.value = '';
  results.value = [];
  isLoading.value = false;
  isReady.value = false;
  hasError.value = false;
});

describe('SearchBox', () => {
  it('reports itself as a combobox that is closed until a query finds something', async () => {
    const wrapper = render();
    const input = wrapper.get('input');
    expect(input.attributes('role')).toBe('combobox');
    expect(input.attributes('aria-expanded')).toBe('false');

    query.value = 'loudness';
    results.value = makeResults(3);
    await nextTick();

    expect(input.attributes('aria-expanded')).toBe('true');
    expect(input.attributes('aria-controls')).toBe(
      wrapper.get('[role="listbox"]').attributes('id'),
    );
    expect(wrapper.findAll('[role="option"]')).toHaveLength(3);
  });

  it('is not a combobox in inline mode and renders no dropdown', async () => {
    const wrapper = render({ inline: true, section: 'glossary' });
    query.value = 'loudness';
    results.value = makeResults(3, 'glossary');
    await nextTick();

    expect(wrapper.get('input').attributes('role')).toBeUndefined();
    expect(wrapper.find('[role="listbox"]').exists()).toBe(false);
  });

  it('emits the query and the results to a parent in inline mode', async () => {
    const wrapper = render({ inline: true });
    query.value = 'loudness';
    results.value = makeResults(3);
    await nextTick();

    expect(wrapper.emitted('update:query')?.at(-1)).toEqual(['loudness']);
    expect(wrapper.emitted('update:results')?.at(-1)?.[0]).toHaveLength(3);
  });

  it('keeps only the section it is scoped to', async () => {
    const wrapper = render({ variant: 'nav', section: 'glossary' });
    query.value = 'loudness';
    results.value = [...makeResults(3, 'doc'), ...makeResults(2, 'glossary')];
    await nextTick();

    expect(wrapper.findAll('[role="option"]')).toHaveLength(2);
  });

  it('caps the dropdown at eight rows and offers the rest on the search page', async () => {
    const wrapper = render({ variant: 'nav' });
    query.value = 'loudness';
    results.value = makeResults(12);
    await nextTick();

    expect(wrapper.findAll('[role="option"]')).toHaveLength(8);
    const footer = wrapper.get('a[href*="#q="]');
    expect(footer.text()).toBe(en.search.seeAll.replace('{total}', '12'));
  });

  it('links the overflow row to the scoped search page', async () => {
    const wrapper = render({ section: 'glossary' });
    query.value = 'loudness';
    results.value = makeResults(12, 'glossary');
    await nextTick();

    expect(wrapper.get('a[href*="#q="]').attributes('href')).toBe(
      '/search.html#q=loudness&section=glossary',
    );
  });

  it('announces a failed search instead of an empty one', async () => {
    const wrapper = render({ variant: 'nav' });
    query.value = 'loudness';
    hasError.value = true;
    await nextTick();

    expect(wrapper.get('[role="status"]').text()).toBe(en.search.error);
    expect(wrapper.find('[role="option"]').exists()).toBe(false);
  });

  it('announces an empty result set', async () => {
    const wrapper = render();
    query.value = 'zzz';
    results.value = [];
    await nextTick();

    expect(wrapper.get('[role="status"]').text()).toBe(en.search.noResults);
  });

  it('keeps the dropdown closed while the index is still loading', async () => {
    const wrapper = render();
    query.value = 'loudness';
    isLoading.value = true;
    await nextTick();

    expect(wrapper.get('input').attributes('aria-expanded')).toBe('false');
    expect(wrapper.get('[role="status"]').text()).toBe(en.search.loading);
  });

  it('moves the active row with the arrow keys and clears it on Escape', async () => {
    const wrapper = render();
    const input = wrapper.get('input');
    query.value = 'loudness';
    results.value = makeResults(3);
    await nextTick();

    expect(input.attributes('aria-activedescendant')).toBeUndefined();

    await input.trigger('keydown', { key: 'ArrowDown' });
    await nextTick();
    const listboxId = wrapper.get('[role="listbox"]').attributes('id');
    expect(input.attributes('aria-activedescendant')).toBe(`${listboxId}-0`);
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({ block: 'nearest' });

    await input.trigger('keydown', { key: 'ArrowDown' });
    expect(input.attributes('aria-activedescendant')).toBe(`${listboxId}-1`);

    await input.trigger('keydown', { key: 'ArrowUp' });
    expect(input.attributes('aria-activedescendant')).toBe(`${listboxId}-0`);

    await input.trigger('keydown', { key: 'Escape' });
    expect(input.attributes('aria-expanded')).toBe('false');
  });

  it('opens the active row through the router, as a click would', async () => {
    go.mockClear();
    const wrapper = render();
    const input = wrapper.get('input');
    query.value = 'loudness';
    results.value = makeResults(3);
    await nextTick();

    await input.trigger('keydown', { key: 'ArrowDown' });
    await input.trigger('keydown', { key: 'Enter' });

    expect(go).toHaveBeenCalledWith('/docs/page-0');
  });
});
