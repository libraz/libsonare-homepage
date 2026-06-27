import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import DemoControls from '@/components/demos/DemoControls.vue';
import type { ParamDef } from '@/demos/types';

const params: ParamDef[] = [
  {
    key: 'mode',
    kind: 'select',
    default: 'clean',
    label: { en: 'Mode', ja: 'モード' },
    options: [
      { value: 'clean', label: { en: 'Clean', ja: 'クリーン' } },
      { value: 'wide', label: { en: 'Wide', ja: 'ワイド' } },
    ],
  },
  {
    key: 'gain',
    kind: 'range',
    default: 3,
    min: 0,
    max: 12,
    step: 1,
    unit: 'dB',
    label: { en: 'Gain', ja: 'ゲイン' },
  },
  {
    key: 'bypass',
    kind: 'toggle',
    default: false,
    label: { en: 'Bypass', ja: 'バイパス' },
  },
];

describe('DemoControls', () => {
  function labelTextFor(
    wrapper: ReturnType<typeof mount>,
    controlSelector: string,
  ): string | undefined {
    const labelId = wrapper.find(controlSelector).attributes('aria-labelledby');
    return wrapper
      .findAll('.dc__label')
      .find((label) => label.attributes('id') === labelId)
      ?.text();
  }

  it('renders accessible controls and emits updated value records', async () => {
    const wrapper = mount(DemoControls, {
      props: {
        params,
        modelValue: { mode: 'clean', gain: 3, bypass: false },
        locale: 'en',
      },
    });

    expect(labelTextFor(wrapper, '[role="group"]')).toBe('Mode');
    expect(labelTextFor(wrapper, '[role="switch"]')).toBe('Bypass');
    expect(labelTextFor(wrapper, 'input[type="range"]')).toBe('Gain');
    const valueId = wrapper.find('input[type="range"]').attributes('aria-describedby');
    expect(wrapper.find('output').attributes('id')).toBe(valueId);
    expect(wrapper.find('output').text()).toBe('3 dB');

    await wrapper.findAll('.dc__seg-btn')[1].trigger('click');
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([
      { mode: 'wide', gain: 3, bypass: false },
    ]);

    await wrapper.find('input[type="range"]').setValue('8');
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([
      { mode: 'clean', gain: 8, bypass: false },
    ]);

    await wrapper.find('[role="switch"]').trigger('click');
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([
      { mode: 'clean', gain: 3, bypass: true },
    ]);
  });

  it('localizes labels and option text', () => {
    const wrapper = mount(DemoControls, {
      props: {
        params,
        modelValue: { mode: 'clean', gain: 3, bypass: false },
        locale: 'ja',
      },
    });

    expect(labelTextFor(wrapper, '[role="group"]')).toBe('モード');
    expect(wrapper.findAll('.dc__seg-btn').map((button) => button.text())).toEqual([
      'クリーン',
      'ワイド',
    ]);
  });
});
