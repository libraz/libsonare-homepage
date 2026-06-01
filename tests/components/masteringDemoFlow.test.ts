import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h, nextTick } from 'vue';

const lang = vi.hoisted(() => ({ value: 'en' }));
const masteringMock = vi.hoisted(() => ({
  state: null as any,
  loadFile: vi.fn(),
  decodeFile: vi.fn(),
  render: vi.fn(),
  renderReferenceMatch: vi.fn(),
  createSourceAudioUrl: vi.fn(),
  createAudioUrl: vi.fn(),
  dispose: vi.fn(),
}));
const insightMock = vi.hoisted(() => ({
  analyzeSourceInsights: vi.fn(),
  resetInsights: vi.fn(),
  report: null as any,
  preview: null as any,
}));
const resultPanelMock = vi.hoisted(() => ({
  setVolume: vi.fn(),
  togglePlayback: vi.fn(),
}));

vi.mock('vitepress', () => ({
  useData: () => ({ lang }),
}));

vi.mock('@/wasm/index.js', () => ({
  init: vi.fn(async () => undefined),
  version: vi.fn(() => 'test-wasm'),
}));

vi.mock('@/composables/useMastering', async () => {
  const actual = await vi.importActual<typeof import('@/composables/useMastering')>(
    '@/composables/useMastering',
  );
  const { ref, shallowRef } = await vi.importActual<typeof import('vue')>('vue');
  const source = shallowRef(null);
  const rendered = shallowRef(null);
  const isRendering = ref(false);
  const renderProgress = ref(0);
  const renderStage = ref('');
  const error = ref<string | null>(null);
  masteringMock.state = { source, rendered, isRendering, renderProgress, renderStage, error };
  return {
    ...actual,
    useMastering: () => ({
      isInitialized: ref(true),
      isLoading: ref(false),
      isRendering,
      renderProgress,
      renderStage,
      error,
      source,
      rendered,
      initWasm: vi.fn(async () => undefined),
      decodeFile: masteringMock.decodeFile,
      loadFile: masteringMock.loadFile,
      render: masteringMock.render,
      renderReferenceMatch: masteringMock.renderReferenceMatch,
      createSourceAudioUrl: masteringMock.createSourceAudioUrl,
      createAudioUrl: masteringMock.createAudioUrl,
      dispose: masteringMock.dispose,
    }),
  };
});

vi.mock('@/composables/useMasteringInsights', async () => {
  const { computed, ref } = await vi.importActual<typeof import('vue')>('vue');
  const report = ref(null);
  const preview = ref<any[]>([]);
  insightMock.report = report;
  insightMock.preview = preview;
  return {
    useMasteringInsights: () => ({
      insightReport: report,
      isAnalyzingInsights: ref(false),
      insightProfileItems: computed(() => []),
      insightSuggestions: computed(() => []),
      insightPreview: computed(() => preview.value),
      analyzeSourceInsights: insightMock.analyzeSourceInsights,
      resetInsights: insightMock.resetInsights,
    }),
  };
});

vi.mock('@/components/MasteringPresetGrid.vue', () => ({
  default: defineComponent({
    props: { modelValue: String },
    emits: ['update:modelValue'],
    setup(_props, { emit }) {
      return () =>
        h(
          'button',
          {
            class: 'preset-edm',
            onClick: () => emit('update:modelValue', 'edm'),
          },
          'Preset EDM',
        );
    },
  }),
}));

vi.mock('@/components/MasteringVenueSelector.vue', () => ({
  default: defineComponent({
    props: { modelValue: String },
    emits: ['update:modelValue'],
    setup(_props, { emit }) {
      return () =>
        h(
          'button',
          {
            class: 'venue-livehouse-small',
            onClick: () => emit('update:modelValue', 'livehouseSmall'),
          },
          'Venue small',
        );
    },
  }),
}));

vi.mock('@/components/MasteringPlatformSelector.vue', () => ({
  default: defineComponent({
    props: { modelValue: String, customLufs: Number },
    emits: ['update:modelValue', 'update:customLufs'],
    setup(_props, { emit }) {
      return () =>
        h('div', { class: 'platform-selector-stub' }, [
          h(
            'button',
            {
              class: 'platform-custom',
              onClick: () => {
                emit('update:modelValue', 'custom');
                emit('update:customLufs', -16);
              },
            },
            'Custom -16',
          ),
        ]);
    },
  }),
}));

