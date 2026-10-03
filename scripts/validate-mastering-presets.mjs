import { fileURLToPath } from 'node:url';
import * as wasm from '../src/wasm/index.js';

// Verified at 48 kHz: a 44.1 kHz context renders the same presets with
// slightly different limiter oversampling and LUFS gating.
export const sampleRate = 48_000;
export const seconds = 3;
export const length = sampleRate * seconds;
/** A fit may land this far from the target (LU). */
export const TARGET_TOLERANCE_LU = 0.5;

// The preset map, the engine-op builder and the loudness fit live in
// TypeScript. Bundling them in memory lets this plain-node gate run the exact
// code the page and its Worker run — repair, then the fit on a raw engine,
// then the export render — over the real preset × venue tables.
let masteringModulePromise;

export function loadMasteringModule() {
  if (!masteringModulePromise) masteringModulePromise = bundleMasteringModule();
  return masteringModulePromise;
}

async function bundleMasteringModule() {
  // Import esbuild lazily: a static import makes vite/vitest pre-transform this
  // module (it is also imported by tests/scripts/validateMasteringPresets.test.ts).
  const esbuild = await import('esbuild');
  const rootDir = fileURLToPath(new URL('..', import.meta.url));
  const result = await esbuild.build({
    stdin: {
      contents: [
        "export { defaultMasteringState, masteringMutators, masteringTargetLufs, MASTERING_SLOT } from './src/demos/mastering/masteringState.ts';",
        "export { fitMasteringLoudness, measureLufs, prepareProgram, renderMasteringState } from './src/demos/mastering/masteringEngine.ts';",
        "export { fitMatchEqPeaks } from './src/demos/mastering/masteringPresetMap.ts';",
        "export { MASTERING_PRESETS, MASTERING_VENUES, MASTERING_PRESET_TARGETS } from './src/demos/mastering/masteringUi.ts';",
      ].join('\n'),
      resolveDir: rootDir,
      sourcefile: 'validator-entry.ts',
      loader: 'ts',
    },
    bundle: true,
    treeShaking: true,
    format: 'esm',
    platform: 'node',
    write: false,
  });
  const code = result.outputFiles[0].text;
  return import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
}

/** `[name, state]` for every genre preset in every venue, at the genre's recommended target. */
export async function buildPresetEntries() {
  const {
    defaultMasteringState,
    masteringMutators: m,
    MASTERING_PRESETS,
    MASTERING_VENUES,
    MASTERING_PRESET_TARGETS,
  } = await loadMasteringModule();

  const entries = [];
  for (const { id: preset } of MASTERING_PRESETS) {
    for (const { id: venue } of MASTERING_VENUES) {
      let state = m.selectVenue(m.selectPreset(defaultMasteringState(), preset), venue);
      state = m.setCustomLufs(state, MASTERING_PRESET_TARGETS[preset]);
      entries.push([`${preset}/${venue}`, state]);
    }
  }
  return entries;
}

/**
 * Runs each preset the way the export does: repair preprocess, loudness fit,
 * fitted render. A preset fails when the master misses its target by more than
 * {@link TARGET_TOLERANCE_LU} or its true peak exceeds the limiter ceiling.
 */
