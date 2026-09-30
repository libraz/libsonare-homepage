/**
 * Everything the step bass instrument puts on screen, in both languages.
 *
 * The panel legends are a separate table because they are not translated: the
 * silkscreen names circuit roles, and a role reads the same on any bench. The
 * prose beside it — what a knob does, why a flag is unavailable on one step —
 * is what changes language.
 *
 * `{n}` and `{a}`/`{b}` are filled in by the component that shows the string.
 */

/** Panel legends. English in every locale, by the same decision the README states. */
export const SILKSCREEN = {
  designation: 'SB-1',
  tagline: 'MONO BASS / 16 STEPS',

  // Control strip sections, in signal order.
  oscillator: 'OSCILLATOR',
  envelope: 'ENVELOPE',

  // Knobs, in signal order: oscillator, filter, envelope, output.
  vco: 'VCO',
  saw: 'SAW',
  square: 'SQUARE',
  tuning: 'TUNING',
  cutoff: 'CUTOFF',
  resonance: 'RESONANCE',
  envMod: 'ENV MOD',
  decay: 'DECAY',
  accent: 'ACCENT',
  tempo: 'TEMPO',
  volume: 'VOLUME',

  // Sequencer lanes.
  note: 'NOTE',
  gate: 'GATE',
  slide: 'SLIDE',

  // Transport, readout and meters.
  run: 'RUN',
  stop: 'STOP',
  step: 'STEP',
  pattern: 'PATTERN',
  sequencer: 'SEQUENCER',
  peak: 'PEAK',

  // Views.
  scope: 'SCOPE',
  filter: 'FILTER',
  output: 'OUTPUT',
} as const;

/** Help for one control: what it does, and the caveat worth knowing about it. */
export interface KnobHelp {
  title: string;
  body: string;
  tip?: string;
}

export type KnobHelpKey =
  | 'vco'
  | 'tuning'
  | 'cutoff'
  | 'resonance'
  | 'envMod'
  | 'decay'
  | 'accent'
  | 'tempo'
  | 'volume';

const enKnobs: Record<KnobHelpKey, KnobHelp> = {
  vco: {
    title: 'Oscillator shape',
    body: 'One oscillator, sawtooth or square. The sawtooth carries every harmonic, so it has more for the filter to work on; the square is hollower and reads as an octave lower to some ears.',
    tip: 'A waveform change lands at the next step that strikes a note, so it never cuts a sounding note in half.',
  },
  tuning: {
    title: 'Tuning',
    body: 'Shifts the whole pattern by up to nine semitones in either direction, without touching the notes you wrote.',
  },
  cutoff: {
    title: 'Filter cutoff',
    body: 'Where the lowpass starts working. The envelope opens above this point and falls back to it, so this is the floor of every sweep rather than a fixed brightness.',
    tip: 'The audible corner sits below this reading, further below at low resonance. The FILTER display approximates the response from measured curves.',
  },
  resonance: {
    title: 'Resonance',
    body: 'Lifts a peak at the corner. It also sets how much brighter an accented step is than a plain one, the way the two ends of one shared control would.',
  },
  envMod: {
    title: 'Envelope amount',
    body: 'How far above the cutoff each note opens, in cents. At zero the filter never moves and the pattern is one flat timbre.',
  },
  decay: {
    title: 'Filter decay',
    body: 'How long the filter takes to fall back to the cutoff. The amplitude envelope is a gate and does not follow it — the note length alone shapes the loudness.',
    tip: 'An accented step overrides this with a short decay of its own.',
  },
  accent: {
    title: 'Accent amount',
    body: 'Scales every accent effect at once: the extra velocity, the brightness against the plain steps, and the forced short decay. At zero an accented step is a plain step.',
  },
  tempo: {
    title: 'Tempo',
    body: 'The transport keeps its position across a tempo change, so the pattern speeds up where it already was rather than restarting.',
  },
  volume: {
    title: 'Output level',
    body: 'The master fader, ahead of a true-peak limiter at -1 dBTP. The limiter holds the ceiling, so this sets how hard the pattern is driven into it.',
  },
};

