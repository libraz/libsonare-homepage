/**
 * The source assistant panel's data: the program's profile, the assistant's
 * suggested moves and chain, and the per-platform delivery estimate. The page
 * hands in an adapter that runs the analysis in the Worker; this module only
 * orders the requests and formats the result.
 */
import { computed, type Ref, ref, watch } from 'vue';
import { enCopy } from '@/demos/mastering/masteringCopy';
import type {
  MasteringAssistantPreset,
  MasteringPresetId,
  MasteringStreamingTarget,
} from '@/demos/mastering/useMastering';

/** What one analysis returns. */
export interface MasteringInsightReport {
  /** Stereo profile; its `loudness` block is measured on the pair itself. */
  profile: unknown;
  suggestions: unknown;
  /** Per-platform estimate of the last rendered master, or null before a render. */
  streamingPreview: unknown;
  /** Flat chain suggestion the state can take with `applyAssistant`. */
  chainParams?: Record<string, number | boolean>;
  /** Keys of `chainParams` the state cannot carry. */
  unmapped?: string[];
}

/** The page side of the panel: whether there is a program, and how to analyse it. */
export interface MasteringInsightSource {
  source: Ref<unknown>;
  analyzeSource(
    platforms: MasteringStreamingTarget[],
    preset?: MasteringAssistantPreset,
  ): Promise<MasteringInsightReport>;
}

/** Labels of the profile rows, in display order. */
export type MasteringProfileLabels = typeof enCopy.insights.profileItems;

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

const STREAMING_TARGETS: MasteringStreamingTarget[] = [
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
  mastering: MasteringInsightSource,
  currentCeilingDb?: Ref<number>,
  selectedPreset?: Ref<MasteringPresetId>,
  labels: Ref<MasteringProfileLabels> = ref(enCopy.insights.profileItems),
) {
  const insightReport = ref<MasteringInsightReport | null>(null);
  const isAnalyzingInsights = ref(false);
  let insightRequestId = 0;

  // Level figures come from the profile's `loudness` block, measured on the pair.
  const insightProfileItems = computed<MasteringInsightItem[]>(() => {
    const profile = insightReport.value?.profile as Record<string, unknown> | null;
    if (!profile) return [];
    const loudness = (profile.loudness ?? {}) as Record<string, unknown>;
    const text = labels.value;
    return [
      { label: text.duration, value: clock(num(profile.durationSec)) },
      {
        label: text.bpm,
        value: num(profile.bpm) === null ? '-' : (profile.bpm as number).toFixed(1),
      },
      { label: text.integrated, value: withUnit(num(loudness.integratedLufs), ' LUFS') },
      { label: text.lra, value: withUnit(num(loudness.lraLu), ' LU') },
      { label: text.truePeak, value: withUnit(num(loudness.truePeakDb), ' dBTP') },
      { label: text.crest, value: withUnit(num(loudness.crestFactorDb), ' dB') },
    ];
  });
  // `explanation[]` is the assistant's rationale written for display.
  const insightSuggestions = computed<string[]>(() => {
    const explanation = (insightReport.value?.suggestions as { explanation?: unknown } | null)
      ?.explanation;
    return Array.isArray(explanation)
      ? explanation.filter((entry): entry is string => typeof entry === 'string').slice(0, 6)
      : [];
  });
  // Each row echoes the ceiling of the platform spec it was derived from.
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
      // A background pass: a failure stays here, off the page's error channel.
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
