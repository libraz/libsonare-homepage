// @vitest-environment node
import { beforeAll, describe, expect, it } from 'vitest';
import * as wasm from '@/wasm/index.js';

/** Engine behaviour stated in mixing.md and mixing-scene-json.md. */

const SR = 48_000;
const BLOCK = 512;
const SETTLE_BLOCKS = 20;

function render(mixer: InstanceType<typeof wasm.Mixer>, value: number, blocks: number) {
  let out = { left: new Float32Array(BLOCK), right: new Float32Array(BLOCK) };
  for (let b = 0; b < blocks; b++) {
    const input = [new Float32Array(BLOCK).fill(value)];
    out = mixer.processStereo(input, [input[0].slice()]);
  }
  return out;
}

function monoStrip(panMode: number, panLaw: number, pan: number): [number, number] {
  const scene = JSON.stringify({
    version: 1,
    strips: [{ id: 'a', sourceLayout: 'mono', panMode, panLaw, pan }],
  });
  const mixer = wasm.Mixer.fromSceneJson(scene, SR, BLOCK);
  try {
    const out = render(mixer, 0.5, SETTLE_BLOCKS);
    const last = BLOCK - 1;
    return [out.left[last], out.right[last]];
  } finally {
    mixer.delete();
  }
}

beforeAll(async () => {
  await wasm.init();
});

describe('mono strip pan law', () => {
  const centreGains = [0.707, 0.595, 0.5, 1.0];

  it.each(centreGains.map((g, law) => [law, g]))(
    'balance mode is unity at centre under law %i',
    (law) => {
      const [l, r] = monoStrip(0, law, 0);
      expect(l).toBeCloseTo(0.5, 3);
      expect(r).toBeCloseTo(0.5, 3);
    },
  );

  it.each(centreGains.map((g, law) => [law, g]))(
    'stereoPan centre gain under law %i',
    (law, gain) => {
      const [l, r] = monoStrip(1, law, 0);
      expect(l / 0.5).toBeCloseTo(gain, 3);
      expect(r / 0.5).toBeCloseTo(gain, 3);
    },
  );

  it.each([0, 1, 2, 3])('stereoPan hard pan is unity on the near channel under law %i', (law) => {
    const [l, r] = monoStrip(1, law, -1);
    expect(l / 0.5).toBeCloseTo(1, 3);
    expect(Math.abs(r)).toBeLessThan(1e-3);
  });
});

describe('scene warnings', () => {
  it('names unread keys and still loads the scene', () => {
    const scene = JSON.stringify({
      version: 1,
      bar: 2,
      strips: [{ id: 'a', faderDB: -3 }],
      buses: [
        { id: 'master', role: 'master' },
        { id: 'sub', role: 'submix', foo: 1 },
      ],
    });
    const mixer = wasm.Mixer.fromSceneJson(scene, SR, BLOCK);
    try {
      const warnings = mixer.sceneWarnings().join('\n');
      expect(mixer.stripCount()).toBe(1);
      expect(warnings).toContain('bar');
      expect(warnings).toContain('strips[0].faderDB');
      expect(warnings).toContain('buses[1].foo');
    } finally {
      mixer.delete();
    }
  });

  it('a send to an undeclared bus loads and is audible through an implicit aux bus', () => {
    const scene = (dest: string) =>
      JSON.stringify({
        version: 1,
        strips: [
          {
            id: 'a',
            faderDb: -120,
            sends: [{ id: 's', destinationBusId: dest, sendDb: 0, timing: 'pre' }],
          },
        ],
        buses: [{ id: 'master', role: 'master' }],
      });
    const mixer = wasm.Mixer.fromSceneJson(scene('typo'), SR, BLOCK);
    try {
      const declaredBusCount = mixer.busCount();
      const out = render(mixer, 0.5, SETTLE_BLOCKS);
      const busCount = mixer.busCount();
      const peak = Math.max(...out.left.map(Math.abs));
      expect(declaredBusCount).toBe(1);
      // The implicit bus routes audio but is not counted by busCount().
      expect(busCount).toBe(1);
      expect(peak).toBeGreaterThan(0.01);
    } finally {
      mixer.delete();
    }
  });
});

describe('flushMeters', () => {
  it('raises true peak for a burst at the end of a block without moving the sample peak', () => {
    const mixer = wasm.Mixer.fromSceneJson(
      JSON.stringify({ version: 1, strips: [{ id: 'a' }] }),
      SR,
      BLOCK,
    );
    try {
      const burst = new Float32Array(BLOCK);
      burst.fill(0.9, BLOCK - 4);
      mixer.processStereo([burst], [burst.slice()]);
      const before = mixer.stripMeter(0);
      mixer.flushMeters();
      const after = mixer.stripMeter(0);
      expect(after.truePeakDbL).toBeGreaterThan(before.truePeakDbL);
      expect(after.peakDbL).toBe(before.peakDbL);
    } finally {
      mixer.delete();
    }
  });
});
