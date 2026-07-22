import { describe, expect, it, vi } from 'vitest';
import { ref, shallowRef } from 'vue';
import {
  type DecodedMasteringAudio,
  defaultModuleSettings,
  type RenderedMasteringAudio,
} from '@/composables/useMastering';
import { useMasteringMetering } from '@/composables/useMasteringMetering';
import { useMasteringSession } from '@/composables/useMasteringSession';
import {
  analyzeMasteringSignal,
  dbToLinear,
  formatMasteringDuration,
  normalizeRange,
} from '@/utils/masteringMetrics';
import { createMasteringReportUrl, reportItems } from '@/utils/masteringReport';

function decodedAudio(overrides: Partial<DecodedMasteringAudio> = {}): DecodedMasteringAudio {
  return {
    fileName: 'source.wav',
    sampleRate: 48_000,
    duration: 125,
    channels: 2,
    left: new Float32Array([0.5, -0.5, 0.25, -0.25]),
    right: new Float32Array([0.5, -0.5, -0.25, 0.25]),
    ...overrides,
  };
}

function renderedAudio(overrides: Partial<RenderedMasteringAudio> = {}): RenderedMasteringAudio {
  return {
    left: new Float32Array([0.25, -0.25, 0.125, -0.125]),
    right: new Float32Array([0.2, -0.2, 0.1, -0.1]),
    sampleRate: 48_000,
    inputLufs: -18,
    outputLufs: -14,
    appliedGainDb: 4,
    stages: ['eq.tilt'],
    latencySamples: 8,
    ...overrides,
  };
}

describe('mastering metrics and report helpers', () => {
  it('computes bounded mastering stats and formatting helpers', () => {
    const stats = analyzeMasteringSignal(
      new Float32Array([0.5, -0.5, 0.25, -0.25]),
      new Float32Array([0.5, -0.5, -0.25, 0.25]),
    );

    expect(stats.peakDb).toBeCloseTo(-6.02, 1);
    expect(stats.rmsDb).toBeLessThan(stats.peakDb);
    expect(stats.crestDb).toBeGreaterThan(0);
    expect(stats.correlation).toBeGreaterThanOrEqual(-1);
    expect(stats.correlation).toBeLessThanOrEqual(1);
    expect(formatMasteringDuration(125)).toBe('2:05');
    expect(dbToLinear(-6)).toBeCloseTo(0.501, 3);
    expect(dbToLinear(6)).toBe(1);
    expect(normalizeRange(-16, -24, -8)).toBe(50);
    expect(normalizeRange(Number.NaN, -24, -8)).toBe(0);
  });

  it('handles silence, missing right channel samples and out-of-range normalization safely', () => {
    const silent = analyzeMasteringSignal(new Float32Array([0, 0, 0]), new Float32Array([]));

    expect(silent).toEqual({
      peakDb: -120,
      rmsDb: -120,
      crestDb: 0,
      correlation: 0,
    });

    const fallbackRight = analyzeMasteringSignal(
      new Float32Array([1, -1, 0.5, -0.5]),
      new Float32Array([1]),
    );
    expect(fallbackRight.peakDb).toBeCloseTo(0, 6);
    expect(fallbackRight.correlation).toBeGreaterThan(0.9);
    expect(formatMasteringDuration(59.6)).toBe('1:00');
    expect(formatMasteringDuration(Number.NaN)).toBe('0:00');
    expect(formatMasteringDuration(Number.POSITIVE_INFINITY)).toBe('0:00');
    expect(dbToLinear(-Infinity)).toBe(0);
    expect(normalizeRange(-99, -24, -8)).toBe(0);
    expect(normalizeRange(0, -24, -8)).toBe(100);
  });

  it('does not miss a single-sample peak between decimated RMS positions', () => {
    const left = new Float32Array(400_002);
    const right = new Float32Array(400_002);
    left[1] = 1;
    expect(analyzeMasteringSignal(left, right).peakDb).toBeCloseTo(0, 6);
  });

  it('flattens nested report values and creates json blob urls', () => {
    const items = reportItems(
      {
        integratedLufs: -14.1234,
        ok: true,
        missing: null,
        nested: {
          true_peak_db: -1.25,
          platforms: [
            { name: 'A', gainDb: 1.234 },
            { name: 'B', gainDb: 100.2 },
          ],
        },
      },
      8,
    );

    expect(items).toEqual(
      expect.arrayContaining([
        { label: 'IntegratedLufs', value: '-14.12' },
        { label: 'Ok', value: 'Yes' },
        { label: 'Missing', value: '-' },
        { label: 'Nested / True Peak Db', value: '-1.25' },
        { label: 'Nested / Platforms / 2 / GainDb', value: '100' },
      ]),
    );

    expect(
      createMasteringReportUrl({
        preset: 'pop',
        venue: 'studio',
        platform: 'spotify',
        targetLufs: -14,
        tuning: { tone: 50, width: 50, dynamics: 50 },
        source: { peak: -6 },
        rendered: { peak: -1 },
        reference: null,
      }),
    ).toBe('blob:test');
  });

  it('limits report arrays and serializes complete report payloads into blobs', async () => {
    const items = reportItems(
      {
        platforms: [
          { name: 'Spotify', gain: -1.5 },
          { name: 'YouTube', gain: 0 },
          { name: 'Apple', gain: 1.25 },
          { name: 'Podcast', gain: -3 },
          { name: 'Ignored', gain: 99 },
        ],
        nested: { bad: Number.POSITIVE_INFINITY, text: 'ok' },
      },
      20,
    );

    expect(items.some((item) => item.label.includes('Ignored'))).toBe(false);
    expect(items).toContainEqual({ label: 'Nested / Bad', value: '-' });
    expect(items).toContainEqual({ label: 'Nested / Text', value: 'ok' });

    const originalCreateObjectURL = URL.createObjectURL;
    const originalBlob = globalThis.Blob;
    try {
      const urls: Blob[] = [];
      const blobParts: unknown[][] = [];
      globalThis.Blob = vi.fn(function (parts: BlobPart[], options?: BlobPropertyBag) {
        blobParts.push(parts);
        return new originalBlob(parts, options);
      }) as unknown as typeof Blob;
      URL.createObjectURL = vi.fn((blob: Blob) => {
        urls.push(blob);
        return 'blob:report';
      });

      expect(
        createMasteringReportUrl({
          preset: 'rock',
          venue: 'livehouseLarge',
          platform: 'custom',
          targetLufs: -12,
          tuning: { tone: 60, width: 40, dynamics: 70 },
          source: { peak: -6 },
          rendered: { peak: -1, ok: true },
          reference: { name: 'ref.wav' },
        }),
      ).toBe('blob:report');

      expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
      expect(urls[0].type).toBe('application/json');
      expect(String(blobParts[0][0])).toContain('"preset": "rock"');
      expect(String(blobParts[0][0])).toContain('"reference"');
    } finally {
      globalThis.Blob = originalBlob;
      URL.createObjectURL = originalCreateObjectURL;
    }
  });
});

