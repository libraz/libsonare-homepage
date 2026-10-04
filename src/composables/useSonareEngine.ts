/**
 * Boot, transport and teardown for libsonare's realtime engine facade
 * (`SonareEngine`) on an AudioWorklet, shared by the engine-driven demos.
 *
 * The site is SAB-free, so the facade runs in postMessage mode: meters and
 * per-block telemetry arrive as messages on the main thread. The facade keeps
 * an offline mirror `RealtimeEngine` from the already-initialised `index.js`
 * as the state of record, and the worklet loads its own WASM instance from a
 * blob: module that imports the untransformed bridge in `src/public/`.
 *
 * Lifecycle: `start()` is idempotent and every await re-checks `disposed`, so
 * an unmount mid-boot unwinds everything created so far. `dispose()` is
 * terminal; a disposed instance never starts again.
 */
import { getCurrentScope, onScopeDispose, type Ref, ref, type ShallowRef, shallowRef } from 'vue';
import sonareJsUrl from '@/wasm/sonare.js?url';
import sonareWasmUrl from '@/wasm/sonare.wasm?url';

type WorkletModule = typeof import('@/wasm/worklet.js');
/** The realtime engine facade instance. */
export type SonareEngine = Awaited<ReturnType<WorkletModule['SonareEngine']['create']>>;
type FacadeOptions = NonNullable<Parameters<WorkletModule['SonareEngine']['create']>[1]>;
/** The offline mirror engine the facade records state into. */
export type SonareMirrorEngine = NonNullable<FacadeOptions['offlineEngine']>;
/** One meter snapshot (master, lane or bus target). */
export type SonareMeterSnapshot = Parameters<Parameters<SonareEngine['onMeter']>[0]>[0];

/**
 * Folds a snapshot into a held true peak, as peak meters hold theirs. The
 * streaming true peak reads up to ~0.1 dB low at block edges, and a true peak
 * is never below a sample peak, so the sample peaks bound it from below.
 */
export function heldTruePeakDb(held: number, meter: SonareMeterSnapshot): number {
  return [meter.truePeakDbL, meter.truePeakDbR, meter.peakDbL, meter.peakDbR].reduce(
    (max, value) => (Number.isFinite(value) && value > max ? value : max),
    held,
  );
}

/** Default engine meter cadence in frames (~47 Hz at 48 kHz). */
export const DEFAULT_METER_INTERVAL_FRAMES = 1024;
/** Offline mirror block size; matches the AudioWorklet render quantum. */
const MIRROR_BLOCK_SIZE = 128;
/** Time constant of the monitor gain ramp; short enough to follow a switch, long enough not to click. */
const MONITOR_GAIN_TIME_CONSTANT_SEC = 0.01;
/** `SonareEngineTelemetryType.ProcessBlock`. */
const TELEMETRY_PROCESS_BLOCK = 0;

/**
 * Untransformed copy of the worklet bridge, kept in `src/public/` by
 * `yarn copy:wasm`. The bundled `@/wasm/worklet.js` cannot be imported inside
 * the AudioWorklet in dev: Vite injects an `/@vite/client` import into it,
 * which references `window` and fails silently in AudioWorkletGlobalScope
 * (Chrome resolves `addModule` even when module evaluation throws). Public
 * assets are served raw in both dev and build, so this path always works.
 */
const WORKLET_BRIDGE_PATH = '/sonare-worklet.js';

/**
 * The worklet module: registers the realtime-engine processor with the embind
 * module factory. Loaded from a blob: URL, so static import specifiers must be
 * absolute — a root-relative path cannot resolve against the opaque blob base.
 */
function buildEngineWorkletSource(sonareUrl: string, workletUrl: string): string {
  return `
import createModule from '${sonareUrl}';
import { registerSonareRealtimeEngineWorkletProcessor } from '${workletUrl}';
globalThis.SonareEmbindModuleFactory = createModule;
registerSonareRealtimeEngineWorkletProcessor();
`;
}

export interface UseSonareEngineOptions {
  /** Meter telemetry cadence in frames. Defaults to {@link DEFAULT_METER_INTERVAL_FRAMES}. */
  meterIntervalFrames?: number;
  /**
   * Test seam only: builds the worklet node in place of `AudioWorkletNode`
   * (forwarded to `SonareEngine.create`). Pages never pass it.
   */
  nodeFactory?: FacadeOptions['nodeFactory'];
}

