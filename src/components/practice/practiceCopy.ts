/**
 * Localized copy and shared constants for the Piano Practice demo.
 *
 * The English table is the source of truth; `jaCopy` mirrors its shape so a
 * missing key is a type error. Both feed the demo through `localizedValue`.
 */

export const enCopy = {
  title: 'Piano Practice',
  subtitle: 'Falling notes · built-in piano engine',
  eyebrow: 'PLAY · LEARN',
  heading: 'Watch the notes fall, follow the keys',
  intro:
    "libsonare's built-in engine renders the score to audio on-device — nothing uploaded. Slow any passage down without changing pitch, and switch between the synthesized and sampled piano on the fly.",

  status: {
    idle: 'READY',
    loading: 'LOADING',
    rendering: 'RENDERING',
    playing: 'PLAYING',
    paused: 'PAUSED',
    ready: 'LOADED',
    error: 'ERROR',
  },

  controls: {
    play: 'Play',
    pause: 'Pause',
    preparing: 'Preparing…',
    restart: 'Restart',
    speed: 'Speed',
    sound: 'Sound',
    sourceSampled: 'Sampled',
    sourceSynth: 'Built-in',
    sourceAria: 'Piano sound source',
    volume: 'Guide volume',
    mute: 'Mute',
    unmute: 'Unmute',
  },

  // Movement selector (the full Goldberg set).
  selector: {
    label: 'Movement',
    prev: 'Previous movement',
    next: 'Next movement',
    aria: 'Choose a movement',
  },

  // Web MIDI input.
  midi: {
    connect: 'Connect MIDI',
    connected: 'MIDI ready',
    waiting: 'Plug in a keyboard',
    unsupported: 'Web MIDI is not available in this browser',
    denied: 'MIDI access was blocked',
  },

  // Rhythm-game mode.
  game: {
    enable: 'Game mode',
    on: 'Game on',
    hint: 'Play each note as it hits the line — on the keys below or a MIDI keyboard.',
    score: 'Score',
    accuracy: 'Accuracy',
    combo: 'Combo',
    results: 'Results',
    rankLabel: 'Rank',
    maxCombo: 'Max Combo',
    fullCombo: 'Full Combo',
    retry: 'Play again',
    exit: 'Close',
    judge: {
      perfect: 'Perfect',
      great: 'Great',
      good: 'Good',
      miss: 'Miss',
    },
  },

  meta: {
    piece: 'Piece',
    notes: 'Notes',
    length: 'Length',
    range: 'Range',
    tempo: 'Tempo',
  },

  composer: 'J.S. Bach',
  work: 'Goldberg Variations · BWV 988',

  guideTitle: 'How it works',
  guideBody:
    'The roll, strike line, and audio share one clock, so the lit keys match what you hear. Slow a passage down to learn it without changing pitch, then switch on game mode and connect a MIDI keyboard to be scored on your timing.',
  guideLink: 'SoundFont player',

  errors: {
    parse: 'That movement could not be loaded.',
    render: 'Could not render the audio. Reload the page and try again.',
  },

  countdown: 'Get ready',
  hint: 'Press play — the piano loads on first play.',
  preparing: 'Preparing the piano…',
  preparingNote: 'Rendering this movement on-device — no upload.',
  attribution:
    'Music: Goldberg Variations (BWV 988), public-domain transcription. Piano: libsonare built-in synth, or a public-domain SoundFont.',
};

export const jaCopy: typeof enCopy = {
  title: 'ピアノ練習',
  subtitle: 'ノート落下 · 内蔵ピアノ音源',
  eyebrow: 'PLAY · LEARN',
  heading: '落ちてくる音符を見て、鍵盤を追う',
  intro:
    'libsonare 内蔵の音源が、楽譜を端末内でオーディオにレンダリングします（アップロードなし）。音の高さを変えずに遅くでき、合成ピアノとサンプル音源はその場で切り替えられます。',

  status: {
    idle: 'READY',
    loading: 'LOADING',
    rendering: 'RENDERING',
    playing: 'PLAYING',
    paused: 'PAUSED',
    ready: 'LOADED',
    error: 'ERROR',
  },

  controls: {
    play: '再生',
    pause: '一時停止',
    preparing: '準備中…',
    restart: '最初から',
    speed: '速度',
    sound: '音源',
    sourceSampled: 'サンプル',
    sourceSynth: '内蔵合成',
    sourceAria: 'ピアノの音源',
    volume: 'ガイド音量',
    mute: 'ミュート',
    unmute: 'ミュート解除',
  },

  selector: {
    label: '楽章',
    prev: '前の楽章',
    next: '次の楽章',
    aria: '楽章を選ぶ',
  },

  midi: {
    connect: 'MIDI を接続',
    connected: 'MIDI 接続済み',
    waiting: 'キーボードを接続してください',
    unsupported: 'このブラウザは Web MIDI に対応していません',
    denied: 'MIDI へのアクセスが拒否されました',
  },

  game: {
    enable: 'ゲームモード',
    on: 'ゲーム中',
    hint: '判定ラインに届いた音を、下の鍵盤か MIDI キーボードで弾きましょう。',
    // The scoreboard terms stay English even in JA — that reads as a rhythm game.
    score: 'Score',
    accuracy: 'Accuracy',
    combo: 'Combo',
    results: 'Results',
    rankLabel: 'Rank',
    maxCombo: 'Max Combo',
    fullCombo: 'Full Combo',
    retry: 'もう一度',
    exit: '閉じる',
    judge: {
      perfect: 'Perfect',
      great: 'Great',
      good: 'Good',
      miss: 'Miss',
    },
  },

  meta: {
    piece: '曲',
    notes: 'ノート数',
    length: '長さ',
    range: '音域',
    tempo: 'テンポ',
  },

  composer: 'J.S. バッハ',
  work: 'ゴルトベルク変奏曲 · BWV 988',

  guideTitle: '仕組み',
  guideBody:
    'ピアノロール・判定ライン・音声は同じクロックで動くので、光る鍵盤と聞こえる音が一致します。速度を落として音の高さを変えずに練習し、ゲームモードで MIDI キーボードをつなぐとタイミングを採点できます。',
  guideLink: 'SoundFont プレイヤー',

  errors: {
    parse: 'この楽章を読み込めませんでした。',
    render: '音声を生成できませんでした。ページを再読み込みして再試行してください。',
  },

  countdown: 'まもなく開始',
  hint: '再生を押すと、初回にピアノ音源を読み込みます。',
  preparing: 'ピアノを準備中…',
  preparingNote: 'この楽章を端末内で生成中 — アップロードなし。',
  attribution:
    '楽曲: ゴルトベルク変奏曲（BWV 988、パブリックドメインの採譜）。ピアノ: libsonare 内蔵合成、またはパブリックドメインの SoundFont。',
};

export type PracticeCopy = typeof enCopy;

/** Practice playback speeds (multipliers of the score tempo). */
export const SPEED_OPTIONS = [0.5, 0.75, 1] as const;

/**
 * Which engine renders the piano: `sf2` plays the bundled sampled acoustic grand
 * through the SoundFont player; `synth` plays libsonare's built-in NativeSynth
 * physical-model piano (no SoundFont — the engine synthesizes every note).
 */
export type SoundSource = 'sf2' | 'synth';
