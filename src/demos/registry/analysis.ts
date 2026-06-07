/**
 * Demo definitions for the analysis cluster (introduction, acoustic-analysis,
 * librosa-compatibility, glossary/analysis, …).
 *
 * Definitions are data only — labels carry both locales so the i18n gate can verify
 * parity without a separate locale file. Add entries here; markdown references them
 * by `id` via `<SonareDemo id="..." />`.
 */

import type { SonareDemoDef } from '../types';

export const analysisDemos: SonareDemoDef[] = [
  {
    id: 'stft-basics',
    archetype: 'transform',
    // A rising chirp makes the time/frequency trade-off legible: a clean diagonal
    // sweeps up the spectrogram as the tone rises.
    source: { kind: 'generate', signal: 'sweep', freq: 220, freqEnd: 4000, duration: 2.5 },
    viz: 'spectrogram',
    title: {
      en: 'STFT — seeing time and frequency at once',
      ja: 'STFT — 時間と周波数を同時に見る',
    },
    caption: {
      en: 'A tone sweeping from 220 Hz to 4 kHz. Each column is one short-time spectrum; brighter means more energy at that frequency.',
      ja: '220 Hz から 4 kHz へ上昇するトーン。各列が1つの短時間スペクトルで、明るいほどその周波数のエネルギーが大きい。',
    },
    config: { nFft: 1024, hopLength: 256 },
  },
  {
    id: 'waveform-harmonics',
    archetype: 'signal',
    // The base shape; the reader can switch waveform and frequency live.
    source: { kind: 'generate', signal: 'saw', freq: 220, duration: 2 },
    viz: 'waveform',
    title: {
      en: 'Waveform and spectrum — where harmonics come from',
      ja: '波形とスペクトル — 倍音はどこから生まれるか',
    },
    caption: {
      en: 'The top panel is the wave in time; the bottom is its spectrum. A sine has only its fundamental, while a saw stacks every harmonic and a square only the odd ones — switch the shape and watch the comb appear.',
      ja: '上段は時間波形、下段はそのスペクトル。サイン波は基音だけ、ノコギリ波はすべての倍音、矩形波は奇数倍音だけが立つ。波形を切り替えると倍音の櫛が現れる。',
    },
    params: [
      {
        key: 'waveform',
        kind: 'select',
        default: 'saw',
        label: { en: 'Waveform', ja: '波形' },
        options: [
          { value: 'sine', label: { en: 'Sine', ja: '正弦' } },
          { value: 'saw', label: { en: 'Saw', ja: 'ノコギリ' } },
          { value: 'square', label: { en: 'Square', ja: '矩形' } },
          { value: 'triangle', label: { en: 'Triangle', ja: '三角' } },
        ],
      },
      {
        key: 'freq',
        kind: 'range',
        default: 220,
        min: 110,
        max: 880,
        step: 1,
        unit: 'Hz',
        label: { en: 'Frequency', ja: '周波数' },
      },
    ],
  },
];
