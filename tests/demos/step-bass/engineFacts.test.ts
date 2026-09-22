// @vitest-environment node
import { beforeAll, describe, expect, it } from 'vitest';
import { applyCompiled } from '@/demos/step-bass/stepBassApply';
import {
  STEP_BASS_ARTICULATION,
  STEP_BASS_BASE_PATCH,
  STEP_BASS_CHANNEL,
  STEP_BASS_TRACK_ID,
} from '@/demos/step-bass/stepBassPatch';
import type {
  CompiledLane,
  CompiledLanePoint,
  CompiledMidiEvent,
  CompiledPattern,
  StepBassEngine,
} from '@/demos/step-bass/stepBassTypes';
import { masterLimiterStripJson } from '@/utils/masterLimiter';
import { noteOffWord, noteOnWord } from '@/utils/ump';
import * as wasm from '@/wasm/index.js';

/**
 * Six engine behaviours this instrument is built on. Each one renders, prints
 * what it measured, and fixes the answer: a refreshed engine build that changes
 * any of them fails here rather than quietly changing how the page sounds.
 */

/** float32 carries about 5.96e-8 per ulp, so two renders within this are one signal. */
const UNCHANGED = 1e-7;

const SAMPLE_RATE = 48_000;
const BLOCK = 128;
const BPM = 120;
/** Frames per quarter note, the unit automation lanes and the loop are written in. */
const FRAMES_PER_PPQ = (SAMPLE_RATE * 60) / BPM;
/** One bar of four quarters: the sequencer's loop. */
const LOOP_PPQ = 4;
const LOOP_FRAMES = Math.round(FRAMES_PER_PPQ * LOOP_PPQ);
/** Low A; the register this instrument plays in. */
const TEST_NOTE = 45;

type Engine = InstanceType<typeof wasm.RealtimeEngine>;

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

function peak(samples: Float32Array, from = 0, to = samples.length): number {
  let worst = 0;
  for (let i = from; i < to; i++) {
    const a = Math.abs(samples[i]);
    if (a > worst) worst = a;
  }
  return worst;
}

/** Largest sample-to-sample step in a span — what a click shows up as. */
function maxSlew(samples: Float32Array, from: number, to: number): number {
  let worst = 0;
  for (let i = Math.max(1, from); i < Math.min(samples.length, to); i++) {
    const d = Math.abs(samples[i] - samples[i - 1]);
    if (d > worst) worst = d;
  }
  return worst;
}

/** Pump the engine block by block, returning the left channel. */
function pump(
  engine: Engine,
  frames: number,
  onBlock?: (framesDone: number) => void,
): Float32Array {
  const out = new Float32Array(frames);
  let done = 0;
  while (done < frames) {
    const n = Math.min(BLOCK, frames - done);
    onBlock?.(done);
    // Re-acquire every block: WASM memory growth detaches the views.
    const left = engine.getChannelBuffer(0, BLOCK);
    const right = engine.getChannelBuffer(1, BLOCK);
    left.fill(0, 0, n);
    right.fill(0, 0, n);
    engine.processPrepared(n);
    out.set(left.subarray(0, n), done);
    done += n;
  }
  return out;
}

function newEngine(): Engine {
  return new wasm.RealtimeEngine(SAMPLE_RATE, BLOCK, 1024, 1024);
}

/** One sustained note filling the loop, the phrase most of these probes use. */
function sustainedEvents(): CompiledMidiEvent[] {
  return [
    { renderFrame: 0, word0: noteOnWord(TEST_NOTE, 100) },
    { renderFrame: LOOP_FRAMES - 1, word0: noteOffWord(TEST_NOTE) },
  ];
}

function compiled(
  events: CompiledMidiEvent[] = sustainedEvents(),
  lanes: CompiledLane[] = [],
  options: { lengthSamples?: number; faderDb?: number } = {},
): CompiledPattern {
  const faderDb = options.faderDb ?? 0;
  return {
    sampleRate: SAMPLE_RATE,
    bpm: BPM,
    patch: { ...STEP_BASS_BASE_PATCH },
    articulation: STEP_BASS_ARTICULATION,
    clip: {
      id: 1,
      trackId: STEP_BASS_TRACK_ID,
      destinationId: STEP_BASS_TRACK_ID,
      startSample: 0,
      startPpq: 0,
      lengthSamples: options.lengthSamples ?? LOOP_FRAMES,
      events,
    },
    loop: { startPpq: 0, endPpq: LOOP_PPQ },
    lanes,
    knobs: {
      cutoffHz: 700,
      resonanceQ: 6.4,
      envToCutoffCents: 2400,
      pitchOffsetCents: 0,
      faderDb,
    },
    masterStripJson: masterLimiterStripJson(faderDb),
  };
}

