---
title: Chord Recognition
description: Chord templates, beat-synchronous chroma, smoothing, and confidence — how libsonare turns chroma into chord segments.
---

# Chord Recognition

**Chord recognition** estimates the harmony that is active over time, returning chord segments with start/end times and confidence. It is local harmony analysis: unlike key detection, it asks "what chord is playing now?"

## What a chord is, for a computer

A **chord** is several notes sounding together as a unit. C major is C + E + G.

For recognition, what matters is the *set of pitch classes* present, not the octave or instrument. That is exactly what [chroma](./chroma-features.md) captures: a C-major chord lights up the C, E, and G bins however it is voiced.

That is why recognition works on chroma rather than the raw spectrum.

## Templates over chroma

libsonare compares each frame or beat-synchronous chroma summary against chord templates. The template set covers triads and extended qualities such as seventh, add9, diminished, half-diminished, ninth, and sus forms. The result is a best matching root and quality for each region.

By default, richer chords must beat the simpler triad by an extra margin before they are preferred. This keeps noisy chroma from turning plain triads into unstable extensions.

## Timing and smoothing

The chord detector can run on frame-level chroma or beat-synchronized chroma. Beat sync usually gives musically cleaner changes because chord boundaries often align with beats. Smoothing and minimum-duration merging avoid very short flickering labels.

Optional HMM smoothing can run a Viterbi pass over chord candidates, with optional key context. In streaming mode, chord estimates are progressive and should be treated as provisional until enough context accumulates.

## Common confusions

Harmonically close chords share notes, so substitutions happen. C major and A minor 7 share three pitch classes, and a chord plus a passing melody note can look like a richer extension.

Expect occasional swaps between neighboring chords. Recognition is strongest on clean, sustained material and weakest on dense or distorted mixes, where overtones blur the chroma the templates read.

::: details How libsonare computes it
`ChordAnalyzer` builds STFT or NNLS chroma, scores templates by correlation, prefers triads unless an extension clears the configured margin, and merges short segments below `minDuration`. Defaults include `minDuration = 0.3`, `smoothingWindow = 2.0`, `threshold = 0.5`, `nFft = 2048`, `hopLength = 512`, and `useBeatSync = true`. Public bindings expose chord roots, qualities, timing, confidence, and optional inversion/key/HMM options depending on the binding.
:::

Related: [Chroma Features](./chroma-features.md), [Key Detection](./key-detection.md), [Beats and Downbeats](./beats-downbeats.md)
