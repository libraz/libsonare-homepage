import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const lang = vi.hoisted(() => ({ value: 'en' }));

vi.mock('vitepress', () => ({
  useData: () => ({ lang }),
}));

vi.mock('@/wasm/index.js', () => ({
  init: vi.fn(async () => undefined),
  version: vi.fn(() => 'test-wasm'),
}));

vi.mock('@/components/MatrixHeatmap.vue', async () => {
  const { defineComponent, h } = await vi.importActual<typeof import('vue')>('vue');
  return {
    default: defineComponent({
      name: 'MatrixHeatmapStub',
      props: {
        rows: Number,
        columns: Number,
        label: String,
      },
      setup(props) {
        return () =>
          h(
            'div',
            {
              class: 'matrix-heatmap-stub',
              'data-label': props.label,
              'data-rows': props.rows,
              'data-columns': props.columns,
            },
            props.label,
          );
      },
    }),
  };
});

import MusicAnalysisStudio from '@/components/MusicAnalysisStudio.vue';

const SAMPLE_RATE = 48_000;

function analysisResult() {
  return {
    version: '9.9.9-test',
    duration: 4,
    sampleRate: SAMPLE_RATE,
    summary: {
      bpm: 123.4,
      bpmConfidence: 0.82,
      keyName: 'D minor',
      keyConfidence: 0.74,
      timeSignature: '4/4',
      integratedLufs: -13.7,
      loudnessRange: 6.2,
      dynamicRangeDb: 9.1,
      crestFactor: 10.4,
      brightness: 0.61,
      warmth: 0.43,
    },
    keyCandidates: [
      { name: 'D minor', confidence: 0.74, correlation: 0.88 },
      { name: 'F major', confidence: 0.52, correlation: 0.71 },
    ],
    sections: [
      { name: 'Intro', start: 0, end: 1, confidence: 0.8, energyLevel: 0.3 },
      { name: 'Drop', start: 1, end: 4, confidence: 0.9, energyLevel: 0.85 },
    ],
    chords: [
      { name: 'Dm', start: 0, end: 1, confidence: 0.8 },
      { name: 'Dm', start: 1, end: 2, confidence: 0.7 },
      { name: 'Bb', start: 2, end: 4, confidence: 0.65 },
    ],
    beats: [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5],
    downbeats: [0, 2],
    melody: {
      pitchRangeOctaves: 1.5,
      pitchStability: 0.78,
      meanFrequency: 220,
      vibratoRate: 5.8,
      points: [
        { time: 0.5, frequency: 220, confidence: 0.9 },
        { time: 1.5, frequency: 330, confidence: 0.7 },
      ],
    },
    heatmaps: {
      chroma: { rows: 12, columns: 3, min: 0, max: 1, values: new Float32Array(36).fill(0.25) },
      mel: { rows: 96, columns: 2, min: -80, max: 0, values: new Float32Array(192).fill(-30) },
      cqt: { rows: 72, columns: 2, min: 0, max: 1, values: new Float32Array(144).fill(0.4) },
    },
    loudness: {
      momentary: [
        { time: 0, value: -20 },
        { time: 4, value: -12 },
      ],
      shortTerm: [
        { time: 0, value: -18 },
        { time: 4, value: -13 },
      ],
    },
  };
}

class MockAudioContext {
  static duration = 4;
  static nextDecodeError: Error | null = null;

  async decodeAudioData(_buffer: ArrayBuffer) {
    if (MockAudioContext.nextDecodeError) throw MockAudioContext.nextDecodeError;
    return {
      length: 8,
      duration: MockAudioContext.duration,
      sampleRate: SAMPLE_RATE,
      numberOfChannels: 2,
      getChannelData: (channel: number) =>
        channel === 0
          ? new Float32Array([0, 0.25, -0.5, 0.75, -1, 0.5, -0.25, 0])
          : new Float32Array([0, -0.25, 0.5, -0.75, 1, -0.5, 0.25, 0]),
    };
  }

  close = vi.fn(async () => {});
}

class MockFile {
  name: string;
  type: string;
  private parts: unknown[];

  constructor(parts: unknown[], name: string, options: { type?: string } = {}) {
    this.parts = parts;
    this.name = name;
    this.type = options.type || '';
  }

  async arrayBuffer() {
    const first = this.parts[0];
    if (first instanceof ArrayBuffer) return first;
    if (ArrayBuffer.isView(first)) return first.buffer.slice(0);
    return new ArrayBuffer(8);
  }
}

type WorkerListener = (event: MessageEvent) => void;

class MockWorker {
  static messages: any[] = [];
  static mode: 'done' | 'error' | 'defer' = 'done';
  static terminated = 0;
  static instances: MockWorker[] = [];

  private messageListeners = new Set<WorkerListener>();
  private errorListeners = new Set<(event: ErrorEvent) => void>();

  constructor() {
    MockWorker.instances.push(this);
  }

