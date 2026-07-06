/**
 * General MIDI target map for the tuner's contribution workflow. libsonare's
 * data-free floor voices every GM program (and channel-10 drum note) through the
 * built-in synth GM fallback bank (`gm_fallback_map.cpp`). This module lets a
 * contributor pick the exact slot their tuned patch is meant to improve, so the
 * exported JSON / GitHub issue is tagged with a concrete target and the tool can
 * render the CURRENT built-in voice for A/B comparison.
 *
 * The GM program names here are the fixed General MIDI standard; the tool does
 * not depend on the WASM name lookup for the picker so it renders before audio
 * is armed.
 */
import type { BodyType } from '@/tuner/dsp/body-resonator';
import { ENGINE_INFO, type PhysicalEngineMode } from '@/tuner/dsp/params';

/** A GM instrument family: 16 groups of 8 consecutive programs. */
export interface GmFamily {
  name: string;
  /** First program number (0-based) in the family. */
  start: number;
  /** Representative note both A/B renders use for this family. */
  note: number;
}

/** The 16 GM families, in program order. */
export const GM_FAMILIES: GmFamily[] = [
  { name: 'Piano', start: 0, note: 60 },
  { name: 'Chromatic Percussion', start: 8, note: 72 },
  { name: 'Organ', start: 16, note: 60 },
  { name: 'Guitar', start: 24, note: 52 },
  { name: 'Bass', start: 32, note: 40 },
  { name: 'Strings', start: 40, note: 62 },
  { name: 'Ensemble', start: 48, note: 60 },
  { name: 'Brass', start: 56, note: 58 },
  { name: 'Reed', start: 64, note: 62 },
  { name: 'Pipe', start: 72, note: 74 },
  { name: 'Synth Lead', start: 80, note: 64 },
  { name: 'Synth Pad', start: 88, note: 60 },
  { name: 'Synth Effects', start: 96, note: 60 },
  { name: 'Ethnic', start: 104, note: 60 },
  { name: 'Percussive', start: 112, note: 60 },
  { name: 'Sound Effects', start: 120, note: 60 },
];

/** Japanese GM family names, index-aligned with {@link GM_FAMILIES}. */
export const GM_FAMILY_NAMES_JA: string[] = [
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
  '効果音',
];

