// @vitest-environment node
/**
 * /mastering preview = export: the same project state applied through the live
 * worklet facade and through the export Worker's raw engine renders the same
 * samples. Also pins the rtSafe table the state diff relies on against the
 * engine's own parameter metadata.
 */
import { afterEach, describe, expect, it } from 'vitest';
import {
  AFTER_STRIP,
  buildFull,
  diff,
  isRtSafeParam,
  MASTERING_NON_RT_PARAMS,
  type MasteringAudio,
  type MasteringClip,
  type MasteringRenderVariant,
  masteringLatencySamples,
  renderMasteringState,
} from '@/demos/mastering/masteringEngine';
import {
  defaultMasteringState,
  MASTERING_INSERT_LAYOUT,
  MASTERING_SLOT,
  type MasteringState,
  masteringMutators as m,
} from '@/demos/mastering/masteringState';
import type { MasteringPresetId, MasteringVenueId } from '@/demos/mastering/useMastering';
import { applyOps, createFacadeTarget, createRawTarget, type EngineOp } from '@/utils/engineApply';
import {
  createFacadeLoopback,
  createRawEngine,
  type FacadeLoopback,
  loadIndexModule,
  maxAbsDiff,
  noise,
  RENDER_QUANTUM,
  rms,
  type StereoBuffer,
} from '../../wasm/support/engineHarness';

const SR = 48_000;
const SECONDS = 1.5;

const facades: FacadeLoopback[] = [];
afterEach(() => {
  for (const f of facades.splice(0)) f.dispose();
});

/** Kick + bass + noise, decorrelated between channels: enough to drive every dynamics slot. */
function programPcm(seconds: number, seed: number): { left: Float32Array; right: Float32Array } {
  const n = Math.round(seconds * SR);
  const hissL = noise(seconds, seed, SR, 0.05);
  const hissR = noise(seconds, seed + 1, SR, 0.05);
  const left = new Float32Array(n);
  const right = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const kick = Math.sin(2 * Math.PI * 55 * t) * Math.exp(-(t % 0.5) * 12);
    left[i] = 0.4 * kick + 0.15 * Math.sin(2 * Math.PI * 220 * t) + hissL[i];
    right[i] = 0.35 * kick + 0.13 * Math.sin(2 * Math.PI * 277 * t) + hissR[i];
  }
  return { left, right };
}

async function clip(seconds: number, seed: number): Promise<MasteringClip> {
  const wasm = await loadIndexModule();
  const { left, right } = programPcm(seconds, seed);
  const interleaved = new Float32Array(left.length * 2);
  for (let i = 0; i < left.length; i++) {
    interleaved[2 * i] = left[i];
    interleaved[2 * i + 1] = right[i];
  }
  return {
    left,
    right,
    sampleRate: SR,
    integratedLufs: wasm.lufsInterleaved(interleaved, 2, SR).integratedLufs,
  };
}

const frames = (seconds: number) => Math.ceil((seconds * SR) / RENDER_QUANTUM) * RENDER_QUANTUM;

async function renderFacade(
  ops: EngineOp[],
  total: number,
  at?: { frame: number; ops: EngineOp[] },
) {
  const f = await createFacadeLoopback({ sampleRate: SR });
  facades.push(f);
  const target = createFacadeTarget(f.engine);
  applyOps(target, ops);
  f.engine.transport.play();
  if (!at) return { out: f.render(total), syncErrors: f.syncErrors };
  const lead = f.render(at.frame);
  applyOps(target, at.ops);
  return { out: concat(lead, f.render(total - at.frame)), syncErrors: f.syncErrors };
}

async function renderRaw(ops: EngineOp[], total: number, at?: { frame: number; ops: EngineOp[] }) {
  const raw = await createRawEngine(SR);
  try {
    const target = createRawTarget(raw);
    applyOps(target, ops);
    raw.play();
    // Chunks render with finalize off so the PDC delay lines carry over, as they do live.
    const block = (count: number, finalize: boolean): StereoBuffer => {
      const [left, right] = raw.renderOffline({
        channels: [new Float32Array(count), new Float32Array(count)],
        blockSize: RENDER_QUANTUM,
        finalize,
      });
      return { left, right };
    };
    if (!at) return block(total, true);
    const lead = block(at.frame, false);
    applyOps(target, at.ops);
    return concat(lead, block(total - at.frame, true));
  } finally {
    raw.destroy();
  }
}

