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

/**
 * The standard name for each GS insertion-effect type, keyed the same way as
 * `data/efx-tables.json`'s `defaults.by_type`.
 */
export const GS_EFX_TYPES: Readonly<Record<string, LocalizedName>> = {
  '00 00': { en: 'Thru', ja: 'スルー' },
  '01 00': { en: 'Stereo-EQ', ja: 'ステレオ EQ' },
  '01 01': { en: 'Spectrum', ja: 'スペクトラム' },
  '01 02': { en: 'Enhancer', ja: 'エンハンサー' },
  '01 03': { en: 'Humanizer', ja: 'ヒューマナイザー' },
  '01 10': { en: 'Overdrive', ja: 'オーバードライブ' },
  '01 11': { en: 'Distortion', ja: 'ディストーション' },
  '01 20': { en: 'Phaser', ja: 'フェイザー' },
  '01 21': { en: 'Auto Wah', ja: 'オートワウ' },
  '01 22': { en: 'Rotary', ja: 'ロータリー' },
  '01 23': { en: 'Stereo Flanger', ja: 'ステレオフランジャー' },
  '01 24': { en: 'Step Flanger', ja: 'ステップフランジャー' },
  '01 25': { en: 'Tremolo', ja: 'トレモロ' },
  '01 26': { en: 'Auto Pan', ja: 'オートパン' },
  '01 30': { en: 'Compressor', ja: 'コンプレッサー' },
  '01 31': { en: 'Limiter', ja: 'リミッター' },
  '01 40': { en: 'Hexa Chorus', ja: 'ヘキサコーラス' },
  '01 41': { en: 'Tremolo Chorus', ja: 'トレモロコーラス' },
  '01 42': { en: 'Stereo Chorus', ja: 'ステレオコーラス' },
  '01 43': { en: 'Space-D', ja: 'スペース D' },
  '01 44': { en: '3D Chorus', ja: '3D コーラス' },
  '01 50': { en: 'Stereo Delay', ja: 'ステレオディレイ' },
  '01 51': { en: 'Modulation Delay', ja: 'モジュレーションディレイ' },
  '01 52': { en: '3 Tap Delay', ja: '3 タップディレイ' },
  '01 53': { en: '4 Tap Delay', ja: '4 タップディレイ' },
  '01 54': { en: 'Time Control Delay', ja: 'タイムコントロールディレイ' },
  '01 55': { en: 'Reverb', ja: 'リバーブ' },
  '01 56': { en: 'Gate Reverb', ja: 'ゲートリバーブ' },
  '01 57': { en: '3D Delay', ja: '3D ディレイ' },
  '01 60': { en: '2-Voice Pitch Shifter', ja: '2 ボイスピッチシフター' },
  '01 61': { en: 'Feedback Pitch Shifter', ja: 'フィードバックピッチシフター' },
  '01 70': { en: '3D Auto', ja: '3D オート' },
  '01 71': { en: '3D Manual', ja: '3D マニュアル' },
  '01 72': { en: 'Lo-Fi 1', ja: 'ローファイ 1' },
  '01 73': { en: 'Lo-Fi 2', ja: 'ローファイ 2' },
  '02 00': { en: 'Overdrive → Chorus', ja: 'オーバードライブ → コーラス' },
  '02 01': { en: 'Overdrive → Flanger', ja: 'オーバードライブ → フランジャー' },
  '02 02': { en: 'Overdrive → Delay', ja: 'オーバードライブ → ディレイ' },
  '02 03': { en: 'Distortion → Chorus', ja: 'ディストーション → コーラス' },
  '02 04': { en: 'Distortion → Flanger', ja: 'ディストーション → フランジャー' },
  '02 05': { en: 'Distortion → Delay', ja: 'ディストーション → ディレイ' },
  '02 06': { en: 'Enhancer → Chorus', ja: 'エンハンサー → コーラス' },
  '02 07': { en: 'Enhancer → Flanger', ja: 'エンハンサー → フランジャー' },
  '02 08': { en: 'Enhancer → Delay', ja: 'エンハンサー → ディレイ' },
  '02 09': { en: 'Chorus → Delay', ja: 'コーラス → ディレイ' },
  '02 0A': { en: 'Flanger → Delay', ja: 'フランジャー → ディレイ' },
  '02 0B': { en: 'Chorus → Flanger', ja: 'コーラス → フランジャー' },
  '03 00': { en: 'Rotary Multi', ja: 'ロータリーマルチ' },
  '04 00': { en: 'Guitar Multi 1', ja: 'ギターマルチ 1' },
  '04 01': { en: 'Guitar Multi 2', ja: 'ギターマルチ 2' },
  '04 02': { en: 'Guitar Multi 3', ja: 'ギターマルチ 3' },
  '04 03': { en: 'Clean Guitar Multi 1', ja: 'クリーンギターマルチ 1' },
  '04 04': { en: 'Clean Guitar Multi 2', ja: 'クリーンギターマルチ 2' },
  '04 05': { en: 'Bass Multi', ja: 'ベースマルチ' },
  '04 06': { en: 'Rhodes Multi', ja: 'ローズマルチ' },
  '05 00': { en: 'Keyboard Multi', ja: 'キーボードマルチ' },
  '11 00': { en: 'Chorus/Delay', ja: 'コーラス / ディレイ' },
  '11 01': { en: 'Flanger/Delay', ja: 'フランジャー / ディレイ' },
  '11 02': { en: 'Chorus/Flanger', ja: 'コーラス / フランジャー' },
  '11 03': { en: 'Overdrive/Distortion 1, 2', ja: 'オーバードライブ / ディストーション 1、2' },
  '11 04': {
    en: 'Overdrive/Distortion, Rotary',
    ja: 'オーバードライブ / ディストーション、ロータリー',
  },
  '11 05': {
    en: 'Overdrive/Distortion, Phaser',
    ja: 'オーバードライブ / ディストーション、フェイザー',
  },
  '11 06': {
    en: 'Overdrive/Distortion, Auto Wah',
    ja: 'オーバードライブ / ディストーション、オートワウ',
  },
  '11 07': { en: 'Phaser, Rotary', ja: 'フェイザー、ロータリー' },
  '11 08': { en: 'Phaser, Auto Wah', ja: 'フェイザー、オートワウ' },
};