/** The 128 GM melodic program names (General MIDI Level 1). */
export const GM_PROGRAM_NAMES: string[] = [
  'Acoustic Grand Piano',
  'Bright Acoustic Piano',
  'Electric Grand Piano',
  'Honky-tonk Piano',
  'Electric Piano 1',
  'Electric Piano 2',
  'Harpsichord',
  'Clavi',
  'Celesta',
  'Glockenspiel',
  'Music Box',
  'Vibraphone',
  'Marimba',
  'Xylophone',
  'Tubular Bells',
  'Dulcimer',
  'Drawbar Organ',
  'Percussive Organ',
  'Rock Organ',
  'Church Organ',
  'Reed Organ',
  'Accordion',
  'Harmonica',
  'Tango Accordion',
  'Acoustic Guitar (nylon)',
  'Acoustic Guitar (steel)',
  'Electric Guitar (jazz)',
  'Electric Guitar (clean)',
  'Electric Guitar (muted)',
  'Overdriven Guitar',
  'Distortion Guitar',
  'Guitar Harmonics',
  'Acoustic Bass',
  'Electric Bass (finger)',
  'Electric Bass (pick)',
  'Fretless Bass',
  'Slap Bass 1',
  'Slap Bass 2',
  'Synth Bass 1',
  'Synth Bass 2',
  'Violin',
  'Viola',
  'Cello',
  'Contrabass',
  'Tremolo Strings',
  'Pizzicato Strings',
  'Orchestral Harp',
  'Timpani',
  'String Ensemble 1',
  'String Ensemble 2',
  'Synth Strings 1',
  'Synth Strings 2',
  'Choir Aahs',
  'Voice Oohs',
  'Synth Voice',
  'Orchestra Hit',
  'Trumpet',
  'Trombone',
  'Tuba',
  'Muted Trumpet',
  'French Horn',
  'Brass Section',
  'Synth Brass 1',
  'Synth Brass 2',
  'Soprano Sax',
  'Alto Sax',
  'Tenor Sax',
  'Baritone Sax',
  'Oboe',
  'English Horn',
  'Bassoon',
  'Clarinet',
  'Piccolo',
  'Flute',
  'Recorder',
  'Pan Flute',
  'Blown Bottle',
  'Shakuhachi',
  'Whistle',
  'Ocarina',
  'Lead 1 (square)',
  'Lead 2 (sawtooth)',
  'Lead 3 (calliope)',
  'Lead 4 (chiff)',
  'Lead 5 (charang)',
  'Lead 6 (voice)',
  'Lead 7 (fifths)',
  'Lead 8 (bass + lead)',
  'Pad 1 (new age)',
  'Pad 2 (warm)',
  'Pad 3 (polysynth)',
  'Pad 4 (choir)',
  'Pad 5 (bowed)',
  'Pad 6 (metallic)',
  'Pad 7 (halo)',
  'Pad 8 (sweep)',
  'FX 1 (rain)',
  'FX 2 (soundtrack)',
  'FX 3 (crystal)',
  'FX 4 (atmosphere)',
  'FX 5 (brightness)',
  'FX 6 (goblins)',
  'FX 7 (echoes)',
  'FX 8 (sci-fi)',
  'Sitar',
  'Banjo',
  'Shamisen',
  'Koto',
  'Kalimba',
  'Bagpipe',
  'Fiddle',
  'Shanai',
  'Tinkle Bell',
  'Agogo',
  'Steel Drums',
  'Woodblock',
  'Taiko Drum',
  'Melodic Tom',
  'Synth Drum',
  'Reverse Cymbal',
  'Guitar Fret Noise',
  'Breath Noise',
  'Seashore',
  'Bird Tweet',
  'Telephone Ring',
  'Helicopter',
  'Applause',
  'Gunshot',
];

