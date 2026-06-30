import { mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import { computed, defineComponent, h, nextTick } from 'vue';
import { useCarouselScroll } from '@/components/demos/useCarouselScroll';

function setElementMetrics(
  el: HTMLElement,
  metrics: { clientWidth: number; scrollWidth: number; scrollLeft: number },
) {
  Object.defineProperty(el, 'clientWidth', { configurable: true, value: metrics.clientWidth });
  Object.defineProperty(el, 'scrollWidth', { configurable: true, value: metrics.scrollWidth });
  Object.defineProperty(el, 'scrollLeft', { configurable: true, value: metrics.scrollLeft });
}

describe('useCarouselScroll', () => {
  it('tracks scroll affordances and scrolls by one card', async () => {
    const Component = defineComponent({
      setup() {
        return useCarouselScroll({ enabled: computed(() => true) });
      },
      render() {
        return h('div', { ref: 'scroller' }, [h('a', { class: 'demo-grid__card' })]);
      },
    });
    const wrapper = mount(Component, { attachTo: document.body });
    const scroller = wrapper.element as HTMLElement;
    const card = scroller.querySelector<HTMLElement>('.demo-grid__card');
    const scrollBy = vi.fn();
    scroller.scrollBy = scrollBy;
    setElementMetrics(scroller, { clientWidth: 200, scrollWidth: 600, scrollLeft: 100 });
    Object.defineProperty(card, 'offsetWidth', { configurable: true, value: 240 });

    wrapper.vm.syncScrollState();
    await nextTick();
    wrapper.vm.scrollByCard(1);

    expect(wrapper.vm.canScrollLeft).toBe(true);
    expect(wrapper.vm.canScrollRight).toBe(true);
    expect(scrollBy).toHaveBeenCalledWith({ left: 256, behavior: 'smooth' });

    wrapper.unmount();
  });
});
