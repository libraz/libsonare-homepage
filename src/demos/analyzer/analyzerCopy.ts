/**
 * Copy for the visual player. Metric labels come from the shared i18n bundle
 * (`demo.panel.*`); this file holds the page text, the player's own controls and
 * messages, and the term explanations behind the info tooltips.
 */

export const enCopy = {
  page: {
    title: 'Visual Player',
    subtitle: 'Audio player with real-time chroma & spectrum visualization',
    localOnly: 'LOCAL',
    initError: 'ENGINE ERROR',
    guideTitle: 'Load a file and press play',
    guideBody:
      'Drop in an audio file and press play. The colors and bars follow the music live: chroma shows which notes are sounding, the spectrum shows where the energy sits. BPM and key are live reference values; for a full report, use Music Analysis. Everything runs in your browser.',
    guideDocs: 'Open docs',
  },
  status: {
    idle: 'No file',
    loading: 'Loading',
    ready: 'Ready',
    playing: 'Playing',
    error: 'Error',
  },
  stages: {
    starting: 'Starting signal processor',
    decoding: 'Decoding audio',
    initializing: 'Initializing analyzer',
    extracting: 'Extracting samples',
    rms: 'Computing RMS',
    beats: 'Detecting beats',
    chroma: 'Computing chroma',
    spectrogram: 'Computing spectrogram',
    finalizing: 'Finalizing',
  },
  controls: {
    rewind: 'Rewind',
    file: 'File',
    changeFile: 'Change file',
  },
  errors: {
    decode: 'Could not decode this audio file. Try a different WAV, MP3, or FLAC file.',
    processing:
      'The audio decoded, but its visualization data could not be generated. Try a shorter file.',
    init: 'The analysis engine could not be loaded. Reload the page and try again.',
  },
  eyebrow: 'Analysis',
  tipLabel: 'How to read it',
  linkLabel: 'Open glossary',
  items: {
    bpm: {
      title: 'Tempo (BPM)',
      body: 'The estimated tempo in beats per minute, with a confidence percentage. In streaming mode it locks in after a few seconds of audio.',
      tip: 'Low confidence usually means rubato, sparse percussion, or a half / double-time ambiguity.',
    },
    key: {
      title: 'Musical key',
      body: 'The estimated key and mode (major or minor), read from the chroma profile, with a confidence percentage.',
      tip: 'Modal or key-changing tracks read lower; a steady diatonic song reads high.',
    },
    pattern: {
      title: 'Chord pattern',
      body: 'The repeating chord loop voted from the bar-by-bar progression, plus the name of the matched common pattern and its match score.',
      tip: 'Pop and loop-based music locks to a clear four-chord pattern; through-composed music may not.',
    },
    timeSig: {
      title: 'Time signature',
      body: 'The beats per bar and beat unit. This streaming view leaves it unreported until a reliable downbeat-based estimate is available.',
      tip: 'A dash means the current analyzer has not produced a trustworthy meter estimate.',
    },
    duration: {
      title: 'Duration',
      body: 'Total length of the loaded audio, shown as minutes:seconds.',
      tip: 'The transport and waveform seek over this same timeline.',
    },
    rate: {
      title: 'Sample rate',
      body: 'Samples per second of the decoded audio, in kHz. Analysis runs at the browser AudioContext rate.',
      tip: '44.1 kHz and 48 kHz are the usual rates; higher rates carry more high-frequency detail.',
    },
    tuning: {
      title: 'Tuning offset',
      body: 'How far the recording sits from concert pitch (A4 = 440 Hz), in cents, estimated from the whole file when it loads. The live key and chord readings are taken against that reference, so a track tuned a quarter-tone flat still reads in its own key.',
      tip: 'A few cents either way is ordinary. Tape transfers, live acoustic takes and older recordings can sit 20 cents or more away.',
    },
    source: {
      title: 'Source file',
      body: 'The name of the audio currently loaded and analyzed. Everything is processed locally in your browser.',
      tip: 'Drop your own WAV, MP3, FLAC, or OGG to analyze it — nothing is uploaded.',
    },
    visualizer: {
      title: 'Synesthesia view',
      body: 'A live picture of the music: the rotating field maps the twelve pitch classes (chroma) to color, brightness tracks energy, and the inner/outer bands split low against high frequencies.',
      tip: 'Watch the color settle toward the tonal center and pulse with each beat as the track plays.',
    },
    waveform: {
      title: 'Waveform & seek',
      body: 'The full track amplitude over time. Click anywhere on it to move the play head to that moment.',
      tip: 'Scrub to a chorus or drop and watch how the live BPM, key, and chord estimates react.',
    },
  },
};

