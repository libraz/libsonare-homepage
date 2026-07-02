---
title: Chroma Features
description: Chroma, pitch classes, and chromagrams — how libsonare folds the spectrum into 12 note bins to power key and chord analysis.
---

# Chroma Features

**Chroma** is the representation that makes harmony analysis possible.

It folds the whole spectrum into **12 pitch-class bins**: C, C♯, D, ... B. Each frame then says "how much C energy, how much C♯ energy, ..." regardless of octave.

Key detection and chord recognition both read from it. This page expands on the harmony section of [MIR Overview](../concepts/mir-overview.md).

## Pitch class: forgetting the octave

A **pitch class** groups every octave of a note together. C2, C3, and C4 are different *pitches* but the same *pitch class*, "C." Western music has 12 pitch classes, one per semitone. Chroma takes the energy spread across all frequencies in an STFT frame and sums it into those 12 bins — a C played in any octave lands in the same bin.

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

Matching the representation to the question is the recurring MIR skill: chroma trades octave and timbre detail *away* precisely to make harmony clear.

::: details How libsonare builds chroma
libsonare derives chroma from the STFT magnitude by mapping each frequency bin onto its pitch class and accumulating energy into 12 bins, with tuning and normalization handling so off-A440 material still aligns. An NNLS (non-negative least squares) chroma variant can reduce the influence of overtones, giving cleaner profiles for chord work. Chroma is used by the Krumhansl-Schmuckler key estimator and the template-matching chord recognizer, so improving the chroma stage improves both downstream features at once.
:::

Related: [MIR Overview](../concepts/mir-overview.md), [Key Detection](./key-detection.md), [Chord Recognition](./chord-recognition.md), [Spectrogram and STFT](./spectrogram-stft.md)
