/** Steps per pattern (one 4/4 bar of 16th notes). */
export const STEP_COUNT = 16;
/** Pattern length in quarter notes (PPQ): one 4/4 bar. */
export const BAR_PPQ = 4;

/** One togglable row in a track's step grid: a fixed pitch. */
export interface StudioRowDef {
  /** MIDI note the row plays. */
  note: number;
  /** Short row label (note name or drum voice). */
  label: string;
}

/** A fixed demo track: one NativeSynth instrument with a small step grid. */
export interface StudioTrackDef {
  id: 'lead' | 'bass' | 'drums';
  /** NativeSynth preset bounced for this track. */
  preset: string;
  /** Project MIDI destination the track routes to. */
  destination: number;
  /** Note length in PPQ for every step. */
  gatePpq: number;
  /** Fixed note-on velocity. */
  velocity: number;
  /** Accent hue used for the lane's steps and meter. */
  hue: 'violet' | 'cyan' | 'amber';
  rows: StudioRowDef[];
}

export const STUDIO_TRACKS: StudioTrackDef[] = [
  {
    id: 'lead',
    preset: 'saw-lead',
    destination: 0,
    gatePpq: 0.22,
    velocity: 100,
    hue: 'violet',
    rows: [
      { note: 72, label: 'C5' },
      { note: 69, label: 'A4' },
      { note: 67, label: 'G4' },
      { note: 64, label: 'E4' },
    ],
  },
  {
    id: 'bass',
    preset: 'sub-bass',
    destination: 1,
    gatePpq: 0.45,
    velocity: 110,
    hue: 'cyan',
    rows: [
      { note: 45, label: 'A2' },
      { note: 43, label: 'G2' },
      { note: 40, label: 'E2' },
    ],
  },
  {
    id: 'drums',
    preset: 'drum-kit',
    destination: 2,
    gatePpq: 0.12,
    velocity: 112,
    hue: 'amber',
    rows: [
      { note: 42, label: 'HAT' },
      { note: 38, label: 'SNR' },
      { note: 36, label: 'KIK' },
    ],
  },
];

/** Pattern cells indexed `[track][row][step]`. */
export type StudioPattern = boolean[][][];

/** A musical starting pattern so the demo sounds good on first play. */
export function defaultPattern(): StudioPattern {
  const pattern = STUDIO_TRACKS.map((track) =>
    track.rows.map(() => new Array<boolean>(STEP_COUNT).fill(false)),
  );
  const set = (track: number, row: number, steps: number[]) => {
    for (const step of steps) pattern[track][row][step] = true;
  };
  // Lead: a near-legato 16th arpeggio — the Am7 cell E-G-A-C rises three
  // times, then a turnaround (A C G A) drops the loop back onto the low E.
  set(0, 0, [3, 7, 11, 13]); // C5
  set(0, 1, [2, 6, 10, 12, 15]); // A4
  set(0, 2, [1, 5, 9, 14]); // G4
  set(0, 3, [0, 4, 8]); // E4
  // Bass: pushed root figure (1, the a-of-1, the and-of-2), down to the
  // sixth chord-tone E, then G walks the turnaround back up to A —
  // an implied Am → Em → G progression inside one bar.
  set(1, 0, [0, 3, 6]); // A2
  set(1, 1, [12, 14]); // G2
  set(1, 2, [8, 11]); // E2
  // Four-on-the-floor: off-beat hats with a 16th push into the loop,
  // clap-style snare layered on beats 2 and 4.
  set(2, 0, [2, 6, 10, 14, 15]); // hat
  set(2, 1, [4, 12]); // snare
  set(2, 2, [0, 4, 8, 12]); // kick
  return pattern;
}

