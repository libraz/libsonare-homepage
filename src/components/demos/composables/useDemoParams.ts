import { reactive } from 'vue';
import type { SonareDemoDef } from '@/demos/types';

export type DemoParamValue = number | string | boolean;
export type DemoParamValues = Record<string, DemoParamValue>;

/**
 * Initializes reader-adjustable demo params from registry defaults and exposes
 * an immutable-update compatible handler for DemoControls.
 */
export function useDemoParams(def: SonareDemoDef) {
  const values = reactive<DemoParamValues>({});
  for (const param of def.params ?? []) values[param.key] = param.default;

  function updateParams(next: DemoParamValues): void {
    Object.assign(values, next);
  }

  return { values, updateParams };
}
