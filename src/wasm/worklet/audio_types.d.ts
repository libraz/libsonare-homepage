export type WorkletInput = readonly (readonly Float32Array[])[];
export type WorkletOutput = Float32Array[][];
/**
 * Copies one plane per output channel. Shared by every worklet output — the
 * engine's program and cue buses and the voice changer — so they cannot drift
 * in their padding behaviour. Allocation-free.
 *
 * A host output wider than the engine's plane count is filled by plane index,
 * never with a copy of plane 0, and no speaker-layout up-mix is applied:
 * - A single plane is copied to every output channel (mono to 2, 4 or 6
 *   outputs alike), so a mono engine driving a stereo host stays centred. For
 *   wider hosts this differs from the Web Audio mono up-mix, which feeds only
 *   the centre of a 5.1 output.
 * - With two or more planes, plane N goes to output N and an output channel
 *   past the last plane is silence.
 *
 * Everything the source does not fill is zeroed — the tail past `frames`, and
 * the remainder of a plane shorter than `frames` — so no sample of the previous
 * block survives into this one.
 */
export declare function copyPlanesToOutput(output: Float32Array[], planes: readonly Float32Array[], frames: number): void;