describe('useMasteringMetering', () => {
  it('derives source, rendered, reference, meter and stereo image values', () => {
    const mastering = {
      source: shallowRef(decodedAudio()),
      rendered: shallowRef(renderedAudio()),
    } as any;
    const metering = useMasteringMetering({
      mastering,
      reference: shallowRef(decodedAudio({ fileName: 'reference.wav', duration: 60 })),
      targetLufs: ref(-16),
      t: (key) => key,
    });

    expect(metering.sourceMetrics.value).toMatchObject({
      duration: '2:05',
      sampleRate: '48 kHz',
      channels: 'Stereo',
    });
    expect(metering.sourceMetrics.value?.peak).toContain('dBFS');
    expect(metering.masterMetrics.value?.peak).toContain('dBFS');
    expect(metering.referenceMetrics.value).toMatchObject({
      fileName: 'reference.wav',
      duration: '1:00',
    });
    expect(metering.meterReadings.value.map((reading) => reading.id)).toEqual([
      'lufs',
      'peak',
      'crest',
      'correlation',
    ]);
    expect(metering.meterReadings.value[0]).toMatchObject({
      label: 'master.meters.outputLufs',
      value: '-14.0 LUFS',
    });
    expect(metering.phasePoints.value.length).toBeGreaterThan(0);
    expect(metering.phasePoints.value[0]).toMatchObject({
      x: expect.any(Number),
      y: expect.any(Number),
      opacity: expect.any(Number),
    });
    expect(metering.stereoImage.value.label).toMatch(/^master\.meters\.stereo/);
  });

  it('falls back to source metrics and target lufs when no render exists', () => {
    const mastering = {
      source: shallowRef(
        decodedAudio({ channels: 1, right: new Float32Array([0.5, -0.5, 0.25, -0.25]) }),
      ),
      rendered: shallowRef(null),
    } as any;
    const metering = useMasteringMetering({
      mastering,
      reference: shallowRef(null),
      targetLufs: ref(-16),
      t: (key) => key,
    });

    expect(metering.sourceMetrics.value?.channels).toBe('Mono');
    expect(metering.masterMetrics.value).toBeNull();
    expect(metering.referenceMetrics.value).toBeNull();
    expect(metering.meterReadings.value[0].value).toBe('-16.0 LUFS');
    expect(metering.phasePoints.value.length).toBeGreaterThan(0);
  });
});

