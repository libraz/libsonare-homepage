/**
 * Localized copy for the Piano Transcription demo. The English table is the
 * source of truth; `jaCopy` mirrors its shape so a missing key is a type error.
 */
import type { KnobKey } from './detectorSettings';

export type ListenMode = 'source' | 'piano' | 'both';
export const LISTEN_MODES: readonly ListenMode[] = ['source', 'piano', 'both'];
export const ZOOM_LEVELS = [1, 2, 4, 8] as const;
export type ZoomLevel = (typeof ZOOM_LEVELS)[number];

interface KnobHelp {
  label: string;
  title: string;
  body: string;
  tip: string;
}

export const enCopy = {
  title: 'Piano Transcription',
  subtitle: 'Audio to MIDI · piano roll · built-in piano',
  eyebrow: 'AUDIO → MIDI',
  heading: 'Turn a piano recording back into notes',
  intro:
    'libsonare finds the notes in a piano recording and lays them on a piano roll under the waveform they came from, then plays them back through its built-in acoustic piano. Set the detector and press Transcribe; every run after the first marks the notes that appeared and the ones that disappeared since the one before. Everything runs in your browser.',

  status: {
    loading: 'LOADING',
    idle: 'READY',
    transcribing: 'TRANSCRIBING',
    rendering: 'RENDERING',
    ready: 'DONE',
    playing: 'PLAYING',
    error: 'ERROR',
  },

  statusFields: {
    source: 'SRC',
    length: 'LEN',
    notes: 'NOTES',
    tempo: 'BPM',
  },

  source: {
    label: 'Audio',
    sample: 'Sample piano piece',
    own: 'Open audio file',
    backToSample: 'Use the sample',
    dropHint: 'or drop one onto the roll',
    drop: 'Drop an audio file to load it',
    loading: 'Decoding…',
    tooLong: 'Use a recording of {max} or shorter.',
    decode: 'That file could not be decoded as audio.',
  },

  run: {
    button: 'Transcribe',
    running: 'Transcribing…',
    firstHint: 'Runs on this device; nothing is uploaded.',
    pending: 'Changed since run #{n}',
    clean: 'Run #{n} used these settings.',
    sourceChanged: 'New audio: not transcribed yet.',
    steps: {
      detect: 'Finding notes',
      render: 'Piano playback and MIDI',
    },
    stepsAria: 'Transcription progress',
  },

  empty: {
    title: 'Nothing transcribed yet',
    body: 'Press Transcribe and the notes found in this recording are laid out under its waveform.',
  },

  legend: {
    wave: 'Original',
    piano: 'Piano playback',
  },

  controls: {
    play: 'Play',
    pause: 'Pause',
    restart: 'Back to start',
    listen: 'Listen',
    listenModes: {
      source: 'Original',
      piano: 'Piano',
      both: 'Both',
    } satisfies Record<ListenMode, string>,
    listenAria: 'What to hear',
    zoom: 'Zoom',
    zoomAria: 'Time zoom',
    fit: 'Fit',
    download: 'Download MIDI',
    downloadName: 'transcription.mid',
  },

  lanes: {
    rollAria:
      'Waveform above a piano roll on one time axis. Click to move the playhead, drag to scroll.',
  },

  detector: {
    title: 'Detector settings',
    mode: 'Path',
    modes: { poly: 'Polyphonic', mono: 'Single line' },
    modeAria: 'Detection path',
    modeHelp: {
      title: 'Polyphonic or single line',
      body: 'Polyphonic reads the multi-F0 chain and finds notes that overlap, which is what a piano plays. Single line reads pYIN cut into notes and follows one pitch at a time, so a chord comes back as at most one of its notes.',
      tip: 'Switch to single line on this piece to see how much of it is chords.',
    },
    polyOnly: 'Polyphonic only',
    monoOnly: 'Single line only',
    tuning: 'Tuning',
    tuningFixed: 'A = 440 Hz',
    tuningAuto: 'Measure',
    tuningAria: 'Tuning reference',
    tuningHelp: {
      title: 'Tuning reference',
      body: 'Note numbers are measured against A = 440 Hz, or against a reference measured from the audio before any pitch is tracked. A recording tuned between semitones can land on the wrong neighbour under a fixed 440.',
      tip: 'The measured offset is shown beside the result.',
    },
    division: {
      label: 'Shortest note value',
      aria: 'Shortest note as a note value',
      off: 'Off',
      help: {
        title: 'Shortest note value',
        body: "Sets the shortest note as a note value at the run's tempo instead of in milliseconds: 1/16 at 120 BPM is the same floor as 125 ms. The tempo is the one detected on the first run over this recording. While a value is chosen, the Shortest note knob is not read.",
        tip: 'Pick 1/16 so the floor follows the tempo of the piece rather than the clock.',
      },
    },
    reset: 'Defaults',
    resetAria: 'Restore the default detector settings',
    knobsTitle: 'Detector',
    off: 'off',
    knobs: {
      minNoteMs: {
        label: 'Shortest note',
        title: 'Shortest note',
        body: "A span shorter than this is dropped rather than kept as a note. The engine's default is 60 ms on the polyphonic path and 30 ms on the single line. This page starts the polyphonic path at 120 ms, which matched the score better on rendered piano; genuinely short notes are the cost.",
        tip: 'Raise it to clear short fragments; fast runs go with them.',
      },
      splitCents: {
        label: 'Pitch split',
        title: 'Pitch split',
        body: 'How far the pitch has to move, in cents, before one note ends and the next begins. 100 cents is a semitone. Only the single-line path reads it; on the polyphonic path it changes nothing.',
        tip: 'Lower values cut a wavering pitch into several notes.',
      },
      velocityFloorDb: {
        label: 'Velocity floor',
        title: 'Velocity floor',
        body: "A note's peak level is mapped linearly from this level, as velocity 1, up to 0 dBFS, as 127. It only sets velocity: no note is dropped for falling under it. Notes are dropped by a separate gate, when they sit more than 36 dB under the loudest notes of the take or under -80 dBFS.",
        tip: 'Raise it and the same notes play back softer.',
      },
      maxPolyphony: {
        label: 'Max voices',
        title: 'Max voices',
        body: 'How many notes one analysis frame may hold at once.',
        tip: 'Set it to 1 or 2 and the inner voices of every chord go first.',
      },
      framePeakRatio: {
        label: 'Frame cut',
        title: 'Frame peak cut',
        body: "Within each frame the search for further notes stops below this share of the frame's strongest peak. 0 is no cut.",
        tip: 'Raise it to drop quiet notes that sit under loud ones.',
      },
      ridgePeakRatio: {
        label: 'Ridge cut',
        title: 'Ridge peak cut',
        body: 'A tracked note ends once it falls below this share of its own running peak. 0 is no cut.',
        tip: 'Higher values end decaying piano notes sooner.',
      },
      reattackRatio: {
        label: 'Re-strike',
        title: 'Re-strike split',
        body: 'A note splits in two where its strength climbs past this multiple of the level just before, the same key struck again while it still sounds. The lowest stop turns the split off.',
        tip: 'Turn it off and repeated notes merge into one long one.',
      },
    } satisfies Record<KnobKey, KnobHelp>,
    helpEyebrow: 'Detector',
    tipLabel: 'Try',
  },

  result: {
    notes: 'Notes',
    kept: 'Unchanged',
    added: 'New',
    removed: 'Gone',
    voices: 'Most at once',
    tempo: 'Tempo',
    tuning: 'Tuning',
    time: 'Detection',
    run: 'Run #{n}',
    against: 'against run #{n}',
    legendAria: 'Change since the previous run',
    firstRun: 'Change a setting and transcribe again to see what moves.',
    sameSettings: 'Same settings as the run before.',
    noNotes: 'No notes were found with these settings.',
    hover: '{note} · {start} · {length} · velocity {velocity}',
  },

  errors: {
    run: 'The transcription failed: {message}',
    audio: 'Audio playback could not start in this browser.',
  },

  guideTitle: 'Transcribe, then compare by ear',
  guideBody:
    'Press Transcribe to detect the notes in the sample piano piece, or open your own recording first. Then switch Listen between Original, Piano and Both. The piano is rendered at the recording’s loudness, so you hear the difference in notes rather than level. It all runs in your browser.',
  guideLink: 'Audio to notes',

  attribution: 'Sample: a piano piece generated with Suno.',
  sampleCredit: 'Generated with Suno',
};

