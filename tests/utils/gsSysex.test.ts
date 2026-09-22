import { describe, expect, it } from 'vitest';
import { buildSmf, dt1, GS_PPQN, gsResetFrame, noteEvents, vlq } from '@/utils/gsSysex';

/** Read a big-endian chunk length back out of a built file. */
function chunkLength(smf: Uint8Array, offset: number): number {
  return (smf[offset] << 24) | (smf[offset + 1] << 16) | (smf[offset + 2] << 8) | smf[offset + 3];
}

function ascii(smf: Uint8Array, offset: number, length: number): string {
  return String.fromCharCode(...smf.slice(offset, offset + length));
}

describe('dt1', () => {
  it('frames an address run with the Roland header and a terminator', () => {
    const frame = dt1([0x40, 0x00, 0x7f, 0x00]);
    expect(frame.slice(0, 4)).toEqual([0x41, 0x10, 0x42, 0x12]);
    expect(frame.at(-1)).toBe(0xf7);
  });

  it('checksums so address, data and checksum sum to a multiple of 128', () => {
    const addrData = [0x40, 0x03, 0x00, 0x01, 0x10];
    const frame = dt1(addrData);
    const checksum = frame.at(-2) as number;
    expect([...addrData, checksum].reduce((a, b) => a + b, 0) & 0x7f).toBe(0);
  });

  it('leaves out the leading F0, which the file supplies with the length', () => {
    expect(dt1([0x40, 0x00, 0x7f, 0x00])).not.toContain(0xf0);
  });
});

describe('gsResetFrame', () => {
  it('addresses 40 00 7F with data 00', () => {
    // 41 10 42 12 | 40 00 7F 00 | sum | F7
    expect(gsResetFrame().slice(4, 8)).toEqual([0x40, 0x00, 0x7f, 0x00]);
  });
});

describe('vlq', () => {
  it('encodes values below 128 as one byte', () => {
    expect(vlq(0)).toEqual([0]);
    expect(vlq(127)).toEqual([0x7f]);
  });

  it('sets the continuation bit on every byte but the last', () => {
    expect(vlq(128)).toEqual([0x81, 0x00]);
    expect(vlq(0x3fff)).toEqual([0xff, 0x7f]);
    expect(vlq(0x4000)).toEqual([0x81, 0x80, 0x00]);
  });
});

describe('noteEvents', () => {
  it('pairs a note-on with a note-off on the same channel', () => {
    expect(noteEvents(3, 60, 100, 0, 1)).toEqual([
      { beat: 0, bytes: [0x93, 60, 100] },
      { beat: 1, bytes: [0x83, 60, 0] },
    ]);
  });

  it('masks the channel to four bits rather than corrupting the status byte', () => {
    const [on] = noteEvents(9, 36, 127, 0, 1);
    expect(on.bytes?.[0]).toBe(0x99);
  });
});

describe('buildSmf', () => {
  it('writes a format-0 header declaring one track at the module ppqn', () => {
    const smf = buildSmf(noteEvents(0, 60, 96, 0, 1), 2);
    expect(ascii(smf, 0, 4)).toBe('MThd');
    expect(chunkLength(smf, 4)).toBe(6);
    expect([smf[8], smf[9]]).toEqual([0, 0]); // format 0
    expect([smf[10], smf[11]]).toEqual([0, 1]); // one track
    expect((smf[12] << 8) | smf[13]).toBe(GS_PPQN);
    expect(ascii(smf, 14, 4)).toBe('MTrk');
  });

  it('declares a track length matching the bytes that follow it', () => {
    const smf = buildSmf(noteEvents(0, 60, 96, 0, 1), 2);
    expect(chunkLength(smf, 18)).toBe(smf.length - 22);
  });

  it('ends the track with the end-of-track meta event', () => {
    const smf = buildSmf([], 1);
    expect([...smf.slice(-3)]).toEqual([0xff, 0x2f, 0x00]);
  });

  it('sorts by beat, so a caller may append in whatever order reads best', () => {
    const late = buildSmf(
      [
        { beat: 1, bytes: [0x90, 62, 96] },
        { beat: 0, bytes: [0x90, 60, 96] },
      ],
      2,
    );
    const ordered = buildSmf(
      [
        { beat: 0, bytes: [0x90, 60, 96] },
        { beat: 1, bytes: [0x90, 62, 96] },
      ],
      2,
    );
    expect([...late]).toEqual([...ordered]);
  });

  it('writes delta ticks, not absolute ones', () => {
    const smf = buildSmf(
      [
        { beat: 0, bytes: [0x90, 60, 96] },
        { beat: 1, bytes: [0x80, 60, 0] },
      ],
      1,
    );
    const track = [...smf.slice(22)];
    // delta 0, note-on, delta ppqn (as a vlq), note-off, delta 0, end-of-track
    expect(track.slice(0, 4)).toEqual([0, 0x90, 60, 96]);
    expect(track.slice(4, 4 + vlq(GS_PPQN).length)).toEqual(vlq(GS_PPQN));
  });

  it('prefixes a sysex body with F0 and its own length', () => {
    const body = dt1([0x40, 0x00, 0x7f, 0x00]);
    const smf = buildSmf([{ beat: 0, sysex: body }], 1);
    const track = [...smf.slice(22)];
    expect(track[0]).toBe(0); // delta
    expect(track[1]).toBe(0xf0);
    expect(track.slice(2, 2 + vlq(body.length).length)).toEqual(vlq(body.length));
  });

  it('places end-of-track at the declared end beat', () => {
    const smf = buildSmf([], 4);
    const track = [...smf.slice(22)];
    expect(track).toEqual([...vlq(4 * GS_PPQN), 0xff, 0x2f, 0x00]);
  });
});
