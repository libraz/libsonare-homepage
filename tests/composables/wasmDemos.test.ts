import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { mount } from '@vue/test-utils';
import { beforeAll, describe, expect, it } from 'vitest';
import { defineComponent } from 'vue';
import { useAudioAnalysis } from '@/composables/useAudioAnalysis';
import { defaultModuleSettings, useMastering } from '@/composables/useMastering';
import { useStreamAnalyzer } from '@/composables/useStreamAnalyzer';
import * as wasm from '@/wasm/index.js';

const SAMPLE_RATE = 22_050;

interface FakeAudioBuffer {
  length: number;
  sampleRate: number;
  numberOfChannels: number;
  getChannelData: (channel: number) => Float32Array;
}

function sine(frequency = 440, durationSeconds = 1, sampleRate = SAMPLE_RATE) {
  const samples = new Float32Array(Math.floor(durationSeconds * sampleRate));
  for (let i = 0; i < samples.length; i++) {
    samples[i] = 0.3 * Math.sin((2 * Math.PI * frequency * i) / sampleRate);
  }
  return samples;
}

function pulseTrain(bpm = 120, durationSeconds = 2, sampleRate = SAMPLE_RATE) {
  const samples = new Float32Array(Math.floor(durationSeconds * sampleRate));
  const period = Math.round((60 / bpm) * sampleRate);
  for (let i = 0; i < samples.length; i += period) {
    samples[i] = 1;
    if (i + 1 < samples.length) samples[i + 1] = 0.5;
  }
  return samples;
}

function audioBuffer(channels: Float32Array[], sampleRate = SAMPLE_RATE): AudioBuffer {
  return {
    length: channels[0]?.length ?? 0,
    duration: (channels[0]?.length ?? 0) / sampleRate,
    sampleRate,
    numberOfChannels: channels.length,
    getChannelData: (channel: number) => channels[channel],
  } as FakeAudioBuffer as AudioBuffer;
}

class MockAudioContext {
  sampleRate = SAMPLE_RATE;

  // Tests that need a realistic-length decode (e.g. the mastering assistant,
  // which rejects sub-window clips) set this; everything else uses the compact
  // 4-sample default that keeps decode/gain assertions exact.
  static override: Float32Array[] | null = null;

  async decodeAudioData(_buffer: ArrayBuffer) {
    return audioBuffer(
      MockAudioContext.override ?? [
        new Float32Array([0.25, -0.25, 0.5, -0.5]),
        new Float32Array([0.125, -0.125, 0.25, -0.25]),
      ],
    );
  }
}

type WorkerListener = (event: MessageEvent) => void;

class MockWorker {
  static messages: any[] = [];
  static terminated = 0;

  private messageListeners = new Set<WorkerListener>();
  private errorListeners = new Set<(event: ErrorEvent) => void>();

  addEventListener(
    type: 'message' | 'error',
    listener: WorkerListener | ((event: ErrorEvent) => void),
  ) {
    if (type === 'message') {
      this.messageListeners.add(listener as WorkerListener);
    } else {
      this.errorListeners.add(listener as (event: ErrorEvent) => void);
    }
  }

  removeEventListener(
    type: 'message' | 'error',
    listener: WorkerListener | ((event: ErrorEvent) => void),
  ) {
    if (type === 'message') {
      this.messageListeners.delete(listener as WorkerListener);
    } else {
      this.errorListeners.delete(listener as (event: ErrorEvent) => void);
    }
  }

  postMessage(message: any) {
    MockWorker.messages.push(message);
    this.emit({
      type: 'progress',
      id: message.id,
      progress: 0.5,
      stage:
        message.type === 'referenceMatch' ? 'match.applyMatchEq left' : 'Running mastering chain',
    });
    this.emit({
      type: 'done',
      id: message.id,
      result: {
        left: new Float32Array(message.left),
        right: new Float32Array(message.right),
        sampleRate: message.sampleRate,
        inputLufs: -18,
        outputLufs: -14,
        appliedGainDb: 4,
        stages:
          message.type === 'referenceMatch'
            ? ['match.applyMatchEq.left', 'match.applyMatchEq.right']
            : ['eq.tilt', 'maximizer.truePeakLimiter'],
        latencySamples: 16,
      },
    });
  }

  terminate() {
    MockWorker.terminated++;
  }

  private emit(data: unknown) {
    const event = { data } as MessageEvent;
    for (const listener of this.messageListeners) listener(event);
  }
}

