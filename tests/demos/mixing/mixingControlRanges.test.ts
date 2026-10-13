// @vitest-environment node
import { beforeAll, describe, expect, it } from 'vitest';
import {
  BUS_CONTROLS,
  busProcessor,
  DYNAMICS_SLOTS,
  MASTER_SLOT_CONTROLS,
  masterSlotProcessor,
  type ParamControl,
  TRACK_SLOT_CONTROLS,
  trackSlotProcessor,
} from '@/demos/mixing/mixingUi';
import { loadIndexModule } from '../../wasm/support/engineHarness';

/**
 * Each control's travel sits inside what the engine's parameter catalogue
 * accepts (a value outside it throws) and is labelled in the catalogue's unit.
 */

interface CatalogParam {
  name: string;
  min: number | null;
  max: number | null;
  minExclusive: boolean;
  maxExclusive: boolean;
  unit: string | null;
}

/** The unit label a control prints, against the catalogue units it stands for. */
const UNIT_LABELS: Readonly<Record<string, readonly (string | null)[]>> = {
  dB: ['dB', 'dBFS'],
  ms: ['ms'],
  Hz: ['Hz'],
  ':1': ['ratio'],
  '%': ['none', 'percent'],
  '': ['none', 'percent'],
};

/** Controls whose displayed quantity is derived from the catalogue parameter, not equal to it. */
const DERIVED = new Set(['effects.reverb.plate:decay']);

let wasm: Awaited<ReturnType<typeof loadIndexModule>>;

beforeAll(async () => {
  wasm = await loadIndexModule();
}, 30_000);

function controlsByProcessor(): Map<string, readonly ParamControl[]> {
  const table = new Map<string, readonly ParamControl[]>();
  for (const slot of DYNAMICS_SLOTS) table.set(trackSlotProcessor(slot), TRACK_SLOT_CONTROLS[slot]);
  for (const slot of ['glue', 'limiter'] as const)
    table.set(masterSlotProcessor(slot), MASTER_SLOT_CONTROLS[slot]);
  for (const bus of ['reverb', 'delay'] as const) table.set(busProcessor(bus), BUS_CONTROLS[bus]);
  return table;
}

describe('mixing control ranges against the engine catalogue', () => {
  it('keeps every control inside the accepted range and in the published unit', () => {
    const problems: string[] = [];
    for (const [processor, controls] of controlsByProcessor()) {
      const catalog = new Map<string, CatalogParam>(
        (wasm.masteringInsertParamInfo(processor) as CatalogParam[]).map((p) => [p.name, p]),
      );
      for (const control of controls) {
        if (DERIVED.has(`${processor}:${control.name}`)) continue;
        const label = `${processor}.${control.name}`;
        const info = catalog.get(control.name);
        if (!info) {
          problems.push(`${label}: not in the catalogue`);
          continue;
        }
        if (
          info.min !== null &&
          (info.minExclusive ? control.min <= info.min : control.min < info.min)
        )
          problems.push(`${label}: control min ${control.min} below catalogue min ${info.min}`);
        if (
          info.max !== null &&
          (info.maxExclusive ? control.max >= info.max : control.max > info.max)
        )
          problems.push(`${label}: control max ${control.max} above catalogue max ${info.max}`);
        if (!(UNIT_LABELS[control.unit] ?? []).includes(info.unit))
          problems.push(`${label}: control unit '${control.unit}' vs catalogue '${info.unit}'`);
      }
    }
    expect(problems).toEqual([]);
  });
});
