// @vitest-environment node
/**
 * Reading a project file: v2 passes through, v1 is validated as before and
 * converted onto the loaded tracks with the v1 rules, and the v1 tone maps to
 * the strip EQ bands that reproduce it.
 */
import { describe, expect, it } from 'vitest';
import {
  convertMixingProjectV1,
  parseMixingProject,
  V1_AIR_SHELF_HZ,
  V1_TILT_PIVOT_HZ,
} from '@/demos/mixing/mixingProjectV1';
import {
  addTrack,
  createMixingState,
  defaultEqBands,
  type MixingState,
  plateDecayFromSeconds,
  SEND_OFF_DB,
  serializeMixingState,
  setFader,
  setMasterFader,
} from '@/demos/mixing/mixingState';
import { buildStripJson } from '@/utils/engineApply';
import {
  createRawEngine,
  loadIndexModule,
  maxAbsDiff,
  noise,
  rms,
} from '../../wasm/support/engineHarness';

function loaded(): MixingState {
  let s = createMixingState();
  s = addTrack(s, 'Lead Vocal', 40);
  s = addTrack(s, 'Drums', 280);
  s = addTrack(s, 'Untouched', 10);
  s = setFader(s, 3, -7);
  return setMasterFader(s, -4);
}

const v1 = {
  version: 1,
  masterFaderDb: 20,
  reverb: { enabled: true, decaySec: 3, preDelayMs: 500 },
  vcaGains: { A: -30, B: 2 },
  tracks: [
    {
      id: 'track-id',
      name: 'Lead Vocal',
      offsetSeconds: 1.5,
      inputTrimDb: 30,
      faderDb: -3,
      pan: 2,
      width: 1.4,
      panLaw: 2.6,
      channelDelayMs: 4,
      eqEnabled: true,
      eqTiltDb: 4,
      eqAirDb: 6,
      reverbSendDb: -12,
      vcaGroup: 'A',
      polarityLeft: true,
      muted: false,
      soloed: true,
      automation: [
        { param: 'fader', timeSec: 2, value: -90, curve: 'hold' },
        { param: 'width', timeSec: 1, value: 0.5, curve: 'bogus' },
        { param: 'pan', timeSec: -1, value: 0.25 },
      ],
    },
    { name: 'Drums', offsetSeconds: 100, reverbSendDb: -6 },
    { id: 'gone', name: 'Not Loaded', faderDb: -1 },
  ],
};

describe('v1 project conversion', () => {
  const { state, fromVersion, unmatched } = parseMixingProject(JSON.stringify(v1), loaded())!;
  const [vox, drums, untouched] = state.tracks;

  it('matches tracks by name and reports the rest', () => {
    expect(fromVersion).toBe(1);
    expect(unmatched).toEqual(['gone']);
    expect(state.tracks.map((t) => t.id)).toEqual([1, 2, 3]);
    expect(untouched).toEqual(loaded().tracks[2]);
  });

  it('clamps to the v1 ranges', () => {
    expect(state.master.faderDb).toBe(12);
    expect(state.vcaGains).toEqual({ A: -24, B: 2, C: 0 });
    expect(vox.slots.trim.params.levelDb).toBe(24);
    expect(vox.pan).toBe(1);
    expect(vox.panLaw).toBe(3);
    expect(vox.clip.startSec).toBe(1.5);
    // The clip must still fit the 300 s timeline.
    expect(drums.clip.startSec).toBe(20);
  });

  it('carries the strip controls over', () => {
    expect(vox.faderDb).toBe(-3);
    expect(vox.slots.width.params.width).toBe(1.4);
    expect(vox.channelDelayMs).toBe(4);
    expect(vox.vcaGroup).toBe('A');
    expect(vox.polarityLeft).toBe(true);
    expect(vox.soloed).toBe(true);
    expect(drums.faderDb).toBe(0);
  });

  it('turns the tone into strip EQ bands', () => {
    const eq = vox.eq;
    expect(eq[1]).toEqual({
      type: 'LowShelf',
      frequencyHz: V1_TILT_PIVOT_HZ,
      gainDb: -2,
      q: Math.SQRT1_2,
      enabled: true,
    });
    expect(eq[4]).toEqual({
      type: 'HighShelf',
      frequencyHz: V1_TILT_PIVOT_HZ,
      gainDb: 2,
      q: Math.SQRT1_2,
      enabled: true,
    });
    expect(eq[3]).toEqual({
      type: 'HighShelf',
      frequencyHz: V1_AIR_SHELF_HZ,
      gainDb: 6,
      q: Math.SQRT1_2,
      enabled: true,
    });
    expect(drums.eq).toEqual(defaultEqBands());
  });

  it('turns the reverb into the REVERB bus and sends', () => {
    expect(vox.sends.reverb).toEqual({ levelDb: -12, timing: 'postFader' });
    expect(drums.sends.reverb.levelDb).toBe(-6);
    expect(vox.sends.delay.levelDb).toBe(SEND_OFF_DB);
    expect(state.buses.reverb.params.decay).toBe(plateDecayFromSeconds(3));
    expect(state.buses.reverb.params.preDelayMs).toBe(120);
  });

  it('turns automation into per-parameter lanes', () => {
    expect(vox.automation.fader).toEqual([
      { id: 'v1-fader-0', timeSec: 2, value: -60, curve: 'hold' },
    ]);
    expect(vox.automation.width).toEqual([
      { id: 'v1-width-1', timeSec: 1, value: 0.5, curve: 'linear' },
    ]);
    expect(vox.automation.pan).toEqual([
      { id: 'v1-pan-2', timeSec: 0, value: 0.25, curve: 'linear' },
    ]);
  });

  it('a disabled v1 reverb turns the sends off', () => {
    const off = convertMixingProjectV1(
      { reverb: { enabled: false }, tracks: [{ name: 'Drums', reverbSendDb: -3 }] },
      loaded(),
    );
    expect(off.state.tracks[1].sends.reverb.levelDb).toBe(SEND_OFF_DB);
  });

  it('omitted top-level settings keep the current ones', () => {
    const base = loaded();
    const partial = convertMixingProjectV1({ tracks: [{ name: 'Drums', faderDb: -2 }] }, base);
    expect(partial.state.master).toEqual(base.master);
    expect(partial.state.buses).toEqual(base.buses);
    expect(partial.state.vcaGains).toEqual(base.vcaGains);
  });
});

