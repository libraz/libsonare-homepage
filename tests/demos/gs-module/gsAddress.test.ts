import { describe, expect, it } from 'vitest';
import {
  addressBytes,
  addressRow,
  blockChannel,
  GS_ADDRESS_ROWS,
  gsWrite,
  gsWriteEfxParameter,
  gsWriteEfxType,
  gsWritePart,
  partBlock,
  resetDefault,
  resolveAddress,
  spellAddress,
} from '@/demos/gs-module/gsAddress';

/** The address bytes a DT1 frame carries, past the four header bytes. */
function framedAddress(frame: number[]): number[] {
  return frame.slice(4, 7);
}

function framedData(frame: number[]): number[] {
  return frame.slice(7, -2);
}

describe('partBlock', () => {
  it('puts the rhythm part in block 0', () => {
    expect(partBlock(9)).toBe(0);
    expect(blockChannel(0)).toBe(9);
  });

  it('shifts channels below the rhythm part up by one', () => {
    expect(partBlock(0)).toBe(1);
    expect(partBlock(8)).toBe(9);
  });

  it('leaves channels above the rhythm part where they are', () => {
    expect(partBlock(10)).toBe(10);
    expect(partBlock(15)).toBe(15);
  });

  it('round-trips every channel', () => {
    for (let channel = 0; channel < 16; channel++) {
      expect(blockChannel(partBlock(channel))).toBe(channel);
    }
  });

  it('keeps every block inside one nibble', () => {
    for (let channel = 0; channel < 16; channel++) {
      expect(partBlock(channel)).toBeLessThan(16);
    }
  });

  it('rejects a channel outside the sixteen', () => {
    expect(() => partBlock(16)).toThrow(RangeError);
    expect(() => partBlock(-1)).toThrow(RangeError);
  });
});

describe('the generated table agrees with the mapping', () => {
  it('matches every part default the table records against its channel', () => {
    // kPartRxChannel powers up holding the channel its block listens to, so the
    // table's own exception map is an independent statement of the mapping.
    const row = addressRow('kPartRxChannel', 'part');
    for (let channel = 0; channel < 16; channel++) {
      const addr = resolveAddress(row, partBlock(channel));
      expect(resetDefault(row, addr)).toBe(channel);
    }
  });
});

describe('addressRow', () => {
  it('separates the global and per-part rows that share a name', () => {
    expect(addressRow('kEfxType', 'global').mask).toBe(0);
    expect(addressRow('kEfxType', 'part').mask).not.toBe(0);
  });

  it('names the parameter it cannot find', () => {
    expect(() => addressRow('kNoSuchParameter')).toThrow(/kNoSuchParameter/);
  });
});

describe('resolveAddress', () => {
  it('fills a single variable nibble', () => {
    const row = addressRow('kPartLevel', 'part');
    expect(spellAddress(resolveAddress(row, 5))).toBe('40 15 19');
  });

  it('fills several variable fields, most significant first', () => {
    // 21 0d rr: the drum map sits in the high nibble of the middle byte and
    // the note number takes the low byte whole.
    const row = addressRow('kUserDrumLevel', 'part');
    expect(spellAddress(resolveAddress(row, 1, 60))).toBe('21 12 3C');
  });

  it('rejects the wrong number of index fields', () => {
    const row = addressRow('kPartLevel', 'part');
    expect(() => resolveAddress(row)).toThrow(/takes 1 index fields/);
    expect(() => resolveAddress(row, 1, 2)).toThrow(/takes 1 index fields/);
  });

  it('rejects an index too wide for its field', () => {
    const row = addressRow('kPartLevel', 'part');
    expect(() => resolveAddress(row, 16)).toThrow(RangeError);
  });
});

describe('gsWrite', () => {
  it('writes a global parameter at its own address', () => {
    const row = addressRow('kMasterVolume', 'global');
    expect(framedAddress(gsWrite('kMasterVolume', 100))).toEqual(addressBytes(row.addr));
    expect(framedData(gsWrite('kMasterVolume', 100))).toEqual([100]);
  });

  it('clamps below the row minimum rather than sending a value the part ignores', () => {
    // kMasterPan starts at 1, not 0.
    expect(framedData(gsWrite('kMasterPan', 0))).toEqual([1]);
  });

  it('clamps above the row maximum', () => {
    expect(framedData(gsWrite('kPartLevel', 999, { fields: [1] }))).toEqual([127]);
  });

  it('rounds a fractional value', () => {
    expect(framedData(gsWrite('kPartLevel', 63.6, { fields: [1] }))).toEqual([64]);
  });

  it('checksums every frame it builds', () => {
    const frame = gsWrite('kMasterVolume', 100);
    const body = frame.slice(4, -1);
    expect(body.reduce((a, b) => a + b, 0) & 0x7f).toBe(0);
  });
});

describe('gsWritePart', () => {
  it('addresses the block the channel maps to, not the channel', () => {
    expect(framedAddress(gsWritePart('kPartLevel', 9))).toEqual([0x40, 0x10, 0x19]);
    expect(framedAddress(gsWritePart('kPartLevel', 0))).toEqual([0x40, 0x11, 0x19]);
    expect(framedAddress(gsWritePart('kPartLevel', 15))).toEqual([0x40, 0x1f, 0x19]);
  });

  it('keeps reverb and chorus on their own addresses', () => {
    // They sit next to each other and in the opposite order to the obvious one.
    expect(framedAddress(gsWritePart('kPartChorusSend', 0))).toEqual([0x40, 0x11, 0x21]);
    expect(framedAddress(gsWritePart('kPartReverbSend', 0))).toEqual([0x40, 0x11, 0x22]);
  });
});

describe('gsWriteEfxType', () => {
  it('sends the type as two bytes at one address', () => {
    expect(framedData(gsWriteEfxType(0x0110))).toEqual([0x01, 0x10]);
  });
});

describe('gsWriteEfxParameter', () => {
  it('walks the slots up from the block base', () => {
    const base = addressRow('kEfxParameter', 'global').addr;
    expect(framedAddress(gsWriteEfxParameter(0, 64))).toEqual(addressBytes(base));
    expect(framedAddress(gsWriteEfxParameter(19, 64))).toEqual(addressBytes(base + 19));
  });

  it('rejects a slot past the block', () => {
    expect(() => gsWriteEfxParameter(20, 0)).toThrow(RangeError);
  });
});

describe('the table itself', () => {
  it('gives every row a level the demo knows how to present', () => {
    const levels = new Set(GS_ADDRESS_ROWS.map((row) => row.level));
    expect([...levels].sort()).toEqual(['ACCEPT', 'AUDIBLE', 'IGNORE', 'STATE']);
  });

  it('gives a reason with every row that drops a value, and only those', () => {
    // A byte that is decoded and discarded owes an explanation exactly as much
    // as one the row declines outright; a byte that is kept does not.
    for (const row of GS_ADDRESS_ROWS) {
      expect(Boolean(row.why)).toBe(row.level === 'IGNORE' || row.level === 'ACCEPT');
    }
  });

  it('keeps every declared range non-empty', () => {
    for (const row of GS_ADDRESS_ROWS) expect(row.hi).toBeGreaterThanOrEqual(row.lo);
  });
});