function concat(a: StereoBuffer, b: StereoBuffer): StereoBuffer {
  const join = (x: Float32Array, y: Float32Array) => {
    const out = new Float32Array(x.length + y.length);
    out.set(x);
    out.set(y, x.length);
    return out;
  };
  return { left: join(a.left, b.left), right: join(a.right, b.right) };
}

const maxDiff = (a: StereoBuffer, b: StereoBuffer) =>
  Math.max(maxAbsDiff(a.left, b.left), maxAbsDiff(a.right, b.right));

describe('the rtSafe table matches the engine', () => {
  it('every layout parameter exists on its processor and agrees on rtSafe', async () => {
    const wasm = await loadIndexModule();
    for (const entry of MASTERING_INSERT_LAYOUT) {
      const info = new Map(
        wasm
          .masteringInsertParamInfo(entry.processor)
          .map((p: { name: string; rtSafe: boolean }) => [p.name, p.rtSafe]),
      );
      for (const name of Object.keys(entry.params)) {
        expect(info.has(name), `${entry.processor}.${name}`).toBe(true);
        expect(isRtSafeParam(entry.processor, name), `${entry.processor}.${name}`).toBe(
          info.get(name),
        );
      }
      for (const name of MASTERING_NON_RT_PARAMS[entry.processor]) {
        expect(info.get(name), `${entry.processor}.${name} is construction-only`).toBe(false);
      }
    }
  });

  it('every slot is a realtime insert', { timeout: 60_000 }, async () => {
    const wasm = await loadIndexModule();
    const catalog = new Map(
      wasm
        .masteringProcessorCatalog()
        .map((e: { id: string; realtimeInsertable: boolean }) => [e.id, e.realtimeInsertable]),
    );
    for (const entry of MASTERING_INSERT_LAYOUT)
      expect(catalog.get(entry.processor), entry.processor).toBe(true);
  });
});

describe('state diff', () => {
  const audio: MasteringAudio = { program: null, reference: null };

  it('sends an rtSafe change by name and a construction-only change as strip JSON', () => {
    const base = defaultMasteringState();
    const live = diff(
      base,
      m.setInsertParam(base, MASTERING_SLOT.compressor, 'thresholdDb', -24),
      audio,
    );
    expect(live.discrete).toBe(false);
    expect(live.ops).toEqual([
      {
        type: 'insertParam',
        strip: AFTER_STRIP,
        insertIndex: MASTERING_SLOT.compressor,
        name: 'thresholdDb',
        value: -24,
      },
    ]);

    const rebuilt = diff(
      base,
      m.setInsertParam(base, MASTERING_SLOT.limiter, 'lookaheadMs', 3),
      audio,
    );
    expect(rebuilt.discrete).toBe(true);
    expect(rebuilt.ops[0].type).toBe('strip');
    // A rebuild clears every bypass flag, so each bypassed slot is re-asserted.
    const bypassed = base.inserts.flatMap((insert, slot) => (insert.bypassed ? [slot] : []));
    expect(rebuilt.ops.slice(1)).toEqual(
      bypassed.map((insertIndex) => ({
        type: 'insertBypass',
        strip: AFTER_STRIP,
        insertIndex,
        bypassed: true,
      })),
    );
  });

  it('sends a boolean rtSafe parameter as 0/1', () => {
    const base = defaultMasteringState();
    const next = m.setInsertParam(base, MASTERING_SLOT.compressor, 'autoMakeup', false);
    expect(diff(base, next, audio).ops).toEqual([
      {
        type: 'insertParam',
        strip: AFTER_STRIP,
        insertIndex: MASTERING_SLOT.compressor,
        name: 'autoMakeup',
        value: 0,
      },
    ]);
  });

  it('emits nothing for a change that does not reach the engine', () => {
    const base = defaultMasteringState();
    expect(diff(base, m.setMode(base, 'studio'), audio)).toEqual({ ops: [], discrete: false });
  });
});

