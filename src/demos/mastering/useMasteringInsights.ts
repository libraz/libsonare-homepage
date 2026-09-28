import { computed, type Ref, ref, watch } from 'vue';
import type {
  MasteringAssistantPreset,
  MasteringInsightReport,
  MasteringPresetId,
  useMastering,
} from '@/demos/mastering/useMastering';

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

/** Map the UI's recording/genre choices to libsonare assistant presets. */
export function assistantPresetForAnalysis(preset: MasteringPresetId): MasteringAssistantPreset {
  if (preset === 'hiphop') return 'hipHop';
  // The assistant has no venue-specific preset. Keep the live render preset
  // selected in the UI, while using the dynamics-preserving acoustic profile
  // as the analysis baseline for both live-room choices.
  if (preset === 'liveSmall' || preset === 'liveLarge') return 'acoustic';
  return preset;
}

export function useMasteringInsights(
  mastering: MasteringApi,
  currentCeilingDb?: Ref<number>,
  selectedPreset?: Ref<MasteringPresetId>,
) {
  const insightReport = ref<MasteringInsightReport | null>(null);
  const isAnalyzingInsights = ref(false);
  let insightRequestId = 0;

  // Curated headline metrics rather than a generic flatten of the profile object,
  // so labels read cleanly and carry units. Field paths follow
  // masteringAudioProfileStereo.
  //
  // Every figure derived from absolute level — integrated LUFS, loudness range,
  // true peak, crest factor — comes from that profile's `loudness` block, which
  // the engine measures from the two channels, so they describe the programme as
  // delivered. Duration and BPM describe timing rather than level and are
  // measured on the downmix, which is the right scope for them.
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
  //
  // Each row echoes the ceiling of the platform spec it was derived from, so the
  // ceiling never has to be recovered by matching a platform name.
  const insightPreview = computed<MasteringPreviewRow[]>(() => {
    const platforms = (insightReport.value?.streamingPreview as { platforms?: unknown } | null)
      ?.platforms;
    if (!Array.isArray(platforms)) return [];
    return platforms.map((entry) => {
      const row = entry as Record<string, unknown>;
      const normalizationGainDb =
        typeof row.normalizationGainDb === 'number' ? row.normalizationGainDb : Number.NaN;
      const platformCeilingDb = num(row.ceilingDb);
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
    insightReport.value = null;
    isAnalyzingInsights.value = true;
    try {
      const assistantPreset = selectedPreset
        ? assistantPresetForAnalysis(selectedPreset.value)
        : undefined;
      const report = assistantPreset
        ? await mastering.analyzeSource(STREAMING_TARGETS, assistantPreset)
        : await mastering.analyzeSource(STREAMING_TARGETS);
      if (id === insightRequestId) insightReport.value = report;
    } catch (error) {
      // Insight analysis is a best-effort background pass. A failure here (e.g.
      // empty audio) stays on this non-fatal channel
      // and must not mutate the shared foreground error state.
      console.warn('Mastering insight analysis failed:', error);
    } finally {
      if (id === insightRequestId) isAnalyzingInsights.value = false;
    }
  }

  if (selectedPreset) {
    watch(selectedPreset, () => {
      if (mastering.source.value) void analyzeSourceInsights();
    });
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
