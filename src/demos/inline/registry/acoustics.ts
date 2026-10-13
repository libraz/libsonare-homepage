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
  {
    id: 'clarity-split',
    archetype: 'clarity-split',
    // Source is unused: the IR comes from the shoebox room the room-decay demo uses.
    source: { kind: 'generate', signal: 'noise' },
    viz: 'overlay',
    title: {
      en: 'Clarity — where early ends and late begins',
      ja: '明瞭度 — 初期と後期の境目はどこか',
    },
    caption: {
      en: 'A room impulse response as energy per 2 ms after the direct sound: teal counts as early, violet as late. Slide the boundary and the clarity value, 10·log10(early / late), climbs as energy changes sides. The dotted marks at 50 and 80 ms carry C50 and C80 from analyzeImpulseResponse; put the boundary on a mark and the reading matches. The medium room gives C50 +1.0 dB and C80 +4.0 dB; in the large hall the tail outweighs even the 80 ms window (C50 −5.1, C80 −2.9 dB). Press play to hear a clap in the room.',
      ja: '直接音以降のエネルギーを 2 ms ごとに表したルームインパルス応答です。ティールが初期、紫が後期として数えられます。境目を動かすと、エネルギーが反対側へ移るので、明瞭度 10·log10（初期 ／ 後期）が上がっていきます。50 ms と 80 ms の点線には analyzeImpulseResponse が返す C50 と C80 が付いていて、境目を点線に合わせると読みが一致します。中くらいの部屋では C50 が +1.0 dB、C80 が +4.0 dB です。大ホールでは 80 ms の窓でもテールのほうが大きくなります（C50 −5.1 dB、C80 −2.9 dB）。再生すると、その部屋での手拍子を聞けます。',
    },
    params: [
      {
        key: 'split',
        kind: 'range',
        default: 50,
        min: 10,
        max: 200,
        step: 1,
        unit: 'ms',
        label: { en: 'Early/late boundary', ja: '初期／後期の境目' },
      },
      {
        key: 'room',
        kind: 'select',
        default: 'medium',
        label: { en: 'Room', ja: '部屋' },
        options: [
          { value: 'small', label: { en: 'Small room', ja: '小部屋' } },
          { value: 'medium', label: { en: 'Medium room', ja: '中くらいの部屋' } },
          { value: 'hall', label: { en: 'Large hall', ja: '大ホール' } },
        ],
      },
    ],
  },
];