  addEventListener(
    type: 'message' | 'error',
    listener: WorkerListener | ((event: ErrorEvent) => void),
  ) {
    if (type === 'message') this.messageListeners.add(listener as WorkerListener);
    else this.errorListeners.add(listener as (event: ErrorEvent) => void);
  }

  removeEventListener(
    type: 'message' | 'error',
    listener: WorkerListener | ((event: ErrorEvent) => void),
  ) {
    if (type === 'message') this.messageListeners.delete(listener as WorkerListener);
    else this.errorListeners.delete(listener as (event: ErrorEvent) => void);
  }

  postMessage(message: any) {
    MockWorker.messages.push(message);
    this.emit({ type: 'progress', id: message.id, progress: 0.42, stage: 'Computing chroma' });
    if (MockWorker.mode === 'error') {
      this.emit({ type: 'error', id: message.id, error: 'analysis failed', recoverable: true });
      return;
    }
    if (MockWorker.mode === 'defer') return;
    this.emit({ type: 'done', id: message.id, result: analysisResult() });
  }

  terminate() {
    MockWorker.terminated++;
  }

  emit(data: unknown) {
    const event = { data } as MessageEvent;
    for (const listener of this.messageListeners) listener(event);
  }
}

describe('MusicAnalysisStudio', () => {
  beforeEach(() => {
    lang.value = 'en';
    MockAudioContext.duration = 4;
    MockAudioContext.nextDecodeError = null;
    MockWorker.messages = [];
    MockWorker.mode = 'done';
    MockWorker.terminated = 0;
    MockWorker.instances = [];
    // @ts-expect-error test AudioContext mock implements decodeAudioData only
    globalThis.AudioContext = MockAudioContext;
    // @ts-expect-error test File mock implements the browser method decodeAudioFile needs
    globalThis.File = MockFile;
    // @ts-expect-error test Worker mock implements the event API used here
    globalThis.Worker = MockWorker;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        blob: async () => new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'audio/mpeg' }),
      })),
    );
  });

  it('loads demo audio, analyzes it in a worker and renders the report views', async () => {
    const wrapper = mount(MusicAnalysisStudio);

    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Load demo')!
      .trigger('click');
    await flushPromises();

    expect(fetch).toHaveBeenCalledWith('/demo.mp3');
    expect(MockWorker.messages).toHaveLength(1);
    expect(MockWorker.messages[0]).toMatchObject({
      type: 'analyze',
      sampleRate: SAMPLE_RATE,
    });
    expect(MockWorker.messages[0].sourceLeft).toBeInstanceOf(Float32Array);
    expect(MockWorker.messages[0].sourceRight).toBeInstanceOf(Float32Array);
    expect(wrapper.text()).toContain('demo.mp3');
    expect(wrapper.text()).toContain('123.4');
    expect(wrapper.text()).toContain('D minor');
    expect(wrapper.text()).toContain('-13.7');
    expect(wrapper.find('.matrix-heatmap-stub').attributes('data-label')).toBe('Chroma');
    expect(wrapper.find('.tool-page__version').text()).toContain('9.9.9-test');

    await wrapper
      .findAll('.heatmap-tabs__button')
      .find((button) => button.text() === 'Mel')!
      .trigger('click');
    expect(wrapper.find('.matrix-heatmap-stub').attributes('data-label')).toBe('Mel');

    await wrapper
      .findAll('.heatmap-tabs__button')
      .find((button) => button.text() === 'CQT')!
      .trigger('click');
    expect(wrapper.find('.matrix-heatmap-stub').attributes('data-label')).toBe('CQT');

    wrapper.unmount();
    expect(MockWorker.terminated).toBe(1);
  });

  it('localizes known section labels in Japanese', async () => {
    lang.value = 'ja';
    const wrapper = mount(MusicAnalysisStudio);

    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'デモを読み込む')!
      .trigger('click');
    await flushPromises();

    expect(wrapper.text()).toContain('イントロ');
    expect(wrapper.text()).toContain('Drop');

    wrapper.unmount();
  });

  it('exports the current analysis report as JSON', async () => {
    const createObjectUrl = vi.mocked(URL.createObjectURL);
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);
    const wrapper = mount(MusicAnalysisStudio);

    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Load demo')!
      .trigger('click');
    await flushPromises();
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Export JSON report')!
      .trigger('click');

    expect(createObjectUrl).toHaveBeenCalledWith(expect.any(Blob));
    expect(click).toHaveBeenCalled();

    click.mockRestore();
    wrapper.unmount();
  });

  it('releases the previous JSON report URL when exporting again', async () => {
    const createObjectUrl = vi.mocked(URL.createObjectURL);
    createObjectUrl.mockReturnValueOnce('blob:first').mockReturnValueOnce('blob:second');
    const revoke = vi.mocked(URL.revokeObjectURL);
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);
    const wrapper = mount(MusicAnalysisStudio);

    try {
      await wrapper
        .findAll('button')
        .find((button) => button.text() === 'Load demo')!
        .trigger('click');
      await flushPromises();
      const exportButton = wrapper
        .findAll('button')
        .find((button) => button.text() === 'Export JSON report')!;
      // Loading the source also mints a playback object URL, so reset (not just
      // clear) to drain any queued once-values before scripting the export pair.
      createObjectUrl.mockReset();
      createObjectUrl.mockReturnValueOnce('blob:first').mockReturnValueOnce('blob:second');

      await exportButton.trigger('click');
      await exportButton.trigger('click');

      expect(createObjectUrl).toHaveBeenCalledTimes(2);
      expect(revoke).toHaveBeenCalledWith('blob:first');
      expect(click).toHaveBeenCalledTimes(2);
    } finally {
      click.mockRestore();
      wrapper.unmount();
    }
  });

  it('shows warnings for long files and resets file input values after loading', async () => {
    MockAudioContext.duration = 10 * 60 + 1;
    const wrapper = mount(MusicAnalysisStudio);
    const input = wrapper.find('input[type="file"]');
    const file = new MockFile([new Uint8Array([1])], 'long.wav', { type: 'audio/wav' });
    Object.defineProperty(input.element, 'files', { configurable: true, value: [file] });

    await input.trigger('change');
    await flushPromises();

    expect(wrapper.text()).toContain(
      'Large files can take time on this device. The analysis still runs locally.',
    );
    expect(wrapper.text()).toContain('long.wav');
    expect((input.element as HTMLInputElement).value).toBe('');
    expect(MockWorker.messages).toHaveLength(1);

    wrapper.unmount();
  });

  it('reports decode and demo fetch failures without leaving loading state active', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const wrapper = mount(MusicAnalysisStudio);

    try {
      MockAudioContext.nextDecodeError = new Error('decode failed');
      await wrapper.find('.analysis-studio').trigger('drop', {
        dataTransfer: { files: [new MockFile([new Uint8Array([1])], 'broken.wav')] },
      });
      await flushPromises();
      expect(wrapper.text()).toContain('Failed to decode this audio file.');
      expect(wrapper.text()).not.toContain('Analyzing...');
      expect(MockWorker.messages).toHaveLength(0);

      MockAudioContext.nextDecodeError = null;
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => {
          throw new Error('network failed');
        }),
      );
      await wrapper
        .findAll('button')
        .find((button) => button.text() === 'Load demo')!
        .trigger('click');
      await flushPromises();
      expect(wrapper.text()).toContain('Failed to load demo audio.');
    } finally {
      consoleError.mockRestore();
      wrapper.unmount();
    }
  });

  it('shows recoverable analysis failures and allows rerunning the loaded source', async () => {
    MockWorker.mode = 'error';
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const wrapper = mount(MusicAnalysisStudio);

    try {
      await wrapper
        .findAll('button')
        .find((button) => button.text() === 'Load demo')!
        .trigger('click');
      await flushPromises();
      expect(wrapper.text()).toContain('Analysis failed. Try a shorter file or reload the page.');
      expect(wrapper.text()).toContain('demo.mp3');

      MockWorker.mode = 'done';
      await wrapper
        .findAll('button')
        .find((button) => button.text() === 'Run again')!
        .trigger('click');
      await flushPromises();

      expect(MockWorker.messages).toHaveLength(2);
      expect(wrapper.text()).toContain('123.4');
      expect(wrapper.text()).not.toContain(
        'Analysis failed. Try a shorter file or reload the page.',
      );
    } finally {
      wrapper.unmount();
      consoleError.mockRestore();
    }
  });

  it('keeps only the latest dropped file result and terminates superseded analysis', async () => {
    MockWorker.mode = 'defer';
    const wrapper = mount(MusicAnalysisStudio);
    const first = new MockFile([new Uint8Array([1])], 'first.wav', { type: 'audio/wav' });
    const second = new MockFile([new Uint8Array([2])], 'second.wav', { type: 'audio/wav' });

    void wrapper.find('.analysis-studio').trigger('drop', { dataTransfer: { files: [first] } });
    await flushPromises();
    expect(MockWorker.instances).toHaveLength(1);

    void wrapper.find('.analysis-studio').trigger('drop', { dataTransfer: { files: [second] } });
    await flushPromises();
    expect(MockWorker.instances).toHaveLength(2);
    expect(MockWorker.terminated).toBe(1);

    const firstId = MockWorker.messages[0].id;
    const secondId = MockWorker.messages[1].id;
    MockWorker.instances[0].emit({ type: 'done', id: firstId, result: analysisResult() });
    MockWorker.instances[1].emit({ type: 'done', id: secondId, result: analysisResult() });
    await flushPromises();

    expect(wrapper.text()).toContain('second.wav');
    expect(wrapper.text()).not.toContain('first.wav');
    wrapper.unmount();
  });
});
