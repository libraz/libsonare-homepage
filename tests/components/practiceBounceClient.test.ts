import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildBouncePayload, createBounceClient } from '@/components/practice/bounceClient';
import type { ParsedMidi } from '@/components/practice/midiSmf';

const midi = {
  notes: [
    { midi: 60, velocity: 100, startSec: 0, endSec: 0.5, startBeat: 0, endBeat: 1 },
    { midi: 64, velocity: 80, startSec: 0.5, endSec: 1, startBeat: 1, endBeat: 2 },
  ],
  tempoSegments: [{ startBeat: 0, bpm: 120 }],
  durationSec: 1,
  durationBeats: 2,
} as unknown as ParsedMidi;

describe('buildBouncePayload', () => {
  it('flattens a movement into a serializable, transferable-friendly worker payload', () => {
    const payload = buildBouncePayload(midi, {
      source: 'synth',
      sf2Url: '/sf2/acoustic-grand.sf2',
      synthPreset: 'acoustic-piano',
      sampleRate: 44_100,
      speed: 0.75,
      tailSec: 1.6,
    });
    expect(payload.source).toBe('synth');
    expect(payload.speed).toBe(0.75);
    expect(payload.durationBeats).toBe(2);
    // Only the beat-timed fields the worker needs are carried over per note.
    expect(payload.notes).toEqual([
      { midi: 60, velocity: 100, startBeat: 0, endBeat: 1 },
      { midi: 64, velocity: 80, startBeat: 1, endBeat: 2 },
    ]);
    expect(payload.tempoSegments).toEqual([{ startBeat: 0, bpm: 120 }]);
    // The payload is a fresh structure — mutating it must not touch the source midi.
    payload.notes[0].midi = 0;
    expect(midi.notes[0].midi).toBe(60);
  });
});

describe('createBounceClient recovery', () => {
  class WorkerMock {
    static instances: WorkerMock[] = [];
    onmessage: ((event: MessageEvent<any>) => void) | null = null;
    onerror: ((event: ErrorEvent) => void) | null = null;
    messages: any[] = [];
    terminate = vi.fn();
    throwOnPost = false;

    constructor() {
      WorkerMock.instances.push(this);
    }

    postMessage(message: any) {
      if (this.throwOnPost) throw new Error('post failed');
      this.messages.push(message);
    }

    crash(message = 'worker crashed') {
      this.onerror?.({ message } as ErrorEvent);
    }

    finish(index = 0) {
      const request = this.messages[index];
      this.onmessage?.({
        data: { id: request.id, pcm: new Float32Array([0.1]), version: 'test' },
      } as MessageEvent);
    }
  }

  const payload = buildBouncePayload(midi, {
    source: 'synth',
    sf2Url: '',
    synthPreset: 'piano',
    sampleRate: 44_100,
    speed: 1,
    tailSec: 1,
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    WorkerMock.instances = [];
  });

  it('rejects pending work and creates a fresh worker after a fatal error', async () => {
    vi.stubGlobal('Worker', WorkerMock);
    const client = createBounceClient();
    const first = client.bounce(payload);
    WorkerMock.instances[0].crash();
    await expect(first).rejects.toThrow('worker crashed');
    expect(WorkerMock.instances[0].terminate).toHaveBeenCalled();

    const second = client.bounce(payload);
    expect(WorkerMock.instances).toHaveLength(2);
    WorkerMock.instances[1].finish();
    await expect(second).resolves.toMatchObject({ version: 'test' });
    client.dispose();
  });

  it('invalidates a worker whose postMessage throws and can retry', async () => {
    vi.stubGlobal('Worker', WorkerMock);
    const client = createBounceClient();
    // Force creation, then crash it so the next worker can be configured before use.
    const first = client.bounce(payload);
    WorkerMock.instances[0].crash('bootstrap failed');
    await expect(first).rejects.toThrow('bootstrap failed');

    const originalConstructor = globalThis.Worker;
    class ThrowingWorker extends WorkerMock {
      constructor() {
        super();
        this.throwOnPost = true;
      }
    }
    vi.stubGlobal('Worker', ThrowingWorker);
    await expect(client.bounce(payload)).rejects.toThrow('post failed');
    expect(WorkerMock.instances.at(-1)!.terminate).toHaveBeenCalled();
    vi.stubGlobal('Worker', originalConstructor);

    const retry = client.bounce(payload);
    WorkerMock.instances.at(-1)!.finish();
    await expect(retry).resolves.toMatchObject({ version: 'test' });
    client.dispose();
  });

  it('settles pending work on dispose and refuses later requests', async () => {
    vi.stubGlobal('Worker', WorkerMock);
    const client = createBounceClient();
    const pending = client.bounce(payload);
    client.dispose();
    await expect(pending).rejects.toThrow('disposed');
    await expect(client.bounce(payload)).rejects.toThrow('disposed');
  });
});
