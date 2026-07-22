import { buildSceneJson, type ReverbConfig, type VcaGroupConfig } from '../utils/mixingScene';
import type { GoniometerPoint, MixMeterSnapshot } from '../wasm/index';

export interface MixingTrackRenderState {
  id: string;
  name: string;
  left: Float32Array;
  right: Float32Array;
  offsetSeconds: number;
  inputTrimDb: number;
  faderDb: number;
  pan: number;
  width: number;
  panLaw?: number;
  panMode?: number;
  dualPanLeft?: number;
  dualPanRight?: number;
  channelDelaySamples?: number;
  eqEnabled?: boolean;
  eqTiltDb?: number;
  eqAirDb?: number;
  reverbSendDb?: number;
  vcaGroup?: string;
  automation?: AutomationPoint[];
  muted: boolean;
  soloed: boolean;
  soloSafe?: boolean;
  polarityLeft: boolean;
  polarityRight: boolean;
}

export type AutomationParam = 'fader' | 'pan' | 'width';
export type AutomationCurve = 'linear' | 'exponential' | 'hold' | 's-curve';

export interface AutomationPoint {
  param: AutomationParam;
  timeSec: number;
  value: number;
  curve: AutomationCurve;
}

export type { ReverbConfig, VcaGroupConfig } from '../utils/mixingScene';

export interface StripMeter {
  id: string;
  name: string;
  peakDb: number;
  rmsDb: number;
  truePeakDb: number;
  correlation: number;
  monoCompatible: boolean;
  goniometer: GoniometerPoint[];
}

export interface MixingBounceResult {
  left: Float32Array;
  right: Float32Array;
  sampleRate: number;
  duration: number;
  meters: MixMeterSnapshot[];
  stripMeters: StripMeter[];
  sceneJson: string;
  peakDb: number;
  rmsDb: number;
  integratedLufs: number;
  truePeakDb: number;
  correlation: number;
}

type WorkerRequest = {
  type: 'mixBounce';
  id: number;
  sampleRate: number;
  masterFaderDb: number;
  tracks: MixingTrackRenderState[];
  reverb?: ReverbConfig;
  vcaGroups?: VcaGroupConfig[];
};

interface MixerProcessResult {
  left: Float32Array;
  right: Float32Array;
  sampleRate: number;
}

interface MixerInstance {
  processStereo(leftChannels: Float32Array[], rightChannels: Float32Array[]): MixerProcessResult;
  stripMeter(stripIndex: number, tap?: 'preFader' | 'postFader'): MixMeterSnapshot;
  readGoniometerLatest(stripIndex: number, maxPoints: number): GoniometerPoint[];
  scheduleFaderAutomation(
    stripIndex: number,
    samplePos: number,
    faderDb: number,
    curve?: AutomationCurve,
  ): void;
  schedulePanAutomation(
    stripIndex: number,
    samplePos: number,
    pan: number,
    curve?: AutomationCurve,
  ): void;
  scheduleWidthAutomation(
    stripIndex: number,
    samplePos: number,
    width: number,
    curve?: AutomationCurve,
  ): void;
  toSceneJson(): string;
  sceneWarnings(): string[];
  delete(): void;
}

interface LufsResult {
  integratedLufs: number;
  momentaryLufs: number;
  shortTermLufs: number;
  loudnessRange: number;
}

type WasmModule = {
  init: () => Promise<void>;
  lufsInterleaved: (samples: Float32Array, channels: number, sampleRate?: number) => LufsResult;
  meteringTruePeakDb: (
    samples: Float32Array,
    sampleRate?: number,
    oversampleFactor?: number,
  ) => number;
  Mixer: {
    fromSceneJson(json: string, sampleRate?: number, blockSize?: number): MixerInstance;
  };
};

const BLOCK_SIZE = 512;
const GONIO_POINTS = 96;

let wasmModule: WasmModule | null = null;

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const request = event.data;

  try {
    postProgress(request.id, 0.04, 'Preparing mix');

    if (!wasmModule) {
      postProgress(request.id, 0.12, 'Loading libsonare WASM');
      wasmModule = (await import('../wasm/index.js')) as unknown as WasmModule;
      await wasmModule.init();
    }

    postProgress(request.id, 0.22, 'Preparing tracks');
    const result = bounce(request);
    postProgress(request.id, 0.94, 'Finalizing bounce');

    self.postMessage({ type: 'done', id: request.id, result }, [
      result.left.buffer,
      result.right.buffer,
    ]);
  } catch (error) {
    self.postMessage({
      type: 'error',
      id: request.id,
      error: error instanceof Error ? error.message : String(error),
      recoverable: true,
    });
  }
};

