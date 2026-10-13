// @vitest-environment node
/**
 * The /mastering Worker against the real engine, through its message loop and
 * through the typed client: every job hands its clips back (finished, failed
 * or cancelled), the loudness fit reaches its target or reports why not, and
 * the export is the fitted master.
 */
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import type {
  MasteringAudioTransfer,
  MasteringWorkerRequest,
  MasteringWorkerResponse,
} from '@/demos/mastering/mastering.worker';
import {
  type MasteringClip,
  measureLufs,
  renderMasteringState,
} from '@/demos/mastering/masteringEngine';
import {
  defaultMasteringState,
  isLoudnessFitStale,
  MASTERING_SLOT,
  type MasteringRepair,
  masteringMutators as m,
} from '@/demos/mastering/masteringState';
import {
  createMasteringWorkerClient,
  type MasteringAudioRegistry,
} from '@/demos/mastering/masteringWorkerClient';
import { WorkerJobCancelled } from '@/utils/workerRpc';
import { loadIndexModule, noise } from '../../wasm/support/engineHarness';

const SR = 48_000;
const SECONDS = 3;

// ---------------------------------------------------------------------------
// An in-process Worker: both ends structured-clone with transfer, deliver
// asynchronously, and the worker end is the module's own `self`.

type Listener = (event: { data: unknown }) => void;
const replies: MasteringWorkerResponse[] = [];
let clientOnMessage: Listener | null = null;
const replyWaiters: Array<() => void> = [];

const scope = {
  onmessage: null as null | ((event: { data: unknown }) => void),
  postMessage(message: MasteringWorkerResponse, options?: { transfer?: Transferable[] }) {
    const data = structuredClone(message, { transfer: options?.transfer ?? [] });
    replies.push(data);
    queueMicrotask(() => {
      clientOnMessage?.({ data });
      for (const wake of replyWaiters.splice(0)) wake();
    });
  },
};

class InProcessWorker {
  static created = 0;
  constructor() {
    InProcessWorker.created++;
  }
  set onmessage(listener: Listener | null) {
    clientOnMessage = listener;
  }
  onerror: unknown = null;
  postMessage(message: unknown, transfer: Transferable[] = []) {
    const data = structuredClone(message, { transfer });
    queueMicrotask(() => scope.onmessage?.({ data }));
  }
  terminate() {}
}

beforeAll(async () => {
  Object.defineProperty(globalThis, 'self', { configurable: true, value: scope });
  Object.defineProperty(globalThis, 'Worker', { configurable: true, value: InProcessWorker });
  await loadIndexModule();
  await import('@/demos/mastering/mastering.worker');
}, 30_000);

afterEach(() => {
  replies.length = 0;
});

/** Resolves with the terminal reply to request `id`. */
async function waitFor(id: number): Promise<MasteringWorkerResponse> {
  for (;;) {
    const reply = replies.find((r) => r.id === id && r.type !== 'progress');
    if (reply) return reply;
    await new Promise<void>((resolve) => replyWaiters.push(resolve));
  }
}

/** Sends one request to the worker loop and resolves with its terminal reply. */
function send(
  request: Exclude<MasteringWorkerRequest, { type: 'cancel' }>,
  transfer: Transferable[] = [],
) {
  new InProcessWorker().postMessage(request, transfer);
  return waitFor(request.id);
}

function programPcm(seed: number, gain = 1, rate = SR): MasteringClip {
  const n = Math.round(SECONDS * rate);
  const hissL = noise(SECONDS, seed, rate, 0.05);
  const hissR = noise(SECONDS, seed + 1, rate, 0.05);
  const left = new Float32Array(n);
  const right = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / rate;
    const kick = Math.sin(2 * Math.PI * 55 * t) * Math.exp(-(t % 0.5) * 12);
    left[i] = gain * (0.35 * kick + 0.12 * Math.sin(2 * Math.PI * 220 * t) + hissL[i]);
    right[i] = gain * (0.3 * kick + 0.12 * Math.sin(2 * Math.PI * 277 * t) + hissR[i]);
  }
  return { left, right, sampleRate: rate, integratedLufs: Number.NaN };
}

