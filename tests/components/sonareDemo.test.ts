import { mount } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';

const getDemoMock = vi.hoisted(() => vi.fn());
const audioMock = vi.hoisted(() => ({
  playingId: { value: '' },
  stop: vi.fn(),
}));
const lang = ref('en');

vi.mock('vitepress', () => ({
  useData: () => ({ lang }),
}));

vi.mock('@/demos/registry', () => ({
  getDemo: getDemoMock,
}));

vi.mock('@/composables/useSonareDemoAudio', () => ({
  useSonareDemoAudio: () => audioMock,
}));

vi.mock('@/components/demos/archetypes', () => ({
  demoArchetypeComponents: {
    signal: {
      props: ['def', 'active'],
      template: '<div class="mock-archetype" :data-id="def.id" :data-active="String(active)" />',
    },
    'lane-mixer': {
      props: ['def', 'active'],
      template: '<div class="mock-archetype" :data-id="def.id" :data-active="String(active)" />',
    },
  },
}));

import SonareDemo from '@/components/demos/SonareDemo.vue';

type ObserverEntry = { isIntersecting: boolean };
type ObserverCallback = (entries: ObserverEntry[]) => void;

let observerCallback: ObserverCallback | null = null;
const observe = vi.fn();
const disconnect = vi.fn();

function installIntersectionObserver() {
  observerCallback = null;
  observe.mockClear();
  disconnect.mockClear();
  vi.stubGlobal(
    'IntersectionObserver',
    vi.fn().mockImplementation(function (callback: ObserverCallback) {
      observerCallback = callback;
      return { observe, disconnect };
    }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  getDemoMock.mockReset();
  audioMock.playingId.value = '';
  audioMock.stop.mockReset();
  lang.value = 'en';
});

describe('SonareDemo', () => {
  it('renders an alert for an unknown demo id', () => {
    installIntersectionObserver();
    getDemoMock.mockReturnValue(undefined);

    const wrapper = mount(SonareDemo, { props: { id: 'missing-demo' } });

    expect(wrapper.find('[role="alert"]').text()).toContain('Unknown demo id');
    expect(wrapper.text()).toContain('missing-demo');
  });

  it('localizes unknown demo alerts on Japanese pages', () => {
    lang.value = 'ja';
    installIntersectionObserver();
    getDemoMock.mockReturnValue(undefined);

    const wrapper = mount(SonareDemo, { props: { id: 'missing-demo' } });

    expect(wrapper.find('[role="alert"]').text()).toContain('不明なデモ ID');
  });

  it('passes active=false until the demo scrolls near the viewport', async () => {
    installIntersectionObserver();
    getDemoMock.mockReturnValue({
      id: 'waveform-harmonics',
      archetype: 'signal',
      source: { kind: 'generate', signal: 'saw' },
      title: { en: 'Waveform harmonics', ja: '波形と倍音' },
    });

    const wrapper = mount(SonareDemo, { props: { id: 'waveform-harmonics' } });

    expect(observe).toHaveBeenCalledTimes(1);
    expect(wrapper.find('.mock-archetype').attributes('data-active')).toBe('false');

    observerCallback?.([{ isIntersecting: true }]);
    await wrapper.vm.$nextTick();

    expect(wrapper.find('.mock-archetype').attributes('data-active')).toBe('true');
    expect(disconnect).toHaveBeenCalledTimes(1);
  });

  it('activates a heavy demo when it scrolls near the viewport', async () => {
    installIntersectionObserver();
    getDemoMock.mockReturnValue({
      id: 'engine-lane-mixer',
      archetype: 'lane-mixer',
      source: { kind: 'generate', signal: 'saw' },
      title: { en: 'Engine lane mixer', ja: 'エンジンのレーンミキサー' },
    });

    const wrapper = mount(SonareDemo, { props: { id: 'engine-lane-mixer' } });

    expect(wrapper.find('.mock-archetype').attributes('data-active')).toBe('false');

    observerCallback?.([{ isIntersecting: true }]);
    await wrapper.vm.$nextTick();

    expect(wrapper.find('.mock-archetype').attributes('data-active')).toBe('true');
  });

  it('activates immediately when IntersectionObserver is unavailable', async () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    getDemoMock.mockReturnValue({
      id: 'waveform-harmonics',
      archetype: 'signal',
      source: { kind: 'generate', signal: 'saw' },
      title: { en: 'Waveform harmonics', ja: '波形と倍音' },
    });

    const wrapper = mount(SonareDemo, { props: { id: 'waveform-harmonics' } });
    await wrapper.vm.$nextTick();

    expect(wrapper.find('.mock-archetype').attributes('data-active')).toBe('true');
  });

  it('stops its audio when unmounted while playing', () => {
    installIntersectionObserver();
    getDemoMock.mockReturnValue({
      id: 'waveform-harmonics',
      archetype: 'signal',
      source: { kind: 'generate', signal: 'saw' },
      title: { en: 'Waveform harmonics', ja: '波形と倍音' },
    });
    audioMock.playingId.value = 'waveform-harmonics';

    const wrapper = mount(SonareDemo, { props: { id: 'waveform-harmonics' } });
    wrapper.unmount();

    expect(audioMock.stop).toHaveBeenCalledTimes(1);
  });

  it('does not stop another demo when unmounted', () => {
    installIntersectionObserver();
    getDemoMock.mockReturnValue({
      id: 'waveform-harmonics',
      archetype: 'signal',
      source: { kind: 'generate', signal: 'saw' },
      title: { en: 'Waveform harmonics', ja: '波形と倍音' },
    });
    audioMock.playingId.value = 'other-demo';

    const wrapper = mount(SonareDemo, { props: { id: 'waveform-harmonics' } });
    wrapper.unmount();

    expect(audioMock.stop).not.toHaveBeenCalled();
  });
});
