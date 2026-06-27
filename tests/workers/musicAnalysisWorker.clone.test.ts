// Integration guard against the "Analysis failed" regression. The other
// music-analysis worker test mocks @/wasm/index.js with plain JS arrays and a
// postMessage stub that never clones, so it cannot reproduce the real failure:
// some WASM calls (detectKeyCandidates / analyzeSections) hand back embind
// value-marshalled arrays that Array.isArray accepts but structuredClone — i.e.
// the real postMessage that ferries a Worker's result to the page — rejects with
// "could not be cloned". A foreign array cannot be faked with property tricks
// (verified: a bogus .constructor still clones), so this test drives the worker
// against the REAL vendored WASM and asserts the posted result actually survives
// structuredClone, for both the mono and stereo metering paths.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as wasm from '@/wasm/index.js';

const SR = 22_050;

function tone(durationSec: number, channel: 'left' | 'right' = 'left'): Float32Array {
  const n = Math.floor(SR * durationSec);
  const out = new Float32Array(n);
  const detune = channel === 'right' ? 1.5 : 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    out[i] =
      0.3 * Math.sin(2 * Math.PI * (220 + detune) * t) + 0.2 * Math.sin(2 * Math.PI * 440 * t);
    if (i % Math.floor(0.5 * SR) < 80) out[i] += 0.4; // periodic clicks for structure/beats
  }
  return out;
}

interface Posted {
  message: { type: string; id: number; result?: unknown; error?: string };
  transfer?: Transferable[];
}

describe('music analysis worker — posted result is structured-cloneable (real WASM)', () => {
  let originalSelf: typeof globalThis.self;
  const posted: Posted[] = [];

  beforeAll(async () => {
    // Pre-init the shared WASM singleton with the binary (Node has no fetch/URL
    // path to it). The worker imports the same module and its no-arg init() is an
    // idempotent no-op once `module` is set.
    await wasm.init({ wasmBinary: readFileSync(join(process.cwd(), 'src/wasm/sonare.wasm')) });

    originalSelf = globalThis.self;
    Object.defineProperty(globalThis, 'self', {
      configurable: true,
      value: {
        postMessage: (message: Posted['message'], transfer?: Transferable[]) => {
          posted.push({ message, transfer });
        },
      },
    });
    // Import (and bind onmessage) once against the installed self stub.
    await import('@/workers/music-analysis.worker.ts');
  });

  afterAll(() => {
    Object.defineProperty(globalThis, 'self', { configurable: true, value: originalSelf });
  });

  async function analyze(request: Record<string, unknown>): Promise<Posted> {
    posted.length = 0;
    await (
      self as unknown as { onmessage: (e: { data: unknown }) => Promise<void> }
    ).onmessage({ data: request });
    const done = posted.at(-1);
    if (!done) throw new Error('worker posted no message');
    return done;
  }

  it('mono source: done result survives postMessage cloning', async () => {
    const done = await analyze({ type: 'analyze', id: 1, samples: tone(6), sampleRate: SR });

    expect(done.message.type).toBe('done');
    const result = done.message.result;
    expect(result).toBeDefined();
    // The exact assertion the mocked test cannot make: the embind arrays inside
    // keyCandidates / sections must be re-rooted to plain Arrays.
    expect(() => structuredClone(result)).not.toThrow();
  }, 30_000);

  it('stereo source: done result (incl. goniometer) survives postMessage cloning', async () => {
    const left = tone(6, 'left');
    const right = tone(6, 'right');
    const done = await analyze({
      type: 'analyze',
      id: 2,
      samples: left,
      sampleRate: SR,
      meterLeft: left.slice(0, 4096),
      meterRight: right.slice(0, 4096),
    });

    expect(done.message.type).toBe('done');
    expect(() => structuredClone(done.message.result)).not.toThrow();
  }, 30_000);
});
