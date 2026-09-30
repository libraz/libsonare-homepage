/**
 * The Japanese side of the module's labels, and the effect-type names.
 *
 * English instrument and family names are not here: the engine answers them
 * (`Project.gmInstrumentName`, `Project.gmFamilyName`) and its spellings are
 * the canonical ones, down to the irregular forms the standard actually uses.
 * A second copy would only be a copy that can drift. What the engine has no
 * query for is the Japanese, and the effect-type names.
 *
 * `GS_EFX_TYPES` is keyed by the same two-byte hex spelling as
 * `data/efx-tables.json`'s `defaults.by_type`, so the demo looks a type's name
 * up by the exact key the data file already carries. Every one of that file's
 * 65 keys has a confirmed name here; there is nothing to list in
 * {@link GS_EFX_TYPES_UNNAMED}.
 */

import type { LocalizedName } from '@/utils/modelNames';

export { GS_EFX_TYPES } from '@/utils/gsEfxNames';

export type { LocalizedName };

/** GM groups its programs eight to a family, in order, with no exceptions. */
export const GM_FAMILY_SIZE = 8;
export const GM_FAMILY_COUNT = 16;
export const GM_PROGRAM_COUNT = GM_FAMILY_SIZE * GM_FAMILY_COUNT;

/** Family index of a program number. */
export function gmFamilyOf(program: number): number {
  if (!Number.isInteger(program) || program < 0 || program >= GM_PROGRAM_COUNT) {
    throw new RangeError(`program out of range: ${program}`);
  }
  return Math.floor(program / GM_FAMILY_SIZE);
}

/** Japanese family names, index = family. */
export const GM_FAMILY_NAMES_JA: readonly string[] = [
  'ピアノ',
  'クロマチックパーカッション',
  'オルガン',
  'ギター',
  'ベース',
  'ストリングス',
  'アンサンブル',
  'ブラス',
  'リード',
  'パイプ',
  'シンセリード',
  'シンセパッド',
  'シンセエフェクト',
  'エスニック',
  'パーカッション',
  'サウンドエフェクト',
];

/**
 * Japanese instrument names, index = program number. The English column is
 * kept beside each one as a comment so a translation can be checked against
 * the program it belongs to without loading the engine.
 */
