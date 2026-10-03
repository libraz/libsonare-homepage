import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { mount } from '@vue/test-utils';
import { beforeAll, describe, expect, it } from 'vitest';
import { defineComponent } from 'vue';
import { useAudioAnalysis } from '@/demos/analyzer/useAudioAnalysis';
import { useStreamAnalyzer } from '@/demos/analyzer/useStreamAnalyzer';
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

describe('wasm-backed demo composables', () => {
  beforeAll(async () => {
    await wasm.init({ wasmBinary: readFileSync(join(process.cwd(), 'src/wasm/sonare.wasm')) });
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
      expect(analyzer.estimate.value.accumulatedSeconds).toBeGreaterThanOrEqual(0);

      analyzer.process(block, block.length + 128);
      expect(analyzer.isProcessing.value).toBe(false);

      analyzer.setExpectedDuration(2);
      analyzer.setNormalizationGain(0.75);

      await analyzer.reinit(SAMPLE_RATE * 2);
      expect(analyzer.estimate.value.accumulatedSeconds).toBe(0);

      analyzer.process(block);
      expect(analyzer.isProcessing.value).toBe(false);

      analyzer.reset(256);
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
});