function bounce(request: WorkerRequest): MixingBounceResult {
  if (!wasmModule) throw new Error('WASM module is not initialized');

  const { sampleRate, masterFaderDb } = request;
  const soloActive = request.tracks.some((track) => track.soloed);
  const activeTracks = request.tracks.filter((track) =>
    soloActive ? track.soloed || track.soloSafe : !track.muted,
  );

  const dryFrames = maxTrackFrames(request.tracks, sampleRate);

  if (!activeTracks.length || dryFrames === 0) {
    const left = new Float32Array(dryFrames);
    const right = new Float32Array(dryFrames);
    return emptyResult(left, right, sampleRate);
  }

  // Reverb decay and per-channel delay compensation ring out past the dry input;
  // extend the render so processStereo is fed zero input through the whole tail.
  const frames = dryFrames + tailFrames(activeTracks, request.reverb, sampleRate);

  // Pad each strip's audio by its arrangement offset so the bounce preserves timeline starts.
  const leftChannels = activeTracks.map((track) =>
    padChannel(track.left, track.offsetSeconds, sampleRate, frames),
  );
  const rightChannels = activeTracks.map((track) =>
    padChannel(track.right, track.offsetSeconds, sampleRate, frames),
  );

  const sceneJson = buildSceneJson(activeTracks, request.reverb, request.vcaGroups);
  const mixer = wasmModule.Mixer.fromSceneJson(sceneJson, sampleRate, BLOCK_SIZE);
  // Insert params no processor consumed (typos / renamed keys) load silently but
  // take no effect — surface them so a broken control never ships unnoticed.
  const sceneWarnings = mixer.sceneWarnings();
  if (sceneWarnings.length > 0) console.warn('[mixing] scene warnings:', sceneWarnings);
  applyAutomation(mixer, activeTracks, sampleRate);

  postProgress(request.id, 0.5, 'Running mixer');
  const outLeft = new Float32Array(frames);
  const outRight = new Float32Array(frames);
  const blockL: Float32Array[] = activeTracks.map(() => new Float32Array(BLOCK_SIZE));
  const blockR: Float32Array[] = activeTracks.map(() => new Float32Array(BLOCK_SIZE));

  let stripMeters: StripMeter[] = [];
  let renderedScene = sceneJson;
  // Live strip meters are windowed (they decay on silence), so accumulate a
  // peak-hold across the whole bounce and capture the goniometer at the loudest block.
  const meterState = activeTracks.map(() => ({
    peakDb: -120,
    rmsDb: -120,
    truePeakDb: -120,
    correlation: 0,
    monoCompatible: true,
    loudestPeak: -Infinity,
    goniometer: [] as GoniometerPoint[],
  }));
  try {
    for (let pos = 0; pos < frames; pos += BLOCK_SIZE) {
      const n = Math.min(BLOCK_SIZE, frames - pos);
      for (let s = 0; s < activeTracks.length; s++) {
        copyBlock(leftChannels[s], pos, n, blockL[s]);
        copyBlock(rightChannels[s], pos, n, blockR[s]);
      }
      const mixed = mixer.processStereo(blockL, blockR);
      const count = Math.min(n, mixed.left.length);
      for (let i = 0; i < count; i++) {
        outLeft[pos + i] = mixed.left[i];
        outRight[pos + i] = mixed.right[i];
      }
      for (let s = 0; s < activeTracks.length; s++) {
        accumulateStripMeter(mixer, s, meterState[s]);
      }
    }
    stripMeters = activeTracks.map((track, index) => ({
      id: track.id,
      name: track.name,
      peakDb: meterState[index].peakDb,
      rmsDb: meterState[index].rmsDb,
      truePeakDb: meterState[index].truePeakDb,
      correlation: meterState[index].correlation,
      monoCompatible: meterState[index].monoCompatible,
      goniometer: meterState[index].goniometer,
    }));
    try {
      renderedScene = mixer.toSceneJson();
    } catch {
      renderedScene = sceneJson;
    }
  } finally {
    mixer.delete();
  }

  postProgress(request.id, 0.8, 'Applying master fader');
  const gain = dbToLinear(masterFaderDb);
  if (gain !== 1) {
    for (let i = 0; i < frames; i++) {
      outLeft[i] *= gain;
      outRight[i] *= gain;
    }
  }

  const stats = calculateStats(outLeft, outRight);
  const integratedLufs = measureIntegratedLufs(outLeft, outRight, sampleRate, stats.integratedLufs);
  const truePeakDb = measureMasterTruePeak(outLeft, outRight, sampleRate, stats.peakDb);
  return {
    left: outLeft,
    right: outRight,
    sampleRate,
    duration: frames / sampleRate,
    meters: [],
    stripMeters,
    sceneJson: renderedScene,
    peakDb: stats.peakDb,
    rmsDb: stats.rmsDb,
    integratedLufs,
    truePeakDb,
    correlation: stats.correlation,
  };
}

