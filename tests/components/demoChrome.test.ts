import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick, ref } from 'vue';
import DemoCardGrid from '@/components/DemoCardGrid.vue';
import DemoDisclaimer from '@/components/DemoDisclaimer.vue';

const lang = ref('en');

vi.mock('vitepress', () => ({
  useData: () => ({ lang }),
}));

describe('DemoCardGrid', () => {
  let resizeDisconnect: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    resizeDisconnect = vi.fn();
    vi.stubGlobal(
      'ResizeObserver',
      vi.fn().mockImplementation(function (callback: ResizeObserverCallback) {
        return {
          observe: vi.fn(() => callback([], {} as ResizeObserver)),
          disconnect: resizeDisconnect,
        };
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function setScrollerMetrics(
    wrapper: ReturnType<typeof mount>,
    values: { scrollWidth: number; clientWidth: number; scrollLeft: number },
  ) {
    const scroller = wrapper.find('.demo-grid').element as HTMLElement;
    Object.defineProperty(scroller, 'scrollWidth', {
      configurable: true,
      value: values.scrollWidth,
    });
    Object.defineProperty(scroller, 'clientWidth', {
      configurable: true,
      value: values.clientWidth,
    });
    Object.defineProperty(scroller, 'scrollLeft', {
      configurable: true,
      writable: true,
      value: values.scrollLeft,
    });
    scroller.scrollBy = vi.fn();
    for (const card of wrapper.findAll('.demo-grid__card')) {
      Object.defineProperty(card.element, 'offsetWidth', { configurable: true, value: 240 });
    }
    return scroller;
  }

  it('renders English demo cards, links and visual variants', async () => {
    lang.value = 'en';
    const wrapper = mount(DemoCardGrid);
    const scroller = setScrollerMetrics(wrapper, {
      scrollWidth: 1600,
      clientWidth: 600,
      scrollLeft: 0,
    });
    await wrapper.find('.demo-grid').trigger('scroll');

    const cards = wrapper.findAll('.demo-grid__card');
    expect(cards).toHaveLength(8);
    expect(cards.map((card) => card.attributes('href'))).toEqual([
      '/analyzer',
      '/mastering',
      '/music-analysis',
      '/mixing',
      '/realtime-fx',
      '/spatial',
      '/synth',
      '/studio',
    ]);
    expect(wrapper.text()).toContain('Visual Player');
    expect(wrapper.text()).toContain('Mastering Studio');
    expect(wrapper.text()).toContain('Spatial Room Scanner');
    expect(wrapper.text()).toContain('Synth Playground');
    expect(wrapper.text()).toContain('Studio Mini');
    expect(wrapper.find('.demo-grid__visual--spectrum').exists()).toBe(true);
    expect(wrapper.find('.demo-grid__visual--lufs').exists()).toBe(true);
    expect(wrapper.find('.demo-grid__visual--chroma').exists()).toBe(true);
    expect(wrapper.find('.demo-grid__visual--faders').exists()).toBe(true);
    expect(wrapper.find('.demo-grid__visual--fx').exists()).toBe(true);
    expect(wrapper.find('.demo-grid__visual--room').exists()).toBe(true);
    expect(wrapper.find('.demo-grid__visual--keys').exists()).toBe(true);
    expect(wrapper.find('.demo-grid__visual--steps').exists()).toBe(true);
    expect(wrapper.find('.demo-carousel__nav--next').classes()).not.toContain(
      'demo-carousel__nav--hidden',
    );

    await wrapper.find('.demo-carousel__nav--next').trigger('click');
    expect(scroller.scrollBy).toHaveBeenCalledWith({ left: 256, behavior: 'smooth' });

    wrapper.unmount();
    expect(resizeDisconnect).toHaveBeenCalled();
  });

  it('localizes Japanese card copy and nav labels with /ja links', async () => {
    lang.value = 'ja';
    const wrapper = mount(DemoCardGrid);
    setScrollerMetrics(wrapper, { scrollWidth: 1600, clientWidth: 600, scrollLeft: 200 });
    await wrapper.find('.demo-grid').trigger('scroll');

    expect(wrapper.findAll('.demo-grid__card').map((card) => card.attributes('href'))).toEqual([
      '/ja/analyzer',
      '/ja/mastering',
      '/ja/music-analysis',
      '/ja/mixing',
      '/ja/realtime-fx',
      '/ja/spatial',
      '/ja/synth',
      '/ja/studio',
    ]);
    expect(wrapper.text()).toContain('ビジュアルプレイヤー');
    expect(wrapper.text()).toContain('マスタリングスタジオ');
    expect(wrapper.text()).toContain('シンセプレイグラウンド');
    expect(wrapper.find('.demo-carousel__nav--prev').attributes('aria-label')).toBe(
      '前のデモを表示',
    );
    expect(wrapper.find('.demo-carousel__nav--next').attributes('aria-label')).toBe(
      '次のデモを表示',
    );
  });
});

describe('DemoDisclaimer', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('shows first-visit overlay, dismisses it and persists acknowledgement', async () => {
    lang.value = 'en';
    const wrapper = mount(DemoDisclaimer, { attachTo: document.body });
    await flushPromises();

    expect(wrapper.find('.demo-disclaimer__banner').text()).toContain('OSS DEMO');
    expect(document.body.querySelector('.demo-disclaimer__overlay')).toBeTruthy();
    expect(document.body.textContent).toContain('This is an open-source demo');
    expect(document.body.querySelector('.demo-disclaimer__source')?.getAttribute('href')).toBe(
      'https://github.com/libraz/libsonare',
    );

    document.body.querySelector<HTMLButtonElement>('.demo-disclaimer__confirm')?.click();
    await nextTick();
    expect(localStorage.getItem('libsonare-demo-disclaimer-v2')).toBe('1');
    expect(document.body.querySelector('.demo-disclaimer__overlay')).toBeNull();

    await wrapper.find('.demo-disclaimer__reopen').trigger('click');
    await nextTick();
    expect(document.body.querySelector('.demo-disclaimer__overlay')).toBeTruthy();

    wrapper.unmount();
  });

  it('skips overlay after acknowledgement and localizes Japanese banner', async () => {
    lang.value = 'ja';
    localStorage.setItem('libsonare-demo-disclaimer-v2', '1');
    const wrapper = mount(DemoDisclaimer, { attachTo: document.body });
    await flushPromises();

    expect(wrapper.find('.demo-disclaimer__banner').text()).toContain('OSS デモ');
    expect(wrapper.find('.demo-disclaimer__reopen').text()).toBe('詳細');
    expect(document.body.querySelector('.demo-disclaimer__overlay')).toBeNull();

    await wrapper.find('.demo-disclaimer__reopen').trigger('click');
    await nextTick();
    expect(document.body.textContent).toContain('これはサービスではなく');

    wrapper.unmount();
  });
});
