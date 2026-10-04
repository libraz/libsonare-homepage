/**
 * The /mastering page controller. One project state is the single source:
 * every edit is a mutator from `masteringState.ts` committed to history, and
 * each change reaches the live engine as the op diff `masteringEngine.diff`
 * derives, the session store as JSON, and the export Worker as the state the
 * bounce renders. PCM lives only in the audio registry; Worker jobs run one at
 * a time because each one borrows the clips it needs.
 */

import { type ComputedRef, computed, ref, shallowRef, watch } from 'vue';
import type { EngineTransportLoop } from '@/components/ui/EngineTransport.vue';
import { useHistory } from '@/composables/useHistory';
import { type UseSonareEngine, useSonareEngine } from '@/composables/useSonareEngine';
import type {
  MasteringExportResult,
  MasteringMeasureResult,
  MasteringReferenceResult,
} from '@/demos/mastering/mastering.worker';
import type { MasteringCopy } from '@/demos/mastering/masteringCopy';
import {
  buildFull,
  clipOps,
  diff,
  laneFaderOps,
  laneMatchGains,
  MASTERING_LANE_TRACK,
  type MasteringAudio,
  type MasteringClip,
  repairChainConfig,
} from '@/demos/mastering/masteringEngine';
import { createMasteringReport } from '@/demos/mastering/masteringReport';
import {
  defaultMasteringState,
  isLoudnessFitStale,
  MASTERING_SLOT,
  type MasteringLane,
  type MasteringMutatorName,
  type MasteringState,
  masteringMutators,
  masteringTargetLufs,
} from '@/demos/mastering/masteringState';
import { MASTERING_MAX_SECONDS } from '@/demos/mastering/masteringUi';
import {
  createMasteringWorkerClient,
  type MasteringAudioRegistry,
  type MasteringJob,
  MasteringJobCancelled,
  type MasteringProgress,
} from '@/demos/mastering/masteringWorkerClient';
import {
  type MasteringInsightReport,
  useMasteringInsights,
} from '@/demos/mastering/useMasteringInsights';
import {
  type MasteringMetering,
  useMasteringMetering,
} from '@/demos/mastering/useMasteringMetering';
import { useMasteringSession } from '@/demos/mastering/useMasteringSession';
import {
  AudioInputBudgetError,
  decodeAudioBuffer,
  downsampleWaveform,
  jsonBlob,
  triggerDownload,
  type WavDither,
  type WaveformPeak,
  type WavFormat,
  wavBlob,
  wavBounceOptions,
} from '@/utils/audio';
import { applyOps, createFacadeTarget, type EngineTarget } from '@/utils/engineApply';

export type MasteringPresetId =
  | 'pop'
  | 'edm'
  | 'acoustic'
  | 'liveSmall'
  | 'liveLarge'
  | 'hiphop'
  | 'aiMusic'
  | 'speech';
/** Preset names accepted by libsonare's mastering assistant. */
export type MasteringAssistantPreset = 'pop' | 'edm' | 'acoustic' | 'hipHop' | 'aiMusic' | 'speech';
export type MasteringVenueId = 'studio' | 'livehouseSmall' | 'livehouseLarge';
export type MasteringPlatformId = 'spotify' | 'youtube' | 'apple' | 'tiktok' | 'custom';
/** One platform the delivery preview estimates. */
export interface MasteringStreamingTarget {
  name: string;
  targetLufs: number;
  ceilingDb: number;
}

type Wasm = typeof import('@/wasm/index.js');
type Mutators = typeof masteringMutators;
/** Arguments of a mutator after the state. */
export type MutatorArgs<K extends MasteringMutatorName> = Mutators[K] extends (
  state: MasteringState,
  ...args: infer A
) => MasteringState
  ? A
  : never;

/** A loaded file as the page shows it. */
export interface MasteringFileInfo {
  fileName: string;
  sampleRate: number;
  duration: number;
  channels: number;
}

export type MasteringJobKind = 'prepare' | 'fit' | 'export' | 'assist' | 'reference' | 'preview';

