/**
 * Demo definitions for the instruments cluster (native-synth, soundfont-player).
 *
 * Definitions are data only — labels carry both locales so the i18n gate can verify
 * parity without a separate locale file. Add entries here; markdown references them
 * by `id` via `<SonareDemo id="..." />`.
 */

import type { SonareDemoDef } from '../types';

export const instrumentsDemos: SonareDemoDef[] = [
  {
    id: 'synth-note',
    archetype: 'synth',
    // The source field is unused for `synth` (the engine renders the note), but the
    // schema requires one; a matching tone keeps the intent readable.
    source: { kind: 'generate', signal: 'saw', freq: 220 },
    viz: 'waveform',
    title: {
      en: 'Shaping a note — oscillator, filter, envelope',
      ja: '音を形づくる — オシレーター・フィルター・エンベロープ',
    },
    caption: {
      en: 'The built-in synth renders a single A3. The outline is its amplitude envelope: raise the attack and the note fades in; lower the cutoff and the tone darkens. Press play to hear the patch.',
      ja: '内蔵シンセが A3 を1音レンダリングします。輪郭はその振幅エンベロープ。アタックを上げると音が徐々に立ち上がり、カットオフを下げると音色が暗くなります。再生でパッチを試聴できます。',
    },
    params: [
      {
        key: 'waveform',
        kind: 'select',
        default: 'saw',
        label: { en: 'Oscillator', ja: 'オシレーター' },
        options: [
          { value: 'sine', label: { en: 'Sine', ja: '正弦' } },
          { value: 'saw', label: { en: 'Saw', ja: 'ノコギリ' } },
          { value: 'square', label: { en: 'Square', ja: '矩形' } },
          { value: 'triangle', label: { en: 'Triangle', ja: '三角' } },
        ],
      },
      {
        key: 'cutoff',
        kind: 'range',
        default: 2200,
        min: 200,
        max: 8000,
        step: 50,
        unit: 'Hz',
        label: { en: 'Cutoff', ja: 'カットオフ' },
      },
      {
        key: 'attack',
        kind: 'range',
        default: 8,
        min: 1,
        max: 400,
        step: 1,
        unit: 'ms',
        label: { en: 'Attack', ja: 'アタック' },
      },
    ],
  },
];