export const GM_PROGRAM_NAMES_JA: readonly string[] = [
  'アコースティックグランドピアノ', // Acoustic Grand Piano
  'ブライトアコースティックピアノ', // Bright Acoustic Piano
  'エレクトリックグランドピアノ', // Electric Grand Piano
  'ホンキートンクピアノ', // Honky-tonk Piano
  'エレクトリックピアノ 1', // Electric Piano 1
  'エレクトリックピアノ 2', // Electric Piano 2
  'ハープシコード', // Harpsichord
  'クラビネット', // Clavinet
  'チェレスタ', // Celesta
  'グロッケンシュピール', // Glockenspiel
  'ミュージックボックス', // Music Box
  'ビブラフォン', // Vibraphone
  'マリンバ', // Marimba
  'シロフォン', // Xylophone
  'チューブラーベル', // Tubular Bells
  'ダルシマー', // Dulcimer
  'ドローバーオルガン', // Drawbar Organ
  'パーカッシブオルガン', // Percussive Organ
  'ロックオルガン', // Rock Organ
  'チャーチオルガン', // Church Organ
  'リードオルガン', // Reed Organ
  'アコーディオン', // Accordion
  'ハーモニカ', // Harmonica
  'タンゴアコーディオン', // Tango Accordion
  'アコースティックギター（ナイロン）', // Acoustic Guitar (nylon)
  'アコースティックギター（スチール）', // Acoustic Guitar (steel)
  'エレキギター（ジャズ）', // Electric Guitar (jazz)
  'エレキギター（クリーン）', // Electric Guitar (clean)
  'エレキギター（ミュート）', // Electric Guitar (muted)
  'オーバードライブギター', // Overdriven Guitar
  'ディストーションギター', // Distortion Guitar
  'ギターハーモニクス', // Guitar Harmonics
  'アコースティックベース', // Acoustic Bass
  'エレキベース（フィンガー）', // Electric Bass (finger)
  'エレキベース（ピック）', // Electric Bass (pick)
  'フレットレスベース', // Fretless Bass
  'スラップベース 1', // Slap Bass 1
  'スラップベース 2', // Slap Bass 2
  'シンセベース 1', // Synth Bass 1
  'シンセベース 2', // Synth Bass 2
  'バイオリン', // Violin
  'ビオラ', // Viola
  'チェロ', // Cello
  'コントラバス', // Contrabass
  'トレモロストリングス', // Tremolo Strings
  'ピチカートストリングス', // Pizzicato Strings
  'オーケストラルハープ', // Orchestral Harp
  'ティンパニ', // Timpani
  'ストリングアンサンブル 1', // String Ensemble 1
  'ストリングアンサンブル 2', // String Ensemble 2
  'シンセストリングス 1', // Synth Strings 1
  'シンセストリングス 2', // Synth Strings 2
  'クワイア（アー）', // Choir Aahs
  'ボイス（ウー）', // Voice Oohs
  'シンセボイス', // Synth Voice
  'オーケストラヒット', // Orchestra Hit
  'トランペット', // Trumpet
  'トロンボーン', // Trombone
  'チューバ', // Tuba
  'ミュートトランペット', // Muted Trumpet
  'フレンチホルン', // French Horn
  'ブラスセクション', // Brass Section
  'シンセブラス 1', // Synth Brass 1
  'シンセブラス 2', // Synth Brass 2
  'ソプラノサックス', // Soprano Sax
  'アルトサックス', // Alto Sax
  'テナーサックス', // Tenor Sax
  'バリトンサックス', // Baritone Sax
  'オーボエ', // Oboe
  'イングリッシュホルン', // English Horn
  'ファゴット', // Bassoon
  'クラリネット', // Clarinet
  'ピッコロ', // Piccolo
  'フルート', // Flute
  'リコーダー', // Recorder
  'パンフルート', // Pan Flute
  'ボトルブロー', // Blown Bottle
  '尺八', // Shakuhachi
  'ホイッスル', // Whistle
  'オカリナ', // Ocarina
  'リード 1（矩形波）', // Lead 1 (square)
  'リード 2（のこぎり波）', // Lead 2 (sawtooth)
  'リード 3（カリオペ）', // Lead 3 (calliope)
  'リード 4（チフ）', // Lead 4 (chiff)
  'リード 5（チャランゴ）', // Lead 5 (charang)
  'リード 6（ボイス）', // Lead 6 (voice)
  'リード 7（フィフス）', // Lead 7 (fifths)
  'リード 8（ベース + リード）', // Lead 8 (bass + lead)
  'パッド 1（ニューエイジ）', // Pad 1 (new age)
  'パッド 2（ウォーム）', // Pad 2 (warm)
  'パッド 3（ポリシンセ）', // Pad 3 (polysynth)
  'パッド 4（クワイア）', // Pad 4 (choir)
  'パッド 5（ボウド）', // Pad 5 (bowed)
  'パッド 6（メタリック）', // Pad 6 (metallic)
  'パッド 7（ハロー）', // Pad 7 (halo)
  'パッド 8（スイープ）', // Pad 8 (sweep)
  'エフェクト 1（レイン）', // FX 1 (rain)
  'エフェクト 2（サウンドトラック）', // FX 2 (soundtrack)
  'エフェクト 3（クリスタル）', // FX 3 (crystal)
  'エフェクト 4（アトモスフィア）', // FX 4 (atmosphere)
  'エフェクト 5（ブライトネス）', // FX 5 (brightness)
  'エフェクト 6（ゴブリン）', // FX 6 (goblins)
  'エフェクト 7（エコー）', // FX 7 (echoes)
  'エフェクト 8（SF）', // FX 8 (sci-fi)
  'シタール', // Sitar
  'バンジョー', // Banjo
  '三味線', // Shamisen
  '琴', // Koto
  'カリンバ', // Kalimba
  'バグパイプ', // Bag pipe
  'フィドル', // Fiddle
  'シャナイ', // Shanai
  'ティンクルベル', // Tinkle Bell
  'アゴゴ', // Agogo
  'スティールドラム', // Steel Drums
  'ウッドブロック', // Woodblock
  '太鼓', // Taiko Drum
  'メロディックタム', // Melodic Tom
  'シンセドラム', // Synth Drum
  'リバースシンバル', // Reverse Cymbal
  'ギターのフレットノイズ', // Guitar Fret Noise
  'ブレスノイズ', // Breath Noise
  '波の音', // Seashore
  '鳥のさえずり', // Bird Tweet
  '電話の呼び出し音', // Telephone Ring
  'ヘリコプター', // Helicopter
  '拍手', // Applause
  '銃声', // Gunshot
];

