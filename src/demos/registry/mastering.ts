/**
 * Demo definitions for the mastering/metering cluster (mastering-* docs, loudness
 * and metering glossary).
 *
 * Definitions are data only — labels carry both locales so the i18n gate can verify
 * parity without a separate locale file. Add entries here; markdown references them
 * by `id` via `<SonareDemo id="..." />`.
 */

import type { SonareDemoDef } from '../types';

export const masteringDemos: SonareDemoDef[] = [
  {
    id: 'loudness-meter',
    archetype: 'meters',
    // A dynamic multi-part phrase exercises the loudness contour and LRA.
    source: { kind: 'clip', clip: 'band' },
    viz: 'meters',
    title: {
      en: 'Loudness metering — LUFS, true-peak, and range',
      ja: 'ラウドネス計測 — LUFS・トゥルーピーク・レンジ',
    },
    caption: {
      en: 'The bar tracks momentary loudness as the clip plays; the panel is the loudness over time. Integrated LUFS is the single overall number, true-peak is the real ceiling between samples, and LRA captures how much the loudness moves. Switch the window to compare the fast momentary meter with the smoother short-term one.',
      ja: 'バーは再生中の瞬時ラウドネスを追い、パネルは時間ごとのラウドネスです。インテグレーテッド LUFS は全体を表す一つの数値、トゥルーピークはサンプル間も含む本当の上限、LRA はラウドネスの動く幅を表します。ウィンドウを切り替えると、速い瞬時メーターと滑らかな短時間メーターを比べられます。',
    },
    params: [
      {
        key: 'window',
        kind: 'select',
        default: 'momentary',
        label: { en: 'Window', ja: 'ウィンドウ' },
        options: [
          { value: 'momentary', label: { en: 'Momentary', ja: '瞬時' } },
          { value: 'short-term', label: { en: 'Short-term', ja: '短時間' } },
        ],
      },
    ],
  },
  {
    id: 'repair-denoise',
    archetype: 'ab-process',
    // A sustained chord makes the injected hiss — and its removal — easy to hear.
    source: { kind: 'clip', clip: 'pad' },
    viz: 'spectrogram',
    title: {
      en: 'Denoise repair — damaged vs repaired',
      ja: 'デノイズ修復 — 修復前と修復後',
    },
    caption: {
      en: 'The clean chord is given a layer of broadband hiss (Damaged); the repair stage removes it (Repaired). Both averaged spectra are drawn together — the raised high-frequency floor is the hiss, and it drops back onto the music once denoised. Flip Compare to audition each side at the same loudness, and switch the algorithm to see how much floor each one pulls down. FLOOR is the high-band reduction in dB.',
      ja: 'きれいなコードに広帯域のヒスノイズを乗せたものが「修復前」、リペアステージで取り除いたものが「修復後」です。平均スペクトルを重ねて表示しており、持ち上がった高域のフロアがヒスノイズで、デノイズすると音楽の上に落ち着きます。Compare を切り替えると同じラウドネスで聴き比べ、アルゴリズムを変えるとフロアの下がり方の違いが分かります。FLOOR は高域の低減量（dB）です。',
    },
    params: [
      {
        key: 'view',
        kind: 'select',
        default: 'damaged',
        label: { en: 'Compare', ja: '比較' },
        options: [
          { value: 'damaged', label: { en: 'Damaged', ja: '修復前' } },
          { value: 'repaired', label: { en: 'Repaired', ja: '修復後' } },
        ],
      },
      {
        key: 'mode',
        kind: 'select',
        default: 'logMmse',
        label: { en: 'Algorithm', ja: 'アルゴリズム' },
        options: [
          { value: 'logMmse', label: { en: 'LogMMSE', ja: 'LogMMSE' } },
          { value: 'spectralSubtraction', label: { en: 'Spectral sub.', ja: 'スペクトル減算' } },
        ],
      },
    ],
  },
];
