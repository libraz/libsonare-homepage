---
title: Spectrogram and STFT
description: FFT, STFT, windows, nFft, hopLength, spectrograms, and CQT/VQT — the time–frequency foundation almost every libsonare analysis feature is built on.
---

# Spectrogram and STFT

Almost every MIR feature in libsonare is computed from a **time-frequency representation** of the audio. That includes chroma, mel, MFCC, onset strength, and even BPM and key.

Understanding this one foundation explains why so many functions share the same `nFft` and `hopLength` parameters. This page goes one level deeper than the map in [MIR Overview](../concepts/mir-overview.md).

## From waveform to frequencies: the FFT

A waveform is amplitude over time; it does not tell you *which frequencies* are present. The **Fourier Transform** answers that — it decomposes a signal into the sine waves that sum to make it, like a prism splitting light into colors. The **FFT (Fast Fourier Transform)** is just an efficient algorithm for computing it on a block of samples.

The catch: one FFT describes a whole block as if its frequency content never changed. Music changes constantly, so a single FFT of a song is almost useless.

## Tracking change over time: the STFT

The **Short-Time Fourier Transform (STFT)** fixes this by chopping the audio into short, overlapping windows and running an FFT on each. The result is a 2-D grid — frequency content for each moment in time. A **spectrogram** is that grid drawn as an image: time on one axis, frequency on the other, energy as brightness.

<SonareDemo id="stft-basics" />

Two parameters appear everywhere because they control this grid:

| Parameter | What it sets | Trade-off |
|-----------|--------------|-----------|
| `nFft` | Window size in samples (e.g. `2048`) | Bigger = finer frequency detail, but blurrier timing |
| `hopLength` | Step between windows (e.g. `512`) | Smaller = more frames per second (smoother motion), more CPU |

This is the **time–frequency resolution trade-off**: you cannot have perfect frequency *and* perfect time resolution at once. It is physics, not a libsonare limitation.

## Windowing

Each block is multiplied by a **window function** (such as a Hann window) that tapers its edges to zero before the FFT. Without it, the abrupt block boundaries leak energy across frequencies (*spectral leakage*) and smear the result. Windowing is why frames overlap — the tapered edges are filled in by neighboring frames.

## Musical spacing: CQT and VQT

A standard STFT spaces its frequency bins *evenly* in Hz. Musical notes are different: they are spaced *logarithmically*, because each octave doubles in frequency.

That means an even-Hz grid can waste resolution high up and lack resolution down low.

| Transform | How it spaces frequency | Use when |
|-----------|-------------------------|----------|
| STFT | Evenly in Hz | You want a general time-frequency view |
| CQT | By musical interval, often one set per semitone | Pitch relationships matter |
| VQT | Like CQT, but relaxed for better low-frequency timing | You need pitch-aware bins with better timing tradeoffs |

::: details How libsonare computes the STFT
libsonare's STFT and framing utilities apply a window (Hann by default), advance by `hopLength`, and run a real FFT per frame, producing the magnitude/power spectra that mel, chroma, onset, and tempogram stages reuse. Because the intermediate spectrogram is shared, asking for several features on one source does not recompute the FFT each time. The `nFft`/`hopLength` defaults (`2048`/`512`) mirror common librosa usage so reference tests can compare outputs. CQT/VQT use log-frequency bins layered on top of the same framing conventions.
:::

Related: [MIR Overview](../concepts/mir-overview.md), [Chroma Features](./chroma-features.md), [Mel, MFCC, and Timbre](./mel-mfcc-timbre.md), [Audio Basics](../concepts/audio-basics.md)
