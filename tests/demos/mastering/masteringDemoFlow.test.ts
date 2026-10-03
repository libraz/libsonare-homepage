import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const lang = vi.hoisted(() => ({ value: 'en' }));

vi.mock('vitepress', () => ({ useData: () => ({ lang }) }));

vi.mock('@/wasm/index.js', () => ({
  init: vi.fn(async () => undefined),
  version: vi.fn(() => 'test'),
}));

vi.mock('@/composables/useSonareEngine', async () => {
  const { ref, shallowRef } = await vi.importActual<typeof import('vue')>('vue');
  return {
    useSonareEngine: () => {
      const engine = { setTempo: vi.fn(), setLoop: vi.fn(), resetMasterLoudnessMeter: vi.fn() };
      const context = {
        sampleRate: 48000,
        decodeAudioData: vi.fn(async () => {
          const channel = new Float32Array(9600).fill(0.1);
          return {
            sampleRate: 48000,
            duration: 0.2,
            length: 9600,
            numberOfChannels: 1,
            getChannelData: () => channel,
          };
        }),
      };
      const sonare = {
        engine: shallowRef<any>(null),
        context: shallowRef<any>(null),
        outputNode: shallowRef(null),
        offlineEngine: shallowRef(null),
        ready: ref(false),
        starting: ref(false),
        error: ref(null),
        position: ref(0),
        playing: ref(false),
        start: vi.fn(async () => {
          sonare.engine.value = engine;
          sonare.context.value = context;
          return true;
        }),
        play: vi.fn(),
        stop: vi.fn(),
        seek: vi.fn(),
        onMeter: vi.fn(() => () => {}),
        dispose: vi.fn(async () => {}),
      };
      return sonare;
    },
  };
});

vi.mock('@/utils/engineApply', async () => {
  const actual = await vi.importActual<typeof import('@/utils/engineApply')>('@/utils/engineApply');
  return {
    ...actual,
    createFacadeTarget: () => new Proxy({}, { get: () => () => undefined }),
  };
});

vi.mock('@/demos/mastering/masteringWorkerClient', async () => {
  const actual = await vi.importActual<typeof import('@/demos/mastering/masteringWorkerClient')>(
    '@/demos/mastering/masteringWorkerClient',
  );
  const job = <T>(value: T) => ({ result: Promise.resolve(value), cancel: vi.fn() });
  return {
    ...actual,
    createMasteringWorkerClient: () => ({
      prepare: (registry: Map<string, any>) => {
        registry.set('program', { ...registry.get('source'), integratedLufs: -18 });
        return job({ stages: [] });
      },
      fit: vi.fn(),
      measure: (registry: Map<string, any>) => {
        registry.set('program', { ...registry.get('program'), integratedLufs: -18 });
        return job({ programLufs: -18, afterLufs: -14 });
      },
      bounce: vi.fn(),
      assist: () =>
        job({ profile: {}, suggestions: { explanation: [] }, chainParams: {}, unmapped: [] }),
      analyzeReference: vi.fn(),
      previewPlatforms: vi.fn(),
      dispose: vi.fn(),
    }),
  };
});

import MasteringDemo from '@/demos/mastering/MasteringDemo.vue';

enableAutoUnmount(afterEach);

function press(code: string, init: KeyboardEventInit = {}) {
  window.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true, ...init }));
}

describe('MasteringDemo', () => {
  beforeEach(() => {
    lang.value = 'en';
    localStorage.clear();
    window.history.replaceState(null, '', '/mastering');
  });

  it('opens in Quick with five numbered steps beside the result pane', async () => {
    const wrapper = mount(MasteringDemo, { attachTo: document.body });
    await flushPromises();
    const steps = wrapper.findAll('.panel__step').map((node) => node.text());
    expect(steps).toEqual(['01', '02', '03', '04', '05']);
    expect(wrapper.find('.quick__result').exists()).toBe(true);
    expect(wrapper.find('.export__primary').attributes('disabled')).toBeDefined();
  });

  it('edits through history: a genre pick, a monitor key and undo', async () => {
    const wrapper = mount(MasteringDemo, { attachTo: document.body });
    await flushPromises();
    const genre = wrapper.findAll('[role="radiogroup"]')[1];
    const edm = genre.findAll('[role="radio"]')[1];
    await edm.trigger('click');
    expect(edm.attributes('aria-checked')).toBe('true');

    press('KeyB');
    await flushPromises();
    const lanes = () =>
      wrapper.findAll('.monitor__lane').map((lane) => lane.attributes('aria-checked'));
    expect(lanes()).toEqual(['false', 'true', 'false']);

    press('KeyZ', { ctrlKey: true, metaKey: false });
    press('KeyZ', { metaKey: true });
    await flushPromises();
    expect(lanes()).toEqual(['true', 'false', 'false']);
  });

  it('switches to Studio and back, reflecting the mode in the URL', async () => {
    const wrapper = mount(MasteringDemo, { attachTo: document.body });
    await flushPromises();
    const studioTab = wrapper.findAll('.tool-mode-tabs__button')[1];
    await studioTab.trigger('click');
    await flushPromises();
    expect(wrapper.find('.studio').exists()).toBe(true);
    expect(wrapper.findAll('.rack__row')).toHaveLength(15);
    expect(window.location.search).toBe('?mode=studio');
    await wrapper.findAll('.tool-mode-tabs__button')[0].trigger('click');
    await flushPromises();
    expect(wrapper.find('.quick').exists()).toBe(true);
  });

  it('loads a file onto the engine and lists it in the status bar', async () => {
    const wrapper = mount(MasteringDemo, { attachTo: document.body });
    await flushPromises();
    const input = wrapper.find('.source input[type="file"]');
    const file = new File([new Uint8Array(4)], 'song.wav', { type: 'audio/wav' });
    Object.defineProperty(input.element, 'files', { value: [file] });
    await input.trigger('change');
    await flushPromises();
    expect(wrapper.text()).toContain('song.wav');
    expect(wrapper.find('.export__primary').attributes('disabled')).toBeUndefined();
    expect(wrapper.find('.export__primary').text()).toBe('Refit and export');
  });

  it('speaks Japanese on the Japanese route', async () => {
    lang.value = 'ja';
    const wrapper = mount(MasteringDemo, { attachTo: document.body });
    await flushPromises();
    expect(wrapper.text()).toContain('録音コンディション');
    expect(wrapper.text()).toContain('試聴と書き出し');
  });
});
