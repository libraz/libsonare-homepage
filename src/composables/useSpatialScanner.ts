import { onBeforeUnmount, ref, shallowRef } from 'vue';
import { PRESET_GEOMETRY, type PresetId } from '@/components/spatial/spatialCopy';
import { decodeAudioBuffer } from '@/utils/audio';
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
  let lastBuffer: AudioBuffer | null = null;
  let lastIsIR = false;
  let disposed = false;

  function ensureWorker(): Worker {
    if (disposed) throw new Error('Spatial scanner disposed');
    if (!worker) {
      worker = new Worker(new URL('../workers/spatial.worker.ts', import.meta.url), {
        type: 'module',
      });
      worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
        if (disposed) return;
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
    const id = ++requestId;
    lastFile = file;
    lastBuffer = null;
    lastIsIR = isIR;
    activePreset.value = null;
    fileName.value = file.name;
    error.value = null;
    status.value = 'decoding';
    progress.value = 0.05;

    try {
      const decoded = await decodeAudioBuffer(file, ensureAudioContext());
      if (disposed || id !== requestId) return;
      scanDecoded(decoded, file.name, isIR, id);
    } catch {
      if (disposed || id !== requestId) return;
      error.value = 'decode';
      status.value = 'error';
    }
  }

  function scanDecoded(buffer: AudioBuffer, name: string, isIR: boolean, id = ++requestId) {
    if (disposed || id !== requestId) return;
    lastFile = null;
    lastBuffer = buffer;
    lastIsIR = isIR;
    activePreset.value = null;
    fileName.value = name;
    error.value = null;
    // Room-acoustic estimation cost grows superlinearly with length; a long song
    // would park the progress bar at 50% for 10-25s ("frozen"). A window of a few
    // tens of seconds is more than enough for RT60/decay, so cap it.
    const maxSamples = Math.min(
      buffer.length,
      Math.floor(MAX_ANALYSIS_SECONDS * buffer.sampleRate),
    );
    const mono = new Float32Array(maxSamples);
    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
      const samples = buffer.getChannelData(channel);
      const gain = 1 / buffer.numberOfChannels;
      for (let i = 0; i < maxSamples; i++) mono[i] += samples[i] * gain;
    }

    status.value = 'scanning';
    progress.value = 0.2;
    ensureWorker().postMessage(
      { type: 'scan', id, samples: mono, sampleRate: buffer.sampleRate, isIR },
      [mono.buffer],
    );
  }

  function scanPreset(preset: PresetId) {
    lastFile = null;
    lastBuffer = null;
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
    } else if (lastBuffer) {
      scanDecoded(lastBuffer, fileName.value, isIR);
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
    lastBuffer = null;
    status.value = 'idle';
    progress.value = 0;
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    requestId++;
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
    scanDecoded,
    scanPreset,
    rescan,
    clear,
    dispose,
    lastIsIR: () => lastIsIR,
  };
}
