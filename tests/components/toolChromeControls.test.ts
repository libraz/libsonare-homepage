import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import ToolStatusBar from '@/components/ToolStatusBar.vue';

describe('ToolStatusBar', () => {
  it('renders live status, flagged dividers and wide field values', () => {
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
          { key: 'GAIN', value: '+3.2 dB', divider: true },
        ],
      },
    });

    // Only the status label is a live region; the changing fields are not.
    expect(wrapper.attributes('role')).toBeUndefined();
    expect(wrapper.find('.status-indicator').attributes('role')).toBe('status');
    expect(wrapper.find('.status-indicator').attributes('aria-live')).toBe('polite');
    expect(wrapper.find('.status-indicator').text()).toContain('CHECK');
    expect(wrapper.find('.status-indicator').classes()).toContain('status-indicator--warning');
    expect(wrapper.find('.status-indicator').classes()).toContain('status-indicator--pulse');
    const dividers = wrapper.findAll('.tool-statusbar__divider');
    expect(dividers).toHaveLength(2);
    expect(dividers[1].element.nextElementSibling?.textContent).toContain('GAIN');
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
