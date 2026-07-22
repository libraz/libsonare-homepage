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
  const VOICE_PRESET_MACROS = {
    'neutral-monitor': { pitchSemitones: 0, formant: 1.0, brightness: 0.1, wet: 1 },
    'bright-idol': { pitchSemitones: 4, formant: 1.18, brightness: 0.7, wet: 1 },
    'soft-whisper': { pitchSemitones: 2, formant: 1.1, brightness: 0.25, wet: 1 },
    'deep-narrator': { pitchSemitones: -5, formant: 0.84, brightness: -0.25, wet: 1 },
    'robot-mascot': { pitchSemitones: 7, formant: 1.3, brightness: 0.75, wet: 1 },
    'dark-villain': { pitchSemitones: -9, formant: 0.72, brightness: -0.7, wet: 1 },
  };
  const VOICE_PRESET_ORDER = Object.keys(VOICE_PRESET_MACROS);
  const ready = ref(false);
  const monitoring = ref(false);
  const error = ref<string | null>(null);
  const latencyMs = ref(0);
  const meter = ref({ inputPeak: 0, outputPeak: 0, inputRms: 0, outputRms: 0 });
  fxMock.state = { ready, monitoring, error, latencyMs, meter };
  return {
    VOICE_PRESET_MACROS,
    VOICE_PRESET_ORDER,
    isVoicePresetId: (value: unknown) =>
      typeof value === 'string' && Object.hasOwn(VOICE_PRESET_MACROS, value),
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
    localStorage.setItem('libsonare:fx:preset', 'dark-villain');
    const wrapper = mount(RealtimeFxLab);

    await nextTick();
    expect(wrapper.findAll('.rt-preset--active').map((button) => button.text())).toEqual([
      'Dark Villain',
    ]);
    expect(fxMock.setParams).toHaveBeenLastCalledWith({
      preset: 'dark-villain',
      pitchSemitones: -9,
      formant: 0.72,
      brightness: -0.7,
      formantEngaged: false,
      wet: 1,
      outputGain: 0.85,
      bypass: false,
    });

    await wrapper
      .findAll('.rt-preset')
      .find((button) => button.text() === 'Robot Mascot')!
      .trigger('click');
    expect(localStorage.getItem('libsonare:fx:preset')).toBe('robot-mascot');
    expect(fxMock.setParams).toHaveBeenLastCalledWith({
      preset: 'robot-mascot',
      pitchSemitones: 7,
      formant: 1.3,
      brightness: 0.75,
      formantEngaged: false,
      wet: 1,
      outputGain: 0.85,
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

    // Selecting a character preset sets the four voice macros but leaves the
    // bypass A/B toggle untouched (it stays on from the step above).
    await wrapper
      .findAll('.rt-preset')
      .find((button) => button.text() === 'Neutral Monitor')!
      .trigger('click');
    expect(fxMock.setParams).toHaveBeenLastCalledWith(
      expect.objectContaining({
        preset: 'neutral-monitor',
        pitchSemitones: 0,
        bypass: true,
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
      'Neutral Monitor',
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

  it('renders localized copy for permission denial and generic start failures', async () => {
    fxMock.state.error.value = 'mic-denied';
    const wrapper = mount(RealtimeFxLab);
    expect(wrapper.find('.rt-error').text()).toContain('Microphone access was blocked');

    // Any unrecognized error code falls back to the generic start-failure copy,
    // so a raw browser message is never shown to the visitor.
    fxMock.state.error.value = 'start-failed';
    await nextTick();
    expect(wrapper.find('.rt-error').text()).toContain(
      'Could not start the realtime audio engine.',
    );

    wrapper.unmount();
  });

  it('keeps Stop available while starting so a half-open context can be cancelled', async () => {
    let releaseStart!: (ok: boolean) => void;
    fxMock.start.mockImplementation(
      () =>
        new Promise<boolean>((resolve) => {
          releaseStart = resolve;
        }),
    );
    const wrapper = mount(RealtimeFxLab);
    const stopButton = () => wrapper.findAll('button').find((button) => button.text() === 'Stop')!;

    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Start engine')!
      .trigger('click');
    await nextTick();
    // Start is still pending (isStarting === true): Stop remains available so
    // getUserMedia/worklet startup can always be cancelled.
    expect(stopButton().attributes('disabled')).toBeUndefined();

    releaseStart(true);
    await nextTick();
    await nextTick();
    wrapper.unmount();
  });
});