/** Boot by hand, without the lanes or the transport, for probes that vary the boot. */
function bootBare(options: { trackLanes?: boolean; slurred?: boolean } = {}): Engine {
  const engine = newEngine();
  engine.prepareChannels(2, BLOCK);
  engine.getChannelBuffer(0, BLOCK);
  engine.getChannelBuffer(1, BLOCK);
  if (options.trackLanes !== false) engine.setTrackLanes([STEP_BASS_TRACK_ID]);
  engine.setSynthInstrument({ ...STEP_BASS_BASE_PATCH }, STEP_BASS_TRACK_ID);
  if (options.slurred) {
    engine.setArticulation(STEP_BASS_TRACK_ID, STEP_BASS_CHANNEL, STEP_BASS_ARTICULATION);
  }
  engine.setTempoSegments([{ startPpq: 0, bpm: BPM }]);
  return engine;
}

beforeAll(async () => {
  await wasm.init();
}, 60_000);

describe('how an automation lane has to be written to hold a value', () => {
  /** Render one loop with the given cutoff lane; cutoff reaches a sounding voice. */
  function renderCutoffLane(points: CompiledLanePoint[]): Float32Array {
    const engine = bootBare();
    const id = engine.resolveInstrumentAutomationId(STEP_BASS_TRACK_ID, 'cutoffHz');
    expect(id).toBeGreaterThanOrEqual(0);
    engine.setMidiClips([compiled().clip]);
    engine.setAutomationLane(id, points);
    engine.setLoop(0, LOOP_PPQ, true);
    engine.play();
    const out = pump(engine, LOOP_FRAMES);
    engine.destroy();
    return out;
  }

  /** How far a render's first half strays from a lane that never moves. */
  function heldSpanDrift(points: CompiledLanePoint[], flat: Float32Array): number {
    const half = Math.round(FRAMES_PER_PPQ * 2);
    return maxDiff(renderCutoffLane(points).subarray(0, half), flat.subarray(0, half));
  }

  it('holds across a span only when two points carry the value, not one', () => {
    const flat = renderCutoffLane([{ ppq: 0, value: 300 }]);
    const ramped = heldSpanDrift(
      [
        { ppq: 0, value: 300 },
        { ppq: 2, value: 3000 },
      ],
      flat,
    );
    const paired = heldSpanDrift(
      [
        { ppq: 0, value: 300 },
        { ppq: 1.999, value: 300 },
        { ppq: 2, value: 3000 },
        { ppq: 3.999, value: 3000 },
      ],
      flat,
    );
    report('one point per value — held span differs from a flat lane by', ramped);
    report('two points per value — held span differs from a flat lane by', paired);

    // One point per value interpolates the whole way, so the "held" span is not
    // held at all; a point pair at each end of the span is what makes it flat.
    expect(ramped).toBeGreaterThan(UNCHANGED);
    expect(paired).toBeLessThanOrEqual(UNCHANGED);
  }, 120_000);

  it('takes the hold curve as its numeric code and refuses the name', () => {
    const flat = renderCutoffLane([{ ppq: 0, value: 300 }]);
    // Breakpoints go to the engine as given, so an enum name never gets
    // resolved on the way in and only this key is read.
    const HOLD = 2;
    const curved = (key: string, value: unknown): CompiledLanePoint[] =>
      [
        { ppq: 0, value: 300, [key]: value },
        { ppq: 2, value: 3000, [key]: value },
      ] as unknown as CompiledLanePoint[];

    let nameError = '';
    try {
      renderCutoffLane(curved('curveToNext', 'hold'));
    } catch (err) {
      nameError = String(err);
    }
    report('curve given as a name', nameError || 'accepted');
    expect(nameError).toMatch(/curveToNext/);

    const held = heldSpanDrift(curved('curveToNext', HOLD), flat);
    const aliased = heldSpanDrift(curved('curve', HOLD), flat);
    report('hold code on curveToNext — held span differs from a flat lane by', held);
    report('hold code on the shorter key — held span differs from a flat lane by', aliased);

    expect(held).toBeLessThanOrEqual(UNCHANGED);
    expect(aliased).toBeGreaterThan(UNCHANGED);
  }, 120_000);
});