/** Keys from {@link GS_EFX_TYPES} whose name could not be confirmed. Empty: every key was confirmed. */
export const GS_EFX_TYPES_UNNAMED: readonly string[] = [];

/**
 * The insert an effect-binding row names, keyed the same way as
 * `data/efx-bindings.json`'s `rows[].stage`.
 */
export const GS_EFX_STAGES: Readonly<Record<string, LocalizedName>> = {
  'dynamics.compressor': { en: 'Compressor', ja: 'コンプレッサー' },
  'effects.delay.stereo': { en: 'Stereo Delay', ja: 'ステレオディレイ' },
  'effects.modulation.chorus': { en: 'Chorus', ja: 'コーラス' },
  'effects.modulation.ensemble': { en: 'Ensemble', ja: 'アンサンブル' },
  'effects.modulation.flanger': { en: 'Flanger', ja: 'フランジャー' },
  'effects.modulation.phaser': { en: 'Phaser', ja: 'フェイザー' },
  'effects.modulation.pitchShifter': { en: 'Pitch Shifter', ja: 'ピッチシフター' },
  'effects.modulation.ringModulator': { en: 'Ring Modulator', ja: 'リングモジュレーター' },
  'effects.modulation.rotary': { en: 'Rotary Speaker', ja: 'ロータリースピーカー' },
  'effects.reverb.dattorro': { en: 'Reverb', ja: 'リバーブ' },
  'eq.graphic': { en: 'Graphic EQ', ja: 'グラフィックイコライザー' },
  'eq.parametric': { en: 'Parametric EQ', ja: 'パラメトリックイコライザー' },
  'stereo.autoPan': { en: 'Auto Pan', ja: 'オートパン' },
  'utility.gain': { en: 'Output Gain', ja: 'アウトプットゲイン' },
};

