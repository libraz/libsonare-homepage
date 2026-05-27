import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const lang = vi.hoisted(() => ({ value: 'en' }));
const bounceMock = vi.hoisted(() => ({
  bounce: vi.fn(),
  dispose: vi.fn(),
}));

vi.mock('vitepress', () => ({
  useData: () => ({ lang }),
}));

vi.mock('@/wasm/index.js', () => ({
  init: vi.fn(async () => undefined),
  version: vi.fn(() => 'test-wasm'),
}));

vi.mock('@/composables/useRealtimeMixer', async () => {
  const { ref } = await vi.importActual<typeof import('vue')>('vue');
  return {
    useRealtimeMixer: () => ({
      playing: ref(false),
      positionSec: ref(0),
      start: vi.fn(async (_config: unknown, onEnded?: () => void) => {
        onEnded?.();
      }),
      stop: vi.fn(),
      seek: vi.fn(),
      updateScene: vi.fn(),
      updateGates: vi.fn(),
      updateMasterGain: vi.fn(),
      dispose: vi.fn(async () => undefined),
    }),
  };
});

vi.mock('@/components/mixing/mixingBounce', () => ({
  createMixBounceController: () => bounceMock,
}));

import MixingStudio from '@/components/MixingStudio.vue';

const SAMPLE_RATE = 48_000;

class MockFile {
  name: string;
  type: string;
  private body: string;

  constructor(parts: unknown[], name: string, options: { type?: string } = {}) {
    this.name = name;
    this.type = options.type || '';
    this.body = parts.map((part) => (typeof part === 'string' ? part : '')).join('');
  }

  async arrayBuffer() {
    return new ArrayBuffer(16);
  }

  async text() {
    return this.body;
  }
}

class MockAudioContext {
  static duration = 2;
  static nextDecodeError: Error | null = null;
  currentTime = 0;
  state = 'running';
  destination = {};

  async decodeAudioData(_buffer: ArrayBuffer) {
    if (MockAudioContext.nextDecodeError) throw MockAudioContext.nextDecodeError;
    return {
      length: 8,
      duration: MockAudioContext.duration,
      sampleRate: SAMPLE_RATE,
      numberOfChannels: 2,
      getChannelData: (channel: number) =>
        channel === 0
          ? new Float32Array([0, 0.2, -0.4, 0.6, -0.8, 0.4, -0.2, 0])
          : new Float32Array([0, -0.1, 0.3, -0.5, 0.7, -0.3, 0.1, 0]),
    };
  }
}

function dropFile(name = 'Drums.wav') {
  return new MockFile([new Uint8Array([1, 2, 3])], name, { type: 'audio/wav' }) as unknown as File;
}

async function loadTrack(wrapper: ReturnType<typeof mount>) {
  await wrapper.find('.mix-studio').trigger('drop', {
    dataTransfer: { files: [dropFile()] },
  });
  await flushPromises();
}

