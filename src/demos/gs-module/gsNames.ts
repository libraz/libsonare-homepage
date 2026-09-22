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

/** A display name in both languages the site serves. */
export interface LocalizedName {
  en: string;
  ja: string;
}

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
