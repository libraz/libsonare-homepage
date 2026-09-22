/**
 * Turning a joined {@link GsEfxBinding} into what a reader sees: which insert
 * a bound slot reaches and which control on it, or the engine's own reason a
 * slot reaches nothing.
 */
import type { GsEfxBinding } from './gsEfx';
import { GS_BINDING_REASONS, GS_EFX_PARAMS, GS_EFX_STAGES } from './gsNames';

/** A bound slot as a reader sees it: which insert, and which control on it. */
export interface GsBindingLabel {
  /** The insert's name, localized. */
  stage: string;
  /** The control's name, localized, including a band number where the key carries one. */
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

/** The display name for one binding key, band number kept as the key spells it. */
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

/** The label for a slot that reaches a control, or null for every other form. */
export function bindingLabel(binding: GsEfxBinding, ja: boolean): GsBindingLabel | null {
  if (binding.form !== 'stage' || binding.stage === null) return null;
  const stageName = GS_EFX_STAGES[binding.stage];
  return {
    stage: stageName ? (ja ? stageName.ja : stageName.en) : binding.stage,
    param: binding.keys.map((key) => keyLabel(key, ja)).join(' / '),
  };
}

/** The engine's reason a byte reaches nothing, localized, falling back to its own wording. */
export function bindingReason(binding: GsEfxBinding, ja: boolean): string | null {
  if (binding.reason === null) return null;
  if (!ja) return binding.reason;
  return GS_BINDING_REASONS[binding.reason] ?? binding.reason;
}
