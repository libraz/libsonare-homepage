/**
 * Per-note percussion seed specs for GM drum keys, mirroring the libsonare
 * core's drum note table (`gm_fallback_map.cpp`, build_drum_patches +
 * build_drum_note_table). Selecting a drum target in the tuner seeds the model
 * with the note's current built-in voicing, so the A/B "adjusted" trace starts
 * at "today's sound" — a contributor tunes a snare from a snare, a hi-hat from
 * a hi-hat, instead of from a generic tom.
 *
 * The values are transcribed 1:1 from the core so the seed stays a faithful
 * starting point; the amp stage carries the core's one-shot DAHDSR times
 * (sustain 0) rather than the tuner's sustained default.
 */
import type { AmpEnvSpec, ModelSpec } from './engine';
import { defaultPercussionParams, type PercussionPatchParams } from './percussion-voice';

/** Mechanism category of a GM drum note, mirroring the core's archetypes. */
export type DrumCategory =
  | 'kick'
  | 'snare'
  | 'tom'
  | 'closed-hat'
  | 'open-hat'
  | 'cymbal'
  | 'wood'
  | 'metal'
  | 'membrane'
  | 'whistle'
  | 'clap'
  | 'shaker'
  | 'scraper'
  | 'generic';

/** The core's `env(attack, decay, sustain, release)` helper (DahdsrConfig). */
function env(attackMs: number, decayMs: number, sustain: number, releaseMs: number): AmpEnvSpec {
  return { attackMs, decayMs, sustain, releaseMs };
}

/** A percussion seed piece: the deep params plus its amp stage and gain. */
interface DrumPiece {
  percussion: PercussionPatchParams;
  ampEnv: AmpEnvSpec;
  gain: number;
}

/** Base percussion params shared by every kit piece (the core's `piece`). */
function basePiece(): PercussionPatchParams {
  return defaultPercussionParams();
}

// ---- base kit archetypes (build_drum_patches) -----------------------------

function kickPiece(): DrumPiece {
  const p = basePiece();
  p.numModes = 2;
  p.modeDecayS = 0.22;
  p.pitchDrop = 1.5;
  p.pitchDropMs = 45;
  p.noiseGain = 0.35;
  p.noiseDecayMs = 20;
  p.noiseCutoffHz = 900;
  p.noiseOutput = 'lowpass';
  p.strikeR = 0.12;
  p.shellMix = 0.18;
  p.shellNumModes = 1;
  p.shellFreqHz = [80, 0, 0, 0];
  p.shellT60S = [0.14, 0, 0, 0];
  p.shellWeight = [1, 0, 0, 0];
  return { percussion: p, ampEnv: env(0.5, 220, 0, 60), gain: 1.1 };
}

function snarePiece(): DrumPiece {
  const p = basePiece();
  p.numModes = 5;
  p.baseFreqHz = 185;
  p.modeDecayS = 0.12;
  p.toneGain = 0.7;
  p.pitchDrop = 0.4;
  p.pitchDropMs = 25;
  p.noiseGain = 1.1;
  p.noiseDecayMs = 160;
  p.noiseCutoffHz = 1800;
  p.noiseQ = 0.9;
  p.strikeR = 0.55;
  p.shellMix = 0.2;
  p.shellNumModes = 2;
  p.shellFreqHz = [330, 480, 0, 0];
  p.shellT60S = [0.08, 0.05, 0, 0];
  p.shellWeight = [1, 0.6, 0, 0];
  p.wireBuzz = 0.9;
  p.wireThreshold = 0.08;
  p.wireCutoffHz = 4500;
  return { percussion: p, ampEnv: env(0.5, 250, 0, 80), gain: 0.8 };
}

function closedHatPiece(): DrumPiece {
  const p = basePiece();
  p.noiseGain = 1.0;
  p.noiseDecayMs = 35;
  p.noiseCutoffHz = 7500;
  p.noiseOutput = 'highpass';
  return { percussion: p, ampEnv: env(0.5, 90, 0, 40), gain: 0.5 };
}

function openHatPiece(): DrumPiece {
  const piece = closedHatPiece();
  piece.percussion.noiseDecayMs = 350;
  piece.ampEnv = env(0.5, 550, 0, 150);
  return piece;
}