/** Japanese GM program names, index-aligned with {@link GM_PROGRAM_NAMES}. */
export const GM_PROGRAM_NAMES_JA: string[] = [
  'アコースティックピアノ',
  'ブライトピアノ',
  'エレクトリックグランドピアノ',
  'ホンキートンクピアノ',
  'エレクトリックピアノ1',
  'エレクトリックピアノ2',
  'ハープシコード',
  'クラビ',
  'チェレスタ',
  'グロッケンシュピール',
  'オルゴール',
  'ビブラフォン',
  'マリンバ',
  'シロフォン',
  'チューブラーベル',
  'ダルシマー',
  'ドローバーオルガン',
  'パーカッシブオルガン',
  'ロックオルガン',
  'チャーチオルガン',
  'リードオルガン',
  'アコーディオン',
  'ハーモニカ',
  'タンゴアコーディオン',
  'アコースティックギター（ナイロン弦）',
  'アコースティックギター（スチール弦）',
  'エレクトリックギター（ジャズ）',
  'エレクトリックギター（クリーン）',
  'エレクトリックギター（ミュート）',
  'オーバードライブギター',
  'ディストーションギター',
  'ギターハーモニクス',
  'アコースティックベース',
  'エレクトリックベース（フィンガー）',
  'エレクトリックベース（ピック）',
  'フレットレスベース',
  'スラップベース1',
  'スラップベース2',
  'シンセベース1',
  'シンセベース2',
  'バイオリン',
  'ビオラ',
  'チェロ',
  'コントラバス',
  'トレモロストリングス',
  'ピチカートストリングス',
  'オーケストラハープ',
  'ティンパニ',
  'ストリングアンサンブル1',
  'ストリングアンサンブル2',
  'シンセストリングス1',
  'シンセストリングス2',
  'クワイア・アー',
  'ボイス・ウー',
  'シンセボイス',
  'オーケストラヒット',
  'トランペット',
  'トロンボーン',
  'チューバ',
  'ミュートトランペット',
  'フレンチホルン',
  'ブラスセクション',
  'シンセブラス1',
  'シンセブラス2',
  'ソプラノサックス',
  'アルトサックス',
  'テナーサックス',
  'バリトンサックス',
  'オーボエ',
  'イングリッシュホルン',
  'ファゴット',
  'クラリネット',
  'ピッコロ',
  'フルート',
  'リコーダー',
  'パンフルート',
  'ボトルブロウ',
  '尺八',
  'ホイッスル',
  'オカリナ',
  'リード1（スクエア）',
  'リード2（ソウトゥース）',
  'リード3（カリオペ）',
  'リード4（チフ）',
  'リード5（チャラング）',
  'リード6（ボイス）',
  'リード7（フィフス）',
  'リード8（ベース＋リード）',
  'パッド1（ニューエイジ）',
  'パッド2（ウォーム）',
  'パッド3（ポリシンセ）',
  'パッド4（クワイア）',
  'パッド5（ボウ）',
  'パッド6（メタリック）',
  'パッド7（ヘイロー）',
  'パッド8（スイープ）',
  'FX1（レイン）',
  'FX2（サウンドトラック）',
  'FX3（クリスタル）',
  'FX4（アトモスフィア）',
  'FX5（ブライトネス）',
  'FX6（ゴブリン）',
  'FX7（エコー）',
  'FX8（サイファイ）',
  'シタール',
  'バンジョー',
  '三味線',
  '琴',
  'カリンバ',
  'バグパイプ',
  'フィドル',
  'シャナイ',
  'ティンクルベル',
  'アゴゴ',
  'スチールドラム',
  'ウッドブロック',
  '太鼓',
  'メロディックタム',
  'シンセドラム',
  'リバースシンバル',
  'ギターフレットノイズ',
  'ブレスノイズ',
  '波の音',
  '鳥のさえずり',
  '電話のベル',
  'ヘリコプター',
  '拍手',
  '銃声',
];

/** The GM percussion map (channel-10 note -> drum name), notes 35-81. */
export const GM_DRUM_NOTES: { note: number; name: string }[] = [
  { note: 35, name: 'Acoustic Bass Drum' },
  { note: 36, name: 'Bass Drum 1' },
  { note: 37, name: 'Side Stick' },
  { note: 38, name: 'Acoustic Snare' },
  { note: 39, name: 'Hand Clap' },
  { note: 40, name: 'Electric Snare' },
  { note: 41, name: 'Low Floor Tom' },
  { note: 42, name: 'Closed Hi-Hat' },
  { note: 43, name: 'High Floor Tom' },
  { note: 44, name: 'Pedal Hi-Hat' },
  { note: 45, name: 'Low Tom' },
  { note: 46, name: 'Open Hi-Hat' },
  { note: 47, name: 'Low-Mid Tom' },
  { note: 48, name: 'Hi-Mid Tom' },
  { note: 49, name: 'Crash Cymbal 1' },
  { note: 50, name: 'High Tom' },
  { note: 51, name: 'Ride Cymbal 1' },
  { note: 52, name: 'Chinese Cymbal' },
  { note: 53, name: 'Ride Bell' },
  { note: 54, name: 'Tambourine' },
  { note: 55, name: 'Splash Cymbal' },
  { note: 56, name: 'Cowbell' },
  { note: 57, name: 'Crash Cymbal 2' },
  { note: 58, name: 'Vibraslap' },
  { note: 59, name: 'Ride Cymbal 2' },
  { note: 60, name: 'Hi Bongo' },
  { note: 61, name: 'Low Bongo' },
  { note: 62, name: 'Mute Hi Conga' },
  { note: 63, name: 'Open Hi Conga' },
  { note: 64, name: 'Low Conga' },
  { note: 65, name: 'High Timbale' },
  { note: 66, name: 'Low Timbale' },
  { note: 67, name: 'High Agogo' },
  { note: 68, name: 'Low Agogo' },
  { note: 69, name: 'Cabasa' },
  { note: 70, name: 'Maracas' },
  { note: 71, name: 'Short Whistle' },
  { note: 72, name: 'Long Whistle' },
  { note: 73, name: 'Short Guiro' },
  { note: 74, name: 'Long Guiro' },
  { note: 75, name: 'Claves' },
  { note: 76, name: 'Hi Wood Block' },
  { note: 77, name: 'Low Wood Block' },
  { note: 78, name: 'Mute Cuica' },
  { note: 79, name: 'Open Cuica' },
  { note: 80, name: 'Mute Triangle' },
  { note: 81, name: 'Open Triangle' },
];

