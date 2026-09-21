/**
 * Demo definitions for the room-acoustics cluster (acoustic-analysis).
 *
 * Definitions are data only — labels carry localized copy so the i18n gate can verify
 * parity without a separate locale file. Add entries here; markdown references them
 * by `id` via `<SonareDemo id="..." />`.
 */

import type { SonareDemoDef } from '../types';

export const acousticsDemos: SonareDemoDef[] = [
  {
    id: 'room-decay',
    archetype: 'room',
    // The source field is unused for `room` (the RIR is synthesized from geometry),
    // but the schema requires one; a neutral tone keeps the intent readable.
    source: { kind: 'generate', signal: 'noise' },
    viz: 'waveform',
    title: {
      en: 'Impulse response — how a room decays',
      ja: 'インパルス応答 — 部屋はどう減衰するか',
    },
    caption: {
      en: 'A room impulse response synthesized from shoebox dimensions, shown as its energy decay in dB. Enlarge the room or lower the absorption and the tail stretches — the RT60 (time to fall 60 dB) climbs with it. Press play to hear a clap in the room.',
      ja: 'シューボックス寸法から合成した室内インパルス応答を、dB のエネルギー減衰として表示します。部屋を広げる・吸音を下げると残響が伸び、RT60（60 dB 減衰までの時間）も伸びます。再生でその部屋の手拍子を試聴できます。',
    },
    params: [
      {
        key: 'size',
        kind: 'range',
        default: 7,
        min: 2.5,
        max: 22,
        step: 0.5,
        unit: 'm',
        label: { en: 'Room size', ja: '部屋の大きさ' },
      },
      {
        key: 'absorption',
        kind: 'range',
        default: 0.16,
        min: 0.05,
        max: 0.6,
        step: 0.01,
        label: { en: 'Absorption', ja: '吸音' },
      },
    ],
  },
];
