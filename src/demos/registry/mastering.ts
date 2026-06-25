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
      en: 'The dots are the stored samples; the curve is the continuous waveform a converter rebuilds from them. They are aligned worst-case, so the true peak falls between two samples. Raise the frequency toward Nyquist and the samples land further down the slope — the reconstruction rises higher above them. Push the sample peak to 0 dBFS and the true peak pokes above it: every stored number looks safe, yet the signal clips on playback. That gap is what a true-peak meter catches and a true-peak limiter tames.',
      ja: 'ドットは保存されたサンプル、曲線はそこからコンバーターが再構成する連続波形です。最悪条件で並べてあるため、真のピークは 2 つのサンプルのあいだに落ちます。周波数をナイキストへ近づけるほどサンプルは斜面の下側に来て、再構成はその上へより高く伸びます。サンプルピークを 0 dBFS まで上げると、真のピークがそれを超えます。保存された数値はどれも安全に見えるのに、再生すると信号はクリップします。この差こそ、トゥルーピークメーターが捉え、トゥルーピークリミッターが抑えるものです。',
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
    // Source is unused for `mono-fold` (the centre tone is synthesized in-browser);
    // a matching tone keeps the intent readable.
    source: { kind: 'generate', signal: 'sine', freq: 220 },
    viz: 'waveform',
    title: {
      en: 'Mono fold — when stereo width cancels',
      ja: 'モノフォールド — ステレオ幅が打ち消されるとき',
    },
    caption: {
      en: 'Phones, club PAs, and many broadcast paths sum left and right to mono. Here the left channel is a steady tone and the right is the same tone, swept from in-phase toward anti-phase. The mono sum averages the two, so as the right channel turns negative the sum shrinks — at full anti-phase it cancels to silence and the correlation meter reads −1. Press play to hear the mono sum: the more anti-phase the content, the quieter the fold-down. This is why width built from opposite-polarity content can vanish on a mono system.',
      ja: 'スマホ、クラブの PA、多くの放送経路は左右をモノに合算します。ここでは左チャンネルが一定のトーン、右チャンネルが同じトーンで、同相から逆相へとスイープします。モノ合算は両者を平均するため、右チャンネルが負へ向かうほど合算は小さくなり、完全な逆相では無音まで打ち消されて相関メーターは −1 を指します。再生するとモノ合算が聴けます — 逆相成分が多いほどフォールドダウンは小さくなります。逆相の成分で作った幅がモノ環境で消えてしまうのは、このためです。',
    },
    params: [
      {
        key: 'antiphase',
        kind: 'range',
        default: 70,
        min: 0,
        max: 100,
        step: 1,
        unit: '%',
        label: { en: 'Anti-phase', ja: '逆相' },
      },
    ],
  },
];
