import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';

const lang = vi.hoisted(() => ({ value: 'en' }));
const fxMock = vi.hoisted(() => ({
  state: null as any,
  start: vi.fn(),
  setParams: vi.fn(),
  toggleMonitor: vi.fn(),
  dispose: vi.fn(),
}));

vi.mock('vitepress', () => ({
  useData: () => ({ lang }),
}));

vi.mock('@/wasm/index.js', () => ({
  init: vi.fn(async () => undefined),
  version: vi.fn(() => 'test-wasm'),
}));

vi.mock('@/composables/useRealtimeFx', async () => {
  const { ref } = await vi.importActual<typeof import('vue')>('vue');
  const FX_PRESETS = {
    natural: {
      pitchSemitones: 0,
      formant: 1,
      wet: 0.72,
      robot: 0,
      reverb: 0.08,
      outputGain: 0.74,
      bypass: false,
    },
    low: {
      pitchSemitones: -7,
      formant: 0.7,
      wet: 0.9,
      robot: 0,
      reverb: 0.1,
      outputGain: 0.72,
      bypass: false,
    },
    bright: {
      pitchSemitones: 6,
      formant: 1.45,
      wet: 0.88,
      robot: 0,
      reverb: 0.08,
      outputGain: 0.68,
      bypass: false,
    },
    robot: {
      pitchSemitones: -1,
      formant: 0.92,
      wet: 0.92,
      robot: 0.9,
      reverb: 0.16,
      outputGain: 0.62,
      bypass: false,
    },
    room: {
      pitchSemitones: 0,
      formant: 1,
      wet: 0.82,
      robot: 0,
      reverb: 0.55,
      outputGain: 0.68,
      bypass: false,
    },
    hall: {
      pitchSemitones: 0,
      formant: 1,
      wet: 0.86,
      robot: 0,
      reverb: 0.9,
      outputGain: 0.58,
      bypass: false,
    },
  };
  const ready = ref(false);
  const monitoring = ref(false);
  const error = ref<string | null>(null);
  const latencyMs = ref(0);
  const meter = ref({ inputPeak: 0, outputPeak: 0, inputRms: 0, outputRms: 0 });
  fxMock.state = { ready, monitoring, error, latencyMs, meter };
  return {
    FX_PRESETS,
    isPresetId: (value: unknown) => typeof value === 'string' && value in FX_PRESETS,
    useRealtimeFx: () => ({
      ready,
      monitoring,
      error,
      latencyMs,
      meter,
      start: fxMock.start,
      setParams: fxMock.setParams,
      toggleMonitor: fxMock.toggleMonitor,
      dispose: fxMock.dispose,
    }),
  };
});

import RealtimeFxLab from '@/components/RealtimeFxLab.vue';

