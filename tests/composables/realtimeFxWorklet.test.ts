import { describe, expect, it } from 'vitest';
import { buildProcessorSource } from '@/composables/useRealtimeFx';

const source = buildProcessorSource('/wasm/sonare.js');

describe('buildProcessorSource', () => {
  it('static-imports the emscripten factory from the given url', () => {
    expect(source).toContain("import createModule from '/wasm/sonare.js';");
  });

  it('creates and prepares the native RealtimeVoiceChanger', () => {
    expect(source).toContain('mod.createRealtimeVoiceChanger(this.preset)');
    expect(source).toContain('this.vc.prepare(sampleRate, MAX_BLOCK, 1)');
    expect(source).not.toContain('createStreamingRetune');
  });

  it('drives the zero-copy prepared-mono path with per-block heap views', () => {
    expect(source).toContain('const inView = this.vc.getMonoInputBuffer(MAX_BLOCK)');
    expect(source).toContain('const outView = this.vc.getMonoOutputBuffer(MAX_BLOCK)');
    expect(source).toContain('this.vc.processPreparedMono(m)');
    expect(source).toContain('inView[i] = mono');
    expect(source).toContain('const wet = outView[i]');
    expect(source).not.toContain('voiceChange(');
  });

  it('layers the four live macros over the preset chain without dropping it', () => {
    expect(source).toContain('this.base = JSON.parse(this.vc.configJson())');
    expect(source).toContain('dsp.retune.semitones = this.pitch');
    expect(source).toContain('dsp.formant.factor = this.formant');
    expect(source).toContain('dsp.formant.brightness = this.brightness');
    expect(source).toContain('dsp.wetMix = this.wet');
    expect(source).toContain('this.vc.setConfig(this.base)');
  });

  it('switches the full preset chain when the preset id changes', () => {
    expect(source).toContain('p.preset !== this.preset');
    expect(source).toContain('this.vc.setConfig(this.preset); this.loadBase()');
  });

  it('reports worklet readiness with latency and module initialization failures', () => {
    expect(source).toContain(
      "this.port.postMessage({ type: 'ready', latencySamples: this.vc.latencySamples() })",
    );
    expect(source).toContain("this.port.postMessage({ type: 'error', error: String(err) })");
    expect(source).toContain(
      "throw new Error('RealtimeVoiceChanger is not available in this WASM build')",
    );
  });

  it('resets native state when disabled or bypassed before passthrough', () => {
    expect(source).toContain("msg.type === 'setEnabled'");
    expect(source).toContain('if (!this.enabled && this.vc) this.vc.reset()');
    expect(source).toContain('if (this.bypass || !this.ready || !this.enabled)');
    expect(source).toContain('if (this.vc) this.vc.reset()');
  });

  it('publishes metering at a throttled cadence with peak and RMS values', () => {
    expect(source).toContain('if (++this.seq % 8 !== 0) return');
    expect(source).toContain("type: 'meter'");
    expect(source).toContain('inputPeak,');
    expect(source).toContain('outputPeak,');
    expect(source).toContain('inputRms: Math.sqrt(inputSum / n)');
    expect(source).toContain('outputRms: Math.sqrt(outputSum / n)');
  });

  it('registers the processor under the expected name', () => {
    expect(source).toContain("registerProcessor('libsonare-voice'");
  });
});