export const enCopy = {
  title: 'Studio Mini',
  subtitle: 'A tiny headless-DAW session: step-sequence, mix, and bounce in the browser',
  localOnly: 'LOCAL ONLY',
  status: {
    idle: 'Idle',
    starting: 'Starting',
    ready: 'Ready',
    playing: 'Playing',
    error: 'Error',
  },
  transport: {
    play: 'Play',
    stop: 'Stop',
    tempo: 'Tempo',
    download: 'Bounce WAV',
    downloading: 'Bouncing…',
  },
  deck: {
    model: 'SM-16',
    tagline: 'HEADLESS DAW · 16-STEP SEQUENCER',
  },
  sections: {
    sequencer: 'Sequencer',
    mixer: 'Mixer',
  },
  tracks: {
    lead: 'Lead',
    bass: 'Bass',
    drums: 'Drums',
  },
  mixer: {
    gain: 'Level',
    mute: 'Mute',
    unmute: 'Unmute',
    master: 'Master',
  },
  statusbar: {
    pos: 'Pos',
    bpm: 'BPM',
  },
  hint: 'Click the grid to toggle steps — pads you arm are auditioned while the transport is stopped. Edits re-render the loop through the Project engine while it plays.',
  errors: {
    start: 'Could not start the studio engine. Reload and try again.',
  },
  guide: {
    title: 'A headless DAW, bounced live in your browser',
    body: 'Every edit rebuilds a libsonare Project — MIDI clips routed to three NativeSynth destinations — and bounces it offline to audio in milliseconds. The loop you hear and the WAV you download are the same deterministic render. This is a deliberately small session; the Project API goes much further.',
    docs: 'Project docs',
  },
  terms: {
    eyebrow: 'Studio',
    tipLabel: 'How to use',
    linkLabel: 'Open glossary',
    resetLabel: 'Reset',
    items: {
      step: {
        title: 'Step sequencer',
        body: 'Each lane is one NativeSynth track; every row is a fixed pitch and every column a 16th-note step. Click a cell to arm or clear that note. The pattern is one 4/4 bar that loops.',
        tip: 'Armed pads are auditioned while the transport is stopped, so you can build a part by ear before pressing play.',
      },
      mixer: {
        title: 'Mixer',
        body: 'Three channel strips feed a master bus. Levels and mutes apply to the live loop and to the WAV you bounce — they are the same render.',
        tip: 'Balance the tracks here; pull a part down or mute it to hear how the arrangement changes.',
      },
      tempo: {
        title: 'Tempo',
        body: 'Playback speed in beats per minute (80–160). Changing it re-renders the loop at the new tempo.',
        tip: 'Nudge tempo to find the groove — the bounce uses whatever value is set here.',
        defaultRationale: 'Double-click the knob to restore 120 BPM.',
      },
      transport: {
        title: 'Transport',
        body: 'Starts and stops the loop. Playback needs a click first — browsers only start audio on a gesture — and the spacebar toggles it too.',
        tip: 'Press play to hear the pattern; edits made while playing re-render the loop seamlessly.',
      },
      position: {
        title: 'Position',
        body: 'The play head as bar.beat.sixteenth. The loop is a single bar, so the bar stays at 1 while beat and sixteenth count through it.',
        tip: 'Watch the run lights above to follow the same position visually.',
      },
      bounce: {
        title: 'Bounce to WAV',
        body: 'Renders the session offline to a 48 kHz WAV and downloads it. The file is the exact deterministic render of the loop you hear — nothing is captured in real time.',
        tip: 'Bounce any time to save the current pattern, levels, and tempo as audio.',
      },
      level: {
        title: 'Channel level',
        body: 'The track fader, in dB (−∞ up to about +3). The LED meter beside it shows live post-fader peak, and the M button mutes the channel.',
        tip: 'Set levels so no single track dominates; double-click the fader to return to unity.',
        defaultRationale: 'Double-click the fader to reset the level.',
      },
      master: {
        title: 'Master level',
        body: 'The final output fader feeding the master bus and the bounce. Everything passes through it after the channel strips.',
        tip: 'Trim the master so the bounce peaks comfortably below 0 dB.',
        defaultRationale: 'Double-click the fader to reset the level.',
      },
      vu: {
        title: 'Master meter',
        body: 'Post-master peak level on a dB scale (−60 to 0). 0 dB is the digital ceiling; readings into the amber and red risk clipping the bounce.',
        tip: 'Keep the loudest moments out of the red so the exported WAV stays clean.',
      },
    },
  },
};

