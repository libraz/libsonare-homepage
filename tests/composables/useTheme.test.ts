import { mount } from '@vue/test-utils';
import { afterEach, describe, expect, it } from 'vitest';
import { defineComponent, h } from 'vue';
import { createTheme, useTheme } from '@/composables/useTheme';

afterEach(() => {
  document.documentElement.classList.remove('dark');
  document.documentElement.style.colorScheme = '';
});

function mountWithTheme() {
  let api!: ReturnType<typeof useTheme>;
  const Child = defineComponent({
    setup() {
      api = useTheme();
      return () => h('span', api.isDark.value ? 'dark' : 'light');
    },
  });
  const Root = defineComponent({
    setup() {
      createTheme();
      return () => h(Child);
    },
  });
  const wrapper = mount(Root);
  return {
    wrapper,
    get api() {
      return api;
    },
  };
}

describe('useTheme', () => {
  it('reads the initial dark state from the <html> class', async () => {
    document.documentElement.classList.add('dark');
    const { wrapper } = mountWithTheme();
    await wrapper.vm.$nextTick();
    expect(wrapper.text()).toBe('dark');
  });

  it('toggle flips the <html> dark class and colorScheme', async () => {
    const { api } = mountWithTheme();
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    api.toggle();
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.documentElement.style.colorScheme).toBe('dark');
    api.toggle();
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(document.documentElement.style.colorScheme).toBe('light');
  });

  it('child injects the same context provided by the root', async () => {
    const { wrapper, api } = mountWithTheme();
    api.toggle();
    await wrapper.vm.$nextTick();
    // The MutationObserver-backed isDark should track the DOM change.
    expect(api.isDark.value).toBe(true);
  });
});
