import type { RoomGeometry } from '@/workers/spatial.worker';

export type PresetId = 'studio' | 'liveRoom' | 'hall' | 'cathedral' | 'bedroom';

/** Built-in rooms. Synthesized into a deterministic RIR, then estimated back so the
 *  scene can compare the blind estimate against the known ("truth") geometry. */
export const PRESET_ORDER: PresetId[] = ['bedroom', 'studio', 'liveRoom', 'hall', 'cathedral'];

export const PRESET_GEOMETRY: Record<PresetId, RoomGeometry> = {
  bedroom: {
    lengthM: 4.2,
    widthM: 3.2,
    heightM: 2.5,
    absorption: 0.32,
    sourceX: 1.0,
    sourceY: 0.8,
    sourceZ: 1.2,
    listenerX: 3.2,
    listenerY: 2.4,
    listenerZ: 1.5,
  },
  studio: {
    lengthM: 6.5,
    widthM: 4.8,
    heightM: 3.0,
    absorption: 0.26,
    sourceX: 1.4,
    sourceY: 1.2,
    sourceZ: 1.4,
    listenerX: 4.8,
    listenerY: 3.4,
    listenerZ: 1.5,
  },
  liveRoom: {
    lengthM: 10.0,
    widthM: 7.0,
    heightM: 3.6,
    absorption: 0.17,
    sourceX: 2.0,
    sourceY: 1.6,
    sourceZ: 1.6,
    listenerX: 7.4,
    listenerY: 5.0,
    listenerZ: 1.6,
  },
  hall: {
    lengthM: 24.0,
    widthM: 16.0,
    heightM: 12.0,
    absorption: 0.11,
    sourceX: 5.0,
    sourceY: 8.0,
    sourceZ: 2.0,
    listenerX: 17.0,
    listenerY: 8.0,
    listenerZ: 1.7,
  },
  cathedral: {
    lengthM: 34.0,
    widthM: 20.0,
    heightM: 24.0,
    absorption: 0.07,
    sourceX: 6.0,
    sourceY: 10.0,
    sourceZ: 2.2,
    listenerX: 24.0,
    listenerY: 10.0,
    listenerZ: 1.7,
  },
};

