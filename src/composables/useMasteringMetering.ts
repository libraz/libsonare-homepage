import { computed, type Ref } from 'vue';
import type { DecodedMasteringAudio, useMastering } from '@/composables/useMastering';
import {
  analyzeMasteringSignal,
  formatMasteringDuration,
  normalizeRange,
} from '@/utils/masteringMetrics';

type MasteringApi = ReturnType<typeof useMastering>;

interface MasteringMeteringOptions {
  mastering: MasteringApi;
  reference: Ref<DecodedMasteringAudio | null>;
  targetLufs: Ref<number>;
  t: (key: string) => string;
}

export function useMasteringMetering(options: MasteringMeteringOptions) {
  const sourceMetrics = computed(() => {
    const audio = options.mastering.source.value;
    if (!audio) return null;
    const stats = analyzeMasteringSignal(audio.left, audio.right);
    return {
      duration: formatMasteringDuration(audio.duration),
      sampleRate: `${Math.round(audio.sampleRate / 1000)} kHz`,
      channels: audio.channels === 1 ? 'Mono' : 'Stereo',
      peak: `${stats.peakDb.toFixed(1)} dBFS`,
      rms: `${stats.rmsDb.toFixed(1)} dBFS`,
      crest: `${stats.crestDb.toFixed(1)} dB`,
      correlation: stats.correlation.toFixed(2),
    };
  });

  const masterMetrics = computed(() => {
    const audio = options.mastering.rendered.value;
    if (!audio) return null;
    const stats = analyzeMasteringSignal(audio.left, audio.right);
    return {
      peak: `${stats.peakDb.toFixed(1)} dBFS`,
      rms: `${stats.rmsDb.toFixed(1)} dBFS`,
      crest: `${stats.crestDb.toFixed(1)} dB`,
      correlation: stats.correlation.toFixed(2),
    };
  });

  const referenceMetrics = computed(() => {
    const audio = options.reference.value;
    if (!audio) return null;
    const stats = analyzeMasteringSignal(audio.left, audio.right);
    return {
      fileName: audio.fileName,
      duration: formatMasteringDuration(audio.duration),
      peak: `${stats.peakDb.toFixed(1)} dBFS`,
      rms: `${stats.rmsDb.toFixed(1)} dBFS`,
      crest: `${stats.crestDb.toFixed(1)} dB`,
      correlation: stats.correlation.toFixed(2),
    };
  });

  const meterReadings = computed(() => {
    const rendered = options.mastering.rendered.value;
    const outputLufs = rendered?.outputLufs ?? options.targetLufs.value;
    const peakValue = Number.parseFloat(
      (masterMetrics.value?.peak || sourceMetrics.value?.peak || '-60').replace(' dBFS', ''),
    );
    const crestValue = Number.parseFloat(
      (masterMetrics.value?.crest || sourceMetrics.value?.crest || '0').replace(' dB', ''),
    );
    const corrValue = Number.parseFloat(
      masterMetrics.value?.correlation || sourceMetrics.value?.correlation || '0',
    );

    return [
      {
        id: 'lufs',
        label: options.t('master.meters.outputLufs'),
        value: `${outputLufs.toFixed(1)} LUFS`,
        percent: normalizeRange(outputLufs, -24, -8),
      },
      {
        id: 'peak',
        label: options.t('master.meters.peak'),
        value: `${peakValue.toFixed(1)} dBFS`,
        percent: normalizeRange(peakValue, -24, 0),
      },
      {
        id: 'crest',
        label: options.t('master.meters.crest'),
        value: `${crestValue.toFixed(1)} dB`,
        percent: normalizeRange(crestValue, 4, 18),
      },
      {
        id: 'correlation',
        label: options.t('master.meters.correlation'),
        value: corrValue.toFixed(2),
        percent: normalizeRange(corrValue, -1, 1),
      },
    ];
  });

  const phasePoints = computed(() => {
    const audio = options.mastering.rendered.value || options.mastering.source.value;
    if (!audio) return [];

    const points: Array<{ x: number; y: number; opacity: number }> = [];
    const stride = Math.max(1, Math.floor(audio.left.length / 96));
    for (let i = 0; i < audio.left.length && points.length < 96; i += stride) {
      const left = audio.left[i];
      const right = audio.right[i] ?? left;
      points.push({
        x: 50 + Math.max(-1, Math.min(1, (left - right) * 0.75)) * 44,
        y: 50 - Math.max(-1, Math.min(1, (left + right) * 0.5)) * 44,
        opacity: 0.28 + Math.min(0.7, Math.abs(left) + Math.abs(right)),
      });
    }
    return points;
  });

  const stereoImage = computed(() => {
    const correlation = Number.parseFloat(
      masterMetrics.value?.correlation || sourceMetrics.value?.correlation || '0',
    );
    return {
      width: `${Math.max(12, Math.min(100, (1 - correlation) * 50 + 22))}%`,
      label:
        correlation > 0.85
          ? options.t('master.meters.stereoNarrow')
          : correlation > 0.25
            ? options.t('master.meters.stereoBalanced')
            : options.t('master.meters.stereoWide'),
    };
  });

  return {
    sourceMetrics,
    masterMetrics,
    referenceMetrics,
    meterReadings,
    phasePoints,
    stereoImage,
  };
}