/** Japanese GM percussion names, keyed by the note values in {@link GM_DRUM_NOTES}. */
export const GM_DRUM_NAMES_JA: Record<number, string> = {
  35: 'アコースティックバスドラム',
  36: 'バスドラム1',
  37: 'サイドスティック',
  38: 'アコースティックスネア',
  39: 'ハンドクラップ',
  40: 'エレクトリックスネア',
  41: 'ローフロアタム',
  42: 'クローズハイハット',
  43: 'ハイフロアタム',
  44: 'ペダルハイハット',
  45: 'ロータム',
  46: 'オープンハイハット',
  47: 'ローミッドタム',
  48: 'ハイミッドタム',
  49: 'クラッシュシンバル1',
  50: 'ハイタム',
  51: 'ライドシンバル1',
  52: 'チャイニーズシンバル',
  53: 'ライドベル',
  54: 'タンバリン',
  55: 'スプラッシュシンバル',
  56: 'カウベル',
  57: 'クラッシュシンバル2',
  58: 'ビブラスラップ',
  59: 'ライドシンバル2',
  60: 'ハイボンゴ',
  61: 'ローボンゴ',
  62: 'ミュートハイコンガ',
  63: 'オープンハイコンガ',
  64: 'ローコンガ',
  65: 'ハイティンバレ',
  66: 'ローティンバレ',
  67: 'ハイアゴゴ',
  68: 'ローアゴゴ',
  69: 'カバサ',
  70: 'マラカス',
  71: 'ショートホイッスル',
  72: 'ロングホイッスル',
  73: 'ショートギロ',
  74: 'ロングギロ',
  75: 'クラベス',
  76: 'ハイウッドブロック',
  77: 'ローウッドブロック',
  78: 'ミュートクイーカ',
  79: 'オープンクイーカ',
  80: 'ミュートトライアングル',
  81: 'オープントライアングル',
};

/** Standard Roland GS drum kits, selected by a channel-10 program change.
 *  A GS drum note reuses the GM percussion map but is scoped to one of these
 *  kits, so a contribution can name which kit its tuned note belongs to. */
export const GS_DRUM_KITS: { program: number; name: string }[] = [
  { program: 0, name: 'Standard Kit' },
  { program: 8, name: 'Room Kit' },
  { program: 16, name: 'Power Kit' },
  { program: 24, name: 'Electronic Kit' },
  { program: 25, name: 'TR-808 Kit' },
  { program: 32, name: 'Jazz Kit' },
  { program: 40, name: 'Brush Kit' },
  { program: 48, name: 'Orchestra Kit' },
  { program: 56, name: 'SFX Kit' },
];

/** Japanese GS drum kit names, keyed by the program values in {@link GS_DRUM_KITS}. */
export const GS_DRUM_KIT_NAMES_JA: Record<number, string> = {
  0: 'スタンダードキット',
  8: 'ルームキット',
  16: 'パワーキット',
  24: 'エレクトロニックキット',
  25: 'TR-808キット',
  32: 'ジャズキット',
  40: 'ブラシキット',
  48: 'オーケストラキット',
  56: 'SFXキット',
};

