import { onBeforeUnmount, ref, shallowRef } from 'vue';
import type { RoomGeometry, ScanResult } from '@/demos/spatial/spatial.worker';
import { PRESET_GEOMETRY, type PresetId } from '@/demos/spatial/spatialCopy';
import { decodeAudioBuffer } from '@/utils/audio';

type Status = 'idle' | 'decoding' | 'scanning' | 'ready' | 'error';

type WorkerMessage =
  | { type: 'progress'; id: number; stage: string; value: number }
  | { type: 'done'; id: number; result: ScanResult }
  | { type: 'error'; id: number; message: string };

// Synthesis sample rate for the built-in preset RIRs.
const PRESET_SAMPLE_RATE = 48000;

// Cap uploaded audio analyzed for room acoustics (RT60/decay needs only a short window).
const MAX_ANALYSIS_SECONDS = 30;

// An ordinary stereo average is the right downmix for coherent material. If its
// energy falls below a quarter of the stronger source channel, phase cancellation
// has likely made the average unusably quiet, so keep that channel instead.
const MONO_CANCELLATION_ENERGY_RATIO = 0.25;

function prepareMono(buffer: AudioBuffer, maxSamples: number): Float32Array {
  const channelCount = buffer.numberOfChannels;
  const mono = new Float32Array(maxSamples);
  if (channelCount === 0 || maxSamples === 0) return mono;

  const gain = 1 / channelCount;
  let strongestChannel = 0;
  let strongestEnergy = 0;

  // Accumulate the downmix and each channel's energy in one pass. This keeps the
  // cap allocation bounded to the one buffer transferred to the worker.
  for (let channel = 0; channel < channelCount; channel++) {
    const samples = buffer.getChannelData(channel);
    let channelEnergy = 0;
    for (let i = 0; i < maxSamples; i++) {
      const sample = samples[i];
      mono[i] += sample * gain;
      channelEnergy += sample * sample;
    }
    if (channelEnergy > strongestEnergy) {
      strongestEnergy = channelEnergy;
      strongestChannel = channel;
    }
  }

  // The 1/4 threshold is calibrated for a stereo pair. With four or more
  // independent channels their ordinary average can have this little energy.
  if (channelCount === 2) {
    let monoEnergy = 0;
    for (let i = 0; i < maxSamples; i++) {
      const sample = mono[i];
      monoEnergy += sample * sample;
    }

    if (monoEnergy <= strongestEnergy * MONO_CANCELLATION_ENERGY_RATIO) {
      mono.set(buffer.getChannelData(strongestChannel).subarray(0, maxSamples));
    }
  }

  return mono;
}

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
      worker = new Worker(new URL('./spatial.worker.ts', import.meta.url), {
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
    const mono = prepareMono(buffer, maxSamples);

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
