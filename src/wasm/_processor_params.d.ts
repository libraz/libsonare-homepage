import type { MasteringInsertParams, MasteringSoloProcessorParams } from './public_types.js';
/**
 * Replaces each enum name in `params` with the number the flat parameter lists
 * carry, resolved by the core against `processor`'s declared choices. A string
 * for a key that is not an enum is a wrong type; an unknown name is refused by
 * the core with the key and the valid names. Internal helper shared by the
 * per-processor entry points.
 */
export declare function resolveProcessorParams(processor: string, params: MasteringSoloProcessorParams): Record<string, number | boolean>;
/**
 * Checks each value of an insert's `params` against the `type` its descriptor
 * declares and returns the document the insert is built from. A `string` key
 * takes a string, an `array` key a list of finite numbers; every other key
 * takes a finite number or boolean, or an enum name resolved as
 * {@link resolveProcessorParams} does. A wrong type is a `TypeError`, a
 * non-finite number a `RangeError`. A key the processor does not declare is
 * left to the core, which refuses it by name.
 */
export declare function resolveInsertParams(fnName: string, processor: string, params: MasteringInsertParams): Record<string, number | boolean | string | number[]>;
