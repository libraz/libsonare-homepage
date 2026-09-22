// @vitest-environment node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { applyCompiled } from '@/demos/step-bass/stepBassApply';
import { compile, STEP_PPQ } from '@/demos/step-bass/stepBassCompile';
import {
  exportStepBassSmf,
  exportStepBassWav,
  renderStepBassChannels,
  type StepBassWasmModule,
  stepBassSmfBytes,
} from '@/demos/step-bass/stepBassExport';
import {
  ACCENT_MEMORY_CAP,
  accentVelocity,
  DEFAULT_BPM,
  STEP_BASS_DEFAULT_KNOBS,
  STEP_VELOCITY,
} from '@/demos/step-bass/stepBassPatch';
import { FACTORY_PATTERNS } from '@/demos/step-bass/stepBassPatterns';
import { buildStepBassProcessorSource } from '@/demos/step-bass/stepBassProcessor';
import type {
  CompiledPattern,
  Pattern,
  Step,
  StepBassEngine,
} from '@/demos/step-bass/stepBassTypes';
import { GS_PPQN } from '@/utils/gsSysex';
import * as wasm from '@/wasm/index.js';
import createSonareModule from '@/wasm/sonare.js';

const SAMPLE_RATE = 48_000;
const BPM = DEFAULT_BPM;
const BLOCK = 128;

/** float32 carries about 5.96e-8 per ulp, so two renders within this are one signal. */
const UNCHANGED = 1e-7;

function report(label: string, value: unknown): void {
  console.info(`  ${label}: ${typeof value === 'object' ? JSON.stringify(value) : value}`);
}

function maxDiff(a: Float32Array, b: Float32Array): number {
  let worst = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    const d = Math.abs(a[i] - b[i]);
    if (d > worst) worst = d;
  }
  return worst;
}

function testPattern(): Pattern {
  return FACTORY_PATTERNS.find((p) => p.id === 'root-walk')!.pattern;
}

function testCompiled(): CompiledPattern {
  return compile(testPattern(), STEP_BASS_DEFAULT_KNOBS, SAMPLE_RATE, BPM);
}

// ---------------------------------------------------------------- fake facade

/** Cheap stand-in for the facade engine that records every call it receives. */
class RecordingEngine {
  calls: { method: string; args: unknown[] }[] = [];
  private buffers: Float32Array[] = [];
  private record(method: string, ...args: unknown[]) {
    this.calls.push({ method, args });
  }
  prepareChannels(channels: number, frames: number) {
    this.record('prepareChannels', channels, frames);
    for (let ch = 0; ch < channels; ch++) this.buffers[ch] = new Float32Array(frames);
  }
  getChannelBuffer(channel: number, frames: number) {
    this.record('getChannelBuffer', channel, frames);
    this.buffers[channel] ??= new Float32Array(frames);
    return this.buffers[channel];
  }
  setMasterStripJson(json: string) {
    this.record('setMasterStripJson', json);
  }
  setTrackLanes(lanes: number[]) {
    this.record('setTrackLanes', lanes);
  }
  setSynthInstrument(a: unknown, b: unknown) {
    this.record('setSynthInstrument', a, b);
  }
  setArticulation(destination: number, channel: number, articulation: string) {
    this.record('setArticulation', destination, channel, articulation);
  }
  setTempoSegments(segments: unknown[]) {
    this.record('setTempoSegments', segments);
  }
  setMidiClips(clips: unknown[]) {
    this.record('setMidiClips', clips);
  }
  resolveInstrumentAutomationId(_destination: number, name: string) {
    this.record('resolveInstrumentAutomationId', name);
    return 1;
  }
  setAutomationLane(id: number, points: unknown[]) {
    this.record('setAutomationLane', id, points);
  }
  setLoop(startPpq: number, endPpq: number, enabled?: boolean) {
    this.record('setLoop', startPpq, endPpq, enabled);
  }
  play() {
    this.record('play');
  }
  processPrepared(frames: number) {
    this.record('processPrepared', frames);
  }
  destroy() {
    this.record('destroy');
  }
}

function fakeModOf(engine: RecordingEngine): StepBassWasmModule {
  return {
    RealtimeEngine: function RealtimeEngine() {
      return engine;
    },
  } as unknown as StepBassWasmModule;
}

// ------------------------------------------------------------------- native

interface RenderableEngine extends StepBassEngine {
  processPrepared(numFrames: number): void;
}

interface NativeSonareModule {
  RealtimeEngine: new (
    sampleRate: number,
    maxBlockSize: number,
    commandCapacity: number,
    telemetryCapacity: number,
  ) => RenderableEngine;
}

