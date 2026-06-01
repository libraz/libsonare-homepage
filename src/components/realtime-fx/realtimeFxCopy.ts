export const enCopy = {
  title: 'Realtime Voice Changer',
  subtitle: "Mic input through libsonare's native voice-changer chain",
  localOnly: 'LOCAL ONLY',
  status: { idle: 'Idle', starting: 'Starting', ready: 'Ready', monitoring: 'Speaker on' },
  panels: {
    input: 'Input',
    presets: 'Character',
    voice: 'Voice',
    meters: 'Meters',
    safety: 'Speaker Safety',
  },
  presets: {
    'neutral-monitor': {
      label: 'Neutral Monitor',
      hint: 'Transparent monitor path — your own voice with the chain barely engaged.',
    },
    'bright-idol': {
      label: 'Bright Idol',
      hint: 'Lifts pitch and formant for a smaller, brighter, polished lead voice.',
    },
    'soft-whisper': {
      label: 'Soft Whisper',
      hint: 'Gentle lift with reduced nasality for an intimate, breathy character.',
    },
    'deep-narrator': {
      label: 'Deep Narrator',
      hint: 'Drops pitch and formant for a larger, weighty storyteller voice.',
    },
    'robot-mascot': {
      label: 'Robot Mascot',
      hint: 'High retune with bright, nasal formants for a chirpy mascot robot.',
    },
    'dark-villain': {
      label: 'Dark Villain',
      hint: 'Heavy downward shift with a big chest body for a menacing tone.',
    },
  },
  actions: {
    start: 'Start engine',
    stop: 'Stop',
    monitorOn: 'Speaker on',
    monitorOff: 'Speaker off',
  },
  controls: {
    pitch: 'Pitch',
    formant: 'Formant',
    brightness: 'Brightness',
    wet: 'Wet/Dry',
    output: 'Output',
    bypass: 'Bypass',
  },
  metrics: {
    inputPeak: 'Input Peak',
    outputPeak: 'Output Peak',
    inputRms: 'Input RMS',
    outputRms: 'Output RMS',
    latency: 'Latency',
    clip: 'Output clipped — click to reset',
  },
  help: { docs: 'Open realtime docs' },
  safety: {
    title: 'Use headphones before turning speakers on.',
    body: 'The microphone is routed to your default browser output. Speakers can feed back into the mic and become loud quickly. Speaker output starts off by default.',
  },
  errors: {
    noMicApi: 'This browser does not expose microphone input.',
    startFailed: 'Could not start the realtime audio engine.',
  },
  terms: {
    eyebrow: 'FX Term',
    tipLabel: 'How to use',
    linkLabel: 'Open glossary',
    defaultLabel: 'Default',
    items: {
      pitch: {
        title: 'Pitch Shift',
        body: 'Moves the voice up or down in semitones without changing its speed. 12 st is one octave.',
        tip: 'Layered over the chosen character. Small shifts (±2 st) stay natural; pair with formant to keep it believable.',
        default: '0 st',
      },
      formant: {
        title: 'Formant',
        body: 'Scales the resonances that define vocal character, shifting the perceived size of the speaker.',
        tip: 'Below 1 sounds larger / deeper, above 1 sounds smaller / brighter. Adjust opposite to pitch for a natural shift.',
        default: '1.00',
      },
      brightness: {
        title: 'Brightness',
        body: 'Tilts the formant balance toward darker (−) or brighter (+) tone without re-pitching the voice.',
        tip: 'Push positive for an airy, present voice; negative for a warmer, chest-heavy tone.',
        default: '0.10',
      },
      wet: {
        title: 'Wet / Dry',
        body: 'Balance between the processed (wet) signal and the untouched (dry) input inside the native chain.',
        tip: 'Blend in dry signal to keep intelligibility when the character gets extreme.',
        default: '100%',
      },
      output: {
        title: 'Output Gain',
        body: 'Final level applied before speaker output, as a percentage of unity.',
        tip: 'Trim it down if the output meter is hitting the top; loud speaker output risks feedback.',
        default: '85%',
      },
      bypass: {
        title: 'Bypass',
        body: 'Passes the dry microphone straight through, skipping the voice-changer chain.',
        tip: 'Toggle it to A/B the processed voice against the raw input.',
      },
      inputPeak: {
        title: 'Input Peak',
        body: 'Loudest incoming mic level, in dBFS. 0 dBFS is digital full scale.',
        tip: 'Keep peaks below 0 dBFS — back off the mic or input if it pins to the top.',
      },
      outputPeak: {
        title: 'Output Peak',
        body: 'Loudest processed level sent to your speaker output, in dBFS.',
        tip: 'Lower the output gain if this approaches 0 dBFS to avoid clipping and feedback.',
      },
      inputRms: {
        title: 'Input RMS',
        body: 'Average incoming mic energy in dBFS — closer to perceived loudness than peak.',
        tip: 'Aim for a steady RMS while speaking; large swings make effects react unevenly.',
      },
      outputRms: {
        title: 'Output RMS',
        body: 'Average processed energy in dBFS sent to your speaker output.',
        tip: 'Compare with input RMS to see how much the character changes perceived level.',
      },
      latency: {
        title: 'Latency',
        body: 'Round-trip delay between mic input and speaker output, in milliseconds.',
        tip: 'Lower is better for live output. The retune grain and device buffers set the floor here.',
      },
    },
  },
};

