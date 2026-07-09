/**
 * GS drum-kit variation transforms, a 1:1 port of the core's
 * `gm_fallback_drum_kit` / `apply_gs_drum_kit` (`gm_fallback_map.cpp`).
 *
 * The core stores one Standard-kit patch per drum note and derives every GS kit
 * (Room / Power / Electronic / TR-808 / Jazz / Brush / Orchestra) as a per-voice
 * transform applied at note-on. The tuner mirrors that split: the editable spec
 * is always the Standard base patch, and a kit is applied at RENDER time only
 * (never baked into the edited params) — otherwise an exported patch fed back to
 * the core would apply the kit twice.
 */
import type { AmpEnvSpec, ModelSpec } from './engine';
import type { PercussionPatchParams } from './percussion-voice';

/** GS drum-kit index (1..8) for a channel-10 program; 0 = Standard. */
export function gsDrumKitIndex(program: number): number {
  switch (program & 0x7f) {
    case 8:
      return 1; // Room
    case 16:
      return 2; // Power
    case 24:
      return 3; // Electronic
    case 25:
      return 4; // TR-808
    case 32:
      return 5; // Jazz
    case 40:
      return 6; // Brush
    case 48:
      return 7; // Orchestra
    case 56:
      return 8; // SFX
    default:
      return 0; // Standard
  }
}

/**
 * Apply a GS kit transform to a percussion patch + amp stage in place and return
 * the gain multiplier the kit applies (1 when untouched). `note` selects the
 * per-class behaviour (kick / snare / tom / cymbal). Mirrors `apply_gs_drum_kit`.
 */
export function applyGsDrumKit(
  perc: PercussionPatchParams,
  amp: AmpEnvSpec,
  kit: number,
  note: number,
): number {
  const kick = note === 35 || note === 36;
  const snare = note === 38 || note === 40;
  const tom =
    note === 41 || note === 43 || note === 45 || note === 47 || note === 48 || note === 50;
  const cymbal =
    note === 49 ||
    note === 51 ||
    note === 52 ||
    note === 53 ||
    note === 55 ||
    note === 57 ||
    note === 59;
  const membrane = kick || snare || tom;
  let gain = 1.0;
  switch (kit) {
    case 1: // Room: more shell body and a longer, ambient tail.
      perc.shellMix = Math.min(perc.shellMix + 0.12, 1.0);
      perc.shellT60S = perc.shellT60S.map((t60) => t60 * 1.6);
      perc.modeDecayS *= 1.15;
      perc.noiseDecayMs *= 1.25;
      amp.decayMs *= 1.25;
      break;
    case 2: // Power (Rock): bigger, lower, longer shells.
      if (membrane) {
        perc.baseFreqHz *= 0.86;
        perc.modeDecayS *= 1.4;
        amp.decayMs *= 1.4;
        gain = 1.2;
      }
      break;
    case 3: // Electronic: sine-ify the membranes and dry them out.
      if (membrane) {
        if (perc.numModes > 1) perc.numModes = 1;
        perc.baseFreqHz *= 0.92;
        perc.pitchDrop = Math.max(perc.pitchDrop, 0.5);
        perc.noiseGain *= 0.5;
      }
      break;
    case 4: // TR-808: the iconic decaying-sine recipes.
      if (kick) {
        perc.numModes = 1;
        perc.baseFreqHz *= 0.82;
        perc.pitchDrop = 1.0;
        perc.pitchDropMs = 60.0;
        perc.modeDecayS *= 2.5;
        amp.decayMs *= 2.5;
        perc.noiseGain *= 0.3;
        gain = 1.2;
      } else if (snare) {
        perc.numModes = 1;
        perc.noiseGain *= 1.2;
        perc.modeDecayS *= 0.8;
      } else if (tom) {
        perc.numModes = 1;
        perc.baseFreqHz *= 0.9;
        perc.pitchDrop = Math.max(perc.pitchDrop, 0.6);
        perc.noiseGain *= 0.4;
      } else if (cymbal) {
        perc.noiseCutoffHz = Math.min(perc.noiseCutoffHz * 1.2, 18000.0);
      }
      break;
    case 5: // Jazz: tighter, higher, softer.
      if (membrane) {
        perc.baseFreqHz *= 1.06;
        perc.modeDecayS *= 0.8;
        amp.decayMs *= 0.8;
        gain = 0.9;
      }
      break;
    case 6: // Brush: the snare becomes a sustained swish, not a crack.
      if (snare) {
        perc.noiseDecayMs *= 2.5;
        amp.decayMs *= 2.0;
        perc.noiseCutoffHz *= 0.8;
        perc.wireBuzz *= 0.4;
        gain = 0.85;
      } else if (membrane) {
        gain = 0.9;
      }
      break;
    case 7: // Orchestra: concert bass drum / timpani rings, longer cymbals.
      if (membrane) {
        perc.modeDecayS *= 2.0;
        amp.decayMs *= 2.0;
      } else if (cymbal) {
        perc.modeDecayS *= 1.5;
        amp.decayMs *= 1.5;
      }
      break;
    default: // 8 = SFX (Standard voicing in GS), 0 = Standard.
      break;
  }
  return gain;
}

/**
 * Return a clone of `spec` with the GS kit (from a channel-10 `program`) applied
 * to its percussion params, amp stage, and gain — the render-time view of how a
 * Standard base patch sounds under the chosen kit. Non-percussion specs and the
 * Standard kit pass through untouched.
 */
export function withGsDrumKit(spec: ModelSpec, program: number, note: number): ModelSpec {
  const kit = gsDrumKitIndex(program);
  if (kit === 0 || !spec.percussion) return spec;
  const perc: PercussionPatchParams = {
    ...spec.percussion,
    modeRatios: spec.percussion.modeRatios.slice(),
    modeM: spec.percussion.modeM.slice(),
    modeAlpha: spec.percussion.modeAlpha.slice(),
    shellFreqHz: spec.percussion.shellFreqHz.slice(),
    shellT60S: spec.percussion.shellT60S.slice(),
    shellWeight: spec.percussion.shellWeight.slice(),
  };
  const ampEnv: AmpEnvSpec = { ...spec.ampEnv };
  const kitGain = applyGsDrumKit(perc, ampEnv, kit, note & 0x7f);
  return { ...spec, percussion: perc, ampEnv, gain: spec.gain * kitGain };
}
