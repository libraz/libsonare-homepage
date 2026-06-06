import { computed, onBeforeUnmount, ref } from 'vue';
import type { RoomGeometry } from '@/workers/spatial.worker';

type MorphGeometry = Partial<RoomGeometry> & {
  lengthM: number;
  widthM: number;
  heightM: number;
  absorption?: number;
};

type MorphWorkerMessage =
  | { type: 'progress'; id: number; stage: string; value: number }
  | { type: 'morphDone'; id: number; left: Float32Array; right: Float32Array; sampleRate: number }
  | { type: 'error'; id: number; message: string };

/**
 * Spatial-demo audio engine.
 *
 * Plays one content clip and exposes a smoothed `level` (0..1) that drives the 3D
 * scene, so playback is reflected visually. Two content sources are supported:
 *   - an uploaded recording (played as-is — it already carries its own room), and
 *   - a preset room's synthesized impulse response, auditioned directly. The RIR *is*
 *     the room's acoustic signature (a clap-like burst + decay), so it is the honest
 *     "sound of the room" — no bundled music asset, which would be an arbitrary,
 *     out-of-place source for a room-acoustics demo.
 *
 * AudioBufferSourceNode is one-shot, so pause/resume restart from an offset
 * (mirrors useAudioPlayer's approach).
 */
