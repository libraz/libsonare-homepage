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
| `nFft` | FFT length in samples (e.g. `2048`) — and, unless you shorten the window separately, the analysis window length too | A longer *window* = finer frequency detail, but blurrier timing |
| `hopLength` | Step between windows (e.g. `512`) | Smaller = more frames per second (smoother motion), more CPU |

This is the **time–frequency resolution trade-off**: you cannot have perfect frequency *and* perfect time resolution at once. It is physics, not a libsonare limitation.

Strictly, it is the *window* length that sets that trade-off, not the transform length. They are the same number by default, and always the same through the JS/WASM bindings. In C++ you can set `StftConfig::win_length` shorter than `n_fft`; from there, raising `n_fft` only zero-pads each frame, which adds bins that interpolate the same spectrum more finely without buying any real frequency resolution — and without costing any time resolution either.

## Windowing

Each block is multiplied by a **window function** (such as a Hann window) that tapers its edges to zero before the FFT. Without it, the abrupt block boundaries leak energy across frequencies (*spectral leakage*) and smear the result. Windowing is why frames overlap — the tapered edges are filled in by neighboring frames.

<StftFramingFigure
  title="nFft and hopLength, drawn to scale"
  caption="At the defaults each window steps forward by a quarter of its own length, so most of every window is samples the previous one already covered — which is what fills in the tapered edges. One window is one FFT is one spectrogram column, so hopLength alone sets how many columns you get per second."
/>

## Musical spacing: CQT and VQT

A standard STFT spaces its frequency bins *evenly* in Hz. Musical notes are different: they are spaced *logarithmically*, because each octave doubles in frequency.

That means an even-Hz grid can waste resolution high up and lack resolution down low.

<BinSpacingFigure
  title="The same octave, twice"
  caption="Both panels are one octave wide and drawn the same size. A pitch-aware bank puts twelve bins in each; an STFT puts whatever a constant hertz spacing happens to give it — five bins in the low octave, over 160 in the high one. VQT keeps exactly these pitch-aware bin centres and instead widens the filters at the bottom, where a strict constant Q would need windows long enough to smear timing."
/>

| Transform | How it spaces frequency | Use when |
|-----------|-------------------------|----------|
| STFT | Evenly in Hz | You want a general time-frequency view |
| CQT (constant-Q transform) | By musical interval, often one set per semitone | Pitch relationships matter |
| VQT (variable-Q transform) | Bin centres stay on CQT's per-semitone grid, but the low-frequency filters are widened (lower Q), so they are shorter in time and low notes do not smear | You want CQT-style pitch-aware bins but cleaner timing on bass and low percussion |

::: details How libsonare computes the STFT
libsonare's STFT and framing utilities apply a window (Hann by default), advance by `hopLength`, and run a real FFT per frame, producing the magnitude/power spectra that mel, chroma, onset, and tempogram stages reuse. That reuse is scoped: inside `analyze()` (`MusicAnalyzer`) the spectrogram is computed once and shared by the chroma and mel stages, while the standalone per-feature helpers — `chroma()`, `melSpectrogram()`, and the individual key/chord/section analyzers — each run their own STFT. Ask for several features through `analyze()` if you want the FFT paid for once. The `nFft`/`hopLength` defaults (`2048`/`512`) mirror common librosa usage so reference tests can compare outputs. CQT/VQT use log-frequency bins layered on top of the same framing conventions.
:::

Related: [MIR Overview](../concepts/mir-overview.md), [Chroma Features](./chroma-features.md), [Mel, MFCC, and Timbre](./mel-mfcc-timbre.md), [Audio Basics](../concepts/audio-basics.md)
