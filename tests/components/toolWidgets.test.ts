import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ToolStatusBar from '@/components/ToolStatusBar.vue';
import DataConsole from '@/demos/analyzer/DataConsole.vue';

vi.mock('vitepress', () => ({ useData: () => ({ lang: { value: 'en' } }) }));

afterEach(() => {
  vi.useRealTimers();
});

describe('ToolStatusBar', () => {
  it('renders status and fields with wide value styling', () => {
    const wrapper = mount(ToolStatusBar, {
      props: {
        status: 'warning',
        label: 'Needs attention',
        pulse: true,
        fields: [
          { key: 'SRC', value: 'demo.wav', wide: true },
          { key: 'LEN', value: '2:05' },
          { key: 'SR', value: '48 kHz' },
          { key: 'CH', value: '2' },
          { key: 'BPM', value: '120.0' },
          { key: 'KEY', value: 'Am' },
        ],
      },
    });

    expect(wrapper.attributes('role')).toBeUndefined();
    expect(wrapper.find('[role="status"]').text()).toContain('Needs attention');
    expect(wrapper.find('[role="status"]').attributes('aria-live')).toBe('polite');
    expect(wrapper.findAll('.tool-statusbar__key').map((node) => node.text())).toEqual([
      'SRC',
      'LEN',
      'SR',
      'CH',
      'BPM',
      'KEY',
    ]);
    expect(wrapper.find('.tool-statusbar__value--wide').text()).toBe('demo.wav');
  });
});

describe('DataConsole', () => {
  it('runs boot sequence, logs playback data and scrolls to the bottom', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000);

    const wrapper = mount(DataConsole, {
      props: {
        chromaData: {
          nFrames: 4,
          nChroma: 12,
          features: new Float32Array([
            0.9, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.8, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.7,
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.6, 0, 0, 0, 0, 0, 0, 0, 0,
          ]),
        },
        rmsData: new Float32Array([0.2, 0.4, 0.6, 0.8]),
        bandData: {
          low: new Float32Array([0.1, 0.2, 0.3, 0.4]),
          high: new Float32Array([0.5, 0.6, 0.7, 0.8]),
        },
        currentTime: 0,
        duration: 4,
        isPlaying: false,
        sampleRate: 48_000,
      },
    });

    await vi.advanceTimersByTimeAsync(1_000);
    expect(wrapper.text()).toContain('LIBSONARE AUDIO ANALYSIS ENGINE');
    expect(wrapper.text()).toContain('[READY] Awaiting audio signal');

    await wrapper.setProps({ isPlaying: true, currentTime: 2 });
    expect(wrapper.text()).toContain('[STREAM] Audio playback started');

    for (let i = 0; i < 6; i++) {
      vi.setSystemTime(1_100 + i * 100);
      await vi.advanceTimersByTimeAsync(80);
    }

    expect(wrapper.text()).toContain('RMS_PWR');
    expect(wrapper.text()).toContain('LO_BAND');
    expect(wrapper.text()).toContain('HI_BAND');
    expect(wrapper.text()).toContain('CHROMA');
    expect(wrapper.text()).toContain('NOTE_DT');
    expect(wrapper.text()).toContain('FRM_IDX');

    await wrapper.setProps({ isPlaying: false });
    await flushPromises();
    expect(wrapper.text()).toContain('[STREAM] Playback paused');

    wrapper.unmount();
  });
});
