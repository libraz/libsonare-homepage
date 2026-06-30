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

export function mixToMono(audioBuffer: AudioBuffer, maxLength?: number): Float32Array {
  const length = maxLength ? Math.min(audioBuffer.length, maxLength) : audioBuffer.length;
  const channels = audioBuffer.numberOfChannels;
  const channelData: Float32Array[] = [];
  for (let channel = 0; channel < channels; channel++) {
    channelData.push(audioBuffer.getChannelData(channel));
  }

  if (channels === 2) {
    const left = channelData[0];
    const right = channelData[1];
    const mono = new Float32Array(length);
    for (let i = 0; i < length; i++) {
      mono[i] = (left[i] + right[i]) * 0.5;
    }
    return mono;
  }

  const mono = new Float32Array(length);
  const scale = 1 / channels;
  for (let i = 0; i < length; i++) {
    let sum = 0;
    for (let channel = 0; channel < channels; channel++) {
      sum += channelData[channel][i];
    }
    mono[i] = sum * scale;
  }
  return mono;
}

export function splitMelBands(mel: MelSpectrogramLike): { low: Float32Array; high: Float32Array } {
  const low = new Float32Array(mel.nFrames);
  const high = new Float32Array(mel.nFrames);
  const lowEnd = Math.floor(mel.nMels * 0.25);
  const highStart = Math.floor(mel.nMels * 0.5);

  for (let frame = 0; frame < mel.nFrames; frame++) {
    let lowSum = 0;
    let highSum = 0;
    for (let bin = 0; bin < lowEnd; bin++) {
      lowSum += mel.power[frame * mel.nMels + bin];
    }
    for (let bin = highStart; bin < mel.nMels; bin++) {
      highSum += mel.power[frame * mel.nMels + bin];
    }
    low[frame] = Math.sqrt(lowSum / lowEnd);
    high[frame] = Math.sqrt(highSum / (mel.nMels - highStart));
  }

  return { low, high };
}
