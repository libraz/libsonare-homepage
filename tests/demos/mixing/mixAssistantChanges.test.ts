import { describe, expect, it } from 'vitest';
import { describeMixChanges } from '@/demos/mixing/mixAssistantChanges';
import { addTrack, createMixingState, type MixPatch } from '@/demos/mixing/mixingState';

describe('describeMixChanges', () => {
  const state = addTrack(createMixingState(), 'one', 10);
  const id = state.tracks[0].id;

  it('lists exactly the fields the patch changes', () => {
    const patch: MixPatch = {
      tracks: {
        [id]: {
          faderDb: -4,
          slots: {
            trim: { bypassed: false, params: { levelDb: 2 } },
            comp: { bypassed: false, params: { thresholdDb: -20, ratio: 3 } },
          },
          sends: { reverb: { levelDb: -18, timing: 'postFader' } },
        },
      },
      masterFaderDb: state.master.faderDb,
    };
    expect(describeMixChanges(patch, state)).toEqual([
      { kind: 'trim', trackId: id, deltaDb: 2 },
      { kind: 'fader', trackId: id, deltaDb: -4 - state.tracks[0].faderDb },
      { kind: 'dynamics', trackId: id, slot: 'comp', thresholdDb: -20, ratio: 3 },
      { kind: 'send', trackId: id, bus: 'reverb', levelDb: -18 },
    ]);
  });

  it('yields nothing for fields left at the current value', () => {
    const track = state.tracks[0];
    const patch: MixPatch = {
      tracks: {
        [id]: {
          faderDb: track.faderDb,
          pan: track.pan,
          slots: {
            trim: { bypassed: false, params: { levelDb: 0 } },
            width: { bypassed: false, params: { width: 1 } },
            gate: { bypassed: true, params: {} },
          },
          sends: { delay: { levelDb: -60, timing: 'postFader' } },
        },
      },
      masterFaderDb: state.master.faderDb,
    };
    expect(describeMixChanges(patch, state)).toEqual([]);
    expect(describeMixChanges({ tracks: {} }, state)).toEqual([]);
  });
});