describe('RealtimeFxLab', () => {
  beforeEach(() => {
    lang.value = 'en';
    fxMock.start.mockReset();
    fxMock.setParams.mockReset();
    fxMock.toggleMonitor.mockReset();
    fxMock.dispose.mockReset();
    fxMock.start.mockResolvedValue(true);
    fxMock.toggleMonitor.mockResolvedValue(true);
    fxMock.dispose.mockResolvedValue(undefined);
    fxMock.state.ready.value = false;
    fxMock.state.monitoring.value = false;
    fxMock.state.error.value = null;
    fxMock.state.latencyMs.value = 0;
    fxMock.state.meter.value = { inputPeak: 0, outputPeak: 0, inputRms: 0, outputRms: 0 };
    localStorage.clear();
  });

  it('restores a persisted preset, applies it and persists later preset choices', async () => {
    localStorage.setItem('libsonare:fx:preset', 'hall');
    const wrapper = mount(RealtimeFxLab);

    await nextTick();
    expect(wrapper.findAll('.rt-preset--active').map((button) => button.text())).toEqual(['Hall']);
    expect(fxMock.setParams).toHaveBeenLastCalledWith({
      pitchSemitones: 0,
      formant: 1,
      wet: 0.86,
      robot: 0,
      reverb: 0.9,
      outputGain: 0.58,
      bypass: false,
    });

    await wrapper
      .findAll('.rt-preset')
      .find((button) => button.text() === 'Robot')!
      .trigger('click');
    expect(localStorage.getItem('libsonare:fx:preset')).toBe('robot');
    expect(fxMock.setParams).toHaveBeenLastCalledWith({
      pitchSemitones: -1,
      formant: 0.92,
      wet: 0.92,
      robot: 0.9,
      reverb: 0.16,
      outputGain: 0.62,
      bypass: false,
    });

    wrapper.unmount();
  });

  it('starts, monitors, stops and disposes the realtime engine through UI actions', async () => {
    const wrapper = mount(RealtimeFxLab);
    const buttons = () => wrapper.findAll('button');

    await buttons()
      .find((button) => button.text() === 'Start engine')!
      .trigger('click');
    expect(fxMock.start).toHaveBeenCalledTimes(1);
    expect(fxMock.setParams).toHaveBeenCalled();

    fxMock.state.ready.value = true;
    await nextTick();
    await buttons()
      .find((button) => button.text() === 'Speaker on')!
      .trigger('click');
    expect(fxMock.toggleMonitor).toHaveBeenCalledTimes(1);

    await buttons()
      .find((button) => button.text() === 'Stop')!
      .trigger('click');
    expect(fxMock.dispose).toHaveBeenCalledTimes(1);

    wrapper.unmount();
    expect(fxMock.dispose).toHaveBeenCalledTimes(2);
  });

  it('sends slider and bypass updates to the realtime engine', async () => {
    const wrapper = mount(RealtimeFxLab);
    const inputs = wrapper.findAll('input');
    const pitch = inputs.find(
      (input) => input.attributes('type') === 'range' && input.attributes('min') === '-12',
    )!;
    const bypass = inputs.find((input) => input.attributes('type') === 'checkbox')!;

    await pitch.setValue('7.5');
    expect(fxMock.setParams).toHaveBeenLastCalledWith(
      expect.objectContaining({
        pitchSemitones: 7.5,
        bypass: false,
      }),
    );

    await bypass.setValue(true);
    expect(fxMock.setParams).toHaveBeenLastCalledWith(
      expect.objectContaining({
        pitchSemitones: 7.5,
        bypass: true,
      }),
    );

    await wrapper
      .findAll('.rt-preset')
      .find((button) => button.text() === 'Natural')!
      .trigger('click');
    expect(fxMock.setParams).toHaveBeenLastCalledWith(
      expect.objectContaining({
        pitchSemitones: 0,
        bypass: false,
      }),
    );

    wrapper.unmount();
  });

  it('does not toggle monitoring when lazy engine start fails', async () => {
    fxMock.start.mockResolvedValue(false);
    const wrapper = mount(RealtimeFxLab);

    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Speaker on')!
      .trigger('click');

    expect(fxMock.start).toHaveBeenCalledTimes(1);
    expect(fxMock.toggleMonitor).not.toHaveBeenCalled();
    expect(fxMock.setParams).not.toHaveBeenCalled();

    wrapper.unmount();
  });

  it('ignores invalid persisted presets without applying parameters', () => {
    localStorage.setItem('libsonare:fx:preset', 'not-a-preset');
    const wrapper = mount(RealtimeFxLab);

    expect(wrapper.findAll('.rt-preset--active').map((button) => button.text())).toEqual([
      'Natural',
    ]);
    expect(fxMock.setParams).not.toHaveBeenCalled();

    wrapper.unmount();
  });

  it('updates meters, latches clipping and lets the user clear the clip indicator', async () => {
    const wrapper = mount(RealtimeFxLab);

    fxMock.state.latencyMs.value = 96;
    fxMock.state.meter.value = {
      inputPeak: 0.5,
      outputPeak: 1,
      inputRms: 0.25,
      outputRms: 0.75,
    };
    await nextTick();

    expect(wrapper.text()).toContain('96 ms');
    expect(wrapper.find('.rt-clip').classes()).toContain('rt-clip--lit');
    expect(wrapper.findAll('.rt-meter__peak')).toHaveLength(2);

    await wrapper.find('.rt-clip').trigger('click');
    expect(wrapper.find('.rt-clip').classes()).not.toContain('rt-clip--lit');

    wrapper.unmount();
  });

  it('maps microphone API errors to user-facing copy', () => {
    fxMock.state.error.value = 'no-mic-api';
    const wrapper = mount(RealtimeFxLab);

    expect(wrapper.find('.rt-error').text()).toContain(
      'This browser does not expose microphone input.',
    );

    wrapper.unmount();
  });
});
