import { ref, shallowRef } from 'vue';
import type { MasteringChainConfig, StreamingPlatform } from '@/wasm/index';

export type MasteringPresetId =
  | 'pop'
  | 'edm'
  | 'acoustic'
  | 'liveSmall'
  | 'liveLarge'
  | 'hiphop'
  | 'aiMusic'
  | 'speech';
export type MasteringVenueId = 'studio' | 'livehouseSmall' | 'livehouseLarge';
export type MasteringPlatformId = 'spotify' | 'youtube' | 'apple' | 'tiktok' | 'custom';

export interface MasteringTuning {
  tone: number;
  width: number;
  dynamics: number;
}

export interface MasteringDiagnosticBypass {
  repair: boolean;
  dynamics: boolean;
  saturation: boolean;
  airBand: boolean;
  stereo: boolean;
  loudnessLimiter: boolean;
}

export interface MasteringModuleSettings {
  inputGainDb: number;
  // Repair (denoise + declick + dereverb)
  denoiseAmount: number;
  declickAmount: number;
  dereverbAmount: number;
  // EQ
  tiltDb: number;
  // Single-band dynamics
  compressorThresholdDb: number;
  compressorRatio: number;
  compressorAttackMs: number;
  compressorReleaseMs: number;
  deesserAmount: number;
  transientAttackDb: number;
  // Multiband compressor (per-band amount drives threshold + ratio)
  multibandLowAmount: number;
  multibandMidAmount: number;
  multibandHighAmount: number;
  // Saturation / Air
  tapeDriveDb: number;
  tapeSaturation: number;
  exciterAmount: number;
  airBandAmount: number;
  // Stereo
  stereoWidth: number;
  monoMakerAmount: number;
  // Limiter
  limiterCeilingDb: number;
  limiterLookaheadMs: number;
}

export interface MasteringRenderOptions {
  preset: MasteringPresetId;
  venue?: MasteringVenueId;
  targetLufs: number;
  tuning: MasteringTuning;
  moduleSettings?: MasteringModuleSettings;
  qualityMode?: 'safe' | 'studio';
  diagnosticBypass?: MasteringDiagnosticBypass;
}

export interface ReferenceMatchOptions {
  targetLufs: number;
  ceilingDb: number;
  lookaheadMs: number;
}

export interface DecodedMasteringAudio {
  fileName: string;
  sampleRate: number;
  duration: number;
  channels: number;
  left: Float32Array;
  right: Float32Array;
}

export interface RenderedMasteringAudio {
  left: Float32Array;
  right: Float32Array;
  sampleRate: number;
  inputLufs: number;
  outputLufs: number;
  appliedGainDb: number;
  stages: string[];
  latencySamples?: number;
}

export interface MasteringInsightReport {
  profile: unknown;
  suggestions: unknown;
  streamingPreview: unknown;
}

type WorkerMessage =
  | { type: 'progress'; id: number; progress: number; stage: string }
  | { type: 'done'; id: number; result: RenderedMasteringAudio }
  | { type: 'error'; id: number; error: string };

