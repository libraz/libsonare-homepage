// @vitest-environment node
/**
 * The /mixing Worker's message protocol, run against the real engine: export
 * bounce with final meters and dither, assistant analysis, cancel and error,
 * and the PCM it was handed going back in every terminal message.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import type {
  MixAudioTransfer,
  MixWorkerRequest,
  MixWorkerResponse,
} from '@/demos/mixing/mixing.worker';
import { buildFull, exportFrames, MIX_TEMPO_BPM } from '@/demos/mixing/mixingEngine';
import {
  addTrack,
  createMixingState,
  type MixingState,
  setMasterSlotBypass,
  setSend,
} from '@/demos/mixing/mixingState';
import { applyOps, createRawTarget } from '@/utils/engineApply';
import { createRawEngine, noise, sine } from '../../wasm/support/engineHarness';

const SR = 48_000;

interface Posted {
  message: MixWorkerResponse;
  transfer: Transferable[];
}

const posted: Posted[] = [];
let assistantWindowSec: typeof import('@/demos/mixing/mixing.worker').assistantWindowSec;
const waiters = new Map<number, (message: MixWorkerResponse) => void>();

beforeAll(async () => {
  Object.defineProperty(globalThis, 'self', {
    configurable: true,
    value: {
      postMessage(message: MixWorkerResponse, options?: { transfer?: Transferable[] }) {
        posted.push({ message, transfer: options?.transfer ?? [] });
        if (message.type !== 'progress') waiters.get(message.id)?.(message);
      },
    },
  });
  // The worker module installs its message handler on `self` when imported.
  ({ assistantWindowSec } = await import('@/demos/mixing/mixing.worker'));
});

function send(request: MixWorkerRequest): void {
  (self as unknown as { onmessage: (event: { data: MixWorkerRequest }) => void }).onmessage({
    data: request,
  });
}

function settled(id: number): Promise<MixWorkerResponse> {
  return new Promise((resolve) => waiters.set(id, resolve));
}

function postedFor(id: number): Posted[] {
  return posted.filter((entry) => entry.message.id === id);
}

function project(): { state: MixingState; audio: MixAudioTransfer[] } {
  let state = createMixingState();
  state = addTrack(state, 'tone', 1);
  state = addTrack(state, 'noise', 1);
  state = setSend(state, 2, 'reverb', { levelDb: -6 });
  state = setMasterSlotBypass(state, 'limiter', false);
  return {
    state,
    audio: [
      { trackId: 1, channels: [sine(440, 1, SR, 0.4), sine(440, 1, SR, 0.4)], sampleRate: SR },
      { trackId: 2, channels: [noise(1, 3, SR, 0.3)], sampleRate: SR },
    ],
  };
}

let nextId = 100;

describe('mixing worker', () => {
  it('bounces with final meters and hands the audio back with the result', async () => {
    const { state, audio } = project();
    const id = nextId++;
    const done = settled(id);
    send({ type: 'bounce', id, state, audio, sampleRate: SR, options: { dither: 0 } });
    const reply = await done;
    expect(reply.type).toBe('bounced');
    if (reply.type !== 'bounced') return;

    const raw = await createRawEngine(SR);
    raw.setTempo(MIX_TEMPO_BPM);
    applyOps(createRawTarget(raw), buildFull(state, new Map(audio.map((t) => [t.trackId, t])), SR));
    const frames = exportFrames(state, SR, raw);
    raw.destroy();
    expect(reply.result.left.length).toBe(frames);
    expect(reply.result.right.length).toBe(frames);
    expect(reply.result.integratedLufs).toBeGreaterThan(-40);
    expect(reply.result.integratedLufs).toBeLessThan(0);
    expect(reply.result.truePeakDb).toBeLessThanOrEqual(-1 + 0.2);
    expect(Number.isFinite(reply.result.loudnessRange)).toBe(true);

    const stages = postedFor(id)
      .filter((p) => p.message.type === 'progress')
      .map((p) => (p.message.type === 'progress' ? p.message.stage : ''));
    expect(stages).toEqual(
      expect.arrayContaining(['loading', 'building', 'rendering', 'measuring']),
    );

    expect(reply.audio).toEqual(audio);
    const transfer = postedFor(id).at(-1)!.transfer;
    for (const buffer of [
      ...audio.flatMap((t) => t.channels.map((c) => c.buffer)),
      reply.result.left.buffer,
      reply.result.right.buffer,
    ]) {
      expect(transfer).toContain(buffer);
    }
  });

  it('dithers to the requested word length', async () => {
    const { state, audio } = project();
    const id = nextId++;
    const done = settled(id);
    send({
      type: 'bounce',
      id,
      state,
      audio,
      sampleRate: SR,
      options: { dither: 2, ditherBits: 16 },
    });
    const reply = await done;
    if (reply.type !== 'bounced') throw new Error(reply.type);
    const step = 2 ** -15;
    const offGrid = reply.result.left.filter(
      (v) => Math.abs(v / step - Math.round(v / step)) > 1e-3,
    ).length;
    expect(offGrid).toBe(0);
  });

  it('a cancel stops the job and still returns the audio', async () => {
    const { state, audio } = project();
    const id = nextId++;
    const done = settled(id);
    send({ type: 'bounce', id, state, audio, sampleRate: SR, options: { dither: 0 } });
    send({ type: 'cancel', id });
    const reply = await done;
    expect(reply.type).toBe('cancelled');
    expect(reply.type !== 'progress' && reply.audio).toEqual(audio);
    expect(postedFor(id).at(-1)!.transfer).toContain(audio[0].channels[0].buffer);
  });

  it('an engine error is reported and the audio still comes back', async () => {
    const { state, audio } = project();
    // A clip offset past the end of its source is refused by the engine.
    const broken: MixingState = {
      ...state,
      tracks: state.tracks.map((t) =>
        t.id === 1 ? { ...t, clip: { ...t.clip, trimStartSec: 5 } } : t,
      ),
    };
    const id = nextId++;
    const done = settled(id);
    send({ type: 'bounce', id, state: broken, audio, sampleRate: SR, options: { dither: 0 } });
    const reply = await done;
    expect(reply.type).toBe('error');
    if (reply.type !== 'error') return;
    expect(reply.error).toMatch(/offset/i);
    expect(reply.audio).toEqual(audio);
  });

  it('runs the assistant and returns the mapped proposal', async () => {
    const { state, audio } = project();
    const id = nextId++;
    const done = settled(id);
    send({ type: 'suggest', id, state, audio, sampleRate: SR });
    const reply = await done;
    expect(reply.type).toBe('suggested');
    if (reply.type !== 'suggested') return;
    expect(reply.result.analyzedSec).toBe(60);
    expect(Object.keys(reply.result.suggestion.patch.tracks).map(Number).sort()).toEqual([1, 2]);
    expect(reply.audio).toEqual(audio);
  });
});

describe('assistant analysis window', () => {
  const tracks = (count: number, channels: number, rate: number): MixAudioTransfer[] =>
    Array.from({ length: count }, (_, i) => ({
      trackId: i + 1,
      channels: Array.from({ length: channels }, () => new Float32Array(1)),
      sampleRate: rate,
    }));

  it('is the first 60 s while every track fits the engine input budget', () => {
    expect(assistantWindowSec(tracks(8, 2, 48_000), 48_000)).toBe(60);
    expect(assistantWindowSec([], 48_000)).toBe(60);
  });

  it('shrinks so eight stereo tracks at 96 kHz stay inside 64 Mi samples', () => {
    expect(assistantWindowSec(tracks(8, 2, 96_000), 96_000)).toBe(43);
  });
});