const buffersOf = (audio: MasteringAudioTransfer) =>
  [
    ...new Set(Object.values(audio).flatMap((c) => (c ? [c.left.buffer, c.right.buffer] : []))),
  ] as Transferable[];

const noRepair = (): MasteringRepair => defaultMasteringState().repair;

let nextId = 1000;

describe('worker jobs', () => {
  it('prepare without repair stages measures the source and plays it as the programme', async () => {
    const source = programPcm(1);
    const audio = { source };
    const reply = await send(
      { type: 'prepare', id: ++nextId, audio, repair: noRepair() },
      buffersOf(audio),
    );
    expect(source.left.byteLength).toBe(0);
    if (reply.type !== 'prepared') throw new Error(reply.type);
    expect(reply.result.stages).toEqual([]);
    expect(reply.audio.program?.left).toBe(reply.audio.source?.left);
    expect(reply.audio.program?.integratedLufs).toBeGreaterThan(-40);
    expect(reply.audio.source?.left.length).toBe(SECONDS * SR);
  });

  it('prepare runs only the enabled repair stages, with progress', async () => {
    const audio = { source: programPcm(2) };
    const repair = m.setRepairStageEnabled(defaultMasteringState(), 'denoise', true).repair;
    const id = ++nextId;
    const reply = await send({ type: 'prepare', id, audio, repair }, buffersOf(audio));
    if (reply.type !== 'prepared')
      throw new Error(reply.type === 'error' ? reply.error : reply.type);
    expect(reply.result.stages).toEqual(['denoise']);
    expect(reply.audio.program?.left).not.toBe(reply.audio.source?.left);
    expect(reply.audio.program?.left.length).toBe(SECONDS * SR);
    expect(
      replies.some((r) => r.id === id && r.type === 'progress' && r.stage === 'repairing'),
    ).toBe(true);
  });

  it('fit reaches the target within the reach tolerance in at most three bounces', async () => {
    const audio = { program: programPcm(3, 0.5) };
    const reply = await send(
      { type: 'fit', id: ++nextId, audio, state: defaultMasteringState() },
      buffersOf(audio),
    );
    if (reply.type !== 'fitted') throw new Error(reply.type === 'error' ? reply.error : reply.type);
    const fit = reply.result;
    expect(fit.targetLufs).toBe(-14);
    expect(fit.bounces).toBeGreaterThanOrEqual(2);
    expect(fit.bounces).toBeLessThanOrEqual(3);
    expect(Math.abs(fit.residualLu)).toBeLessThanOrEqual(0.5);
    expect(fit.limited).toBe(false);
    expect(reply.audio.program?.left.length).toBe(SECONDS * SR);
  });

  it('fit reports a target the limiter cannot reach', async () => {
    const audio = { program: programPcm(4, 0.5) };
    const state = m.setCustomLufs(defaultMasteringState(), -8);
    const hot = m.setInsertParam(state, MASTERING_SLOT.limiter, 'ceilingDb', -6);
    const reply = await send({ type: 'fit', id: ++nextId, audio, state: hot }, buffersOf(audio));
    if (reply.type !== 'fitted') throw new Error(reply.type === 'error' ? reply.error : reply.type);
    expect(reply.result.bounces).toBe(3);
    expect(reply.result.limited).toBe(true);
    expect(reply.result.residualLu).toBeGreaterThan(0.5);
  });

  it('measure returns the program loudness and the After render loudness', async () => {
    const wasm = await loadIndexModule();
    const program = programPcm(7, 0.5);
    const state = m.setInsertParam(defaultMasteringState(), MASTERING_SLOT.input, 'levelDb', 4);
    const expectedProgram = measureLufs(wasm, program.left, program.right, SR);
    const render = renderMasteringState(wasm, state, program);
    const expectedAfter = measureLufs(wasm, render.left, render.right, SR);
    const audio = { program };
    const reply = await send({ type: 'measure', id: ++nextId, audio, state }, buffersOf(audio));
    if (reply.type !== 'measured')
      throw new Error(reply.type === 'error' ? reply.error : reply.type);
    expect(reply.result.programLufs).toBe(expectedProgram);
    expect(reply.result.afterLufs).toBe(expectedAfter);
    expect(reply.result.afterLufs - reply.result.programLufs).toBeGreaterThan(2);
    expect(reply.audio.program?.integratedLufs).toBe(expectedProgram);
    expect(reply.audio.program?.left.length).toBe(SECONDS * SR);
  });

  it('export refits, renders with dither and measures the master', async () => {
    const audio = { program: programPcm(5, 0.5) };
    const state = defaultMasteringState();
    const reply = await send(
      {
        type: 'export',
        id: ++nextId,
        audio,
        state,
        options: { dither: 2, ditherBits: 16 },
        refit: true,
      },
      buffersOf(audio),
    );
    if (reply.type !== 'exported')
      throw new Error(reply.type === 'error' ? reply.error : reply.type);
    const { result } = reply;
    expect(result.fit).not.toBeNull();
    expect(Math.abs(result.integratedLufs - -14)).toBeLessThanOrEqual(0.5);
    expect(result.truePeakDb).toBeLessThanOrEqual(-1 + 0.05);
    expect(result.loudnessRange).toBeGreaterThanOrEqual(0);
    expect(result.shortTermLufs.length).toBeGreaterThan(0);
    expect(reply.audio.master?.left.length).toBe(SECONDS * SR);
    expect(reply.audio.program?.left.length).toBe(SECONDS * SR);

    // The fit written back is current, and exporting that state again needs no refit.
    const fitted = m.applyLoudnessFit(state, result.fit!);
    expect(isLoudnessFitStale(m.setSource(fitted, null))).toBe(false);
    const again = await send(
      {
        type: 'export',
        id: ++nextId,
        audio: { program: reply.audio.program },
        state: fitted,
        options: { dither: 0 },
        refit: false,
      },
      buffersOf({ program: reply.audio.program }),
    );
    if (again.type !== 'exported') throw new Error(again.type);
    expect(again.result.fit).toBeNull();
    expect(Math.abs(again.result.integratedLufs - result.integratedLufs)).toBeLessThan(0.05);
  });

  it('assistant returns the flat chain suggestion and what it cannot carry', async () => {
    const audio = { program: programPcm(6) };
    const reply = await send(
      { type: 'assistant', id: ++nextId, audio, preset: 'pop' },
      buffersOf(audio),
    );
    if (reply.type !== 'assisted')
      throw new Error(reply.type === 'error' ? reply.error : reply.type);
    expect(typeof reply.result.chainParams['dynamics.compressor.ratio']).toBe('number');
    expect(reply.result.unmapped.every((key) => key.startsWith('loudness.'))).toBe(true);
    expect(reply.result.profile).toHaveProperty('loudness');
    expect(reply.result.suggestions).toHaveProperty('chainConfig');
  });

  it('reference analyses a 44.1 kHz file at its own rate and fits a match EQ', async () => {
    const audio = { program: programPcm(7), reference: programPcm(8, 0.7, 44_100) };
    const reply = await send({ type: 'reference', id: ++nextId, audio }, buffersOf(audio));
    if (reply.type !== 'referenced')
      throw new Error(reply.type === 'error' ? reply.error : reply.type);
    const reference = reply.audio.reference!;
    expect(reference.sampleRate).toBe(44_100);
    expect(reference.left.length).toBe(SECONDS * 44_100);
    expect(Number.isFinite(reference.integratedLufs)).toBe(true);
    expect(reply.result.loudness.gainToMatchDb).toBeCloseTo(
      reply.result.loudness.referenceLufs - reply.result.loudness.sourceLufs,
      9,
    );
    expect(reply.result.matchEq.bands).toHaveLength(4);
  });

  it('platform preview echoes each requested target and ceiling onto its row', async () => {
    const audio = { master: programPcm(9) };
    const platforms = [
      { name: 'spotify', targetLufs: -14, ceilingDb: -1 },
      { name: 'apple', targetLufs: -16, ceilingDb: -1 },
    ];
    const reply = await send(
      { type: 'platformPreview', id: ++nextId, audio, platforms },
      buffersOf(audio),
    );
    if (reply.type !== 'previewed')
      throw new Error(reply.type === 'error' ? reply.error : reply.type);
    expect(reply.result.map((row) => [row.name, row.targetLufs, row.ceilingDb])).toEqual([
      ['spotify', -14, -1],
      ['apple', -16, -1],
    ]);
  });

  it('a failing job reports the error and hands the audio back', async () => {
    const audio = { source: programPcm(10) };
    const reply = await send(
      { type: 'fit', id: ++nextId, audio, state: defaultMasteringState() },
      buffersOf(audio),
    );
    expect(reply.type).toBe('error');
    if (reply.type === 'error') expect(reply.error).toMatch(/program/);
    expect(reply.audio.source?.left.length).toBe(SECONDS * SR);
  });

  it('a cancelled job stops at the next stage and hands the audio back', async () => {
    const audio = { program: programPcm(11) };
    const id = ++nextId;
    const worker = new InProcessWorker();
    worker.postMessage(
      { type: 'fit', id, audio, state: defaultMasteringState() },
      buffersOf(audio),
    );
    worker.postMessage({ type: 'cancel', id });
    const reply = await waitFor(id);
    expect(reply.type).toBe('cancelled');
    expect(reply.type === 'cancelled' && reply.audio.program?.left.length).toBe(SECONDS * SR);
  });
});

