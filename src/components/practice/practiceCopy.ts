/**
 * Localized copy and shared constants for the Piano Practice demo.
 *
 * The English table is the source of truth; `jaCopy` mirrors its shape so a
 * missing key is a type error. Both feed the demo through `localizedValue`.
 */

export const enCopy = {
  title: 'Piano Practice',
  subtitle: 'Falling-note player',
  eyebrow: 'PLAY · LEARN',
  heading: 'Watch the notes fall, follow the keys',
  intro:
    'The score scrolls down toward the keyboard; each key lights as its note lands on the strike line. Connect a MIDI keyboard to play along and be scored. Audio is rendered locally by the libsonare SoundFont player — nothing is uploaded.',

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
    'The roll, the strike line, and the rendered audio share one clock, so the lit keys match what you hear. Drop the speed to learn a passage, then bring it back to tempo. Switch on game mode and connect a MIDI keyboard to be scored on your timing.',
  guideLink: 'SoundFont player',

  errors: {
    parse: 'That movement could not be loaded.',
    render: 'Could not render the audio. Reload the page and try again.',
  },

  hint: 'Press play — the piano loads on first play.',
  preparing: 'Preparing the piano…',
  preparingNote: 'Rendering this movement on-device — no upload.',
  attribution:
    'Music: Goldberg Variations (BWV 988), public-domain transcription. Piano: public-domain SoundFont.',
};

export const jaCopy: typeof enCopy = {
  title: 'ピアノ練習',
  subtitle: 'ノート落下プレイヤー',
  eyebrow: 'PLAY · LEARN',
  heading: '落ちてくる音符を見て、鍵盤を追う',
  intro:
    '楽譜が鍵盤に向かって流れ落ち、ノートが判定ラインに届くと対応する鍵盤が光ります。MIDIキーボードをつなげば一緒に弾いてスコアを競えます。音はlibsonareのSoundFontプレイヤーがローカルで生成し、アップロードは一切ありません。',

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
    connect: 'MIDIを接続',
    connected: 'MIDI接続済み',
    waiting: 'キーボードを接続してください',
    unsupported: 'このブラウザはWeb MIDIに対応していません',
    denied: 'MIDIへのアクセスが拒否されました',
  },

  game: {
    enable: 'ゲームモード',
    on: 'ゲーム中',
    hint: '判定ラインに届いた音を、下の鍵盤かMIDIキーボードで弾きましょう。',
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
    'ピアノロール・判定ライン・生成音声は同じクロックで動くので、光る鍵盤と聞こえる音が一致します。速度を落としてパッセージを覚え、テンポを戻して仕上げましょう。ゲームモードをオンにしてMIDIキーボードをつなげば、タイミングを採点できます。',
  guideLink: 'SoundFontプレイヤー',

  errors: {
    parse: 'この楽章を読み込めませんでした。',
    render: '音声を生成できませんでした。ページを再読み込みして再試行してください。',
  },

  hint: '再生を押すと、初回にピアノ音源を読み込みます。',
  preparing: 'ピアノを準備中…',
  preparingNote: 'この楽章を端末内で生成中 — アップロードなし。',
  attribution:
    '楽曲: ゴルトベルク変奏曲（BWV 988、パブリックドメインの採譜）。ピアノ: パブリックドメインのSoundFont。',
};

export type PracticeCopy = typeof enCopy;

/** Practice playback speeds (multipliers of the score tempo). */
export const SPEED_OPTIONS = [0.5, 0.75, 1] as const;
