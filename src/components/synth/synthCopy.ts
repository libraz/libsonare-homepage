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
    engine: 'Engine',
    gain: 'Gain',
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
};

export const jaCopy: typeof enCopy = {
  title: 'シンセプレイグラウンド',
  subtitle: 'libsonare のネイティブ・ポリフォニックシンセをブラウザで演奏',
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
    engine: 'エンジン',
    gain: 'ゲイン',
  },
  keyboardHint:
    '鍵盤をクリック／タップするか、PC キーボードで演奏できます: A W S E D F T G Y H U J K。Z / X でオクターブを切り替えます。鍵盤上をドラッグするとグリッサンド、鍵盤の下側を押すほど強く鳴ります。',
  errors: {
    start: 'シンセを起動できませんでした。再読み込みして再度お試しください。',
  },
  guide: {
    title: 'ブラウザで動くネイティブ・ポリフォニックシンセ',
    body: '各鍵盤は SAB フリーの AudioWorklet 上でホストされる libsonare の NativeSynth を通して鳴ります。押鍵はライブ MIDI イベントになり、エンジンはオーディオスレッドで専用の WebAssembly ヒープを使ってステレオバスをレンダーします。複数の鍵盤を同時に押すとポリフォニックに鳴ります。',
    docs: 'リアルタイムエンジンのドキュメント',
  },
};

/**
 * One playable key in the demo keyboard: its semitone offset above the lowest
 * C of the active octave range and whether it is a black (accidental) key.
 */
export interface KeyDef {
  /** Semitone offset above the range's base C. */
  semitone: number;
  /** True for sharp/flat keys (rendered as raised black keys). */
  black: boolean;
  /** Computer-keyboard character mapped to this key, if any. */
  pc?: string;
}

/**
 * Two-octave keyboard layout (C..B over two octaves) with the standard
 * tracker/DAW computer-keyboard mapping over the lower octave-and-a-bit.
 */
export const KEY_LAYOUT: KeyDef[] = [
  { semitone: 0, black: false, pc: 'a' },
  { semitone: 1, black: true, pc: 'w' },
  { semitone: 2, black: false, pc: 's' },
  { semitone: 3, black: true, pc: 'e' },
  { semitone: 4, black: false, pc: 'd' },
  { semitone: 5, black: false, pc: 'f' },
  { semitone: 6, black: true, pc: 't' },
  { semitone: 7, black: false, pc: 'g' },
  { semitone: 8, black: true, pc: 'y' },
  { semitone: 9, black: false, pc: 'h' },
  { semitone: 10, black: true, pc: 'u' },
  { semitone: 11, black: false, pc: 'j' },
  { semitone: 12, black: false, pc: 'k' },
  { semitone: 13, black: true },
  { semitone: 14, black: false },
  { semitone: 15, black: true },
  { semitone: 16, black: false },
  { semitone: 17, black: false },
  { semitone: 18, black: true },
  { semitone: 19, black: false },
  { semitone: 20, black: true },
  { semitone: 21, black: false },
  { semitone: 22, black: true },
  { semitone: 23, black: false },
];
