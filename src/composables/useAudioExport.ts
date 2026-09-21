/**
 * File export for rendered audio and MIDI: mix offline stems down to one
 * interleaved buffer, encode it as a 16-bit PCM WAV, and wrap the native SMF
 * writer's bytes as a downloadable file. Pure and synchronous, so a demo can
 * call it from a download click on the main thread or from a worker.
 */

export interface StemMixOptions {
  /** Linear gain per stem, in stem order. Missing entries mean unity. */
  gains?: number[];
  /** Linear gain applied to the summed mix. Defaults to unity. */
  masterGain?: number;
}

export interface WavExportOptions extends StemMixOptions {
  sampleRate: number;
  numChannels: number;
}

export function useAudioExport() {
  /**
   * Sum interleaved stems of any length into one buffer as long as the longest
   * (release tails survive), each scaled by its gain, then by the master gain.
   * Returns null when there is nothing to mix.
   */
  function mixStems(stems: Float32Array[], options: StemMixOptions = {}): Float32Array | null {
    let maxLength = 0;
    for (const stem of stems) {
      if (stem.length > maxLength) maxLength = stem.length;
    }
    if (maxLength === 0) return null;
    const mix = new Float32Array(maxLength);
    stems.forEach((stem, index) => {
      const gain = options.gains?.[index] ?? 1;
      // Round each scaled sample to float32 before summing, as a per-stem
      // Float32Array copy would, so the mix does not depend on double precision.
      for (let f = 0; f < stem.length; f++) mix[f] += Math.fround(stem[f] * gain);
    });
    const masterGain = options.masterGain ?? 1;
    for (let f = 0; f < mix.length; f++) mix[f] *= masterGain;
    return mix;
  }

  /** Encode interleaved float samples as a 16-bit PCM WAV blob. */
  function encodeWav(interleaved: Float32Array, sampleRate: number, numChannels: number): Blob {
    const bytesPerSample = 2;
    const dataBytes = interleaved.length * bytesPerSample;
    const buffer = new ArrayBuffer(44 + dataBytes);
    const view = new DataView(buffer);
    const writeStr = (offset: number, s: string) => {
      for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
    };
    writeStr(0, 'RIFF');
    view.setUint32(4, 36 + dataBytes, true);
    writeStr(8, 'WAVE');
    writeStr(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numChannels * bytesPerSample, true);
    view.setUint16(32, numChannels * bytesPerSample, true);
    view.setUint16(34, 8 * bytesPerSample, true);
    writeStr(36, 'data');
    view.setUint32(40, dataBytes, true);
    let offset = 44;
    for (let i = 0; i < interleaved.length; i++) {
      const s = Math.max(-1, Math.min(1, interleaved[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      offset += bytesPerSample;
    }
    return new Blob([buffer], { type: 'audio/wav' });
  }

  /** Mix stems with their gains and encode the result; null when nothing was mixed. */
  function exportWav(stems: Float32Array[], options: WavExportOptions): Blob | null {
    const mix = mixStems(stems, options);
    return mix ? encodeWav(mix, options.sampleRate, options.numChannels) : null;
  }

  /** Wrap Standard MIDI File bytes (e.g. `Project.exportSmf()`) as a blob. */
  function exportMidi(smf: Uint8Array): Blob {
    // A fresh copy is ArrayBuffer-backed, which is what BlobPart requires.
    return new Blob([new Uint8Array(smf)], { type: 'audio/midi' });
  }

  return { mixStems, encodeWav, exportWav, exportMidi };
}
