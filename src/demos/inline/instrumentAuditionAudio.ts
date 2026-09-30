import type { StereoAudio } from './useSonareDemoAudio';

/** Convert the interleaved stereo buffer returned by the native bounce API. */
export function deinterleaveStereo(
  interleaved: Float32Array,
  frames: number,
  sampleRate: number,
): StereoAudio {
  if (!Number.isInteger(frames) || frames <= 0) {
    throw new Error(`invalid stereo frame count: ${frames}`);
  }
  if (interleaved.length !== frames * 2) {
    throw new Error(`stereo bounce returned ${interleaved.length} samples for ${frames} frames`);
  }
  if (!Number.isFinite(sampleRate) || sampleRate <= 0) {
    throw new Error(`invalid stereo sample rate: ${sampleRate}`);
  }
  const left = new Float32Array(frames);
  const right = new Float32Array(frames);
  for (let frame = 0; frame < frames; frame++) {
    left[frame] = interleaved[frame * 2] ?? 0;
    right[frame] = interleaved[frame * 2 + 1] ?? 0;
  }
  return { left, right, sampleRate };
}

/**
 * Peak-match a stereo render with one gain derived from both channels.
 *
 * The channels stay independent: the shared gain preserves their balance and
 * leaves loudness differences between renders visible to the listener.
 */
export function peakNormalizeStereo(audio: StereoAudio, targetPeak = 0.9): StereoAudio {
  if (!Number.isFinite(targetPeak) || targetPeak <= 0) {
    throw new Error(`invalid target peak: ${targetPeak}`);
  }
  if (audio.left.length === 0 || audio.left.length !== audio.right.length) {
    throw new Error('stereo audio must have equal non-empty channels');
  }
  let peak = 1e-6;
  for (let i = 0; i < audio.left.length; i++) {
    peak = Math.max(peak, Math.abs(audio.left[i] ?? 0), Math.abs(audio.right[i] ?? 0));
  }
  const scale = targetPeak / peak;
  for (let i = 0; i < audio.left.length; i++) {
    audio.left[i] = (audio.left[i] ?? 0) * scale;
    audio.right[i] = (audio.right[i] ?? 0) * scale;
  }
  return audio;
}
