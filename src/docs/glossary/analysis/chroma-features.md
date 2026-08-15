---
title: Chroma Features
description: Chroma, pitch classes, and chromagrams — how libsonare folds the spectrum into 12 note bins to power key and chord analysis.
---

# Chroma Features

**Chroma** is the representation that makes harmony analysis possible.

It folds the whole spectrum into **12 pitch-class bins**: C, C♯, D, ... B. Each frame then says "how much C energy, how much C♯ energy, ..." regardless of octave.

Key detection and chord recognition both read from it. This page expands on the harmony section of [MIR Overview](../concepts/mir-overview.md).

## Pitch class: forgetting the octave

A **pitch class** groups every octave of a note together. C2, C3, and C4 are different *pitches* but the same *pitch class*, "C." Western music has 12 pitch classes, one per semitone. Chroma takes the energy spread across all frequencies in an [STFT](./spectrogram-stft.md) frame and sums it into those 12 bins — a C played in any octave lands in the same bin.

The octaves are not weighted equally, though. Following the librosa reference, the filterbank tapers each bin's contribution with a Gaussian octave envelope centred near C5 and about two octaves wide, so mid-register content dominates the chroma vector while a very low bass note or a very high harmonic contributes comparatively little. That is why a bass line can look faint in a chromagram even when it is clearly audible.

This deliberate forgetting is the point. Harmony is about *which notes*, not *which octave*: a C-major chord is a C-major chord whether it is voiced low or high. Folding octaves together gives a clean, 12-dimensional fingerprint of the harmony at each moment.

## Chromagram: chroma over time

Stack a chroma vector for every frame and you get a **chromagram** — a 12-row image showing how pitch-class energy moves through the song. Sustained chords appear as steady horizontal bands; a key change shifts which bins stay lit. Visualizers draw it directly; analyzers read patterns out of it.

<SonareDemo id="chromagram" />

## Why chroma is right for harmony — and wrong for melody

| Question | Use chroma? | Why |
|----------|-------------|-----|
| What key is this? | Yes | Overall pitch-class distribution reveals the tonal center |
| What chord is playing now? | Yes | A frame's chroma matches a chord template |
| What octave is the bass in? | No | Octave is folded away |
| What is the lead melody note? | No | Use pitch tracking; chroma cannot separate the line |
| What instrument is this? | No | Timbre needs spectral shape; use MFCC |

Matching the representation to the question is the recurring skill in MIR (music information retrieval): chroma trades octave and timbre detail *away* precisely to make harmony clear.

::: details How libsonare builds chroma
libsonare applies a chroma filterbank to the STFT **power** spectrum — mapping each frequency bin onto its pitch class, weighted by the octave envelope described above — and then normalizes each frame so its largest of the 12 values is 1.0 (L-infinity). Working from power rather than magnitude weights strong partials more heavily than weak ones. A constant-Q variant, `chromaCqt` / `chroma_cqt`, folds a constant-Q transform into the 12 bins for a direct `librosa.feature.chroma_cqt` equivalent. A separate NNLS (non-negative least squares) chroma variant estimates per-note activation to reduce the influence of overtones, giving cleaner profiles for chord work. Chroma is used by the Krumhansl-Schmuckler key estimator and the template-matching chord recognizer, so improving the chroma stage improves both downstream features at once.
:::

::: warning Tuning is not estimated for you
`ChromaConfig.tuning` defaults to `0` — concert A440 — and libsonare never estimates it from the signal. `librosa.feature.chroma_stft` behaves differently: its `tuning=None` default runs `estimate_tuning()` first. On a recording that sits a fraction of a semitone off A440 the pitch-class grid no longer lines up with the actual partials, energy smears into neighbouring bins, and key and chord results quietly get worse with nothing to signal it.

Run `estimateTuning()` / `estimate_tuning()` on the audio and pass the result into `tuning` whenever the source may not be at A440 — older recordings, tape, live acoustic material, anything deliberately tuned to a different reference pitch.
:::

Related: [MIR Overview](../concepts/mir-overview.md), [Key Detection](./key-detection.md), [Chord Recognition](./chord-recognition.md), [Spectrogram and STFT](./spectrogram-stft.md)
