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
};
