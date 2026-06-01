import { mount } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h } from 'vue';
import MasteringChainPanel from '@/components/MasteringChainPanel.vue';
import MasteringFineTune from '@/components/MasteringFineTune.vue';
import MasteringMetersPanel from '@/components/MasteringMetersPanel.vue';
import MasteringModuleEditor from '@/components/MasteringModuleEditor.vue';
import { defaultDiagnosticBypass, defaultModuleSettings } from '@/composables/useMastering';

const lang = vi.hoisted(() => ({ value: 'en' }));

vi.mock('vitepress', () => ({
  useData: () => ({ lang }),
}));

vi.mock('@/components/MasterKnob.vue', () => ({
  default: defineComponent({
    props: ['modelValue', 'label'],
    emits: ['update:modelValue'],
    setup(props, { emit }) {
      return () =>
        h(
          'button',
          {
            class: 'master-knob-stub',
            'data-label': props.label,
            'data-value': props.modelValue,
            onClick: () => emit('update:modelValue', Number(props.modelValue) + 1),
          },
          props.label,
        );
    },
  }),
}));

vi.mock('@/components/MasteringWaveform.vue', () => ({
  default: defineComponent({
    props: ['audio', 'compare', 'variant'],
    setup(props) {
      return () =>
        h(
          'div',
          {
            class: 'mastering-waveform-stub',
            'data-variant': props.variant,
            'data-has-compare': String(Boolean(props.compare)),
          },
          'Waveform',
        );
    },
  }),
}));

afterEach(() => {
  document.body.innerHTML = '';
});

function audio() {
  return {
    fileName: 'source.wav',
    sampleRate: 48_000,
    duration: 10,
    channels: 2,
    left: new Float32Array([0.2, -0.2]),
    right: new Float32Array([0.2, -0.2]),
  };
}

function rendered() {
  return {
    left: new Float32Array([0.1, -0.1]),
    right: new Float32Array([0.1, -0.1]),
    sampleRate: 48_000,
    inputLufs: -18,
    outputLufs: -14,
    appliedGainDb: 4,
    stages: ['eq.tilt'],
  };
}