const jaKnobs: Record<KnobHelpKey, KnobHelp> = {
  vco: {
    title: 'オシレータの波形',
    body: 'オシレータは 1 基、ノコギリ波か矩形波です。ノコギリ波は倍音が揃っているぶんフィルタの効きしろが大きく、矩形波は中身が抜けた響きで、1 オクターブ低く聴こえることもあります。',
    tip: '波形の切り替えは、次に音を打ち直すステップの境目で反映されます。鳴っている音を途中で断ち切りません。',
  },
  tuning: {
    title: 'チューニング',
    body: '書いた音符はそのままに、パターン全体を上下 9 半音まで移します。',
  },
  cutoff: {
    title: 'フィルタのカットオフ',
    body: 'ローパスが効きはじめる位置です。エンベロープはここより上へ開いてここへ戻るので、固定の明るさというより、掃引の下限にあたります。',
    tip: '聴こえる折れ点はこの数値より下にあり、レゾナンスが低いほど下がります。FILTER の画面は、実測した特性に基づく近似を描いています。',
  },
  resonance: {
    title: 'レゾナンス',
    body: '折れ点に山を立てます。アクセントの付いたステップが通常のステップよりどれだけ明るくなるかも、ここで決まります。1 つのつまみが 2 つの役目を兼ねています。',
  },
  envMod: {
    title: 'エンベロープ量',
    body: '1 音ごとにカットオフの何セント上まで開くかを決めます。ゼロならフィルタは動かず、パターンは平坦な 1 つの音色になります。',
  },
  decay: {
    title: 'フィルタのディケイ',
    body: 'フィルタがカットオフまで戻る時間です。アンプ側のエンベロープはゲートなのでこれに追随せず、音量の輪郭は音符の長さだけが決めます。',
    tip: 'アクセントの付いたステップは、この値を無視して自前の短いディケイになります。',
  },
  accent: {
    title: 'アクセント量',
    body: 'アクセントの 3 つの効果 — ベロシティの上乗せ、通常ステップに対する明るさの差、ディケイの強制短縮 — をまとめて増減します。ゼロならアクセントのステップは通常のステップと同じです。',
  },
  tempo: {
    title: 'テンポ',
    body: 'テンポを変えてもトランスポートは位置を保つので、頭から鳴り直すのではなく、いまいる場所のまま速さが変わります。',
  },
  volume: {
    title: '出力レベル',
    body: 'マスターフェーダーで、この後ろに -1 dBTP の真のピークリミッタがあります。天井はリミッタが押さえるので、ここで決まるのはリミッタへの突っ込み具合です。',
  },
};

export const enCopy = {
  title: 'Step Bass',
  subtitle: 'Sixteen steps, one voice, nothing on the panel that does not move the sound',
  localOnly: 'LOCAL',

  guideTitle: 'The sequencer runs inside the audio thread',
  guideBody:
    'Nothing is uploaded and nothing is pre-rendered. The engine holds the pattern and the transport, so a turn of CUTOFF, RESONANCE or ENV MOD reaches the note already sounding.',
  guideLink: 'Read about the synthesizer',

  sections: {
    controls: 'Sound controls',
    transport: 'Transport',
    sequencer: 'Step sequencer',
    views: 'Displays',
  },

  help: {
    eyebrow: 'Control',
    tipLabel: 'Try',
  },

  knobs: enKnobs,

  transport: {
    run: 'Start the sequencer',
    stop: 'Stop the sequencer',
    gesture: 'Press RUN to start the audio engine.',
    randomise: 'Randomise',
    randomiseLabel: 'Replace the pattern with a generated one',
    patterns: 'Patterns',
    patternsLabel: 'Load a pattern',
    custom: 'Edited',
    exportWav: 'WAV',
    exportWavLabel: 'Download one loop as a WAV file',
    exportMidi: 'MIDI',
    exportMidiLabel: 'Download the pattern as a MIDI file',
    exporting: 'Rendering…',
    exportFailed: 'The download could not be rendered.',
  },

  status: {
    booting: 'Starting',
    stopped: 'Stopped',
    running: 'Running',
    suspended: 'Waiting for RUN',
    unsupported: 'This browser has no Web Audio support, so the instrument cannot run here.',
    failed: 'The audio engine stopped. Reload the page to start it again.',
  },

  grid: {
    label: 'Step sequencer, sixteen steps',
    bank: 'Steps {a} to {b}',
    ruler: 'Step',
    step: 'Step {n}',
    cell: 'Step {n}, {lane}',
    keyHint:
      'Arrow keys move between cells. Space changes the cell under the cursor; on a note cell, plus and minus move the pitch by a semitone and Page Up and Page Down by an octave.',
    lanes: {
      note: 'note',
      gate: 'gate',
      accent: 'accent',
      slide: 'slide',
    },
    gates: {
      note: 'Strike',
      tie: 'Hold',
      rest: 'Rest',
    },
    gateHelp: 'Strike plays a new note, hold extends the one before it, rest is silence.',
    on: 'on',
    off: 'off',
    unavailable: 'unavailable',
    accentUnavailable:
      'Accent needs a struck note. A hold extends the note before it and a rest has none, so neither one latches a velocity.',
    slideUnavailable: 'A rest has no note to glide from.',
    slideInert: 'This slide does nothing until the next step strikes a note.',
    slidePitchOnly:
      'On the last step the slide moves pitch only: the loop releases the sounding voice as it wraps, so step 1 starts its envelope again.',
    pitchOnlyBadge: 'pitch only',
    inspector: 'Selected step',
    pitch: 'Pitch',
    pitchDown: 'Down a semitone',
    pitchUp: 'Up a semitone',
    pitchUnavailable: 'Only a struck note carries a pitch of its own.',
    nextGate: 'Change the gate',
    toggleAccent: 'Turn the accent on or off',
    toggleSlide: 'Turn the slide on or off',
  },

  views: {
    switcher: 'Display',
    scope: {
      caption: 'Output waveform over the spectrum, tapped after the master chain.',
    },
    filter: {
      caption:
        'Measurement-based approximation, interpolated from rendered noise responses. At low resonance the audible corner sits well below the number on the knob.',
      corner: 'Corner',
      envOpen: 'Envelope open',
      axisDb: 'dB',
    },
    output: {
      caption: 'Output peak after the master fader and its true-peak limiter at -1 dBTP.',
      ceiling: 'Ceiling',
      rate: 'Rate',
    },
  },
};