export const enCopy = {
  title: 'Spatial Room Scanner',
  subtitle: 'Estimate room geometry & source distance in 3D from one recording',
  localOnly: 'LOCAL ONLY',
  status: {
    idle: 'Idle',
    decoding: 'Decoding',
    scanning: 'Scanning',
    ready: 'Scan complete',
    error: 'Error',
  },
  panels: {
    input: 'Source',
    rooms: 'Sample Rooms',
    scene: '3D Reconstruction',
    geometry: 'Estimated Room',
    acoustics: 'Acoustic Profile',
    bands: 'Per-Band Decay',
    legend: 'Scene Legend',
  },
  actions: {
    drop: 'Drop a recording or click to browse',
    dropHint: 'WAV · FLAC · MP3 · OGG — a clap, balloon pop, or sweep gives the cleanest estimate',
    irToggle: 'Treat as impulse response',
    irHint: 'On for a clean clap / pop / sweep. Off for ordinary music or speech (blind estimate).',
    rescan: 'Rescan',
    clear: 'Clear',
    morph: 'Morph demo through room',
    morphUpload: 'Morph upload through room',
    morphing: 'Morphing...',
  },
  rooms: {
    bedroom: {
      label: 'Bedroom',
      hint: 'Small, well-damped room — short tail, clear direct sound.',
    },
    studio: {
      label: 'Project Studio',
      hint: 'Treated mid-size room with a controlled, tight decay.',
    },
    liveRoom: {
      label: 'Live Room',
      hint: 'Reflective tracking room with an audible, lively tail.',
    },
    hall: {
      label: 'Concert Hall',
      hint: 'Large reverberant hall — long RT60, distant source feel.',
    },
    cathedral: { label: 'Cathedral', hint: 'Cavernous stone space with a very long, washy decay.' },
  },
  scene: {
    placeholder: 'Pick a sample room or drop a recording to reconstruct the space.',
    autoRotate: 'Auto-rotate',
    drag: 'Drag to orbit · scroll to zoom',
    truth: 'Ground truth',
    estimate: 'Estimate',
  },
  audio: {
    dropTitle: 'Drop a recording',
    dropHint: 'or click to browse',
    formats: 'WAV FLAC MP3 OGG',
    impulse: 'Impulse response',
    morphed: 'Room-morphed audio',
  },
  legend: {
    room: 'Estimated walls',
    listener: 'Listener / mic',
    source: 'Estimated source',
    shell: 'Source-distance shell',
    critical: 'Critical distance',
    truthRoom: 'True room (preset)',
    truthSource: 'True source (preset)',
  },
  metrics: {
    dimensions: 'Dimensions',
    volume: 'Volume',
    rt60: 'RT60',
    edt: 'EDT',
    c50: 'C50',
    c80: 'C80',
    d50: 'D50',
    drr: 'DRR',
    sourceDistance: 'Source distance',
    criticalDistance: 'Critical distance',
    confidence: 'Confidence',
    mode: 'Mode',
    modeIr: 'Impulse response',
    modeBlind: 'Blind estimate',
  },
  bands: {
    freq: 'Band',
    rt60: 'RT60 (s)',
    absorption: 'Absorption',
    hz: 'Hz',
  },
  guide: {
    title: 'How the estimate works',
    body: 'libsonare solves an inverse acoustics problem: from the decay tail it estimates an equivalent shoebox room (volume, dimensions, per-band absorption) and the direct-to-reverberant ratio. The DRR plus the critical distance places the source at an estimated distance — a single channel reveals how far, not which direction, so the source is drawn as a full shell around the listener.',
    docs: 'Room Acoustics docs',
  },
  notes: {
    blind:
      'Blind estimate from ordinary audio — useful for ranking and visualization, not an architectural measurement. A single channel resolves one equivalent source distance, so multiple talkers or instruments collapse into a single source.',
    lowConfidence:
      'Low confidence: no clean decay region was found. Try an impulse-response recording (clap / pop / sweep).',
    truth:
      'This room was synthesized from known geometry, then estimated back — compare the estimate to the ground truth.',
    invalid:
      'No clear room or decay was found in this recording. Room estimation needs audible reverberation — pick a sample room, or upload an impulse response (a clap, balloon pop, or sweep).',
    morph:
      'Room morph renders the playable audio through the estimated shoebox model. It is a creative audition of the room, not a corrective dereverb pass.',
  },
  errors: {
    decode: 'Could not decode this audio file. Try WAV, FLAC, MP3, or OGG.',
    scan: 'Scan failed.',
    morph: 'Room morph failed.',
  },
  help: { docs: 'Open docs' },
};