describe('project file dispatch', () => {
  it('reads v2 as is', () => {
    const state = loaded();
    expect(parseMixingProject(serializeMixingState(state), createMixingState())).toEqual({
      state,
      fromVersion: 2,
      unmatched: [],
    });
  });

  it.each([
    ['an engine scene', { strips: [], buses: [] }],
    ['a v1 string number', { version: 1, masterFaderDb: '-6' }],
    ['a v1 file with no payload', { version: 1 }],
    ['an unknown version', { version: 3, tracks: [] }],
    ['broken JSON', '{"version":'],
  ])('rejects %s', (_label, value) => {
    expect(parseMixingProject(value, loaded())).toBeNull();
  });
});

describe('v1 tone constants agree with the engine', () => {
  it('pivot and air shelf are the processors’ defaults', async () => {
    const wasm = await loadIndexModule();
    const defaultOf = (processor: string, name: string) =>
      wasm.masteringInsertParamInfo(processor).find((p: { name: string }) => p.name === name)
        ?.default;
    expect(defaultOf('eq.tilt', 'pivotHz')).toBe(V1_TILT_PIVOT_HZ);
    expect(defaultOf('spectral.airBand', 'shelfFrequencyHz')).toBe(V1_AIR_SHELF_HZ);
  });

  it('the two shelves render what eq.tilt renders', async () => {
    const source = noise(0.5, 21);
    const render = async (strip: string) => {
      const engine = await createRawEngine();
      engine.setTrackLanes([{ trackId: 1 }]);
      engine.setTrackStripJson(1, strip);
      engine.setClips([{ trackId: 1, channels: [source, source], startPpq: 0 }]);
      engine.play();
      const out = engine.bounceOffline({ totalFrames: source.length, numChannels: 2 }).interleaved;
      engine.destroy();
      return out;
    };
    const tilted = await render(
      buildStripJson(
        { kind: 'track', trackId: 1 },
        { inserts: [{ slot: 'pre', processor: 'eq.tilt', params: { tiltDb: 6 } }] },
      ),
    );
    const converted = convertMixingProjectV1(
      { tracks: [{ name: 'Drums', eqEnabled: true, eqTiltDb: 6 }] },
      loaded(),
    ).state.tracks[1].eq;
    const shelved = await render(
      buildStripJson({ kind: 'track', trackId: 1 }, { inserts: [], eqBands: converted }),
    );
    const plain = await render(buildStripJson({ kind: 'track', trackId: 1 }, { inserts: [] }));
    expect(maxAbsDiff(tilted, plain)).toBeGreaterThan(1e-2);
    expect(maxAbsDiff(tilted, shelved) / rms(tilted)).toBeLessThanOrEqual(1e-4);
  });
});
