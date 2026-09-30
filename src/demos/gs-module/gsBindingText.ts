/**
 * Localized labels for the modern insertion-chain targets in a binding row.
 * The raw stage and key names are engine identifiers; this module is the only
 * place the inspector turns them into reader-facing text.
 */
import type { GsEfxBinding, GsEfxTarget } from './gsEfx';
import { bindingTargets } from './gsEfx';
import { GS_EFX_PARAMS, GS_EFX_STAGES } from './gsNames';

/** A target as the inspector prints it. */
export interface GsBindingLabel {
  /** The insert's localized name, including an ordinal where needed. */
  stage: string;
  /** The localized control names, including band numbers where present. */
  param: string;
}

/** `band1.frequencyHz` — a numbered band, dotted into its own leaf. */
const BAND_DOTTED_KEY = /^band(\d+)\.(.+)$/;
/** `band11GainDb` — a graphic-EQ fixed band, concatenated with no dot. */
const BAND_GAIN_KEY = /^band(\d+)GainDb$/;

function bandLabel(index: string, ja: boolean): string {
  return ja ? `バンド ${index}` : `Band ${index}`;
}

function paramName(leaf: string, ja: boolean): string {
  const name = GS_EFX_PARAMS[leaf];
  return name ? (ja ? name.ja : name.en) : leaf;
}

/** The display name for one binding key, keeping the band number it carries. */
function keyLabel(key: string, ja: boolean): string {
  const dotted = BAND_DOTTED_KEY.exec(key);
  if (dotted) {
    const [, index, leaf] = dotted;
    return `${bandLabel(index, ja)} · ${paramName(leaf, ja)}`;
  }
  const bandGain = BAND_GAIN_KEY.exec(key);
  if (bandGain) {
    const [, index] = bandGain;
    return `${bandLabel(index, ja)} · ${paramName('gainDb', ja)}`;
  }
  return paramName(key, ja);
}

export function localizedStageName(stage: string, ja: boolean): string {
  const name = GS_EFX_STAGES[stage];
  return name ? (ja ? name.ja : name.en) : stage;
}

export function localizedOrdinalName(stage: string, ordinal: number, ja: boolean): string {
  if (ordinal === 0) return stage;
  return ja ? `${stage} ${ordinal + 1}系統目` : `${stage} ${ordinal + 1}`;
}

function targetLabel(target: GsEfxTarget, ja: boolean): GsBindingLabel {
  return {
    stage: localizedOrdinalName(localizedStageName(target.stage, ja), target.ordinal, ja),
    param: target.keys.map((key) => keyLabel(key, ja)).join(' / '),
  };
}

/** Every primary and alternative target, with ordinal lists expanded. */
export function bindingLabels(binding: GsEfxBinding, ja: boolean): GsBindingLabel[] {
  return bindingTargets(binding).map((target) => targetLabel(target, ja));
}

/** The combined label for a row, retained for callers that need one string pair. */
export function bindingLabel(binding: GsEfxBinding, ja: boolean): GsBindingLabel | null {
  const labels = bindingLabels(binding, ja);
  if (labels.length === 0) return null;
  return {
    stage: labels.map((label) => label.stage).join(' / '),
    param: labels.map((label) => label.param).join(' / '),
  };
}
