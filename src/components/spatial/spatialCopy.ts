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
  terms: {
    eyebrow: 'Acoustics',
    tipLabel: 'How to read it',
    linkLabel: 'Open glossary',
    items: {
      dimensions: {
        title: 'Dimensions',
        body: 'The estimated length × width × height of an equivalent shoebox room, in meters. It reproduces the measured decay, not the literal floor plan.',
        tip: 'On preset rooms, compare against the ground truth to see how close the blind estimate lands.',
      },
      volume: {
        title: 'Volume',
        body: 'Enclosed volume of the estimated room in cubic meters, derived from the dimensions. Larger volumes decay more slowly.',
        tip: 'Big volume plus low absorption is what gives halls their long tails.',
      },
      sourceDistance: {
        title: 'Source distance',
        body: 'Estimated distance from the listener/mic to the source, in meters. One channel reveals how far, not which direction — so it is drawn as a shell around the listener.',
        tip: 'Driven mainly by the direct-to-reverberant ratio: a drier direct sound reads as closer.',
      },
      criticalDistance: {
        title: 'Critical distance',
        body: 'The distance at which the direct sound and the reverberant field are equally loud. Beyond it, the room dominates what you hear.',
        tip: 'A source past critical distance gives a washy, room-heavy recording.',
      },
      drr: {
        title: 'Direct-to-reverberant ratio',
        body: 'The level of the direct sound relative to the reverberant tail, in dB. Higher means closer and drier; lower means more distant, more room.',
        tip: 'DRR is the main cue behind the source-distance estimate.',
      },
      mode: {
        title: 'Estimation mode',
        body: 'Impulse response uses a clean clap, pop, or sweep directly. Blind estimate infers the room from ordinary music or speech — useful for ranking, not architectural measurement.',
        tip: 'Toggle "Treat as impulse response" to switch how an uploaded file is analyzed.',
      },
      rt60: {
        title: 'RT60',
        body: "Reverberation time: how long the tail takes to decay by 60 dB after the sound stops, in seconds. The headline measure of a room's liveness.",
        tip: 'Short RT60 reads as a treated, intimate room; long RT60 as a large, reflective space.',
      },
      edt: {
        title: 'Early decay time',
        body: 'Decay measured over the first 10 dB and scaled to 60 dB, in seconds. It tracks the perceived reverberance of the early field better than RT60.',
        tip: 'EDT well below RT60 hints at strong early reflections over a longer late tail.',
      },
      c50: {
        title: 'Clarity (C50)',
        body: 'The energy ratio of the first 50 ms to everything after, in dB. A speech-clarity measure — higher is more intelligible.',
        tip: 'Aim high for spoken word; low C50 smears consonants.',
      },
      c80: {
        title: 'Clarity (C80)',
        body: 'The energy ratio of the first 80 ms to the rest, in dB. The music counterpart of C50 — higher is more articulate, lower more blended.',
        tip: 'Concert halls balance C80 so music stays clear without sounding dry.',
      },
      d50: {
        title: 'Definition (D50)',
        body: 'The fraction of energy arriving within the first 50 ms, as a percentage. Closely related to C50 and speech definition.',
        tip: 'Higher D50 means a clearer, more direct-sounding room.',
      },
      confidence: {
        title: 'Confidence',
        body: 'How reliable the estimate is, from the quality of the decay region found. Clean impulse responses score high; noisy or reverb-light material scores low.',
        tip: 'Below about 35% the estimate is rough — try an impulse-response recording (clap, pop, sweep).',
      },
      band: {
        title: 'Per-band decay',
        body: 'RT60 measured separately in frequency bands. Real rooms absorb highs faster than lows, so the tail is rarely uniform across the spectrum.',
        tip: 'A steep high-band rolloff means soft, absorptive surfaces; flat bands mean hard, reflective ones.',
      },
      absorption: {
        title: 'Absorption',
        body: "The estimated fraction of sound energy each band loses per reflection, as a percentage. Higher absorption shortens that band's RT60.",
        tip: 'Bright, reflective rooms show low absorption; damped rooms show high.',
      },
    },
  },
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
  terms: {
    eyebrow: '音響',
    tipLabel: '読み方',
    linkLabel: '用語集を開く',
    items: {
      dimensions: {
        title: '寸法',
        body: '測定された減衰を再現する等価なシューボックス型の部屋の、奥行き × 幅 × 高さ（メートル）です。実際の間取りそのものではありません。',
        tip: 'プリセットの部屋では正解値と比べて、ブラインド推定の精度を確認できます。',
      },
      volume: {
        title: '容積',
        body: '寸法から求めた推定室の容積（立方メートル）です。容積が大きいほど減衰はゆっくりになります。',
        tip: '大きな容積と低い吸音率の組み合わせが、ホール特有の長い残響を生みます。',
      },
      sourceDistance: {
        title: '音源までの距離',
        body: 'リスナー／マイクから音源までの推定距離（メートル）です。1 チャンネルでは「どれだけ遠いか」は分かっても「どの方向か」は分からないため、リスナーを囲むシェルとして描かれます。',
        tip: '主に直接音／残響音比で決まります。直接音が乾いているほど近いと判断されます。',
      },
      criticalDistance: {
        title: '臨界距離',
        body: '直接音と残響音場が同じ大きさになる距離です。これを超えると、聞こえる音は部屋の響きが支配的になります。',
        tip: '音源が臨界距離より遠いと、残響に埋もれた録音になりやすくなります。',
      },
      drr: {
        title: '直接音／残響音比（DRR）',
        body: '残響の尾に対する直接音のレベル（dB）です。高いほど近く乾いた音、低いほど遠く部屋の響きが多い音になります。',
        tip: 'DRR は音源距離推定の主要な手がかりです。',
      },
      mode: {
        title: '推定モード',
        body: 'インパルス応答はクリーンな拍手・破裂音・スイープをそのまま使います。ブラインド推定は通常の音楽や音声から部屋を推測するもので、比較には有用ですが建築的な測定値ではありません。',
        tip: '「インパルス応答として扱う」を切り替えると、アップロード音源の解析方法が変わります。',
      },
      rt60: {
        title: 'RT60',
        body: '残響時間。音が止まってから尾が 60 dB 減衰するまでの時間（秒）で、部屋の響きの豊かさを表す代表的な指標です。',
        tip: '短い RT60 は音響処理された親密な部屋、長い RT60 は大きく反射の多い空間を示します。',
      },
      edt: {
        title: '初期減衰時間（EDT）',
        body: '最初の 10 dB の減衰から測り 60 dB に換算した時間（秒）です。初期音場の体感的な残響感は RT60 より EDT のほうがよく表します。',
        tip: 'EDT が RT60 より大きく短い場合、強い初期反射と長い後部残響が示唆されます。',
      },
      c50: {
        title: '明瞭度（C50）',
        body: '最初の 50 ms とそれ以降のエネルギー比（dB）です。音声明瞭度の指標で、高いほど聞き取りやすくなります。',
        tip: '話し言葉では高めを狙います。C50 が低いと子音がにじみます。',
      },
      c80: {
        title: '明瞭度（C80）',
        body: '最初の 80 ms とそれ以降のエネルギー比（dB）です。C50 の音楽版で、高いほど分離がよく、低いほど溶け合った響きになります。',
        tip: 'コンサートホールは、乾きすぎず明瞭さを保つよう C80 を整えています。',
      },
      d50: {
        title: '明瞭度（D50）',
        body: '最初の 50 ms に到達するエネルギーの割合（パーセント）です。C50 や音声の明瞭さと密接に関係します。',
        tip: 'D50 が高いほど、明瞭で直接音の強い部屋になります。',
      },
      confidence: {
        title: '信頼度',
        body: '見つかった減衰領域の質から求めた推定の信頼度です。クリーンなインパルス応答は高く、ノイズが多い・残響の乏しい素材は低くなります。',
        tip: '約 35% を下回ると推定は粗くなります。インパルス応答の録音（拍手・破裂音・スイープ）をお試しください。',
      },
      band: {
        title: '帯域別の減衰',
        body: '周波数帯域ごとに測った RT60 です。実際の部屋は低域より高域を速く吸音するため、尾はスペクトル全体で一様にはなりません。',
        tip: '高域が急に落ちるほど柔らかく吸音性の高い面、各帯域が平坦なほど硬く反射的な面を示します。',
      },
      absorption: {
        title: '吸音率',
        body: '各帯域が 1 回の反射で失う音響エネルギーの推定割合（パーセント）です。吸音率が高いほどその帯域の RT60 は短くなります。',
        tip: '明るく反射的な部屋は低く、吸音の効いた部屋は高くなります。',
      },
    },
  },
};

/** Help-tooltip term keys, derived from the English copy. */
export type SpatialTermKey = keyof typeof enCopy.terms.items;

/**
 * Glossary slug each term deep-links to (relative to `/docs/glossary/`).
 * Room-acoustic terms are grouped into a handful of pages, so several keys
 * intentionally point at the same guide.
 */
export const SPATIAL_TERM_SLUGS: Record<SpatialTermKey, string | undefined> = {
  dimensions: 'acoustics/room-geometry',
  volume: 'acoustics/room-geometry',
  sourceDistance: 'acoustics/source-distance',
  criticalDistance: 'acoustics/source-distance',
  drr: 'acoustics/source-distance',
  mode: 'acoustics/inverse-estimation',
  rt60: 'acoustics/reverberation-time',
  edt: 'acoustics/reverberation-time',
  c50: 'acoustics/clarity-definition',
  c80: 'acoustics/clarity-definition',
  d50: 'acoustics/clarity-definition',
  confidence: 'acoustics/inverse-estimation',
  band: 'acoustics/absorption-bands',
  absorption: 'acoustics/absorption-bands',
};