describe('what the transport loop does at its boundary', () => {
  function renderLaps(
    events: CompiledMidiEvent[],
    lengthSamples: number,
    laps: number,
  ): Float32Array {
    const engine = bootBare({ slurred: true });
    engine.setMidiClips([compiled(events, [], { lengthSamples }).clip]);
    engine.setLoop(0, LOOP_PPQ, true);
    engine.play();
    const out = pump(engine, LOOP_FRAMES * laps);
    engine.destroy();
    return out;
  }

  const onFrame = Math.round(FRAMES_PER_PPQ * 3.5);
  const span = (render: Float32Array, fromPpq: number, toPpq: number) =>
    peak(render, Math.round(FRAMES_PER_PPQ * fromPpq), Math.round(FRAMES_PER_PPQ * toPpq));

  it('never fires an event past the loop end, and releases the note the wrap catches', () => {
    // A note starting near the end, told to stop after the loop end.
    const hanging = renderLaps(
      [
        { renderFrame: onFrame, word0: noteOnWord(TEST_NOTE, 100) },
        { renderFrame: Math.round(FRAMES_PER_PPQ * 4.25), word0: noteOffWord(TEST_NOTE) },
      ],
      Math.round(FRAMES_PER_PPQ * 5),
      3,
    );
    // The same note with no note-off written at all.
    const noOff = renderLaps(
      [{ renderFrame: onFrame, word0: noteOnWord(TEST_NOTE, 100) }],
      Math.round(FRAMES_PER_PPQ * 8),
      3,
    );
    // The same note released one frame before the loop end.
    const released = renderLaps(
      [
        { renderFrame: onFrame, word0: noteOnWord(TEST_NOTE, 100) },
        { renderFrame: LOOP_FRAMES - 1, word0: noteOffWord(TEST_NOTE) },
      ],
      LOOP_FRAMES,
      3,
    );

    report('sounding just before the wrap', span(noOff, 3.6, 3.9));
    report('no note-off written — just after the wrap', span(noOff, 4.0, 4.1));
    report('released one frame early — just after the wrap', span(released, 4.0, 4.1));
    report('no note-off written — a quarter past the wrap', span(noOff, 4.2, 4.5));
    report('note-off written past the loop end — second lap, mid-bar', span(hanging, 5.0, 5.5));
    report('no note-off written — second lap, same onset', span(noOff, 7.5, 7.9));

    expect(span(noOff, 3.6, 3.9)).toBeGreaterThan(0.01);
    // The wrap itself releases the voice: leaving the note-off out sounds the
    // same as writing it at the last frame, so a note cannot be carried into
    // the next lap and a slide across the boundary is pitch only.
    expect(Math.abs(span(noOff, 4.0, 4.1) - span(released, 4.0, 4.1))).toBeLessThan(0.002);
    expect(span(noOff, 4.2, 4.5)).toBeLessThan(0.001);
    // An event written past the loop end never fires — it does not carry over.
    expect(span(hanging, 5.0, 5.5)).toBeLessThan(1e-6);
    // The loop still replays: the same onset speaks again on the next lap.
    expect(span(noOff, 7.5, 7.9)).toBeGreaterThan(0.01);
  }, 180_000);
});

describe('whether the slur survives a new instrument on the same destination', () => {
  /**
   * Play a note, then a second on top with the first released — the slide's
   * shape. A retrigger shows up as the amp envelope jumping at the new onset.
   */
  function legatoPair(options: { slurred: boolean; rebind: boolean }) {
    const engine = bootBare({ slurred: options.slurred });
    if (options.rebind) engine.setSynthInstrument({ ...STEP_BASS_BASE_PATCH }, STEP_BASS_TRACK_ID);
    engine.setMidiInputSource(STEP_BASS_TRACK_ID);
    const readback = engine.articulation(STEP_BASS_TRACK_ID, STEP_BASS_CHANNEL);
    const secondAt = Math.round(SAMPLE_RATE * 0.4);
    let started = false;
    let slurred = false;
    const out = pump(engine, Math.round(SAMPLE_RATE * 0.6), (done) => {
      if (!started) {
        engine.pushMidiInputNoteOn(0, STEP_BASS_CHANNEL, TEST_NOTE, 100, 0);
        started = true;
      } else if (!slurred && done >= secondAt) {
        engine.pushMidiInputNoteOn(0, STEP_BASS_CHANNEL, TEST_NOTE + 7, 100, 0);
        engine.pushMidiInputNoteOff(0, STEP_BASS_CHANNEL, TEST_NOTE, 0, 0);
        slurred = true;
      }
    });
    engine.destroy();
    /** Envelope around the second onset: peak of a window wider than one cycle. */
    const envelopeAt = (ms: number) => {
      const centre = secondAt + Math.round((SAMPLE_RATE * ms) / 1000);
      return peak(out, Math.max(0, centre - 120), Math.min(out.length, centre + 120));
    };
    return { readback, out, before: envelopeAt(-10), at: envelopeAt(4), after: envelopeAt(30) };
  }

  it('drops back to taking a fresh voice as soon as the instrument is rebound', () => {
    const slurred = legatoPair({ slurred: true, rebind: false });
    const rebound = legatoPair({ slurred: true, rebind: true });
    const fresh = legatoPair({ slurred: false, rebind: false });

    for (const [label, run] of [
      ['slurred', slurred],
      ['slurred, then rebound', rebound],
      ['a fresh voice per note', fresh],
    ] as const) {
      report(`${label} — readback / envelope at -10, +4, +30 ms`, [
        run.readback,
        run.before,
        run.at,
        run.after,
      ]);
    }

    // Asked for, and held, while the instrument stays bound.
    expect(slurred.readback).toBe(STEP_BASS_ARTICULATION);
    // The envelope keeps falling through the new onset rather than jumping.
    expect(slurred.at).toBeLessThan(slurred.before);
    expect(fresh.at).toBeGreaterThan(fresh.before);

    // Binding an instrument resets the destination's articulation, so it has to
    // be asked for again after every rebind — the waveform switch included.
    expect(rebound.readback).toBe('poly');
    expect(maxDiff(rebound.out, fresh.out)).toBeLessThanOrEqual(UNCHANGED);
  }, 120_000);
});