export function useMastering() {
  const isInitialized = ref(false);
  const isLoading = ref(false);
  const isRendering = ref(false);
  const renderProgress = ref(0);
  const renderStage = ref('');
  const error = ref<string | null>(null);
  const source = shallowRef<DecodedMasteringAudio | null>(null);
  const rendered = shallowRef<RenderedMasteringAudio | null>(null);

  let wasmModule: any = null;
  let audioContext: AudioContext | null = null;
  let worker: Worker | null = null;
  let renderRequestId = 0;

  async function initWasm() {
    if (isInitialized.value) return;
    wasmModule = await import('@/wasm/index.js');
    await wasmModule.init();
    isInitialized.value = true;
  }

  function getAudioContext(): AudioContext {
    if (!audioContext) {
      audioContext = new AudioContext();
    }
    return audioContext;
  }

  async function loadFile(file: File): Promise<DecodedMasteringAudio> {
    isLoading.value = true;
    error.value = null;
    rendered.value = null;

    try {
      const decoded = await decodeFile(file);
      source.value = decoded;
      return decoded;
    } catch (e) {
      console.error('Failed to load mastering file:', e);
      error.value = 'Failed to decode audio file';
      throw e;
    } finally {
      isLoading.value = false;
    }
  }

  async function decodeFile(file: File): Promise<DecodedMasteringAudio> {
    const ctx = getAudioContext();
    const buffer = await ctx.decodeAudioData(await file.arrayBuffer());
    return {
      fileName: file.name,
      sampleRate: buffer.sampleRate,
      duration: buffer.duration,
      channels: buffer.numberOfChannels,
      left: new Float32Array(buffer.getChannelData(0)),
      right:
        buffer.numberOfChannels > 1
          ? new Float32Array(buffer.getChannelData(1))
          : new Float32Array(buffer.getChannelData(0)),
    };
  }

  async function render(options: MasteringRenderOptions): Promise<RenderedMasteringAudio> {
    if (!source.value) {
      throw new Error('No audio loaded');
    }

    isRendering.value = true;
    renderProgress.value = 0;
    renderStage.value = 'Queued';
    error.value = null;

    try {
      const config = buildMasteringConfig(options);
      const inputGainDb = options.moduleSettings?.inputGainDb ?? 0;
      const inputSource = inputGainDb !== 0 ? applyGain(source.value, inputGainDb) : source.value;
      const output = await renderInWorker(inputSource, config);
      rendered.value = output;
      renderProgress.value = 1;
      renderStage.value = 'Complete';
      return output;
    } catch (e) {
      console.error('Mastering render failed:', e);
      error.value = 'Mastering render failed';
      throw e;
    } finally {
      isRendering.value = false;
    }
  }

  async function renderReferenceMatch(
    reference: DecodedMasteringAudio,
    options: ReferenceMatchOptions,
  ): Promise<RenderedMasteringAudio> {
    if (!source.value) {
      throw new Error('No audio loaded');
    }

    isRendering.value = true;
    renderProgress.value = 0;
    renderStage.value = 'Queued';
    error.value = null;

    try {
      const matchedReference =
        reference.sampleRate === source.value.sampleRate
          ? reference
          : {
              ...reference,
              sampleRate: source.value.sampleRate,
              left: resampleLinear(reference.left, reference.sampleRate, source.value.sampleRate),
              right: resampleLinear(reference.right, reference.sampleRate, source.value.sampleRate),
            };
      const output = await renderReferenceMatchInWorker(source.value, matchedReference, options);
      rendered.value = output;
      renderProgress.value = 1;
      renderStage.value = 'Complete';
      return output;
    } catch (e) {
      console.error('Reference match failed:', e);
      error.value = 'Reference match failed';
      throw e;
    } finally {
      isRendering.value = false;
    }
  }

  async function measureIntegratedLufs(audio: DecodedMasteringAudio): Promise<number> {
    await initWasm();
    const mono = mixToMono(audio.left, audio.right);
    return wasmModule.lufs(mono, audio.sampleRate).integratedLufs;
  }

  async function analyzeSource(platforms: StreamingPlatform[]): Promise<MasteringInsightReport> {
    if (!source.value) {
      throw new Error('No audio loaded');
    }
    await initWasm();
    const samples = mixToMono(source.value.left, source.value.right);
    try {
      return {
        profile: parseJsonReport(
          wasmModule.masteringAudioProfile(samples, source.value.sampleRate),
        ),
        suggestions: parseJsonReport(
          wasmModule.masteringAssistantSuggest(samples, source.value.sampleRate),
        ),
        streamingPreview: parseJsonReport(
          wasmModule.masteringStreamingPreview(samples, source.value.sampleRate, platforms),
        ),
      };
    } catch (e) {
      // The mastering assistant rejects clips shorter than one analysis window.
      // It surfaces as a raw WASM exception pointer (a number), so normalise it
      // into an Error and set a friendly message instead of leaking the pointer.
      console.error('Mastering analysis failed:', e);
      error.value = 'Could not analyze this audio — it may be too short.';
      throw e instanceof Error ? e : new Error('Mastering analysis failed');
    }
  }

  function createAudioUrl(audio: RenderedMasteringAudio): string {
    const wav = encodeWav(audio.left, audio.right, audio.sampleRate);
    return URL.createObjectURL(new Blob([wav], { type: 'audio/wav' }));
  }

  function createSourceAudioUrl(audio: DecodedMasteringAudio): string {
    const wav = encodeWav(audio.left, audio.right, audio.sampleRate);
    return URL.createObjectURL(new Blob([wav], { type: 'audio/wav' }));
  }

  function dispose() {
    worker?.terminate();
    worker = null;
  }

  function renderInWorker(
    audio: DecodedMasteringAudio,
    config: MasteringChainConfig,
  ): Promise<RenderedMasteringAudio> {
    const id = ++renderRequestId;

    if (!worker) {
      worker = new Worker(new URL('../workers/mastering.worker.ts', import.meta.url), {
        type: 'module',
      });
    }

    return new Promise((resolve, reject) => {
      const onMessage = (event: MessageEvent<WorkerMessage>) => {
        const message = event.data;
        if (message.id !== id) return;

        if (message.type === 'progress') {
          renderProgress.value = message.progress;
          renderStage.value = message.stage;
          return;
        }

        worker?.removeEventListener('message', onMessage);
        worker?.removeEventListener('error', onError);

        if (message.type === 'done') {
          resolve(message.result);
        } else {
          reject(new Error(message.error));
        }
      };

      const onError = (event: ErrorEvent) => {
        worker?.removeEventListener('message', onMessage);
        worker?.removeEventListener('error', onError);
        reject(event.error || new Error(event.message));
      };

      worker!.addEventListener('message', onMessage);
      worker!.addEventListener('error', onError);
      worker!.postMessage({
        type: 'render',
        id,
        left: new Float32Array(audio.left),
        right: new Float32Array(audio.right),
        sampleRate: audio.sampleRate,
        config,
      });
    });
  }

  function renderReferenceMatchInWorker(
    audio: DecodedMasteringAudio,
    referenceAudio: DecodedMasteringAudio,
    options: ReferenceMatchOptions,
  ): Promise<RenderedMasteringAudio> {
    const id = ++renderRequestId;

    if (!worker) {
      worker = new Worker(new URL('../workers/mastering.worker.ts', import.meta.url), {
        type: 'module',
      });
    }

    return new Promise((resolve, reject) => {
      const onMessage = (event: MessageEvent<WorkerMessage>) => {
        const message = event.data;
        if (message.id !== id) return;

        if (message.type === 'progress') {
          renderProgress.value = message.progress;
          renderStage.value = message.stage;
          return;
        }

        worker?.removeEventListener('message', onMessage);
        worker?.removeEventListener('error', onError);

        if (message.type === 'done') {
          resolve(message.result);
        } else {
          reject(new Error(message.error));
        }
      };

      const onError = (event: ErrorEvent) => {
        worker?.removeEventListener('message', onMessage);
        worker?.removeEventListener('error', onError);
        reject(event.error || new Error(event.message));
      };

      worker!.addEventListener('message', onMessage);
      worker!.addEventListener('error', onError);
      worker!.postMessage({
        type: 'referenceMatch',
        id,
        left: new Float32Array(audio.left),
        right: new Float32Array(audio.right),
        referenceLeft: new Float32Array(referenceAudio.left),
        referenceRight: new Float32Array(referenceAudio.right),
        sampleRate: audio.sampleRate,
        targetLufs: options.targetLufs,
        ceilingDb: options.ceilingDb,
        lookaheadMs: options.lookaheadMs,
      });
    });
  }

  return {
    isInitialized,
    isLoading,
    isRendering,
    renderProgress,
    renderStage,
    error,
    source,
    rendered,
    initWasm,
    decodeFile,
    loadFile,
    render,
    renderReferenceMatch,
    analyzeSource,
    measureIntegratedLufs,
    createAudioUrl,
    createSourceAudioUrl,
    dispose,
  };
}

