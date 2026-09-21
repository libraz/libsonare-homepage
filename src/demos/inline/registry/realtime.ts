/**
 * Demo definitions for the realtime-engine cluster (realtime-streaming).
 *
 * Definitions are data only — labels carry localized copy so the i18n gate can verify
 * parity without a separate locale file. Add entries here; markdown references them
 * by `id` via `<SonareDemo id="..." />`.
 */

import type { SonareDemoDef } from '../types';

export const realtimeDemos: SonareDemoDef[] = [
  {
    id: 'engine-lane-mixer',
    archetype: 'lane-mixer',
    // The source field is unused for `lane-mixer` (the engine renders its own MIDI
    // clips), but the schema requires one; a matching tone keeps the intent readable.
    source: { kind: 'generate', signal: 'saw', freq: 220 },
    viz: 'waveform',
    title: {
      en: 'The engine lane mixer — faders and mutes inside the playback engine',
      ja: 'エンジンのレーンミキサー — 再生エンジン内のフェーダーとミュート',
    },
    caption: {
      en: 'Three MIDI clips loop through the realtime engine: each track occupies a lane with its own channel strip. The faders call the strip setters and the mutes call setSoloMute — every band below is the engine’s actual per-lane output, re-rendered through renderOffline as you move the controls.',
      ja: '3 つの MIDI クリップがリアルタイムエンジンでループします。各トラックはレーンを 1 つ占有し、専用のチャンネルストリップを持ちます。フェーダーはストリップのセッターを、ミュートは setSoloMute を呼びます。下の各バンドはエンジンの実際のレーン別出力で、操作のたびに renderOffline で描き直されます。',
    },
    params: [
      {
        key: 'leadDb',
        kind: 'range',
        default: 0,
        min: -24,
        max: 6,
        step: 1,
        unit: 'dB',
        label: { en: 'Lead fader', ja: 'リードのフェーダー' },
      },
      {
        key: 'bassDb',
        kind: 'range',
        default: 0,
        min: -24,
        max: 6,
        step: 1,
        unit: 'dB',
        label: { en: 'Bass fader', ja: 'ベースのフェーダー' },
      },
      {
        key: 'drumsDb',
        kind: 'range',
        default: 0,
        min: -24,
        max: 6,
        step: 1,
        unit: 'dB',
        label: { en: 'Drums fader', ja: 'ドラムのフェーダー' },
      },
      {
        key: 'muteLead',
        kind: 'toggle',
        default: false,
        label: { en: 'Mute lead', ja: 'リードをミュート' },
      },
      {
        key: 'muteBass',
        kind: 'toggle',
        default: false,
        label: { en: 'Mute bass', ja: 'ベースをミュート' },
      },
      {
        key: 'muteDrums',
        kind: 'toggle',
        default: false,
        label: { en: 'Mute drums', ja: 'ドラムをミュート' },
      },
    ],
  },
  {
    id: 'pre-post-fader',
    archetype: 'send-routing',
    // No clip: the meters are derived from the fader, and the auditioned mix (dry
    // post-fader tone + a constant pre-fader send) is synthesized to match.
    source: { kind: 'generate', signal: 'sine', freq: 220 },
    viz: 'meters',
    title: {
      en: 'Pre-fader vs post-fader sends — drag the fader',
      ja: 'プリフェーダー送りとポストフェーダー送り — フェーダーを動かす',
    },
    caption: {
      en: 'One channel feeds two sends and the main output. Pull the channel fader down: the POST-fader send and the MAIN output follow it, because they are tapped after the fader; the PRE-fader send is tapped before it and stays put. Press play to hear it — the dry tone (post-fader) fades out while the pre-fader send (a stand-in for a reverb/aux return) keeps sounding even with the fader all the way down. That is why a vocal reverb fed pre-fader does not disappear when you ride the vocal down — the classic routing surprise.',
      ja: '1 つのチャンネルが 2 つの送りとメイン出力に分かれます。チャンネルフェーダーを下げると、ポストフェーダー送りとメイン出力はそれに従います。フェーダーの後ろで分岐しているからです。プリフェーダー送りはフェーダーの前で分岐しているので、そのまま残ります。再生すると、ドライ音（ポストフェーダー）は消えていくのに、プリフェーダー送り（リバーブ／アックスのリターンの代役）はフェーダーを下げきっても鳴り続けます。プリフェーダーに送ったボーカルのリバーブが、ボーカルを下げても消えないのはこのためです。よくある送りの落とし穴です。',
    },
    params: [
      {
        key: 'fader',
        kind: 'range',
        default: 0,
        min: -40,
        max: 6,
        step: 1,
        unit: 'dB',
        label: { en: 'Channel fader', ja: 'チャンネルフェーダー' },
      },
    ],
  },
];