vi.mock('@/components/MasteringFineTune.vue', () => ({
  default: defineComponent({
    emits: ['update:tone', 'update:width', 'update:dynamics', 'update:show', 'update:ceilingDb'],
    setup(_props, { emit }) {
      return () =>
        h(
          'button',
          {
            class: 'fine-tune-stub',
            onClick: () => {
              emit('update:show', true);
              emit('update:tone', 70);
              emit('update:width', 40);
              emit('update:dynamics', 65);
              emit('update:ceilingDb', -1.5);
            },
          },
          'Fine tune',
        );
    },
  }),
}));

vi.mock('@/components/MasteringReferencePanel.vue', () => ({
  default: defineComponent({
    props: { canMatch: Boolean, reference: Object },
    emits: ['file', 'match'],
    setup(props, { emit }) {
      return () =>
        h('div', { class: 'reference-panel-stub' }, [
          h(
            'button',
            {
              class: 'reference-load',
              onClick: () =>
                emit('file', {
                  target: {
                    files: [{ name: 'reference.wav', arrayBuffer: async () => new ArrayBuffer(8) }],
                    value: 'reference.wav',
                  },
                }),
            },
            'Load reference',
          ),
          h(
            'button',
            {
              class: 'reference-match',
              disabled: !props.canMatch,
              onClick: () => emit('match'),
            },
            props.reference ? 'Match reference' : 'No reference',
          ),
        ]);
    },
  }),
}));

vi.mock('@/components/MasteringResultPanel.vue', () => ({
  default: defineComponent({
    props: {
      playbackUrl: String,
      sourceUrl: String,
      outputUrl: String,
      reportUrl: String,
      error: String,
      renderResultStages: String,
    },
    emits: ['update:listenTarget', 'update:loudnessMatched'],
    setup(props, { expose, emit }) {
      expose({
        setVolume: resultPanelMock.setVolume,
        togglePlayback: resultPanelMock.togglePlayback,
      });
      return () =>
        h(
          'div',
          {
            class: 'result-panel-stub',
            'data-playback-url': props.playbackUrl,
            'data-source-url': props.sourceUrl,
            'data-output-url': props.outputUrl,
            'data-report-url': props.reportUrl,
            'data-error': props.error,
            'data-stages': props.renderResultStages,
          },
          [
            h(
              'button',
              { class: 'listen-source', onClick: () => emit('update:listenTarget', 'source') },
              'Source',
            ),
            h(
              'button',
              { class: 'listen-master', onClick: () => emit('update:listenTarget', 'master') },
              'Master',
            ),
          ],
        );
    },
  }),
}));

vi.mock('@/components/MasteringInsights.vue', () => ({
  default: defineComponent({
    emits: ['apply', 'refresh'],
    setup(_props, { emit }) {
      return () =>
        h('div', { class: 'insights-stub' }, [
          h('button', { class: 'insights-apply', onClick: () => emit('apply') }, 'Apply insights'),
          h(
            'button',
            { class: 'insights-refresh', onClick: () => emit('refresh') },
            'Refresh insights',
          ),
        ]);
    },
  }),
}));

vi.mock('@/components/MasteringChainPanel.vue', () => ({
  default: defineComponent({
    emits: ['save', 'load', 'export', 'import', 'update:activeModule'],
    setup() {
      return () => h('div', { class: 'chain-panel-stub' }, 'Chain');
    },
  }),
}));

vi.mock('@/components/MasteringModuleEditor.vue', () => ({
  default: defineComponent({
    emits: ['update:moduleSetting', 'update:selectedPlatform', 'update:customLufs', 'reset'],
    setup() {
      return () => h('div', { class: 'module-editor-stub' }, 'Module');
    },
  }),
}));

vi.mock('@/components/MasteringMetersPanel.vue', () => ({
  default: defineComponent({
    setup() {
      return () => h('div', { class: 'meters-panel-stub' }, 'Meters');
    },
  }),
}));