export async function validateMasteringPresets({ api = wasm, presetEntries, log = () => {} } = {}) {
  await api.init();
  log(`libsonare ${api.version()}`);

  const mastering = await loadMasteringModule();
  const { masteringMutators: m, masteringTargetLufs, MASTERING_SLOT } = mastering;
  const entries = presetEntries ?? (await buildPresetEntries());
  const source = { ...makeSyntheticMix(), sampleRate, integratedLufs: Number.NaN };
  const reference = makeReferenceMix();

  const failures = [];
  for (const [name, state] of entries) {
    try {
      const { program, stages } = mastering.prepareProgram(api, source, state.repair);
      assertFinite(`${name}.programLufs`, program.integratedLufs);
      const fit = await mastering.fitMasteringLoudness(api, state, program);
      const master = mastering.renderMasteringState(api, m.applyLoudnessFit(state, fit), program);
      if (master.left.length !== length || master.right.length !== length) {
        throw new Error(`unexpected output length ${master.left.length}/${master.right.length}`);
      }
      const lufs = mastering.measureLufs(api, master.left, master.right, sampleRate);
      assertFinite(`${name}.outputLufs`, lufs);
      const truePeak = Math.max(
        api.meteringTruePeakDb(master.left, sampleRate, 4),
        api.meteringTruePeakDb(master.right, sampleRate, 4),
      );
      assertFinite(`${name}.truePeakDb`, truePeak);
      const target = masteringTargetLufs(state);
      const ceiling = state.inserts[MASTERING_SLOT.limiter].params.ceilingDb;

      if (Math.abs(lufs - target) > TARGET_TOLERANCE_LU) {
        throw new Error(
          `output ${lufs.toFixed(2)} LUFS misses target ${target} by more than ${TARGET_TOLERANCE_LU} LU (fit residual ${fit.residualLu.toFixed(2)} LU after ${fit.bounces} bounces)`,
        );
      }
      if (truePeak > ceiling) {
        throw new Error(`true peak ${truePeak.toFixed(2)} dBTP exceeds ceiling ${ceiling} dBTP`);
      }

      log(
        `${name}: ${lufs.toFixed(2)} LUFS (target ${target}), true peak ${truePeak.toFixed(2)} dBTP (ceiling ${ceiling}), drive ${fit.driveDb.toFixed(2)} dB in ${fit.bounces} bounces, repair ${stages.join('/') || 'none'}`,
      );
    } catch (error) {
      failures.push(`${name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  try {
    const curve = JSON.parse(
      api.masteringPairAnalyze('match.matchEqCurve', source.left, reference.left, sampleRate),
    );
    const fit = mastering.fitMatchEqPeaks(curve, sampleRate);
    if (fit.bands.length !== 4 || !fit.bands.every((band) => Number.isFinite(band.gainDb))) {
      throw new Error('match EQ fit did not produce four finite bands');
    }
    log(`reference match EQ: residual ${(fit.residualRatio * 100).toFixed(0)}% of the deviation`);
  } catch (error) {
    failures.push(`reference analysis: ${error instanceof Error ? error.message : String(error)}`);
  }

  return failures;
}

/**
 * A deterministic mix with what a master carries: kick, hats, a moving bass
 * line, a pad and a noise bed. Steady pure tones alone are not enough — the
 * repair denoiser treats them as noise and removes most of the programme.
 */
export function makeSyntheticMix() {
  const left = new Float32Array(length);
  const right = new Float32Array(length);
  let seed = 12345;
  const random = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return (seed / 0x7fffffff) * 2 - 1;
  };
  const roots = [110, 146.83, 130.81, 98];
  let bedL = 0;
  let bedR = 0;
  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    const beat = t % 0.5;
    const root = roots[Math.floor(t / 0.75) % roots.length];
    const kick =
      Math.sin(2 * Math.PI * (50 + 80 * Math.exp(-beat * 40)) * beat) * Math.exp(-beat * 9);
    const hat = t % 0.25 < 0.03 ? random() * Math.exp(-(t % 0.25) * 120) : 0;
    const bass = Math.sin(2 * Math.PI * root * t) * (0.6 + 0.4 * Math.sin(2 * Math.PI * 2 * t));
    const pad =
      ((Math.sin(2 * Math.PI * root * 2 * t) +
        Math.sin(2 * Math.PI * root * 2.52 * t) +
        Math.sin(2 * Math.PI * root * 3 * t)) /
        3) *
      (0.7 + 0.3 * Math.sin(2 * Math.PI * 0.5 * t));
    bedL += 0.2 * (random() - bedL);
    bedR += 0.2 * (random() - bedR);
    left[i] = 0.3 * kick + 0.12 * hat + 0.16 * bass + 0.1 * pad + 0.03 * bedL;
    right[i] = 0.28 * kick + 0.1 * hat + 0.15 * bass + 0.09 * pad + 0.03 * bedR;
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
