/**
 * Demo definitions for the mastering/metering cluster (mastering-* docs, loudness
 * and metering glossary).
 *
 * Definitions are data only — labels carry localized copy so the i18n gate can verify
 * parity without a separate locale file. Add entries here; markdown references them
 * by `id` via `<SonareDemo id="..." />`.
 */

import type { SonareDemoDef } from '../types';

export const masteringDemos: SonareDemoDef[] = [
  {
    id: 'repair-clicks',
    archetype: 'ab-process',
    source: { kind: 'clip', clip: 'damaged-vinyl' },
    viz: 'spectrogram',
    title: {
      en: 'Click repair — compare before and after',
      ja: 'クリック修復 — 処理前後を比較する',
    },
    caption: {
      en: 'The declicker detects short impulsive defects and reconstructs their samples from the surrounding signal. This clip also contains hum, hiss and crackle; this demo runs only declick, so those defects can remain. Compare the original and processed signal without extra loudness matching. Musical attacks can also be affected: inspect the result rather than assuming every detected impulse is damage.',
      ja: 'デクリッカーは短い突発的な欠陥を検出し、周囲の信号から該当するサンプルを再構成します。このクリップにはハム・ヒスノイズ・クラックルも含まれますが、デモが適用するのはデクリックだけなので、ほかの欠陥は残ることがあります。追加の音量合わせをせずに処理前後を比較してください。楽器の立ち上がりにも影響する場合があるため、検出したすべての突発音を欠陥と決めつけず、結果を確認してください。',
    },
    config: {
      processor: 'repair-clicks',
      injectNoise: false,
      showFloor: false,
      eyebrow: 'A/B PROCESS · DECLICK',
      legendBefore: { en: 'Before', ja: '処理前' },
      legendAfter: { en: 'After', ja: '処理後' },
      loadingLabel: { en: 'Repairing clicks', ja: 'クリック修復中' },
      stateBefore: 'BEFORE',
      stateAfter: 'AFTER',
    },
    params: [
      {
        key: 'view',
        kind: 'select',
        default: 'damaged',
        label: { en: 'Compare', ja: '比較' },
        options: [
          { value: 'damaged', label: { en: 'Before', ja: '処理前' } },
          { value: 'repaired', label: { en: 'After', ja: '処理後' } },
        ],
      },
    ],
  },
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
      en: 'The bar tracks momentary loudness as the clip plays; the panel is the loudness over time. Integrated LUFS is the single overall number, true-peak estimates peaks between samples, and LRA captures how much the loudness moves. Switch the window to compare the fast momentary meter with the smoother short-term one — each reports only once its window has filled, so the short-term contour starts three seconds into the clip.',
      ja: 'バーは再生中の瞬時ラウドネスを追い、パネルは時間ごとのラウドネスです。インテグレーテッド LUFS は全体を表す一つの数値、トゥルーピークはサンプル間も含むピークの推定値、LRA はラウドネスの動く幅を表します。ウィンドウを切り替えると、速い瞬時メーターと滑らかな短時間メーターを比べられます。どちらもウィンドウが埋まってから値を出すため、短時間の曲線はクリップの 3 秒後から始まります。',
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
      en: 'Broadband hiss is added to a clean chord. Compare the noisy and denoised signals and their spectra, then choose a denoising algorithm. Both retain their processed levels without extra loudness matching. Noise reduction can also change musical transients and timbre. FLOOR shows the average high-band reduction in dB.',
      ja: 'きれいなコードに広帯域のヒスノイズを加えています。修復前後の音とスペクトルを比較し、デノイズの方式を切り替えてください。追加の音量合わせは行っていません。ノイズ低減は、音楽の立ち上がりや音色にも影響することがあります。FLOOR は高域の平均低減量（dB）です。',
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
  {
    id: 'mastering-restoration',
    archetype: 'ab-process',
    // A piano bed already carrying hum, surface noise and crackle, so the repair
    // stage has real record damage to work on rather than injected hiss alone.
    source: { kind: 'clip', clip: 'damaged-vinyl' },
    viz: 'spectrogram',
    // The clip carries its own damage, so the archetype must not add hiss on top.
    config: {
      processor: 'dereverb-classical',
      injectNoise: false,
      eyebrow: 'A/B PROCESS · DEREVERB',
    },
    title: {
      en: 'Restoration — a worn record, before and after',
      ja: 'レストレーション — 傷んだレコードの修復前と修復後',
    },
    caption: {
      en: 'The piano clip contains hum, hiss, clicks and crackle. This example applies only the classical dereverberator, which attenuates diffuse sustained energy; it does not apply a dedicated declick or dehum stage. Compare the spectra and audition the result without added loudness matching. The processor can change musical tails and timbre as well as the noise bed. FLOOR shows the high-band reduction in dB.',
      ja: 'ピアノのクリップには、ハム・ヒスノイズ・クリック・クラックルが入っています。このデモは古典的なデリバーブだけを適用し、拡散した持続成分を減衰させます。専用のデクリックやハム除去は適用していません。追加の音量合わせをせずに、スペクトルと音を比較してください。ノイズだけでなく、音楽の余韻や音色も変わることがあります。FLOOR は高域の低減量（dB）です。',
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
    ],
  },
  {
    id: 'compressor-curve',
    archetype: 'compressor',
    // No clip: the transfer curve and the gain-reduction envelope are computed from
    // a fixed test program, and the auditioned audio is synthesized to match.
    source: { kind: 'generate', signal: 'saw', freq: 150 },
    viz: 'overlay',
    title: {
      en: 'Compression — threshold, ratio, knee, attack, release',
      ja: 'コンプレッション — スレッショルド・レシオ・ニー・アタック・リリース',
    },
    caption: {
      en: 'The left panel is the transfer curve — input level in, output level out — with the threshold and the soft knee marked; raise the ratio and it bends harder past the threshold. The right panel runs a fixed program (a steady bed with transient hits) through the compressor: the shaded gap is the gain reduction, and attack and release decide how fast it clamps down and lets go. Press play to hear the same program — the pumping you see is the pumping you hear.',
      ja: '左のパネルは伝達カーブ（入力レベル → 出力レベル）で、スレッショルドとソフトニーを示します。レシオを上げるほど、スレッショルドを超えてから強く折れ曲がります。右のパネルは固定のプログラム（一定のベッドにトランジェントの打点を重ねたもの）をコンプに通したものです。網かけの差がゲインリダクションで、アタックとリリースが、どれだけ速く抑え込み・解放するかを決めます。再生すると同じプログラムが聞こえます — 見えるポンピングが、そのまま聞こえます。',
    },
    params: [
      {
        key: 'threshold',
        kind: 'range',
        default: -18,
        min: -42,
        max: 0,
        step: 1,
        unit: 'dB',
        label: { en: 'Threshold', ja: 'スレッショルド' },
      },
      {
        key: 'ratio',
        kind: 'range',
        default: 4,
        min: 1,
        max: 20,
        step: 0.5,
        unit: ':1',
        label: { en: 'Ratio', ja: 'レシオ' },
      },
      {
        key: 'knee',
        kind: 'range',
        default: 6,
        min: 0,
        max: 24,
        step: 1,
        unit: 'dB',
        label: { en: 'Knee', ja: 'ニー' },
      },
      {
        key: 'attack',
        kind: 'range',
        default: 15,
        min: 1,
        max: 120,
        step: 1,
        unit: 'ms',
        label: { en: 'Attack', ja: 'アタック' },
      },
      {
        key: 'release',
        kind: 'range',
        default: 160,
        min: 20,
        max: 600,
        step: 10,
        unit: 'ms',
        label: { en: 'Release', ja: 'リリース' },
      },
    ],
  },
  {
    id: 'inter-sample-peak',
    archetype: 'true-peak',
    // No clip: the samples and the reconstructed waveform are drawn from the two
    // sliders, and the auditioned tone is synthesized at the sample level.
    source: { kind: 'generate', signal: 'sine', freq: 660 },
    viz: 'waveform',
    title: {
      en: 'Inter-sample peaks — why a master clips on playback',
      ja: 'サンプル間ピーク — マスターが再生時にクリップする理由',
    },
    caption: {
      en: 'The dots are samples of a sine wave; the curve shows its analytic waveform. A crest can fall between samples, above every stored value. The gap depends on frequency and phase, so it does not increase smoothly toward Nyquist. Compare the analytic peak with the oversampled meter reading. Raising the sample peak toward 0 dBFS can leave an inter-sample over that clips a converter or processor without sufficient headroom.',
      ja: 'ドットは正弦波のサンプル、曲線はその解析的な波形です。山の頂点がサンプル間に来ると、保存された値より高いピークが生じます。その差は周波数と位相で変わり、ナイキスト周波数に近づくほど単調に増えるわけではありません。解析的なピークと、オーバーサンプリングしたメーターの推定値を比較してください。サンプルピークを 0 dBFS に近づけると、サンプル間の超過が生じ、ヘッドルームの足りないコンバーターや後段の処理でクリップする可能性があります。',
    },
    params: [
      {
        key: 'level',
        kind: 'range',
        default: -0.3,
        min: -6,
        max: 0,
        step: 0.1,
        unit: 'dBFS',
        label: { en: 'Sample peak', ja: 'サンプルピーク' },
      },
      {
        key: 'nyquist',
        kind: 'range',
        default: 0.4,
        min: 0.15,
        max: 0.48,
        step: 0.01,
        label: { en: 'Frequency (×Nyquist)', ja: '周波数（×ナイキスト）' },
      },
    ],
  },
  {
    id: 'mono-fold',
    archetype: 'mono-fold',
    // Source is unused for `mono-fold`; the phase-shifted pair is synthesized in-browser.
    source: { kind: 'generate', signal: 'sine', freq: 220 },
    viz: 'waveform',
    title: {
      en: 'Mono fold — when stereo width cancels',
      ja: 'モノフォールド — ステレオ幅が打ち消されるとき',
    },
    caption: {
      en: 'Left and right are the same sine wave with a phase offset from 0° to 180°. The mono fold averages them: at 90° it is −3.01 dB relative to the left channel, and at 180° it cancels. Correlation follows the same shift from +1 through 0 to −1. Choose the left reference or the mono fold to hear the level change.',
      ja: '左と右に同じサイン波を置き、位相差を 0° から 180° まで動かします。モノフォールドは左右の平均です。90° では左チャンネル比 −3.01 dB、180° では打ち消し、相関は +1、0、−1 と連続して変化します。左の基準音とモノフォールドを切り替えて、レベル差を聴き比べられます。',
    },
    params: [
      {
        key: 'phase',
        kind: 'range',
        default: 90,
        min: 0,
        max: 180,
        step: 1,
        unit: '°',
        label: { en: 'Phase offset', ja: '位相差' },
      },
      {
        key: 'audition',
        kind: 'select',
        default: 'mono',
        label: { en: 'Audition', ja: '試聴' },
        options: [
          { value: 'left', label: { en: 'L reference', ja: 'L 基準' } },
          { value: 'mono', label: { en: 'Mono fold', ja: 'モノフォールド' } },
        ],
      },
    ],
  },
  {
    id: 'parallel-compression',
    archetype: 'compressor',
    // No clip: the transfer curve, envelopes, and auditioned tone are computed from
    // the sliders, the same as compressor-curve, plus a dry/compressed blend.
    source: { kind: 'generate', signal: 'saw', freq: 150 },
    viz: 'overlay',
    title: {
      en: 'Parallel compression — squash a copy, keep the punch',
      ja: 'パラレルコンプレッション — コピーを潰し、パンチは残す',
    },
    caption: {
      en: 'Blend the dry signal with a compressed copy. The dry path preserves more of the original transients than fully wet compression. This example applies no makeup gain, so blending does not boost quiet passages and output level changes with the mix. Compare the transfer curve and gain envelope, then audition the result.',
      ja: 'ドライ音と圧縮した音を混ぜます。圧縮音だけの場合に比べ、ドライ音を混ぜると元の立ち上がりが残ります。このデモはメイクアップゲインを加えないため、小さい音を持ち上げる処理ではなく、混合比によって出力レベルも変わります。入出力特性とゲインの変化を見ながら試聴してください。',
    },
    params: [
      {
        key: 'threshold',
        kind: 'range',
        default: -28,
        min: -48,
        max: 0,
        step: 1,
        unit: 'dB',
        label: { en: 'Threshold', ja: 'スレッショルド' },
      },
      {
        key: 'ratio',
        kind: 'range',
        default: 8,
        min: 1,
        max: 20,
        step: 0.5,
        unit: ':1',
        label: { en: 'Ratio', ja: 'レシオ' },
      },
      {
        key: 'mix',
        kind: 'range',
        default: 50,
        min: 0,
        max: 100,
        step: 1,
        unit: '%',
        label: { en: 'Blend', ja: 'ブレンド' },
      },
    ],
  },
  {
    id: 'tilt-eq',
    archetype: 'param-sweep',
    // A broadband mix (drums + band) makes the spectral rotation easy to see and hear.
    source: { kind: 'clip', clip: 'mix' },
    viz: 'overlay',
    config: { processor: 'tilt-eq' },
    title: {
      en: 'Tilt EQ — rebalance the whole spectrum at once',
      ja: 'チルト EQ — スペクトル全体を一度に整える',
    },
    caption: {
      en: 'Tilt EQ rotates the broad tonal balance around a fixed midrange pivot (the amber line). Positive tilt lifts the highs and trims the lows for a brighter master; negative tilt does the reverse for a warmer one. Every render is peak-normalized to the same ceiling, which keeps a positive tilt from clipping — but that matches peaks, not loudness, so perceived loudness can still differ. Watch the averaged spectrum see-saw around the pivot as you drag. Use it for broad correction — reach for a narrow band, not tilt, to tame a single resonance.',
      ja: 'チルト EQ は、固定したミッドレンジのピボット（橙色の線）を軸に、おおまかな音色バランスを傾けます。プラス方向は高域を持ち上げ低域を削って明るく、マイナス方向はその逆で温かくします。レンダーごとにピークを同じ高さへ揃えているためプラス方向でもクリップしませんが、揃えているのはピークであってラウドネスではないので、知覚上の音量は設定によって変わります。ドラッグすると、平均スペクトルがピボットを軸にシーソーのように傾くのが見えます。用途は広い範囲の補正です。特定の共鳴を抑えたいときは、チルトではなく狭いバンドを使ってください。',
    },
    params: [
      {
        key: 'tilt',
        kind: 'range',
        default: 6,
        min: -12,
        max: 12,
        step: 0.5,
        unit: 'dB',
        label: { en: 'Tilt', ja: 'チルト' },
      },
    ],
  },
  {
    id: 'vowel-filter',
    archetype: 'ab-process',
    source: { kind: 'clip', clip: 'pad' },
    viz: 'spectrogram',
    config: {
      processor: 'vowel-filter',
      injectNoise: false,
      eyebrow: 'A/B PROCESS · VOWEL',
      legendBefore: { en: 'Dry', ja: '原音' },
      legendAfter: { en: 'Filtered', ja: 'フィルター音' },
      loadingLabel: { en: 'Filtering', ja: 'フィルター処理中' },
      showFloor: false,
    },
    title: {
      en: 'Vowel filter — shaping formant bands',
      ja: '母音フィルター — フォルマントの帯域を変える',
    },
    caption: {
      en: 'Choose a, i, u, e or o and compare the pad with the filtered signal. The real vowel filter combines three resonant bands with a direct path, changing the spectral shape without transposing the notes. Both spectra share one reference scale, and neither A/B signal receives extra peak or loudness matching. This is a timbre effect, not speech synthesis; output level can differ between vowels.',
      ja: 'あ・い・う・え・おを選び、パッドの原音とフィルター音を比較してください。母音フィルターは３つの共振帯域と直接音を組み合わせ、音程を移調せずにスペクトルの形を変えます。スペクトルは共通の基準で表示し、A/B の音には追加のピーク合わせやラウドネス合わせを行っていません。音声を生成する処理ではなく、音色を変えるエフェクトです。母音によって出力レベルも変わります。',
    },
    params: [
      {
        key: 'view',
        kind: 'select',
        default: 'repaired',
        label: { en: 'Compare', ja: '比較' },
        options: [
          { value: 'damaged', label: { en: 'Dry', ja: '原音' } },
          { value: 'repaired', label: { en: 'Filtered', ja: 'フィルター音' } },
        ],
      },
      {
        key: 'mode',
        kind: 'select',
        default: '0',
        label: { en: 'Vowel', ja: '母音' },
        options: [
          { value: '0', label: { en: 'a', ja: 'あ' } },
          { value: '1', label: { en: 'i', ja: 'い' } },
          { value: '2', label: { en: 'u', ja: 'う' } },
          { value: '3', label: { en: 'e', ja: 'え' } },
          { value: '4', label: { en: 'o', ja: 'お' } },
        ],
      },
    ],
  },
];