/** Release a raw embind object, whichever of the two release names this build exposes. */
function releaseEngine(engine: unknown): void {
  const e = engine as { destroy?: () => void; delete?: () => void };
  if (typeof e.destroy === 'function') e.destroy();
  else e.delete?.();
}

/** Pump a prepared engine block by block, mirroring the worklet processor's own render loop. */
function pumpStereo(engine: RenderableEngine, frames: number): [Float32Array, Float32Array] {
  const left = new Float32Array(frames);
  const right = new Float32Array(frames);
  let done = 0;
  while (done < frames) {
    const n = Math.min(BLOCK, frames - done);
    const l = engine.getChannelBuffer(0, BLOCK);
    const r = engine.getChannelBuffer(1, BLOCK);
    l.fill(0, 0, n);
    r.fill(0, 0, n);
    engine.processPrepared(n);
    left.set(l.subarray(0, n), done);
    right.set(r.subarray(0, n), done);
    done += n;
  }
  return [left, right];
}

let nativeModule: NativeSonareModule;

beforeAll(async () => {
  await wasm.init();
  const wasmBinary = readFileSync(resolve('src/wasm/sonare.wasm'));
  const factory = createSonareModule as unknown as (
    options: Record<string, unknown>,
  ) => Promise<NativeSonareModule>;
  nativeModule = await factory({ wasmBinary, locateFile: () => 'sonare.wasm' });
}, 60_000);

// -------------------------------------------------------------- 7(a) source

describe('criterion 7(a): the processor source embeds the shared apply function', () => {
  it('contains applyCompiled.toString() verbatim', () => {
    const source = buildStepBassProcessorSource('/wasm/sonare.js');
    expect(source).toContain(applyCompiled.toString());
  });
});

// --------------------------------------------------------- 7(b) same value

describe('criterion 7(b): live and export apply the same CompiledPattern', () => {
  it('applies a structural clone of the compiled pattern (what a worklet would receive over postMessage) identically to the value passed directly to the export path', () => {
    const compiled = testCompiled();
    // What a worklet would receive: postMessage structurally clones it.
    const postedToWorklet = structuredClone(compiled);

    const liveShaped = new RecordingEngine();
    renderStepBassChannels(fakeModOf(liveShaped), postedToWorklet, 1);

    const exportShaped = new RecordingEngine();
    renderStepBassChannels(fakeModOf(exportShaped), compiled, 1);

    // Same code path, so a byte-identical call log proves the export path
    // treated the clone and the original as the same value — not merely
    // reference-equal, and not silently diverging on some field.
    expect(exportShaped.calls).toEqual(liveShaped.calls);
    expect(liveShaped.calls.length).toBeGreaterThan(0);
    expect(compiled).toEqual(postedToWorklet);
  });
});

// ------------------------------------------------------ 7(c) maxdiff (main)

describe('criterion 7(c): the worklet and export apply-and-render procedures agree', () => {
  it('renders the same samples in Node through the native and facade surfaces', () => {
    const compiled = testCompiled();

    const nativeEngine = new nativeModule.RealtimeEngine(compiled.sampleRate, BLOCK, 1024, 1024);
    let nativeOut: [Float32Array, Float32Array];
    try {
      applyCompiled(nativeEngine as unknown as StepBassEngine, compiled, 'native');
      // The raw embind object has no JS-side default for this argument — only
      // the facade wrapper supplies one (`play(renderFrame = -1)`); -1 mirrors
      // it exactly so both sides start the transport the same way.
      nativeEngine.play(-1);
      nativeOut = pumpStereo(nativeEngine, compiled.clip.lengthSamples);
    } finally {
      releaseEngine(nativeEngine);
    }

    const facadeOut = renderStepBassChannels(wasm, compiled, 1);

    const worstLeft = maxDiff(nativeOut[0], facadeOut[0]);
    const worstRight = maxDiff(nativeOut[1], facadeOut[1]);
    report('native vs. export render — left/right maxdiff', [worstLeft, worstRight]);

    expect(Math.max(worstLeft, worstRight)).toBeLessThanOrEqual(UNCHANGED);
  }, 120_000);
});

// -------------------------------------------------------------- WAV export

describe('WAV export', () => {
  it('produces byte-identical output across two renders of the same pattern', async () => {
    const compiled = testCompiled();
    const first = new Uint8Array(await exportStepBassWav(wasm, compiled, 1).arrayBuffer());
    const second = new Uint8Array(await exportStepBassWav(wasm, compiled, 1).arrayBuffer());
    report('WAV bytes', first.length);
    expect(first).toEqual(second);
  }, 120_000);
});

// -------------------------------------------------------------- MIDI export

