// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { buildSceneJson } from '@/demos/mixing/mixingScene';
import * as wasm from '@/wasm/index.js';

/**
 * The bounce runs for the dry length plus what the mixer reports as its tail and
 * latency. These hold those two numbers to the scene the demo builds, so a build
 * that stops counting the reverb or the channel delay truncates a test here
 * rather than every bounce's ending.
 */

const SAMPLE_RATE = 48_000;

function strip(overrides: Record<string, unknown> = {}) {
  return {
    id: 'a',
    inputTrimDb: 0,
    faderDb: 0,
    pan: 0,
    width: 1,
    polarityLeft: false,
    polarityRight: false,
    ...overrides,
  };
}

function graph(json: string) {
  const mixer = wasm.Mixer.fromSceneJson(json, SAMPLE_RATE, 512);
  try {
    return { tail: mixer.tailSamples(), latency: mixer.latencySamples() };
  } finally {
    mixer.delete();
  }
}

describe('mixer tail and latency', () => {
  it('counts the plate decay and its pre-delay as tail', async () => {
    await wasm.init();
    const { tail } = graph(
      buildSceneJson([strip({ reverbSendDb: -6 })], {
        enabled: true,
        decaySec: 2.5,
        preDelayMs: 20,
      }),
    );
    expect(tail).toBeGreaterThanOrEqual(2.52 * SAMPLE_RATE);
  });

  it('counts a channel delay as latency', async () => {
    await wasm.init();
    const { tail, latency } = graph(buildSceneJson([strip({ channelDelaySamples: 480 })]));
    expect(tail).toBe(0);
    expect(latency).toBe(480);
  });
});