/**
 * The control an effect-binding row's key leaf names — the part of the key
 * after its last dot. The `bandNNGainDb` leaves (the graphic EQ's fixed
 * bands) are not listed one by one; {@link bindingLabel} resolves those
 * through the plain `gainDb` entry instead.
 */
export const GS_EFX_PARAMS: Readonly<Record<string, LocalizedName>> = {
  accelTauS: { en: 'Acceleration Time', ja: '加速時間' },
  gainDb: { en: 'Gain', ja: 'ゲイン' },
  frequencyHz: { en: 'Frequency', ja: '周波数' },
  q: { en: 'Q', ja: 'Q' },
  carrierHz: { en: 'Carrier Frequency', ja: 'キャリア周波数' },
  centerDelayMs: { en: 'Center Delay', ja: 'センターディレイ' },
  decelTauS: { en: 'Deceleration Time', ja: '減速時間' },
  dampingHz: { en: 'Damping', ja: 'ダンピング' },
  delayTimeLMs: { en: 'Delay Time (L)', ja: 'ディレイタイム（L）' },
  delayTimeRMs: { en: 'Delay Time (R)', ja: 'ディレイタイム（R）' },
  drumUndershootHz: { en: 'Drum Undershoot', ja: 'ドラムアンダーシュート' },
  feedback: { en: 'Feedback', ja: 'フィードバック' },
  levelDb: { en: 'Level', ja: 'レベル' },
  makeupGainDb: { en: 'Makeup Gain', ja: 'メイクアップゲイン' },
  preFilterHz: { en: 'Pre-Filter', ja: 'プリフィルター' },
  preDelayMs: { en: 'Pre-Delay', ja: 'プリディレイ' },
  rateHz: { en: 'Rate', ja: 'レート' },
  semitones: { en: 'Semitones', ja: '半音' },
  undershootHz: { en: 'Undershoot', ja: 'アンダーシュート' },
  windowMs: { en: 'Window', ja: 'ウィンドウ' },
};

/**
 * Japanese for each distinct non-stage reason `data/efx-bindings.json` carries,
 * keyed by the engine's exact English wording. Falls back to the English
 * itself when a key is missing, which is the signal that the engine reworded a
 * reason this table has not caught up with.
 */
