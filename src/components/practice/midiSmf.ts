/**
 * Minimal Standard MIDI File (SMF) reader for the Piano Practice demo.
 *
 * The demo plays a single melodic line, so the parser deliberately accepts only
 * files whose notes live on ONE track (a format-0 file, or a format-1 file with
 * a conductor/tempo track plus a single note track). A file with two or more
 * note-bearing tracks is rejected with {@link MultiTrackError} so the caller can
 * show a clear "single-track only" message rather than silently dropping voices.
 *
 * Tempo (FF 51) and time-signature (FF 58) meta events from every track feed a
 * shared tempo map, which converts tick positions to seconds for the falling-note
 * timeline. Note positions are also returned in beats (quarter notes) so the
 * caller can re-sequence them through the libsonare Project for audio rendering.
 */

/** One parsed note, timed both in seconds (for display) and beats (for rendering). */
export interface ParsedNote {
  /** MIDI note number (0-127). */
  midi: number;
  /** Note-on velocity (1-127). */
  velocity: number;
  /** Onset in seconds, derived from the tempo map. */
  startSec: number;
  /** Note-off in seconds. */
  endSec: number;
  /** Onset in quarter notes. */
  startBeat: number;
  /** Note-off in quarter notes. */
  endBeat: number;
}

/** A tempo-map segment in quarter-note (ppq) units, for the render engine. */
export interface TempoSegment {
  startBeat: number;
  bpm: number;
}

export interface ParsedMidi {
  notes: ParsedNote[];
  tempoSegments: TempoSegment[];
  /** Total span in seconds (last note-off). */
  durationSec: number;
  /** Total span in beats (last note-off). */
  durationBeats: number;
  ticksPerBeat: number;
  /** Quarter-note beats per bar from the first time signature (default 4). */
  beatsPerBar: number;
  /** Lowest / highest MIDI note present, for sizing the keyboard. */
  lowestMidi: number;
  highestMidi: number;
  /** Optional sequence/track name from a FF 03 meta event. */
  name?: string;
}

/** Thrown when a file carries notes on more than one track. */
export class MultiTrackError extends Error {
  readonly trackCount: number;
  constructor(trackCount: number) {
    super(`This MIDI has ${trackCount} note tracks; the demo accepts single-track files only.`);
    this.name = 'MultiTrackError';
    this.trackCount = trackCount;
  }
}

/** Thrown for malformed input or unsupported division formats. */
export class MidiParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MidiParseError';
  }
}

interface RawTempoEvent {
  tick: number;
  usPerQuarter: number;
}

interface RawNote {
  midi: number;
  velocity: number;
  startTick: number;
  endTick: number;
}

class Reader {
  pos = 0;
  private readonly view: DataView;
  constructor(view: DataView) {
    this.view = view;
  }

  get remaining(): number {
    return this.view.byteLength - this.pos;
  }

  u8(): number {
    return this.view.getUint8(this.pos++);
  }

  u16(): number {
    const v = this.view.getUint16(this.pos);
    this.pos += 2;
    return v;
  }

  u32(): number {
    const v = this.view.getUint32(this.pos);
    this.pos += 4;
    return v;
  }

  bytes(length: number): Uint8Array {
    const out = new Uint8Array(this.view.buffer, this.view.byteOffset + this.pos, length);
    this.pos += length;
    return out;
  }

  fourCC(): string {
    return String.fromCharCode(this.u8(), this.u8(), this.u8(), this.u8());
  }

  /** Read a MIDI variable-length quantity. */
  vlq(): number {
    let value = 0;
    for (let i = 0; i < 4; i++) {
      const byte = this.u8();
      value = (value << 7) | (byte & 0x7f);
      if ((byte & 0x80) === 0) break;
    }
    return value;
  }
}

interface TrackResult {
  notes: RawNote[];
  tempos: RawTempoEvent[];
  name?: string;
  /** First time signature seen, as quarter-note beats per bar. */
  beatsPerBar?: number;
}

/** Parse one MTrk chunk body, resolving running status and matching note pairs. */
function parseTrack(reader: Reader, length: number): TrackResult {
  const end = reader.pos + length;
  const notes: RawNote[] = [];
  const tempos: RawTempoEvent[] = [];
  let name: string | undefined;
  let beatsPerBar: number | undefined;
  // Open note-ons per (channel, pitch), matched FIFO to the next note-off.
  const open = new Map<number, RawNote[]>();
  let tick = 0;
  let runningStatus = 0;

  const release = (channel: number, midi: number, endTick: number): void => {
    const key = (channel << 8) | midi;
    const stack = open.get(key);
    const note = stack?.shift();
    if (note) note.endTick = endTick;
  };

  while (reader.pos < end) {
    tick += reader.vlq();
    let status = reader.u8();
    if (status < 0x80) {
      // Running status: reuse the previous status byte, rewind the data byte.
      reader.pos -= 1;
      status = runningStatus;
    } else {
      runningStatus = status;
    }

    const type = status & 0xf0;
    const channel = status & 0x0f;

    if (status === 0xff) {
      // Meta event.
      const metaType = reader.u8();
      const len = reader.vlq();
      const data = reader.bytes(len);
      if (metaType === 0x51 && len === 3) {
        tempos.push({ tick, usPerQuarter: (data[0] << 16) | (data[1] << 8) | data[2] });
      } else if (metaType === 0x58 && len >= 2 && beatsPerBar === undefined) {
        // FF 58: numerator, denominator-as-power-of-two. Convert to quarter-note
        // beats per bar so the lane grid's bar lines fall on real downbeats.
        beatsPerBar = (data[0] * 4) / 2 ** data[1];
      } else if ((metaType === 0x03 || metaType === 0x01) && !name && len > 0) {
        name = new TextDecoder().decode(data).trim() || undefined;
      }
    } else if (status === 0xf0 || status === 0xf7) {
      // SysEx — skip its payload.
      const len = reader.vlq();
      reader.pos += len;
    } else if (type === 0x90) {
      const midi = reader.u8();
      const velocity = reader.u8();
      if (velocity > 0) {
        const note: RawNote = { midi, velocity, startTick: tick, endTick: tick };
        const key = (channel << 8) | midi;
        const stack = open.get(key) ?? [];
        stack.push(note);
        open.set(key, stack);
        notes.push(note);
      } else {
        release(channel, midi, tick);
      }
    } else if (type === 0x80) {
      const midi = reader.u8();
      reader.u8(); // release velocity, ignored
      release(channel, midi, tick);
    } else if (type === 0xa0 || type === 0xb0 || type === 0xe0) {
      reader.pos += 2; // two data bytes
    } else if (type === 0xc0 || type === 0xd0) {
      reader.pos += 1; // one data byte
    } else {
      reader.pos += 1; // unknown — best-effort skip
    }
  }

  reader.pos = end;
  // Any note left open rings to its own start (zero-length); clamp to a beat.
  return { notes, tempos, name, beatsPerBar };
}