export function useSpatialAudio() {
  const isPlaying = ref(false);
  const isPaused = ref(false);
  const currentTime = ref(0);
  const duration = ref(0);
  const level = ref(0);
  const hasContent = ref(false);
  const isMorphing = ref(false);
  const morphProgress = ref(0);
  const contentLabel = ref('');

  let ctx: AudioContext | null = null;
  let analyser: AnalyserNode | null = null;
  let source: AudioBufferSourceNode | null = null;
  let contentBuffer: AudioBuffer | null = null;
  let dryBuffer: AudioBuffer | null = null;
  let timeData: Float32Array | null = null;
  let morphWorker: Worker | null = null;
  let morphRequestId = 0;
  let startTime = 0;
  let pauseOffset = 0;
  let raf: number | null = null;

  function getCtx(): AudioContext {
    if (!ctx) {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctx = new Ctor();
      analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.6;
      analyser.connect(ctx.destination);
      timeData = new Float32Array(analyser.fftSize);
    }
    return ctx;
  }

  /** Play an uploaded recording directly (it already carries its own room). */
  async function setUpload(file: File): Promise<void> {
    const ctxLocal = getCtx();
    const buf = await ctxLocal.decodeAudioData(await file.arrayBuffer());
    stop();
    contentBuffer = buf;
    dryBuffer = buf;
    duration.value = buf.duration;
    hasContent.value = true;
    contentLabel.value = file.name;
  }

  /** Audition a preset room by playing its synthesized impulse response directly.
   *  The RIR is peak-normalized into a fresh buffer so the direct impulse can't clip. */
  function setRoomImpulse(rir: Float32Array, sampleRate: number): void {
    const ctxLocal = getCtx();
    let peak = 0;
    for (let i = 0; i < rir.length; i++) {
      const a = Math.abs(rir[i]);
      if (a > peak) peak = a;
    }
    const gain = peak > 0 ? 0.9 / peak : 1;
    const buf = ctxLocal.createBuffer(1, rir.length, sampleRate);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < rir.length; i++) ch[i] = rir[i] * gain;
    stop();
    contentBuffer = buf;
    dryBuffer = null;
    duration.value = buf.duration;
    hasContent.value = true;
    contentLabel.value = '';
  }

  async function renderRoomMorph(
    geometry: MorphGeometry,
    options: { demoUrl?: string; label: string },
  ) {
    const ctxLocal = getCtx();
    const input = dryBuffer ?? (await loadDemoBuffer(options.demoUrl ?? '/demo.mp3'));
    dryBuffer = dryBuffer ?? input;

    isMorphing.value = true;
    morphProgress.value = 0.05;
    try {
      const result = await morphInWorker(input, geometry);
      const length = Math.max(result.left.length, result.right.length);
      const buf = ctxLocal.createBuffer(2, length, result.sampleRate);
      copyIntoChannel(buf.getChannelData(0), result.left);
      copyIntoChannel(buf.getChannelData(1), result.right);
      stop();
      contentBuffer = normalizeBuffer(buf);
      duration.value = contentBuffer.duration;
      hasContent.value = true;
      contentLabel.value = options.label;
    } finally {
      isMorphing.value = false;
      morphProgress.value = 0;
    }
  }

  function clearSource(): void {
    stop();
    contentBuffer = null;
    dryBuffer = null;
    duration.value = 0;
    currentTime.value = 0;
    level.value = 0;
    hasContent.value = false;
    contentLabel.value = '';
  }

  function disconnectSource(): void {
    if (source) {
      try {
        source.onended = null;
        source.stop();
      } catch {
        /* already stopped */
      }
      source.disconnect();
      source = null;
    }
  }

  async function play(offset = 0): Promise<void> {
    const ctxLocal = getCtx();
    if (!contentBuffer || !analyser) return;
    if (ctxLocal.state === 'suspended') await ctxLocal.resume();
    disconnectSource();

    const src = ctxLocal.createBufferSource();
    src.buffer = contentBuffer;
    src.connect(analyser);

    src.onended = () => {
      if (isPlaying.value) stop();
    };

    source = src;
    startTime = ctxLocal.currentTime - offset;
    src.start(0, offset);
    isPlaying.value = true;
    isPaused.value = false;
    tick();
  }

  function pause(): void {
    if (!isPlaying.value || !ctx) return;
    pauseOffset = ctx.currentTime - startTime;
    disconnectSource();
    isPlaying.value = false;
    isPaused.value = true;
    if (raf) cancelAnimationFrame(raf);
    raf = null;
  }

  function stop(): void {
    disconnectSource();
    isPlaying.value = false;
    isPaused.value = false;
    pauseOffset = 0;
    currentTime.value = 0;
    level.value = 0;
    if (raf) cancelAnimationFrame(raf);
    raf = null;
  }

  function toggle(): void {
    if (isPlaying.value) pause();
    else void play(isPaused.value ? pauseOffset : 0);
  }

  function seek(fraction: number): void {
    const t = Math.max(0, Math.min(1, fraction)) * duration.value;
    const wasPlaying = isPlaying.value;
    disconnectSource();
    if (raf) cancelAnimationFrame(raf);
    raf = null;
    if (wasPlaying) {
      void play(t);
    } else {
      pauseOffset = t;
      currentTime.value = t;
      isPaused.value = true;
    }
  }

  function tick(): void {
    if (!isPlaying.value || !ctx || !analyser || !timeData) return;
    const t = ctx.currentTime - startTime;
    currentTime.value = Math.min(t, duration.value);
    if (t >= duration.value) {
      stop();
      return;
    }
    analyser.getFloatTimeDomainData(timeData);
    let sum = 0;
    for (let i = 0; i < timeData.length; i++) sum += timeData[i] * timeData[i];
    const rms = Math.sqrt(sum / timeData.length);
    // Map RMS to a lively 0..1 with a little smoothing.
    const target = Math.min(1, rms * 3.2);
    level.value = level.value * 0.55 + target * 0.45;
    raf = requestAnimationFrame(tick);
  }

  const progress = computed(() => (duration.value > 0 ? currentTime.value / duration.value : 0));

  onBeforeUnmount(() => {
    stop();
    morphWorker?.terminate();
    morphWorker = null;
    void ctx?.close();
    ctx = null;
  });

  async function loadDemoBuffer(url: string): Promise<AudioBuffer> {
    const ctxLocal = getCtx();
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    return ctxLocal.decodeAudioData(arrayBuffer);
  }

  function morphInWorker(
    buffer: AudioBuffer,
    geometry: MorphGeometry,
  ): Promise<{ left: Float32Array; right: Float32Array; sampleRate: number }> {
    const id = ++morphRequestId;
    if (!morphWorker) {
      morphWorker = new Worker(new URL('../workers/spatial.worker.ts', import.meta.url), {
        type: 'module',
      });
    }

    const left = new Float32Array(buffer.getChannelData(0));
    const right =
      buffer.numberOfChannels > 1
        ? new Float32Array(buffer.getChannelData(1))
        : new Float32Array(buffer.getChannelData(0));

    return new Promise((resolve, reject) => {
      const onMessage = (event: MessageEvent<MorphWorkerMessage>) => {
        const message = event.data;
        if (message.id !== id) return;

        if (message.type === 'progress') {
          morphProgress.value = message.value;
          return;
        }

        morphWorker?.removeEventListener('message', onMessage);
        morphWorker?.removeEventListener('error', onError);

        if (message.type === 'morphDone') {
          resolve({ left: message.left, right: message.right, sampleRate: message.sampleRate });
        } else {
          reject(new Error(message.message));
        }
      };

      const onError = (event: ErrorEvent) => {
        morphWorker?.removeEventListener('message', onMessage);
        morphWorker?.removeEventListener('error', onError);
        reject(event.error || new Error(event.message));
      };

      morphWorker!.addEventListener('message', onMessage);
      morphWorker!.addEventListener('error', onError);
      morphWorker!.postMessage(
        {
          type: 'morph',
          id,
          left,
          right,
          sampleRate: buffer.sampleRate,
          geometry,
        },
        [left.buffer, right.buffer],
      );
    });
  }

  return {
    isPlaying,
    isPaused,
    currentTime,
    duration,
    progress,
    level,
    hasContent,
    isMorphing,
    morphProgress,
    contentLabel,
    setUpload,
    setRoomImpulse,
    renderRoomMorph,
    clearSource,
    play,
    pause,
    toggle,
    seek,
    stop,
  };
}

function copyIntoChannel(target: Float32Array, source: Float32Array) {
  target.set(source.subarray(0, target.length));
}

function normalizeBuffer(buffer: AudioBuffer): AudioBuffer {
  let peak = 0;
  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < data.length; i++) peak = Math.max(peak, Math.abs(data[i]));
  }
  if (peak <= 0.98 || peak === 0) return buffer;
  const gain = 0.98 / peak;
  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < data.length; i++) data[i] *= gain;
  }
  return buffer;
}
