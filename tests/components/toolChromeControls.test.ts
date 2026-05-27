import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import ToolModeTabs from '@/components/ToolModeTabs.vue';
import ToolStatusBar from '@/components/ToolStatusBar.vue';

describe('ToolModeTabs', () => {
  it('renders accessible mode buttons and emits selected mode ids', async () => {
    const wrapper = mount(ToolModeTabs, {
      props: {
        modelValue: 'quick',
        ariaLabel: 'Mastering mode',
        options: [
          { id: 'quick', label: 'Quick' },
          { id: 'studio', label: 'Studio' },
          { id: 'reference', label: 'Reference' },
        ],
      },
    });

    expect(wrapper.attributes('aria-label')).toBe('Mastering mode');
    const buttons = wrapper.findAll('button');
    expect(buttons.map((button) => button.text())).toEqual(['Quick', 'Studio', 'Reference']);
    expect(buttons[0].classes()).toContain('tool-mode-tabs__button--active');
    expect(buttons[1].classes()).not.toContain('tool-mode-tabs__button--active');

    await buttons[1].trigger('click');
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['studio']);

    await wrapper.setProps({ modelValue: 'reference' });
    expect(buttons[0].classes()).not.toContain('tool-mode-tabs__button--active');
    expect(buttons[2].classes()).toContain('tool-mode-tabs__button--active');
  });
});

describe('ToolStatusBar', () => {
  it('renders live status, dividers and wide field values', () => {
    const wrapper = mount(ToolStatusBar, {
      props: {
        status: 'warning',
        label: 'CHECK',
        pulse: true,
        fields: [
          { key: 'FILE', value: 'song.wav', wide: true },
          { key: 'DUR', value: '2:05' },
          { key: 'RATE', value: '48 kHz' },
          { key: 'CH', value: 'Stereo' },
          { key: 'TARGET', value: '-14 LUFS' },
          { key: 'GAIN', value: '+3.2 dB' },
        ],
      },
    });

    expect(wrapper.attributes('role')).toBe('status');
    expect(wrapper.attributes('aria-live')).toBe('polite');
    expect(wrapper.find('.status-indicator').text()).toContain('CHECK');
    expect(wrapper.find('.status-indicator').classes()).toContain('status-indicator--warning');
    expect(wrapper.find('.status-indicator').classes()).toContain('status-indicator--pulse');
    expect(wrapper.findAll('.tool-statusbar__divider')).toHaveLength(2);
    expect(wrapper.findAll('.tool-statusbar__key').map((node) => node.text())).toEqual([
      'FILE',
      'DUR',
      'RATE',
      'CH',
      'TARGET',
      'GAIN',
    ]);
    expect(wrapper.find('.tool-statusbar__value--wide').text()).toBe('song.wav');
  });
});
