import { mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import { defineComponent, h } from 'vue';
import MasteringPlatformSelector from '@/components/MasteringPlatformSelector.vue';
import MasteringPresetGrid from '@/components/MasteringPresetGrid.vue';
import MasteringReferencePanel from '@/components/MasteringReferencePanel.vue';
import MasteringResultPanel from '@/components/MasteringResultPanel.vue';
import MasteringVenueSelector from '@/components/MasteringVenueSelector.vue';
import type { DecodedMasteringAudio, RenderedMasteringAudio } from '@/composables/useMastering';

const lang = vi.hoisted(() => ({ value: 'en' }));

vi.mock('vitepress', () => ({
  useData: () => ({ lang }),
}));

const transportMock = vi.hoisted(() => ({
  setVolume: vi.fn(),
  seekFraction: vi.fn(),
  togglePlayback: vi.fn(),
}));

vi.mock('@/components/ui', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@/components/ui');
  return {
    ...actual,
    AudioTransport: defineComponent({
      props: { src: String },
      emits: ['progress'],
      setup(props, { emit, expose }) {
        expose(transportMock);
        return () =>
          h(
            'button',
            {
              class: 'audio-transport-stub',
              'data-src': props.src,
              onClick: () => emit('progress', 0.42),
            },
            'Transport',
          );
      },
    }),
  };
});

vi.mock('@/components/MasteringWaveform.vue', () => ({
  default: defineComponent({
    props: ['audio', 'compare', 'variant', 'modeLabel', 'height', 'progress'],
    emits: ['seek'],
    setup(props, { emit }) {
      return () =>
        h(
          'button',
          {
            class: 'mastering-waveform-stub',
            'data-variant': props.variant,
            'data-mode-label': props.modeLabel,
            'data-progress': props.progress,
            onClick: () => emit('seek', 0.25),
          },
          'Waveform',
        );
    },
  }),
}));

function decodedAudio(fileName = 'source.wav'): DecodedMasteringAudio {
  return {
    fileName,
    sampleRate: 48_000,
    duration: 10,
    channels: 2,
    left: new Float32Array([0.4, -0.4]),
    right: new Float32Array([0.3, -0.3]),
  };
}

function renderedAudio(): RenderedMasteringAudio {
  return {
    left: new Float32Array([0.2, -0.2]),
    right: new Float32Array([0.2, -0.2]),
    sampleRate: 48_000,
    inputLufs: -18,
    outputLufs: -14,
    appliedGainDb: 4,
    stages: ['eq.tilt'],
  };
}

