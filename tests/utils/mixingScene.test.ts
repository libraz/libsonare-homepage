import { describe, expect, it } from 'vitest';
import { buildSceneJson, REVERB_SEND_FLOOR, type SceneStripInput } from '@/utils/mixingScene';

function strip(overrides: Partial<SceneStripInput> = {}): SceneStripInput {
  return {
    id: 'drums',
    inputTrimDb: 0,
    faderDb: 0,
    pan: 0,
    width: 1,
    polarityLeft: false,
    polarityRight: false,
    ...overrides,
  };
}

describe('buildSceneJson', () => {
  it('routes every strip to the master bus', () => {
    const scene = JSON.parse(buildSceneJson([strip({ id: 'a' }), strip({ id: 'b' })]));
    expect(scene.buses).toEqual([{ id: 'master', role: 'master' }]);
    expect(scene.connections).toEqual([
      { source: 'a', destination: 'master' },
      { source: 'b', destination: 'master' },
    ]);
  });

  it('omits the reverb bus when reverb is disabled', () => {
    const scene = JSON.parse(
      buildSceneJson([strip({ reverbSendDb: -6 })], {
        enabled: false,
        decaySec: 2,
        preDelayMs: 20,
      }),
    );
    expect(scene.buses.some((b: any) => b.id === 'verb')).toBe(false);
    expect(scene.strips[0].sends).toEqual([]);
  });

  it('adds the reverb aux bus and send when enabled with an audible send', () => {
    const scene = JSON.parse(
      buildSceneJson([strip({ reverbSendDb: -6 })], { enabled: true, decaySec: 2, preDelayMs: 20 }),
    );
    expect(scene.buses.some((b: any) => b.id === 'verb' && b.role === 'aux')).toBe(true);
    expect(scene.connections).toContainEqual({ source: 'verb', destination: 'master' });
    expect(scene.strips[0].sends).toEqual([
      { id: 'drums-verb', destinationBusId: 'verb', sendDb: -6, timing: 'post' },
    ]);
  });

  it('does not create a reverb bus when all sends sit at the floor', () => {
    const scene = JSON.parse(
      buildSceneJson([strip({ reverbSendDb: REVERB_SEND_FLOOR })], {
        enabled: true,
        decaySec: 2,
        preDelayMs: 20,
      }),
    );
    expect(scene.buses.some((b: any) => b.id === 'verb')).toBe(false);
  });

  it('emits EQ inserts only when eqEnabled and a band is non-zero', () => {
    const off = JSON.parse(buildSceneJson([strip({ eqEnabled: false, eqTiltDb: 3 })]));
    expect(off.strips[0].inserts).toEqual([]);

    const on = JSON.parse(buildSceneJson([strip({ eqEnabled: true, eqTiltDb: 3, eqAirDb: 2 })]));
    const processors = on.strips[0].inserts.map((i: any) => i.processor);
    expect(processors).toContain('eq.tilt');
    expect(processors).toContain('spectral.airBand');
  });

  it('drops air-band insert for non-positive air values', () => {
    const scene = JSON.parse(buildSceneJson([strip({ eqEnabled: true, eqTiltDb: 0, eqAirDb: 0 })]));
    expect(scene.strips[0].inserts).toEqual([]);
  });

  it('includes only VCA groups that have members', () => {
    const scene = JSON.parse(
      buildSceneJson([strip({ id: 'kick', vcaGroup: 'drums' }), strip({ id: 'vox' })], undefined, [
        { id: 'drums', gainDb: -2 },
        { id: 'empty', gainDb: 0 },
      ]),
    );
    expect(scene.vcaGroups).toEqual([{ id: 'drums', gainDb: -2, members: ['kick'] }]);
  });

  it('clamps negative channel delay to zero and rounds to integer samples', () => {
    const scene = JSON.parse(
      buildSceneJson([
        strip({ channelDelaySamples: -5 }),
        strip({ id: 'b', channelDelaySamples: 12.7 }),
      ]),
    );
    expect(scene.strips[0].channelDelaySamples).toBe(0);
    expect(scene.strips[1].channelDelaySamples).toBe(13);
  });
});
