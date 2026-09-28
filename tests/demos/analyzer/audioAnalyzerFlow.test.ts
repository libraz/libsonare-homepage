import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h } from 'vue';

const analysisMock = vi.hoisted(() => ({
  analyze: vi.fn(),
}));
const playerMock = vi.hoisted(() => ({
  loadAudio: vi.fn(),
  loadAudioFromArrayBuffer: vi.fn(),
  play: vi.fn(),
  pause: vi.fn(),
  resume: vi.fn(),
  stop: vi.fn(),
  seek: vi.fn(),
  setProcessCallback: vi.fn(),
  getAudioContext: vi.fn(),
  state: null as any,
}));
const streamMock = vi.hoisted(() => ({
  init: vi.fn(),
  reinit: vi.fn(),
  process: vi.fn(),
  setExpectedDuration: vi.fn(),
  setNormalizationGain: vi.fn(),
  setTuningRefHz: vi.fn(),
  reset: vi.fn(),
  state: null as any,
}));
const lang = vi.hoisted(() => ({ value: 'en' }));
const analyzerWasmMock = vi.hoisted(() => ({
  rmsEnergy: vi.fn(() => new Float32Array([0.1, 0.2, 0.3])),
  detectBeats: vi.fn(() => new Float32Array([0.5, 1.5, 2.5])),
  estimateTuning: vi.fn(() => 0.13),
  chroma: vi.fn(() => ({
    features: new Float32Array(36).fill(0.25),
    nFrames: 3,
    nChroma: 12,
  })),
  melSpectrogram: vi.fn(() => ({
    power: new Float32Array(128 * 3).fill(0.5),
    nMels: 128,
    nFrames: 3,
  })),
}));

vi.mock('vitepress', () => ({
  useData: () => ({ lang }),
}));

vi.mock('@/wasm/index.js', () => ({
  init: vi.fn(async () => undefined),
  version: vi.fn(() => 'test-wasm'),
  ...analyzerWasmMock,
}));

vi.mock('@/demos/analyzer/useAudioAnalysis', async () => {
  const { ref } = await vi.importActual<typeof import('vue')>('vue');
  return {
    useAudioAnalysis: () => ({
      isAnalyzing: ref(false),
      progress: ref(0),
      progressStage: ref(''),
      result: ref(null),
      error: ref(''),
      analyze: analysisMock.analyze,
    }),
  };
});

vi.mock('@/demos/analyzer/useAudioPlayer', async () => {
  const { ref, shallowRef } = await vi.importActual<typeof import('vue')>('vue');
  const audioBuffer = shallowRef(null);
  const isPlaying = ref(false);
  const isPaused = ref(false);
  const currentTime = ref(0);
  const duration = ref(0);
  playerMock.state = { audioBuffer, isPlaying, isPaused, currentTime, duration };
  return {
    useAudioPlayer: () => ({
      audioBuffer,
      isPlaying,
      isPaused,
      currentTime,
      duration,
      decodeAudio: playerMock.loadAudio,
      decodeAudioFromArrayBuffer: playerMock.loadAudioFromArrayBuffer,
      setAudioBuffer: (buffer: AudioBuffer) => {
        audioBuffer.value = buffer;
        duration.value = buffer.duration;
      },
      resetAudio: () => {
        audioBuffer.value = null;
        duration.value = 0;
        isPlaying.value = false;
        isPaused.value = false;
        currentTime.value = 0;
      },
      play: playerMock.play,
      pause: playerMock.pause,
      resume: playerMock.resume,
      stop: playerMock.stop,
      seek: playerMock.seek,
      formatTime: (seconds: number) => `0:${String(Math.floor(seconds)).padStart(2, '0')}`,
      setProcessCallback: playerMock.setProcessCallback,
      getAudioContext: playerMock.getAudioContext,
    }),
  };
});

