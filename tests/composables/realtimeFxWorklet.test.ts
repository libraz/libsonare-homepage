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

  it('drives the zero-copy prepared-mono path with cached heap views', () => {
    expect(source).toContain('const inView = this.inputView()');
    expect(source).toContain('const outView = this.outputView()');
    expect(source).toContain('this.vc.processPreparedMono(m)');
    expect(source).toContain('inView[i] = mono');
    expect(source).toContain('const wet = outView[i]');
    expect(source).not.toContain('voiceChange(');
  });

  it('caches heap views and re-acquires them only after the buffer detaches', () => {
    expect(source).toContain('this.vc.getMonoInputBuffer(MAX_BLOCK)');
    expect(source).toContain('this.vc.getMonoOutputBuffer(MAX_BLOCK)');
    expect(source).toContain('this.inView.buffer.byteLength === 0');
    expect(source).toContain('this.outView.buffer.byteLength === 0');
    expect(source).toContain('this.inView = null; this.outView = null');
  });

  it('layers the four live macros over the preset chain without dropping it', () => {
    expect(source).toContain('this.base = JSON.parse(this.vc.configJson())');
    expect(source).toContain('dsp.retune.semitones = this.pitch');
    expect(source).toContain('dsp.formant.factor = this.formant');
    expect(source).toContain('dsp.formant.brightness = this.brightness');
    expect(source).toContain('dsp.wetMix = this.wet');
    expect(source).toContain('this.vc.setConfig(this.base)');
  });

  it('preserves the preset formant amount until a formant control is engaged', () => {
    expect(source).toContain('dsp.formant.amount');
    expect(source).toContain('this.baseFormantAmount = Number');
    expect(source).toContain('this.formantEngaged ? 1 : this.baseFormantAmount');
  });

  it('switches the full preset chain when the preset id changes', () => {
    expect(source).toContain('p.preset !== this.preset');
    expect(source).toContain('this.vc.setConfig(this.preset); this.loadBase()');
  });

  it('records the preset id even when params arrive before the engine exists', () => {
    // The preset guard no longer requires this.vc, so a preset chosen during
    // startup still seeds createRealtimeVoiceChanger once init completes.
    expect(source).toContain('if (p.preset && p.preset !== this.preset)');
    expect(source).not.toContain('if (this.vc && p.preset && p.preset !== this.preset)');
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

  it('flushes native state once on the transition into processing, not every block', () => {
    expect(source).toContain("msg.type === 'setEnabled'");
    expect(source).toContain('if (!this.enabled && this.vc) this.vc.reset()');
    expect(source).toContain('if (this.bypass || !this.ready || !this.enabled)');
    expect(source).toContain(
      'if (!this.wasProcessing) { this.vc.reset(); this.wasProcessing = true; }',
    );
    // The bypass path only records the transition; it no longer resets the
    // whole voice changer on every render block.
    expect(source).toContain('this.wasProcessing = false;');
    expect(source).not.toContain('if (this.vc) this.vc.reset()');
  });

  it('drops to dry passthrough and surfaces a native processing fault', () => {
    expect(source).toContain("this.port.postMessage({ type: 'error', error: String(e) })");
    expect(source).toContain('this.ready = false;');
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
