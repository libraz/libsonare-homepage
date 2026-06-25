/**
 * Demo definitions for the analysis cluster (introduction, acoustic-analysis,
 * librosa-compatibility, glossary/analysis, …).
 *
 * Definitions are data only — labels carry both locales so the i18n gate can verify
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
    // The band clip walks C–Am–F–G, so the lit pitch classes shift chord to chord.
    source: { kind: 'clip', clip: 'band' },
    viz: 'chroma',
    config: { transform: 'chroma', nFft: 2048, hopLength: 512 },
    title: {
      en: 'Chromagram — harmony folded into 12 bins',
      ja: 'クロマグラム — ハーモニーを12ビンに畳む',
    },
    caption: {
      en: 'Every frequency is folded onto one of twelve pitch classes, so octave is forgotten and only the harmony remains. This clip walks a C–Am–F–G turnaround: watch the lit rows shift as each chord changes, then play to follow the progression.',
      ja: 'すべての周波数を12のピッチクラスのどれかへ畳み込むため、オクターブは忘れられ、ハーモニーだけが残ります。このクリップは C–Am–F–G を循環します。コードが変わるたびに点灯する行が移るのを見て、再生して進行を追ってください。',
    },
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
    // Same groove: beats are the pulse, downbeats are the "1" of each bar.
    source: { kind: 'clip', clip: 'drum' },
    viz: 'overlay',
    title: {
      en: 'Beats vs downbeats — finding the bar line',
      ja: 'ビートとダウンビート — 小節の頭を見つける',
    },
    caption: {
      en: 'Beats are the steady pulse; downbeats are the stronger "one" that starts each bar. Switch the view to see the tracker thin the full pulse down to just the bar lines — far fewer markers, spaced a whole measure apart. Press play to feel where the count resets.',
      ja: 'ビートは一定の拍、ダウンビートは各小節の頭にあたる強い「1」です。表示を切り替えると、すべての拍から小節の頭だけへと絞り込まれ、マーカーがぐっと減って1小節ごとの間隔になります。再生すると、カウントがリセットされる位置が体感できます。',
    },
    params: [
      {
        key: 'view',
        kind: 'select',
        default: 'beat',
        label: { en: 'Detect', ja: '検出' },
        options: [
          { value: 'beat', label: { en: 'Beats', ja: 'ビート' } },
          { value: 'downbeat', label: { en: 'Downbeats', ja: 'ダウンビート' } },
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
];