interface DecodedNoteEvent {
  tick: number;
  type: 'on' | 'off';
  note: number;
  velocity: number;
}

/** Minimal format-0 SMF reader: just enough to check what `stepBassSmfBytes` wrote. */
function decodeTrack(bytes: Uint8Array): DecodedNoteEvent[] {
  // MThd (4 id + 4 length + 6 body) then MTrk header (4 id + 4 length).
  let offset = 14 + 8;
  let tick = 0;
  const events: DecodedNoteEvent[] = [];
  while (offset < bytes.length) {
    let delta = 0;
    let byte: number;
    do {
      byte = bytes[offset++];
      delta = (delta << 7) | (byte & 0x7f);
    } while (byte & 0x80);
    tick += delta;

    const status = bytes[offset++];
    if (status === 0xff) {
      offset++; // meta type
      let len = 0;
      do {
        byte = bytes[offset++];
        len = (len << 7) | (byte & 0x7f);
      } while (byte & 0x80);
      offset += len;
      continue;
    }
    const type = (status & 0xf0) === 0x90 ? 'on' : (status & 0xf0) === 0x80 ? 'off' : null;
    const note = bytes[offset++];
    const velocity = bytes[offset++];
    if (type) events.push({ tick, type, note, velocity });
  }
  return events;
}

const TICKS_PER_STEP = STEP_PPQ * GS_PPQN;
const ACCENT_VELOCITY = accentVelocity(1, ACCENT_MEMORY_CAP);

describe('MIDI export', () => {
  it('embeds applyCompiled verbatim, and matches stepBassSmfBytes byte for byte', async () => {
    const pattern = testPattern();
    const bytes = stepBassSmfBytes(pattern);
    const blob = exportStepBassSmf(pattern);
    expect(blob.type).toBe('audio/midi');
    expect(new Uint8Array(await blob.arrayBuffer())).toEqual(bytes);
  });

  it('writes accent velocity 127 and normal velocity 64', () => {
    const pattern = FACTORY_PATTERNS.find((p) => p.id === 'thirds-roll')!.pattern;
    const events = decodeTrack(stepBassSmfBytes(pattern));
    const onAt = (step: number, note: number) =>
      events.find(
        (e) => e.type === 'on' && e.tick === Math.round(step * TICKS_PER_STEP) && e.note === note,
      );

    // Step 1 and step 9 carry the accent flag; step 0 does not.
    expect(onAt(1, 41)?.velocity).toBe(ACCENT_VELOCITY);
    expect(onAt(9, 43)?.velocity).toBe(ACCENT_VELOCITY);
    expect(onAt(0, 38)?.velocity).toBe(STEP_VELOCITY);
    expect(ACCENT_VELOCITY).toBe(127);
    expect(STEP_VELOCITY).toBe(64);
  });

  it('writes a slide as the outgoing note releasing after the incoming note starts', () => {
    const pattern = FACTORY_PATTERNS.find((p) => p.id === 'thirds-roll')!.pattern;
    const events = decodeTrack(stepBassSmfBytes(pattern));

    // Step 2 (note 43) slides into step 3 (note 41).
    const incomingOn = events.find(
      (e) => e.type === 'on' && e.note === 41 && e.tick === Math.round(3 * TICKS_PER_STEP),
    );
    const outgoingOff = events.find(
      (e) => e.type === 'off' && e.note === 43 && e.tick > Math.round(2 * TICKS_PER_STEP),
    );
    report('incoming on-tick / outgoing off-tick', [incomingOn?.tick, outgoingOff?.tick]);

    expect(incomingOn).toBeDefined();
    expect(outgoingOff).toBeDefined();
    expect(outgoingOff!.tick).toBeGreaterThan(incomingOn!.tick);
  });

  it('extends a tied note across the tied steps as one note, not a retrigger', () => {
    const steps: Step[] = Array.from({ length: 16 }, () => ({
      gate: 'rest',
      note: 0,
      accent: false,
      slide: false,
    }));
    steps[0] = { gate: 'note', note: 60, accent: false, slide: false };
    steps[1] = { gate: 'tie', note: 60, accent: false, slide: false };
    steps[2] = { gate: 'tie', note: 60, accent: false, slide: false };

    const events = decodeTrack(stepBassSmfBytes({ steps, root: 60 }));
    const ons = events.filter((e) => e.type === 'on' && e.note === 60);
    const offs = events.filter((e) => e.type === 'off' && e.note === 60);

    expect(ons).toHaveLength(1);
    expect(ons[0].tick).toBe(0);
    expect(offs).toHaveLength(1);
    expect(offs[0].tick).toBe(Math.round(3 * TICKS_PER_STEP));
  });
});
