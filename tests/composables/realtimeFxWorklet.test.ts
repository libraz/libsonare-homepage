import { describe, expect, it } from 'vitest';
import { buildProcessorSource } from '@/composables/useRealtimeFx';

const source = buildProcessorSource('/wasm/sonare.js');

describe('buildProcessorSource', () => {
  it('static-imports the emscripten factory from the given url', () => {
    expect(source).toContain("import createModule from '/wasm/sonare.js';");
  });

  it('injects the DSP primitives as named const bindings', () => {
    // Bound to a const so the call sites resolve regardless of how the bundler
    // mangles the original function name inside the .toString() output.
    for (const name of ['ringModulate', 'advancePhase']) {
      expect(source).toContain(`const ${name} =`);
    }
  });

  it('calls the injected primitives instead of inlining their math', () => {
    expect(source).toContain('advancePhase(this.robotPhase, 55, sampleRate)');
    expect(source).toContain('ringModulate(wetMono, carrier, this.robot)');
  });

  it('uses native StreamingRetune instead of offline voiceChange frames', () => {
    expect(source).toContain('mod.createStreamingRetune');
    expect(source).toContain('this.retune.prepare(sampleRate, RETUNE_MAX_BLOCK)');
    expect(source).toContain(
      'this.retune.setConfig({ semitones: this.pitch, mix: 1, grainSize: 0 })',
    );
    expect(source).toContain('this.retune.processMono(this.monoBlock)');
    expect(source).not.toContain('voiceChange(');
  });

  it('reports worklet readiness and module initialization failures', () => {
    expect(source).toContain("this.port.postMessage({ type: 'ready' })");
    expect(source).toContain("this.port.postMessage({ type: 'error', error: String(err) })");
    expect(source).toContain(
      "throw new Error('StreamingRetune is not available in this WASM build')",
    );
  });

  it('resets native retune state when disabled or bypassed before passthrough', () => {
    expect(source).toContain("msg.type === 'setEnabled'");
    expect(source).toContain('if (!this.enabled && this.retune) this.retune.reset()');
    expect(source).toContain('if (this.bypass || !this.ready || !this.enabled)');
    expect(source).toContain('if (this.retune) this.retune.reset()');
  });

  it('publishes metering at a throttled cadence with peak and RMS values', () => {
    expect(source).toContain('if (++this.seq % 8 !== 0) return');
    expect(source).toContain("type: 'meter'");
    expect(source).toContain('inputPeak,');
    expect(source).toContain('outputPeak,');
    expect(source).toContain('inputRms: Math.sqrt(inputSum / n)');
    expect(source).toContain('outputRms: Math.sqrt(outputSum / n)');
  });

  it('adds audible realtime voice color and reverb after retune', () => {
    expect(source).toContain('this.toneLow');
    expect(source).toContain('(this.formant - 1) * 1.7');
    expect(source).toContain('this.revA = new Float32Array(1499)');
    expect(source).toContain('this.revB = new Float32Array(2111)');
    expect(source).toContain('this.revC = new Float32Array(2633)');
  });

  it('registers the processor under the expected name', () => {
    expect(source).toContain("registerProcessor('libsonare-fx'");
  });
});