describe('mastering studio panel components', () => {
  it('emits chain navigation and preset management actions', async () => {
    const wrapper = mount(MasteringChainPanel, {
      props: {
        modules: ['input', 'eq', 'limiter'],
        activeModule: 'eq',
        chainSettingsUrl: 'blob:chain',
      },
    });

    expect(wrapper.findAll('.signal-flow__row')[1].classes()).toContain('signal-flow__row--active');
    expect(wrapper.find('.studio-actions__button--link').attributes('href')).toBe('blob:chain');
    expect(wrapper.find('.studio-actions__button--link').attributes('download')).toBe(
      'libsonare-mastering-chain.json',
    );

    await wrapper.findAll('.signal-flow__btn')[2].trigger('click');
    expect(wrapper.emitted('update:activeModule')).toEqual([['limiter']]);

    const buttons = wrapper
      .findAll('.studio-actions__button')
      .filter((button) => button.element.tagName === 'BUTTON');
    await buttons[0].trigger('click');
    await buttons[1].trigger('click');
    await buttons[2].trigger('click');
    expect(wrapper.emitted('save')).toHaveLength(1);
    expect(wrapper.emitted('load')).toHaveLength(1);
    expect(wrapper.emitted('export')).toHaveLength(1);

    await wrapper.find('input[type="file"]').trigger('change');
    expect(wrapper.emitted('import')).toHaveLength(1);
  });

  it('toggles fine tune controls and emits slider values', async () => {
    const wrapper = mount(MasteringFineTune, {
      props: {
        show: false,
        tone: 50,
        width: 60,
        dynamics: 40,
        ceilingDb: -1,
        diagnosticBypass: defaultDiagnosticBypass(),
      },
    });

    await wrapper.find('.master-disclosure').trigger('click');
    expect(wrapper.emitted('update:show')).toEqual([[true]]);

    await wrapper.setProps({ show: true });
    const sliders = wrapper.findAll('input[type="range"]');
    await sliders[0].setValue('70');
    await sliders[1].setValue('45');
    await sliders[2].setValue('80');
    await sliders[3].setValue('-1.5');
    expect(wrapper.emitted('update:tone')).toEqual([[70]]);
    expect(wrapper.emitted('update:width')).toEqual([[45]]);
    expect(wrapper.emitted('update:dynamics')).toEqual([[80]]);
    expect(wrapper.emitted('update:ceilingDb')).toEqual([[-1.5]]);
  });

  it('keeps fine tune sliders unmounted while collapsed and switches labels by locale', async () => {
    lang.value = 'ja';
    const wrapper = mount(MasteringFineTune, {
      props: {
        show: false,
        tone: 50,
        width: 60,
        dynamics: 40,
        ceilingDb: -1,
        diagnosticBypass: defaultDiagnosticBypass(),
      },
    });

    expect(wrapper.findAll('input[type="range"]')).toHaveLength(0);
    expect(wrapper.find('.master-disclosure').text()).toContain('微調整');

    await wrapper.setProps({ show: true });
    expect(wrapper.findAll('input[type="range"]')).toHaveLength(4);
    expect(wrapper.find('.master-disclosure').text()).toContain('微調整');

    lang.value = 'en';
    wrapper.unmount();
  });

  it('renders module controls, reset state and loudness platform controls', async () => {
    const settings = defaultModuleSettings();
    const wrapper = mount(MasteringModuleEditor, {
      props: {
        activeModule: 'loudness',
        activeStage: 4,
        totalStages: 9,
        source: audio(),
        rendered: rendered(),
        moduleControls: [
          { key: 'inputGainDb', min: -24, max: 24, step: 0.5, unit: 'dB' },
          { key: 'tiltDb', min: -12, max: 12, step: 0.5, unit: 'dB' },
        ],
        moduleSettings: settings,
        chainDefaults: defaultModuleSettings(),
        canResetActiveModule: true,
        targetLufs: -14,
        selectedPlatform: 'youtube',
        customLufs: -14,
        platforms: [
          { id: 'youtube', lufs: -14 },
          { id: 'custom', lufs: -14 },
        ],
      },
    });

    expect(wrapper.find('.module-editor__stage strong').text()).toBe('04');
    expect(wrapper.find('.mastering-waveform-stub').attributes('data-variant')).toBe('master');
    expect(wrapper.find('.mastering-waveform-stub').attributes('data-has-compare')).toBe('true');
    expect(wrapper.findAll('.master-knob-stub')).toHaveLength(2);

    await wrapper.findAll('.master-knob-stub')[0].trigger('click');
    expect(wrapper.emitted('update:moduleSetting')).toEqual([
      ['inputGainDb', settings.inputGainDb + 1],
    ]);

    await wrapper.find('.module-editor__reset-btn').trigger('click');
    expect(wrapper.emitted('reset')).toHaveLength(1);

    await wrapper.findAll('input[type="radio"]')[1].trigger('change');
    expect(wrapper.emitted('update:selectedPlatform')).toEqual([['custom']]);

    await wrapper.setProps({ selectedPlatform: 'custom' });
    await wrapper.find('.master-slider input').setValue('-16');
    expect(wrapper.emitted('update:customLufs')).toEqual([[-16]]);
  });

  it('marks active studio platforms and hides custom LUFS until custom is selected', async () => {
    const wrapper = mount(MasteringModuleEditor, {
      props: {
        activeModule: 'loudness',
        activeStage: 4,
        totalStages: 9,
        source: audio(),
        rendered: null,
        moduleControls: [],
        moduleSettings: defaultModuleSettings(),
        chainDefaults: defaultModuleSettings(),
        canResetActiveModule: false,
        targetLufs: -16,
        selectedPlatform: 'apple',
        customLufs: -12,
        platforms: [
          { id: 'youtube', lufs: -14 },
          { id: 'apple', lufs: -16 },
          { id: 'custom', lufs: -12 },
        ],
      },
    });

    expect(wrapper.find('.platform-grid').classes()).toContain('platform-grid--studio');
    expect(wrapper.findAll('.platform-option')[1].classes()).toContain('platform-option--active');
    expect(wrapper.find('.master-slider').exists()).toBe(false);

    await wrapper.setProps({ selectedPlatform: 'custom' });
    expect(wrapper.find('.master-slider').exists()).toBe(true);
    expect(wrapper.find('.master-slider strong').text()).toBe('-12 LUFS');
  });

  it('disables module reset when nothing changed and shows source-only waveform before render', () => {
    const wrapper = mount(MasteringModuleEditor, {
      props: {
        activeModule: 'output',
        activeStage: 9,
        totalStages: 9,
        source: audio(),
        rendered: null,
        moduleControls: [{ key: 'limiterCeilingDb', min: -3, max: 0, step: 0.1, unit: 'dB' }],
        moduleSettings: defaultModuleSettings(),
        chainDefaults: defaultModuleSettings(),
        canResetActiveModule: false,
        targetLufs: -14,
        selectedPlatform: 'youtube',
        customLufs: -14,
        platforms: [{ id: 'youtube', lufs: -14 }],
      },
    });

    expect(wrapper.find('.module-editor__reset-btn').attributes('disabled')).toBeDefined();
    expect(wrapper.find('.mastering-waveform-stub').attributes('data-variant')).toBe('source');
    expect(wrapper.text()).toContain('Output');
  });

  it('renders LED meters, phase scope and emits jump targets', async () => {
    const wrapper = mount(MasteringMetersPanel, {
      props: {
        readings: [
          { id: 'lufs', label: 'LUFS', value: '-14.0', percent: 75 },
          { id: 'crest', label: 'Crest', value: '9.0 dB', percent: 30 },
          { id: 'unknown', label: 'Other', value: '-', percent: 10 },
        ],
        meterTargets: { lufs: 'loudness', crest: 'dynamics' },
        moduleGuideSlugs: {
          input: 'input',
          loudness: 'loudness',
          limiter: 'limiter',
          dynamics: 'dynamics',
          stereo: 'stereo',
        },
        activeModule: 'loudness',
        statusLabel: 'Ready',
        rendered: rendered(),
        sourceMetrics: { peak: '-6.0 dBFS', crest: '8.0 dB', correlation: '0.20' },
        masterMetrics: { peak: '-1.0 dBFS', crest: '9.0 dB', correlation: '0.40' },
        targetLufs: -14,
        phasePoints: [
          { x: 10, y: 20, opacity: 0.5 },
          { x: 80, y: 40, opacity: 0.8 },
        ],
        stereoImage: { width: '65%', label: 'Wide' },
        glossaryBasePath: '/docs/glossary',
      },
    });

    const meters = wrapper.findAll('.led-meter');
    expect(meters[0].classes()).toContain('led-meter--active');
    expect(meters[2].attributes('disabled')).toBeDefined();
    expect(wrapper.findAll('.led-meter__seg--on').length).toBeGreaterThan(0);
    expect(wrapper.findAll('.phase-scope span')).toHaveLength(2);
    expect(wrapper.find('.stereo-field span').attributes('style')).toContain('width: 65%');

    await meters[0].trigger('click');
    await meters[1].trigger('click');
    await wrapper.findAll('.meter-jump')[0].trigger('click');
    await wrapper.find('.meter-jump--block').trigger('click');
    expect(wrapper.emitted('jump')).toEqual([['loudness'], ['dynamics'], ['input'], ['stereo']]);
  });
});
