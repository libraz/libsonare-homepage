/**
 * Default preset bound when the engine starts. Must be a member of the catalog
 * returned by `synthPresetNames()`.
 */
export const DEFAULT_PRESET = 'e-piano';

export const enCopy = {
  title: 'Synth Playground',
  subtitle: "Play libsonare's native polyphonic synth, live in the browser",
  localOnly: 'LOCAL ONLY',
  status: {
    idle: 'Idle',
    starting: 'Starting',
    armed: 'Ready',
    ready: 'Playing',
    error: 'Error',
  },
  deck: {
    model: 'NS-1',
    tagline: 'NATIVE POLYPHONIC SYNTHESIZER',
    power: 'Power',
  },
  sections: {
    program: 'Program',
    osc: 'Oscillator',
    filter: 'Filter',
    envelope: 'Envelope',
    voice: 'Voice',
    output: 'Output',
    midi: 'MIDI In',
    keys: 'Keybed',
  },
  controls: {
    preset: 'Preset',
    octave: 'Octave',
    octaveDown: 'Octave down',
    octaveUp: 'Octave up',
    panic: 'All notes off',
  },
  patch: {
    waveform: 'Waveform',
    filterModel: 'Filter',
    cutoff: 'Cutoff',
    resonance: 'Resonance',
    attack: 'Attack',
    release: 'Release',
    glide: 'Glide',
    spread: 'Width',
    reset: 'Reset to preset',
    hint: 'Tweaks layer on top of the selected program and apply live while you play.',
    engine: 'Engine',
  },
  engineNotes: {
    noOscillator:
      '{engine} makes its own tone, so there is no waveform to pick. Only the subtractive engine has an oscillator.',
    kit: 'The kit voices each drum itself. The oscillator, filter, envelope and voice controls do not reach it; only the output level does.',
  },
  midi: {
    connect: 'Connect MIDI device',
    connecting: 'Connecting…',
    listening: 'Listening',
    unavailable:
      'Web MIDI is not available in this browser. Chrome and Edge support USB MIDI keyboards.',
    none: 'No MIDI inputs detected. Plug in a USB MIDI keyboard and it will appear here.',
    error: 'Could not access MIDI devices. Check the browser permission prompt.',
    docs: 'MIDI input docs',
  },
  output: {
    peak: 'Peak',
    rate: 'Rate',
    gain: 'Gain',
    clip: 'Output clipped — click to reset',
  },
  keyboardHint:
    'Click or tap the keys, or play with your computer keyboard: A W S E D F T G Y H U J K. Use Z / X to shift the octave. Drag across keys for glissando — striking lower on a key plays louder.',
  errors: {
    start: 'Could not start the synthesizer. Reload and try again.',
  },
  guide: {
    title: 'Native polyphonic synthesis, in the browser',
    body: "Every key plays through libsonare's NativeSynth hosted in a SAB-free AudioWorklet: notes become live MIDI events, and the engine renders a stereo bus in the audio thread with its own WebAssembly heap. Hold several keys for full polyphony.",
    docs: 'Realtime Engine docs',
  },
  terms: {
    eyebrow: 'Synth',
    tipLabel: 'How to use',
    linkLabel: 'Open glossary',
    resetLabel: 'Reset',
    items: {
      program: {
        title: 'Program',
        body: 'Programs are grouped by the engine that plays them: subtractive, FM, the physical models and the rest. Each program is a complete saved patch; selecting one reloads every control to the stored sound and clears your tweaks. Picking an engine plays the program you last chose on it.',
        tip: 'Start here: pick the program closest to the sound you want, then nudge the knobs from there. A control the engine does not use is dimmed.',
      },
      waveform: {
        title: 'Waveform',
        body: "The oscillator's raw tone before filtering. Sine is pure; saw and square are bright and harmonically rich; triangle is soft; noise is unpitched. AUTO keeps the program's own waveform.",
        tip: 'Reach for saw or square when a patch needs more bite, triangle or sine when it should sit back. Only the subtractive programs (sine, saw, square, triangle, the leads, sub bass, warm pad) have a switchable oscillator — the physical-model, FM, and sampled-style programs generate their tone from their own engine, so the switch is dimmed on them.',
      },
      cutoff: {
        title: 'Cutoff',
        body: 'The low-pass filter corner frequency (80 Hz–16 kHz). Everything above it is rolled off, so a lower cutoff means a darker, rounder tone.',
        tip: 'Pull cutoff down to tame brightness, or open it up to let a patch cut through a mix.',
        defaultRationale: "Double-click the knob to restore the program's cutoff.",
      },
      resonance: {
        title: 'Resonance (Q)',
        body: 'Emphasizes a narrow band right at the cutoff frequency (0.5–12). Higher Q adds a vocal, whistling peak and can self-oscillate on ladder filters.',
        tip: 'A little resonance adds character; push it high for squelchy, acid-style sweeps.',
        defaultRationale: "Double-click the knob to restore the program's resonance.",
      },
      filterModel: {
        title: 'Filter model',
        body: 'The filter circuit being modeled. SVF is clean and neutral; the Moog and diode ladders add analog warmth and drive; Sallen-Key is punchy. AUTO uses the program filter.',
        tip: 'Switch models to recolor the same cutoff and resonance — ladders sound thicker, SVF stays transparent.',
      },
      attack: {
        title: 'Attack',
        body: 'How long a note takes to reach full level after the key goes down (1–2000 ms). Short is percussive; long is a slow swell.',
        tip: 'Lengthen attack for pads and strings; keep it short for keys, plucks, and bass.',
        defaultRationale: "Double-click the knob to restore the program's attack.",
      },
      release: {
        title: 'Release',
        body: 'How long a note takes to fade out after the key is let go (10–5000 ms). A long release leaves notes ringing into each other.',
        tip: 'Stretch release for ambient tails; shorten it for tight, staccato playing.',
        defaultRationale: "Double-click the knob to restore the program's release.",
      },
      glide: {
        title: 'Glide (portamento)',
        body: 'Slides pitch from the previous note to the new one over this time (0–300 ms). At 0 ms notes jump instantly.',
        tip: 'A touch of glide makes monophonic leads and basslines feel connected and expressive.',
      },
      spread: {
        title: 'Stereo width',
        body: 'Spreads the voices across the stereo field (0–100%). At 0% the synth is centered in mono; higher values widen the image.',
        tip: 'Widen for lush pads; keep it narrow for bass and mono-compatible mixes.',
        defaultRationale: "Double-click the knob to restore the program's width.",
      },
      gain: {
        title: 'Output gain',
        body: 'Monitor level after the engine’s master limiter (0–100%). A true-peak limiter on the engine’s master strip holds the synth bus at −1 dBTP, so a big chord on a loud program is caught there rather than clipped; this knob only sets how loud that ceiling sits.',
        tip: 'Leave it near 90% and let the limiter do the protecting — turning it down does not change how hard chords hit the ceiling.',
        defaultRationale: 'Double-click the knob to restore 90%.',
      },
      peak: {
        title: 'Peak meter',
        body: 'The loudest recent sample on the stereo output, in dBFS. The engine’s master limiter holds the bus at −1 dBTP, so the meter tops out just under the ceiling; the CLIP chip latches if a sample ever reaches full scale.',
        tip: 'Hold an eight-note chord on a loud program at full velocity and watch the limiter catch it.',
      },
      octave: {
        title: 'Octave',
        body: 'Shifts the whole keyboard up or down in 12-semitone steps (C1–C6). The readout shows the lowest key on the keybed.',
        tip: 'Drop an octave for bass, raise it for leads and bell tones — or use the Z / X keys.',
      },
      panic: {
        title: 'All notes off',
        body: 'Immediately silences every sounding voice. Use it if a note sticks on after a dropped key or a MIDI glitch.',
        tip: 'Hit this whenever a note hangs — it sends note-off to the whole engine.',
      },
      midi: {
        title: 'MIDI input',
        body: "Connects a USB MIDI keyboard through the browser's Web MIDI API. Played notes drive the synth exactly like the on-screen keys. Chrome and Edge support this.",
        tip: 'Plug in a controller, click connect, and allow the permission prompt to play with real keys.',
      },
    },
  },
};