vi.mock('@/demos/analyzer/useStreamAnalyzer', async () => {
  const { ref } = await vi.importActual<typeof import('vue')>('vue');
  const estimate = ref({
    bpm: 128,
    bpmConfidence: 0.76,
    key: 'A minor',
    keyConfidence: 0.68,
    chord: 'Am',
    chordConfidence: 0.8,
    currentBar: 2,
    barChordProgression: ['Am', 'F', 'C', 'G'],
    votedPattern: ['Am', 'F', 'C', 'G'],
    detectedPatternName: 'Axis',
    detectedPatternScore: 0.91,
  });
  streamMock.state = {
    isInitialized: ref(true),
    estimate,
    streamingData: ref({}),
  };
  return {
    useStreamAnalyzer: () => ({
      isInitialized: streamMock.state.isInitialized,
      estimate,
      streamingData: streamMock.state.streamingData,
      init: streamMock.init,
      reinit: streamMock.reinit,
      process: streamMock.process,
      setExpectedDuration: streamMock.setExpectedDuration,
      setNormalizationGain: streamMock.setNormalizationGain,
      setTuningRefHz: streamMock.setTuningRefHz,
      reset: streamMock.reset,
    }),
  };
});

vi.mock('@/demos/analyzer/WaveformVisualizer.vue', () => ({
  default: defineComponent({
    props: ['audioBuffer', 'beats', 'currentTime', 'duration'],
    emits: ['seek'],
    setup(props, { emit }) {
      return () =>
        h(
          'button',
          {
            class: 'waveform-stub',
            'data-duration': props.duration,
            'data-beats': props.beats ? Array.from(props.beats).join(',') : '',
            onClick: () => emit('seek', 1.5),
          },
          'Waveform',
        );
    },
  }),
}));

vi.mock('@/demos/analyzer/SynesthesiaVisualizer.vue', () => ({
  default: defineComponent({
    props: ['chromaData', 'rmsData', 'bandData', 'currentTime', 'duration', 'isPlaying'],
    setup(props) {
      return () =>
        h(
          'div',
          {
            class: 'synesthesia-stub',
            'data-playing': String(props.isPlaying),
            'data-has-chroma': String(Boolean(props.chromaData)),
          },
          'Synesthesia',
        );
    },
  }),
}));

vi.mock('@/demos/analyzer/DataConsole.vue', () => ({
  default: defineComponent({
    props: [
      'chromaData',
      'rmsData',
      'bandData',
      'currentTime',
      'duration',
      'isPlaying',
      'sampleRate',
    ],
    setup(props) {
      return () =>
        h(
          'div',
          {
            class: 'data-console-stub',
            'data-sample-rate': props.sampleRate,
            'data-playing': String(props.isPlaying),
          },
          'Console',
        );
    },
  }),
}));

import AudioAnalyzer from '@/demos/analyzer/AudioAnalyzer.vue';

function audioBuffer(): AudioBuffer {
  return {
    length: 8,
    duration: 4,
    sampleRate: 48_000,
    numberOfChannels: 2,
    getChannelData: (channel: number) =>
      channel === 0
        ? new Float32Array([0, 0.5, -1, 0.25, -0.25, 0.1, -0.1, 0])
        : new Float32Array([0, -0.5, 1, -0.25, 0.25, -0.1, 0.1, 0]),
  } as unknown as AudioBuffer;
}