export const GS_BINDING_REASONS: Readonly<Record<string, string>> = {
  'a bare 00-7F with no unit printed beside it, so no conversion may be guessed':
    '00〜7F の生値で単位の記載がなく、変換式を推測できない',
  'a pan places a signal where stereo.stereoBalance moves an image already there, and the measured pair is the raw constant-power curve, which that insert normalises to centre unity three decibels above':
    'このパンは stereo.stereoBalance がすでに定位させた像を動かす位置指定で、測定されたペアは生の等パワーカーブだが、このインサートはセンターを基準ユニティより 3dB 上に正規化している',
  'a printed column with no measured table behind it':
    '記載列はあるが、裏付けとなる測定テーブルがない',
  "the auto-pan insert's LFO takes no shape selector":
    'オートパンインサートの LFO に波形セレクターはない',
  'the auto-wah insert follows an envelope and carries no LFO rate':
    'オートワウインサートはエンベロープ追従で、LFO レートを持たない',
  'the bit-crusher insert has no filter': 'ビットクラッシャーインサートにフィルターはない',
  'the bit-crusher insert has no gain ladder before its degrader':
    'ビットクラッシャーインサートには劣化段の前段ゲインがない',
  'the bit-crusher insert has no shelf table after its degrader':
    'ビットクラッシャーインサートには劣化段の後段シェルフテーブルがない',
  'the flanger insert has no sample-and-hold clock over its LFO':
    'フランジャーインサートの LFO にサンプル&ホールドクロックはない',
  'the graphic-EQ insert has no band width': 'グラフィック EQ インサートにバンド幅はない',
  "the insert's mix is a crossfade, dry = 1 - wet; the measured law is two independent gains that meet at full in the middle of the byte, which the record calls the opposite sign to a crossfade":
    'このインサートのミックスは dry = 1 - wet のクロスフェードだが、測定された特性はバイト中央でフルに達する独立した 2 本のゲインで、記録はクロスフェードとは符号が逆だとしている',
  'the limiter insert has no post gain': 'リミッターインサートにポストゲインはない',
  'the limiter insert has no ratio': 'リミッターインサートにレシオはない',
  'the pitch-shifter insert has no feedback': 'ピッチシフターインサートにフィードバックはない',
  'the pitch-shifter insert has one voice and this is a second':
    'ピッチシフターインサートはボイス 1 系統のみで、これは 2 系統目にあたる',
  "the ring modulator's carrier is a sine and takes no shape selector":
    'リングモジュレーターのキャリアはサイン波固定で、波形セレクターはない',
  'the rotary insert has no speed switch': 'ロータリーインサートにスピードスイッチはない',
  'the stereo-delay insert carries no modulation LFO':
    'ステレオディレイインサートに変調 LFO はない',
  'the stereo-delay insert has two taps and this is a fourth':
    'ステレオディレイインサートはタップ 2 系統のみで、これは 4 系統目にあたる',
  'the stereo-delay insert has two taps and this is a third':
    'ステレオディレイインサートはタップ 2 系統のみで、これは 3 系統目にあたる',
  'a binaural panner has no insert, so the type realises no chain at all':
    'バイノーラルパンナーにインサートはなく、このタイプはチェーンを一切構成しない',
  'a parallel-2 type realises no chain at all': '並列 2 系統タイプはチェーンを一切構成しない',
  'a vowel formant filter has no insert, so the type realises no chain at all':
    '母音フォルマントフィルターにインサートはなく、このタイプはチェーンを一切構成しない',
  "no reading measured this type's shift mode; the five splice windows were read on the two pitch-shifter types, and a claim does not reach a type it never measured":
    'このタイプのシフトモードは測定されていない。5つのスプライス窓は2種類のピッチシフターで読まれたもので、測定していないタイプには適用できない',
  "no reading measured where the cross mode routes the loop, so it is not taken for the stereo-delay insert's ping-pong":
    'クロスモードがループをどう経路指定するかは測定されていないため、ステレオディレイのピンポンには適用しない',
  "no reading measured which filter this gain drives, and the amp-sim insert's tone stack is not a pair of shelves":
    'このゲインがどのフィルターを駆動するかは測定されておらず、アンプシミュレーターのトーンスタックは2本のシェルフではない',
  "no reading placed the hold the index's flat group applies or the size of the step its quantiser leaves, so neither field of the byte may be given a conversion":
    'ホールドをどのフラットグループが受け持つか、量子化器が残すステップ幅も測定されておらず、バイトのどちらのフィールドにも変換を与えられない',
  'the auto-wah insert has one filter shape': 'オートワウインサートのフィルター形状は1種類のみ',
  'the auto-wah insert sweeps in one direction': 'オートワウインサートは一方向にのみスイープする',
  'the bit-crusher insert adds no noise': 'ビットクラッシャーインサートはノイズを加えない',
  'the bit-crusher insert has no mono switch': 'ビットクラッシャーインサートにモノスイッチはない',
  'the bit-crusher insert has no type ladder': 'ビットクラッシャーインサートにタイプ切り替えはない',
  'the chain carries no binaural stage for this output mode to configure':
    'この出力モードのチェーンには設定できるバイノーラル段がない',
  'the chain realises the chorus/flanger block as the chorus insert whichever this selects':
    'チェーンはこの選択値にかかわらず、コーラス / フランジャーブロックをコーラスインサートとして実行する',
  'the chain realises the tremolo/pan block as the auto-pan insert whichever this selects':
    'チェーンはこの選択値にかかわらず、トレモロ / パンブロックをオートパンインサートとして実行する',
  'the chain runs the overdrive voicing whichever character this selects':
    'チェーンはこのキャラクター選択値にかかわらず、オーバードライブの音色を実行する',
  'the chain runs this stage whichever way the switch is set':
    'チェーンはスイッチの設定にかかわらずこの段を実行する',
  'the chorus insert has no feedback': 'コーラスインサートにフィードバックはない',
  "the chorus insert has no phase between its two channels' sweeps":
    'コーラスインサートの2チャンネルのスイープには位相差がない',
  'the ensemble insert has no per-voice deviation':
    'アンサンブルインサートにボイスごとの偏差はない',
  'the ensemble insert runs a slow and a fast sweep and has no single rate':
    'アンサンブルインサートは遅いスイープと速いスイープを実行し、単一のレートは持たない',
  "the flanger insert has no phase between its two channels' sweeps":
    'フランジャーインサートの2チャンネルのスイープには位相差がない',
  'the four amplifier responses are one measured table of fixed curves, and no insert here realises those curves':
    '4種類のアンプ特性は固定カーブをまとめた1つの測定テーブルで、このインサートはそのカーブを再現しない',
  'the pitch-shifter insert has no pre-delay': 'ピッチシフターインサートにプリディレイはない',
  'the pitch-shifter insert takes one pitch, which the coarse byte sets in whole semitones':
    'ピッチシフターインサートはピッチを1つだけ受け取り、粗調整バイトが整数半音単位で設定する',
  'the reverb insert has no gate': 'リバーブインサートにゲートはない',
  'the reverb insert is one algorithm and has no room-type selector':
    'リバーブインサートは1つのアルゴリズムのみで、ルームタイプのセレクターはない',
  "the reverb insert's damping is a coefficient rather than a corner":
    'リバーブインサートのダンピングはコーナー周波数ではなく係数である',
  'the ring-modulator insert has no phase between its channels':
    'リングモジュレーターインサートのチャンネル間に位相差はない',
  'the rotary insert has one rate per rotor, and the speed switch picks which of the two rate bytes it follows':
    'ロータリーインサートはローターごとに1つのレートを持ち、スピードスイッチが2つのレートバイトのどちらに従うかを選ぶ',
  'the skeleton reads the byte as a linear effect balance; the measured two-ramp law names three delay types and not this one':
    'スケルトンはバイトをエフェクト量の線形バランスとして読むが、測定された2本のランプ則が対象にするのは3種類のディレイで、このタイプではない',
  "the skeleton reads the byte as the amp model's drive fraction; the archive measured a gain in front of one fixed curve and derived no byte-to-decibel law":
    'スケルトンはバイトをアンプモデルのドライブ比率として読むが、アーカイブが測定したのは1つの固定カーブ前段のゲインで、バイトからデシベルへの則は導出されていない',
  "the skeleton reads the byte as the pre-filter's shape, which the archive read to be the Stereo Chorus's section; the archive measured an enumeration rather than a conversion, so the derivation gives it no class":
    'スケルトンはバイトをプリフィルターの形状として読む。アーカイブはそれをステレオコーラスのセクションとして読んだが、測定したのは変換ではなく列挙なので、導出に変換クラスはない',
  "the skeleton reads the byte as the pre-filter's shape; the archive measured an enumeration rather than a conversion, so the derivation gives it no class":
    'スケルトンはバイトをプリフィルターの形状として読むが、アーカイブが測定したのは変換ではなく列挙なので、導出に変換クラスはない',
  'the stereo-delay insert has no glide between delay times':
    'ステレオディレイインサートにディレイタイム間のグライドはない',
  'the stereo-delay insert has no polarity inversion': 'ステレオディレイインサートに極性反転はない',
  'the switch takes the measured amplifier response out of the path, and no insert here carries that response to take out':
    'スイッチは測定されたアンプ特性を信号経路から外すが、このインサートにはその特性を外す機能がない',
  'the wah insert has one filter shape': 'ワウインサートのフィルター形状は1種類のみ',
};

/**
 * How a type stands in this build, worded once for every panel that says it.
 * The standing itself is measured; only its wording lives here.
 */
export const GS_EFX_STANDINGS: Readonly<Record<string, LocalizedName>> = {
  adjustable: { en: 'Adjustable', ja: '調整できる' },
  fixed: { en: 'Parameters inert', ja: 'パラメータが効かない' },
  inert: { en: 'No effect here', ja: 'このビルドでは効かない' },
};