describe('mastering panel components', () => {
  it('emits preset changes and marks the active preset', async () => {
    const wrapper = mount(MasteringPresetGrid, {
      props: {
        modelValue: 'pop',
        presets: [
          { id: 'pop', icon: 'POP' },
          { id: 'edm', icon: 'EDM' },
        ],
      },
    });

    expect(wrapper.findAll('.preset-card')[0].classes()).toContain('preset-card--active');

    await wrapper.findAll('.preset-card')[1].trigger('click');
    expect(wrapper.emitted('update:modelValue')).toEqual([['edm']]);

    await wrapper.findAll('.preset-card__info')[0].trigger('click');
    expect(wrapper.emitted('update:modelValue')).toEqual([['edm']]);
  });

  it('emits venue changes and marks the active recording condition', async () => {
    const wrapper = mount(MasteringVenueSelector, {
      props: {
        modelValue: 'studio',
        venues: [
          { id: 'studio', icon: 'STU' },
          { id: 'livehouseSmall', icon: 'LV-S' },
          { id: 'livehouseLarge', icon: 'LV-L' },
        ],
      },
    });

    expect(wrapper.findAll('.venue-option')[0].classes()).toContain('venue-option--active');

    await wrapper.findAll('.venue-option')[1].trigger('click');
    expect(wrapper.emitted('update:modelValue')).toEqual([['livehouseSmall']]);

    await wrapper.findAll('.venue-option__info')[2].trigger('click');
    expect(wrapper.emitted('update:modelValue')).toEqual([['livehouseSmall']]);
  });

  it('emits platform and custom LUFS updates', async () => {
    const wrapper = mount(MasteringPlatformSelector, {
      props: {
        modelValue: 'youtube',
        customLufs: -14,
        eyebrow: 'Target',
        platforms: [
          { id: 'youtube', lufs: -14 },
          { id: 'spotify', lufs: -14 },
          { id: 'custom', lufs: -14 },
        ],
      },
    });

    await wrapper.findAll('input[type="radio"]')[1].trigger('change');
    expect(wrapper.emitted('update:modelValue')).toEqual([['spotify']]);

    await wrapper.setProps({ modelValue: 'custom' });
    expect(wrapper.find('.master-slider').exists()).toBe(true);
    await wrapper.find('.master-slider input').setValue('-16.5');
    expect(wrapper.emitted('update:customLufs')).toEqual([[-16.5]]);
  });

  it('shows the recommended target badge and warns only when the target is louder', async () => {
    const wrapper = mount(MasteringPlatformSelector, {
      props: {
        modelValue: 'apple',
        customLufs: -14,
        eyebrow: 'Target',
        platforms: [
          { id: 'apple', lufs: -16 },
          { id: 'youtube', lufs: -14 },
        ],
        recommendedLufs: -16,
        currentLufs: -16,
        presetName: 'Live · Stage',
      },
    });

    expect(wrapper.find('.platform-rec__badge').exists()).toBe(true);
    expect(wrapper.find('.platform-rec__warning').exists()).toBe(false);

    // Target now 2 LU louder than the -16 recommendation → warn.
    await wrapper.setProps({ currentLufs: -14 });
    expect(wrapper.find('.platform-rec__warning').exists()).toBe(true);
  });

  it('omits the recommendation block when no recommended target is provided', () => {
    const wrapper = mount(MasteringPlatformSelector, {
      props: {
        modelValue: 'youtube',
        customLufs: -14,
        eyebrow: 'Target',
        platforms: [{ id: 'youtube', lufs: -14 }],
      },
    });

    expect(wrapper.find('.platform-rec').exists()).toBe(false);
  });

  it('renders reference metrics and emits file/match events with disabled states', async () => {
    const wrapper = mount(MasteringReferencePanel, {
      props: {
        reference: null,
        referenceMetrics: null,
        referenceUrl: null,
        masterCrest: null,
        isRendering: false,
        canMatch: false,
      },
    });

    expect(wrapper.find('.reference-panel__button').attributes('disabled')).toBeDefined();
    await wrapper.find('input[type="file"]').trigger('change');
    expect(wrapper.emitted('file')).toHaveLength(1);

    await wrapper.setProps({
      reference: decodedAudio('reference.wav'),
      referenceMetrics: {
        duration: '0:10',
        peak: '-4.0 dBFS',
        crest: '8.0 dB',
        correlation: '0.80',
      },
      referenceUrl: 'blob:reference',
      masterCrest: '9.0 dB',
      canMatch: true,
    });

    expect(wrapper.text()).toContain('reference.wav');
    expect(wrapper.text()).toContain('9.0 dB / 8.0 dB');
    expect(wrapper.find('.audio-transport-stub').attributes('data-src')).toBe('blob:reference');
    expect(wrapper.find('.mastering-waveform-stub').attributes('data-mode-label')).toBeTruthy();

    await wrapper.find('.reference-panel__button').trigger('click');
    expect(wrapper.emitted('match')).toHaveLength(1);

    await wrapper.setProps({ isRendering: true });
    expect(wrapper.find('.reference-panel__button').attributes('disabled')).toBeDefined();
  });

  it('wires result panel A/B controls, loudness matching, downloads, progress and exposed transport methods', async () => {
    transportMock.setVolume.mockReset();
    transportMock.seekFraction.mockReset();
    transportMock.togglePlayback.mockReset();

    const wrapper = mount(MasteringResultPanel, {
      props: {
        source: decodedAudio(),
        sourceMetrics: {
          duration: '0:10',
          sampleRate: '48 kHz',
          channels: 'Stereo',
          peak: '-6.0 dBFS',
        },
        masterMetrics: { peak: '-1.0 dBFS' },
        resultWaveAudio: renderedAudio(),
        resultWaveCompare: decodedAudio(),
        resultWaveVariant: 'master',
        playbackUrl: 'blob:master',
        listenTarget: 'master',
        loudnessMatched: true,
        sourceUrl: 'blob:source',
        outputUrl: 'blob:master',
        referenceUrl: 'blob:reference',
        reportUrl: 'blob:report',
        renderResultStages: 'EQ / Limiter',
        error: 'Render warning',
      },
    });

    const buttons = wrapper.findAll('.ab-controls__button');
    expect(buttons.map((button) => button.attributes('disabled'))).toEqual([
      undefined,
      undefined,
      undefined,
    ]);
    await buttons[0].trigger('click');
    await buttons[2].trigger('click');
    expect(wrapper.emitted('update:listenTarget')).toEqual([['source'], ['reference']]);

    await wrapper.find('input[type="checkbox"]').setValue(false);
    expect(wrapper.emitted('update:loudnessMatched')).toEqual([[false]]);

    expect(wrapper.findAll('.master-download')[0].attributes('href')).toBe('blob:master');
    expect(wrapper.findAll('.master-download')[1].attributes('href')).toBe('blob:report');
    expect(wrapper.text()).toContain('EQ / Limiter');
    expect(wrapper.text()).toContain('Render warning');

    await wrapper.find('.audio-transport-stub').trigger('click');
    expect(wrapper.find('.mastering-waveform-stub').attributes('data-progress')).toBe('0.42');
    await wrapper.find('.mastering-waveform-stub').trigger('click');
    expect(transportMock.seekFraction).toHaveBeenCalledWith(0.25);

    (wrapper.vm as any).setVolume(0.5);
    (wrapper.vm as any).togglePlayback();
    expect(transportMock.setVolume).toHaveBeenCalledWith(0.5);
    expect(transportMock.togglePlayback).toHaveBeenCalledTimes(1);
  });
});
