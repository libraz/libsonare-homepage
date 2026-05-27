import type { MasteringPlatformId, MasteringPresetId } from '@/composables/useMastering';

export interface MasteringReportPayload {
  preset: MasteringPresetId;
  platform: MasteringPlatformId;
  targetLufs: number;
  tuning: {
    tone: number;
    width: number;
    dynamics: number;
  };
  source: unknown;
  rendered: unknown;
  reference: unknown;
}

export function reportItems(
  value: unknown,
  limit: number,
): Array<{ label: string; value: string }> {
  return flattenReport(value)
    .slice(0, limit)
    .map(([label, itemValue]) => ({
      label: prettyReportKey(label),
      value: formatReportValue(itemValue),
    }));
}

export function createMasteringReportUrl(payload: MasteringReportPayload): string {
  return URL.createObjectURL(
    new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    }),
  );
}

function flattenReport(value: unknown, prefix = ''): Array<[string, unknown]> {
  if (value == null) return [];
  if (Array.isArray(value)) {
    return value
      .slice(0, 4)
      .flatMap((item, index) => flattenReport(item, `${prefix}${prefix ? '.' : ''}${index + 1}`));
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    const primitiveEntries = entries.filter(
      ([, child]) => child == null || typeof child !== 'object',
    );
    const nestedEntries = entries.filter(([, child]) => child && typeof child === 'object');
    return [
      ...primitiveEntries.map(
        ([key, child]) => [`${prefix}${prefix ? '.' : ''}${key}`, child] as [string, unknown],
      ),
      ...nestedEntries.flatMap(([key, child]) =>
        flattenReport(child, `${prefix}${prefix ? '.' : ''}${key}`),
      ),
    ];
  }
  return [[prefix || 'value', value]];
}

function prettyReportKey(key: string): string {
  return key
    .replace(/[_-]/g, ' ')
    .replace(/\./g, ' / ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatReportValue(value: unknown): string {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return '-';
    return Math.abs(value) >= 100 ? value.toFixed(0) : value.toFixed(2);
  }
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (value == null) return '-';
  return String(value);
}