export type TranscribeCopy = typeof enCopy;

export const jaCopy: TranscribeCopy = {
  title: 'ピアノ採譜',
  subtitle: 'オーディオ→MIDI · ピアノロール · 内蔵ピアノ',
  eyebrow: 'AUDIO → MIDI',
  heading: 'ピアノの録音を音符に戻す',
  intro:
    'libsonare がピアノの録音から音符を拾い出し、元の波形の真下にピアノロールとして並べ、内蔵のアコースティックピアノで鳴らし直します。検出の設定を決めて「採譜する」を押してください。2 回目からは、前回の採譜から増えた音と消えた音に印が付きます。処理はすべてブラウザの中で行います。',

  status: {
    loading: 'LOADING',
    idle: 'READY',
    transcribing: 'TRANSCRIBING',
    rendering: 'RENDERING',
    ready: 'DONE',
    playing: 'PLAYING',
    error: 'ERROR',
  },

  statusFields: {
    source: 'SRC',
    length: 'LEN',
    notes: 'NOTES',
    tempo: 'BPM',
  },

  source: {
    label: '音源',
    sample: 'サンプルのピアノ曲',
    own: '音声ファイルを開く',
    backToSample: 'サンプルに戻す',
    dropHint: 'ロールへのドロップでも開けます',
    drop: '音声ファイルをドロップして読み込む',
    loading: 'デコード中…',
    tooLong: '{max} 以内の録音を使ってください。',
    decode: 'このファイルは音声として読み込めませんでした。',
  },

  run: {
    button: '採譜する',
    running: '採譜中…',
    firstHint: 'この端末の中で処理します。アップロードはありません。',
    pending: '採譜 #{n} からの変更',
    clean: '採譜 #{n} はこの設定です。',
    sourceChanged: '新しい音源です。まだ採譜していません。',
    steps: {
      detect: '音符を検出',
      render: 'ピアノの再生音と MIDI',
    },
    stepsAria: '採譜の進み具合',
  },

  empty: {
    title: 'まだ採譜していません',
    body: '「採譜する」を押すと、この録音から見つかった音符が波形の下に並びます。',
  },

  legend: {
    wave: '原曲',
    piano: 'ピアノの再生音',
  },

  controls: {
    play: '再生',
    pause: '一時停止',
    restart: '先頭へ',
    listen: '試聴',
    listenModes: {
      source: '原曲',
      piano: 'ピアノ',
      both: '重ねる',
    },
    listenAria: '聴く音',
    zoom: 'ズーム',
    zoomAria: '時間軸のズーム',
    fit: '全体',
    download: 'MIDI を保存',
    downloadName: 'transcription.mid',
  },

  lanes: {
    rollAria:
      '同じ時間軸で、上に波形、下にピアノロール。クリックで再生位置を移動、ドラッグでスクロールします。',
  },

  detector: {
    title: '検出の設定',
    mode: '方式',
    modes: { poly: 'ポリフォニック', mono: '単旋律' },
    modeAria: '検出方式',
    modeHelp: {
      title: 'ポリフォニックと単旋律',
      body: 'ポリフォニックは multi-F0 の処理系を使い、重なって鳴る音を拾います。ピアノの演奏はこちらです。単旋律は pYIN の結果を音符に切り分ける方式で、一度に一つの高さしか追わないため、和音からは多くても一音しか残りません。',
      tip: 'この曲で単旋律に切り替えると、和音がどれだけあるかが見えます。',
    },
    polyOnly: 'ポリフォニックのみ',
    monoOnly: '単旋律のみ',
    tuning: 'チューニング',
    tuningFixed: 'A = 440 Hz',
    tuningAuto: '測定',
    tuningAria: 'チューニングの基準',
    tuningHelp: {
      title: 'チューニングの基準',
      body: 'ノート番号は A = 440 Hz を基準に決めるか、音高を追う前に音声から基準を測ってから決めます。半音の間でチューニングされた録音は、440 固定だと隣の音に寄ることがあります。',
      tip: '測った偏差は結果の欄に出ます。',
    },
    division: {
      label: '最短の音価',
      aria: '最短の音を音価で指定',
      off: 'オフ',
      help: {
        title: '最短の音価',
        body: '最短の音をミリ秒ではなく、実行時のテンポでの音価で指定します。120 BPM での 1/16 は 125 ms と同じ下限です。テンポは、この録音で最初に実行したときに検出したものを使います。音価を選んでいる間は「最短の音」ノブは使われません。',
        tip: '1/16 を選ぶと、下限が時計ではなく曲のテンポに合わせて決まります。',
      },
    },
    reset: '既定値に戻す',
    resetAria: '検出設定を既定値に戻す',
    knobsTitle: '検出の細部',
    off: 'オフ',
    knobs: {
      minNoteMs: {
        label: '最短の音',
        title: '最短の音',
        body: 'これより短い区間は音符として残さず捨てます。エンジンの既定値はポリフォニックで 60 ms、単旋律で 30 ms です。このページはポリフォニックを 120 ms から始めます。ピアノの音で試したとき、こちらのほうが楽譜との一致がよかったためです。その代わり、本当に短い音は消えます。',
        tip: '上げると細かい断片が消えます。速いパッセージも一緒に消えます。',
      },
      splitCents: {
        label: '音高の区切り',
        title: '音高の区切り',
        body: '音の高さがこのセント数だけ動いたら、そこで音符を切って次の音符を始めます。100 セントで半音です。効くのは単旋律だけで、ポリフォニックでは結果が変わりません。',
        tip: '下げると、揺れる音高が複数の音符に分かれます。',
      },
      velocityFloorDb: {
        label: 'ベロシティ下限',
        title: 'ベロシティ下限',
        body: '音符ごとのピークレベルを、この値をベロシティ 1、0 dBFS を 127 として直線で割り当てます。決めるのはベロシティだけで、この値を下回っても音は捨てません。音を捨てるのは別の判定で、録音中で最も大きな音より 36 dB 以上小さい音と、-80 dBFS 未満の音が対象です。',
        tip: '上げると、同じ音がそのまま弱く鳴ります。',
      },
      maxPolyphony: {
        label: '最大同時音数',
        title: '最大同時音数',
        body: '1 つの解析フレームが同時に持てる音の数です。',
        tip: '1 や 2 にすると、和音の内声から先に消えます。',
      },
      framePeakRatio: {
        label: 'フレーム足切り',
        title: 'フレーム内の足切り',
        body: '各フレームで、最も強いピークに対してこの割合を下回ったところで、次の音の探索を打ち切ります。0 で足切りなし。',
        tip: '上げると、大きな音の陰にある小さな音が落ちます。',
      },
      ridgePeakRatio: {
        label: '持続の足切り',
        title: '持続の足切り',
        body: '追跡中の音が、それ自身のそれまでのピークに対してこの割合を下回ったら終わらせます。0 で足切りなし。',
        tip: '上げると、減衰していくピアノの音が早めに切れます。',
      },
      reattackRatio: {
        label: '打ち直し',
        title: '打ち直しの分割',
        body: '鳴っている音の強さが直前の何倍を超えて立ち上がったら、同じ鍵盤が打ち直されたとみなして音符を二つに分けます。一番下でこの分割をしません。',
        tip: 'オフにすると、連打が一本の長い音にまとまります。',
      },
    },
    helpEyebrow: '検出',
    tipLabel: '試す',
  },

  result: {
    notes: '音符',
    kept: '変化なし',
    added: '新しく出た',
    removed: '消えた',
    voices: '最大同時発音',
    tempo: 'テンポ',
    tuning: 'チューニング',
    time: '検出時間',
    run: '採譜 #{n}',
    against: '#{n} との比較',
    legendAria: '前回の採譜からの変化',
    firstRun: '設定を変えてもう一度採譜すると、変わった音に印が付きます。',
    sameSettings: '前回と同じ設定です。',
    noNotes: 'この設定では音符が見つかりませんでした。',
    hover: '{note} · {start} · 長さ {length} · ベロシティ {velocity}',
  },

  errors: {
    run: '採譜に失敗しました: {message}',
    audio: 'このブラウザでは音声を再生できませんでした。',
  },

  guideTitle: '採譜して、聴き比べます',
  guideBody:
    'サンプルのピアノ曲に対して「採譜する」を押すか、先に手持ちの録音を開きます。続けて試聴を「原曲」「ピアノ」「重ねる」で切り替えて聴き比べます。ピアノは録音と同じラウドネスでレンダリングするので、音量ではなく音符の違いが聞こえます。処理はすべてブラウザ内で行います。',
  guideLink: 'オーディオから音符へ',

  attribution: 'サンプル音源: Suno で生成したピアノ曲',
  sampleCredit: 'Suno で生成',
};
