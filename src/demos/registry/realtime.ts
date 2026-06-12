/**
 * Demo definitions for the realtime-engine cluster (realtime-streaming).
 *
 * Definitions are data only — labels carry both locales so the i18n gate can verify
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
];
