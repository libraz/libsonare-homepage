import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';

const lang = vi.hoisted(() => ({ value: 'en' }));

vi.mock('vitepress', () => ({
  useData: () => ({ lang }),
}));

vi.mock('@/wasm/index.js', () => ({
  init: vi.fn(async () => undefined),
  version: vi.fn(() => 'test-wasm'),
}));

vi.mock('@/demos/spatial/RoomScene.vue', async () => {
  const { defineComponent, h } = await vi.importActual<typeof import('vue')>('vue');
  return { default: defineComponent({ name: 'RoomSceneStub', setup: () => () => h('div') }) };
});

const scanner = vi.hoisted(() => ({ scanPreset: vi.fn() }));
const morph = vi.hoisted(() => ({ fail: false }));

vi.mock('@/demos/spatial/useSpatialScanner', () => ({
  useSpatialScanner: () => ({
    status: ref('ready'),
    progress: ref(1),
    error: ref(null),
    fileName: ref(''),
    activePreset: ref('hall'),
    result: ref({
      valid: true,
      isBlind: false,
      confidence: 0.8,
      room: { length: 24, width: 16, height: 12, volume: 4608 },
      acoustic: { rt60: 2.1, edt: 2, c50: -3, c80: -1, d50: 0.3 },
      bands: [],
      drrDb: -6,
      criticalDistance: 2.4,
      sourceDistance: 4.8,
      listener: { x: 17, y: 8, z: 1.7 },
      source: { x: 5, y: 8, z: 2 },
      dspSource: { x: 5, y: 8, z: 2 },
      truth: null,
    }),
    scanPreset: scanner.scanPreset,
    scanDecoded: vi.fn(),
    rescan: vi.fn(),
    clear: vi.fn(),
  }),
}));

vi.mock('@/demos/spatial/useSpatialAudio', () => ({
  useSpatialAudio: () => ({
    isPlaying: ref(false),
    progress: ref(0),
    currentTime: ref(0),
    duration: ref(0),
    level: ref(0),
    hasContent: ref(false),
    isMorphing: ref(false),
    morphProgress: ref(0),
    contentLabel: ref(''),
    renderedKind: ref(null),
    renderNotes: ref([]),
    getContext: vi.fn(),
    renderRoomMorph: vi.fn(async () => {
      if (morph.fail) throw new Error('morph failed');
    }),
    setRoomImpulse: vi.fn(),
    clearSource: vi.fn(),
    toggle: vi.fn(),
    seek: vi.fn(),
  }),
}));

import SpatialScanner from '@/demos/spatial/SpatialScanner.vue';

describe('SpatialScanner', () => {
  beforeEach(() => {
    lang.value = 'en';
    morph.fail = false;
    scanner.scanPreset.mockClear();
  });

  it('marks the active sample room pressed and reports the scan in the status bar', async () => {
    const wrapper = mount(SpatialScanner);
    const rooms = wrapper.findAll('.sp-room');
    expect(rooms.length).toBeGreaterThan(1);
    for (const room of rooms) expect(room.attributes('type')).toBe('button');
    const pressed = rooms.filter((room) => room.attributes('aria-pressed') === 'true');
    expect(pressed.map((room) => room.find('.sp-room__label').text())).toEqual(['Concert Hall']);

    await rooms[0].trigger('click');
    expect(scanner.scanPreset).toHaveBeenCalledWith('bedroom');

    const status = wrapper.find('.tool-statusbar').text();
    expect(status).toContain('Concert Hall');
    expect(status).toContain('2.10 s');
    wrapper.unmount();
  });

  it('shows a failed morph as an alert', async () => {
    morph.fail = true;
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const wrapper = mount(SpatialScanner);
    try {
      await wrapper.find('.sp-morph').trigger('click');
      await flushPromises();
      expect(wrapper.find('[role="alert"]').text()).toContain('Room morph failed.');
    } finally {
      warn.mockRestore();
      wrapper.unmount();
    }
  });
});