/**
 * Build a tick→seconds converter from a sorted tempo map.
 *
 * @param tempos Tempo events sorted by tick.
 * @param ticksPerBeat Division from the header.
 */
function makeTickToSec(tempos: RawTempoEvent[], ticksPerBeat: number): (tick: number) => number {
  const map = tempos.length > 0 ? tempos : [{ tick: 0, usPerQuarter: 500000 }];
  if (map[0].tick !== 0) map.unshift({ tick: 0, usPerQuarter: 500000 });
  // Precompute the elapsed seconds at the start of each segment.
  const secAtTick: number[] = [0];
  for (let i = 1; i < map.length; i++) {
    const dt = map[i].tick - map[i - 1].tick;
    secAtTick[i] = secAtTick[i - 1] + (dt * map[i - 1].usPerQuarter) / (ticksPerBeat * 1e6);
  }
  return (tick: number): number => {
    let i = map.length - 1;
    while (i > 0 && map[i].tick > tick) i--;
    const dt = tick - map[i].tick;
    return secAtTick[i] + (dt * map[i].usPerQuarter) / (ticksPerBeat * 1e6);
  };
}

/**
 * Parse a Standard MIDI File into notes, a tempo map, and metadata.
 *
 * @param data The raw `.mid` bytes.
 * @throws {MidiParseError} on malformed input or SMPTE time division.
 * @throws {MultiTrackError} when more than one track carries notes.
 */
export function parseMidi(data: Uint8Array): ParsedMidi {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const reader = new Reader(view);

  if (reader.remaining < 14 || reader.fourCC() !== 'MThd') {
    throw new MidiParseError('Not a MIDI file (missing MThd header).');
  }
  reader.u32(); // header length (6)
  reader.u16(); // format
  const ntrks = reader.u16();
  const division = reader.u16();
  if (division & 0x8000) {
    throw new MidiParseError('SMPTE time-division MIDI files are not supported.');
  }
  const ticksPerBeat = division || 480;

  const parsedTracks: TrackResult[] = [];
  for (let t = 0; t < ntrks && reader.remaining >= 8; t++) {
    const id = reader.fourCC();
    const len = reader.u32();
    if (id !== 'MTrk') {
      reader.pos += len; // skip alien chunk
      continue;
    }
    parsedTracks.push(parseTrack(reader, len));
  }

  const noteTracks = parsedTracks.filter((tr) => tr.notes.length > 0);
  if (noteTracks.length === 0) {
    throw new MidiParseError('No notes found in this MIDI file.');
  }
  if (noteTracks.length > 1) {
    throw new MultiTrackError(noteTracks.length);
  }

  const noteTrack = noteTracks[0];
  const allTempos = parsedTracks.flatMap((tr) => tr.tempos).sort((a, b) => a.tick - b.tick);
  const tickToSec = makeTickToSec(allTempos, ticksPerBeat);

  const notes: ParsedNote[] = noteTrack.notes
    .map((n) => {
      const endTick = Math.max(n.endTick, n.startTick + 1);
      return {
        midi: n.midi,
        velocity: n.velocity,
        startSec: tickToSec(n.startTick),
        endSec: tickToSec(endTick),
        startBeat: n.startTick / ticksPerBeat,
        endBeat: endTick / ticksPerBeat,
      };
    })
    .sort((a, b) => a.startSec - b.startSec || a.midi - b.midi);

  const tempoSegments: TempoSegment[] = (
    allTempos.length > 0 ? allTempos : [{ tick: 0, usPerQuarter: 500000 }]
  ).map((tp) => ({ startBeat: tp.tick / ticksPerBeat, bpm: 60_000_000 / tp.usPerQuarter }));

  const durationSec = Math.max(...notes.map((n) => n.endSec));
  const durationBeats = Math.max(...notes.map((n) => n.endBeat));
  const lowestMidi = Math.min(...notes.map((n) => n.midi));
  const highestMidi = Math.max(...notes.map((n) => n.midi));

  const beatsPerBar = parsedTracks.find((tr) => tr.beatsPerBar)?.beatsPerBar ?? 4;

  return {
    notes,
    tempoSegments,
    durationSec,
    durationBeats,
    ticksPerBeat,
    beatsPerBar,
    lowestMidi,
    highestMidi,
    name: noteTrack.name,
  };
}
