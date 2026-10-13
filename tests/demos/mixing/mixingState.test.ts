// @vitest-environment node
/**
 * The mixing project state: the mutator list is the only way to change it,
 * each mutator is pure and records one history entry, the v2 file round-trips,
 * the audio budget holds, and the fixed layout agrees with the engine's
 * parameter catalogue (names, defaults, which params are construction-only).
 */
import { describe, expect, it } from 'vitest';
import { useHistory } from '@/composables/useHistory';
import { DISCRETE_PARAMS } from '@/demos/mixing/mixingEngine';
import {
  AUX_BUS_PROCESSORS,
  AUX_BUSES,
  addAutomationPoint,
  addTrack,
  checkAudioBudget,
  createMixingState,
  defaultBuses,
  defaultMasterSlots,
  defaultTrackSlots,
  MASTER_SLOT_PROCESSORS,
  MASTER_SLOTS,
  MAX_TOTAL_TRACK_SECONDS,
  MIXING_MUTATORS,
  type MixingState,
  parseMixingState,
  plateDecayFromSeconds,
  serializeMixingState,
  setDuckKey,
  setSend,
  setSlotParam,
  TRACK_SLOT_PROCESSORS,
  TRACK_SLOTS,
} from '@/demos/mixing/mixingState';
import { boundedControl, TRACK_SLOT_CONTROLS } from '@/demos/mixing/mixingUi';
import {
  createRawEngine,
  loadIndexModule,
  maxAbsDiff,
  noise,
} from '../../wasm/support/engineHarness';

function baseState(): MixingState {
  let s = createMixingState();
  s = addTrack(s, 'kick', 30);
  s = addTrack(s, 'vox', 45);
  s = addAutomationPoint(s, 2, 'fader', { id: 'a', timeSec: 1, value: -3, curve: 'linear' });
  return s;
}

type Mutators = typeof MIXING_MUTATORS;
type Case = (s: MixingState) => MixingState;

/** One representative call per mutator; the key set must equal the exported list. */
const cases: { [K in keyof Mutators]: Case } = {
  addTrack: (s) => MIXING_MUTATORS.addTrack(s, 'bass', 60),
  removeTrack: (s) => MIXING_MUTATORS.removeTrack(s, 1),
  renameTrack: (s) => MIXING_MUTATORS.renameTrack(s, 1, 'Kick In'),
  moveClip: (s) => MIXING_MUTATORS.moveClip(s, 1, 2.5),
  trimClip: (s) => MIXING_MUTATORS.trimClip(s, 1, 1, 10),
  setClipFades: (s) => MIXING_MUTATORS.setClipFades(s, 1, 0.1, 0.5),
  setFader: (s) => MIXING_MUTATORS.setFader(s, 1, -6),
  setPan: (s) => MIXING_MUTATORS.setPan(s, 1, 0.4),
  setPanLaw: (s) => MIXING_MUTATORS.setPanLaw(s, 1, 2),
  setPanMode: (s) => MIXING_MUTATORS.setPanMode(s, 1, 1),
  setDualPan: (s) => MIXING_MUTATORS.setDualPan(s, 1, -0.5, 0.5),
  setChannelDelay: (s) => MIXING_MUTATORS.setChannelDelay(s, 1, 3),
  setPolarity: (s) => MIXING_MUTATORS.setPolarity(s, 1, 'right', true),
  setMute: (s) => MIXING_MUTATORS.setMute(s, 1, true),
  setSolo: (s) => MIXING_MUTATORS.setSolo(s, 1, true),
  setSoloSafe: (s) => MIXING_MUTATORS.setSoloSafe(s, 1, true),
  setVcaGroup: (s) => MIXING_MUTATORS.setVcaGroup(s, 1, 'B'),
  setEqBand: (s) => MIXING_MUTATORS.setEqBand(s, 1, 2, { gainDb: 3, enabled: true }),
  setSlotBypass: (s) => MIXING_MUTATORS.setSlotBypass(s, 1, 'comp', false),
  setSlotParam: (s) => MIXING_MUTATORS.setSlotParam(s, 1, 'comp', 'ratio', 4),
  setDuckKey: (s) => MIXING_MUTATORS.setDuckKey(s, 2, 1),
  setSend: (s) => MIXING_MUTATORS.setSend(s, 1, 'delay', { levelDb: -12, timing: 'preFader' }),
  setOutputBus: (s) => MIXING_MUTATORS.setOutputBus(s, 1, 'group2'),
  addAutomationPoint: (s) =>
    MIXING_MUTATORS.addAutomationPoint(s, 1, 'pan', {
      id: 'p',
      timeSec: 0.5,
      value: 0.2,
      curve: 'hold',
    }),
  moveAutomationPoint: (s) => MIXING_MUTATORS.moveAutomationPoint(s, 2, 'fader', 'a', 2, -6),
  setAutomationCurve: (s) => MIXING_MUTATORS.setAutomationCurve(s, 2, 'fader', 'a', 's-curve'),
  removeAutomationPoint: (s) => MIXING_MUTATORS.removeAutomationPoint(s, 2, 'fader', 'a'),
  clearAutomation: (s) => MIXING_MUTATORS.clearAutomation(s, 2, 'fader'),
  setBusGain: (s) => MIXING_MUTATORS.setBusGain(s, 'reverb', -4),
  setBusParam: (s) => MIXING_MUTATORS.setBusParam(s, 'delay', 'feedback', 0.4),
  setGroupGain: (s) => MIXING_MUTATORS.setGroupGain(s, 'group1', -3),
  setMasterFader: (s) => MIXING_MUTATORS.setMasterFader(s, -2),
  setMasterSlotBypass: (s) => MIXING_MUTATORS.setMasterSlotBypass(s, 'limiter', false),
  setMasterSlotParam: (s) => MIXING_MUTATORS.setMasterSlotParam(s, 'limiter', 'ceilingDb', -0.5),
  setVcaGain: (s) => MIXING_MUTATORS.setVcaGain(s, 'A', -3),
  setLoop: (s) => MIXING_MUTATORS.setLoop(s, { enabled: true, startSec: 1, endSec: 4 }),
  applyMixPatch: (s) => MIXING_MUTATORS.applyMixPatch(s, { tracks: { 1: { faderDb: -1 } } }),
};