describe('MixingStudio', () => {
  beforeEach(() => {
    lang.value = 'en';
    MockAudioContext.duration = 2;
    MockAudioContext.nextDecodeError = null;
    bounceMock.bounce.mockReset();
    bounceMock.dispose.mockReset();
    bounceMock.bounce.mockImplementation(async (config: any) => {
      config.onProgress(0.25, 'Preparing tracks');
      config.onProgress(0.8, 'Running mixer');
      return {
        left: new Float32Array([0, 0.1, -0.1, 0]),
        right: new Float32Array([0, -0.1, 0.1, 0]),
        sampleRate: config.sampleRate,
        duration: 4 / config.sampleRate,
        peakDb: -3,
        rmsDb: -12,
        integratedLufs: -14,
        truePeakDb: -1,
        correlation: 0.4,
        stripMeters: config.tracks.map((track: any) => ({
          id: track.id,
          peakDb: -6,
          rmsDb: -18,
          truePeakDb: -1,
          correlation: 0.5,
          monoCompatible: true,
          goniometer: [
            { left: 0, right: 0 },
            { left: 0.4, right: -0.2 },
          ],
        })),
      };
    });
    // @ts-expect-error test AudioContext mock implements the decode path used here
    globalThis.AudioContext = MockAudioContext;
    // @ts-expect-error test File mock implements arrayBuffer/text
    globalThis.File = MockFile;
  });

  it('loads dropped stems and wires core mixer controls to track state', async () => {
    const wrapper = mount(MixingStudio);

    await loadTrack(wrapper);

    expect(wrapper.text()).toContain('Drums');
    expect(wrapper.text()).toContain('TRACKS1/8');
    expect(wrapper.find('.mix-strip__name').element).toHaveProperty('value', 'Drums');

    await wrapper.find('.mix-strip__name').setValue('Main Drums');
    expect(wrapper.find('.mix-inspector__name').element).toHaveProperty('value', 'Main Drums');

    await wrapper
      .findAll('.mix-toggle')
      .find((button) => button.text() === 'M')!
      .trigger('click');
    expect(wrapper.find('.mix-clip').classes()).toContain('mix-clip--muted');

    await wrapper
      .findAll('.mix-toggle')
      .find((button) => button.text() === 'EQ On')!
      .trigger('click');
    expect(wrapper.text()).toContain('Tilt');
    expect(wrapper.text()).toContain('Air');

    await wrapper
      .findAll('.mix-segment__btn')
      .find((button) => button.text() === 'Dual Pan')!
      .trigger('click');
    expect(wrapper.text()).toContain('Dual L');
    expect(wrapper.text()).toContain('Dual R');

    wrapper.unmount();
  });

  it('enforces duration and track-count limits while loading dropped stems', async () => {
    const wrapper = mount(MixingStudio);

    try {
      MockAudioContext.duration = 301;
      await wrapper.find('.mix-studio').trigger('drop', {
        dataTransfer: { files: [dropFile('too-long.wav')] },
      });
      await flushPromises();

      expect(wrapper.text()).toContain('too-long.wav is longer than 5:00 and was not loaded.');
      expect(wrapper.text()).toContain('TRACKS0/8');

      MockAudioContext.duration = 2;
      await wrapper.find('.mix-studio').trigger('drop', {
        dataTransfer: {
          files: Array.from({ length: 9 }, (_, index) => dropFile(`Stem ${index + 1}.wav`)),
        },
      });
      await flushPromises();

      expect(wrapper.text()).toContain('TRACKS8/8');
      expect(wrapper.text()).toContain('The mixer is limited to 8 tracks.');
      expect(wrapper.findAll('.mix-strip__name')).toHaveLength(8);
    } finally {
      wrapper.unmount();
    }
  });

  it('reports decode failures and loads the two-band demo only once', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const originalFetch = globalThis.fetch;
    const wrapper = mount(MixingStudio);

    try {
      MockAudioContext.nextDecodeError = new Error('decode failed');
      await wrapper.find('.mix-studio').trigger('drop', {
        dataTransfer: { files: [dropFile('broken.wav')] },
      });
      await flushPromises();
      expect(wrapper.text()).toContain('Failed to decode one of the audio files.');
      expect(wrapper.text()).toContain('TRACKS0/8');

      MockAudioContext.nextDecodeError = null;
      globalThis.fetch = vi.fn(async () => ({
        blob: async () => ({ type: 'audio/mpeg' }),
      })) as any;

      await wrapper
        .findAll('button')
        .find((button) => button.text() === 'Load demo')!
        .trigger('click');
      await flushPromises();
      expect(globalThis.fetch).toHaveBeenCalledWith('/demo.mp3');
      expect(wrapper.text()).toContain('Low band');
      expect(wrapper.text()).toContain('High band');
      expect(wrapper.text()).toContain('TRACKS2/8');

      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
      expect(wrapper.findAll('button').some((button) => button.text() === 'Load demo')).toBe(false);
    } finally {
      globalThis.fetch = originalFetch;
      consoleError.mockRestore();
      wrapper.unmount();
    }
  });

  it('adds, clears and serializes automation lane points', async () => {
    const rectSpy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      width: 200,
      height: 100,
      left: 0,
      top: 0,
      right: 200,
      bottom: 100,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);
    const wrapper = mount(MixingStudio);

    try {
      await loadTrack(wrapper);

      await wrapper.find('.mix-autolane__plot').trigger('click', { clientX: 100, clientY: 25 });
      expect(wrapper.findAll('.mix-autolane__node')).toHaveLength(1);
      expect(wrapper.find('.mix-autolane__line').exists()).toBe(true);

      await wrapper
        .findAll('button')
        .find((button) => button.text() === 'Export Scene')!
        .trigger('click');
      expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
      expect(click).toHaveBeenCalled();

      await wrapper
        .findAll('button')
        .find((button) => button.text() === 'Clear Lane')!
        .trigger('click');
      expect(wrapper.findAll('.mix-autolane__node')).toHaveLength(0);
    } finally {
      click.mockRestore();
      rectSpy.mockRestore();
      wrapper.unmount();
    }
  });

  it('bounces the loaded mix, exposes metrics and downloads the rendered wav', async () => {
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);
    const wrapper = mount(MixingStudio);

    try {
      await loadTrack(wrapper);
      await wrapper
        .findAll('button')
        .find((button) => button.text() === 'Bounce Mix')!
        .trigger('click');
      await flushPromises();

      expect(bounceMock.bounce).toHaveBeenCalledTimes(1);
      expect(bounceMock.bounce.mock.calls[0][0]).toMatchObject({
        sampleRate: SAMPLE_RATE,
        masterFaderDb: 0,
      });
      expect(bounceMock.bounce.mock.calls[0][0].tracks).toHaveLength(1);
      expect(wrapper.text()).toContain('-3.0 dB');
      expect(wrapper.text()).toContain('-14.0 LUFS');

      await wrapper
        .findAll('button')
        .find((button) => button.text() === 'Download WAV')!
        .trigger('click');
      expect(click).toHaveBeenCalled();
    } finally {
      click.mockRestore();
      wrapper.unmount();
    }
  });

  it('imports scene JSON onto matching tracks and reports invalid scene files', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const wrapper = mount(MixingStudio);

    try {
      await loadTrack(wrapper);
      const trackName = 'Drums';
      const validScene = new MockFile(
        [
          JSON.stringify({
            masterFaderDb: -6,
            reverb: { enabled: true, decaySec: 3, preDelayMs: 40 },
            vcaGains: { A: -2 },
            tracks: [{ name: trackName, faderDb: -9, pan: 0.5, vcaGroup: 'A', eqEnabled: true }],
          }),
        ],
        'scene.json',
        { type: 'application/json' },
      );
      const sceneInput = wrapper.find('input[accept="application/json,.json"]');
      Object.defineProperty(sceneInput.element, 'files', {
        configurable: true,
        value: [validScene],
      });
      await sceneInput.trigger('change');
      await flushPromises();

      expect(wrapper.text()).toContain('-9.0');
      expect(wrapper.text()).toContain('Reverb Bus');
      expect(wrapper.findAll('.mix-flag--vca').map((node) => node.text())).toContain('A');

      const invalidScene = new MockFile(['not-json'], 'broken.json', { type: 'application/json' });
      Object.defineProperty(sceneInput.element, 'files', {
        configurable: true,
        value: [invalidScene],
      });
      await sceneInput.trigger('change');
      await flushPromises();
      expect(wrapper.text()).toContain('Could not import this scene JSON.');
    } finally {
      consoleError.mockRestore();
      wrapper.unmount();
    }
  });
});
