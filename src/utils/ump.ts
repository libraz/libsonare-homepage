/**
 * UMP MIDI 1.0 channel-voice words (group 0) for the engine's clip events.
 * `EngineMidiEvent.word0` carries the group in bits 24..27, so group 0 is the
 * bare message.
 */

/** Note-on word for a 7-bit note and velocity. */
export function noteOnWord(note: number, velocity: number): number {
  return ((0x2 << 28) | (0x9 << 20) | ((note & 0x7f) << 8) | (velocity & 0x7f)) >>> 0;
}

/** Note-off word for a 7-bit note, at release velocity 0. */
export function noteOffWord(note: number): number {
  return ((0x2 << 28) | (0x8 << 20) | ((note & 0x7f) << 8)) >>> 0;
}