describe('mixing state mutators', () => {
  it('the exported list is exactly the set the UI may use', () => {
    expect(Object.keys(MIXING_MUTATORS).sort()).toEqual(Object.keys(cases).sort());
  });

  for (const [name, run] of Object.entries(cases)) {
    it(`${name} is pure on a frozen snapshot and records one undo entry`, () => {
      const history = useHistory(baseState());
      const before = history.state.value;
      expect(Object.isFrozen(before.tracks[0])).toBe(true);
      const next = run(before);
      expect(next).not.toBe(before);
      expect(serializeMixingState(next)).not.toBe(serializeMixingState(before));
      // Plain data only: it survives a structured clone and a JSON round trip unchanged.
      expect(JSON.parse(JSON.stringify(structuredClone(next)))).toEqual(next);
      history.commit(next);
      expect(history.canUndo.value).toBe(true);
      expect(history.undo()).toBe(before);
      expect(history.canUndo.value).toBe(false);
    });
  }

  it('reject addresses that do not exist', () => {
    const s = baseState();
    expect(() => MIXING_MUTATORS.setFader(s, 99, 0)).toThrow(RangeError);
    expect(() => setSlotParam(s, 1, 'comp', 'noSuchParam', 1)).toThrow(RangeError);
    expect(() => setDuckKey(s, 1, 1)).toThrow(RangeError);
    expect(() => MIXING_MUTATORS.setEqBand(s, 1, 6, { gainDb: 1 })).toThrow(RangeError);
  });

  it('refuses a duck key that closes a cycle', () => {
    let s = addTrack(addTrack(baseState(), 'c', 10), 'd', 10);
    s = setDuckKey(setDuckKey(s, 2, 1), 3, 2);
    expect(() => setDuckKey(s, 1, 2)).toThrow(RangeError);
    expect(() => setDuckKey(s, 1, 3)).toThrow(RangeError);
    expect(setDuckKey(s, 1, 4).tracks[0].duckKeyTrackId).toBe(4);
    expect(setDuckKey(s, 2, null).tracks[1].duckKeyTrackId).toBeNull();
  });

  it('removing a track releases the ducks it keyed', () => {
    const keyed = setDuckKey(baseState(), 2, 1);
    expect(MIXING_MUTATORS.removeTrack(keyed, 1).tracks[0].duckKeyTrackId).toBeNull();
  });

  it('new tracks never reuse the highest id', () => {
    const s = MIXING_MUTATORS.removeTrack(baseState(), 1);
    expect(addTrack(s, 'x', 1).tracks.map((t) => t.id)).toEqual([2, 3]);
  });
});

