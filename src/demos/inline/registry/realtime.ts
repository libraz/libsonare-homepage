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
      en: 'Three MIDI clips loop through the realtime engine: each track occupies a lane with its own channel strip, and the lanes sum into a master strip carrying the engine’s true-peak limiter. The faders call the strip setters and the mutes call setSoloMute — every band below is the engine’s separate solo previews through the master chain, re-rendered through renderOffline as you move the controls.',
      ja: '3 つの MIDI クリップがリアルタイムエンジンでループします。各トラックはレーンを 1 つ占有し、専用のチャンネルストリップを持ち、レーンの合計はエンジンの True Peak リミッターを載せたマスターストリップへ送られます。フェーダーはストリップのセッターを、ミュートは setSoloMute を呼びます。下の各バンドは各レーンをソロにしてマスターチェーンを通した個別の試聴結果で、操作のたびに renderOffline で描き直されます。',
    },
    // Fader defaults set the balance: the kit renders far hotter than the two
    // sustained voices and the sub-bass far quieter, so they start offset.
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
        default: 3,
        min: -24,
        max: 6,
        step: 1,
        unit: 'dB',
        label: { en: 'Bass fader', ja: 'ベースのフェーダー' },
      },
      {
        key: 'drumsDb',
        kind: 'range',
        default: -8,
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
      ja: '1 つのチャンネルが 2 つの送りとメイン出力に分かれます。チャンネルフェーダーを下げると、ポストフェーダー送りとメイン出力はそれに従います。フェーダーの後ろで分岐しているからです。プリフェーダー送りはフェーダーの前で分岐しているので、そのまま残ります。再生すると、ドライ音（ポストフェーダー）は消えていくのに、プリフェーダー送り（リバーブ／AUXのリターンの代役）はフェーダーを下げきっても鳴り続けます。プリフェーダーに送ったボーカルのリバーブが、ボーカルを下げても消えないのはこのためです。よくある送りの落とし穴です。',
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
  {
    id: 'pan-law',
    archetype: 'pan-law',
    // The noise is the pan-sweep audition; the curves are measured from a Mixer strip.
    source: { kind: 'generate', signal: 'noise', duration: 4, sampleRate: 48000, gain: 0.25 },
    viz: 'overlay',
    title: {
      en: 'Pan laws: what happens to level as a source moves',
      ja: 'パンロー：音源を動かすとレベルはどう変わるか',
    },
    caption: {
      en: 'A mono source panned across one mixer strip. Top: the left and right gains the strip applies. Bottom: total power and the mono sum (L + R), in dB against a hard pan, with the other laws ghosted. In stereoPan, const3dB keeps the power flat and the mono sum rises 3 dB at the center; const6dB keeps the mono sum flat and the power dips 3 dB. Switch to balance and the center is unity on both channels under every law. Press play to sweep noise from left to right.',
      ja: 'モノラル音源をミキサーのストリップ 1 本でパンした結果です。上段はストリップが左右にかけるゲイン、下段は合計パワーとモノラル合算（L + R）を、ハードパンを基準にした dB で示し、ほかのパンローも薄く重ねています。stereoPan では、const3dB はパワーを一定に保ち、モノラル合算はセンターで 3 dB 上がります。const6dB はモノラル合算を一定に保ち、パワーが 3 dB 下がります。balance に切り替えると、どのパンローでもセンターは左右とも等倍です。再生すると、ノイズが左から右へ移動します。',
    },
    params: [
      {
        key: 'law',
        kind: 'select',
        default: 'const3dB',
        label: { en: 'Pan law', ja: 'パンロー' },
        options: [
          { value: 'const3dB', label: { en: 'const3dB', ja: 'const3dB' } },
          { value: 'const4.5dB', label: { en: 'const4.5dB', ja: 'const4.5dB' } },
          { value: 'const6dB', label: { en: 'const6dB', ja: 'const6dB' } },
          { value: 'linear0dB', label: { en: 'linear0dB', ja: 'linear0dB' } },
        ],
      },
      {
        key: 'mode',
        kind: 'select',
        default: 'stereoPan',
        label: { en: 'Pan mode', ja: 'パンモード' },
        options: [
          { value: 'stereoPan', label: { en: 'stereoPan', ja: 'stereoPan' } },
          { value: 'balance', label: { en: 'balance', ja: 'balance' } },
        ],
      },
    ],
  },
  {
    id: 'ducking',
    archetype: 'ducking',
    // A synthetic voice gated into phrases keys the router; the pad is the bed it ducks.
    source: { kind: 'clip', clip: 'pad' },
    viz: 'overlay',
    config: { clips: ['vowel', 'pad'] },
    title: {
      en: 'Ducking: a voice pulls the music bed down',
      ja: 'ダッキング：声が音楽ベッドを押し下げる',
    },
    caption: {
      en: 'A voice (top) keys dynamics.sidechainRouter on a music bed, as in the commentaryDucking scene. The middle lane is the bed before (grey) and after (teal) the duck; the bottom lane is the gain reduction between them, capped at 18 dB. At the defaults the bed sits about 10 dB down under the voice, but the 100 ms release lets it swell back to about −2 dB in each 150 ms gap between phrases: that swing is the pumping. Raise the release to 500 ms and the bed stays near −11 dB through the sentence, coming back only in the long pause. Press play to hear the mix.',
      ja: '声（上段）が commentaryDucking シーンと同じく音楽ベッドの dynamics.sidechainRouter をキーとして動かします。中段はダッキング前（灰色）と後（ティール）のベッド、下段はその差のゲインリダクションで、18 dB が上限です。既定値では、声の下でベッドは約 10 dB 下がりますが、100 ms のリリースではフレーズ間の 150 ms の隙間ごとに約 −2 dB まで戻ってきます。この上下の揺れがポンピングです。リリースを 500 ms に上げると、ベッドは文の間ずっと −11 dB 前後にとどまり、長い休止でだけ戻ります。再生するとミックスを聞けます。',
    },
    params: [
      {
        key: 'release',
        kind: 'range',
        default: 100,
        min: 20,
        max: 800,
        step: 10,
        unit: 'ms',
        label: { en: 'Release', ja: 'リリース' },
      },
      {
        key: 'threshold',
        kind: 'range',
        default: -30,
        min: -50,
        max: -10,
        step: 1,
        unit: 'dB',
        label: { en: 'Threshold', ja: 'スレッショルド' },
      },
      {
        key: 'ratio',
        kind: 'range',
        default: 4,
        min: 1.5,
        max: 10,
        step: 0.5,
        label: { en: 'Ratio', ja: 'レシオ' },
      },
    ],
  },
  {
    id: 'channel-downmix',
    archetype: 'channel-downmix',
    // Source is unused for `channel-downmix`; the six 5.1 channels are
    // synthesized in-browser and folded by the engine's `downmix`.
    source: { kind: 'generate', signal: 'sine', freq: 220.5 },
    viz: 'meters',
    title: {
      en: '5.1 downmix: a fold that can pass full scale',
      ja: '5.1 のダウンミックス：フルスケールを超える折りたたみ',
    },
    caption: {
      en: 'The six channels play their own sounds in canonical order (L, R, C, LFE, Ls, Rs), then one in-phase sine together. downmix adds the centre and surrounds at −3 dB (×0.707), drops the LFE and does not normalize, so at full scale the in-phase sine reaches 2.414 (+7.66 dBFS) in stereo and in mono. Switch channels off to see which ones push the fold past 0 dBFS.',
      ja: '6 つのチャンネルが標準順（L、R、C、LFE、Ls、Rs）でそれぞれの音を鳴らし、最後に同相のサイン波を一斉に鳴らします。downmix はセンターとサラウンドを −3 dB（×0.707）で加え、LFE を捨て、正規化はしません。そのためフルスケールでは、同相のサイン波がステレオでもモノラルでも 2.414（+7.66 dBFS）に達します。チャンネルをオフにすると、どのチャンネルが 0 dBFS を超えさせているかがわかります。',
    },
    params: [
      {
        key: 'target',
        kind: 'select',
        default: 'stereo',
        label: { en: 'Target', ja: '出力先' },
        options: [
          { value: 'stereo', label: { en: 'Stereo', ja: 'ステレオ' } },
          { value: 'mono', label: { en: 'Mono', ja: 'モノラル' } },
        ],
      },
      {
        key: 'level',
        kind: 'range',
        default: 0,
        min: -24,
        max: 0,
        step: 1,
        unit: 'dBFS',
        label: { en: 'Peak per channel', ja: 'チャンネルごとのピーク' },
      },
    ],
  },
];
