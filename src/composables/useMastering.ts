import { ref, shallowRef } from 'vue';
import type { MasteringChainConfig, StreamingPlatform } from '@/wasm/index';

export type MasteringPresetId = 'pop' | 'edm' | 'acoustic' | 'hiphop' | 'aiMusic' | 'speech';
export type MasteringPlatformId = 'spotify' | 'youtube' | 'apple' | 'tiktok' | 'custom';

export interface MasteringTuning {
  tone: number;
  width: number;
  dynamics: number;
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
  targetLufs: number;
  tuning: MasteringTuning;
  moduleSettings?: MasteringModuleSettings;
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
    return {
      profile: parseJsonReport(wasmModule.masteringAudioProfile(samples, source.value.sampleRate)),
      suggestions: parseJsonReport(
        wasmModule.masteringAssistantSuggest(samples, source.value.sampleRate),
      ),
      streamingPreview: parseJsonReport(
        wasmModule.masteringStreamingPreview(samples, source.value.sampleRate, platforms),
      ),
    };
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
  const warm = tuning.tone / 100;
  const wide = tuning.width / 100;
  const compressed = (100 - tuning.dynamics) / 100;
  const settings = options.moduleSettings || defaultModuleSettings();

  const config: MasteringChainConfig = {
    eq: {
      tiltDb: settings.tiltDb + (warm - 0.5) * -2.5,
      pivotHz: 1000,
    },
    dynamics: {
      compressor: {
        thresholdDb: settings.compressorThresholdDb - compressed * 4,
        ratio: settings.compressorRatio + compressed * 0.8,
        attackMs:
          preset === 'speech'
            ? Math.min(settings.compressorAttackMs, 8)
            : settings.compressorAttackMs,
        releaseMs:
          preset === 'edm'
            ? Math.min(settings.compressorReleaseMs, 120)
            : settings.compressorReleaseMs,
        kneeDb: 4,
        autoMakeup: true,
      },
    },
    saturation: {
      exciter: {
        frequencyHz: preset === 'aiMusic' ? 14500 : 9000,
        driveDb: warm * 2.5,
        amount:
          preset === 'aiMusic'
            ? settings.exciterAmount + 0.14 + warm * 0.18
            : settings.exciterAmount + warm * 0.1,
        q: 0.8,
        evenOddMix: 0.65,
      },
    },
    spectral: {
      airBand: {
        amount:
          preset === 'aiMusic'
            ? Math.max(settings.airBandAmount, 0.55)
            : settings.airBandAmount + warm * 0.12,
        shelfFrequencyHz: preset === 'aiMusic' ? 15500 : 12000,
      },
    },
    stereo: {
      imager: {
        width:
          preset === 'speech'
            ? Math.min(settings.stereoWidth, 0.95)
            : settings.stereoWidth + wide * 0.2,
        decorrelationAmount: preset === 'speech' ? 0 : wide * 0.08,
        preserveEnergy: true,
      },
    },
    maximizer: {
      truePeakLimiter: {
        ceilingDb: settings.limiterCeilingDb,
        lookaheadMs: settings.limiterLookaheadMs,
        releaseMs: preset === 'edm' ? 80 : 120,
        oversampleFactor: 4,
        applyGainAtInputRate: true,
      },
    },
    loudness: {
      targetLufs,
      ceilingDb: settings.limiterCeilingDb,
      truePeakOversample: 4,
    },
  };

  // ---- Repair (denoise / declick / dereverb) -----------------------------
  const repairActive =
    preset === 'aiMusic' ||
    preset === 'speech' ||
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
    if (settings.dereverbAmount > 0) {
      config.repair.dereverb = {
        threshold: 0.08,
        attenuation: settings.dereverbAmount,
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
      attackGainDb: settings.transientAttackDb,
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
    config.dynamics!.multibandComp = {
      lowCutoffHz: 220,
      highCutoffHz: 4500,
      lowThresholdDb: -10 - mbLow * 16,
      lowRatio: 1.4 + mbLow * 2,
      lowAttackMs: 12,
      lowReleaseMs: 220,
      midThresholdDb: -12 - mbMid * 14,
      midRatio: 1.4 + mbMid * 2,
      midAttackMs: 18,
      midReleaseMs: 160,
      highThresholdDb: -14 - mbHigh * 14,
      highRatio: 1.4 + mbHigh * 2,
      highAttackMs: 6,
      highReleaseMs: 90,
    };
  }

  // ---- Tape saturation (chain-side color) -------------------------------
  if (settings.tapeDriveDb > 0 || settings.tapeSaturation > 0) {
    config.saturation = {
      ...config.saturation,
      tape: {
        driveDb: settings.tapeDriveDb,
        saturation: settings.tapeSaturation,
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
        autoMakeup: true,
      },
    };
  }

  if (preset === 'hiphop') {
    config.eq = {
      tiltDb: (config.eq?.tiltDb ?? 0) - 0.5,
      pivotHz: 850,
    };
    config.dynamics!.compressor!.ratio = 2.6 + compressed;
  }

  return config;
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
    exciterAmount: 0.12,
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
