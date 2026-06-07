import { describe, expect, it } from 'vitest';
import {
  buildSynthProcessorSource,
  SYNTH_CHANNEL,
  SYNTH_DESTINATION,
  SYNTH_GROUP,
} from '@/composables/useSynthEngine';

const source = buildSynthProcessorSource('/wasm/sonare.js');

describe('buildSynthProcessorSource', () => {
  it('static-imports the emscripten factory from the given url', () => {
    expect(source).toContain("import createModule from '/wasm/sonare.js';");
  });

  it('constructs and prepares the native RealtimeEngine', () => {
    expect(source).toContain('this.engine = new mod.RealtimeEngine(sampleRate, BLOCK, 1024, 1024)');
    expect(source).toContain('this.engine.prepareChannels(CHANNELS, BLOCK)');
    expect(source).toContain('this.engine.getChannelBuffer(ch, BLOCK)');
  });

  it('binds the patch-driven synth with the native (destination, patch) arg order', () => {
    expect(source).toContain('this.engine.setSynthInstrument(DEST, this.pendingPatch)');
    expect(source).toContain('this.engine.setSynthInstrument(DEST, msg.patch)');
    expect(source).toContain('this.engine.setMidiInputSource(DEST)');
  });

  it('forwards MIDI commands through the native input queue', () => {
    expect(source).toContain(
      'this.engine.pushMidiInputNoteOn(GROUP, CHANNEL, msg.note, msg.velocity, 0)',
    );
    expect(source).toContain('this.engine.pushMidiInputNoteOff(GROUP, CHANNEL, msg.note, 0, 0)');
    expect(source).toContain(
      'this.engine.pushMidiInputCc(GROUP, CHANNEL, msg.controller, msg.value, 0)',
    );
    expect(source).toContain('this.engine.pushMidiPanic(-1)');
  });

  it('renders via processPrepared and re-acquires heap views after memory growth', () => {
    expect(source).toContain('this.engine.processPrepared(frames)');
    // The detached-buffer guard re-fetches channel views inside process().
    expect(source).toContain('(this.channelBuffers[0]?.byteLength ?? 0) === 0');
  });

  it('guards against builds without the realtime engine and reports readiness/errors', () => {
    expect(source).toContain(
      "throw new Error('RealtimeEngine is not available in this WASM build')",
    );
    expect(source).toContain("this.port.postMessage({ type: 'ready' })");
    expect(source).toContain("this.port.postMessage({ type: 'error', error: String(err) })");
  });

  it('registers the synth processor and inlines the shared destination constants', () => {
    expect(source).toContain("registerProcessor('libsonare-synth', LibsonareSynthProcessor)");
    expect(source).toContain(`const DEST = ${SYNTH_DESTINATION};`);
    expect(source).toContain(`const GROUP = ${SYNTH_GROUP};`);
    expect(source).toContain(`const CHANNEL = ${SYNTH_CHANNEL};`);
  });
});