// Pairwise over preset × venue × variant × edit (L9 orthogonal array; the
// 2-level variant takes the 3-level column folded as preview/export/preview,
// which keeps every pair covered).
const PRESETS: MasteringPresetId[] = ['pop', 'hiphop', 'speech'];
const VENUES: MasteringVenueId[] = ['studio', 'livehouseSmall', 'livehouseLarge'];
const VARIANTS: MasteringRenderVariant[] = ['preview', 'export', 'preview'];
type Edit = 'none' | 'rtParam' | 'discrete';
const EDITS: Edit[] = ['none', 'rtParam', 'discrete'];
const L9 = [
  [0, 0, 0, 0],
  [0, 1, 1, 1],
  [0, 2, 2, 2],
  [1, 0, 1, 2],
  [1, 1, 2, 0],
  [1, 2, 0, 1],
  [2, 0, 2, 1],
  [2, 1, 0, 2],
  [2, 2, 1, 0],
];

function edited(state: MasteringState, edit: Edit): MasteringState {
  if (edit === 'rtParam')
    return m.setMacro(m.setInsertBypassed(state, MASTERING_SLOT.tape, false), 'tone', 1.5);
  if (edit === 'discrete')
    return m.setInsertParam(state, MASTERING_SLOT.multiband, 'cutoff1Hz', 3000);
  return state;
}

describe('facade and raw adapters render the same mastering state', () => {
  it.each(L9.map(([p, v, k, e]) => [PRESETS[p], VENUES[v], VARIANTS[k], EDITS[e]] as const))(
    '%s / %s / %s / edit %s',
    async (preset, venue, variant, edit) => {
      const program = await clip(SECONDS, 11);
      const reference = await clip(SECONDS, 23);
      const audio: MasteringAudio = { program, reference };
      let state = m.selectVenue(m.selectPreset(defaultMasteringState(), preset), venue);
      state = m.setReference(state, {
        id: 'ref',
        fileName: 'ref.wav',
        sampleRate: SR,
        frames: reference.left.length,
        channels: 2,
      });
      const next = edited(state, edit);

      if (variant === 'export') {
        // The export renders lane 1 alone on a fresh engine, latency removed.
        const wasm = await loadIndexModule();
        const latency = masteringLatencySamples(wasm, next, SR);
        const total = frames(SECONDS + latency / SR);
        const live = await renderFacade(buildFull(next, audio, 'export'), total);
        expect(live.syncErrors).toEqual([]);
        const exported = renderMasteringState(wasm, next, program);
        const n = exported.left.length;
        const aligned = {
          left: live.out.left.subarray(latency, latency + n),
          right: live.out.right.subarray(latency, latency + n),
        };
        expect(rms(exported.left)).toBeGreaterThan(1e-2);
        expect(maxDiff(aligned, exported)).toBeLessThanOrEqual(1e-7);
        return;
      }

      // The preview is three lanes; an edit lands mid-render on both engines.
      const total = frames(SECONDS);
      const at = { frame: frames(0.6), ops: diff(state, next, audio).ops };
      const live = await renderFacade(buildFull(state, audio, 'preview'), total, at);
      expect(live.syncErrors).toEqual([]);
      const raw = await renderRaw(buildFull(state, audio, 'preview'), total, at);
      expect(rms(raw.left)).toBeGreaterThan(1e-2);
      expect(maxDiff(live.out, raw)).toBeLessThanOrEqual(1e-7);
    },
    60_000,
  );
});

describe('a construction-only edit keeps the bypass flags', () => {
  it('a bypassed slot stays bypassed after the strip is rebuilt', async () => {
    const program = await clip(SECONDS, 5);
    const audio: MasteringAudio = { program, reference: null };
    // A -20 dB input stage, bypassed: if a rebuild dropped the flag the level would fall 20 dB.
    let state = m.setInsertParam(defaultMasteringState(), MASTERING_SLOT.input, 'levelDb', -20);
    state = m.setInsertBypassed(state, MASTERING_SLOT.input, true);
    const next = m.setInsertParam(state, MASTERING_SLOT.limiter, 'lookaheadMs', 3);
    const change = diff(state, next, audio);
    expect(change.discrete).toBe(true);
    const at = frames(0.5);
    const out = await renderRaw(buildFull(state, audio, 'preview'), frames(SECONDS), {
      frame: at,
      ops: change.ops,
    });
    const before = rms(out.left, frames(0.2), at);
    const after = rms(out.left, at + frames(0.3), frames(SECONDS));
    expect(Math.abs(20 * Math.log10(after / before))).toBeLessThan(3);
  });
});
