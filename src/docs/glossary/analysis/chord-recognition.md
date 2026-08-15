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

<SonareDemo id="chromagram" />

## Templates over chroma

libsonare compares each frame or beat-synchronous chroma summary against a set of chord templates. These cover the four triads — major, minor, diminished, and augmented — as well as richer qualities that add or alter notes: sevenths, ninths, add9, half-diminished, and sus voicings. The result is a best matching root and quality for each region.

By default, everything outside the triad group must beat the best triad by an extra margin before it is preferred. This keeps noisy chroma from turning plain triads into unstable extensions. Note that sus2 and sus4 are three-note chords but sit on the non-triad side of that comparison, so they pay the margin too.

## Timing and smoothing

The chord detector can run on frame-level chroma or beat-synchronized chroma. Beat sync usually gives musically cleaner changes because chord boundaries often align with beats. Smoothing and minimum-duration merging avoid very short flickering labels.

::: warning `detectChords()` is always frame-level, whatever `useBeatSync` says
Beat synchronization needs a list of beat times, and only the whole-track analysis path (`analyze` / `MusicAnalyzer`) supplies one — it tracks beats first, then hands them to the chord analyzer. The standalone `detectChords()` entry point goes straight from audio to chroma, so it runs frame-level even though `useBeatSync` defaults to `true`. Run the full music analysis when you want beat-aligned chord boundaries.
:::

Optional HMM smoothing (a hidden Markov model, which favors sequences of chords that follow one another plausibly rather than judging each region in isolation) can run over the chord candidates, with optional key context, to further suppress jitter. In streaming mode, chord estimates update over time and should be treated as provisional until enough context accumulates.

## Common confusions

Harmonically close chords share notes, so substitutions happen. C major and A minor 7 share three pitch classes, and a chord plus a passing melody note can look like a richer extension.

Expect occasional swaps between neighboring chords. Recognition is strongest on clean, sustained material and weakest on dense or distorted mixes, where overtones blur the chroma the templates read.

::: details How libsonare computes it
`ChordAnalyzer` builds STFT or NNLS chroma, scores templates by correlation, prefers triads unless a non-triad template clears the configured margin, and merges short segments below `minDuration`. Defaults include `minDuration = 0.3`, `smoothingWindow = 2.0`, `threshold = 0.5`, `nFft = 2048`, `hopLength = 512`, and `useBeatSync = true` — the last of which is honored only by the constructor that receives beat times, so it has no effect on `detectChords()`. Public bindings expose chord roots, qualities, timing, confidence, and optional inversion/key/HMM options depending on the binding.
:::

Related: [Chroma Features](./chroma-features.md), [Key Detection](./key-detection.md), [Beats and Downbeats](./beats-downbeats.md)
