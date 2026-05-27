#!/usr/bin/env node
import { fileURLToPath } from 'node:url';
import { init, masteringChainStereo, masteringPairAnalyze, version } from '../src/wasm/index.js';

export const sampleRate = 22050;
export const seconds = 2;
export const length = sampleRate * seconds;

export const presets = [
  ['pop', buildConfig({ targetLufs: -14, tiltDb: 0.4, ratio: 2.2, air: 0.24, width: 1.08 })],
  ['edm', buildConfig({ targetLufs: -12, tiltDb: -0.2, ratio: 3.0, air: 0.32, width: 1.18 })],
  ['acoustic', buildConfig({ targetLufs: -16, tiltDb: 0.1, ratio: 1.5, air: 0.16, width: 0.96 })],
  ['hiphop', buildConfig({ targetLufs: -13, tiltDb: -0.5, ratio: 2.8, air: 0.2, width: 1.02 })],
  [
    'aiMusic',
    buildConfig({ targetLufs: -14, tiltDb: 0.3, ratio: 2.1, air: 0.58, width: 1.0, denoise: true }),
  ],
  [
    'speech',
    buildConfig({ targetLufs: -16, tiltDb: 0.0, ratio: 3.0, air: 0.12, width: 0.9, denoise: true }),
  ],
];

export async function validateMasteringPresets({
  api = { init, masteringChainStereo, masteringPairAnalyze, version },
  presetEntries = presets,
  log = () => {},
} = {}) {
  await api.init();
  log(`libsonare ${api.version()}`);

  const source = makeSyntheticMix();
  const reference = makeReferenceMix();

  const failures = [];

  for (const [name, config] of presetEntries) {
    try {
      const result = api.masteringChainStereo(source.left, source.right, sampleRate, config);
      assertFinite(`${name}.inputLufs`, result.inputLufs);
      assertFinite(`${name}.outputLufs`, result.outputLufs);
      assertFinite(`${name}.appliedGainDb`, result.appliedGainDb);

      if (!(result.left instanceof Float32Array) || !(result.right instanceof Float32Array)) {
        throw new Error('output channels are not Float32Array');
      }
      if (result.left.length !== length || result.right.length !== length) {
        throw new Error(`unexpected output length ${result.left.length}/${result.right.length}`);
      }
      if (!Array.isArray(result.stages) || result.stages.length === 0) {
        throw new Error('no mastering stages were applied');
      }
      if (Math.abs(result.outputLufs - config.loudness.targetLufs) > 2.5) {
        throw new Error(
          `output LUFS ${result.outputLufs.toFixed(2)} is far from target ${config.loudness.targetLufs}`,
        );
      }

      const peak = Math.max(maxAbs(result.left), maxAbs(result.right));
      if (!Number.isFinite(peak) || peak <= 0 || peak > 1.01) {
        throw new Error(`invalid peak ${peak}`);
      }

      log(
        `${name}: ${result.outputLufs.toFixed(2)} LUFS, peak ${peak.toFixed(4)}, stages ${result.stages.join('/')}`,
      );
    } catch (error) {
      failures.push(`${name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  try {
    const report = api.masteringPairAnalyze(
      'match.referenceLoudness',
      source.left,
      reference.left,
      sampleRate,
      {},
    );
    if (typeof report !== 'string' || report.length === 0) {
      throw new Error('empty pair analysis report');
    }
    log('reference analysis: ok');
  } catch (error) {
    failures.push(`reference analysis: ${error instanceof Error ? error.message : String(error)}`);
  }

  return failures;
}

export function buildConfig({ targetLufs, tiltDb, ratio, air, width, denoise = false }) {
  return {
    repair: denoise ? { denoise: true, gainFloor: 0.1 } : undefined,
    eq: { tiltDb, pivotHz: 1000 },
    dynamics: {
      compressor: {
        thresholdDb: -18,
        ratio,
        attackMs: 18,
        releaseMs: 160,
        kneeDb: 4,
        autoMakeup: true,
      },
    },
    spectral: {
      airBand: { amount: air, shelfFrequencyHz: 14000 },
    },
    stereo: {
      imager: { width, preserveEnergy: true },
    },
    maximizer: {
      truePeakLimiter: {
        ceilingDb: -1,
        lookaheadMs: 5,
        releaseMs: 120,
        oversampleFactor: 4,
        applyGainAtInputRate: true,
      },
    },
    loudness: {
      targetLufs,
      ceilingDb: -1,
      truePeakOversample: 4,
    },
  };
}

export function makeSyntheticMix() {
  const left = new Float32Array(length);
  const right = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    const kick = Math.sin(2 * Math.PI * 55 * t) * Math.exp(-(t % 0.5) * 12);
    const body = Math.sin(2 * Math.PI * 220 * t) * 0.18;
    const air = Math.sin(2 * Math.PI * 4200 * t) * 0.025;
    left[i] = kick * 0.32 + body + air;
    right[i] = kick * 0.28 + Math.sin(2 * Math.PI * 277 * t) * 0.16 + air * 0.8;
  }
  return { left, right };
}

export function makeReferenceMix() {
  const left = new Float32Array(length);
  const right = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    left[i] = Math.sin(2 * Math.PI * 165 * t) * 0.18 + Math.sin(2 * Math.PI * 3300 * t) * 0.03;
    right[i] = Math.sin(2 * Math.PI * 247 * t) * 0.17 + Math.sin(2 * Math.PI * 3600 * t) * 0.025;
  }
  return { left, right };
}

export function maxAbs(samples) {
  let peak = 0;
  for (const sample of samples) peak = Math.max(peak, Math.abs(sample));
  return peak;
}

export function assertFinite(label, value) {
  if (!Number.isFinite(value)) throw new Error(`${label} is not finite`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const failures = await validateMasteringPresets({ log: console.log });

  if (failures.length > 0) {
    console.error('mastering preset validation failed:');
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }

  console.log('mastering preset validation passed');
}
