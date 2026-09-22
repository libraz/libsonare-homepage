import { describe, expect, it } from 'vitest';
import { addressRow, spellAddress } from '@/demos/gs-module/gsAddress';
import {
  defaultEfxState,
  defaultModuleState,
  defaultPartState,
  EFX_SLOTS,
  efxTypeDefaults,
  efxTypeKey,
  type GsModuleState,
  partIsEdited,
  RHYTHM_CHANNEL,
  setupEvents,
  withEfxType,
} from '@/demos/gs-module/gsState';

/** The address a DT1 event writes to, spelled the way the table spells it. */
function targetOf(event: { sysex?: readonly number[] }): string {
  const sysex = event.sysex as number[];
  return spellAddress((sysex[4] << 16) | (sysex[5] << 8) | sysex[6]);
}

function edited(mutate: (state: GsModuleState) => void): GsModuleState {
  const state = defaultModuleState();
  mutate(state);
  return state;
}

describe('defaults', () => {
  it('takes every part value from the address table, not a literal', () => {
    const part = defaultPartState(0);
    expect(part.level).toBe(addressRow('kPartLevel', 'part').def);
    expect(part.reverbSend).toBe(addressRow('kPartReverbSend', 'part').def);
  });

  it('starts every part unrouted from the insertion effect', () => {
    for (let channel = 0; channel < 16; channel++) {
      expect(defaultPartState(channel).efxAssigned).toBe(false);
    }
  });

  it('starts the effect on Thru with that type’s own bytes', () => {
    expect(defaultEfxState().type).toBe(0);
    expect(defaultEfxState().params).toEqual(efxTypeDefaults(0));
    expect(defaultEfxState().params).toHaveLength(EFX_SLOTS);
  });

  it('builds sixteen parts', () => {
    expect(defaultModuleState().parts).toHaveLength(16);
    expect(defaultModuleState().parts[RHYTHM_CHANNEL].channel).toBe(RHYTHM_CHANNEL);
  });
});

describe('efxTypeKey', () => {
  it('spells a packed type the way the derivation file keys it', () => {
    expect(efxTypeKey(0)).toBe('00 00');
    expect(efxTypeKey(0x0110)).toBe('01 10');
    expect(efxTypeKey(0x040b)).toBe('04 0B');
  });

  it('falls back to zeros for a type the archive never measured', () => {
    expect(efxTypeDefaults(0x7f7f)).toEqual(new Array(EFX_SLOTS).fill(0));
  });
});

describe('setupEvents', () => {
  it('emits nothing for a state already at power-on', () => {
    expect(setupEvents(defaultModuleState())).toEqual([]);
  });

  it('emits only the part that moved', () => {
    const events = setupEvents(
      edited((s) => {
        s.parts[3].level = 20;
      }),
    );
    expect(events).toHaveLength(1);
    expect(targetOf(events[0])).toBe('40 14 19');
  });

  it('addresses the rhythm part at block 0', () => {
    const events = setupEvents(
      edited((s) => {
        s.parts[RHYTHM_CHANNEL].reverbSend = 90;
      }),
    );
    expect(targetOf(events[0])).toBe('40 10 22');
  });

  it('sends a program change as a channel message, not as SysEx', () => {
    const events = setupEvents(
      edited((s) => {
        s.parts[2].program = 48;
      }),
    );
    expect(events[0].bytes).toEqual([0xc2, 48]);
  });

  it('sends the bank before the program that selects from it', () => {
    const events = setupEvents(
      edited((s) => {
        s.parts[0].bankMsb = 8;
        s.parts[0].program = 48;
      }),
    );
    expect(events[0].bytes).toEqual([0xb0, 0x00, 8]);
    expect(events[1].bytes).toEqual([0xc0, 48]);
  });

  it('sends the effect type before its slots, because the type overwrites them', () => {
    const events = setupEvents(
      edited((s) => {
        s.efx = withEfxType(s.efx, 0x0100);
        s.efx.params[9] = 127;
      }),
    );
    expect(events).toHaveLength(2);
    expect(targetOf(events[0])).toBe(spellAddress(addressRow('kEfxType', 'global').addr));
    expect(targetOf(events[1])).toBe(spellAddress(addressRow('kEfxParameter', 'global').addr + 9));
  });

  it('leaves slots already at the type default out of the frame list', () => {
    const events = setupEvents(
      edited((s) => {
        s.efx = withEfxType(s.efx, 0x0100);
      }),
    );
    expect(events).toHaveLength(1);
  });

  it('writes the effect assignment as a unit number', () => {
    const events = setupEvents(
      edited((s) => {
        s.parts[0].efxAssigned = true;
      }),
    );
    expect(targetOf(events[0])).toBe('40 41 22');
    expect((events[0].sysex as number[])[7]).toBe(1);
  });

  it('places every setup frame on the beat it is given', () => {
    const events = setupEvents(
      edited((s) => {
        s.parts[0].level = 10;
      }),
      2.5,
    );
    expect(events.every((event) => event.beat === 2.5)).toBe(true);
  });
});

describe('withEfxType', () => {
  it('replaces the slot values with the new type’s own', () => {
    const next = withEfxType(defaultEfxState(), 0x0100);
    expect(next.type).toBe(0x0100);
    expect(next.params).toEqual(efxTypeDefaults(0x0100));
  });

  it('does not carry the previous type’s edits across', () => {
    const edits = { ...defaultEfxState(), params: new Array(EFX_SLOTS).fill(99) };
    expect(withEfxType(edits, 0x0100).params).toEqual(efxTypeDefaults(0x0100));
  });

  it('leaves the state alone when the type is unchanged', () => {
    const efx = defaultEfxState();
    expect(withEfxType(efx, efx.type)).toBe(efx);
  });
});

describe('partIsEdited', () => {
  it('is false for a part at power-on', () => {
    expect(partIsEdited(defaultPartState(4))).toBe(false);
  });

  it('is true once any field moves', () => {
    expect(partIsEdited({ ...defaultPartState(4), pan: 0 })).toBe(true);
  });
});
