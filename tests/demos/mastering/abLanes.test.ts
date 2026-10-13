// @vitest-environment node
/**
 * /mastering A/B/R: three engine lanes switched by fader. With loudness
 * matching on, every lane plays at the loudness of the quietest one (a match
 * gain is never above 0 dB), and switching lanes while audio plays never drops
 * the output out.
 */
import { afterEach, describe, expect, it } from 'vitest';
import {
  buildFull,
  diff,
  LANE_OFF_DB,
  laneFaders,
  laneMatchGains,
  type MasteringAudio,
  type MasteringClip,
  renderMasteringState,
} from '@/demos/mastering/masteringEngine';
import {
  defaultMasteringState,
  MASTERING_LANES,
  type MasteringLane,
  type MasteringState,
  masteringMutators as m,
  masteringTargetLufs,
} from '@/demos/mastering/masteringState';
import { applyOps, createFacadeTarget, createRawTarget } from '@/utils/engineApply';
import {
  createFacadeLoopback,
  createRawEngine,
  type FacadeLoopback,
  loadIndexModule,
  noise,
  RENDER_QUANTUM,
  toDb,
} from '../../wasm/support/engineHarness';

const SR = 48_000;
const SECONDS = 4;

const facades: FacadeLoopback[] = [];
afterEach(() => {
  for (const f of facades.splice(0)) f.dispose();
});

function interleave(left: Float32Array, right: Float32Array): Float32Array {
  const out = new Float32Array(left.length * 2);
  for (let i = 0; i < left.length; i++) {
    out[2 * i] = left[i];
    out[2 * i + 1] = right[i];
  }
  return out;
}

async function lufs(left: Float32Array, right: Float32Array): Promise<number> {
  const wasm = await loadIndexModule();
  return wasm.lufsInterleaved(interleave(left, right), 2, SR).integratedLufs;
}

/** A continuous programme (no gaps) at `gain`: pulsed bass, chords, hiss. */
async function clip(seed: number, gain: number, pitch = 1): Promise<MasteringClip> {
  const n = SECONDS * SR;
  const hissL = noise(SECONDS, seed, SR, 0.06);
  const hissR = noise(SECONDS, seed + 1, SR, 0.06);
  const left = new Float32Array(n);
  const right = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const pulse = 0.6 + 0.4 * Math.exp(-(t % 0.25) * 10);
    const bass = Math.sin(2 * Math.PI * 65 * pitch * t) * pulse;
    left[i] = gain * (0.35 * bass + 0.12 * Math.sin(2 * Math.PI * 330 * pitch * t) + hissL[i]);
    right[i] = gain * (0.3 * bass + 0.12 * Math.sin(2 * Math.PI * 415 * pitch * t) + hissR[i]);
  }
  return { left, right, sampleRate: SR, integratedLufs: await lufs(left, right) };
}

const refAudio = (reference: MasteringClip) => ({
  id: 'ref',
  fileName: 'ref.wav',
  sampleRate: SR,
  frames: reference.left.length,
  channels: 2,
});

/** The After lane's loudness as the fit records it: the export render at unity. */
async function withMeasuredAfter(
  state: MasteringState,
  program: MasteringClip,
): Promise<MasteringState> {
  const wasm = await loadIndexModule();
  const render = renderMasteringState(wasm, state, program);
  const measuredLufs = await lufs(render.left, render.right);
  const targetLufs = masteringTargetLufs(state);
  return m.applyLoudnessFit(state, {
    targetLufs,
    driveDb: 0,
    measuredLufs,
    residualLu: targetLufs - measuredLufs,
    bounces: 1,
    limited: false,
  });
}

/** Lane 1's plugin delay, which every lane is compensated to, as the engine reports it. */
async function laneLatency(state: MasteringState): Promise<number> {
  const raw = await createRawEngine(SR);
  try {
    applyOps(createRawTarget(raw), buildFull(state, { program: null, reference: null }, 'export'));
    return Math.round(raw.graphLatencySamplesQ8() / 256);
  } finally {
    raw.destroy();
  }
}

describe('lane match gains', () => {
  const state = defaultMasteringState();
  const fake = (integratedLufs: number): MasteringClip => ({
    left: new Float32Array(1),
    right: new Float32Array(1),
    sampleRate: SR,
    integratedLufs,
  });
  const fitted = (measuredLufs: number) =>
    m.applyLoudnessFit(state, {
      targetLufs: -14,
      driveDb: 0,
      measuredLufs,
      residualLu: 0,
      bounces: 2,
      limited: false,
    });

  // Exhaustive: after loudness (known loud / known quiet / unknown) × reference
  // (none / loaded) × matching (on / off) × monitored lane.
  const afters = [-9, -22, null] as const;
  const cases = afters.flatMap((after) =>
    [false, true].flatMap((reference) =>
      [true, false].flatMap((match) =>
        MASTERING_LANES.map((lane) => ({ after, reference, match, lane })),
      ),
    ),
  );

  it.each(cases)(
    '$after LUFS after, reference $reference, match $match, monitor $lane',
    ({ after, reference, match, lane }) => {
      let s = after === null ? state : fitted(after);
      if (reference)
        s = m.setReference(s, { id: 'r', fileName: 'r', sampleRate: SR, frames: 1, channels: 2 });
      s = m.setMonitorLane(m.setMatchLoudness(s, match), lane);
      const audio: MasteringAudio = { program: fake(-16), reference: reference ? fake(-12) : null };
      const gains = laneMatchGains(s, audio);
      for (const value of Object.values(gains)) expect(value).toBeLessThanOrEqual(0);
      if (!match) expect(gains).toEqual({ after: 0, before: 0, reference: 0 });
      if (match) {
        const levels = {
          after: after ?? Number.NaN,
          before: -16,
          reference: reference ? -12 : Number.NaN,
        };
        const known = MASTERING_LANES.filter((l) => Number.isFinite(levels[l]));
        const matched = known.map((l) => levels[l] + gains[l]);
        for (const value of matched)
          expect(value).toBeCloseTo(Math.min(...known.map((l) => levels[l])), 9);
      }
      const faders = laneFaders(s, audio);
      const heard = s.monitor.lane;
      for (const l of MASTERING_LANES) expect(faders[l]).toBe(l === heard ? gains[l] : LANE_OFF_DB);
    },
  );
});

