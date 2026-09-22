export interface DecodedStereoAudio {
  fileName: string;
  sampleRate: number;
  duration: number;
  channels: number;
  left: Float32Array;
  right: Float32Array;
}

export interface AudioInputBudget {
  maxFileBytes?: number;
  maxDurationSeconds?: number;
  maxChannels?: number;
  maxFrames?: number;
}

export const DEFAULT_AUDIO_INPUT_BUDGET: Required<AudioInputBudget> = {
  maxFileBytes: 128 * 1024 * 1024,
  maxDurationSeconds: 20 * 60,
  maxChannels: 8,
  maxFrames: 57_600_000,
};

export class AudioInputBudgetError extends Error {
  constructor(public readonly code: 'file-size' | 'duration' | 'channels' | 'frames') {
    super(`Audio input exceeds the ${code} budget`);
    this.name = 'AudioInputBudgetError';
  }
}

export function assertAudioFileBudget(file: File, budget: AudioInputBudget = {}): void {
  const limit = budget.maxFileBytes ?? DEFAULT_AUDIO_INPUT_BUDGET.maxFileBytes;
  if (file.size > limit) throw new AudioInputBudgetError('file-size');
}

export function assertDecodedAudioBudget(buffer: AudioBuffer, budget: AudioInputBudget = {}): void {
  const limits = { ...DEFAULT_AUDIO_INPUT_BUDGET, ...budget };
  if (buffer.numberOfChannels > limits.maxChannels) throw new AudioInputBudgetError('channels');
  if (buffer.duration > limits.maxDurationSeconds) throw new AudioInputBudgetError('duration');
  if (buffer.length > limits.maxFrames) throw new AudioInputBudgetError('frames');
}

export async function decodeAudioBuffer(
  file: File,
  audioContext: AudioContext,
  budget: AudioInputBudget = {},
): Promise<AudioBuffer> {
  assertAudioFileBudget(file, budget);
  const buffer = await audioContext.decodeAudioData(await file.arrayBuffer());
  assertDecodedAudioBudget(buffer, budget);
  return buffer;
}

export interface WaveformPeak {
  min: number;
  max: number;
  rms: number;
}

export async function decodeAudioFile(
  file: File,
  audioContext: AudioContext,
  budget: AudioInputBudget = {},
): Promise<DecodedStereoAudio> {
  const buffer = await decodeAudioBuffer(file, audioContext, budget);
  const left = new Float32Array(buffer.getChannelData(0));
  const right =
    buffer.numberOfChannels > 1
      ? new Float32Array(buffer.getChannelData(1))
      : new Float32Array(buffer.getChannelData(0));

  return {
    fileName: file.name,
    sampleRate: buffer.sampleRate,
    duration: buffer.duration,
    channels: buffer.numberOfChannels,
    left,
    right,
  };
}

export function mixToMono(left: Float32Array, right: Float32Array): Float32Array {
  const length = Math.min(left.length, right.length);
  const mono = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    mono[i] = (left[i] + right[i]) * 0.5;
  }
  return mono;
}

export function downsampleWaveform(
  left: Float32Array,
  right: Float32Array,
  targetPoints = 1200,
): WaveformPeak[] {
  const length = Math.min(left.length, right.length);
  if (!length) return [];

  const points = Math.max(1, Math.min(targetPoints, length));
  const blockSize = Math.max(1, Math.floor(length / points));
  const peaks: WaveformPeak[] = [];

  for (let point = 0; point < points; point++) {
    const start = point * blockSize;
    const end = point === points - 1 ? length : Math.min(length, start + blockSize);
    let min = 1;
    let max = -1;
    let sum = 0;
    let count = 0;

    for (let i = start; i < end; i++) {
      const value = (left[i] + right[i]) * 0.5;
      if (value < min) min = value;
      if (value > max) max = value;
      sum += value * value;
      count++;
    }

    peaks.push({
      min,
      max,
      rms: Math.sqrt(sum / Math.max(1, count)),
    });
  }

  return peaks;
}