/** Suggested physical engine per GM family (index = family order). */
const FAMILY_ENGINE: PhysicalEngineMode[] = [
  'piano', // Piano
  'modal', // Chromatic Percussion
  'pipe-organ', // Organ
  'karplus-strong', // Guitar
  'karplus-strong', // Bass
  'bowed-string', // Strings
  'bowed-string', // Ensemble
  'brass', // Brass
  'reed', // Reed
  'flute', // Pipe
  'reed', // Synth Lead
  'bowed-string', // Synth Pad
  'modal', // Synth Effects
  'karplus-strong', // Ethnic
  'percussion', // Percussive
  'percussion', // Sound Effects
];

/** Per-program engine overrides where the family default is a poor match. */
const PROGRAM_ENGINE_OVERRIDE: Record<number, PhysicalEngineMode> = {
  6: 'karplus-strong', // Harpsichord (plucked string)
  7: 'karplus-strong', // Clavi (struck string + pickup, plucked-like)
  20: 'free-reed', // Reed Organ (free reed)
  21: 'free-reed', // Accordion (free reed)
  22: 'free-reed', // Harmonica (free reed)
  23: 'free-reed', // Bandoneon (free reed)
  46: 'karplus-strong', // Orchestral Harp (plucked)
  45: 'karplus-strong', // Pizzicato Strings
  47: 'percussion', // Timpani
  52: 'vocal', // Choir Aahs (source-filter vowel)
  53: 'vocal', // Voice Oohs
  54: 'vocal', // Synth Voice
  104: 'plucked-string', // Sitar (buzzing jawari bridge)
  105: 'karplus-strong', // Banjo
  106: 'plucked-string', // Shamisen (sawari buzzing bridge)
  107: 'plucked-string', // Koto (bridge-buzz plucked)
  108: 'modal', // Kalimba
  109: 'reed', // Bagpipe
  110: 'bowed-string', // Fiddle
  111: 'reed', // Shanai
};

/**
 * The non-physical NativeSynth engines. A GM slot voiced by one of these is
 * outside this tool's scope (it tunes only the twelve physical-model cores) — its
 * deep voicing is shaped on the subtractive/FM/additive engines instead.
 */
export type SynthMode = 'subtractive' | 'fm' | 'additive';

/** How a GM slot is voiced: a physical-model engine (tunable here) or a
 *  non-physical synth engine (out of scope — flagged in the UI). */
export type GmVoicing =
  | { kind: 'physical'; engine: PhysicalEngineMode }
  | { kind: 'synth'; mode: SynthMode };

/** Families whose voices are inherently non-physical (analog/DX/tonewheel). */
const FAMILY_SYNTH: Record<number, SynthMode> = {
  10: 'subtractive', // Synth Lead
  11: 'subtractive', // Synth Pad
  12: 'subtractive', // Synth Effects
  15: 'subtractive', // Sound Effects (noise / samples)
};

/** Per-program non-physical overrides inside otherwise-physical families. */
const PROGRAM_SYNTH_OVERRIDE: Record<number, SynthMode> = {
  4: 'fm', // Electric Piano 1 (Rhodes/DX heritage — FM-voiced)
  5: 'fm', // Electric Piano 2 (FM electric piano)
  16: 'additive', // Drawbar Organ (tonewheel — additive)
  17: 'additive', // Percussive Organ
  18: 'additive', // Rock Organ
  38: 'subtractive', // Synth Bass 1
  39: 'subtractive', // Synth Bass 2
  50: 'subtractive', // Synth Strings 1
  51: 'subtractive', // Synth Strings 2
  55: 'subtractive', // Orchestra Hit (sampled stab)
  62: 'subtractive', // Synth Brass 1
  63: 'subtractive', // Synth Brass 2
};