describe('worker client', () => {
  function registry(): MasteringAudioRegistry {
    return new Map([['program', { ...programPcm(12, 0.5), integratedLufs: -20 }]]);
  }

  it('lends the clips to the job and puts them back, with what the job made', async () => {
    const client = createMasteringWorkerClient();
    const audio = registry();
    const program = audio.get('program')!;
    const progress: string[] = [];
    const job = client.bounce(audio, defaultMasteringState(), { dither: 0 }, true, (_p, stage) =>
      progress.push(stage),
    );
    // Transferred: the page holds no copy while the job runs.
    expect(program.left.byteLength).toBe(0);
    const result = await job.result;
    expect(result.fit?.bounces).toBeGreaterThanOrEqual(2);
    expect(audio.get('program')?.left.length).toBe(SECONDS * SR);
    expect(audio.get('master')?.left.length).toBe(SECONDS * SR);
    expect(progress).toContain('fitting');
    expect(progress).toContain('rendering');
    client.dispose();
  });

  it('a cancel rejects with WorkerJobCancelled and the clips come back', async () => {
    const client = createMasteringWorkerClient();
    const audio = registry();
    const job = client.fit(audio, defaultMasteringState());
    job.cancel();
    await expect(job.result).rejects.toBeInstanceOf(WorkerJobCancelled);
    expect(audio.get('program')?.left.length).toBe(SECONDS * SR);
    client.dispose();
  });

  it('a job without its clip rejects with the worker error', async () => {
    const client = createMasteringWorkerClient();
    await expect(client.previewPlatforms(new Map(), []).result).rejects.toThrow(/master/);
    client.dispose();
  });

  it('dispose settles a job in flight', async () => {
    const client = createMasteringWorkerClient();
    const job = client.fit(registry(), defaultMasteringState());
    client.dispose();
    await expect(job.result).rejects.toThrow('Mastering worker disposed');
  });
});