function tomPiece(): DrumPiece {
  const p = basePiece();
  p.numModes = 5;
  p.modeDecayS = 0.3;
  p.pitchDrop = 0.6;
  p.pitchDropMs = 55;
  p.noiseGain = 0.25;
  p.noiseDecayMs = 30;
  p.noiseCutoffHz = 1500;
  p.strikeR = 0.6;
  p.shellMix = 0.25;
  p.shellNumModes = 2;
  p.shellFreqHz = [0, 330, 0, 0];
  p.shellT60S = [0.12, 0.06, 0, 0];
  p.shellWeight = [1, 0.4, 0, 0];
  return { percussion: p, ampEnv: env(0.5, 400, 0, 120), gain: 1.0 };
}

function cymbalPiece(): DrumPiece {
  const p = basePiece();
  p.numModes = 4;
  p.modeRatios = [1.0, 1.34, 1.72, 2.15, 0, 0];
  p.baseFreqHz = 3600;
  p.modeDecayS = 1.1;
  p.toneGain = 0.25;
  p.noiseGain = 0.9;
  p.noiseDecayMs = 900;
  p.noiseCutoffHz = 5500;
  p.noiseOutput = 'highpass';
  p.shimmer = 6.0;
  p.shimmerAttackMs = 60;
  p.shimmerCutoffHz = 9000;
  return { percussion: p, ampEnv: env(0.5, 1400, 0, 400), gain: 0.5 };
}

/** The generic short-burst voice every unmapped key falls back to. */
function genericPiece(): DrumPiece {
  const p = basePiece();
  p.numModes = 1;
  p.modeDecayS = 0.08;
  p.toneGain = 0.4;
  p.noiseGain = 0.9;
  p.noiseDecayMs = 110;
  p.noiseCutoffHz = 2500;
  p.noiseQ = 1.5;
  return { percussion: p, ampEnv: env(0.5, 200, 0, 80), gain: 0.7 };
}

// ---- fixed-pitch idiophone builders (build_drum_note_table lambdas) --------

function membrane(
  baseHz: number,
  decayS: number,
  drop: number,
  shellHz: number,
  gain: number,
): DrumPiece {
  const p = basePiece();
  p.numModes = 5;
  p.baseFreqHz = baseHz;
  p.modeDecayS = decayS;
  p.pitchDrop = drop;
  p.pitchDropMs = 30;
  p.toneGain = 0.8;
  p.noiseGain = 0.2;
  p.noiseDecayMs = 18;
  p.noiseCutoffHz = 2000;
  p.strikeR = 0.55;
  if (shellHz > 0) {
    p.shellMix = 0.2;
    p.shellNumModes = 1;
    p.shellFreqHz = [shellHz, 0, 0, 0];
    p.shellT60S = [0.06, 0, 0, 0];
    p.shellWeight = [1, 0, 0, 0];
  }
  return { percussion: p, ampEnv: env(0.5, decayS * 1000 + 120, 0, 40), gain };
}

function wood(baseHz: number, ratio2: number, decayS: number, gain: number): DrumPiece {
  const p = basePiece();
  p.numModes = ratio2 > 0 ? 2 : 1;
  p.modeRatios = [1.0, ratio2, 0, 0, 0, 0];
  p.baseFreqHz = baseHz;
  p.modeDecayS = decayS;
  p.toneGain = 0.9;
  p.noiseGain = 0.3;
  p.noiseDecayMs = 4;
  p.noiseCutoffHz = baseHz * 2;
  p.noiseOutput = 'bandpass';
  return { percussion: p, ampEnv: env(0.3, decayS * 1000 + 40, 0, 20), gain };
}

function metal(
  baseHz: number,
  ratios: number[],
  nmodes: number,
  decayS: number,
  gain: number,
): DrumPiece {
  const p = basePiece();
  p.numModes = nmodes;
  p.modeRatios = ratios.slice();
  p.baseFreqHz = baseHz;
  p.modeDecayS = decayS;
  p.toneGain = 0.5;
  p.noiseGain = 0.15;
  p.noiseDecayMs = 8;
  p.noiseCutoffHz = baseHz * 3;
  p.noiseOutput = 'bandpass';
  return { percussion: p, ampEnv: env(0.3, decayS * 1000 + 60, 0, 30), gain };
}

function whistle(baseHz: number, decayS: number, gain: number): DrumPiece {
  const p = basePiece();
  p.numModes = 1;
  p.modeRatios = [1.0, 0, 0, 0, 0, 0];
  p.baseFreqHz = baseHz;
  p.modeDecayS = decayS;
  p.toneGain = 0.8;
  p.noiseGain = 0.4;
  p.noiseDecayMs = decayS * 1000;
  p.noiseCutoffHz = baseHz;
  p.noiseQ = 4.0;
  p.noiseOutput = 'bandpass';
  return { percussion: p, ampEnv: env(3.0, decayS * 1000 + 40, 0, 25), gain };
}

