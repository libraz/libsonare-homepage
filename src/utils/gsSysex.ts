/**
 * Byte-level MIDI for the GS demos: Roland DT1 SysEx frames and a one-track
 * Standard MIDI File to carry them.
 *
 * A file is the only way in. `Project.setMidiEvents()` takes three-byte channel
 * messages and drops every SysEx the clip held, while `Project.importSmf()`
 * keeps them and an offline bounce realizes them — so anything that has to
 * configure the GS layer builds a file and imports it.
 *
 * Address semantics stay out of here. This module knows how to frame and time
 * bytes; which address means what is the address table's business.
 */

/** Ticks per quarter note in the files this module writes. */
export const GS_PPQN = 480;

/** Roland's manufacturer id, device 10h, model GS, command DT1. */
const DT1_HEADER = [0x41, 0x10, 0x42, 0x12];

/**
 * Wrap an address+data run as a DT1 body, checksum and `F7` included. The
 * leading `F0` is left off: {@link buildSmf} supplies it with the payload
 * length, which is how a file has to carry it.
 */
export function dt1(addrData: readonly number[]): number[] {
  let sum = 0;
  for (const byte of addrData) sum = (sum + byte) & 0x7f;
  return [...DT1_HEADER, ...addrData, (128 - sum) & 0x7f, 0xf7];
}

/**
 * GS Reset. It restores the power-on state, which includes clearing the
 * insertion effect's type and every part's assignment to it — a sequence that
 * sends this mid-stream has to send those again afterwards.
 *
 * It also runs all-sound-off first, so a note already sounding is cut. Judging
 * the reset by what that note does next measures a corpse.
 */
export function gsResetFrame(): number[] {
  return dt1([0x40, 0x00, 0x7f, 0x00]);
}

/** MIDI variable-length quantity. */
export function vlq(value: number): number[] {
  const out = [value & 0x7f];
  let rest = value >>> 7;
  while (rest > 0) {
    out.unshift((rest & 0x7f) | 0x80);
    rest >>>= 7;
  }
  return out;
}

/** Prefix a chunk body with its four-character id and big-endian length. */
function smfChunk(id: string, body: readonly number[]): number[] {
  const n = body.length;
  return [
    ...[...id].map((c) => c.charCodeAt(0)),
    (n >>> 24) & 0xff,
    (n >>> 16) & 0xff,
    (n >>> 8) & 0xff,
    n & 0xff,
    ...body,
  ];
}

/** One timed thing in a file: a channel message, or a SysEx body without its `F0`. */
export interface SmfEvent {
  /** Position in quarter notes, matching the units `Project.midi*` packs. */
  beat: number;
  /** A raw channel message, status byte first. */
  bytes?: readonly number[];
  /** A SysEx body excluding the leading `F0`; {@link dt1} returns one. */
  sysex?: readonly number[];
}

/**
 * Build a format-0 SMF from events timed in quarter notes. Events are sorted by
 * beat, so a caller may append in whatever order reads best; `endBeat` places
 * the end-of-track meta event and therefore the file's length.
 */
export function buildSmf(events: readonly SmfEvent[], endBeat: number): Uint8Array {
  const track: number[] = [];
  let lastTick = 0;
  const ordered = [...events].sort((a, b) => a.beat - b.beat);
  const withEnd: SmfEvent[] = [...ordered, { beat: endBeat, bytes: [0xff, 0x2f, 0x00] }];
  for (const event of withEnd) {
    const tick = Math.round(event.beat * GS_PPQN);
    const payload = event.sysex
      ? [0xf0, ...vlq(event.sysex.length), ...event.sysex]
      : (event.bytes ?? []);
    track.push(...vlq(tick - lastTick), ...payload);
    lastTick = tick;
  }
  return Uint8Array.from([
    ...smfChunk('MThd', [0, 0, 0, 1, (GS_PPQN >> 8) & 0xff, GS_PPQN & 0xff]),
    ...smfChunk('MTrk', track),
  ]);
}

/** `90`/`80` pairs for one note, velocity on the way in only. */
export function noteEvents(
  channel: number,
  note: number,
  velocity: number,
  onBeat: number,
  offBeat: number,
): SmfEvent[] {
  return [
    { beat: onBeat, bytes: [0x90 | (channel & 0x0f), note, velocity] },
    { beat: offBeat, bytes: [0x80 | (channel & 0x0f), note, 0] },
  ];
}