/** Keys from {@link GS_EFX_TYPES} whose name could not be confirmed. Empty: every key was confirmed. */
export const GS_EFX_TYPES_UNNAMED: readonly string[] = [];

/**
 * The insert an effect-binding row names, keyed the same way as
 * `data/efx-bindings.json`'s `rows[].stage`.
 */
export const GS_EFX_STAGES: Readonly<Record<string, LocalizedName>> = {
  'dynamics.compressor': { en: 'Compressor', ja: 'コンプレッサー' },
  'dynamics.limiter': { en: 'Limiter', ja: 'リミッター' },
  'effects.delay.stereo': { en: 'Stereo Delay', ja: 'ステレオディレイ' },
  'effects.filter.vowel': { en: 'Vowel Filter', ja: '母音フィルター' },
  'effects.modulation.autoWah': { en: 'Auto Wah', ja: 'オートワウ' },
  'effects.modulation.chorus': { en: 'Chorus', ja: 'コーラス' },
  'effects.modulation.ensemble': { en: 'Ensemble', ja: 'アンサンブル' },
  'effects.modulation.flanger': { en: 'Flanger', ja: 'フランジャー' },
  'effects.modulation.phaser': { en: 'Phaser', ja: 'フェイザー' },
  'effects.modulation.pitchShifter': { en: 'Pitch Shifter', ja: 'ピッチシフター' },
  'effects.modulation.ringModulator': { en: 'Ring Modulator', ja: 'リングモジュレーター' },
  'effects.modulation.rotary': { en: 'Rotary Speaker', ja: 'ロータリースピーカー' },
  'effects.modulation.wah': { en: 'Wah', ja: 'ワウ' },
  'effects.reverb.dattorro': { en: 'Reverb', ja: 'リバーブ' },
  'eq.graphic': { en: 'Graphic EQ', ja: 'グラフィックイコライザー' },
  'eq.parametric': { en: 'Parametric EQ', ja: 'パラメトリックイコライザー' },
  'saturation.ampSim': { en: 'Amp Simulator', ja: 'アンプシミュレーター' },
  'saturation.bitcrusher': { en: 'Bit Crusher', ja: 'ビットクラッシャー' },
  'spectral.presenceEnhancer': { en: 'Presence Enhancer', ja: 'プレゼンスエンハンサー' },
  'stereo.autoPan': { en: 'Auto Pan', ja: 'オートパン' },
  'stereo.binaural': { en: 'Binaural', ja: 'バイノーラル' },
  'stereo.stereoBalance': { en: 'Stereo Balance', ja: 'ステレオバランス' },
  'utility.gain': { en: 'Output Gain', ja: 'アウトプットゲイン' },
};

/**
 * The control an effect-binding row's key leaf names — the part of the key
 * after its last dot. The `bandNNGainDb` leaves (the graphic EQ's fixed
 * bands) are not listed one by one; {@link bindingLabel} resolves those
 * through the plain `gainDb` entry instead.
 */