function measureIntegratedLufs(
  left: Float32Array,
  right: Float32Array,
  sampleRate: number,
  fallback: number,
): number {
  if (!wasmModule) return fallback;
  try {
    const length = Math.min(left.length, right.length);
    // Measure true stereo loudness: a mono (L+R)*0.5 downmix under-reads by ~3 dB
    // versus the ITU-R BS.1770 channel-weighted sum used by lufsInterleaved.
    const interleaved = new Float32Array(length * 2);
    for (let i = 0; i < length; i++) {
      interleaved[i * 2] = left[i];
      interleaved[i * 2 + 1] = right[i];
    }
    const result = wasmModule.lufsInterleaved(interleaved, 2, sampleRate);
    return Number.isFinite(result.integratedLufs) ? result.integratedLufs : fallback;
  } catch {
    return fallback;
  }
}

// Master True Peak measured on the final post-master-fader stereo output; the
// per-strip meter tap runs before the master fader and L/R sum and under-reads.
function measureMasterTruePeak(
  left: Float32Array,
  right: Float32Array,
  sampleRate: number,
  fallback: number,
): number {
  if (!wasmModule) return fallback;
  try {
    const leftTp = wasmModule.meteringTruePeakDb(left, sampleRate, 4);
    const rightTp = wasmModule.meteringTruePeakDb(right, sampleRate, 4);
    const truePeak = Math.max(leftTp, rightTp);
    return Number.isFinite(truePeak) ? truePeak : fallback;
  } catch {
    return fallback;
  }
}

// Extra render frames so reverb decay and per-channel delay compensation ring out
// past the dry input instead of being truncated at the last dry sample.
function tailFrames(
  tracks: MixingTrackRenderState[],
  reverb: ReverbConfig | undefined,
  sampleRate: number,
): number {
  const maxDelay = tracks.reduce((max, track) => Math.max(max, track.channelDelaySamples ?? 0), 0);
  let tail = maxDelay;
  if (reverb?.enabled && reverb.decaySec > 0) {
    tail += Math.ceil(reverb.decaySec * sampleRate);
    tail += Math.ceil(((reverb.preDelayMs ?? 0) / 1000) * sampleRate);
  }
  return tail;
}

function applyAutomation(
  mixer: MixerInstance,
  tracks: MixingTrackRenderState[],
  sampleRate: number,
) {
  tracks.forEach((track, index) => {
    const points = track.automation;
    if (!points?.length) return;
    for (const point of points) {
      const samplePos = Math.max(0, Math.round(point.timeSec * sampleRate));
      try {
        if (point.param === 'fader')
          mixer.scheduleFaderAutomation(index, samplePos, point.value, point.curve);
        else if (point.param === 'pan')
          mixer.schedulePanAutomation(index, samplePos, point.value, point.curve);
        else if (point.param === 'width')
          mixer.scheduleWidthAutomation(index, samplePos, point.value, point.curve);
      } catch {
        // Ignore malformed automation events rather than failing the whole bounce.
      }
    }
  });
}

interface StripMeterState {
  peakDb: number;
  rmsDb: number;
  truePeakDb: number;
  correlation: number;
  monoCompatible: boolean;
  loudestPeak: number;
  goniometer: GoniometerPoint[];
}

