import { onMounted, onUnmounted, type Ref, ref, watch } from 'vue';

export interface WaveformOptions {
  barWidth?: number;
  barGap?: number;
  barColor?: string | Ref<string>;
  progressColor?: string | Ref<string>;
  backgroundColor?: string | Ref<string>;
}

function unref(v: string | Ref<string>): string {
  return typeof v === 'string' ? v : v.value;
}

/**
 * Resolves the global --color-accent-pink token into a semi-transparent stroke
 * for beat markers, falling back to the brand pink (#EC4899) at 0.5 alpha.
 */
function beatMarkerColor(): string {
  if (typeof document === 'undefined') return 'rgba(236, 72, 153, 0.5)';
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue('--color-accent-pink')
    .trim();
  if (!raw) return 'rgba(236, 72, 153, 0.5)';
  return `color-mix(in srgb, ${raw} 50%, transparent)`;
}

export function useWaveform(
  canvasRef: { value: HTMLCanvasElement | null },
  options: WaveformOptions = {},
) {
  const {
    barWidth = 3,
    barGap = 1,
    barColor = 'rgba(139, 92, 246, 0.4)',
    progressColor = 'rgba(139, 92, 246, 1)',
    backgroundColor = 'rgba(6, 8, 12, 1)',
  } = options;

  const waveformData = ref<number[]>([]);
  const progress = ref(0);
  const beatMarkers = ref<number[]>([]);

  let resizeObserver: ResizeObserver | null = null;
  let currentAudioBuffer: AudioBuffer | null = null;
  // Cached mono mixdown so resizes only re-bucket the existing samples instead
  // of re-mixing the whole buffer channel-by-channel on every ResizeObserver tick.
  let monoSamples: Float32Array | null = null;

  function extractWaveformData(rawData: Float32Array, numBars = 200): number[] {
    const bars: number[] = [];

    for (let i = 0; i < numBars; i++) {
      const start = Math.floor((i * rawData.length) / numBars);
      const end = Math.min(
        rawData.length,
        Math.max(start + 1, Math.floor(((i + 1) * rawData.length) / numBars)),
      );
      let max = 0;

      for (let j = start; j < end; j++) {
        const absValue = Math.abs(rawData[j]);
        if (absValue > max) max = absValue;
      }

      bars.push(max);
    }

    // Normalize
    const maxValue = Math.max(...bars);
    if (maxValue > 0) {
      for (let i = 0; i < bars.length; i++) {
        bars[i] = bars[i] / maxValue;
      }
    }

    return bars;
  }

  function mixToMono(audioBuffer: AudioBuffer): Float32Array {
    const length = audioBuffer.length;
    const channels = audioBuffer.numberOfChannels;

    // Hoist the channel views out of the per-sample loop.
    const channelData: Float32Array[] = [];
    for (let ch = 0; ch < channels; ch++) {
      channelData.push(audioBuffer.getChannelData(ch));
    }

    const mono = new Float32Array(length);
    for (let i = 0; i < length; i++) {
      let sum = 0;
      for (let ch = 0; ch < channels; ch++) {
        sum += channelData[ch][i];
      }
      mono[i] = sum / channels;
    }

    return mono;
  }

  function setAudioBuffer(audioBuffer: AudioBuffer) {
    currentAudioBuffer = audioBuffer;
    monoSamples =
      audioBuffer.numberOfChannels > 1 ? mixToMono(audioBuffer) : audioBuffer.getChannelData(0);
    recalcBars();
  }

  /**
   * Logical (CSS-pixel) canvas size. The backing store is sized to physical
   * pixels (rect * dpr) and the context is scaled by dpr, so all drawing must
   * happen in logical pixels to avoid applying the device pixel ratio twice.
   */
  function logicalSize(canvas: HTMLCanvasElement): { width: number; height: number } {
    const dpr = window.devicePixelRatio || 1;
    return { width: canvas.width / dpr, height: canvas.height / dpr };
  }

  function recalcBars() {
    const canvas = canvasRef.value;
    if (!canvas || !currentAudioBuffer || !monoSamples) return;

    const { width } = logicalSize(canvas);
    const numBars = Math.floor(width / (barWidth + barGap));
    if (numBars > 0) {
      waveformData.value = extractWaveformData(monoSamples, numBars);
    }
    draw();
  }

  function setBeats(beats: Float32Array | number[], duration: number) {
    beatMarkers.value = Array.from(beats).map((t) => t / duration);
  }

  function setProgress(p: number) {
    progress.value = p;
    draw();
  }

  function draw() {
    const canvas = canvasRef.value;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Draw in logical pixels; the context is already dpr-scaled in handleResize.
    const { width, height } = logicalSize(canvas);
    const data = waveformData.value;

    // Clear
    ctx.fillStyle = unref(backgroundColor);
    ctx.fillRect(0, 0, width, height);

    if (data.length === 0) return;

    const totalBarWidth = barWidth + barGap;
    const centerY = height / 2;

    // Draw bars
    const bc = unref(barColor);
    const pc = unref(progressColor);
    for (let i = 0; i < data.length; i++) {
      const x = i * totalBarWidth;
      const barHeight = data[i] * height * 0.8;
      const y = centerY - barHeight / 2;

      const barProgress = i / data.length;
      ctx.fillStyle = barProgress <= progress.value ? pc : bc;

      ctx.beginPath();
      ctx.roundRect(x, y, barWidth, barHeight, 2);
      ctx.fill();
    }

    // Draw beat markers — keep the brand pink but derive it from the global
    // --color-accent-pink token so it stays in sync with the design system.
    if (beatMarkers.value.length > 0) {
      ctx.strokeStyle = beatMarkerColor();
      ctx.lineWidth = 1;

      for (const beatPos of beatMarkers.value) {
        const x = beatPos * width;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
    }
  }

  function handleResize() {
    const canvas = canvasRef.value;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.scale(dpr, dpr);
    }

    recalcBars();
  }

  onMounted(() => {
    if (canvasRef.value) {
      resizeObserver = new ResizeObserver(handleResize);
      resizeObserver.observe(canvasRef.value);
      handleResize();
    }
  });

  onUnmounted(() => {
    if (resizeObserver) {
      resizeObserver.disconnect();
    }
  });

  watch(
    () => canvasRef.value,
    (canvas) => {
      if (canvas && resizeObserver) {
        resizeObserver.observe(canvas);
        handleResize();
      }
    },
  );

  return {
    waveformData,
    progress,
    beatMarkers,
    setAudioBuffer,
    setBeats,
    setProgress,
    draw,
  };
}