describe('what a lane or clip re-send costs while the transport is running', () => {
  const resendAt = Math.round(FRAMES_PER_PPQ * 1.5);
  const decayLane: CompiledLane[] = [
    {
      param: 'filterDecayMs',
      points: [
        { ppq: 0, value: 300 },
        { ppq: 3.999, value: 300 },
      ],
    },
  ];

  function renderWithResend(kind: 'none' | 'lanes' | 'clip' | 'both'): Float32Array {
    const engine = newEngine();
    const pattern = compiled(sustainedEvents(), decayLane);
    const ids = applyCompiled(engine as unknown as StepBassEngine, pattern, 'facade');
    engine.play();
    let fired = false;
    const out = pump(engine, LOOP_FRAMES, (done) => {
      if (fired || done < resendAt) return;
      const id = ids.filterDecayMs;
      if ((kind === 'lanes' || kind === 'both') && id !== undefined) {
        engine.setAutomationLane(id, decayLane[0].points);
      }
      if (kind === 'clip' || kind === 'both') engine.setMidiClips([pattern.clip]);
      fired = true;
    });
    engine.destroy();
    return out;
  }

  it('changes nothing at all when the re-sent content is the same', () => {
    const base = renderWithResend('none');
    const lanes = renderWithResend('lanes');
    const clip = renderWithResend('clip');
    const both = renderWithResend('both');

    report('lane re-sent, difference from no re-send', maxDiff(lanes, base));
    report('clip re-sent, difference from no re-send', maxDiff(clip, base));
    report('both re-sent, difference from no re-send', maxDiff(both, base));
    report(
      'largest sample step, one block either side of the re-send',
      maxSlew(both, resendAt - BLOCK, resendAt + BLOCK),
    );

    expect(maxDiff(lanes, base)).toBe(0);
    expect(maxDiff(clip, base)).toBe(0);
    expect(maxDiff(both, base)).toBe(0);
  }, 180_000);

  /** Cutoff, so a lane's new value is audible under the note already sounding. */
  function renderCutoffChange(to: number | null): Float32Array {
    const engine = bootBare({ slurred: true });
    const id = engine.resolveInstrumentAutomationId(STEP_BASS_TRACK_ID, 'cutoffHz');
    const held = (value: number) => [
      { ppq: 0, value },
      { ppq: 3.999, value },
    ];
    engine.setMidiClips([compiled().clip]);
    engine.setAutomationLane(id, held(400));
    engine.setLoop(0, LOOP_PPQ, true);
    engine.play();
    let fired = false;
    const out = pump(engine, LOOP_FRAMES, (done) => {
      if (fired || to === null || done < resendAt) return;
      engine.setAutomationLane(id, held(to));
      fired = true;
    });
    engine.destroy();
    return out;
  }

  it('slides into a re-sent value rather than stepping to it', () => {
    const boundary = (render: Float32Array) => maxSlew(render, resendAt - BLOCK, resendAt + BLOCK);
    const settled = (render: Float32Array) =>
      maxSlew(render, resendAt + 20 * BLOCK, resendAt + 40 * BLOCK);

    const base = renderCutoffChange(null);
    const opened = renderCutoffChange(3000);
    const closed = renderCutoffChange(80);

    report('unchanged — slew at the boundary / once settled', [boundary(base), settled(base)]);
    report('opened to 3000 Hz — slew at the boundary / once settled', [
      boundary(opened),
      settled(opened),
    ]);
    report('closed to 80 Hz — slew at the boundary / once settled', [
      boundary(closed),
      settled(closed),
    ]);

    // A click would be a transient larger than either steady state. Neither
    // direction produces one: the boundary stays under the louder of the two.
    for (const changed of [opened, closed]) {
      expect(boundary(changed)).toBeLessThanOrEqual(Math.max(settled(base), settled(changed)));
    }
  }, 180_000);
});

