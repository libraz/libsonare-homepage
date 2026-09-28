/**
 * Demo definitions for the analysis cluster (introduction, acoustic-analysis,
 * librosa-compatibility, glossary/analysis, …).
 *
 * Definitions are data only — labels carry localized copy so the i18n gate can verify
 * parity without a separate locale file. Add entries here; markdown references them
 * by `id` via `<SonareDemo id="..." />`.
 */

import type { SonareDemoDef } from '../types';

export const analysisDemos: SonareDemoDef[] = [
  {
    id: 'stft-basics',
    archetype: 'transform',
    // A rising chirp makes the time/frequency trade-off legible: a clean diagonal
    // sweeps up the spectrogram as the tone rises.
    source: { kind: 'generate', signal: 'sweep', freq: 220, freqEnd: 4000, duration: 2.5 },
    viz: 'spectrogram',
    title: {
      en: 'STFT — seeing time and frequency at once',
      ja: 'STFT — 時間と周波数を同時に見る',
    },
    caption: {
      en: 'A tone sweeping from 220 Hz to 4 kHz. Each column is one short-time spectrum; brighter means more energy at that frequency.',
      ja: '220 Hz から 4 kHz へ上昇するトーン。各列が1つの短時間スペクトルで、明るいほどその周波数のエネルギーが大きい。',
    },
    config: { nFft: 1024, hopLength: 256 },
  },
  {
    id: 'waveform-harmonics',
    archetype: 'signal',
    // The base shape; the reader can switch waveform and frequency live.
    source: { kind: 'generate', signal: 'saw', freq: 220, duration: 2 },
    viz: 'waveform',
    title: {
      en: 'Waveform and spectrum — where harmonics come from',
      ja: '波形とスペクトル — 倍音はどこから生まれるか',
    },
    caption: {
      en: 'The top panel is the wave in time; the bottom is its spectrum. A sine has only its fundamental, while a saw stacks every harmonic and a square only the odd ones — switch the shape and watch the comb appear.',
      ja: '上段は時間波形、下段はそのスペクトル。サイン波は基音だけ、ノコギリ波はすべての倍音、矩形波は奇数倍音だけが立つ。波形を切り替えると倍音の櫛が現れる。',
    },
    params: [
      {
        key: 'waveform',
        kind: 'select',
        default: 'saw',
        label: { en: 'Waveform', ja: '波形' },
        options: [
          { value: 'sine', label: { en: 'Sine', ja: '正弦' } },
          { value: 'saw', label: { en: 'Saw', ja: 'ノコギリ' } },
          { value: 'square', label: { en: 'Square', ja: '矩形' } },
          { value: 'triangle', label: { en: 'Triangle', ja: '三角' } },
        ],
      },
      {
        key: 'freq',
        kind: 'range',
        default: 220,
        min: 110,
        max: 880,
        step: 1,
        unit: 'Hz',
        label: { en: 'Frequency', ja: '周波数' },
      },
    ],
  },
  {
    id: 'chromagram',
    archetype: 'transform',
    // A dedicated chord-only clip keeps the chroma changes easy to read.
    source: { kind: 'clip', clip: 'chord-turnaround' },
    viz: 'chroma',
    config: { transform: 'chroma', nFft: 2048, hopLength: 512 },
    title: {
      en: 'Chromagram — harmony folded into 12 bins',
      ja: 'クロマグラム — ハーモニーを12ビンに畳む',
    },
    caption: {
      en: 'Every frequency is folded onto one of twelve pitch classes, so octave is forgotten and the harmony remains. This clip contains only four separated triads, C–Am–F–G, with a one-beat gap between bars. Watch the lit rows move, then play the turnaround.',
      ja: 'すべての周波数を12のピッチクラスへ畳み込むため、オクターブは消え、ハーモニーが残ります。このクリップは C–Am–F–G の三和音だけを小節ごとに鳴らし、コードの間に1拍の休符を置いています。点灯する行の移動を見てから、進行を再生してください。',
    },
  },
  {
    id: 'chord-track',
    archetype: 'chord-track',
    // Use the clean chord-only passage so the default result has four readable bars.
    source: { kind: 'clip', clip: 'chord-turnaround' },
    viz: 'overlay',
    title: {
      en: 'Chord track — the segments recognition returns',
      ja: 'コードトラック — 認識が返す区間',
    },
    caption: {
      en: 'Each block is a detected chord segment. With the default STFT chroma and a 0.3 second minimum, both template sets read this clip as C–Am–F–G. Lower the minimum duration to keep brief extension readings near chord changes, then switch between all qualities and triads to compare the template vocabulary.',
      ja: 'ブロック 1 つが検出されたコード区間です。初期設定の STFT クロマと最小長 0.3 秒では、どちらのテンプレート集合でもこのクリップを C–Am–F–G と読みます。最小長を下げるとコードの切り替わり付近にある短い拡張コードの読みが残り、「全品質」と「三和音のみ」を切り替えてテンプレート集合の違いを比べられます。',
    },
    params: [
      {
        key: 'vocabulary',
        kind: 'select',
        default: 'full',
        label: { en: 'Templates', ja: 'テンプレート' },
        options: [
          { value: 'full', label: { en: 'All qualities', ja: '全品質' } },
          { value: 'triads', label: { en: 'Triads only', ja: '三和音のみ' } },
        ],
      },
      {
        key: 'minDuration',
        kind: 'range',
        default: 0.3,
        min: 0,
        max: 1,
        step: 0.1,
        unit: 's',
        label: { en: 'Min duration', ja: '最小長' },
      },
    ],
  },
  {
    id: 'mel-spectrogram',
    archetype: 'transform',
    // A vowel-like tone: formant bands are clearer on a perceptual mel axis.
    source: { kind: 'clip', clip: 'vowel' },
    viz: 'spectrogram',
    config: { transform: 'mel', nFft: 2048, hopLength: 512, nMels: 96 },
    title: {
      en: 'Mel spectrogram — frequency the way we hear it',
      ja: 'メルスペクトログラム — 人の聞こえ方の周波数',
    },
    caption: {
      en: 'The same STFT, re-mapped onto the mel scale: fine resolution low down where the ear discriminates, coarser up high. The harmonic stack and formant bands of this vowel-like tone sit closer together than on a linear axis — the view our ears (and most ML front-ends) actually use.',
      ja: '同じ STFT をメル尺度へ写し直したものです。耳が聞き分ける低域は細かく、高域は粗くなります。この母音的なトーンの倍音列とフォルマントの帯は、リニア軸より近くに並びます — 耳（そして多くの機械学習の前処理）が実際に使う見え方です。',
    },
  },
  {
    id: 'mfcc-map',
    archetype: 'transform',
    // The same vowel source so mel ↔ MFCC can be compared on one page.
    source: { kind: 'clip', clip: 'vowel' },
    viz: 'heatmap',
    config: { transform: 'mfcc', nFft: 2048, hopLength: 512, nMfcc: 20 },
    title: {
      en: 'MFCC map — a compact timbre fingerprint',
      ja: 'MFCC マップ — コンパクトな音色の指紋',
    },
    caption: {
      en: 'MFCCs compress the mel spectrogram into a handful of coefficients that capture the spectral envelope while discarding pitch detail. Each row is one coefficient over time (the 0th energy term is dropped); steady timbre reads as steady rows. This is the fingerprint instrument and voice classifiers actually compare.',
      ja: 'MFCC はメルスペクトログラムを少数の係数へ圧縮し、ピッチの詳細を捨ててスペクトル包絡を捉えます。各行が時間に対する1係数（0次のエネルギー項は除外）で、音色が安定していれば行も安定します。これが楽器や声の分類器が実際に比較する指紋です。',
    },
  },
  {
    id: 'beat-tracking',
    archetype: 'detector',
    // A kit groove: onsets are every hit, beats are the inferred pulse.
    source: { kind: 'clip', clip: 'drum' },
    viz: 'overlay',
    title: {
      en: 'Onsets vs beats — from attacks to a pulse',
      ja: 'オンセットとビート — 打点から拍へ',
    },
    caption: {
      en: 'Onset detection marks every attack in the audio; beat tracking distils those into the steady pulse you would tap along to. Switch the view, then press play to watch each marker fire as the playhead reaches it.',
      ja: 'オンセット検出は音の打点をすべて捉え、ビート追跡はそこから手拍子を打つような一定の拍を導き出す。表示を切り替え、再生するとプレイヘッドが到達するたびにマーカーが光る。',
    },
    params: [
      {
        key: 'view',
        kind: 'select',
        default: 'onset',
        label: { en: 'Detect', ja: '検出' },
        options: [
          { value: 'onset', label: { en: 'Onsets', ja: 'オンセット' } },
          { value: 'beat', label: { en: 'Beats', ja: 'ビート' } },
        ],
      },
    ],
  },
  {
    id: 'downbeat-tracking',
    archetype: 'detector',
    // The groove gives the detector enough repeated bars to establish its phase.
    source: { kind: 'clip', clip: 'meter-groove' },
    viz: 'overlay',
    title: {
      en: 'Downbeat tracking — finding the bar line',
      ja: 'ダウンビート追跡 — 小節線を見つける',
    },
    caption: {
      en: 'Downbeat tracking keeps the first beat of each bar from the full pulse. On this four-bar groove, the detector settles after the opening hit and returns bar lines near 2, 4, and 6 seconds. Switch to Beats to see the pulse it follows.',
      ja: 'ダウンビート追跡は、拍全体から各小節の1拍目を残します。この4小節のグルーヴでは、冒頭の打点を過ぎて検出器が安定し、およそ2・4・6秒に小節線を返します。「ビート」に切り替えると、追跡の土台になった拍が見えます。',
    },
    params: [
      {
        key: 'view',
        kind: 'select',
        default: 'downbeat',
        label: { en: 'Detect', ja: '検出' },
        options: [
          { value: 'beat', label: { en: 'Beats', ja: 'ビート' } },
          { value: 'downbeat', label: { en: 'Downbeats', ja: 'ダウンビート' } },
        ],
      },
    ],
  },
  {
    id: 'meter-estimate',
    archetype: 'detector',
    // Four bars of 4/4 with the downbeat accented and beat 3 held back, so the
    // four-beat period wins over its 6/4 neighbour at every rate a browser is
    // likely to decode at.
    source: { kind: 'clip', clip: 'meter-groove' },
    viz: 'overlay',
    title: {
      en: 'Meter estimation — ranking time signatures by confidence',
      ja: '拍子の推定 — 拍子記号を信頼度で並べる',
    },
    caption: {
      en: "Meter estimation scores candidate time signatures over the detected beats: each beat's accent is read from the onset envelope, and 3, 4 and 6 are tried as bar lengths. The result is a ranked list with a confidence for each, not a single verdict — the confidences are shares of the total support, so they read as a breakdown rather than as a probability of being right. Four bars of a plain 4/4 groove here, so 4 takes most of the support and 6 keeps the rest, since every other downbeat also starts a six-beat span. Switch to Beats to see the pulse the estimate was scored on. A clip with fewer than eight detected beats reports that no search ran at all, rather than guessing.",
      ja: '拍子の推定は、検出したビートの上で候補となる拍子記号を採点します。各ビートのアクセントはオンセットエンベロープから読み取り、小節の長さとして 3・4・6 拍を試します。結果は一つの断定ではなく、候補ごとに信頼度を付けた順位表です。信頼度は全体の支持の割合なので、正解である確率ではなく内訳として読みます。ここでは素直な 4 拍子のグルーヴを 4 小節鳴らしているので、支持の大半を 4 が取り、残りを 6 が拾います。1 小節おきの強拍は 6 拍の区切りの開始点でもあるからです。「ビート」に切り替えると、採点の土台になった拍が見えます。ビートが 8 つに満たないクリップでは、推測せずに探索を行わなかったことを表示します。',
    },
    params: [
      {
        key: 'view',
        kind: 'select',
        default: 'meter-estimate',
        label: { en: 'Detect', ja: '検出' },
        options: [
          { value: 'beat', label: { en: 'Beats', ja: 'ビート' } },
          { value: 'meter-estimate', label: { en: 'Meter', ja: '拍子' } },
        ],
      },
    ],
  },
  {
    id: 'meter-estimate-three',
    archetype: 'detector',
    // The same construction in 3/4. Ten bars rather than four: a three-beat bar
    // needs more of them before its downbeat dominates at this tempo.
    source: { kind: 'clip', clip: 'meter-groove-three' },
    viz: 'overlay',
    title: {
      en: 'The same estimate on a waltz',
      ja: '同じ推定を 3 拍子にかけると',
    },
    caption: {
      en: 'The same estimator, the same controls, a groove in 3 instead of 4. The ranking is not close this time: nothing in the material supports a four-beat or six-beat bar, so 3 takes essentially all of the support and the others fall to zero. Comparing this with the 4/4 clip above is the point — a confident estimate and a divided one look different, and the breakdown is what tells them apart.',
      ja: '推定器も操作子も同じで、グルーヴだけ 4 拍子から 3 拍子に変えたものです。今度は接戦になりません。素材に 4 拍や 6 拍の小節を支持する材料が無いため、支持のほぼ全部を 3 が取り、他はゼロに落ちます。上の 4 拍子のクリップと見比べるのがここの狙いです。自信のある推定と割れている推定は見え方が違い、その違いを教えてくれるのが内訳です。',
    },
    params: [
      {
        key: 'view',
        kind: 'select',
        default: 'meter-estimate',
        label: { en: 'Detect', ja: '検出' },
        options: [
          { value: 'beat', label: { en: 'Beats', ja: 'ビート' } },
          { value: 'meter-estimate', label: { en: 'Meter', ja: '拍子' } },
        ],
      },
    ],
  },
  {
    id: 'melody-contour',
    archetype: 'contour',
    // A monophonic lead line: one note at a time, so YIN tracks one clear fundamental.
    source: { kind: 'clip', clip: 'lead' },
    viz: 'overlay',
    title: {
      en: 'Pitch contour — tracing a melody as f0',
      ja: 'ピッチコンター — メロディを f0 として描く',
    },
    caption: {
      en: 'Pitch tracking estimates the fundamental frequency at every frame, turning a sung or played line into a contour you can see. The line breaks where the tracker hears no clear pitch. Toggle Smooth to watch the raw estimate — which jumps the odd octave at note attacks — settle into a clean melody once a median filter and octave correction are applied. Press play and the dot rides the pitch you hear.',
      ja: 'ピッチ追跡はフレームごとに基音の周波数を推定し、歌ったり弾いたりした旋律を目に見えるコンターに変えます。明確なピッチが聞こえない箇所では線が途切れます。「平滑化」を切り替えると、音の立ち上がりで時おりオクターブが飛ぶ生の推定が、メディアンフィルタとオクターブ補正によってきれいな旋律へ落ち着く様子が見えます。再生すると、聞こえるピッチの上をドットが進みます。',
    },
    params: [
      {
        key: 'smooth',
        kind: 'toggle',
        default: true,
        label: { en: 'Smooth', ja: '平滑化' },
      },
    ],
  },
  {
    id: 'griffin-lim',
    archetype: 'param-sweep',
    config: { processor: 'griffin-lim' },
    // A sustained vowel reconstructs quickly and stays recognizable, so the iteration
    // count's effect on phase quality is what you hear, not the choice of material.
    source: { kind: 'clip', clip: 'vowel' },
    viz: 'waveform',
    title: {
      en: 'Griffin-Lim — how iterations recover phase',
      ja: 'Griffin-Lim — 反復で位相を取り戻す',
    },
    caption: {
      en: 'A mel spectrogram keeps how much energy sits at each frequency but throws phase away, so reconstructing audio means inventing a plausible phase. Griffin-Lim does that by repetition: each pass nudges the phase toward something a real waveform could have produced. Drag the iteration count and press play — at one or two passes the result is hollow and "phasey"; by 30–40 it settles into a recognizable voice. The averaged spectrum barely changes because the magnitude is fixed throughout; it is the phase, and therefore the clarity, that improves.',
      ja: 'メルスペクトログラムは各周波数のエネルギー量は残しますが位相を捨てるため、音声を再構成するにはもっともらしい位相を作り出す必要があります。Griffin-Lim はそれを反復で行い、各パスごとに、実際の波形が生み出しうる位相へと近づけていきます。反復回数をドラッグして再生してみてください — 1〜2 パスでは虚ろで「位相っぽい」音ですが、30〜40 パスでは聞き取れる声に落ち着きます。マグニチュードは終始固定されているため平均スペクトルはほとんど変わりません — 改善するのは位相、つまり明瞭さです。',
    },
    params: [
      {
        key: 'iters',
        kind: 'range',
        default: 16,
        min: 1,
        max: 60,
        step: 1,
        unit: { en: 'iter', ja: '反復' },
        label: { en: 'Iterations', ja: '反復回数' },
      },
    ],
  },
  {
    id: 'hpss-separation',
    archetype: 'hpss',
    // The band phrase with the drum groove on top: sustained pitched lines and
    // transient hits together, so the separation has both layers to pull apart.
    source: { kind: 'clip', clip: 'mix' },
    viz: 'spectrogram',
    title: {
      en: 'HPSS — splitting the tune from the drums',
      ja: 'HPSS — 旋律と打楽器を分ける',
    },
    caption: {
      en: 'On a spectrogram, sustained pitched notes draw horizontal ridges while drum hits draw vertical streaks. HPSS exploits exactly that: median-filtering along time keeps the horizontal (harmonic) content, along frequency keeps the vertical (percussive) content. Switch the view — Full shows both, Harmonic keeps the ridges (the chords and bass, drums gone), Percussive keeps the streaks (the kit, tune gone) — and press play to hear each layer on its own. Separating them first often cleans up downstream beat or pitch tracking.',
      ja: 'スペクトログラムでは、持続する音程の音は横方向のすじを、打楽器の打点は縦方向のすじを描きます。HPSS はまさにそれを利用します。時間方向のメディアンフィルタは横（倍音成分）を、周波数方向のメディアンフィルタは縦（打撃成分）を残します。表示を切り替えると、Full は両方、Harmonic はすじ（和音とベース、打楽器なし）、Percussive は縦すじ（ドラム、旋律なし）になります。再生すると各レイヤーを単独で聴けます。先に分離しておくと、後段のビート追跡やピッチ追跡がきれいになることがよくあります。',
    },
    params: [
      {
        key: 'view',
        kind: 'select',
        default: 'full',
        label: { en: 'Layer', ja: 'レイヤー' },
        options: [
          { value: 'full', label: { en: 'Full mix', ja: 'フルミックス' } },
          { value: 'harmonic', label: { en: 'Harmonic', ja: '倍音成分' } },
          { value: 'percussive', label: { en: 'Percussive', ja: '打撃成分' } },
        ],
      },
    ],
  },
  {
    id: 'stem-decompose',
    archetype: 'ab-process',
    // A pad bed under broadband hits on every beat: the two layers are built to
    // separate cleanly, so the percussive stem comes out on its own.
    source: { kind: 'clip', clip: 'mixed-stems' },
    viz: 'spectrogram',
    // Nothing is being repaired here, so the injected hiss and the repair copy
    // would both misdescribe the split.
    config: {
      processor: 'hpss-decompose',
      injectNoise: false,
      eyebrow: 'A/B PROCESS · HPSS',
      legendBefore: { en: 'Full mix', ja: 'フルミックス' },
      legendAfter: { en: 'Percussive', ja: '打撃成分' },
    },
    title: {
      en: 'Stem decomposition — pulling the percussive part out of a mix',
      ja: 'ステム分解 — ミックスから打撃成分を取り出す',
    },
    caption: {
      en: "A sustained pad chord bed with sharp broadband hits on every beat (Full mix). The stage applied here is HPSS decomposition, and the B side is its percussive component alone: the hits survive as short vertical events while the pad's steady spectral lines are pushed out. That is one stem of a two-way split, not a full multi-stem separation (Percussive). Both averaged spectra are drawn together so you can see what the split kept. Flip Compare to audition the mix against the stem it was decomposed into.",
      ja: '持続するパッドの和音の上に、拍ごとに鋭い広帯域の打点を重ねたクリップです（フルミックス）。ここで適用しているのは HPSS による分解で、B 側はその打撃成分だけです。打点は短い縦方向のイベントとして残り、パッドの安定したスペクトル線は押し出されます。つまり 2 分割のうち片方のステムであって、複数ステムへの完全な分離ではありません（打撃成分）。平均スペクトルを重ねて表示するので、分割で何が残ったかが分かります。Compare を切り替えて、ミックスと取り出したステムを聴き比べてください。',
    },
    params: [
      {
        key: 'view',
        kind: 'select',
        default: 'damaged',
        label: { en: 'Compare', ja: '比較' },
        options: [
          { value: 'damaged', label: { en: 'Full mix', ja: 'フルミックス' } },
          { value: 'repaired', label: { en: 'Percussive', ja: '打撃成分' } },
        ],
      },
    ],
  },
];
