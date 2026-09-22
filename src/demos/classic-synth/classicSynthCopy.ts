/**
 * The label vocabulary the whole page shares.
 *
 * Every panel, chapter and matrix cell names the same field, so the names live
 * once. A component adding a label of its own for something already named here
 * is how two parts of one screen start calling the same control two things.
 *
 * Prose stays in the component that shows it. This file is nouns.
 */
import type {
  BodyName,
  FilterModelName,
  FilterOutputName,
  ModDestinationName,
  ModRequirement,
  ModSourceName,
  NumericParamKey,
  ParamGroup,
  ParamUnit,
  WaveformName,
} from './classicSynthState';

/** A display name in both languages the site serves. */
export interface LocalizedName {
  en: string;
  ja: string;
}

export const GROUP_NAMES: Readonly<Record<ParamGroup, LocalizedName>> = {
  osc: { en: 'Oscillator', ja: 'オシレータ' },
  filter: { en: 'Filter', ja: 'フィルタ' },
  amp: { en: 'Amp envelope', ja: 'アンプエンベロープ' },
  'filter-env': { en: 'Filter envelope', ja: 'フィルタエンベロープ' },
  lfo: { en: 'LFO', ja: 'LFO' },
  body: { en: 'Body', ja: 'ボディ' },
  out: { en: 'Output', ja: '出力' },
};

export const PARAM_NAMES: Readonly<Record<NumericParamKey, LocalizedName>> = {
  unison: { en: 'Unison', ja: 'ユニゾン' },
  detuneCents: { en: 'Detune', ja: 'デチューン' },
  driftCents: { en: 'Drift', ja: 'ドリフト' },
  drive: { en: 'Drive', ja: 'ドライブ' },

  cutoffHz: { en: 'Cutoff', ja: 'カットオフ' },
  resonanceQ: { en: 'Resonance', ja: 'レゾナンス' },
  hpCutoffHz: { en: 'High-pass', ja: 'ハイパス' },
  keyTrack: { en: 'Key tracking', ja: 'キートラック' },
  envToCutoffCents: { en: 'Envelope amount', ja: 'エンベロープ量' },
  velToCutoffCents: { en: 'Velocity amount', ja: 'ベロシティ量' },

  ampAttackMs: { en: 'Attack', ja: 'アタック' },
  ampDecayMs: { en: 'Decay', ja: 'ディケイ' },
  ampSustain: { en: 'Sustain', ja: 'サステイン' },
  ampReleaseMs: { en: 'Release', ja: 'リリース' },

  filterAttackMs: { en: 'Attack', ja: 'アタック' },
  filterDecayMs: { en: 'Decay', ja: 'ディケイ' },
  filterSustain: { en: 'Sustain', ja: 'サステイン' },
  filterReleaseMs: { en: 'Release', ja: 'リリース' },

  lfoRateHz: { en: 'LFO 1 rate', ja: 'LFO 1 レート' },
  lfoToPitchCents: { en: 'LFO 1 to pitch', ja: 'LFO 1 → ピッチ' },
  lfo2RateHz: { en: 'LFO 2 rate', ja: 'LFO 2 レート' },

  bodyMix: { en: 'Body mix', ja: 'ボディミックス' },

  glideMs: { en: 'Glide', ja: 'グライド' },
  stereoSpread: { en: 'Width', ja: '広がり' },
  gain: { en: 'Gain', ja: 'ゲイン' },
  busDrive: { en: 'Bus drive', ja: 'バスドライブ' },
};

export const WAVEFORM_NAMES: Readonly<Record<WaveformName, LocalizedName>> = {
  sine: { en: 'Sine', ja: '正弦波' },
  saw: { en: 'Saw', ja: 'のこぎり波' },
  square: { en: 'Square', ja: '矩形波' },
  triangle: { en: 'Triangle', ja: '三角波' },
  noise: { en: 'Noise', ja: 'ノイズ' },
};

export const FILTER_MODEL_NAMES: Readonly<Record<FilterModelName, LocalizedName>> = {
  svf: { en: 'State variable', ja: 'ステートバリアブル' },
  'moog-ladder': { en: 'Transistor ladder', ja: 'トランジスタラダー' },
  'diode-ladder': { en: 'Diode ladder', ja: 'ダイオードラダー' },
  'sallen-key': { en: 'Sallen-Key', ja: 'ザレンキー' },
};