function mixToMono(left: Float32Array, right: Float32Array): Float32Array {
  const length = Math.min(left.length, right.length);
  const mono = new Float32Array(length);
  for (let i = 0; i < length; i++) mono[i] = (left[i] + right[i]) * 0.5;
  return mono;
}

function parseJsonReport(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

function applyGain(audio: DecodedMasteringAudio, gainDb: number): DecodedMasteringAudio {
  const factor = 10 ** (gainDb / 20);
  const left = new Float32Array(audio.left.length);
  const right = new Float32Array(audio.right.length);
  for (let i = 0; i < audio.left.length; i++) left[i] = audio.left[i] * factor;
  for (let i = 0; i < audio.right.length; i++) right[i] = audio.right[i] * factor;
  return { ...audio, left, right };
}

function resampleLinear(
  samples: Float32Array,
  fromSampleRate: number,
  toSampleRate: number,
): Float32Array {
  if (fromSampleRate === toSampleRate || samples.length === 0) return new Float32Array(samples);
  const ratio = toSampleRate / fromSampleRate;
  const outputLength = Math.max(1, Math.round(samples.length * ratio));
  const output = new Float32Array(outputLength);
  for (let i = 0; i < outputLength; i++) {
    const sourceIndex = i / ratio;
    const index = Math.floor(sourceIndex);
    const fraction = sourceIndex - index;
    const current = samples[Math.min(index, samples.length - 1)];
    const next = samples[Math.min(index + 1, samples.length - 1)];
    output[i] = current + (next - current) * fraction;
  }
  return output;
}

function buildMasteringConfig(options: MasteringRenderOptions): MasteringChainConfig {
  const { preset, targetLufs, tuning } = options;
  const venue: MasteringVenueId = options.venue ?? 'studio';
  const safeMode = options.qualityMode === 'safe';
  const warm = tuning.tone / 100;
  const wide = tuning.width / 100;
  const compressed = (100 - tuning.dynamics) / 100;
  const settings = options.moduleSettings || defaultModuleSettings();
  const ceilingDb = safeMode
    ? Math.min(settings.limiterCeilingDb, -1.5)
    : settings.limiterCeilingDb;
  const exciterAmount = safeMode ? Math.min(settings.exciterAmount, 0.04) : settings.exciterAmount;
  const exciterEnabled = exciterAmount > 0;
  const airBandAmount = safeMode ? Math.min(settings.airBandAmount, 0.14) : settings.airBandAmount;
  const stereoWidth = safeMode ? Math.min(settings.stereoWidth, 1.03) : settings.stereoWidth;
  const exciterDriveDb = exciterEnabled ? warm * (safeMode ? 0.8 : 2.5) : 0;

  const config: MasteringChainConfig = {
    eq: {
      tiltDb: settings.tiltDb + (warm - 0.5) * (safeMode ? -1.2 : -2.5),
      pivotHz: 1000,
    },
    dynamics: {
      compressor: {
        thresholdDb: settings.compressorThresholdDb - compressed * (safeMode ? 2 : 4),
        ratio: settings.compressorRatio + compressed * (safeMode ? 0.35 : 0.8),
        attackMs:
          preset === 'speech'
            ? Math.min(settings.compressorAttackMs, 8)
            : settings.compressorAttackMs,
        releaseMs:
          preset === 'edm'
            ? Math.min(settings.compressorReleaseMs, 120)
            : settings.compressorReleaseMs,
        kneeDb: 4,
        autoMakeup: !safeMode,
      },
    },
    spectral: {
      airBand: {
        amount:
          preset === 'aiMusic'
            ? safeMode
              ? Math.max(airBandAmount, 0.22)
              : Math.max(airBandAmount, 0.55)
            : airBandAmount + warm * (safeMode ? 0.04 : 0.12),
        shelfFrequencyHz: preset === 'aiMusic' ? 15500 : 12000,
      },
    },
    stereo: {
      imager: {
        width:
          preset === 'speech'
            ? Math.min(stereoWidth, 0.95)
            : stereoWidth + wide * (safeMode ? 0.06 : 0.2),
        decorrelationAmount: preset === 'speech' ? 0 : wide * (safeMode ? 0.02 : 0.08),
        preserveEnergy: true,
      },
    },
    maximizer: {
      truePeakLimiter: {
        ceilingDb,
        lookaheadMs: settings.limiterLookaheadMs,
        releaseMs: safeMode ? 160 : preset === 'edm' ? 80 : 120,
        oversampleFactor: 4,
        applyGainAtInputRate: safeMode,
      },
    },
    loudness: {
      targetLufs,
      ceilingDb,
      truePeakOversample: 4,
      applyGainAtInputRate: safeMode,
    },
  };

  if (exciterEnabled) {
    config.saturation = {
      exciter: {
        frequencyHz: preset === 'aiMusic' ? 14500 : 9000,
        driveDb: exciterDriveDb,
        amount: preset === 'aiMusic' ? exciterAmount + (safeMode ? 0.02 : 0.08) : exciterAmount,
        q: 0.8,
        evenOddMix: 0.65,
      },
    };
  }

  // ---- Repair (denoise / declick / dereverb) -----------------------------
  const isLivehouse = venue === 'livehouseSmall' || venue === 'livehouseLarge';
  const repairActive =
    preset === 'aiMusic' ||
    preset === 'speech' ||
    isLivehouse ||
    settings.denoiseAmount > 0 ||
    settings.declickAmount > 0 ||
    settings.dereverbAmount > 0;

  if (repairActive) {
    config.repair = {
      denoise: settings.denoiseAmount > 0 || preset === 'aiMusic' || preset === 'speech',
      nFft: 2048,
      hopLength: 512,
      ddAlpha: preset === 'speech' ? 0.96 : 0.98,
      gainFloor: Math.max(0.04, 0.16 - settings.denoiseAmount * 0.12),
    };
    if (settings.declickAmount > 0) {
      config.repair.declick = {
        // Higher UI amount → lower trigger threshold (more aggressive declick)
        threshold: Math.max(0.08, 0.5 - settings.declickAmount * 0.4),
        neighborRatio: 4,
        maxClickSamples: 96,
      };
    }
    // Small rooms have a short, dense tail (pull back gently); large rooms
    // wash out with a long tail (pull back harder). User amount always wins.
    const livehouseDereverb =
      venue === 'livehouseSmall' ? 0.25 : venue === 'livehouseLarge' ? 0.45 : 0;
    if (settings.dereverbAmount > 0 || livehouseDereverb > 0) {
      config.repair.dereverb = {
        threshold: 0.08,
        attenuation: settings.dereverbAmount > 0 ? settings.dereverbAmount : livehouseDereverb,
        nFft: 2048,
        hopLength: 512,
        overSubtraction: 1.2,
      };
    }
  }

  // ---- Dynamics: deesser + transient shaper -----------------------------
  if (settings.deesserAmount > 0) {
    config.dynamics!.deesser = {
      frequencyHz: 6500,
      thresholdDb: -30 + (1 - settings.deesserAmount) * 18,
      ratio: 2 + settings.deesserAmount * 4,
      attackMs: 1.5,
      releaseMs: 60,
      rangeDb: 12,
    };
  }
  if (settings.transientAttackDb !== 0) {
    config.dynamics!.transientShaper = {
      attackGainDb: safeMode
        ? Math.max(-3, Math.min(3, settings.transientAttackDb))
        : settings.transientAttackDb,
      sustainGainDb: 0,
      fastAttackMs: 1.5,
      fastReleaseMs: 18,
      slowAttackMs: 25,
      slowReleaseMs: 220,
      sensitivity: 0.6,
      maxGainDb: 8,
      gainSmoothingMs: 6,
      lookaheadMs: 1.5,
    };
  }

  // ---- Multiband compressor (3-band, amount-driven) ---------------------
  const mbLow = settings.multibandLowAmount;
  const mbMid = settings.multibandMidAmount;
  const mbHigh = settings.multibandHighAmount;
  if (mbLow > 0 || mbMid > 0 || mbHigh > 0) {
    const mbScale = safeMode ? 0.55 : 1;
    config.dynamics!.multibandComp = {
      lowCutoffHz: 220,
      highCutoffHz: 4500,
      lowThresholdDb: -10 - mbLow * mbScale * 16,
      lowRatio: 1.4 + mbLow * mbScale * 2,
      lowAttackMs: 12,
      lowReleaseMs: 220,
      midThresholdDb: -12 - mbMid * mbScale * 14,
      midRatio: 1.4 + mbMid * mbScale * 2,
      midAttackMs: 18,
      midReleaseMs: 160,
      highThresholdDb: -14 - mbHigh * mbScale * 14,
      highRatio: 1.4 + mbHigh * mbScale * 2,
      highAttackMs: 6,
      highReleaseMs: 90,
    };
  }

  // ---- Tape saturation (chain-side color) -------------------------------
  if (settings.tapeDriveDb > 0 || settings.tapeSaturation > 0) {
    config.saturation = {
      ...config.saturation,
      tape: {
        driveDb: safeMode ? Math.min(settings.tapeDriveDb, 1.5) : settings.tapeDriveDb,
        saturation: safeMode ? Math.min(settings.tapeSaturation, 0.25) : settings.tapeSaturation,
        hysteresis: 0.25,
        outputGainDb: 0,
        speedIps: 15,
        headBumpDb: 1.2,
        bias: 0.5,
        gapLoss: 0.25,
      },
    };
  }

  // ---- Stereo mono-maker (bass mono safety) -----------------------------
  if (settings.monoMakerAmount > 0) {
    config.stereo!.monoMaker = {
      amount: settings.monoMakerAmount,
    };
  }

  // ---- Preset-specific overrides (keep behavior) ------------------------
  if (preset === 'acoustic') {
    config.dynamics = {
      ...config.dynamics,
      compressor: {
        thresholdDb: -16,
        ratio: 1.5,
        attackMs: Math.max(24, settings.compressorAttackMs),
        releaseMs: Math.max(220, settings.compressorReleaseMs),
        kneeDb: 6,
        autoMakeup: !safeMode,
      },
    };
  }

  if (preset === 'hiphop') {
    config.eq = {
      tiltDb: (config.eq?.tiltDb ?? 0) - 0.5,
      pivotHz: 850,
    };
    config.dynamics!.compressor!.ratio = safeMode ? 2.2 + compressed * 0.45 : 2.6 + compressed;
  }

  // Live-music genre character (NOT room repair — that is the venue layer).
  // These keep the performance dynamics and stage energy that a studio-loud
  // master would flatten. Small = intimate club gig, Large = big-stage show.
  if (preset === 'liveSmall') {
    config.eq = {
      tiltDb: (config.eq?.tiltDb ?? 0) + 0.2,
      pivotHz: 900,
    };
    config.dynamics!.compressor = {
      ...config.dynamics!.compressor!,
      ratio: 1.8 + compressed * 0.6,
      attackMs: Math.max(18, settings.compressorAttackMs),
      releaseMs: Math.max(180, settings.compressorReleaseMs),
      kneeDb: 6,
      autoMakeup: !safeMode,
    };
  }

  if (preset === 'liveLarge') {
    config.eq = {
      tiltDb: (config.eq?.tiltDb ?? 0) + 0.1,
      pivotHz: 700,
    };
    config.dynamics!.compressor = {
      ...config.dynamics!.compressor!,
      ratio: 1.6 + compressed * 0.6,
      attackMs: Math.max(24, settings.compressorAttackMs),
      releaseMs: Math.max(240, settings.compressorReleaseMs),
      kneeDb: 6,
      autoMakeup: !safeMode,
    };
    config.stereo!.imager = {
      ...config.stereo!.imager,
      width: (config.stereo?.imager?.width ?? settings.stereoWidth) + 0.05,
      preserveEnergy: true,
    };
  }

  // ---- Recording-condition (venue) layer --------------------------------
  // Orthogonal to the genre preset: a live-room repair pass that composes ON
  // TOP of the chosen style instead of replacing it. It re-centers the EQ
  // pivot on the room's problem band, adds a gentle corrective tilt, folds the
  // low end to tame room modes, and slows the compressor for the acoustic
  // space — while the genre keeps driving character and loudness. (Dereverb
  // for the venue is wired through the repair section above.)
  if (isLivehouse) {
    // Small clubs (~100-300 cap): close walls give a boxy/one-note low-mid
    // buildup. Large halls: deep low-frequency room modes and a long, diffuse
    // tail — fold the bottom harder and slow the compressor for the big space.
    const room =
      venue === 'livehouseSmall'
        ? { pivotHz: 600, tiltDelta: 0.4, monoFloor: 0.25, attackFloor: 20, releaseFloor: 160 }
        : { pivotHz: 500, tiltDelta: 0.2, monoFloor: 0.45, attackFloor: 24, releaseFloor: 220 };

    // Keep the genre's tonal direction but re-center the pivot on the room and
    // add a light de-boxing tilt.
    config.eq = {
      tiltDb: (config.eq?.tiltDb ?? 0) + room.tiltDelta,
      pivotHz: room.pivotHz,
    };

    // Floors only — a genre that already compresses slower keeps its setting.
    const compressor = config.dynamics?.compressor;
    if (compressor) {
      compressor.attackMs = Math.max(compressor.attackMs ?? 0, room.attackFloor);
      compressor.releaseMs = Math.max(compressor.releaseMs ?? 0, room.releaseFloor);
    }

    // Fold the low end to control room modes; a stronger user/genre value wins.
    config.stereo = config.stereo ?? {};
    const existingMono = config.stereo.monoMaker?.amount ?? settings.monoMakerAmount;
    config.stereo.monoMaker = { amount: Math.max(existingMono, room.monoFloor) };
  }

  applyDiagnosticBypass(config, options.diagnosticBypass);
  return config;
}

function applyDiagnosticBypass(
  config: MasteringChainConfig,
  bypass: MasteringDiagnosticBypass | undefined,
) {
  if (!bypass) return;
  if (bypass.repair) delete config.repair;
  if (bypass.dynamics) delete config.dynamics;
  if (bypass.saturation) delete config.saturation;
  if (bypass.airBand) delete config.spectral;
  if (bypass.stereo) delete config.stereo;
  if (bypass.loudnessLimiter) {
    delete config.maximizer;
    delete config.loudness;
  }
}

export function defaultDiagnosticBypass(): MasteringDiagnosticBypass {
  return {
    repair: false,
    dynamics: false,
    saturation: false,
    airBand: false,
    stereo: false,
    loudnessLimiter: false,
  };
}

export function defaultModuleSettings(): MasteringModuleSettings {
  return {
    inputGainDb: 0,
    denoiseAmount: 0,
    declickAmount: 0,
    dereverbAmount: 0,
    tiltDb: 0,
    compressorThresholdDb: -18,
    compressorRatio: 2.2,
    compressorAttackMs: 18,
    compressorReleaseMs: 160,
    deesserAmount: 0,
    transientAttackDb: 0,
    multibandLowAmount: 0,
    multibandMidAmount: 0,
    multibandHighAmount: 0,
    tapeDriveDb: 0,
    tapeSaturation: 0,
    exciterAmount: 0,
    airBandAmount: 0.22,
    stereoWidth: 1.05,
    monoMakerAmount: 0,
    limiterCeilingDb: -1,
    limiterLookaheadMs: 5,
  };
}

function encodeWav(left: Float32Array, right: Float32Array, sampleRate: number): ArrayBuffer {
  const channels = 2;
  const bytesPerSample = 2;
  const blockAlign = channels * bytesPerSample;
  const dataSize = left.length * blockAlign;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bytesPerSample * 8, true);
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < left.length; i++) {
    view.setInt16(offset, floatToInt16(left[i]), true);
    view.setInt16(offset + 2, floatToInt16(right[i]), true);
    offset += 4;
  }

  return buffer;
}

function floatToInt16(value: number): number {
  const clipped = Math.max(-1, Math.min(1, value));
  return clipped < 0 ? clipped * 0x8000 : clipped * 0x7fff;
}

function writeString(view: DataView, offset: number, value: string) {
  for (let i = 0; i < value.length; i++) {
    view.setUint8(offset + i, value.charCodeAt(i));
  }
}