describe('mixing project v2 file', () => {
  it('round-trips the whole state', () => {
    let s = baseState();
    s = setSend(s, 2, 'reverb', { levelDb: -9, timing: 'preFader' });
    s = setDuckKey(s, 2, 1);
    s = MIXING_MUTATORS.trimClip(s, 1, 2, null);
    s = MIXING_MUTATORS.setLoop(s, { enabled: true, startSec: 1, endSec: 3 });
    s = MIXING_MUTATORS.setOutputBus(s, 1, 'group1');
    s = MIXING_MUTATORS.setGroupGain(s, 'group1', -4.5);
    expect(parseMixingState(serializeMixingState(s))).toEqual(s);
    expect(parseMixingState(JSON.parse(serializeMixingState(s)))).toEqual(s);
  });

  it('fills absent fields with defaults', () => {
    const parsed = parseMixingState({ version: 2, tracks: [{ id: 4, name: 'x' }] });
    expect(parsed?.tracks[0].slots).toEqual(defaultTrackSlots());
    expect(parsed?.buses).toEqual(defaultBuses());
    expect(parsed?.master.slots).toEqual(defaultMasterSlots());
    expect(parsed?.tracks[0].outputBus).toBeNull();
    expect(parsed?.groups).toEqual(createMixingState().groups);
  });

  it.each([
    ['another version', { version: 1, tracks: [] }],
    ['not JSON', '{'],
    ['a string number', { version: 2, master: { faderDb: '-6' } }],
    [
      'an unknown slot param',
      { version: 2, tracks: [{ id: 1, name: 'a', slots: { comp: { params: { foo: 1 } } } }] },
    ],
    [
      'duplicate track ids',
      {
        version: 2,
        tracks: [
          { id: 1, name: 'a' },
          { id: 1, name: 'b' },
        ],
      },
    ],
    ['a duck key to no track', { version: 2, tracks: [{ id: 1, name: 'a', duckKeyTrackId: 7 }] }],
    [
      'a duck key cycle',
      {
        version: 2,
        tracks: [
          { id: 1, name: 'a', duckKeyTrackId: 2 },
          { id: 2, name: 'b', duckKeyTrackId: 1 },
        ],
      },
    ],
    ['an unknown VCA group', { version: 2, tracks: [{ id: 1, name: 'a', vcaGroup: 'Z' }] }],
    [
      'a bad send timing',
      { version: 2, tracks: [{ id: 1, name: 'a', sends: { reverb: { timing: 'pre' } } }] },
    ],
    ['a short EQ', { version: 2, tracks: [{ id: 1, name: 'a', eq: [] }] }],
    ['an unknown output bus', { version: 2, tracks: [{ id: 1, name: 'a', outputBus: 'reverb' }] }],
  ])('rejects %s', (_label, value) => {
    expect(parseMixingState(value)).toBeNull();
  });
});

describe('gate threshold bounds', () => {
  it('follow the dependencies the engine catalogue publishes', async () => {
    const wasm = await loadIndexModule();
    const info = wasm.masteringInsertParamInfo('dynamics.gate');
    const bounded = (name: string, params: Record<string, number>) => {
      const control = TRACK_SLOT_CONTROLS.gate.find((c) => c.name === name)!;
      const dependsOn = info.find((p: { name: string }) => p.name === name)?.dependsOn ?? [];
      const { min, max } = boundedControl(control, params, dependsOn);
      return [min, max];
    };
    const params = { ...defaultTrackSlots().gate.params, thresholdDb: -30, closeThresholdDb: -40 };
    expect(bounded('thresholdDb', params)).toEqual([-40, 0]);
    expect(bounded('closeThresholdDb', params)).toEqual([-80, -30]);
    // At the defaults the two meet at −50 dB.
    expect(bounded('thresholdDb', defaultTrackSlots().gate.params)).toEqual([-50, 0]);
    expect(bounded('closeThresholdDb', defaultTrackSlots().gate.params)).toEqual([-80, -50]);
  });
});

describe('audio budget', () => {
  // Two parameters, so every combination is listed: loaded sources x candidate length.
  const loaded = {
    none: [],
    threeFull: [300, 300, 300],
    eightHalf: Array.from({ length: 8 }, () => 150),
    fourNearFull: [300, 300, 300, 250],
  } as const;
  const expected: Record<keyof typeof loaded, Record<number, string>> = {
    none: { 50: 'ok', 300: 'ok', 301: 'trackTooLong' },
    threeFull: { 50: 'ok', 300: 'ok', 301: 'trackTooLong' },
    eightHalf: { 50: 'tooManyTracks', 300: 'tooManyTracks', 301: 'tooManyTracks' },
    fourNearFull: { 50: 'ok', 300: 'totalExceeded', 301: 'trackTooLong' },
  };
  for (const [name, durations] of Object.entries(loaded)) {
    for (const candidate of [50, 300, 301]) {
      it(`${name} + ${candidate} s`, () => {
        const verdict = checkAudioBudget(durations, candidate);
        const used = durations.reduce((a: number, b: number) => a + b, 0);
        expect(verdict.ok ? 'ok' : verdict.reason).toBe(
          expected[name as keyof typeof loaded][candidate],
        );
        expect(verdict.remainingSec).toBe(Math.max(0, MAX_TOTAL_TRACK_SECONDS - used));
      });
    }
  }

  it('addTrack refuses a source past the budget', () => {
    let s = createMixingState();
    for (let i = 0; i < 4; i++) s = addTrack(s, `t${i}`, 300);
    expect(() => addTrack(s, 'over', 1)).toThrow(/totalExceeded/);
  });
});