export interface UseSonareEngine {
  /** Boots the engine; resolves `true` once it is connected, `false` on failure or dispose. */
  start(): Promise<boolean>;
  /** The live facade; callers configure lanes, clips and instruments on it. */
  engine: ShallowRef<SonareEngine | null>;
  /** The AudioContext the engine renders into. */
  context: ShallowRef<AudioContext | null>;
  /** The facade's offline mirror (state of record). Owned and destroyed by the facade. */
  offlineEngine: ShallowRef<SonareMirrorEngine | null>;
  /** The engine's output node (before the monitor gain), for analysers to tap. */
  outputNode: ShallowRef<AudioNode | null>;
  ready: Ref<boolean>;
  starting: Ref<boolean>;
  /** Message of the last start failure, or `null`. */
  error: Ref<string | null>;
  /** Audible transport position in seconds (latency-compensated block telemetry), updated once per frame. */
  position: Ref<number>;
  playing: Ref<boolean>;
  /** Starts the transport; call from a user gesture so a suspended context resumes. */
  play(): void;
  stop(): void;
  /** Moves the transport to `seconds` on the timeline. */
  seek(seconds: number): void;
  /** Subscribes to meter snapshots; valid before `start()`. Returns the unsubscribe. */
  onMeter(callback: (meter: SonareMeterSnapshot) => void): () => void;
  /** Sets the listening-only gain after the engine, in dB; it is not in meters, scopes or exports. */
  setMonitorGainDb(db: number): void;
  /** Stops the transport and releases the engine, mirror, context and blob URL. */
  dispose(): Promise<void>;
}

/**
 * Shared boot of the realtime engine facade for /mastering, /mixing and
 * /studio. Disposes itself with the calling effect scope (component unmount).
 */