export const jaCopy: typeof enCopy = {
  title: 'リアルタイムボイスチェンジャー',
  subtitle: 'マイク入力を libsonare ネイティブのボイスチェンジャーチェーンへ',
  localOnly: 'LOCAL ONLY',
  status: { idle: '待機中', starting: '起動中', ready: '準備完了', monitoring: 'スピーカー出力中' },
  panels: {
    input: '入力',
    presets: 'キャラクター',
    voice: 'ボイス',
    meters: 'メーター',
    safety: 'スピーカー安全性',
  },
  presets: {
    'neutral-monitor': {
      label: 'ニュートラルモニター',
      hint: 'チェーンをほぼ通さない素通しモニター。自分の声をそのまま確認できます。',
    },
    'bright-idol': {
      label: 'ブライトアイドル',
      hint: 'ピッチとフォルマントを上げ、小さく明るい洗練されたリードボイスに。',
    },
    'soft-whisper': {
      label: 'ソフトウィスパー',
      hint: '軽く持ち上げつつ鼻声感を抑え、親密で息感のあるキャラクターに。',
    },
    'deep-narrator': {
      label: 'ディープナレーター',
      hint: 'ピッチとフォルマントを下げ、大きく重みのある語り手の声に。',
    },
    'robot-mascot': {
      label: 'ロボットマスコット',
      hint: '高めのリチューンと明るく鼻にかかったフォルマントで陽気なマスコットロボに。',
    },
    'dark-villain': {
      label: 'ダークヴィラン',
      hint: '大きく下げつつ胸鳴りを厚くし、威圧的なトーンに。',
    },
  },
  actions: {
    start: 'エンジン開始',
    stop: '停止',
    monitorOn: 'スピーカー ON',
    monitorOff: 'スピーカー OFF',
  },
  controls: {
    pitch: 'ピッチ',
    formant: 'フォルマント',
    brightness: 'ブライトネス',
    wet: 'Wet/Dry',
    output: '出力',
    bypass: 'バイパス',
  },
  metrics: {
    inputPeak: '入力ピーク',
    outputPeak: '出力ピーク',
    inputRms: '入力 RMS',
    outputRms: '出力 RMS',
    latency: 'レイテンシ',
    clip: '出力クリップ — クリックでリセット',
  },
  help: { docs: 'リアルタイム資料を開く' },
  safety: {
    title: 'スピーカーを ON にする前にヘッドホンを使ってください。',
    body: 'マイク音声はブラウザの既定出力へ戻ります。スピーカー出力はマイクへ回り込み、急に大きなハウリングになる場合があります。初期状態ではスピーカー OFF です。',
  },
  errors: {
    noMicApi: 'このブラウザではマイク入力を利用できません。',
    startFailed: 'リアルタイム音声エンジンを開始できませんでした。',
  },
  terms: {
    eyebrow: 'FX 用語',
    tipLabel: '使い方',
    linkLabel: '用語集を開く',
    defaultLabel: '初期値',
    items: {
      pitch: {
        title: 'ピッチシフト',
        body: '速度を変えずに声を半音単位で上下させます。12 st が 1 オクターブです。',
        tip: '選んだキャラクターに重ねて効きます。±2 st 程度なら自然で、フォルマントと組み合わせると説得力が増します。',
        default: '0 st',
      },
      formant: {
        title: 'フォルマント',
        body: '声のキャラクターを決める共鳴を伸縮させ、話者の体格感を変えます。',
        tip: '1 より下で大きく低く、上で小さく明るく聞こえます。ピッチと逆方向に動かすと自然なシフトになります。',
        default: '1.00',
      },
      brightness: {
        title: 'ブライトネス',
        body: '再ピッチせずに、フォルマントのバランスを暗め（−）／明るめ（＋）へ傾けます。',
        tip: 'プラスで空気感のある前に出る声、マイナスで暖かく胸鳴りの多いトーンになります。',
        default: '0.10',
      },
      wet: {
        title: 'Wet / Dry',
        body: 'ネイティブチェーン内での、処理後（Wet）と未処理（Dry）入力とのバランスです。',
        tip: 'キャラクターが極端なときは Dry を混ぜると明瞭度を保てます。',
        default: '100%',
      },
      output: {
        title: '出力ゲイン',
        body: 'スピーカー出力前に加える最終レベル（ユニティに対する割合）です。',
        tip: '出力メーターが上限に当たるなら下げてください。大音量のスピーカー出力はハウリングの原因になります。',
        default: '85%',
      },
      bypass: {
        title: 'バイパス',
        body: 'ボイスチェンジャーチェーンを飛ばし、ドライのマイク音をそのまま通します。',
        tip: '切り替えて、処理後の声と素の入力を A/B 比較できます。',
      },
      inputPeak: {
        title: '入力ピーク',
        body: '入ってくるマイクの最大レベル（dBFS）。0 dBFS がデジタルのフルスケールです。',
        tip: 'ピークは 0 dBFS 未満に保ちます。上限に張り付くならマイクや入力を下げてください。',
      },
      outputPeak: {
        title: '出力ピーク',
        body: 'スピーカーへ送る処理後の最大レベル（dBFS）です。',
        tip: '0 dBFS に近づいたら出力ゲインを下げ、クリップやハウリングを防ぎます。',
      },
      inputRms: {
        title: '入力 RMS',
        body: '入ってくるマイクの平均エネルギー（dBFS）。ピークより知覚ラウドネスに近い指標です。',
        tip: '話している間は RMS を安定させます。変動が大きいとエフェクトの反応がムラになります。',
      },
      outputRms: {
        title: '出力 RMS',
        body: 'スピーカーへ送る処理後の平均エネルギー（dBFS）です。',
        tip: '入力 RMS と比べると、キャラクターが体感レベルをどれだけ変えたか分かります。',
      },
      latency: {
        title: 'レイテンシ',
        body: 'マイク入力からスピーカー出力までの往復遅延（ミリ秒）です。',
        tip: 'ライブ出力では小さいほど有利です。リチューンのグレインと端末のバッファが下限を決めます。',
      },
    },
  },
};