describe('fixed layout agrees with the engine catalogue', () => {
  const usedSlots = (): Array<[string, Record<string, number>]> => [
    ...TRACK_SLOTS.map((name): [string, Record<string, number>] => [
      TRACK_SLOT_PROCESSORS[name],
      defaultTrackSlots()[name].params,
    ]),
    ...MASTER_SLOTS.map((name): [string, Record<string, number>] => [
      MASTER_SLOT_PROCESSORS[name],
      defaultMasterSlots()[name].params,
    ]),
  ];

  it('slot params exist and default to the processor defaults', async () => {
    const wasm = await loadIndexModule();
    for (const [processor, params] of usedSlots()) {
      const info = new Map(
        wasm.masteringInsertParamInfo(processor).map((p: { name: string }) => [p.name, p]),
      );
      for (const [name, value] of Object.entries(params)) {
        const param = info.get(name) as { default: number | boolean } | undefined;
        expect(param, `${processor}.${name}`).toBeDefined();
        expect(value, `${processor}.${name}`).toBe(Number(param?.default));
      }
    }
  });

  it('bus params exist on their processors and are all live', async () => {
    const wasm = await loadIndexModule();
    for (const bus of AUX_BUSES) {
      const info = new Map(
        wasm
          .masteringInsertParamInfo(AUX_BUS_PROCESSORS[bus])
          .map((p: { name: string; rtSafe: boolean }) => [p.name, p.rtSafe]),
      );
      for (const name of Object.keys(defaultBuses()[bus].params)) {
        expect(info.get(name), `${bus}.${name}`).toBe(true);
      }
    }
  });

  it('DISCRETE_PARAMS lists exactly the construction-only params the state carries', async () => {
    const wasm = await loadIndexModule();
    const discrete: Record<string, string[]> = {};
    const all: Array<[string, Record<string, number>]> = [
      ...usedSlots(),
      ...AUX_BUSES.map((bus): [string, Record<string, number>] => [
        AUX_BUS_PROCESSORS[bus],
        defaultBuses()[bus].params,
      ]),
    ];
    for (const [processor, params] of all) {
      const rtSafe = new Map(
        wasm
          .masteringInsertParamInfo(processor)
          .map((p: { name: string; rtSafe: boolean }) => [p.name, p.rtSafe]),
      );
      const names = Object.keys(params).filter((name) => rtSafe.get(name) === false);
      if (names.length)
        discrete[processor] = [...new Set([...(discrete[processor] ?? []), ...names])];
    }
    expect(discrete).toEqual(DISCRETE_PARAMS);
  });

  it('plateDecayFromSeconds sets the decay the decaySec construction key sets', async () => {
    const renderPlate = async (params: Record<string, number>) => {
      const engine = await createRawEngine();
      engine.setTrackBuses([{ busId: 1 }]);
      engine.setTrackLanes([{ trackId: 1, sends: [{ busId: 1, levelDb: 0 }] }]);
      engine.setBusStripJson(
        1,
        JSON.stringify({
          version: 1,
          buses: [
            { id: '1', inserts: [{ slot: 'pre', processor: 'effects.reverb.plate', params }] },
          ],
        }),
      );
      const source = noise(0.1, 9);
      engine.setClips([{ trackId: 1, channels: [source, source], startPpq: 0 }]);
      engine.play();
      const out = engine.bounceOffline({ totalFrames: 96_000, numChannels: 2 }).interleaved;
      engine.destroy();
      return out;
    };
    for (const seconds of [0.6, 2.2, 5]) {
      const bySeconds = await renderPlate({ decaySec: seconds, dryWet: 1 });
      const byDecay = await renderPlate({ decay: plateDecayFromSeconds(seconds), dryWet: 1 });
      expect(maxAbsDiff(bySeconds, byDecay), `${seconds} s`).toBeLessThanOrEqual(1e-6);
    }
  });
});
