/**
 * The /mixing page controller. One project state is the single source: every
 * edit is a mutator from `mixingState.ts` committed to history, and each
 * change reaches the live engine as the op diff `mixingEngine.diff` derives,
 * the session store as JSON, and the export Worker as the state it bounces.
 *
 * The engine holds the *audible* state: the user's mix (A) or, while a mix
 * assistant suggestion is auditioned, that mix with the suggestion applied
 * (B). Both reach the engine through the same diff, so switching is setters
 * only. A channel-delay edit made while playing is held back until the
 * transport stops, because a live delay change misaligns the other lanes.
 *
 * PCM lives only in the audio registry, keyed by track id. Worker jobs borrow
 * every clip (transferred, not copied), so they run one at a time and lock
 * editing until the audio is back.
 */

import { type ComputedRef, computed, ref, type ShallowRef, shallowRef, watch } from 'vue';
import { useHistory } from '@/composables/useHistory';
import { type UseSonareEngine, useSonareEngine } from '@/composables/useSonareEngine';
import { abMatchGains } from '@/demos/mixing/mixAssistantMap';
import type {
  MixBounceResult,
  MixSuggestResult,
  MixWorkerStage,
} from '@/demos/mixing/mixing.worker';
import { createMixWorkerClient, type MixJob, type MixProgress } from '@/demos/mixing/mixingBounce';
import { MAX_DURATION_SECONDS } from '@/demos/mixing/mixingConstants';
import type { MixingCopy } from '@/demos/mixing/mixingCopy';
import {
  buildFull,
  diff,
  MIX_TEMPO_BPM,
  type MixAudio,
  secondsToPpq,
} from '@/demos/mixing/mixingEngine';
import {
  createEqResponder,
  type EqCurvePoint,
  type EqResponder,
} from '@/demos/mixing/mixingEqResponse';
import { parseMixingProject } from '@/demos/mixing/mixingProjectV1';
import {
  type AudioBudgetVerdict,
  addTrack,
  applyMixPatch,
  arrangementEndSec,
  checkAudioBudget,
  createMixingState,
  type LoopState,
  MIXING_MUTATORS,
  type MixingState,
  type StripEqBand,
} from '@/demos/mixing/mixingState';
import {
  fileBase,
  holdChannelDelays,
  pendingDelayIds,
  rebuiltTrackIds,
} from '@/demos/mixing/mixingUi';
import { type MixingMetering, useMixingMetering } from '@/demos/mixing/useMixingMetering';
import { useMixingSession } from '@/demos/mixing/useMixingSession';
import {
  AudioInputBudgetError,
  decodeAudioBuffer,
  downloadBlob,
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
import { WorkerJobCancelled } from '@/utils/workerRpc';

type Wasm = typeof import('@/wasm/index.js');
type Mutators = typeof MIXING_MUTATORS;
export type MixingMutatorName = keyof Mutators;
/** Arguments of a mutator after the state. */
export type MixingMutatorArgs<K extends MixingMutatorName> = Mutators[K] extends (
  state: MixingState,
  ...args: infer A
) => MixingState
  ? A
  : never;

/** What the page knows about a track's source audio. */
export interface MixTrackInfo {
  fileName: string;
  sampleRate: number;
  channels: number;
  durationSec: number;
  waveform: WaveformPeak[];
}

export type MixingJobKind = 'export' | 'suggest' | 'match';

export interface MixingJobState {
  kind: MixingJobKind;
  progress: number;
  stage: MixWorkerStage;
  cancel(): void;
}

export interface MixRender {
  result: MixBounceResult;
  format: WavFormat;
  dither: WavDither;
  url: string;
  fileName: string;
  at: number;
}

export type MixingErrorKey = keyof MixingCopy['errors'];
export type MixingNoticeKey = keyof MixingCopy['notices'];

export interface MixingNotice {
  key: MixingNoticeKey;
  values: Record<string, string | number>;
}

/** Which mix is audible: the user's (A) or the assistant's suggestion (B). */
export type AbSide = 'a' | 'b';

/** File name of the project JSON. */
export const MIX_PROJECT_FILE = 'libsonare-mix-project.json';
/** How long a strip shows that a discrete edit rebuilt its inserts. */
const RESET_FLASH_MS = 700;
/** Waveform columns kept per track; the arrangement draws subsets. */
const WAVEFORM_POINTS = 4096;
/** Crossover of the demo's low/high pseudo-stems. */
const DEMO_CROSSOVER_HZ = 250;

/**
 * Splits a signal into complementary bands with a one-pole low-pass (high =
 * input − low), so the two bands sum back to the source exactly.
 */
export function splitBands(samples: Float32Array, sampleRate: number, crossoverHz: number) {
  const coeff = 1 - Math.exp((-2 * Math.PI * crossoverHz) / sampleRate);
  const low = new Float32Array(samples.length);
  const high = new Float32Array(samples.length);
  let state = 0;
  for (let i = 0; i < samples.length; i++) {
    state += coeff * (samples[i] - state);
    low[i] = state;
    high[i] = samples[i] - state;
  }
  return { low, high };
}

function trackIdsKey(state: MixingState): string {
  return state.tracks.map((track) => track.id).join(',');
}

interface Decoded {
  audio: MixAudio;
  info: MixTrackInfo;
}

function decodedFrom(
  left: Float32Array,
  right: Float32Array,
  info: Omit<MixTrackInfo, 'waveform'>,
) {
  return {
    audio: { channels: [left, right], sampleRate: info.sampleRate },
    info: { ...info, waveform: downsampleWaveform(left, right, WAVEFORM_POINTS) },
  };
}

export interface MixingStudioOptions {
  copy: ComputedRef<MixingCopy>;
  /** The page's WASM module once booted; the engine boot also fills it. */
  wasm: ShallowRef<Wasm | null>;
}

export function useMixingStudio(options: MixingStudioOptions) {
  const sonare: UseSonareEngine = useSonareEngine();
  const worker = createMixWorkerClient();
  const session = useMixingSession();
  const registry = new Map<number, MixAudio>();
  const { wasm } = options;
  let target: EngineTarget | null = null;
  /** The state the engine currently holds; null until it is built. */
  let engineState: MixingState | null = null;

  const engineApplied = shallowRef<MixingState | null>(null);
  const trackInfo = shallowRef<ReadonlyMap<number, MixTrackInfo>>(new Map());
  const loading = ref(false);
  const error = ref<MixingErrorKey | null>(null);
  const notices = ref<MixingNotice[]>([]);
  const job = shallowRef<MixingJobState | null>(null);
  const lastRender = shallowRef<MixRender | null>(null);
  const suggestion = shallowRef<MixSuggestResult | null>(null);
  const ab = ref<AbSide>('a');
  const selectedId = ref<number | null>(null);
  const rebuilt = shallowRef<ReadonlySet<number>>(new Set());
  const restored = ref(false);
  let suggestionFor = '';
  /** Monitor gains that level-match A and B, with the A state they were measured on. */
  const match = shallowRef<{ aDb: number; bDb: number; measuredA: MixingState } | null>(null);

  const history = useHistory(createMixingState(), { onChange });
  const state = history.state;

  /** What the console shows and the engine plays. */
  const view = computed<MixingState>(() =>
    ab.value === 'b' && suggestion.value
      ? applyMixPatch(state.value, suggestion.value.suggestion.patch)
      : state.value,
  );

  const selectedTrack = computed(
    () => view.value.tracks.find((track) => track.id === selectedId.value) ?? null,
  );

  const metering: MixingMetering = useMixingMetering({
    sonare,
    wasm,
    laneOrder: () => engineState?.tracks.map((track) => track.id) ?? [],
    selected: () => {
      const track = selectedTrack.value;
      return track ? { track, audio: registry.get(track.id) } : null;
    },
  });

  // -------------------------------------------------------------------------
  // State → engine

  let flashTimer: ReturnType<typeof setTimeout> | null = null;

  function flash(ids: ReadonlySet<number>): void {
    rebuilt.value = ids;
    if (flashTimer) clearTimeout(flashTimer);
    flashTimer = setTimeout(() => {
      rebuilt.value = new Set();
    }, RESET_FLASH_MS);
  }

  function applyLoop(loop: LoopState): void {
    sonare.engine.value?.setLoop(
      secondsToPpq(loop.startSec),
      secondsToPpq(loop.endSec),
      loop.enabled,
    );
  }

  function desiredEngineState(): MixingState {
    return sonare.playing.value && engineState
      ? holdChannelDelays(view.value, engineState)
      : view.value;
  }

  /** Brings the engine from the state it holds to the audible one. */
  function syncEngine(): void {
    if (!target || !engineState) return;
    const next = desiredEngineState();
    if (next === engineState) return;
    const ops = diff(engineState, next, registry);
    const ids = rebuiltTrackIds(ops, engineState);
    applyOps(target, ops);
    if (JSON.stringify(engineState.loop) !== JSON.stringify(next.loop)) applyLoop(next.loop);
    engineState = next;
    engineApplied.value = next;
    if (ids.size > 0) flash(ids);
  }

  /** Constructs the audible state on the engine from scratch (load time, transport stopped). */
  function rebuildEngine(): void {
    if (!target) return;
    sonare.stop();
    const next = view.value;
    applyOps(target, buildFull(next, registry));
    applyLoop(next.loop);
    engineState = next;
    engineApplied.value = next;
  }

  function onChange(prev: MixingState, next: MixingState): void {
    session.save(next);
    if (suggestion.value && trackIdsKey(next) !== suggestionFor) {
      suggestion.value = null;
      ab.value = 'a';
    }
    if (selectedId.value !== null && !next.tracks.some((t) => t.id === selectedId.value)) {
      selectedId.value = next.tracks[0]?.id ?? null;
    }
    if (prev !== next) syncEngine();
  }

  const editLocked = computed(() => loading.value || job.value !== null || ab.value === 'b');

  /** Applies one mutator as one history entry (a drag folds its entries between begin and end). */
  function edit<K extends MixingMutatorName>(name: K, ...args: MixingMutatorArgs<K>): void {
    if (editLocked.value) return;
    const mutate = MIXING_MUTATORS[name] as unknown as (
      s: MixingState,
      ...a: MixingMutatorArgs<K>
    ) => MixingState;
    let next: MixingState;
    try {
      next = mutate(state.value, ...args);
    } catch (cause) {
      console.warn(`mixing: ${String(name)} rejected`, cause);
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

  // Held channel delays reach the engine once the transport stops.
  watch(sonare.playing, (playing) => {
    if (!playing) syncEngine();
  });

  const pendingDelays = computed(() => pendingDelayIds(view.value, engineApplied.value));

  // -------------------------------------------------------------------------
  // Worker jobs, one at a time

  let queue: Promise<unknown> = Promise.resolve();

  function runJob<T>(kind: MixingJobKind, start: (progress: MixProgress) => MixJob<T>): Promise<T> {
    const run = async () => {
      const handle = start((progress, stage) => {
        if (job.value) job.value = { ...job.value, progress, stage };
      });
      job.value = { kind, progress: 0, stage: 'loading', cancel: handle.cancel };
      try {
        return await handle.result;
      } finally {
        job.value = null;
      }
    };
    const result = queue.then(run, run);
    queue = result.catch(() => undefined);
    return result;
  }

  function cancelJob(): void {
    job.value?.cancel();
  }

  // -------------------------------------------------------------------------
  // Audio

  const audioIds = shallowRef<ReadonlySet<number>>(new Set());
  const missingAudio = computed(() =>
    state.value.tracks.filter((track) => !audioIds.value.has(track.id)),
  );
  const hasAudio = computed(() => engineApplied.value !== null && audioIds.value.size > 0);

  function putAudio(trackId: number, decoded: Decoded): void {
    registry.set(trackId, decoded.audio);
    audioIds.value = new Set(registry.keys());
    trackInfo.value = new Map(trackInfo.value).set(trackId, decoded.info);
  }

  async function ensureEngine(): Promise<boolean> {
    if (target) return true;
    if (!(await sonare.start())) {
      error.value = 'engine';
      return false;
    }
    const live = sonare.engine.value;
    if (!live) return false;
    live.setTempo(MIX_TEMPO_BPM);
    target = createFacadeTarget(live);
    wasm.value ??= await import('@/wasm/index.js');
    return true;
  }

  function notify(key: MixingNoticeKey, values: Record<string, string | number> = {}): void {
    notices.value = [...notices.value, { key, values }];
  }

  function dismissNotices(): void {
    notices.value = [];
  }

  function budgetNotice(verdict: Extract<AudioBudgetVerdict, { ok: false }>, file: string): void {
    notify(verdict.reason, {
      file,
      min: (verdict.remainingSec / 60).toFixed(1),
      max: MAX_DURATION_SECONDS / 60,
    });
  }

  async function decode(file: File): Promise<Decoded | null> {
    const context = sonare.context.value;
    if (!context) return null;
    try {
      const buffer = await decodeAudioBuffer(file, context, {
        maxDurationSeconds: MAX_DURATION_SECONDS,
      });
      const left = buffer.getChannelData(0).slice();
      const right = buffer.numberOfChannels > 1 ? buffer.getChannelData(1).slice() : left.slice();
      return decodedFrom(left, right, {
        fileName: file.name,
        sampleRate: buffer.sampleRate,
        channels: buffer.numberOfChannels,
        durationSec: buffer.duration,
      });
    } catch (cause) {
      if (cause instanceof AudioInputBudgetError && cause.code === 'duration') {
        notify('trackTooLong', { file: file.name, max: MAX_DURATION_SECONDS / 60 });
      } else {
        console.warn('mixing: decode failed', cause);
        notify('decodeFailed', { file: file.name });
      }
      return null;
    }
  }

  /** Adds a decoded source as a new track; false when the budget refuses it. */
  function addDecoded(name: string, decoded: Decoded): boolean {
    const verdict = checkAudioBudget(
      state.value.tracks.map((track) => track.sourceDurationSec),
      decoded.info.durationSec,
    );
    if (!verdict.ok) {
      budgetNotice(verdict, decoded.info.fileName);
      return false;
    }
    const next = addTrack(state.value, name, decoded.info.durationSec);
    const id = next.tracks[next.tracks.length - 1].id;
    putAudio(id, decoded);
    // Not a user edit: written while the load holds the edit lock.
    history.commit(next);
    selectedId.value ??= id;
    return true;
  }

  /** A restored track without audio that `fileName` should fill: same name first, else the next in order. */
  function missingFor(fileName: string): number | null {
    const missing = missingAudio.value;
    const byName = missing.find((track) => track.name === fileBase(fileName));
    return (byName ?? missing[0])?.id ?? null;
  }

  async function withLoad(task: () => Promise<boolean>): Promise<void> {
    if (loading.value || job.value) return;
    error.value = null;
    loading.value = true;
    try {
      if (!(await ensureEngine())) return;
      const attached = await task();
      // A restored project reaches the engine once audio arrives; attaching rebuilds it.
      if (!engineState || attached) rebuildEngine();
    } finally {
      loading.value = false;
    }
  }

  async function addFiles(files: readonly File[]): Promise<void> {
    if (files.length === 0 || ab.value === 'b') return;
    await withLoad(async () => {
      let attached = false;
      for (const file of files) {
        const decoded = await decode(file);
        if (!decoded) continue;
        const restoredId = missingFor(file.name);
        if (restoredId !== null) {
          putAudio(restoredId, decoded);
          attached = true;
        } else {
          addDecoded(fileBase(file.name), decoded);
        }
      }
      return attached;
    });
  }

  async function loadDemo(): Promise<void> {
    if (ab.value === 'b') return;
    await withLoad(async () => {
      let file: File;
      try {
        const response = await fetch('/demo.mp3');
        const blob = await response.blob();
        file = new File([blob], 'demo.mp3', { type: blob.type || 'audio/mpeg' });
      } catch {
        error.value = 'loadFailed';
        return false;
      }
      const decoded = await decode(file);
      if (!decoded) return false;
      const [left, right] = decoded.audio.channels;
      const { sampleRate } = decoded.audio;
      const l = splitBands(left, sampleRate, DEMO_CROSSOVER_HZ);
      const r = splitBands(right, sampleRate, DEMO_CROSSOVER_HZ);
      const names = [options.copy.value.import.demoLow, options.copy.value.import.demoHigh];
      const bands = [
        decodedFrom(l.low, r.low, { ...decoded.info, fileName: names[0] }),
        decodedFrom(l.high, r.high, { ...decoded.info, fileName: names[1] }),
      ];
      const missing = missingAudio.value.slice(0, bands.length);
      if (missing.length > 0) {
        missing.forEach((track, i) => {
          putAudio(track.id, bands[i]);
        });
        return true;
      }
      if (state.value.tracks.length > 0) return false;
      bands.forEach((band, i) => {
        addDecoded(names[i], band);
      });
      return false;
    });
  }

  function removeTrack(trackId: number): void {
    // The audio stays in the registry so an undo brings the track back with it.
    edit('removeTrack', trackId);
  }

  // -------------------------------------------------------------------------
  // Transport

  const duration = computed(() => arrangementEndSec(view.value));

  function play(): void {
    if (!hasAudio.value) return;
    // Integrated loudness and the true-peak maximum cover this pass only.
    sonare.engine.value?.resetMasterLoudnessMeter();
    metering.reset();
    sonare.play();
  }

  function stop(): void {
    sonare.stop();
    // Held channel delays go out now; the watcher below covers any other stop.
    syncEngine();
  }

  function togglePlay(): void {
    if (sonare.playing.value) stop();
    else play();
  }

  function seek(seconds: number): void {
    sonare.seek(Math.max(0, Math.min(Math.max(duration.value, state.value.loop.endSec), seconds)));
  }

  function setLoop(loop: Partial<LoopState>): void {
    edit('setLoop', loop);
  }

  function toggleLoop(): void {
    if (!hasAudio.value) return;
    const { loop } = state.value;
    const valid = loop.endSec > loop.startSec;
    setLoop({
      enabled: !loop.enabled,
      startSec: valid ? loop.startSec : 0,
      endSec: valid ? loop.endSec : duration.value,
    });
  }

  watch(sonare.position, (seconds) => {
    if (
      sonare.playing.value &&
      !view.value.loop.enabled &&
      duration.value > 0 &&
      seconds >= duration.value
    ) {
      stop();
      seek(0);
    }
  });

  function toggleSelected(field: 'muted' | 'soloed'): void {
    const track = selectedTrack.value;
    if (!track) return;
    if (field === 'muted') edit('setMute', track.id, !track.muted);
    else edit('setSolo', track.id, !track.soloed);
  }

  // -------------------------------------------------------------------------
  // Export and project files

  function sampleRate(): number {
    return sonare.context.value?.sampleRate ?? 48000;
  }

  async function exportMix(format: WavFormat, dither: WavDither): Promise<void> {
    if (!hasAudio.value || editLocked.value) return;
    error.value = null;
    const snapshot = state.value;
    let result: MixBounceResult;
    try {
      result = await runJob('export', (progress) =>
        worker.bounce(snapshot, registry, sampleRate(), wavBounceOptions(format, dither), progress),
      );
    } catch (cause) {
      if (!(cause instanceof WorkerJobCancelled)) {
        console.warn('mixing: export failed', cause);
        error.value = 'exportFailed';
      }
      return;
    }
    if (lastRender.value) URL.revokeObjectURL(lastRender.value.url);
    const url = URL.createObjectURL(
      wavBlob([result.left, result.right], result.sampleRate, format),
    );
    const fileName = 'libsonare-mix.wav';
    lastRender.value = { result, format, dither, url, fileName, at: Date.now() };
    triggerDownload(url, fileName);
  }

  function downloadRender(): void {
    const render = lastRender.value;
    if (render) triggerDownload(render.url, render.fileName);
  }

  function exportProject(): void {
    downloadBlob(jsonBlob(state.value), MIX_PROJECT_FILE);
  }

  async function importProject(file: File): Promise<void> {
    if (editLocked.value) return;
    error.value = null;
    const loaded = parseMixingProject(await file.text(), state.value);
    if (!loaded) {
      error.value = 'projectInvalid';
      return;
    }
    if (loaded.fromVersion === 1) notify('projectV1');
    if (loaded.unmatched.length > 0)
      notify('projectUnmatched', { names: loaded.unmatched.join(', ') });
    history.commit(loaded.state);
    selectedId.value = loaded.state.tracks[0]?.id ?? null;
  }

  // -------------------------------------------------------------------------
  // Mix assistant

  async function suggest(): Promise<void> {
    if (!hasAudio.value || editLocked.value) return;
    error.value = null;
    const snapshot = state.value;
    try {
      const result = await runJob('suggest', (progress) =>
        worker.suggest(snapshot, registry, sampleRate(), progress),
      );
      suggestion.value = result;
      suggestionFor = trackIdsKey(snapshot);
      ab.value = 'a';
    } catch (cause) {
      if (!(cause instanceof WorkerJobCancelled)) {
        console.warn('mixing: suggestion failed', cause);
        error.value = 'suggestFailed';
      }
      return;
    }
    await measureMatch();
  }

  /** Measures A against B over the analysed window and stores the level-matching gains. */
  async function measureMatch(): Promise<void> {
    const current = suggestion.value;
    if (!current) return;
    const measuredA = state.value;
    const measuredB = applyMixPatch(measuredA, current.suggestion.patch);
    match.value = null;
    try {
      const { aLufs, bLufs } = await runJob('match', (progress) =>
        worker.measureAB(
          measuredA,
          measuredB,
          registry,
          sampleRate(),
          current.analyzedSec,
          progress,
        ),
      );
      if (suggestion.value === current) {
        match.value = { ...abMatchGains(aLufs, bLufs), measuredA };
      }
    } catch (cause) {
      // Without a measurement the sides simply play unmatched.
      if (!(cause instanceof WorkerJobCancelled)) console.warn('mixing: A/B match failed', cause);
    }
  }

  /** The monitor gain of the audible side; 0 dB without a suggestion or a measurement. */
  const monitorGainDb = computed(() => {
    if (!suggestion.value || !match.value) return 0;
    return ab.value === 'b' ? match.value.bDb : match.value.aDb;
  });
  watch(monitorGainDb, (db) => sonare.setMonitorGainDb(db), { immediate: true });
  watch(suggestion, (value) => {
    if (!value) match.value = null;
  });

  function setAb(side: AbSide): void {
    if (side === ab.value || job.value || (side === 'b' && !suggestion.value)) return;
    history.end();
    ab.value = side;
    syncEngine();
    if (side === 'b' && match.value?.measuredA !== state.value) void measureMatch();
  }

  /** Takes the whole suggestion as one history entry. */
  function adoptSuggestion(): void {
    const current = suggestion.value;
    if (!current || job.value || loading.value) return;
    const next = applyMixPatch(state.value, current.suggestion.patch);
    suggestion.value = null;
    ab.value = 'a';
    history.commit(next);
  }

  function discardSuggestion(): void {
    suggestion.value = null;
    ab.value = 'a';
    syncEngine();
  }

  // -------------------------------------------------------------------------
  // EQ curves

  const eqResponder = shallowRef<EqResponder | null>(null);
  watch(
    [wasm, () => sonare.context.value?.sampleRate],
    ([module, rate]) => {
      eqResponder.value?.dispose();
      eqResponder.value =
        module && typeof module.StreamingEqualizer === 'function'
          ? createEqResponder(module, rate ?? 48000)
          : null;
    },
    { immediate: true },
  );

  function eqCurve(bands: readonly StripEqBand[]): EqCurvePoint[] | null {
    return eqResponder.value?.curve(bands) ?? null;
  }

  // -------------------------------------------------------------------------
  // Lifecycle

  function restore(): void {
    const saved = session.restore();
    if (!saved) return;
    history.reset(saved);
    selectedId.value = saved.tracks[0]?.id ?? null;
    restored.value = saved.tracks.length > 0;
  }

  function dispose(): void {
    if (flashTimer) clearTimeout(flashTimer);
    session.flush();
    session.dispose();
    metering.dispose();
    worker.dispose();
    eqResponder.value?.dispose();
    eqResponder.value = null;
    if (lastRender.value) URL.revokeObjectURL(lastRender.value.url);
    void sonare.dispose();
  }

  return {
    sonare,
    state,
    view,
    canUndo: history.canUndo,
    canRedo: history.canRedo,
    undo,
    redo,
    edit,
    begin: history.begin,
    end: history.end,
    editLocked,
    loading,
    error,
    notices,
    dismissNotices,
    job,
    cancelJob,
    trackInfo,
    missingAudio,
    hasAudio,
    restored,
    selectedId,
    selectedTrack,
    rebuilt,
    pendingDelays,
    metering,
    duration,
    lastRender,
    suggestion,
    match,
    ab,
    addFiles,
    loadDemo,
    removeTrack,
    play,
    stop,
    togglePlay,
    seek,
    setLoop,
    toggleLoop,
    toggleSelected,
    exportMix,
    downloadRender,
    exportProject,
    importProject,
    suggest,
    setAb,
    adoptSuggestion,
    discardSuggestion,
    eqCurve,
    restore,
    dispose,
  };
}

export type MixingController = ReturnType<typeof useMixingStudio>;
