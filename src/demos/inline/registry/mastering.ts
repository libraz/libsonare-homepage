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
      en: 'The bar tracks momentary loudness as the clip plays; the panel is the loudness over time. Integrated LUFS is the single overall number, true-peak is the real ceiling between samples, and LRA captures how much the loudness moves. Switch the window to compare the fast momentary meter with the smoother short-term one — each reports only once its window has filled, so the short-term contour starts three seconds into the clip.',
      ja: 'バーは再生中の瞬時ラウドネスを追い、パネルは時間ごとのラウドネスです。インテグレーテッド LUFS は全体を表す一つの数値、トゥルーピークはサンプル間も含む本当の上限、LRA はラウドネスの動く幅を表します。ウィンドウを切り替えると、速い瞬時メーターと滑らかな短時間メーターを比べられます。どちらもウィンドウが埋まってから値を出すため、短時間の曲線はクリップの 3 秒後から始まります。',
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
      en: 'The clean chord is given a layer of broadband hiss (Damaged); the repair stage removes it (Repaired). Both averaged spectra are drawn together — the raised high-frequency floor is the hiss, and it drops back onto the music once denoised. Flip Compare to audition each side — the gain is untouched, so the hiss is the only thing that moves — and switch the algorithm to see how much floor each one pulls down. FLOOR is the high-band reduction in dB.',
      ja: 'きれいなコードに広帯域のヒスノイズを乗せたものが「修復前」、リペアステージで取り除いたものが「修復後」です。平均スペクトルを重ねて表示しており、持ち上がった高域のフロアがヒスノイズで、デノイズすると音楽の上に落ち着きます。Compare を切り替えると両者を聴き比べできます。ゲインには手を加えていないので、動くのはヒスノイズだけです。アルゴリズムを変えるとフロアの下がり方の違いが分かります。FLOOR は高域の低減量（dB）です。',
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
      en: 'A piano turnaround carrying the damage a restoration chain targets: mains hum, surface noise and hiss, and sparse clicks and crackle (Damaged). The repair stage applied here is the classical dereverberator — spectral subtraction of the diffuse, sustained energy — so what it strips is the noise bed and the smeared tails, not the clicks or the hum; those belong to the declick and hum-removal stages (Repaired). Both averaged spectra are drawn together, and FLOOR is how far the high band came down. Flip Compare to audition each side — the level is untouched, so only the bed moves.',
      ja: 'レストレーションの処理対象となる傷みを乗せたピアノのターンアラウンドです。電源ハム、表面ノイズとヒスノイズ、まばらなクリックとクラックルが入っています（修復前）。ここで適用しているリペアステージは古典的なデリバーブで、拡散した持続成分をスペクトル減算します。取り除かれるのはノイズの土台と滲んだ余韻で、クリックやハムはデクリックやハム除去といった別のステージの担当です（修復後）。平均スペクトルは重ねて表示し、FLOOR は高域がどれだけ下がったかを示します。Compare を切り替えると両者を聴き比べできます。レベルは変えていないので、動くのは土台のノイズだけです。',
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
      en: 'The dots are the stored samples; the curve is the continuous waveform a converter rebuilds from them. The middle pair straddles a crest, so there the true peak falls between two samples. The nearer the frequency sits to Nyquist, the fewer dots there are per cycle and the further the reconstruction can rise above every stored one — but the overshoot does not grow smoothly: at some frequencies a dot lands right on a crest and the gap closes to nothing. Push the sample peak to 0 dBFS and the true peak pokes above it: every stored number looks safe, yet the signal clips on playback. That gap is what a true-peak meter catches and a true-peak limiter tames.',
      ja: 'ドットは保存されたサンプル、曲線はそこからコンバーターが再構成する連続波形です。中央の 2 つは山をまたいでいるので、そこでは真のピークがサンプルのあいだに落ちます。周波数がナイキストに近いほど 1 周期あたりのドットは減り、再構成はどのサンプルよりも高く伸びられます。ただし、はみ出し方は滑らかに増えるわけではありません。周波数によってはドットがちょうど山の頂点に乗り、差がゼロになります。サンプルピークを 0 dBFS まで上げると、真のピークがそれを超えます。保存された数値はどれも安全に見えるのに、再生すると信号はクリップします。この差こそ、トゥルーピークメーターが捉え、トゥルーピークリミッターが抑えるものです。',
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
        default: 0.48,
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
      en: 'Compression need not be all-or-nothing. Parallel ("New York") compression mixes a heavily compressed copy under the untouched dry signal: the dry copy keeps the transients and punch while the squashed copy lifts the quiet body. Set a low threshold and a high ratio to crush the copy, then drag Blend — at 100% you hear only the compressor (the transfer curve fully bent), and as you lower it the dry dynamics return and the curve straightens back toward 1:1. The envelope panel shows the transients surviving that a full compressor would have flattened.',
      ja: 'コンプレッションは「全か無か」である必要はありません。パラレル（「ニューヨーク」）コンプレッションは、強く潰したコピーを、手を加えていないドライ信号の下に混ぜます。ドライのコピーが過渡音とパンチを保ち、潰したコピーが静かな胴体を持ち上げます。低いスレッショルドと高いレシオでコピーを潰し、ブレンドをドラッグしてください。100% ではコンプレッサーだけが聞こえ（伝達曲線は完全に曲がる）、下げるとドライのダイナミクスが戻って曲線は 1:1 に向かって戻ります。エンベロープのパネルでは、フルのコンプなら潰れていた過渡音が生き残るのが見えます。',
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
      en: 'Tilt EQ rotates the broad tonal balance around a fixed midrange pivot (the amber line). Positive tilt lifts the highs and trims the lows for a brighter master; negative tilt does the reverse for a warmer one. Every render is peak-normalized to the same ceiling, which keeps a positive tilt from clipping — but that matches peaks, not loudness, so a bright setting still measures a couple of LU under a dark one. Watch the averaged spectrum see-saw around the pivot as you drag. Use it for broad correction — reach for a narrow band, not tilt, to tame a single resonance.',
      ja: 'チルト EQ は、固定したミッドレンジのピボット（橙色の線）を軸に、おおまかな音色バランスを回転させます。プラス方向は高域を持ち上げ低域を削って明るく、マイナス方向はその逆で温かくします。レンダーごとにピークを同じ高さへ揃えているためプラス方向でもクリップしませんが、揃えているのはピークであってラウドネスではないので、明るい設定は暗い設定より 2 LU ほど低く出ます。ドラッグすると、平均スペクトルがピボットを軸にシーソーのように傾くのが見えます。用途は広い範囲の補正です。特定の共鳴を抑えたいときは、チルトではなく狭いバンドを使ってください。',
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
];
