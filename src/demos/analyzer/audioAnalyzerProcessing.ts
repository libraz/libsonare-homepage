export interface MelSpectrogramLike {
  power: Float32Array;
  nMels: number;
  nFrames: number;
}

export function calculateNormalizationGain(buffer: AudioBuffer): number {
  const targetPeak = 0.5;
  const threshold = 0.8;

  let maxPeak = 0;
  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < data.length; i++) {
      const abs = Math.abs(data[i]);
      if (abs > maxPeak) maxPeak = abs;
    }
  }

  return maxPeak > threshold ? targetPeak / maxPeak : 1;
}

/**
 * Collapse a mel power spectrogram into low- and high-band RMS envelopes.
 *
 * `melSpectrogram` returns `power` as a row-major `[nMels x nFrames]` matrix
 * (one contiguous run of frames per mel band), so a band/frame pair lives at
 * `bin * nFrames + frame`.
 */
export function splitMelBands(mel: MelSpectrogramLike): { low: Float32Array; high: Float32Array } {
  const low = new Float32Array(mel.nFrames);
  const high = new Float32Array(mel.nFrames);
  const lowEnd = Math.floor(mel.nMels * 0.25);
  const highStart = Math.floor(mel.nMels * 0.5);

  for (let frame = 0; frame < mel.nFrames; frame++) {
    let lowSum = 0;
    let highSum = 0;
    for (let bin = 0; bin < lowEnd; bin++) {
      lowSum += mel.power[bin * mel.nFrames + frame];
    }
    for (let bin = highStart; bin < mel.nMels; bin++) {
      highSum += mel.power[bin * mel.nFrames + frame];
    }
    low[frame] = Math.sqrt(lowSum / lowEnd);
    high[frame] = Math.sqrt(highSum / (mel.nMels - highStart));
  }

  return { low, high };
}
