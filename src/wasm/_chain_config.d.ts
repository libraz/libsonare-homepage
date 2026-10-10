import type { MasteringChainConfig } from './public_types.js';
/**
 * Flattens a nested {@link MasteringChainConfig} into the dot-notation
 * `{ "module.processor.param": value }` map the core consumes. Internal helper
 * shared by the mastering-chain / master-audio entry points. The core owns
 * legacy leaf-name aliases, so this remains a structural flattening step.
 *
 * A key the caller already wrote in dot notation carries through untouched, so
 * both spellings a {@link MasteringChainConfig} accepts reach the core as the
 * same parameter — matching what the Python binding documents. An unknown key
 * in either spelling is rejected by the core, not here.
 *
 * An array recurses as `<path>.<index>` (`crossover.cutoffsHz.0`,
 * `bands.2.thresholdDb`). An empty array is refused by its path, since it has
 * no flat key and dropping it would silently edit nothing.
 *
 * An enum-valued key may be given by its name (`noiseEstimator: 'mcra'`); the
 * core resolves the name to the number every flat parameter list carries and
 * refuses an unknown one with the key and the valid names.
 */
export declare function flattenChainConfig(config: MasteringChainConfig): Record<string, number | boolean>;