describe('wasm-backed demo composables', () => {
  beforeAll(async () => {
    await wasm.init({ wasmBinary: readFileSync(join(process.cwd(), 'src/wasm/sonare.wasm')) });
    // @ts-expect-error test AudioContext mock only implements decodeAudioData
    globalThis.AudioContext = MockAudioContext;
    // @ts-expect-error test Worker mock only implements the event API used here
    globalThis.Worker = MockWorker;
  }, 30_000);

  it('useAudioAnalysis initializes wasm, analyzes mono audio and exposes completion state', async () => {
    const analysis = useAudioAnalysis();
    expect(analysis.getVersion()).toBe('');

    await analysis.initWasm();
    expect(analysis.isInitialized.value).toBe(true);
    expect(analysis.getVersion()).toMatch(/^\d+\.\d+\.\d+/);

    const result = await analysis.analyze(audioBuffer([sine()]));
    expect(result.key.name).toBeTruthy();
    expect(result.bpm).toBeGreaterThan(0);
    expect(analysis.result.value).toBe(result);
    expect(analysis.isAnalyzing.value).toBe(false);
    expect(analysis.progress.value).toBe(1);
    expect(analysis.progressStage.value).toBe('Complete');
    expect(analysis.error.value).toBeNull();
  });

  it('useAudioAnalysis downmixes stereo audio for bpm and beat detection', async () => {
    const analysis = useAudioAnalysis();
    const pulses = pulseTrain();
    const inverted = new Float32Array(pulses.length);
    for (let i = 0; i < pulses.length; i++) inverted[i] = pulses[i] * 0.5;

    const buffer = audioBuffer([pulses, inverted]);
    const bpm = await analysis.detectBpm(buffer);
    const beats = await analysis.detectBeats(buffer);

    expect(analysis.isInitialized.value).toBe(true);
    expect(bpm).toBeGreaterThan(80);
    expect(beats.length).toBeGreaterThan(0);
  });

  it('useStreamAnalyzer processes frames, handles offsets, reinitializes and resets', async () => {
    let analyzer!: ReturnType<typeof useStreamAnalyzer>;
    const wrapper = mount(
      defineComponent({
        setup() {
          analyzer = useStreamAnalyzer({
            sampleRate: SAMPLE_RATE,
            nFft: 512,
            hopLength: 128,
            nMels: 24,
            emitEveryNFrames: 1,
          });
          return () => null;
        },
      }),
    );

    try {
      await analyzer.init();
      expect(analyzer.isInitialized.value).toBe(true);
      expect(analyzer.error.value).toBeNull();

      const block = sine(440, 2048 / SAMPLE_RATE);
      analyzer.process(block, 0);
      expect(analyzer.isProcessing.value).toBe(false);
      expect(analyzer.streamingData.value.nFrames).toBeGreaterThan(0);
      expect(analyzer.streamingData.value.nMels).toBe(24);
      expect(analyzer.streamingData.value.nChroma).toBe(12);
      expect(analyzer.streamingData.value.mel.length).toBe(
        analyzer.streamingData.value.nFrames * analyzer.streamingData.value.nMels,
      );

      const framesBeforeSeekReset = analyzer.streamingData.value.nFrames;
      analyzer.process(block, block.length + 128);
      expect(analyzer.streamingData.value.nFrames).toBeLessThanOrEqual(framesBeforeSeekReset);

      analyzer.setExpectedDuration(2);
      analyzer.setNormalizationGain(0.75);

      await analyzer.reinit(SAMPLE_RATE * 2);
      expect(analyzer.streamingData.value.nFrames).toBe(0);

      analyzer.process(block);
      expect(analyzer.streamingData.value.nFrames).toBeGreaterThan(0);

      analyzer.reset(256);
      expect(analyzer.streamingData.value.nFrames).toBe(0);
      expect(analyzer.estimate.value).toMatchObject({
        bpm: 0,
        key: '-',
        chord: '-',
        currentBar: -1,
      });

      analyzer.destroy();
      expect(analyzer.isInitialized.value).toBe(false);
    } finally {
      wrapper.unmount();
    }
  });

  it('useMastering loads audio, analyzes source reports and creates wav URLs', async () => {
    const mastering = useMastering();
    const file = {
      name: 'mastering-demo.wav',
      arrayBuffer: async () => new ArrayBuffer(8),
    } as File;

    // The mastering assistant (profile/suggest) rejects clips shorter than one
    // analysis window, so decode a representative-length tone for this path.
    const frames = 4096;
    const left = new Float32Array(frames);
    const right = new Float32Array(frames);
    for (let i = 0; i < frames; i++) {
      left[i] = 0.3 * Math.sin((2 * Math.PI * 440 * i) / SAMPLE_RATE);
      right[i] = left[i] * 0.5;
    }
    MockAudioContext.override = [left, right];

    try {
      const decoded = await mastering.loadFile(file);
      expect(decoded).toMatchObject({
        fileName: 'mastering-demo.wav',
        sampleRate: SAMPLE_RATE,
        duration: frames / SAMPLE_RATE,
        channels: 2,
      });
      expect(decoded.left).toHaveLength(frames);
      expect(decoded.left[1]).toBeCloseTo(0.3 * Math.sin((2 * Math.PI * 440) / SAMPLE_RATE), 6);
      expect(decoded.right[1]).toBeCloseTo(decoded.left[1] * 0.5, 6);
      expect(mastering.source.value).toBe(decoded);
      expect(mastering.isLoading.value).toBe(false);
      expect(mastering.error.value).toBeNull();

      const report = await mastering.analyzeSource([
        { name: 'Test', targetLufs: -14, ceilingDb: -1 },
      ]);
      expect(mastering.isInitialized.value).toBe(true);
      expect(report.profile).toBeTruthy();
      expect(report.suggestions).toBeTruthy();
      expect(report.streamingPreview).toMatchObject({
        platforms: expect.any(Array),
      });

      expect(mastering.createSourceAudioUrl(decoded)).toBe('blob:test');
    } finally {
      MockAudioContext.override = null;
    }
  });

  it('useMastering handles very short analysis clips without leaking raw WASM errors', async () => {
    const mastering = useMastering();
    // Default mock decodes a 4-sample clip — shorter than one analysis window,
    // which the mastering assistant rejects with a raw WASM exception.
    await mastering.loadFile({
      name: 'too-short.wav',
      arrayBuffer: async () => new ArrayBuffer(8),
    } as File);

    const outcome = await mastering
      .analyzeSource([{ name: 'Test', targetLufs: -14, ceilingDb: -1 }])
      .then((report) => ({ report, rejection: null as unknown }))
      .catch((e) => ({ report: null, rejection: e as unknown }));

    // Older WASM builds rejected this path; current builds may return a compact
    // profile. If it rejects, it must still be normalized to an Error, never the
    // bare Emscripten pointer number.
    if (outcome.rejection) {
      expect(outcome.rejection).toBeInstanceOf(Error);
      expect(typeof outcome.rejection).not.toBe('number');
      expect(mastering.error.value).toBeTruthy();
    } else {
      expect(outcome.report).toBeTruthy();
      expect(mastering.error.value).toBeNull();
    }
  });

  it('useMastering renders through the worker and posts mastering config/input gain', async () => {
    MockWorker.messages = [];
    const mastering = useMastering();
    await mastering.loadFile({
      name: 'render-source.wav',
      arrayBuffer: async () => new ArrayBuffer(8),
    } as File);

    const settings = {
      ...defaultModuleSettings(),
      inputGainDb: 6,
      denoiseAmount: 0.25,
      declickAmount: 0.2,
      dereverbAmount: 0.15,
      tapeDriveDb: 1,
      tapeSaturation: 0.3,
      monoMakerAmount: 0.2,
    };
    const rendered = await mastering.render({
      preset: 'aiMusic',
      targetLufs: -13,
      tuning: { tone: 70, width: 60, dynamics: 40 },
      moduleSettings: settings,
    });

    expect(rendered.left).toHaveLength(4);
    expect(rendered.stages).toContain('eq.tilt');
    expect(mastering.rendered.value).toBe(rendered);
    expect(mastering.isRendering.value).toBe(false);
    expect(mastering.renderProgress.value).toBe(1);
    expect(mastering.renderStage.value).toBe('Complete');

    const message = MockWorker.messages.at(-1);
    expect(message.type).toBe('render');
    expect(message.left[0]).toBeCloseTo(0.25 * 10 ** (6 / 20), 6);
    expect(message.config.loudness.targetLufs).toBe(-13);
    expect(message.config.repair.denoise).toBe(true);
    expect(message.config.repair.declick).toBeTruthy();
    expect(message.config.repair.dereverb).toBeTruthy();
    expect(message.config.saturation.tape).toBeTruthy();
    expect(message.config.stereo.monoMaker).toMatchObject({ amount: 0.2 });

    expect(mastering.createAudioUrl(rendered)).toBe('blob:test');
    mastering.dispose();
    expect(MockWorker.terminated).toBeGreaterThan(0);
  });

  it('useMastering renders reference matching with resampled references and rejects missing source', async () => {
    await expect(
      useMastering().render({
        preset: 'pop',
        targetLufs: -14,
        tuning: { tone: 50, width: 50, dynamics: 50 },
      }),
    ).rejects.toThrow(/No audio loaded/);

    MockWorker.messages = [];
    const mastering = useMastering();
    await mastering.loadFile({
      name: 'source.wav',
      arrayBuffer: async () => new ArrayBuffer(8),
    } as File);

    const reference = {
      fileName: 'reference.wav',
      sampleRate: SAMPLE_RATE / 2,
      duration: 4 / (SAMPLE_RATE / 2),
      channels: 2,
      left: new Float32Array([0, 1]),
      right: new Float32Array([1, 0]),
    };

    const rendered = await mastering.renderReferenceMatch(reference, {
      targetLufs: -14,
      ceilingDb: -1,
      lookaheadMs: 4,
    });
    expect(rendered.stages).toEqual(['match.applyMatchEq.left', 'match.applyMatchEq.right']);
    expect(mastering.renderStage.value).toBe('Complete');

    const message = MockWorker.messages.at(-1);
    expect(message.type).toBe('referenceMatch');
    expect(message.referenceLeft).toHaveLength(4);
    expect(message.referenceRight).toHaveLength(4);
    expect(message.sampleRate).toBe(SAMPLE_RATE);
    expect(message.targetLufs).toBe(-14);
    expect(message.ceilingDb).toBe(-1);
    expect(message.lookaheadMs).toBe(4);
  });
});