export const jaCopy: typeof enCopy = {
  title: 'シンセプレイグラウンド',
  subtitle: 'libsonare の内蔵ポリフォニックシンセをブラウザで演奏',
  localOnly: 'ローカル処理',
  status: {
    idle: '待機中',
    starting: '起動中',
    armed: '準備完了',
    ready: '演奏中',
    error: 'エラー',
  },
  deck: {
    model: 'NS-1',
    tagline: 'NATIVE POLYPHONIC SYNTHESIZER',
    power: '電源',
  },
  sections: {
    program: 'プログラム',
    osc: 'オシレーター',
    filter: 'フィルター',
    envelope: 'エンベロープ',
    voice: 'ボイス',
    output: '出力',
    midi: 'MIDI 入力',
    keys: '鍵盤',
  },
  controls: {
    preset: 'プリセット',
    octave: 'オクターブ',
    octaveDown: 'オクターブを下げる',
    octaveUp: 'オクターブを上げる',
    panic: '全音オフ',
  },
  patch: {
    waveform: '波形',
    filterModel: 'フィルター',
    cutoff: 'カットオフ',
    resonance: 'レゾナンス',
    attack: 'アタック',
    release: 'リリース',
    glide: 'グライド',
    spread: '広がり',
    reset: 'プリセットに戻す',
    hint: '選択中のプログラムに重ねて適用され、演奏中もリアルタイムに反映されます。',
    engine: 'エンジン',
  },
  engineNotes: {
    noOscillator:
      '{engine} は音色を自分で作るため、選べる波形がありません。オシレーターを持つのは subtractive エンジンだけです。',
    kit: 'キットは各ドラムを自分で鳴らします。オシレーター・フィルター・エンベロープ・ボイスのつまみは届かず、効くのは出力レベルだけです。',
  },
  midi: {
    connect: 'MIDI デバイスを接続',
    connecting: '接続中…',
    listening: '受信中',
    unavailable:
      'このブラウザでは Web MIDI を利用できません。USB MIDI キーボードは Chrome / Edge で利用できます。',
    none: 'MIDI 入力が見つかりません。USB MIDI キーボードを接続するとここに表示されます。',
    error: 'MIDI デバイスにアクセスできませんでした。ブラウザの許可ダイアログを確認してください。',
    docs: 'MIDI 入力のドキュメント',
  },
  output: {
    peak: 'ピーク',
    rate: 'レート',
    gain: 'ゲイン',
    clip: '出力クリップ — クリックでリセット',
  },
  keyboardHint:
    '鍵盤をクリック／タップするか、PC キーボードで演奏できます: A W S E D F T G Y H U J K。Z / X でオクターブを切り替えます。鍵盤上をドラッグするとグリッサンド、鍵盤の下側を押すほど強く鳴ります。',
  errors: {
    start: 'シンセを起動できませんでした。再読み込みして再度お試しください。',
  },
  guide: {
    title: 'ブラウザで動く内蔵ポリフォニックシンセ',
    body: '鍵盤を押すと、その入力が MIDI イベントとして NativeSynth に届き、AudioWorklet のオーディオスレッドで音声が生成されます。処理はブラウザ内の WebAssembly で完結し、音源はアップロードされません。複数の鍵盤を同時に押すと、和音としてポリフォニックに鳴ります。',
    docs: 'リアルタイムエンジンのドキュメント',
  },
  terms: {
    eyebrow: 'シンセ',
    tipLabel: '使い方',
    linkLabel: '用語集を開く',
    resetLabel: 'リセット',
    items: {
      program: {
        title: 'プログラム',
        body: 'プログラムは、それを鳴らすエンジンごとにまとめてあります。減算方式、FM、物理モデルなどです。各プログラムは設定一式を収めた保存パッチで、選ぶとすべてのコントロールが保存音色に戻り、それまでの微調整はクリアされます。エンジンを選ぶと、そのエンジンで最後に選んだプログラムが鳴ります。',
        tip: 'まずここから。目的に近いプログラムを選び、そこからノブで詰めていきます。そのエンジンが使わないコントロールは暗く表示されます。',
      },
      waveform: {
        title: '波形',
        body: 'フィルターに入る前の、オシレーターの元の音です。サイン波は純粋、ノコギリ波と矩形波は明るく倍音が豊か、三角波は柔らかく、ノイズは音程を持ちません。AUTO はプログラム本来の波形を使います。',
        tip: 'もっと前に出したいときはノコギリ波／矩形波、後ろに収めたいときは三角波／サイン波を。オシレーターを切り替えられるのは減算方式のプログラム（sine・saw・square・triangle・各リード・サブベース・ウォームパッド）だけで、物理モデルや FM などのプログラムはそれぞれのエンジンで音を作るため、この切り替えは暗く表示されます。',
      },
      cutoff: {
        title: 'カットオフ',
        body: 'ローパスフィルターのコーナー周波数（80 Hz〜16 kHz）。これより上が削られるため、低いほど暗く丸い音になります。',
        tip: '明るさを抑えたいときは下げ、ミックスで抜けさせたいときは開きます。',
        defaultRationale: 'ノブをダブルクリックするとプログラムのカットオフに戻ります。',
      },
      resonance: {
        title: 'レゾナンス（Q）',
        body: 'カットオフ付近の狭い帯域を強調します（0.5〜12）。Q が高いほど鼻にかかった笛のようなピークが付き、ラダー型では自己発振することもあります。',
        tip: '少量で個性付け、高く上げるとアシッド系のうねるスイープになります。',
        defaultRationale: 'ノブをダブルクリックするとプログラムのレゾナンスに戻ります。',
      },
      filterModel: {
        title: 'フィルターモデル',
        body: 'モデル化するフィルター回路です。SVF はクリーンでニュートラル、Moog／diode ラダーはアナログ的な温かみとドライブ、Sallen-Key は押し出しが強め。AUTO はプログラムのフィルターを使います。',
        tip: '同じカットオフ／レゾナンスのまま色付けを変えられます。ラダーは太く、SVF は素直です。',
      },
      attack: {
        title: 'アタック',
        body: '押鍵後に音が最大レベルへ達するまでの時間（1〜2000 ms）。短いと打鍵感が出て、長いとゆっくり立ち上がります。',
        tip: 'パッドやストリングスは長め、鍵盤系・プラック・ベースは短めに。',
        defaultRationale: 'ノブをダブルクリックするとプログラムのアタックに戻ります。',
      },
      release: {
        title: 'リリース',
        body: '離鍵後に音が消えるまでの時間（10〜5000 ms）。長いと音同士が重なって残ります。',
        tip: 'アンビエントな余韻は長め、タイトでスタッカートな演奏は短めに。',
        defaultRationale: 'ノブをダブルクリックするとプログラムのリリースに戻ります。',
      },
      glide: {
        title: 'グライド（ポルタメント）',
        body: '直前の音から次の音へ、この時間をかけて音程を滑らせます（0〜300 ms）。0 ms ではすぐ次の音程へ移ります。',
        tip: '少し効かせると、モノフォニックなリードやベースに表情とつながりが生まれます。',
      },
      spread: {
        title: 'ステレオ幅',
        body: 'ボイスをステレオ空間に広げます（0〜100%）。0% ではモノラル中央、上げるほど音像が広がります。',
        tip: '厚みのあるパッドは広めに、ベースやモノラル互換を保ちたいミックスは狭めに。',
        defaultRationale: 'ノブをダブルクリックするとプログラムの幅に戻ります。',
      },
      gain: {
        title: '出力ゲイン',
        body: 'エンジンのマスターリミッター後のモニターレベル（0〜100%）。エンジンのマスターストリップに入ったトゥルーピークリミッターがシンセバスを −1 dBTP に抑えるため、大きな音色で和音を押し込んでもクリップせずそこで止まります。このノブはその上限をどの音量で聴くかを決めるだけです。',
        tip: '90% 前後のままにして、保護はリミッターに任せます。ノブを下げても和音が上限に当たる強さは変わりません。',
        defaultRationale: 'ノブをダブルクリックすると 90% に戻ります。',
      },
      peak: {
        title: 'ピークメーター',
        body: 'ステレオ出力で直近に最も大きかったサンプルを dBFS で表示します。エンジンのマスターリミッターがバスを −1 dBTP に抑えるので、メーターは上限のすぐ下で止まります。サンプルがフルスケールに達すると CLIP チップが点灯したままになります。',
        tip: '大きな音色で 8 音の和音を最大ベロシティで押さえ、リミッターが受け止める様子を見てみてください。',
      },
      octave: {
        title: 'オクターブ',
        body: '鍵盤全体を 12 半音単位で上下にシフトします（C1〜C6）。表示は鍵盤の最低音です。',
        tip: 'ベースは下げ、リードやベル系は上げます。Z / X キーでも切り替えられます。',
      },
      panic: {
        title: '全音オフ',
        body: '鳴っているすべてのボイスを即座に消音します。鍵盤の取りこぼしや MIDI の不具合で音が鳴り続けたときに使います。',
        tip: '音が鳴りっぱなしになったら押してください。エンジン全体にノートオフを送ります。',
      },
      midi: {
        title: 'MIDI 入力',
        body: 'ブラウザの Web MIDI API を通じて USB MIDI キーボードを接続します。演奏した音は画面上の鍵盤とまったく同じようにシンセを鳴らします。Chrome / Edge が対応しています。',
        tip: 'コントローラーを接続し、接続をクリックして許可ダイアログを承認すると、実機の鍵盤で演奏できます。',
      },
    },
  },
};

/** Help-tooltip term keys, derived from the English copy. */
export type SynthTermKey = keyof typeof enCopy.terms.items;

/**
 * Glossary slug each term deep-links to (relative to `/docs/glossary/`).
 * `undefined` terms still show a tooltip but render no docs link.
 */
export const SYNTH_TERM_SLUGS: Record<SynthTermKey, string | undefined> = {
  program: 'instruments/synthesis-basics',
  waveform: 'instruments/synthesis-basics',
  cutoff: 'instruments/synthesis-basics',
  resonance: 'instruments/synthesis-basics',
  filterModel: 'instruments/synthesis-basics',
  attack: 'instruments/envelopes-modulation',
  release: 'instruments/envelopes-modulation',
  glide: 'instruments/envelopes-modulation',
  spread: 'instruments/synthesis-basics',
  gain: 'concepts/audio-basics',
  peak: 'concepts/audio-basics',
  octave: undefined,
  panic: undefined,
  midi: 'instruments/midi-basics',
};