export const jaCopy: typeof enCopy = {
  title: 'スタジオミニ',
  subtitle: 'ヘッドレス DAW のミニセッション：ステップ入力・ミックス・バウンスをブラウザで',
  localOnly: 'ローカル処理',
  status: {
    idle: '待機中',
    starting: '起動中',
    ready: '準備完了',
    playing: '再生中',
    error: 'エラー',
  },
  transport: {
    play: '再生',
    stop: '停止',
    tempo: 'テンポ',
    download: 'WAV にバウンス',
    downloading: 'バウンス中…',
  },
  deck: {
    model: 'SM-16',
    tagline: 'HEADLESS DAW · 16-STEP SEQUENCER',
  },
  sections: {
    sequencer: 'シーケンサー',
    mixer: 'ミキサー',
  },
  tracks: {
    lead: 'リード',
    bass: 'ベース',
    drums: 'ドラム',
  },
  mixer: {
    gain: 'レベル',
    mute: 'ミュート',
    unmute: 'ミュート解除',
    master: 'マスター',
  },
  statusbar: {
    pos: '位置',
    bpm: 'BPM',
  },
  hint: 'グリッドをクリックしてステップを切り替えます。停止中はオンにしたパッドの音をその場で試聴できます。編集すると再生中でも Project エンジンがループを再レンダーします。',
  errors: {
    start: 'スタジオエンジンを起動できませんでした。再読み込みして再度お試しください。',
  },
  guide: {
    title: 'ブラウザ内でライブにバウンスされるヘッドレス DAW',
    body: '編集のたびに libsonare の Project（3 つの NativeSynth デスティネーションへルーティングされた MIDI クリップ）を再構築し、ミリ秒単位でオフラインレンダーします。聴いているループとダウンロードする WAV は同一の決定的レンダーです。これは意図的に小さなセッションで、Project API 自体はさらに多くの機能を持ちます。',
    docs: 'Project ドキュメント',
  },
  terms: {
    eyebrow: 'スタジオ',
    tipLabel: '使い方',
    linkLabel: '用語集を開く',
    resetLabel: 'リセット',
    items: {
      step: {
        title: 'ステップシーケンサー',
        body: '各レーンが 1 つの NativeSynth トラックで、行は固定の音程、列は 16 分音符のステップです。セルをクリックするとそのノートのオン／オフを切り替えられます。パターンはループする 4/4 の 1 小節です。',
        tip: '停止中はオンにしたパッドの音をその場で試聴できるので、再生前に耳で組み立てられます。',
      },
      mixer: {
        title: 'ミキサー',
        body: '3 本のチャンネルストリップがマスターバスへ送られます。レベルとミュートは再生中のループにもバウンスする WAV にも同じように反映されます（同一のレンダーです）。',
        tip: 'ここでトラックのバランスを取ります。下げたりミュートしたりして、アレンジの変化を確認しましょう。',
      },
      tempo: {
        title: 'テンポ',
        body: '再生速度（BPM、80〜160）。変更するとループが新しいテンポで再レンダーされます。',
        tip: 'テンポを動かしてグルーヴを探します。バウンスはここで設定した値を使います。',
        defaultRationale: 'ノブをダブルクリックすると 120 BPM に戻ります。',
      },
      transport: {
        title: 'トランスポート',
        body: 'ループの再生／停止です。ブラウザはユーザー操作がないと音を鳴らせないため、最初は必ずクリックが必要です。スペースキーでも切り替えられます。',
        tip: '再生でパターンを聴けます。再生中の編集もシームレスにループへ再レンダーされます。',
      },
      position: {
        title: '位置',
        body: '再生ヘッドを 小節.拍.16分 で表示します。ループは 1 小節なので小節は 1 のまま、拍と 16 分が進みます。',
        tip: '上のランライトでも同じ位置を視覚的に追えます。',
      },
      bounce: {
        title: 'WAV にバウンス',
        body: 'セッションをオフラインで 48 kHz の WAV にレンダーしてダウンロードします。ファイルは聴いているループの決定的レンダーそのもので、リアルタイム録音ではありません。',
        tip: 'いつでもバウンスして、現在のパターン・レベル・テンポを音声として保存できます。',
      },
      level: {
        title: 'チャンネルレベル',
        body: 'トラックのフェーダー（dB、−∞ から約 +3）。横の LED メーターはフェーダー後のライブピーク、M ボタンはチャンネルのミュートです。',
        tip: '特定のトラックが突出しないようレベルを整えます。フェーダーをダブルクリックでユニティに戻ります。',
        defaultRationale: 'フェーダーをダブルクリックするとレベルがリセットされます。',
      },
      master: {
        title: 'マスターレベル',
        body: 'マスターバスとバウンスへ送る最終出力フェーダーです。チャンネルストリップの後段で、すべてがここを通ります。',
        tip: 'バウンスが 0 dB に十分な余裕を持って収まるようマスターを調整します。',
        defaultRationale: 'フェーダーをダブルクリックするとレベルがリセットされます。',
      },
      vu: {
        title: 'マスターメーター',
        body: 'マスター後のピークレベルを dB スケール（−60〜0）で表示します。0 dB がデジタルの上限で、アンバー／レッドに入るとバウンスがクリップする恐れがあります。',
        tip: '最も大きい瞬間がレッドに入らないようにすれば、書き出した WAV はクリーンに保てます。',
      },
    },
  },
};

/** Help-tooltip term keys, derived from the English copy. */
export type StudioTermKey = keyof typeof enCopy.terms.items;

/**
 * Glossary slug each term deep-links to (relative to `/docs/glossary/`).
 * `undefined` terms still show a tooltip but render no docs link.
 */
export const STUDIO_TERM_SLUGS: Record<StudioTermKey, string | undefined> = {
  step: 'arrangement/clips-and-tracks',
  mixer: 'mixing/channel-strip',
  tempo: 'arrangement/warp-and-tempo',
  transport: 'realtime/realtime-engine',
  position: undefined,
  bounce: 'arrangement/bounce-and-rendering',
  level: 'mixing/channel-strip',
  master: 'concepts/gain-staging',
  vu: 'mixing/automation-metering',
};