/** The Worker job in flight. */
export interface MasteringJobState {
  kind: MasteringJobKind;
  progress: number;
  cancel(): void;
}

/** Jobs during which the project must not change: their result is written back into it. */
const LOCKING_JOBS: readonly MasteringJobKind[] = ['fit', 'export'];

/** The last export render. */
export interface MasteringRenderRecord {
  result: MasteringExportResult;
  format: WavFormat;
  dither: WavDither;
  at: number;
  url: string;
  fileName: string;
}

export type MasteringErrorKey = keyof MasteringCopy['errors'];

/** Quiet period after a repair edit before the preprocess reruns. */
const PREPARE_DELAY_MS = 400;
/** Quiet period after a lane-1 edit before its loudness is measured again for the A/B match. */
export const MEASURE_DELAY_MS = 1500;
/** How long the rack shows that a discrete edit rebuilt the inserts. */
const RESET_FLASH_MS = 700;
/** Waveform columns kept for the timeline; zoom reads subsets of them. */
const WAVEFORM_POINTS = 8192;
/** The engine tempo: a quarter note is one second, so ppq = seconds. */
const ENGINE_BPM = 60;

const EMPTY_LOOP: EngineTransportLoop = { enabled: false, start: 0, end: 0 };

function newAudioId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function stereoOf(buffer: AudioBuffer): { left: Float32Array; right: Float32Array } {
  const left = buffer.getChannelData(0).slice();
  const right = buffer.numberOfChannels > 1 ? buffer.getChannelData(1).slice() : left.slice();
  return { left, right };
}

/** Everything that changes what lane 1 renders; a measured After loudness is valid for one key. */
function afterKey(state: MasteringState): string {
  return JSON.stringify([state.source?.id ?? null, state.repair, state.eq, state.inserts]);
}

function fileBase(name: string): string {
  return name.replace(/\.[^.]+$/, '') || 'master';
}