function accumulateStripMeter(mixer: MixerInstance, index: number, state: StripMeterState) {
  let snapshot: MixMeterSnapshot | null = null;
  try {
    snapshot = mixer.stripMeter(index, 'postFader');
  } catch {
    return;
  }
  if (!snapshot) return;
  const peak = Math.max(snapshot.peakDbL, snapshot.peakDbR);
  state.peakDb = Math.max(state.peakDb, peak);
  state.rmsDb = Math.max(state.rmsDb, Math.max(snapshot.rmsDbL, snapshot.rmsDbR));
  state.truePeakDb = Math.max(state.truePeakDb, snapshot.maxTruePeakDb);
  // Capture phase/correlation + the goniometer trace from the loudest block.
  if (peak > state.loudestPeak) {
    state.loudestPeak = peak;
    state.correlation = snapshot.correlation;
    state.monoCompatible = snapshot.likelyMonoCompatible;
    try {
      // readGoniometerLatest returns an embind-backed array whose constructor is a
      // wrapped method, so it is not structured-cloneable and would break postMessage.
      // Array.from() re-roots it as a plain array before it reaches the done payload.
      state.goniometer = Array.from(mixer.readGoniometerLatest(index, GONIO_POINTS) || []);
    } catch {
      // Keep the previous trace if this read fails.
    }
  }
}

function padChannel(
  samples: Float32Array,
  offsetSeconds: number,
  sampleRate: number,
  frames: number,
): Float32Array {
  const offsetFrames = Math.max(0, Math.round(offsetSeconds * sampleRate));
  const output = new Float32Array(frames);
  const limit = Math.min(samples.length, frames - offsetFrames);
  for (let i = 0; i < limit; i++) output[offsetFrames + i] = samples[i];
  return output;
}

function copyBlock(source: Float32Array, pos: number, n: number, dest: Float32Array) {
  for (let i = 0; i < n; i++) dest[i] = source[pos + i];
  for (let i = n; i < dest.length; i++) dest[i] = 0;
}

function emptyResult(
  left: Float32Array,
  right: Float32Array,
  sampleRate: number,
): MixingBounceResult {
  return {
    left,
    right,
    sampleRate,
    duration: left.length / sampleRate,
    meters: [],
    stripMeters: [],
    sceneJson: '',
    peakDb: -120,
    rmsDb: -120,
    integratedLufs: -120,
    truePeakDb: -120,
    correlation: 0,
  };
}

function calculateStats(left: Float32Array, right: Float32Array) {
  const length = Math.min(left.length, right.length);
  let peak = 0;
  let sum = 0;
  let sumLR = 0;
  let sumL2 = 0;
  let sumR2 = 0;

  for (let i = 0; i < length; i++) {
    const l = left[i];
    const r = right[i];
    peak = Math.max(peak, Math.abs(l), Math.abs(r));
    sum += (l * l + r * r) * 0.5;
    sumLR += l * r;
    sumL2 += l * l;
    sumR2 += r * r;
  }

  const denominator = Math.sqrt(sumL2 * sumR2);
  const rms = Math.sqrt(sum / Math.max(1, length));
  return {
    peakDb: amplitudeToDb(peak),
    rmsDb: amplitudeToDb(rms),
    // Approximate program loudness from RMS (K-weighting is applied by the engine meters).
    integratedLufs: rms > 0 ? 20 * Math.log10(rms) - 3 : -120,
    correlation: denominator > 0 ? Math.max(-1, Math.min(1, sumLR / denominator)) : 0,
  };
}

function maxTrackFrames(tracks: MixingTrackRenderState[], sampleRate: number): number {
  return tracks.reduce((max, track) => {
    const offsetFrames = Math.max(0, Math.round(track.offsetSeconds * sampleRate));
    return Math.max(max, offsetFrames + track.left.length, offsetFrames + track.right.length);
  }, 0);
}

function dbToLinear(db: number): number {
  return 10 ** (db / 20);
}

function amplitudeToDb(value: number): number {
  return value > 0 ? 20 * Math.log10(value) : -120;
}

function postProgress(id: number, progress: number, stage: string) {
  self.postMessage({ type: 'progress', id, progress, stage });
}