/** The physical engine best suited to voice a GM program (closest physical model
 *  even for slots a synth engine actually voices — used for the initial spec). */
export function gmEngineFor(program: number): PhysicalEngineMode {
  if (program in PROGRAM_ENGINE_OVERRIDE) return PROGRAM_ENGINE_OVERRIDE[program];
  const familyIndex = Math.min(GM_FAMILIES.length - 1, Math.floor(program / 8));
  return FAMILY_ENGINE[familyIndex];
}

/**
 * How libsonare's fallback bank voices this GM program. Returns a physical
 * engine (tunable in this tool) or a non-physical synth mode (out of scope).
 * Precedence: explicit synth override → explicit physical override → family
 * synth default → family physical default.
 */
export function gmVoicing(program: number): GmVoicing {
  if (program in PROGRAM_SYNTH_OVERRIDE) {
    return { kind: 'synth', mode: PROGRAM_SYNTH_OVERRIDE[program] };
  }
  if (program in PROGRAM_ENGINE_OVERRIDE) {
    return { kind: 'physical', engine: PROGRAM_ENGINE_OVERRIDE[program] };
  }
  const familyIndex = Math.min(GM_FAMILIES.length - 1, Math.floor(program / 8));
  if (familyIndex in FAMILY_SYNTH) {
    return { kind: 'synth', mode: FAMILY_SYNTH[familyIndex] };
  }
  return { kind: 'physical', engine: FAMILY_ENGINE[familyIndex] };
}

/** A resonator-body choice with its wet-mix weight. */
export interface GmBody {
  body: BodyType;
  mix: number;
}

/**
 * Programs whose resonator body is implied by the instrument itself, overriding
 * the exciter engine's generic default. The bare Karplus-Strong loop supplies no
 * corpus, so plucked acoustic strings (guitars, harp, sitar/koto family) need a
 * hollow wooden body added explicitly — otherwise they sound like a raw string
 * with no soundbox. Keyed by GM program; anything absent inherits the engine's
 * `defaultBody`/`defaultBodyMix`.
 */
const PROGRAM_BODY_OVERRIDE: Record<number, GmBody> = {
  24: { body: 'guitar', mix: 0.35 }, // Nylon guitar
  25: { body: 'guitar', mix: 0.32 }, // Steel guitar
  26: { body: 'guitar', mix: 0.28 }, // Jazz guitar
  27: { body: 'guitar', mix: 0.22 }, // Clean guitar
  28: { body: 'guitar', mix: 0.18 }, // Muted guitar
  29: { body: 'guitar', mix: 0.2 }, // Overdriven guitar
  30: { body: 'guitar', mix: 0.2 }, // Distortion guitar
  31: { body: 'guitar', mix: 0.24 }, // Guitar harmonics
  32: { body: 'guitar', mix: 0.25 }, // Acoustic bass
  46: { body: 'guitar', mix: 0.3 }, // Harp (soundboard)
  104: { body: 'guitar', mix: 0.28 }, // Sitar
  105: { body: 'guitar', mix: 0.3 }, // Banjo
  106: { body: 'guitar', mix: 0.22 }, // Shamisen
  107: { body: 'guitar', mix: 0.3 }, // Koto
};

/**
 * The resonator body implied by a GM program. Falls back to the exciter engine's
 * built-in default when the program carries no stronger implication, so this is
 * the body the tuner locks to when a covered target is selected.
 */
export function gmBody(program: number): GmBody {
  const override = PROGRAM_BODY_OVERRIDE[program];
  if (override) return override;
  const info = ENGINE_INFO[gmEngineFor(program)];
  return { body: info.defaultBody, mix: info.defaultBodyMix };
}

/** The representative A/B note for a GM program (its family's note). */
export function gmNoteFor(program: number): number {
  const familyIndex = Math.min(GM_FAMILIES.length - 1, Math.floor(program / 8));
  return GM_FAMILIES[familyIndex].note;
}
