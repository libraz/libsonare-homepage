import { afterEach, describe, expect, it } from 'vitest';
import type {
  TranscribeRequest,
  TranscribeResponse,
} from '@/demos/inline/archetypes/transcribe.worker';
import type { TranscriptionRender } from '@/demos/inline/archetypes/transcribePipeline';
import {
  createTranscribeWorkerClient,
  type TranscribeWorkerLike,
} from '@/demos/inline/archetypes/transcribeWorkerClient';

class FakeWorker implements TranscribeWorkerLike {
  onmessage: ((event: MessageEvent<TranscribeResponse>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  messages: TranscribeRequest[] = [];
  terminated = false;

  postMessage(message: TranscribeRequest): void {
    this.messages.push(message);
  }

  terminate(): void {
    this.terminated = true;
  }

  respond(response: TranscribeResponse): void {
    this.onmessage?.({ data: response } as MessageEvent<TranscribeResponse>);
  }

  fail(error: Error): void {
    this.onerror?.({ error, message: error.message } as ErrorEvent);
  }
}

function response(id: number): TranscribeResponse {
  return {
    id,
    type: 'done',
    events: [],
    notes: [],
    noteCount: 0,
    tempoBpm: 120,
    sampleRate: 32_000,
    sourceDurationSec: 0.25,
    pianoDurationSec: 1.45,
    piano: new Float32Array([0, 0.25]),
  };
}

function toRender(responseValue: TranscribeResponse): TranscriptionRender {
  if (responseValue.type !== 'done') throw new Error('test response must be done');
  return {
    events: responseValue.events,
    notes: responseValue.notes,
    noteCount: responseValue.noteCount,
    tempoBpm: responseValue.tempoBpm,
    sampleRate: responseValue.sampleRate,
    sourceDurationSec: responseValue.sourceDurationSec,
    pianoDurationSec: responseValue.pianoDurationSec,
    piano: responseValue.piano,
  };
}

let clients: Array<{ dispose(): void }> = [];

afterEach(() => {
  for (const client of clients) client.dispose();
  clients = [];
});

describe('transcribe worker client', () => {
  it('copies input samples before transferring them and resolves the current result', async () => {
    const worker = new FakeWorker();
    const client = createTranscribeWorkerClient({ createWorker: () => worker });
    clients.push(client);
    const input = new Float32Array([0.1, -0.2]);
    const promise = client.render(input, 32_000);

    expect(worker.messages).toHaveLength(1);
    expect(worker.messages[0].samples).not.toBe(input);
    expect([...worker.messages[0].samples]).toEqual([...input]);
    input[0] = 99;
    expect(worker.messages[0].samples[0]).toBeCloseTo(0.1);

    const expected = toRender(response(worker.messages[0].id));
    worker.respond(response(worker.messages[0].id));
    await expect(promise).resolves.toEqual(expected);
  });

  it('rejects a superseded promise and ignores its late response', async () => {
    const worker = new FakeWorker();
    const client = createTranscribeWorkerClient({ createWorker: () => worker });
    clients.push(client);

    const first = client.render(new Float32Array([1]), 32_000);
    const firstId = worker.messages[0].id;
    const second = client.render(new Float32Array([2]), 32_000);
    const secondId = worker.messages[1].id;

    await expect(first).rejects.toThrow('superseded');
    worker.respond(response(firstId));
    worker.respond(response(secondId));
    await expect(second).resolves.toMatchObject({ noteCount: 0, tempoBpm: 120 });
  });

  it('rejects pending work on worker errors and on disposal', async () => {
    const worker = new FakeWorker();
    const client = createTranscribeWorkerClient({ createWorker: () => worker });
    clients.push(client);
    const failed = client.render(new Float32Array([1]), 32_000);
    worker.fail(new Error('worker exploded'));
    await expect(failed).rejects.toThrow('worker exploded');
    expect(worker.terminated).toBe(true);

    const secondWorker = new FakeWorker();
    const secondClient = createTranscribeWorkerClient({ createWorker: () => secondWorker });
    clients.push(secondClient);
    const pending = secondClient.render(new Float32Array([1]), 32_000);
    secondClient.dispose();
    await expect(pending).rejects.toThrow('disposed');
    expect(secondWorker.terminated).toBe(true);
  });
});
