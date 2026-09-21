import { computed, onUnmounted, ref, shallowRef } from 'vue';

export type AudioProcessCallback = (samples: Float32Array, sampleOffset: number) => void;

export function useAudioPlayer() {
  const audioContext = ref<AudioContext | null>(null);
  const sourceNode = shallowRef<AudioBufferSourceNode | null>(null);
  const audioBuffer = ref<AudioBuffer | null>(null);
  const startTime = ref(0);
  const pauseTime = ref(0);
  const isPlaying = ref(false);
  const isPaused = ref(false);
  const currentTime = ref(0);
  const duration = ref(0);

  let animationFrame: number | null = null;
  let workletNode: AudioWorkletNode | null = null;
  let processCallback: AudioProcessCallback | null = null;
  let workletReady = false;
  let workletReadyPromise: Promise<void> | null = null;
  let playbackGeneration = 0;

  function getAudioContext(): AudioContext {
    if (!audioContext.value) {
      audioContext.value = new AudioContext();
    }
    return audioContext.value;
  }

  async function ensureWorkletReady(): Promise<void> {
    if (workletReady) return;
    if (workletReadyPromise) return workletReadyPromise;

    const ctx = getAudioContext();
    const task = ctx.audioWorklet
      .addModule('/audio-stream-processor.js')
      .then(() => {
        workletReady = true;
      })
      .catch((error) => {
        console.error('Failed to load AudioWorklet:', error);
        throw error;
      });
    workletReadyPromise = task;
    try {
      await task;
    } finally {
      if (workletReadyPromise === task) workletReadyPromise = null;
    }
  }

  async function decodeAudio(file: File): Promise<AudioBuffer> {
    const ctx = getAudioContext();
    const arrayBuffer = await file.arrayBuffer();
    return ctx.decodeAudioData(arrayBuffer);
  }

  async function decodeAudioFromArrayBuffer(arrayBuffer: ArrayBuffer): Promise<AudioBuffer> {
    return getAudioContext().decodeAudioData(arrayBuffer);
  }

  function setAudioBuffer(buffer: AudioBuffer) {
    stop();
    audioBuffer.value = buffer;
    duration.value = buffer.duration;
  }

  async function loadAudio(file: File): Promise<AudioBuffer> {
    const buffer = await decodeAudio(file);
    setAudioBuffer(buffer);
    return buffer;
  }

  async function loadAudioFromArrayBuffer(arrayBuffer: ArrayBuffer): Promise<AudioBuffer> {
    const buffer = await decodeAudioFromArrayBuffer(arrayBuffer);
    setAudioBuffer(buffer);
    return buffer;
  }

  async function play(offset = 0) {
    const buffer = audioBuffer.value;
    if (!buffer) return;
    const currentGeneration = ++playbackGeneration;

    const ctx = getAudioContext();

    stopPlaybackNodes();
    isPlaying.value = false;

    // Resume context if suspended
    if (ctx.state === 'suspended') {
      await ctx.resume();
      if (currentGeneration !== playbackGeneration) return;
    }

    // Set up audio processing chain with AudioWorklet
    let processingAvailable = false;
    if (processCallback) {
      try {
        await ensureWorkletReady();
        if (currentGeneration !== playbackGeneration) return;
        processingAvailable = true;
      } catch (e) {
        // Fallback to direct connection if AudioWorklet fails
        console.warn('AudioWorklet not available, audio processing disabled:', e);
      }
    }

    if (currentGeneration !== playbackGeneration) return;
    const source = ctx.createBufferSource();
    source.buffer = buffer;

    if (processingAvailable) {
      const processingNode = new AudioWorkletNode(ctx, 'audio-stream-processor');
      workletNode = processingNode;

      // Set initial sample offset based on playback position
      const initialSampleOffset = Math.floor(offset * ctx.sampleRate);
      processingNode.port.postMessage({
        type: 'reset',
        sampleOffset: initialSampleOffset,
      });

      // Handle messages from worklet (sample data), then return the transferred
      // backing store to its small pool on the audio thread.
      processingNode.port.onmessage = (event) => {
        if (event.data.type !== 'samples') return;
        const samples = event.data.samples as Float32Array;
        try {
          processCallback?.(samples, event.data.sampleOffset);
        } finally {
          processingNode.port.postMessage({ type: 'recycle', samples }, [samples.buffer]);
        }
      };

      // Connect: source -> worklet -> destination
      source.connect(processingNode);
      processingNode.connect(ctx.destination);
    } else {
      source.connect(ctx.destination);
    }

    source.onended = () => {
      if (sourceNode.value === source && isPlaying.value && !isPaused.value) {
        if (animationFrame) {
          cancelAnimationFrame(animationFrame);
          animationFrame = null;
        }
        if (sourceNode.value) {
          sourceNode.value.disconnect();
          sourceNode.value = null;
        }
        stopProcessing();
        isPlaying.value = false;
        isPaused.value = false;
        currentTime.value = 0;
        pauseTime.value = 0;
      }
    };

    sourceNode.value = source;
    startTime.value = ctx.currentTime - offset;
    source.start(0, offset);
    isPlaying.value = true;
    isPaused.value = false;

    updateTime();
  }

  function stopProcessing() {
    if (workletNode) {
      workletNode.port.postMessage({ type: 'stop' });
      workletNode.port.onmessage = null;
      workletNode.disconnect();
      workletNode = null;
    }
  }

  function pause() {
    if (!isPlaying.value || !audioContext.value) return;

    playbackGeneration += 1;

    pauseTime.value = audioContext.value.currentTime - startTime.value;

    if (sourceNode.value) {
      sourceNode.value.onended = null;
      sourceNode.value.stop();
      sourceNode.value.disconnect();
      sourceNode.value = null;
    }

    stopProcessing();

    isPlaying.value = false;
    isPaused.value = true;

    if (animationFrame) {
      cancelAnimationFrame(animationFrame);
      animationFrame = null;
    }
  }

  function resume() {
    if (!isPaused.value) return;
    play(pauseTime.value);
  }

  function stop() {
    playbackGeneration += 1;
    stopPlaybackNodes();

    isPlaying.value = false;
    isPaused.value = false;
    currentTime.value = 0;
    pauseTime.value = 0;

    if (animationFrame) {
      cancelAnimationFrame(animationFrame);
      animationFrame = null;
    }
  }

  function stopPlaybackNodes() {
    if (sourceNode.value) {
      sourceNode.value.onended = null;
      sourceNode.value.stop();
      sourceNode.value.disconnect();
      sourceNode.value = null;
    }

    stopProcessing();
  }

  function resetAudio() {
    stop();
    audioBuffer.value = null;
    duration.value = 0;
  }

  function setProcessCallback(callback: AudioProcessCallback | null): void {
    processCallback = callback;
  }

  function seek(time: number) {
    const wasPlaying = isPlaying.value;
    stop();
    if (wasPlaying) {
      play(time);
    } else {
      pauseTime.value = time;
      currentTime.value = time;
      isPaused.value = true;
    }
  }

  function updateTime() {
    if (!isPlaying.value || !audioContext.value) return;

    const rawTime = audioContext.value.currentTime - startTime.value;
    currentTime.value = Math.min(rawTime, duration.value);

    if (rawTime >= duration.value) {
      stop();
      return;
    }

    animationFrame = requestAnimationFrame(updateTime);
  }

  const progress = computed(() => {
    if (duration.value === 0) return 0;
    return currentTime.value / duration.value;
  });

  function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  onUnmounted(() => {
    stop();
    stopProcessing();
    processCallback = null;
    if (audioContext.value) {
      audioContext.value.close();
    }
  });

  return {
    audioBuffer,
    isPlaying,
    isPaused,
    currentTime,
    duration,
    progress,
    loadAudio,
    loadAudioFromArrayBuffer,
    decodeAudio,
    decodeAudioFromArrayBuffer,
    setAudioBuffer,
    resetAudio,
    play,
    pause,
    resume,
    stop,
    seek,
    formatTime,
    getAudioContext,
    setProcessCallback,
  };
}
