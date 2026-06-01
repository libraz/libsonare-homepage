import { computed, type Ref, ref } from 'vue';
import type { MasteringInsightReport, useMastering } from '@/composables/useMastering';

type MasteringApi = ReturnType<typeof useMastering>;

export interface MasteringInsightItem {
  label: string;
  value: string;
}

export interface MasteringPreviewRow {
  name: string;
  normalizationGainDb: number;
  ceilingRisk: boolean;
  safeCeilingDb: number;
  currentCeilingDb: number;
}

function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function withUnit(value: number | null, unit: string, digits = 1): string {
  return value === null ? '-' : `${value.toFixed(digits)}${unit}`;
}

function clock(seconds: number | null): string {
  if (seconds === null) return '-';
  const total = Math.round(seconds);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

const STREAMING_TARGETS = [
  { name: 'Spotify', targetLufs: -14, ceilingDb: -1 },
  { name: 'YouTube', targetLufs: -14, ceilingDb: -1 },
  { name: 'Apple Music', targetLufs: -16, ceilingDb: -1 },
  { name: 'Podcast', targetLufs: -16, ceilingDb: -1 },
];

export function useMasteringInsights(mastering: MasteringApi, currentCeilingDb?: Ref<number>) {
  const insightReport = ref<MasteringInsightReport | null>(null);
  const isAnalyzingInsights = ref(false);
  let insightRequestId = 0;

  // Curated headline metrics rather than a generic flatten of the profile object,
  // so labels read cleanly and carry units. Field paths follow masteringAudioProfile.
  const insightProfileItems = computed<MasteringInsightItem[]>(() => {
    const profile = insightReport.value?.profile as Record<string, unknown> | null;
    if (!profile) return [];
    const loudness = (profile.loudness ?? {}) as Record<string, unknown>;
    return [
      { label: 'Duration', value: clock(num(profile.durationSec)) },
      { label: 'BPM', value: num(profile.bpm) === null ? '-' : (profile.bpm as number).toFixed(1) },
      { label: 'Integrated LUFS', value: withUnit(num(loudness.integratedLufs), ' LUFS') },
      { label: 'Loudness range', value: withUnit(num(loudness.lraLu), ' LU') },
      { label: 'True peak', value: withUnit(num(loudness.truePeakDb), ' dBTP') },
      { label: 'Crest factor', value: withUnit(num(loudness.crestFactorDb), ' dB') },
    ];
  });
  // The assistant's `explanation[]` is the plain-language rationale meant for the
  // UI; `chainConfig.params` is the entire default chain (mostly unchanged), so
  // flattening it would surface noise instead of the actual suggested moves.
  const insightSuggestions = computed<string[]>(() => {
    const explanation = (insightReport.value?.suggestions as { explanation?: unknown } | null)
      ?.explanation;
    return Array.isArray(explanation)
      ? explanation.filter((entry): entry is string => typeof entry === 'string').slice(0, 6)
      : [];
  });
  // Per-platform delivery rows. The measured loudness/true-peak are identical for
  // every platform (and already shown in the profile), so the preview focuses on
  // the actionable values: the normalization gain each platform applies and
  // whether that risks the ceiling. Flattening would only surface one platform.
  const insightPreview = computed<MasteringPreviewRow[]>(() => {
    const platforms = (insightReport.value?.streamingPreview as { platforms?: unknown } | null)
      ?.platforms;
    if (!Array.isArray(platforms)) return [];
    return platforms.map((entry) => {
      const row = entry as Record<string, unknown>;
      const normalizationGainDb =
        typeof row.normalizationGainDb === 'number' ? row.normalizationGainDb : Number.NaN;
      const platformCeilingDb =
        typeof row.ceilingDb === 'number'
          ? row.ceilingDb
          : STREAMING_TARGETS.find((target) => target.name === row.name)?.ceilingDb;
      const currentCeiling = currentCeilingDb?.value;
      const safeCeilingDb =
        typeof platformCeilingDb === 'number' && Number.isFinite(normalizationGainDb)
          ? platformCeilingDb - normalizationGainDb
          : Number.NaN;
      const settingAwareRisk =
        typeof currentCeiling === 'number' && Number.isFinite(safeCeilingDb)
          ? currentCeiling > safeCeilingDb
          : Boolean(row.ceilingRisk);
      return {
        name: typeof row.name === 'string' ? row.name : '-',
        normalizationGainDb,
        ceilingRisk: settingAwareRisk,
        safeCeilingDb,
        currentCeilingDb:
          typeof currentCeiling === 'number' && Number.isFinite(currentCeiling)
            ? currentCeiling
            : Number.NaN,
      };
    });
  });

  function resetInsights() {
    insightReport.value = null;
    isAnalyzingInsights.value = false;
    insightRequestId++;
  }

  async function analyzeSourceInsights() {
    if (!mastering.source.value) return;
    const id = ++insightRequestId;
    isAnalyzingInsights.value = true;
    try {
      const report = await mastering.analyzeSource(STREAMING_TARGETS);
      if (id === insightRequestId) insightReport.value = report;
    } catch (error) {
      console.warn('Mastering insight analysis failed:', error);
    } finally {
      if (id === insightRequestId) isAnalyzingInsights.value = false;
    }
  }

  return {
    insightReport,
    isAnalyzingInsights,
    insightProfileItems,
    insightSuggestions,
    insightPreview,
    analyzeSourceInsights,
    resetInsights,
  };
}