describe('matched lanes play at the same integrated loudness', () => {
  it.each([
    ['a quiet programme (After is turned down)', 0.25],
    ['a hot programme (Before is turned down)', 3],
  ])('%s', { timeout: 120_000 }, async (_label, programGain) => {
    const program = await clip(31, programGain);
    const reference = await clip(47, 0.7, 1.5);
    const audio: MasteringAudio = { program, reference };
    const base = m.setReference(defaultMasteringState(), refAudio(reference));
    const state = await withMeasuredAfter(base, program);
    const gains = laneMatchGains(state, audio);
    for (const lane of MASTERING_LANES) expect(gains[lane]).toBeLessThanOrEqual(0);

    const latency = await laneLatency(state);
    const total = Math.ceil((SECONDS * SR + latency) / RENDER_QUANTUM) * RENDER_QUANTUM;
    const heard: Record<MasteringLane, number> = { after: 0, before: 0, reference: 0 };
    for (const lane of MASTERING_LANES) {
      const raw = await createRawEngine(SR);
      try {
        applyOps(createRawTarget(raw), buildFull(m.setMonitorLane(state, lane), audio, 'preview'));
        raw.settleParameters();
        raw.play();
        const [left, right] = raw.renderOffline(
          [new Float32Array(total), new Float32Array(total)],
          RENDER_QUANTUM,
        );
        const span = SECONDS * SR;
        heard[lane] = await lufs(
          left.subarray(latency, latency + span),
          right.subarray(latency, latency + span),
        );
      } finally {
        raw.destroy();
      }
    }
    expect(Math.abs(heard.after - heard.before)).toBeLessThanOrEqual(0.1);
    expect(Math.abs(heard.reference - heard.before)).toBeLessThanOrEqual(0.1);
    // Matching does something here: the unmatched lanes differ by more than the tolerance.
    expect(Math.abs(state.loudness.fit!.measuredLufs - program.integratedLufs)).toBeGreaterThan(1);
  });
});

describe('switching lanes while playing', () => {
  it('never drops a 128-frame block below -60 dBFS while the source is above -20 dBFS', {
    timeout: 120_000,
  }, async () => {
    const program = await clip(5, 0.8);
    const reference = await clip(9, 0.5, 1.5);
    const audio: MasteringAudio = { program, reference };
    let state = await withMeasuredAfter(
      m.setReference(defaultMasteringState(), refAudio(reference)),
      program,
    );
    const latency = await laneLatency(state);

    const f = await createFacadeLoopback({ sampleRate: SR });
    facades.push(f);
    const target = createFacadeTarget(f.engine);
    applyOps(target, buildFull(state, audio, 'preview'));
    f.engine.transport.play();
    const switches: MasteringLane[] = [
      'before',
      'reference',
      'after',
      'reference',
      'before',
      'after',
    ];
    const segment =
      Math.floor((SECONDS * SR) / (switches.length + 1) / RENDER_QUANTUM) * RENDER_QUANTUM;
    const left = new Float32Array(segment * (switches.length + 1));
    const right = new Float32Array(left.length);
    let at = 0;
    for (const lane of [...switches, null]) {
      const out = f.render(segment);
      left.set(out.left, at);
      right.set(out.right, at);
      at += segment;
      if (lane) {
        const next = m.setMonitorLane(state, lane);
        applyOps(target, diff(state, next, audio).ops);
        state = next;
      }
    }
    expect(f.syncErrors).toEqual([]);

    const blockDb = (l: Float32Array, r: Float32Array, start: number) => {
      let sum = 0;
      for (let i = start; i < start + RENDER_QUANTUM; i++) sum += l[i] * l[i] + r[i] * r[i];
      return toDb(Math.sqrt(sum / (2 * RENDER_QUANTUM)));
    };
    let loudBlocks = 0;
    let quietest = 0;
    for (let start = latency; start + RENDER_QUANTUM <= left.length; start += RENDER_QUANTUM) {
      const source = start - latency;
      if (source + RENDER_QUANTUM > program.left.length) break;
      if (blockDb(program.left, program.right, source) <= -20) continue;
      loudBlocks++;
      quietest = Math.min(quietest, blockDb(left, right, start));
    }
    expect(loudBlocks).toBeGreaterThan(1000);
    expect(quietest).toBeGreaterThan(-60);
  });
});