function shaker(
  beans: number,
  energyMs: number,
  resHz: number,
  resQ: number,
  gain: number,
): DrumPiece {
  const p = basePiece();
  p.phisemBeans = beans;
  p.phisemEnergyMs = energyMs;
  p.phisemSoundMs = 3.0;
  p.phisemResHz = resHz;
  p.phisemResQ = resQ;
  return { percussion: p, ampEnv: env(0.5, energyMs + 200, 0, 40), gain };
}

function scrape(
  beans: number,
  energyMs: number,
  scrapeHz: number,
  resHz: number,
  resQ: number,
  glide: number,
  gain: number,
): DrumPiece {
  const p = basePiece();
  p.phisemBeans = beans;
  p.phisemEnergyMs = energyMs;
  p.phisemSoundMs = 4.0;
  p.phisemScrapeHz = scrapeHz;
  p.phisemResHz = resHz;
  p.phisemResQ = resQ;
  p.phisemPitchGlide = glide;
  return { percussion: p, ampEnv: env(0.5, energyMs + 200, 0, 40), gain };
}

function clapPiece(): DrumPiece {
  const p = basePiece();
  p.noiseGain = 1.0;
  p.noiseDecayMs = 90;
  p.noiseCutoffHz = 1300;
  p.noiseQ = 1.2;
  p.noiseOutput = 'bandpass';
  return { percussion: p, ampEnv: env(0.5, 120, 0, 40), gain: 0.7 };
}

// ---- note table ------------------------------------------------------------

const TRIANGLE_RATIOS = [1.0, 2.76, 5.4, 8.9, 0, 0];

/** Build the DrumPiece for a GM drum note, mirroring build_drum_note_table. */
function pieceForNote(note: number): DrumPiece {
  switch (note) {
    // kit archetypes
    case 35:
    case 36:
      return kickPiece();
    case 38:
    case 40:
      return snarePiece();
    case 42:
    case 44: {
      const piece = closedHatPiece();
      piece.percussion.exclusiveClass = 1;
      return piece;
    }
    case 46: {
      const piece = openHatPiece();
      piece.percussion.exclusiveClass = 1;
      piece.ampEnv.releaseMs = 40;
      return piece;
    }
    case 41:
    case 43:
    case 45:
    case 47:
    case 48:
    case 50:
      return tomPiece();
    case 49:
    case 51:
    case 52:
    case 55:
    case 57:
    case 59:
      return cymbalPiece();
    // wooden idiophones + clicks
    case 31:
      return wood(1000, 0, 0.03, 0.6);
    case 32:
      return wood(1000, 0, 0.02, 0.5);
    case 33:
      return wood(1200, 0, 0.02, 0.5);
    case 37:
      return wood(820, 0, 0.05, 0.7);
    case 75:
      return wood(2500, 0, 0.025, 0.6);
    case 76:
      return wood(1200, 0, 0.06, 0.6);
    case 77:
      return wood(800, 0, 0.07, 0.6);
    case 85:
      return wood(1800, 0, 0.02, 0.5);
    // metal idiophones + bells
    case 34:
      return metal(1500, [1.0, 2.8, 5.4, 0, 0, 0], 3, 0.3, 0.4);
    case 53:
      return metal(1200, [1.0, 1.5, 2.6, 0, 0, 0], 3, 0.6, 0.4);
    case 56:
      return metal(587, [1.0, 1.44, 0, 0, 0, 0], 2, 0.25, 0.5);
    case 67:
      return metal(1200, [1.0, 2.7, 0, 0, 0, 0], 2, 0.25, 0.45);
    case 68:
      return metal(900, [1.0, 2.7, 0, 0, 0, 0], 2, 0.3, 0.45);
    case 83:
      return metal(2500, [1.0, 1.7, 2.4, 0, 0, 0], 3, 0.4, 0.35);
    case 84:
      return metal(3000, [1.0, 1.6, 2.3, 3.1, 0, 0], 4, 1.5, 0.3);
    case 80: {
      const piece = metal(5000, TRIANGLE_RATIOS, 4, 0.15, 0.35);
      piece.percussion.exclusiveClass = 3;
      return piece;
    }
    case 81: {
      const piece = metal(5000, TRIANGLE_RATIOS, 4, 1.2, 0.35);
      piece.percussion.exclusiveClass = 3;
      return piece;
    }
    // fixed-pitch membranes
    case 60:
      return membrane(260, 0.18, 0.3, 0, 0.7);
    case 61:
      return membrane(180, 0.2, 0.3, 0, 0.7);
    case 62:
      return membrane(220, 0.08, 0.2, 0, 0.7);
    case 63:
      return membrane(200, 0.25, 0.3, 0, 0.7);
    case 64:
      return membrane(130, 0.3, 0.35, 0, 0.75);
    case 65:
      return membrane(250, 0.22, 0.2, 700, 0.7);
    case 66:
      return membrane(200, 0.26, 0.2, 550, 0.7);
    case 86: {
      const piece = membrane(95, 0.12, 0.4, 0, 0.8);
      piece.percussion.exclusiveClass = 6;
      return piece;
    }
    case 87: {
      const piece = membrane(80, 0.4, 0.5, 0, 0.85);
      piece.percussion.exclusiveClass = 6;
      return piece;
    }
    // whistles + hand clap
    case 71: {
      const piece = whistle(1400, 0.12, 0.5);
      piece.percussion.exclusiveClass = 4;
      return piece;
    }
    case 72: {
      const piece = whistle(1400, 0.5, 0.5);
      piece.percussion.exclusiveClass = 4;
      return piece;
    }
    case 39:
      return clapPiece();
    // PhISEM shakers + scrapers
    case 54:
      return shaker(32, 120, 2500, 2.0, 0.5);
    case 58:
      return shaker(24, 400, 2500, 3.0, 0.45);
    case 69:
      return shaker(24, 90, 4000, 1.0, 0.5);
    case 70:
      return shaker(20, 90, 3200, 1.5, 0.5);
    case 82:
      return shaker(28, 110, 6000, 1.0, 0.5);
    case 73: {
      const piece = scrape(8, 120, 150, 2500, 3.0, 0.0, 0.5);
      piece.percussion.exclusiveClass = 5;
      return piece;
    }
    case 74: {
      const piece = scrape(8, 500, 120, 2500, 3.0, 0.0, 0.5);
      piece.percussion.exclusiveClass = 5;
      return piece;
    }
    case 78: {
      const piece = scrape(6, 120, 40, 400, 3.0, -0.3, 0.55);
      piece.percussion.exclusiveClass = 2;
      return piece;
    }
    case 79: {
      const piece = scrape(6, 250, 40, 500, 3.0, 0.5, 0.55);
      piece.percussion.exclusiveClass = 2;
      return piece;
    }
    default:
      return genericPiece();
  }
}