export const FILTER_OUTPUT_NAMES: Readonly<Record<FilterOutputName, LocalizedName>> = {
  lowpass: { en: 'Low-pass', ja: 'ローパス' },
  bandpass: { en: 'Band-pass', ja: 'バンドパス' },
  highpass: { en: 'High-pass', ja: 'ハイパス' },
};

export const BODY_NAMES: Readonly<Record<BodyName, LocalizedName>> = {
  none: { en: 'None', ja: 'なし' },
  guitar: { en: 'Guitar', ja: 'ギター' },
  violin: { en: 'Violin', ja: 'バイオリン' },
  'wood-tube': { en: 'Wood tube', ja: '木管' },
  'brass-bell': { en: 'Brass bell', ja: '金管ベル' },
  vocal: { en: 'Vocal', ja: '声' },
};

export const MOD_SOURCE_NAMES: Readonly<Record<ModSourceName, LocalizedName>> = {
  'amp-env': { en: 'Amp env', ja: 'アンプ EG' },
  'filter-env': { en: 'Filter env', ja: 'フィルタ EG' },
  lfo1: { en: 'LFO 1', ja: 'LFO 1' },
  lfo2: { en: 'LFO 2', ja: 'LFO 2' },
  velocity: { en: 'Velocity', ja: 'ベロシティ' },
  'key-track': { en: 'Key', ja: 'キー' },
  'mod-wheel': { en: 'Mod wheel', ja: 'モジュレーション' },
  random: { en: 'Random', ja: 'ランダム' },
  breath: { en: 'Breath', ja: 'ブレス' },
  aftertouch: { en: 'Aftertouch', ja: 'アフタータッチ' },
  'expression-cc': { en: 'Expression', ja: 'エクスプレッション' },
  'pitch-bend': { en: 'Pitch bend', ja: 'ピッチベンド' },
};

export const MOD_DESTINATION_NAMES: Readonly<Record<ModDestinationName, LocalizedName>> = {
  'pitch-cents': { en: 'Pitch', ja: 'ピッチ' },
  'cutoff-cents': { en: 'Cutoff', ja: 'カットオフ' },
  'amp-gain': { en: 'Level', ja: 'レベル' },
  'pan-units': { en: 'Pan', ja: 'パン' },
  'resonance-q': { en: 'Resonance', ja: 'レゾナンス' },
  'vibrato-depth-cents': { en: 'Vibrato depth', ja: 'ビブラート深さ' },
  'filter-env-depth': { en: 'Filter env amount', ja: 'フィルタ EG 量' },
  'lfo1-rate-scale': { en: 'LFO 1 rate', ja: 'LFO 1 レート' },
};

/** Why a destination would be silent, said in the terms of the control that fixes it. */
export const REQUIREMENT_NOTES: Readonly<Record<ModRequirement, LocalizedName>> = {
  'filter-env': {
    en: 'Silent while the filter envelope amount is zero — there is nothing for it to scale.',
    ja: 'フィルタのエンベロープ量が 0 のあいだは無音です。スケールする対象そのものがありません。',
  },
  'lfo1-audible': {
    en: 'Silent while LFO 1 drives nothing. Give it a pitch amount, or route it somewhere first.',
    ja: 'LFO 1 が何も動かしていないあいだは無音です。ピッチ量を与えるか、先にどこかへ結線してください。',
  },
};

/** Spell a value in its own unit, short enough to sit beside a control. */
export function formatValue(value: number, unit: ParamUnit): string {
  switch (unit) {
    case 'hz':
      return value >= 1000 ? `${(value / 1000).toFixed(2)} kHz` : `${Math.round(value)} Hz`;
    case 'ms':
      return value >= 1000 ? `${(value / 1000).toFixed(2)} s` : `${Math.round(value)} ms`;
    case 'cents':
      return `${Math.round(value)} ¢`;
    case 'count':
      return String(Math.round(value));
    default:
      return value.toFixed(2);
  }
}
