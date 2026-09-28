import { describe, expect, it, vi } from 'vitest';
import { nextTick, ref } from 'vue';
import type { MasteringPresetId } from '@/demos/mastering/useMastering';
import {
  assistantPresetForAnalysis,
  useMasteringInsights,
} from '@/demos/mastering/useMasteringInsights';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

function report(label: string) {
  return {
    profile: { label },
    suggestions: { explanation: [`base preset: ${label}`] },
    streamingPreview: { platforms: [] },
  };
}

describe('useMasteringInsights assistant preset selection', () => {
  it.each([
    ['pop', 'pop'],
    ['edm', 'edm'],
    ['acoustic', 'acoustic'],
    ['liveSmall', 'acoustic'],
    ['liveLarge', 'acoustic'],
    ['hiphop', 'hipHop'],
    ['aiMusic', 'aiMusic'],
    ['speech', 'speech'],
  ] as Array<[MasteringPresetId, string]>)('maps %s to %s', (uiPreset, corePreset) => {
    expect(assistantPresetForAnalysis(uiPreset)).toBe(corePreset);
  });

  it('reanalyzes on preset changes and keeps the newest result', async () => {
    const source = ref({ left: new Float32Array([0]), right: new Float32Array([0]) });
    const selectedPreset = ref<MasteringPresetId>('pop');
    const pending = [deferred<any>(), deferred<any>(), deferred<any>()];
    const analyzeSource = vi
      .fn()
      .mockReturnValueOnce(pending[0].promise)
      .mockReturnValueOnce(pending[1].promise)
      .mockReturnValueOnce(pending[2].promise);
    const mastering = { source, analyzeSource, error: ref('Mastering render failed') } as any;
    const insights = useMasteringInsights(mastering, undefined, selectedPreset);

    const firstRun = insights.analyzeSourceInsights();
    expect(analyzeSource).toHaveBeenCalledWith(
      [
        { name: 'Spotify', targetLufs: -14, ceilingDb: -1 },
        { name: 'YouTube', targetLufs: -14, ceilingDb: -1 },
        { name: 'Apple Music', targetLufs: -16, ceilingDb: -1 },
        { name: 'Podcast', targetLufs: -16, ceilingDb: -1 },
      ],
      'pop',
    );

    selectedPreset.value = 'hiphop';
    await nextTick();
    expect(analyzeSource).toHaveBeenLastCalledWith(expect.any(Array), 'hipHop');

    pending[0].reject(new Error('stale analysis failed'));
    await firstRun;
    expect(insights.insightReport.value).toBeNull();
    expect(mastering.error.value).toBe('Mastering render failed');

    pending[1].resolve(report('hipHop'));
    await nextTick();
    expect(insights.insightReport.value?.profile).toEqual({ label: 'hipHop' });
    expect(insights.isAnalyzingInsights.value).toBe(false);
    expect(mastering.error.value).toBe('Mastering render failed');

    selectedPreset.value = 'liveSmall';
    await nextTick();
    expect(insights.insightReport.value).toBeNull();
    expect(analyzeSource).toHaveBeenLastCalledWith(expect.any(Array), 'acoustic');

    pending[2].reject(new Error('analysis failed'));
    await nextTick();
    expect(insights.insightReport.value).toBeNull();
    expect(insights.isAnalyzingInsights.value).toBe(false);
  });
});