import MasteringDemo from '@/components/MasteringDemo.vue';

enableAutoUnmount(afterEach);

function decodedAudio(fileName = 'source.wav') {
  return {
    fileName,
    sampleRate: 48_000,
    duration: 2,
    channels: 2,
    left: new Float32Array([0.4, -0.4, 0.2, -0.2]),
    right: new Float32Array([0.3, -0.3, 0.1, -0.1]),
  };
}

function renderedAudio(stages = ['eq.tilt', 'maximizer.truePeakLimiter']) {
  return {
    left: new Float32Array([0.2, -0.2, 0.1, -0.1]),
    right: new Float32Array([0.2, -0.2, 0.1, -0.1]),
    sampleRate: 48_000,
    inputLufs: -18,
    outputLufs: -14,
    appliedGainDb: 4,
    stages,
    latencySamples: 16,
  };
}

async function loadSource(wrapper: ReturnType<typeof mount>) {
  const input = wrapper.find('input[type="file"]');
  Object.defineProperty(input.element, 'files', {
    configurable: true,
    value: [{ name: 'source.wav', arrayBuffer: async () => new ArrayBuffer(8) }],
  });
  await input.trigger('change');
  await flushPromises();
}

describe('MasteringDemo flow', () => {
  beforeEach(() => {
    lang.value = 'en';
    sessionStorage.clear();
    localStorage.clear();
    masteringMock.loadFile.mockReset();
    masteringMock.decodeFile.mockReset();
    masteringMock.render.mockReset();
    masteringMock.renderReferenceMatch.mockReset();
    masteringMock.createSourceAudioUrl.mockReset();
    masteringMock.createAudioUrl.mockReset();
    masteringMock.dispose.mockReset();
    insightMock.analyzeSourceInsights.mockReset();
    insightMock.resetInsights.mockReset();
    insightMock.report.value = null;
    insightMock.preview.value = [];
    resultPanelMock.setVolume.mockReset();
    resultPanelMock.togglePlayback.mockReset();
    masteringMock.state.source.value = null;
    masteringMock.state.rendered.value = null;
    masteringMock.state.isRendering.value = false;
    masteringMock.state.renderProgress.value = 0;
    masteringMock.state.renderStage.value = '';
    masteringMock.state.error.value = null;

    masteringMock.loadFile.mockImplementation(async (file: File) => {
      const audio = decodedAudio(file.name);
      masteringMock.state.source.value = audio;
      return audio;
    });
    masteringMock.decodeFile.mockImplementation(async (file: File) => decodedAudio(file.name));
    masteringMock.render.mockImplementation(async () => {
      const rendered = renderedAudio();
      masteringMock.state.rendered.value = rendered;
      return rendered;
    });
    masteringMock.renderReferenceMatch.mockImplementation(async () => {
      const rendered = renderedAudio(['match.applyMatchEq', 'maximizer.truePeakLimiter']);
      masteringMock.state.rendered.value = rendered;
      return rendered;
    });
    masteringMock.createSourceAudioUrl.mockImplementation(
      (audio: { fileName: string }) => `blob:${audio.fileName}`,
    );
    masteringMock.createAudioUrl.mockReturnValue('blob:master.wav');
  });

  it('loads a source, runs quick mastering with selected settings and updates result URLs', async () => {
    const wrapper = mount(MasteringDemo);

    await loadSource(wrapper);
    expect(masteringMock.loadFile).toHaveBeenCalledTimes(1);
    expect(insightMock.resetInsights).toHaveBeenCalledTimes(1);
    expect(insightMock.analyzeSourceInsights).toHaveBeenCalledTimes(1);
    expect(wrapper.text()).toContain('source.wav');
    expect(wrapper.find('.result-panel-stub').attributes('data-playback-url')).toBe(
      'blob:source.wav',
    );

    await wrapper.find('.preset-edm').trigger('click');
    await wrapper.find('.venue-livehouse-small').trigger('click');
    await wrapper.find('.platform-custom').trigger('click');
    await wrapper.find('.fine-tune-stub').trigger('click');
    await wrapper.find('.master-action').trigger('click');
    await flushPromises();

    expect(masteringMock.render).toHaveBeenCalledWith(
      expect.objectContaining({
        preset: 'edm',
        venue: 'livehouseSmall',
        targetLufs: -16,
        tuning: { tone: 70, width: 40, dynamics: 65 },
        moduleSettings: expect.objectContaining({ limiterCeilingDb: -1.5 }),
      }),
    );
    expect(masteringMock.createAudioUrl).toHaveBeenCalledWith(masteringMock.state.rendered.value);
    expect(wrapper.find('.result-panel-stub').attributes('data-output-url')).toBe(
      'blob:master.wav',
    );
    expect(wrapper.find('.result-panel-stub').attributes('data-playback-url')).toBe(
      'blob:master.wav',
    );
    expect(wrapper.find('.result-panel-stub').attributes('data-report-url')).toBe('blob:test');

    wrapper.unmount();
    expect(masteringMock.dispose).toHaveBeenCalledTimes(1);
  });

  it('applies source assistant suggestions to quick mastering settings', async () => {
    const wrapper = mount(MasteringDemo);

    await loadSource(wrapper);
    insightMock.report.value = {
      suggestions: {
        chainConfig: {
          params: {
            'eq.tilt.tiltDb': -1.2,
            'dynamics.compressor.thresholdDb': -20,
            'dynamics.compressor.ratio': 2.8,
            'maximizer.truePeakLimiter.ceilingDb': -0.5,
            'loudness.targetLufs': -16,
          },
        },
        genreCandidates: [{ name: 'hipHop' }],
      },
    };
    insightMock.preview.value = [
      {
        name: 'YouTube',
        normalizationGainDb: 1.2,
        ceilingRisk: true,
        safeCeilingDb: -2.2,
        currentCeilingDb: -1,
      },
    ];
    await nextTick();

    await wrapper.find('.insights-apply').trigger('click');
    await wrapper.find('.master-action').trigger('click');
    await flushPromises();

    expect(masteringMock.render).toHaveBeenCalledWith(
      expect.objectContaining({
        preset: 'hiphop',
        targetLufs: -16,
        moduleSettings: expect.objectContaining({
          tiltDb: -1.2,
          compressorThresholdDb: -20,
          compressorRatio: 2.8,
          limiterCeilingDb: -2.2,
        }),
      }),
    );
  });

  it('caps the render target when source analysis indicates over-limiting risk', async () => {
    const wrapper = mount(MasteringDemo);

    await loadSource(wrapper);
    insightMock.report.value = {
      profile: {
        loudness: {
          integratedLufs: -25,
          truePeakDb: -3,
          crestFactorDb: 10,
        },
      },
    };
    await nextTick();

    await wrapper.find('.master-action').trigger('click');
    await flushPromises();

    expect(masteringMock.render).toHaveBeenCalledWith(
      expect.objectContaining({
        targetLufs: -17,
      }),
    );
  });

  it('switches to studio mode, loads a reference and renders reference matching', async () => {
    const wrapper = mount(MasteringDemo);

    await loadSource(wrapper);
    await wrapper
      .findAll('.tool-mode-tabs__button')
      .find((button) => button.text().includes('Studio'))!
      .trigger('click');
    await nextTick();
    expect(wrapper.find('.chain-panel-stub').exists()).toBe(true);
    expect(wrapper.find('.module-editor-stub').exists()).toBe(true);

    await wrapper.find('.reference-load').trigger('click');
    await flushPromises();
    expect(masteringMock.decodeFile).toHaveBeenCalledTimes(1);
    expect(wrapper.find('.reference-match').attributes('disabled')).toBeUndefined();

    await wrapper.find('.reference-match').trigger('click');
    await flushPromises();

    expect(masteringMock.renderReferenceMatch).toHaveBeenCalledWith(
      expect.objectContaining({
        fileName: 'reference.wav',
      }),
      expect.objectContaining({
        targetLufs: -14,
        ceilingDb: expect.any(Number),
        lookaheadMs: expect.any(Number),
      }),
    );
    expect(wrapper.find('.result-panel-stub').attributes('data-stages')).toContain('Match');
    expect(wrapper.find('.result-panel-stub').attributes('data-output-url')).toBe(
      'blob:master.wav',
    );
  });

  it('surfaces render failures from the parent result panel', async () => {
    masteringMock.render.mockRejectedValueOnce(new Error('render failed'));
    const wrapper = mount(MasteringDemo);

    await loadSource(wrapper);
    await wrapper.find('.master-action').trigger('click');
    await flushPromises();

    expect(wrapper.find('.result-panel-stub').attributes('data-error')).toBe(
      'Mastering failed. Try a shorter file or a lighter preset.',
    );
  });

  it('reports source and demo load failures without leaving stale URLs', async () => {
    masteringMock.loadFile.mockRejectedValueOnce(new Error('decode failed'));
    const originalFetch = globalThis.fetch;
    const wrapper = mount(MasteringDemo);

    try {
      await loadSource(wrapper);
      expect(insightMock.resetInsights).toHaveBeenCalledTimes(1);
      expect(wrapper.find('.result-panel-stub').attributes('data-error')).toContain(
        'Could not load this audio file',
      );
      expect(wrapper.find('.result-panel-stub').attributes('data-source-url')).toBeUndefined();

      globalThis.fetch = vi.fn(async () => {
        throw new Error('network failed');
      }) as any;
      await wrapper
        .findAll('button')
        .find((button) => button.text().includes('Load demo'))!
        .trigger('click');
      await flushPromises();
      expect(wrapper.find('.result-panel-stub').attributes('data-error')).toContain(
        'Could not load this audio file',
      );
    } finally {
      globalThis.fetch = originalFetch;
      wrapper.unmount();
    }
  });

  it('releases previous source, output, report and reference URLs when replacing the source', async () => {
    const revoke = vi.mocked(URL.revokeObjectURL);
    revoke.mockClear();
    const wrapper = mount(MasteringDemo);

    await loadSource(wrapper);
    await wrapper.find('.master-action').trigger('click');
    await flushPromises();

    await wrapper.find('.reference-load').trigger('click');
    await flushPromises();
    expect(wrapper.find('.result-panel-stub').attributes('data-source-url')).toBe(
      'blob:source.wav',
    );
    expect(wrapper.find('.result-panel-stub').attributes('data-output-url')).toBe(
      'blob:master.wav',
    );

    const input = wrapper.find('input[type="file"]');
    Object.defineProperty(input.element, 'files', {
      configurable: true,
      value: [{ name: 'replacement.wav', arrayBuffer: async () => new ArrayBuffer(8) }],
    });
    await input.trigger('change');
    await flushPromises();

    expect(revoke).toHaveBeenCalledWith('blob:source.wav');
    expect(revoke).toHaveBeenCalledWith('blob:master.wav');
    expect(revoke).toHaveBeenCalledWith('blob:test');
    expect(revoke).toHaveBeenCalledWith('blob:reference.wav');
    expect(wrapper.find('.result-panel-stub').attributes('data-source-url')).toBe(
      'blob:replacement.wav',
    );
    expect(wrapper.find('.result-panel-stub').attributes('data-output-url')).toBeUndefined();

    wrapper.unmount();
  });

  it('handles A/B keyboard shortcuts and ignores typing targets', async () => {
    const wrapper = mount(MasteringDemo);

    await loadSource(wrapper);
    await wrapper.find('.master-action').trigger('click');
    await flushPromises();

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    await nextTick();
    expect(wrapper.find('.result-panel-stub').attributes('data-playback-url')).toBe(
      'blob:source.wav',
    );

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'b' }));
    await nextTick();
    expect(wrapper.find('.result-panel-stub').attributes('data-playback-url')).toBe(
      'blob:master.wav',
    );

    resultPanelMock.togglePlayback.mockClear();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
    expect(resultPanelMock.togglePlayback).toHaveBeenCalledTimes(1);

    const input = wrapper.find('input[type="file"]').element;
    input.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    expect(resultPanelMock.togglePlayback).toHaveBeenCalledTimes(1);

    wrapper.unmount();
  });
});