export function calculatePeakRms(left: Float32Array, right: Float32Array) {
  const length = Math.min(left.length, right.length);
  let peak = 0;
  let sum = 0;

  for (let i = 0; i < length; i++) {
    const l = left[i];
    const r = right[i];
    peak = Math.max(peak, Math.abs(l), Math.abs(r));
    sum += (l * l + r * r) * 0.5;
  }

  const rms = Math.sqrt(sum / Math.max(1, length));
  return {
    peakDb: amplitudeToDb(peak),
    rmsDb: amplitudeToDb(rms),
  };
}

export function calculateCorrelation(left: Float32Array, right: Float32Array): number {
  const length = Math.min(left.length, right.length);
  let sumLR = 0;
  let sumL2 = 0;
  let sumR2 = 0;

  for (let i = 0; i < length; i++) {
    const l = left[i];
    const r = right[i];
    sumLR += l * r;
    sumL2 += l * l;
    sumR2 += r * r;
  }

  const denominator = Math.sqrt(sumL2 * sumR2);
  return denominator > 0 ? Math.max(-1, Math.min(1, sumLR / denominator)) : 0;
}

export function amplitudeToDb(value: number): number {
  return value > 0 ? 20 * Math.log10(value) : -120;
}

/**
 * A position in a clip — a playhead, a section boundary, a marker. Floors, the
 * way a clock does: a readout must not show 1:00 before the minute is reached.
 */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds)) return '--:--';
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

/**
 * How long a clip is. Rounds, because a length is being reported rather than
 * counted up to, and a 59.6 s file reads as a minute.
 */
export function formatClipLength(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0:00';
  // Round the whole value first: rounding the remainder alone can carry to 60.
  const total = Math.round(seconds);
  const minutes = Math.floor(total / 60);
  const rest = (total % 60).toString().padStart(2, '0');
  return `${minutes}:${rest}`;
}

export function formatSampleRate(sampleRate: number): string {
  if (!sampleRate) return '-';
  return `${(sampleRate / 1000).toFixed(sampleRate % 1000 === 0 ? 0 : 1)} kHz`;
}

export function formatDb(value: number): string {
  if (!Number.isFinite(value)) return '-';
  return `${value.toFixed(1)} dB`;
}

/**
 * Hands an object URL to the browser as a download. The anchor is never in the
 * document — clicking a detached one is enough, and there is nothing to clean
 * up afterwards. The caller owns the URL's lifetime.
 */
export function triggerDownload(url: string, filename: string): void {
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
}

/**
 * Revoking an object URL in the same tick as the click cancels the download in
 * some browsers, so a one-shot blob is released on a timer instead.
 */
const DOWNLOAD_URL_LIFETIME_MS = 5000;

/** Downloads a blob nothing else refers to, releasing the URL once it is safe. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  triggerDownload(url, filename);
  setTimeout(() => URL.revokeObjectURL(url), DOWNLOAD_URL_LIFETIME_MS);
}

/** A pretty-printed JSON blob — the shape every export on the site uses. */
export function jsonBlob(data: unknown): Blob {
  return new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
}

/**
 * Downloads `data` as JSON and returns the object URL, which stays alive so the
 * caller can keep offering the same file. Revoking it is the caller's job; use
 * {@link downloadBlob} instead when nothing will refer to it again.
 */
export function downloadJson(filename: string, data: unknown): string {
  const url = URL.createObjectURL(jsonBlob(data));
  triggerDownload(url, filename);
  return url;
}

export function encodeWavStereo(
  left: Float32Array,
  right: Float32Array,
  sampleRate: number,
): ArrayBuffer {
  const frames = Math.min(left.length, right.length);
  const channels = 2;
  const bytesPerSample = 2;
  const blockAlign = channels * bytesPerSample;
  const dataSize = frames * blockAlign;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bytesPerSample * 8, true);
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < frames; i++) {
    view.setInt16(offset, floatToInt16(left[i]), true);
    view.setInt16(offset + 2, floatToInt16(right[i]), true);
    offset += 4;
  }

  return buffer;
}

function floatToInt16(value: number): number {
  const clipped = Math.max(-1, Math.min(1, value));
  return clipped < 0 ? clipped * 0x8000 : clipped * 0x7fff;
}

function writeString(view: DataView, offset: number, value: string) {
  for (let i = 0; i < value.length; i++) {
    view.setUint8(offset + i, value.charCodeAt(i));
  }
}