export const jaCopy: typeof enCopy = {
  title: '空間ルームスキャナー',
  subtitle: '1 本の録音から部屋の形状と音源までの距離を 3D 推定',
  localOnly: 'ローカル処理',
  status: {
    idle: '待機中',
    decoding: 'デコード中',
    scanning: 'スキャン中',
    ready: 'スキャン完了',
    error: 'エラー',
  },
  panels: {
    input: '音源',
    rooms: 'サンプルルーム',
    scene: '3D 再構成',
    geometry: '推定された部屋',
    acoustics: '音響プロファイル',
    bands: '帯域別の減衰',
    legend: 'シーンの凡例',
  },
  actions: {
    drop: '録音をドロップ、またはクリックして選択',
    dropHint: 'WAV・FLAC・MP3・OGG — 拍手・風船の破裂音・スイープが最も高精度です',
    irToggle: 'インパルス応答として扱う',
    irHint: 'クリーンな拍手・破裂音・スイープなら ON。通常の音楽や音声なら OFF（ブラインド推定）。',
    rescan: '再スキャン',
    clear: 'クリア',
    morph: 'デモ音源をこの部屋に通す',
    morphUpload: 'アップロード音源をこの部屋に通す',
    morphing: 'モーフ中...',
  },
  rooms: {
    bedroom: { label: '寝室', hint: '小さく吸音の効いた部屋。残響が短く直接音が明瞭。' },
    studio: {
      label: 'プロジェクトスタジオ',
      hint: '音響処理された中規模の部屋。タイトで制御された減衰。',
    },
    liveRoom: {
      label: 'ライブルーム',
      hint: '反射の多い録音用の部屋。生き生きとした残響が聞こえる。',
    },
    hall: {
      label: 'コンサートホール',
      hint: '大きく残響豊かなホール。長い RT60 で音源が遠く感じる。',
    },
    cathedral: { label: '大聖堂', hint: '石造りの広大な空間。非常に長く広がる残響。' },
  },
  scene: {
    placeholder: 'サンプルルームを選ぶか録音をドロップすると空間を再構成します。',
    autoRotate: '自動回転',
    drag: 'ドラッグで回転・スクロールでズーム',
    truth: '正解値',
    estimate: '推定値',
  },
  audio: {
    dropTitle: '録音をドロップ',
    dropHint: 'またはクリックして選択',
    formats: 'WAV FLAC MP3 OGG',
    impulse: 'インパルス応答',
    morphed: 'ルームモーフ済み音声',
  },
  legend: {
    room: '推定された壁',
    listener: 'リスナー / マイク',
    source: '推定された音源',
    shell: '音源距離シェル',
    critical: '臨界距離',
    truthRoom: '実際の部屋（プリセット）',
    truthSource: '実際の音源（プリセット）',
  },
  metrics: {
    dimensions: '寸法',
    volume: '容積',
    rt60: 'RT60',
    edt: 'EDT',
    c50: 'C50',
    c80: 'C80',
    d50: 'D50',
    drr: 'DRR',
    sourceDistance: '音源までの距離',
    criticalDistance: '臨界距離',
    confidence: '信頼度',
    mode: 'モード',
    modeIr: 'インパルス応答',
    modeBlind: 'ブラインド推定',
  },
  bands: {
    freq: '帯域',
    rt60: 'RT60 (秒)',
    absorption: '吸音率',
    hz: 'Hz',
  },
  guide: {
    title: '推定の仕組み',
    body: 'libsonare は逆問題として音響を解きます。減衰の尾から等価なシューボックス型の部屋（容積・寸法・帯域別の吸音率）と直接音／残響音比（DRR）を推定します。DRR と臨界距離から音源までの距離を求めますが、1 チャンネルでは「どれだけ遠いか」は分かっても「どの方向か」は分からないため、音源はリスナーを囲むシェルとして描画されます。',
    docs: 'ルーム音響のドキュメント',
  },
  notes: {
    blind:
      '通常の音声からのブラインド推定です。比較や可視化には有用ですが、建築的な測定値ではありません。1 チャンネルでは音源までの等価距離を 1 つだけ求めるため、複数の話者や楽器は 1 つの音源として扱われます。',
    lowConfidence:
      '信頼度が低い状態です。クリーンな減衰領域が見つかりませんでした。インパルス応答の録音（拍手・破裂音・スイープ）をお試しください。',
    truth:
      'この部屋は既知の形状から合成し、それを逆推定したものです。推定値と正解値を比べてみてください。',
    invalid:
      'この録音からは明確な部屋の響きや減衰を検出できませんでした。ルーム推定には聞き取れる残響が必要です。サンプルルームを選ぶか、インパルス応答（拍手・風船の破裂音・スイープ）をアップロードしてください。',
    morph:
      'ルームモーフは、再生対象の音声を推定されたシューボックスモデルの部屋に通してレンダーします。補正用のデリバーブではなく、部屋の響きを試聴するためのクリエイティブ処理です。',
  },
  errors: {
    decode: 'この音声ファイルをデコードできませんでした。WAV・FLAC・MP3・OGG をお試しください。',
    scan: 'スキャンに失敗しました。',
    morph: 'ルームモーフに失敗しました。',
  },
  help: { docs: 'ドキュメントを開く' },
};
