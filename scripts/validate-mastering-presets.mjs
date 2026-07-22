import { fileURLToPath } from 'node:url';
import { init, masteringChainStereo, masteringPairAnalyze, version } from '../src/wasm/index.js';

export const sampleRate = 22050;
export const seconds = 2;
export const length = sampleRate * seconds;

// Neutral tuning + default module settings: exercise the production chain-config
// builder along its preset/venue branches rather than a hand-rolled config.
const NEUTRAL_TUNING = { tone: 50, width: 50, dynamics: 50 };

// The production config builder and the canonical preset/venue ID tables live in
// TypeScript source. Bundling them in-memory (with a Vue stub, since the builder
// ships alongside a Vue composable) lets this plain-node gate exercise the exact
// code path the demo runs — and iterate the real MasteringPresetId × VenueId sets
// instead of a drifting hand-maintained list.
let masteringModulePromise;

export function loadMasteringModule() {
  if (!masteringModulePromise) masteringModulePromise = bundleMasteringModule();
  return masteringModulePromise;
}

async function bundleMasteringModule() {
  // Import esbuild lazily: a static import makes vite/vitest pre-transform this
  // module (it is also imported by tests/scripts/validateMasteringPresets.test.ts)
  // and choke on the shebang. A dynamic import keeps it out of that transform.
  const esbuild = await import('esbuild');
  const rootDir = fileURLToPath(new URL('..', import.meta.url));
  const stubVue = {
    name: 'stub-vue',
    setup(build) {
      build.onResolve({ filter: /^vue$/ }, () => ({ path: 'vue', namespace: 'stub-vue' }));
      build.onLoad({ filter: /.*/, namespace: 'stub-vue' }, () => ({
        contents: 'export const ref = () => {}; export const shallowRef = () => {};',
        loader: 'js',
      }));
    },
  };
  const result = await esbuild.build({
    stdin: {
      contents: [
        "export { buildMasteringConfig } from './src/composables/useMastering.ts';",
        "export { MASTERING_PRESETS, MASTERING_VENUES, MASTERING_PRESET_TARGETS } from './src/utils/masteringUi.ts';",
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
    plugins: [stubVue],
  });
  const code = result.outputFiles[0].text;
  return import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
}

export async function buildPresetEntries() {
  const { buildMasteringConfig, MASTERING_PRESETS, MASTERING_VENUES, MASTERING_PRESET_TARGETS } =
    await loadMasteringModule();

  const entries = [];
  for (const { id: preset } of MASTERING_PRESETS) {
    for (const { id: venue } of MASTERING_VENUES) {
      const config = buildMasteringConfig({
        preset,
        venue,
        targetLufs: MASTERING_PRESET_TARGETS[preset],
        tuning: NEUTRAL_TUNING,
      });
      entries.push([`${preset}/${venue}`, config]);
    }
  }
  return entries;
}

export async function validateMasteringPresets({
  api = { init, masteringChainStereo, masteringPairAnalyze, version },
  presetEntries,
  log = () => {},
} = {}) {
  await api.init();
  log(`libsonare ${api.version()}`);

  const entries = presetEntries ?? (await buildPresetEntries());

  const source = makeSyntheticMix();
  const reference = makeReferenceMix();

  const failures = [];

  for (const [name, config] of entries) {
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
      if (result.outputLufs > config.loudness.targetLufs + 1.0) {
        throw new Error(
          `output LUFS ${result.outputLufs.toFixed(2)} exceeds target ${config.loudness.targetLufs}`,
        );
      }
      // loudness.optimize clamps its static gain so the true peak never crosses
      // the ceiling, so a preset may legitimately land below the target: when
      // the target sits below the input loudness (it attenuates), and when
      // denoise removes loudness it cannot boost back without peak headroom.
      // Allow that headroom shortfall, but still fail on collapse.
      const denoiseShortfall = config.repair?.denoise ? 4.0 : 0.5;
      const loudnessFloor =
        Math.min(result.inputLufs, config.loudness.targetLufs) - denoiseShortfall;
      if (result.outputLufs < loudnessFloor) {
        throw new Error(
          `output LUFS ${result.outputLufs.toFixed(2)} fell below floor ${loudnessFloor.toFixed(2)} (input ${result.inputLufs.toFixed(2)}, target ${config.loudness.targetLufs})`,
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