export function useMastering(options: { copy: ComputedRef<MasteringCopy> }) {
  const sonare: UseSonareEngine = useSonareEngine();
  const worker = createMasteringWorkerClient();
  const session = useMasteringSession();
  const registry: MasteringAudioRegistry = new Map();
  const wasm = shallowRef<Wasm | null>(null);
  let target: EngineTarget | null = null;

  /** True once lane clips and strips are on the engine for the current program. */
  const applied = ref(false);
  const pendingRestore = ref(false);
  const restoreNotices = ref<string[]>([]);
  const error = ref<MasteringErrorKey | null>(null);
  const loading = ref<'source' | 'reference' | null>(null);
  const sourceInfo = shallowRef<MasteringFileInfo | null>(null);
  const referenceInfo = shallowRef<MasteringFileInfo | null>(null);
  const referenceReady = ref(false);
  const referenceAnalysis = shallowRef<MasteringReferenceResult | null>(null);
  const programLufs = ref(Number.NaN);
  /** Loudness of lane 1's output and the {@link afterKey} it was measured on. */
  const afterLoudness = shallowRef<{ key: string; lufs: number } | null>(null);
  const waveform = shallowRef<WaveformPeak[] | null>(null);
  const job = shallowRef<MasteringJobState | null>(null);
  const prepareFailed = ref(false);
  const resetFlash = ref(0);
  const lastRender = shallowRef<MasteringRenderRecord | null>(null);
  const loop = ref<EngineTransportLoop>({ ...EMPTY_LOOP });
  const now = ref(Date.now());

  const history = useHistory(defaultMasteringState(), { onChange });
  const state = history.state;

  function registryAudio(): MasteringAudio {
    return {
      program: registry.get('program') ?? null,
      reference: referenceReady.value ? (registry.get('reference') ?? null) : null,
      afterLufs: afterLoudness.value?.lufs,
    };
  }

  const metering: MasteringMetering = useMasteringMetering({
    sonare,
    wasm,
    program: () => registry.get('program'),
  });

  // -------------------------------------------------------------------------
  // State → engine

  let prepareTimer: ReturnType<typeof setTimeout> | null = null;
  let measureTimer: ReturnType<typeof setTimeout> | null = null;
  let measureHandle: MasteringJob<MasteringMeasureResult> | null = null;
  let measureRequest = 0;
  let flashTimer: ReturnType<typeof setTimeout> | null = null;

  function flashReset(): void {
    resetFlash.value = Date.now();
    if (flashTimer) clearTimeout(flashTimer);
    flashTimer = setTimeout(() => {
      resetFlash.value = 0;
    }, RESET_FLASH_MS);
  }

  function onChange(prev: MasteringState, next: MasteringState): void {
    session.save(next);
    if (applied.value && target) {
      const change = diff(prev, next, registryAudio());
      applyOps(target, change.ops);
      if (change.discrete) flashReset();
    }
    if (JSON.stringify(prev.repair) !== JSON.stringify(next.repair) && registry.has('source')) {
      schedulePrepare();
    }
    if (next.monitor.matchLoudness && !prev.monitor.matchLoudness) scheduleMeasure(0);
    else if (afterKey(prev) !== afterKey(next)) scheduleMeasure();
  }

  const editLocked = computed(
    () =>
      loading.value === 'source' || (job.value !== null && LOCKING_JOBS.includes(job.value.kind)),
  );

  /** Applies one mutator as one history entry (a drag folds its entries between begin and end). */
  function edit<K extends MasteringMutatorName>(name: K, ...args: MutatorArgs<K>): void {
    if (editLocked.value) return;
    const mutate = masteringMutators[name] as unknown as (
      s: MasteringState,
      ...a: MutatorArgs<K>
    ) => MasteringState;
    let next: MasteringState;
    try {
      next = mutate(state.value, ...args);
    } catch (cause) {
      console.warn(`mastering: ${String(name)} rejected`, cause);
      return;
    }
    if (next !== state.value) history.commit(next);
  }

  function undo(): void {
    if (!editLocked.value) history.undo();
  }

  function redo(): void {
    if (!editLocked.value) history.redo();
  }

  // -------------------------------------------------------------------------
  // Worker jobs, one at a time

  let queue: Promise<unknown> = Promise.resolve();

  function enqueue<T>(run: () => Promise<T>): Promise<T> {
    const result = queue.then(run, run);
    queue = result.catch(() => undefined);
    return result;
  }

  function runJob<T>(
    kind: MasteringJobKind,
    start: (progress: MasteringProgress) => MasteringJob<T>,
  ): Promise<T> {
    // A loudness measurement yields to the jobs the visitor waits on and reschedules itself.
    if (kind === 'prepare' || LOCKING_JOBS.includes(kind)) measureHandle?.cancel();
    return enqueue(async () => {
      const handle = start((progress) => {
        if (job.value) job.value = { ...job.value, progress };
      });
      job.value = { kind, progress: 0, cancel: handle.cancel };
      try {
        return await handle.result;
      } finally {
        job.value = null;
      }
    });
  }

  function cancelJob(): void {
    job.value?.cancel();
  }

  async function ensureEngine(): Promise<boolean> {
    if (target) return true;
    if (!(await sonare.start())) {
      error.value = 'engine';
      return false;
    }
    const live = sonare.engine.value;
    if (!live) return false;
    live.setTempo(ENGINE_BPM);
    target = createFacadeTarget(live);
    wasm.value = await import('@/wasm/index.js');
    return true;
  }

  function buildEngine(): void {
    if (!target || !registry.has('program')) return;
    applyOps(target, buildFull(state.value, registryAudio()));
    applied.value = true;
    pendingRestore.value = false;
  }

  /** Re-sends the lane clips and the lane faders after the audio changed. */
  function refreshLanes(lanes: readonly MasteringLane[]): void {
    if (!target || !applied.value) return;
    const audio = registryAudio();
    const tracks = lanes.map((lane) => MASTERING_LANE_TRACK[lane]);
    const clips = clipOps(audio).filter((op) => op.type === 'clips' && tracks.includes(op.trackId));
    applyOps(target, [...clips, ...laneFaderOps(state.value, audio)]);
  }

  function schedulePrepare(): void {
    if (prepareTimer) clearTimeout(prepareTimer);
    prepareTimer = setTimeout(() => {
      prepareTimer = null;
      void runPrepare();
    }, PREPARE_DELAY_MS);
  }

  /** Puts the new program on the lanes, or builds the project on its first program. */
  function programReady(): void {
    const program = registry.get('program');
    if (program) {
      programLufs.value = program.integratedLufs;
      waveform.value = downsampleWaveform(program.left, program.right, WAVEFORM_POINTS);
    }
    if (applied.value) refreshLanes(['after', 'before']);
    else buildEngine();
    scheduleMeasure(0);
  }

  /**
   * Runs the repair preprocess; resolves false when it was cancelled or failed.
   * With no repair stage enabled the program is a copy of the source and no
   * Worker job runs.
   */
  async function runPrepare(): Promise<boolean> {
    if (!registry.has('source')) return false;
    if (!repairChainConfig(state.value.repair)) {
      // Queued, so no running job can put an older program back over this one.
      const copied = await enqueue(async () => {
        const source = registry.get('source');
        if (!source || repairChainConfig(state.value.repair)) return false;
        registry.set('program', {
          left: source.left.slice(),
          right: source.right.slice(),
          sampleRate: source.sampleRate,
          integratedLufs: Number.NaN,
        });
        return true;
      });
      if (!copied) return false;
      prepareFailed.value = false;
      programReady();
      return true;
    }
    try {
      await runJob('prepare', (progress) => worker.prepare(registry, state.value.repair, progress));
    } catch (cause) {
      prepareFailed.value = true;
      if (!(cause instanceof MasteringJobCancelled)) {
        console.warn('mastering: repair failed', cause);
        error.value = 'repairFailed';
      }
      return false;
    }
    prepareFailed.value = false;
    programReady();
    return true;
  }

  // -------------------------------------------------------------------------
  // Lane loudness for the A/B match

  function measureNeeded(): boolean {
    return (
      applied.value &&
      state.value.monitor.matchLoudness &&
      registry.has('program') &&
      (Number.isNaN(programLufs.value) || afterLoudness.value?.key !== afterKey(state.value))
    );
  }

  /** True while the match gains wait for a loudness the page has not measured yet. */
  const matchPending = computed(
    () =>
      applied.value &&
      state.value.monitor.matchLoudness &&
      (Number.isNaN(programLufs.value) || afterLoudness.value?.key !== afterKey(state.value)),
  );

  function applyLaneFaders(): void {
    if (target && applied.value) applyOps(target, laneFaderOps(state.value, registryAudio()));
  }

  /** Drops the pending measurement and stops the one in flight. */
  function cancelMeasure(): void {
    if (measureTimer) clearTimeout(measureTimer);
    measureTimer = null;
    measureRequest += 1;
    measureHandle?.cancel();
  }

  /** Measures the lanes `delay` ms after the last call; an edit meanwhile restarts the wait. */
  function scheduleMeasure(delay = MEASURE_DELAY_MS): void {
    cancelMeasure();
    if (!measureNeeded()) return;
    if (delay <= 0) {
      void runMeasure();
      return;
    }
    measureTimer = setTimeout(() => {
      measureTimer = null;
      void runMeasure();
    }, delay);
  }

  async function runMeasure(): Promise<void> {
    const request = ++measureRequest;
    try {
      const outcome = await enqueue(async () => {
        if (request !== measureRequest || !measureNeeded()) return null;
        const snapshot = state.value;
        const handle = worker.measure(registry, snapshot);
        measureHandle = handle;
        try {
          return { key: afterKey(snapshot), result: await handle.result };
        } finally {
          measureHandle = null;
        }
      });
      if (!outcome) return;
      programLufs.value = outcome.result.programLufs;
      afterLoudness.value = { key: outcome.key, lufs: outcome.result.afterLufs };
      applyLaneFaders();
    } catch (cause) {
      if (!(cause instanceof MasteringJobCancelled)) {
        console.warn('mastering: loudness measurement failed', cause);
      } else if (request === measureRequest) {
        scheduleMeasure();
      }
    }
  }

  /** Records a loudness a fit or an export measured on the current lane 1. */
  function recordAfterLoudness(lufs: number): void {
    afterLoudness.value = { key: afterKey(state.value), lufs };
    applyLaneFaders();
  }

  // -------------------------------------------------------------------------
  // Loading audio

  async function decode(
    file: File,
  ): Promise<{ clip: MasteringClip; info: MasteringFileInfo } | null> {
    const context = sonare.context.value;
    if (!context) return null;
    try {
      const buffer = await decodeAudioBuffer(file, context, {
        maxDurationSeconds: MASTERING_MAX_SECONDS,
      });
      const { left, right } = stereoOf(buffer);
      return {
        clip: { left, right, sampleRate: buffer.sampleRate, integratedLufs: Number.NaN },
        info: {
          fileName: file.name,
          sampleRate: buffer.sampleRate,
          duration: buffer.duration,
          channels: buffer.numberOfChannels,
        },
      };
    } catch (cause) {
      error.value = cause instanceof AudioInputBudgetError ? 'tooLong' : 'loadFailed';
      return null;
    }
  }

  async function loadSource(file: File): Promise<void> {
    if (loading.value || editLocked.value) return;
    error.value = null;
    loading.value = 'source';
    try {
      if (!(await ensureEngine())) return;
      const decoded = await decode(file);
      if (!decoded) return;
      if (prepareTimer) clearTimeout(prepareTimer);
      prepareTimer = null;
      cancelMeasure();
      // Jobs in flight hold clips of the old source and put them back when they settle.
      await queue;
      sonare.stop();
      applied.value = false;
      afterLoudness.value = null;
      programLufs.value = Number.NaN;
      registry.clear();
      registry.set('source', decoded.clip);
      referenceReady.value = false;
      referenceInfo.value = null;
      referenceAnalysis.value = null;
      lastRender.value = null;
      waveform.value = null;
      sourceInfo.value = decoded.info;
      loop.value = { enabled: false, start: 0, end: decoded.info.duration };
      metering.reset();
      const audioRef = {
        id: newAudioId(),
        fileName: decoded.info.fileName,
        sampleRate: decoded.clip.sampleRate,
        frames: decoded.clip.left.length,
        channels: decoded.info.channels,
      };
      // A new source starts a new undo history; edits before it do not apply to this audio.
      history.reset(
        masteringMutators.setReference(masteringMutators.setSource(state.value, audioRef), null),
      );
    } finally {
      loading.value = null;
    }
    if (await runPrepare()) void insights.analyzeSourceInsights();
  }

  async function loadDemo(): Promise<void> {
    try {
      const response = await fetch('/demo.mp3');
      const blob = await response.blob();
      await loadSource(new File([blob], 'demo.mp3', { type: blob.type || 'audio/mpeg' }));
    } catch {
      error.value = 'loadFailed';
    }
  }

  async function loadReference(file: File): Promise<void> {
    if (loading.value || !registry.has('program')) return;
    error.value = null;
    loading.value = 'reference';
    let decoded: Awaited<ReturnType<typeof decode>>;
    try {
      decoded = await decode(file);
    } finally {
      loading.value = null;
    }
    if (!decoded) return;
    registry.set('reference', decoded.clip);
    referenceReady.value = false;
    referenceAnalysis.value = null;
    referenceInfo.value = decoded.info;
    try {
      referenceAnalysis.value = await runJob('reference', (progress) =>
        worker.analyzeReference(registry, progress),
      );
    } catch (cause) {
      if (!(cause instanceof MasteringJobCancelled)) error.value = 'referenceFailed';
      registry.delete('reference');
      referenceInfo.value = null;
      history.commit(masteringMutators.setReference(state.value, null));
      return;
    }
    const conformed = registry.get('reference');
    if (!conformed) return;
    referenceReady.value = true;
    refreshLanes(['reference']);
    // Not a user edit: written even while another job holds the edit lock.
    history.commit(
      masteringMutators.setReference(state.value, {
        id: newAudioId(),
        fileName: decoded.info.fileName,
        sampleRate: conformed.sampleRate,
        frames: conformed.left.length,
        channels: decoded.info.channels,
      }),
    );
  }

  function clearReference(): void {
    if (editLocked.value) return;
    edit('setReference', null);
    registry.delete('reference');
    referenceReady.value = false;
    referenceInfo.value = null;
    referenceAnalysis.value = null;
    refreshLanes(['reference']);
  }

  // -------------------------------------------------------------------------
  // Loudness fit and export

  const fitStale = computed(() => isLoudnessFitStale(state.value));
  const targetLufs = computed(() => masteringTargetLufs(state.value));
  const hasProgram = computed(() => applied.value);

  async function fit(): Promise<void> {
    if (!hasProgram.value || editLocked.value) return;
    error.value = null;
    try {
      const result = await runJob('fit', (progress) => worker.fit(registry, state.value, progress));
      history.commit(masteringMutators.applyLoudnessFit(state.value, result));
      recordAfterLoudness(result.measuredLufs);
    } catch (cause) {
      if (!(cause instanceof MasteringJobCancelled)) {
        console.warn('mastering: loudness fit failed', cause);
        error.value = 'fitFailed';
      }
    }
  }

  async function exportMaster(format: WavFormat, dither: WavDither): Promise<void> {
    if (!hasProgram.value || editLocked.value) return;
    error.value = null;
    const refit = fitStale.value;
    const snapshot = state.value;
    let result: MasteringExportResult;
    try {
      result = await runJob('export', (progress) =>
        worker.bounce(registry, snapshot, wavBounceOptions(format, dither), refit, progress),
      );
    } catch (cause) {
      if (!(cause instanceof MasteringJobCancelled)) {
        console.warn('mastering: export failed', cause);
        error.value = 'exportFailed';
      }
      return;
    }
    // The refit drive goes back into the project, so the preview is the export.
    if (result.fit) history.commit(masteringMutators.applyLoudnessFit(state.value, result.fit));
    recordAfterLoudness(result.integratedLufs);
    const master = registry.get('master');
    if (!master) return;
    if (lastRender.value) URL.revokeObjectURL(lastRender.value.url);
    const url = URL.createObjectURL(
      wavBlob([master.left, master.right], master.sampleRate, format),
    );
    const fileName = `${fileBase(sourceInfo.value?.fileName ?? 'master')}-master.wav`;
    lastRender.value = { result, format, dither, at: Date.now(), url, fileName };
    triggerDownload(url, fileName);
    void insights.analyzeSourceInsights();
  }

  function downloadRender(): void {
    const render = lastRender.value;
    if (render) triggerDownload(render.url, render.fileName);
  }

  function downloadReport(): void {
    const render = lastRender.value;
    if (!render) return;
    const url = URL.createObjectURL(
      jsonBlob(createMasteringReport({ state: state.value, source: sourceInfo.value, render })),
    );
    triggerDownload(url, `${fileBase(render.fileName)}-report.json`);
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  // -------------------------------------------------------------------------
  // Monitoring and transport

  const matchGains = computed(() => {
    // The registry is not reactive; the program's loudness lands in `programLufs`.
    void programLufs.value;
    return laneMatchGains(state.value, registryAudio());
  });
  const duration = computed(() => sourceInfo.value?.duration ?? 0);
  const canMonitorReference = computed(
    () => referenceReady.value && state.value.reference !== null,
  );

  function setLane(lane: MasteringLane): void {
    if (lane === 'reference' && !canMonitorReference.value) return;
    edit('setMonitorLane', lane);
  }

  function play(): void {
    if (!hasProgram.value) return;
    // Integrated loudness and the true-peak maximum cover this pass only.
    sonare.engine.value?.resetMasterLoudnessMeter();
    metering.reset();
    sonare.play();
  }

  function stop(): void {
    sonare.stop();
  }

  function togglePlay(): void {
    if (sonare.playing.value) stop();
    else play();
  }

  function seek(seconds: number): void {
    sonare.seek(Math.max(0, Math.min(duration.value, seconds)));
  }

  function setLoop(next: EngineTransportLoop): void {
    loop.value = { ...next };
    sonare.engine.value?.setLoop(next.start, next.end, next.enabled);
  }

  function toggleLoop(): void {
    if (!hasProgram.value) return;
    const current = loop.value;
    const end = current.end > current.start ? current.end : duration.value;
    setLoop({ ...current, end, enabled: !current.enabled });
  }

  watch(sonare.position, (seconds) => {
    if (
      sonare.playing.value &&
      !loop.value.enabled &&
      duration.value > 0 &&
      seconds >= duration.value
    ) {
      stop();
      seek(0);
    }
  });

  // -------------------------------------------------------------------------
  // Assistant, reference match

  const ceilingDb = computed(
    () => state.value.inserts[MASTERING_SLOT.limiter].params.ceilingDb as number,
  );
  const presetId = computed(() => state.value.quick.preset);

  const insights = useMasteringInsights(
    {
      source: hasProgram,
      async analyzeSource(platforms, preset): Promise<MasteringInsightReport> {
        const assisted = await runJob('assist', (progress) =>
          worker.assist(registry, preset, progress),
        );
        let streamingPreview: unknown = null;
        if (registry.has('master')) {
          const rows = await runJob('preview', (progress) =>
            worker.previewPlatforms(registry, platforms, progress),
          );
          streamingPreview = { platforms: rows };
        }
        return {
          profile: assisted.profile,
          suggestions: assisted.suggestions,
          streamingPreview,
          chainParams: assisted.chainParams,
          unmapped: assisted.unmapped,
        };
      },
    },
    ceilingDb,
    presetId,
    computed(() => options.copy.value.insights.profileItems),
  );

  function applyAssistant(): void {
    const params = insights.insightReport.value?.chainParams;
    if (params) edit('applyAssistant', params);
  }

  function applyMatchEq(): void {
    const analysis = referenceAnalysis.value;
    const reference = state.value.reference;
    if (analysis && reference) edit('applyMatchEq', analysis.matchEq, reference.id);
  }

  // -------------------------------------------------------------------------
  // Lifecycle

  const clock = setInterval(() => {
    now.value = Date.now();
  }, 1000);

  function restore(): void {
    const restored = session.restore();
    if (!restored) return;
    history.reset(restored.state);
    restoreNotices.value = restored.notices;
    pendingRestore.value = restored.state.source !== null;
  }

  function dispose(): void {
    clearInterval(clock);
    if (prepareTimer) clearTimeout(prepareTimer);
    cancelMeasure();
    if (flashTimer) clearTimeout(flashTimer);
    session.flush();
    session.dispose();
    metering.dispose();
    worker.dispose();
    if (lastRender.value) URL.revokeObjectURL(lastRender.value.url);
    void sonare.dispose();
  }

  return {
    sonare,
    wasm,
    state,
    canUndo: history.canUndo,
    canRedo: history.canRedo,
    undo,
    redo,
    edit,
    begin: history.begin,
    end: history.end,
    editLocked,
    applied,
    hasProgram,
    pendingRestore,
    restoreNotices,
    error,
    loading,
    sourceInfo,
    referenceInfo,
    referenceReady,
    referenceAnalysis,
    canMonitorReference,
    programLufs,
    waveform,
    duration,
    job,
    cancelJob,
    prepareFailed,
    runPrepare,
    resetFlash,
    lastRender,
    now,
    loop,
    metering,
    matchGains,
    matchPending,
    fitStale,
    targetLufs,
    insights,
    loadSource,
    loadDemo,
    loadReference,
    clearReference,
    fit,
    exportMaster,
    downloadRender,
    downloadReport,
    setLane,
    play,
    stop,
    togglePlay,
    seek,
    setLoop,
    toggleLoop,
    applyAssistant,
    applyMatchEq,
    restore,
    dispose,
  };
}

export type MasteringController = ReturnType<typeof useMastering>;
