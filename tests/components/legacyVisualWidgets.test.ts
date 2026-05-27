import { mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import BpmVisualizer from '@/components/BpmVisualizer.vue';
import DataConsole from '@/components/DataConsole.vue';
import WaveformVisualizer from '@/components/WaveformVisualizer.vue';

function makeAudioBuffer(channels: Float32Array[], sampleRate = 44100): AudioBuffer {
  return {
    numberOfChannels: channels.length,
    length: channels[0]?.length ?? 0,
    duration: (channels[0]?.length ?? 0) / sampleRate,
    sampleRate,
    getChannelData: (channel: number) => channels[channel],
  } as unknown as AudioBuffer;
}

function installCanvasMocks() {
  const ctx = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    fillRect: vi.fn(),
    beginPath: vi.fn(),
    roundRect: vi.fn(),
    fill: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    scale: vi.fn(),
  };

  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
    ctx as unknown as CanvasRenderingContext2D,
  );
  vi.stubGlobal(
    'ResizeObserver',
    vi.fn().mockImplementation(function (callback: ResizeObserverCallback) {
      return {
        observe: vi.fn((target: Element) =>
          callback([{ target } as ResizeObserverEntry], {} as ResizeObserver),
        ),
        disconnect: vi.fn(),
      };
    }),
  );

  return ctx;
}

describe('BpmVisualizer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('pulses on detected beat frames and clears the pulse state', async () => {
    const wrapper = mount(BpmVisualizer, {
      props: {
        bpm: 128.4,
        isPlaying: false,
        currentTime: 0,
        beats: new Float32Array([0.5, 1.0]),
      },
    });

    expect(wrapper.find('.bpm-value').text()).toBe('128');

    await wrapper.setProps({ isPlaying: true, currentTime: 0.51 });
    expect(wrapper.find('.bpm-circle').classes()).toContain('bpm-circle--beating');
    expect(wrapper.find('.bpm-circle').attributes('style')).toContain('scale(1.15)');
    expect(wrapper.findAll('.bpm-bar--active')).toHaveLength(2);

    vi.advanceTimersByTime(100);
    await wrapper.vm.$nextTick();
    expect(wrapper.find('.bpm-circle').attributes('style')).toContain('scale(1)');

    vi.advanceTimersByTime(100);
    await wrapper.vm.$nextTick();
    expect(wrapper.find('.bpm-circle').classes()).not.toContain('bpm-circle--beating');
  });

  it('uses BPM interval fallback when no explicit beats are available', async () => {
    const wrapper = mount(BpmVisualizer, {
      props: { bpm: 120, isPlaying: false, currentTime: 0, beats: [] },
    });

    await wrapper.setProps({ isPlaying: true });
    vi.advanceTimersByTime(500);
    await wrapper.vm.$nextTick();
    expect(wrapper.find('.bpm-circle').classes()).toContain('bpm-circle--beating');

    await wrapper.setProps({ isPlaying: false });
    vi.advanceTimersByTime(200);
    await wrapper.vm.$nextTick();
    expect(wrapper.find('.bpm-circle').classes()).not.toContain('bpm-circle--beating');
  });
});

describe('DataConsole', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const props = {
    chromaData: {
      features: new Float32Array([
        0.05, 0.2, 0.9, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.8, 0.1, 0, 0, 0, 0, 0, 0, 0,
      ]),
      nFrames: 2,
      nChroma: 12,
    },
    rmsData: new Float32Array([0.25, 0.75]),
    bandData: {
      low: new Float32Array([0.3, 0.6]),
      high: new Float32Array([0.2, 0.7]),
    },
    currentTime: 0.5,
    duration: 1,
    isPlaying: false,
    sampleRate: 44100,
  };

  it('boots with wasm version text and appends stream telemetry while playing', async () => {
    const wrapper = mount(DataConsole, { props });

    vi.advanceTimersByTime(1000);
    await wrapper.vm.$nextTick();
    expect(wrapper.text()).toContain('LIBSONARE AUDIO ANALYSIS ENGINE');
    expect(wrapper.text()).toContain('[READY] Awaiting audio signal');

    await wrapper.setProps({ isPlaying: true, currentTime: 0.52 });
    expect(wrapper.text()).toContain('[STREAM] Audio playback started');

    vi.advanceTimersByTime(640);
    await wrapper.vm.$nextTick();
    expect(wrapper.text()).toMatch(/LO_BAND|HI_BAND|CHROMA|NOTE_DT|FRM_IDX|RMS_PWR/);

    wrapper.unmount();
  });
});

describe('WaveformVisualizer', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('draws waveform data, positions the playhead and emits seek times', async () => {
    const ctx = installCanvasMocks();
    const wrapper = mount(WaveformVisualizer, {
      props: {
        audioBuffer: makeAudioBuffer([
          new Float32Array([0, 0.5, -1, 0.25, 0.75, 0.1]),
          new Float32Array([0, -0.5, 1, -0.25, 0.25, -0.1]),
        ]),
        beats: new Float32Array([0.5, 1.5]),
        currentTime: 1,
        duration: 2,
      },
    });

    const canvas = wrapper.find('canvas').element as HTMLCanvasElement;
    Object.defineProperty(canvas, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ left: 20, top: 0, width: 200, height: 100, right: 220, bottom: 100 }),
    });

    await wrapper.setProps({ currentTime: 1.5 });
    expect(wrapper.find('.waveform__playhead').attributes('style')).toContain('left: 75%');
    expect(ctx.fillRect).toHaveBeenCalled();

    await wrapper.find('.waveform').trigger('click', { clientX: 120 });
    expect(wrapper.emitted('seek')?.[0]).toEqual([1]);
  });
});
