/**
 * File export for rendered audio and MIDI: mix offline stems down to one
 * interleaved buffer, then hand it and the native SMF writer's bytes back as
 * downloadable blobs. The WAV bytes themselves come from `utils/audio`, which
 * is where the site's one encoder lives. Pure and synchronous, so a demo can
 * call it from a download click on the main thread or from a worker.
 */

import { encodeWavInterleaved } from '@/utils/audio';

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
    return new Blob([encodeWavInterleaved(interleaved, sampleRate, numChannels)], {
      type: 'audio/wav',
    });
  }

  /** Mix stems with their gains and encode the result; null when nothing was mixed. */
  function exportWav(stems: Float32Array[], options: WavExportOptions): Blob | null {
    const mix = mixStems(stems, options);
    return mix ? encodeWav(mix, options.sampleRate, options.numChannels) : null;
  }

  /** Wrap Standard MIDI File bytes (e.g. `Project.exportSmf()`) as a blob. */
  function exportMidi(smf: Uint8Array<ArrayBuffer>): Blob {
    return new Blob([smf], { type: 'audio/midi' });
  }

  return { mixStems, encodeWav, exportWav, exportMidi };
}
