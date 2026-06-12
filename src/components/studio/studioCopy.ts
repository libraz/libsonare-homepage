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
  /**
   * Project MIDI destination for the offline bounce path (0-based). The live
   * engine path instead derives both track id and destination id as
   * `index + 1` (they must match for output to enter the lane mixer) — see
   * `trackId()` in useStudioEngine. The two schemes are independent.
   */
  destination: number;
  /** Note length in PPQ for every step. */
  gatePpq: number;
  /** Fixed note-on velocity. */
  velocity: number;
  /** Accent hue used for the lane's steps and meter. */
  hue: 'violet' | 'cyan' | 'amber';
  /**
   * General MIDI mapping for the SMF export, so the file plays sensibly in
   * any GM-aware DAW or player. Drums omit `program` and use channel 9.
   */
  gm: { channel: number; program?: number };
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
    gm: { channel: 0, program: 81 }, // Lead 2 (sawtooth)
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
    gm: { channel: 1, program: 38 }, // Synth Bass 1
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
    gm: { channel: 9 }, // GM drum channel; row notes are GM drum notes
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
    midi: 'Export MIDI',
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
  hint: 'Click the grid to toggle steps — pads you arm are auditioned while the transport is stopped. Edits swap the engine\u2019s MIDI clip schedule in place, so the loop keeps playing through every change.',
  errors: {
    start: 'Could not start the studio engine. Reload and try again.',
  },
  guide: {
    title: 'A headless DAW, running live in your browser',
    body: 'The pattern is compiled into looping MIDI clips on libsonare\u2019s realtime engine: three NativeSynth destinations mixed through the engine\u2019s per-track lane mixer, with faders, mutes, and meters living engine-side. Edits replace the clip schedule in place — playback never stops to re-render. The WAV you download is the same arrangement rendered deterministically offline, and the MIDI export writes the pattern itself as a Standard MIDI File for any DAW. This is a deliberately small session; the engine API goes much further.',
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
        body: 'Three engine lane strips feed the master strip. Faders and mutes run inside the realtime engine, and the same gains are applied to the WAV you bounce.',
        tip: 'Balance the tracks here; pull a part down or mute it to hear how the arrangement changes.',
      },
      tempo: {
        title: 'Tempo',
        body: 'Playback speed in beats per minute (80–160). Changing it updates the engine\u2019s tempo map live — the loop follows without re-rendering.',
        tip: 'Nudge tempo to find the groove — the bounce uses whatever value is set here.',
        defaultRationale: 'Double-click the knob to restore 120 BPM.',
      },
      transport: {
        title: 'Transport',
        body: 'Starts and stops the loop. Playback needs a click first — browsers only start audio on a gesture — and the spacebar toggles it too.',
        tip: 'Press play to hear the pattern; edits made while playing swap the clip schedule in place, so the loop never stops.',
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
      midi: {
        title: 'Export MIDI',
        body: 'Writes the pattern and tempo as a Standard MIDI File — one track per instrument, with General MIDI programs and drum notes — so the loop opens in any DAW.',
        tip: 'Muted tracks are left out, matching the WAV bounce. Swap the sounds freely after import: the notes carry no audio.',
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
    midi: 'MIDI 書き出し',
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
  hint: 'グリッドをクリックしてステップを切り替えます。停止中はオンにしたパッドの音をその場で試聴できます。編集はエンジンの MIDI クリップスケジュールをその場で差し替えるので、再生は止まりません。',
  errors: {
    start: 'スタジオエンジンを起動できませんでした。再読み込みして再度お試しください。',
  },
  guide: {
    title: 'ブラウザ内でライブに動くヘッドレス DAW',
    body: 'パターンは libsonare のリアルタイムエンジン上のループ MIDI クリップへコンパイルされます。3 つの NativeSynth デスティネーションをエンジン内蔵のトラックレーンミキサーがミックスし、フェーダー・ミュート・メーターもエンジン側で動きます。編集はクリップスケジュールをその場で置き換えるため、再生を止めて再レンダーすることはありません。ダウンロードする WAV は同じアレンジを決定的にオフラインレンダーしたもので、MIDI 書き出しはパターンそのものをスタンダード MIDI ファイルとして保存し、どの DAW でも開けます。これは意図的に小さなセッションで、エンジン API 自体はさらに多くの機能を持ちます。',
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
        body: '3 本のエンジンレーンストリップがマスターストリップへ送られます。フェーダーとミュートはリアルタイムエンジン内で動き、バウンスする WAV にも同じゲインが適用されます。',
        tip: 'ここでトラックのバランスを取ります。下げたりミュートしたりして、アレンジの変化を確認しましょう。',
      },
      tempo: {
        title: 'テンポ',
        body: '再生速度（BPM、80〜160）。変更はエンジンのテンポマップにライブで反映され、再レンダーなしでループが追従します。',
        tip: 'テンポを動かしてグルーヴを探します。バウンスはここで設定した値を使います。',
        defaultRationale: 'ノブをダブルクリックすると 120 BPM に戻ります。',
      },
      transport: {
        title: 'トランスポート',
        body: 'ループの再生／停止です。ブラウザはユーザー操作がないと音を鳴らせないため、最初は必ずクリックが必要です。スペースキーでも切り替えられます。',
        tip: '再生でパターンを聴けます。再生中の編集はクリップスケジュールをその場で差し替えるので、ループは止まりません。',
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
      midi: {
        title: 'MIDI 書き出し',
        body: 'パターンとテンポをスタンダード MIDI ファイルとして書き出します。楽器ごとに 1 トラック、General MIDI のプログラムとドラムノート付きなので、どの DAW でもそのまま開けます。',
        tip: 'WAV バウンスと同じく、ミュート中のトラックは含まれません。ノートに音声は含まれないため、読み込み後は自由に音色を差し替えられます。',
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
  midi: 'instruments/midi-basics',
  level: 'mixing/channel-strip',
  master: 'concepts/gain-staging',
  vu: 'mixing/automation-metering',
};
