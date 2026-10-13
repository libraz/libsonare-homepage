// @vitest-environment node
import { beforeAll, describe, expect, it } from 'vitest';
import { MASTERING_INSERT_LAYOUT } from '@/demos/mastering/masteringState';
import { MASTERING_SLOT_CONTROLS } from '@/demos/mastering/masteringUi';
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

/** The unit label a control prints, against the catalogue unit it stands for. */
const UNIT_LABELS: Readonly<Record<string, readonly (string | null)[]>> = {
  dB: ['dB'],
  dBTP: ['dBFS'],
  ms: ['ms'],
  Hz: ['Hz'],
  ips: ['inPerSec'],
  ':1': ['ratio'],
  '×': ['none'],
  '': ['none', 'percent'],
};

let wasm: Awaited<ReturnType<typeof loadIndexModule>>;

beforeAll(async () => {
  wasm = await loadIndexModule();
}, 30_000);

describe('mastering control ranges against the engine catalogue', () => {
  it('keeps every control inside the accepted range and in the published unit', () => {
    const problems: string[] = [];
    for (const entry of MASTERING_INSERT_LAYOUT) {
      const catalog = new Map<string, CatalogParam>(
        (wasm.masteringInsertParamInfo(entry.processor) as CatalogParam[]).map((p) => [p.name, p]),
      );
      for (const group of MASTERING_SLOT_CONTROLS[entry.id]) {
        for (const spec of group.params) {
          if ('toggle' in spec) continue;
          const label = `${entry.processor}.${spec.name}`;
          const info = catalog.get(spec.name);
          if (!info) {
            problems.push(`${label}: not in the catalogue`);
            continue;
          }
          if (info.min !== null && (info.minExclusive ? spec.min <= info.min : spec.min < info.min))
            problems.push(`${label}: control min ${spec.min} below catalogue min ${info.min}`);
          if (info.max !== null && (info.maxExclusive ? spec.max >= info.max : spec.max > info.max))
            problems.push(`${label}: control max ${spec.max} above catalogue max ${info.max}`);
          if (!(UNIT_LABELS[spec.unit] ?? []).includes(info.unit))
            problems.push(`${label}: control unit '${spec.unit}' vs catalogue '${info.unit}'`);
        }
      }
    }
    expect(problems).toEqual([]);
  });
});
