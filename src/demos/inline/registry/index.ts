/**
 * Aggregated registry of inline documentation demos.
 *
 * Each cluster contributes an array of {@link SonareDemoDef}. They are merged into a
 * single id → def map consumed by the `<SonareDemo>` dispatcher. Ids must be unique
 * across clusters; {@link getDemo} is the single lookup entry point.
 */

import type { SonareDemoDef } from '../types';
import { acousticsDemos } from './acoustics';
import { analysisDemos } from './analysis';
import { editingDemos } from './editing';
import { instrumentsDemos } from './instruments';
import { masteringDemos } from './mastering';
import { realtimeDemos } from './realtime';

const allDemos: SonareDemoDef[] = [
  ...analysisDemos,
  ...instrumentsDemos,
  ...acousticsDemos,
  ...editingDemos,
  ...masteringDemos,
  ...realtimeDemos,
];

const byId = new Map<string, SonareDemoDef>();
for (const def of allDemos) {
  if (byId.has(def.id)) {
    throw new Error(`duplicate SonareDemo id: ${def.id}`);
  }
  byId.set(def.id, def);
}

/** Resolve a demo definition by id, or `undefined` if unknown. */
export function getDemo(id: string): SonareDemoDef | undefined {
  return byId.get(id);
}

/** All registered demo ids (used by tests / tooling). */
export function demoIds(): string[] {
  return [...byId.keys()];
}

export { allDemos };