export const jaCopy: typeof enCopy = {
  title: 'ステップベース',
  subtitle: '16 ステップ、1 ボイス。パネルに音が変わらないつまみはありません',
  localOnly: 'ローカル',

  guideTitle: 'シーケンサーはオーディオスレッドの中で回っています',
  guideBody:
    'アップロードも事前レンダリングもありません。パターンもトランスポートもエンジン側で管理しているので、CUTOFF・RESONANCE・ENV MOD を回すと、いま鳴っている音がその場で変わります。',
  guideLink: 'シンセサイザーについて読む',

  sections: {
    controls: '音づくりのつまみ',
    transport: 'トランスポート',
    sequencer: 'ステップシーケンサー',
    views: 'ディスプレイ',
  },

  help: {
    eyebrow: 'コントロール',
    tipLabel: '試す',
  },

  knobs: jaKnobs,

  transport: {
    run: 'シーケンサーを再生',
    stop: 'シーケンサーを停止',
    gesture: 'RUN を押すとオーディオエンジンが起動します。',
    randomise: '自動生成',
    randomiseLabel: 'パターンを生成したものに差し替える',
    patterns: 'パターン',
    patternsLabel: 'パターンを読み込む',
    custom: '編集中',
    exportWav: 'WAV',
    exportWavLabel: '1 ループ分を WAV ファイルで保存する',
    exportMidi: 'MIDI',
    exportMidiLabel: 'パターンを MIDI ファイルで保存する',
    exporting: 'レンダリング中…',
    exportFailed: '書き出しに失敗しました。',
  },

  status: {
    booting: '起動中',
    stopped: '停止中',
    running: '再生中',
    suspended: 'RUN 待ち',
    unsupported: 'このブラウザは Web Audio に対応していないため、この楽器は動きません。',
    failed: 'オーディオエンジンが停止しました。ページを再読み込みすると起動し直します。',
  },

  grid: {
    label: 'ステップシーケンサー、16 ステップ',
    bank: '{a} から {b} ステップ',
    ruler: 'ステップ',
    step: '{n} ステップ目',
    cell: '{n} ステップ目、{lane}',
    keyHint:
      '矢印キーでセルの間を移動します。スペースキーでカーソル下のセルを変更し、音符のセルではプラスとマイナスで半音、Page Up と Page Down で 1 オクターブ動きます。',
    lanes: {
      note: '音の高さ',
      gate: 'ゲート',
      accent: 'アクセント',
      slide: 'スライド',
    },
    gates: {
      note: '打つ',
      tie: '伸ばす',
      rest: '休む',
    },
    gateHelp: '「打つ」は新しい音を出し、「伸ばす」は前の音を続け、「休む」は無音です。',
    on: 'オン',
    off: 'オフ',
    unavailable: '無効',
    accentUnavailable:
      'アクセントは打ち直した音にだけ乗ります。「伸ばす」は前の音を続けるだけ、「休む」には音がないので、どちらもベロシティを拾いません。',
    slideUnavailable: '「休む」には、滑り出す元の音がありません。',
    slideInert: 'このスライドは、次のステップが音を打ち直すまで何も起こしません。',
    slidePitchOnly:
      '最後のステップのスライドはピッチだけが滑ります。ループの折り返しで鳴っているボイスが解放されるため、1 ステップ目はエンベロープを立て直します。',
    pitchOnlyBadge: 'ピッチのみ',
    inspector: '選択中のステップ',
    pitch: '音の高さ',
    pitchDown: '半音下げる',
    pitchUp: '半音上げる',
    pitchUnavailable: '自分の音の高さを持つのは、打ち直すステップだけです。',
    nextGate: 'ゲートを変える',
    toggleAccent: 'アクセントを切り替える',
    toggleSlide: 'スライドを切り替える',
  },

  views: {
    switcher: '表示',
    scope: {
      caption: 'マスター段の後ろで取り出した、出力波形とスペクトラムです。',
    },
    filter: {
      caption:
        'ノイズを通して実測した特性を補間した近似です。レゾナンスが低いほど、聴こえる折れ点はつまみの数値よりかなり下にあります。',
      corner: '折れ点',
      envOpen: 'エンベロープ開放',
      axisDb: 'dB',
    },
    output: {
      caption: 'マスターフェーダーと -1 dBTP の真のピークリミッタを通った後の出力ピークです。',
      ceiling: '天井',
      rate: 'サンプルレート',
    },
  },
};

/** The two copy tables, keyed the way `localizedValue` takes them. */
export const STEP_BASS_COPY = { en: enCopy, ja: jaCopy };

export type StepBassCopy = typeof enCopy;