describe('whether the limiter reports its gain reduction', () => {
  it('carries the field but never fills it in, so there is no meter to build on', () => {
    const engine = newEngine();
    // +24 dB into a -1 dBTP ceiling: the limiter is working hard here.
    applyCompiled(
      engine as unknown as StepBassEngine,
      compiled(sustainedEvents(), [], { faderDb: 24 }),
      'facade',
    );
    engine.play();
    const byTarget = new Map<number, { records: number; worstGr: number; loudestPeak: number }>();
    const out = pump(engine, LOOP_FRAMES, () => {
      for (const record of engine.drainMeterTelemetry(64)) {
        const seen = byTarget.get(record.targetId) ?? { records: 0, worstGr: 0, loudestPeak: -120 };
        seen.records++;
        const reduction = record.gainReductionDb ?? 0;
        if (reduction < seen.worstGr) seen.worstGr = reduction;
        if (record.peakDbL > seen.loudestPeak) seen.loudestPeak = record.peakDbL;
        byTarget.set(record.targetId, seen);
      }
    });
    const targets = [...byTarget.entries()].map(([id, seen]) => ({ id, ...seen }));
    engine.destroy();

    report('output peak', peak(out));
    report('meter targets', targets);

    // The limiter is demonstrably holding the ceiling.
    expect(targets.length).toBeGreaterThanOrEqual(2);
    const atCeiling = targets.find((target) => target.loudestPeak > -1.5);
    expect(atCeiling, 'no meter target reaches the ceiling').toBeTruthy();
    expect(atCeiling?.loudestPeak).toBeLessThanOrEqual(-0.9);
    // And every record still reports no reduction at all, on every target. The
    // number is not available, so nothing on screen may claim to show it.
    for (const target of targets) expect(target.worstGr).toBe(0);
  }, 180_000);
});

describe('the shape of the track lane call', () => {
  it('takes a 1-based id as a number or an object, and refuses zero', () => {
    const engine = newEngine();
    const native = (engine as unknown as { native?: { setTrackLanes(lanes: unknown[]): void } })
      .native;
    expect(native, 'the native engine object is not reachable').toBeTruthy();

    const attempt = (run: () => void): string => {
      try {
        run();
        return 'accepted';
      } catch (err) {
        return String(err);
      }
    };
    const asNumber = attempt(() => native?.setTrackLanes([STEP_BASS_TRACK_ID]));
    const asObject = attempt(() => native?.setTrackLanes([{ trackId: STEP_BASS_TRACK_ID }]));
    const asZero = attempt(() => native?.setTrackLanes([0]));
    const facadeZero = attempt(() => engine.setTrackLanes([0]));
    engine.destroy();

    report('native, plain id', asNumber);
    report('native, object form', asObject);
    report('native, zero id', asZero);
    report('facade, zero id', facadeZero);

    expect(asNumber).toBe('accepted');
    expect(asObject).toBe('accepted');
    expect(asZero).toMatch(/track lane/);
    expect(facadeZero).toMatch(/track lane/);
  }, 60_000);

  it('is not what makes a clip sound on this build', () => {
    function renderClip(trackLanes: boolean): number {
      const engine = bootBare({ trackLanes });
      engine.setMidiClips([compiled().clip]);
      engine.setLoop(0, LOOP_PPQ, true);
      engine.play();
      const out = pump(engine, LOOP_FRAMES);
      engine.destroy();
      return peak(out);
    }
    const withLanes = renderClip(true);
    const withoutLanes = renderClip(false);
    report('peak with the lane declared', withLanes);
    report('peak without it', withoutLanes);

    expect(withLanes).toBeGreaterThan(0.01);
    // The call is still made — lane strips and sends need it — but leaving it
    // out no longer silences a clip, so silence has to be diagnosed elsewhere.
    expect(withoutLanes).toBeCloseTo(withLanes, 6);
  }, 120_000);
});