export function useSonareEngine(options: UseSonareEngineOptions = {}): UseSonareEngine {
  const meterIntervalFrames = options.meterIntervalFrames ?? DEFAULT_METER_INTERVAL_FRAMES;
  const engine = shallowRef<SonareEngine | null>(null);
  const context = shallowRef<AudioContext | null>(null);
  const offlineEngine = shallowRef<SonareMirrorEngine | null>(null);
  const outputNode = shallowRef<AudioNode | null>(null);
  const ready = ref(false);
  const starting = ref(false);
  const error = ref<string | null>(null);
  const position = ref(0);
  const playing = ref(false);

  let monitorGain: GainNode | null = null;
  let monitorGainDb = 0;
  const meterListeners = new Set<(meter: SonareMeterSnapshot) => void>();
  let unsubscribers: Array<() => void> = [];
  let moduleUrl: string | null = null;
  let pendingStart: Promise<boolean> | null = null;
  /** Set by dispose(); cancels an in-flight start() at its next await point. */
  let disposed = false;
  let latestSample = 0;
  let rafId = 0;

  function flushPosition(): void {
    rafId = 0;
    const ctx = context.value;
    if (ctx) position.value = latestSample / ctx.sampleRate;
  }

  async function closeContext(): Promise<void> {
    const ctx = context.value;
    context.value = null;
    if (!ctx) return;
    try {
      await ctx.close();
    } catch {
      /* already closed */
    }
  }

  async function boot(): Promise<boolean> {
    starting.value = true;
    error.value = null;
    try {
      // index.js carries the mirror engine and the ABI numbers; passing them
      // lets the worklet bridge skip its own (uninitialised) lookup.
      const mod = await import('@/wasm/index.js');
      await mod.init();
      if (disposed) return false;
      const wmod = await import('@/wasm/worklet.js');
      if (disposed) return false;

      const ctx = new AudioContext({ latencyHint: 'interactive' });
      context.value = ctx;
      if (!moduleUrl) {
        const absSonare = new URL(sonareJsUrl, location.href).href;
        const absWorklet = new URL(WORKLET_BRIDGE_PATH, location.href).href;
        moduleUrl = URL.createObjectURL(
          new Blob([buildEngineWorkletSource(absSonare, absWorklet)], {
            type: 'text/javascript',
          }),
        );
      }
      const wasmBinary = await (await fetch(sonareWasmUrl)).arrayBuffer();
      if (disposed) return false;

      // Ownership transfers to SonareEngine only after create() succeeds. If
      // worklet construction rejects, explicitly destroy this native mirror.
      const mirror = new mod.RealtimeEngine(
        ctx.sampleRate,
        MIRROR_BLOCK_SIZE,
      ) as unknown as SonareMirrorEngine;
      let created: SonareEngine;
      try {
        created = await wmod.SonareEngine.create(ctx, {
          moduleUrl,
          wasmBinary,
          mode: 'auto', // the site is SAB-free, so this falls back to postMessage
          channelCount: 2,
          meterIntervalFrames,
          engineAbiVersion: mod.engineAbiVersion(),
          expectedEngineAbiVersion: mod.EXPECTED_ENGINE_ABI_VERSION,
          offlineEngine: mirror,
          ...(options.nodeFactory ? { nodeFactory: options.nodeFactory } : {}),
        });
      } catch (cause) {
        mirror.destroy();
        throw cause;
      }
      if (disposed) {
        created.destroy();
        return false;
      }
      monitorGain = ctx.createGain();
      monitorGain.gain.value = 10 ** (monitorGainDb / 20);
      created.node.connect(monitorGain);
      monitorGain.connect(ctx.destination);
      unsubscribers = [
        created.onMeter((meter) => {
          for (const listener of meterListeners) listener(meter);
        }),
        created.onTelemetry((record) => {
          if (record.type !== TELEMETRY_PROCESS_BLOCK) return;
          latestSample = record.audibleTimelineSample;
          if (!rafId) rafId = requestAnimationFrame(flushPosition);
        }),
      ];
      engine.value = created;
      offlineEngine.value = mirror;
      outputNode.value = created.node;

      // Outside a gesture this stays pending until play() resumes it.
      void ctx.resume().catch(() => {
        /* resume re-attempted by play() */
      });
      ready.value = true;
      return true;
    } catch (err) {
      if (disposed) return false;
      console.error('sonare engine start failed:', err);
      error.value = err instanceof Error ? err.message : String(err);
      // The engine never came up — don't leave a dangling AudioContext.
      await closeContext();
      return false;
    } finally {
      starting.value = false;
    }
  }

  function start(): Promise<boolean> {
    if (ready.value) return Promise.resolve(true);
    if (disposed) return Promise.resolve(false);
    pendingStart ??= boot().finally(() => {
      pendingStart = null;
    });
    return pendingStart;
  }

  function play(): void {
    const live = engine.value;
    const ctx = context.value;
    if (!live || !ctx || playing.value) return;
    if (ctx.state !== 'running') void ctx.resume().catch(() => {});
    if (live.transport.play()) playing.value = true;
  }

  function stop(): void {
    playing.value = false;
    engine.value?.transport.stop();
  }

  function seek(seconds: number): void {
    const live = engine.value;
    if (!live) return;
    live.transport.seekSeconds(seconds);
    position.value = Math.max(0, seconds);
  }

  function onMeter(callback: (meter: SonareMeterSnapshot) => void): () => void {
    meterListeners.add(callback);
    return () => {
      meterListeners.delete(callback);
    };
  }

  function setMonitorGainDb(db: number): void {
    monitorGainDb = Number.isFinite(db) ? db : 0;
    const ctx = context.value;
    monitorGain?.gain.setTargetAtTime(
      10 ** (monitorGainDb / 20),
      ctx?.currentTime ?? 0,
      MONITOR_GAIN_TIME_CONSTANT_SEC,
    );
  }

  async function dispose(): Promise<void> {
    disposed = true;
    stop();
    ready.value = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
    for (const unsubscribe of unsubscribers) unsubscribe();
    unsubscribers = [];
    meterListeners.clear();
    // The facade destroys its mirror and disconnects its node.
    engine.value?.destroy();
    engine.value = null;
    offlineEngine.value = null;
    outputNode.value = null;
    monitorGain?.disconnect();
    monitorGain = null;
    if (moduleUrl) {
      URL.revokeObjectURL(moduleUrl);
      moduleUrl = null;
    }
    await closeContext();
    // An in-flight start() unwinds at its next await; wait so nothing outlives dispose.
    await pendingStart;
  }

  if (getCurrentScope()) onScopeDispose(() => void dispose());

  return {
    start,
    engine,
    context,
    offlineEngine,
    outputNode,
    ready,
    starting,
    error,
    position,
    playing,
    play,
    stop,
    seek,
    onMeter,
    setMonitorGainDb,
    dispose,
  };
}