async function drainAsyncWork() {
  for (let i = 0; i < 12; i++) {
    await flushPromises();
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

describe('AudioAnalyzer visual player flow', () => {
  beforeEach(() => {
    playerMock.loadAudio.mockReset();
    playerMock.loadAudioFromArrayBuffer.mockReset();
    playerMock.play.mockReset();
    playerMock.pause.mockReset();
    playerMock.resume.mockReset();
    playerMock.stop.mockReset();
    playerMock.seek.mockReset();
    playerMock.setProcessCallback.mockReset();
    playerMock.getAudioContext.mockReset();
    streamMock.init.mockReset();
    streamMock.reinit.mockReset();
    streamMock.process.mockReset();
    streamMock.setExpectedDuration.mockReset();
    streamMock.setNormalizationGain.mockReset();
    streamMock.setTuningRefHz.mockReset();
    streamMock.reset.mockReset();
    analyzerWasmMock.estimateTuning.mockReset();
    analyzerWasmMock.estimateTuning.mockReturnValue(0.13);
    analyzerWasmMock.rmsEnergy.mockReset();
    analyzerWasmMock.rmsEnergy.mockReturnValue(new Float32Array([0.1, 0.2, 0.3]));
    analyzerWasmMock.detectBeats.mockReset();
    analyzerWasmMock.detectBeats.mockReturnValue(new Float32Array([0.5, 1.5, 2.5]));
    analyzerWasmMock.chroma.mockReset();
    analyzerWasmMock.chroma.mockReturnValue({
      features: new Float32Array(36).fill(0.25),
      nFrames: 3,
      nChroma: 12,
    });
    analyzerWasmMock.melSpectrogram.mockReset();
    analyzerWasmMock.melSpectrogram.mockReturnValue({
      power: new Float32Array(128 * 3).fill(0.5),
      nMels: 128,
      nFrames: 3,
    });

    const buffer = audioBuffer();
    playerMock.state.audioBuffer.value = null;
    playerMock.state.isPlaying.value = false;
    playerMock.state.isPaused.value = false;
    playerMock.state.currentTime.value = 0;
    playerMock.state.duration.value = 0;
    playerMock.loadAudioFromArrayBuffer.mockImplementation(async () => {
      return buffer;
    });
    playerMock.loadAudio.mockImplementation(async () => {
      return buffer;
    });
    playerMock.getAudioContext.mockReturnValue({ sampleRate: 48_000 });
    playerMock.play.mockImplementation(() => {
      playerMock.state.isPlaying.value = true;
      playerMock.state.isPaused.value = false;
    });
    playerMock.pause.mockImplementation(() => {
      playerMock.state.isPlaying.value = false;
      playerMock.state.isPaused.value = true;
    });
    playerMock.resume.mockImplementation(() => {
      playerMock.state.isPlaying.value = true;
      playerMock.state.isPaused.value = false;
    });
    playerMock.stop.mockImplementation(() => {
      playerMock.state.isPlaying.value = false;
      playerMock.state.isPaused.value = false;
      playerMock.state.currentTime.value = 0;
    });
    playerMock.seek.mockImplementation((time: number) => {
      playerMock.state.currentTime.value = time;
    });
    streamMock.init.mockResolvedValue(undefined);
    streamMock.reinit.mockResolvedValue(undefined);
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        arrayBuffer: async () => new ArrayBuffer(16),
      })),
    );
  });

  it('auto-loads the demo and renders streaming estimates with visual data', async () => {
    const wrapper = mount(AudioAnalyzer, { props: { libVersion: 'test-wasm' } });
    await drainAsyncWork();

    expect(fetch).toHaveBeenCalledWith('/demo.mp3');
    expect(streamMock.init).toHaveBeenCalledTimes(1);
    expect(playerMock.loadAudioFromArrayBuffer).toHaveBeenCalledTimes(1);
    expect(streamMock.reinit).toHaveBeenCalledWith(48_000);
    expect(streamMock.setExpectedDuration).toHaveBeenCalledWith(4);
    expect(streamMock.setNormalizationGain).toHaveBeenCalledWith(0.5);
    // The live key and chord readings follow the reference the recording sits at.
    expect(streamMock.setTuningRefHz).toHaveBeenCalledWith(440 * 2 ** (0.13 / 12));
    expect(playerMock.setProcessCallback).toHaveBeenCalledWith(expect.any(Function));
    const processCallback = playerMock.setProcessCallback.mock.calls.find(
      ([callback]) => typeof callback === 'function',
    )?.[0];
    const streamed = new Float32Array([0.1, 0.2]);
    processCallback(streamed, 512);
    expect(streamMock.process).toHaveBeenCalledWith(streamed, 512);

    expect(wrapper.find('.analyzer__main').exists()).toBe(true);
    expect(wrapper.text()).toContain('128');
    expect(wrapper.text()).toContain('A minor');
    expect(wrapper.text()).toContain('Am→F→C→G');
    expect(wrapper.text()).toContain('+13¢');
    expect(wrapper.text()).toContain('Axis');
    expect(wrapper.find('.synesthesia-stub').attributes('data-has-chroma')).toBe('true');
    expect(wrapper.find('.data-console-stub').attributes('data-sample-rate')).toBe('48000');
    // This player shows live estimates; the full-file meter and benchmark live
    // in Music Analysis rather than appearing here as permanent empty readouts.
    const metricLabels = wrapper.findAll('.metric-item__label').map((item) => item.text());
    expect(metricLabels).toContain('LENi');
    expect(metricLabels).not.toContain('TIMEi');
    expect(metricLabels).not.toContain('ANALYSIS');
    expect(analyzerWasmMock.detectBeats).toHaveBeenCalledWith(expect.any(Float32Array), 48_000);
    expect(wrapper.find('.waveform-stub').attributes('data-beats')).toBe('0.5,1.5,2.5');
  });

  it('routes transport buttons and waveform seeks to the audio player', async () => {
    const wrapper = mount(AudioAnalyzer);
    await drainAsyncWork();

    await wrapper.find('button[aria-label="Play"]').trigger('click');
    expect(playerMock.play).toHaveBeenCalledTimes(1);

    await wrapper.find('button[aria-label="Pause"]').trigger('click');
    expect(playerMock.pause).toHaveBeenCalledTimes(1);

    await wrapper.find('button[aria-label="Rewind"]').trigger('click');
    expect(playerMock.seek).toHaveBeenLastCalledWith(0);

    await wrapper.find('.waveform-stub').trigger('click');
    expect(playerMock.seek).toHaveBeenLastCalledWith(1.5);

    await wrapper.find('button[aria-label="Stop"]').trigger('click');
    expect(playerMock.stop).toHaveBeenCalledTimes(1);
  });

  it('resets the loaded file and analyzer state from the FILE control', async () => {
    const wrapper = mount(AudioAnalyzer);
    await drainAsyncWork();

    await wrapper
      .findAll('button')
      .find((button) => button.text().includes('FILE'))!
      .trigger('click');

    expect(playerMock.state.audioBuffer.value).toBeNull();
    expect(streamMock.reset).toHaveBeenCalled();
    expect(playerMock.setProcessCallback).toHaveBeenLastCalledWith(null);
  });

  it('surfaces a decode error and restores the drop zone when an uploaded file fails to decode', async () => {
    // Fail the auto-loaded demo so the drop zone is shown for the manual upload.
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        arrayBuffer: async () => new ArrayBuffer(0),
      })),
    );
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    playerMock.loadAudio.mockReset();
    playerMock.loadAudio.mockRejectedValue(new Error('decode failed'));

    try {
      const wrapper = mount(AudioAnalyzer);
      await drainAsyncWork();

      const dropZone = wrapper.findComponent({ name: 'DropZone' });
      expect(dropZone.exists()).toBe(true);

      const file = new File([new Uint8Array([1, 2, 3])], 'broken.wav', { type: 'audio/wav' });
      dropZone.vm.$emit('file', file);
      await drainAsyncWork();

      // The error is surfaced to the user instead of being silently swallowed.
      const errorEl = wrapper.find('.analyzer__error');
      expect(errorEl.exists()).toBe(true);
      expect(errorEl.text()).toContain('Could not decode');

      // Upload state is rolled back: the loading overlay is gone and the drop
      // zone is shown again so the visitor can retry (and the demo can fall back).
      expect(wrapper.find('.analyzer__loading').exists()).toBe(false);
      expect(wrapper.findComponent({ name: 'DropZone' }).exists()).toBe(true);
      expect(playerMock.state.audioBuffer.value).toBeNull();

      wrapper.unmount();
    } finally {
      consoleError.mockRestore();
    }
  });

  it('rolls back decoded audio when a later visualization stage fails', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const wrapper = mount(AudioAnalyzer);

    try {
      await drainAsyncWork();
      await wrapper
        .findAll('button')
        .find((button) => button.text().includes('FILE'))!
        .trigger('click');
      analyzerWasmMock.melSpectrogram.mockImplementationOnce(() => {
        throw new Error('mel failed');
      });

      wrapper
        .findComponent({ name: 'DropZone' })
        .vm.$emit('file', new File([new Uint8Array([1])], 'broken-late.wav'));
      await drainAsyncWork();

      expect(playerMock.state.audioBuffer.value).toBeNull();
      expect(playerMock.state.duration.value).toBe(0);
      expect(wrapper.findComponent({ name: 'DropZone' }).exists()).toBe(true);
      expect(wrapper.find('.synesthesia-stub').exists()).toBe(false);
      expect(wrapper.text()).toContain('visualization data could not be generated');
    } finally {
      wrapper.unmount();
      consoleError.mockRestore();
    }
  });

  it('keeps the later of two overlapping drops even when the earlier one decodes last', async () => {
    const wrapper = mount(AudioAnalyzer);
    await drainAsyncWork();
    await wrapper
      .findAll('button')
      .find((button) => button.text().includes('FILE'))!
      .trigger('click');

    const slowBuffer = { ...audioBuffer(), duration: 9 } as AudioBuffer;
    const fastBuffer = audioBuffer();
    let finishSlow!: (buffer: AudioBuffer) => void;
    playerMock.loadAudio.mockReset();
    playerMock.loadAudio
      .mockImplementationOnce(
        () =>
          new Promise<AudioBuffer>((resolve) => {
            finishSlow = resolve;
          }),
      )
      .mockImplementationOnce(async () => fastBuffer);

    wrapper
      .findComponent({ name: 'DropZone' })
      .vm.$emit('file', new File([new Uint8Array([1])], 'slow.wav'));
    await drainAsyncWork();
    expect(playerMock.loadAudio).toHaveBeenCalledTimes(1);
    expect(wrapper.find('.analyzer__loading').exists()).toBe(true);

    // A second file arrives while the first is still decoding. The progress
    // overlay has replaced the drop zone, so it is handed to the handler directly.
    void (wrapper.vm as unknown as { handleFile: (file: File) => Promise<void> }).handleFile(
      new File([new Uint8Array([2])], 'fast.wav'),
    );
    await drainAsyncWork();

    expect(playerMock.loadAudio).toHaveBeenCalledTimes(2);
    expect(playerMock.state.audioBuffer.value).toBe(fastBuffer);
    expect(wrapper.find('.analyzer__main').exists()).toBe(true);
    expect(wrapper.text()).toContain('fast.wav');

    // The first drop finishing afterwards must not overwrite the second.
    finishSlow(slowBuffer);
    await drainAsyncWork();

    expect(playerMock.state.audioBuffer.value).toBe(fastBuffer);
    expect(playerMock.state.duration.value).toBe(4);
    expect(wrapper.text()).toContain('fast.wav');
    expect(wrapper.text()).not.toContain('slow.wav');
    expect(wrapper.find('.analyzer__error').exists()).toBe(false);
    expect(wrapper.find('.analyzer__loading').exists()).toBe(false);

    wrapper.unmount();
  });

  it('names the engine as the cause when the stream analyzer cannot initialize', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    streamMock.init.mockRejectedValue(new Error('wasm gone'));

    try {
      const wrapper = mount(AudioAnalyzer);
      await drainAsyncWork();

      // The bundled demo fails the same way, so the drop zone is offered.
      const dropZone = wrapper.findComponent({ name: 'DropZone' });
      expect(dropZone.exists()).toBe(true);

      dropZone.vm.$emit('file', new File([new Uint8Array([1])], 'song.wav'));
      await drainAsyncWork();

      const errorEl = wrapper.find('.analyzer__error');
      expect(errorEl.exists()).toBe(true);
      expect(errorEl.text()).toContain('analysis engine could not be loaded');
      expect(errorEl.text()).not.toContain('decode');
      expect(playerMock.loadAudio).not.toHaveBeenCalled();
      expect(wrapper.findComponent({ name: 'DropZone' }).exists()).toBe(true);

      wrapper.unmount();
    } finally {
      consoleError.mockRestore();
    }
  });

  it('falls back to the drop zone when the bundled demo cannot be fetched', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        arrayBuffer: async () => new ArrayBuffer(0),
      })),
    );
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    try {
      const wrapper = mount(AudioAnalyzer);
      await drainAsyncWork();

      expect(fetch).toHaveBeenCalledWith('/demo.mp3');
      expect(playerMock.loadAudioFromArrayBuffer).not.toHaveBeenCalled();
      expect(wrapper.findComponent({ name: 'DropZone' }).exists()).toBe(true);
      expect(wrapper.find('.analyzer__loading').exists()).toBe(false);

      wrapper.unmount();
    } finally {
      consoleError.mockRestore();
    }
  });
});
