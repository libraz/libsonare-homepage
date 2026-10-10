/**
 * Pack a MIDI 2.0 Program Change into its two UMP words, refusing a non-zero
 * bank MSB/LSB when `bankValid` is false (the receiver would ignore it).
 * `fnName` prefixes every refusal.
 */
export declare function packMidi2Program(fnName: string, group: number, channel: number, program: number, bankValid: boolean, bankMsb: number, bankLsb: number): [number, number];