/** Classify a GM drum note into its mechanism category (for UI labelling). */
export function drumCategoryFor(note: number): DrumCategory {
  switch (note) {
    case 35:
    case 36:
      return 'kick';
    case 38:
    case 40:
      return 'snare';
    case 41:
    case 43:
    case 45:
    case 47:
    case 48:
    case 50:
      return 'tom';
    case 42:
    case 44:
      return 'closed-hat';
    case 46:
      return 'open-hat';
    case 49:
    case 51:
    case 52:
    case 55:
    case 57:
    case 59:
      return 'cymbal';
    case 31:
    case 32:
    case 33:
    case 37:
    case 75:
    case 76:
    case 77:
    case 85:
      return 'wood';
    case 34:
    case 53:
    case 56:
    case 67:
    case 68:
    case 80:
    case 81:
    case 83:
    case 84:
      return 'metal';
    case 60:
    case 61:
    case 62:
    case 63:
    case 64:
    case 65:
    case 66:
    case 86:
    case 87:
      return 'membrane';
    case 71:
    case 72:
      return 'whistle';
    case 39:
      return 'clap';
    case 54:
    case 58:
    case 69:
    case 70:
    case 82:
      return 'shaker';
    case 73:
    case 74:
    case 78:
    case 79:
      return 'scraper';
    default:
      return 'generic';
  }
}

/**
 * Build the full percussion ModelSpec seed for a GM drum note. The wrapper is
 * kept minimal (no body, no drive) so the percussion core owns the sound — the
 * amp stage carries the note's one-shot DAHDSR times from the core.
 */
export function buildDrumSeedSpec(note: number): ModelSpec {
  const piece = pieceForNote(note & 0x7f);
  return {
    engineMode: 'percussion',
    percussion: piece.percussion,
    body: 'none',
    bodyMix: 0,
    drive: 0,
    ampEnv: piece.ampEnv,
    gain: piece.gain,
  };
}
