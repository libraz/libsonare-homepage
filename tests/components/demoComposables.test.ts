import { describe, expect, it, vi } from 'vitest';
import { computed, ref } from 'vue';
import { useDemoChrome, useDemoParams } from '@/components/demos/composables';
import type { SonareDemoDef } from '@/demos/types';

const lang = ref('en');

vi.mock('vitepress', () => ({
  useData: () => ({ lang }),
}));

const def: SonareDemoDef = {
  id: 'example',
  archetype: 'signal',
  source: { kind: 'generate', signal: 'sine' },
  title: { en: 'Signal', ja: '信号' },
  caption: { en: 'Caption', ja: '説明' },
  params: [
    { key: 'freq', kind: 'range', label: { en: 'Frequency', ja: '周波数' }, default: 220 },
    {
      key: 'waveform',
      kind: 'select',
      label: { en: 'Waveform', ja: '波形' },
      default: 'saw',
    },
  ],
};

describe('demo composables', () => {
  it('initializes params from registry defaults and updates by record merge', () => {
    const { values, updateParams } = useDemoParams(def);

    expect(values.freq).toBe(220);
    expect(values.waveform).toBe('saw');

    updateParams({ freq: 440, waveform: 'square' });

    expect(values.freq).toBe(440);
    expect(values.waveform).toBe('square');
  });

  it('maps status and playback to frame tone', () => {
    const playing = computed(() => false);
    const chrome = useDemoChrome(def, playing);

    expect(chrome.title.value).toBe('Signal');
    expect(chrome.caption.value).toBe('Caption');
    expect(chrome.tone.value).toBe('idle');

    chrome.status.value = 'ready';
    expect(chrome.tone.value).toBe('ready');

    chrome.fail(new Error('decode failed'));
    expect(chrome.status.value).toBe('error');
    expect(chrome.errorMsg.value).toBe('decode failed');
    expect(chrome.tone.value).toBe('error');
  });
});