describe('useMasteringSession', () => {
  function makeState() {
    return {
      mode: ref<'quick' | 'studio'>('quick'),
      selectedPreset: ref<'pop' | 'edm'>('pop'),
      selectedVenue: ref<'studio' | 'livehouseSmall' | 'livehouseLarge'>('studio'),
      selectedPlatform: ref<'spotify' | 'youtube' | 'custom'>('spotify'),
      customLufs: ref(-14),
      tone: ref(50),
      width: ref(50),
      dynamics: ref(50),
      showFineTune: ref(false),
      activeModule: ref('eq'),
      loudnessMatched: ref(false),
      moduleSettings: ref(defaultModuleSettings()),
      chainSettingsUrl: ref<string | null>(null),
      localError: ref<string | null>(null),
      t: (key: string) => key,
    };
  }

  it('applies only valid settings and clamps numeric session values', () => {
    const state = makeState();
    const session = useMasteringSession(state as any);

    session.applySessionSettings({
      mode: 'studio',
      selectedPreset: 'edm',
      selectedVenue: 'livehouseSmall',
      selectedPlatform: 'custom',
      customLufs: -99,
      tone: 150,
      width: -20,
      dynamics: 75,
      showFineTune: true,
      activeModule: 'limiter',
      loudnessMatched: true,
      moduleSettings: { inputGainDb: 3, tiltDb: 2 } as any,
    });

    expect(session.currentSessionSettings()).toMatchObject({
      mode: 'studio',
      selectedPreset: 'edm',
      selectedVenue: 'livehouseSmall',
      selectedPlatform: 'custom',
      customLufs: -24,
      tone: 100,
      width: 0,
      dynamics: 75,
      showFineTune: true,
      loudnessMatched: true,
    });
    expect(state.moduleSettings.value).toMatchObject({ inputGainDb: 3, tiltDb: 2 });

    session.applySessionSettings({
      mode: 'bad',
      selectedPreset: 'missing',
      selectedVenue: 'missing',
      selectedPlatform: 'missing',
      activeModule: 'missing',
    } as any);
    expect(state.mode.value).toBe('studio');
    expect(state.selectedPreset.value).toBe('edm');
    expect(state.selectedVenue.value).toBe('livehouseSmall');
    expect(state.selectedPlatform.value).toBe('custom');
    expect(state.activeModule.value).toBe('limiter');

    const originalSettings = { ...state.moduleSettings.value };
    session.applySessionSettings({
      moduleSettings: {
        ...originalSettings,
        limiterCeilingDb: 999,
        compressorRatio: 'not-a-number',
        unknownSetting: 12,
      },
    } as any);
    expect(state.moduleSettings.value.limiterCeilingDb).toBeLessThan(999);
    expect(state.moduleSettings.value.compressorRatio).toBe(originalSettings.compressorRatio);
    expect(state.moduleSettings.value).not.toHaveProperty('unknownSetting');
  });

  it('saves/restores sessions, handles corrupt storage, and imports/exports presets', async () => {
    const state = makeState();
    const session = useMasteringSession(state as any);

    session.applySessionSettings({ mode: 'studio', customLufs: -12, tone: 80 });
    session.saveSession();

    const restoredState = makeState();
    const restoredSession = useMasteringSession(restoredState as any);
    restoredSession.restoreSession();
    expect(restoredState.mode.value).toBe('studio');
    expect(restoredState.customLufs.value).toBe(-12);
    expect(restoredState.tone.value).toBe(80);

    sessionStorage.setItem('libsonare-mastering-session-v1', '{bad json');
    restoredSession.restoreSession();
    expect(sessionStorage.getItem('libsonare-mastering-session-v1')).toBeNull();

    localStorage.removeItem('libsonare-mastering-chain-preset-v1');
    restoredSession.loadChainPreset();
    expect(restoredState.localError.value).toBe('master.errors.noSavedPreset');

    session.saveChainPreset();
    restoredSession.loadChainPreset();
    expect(restoredState.localError.value).toBeNull();
    expect(restoredState.mode.value).toBe('studio');

    restoredSession.exportChainSettings();
    expect(restoredState.chainSettingsUrl.value).toBe('blob:test');

    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL');
    restoredSession.exportChainSettings();
    expect(revokeSpy).toHaveBeenCalledWith('blob:test');
    revokeSpy.mockRestore();

    await restoredSession.handleChainImport({
      target: {
        files: [{ text: async () => JSON.stringify({ settings: { customLufs: -9, width: 90 } }) }],
        value: 'preset.json',
      },
    } as unknown as Event);
    expect(restoredState.customLufs.value).toBe(-9);
    expect(restoredState.width.value).toBe(90);

    await restoredSession.handleChainImport({
      target: {
        files: [{ text: async () => '{bad json' }],
        value: 'bad.json',
      },
    } as unknown as Event);
    expect(restoredState.localError.value).toBe('master.errors.presetLoadFailed');

    await restoredSession.handleChainImport({
      target: {
        files: [
          {
            size: 1_000_001,
            text: vi.fn(async () => JSON.stringify({ settings: {} })),
          },
        ],
        value: 'huge.json',
      },
    } as unknown as Event);
    expect(restoredState.localError.value).toBe('master.errors.presetLoadFailed');
  });
});