export const GS_EFX_PARAMS: Readonly<Record<string, LocalizedName>> = {
  accelMs: { en: 'Acceleration', ja: '加速' },
  accelTauS: { en: 'Acceleration Time', ja: '加速時間' },
  amount: { en: 'Amount', ja: '量' },
  attackMs: { en: 'Attack', ja: 'アタック' },
  autoTurn: { en: 'Auto Turn', ja: 'オートターン' },
  azimuthDeg: { en: 'Azimuth', ja: '方位角' },
  balance: { en: 'Balance', ja: 'バランス' },
  bassDb: { en: 'Bass', ja: '低域' },
  cab: { en: 'Cabinet', ja: 'キャビネット' },
  cabModel: { en: 'Cabinet Model', ja: 'キャビネットモデル' },
  carrierHz: { en: 'Carrier Frequency', ja: 'キャリア周波数' },
  centerDelayMs: { en: 'Center Delay', ja: 'センターディレイ' },
  cents: { en: 'Cents', ja: 'セント' },
  cents2: { en: 'Cents 2', ja: 'セント 2' },
  character: { en: 'Character', ja: 'キャラクター' },
  clockwise: { en: 'Clockwise', ja: '時計回り' },
  crossMode: { en: 'Cross Mode', ja: 'クロスモード' },
  dampingHz: { en: 'Damping', ja: 'ダンピング' },
  decay: { en: 'Decay', ja: '減衰' },
  decelTauS: { en: 'Deceleration Time', ja: '減速時間' },
  delayTimeLMs: { en: 'Delay Time (L)', ja: 'ディレイタイム（L）' },
  delayTimeRMs: { en: 'Delay Time (R)', ja: 'ディレイタイム（R）' },
  depth: { en: 'Depth', ja: '深さ' },
  depthDev: { en: 'Depth Deviation', ja: '深さの偏差' },
  depthMs: { en: 'Depth', ja: '深さ' },
  depthSlowMs: { en: 'Slow Depth', ja: '低速深さ' },
  direction: { en: 'Direction', ja: '方向' },
  discNoiseLevel: { en: 'Disc Noise Level', ja: 'ディスクノイズレベル' },
  discNoiseLpfHz: { en: 'Disc Noise Filter', ja: 'ディスクノイズフィルター' },
  discType: { en: 'Disc Type', ja: 'ディスクタイプ' },
  drive: { en: 'Drive', ja: 'ドライブ' },
  driveOn: { en: 'Drive On', ja: 'ドライブ有効' },
  drumFastHz: { en: 'Fast Drum Rate', ja: '高速ドラムレート' },
  drumLevelDb: { en: 'Drum Level', ja: 'ドラムレベル' },
  drumSlowHz: { en: 'Slow Drum Rate', ja: '低速ドラムレート' },
  drumUndershootHz: { en: 'Drum Undershoot', ja: 'ドラムアンダーシュート' },
  dryWet: { en: 'Dry / Wet', ja: 'ドライ / ウェット' },
  feedback: { en: 'Feedback', ja: 'フィードバック' },
  filterType: { en: 'Filter Type', ja: 'フィルタータイプ' },
  frequencyHz: { en: 'Frequency', ja: '周波数' },
  gainDb: { en: 'Gain', ja: 'ゲイン' },
  gateHoldMs: { en: 'Gate Hold', ja: 'ゲートホールド' },
  gateType: { en: 'Gate Type', ja: 'ゲートタイプ' },
  glideMs: { en: 'Glide', ja: 'グライド' },
  hornFastHz: { en: 'Fast Horn Rate', ja: '高速ホーンレート' },
  hornLevelDb: { en: 'Horn Level', ja: 'ホーンレベル' },
  hornSlowHz: { en: 'Slow Horn Rate', ja: '低速ホーンレート' },
  humHz: { en: 'Hum Frequency', ja: 'ハム周波数' },
  humLevel: { en: 'Hum Level', ja: 'ハムレベル' },
  humLpfHz: { en: 'Hum Filter', ja: 'ハムフィルター' },
  inputDb: { en: 'Input Gain', ja: '入力ゲイン' },
  invertL: { en: 'Invert L', ja: 'L 反転' },
  invertR: { en: 'Invert R', ja: 'R 反転' },
  level2: { en: 'Level 2', ja: 'レベル 2' },
  levelDb: { en: 'Level', ja: 'レベル' },
  lfoDepth: { en: 'LFO Depth', ja: 'LFO 深さ' },
  lfoRateHz: { en: 'LFO Rate', ja: 'LFO レート' },
  makeupGainDb: { en: 'Makeup Gain', ja: 'メイクアップゲイン' },
  minHz: { en: 'Minimum Frequency', ja: '最低周波数' },
  mix: { en: 'Mix', ja: 'ミックス' },
  modDepthMs: { en: 'Modulation Depth', ja: '変調深さ' },
  modPhaseDeg: { en: 'Modulation Phase', ja: '変調位相' },
  modRateHz: { en: 'Modulation Rate', ja: '変調レート' },
  mono: { en: 'Mono', ja: 'モノ' },
  noiseDetune: { en: 'Noise Detune', ja: 'ノイズデチューン' },
  output: { en: 'Output', ja: '出力' },
  pan: { en: 'Pan', ja: 'パン' },
  pan2: { en: 'Pan 2', ja: 'パン 2' },
  panDev: { en: 'Pan Deviation', ja: 'パンの偏差' },
  phaseDeg: { en: 'Phase', ja: '位相' },
  postFilterHz: { en: 'Post-Filter', ja: 'ポストフィルター' },
  postGainDb: { en: 'Post Gain', ja: 'ポストゲイン' },
  preDelay2Ms: { en: 'Pre-Delay 2', ja: 'プリディレイ 2' },
  preDelayDevMs: { en: 'Pre-Delay Deviation', ja: 'プリディレイの偏差' },
  preDelayMs: { en: 'Pre-Delay', ja: 'プリディレイ' },
  preFilterHz: { en: 'Pre-Filter', ja: 'プリフィルター' },
  preFilterMode: { en: 'Pre-Filter Mode', ja: 'プリフィルターモード' },
  q: { en: 'Q', ja: 'Q' },
  radioNoiseLevel: { en: 'Radio Noise Level', ja: 'ラジオノイズレベル' },
  rateHz: { en: 'Rate', ja: 'レート' },
  ratio: { en: 'Ratio', ja: 'レシオ' },
  releaseMs: { en: 'Release', ja: 'リリース' },
  resonance: { en: 'Resonance', ja: 'レゾナンス' },
  semitones: { en: 'Semitones', ja: '半音' },
  semitones2: { en: 'Semitones 2', ja: '半音 2' },
  sensitivity: { en: 'Sensitivity', ja: '感度' },
  shape: { en: 'Shape', ja: '形状' },
  speed: { en: 'Speed', ja: '速度' },
  stepRateHz: { en: 'Step Rate', ja: 'ステップレート' },
  stereoSpread: { en: 'Stereo Spread', ja: 'ステレオ広がり' },
  tap1LevelDb: { en: 'Tap 1 Level', ja: 'タップ 1 レベル' },
  tap2LevelDb: { en: 'Tap 2 Level', ja: 'タップ 2 レベル' },
  tap3LevelDb: { en: 'Tap 3 Level', ja: 'タップ 3 レベル' },
  tap3Ms: { en: 'Tap 3 Delay', ja: 'タップ 3 ディレイ' },
  tap4LevelDb: { en: 'Tap 4 Level', ja: 'タップ 4 レベル' },
  tap4Ms: { en: 'Tap 4 Delay', ja: 'タップ 4 ディレイ' },
  thresholdDb: { en: 'Threshold', ja: 'スレッショルド' },
  trebleDb: { en: 'Treble', ja: '高域' },
  turnRateHz: { en: 'Turn Rate', ja: '旋回レート' },
  typeLadder: { en: 'Type', ja: 'タイプ' },
  undershootHz: { en: 'Undershoot', ja: 'アンダーシュート' },
  vowel: { en: 'Vowel', ja: '母音' },
  windowMs: { en: 'Window', ja: 'ウィンドウ' },
  wpNoiseLevel: { en: 'Waveform Noise Level', ja: '波形ノイズレベル' },
  wpNoiseLpfHz: { en: 'Waveform Noise Filter', ja: '波形ノイズフィルター' },
  wpNoisePink: { en: 'Pink Noise', ja: 'ピンクノイズ' },
};

/**
 * Japanese for each distinct non-stage reason `data/efx-bindings.json` carries,
 * keyed by the engine's exact English wording. Falls back to the English
 * itself when a key is missing, which is the signal that the engine reworded a
 * reason this table has not caught up with.
 */
/**
 * How a type stands in this build, worded once for every panel that says it.
 * The standing itself is measured; only its wording lives here.
 */
export const GS_EFX_STANDINGS: Readonly<Record<string, LocalizedName>> = {
  adjustable: { en: 'Adjustable', ja: '調整できる' },
  fixed: { en: 'No parameter change at defaults', ja: '既定値ではパラメータの変化なし' },
  inert: { en: 'Unchanged at defaults', ja: '既定値では変化なし' },
};
