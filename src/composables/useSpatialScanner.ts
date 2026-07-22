import { onBeforeUnmount, ref, shallowRef } from 'vue';
import { PRESET_GEOMETRY, type PresetId } from '@/components/spatial/spatialCopy';
import { decodeAudioFile, mixToMono } from '@/utils/audio';
import type { RoomGeometry, ScanResult } from '@/workers/spatial.worker';

type Status = 'idle' | 'decoding' | 'scanning' | 'ready' | 'error';

type WorkerMessage =
  | { type: 'progress'; id: number; stage: string; value: number }
  | { type: 'done'; id: number; result: ScanResult }
  | { type: 'error'; id: number; message: string };

// Synthesis sample rate for the built-in preset RIRs.
const PRESET_SAMPLE_RATE = 48000;

// Cap uploaded audio analyzed for room acoustics (RT60/decay needs only a short window).
const MAX_ANALYSIS_SECONDS = 30;

/** Options for {@link useSpatialScanner}. */
export interface SpatialScannerOptions {
  /**
   * Supply the shared playback AudioContext (from `useSpatialAudio`) so uploads are
   * decoded through it instead of opening a second context. When provided, the scanner
   * does not own or close the context. Falls back to a self-owned context otherwise.
   */
  getAudioContext?: () => AudioContext;
}

export function useSpatialScanner(options: SpatialScannerOptions = {}) {
  const status = ref<Status>('idle');
  const progress = ref(0);
  const error = ref<string | null>(null);
  const fileName = ref('');
  const activePreset = ref<PresetId | null>(null);
  const result = shallowRef<ScanResult | null>(null);

  const externalAudioContext = options.getAudioContext ?? null;
  let worker: Worker | null = null;
  let audioContext: AudioContext | null = null;
  let requestId = 0;
  let lastFile: File | null = null;
  let lastIsIR = false;

  function ensureWorker(): Worker {
    if (!worker) {
      worker = new Worker(new URL('../workers/spatial.worker.ts', import.meta.url), {
        type: 'module',
      });
      worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
        const msg = event.data;
        if (msg.id !== requestId) return; // stale response from a superseded scan
        if (msg.type === 'progress') {
          progress.value = msg.value;
        } else if (msg.type === 'done') {
          result.value = msg.result;
          progress.value = 1;
          status.value = 'ready';
        } else if (msg.type === 'error') {
          error.value = msg.message;
          status.value = 'error';
        }
      };
    }
    return worker;
  }

  function ensureAudioContext(): AudioContext {
    if (externalAudioContext) return externalAudioContext();
    if (!audioContext) {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      audioContext = new Ctor();
    }
    return audioContext;
  }

  async function scanFile(file: File, isIR: boolean) {
    lastFile = file;
    lastIsIR = isIR;
    activePreset.value = null;
    fileName.value = file.name;
    error.value = null;
    status.value = 'decoding';
    progress.value = 0.05;

    let mono: Float32Array;
    let sampleRate: number;
    try {
      const decoded = await decodeAudioFile(file, ensureAudioContext());
      mono = mixToMono(decoded.left, decoded.right);
      sampleRate = decoded.sampleRate;
    } catch {
      error.value = 'decode';
      status.value = 'error';
      return;
    }

    // Room-acoustic estimation cost grows superlinearly with length; a long song
    // would park the progress bar at 50% for 10-25s ("frozen"). A window of a few
    // tens of seconds is more than enough for RT60/decay, so cap it.
    const maxSamples = Math.floor(MAX_ANALYSIS_SECONDS * sampleRate);
    if (mono.length > maxSamples) mono = mono.slice(0, maxSamples);

    const id = ++requestId;
    status.value = 'scanning';
    progress.value = 0.2;
    ensureWorker().postMessage({ type: 'scan', id, samples: mono, sampleRate, isIR }, [
      mono.buffer,
    ]);
  }

  function scanPreset(preset: PresetId) {
    lastFile = null;
    activePreset.value = preset;
    fileName.value = '';
    error.value = null;
    status.value = 'scanning';
    progress.value = 0.15;
    const geometry: RoomGeometry = PRESET_GEOMETRY[preset];
    const id = ++requestId;
    ensureWorker().postMessage({
      type: 'preset',
      id,
      sampleRate: PRESET_SAMPLE_RATE,
      geometry,
    });
  }

  function rescan(isIR: boolean) {
    if (activePreset.value) {
      scanPreset(activePreset.value);
    } else if (lastFile) {
      void scanFile(lastFile, isIR);
    }
  }

  function clear() {
    requestId++; // invalidate any in-flight scan
    result.value = null;
    error.value = null;
    fileName.value = '';
    activePreset.value = null;
    lastFile = null;
    status.value = 'idle';
    progress.value = 0;
  }

  function dispose() {
    worker?.terminate();
    worker = null;
    // Only close a self-owned context; a shared context is owned by useSpatialAudio.
    if (!externalAudioContext) void audioContext?.close();
    audioContext = null;
  }

  onBeforeUnmount(dispose);

  return {
    status,
    progress,
    error,
    fileName,
    activePreset,
    result,
    scanFile,
    scanPreset,
    rescan,
    clear,
    dispose,
    lastIsIR: () => lastIsIR,
  };
}