export const jaCopy: typeof enCopy = {
  page: {
    title: 'ビジュアルプレイヤー',
    subtitle: 'クロマ・スペクトルをリアルタイム可視化するオーディオプレイヤー',
    localOnly: 'ローカル実行',
    initError: 'エンジンエラー',
    guideTitle: '音声ファイルを読み込んで再生します',
    guideBody:
      '音声ファイルを読み込んで再生すると、色とバーが音楽に合わせてリアルタイムに動きます。クロマは鳴っている音の高さ、スペクトルはエネルギーが集まる周波数帯を示します。BPM とキーは再生中の参考値です。全体の解析は「楽曲解析」で行えます。処理はすべてブラウザ内で行います。',
    guideDocs: 'ドキュメント',
  },
  status: {
    idle: 'ファイルなし',
    loading: '読み込み中',
    ready: '準備完了',
    playing: '再生中',
    error: 'エラー',
  },
  stages: {
    starting: '信号処理を起動中',
    decoding: '音声をデコード中',
    initializing: '解析器を初期化中',
    extracting: 'サンプルを取り出し中',
    rms: 'RMS を計算中',
    beats: 'ビートを検出中',
    chroma: 'クロマを計算中',
    spectrogram: 'スペクトログラムを計算中',
    finalizing: '仕上げ中',
  },
  controls: {
    rewind: '先頭へ戻る',
    file: 'ファイル',
    changeFile: 'ファイルを変更',
  },
  errors: {
    decode:
      'この音声ファイルをデコードできませんでした。別の WAV・MP3・FLAC ファイルをお試しください。',
    processing:
      '音声はデコードできましたが、可視化データを生成できませんでした。より短いファイルをお試しください。',
    init: '解析エンジンを読み込めませんでした。ページを再読み込みしてからもう一度お試しください。',
  },
  eyebrow: '解析',
  tipLabel: '読み方',
  linkLabel: '用語集を開く',
  items: {
    bpm: {
      title: 'テンポ（BPM）',
      body: '推定テンポ（BPM）と信頼度です。ストリーミングモードでは数秒の音声を受け取ると値が確定します。',
      tip: '信頼度が低いときは、ルバート、打楽器が少ない、または倍／半テンポの曖昧さが原因のことが多いです。',
    },
    key: {
      title: '調（キー）',
      body: 'クロマプロファイルから推定した調とモード（長調／短調）と、その信頼度です。',
      tip: 'モーダルな曲や転調する曲は低めに、安定したダイアトニックな曲は高めに出ます。',
    },
    pattern: {
      title: 'コードパターン',
      body: '小節ごとの進行から投票で選ばれた繰り返しのコードループと、一致した代表的パターンの名前・一致スコアです。',
      tip: 'ポップスやループ主体の曲は明確な 4 コードパターンに収束します。通作形式の曲は収束しないこともあります。',
    },
    timeSig: {
      title: '拍子',
      body: '1 小節あたりの拍数と拍の単位です。信頼できるダウンビート推定が得られるまでは未解析として表示します。',
      tip: 'ダッシュ表示は、現在の解析器が信頼できる拍子をまだ算出していないことを示します。',
    },
    duration: {
      title: '長さ',
      body: '読み込んだ音声の総再生時間で、分:秒 で表示します。',
      tip: 'トランスポートと波形は同じタイムライン上をシークします。',
    },
    rate: {
      title: 'サンプルレート',
      body: 'デコードした音声の 1 秒あたりのサンプル数（kHz）です。解析はブラウザの AudioContext のレートで実行されます。',
      tip: '通常は 44.1 kHz と 48 kHz が一般的で、レートが高いほど高域の情報を多く含みます。',
    },
    tuning: {
      title: 'チューニングのずれ',
      body: '録音が標準ピッチ（A4 = 440 Hz）から何セントずれているかです。読み込んだときにファイル全体から推定します。ライブのキーとコードはこの基準ピッチで読むので、4 分の 1 音低く調律された曲でも本来のキーで表示されます。',
      tip: '数セントのずれはよくあります。テープから起こした音源、アコースティックのライブ録音、古い録音では 20 セント以上ずれていることがあります。',
    },
    source: {
      title: 'ソースファイル',
      body: '現在読み込んで解析している音声の名前です。すべての処理はブラウザ内でローカルに行われます。',
      tip: '自分の WAV・MP3・FLAC・OGG をドロップして解析できます。アップロードはされません。',
    },
    visualizer: {
      title: 'シナスタジア表示',
      body: '音楽をリアルタイムに描いた図です。回転するフィールドは 12 のピッチクラス（クロマ）を色に対応させ、明るさはエネルギー、内側／外側の帯は低域と高域を表します。',
      tip: '再生に合わせて色が調性の中心に寄り、ビートごとに脈打つ様子を見てみてください。',
    },
    waveform: {
      title: '波形とシーク',
      body: '楽曲全体の振幅を時間軸で表したものです。どこをクリックしても再生ヘッドがその位置へ移動します。',
      tip: 'サビやドロップへスクラブして、ライブの BPM・キー・コード推定がどう反応するか見てみましょう。',
    },
  },
};

/** Help-tooltip term keys, derived from the English copy. */
export type AnalyzerTermKey = keyof typeof enCopy.items;

/**
 * Glossary slug each term deep-links to (relative to `/docs/glossary/`).
 * `undefined` terms still show a tooltip but render no docs link.
 */
export const ANALYZER_TERM_SLUGS: Record<AnalyzerTermKey, string | undefined> = {
  bpm: 'analysis/tempo-bpm',
  key: 'analysis/key-detection',
  pattern: 'analysis/chord-recognition',
  timeSig: 'analysis/beats-downbeats',
  duration: undefined,
  rate: 'concepts/audio-basics',
  tuning: 'analysis/chroma-features',
  source: 'concepts/browser-local-processing',
  visualizer: 'analysis/chroma-features',
  waveform: undefined,
};
