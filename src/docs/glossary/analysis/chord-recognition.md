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

libsonare compares each frame or beat-synchronous chroma summary against a set of chord templates. These cover the four triads — major, minor, diminished, and augmented — as well as richer qualities that add or alter notes: sevenths, ninths, add9, half-diminished, and sus voicings. Beyond those sit the sixth chords (`6`, `m6`), the minor-major seventh (`mM7`), `7sus4`, and the dominant extensions and alterations (`11`, `13`, `7b9`, `7#9`). The result is a best matching root and quality for each region.

Everything outside the four triads must beat the best triad by an extra margin before it is preferred. This keeps noisy chroma from turning plain triads into unstable extensions. There are two margins, not one. The ordinary one is 0.05 of correlation, and it applies to every non-triad quality by default — the sevenths, the ninths, `sus2` and `sus4` (three-note chords, but on the non-triad side of the comparison), and also `6`, `m6` and `7sus4`. The wider one, 0.09, is reserved for the five qualities that add a tension a plainer chord already explains: `mM7`, `11`, `13`, `7b9` and `7#9`.

::: info Why the sixth chords pay a penalty instead of a wider margin
`6`, `m6` and `7sus4` are confusable in an exact way. A `maj6` spells the same four pitch classes as the `m7` a minor third below it; a `m6` spells the same set as the `m7b5` below it; a `7sus4` spells the same set as the `sus2add4` a fourth below. Nothing in a chromagram separates those pairs — only the bass evidence below can — so their templates carry a fixed 0.07 correlation penalty (`kAnagramQualityPenalty`) that makes the established reading the default, and the sixth wins only when the low register names its root. Stacking the wider margin on top of that penalty would put them out of reach of any evidence, which is why they take the ordinary 0.05.
:::

## Triads only, or the full set

`useTriadsOnly` (`use_triads_only` in C++ and Python) picks between two template sets and nothing in between. On, the search covers the four triads over twelve roots — 48 templates. Off, it covers all 24 qualities over twelve roots — 288 templates: the 16 base qualities (`maj`, `m`, `dim`, `aug`, `7`, `maj7`, `m7`, `sus2`, `sus4`, `add9`, `madd9`, `dim7`, `m7b5`, `maj9`, `9`, `sus2add4`) plus the eight `extended_chord_qualities()` adds: `6`, `m6`, `mM7`, `7sus4`, `11`, `13`, `7b9`, `7#9`. There is no "sevenths but not extensions" tier.

The two entry points default differently. `detectChords()` and `ChordConfig` leave it `false`, so the full set is searched; the whole-track `analyze()` / `MusicAnalyzer` sets it `true`, so a seventh chord there comes back as the triad inside it until you pass `useTriadsOnly: false`.

Turning the full set on buys the labels a lead sheet actually uses, at three costs. Every non-triad label has to clear its margin, so borderline sevenths still land as triads and the boundary between the two readings can flicker across a sustained chord. The anagram pairs above become reachable, and on material with no bass part they are decided by the penalty alone. And a passing tone or a strong overtone has 20 more shapes it can push the chroma toward, so dense or distorted mixes pick up more short extension segments for `minDuration` and smoothing to absorb. Triads only is the right choice when you want a stable harmonic outline; the full set is the right choice when the quality is the point.

## Timing and smoothing

The chord detector can run on frame-level chroma or beat-synchronized chroma. Beat sync usually gives musically cleaner changes because chord boundaries often align with beats. Smoothing and minimum-duration merging avoid very short flickering labels.

::: warning `detectChords()` is always frame-level, whatever `useBeatSync` says
Beat synchronization needs a list of beat times, and only the whole-track analysis path (`analyze` / `MusicAnalyzer`) supplies one — it tracks beats first, then hands them to the chord analyzer. The standalone `detectChords()` entry point goes straight from audio to chroma, so it runs frame-level even though `useBeatSync` defaults to `true`. Run the full music analysis when you want beat-aligned chord boundaries.
:::

Optional HMM smoothing (a hidden Markov model, which favors sequences of chords that follow one another plausibly rather than judging each region in isolation) can run over the chord candidates, with optional key context, to further suppress jitter. In streaming mode, chord estimates update over time and should be treated as provisional until enough context accumulates.

The transition model grades cadences rather than scoring them all alike. `V7 -> I` and `v -> i` are the same two scale degrees, so a test that looks only at root motion cannot tell them apart — and it is the dominant's tritone that actually resolves, the strongest harmonic cue there is. A cadence whose dominant carries that tritone is therefore favoured over one spelled with the expected qualities, which in turn is favoured over cadential root motion carrying a quality that does not pull.

## Common confusions

Harmonically close chords share notes, so substitutions happen. C major and A minor 7 share three pitch classes, and a chord plus a passing melody note can look like a richer extension.

Folding twelve pitch classes into one vector is what causes it. A chord and its relative — A and F#m share two of three tones — leave almost the same chroma evidence, and nothing in that vector says which of the shared tones is the root.

The bass register carries exactly that cue, so the recogniser adds a low-register salience term to each template's score: a candidate whose root the bass sounds is preferred. Two things about how it is applied matter more than the term itself.

- **It is a tie-breaker, not an override.** The bass names the root only in root position. A weight large enough to overturn a clear chroma decision would relabel every inversion after its own bass note, which is worse than the confusion it fixes.
- **It measures what the low register *adds*, not what it says on its own.** The candidate root's share of the low-register energy has the same share taken over the harmonic chroma subtracted from it, leaving only the part of the bass evidence the chroma did not already carry. On material with no bass part the low-register chromagram is a scaled copy of the harmonic one, the two shares cancel, and the term decides nothing rather than nominating whichever pitch class the leakage happened to favour.

Expect occasional swaps between neighboring chords. Recognition is strongest on clean, sustained material and weakest on dense or distorted mixes, where overtones blur the chroma the templates read.

::: details How libsonare computes it
`ChordAnalyzer` builds STFT or NNLS chroma, takes `generate_triad_templates()` or `generate_all_chord_templates()` according to `use_triads_only`, scores templates by correlation plus the low-register root term (`bass_root_weight`, C++ only; 0 disables it), prefers triads unless a non-triad template clears its margin — `kTetradThreshold` 0.05 by default, `kExtendedQualityThreshold` 0.09 for `mM7`, `11`, `13`, `7b9` and `7#9` — and merges short segments below `minDuration`. Defaults include `minDuration = 0.3`, `smoothingWindow = 2.0`, `threshold = 0.5`, `nFft = 2048`, `hopLength = 512`, and `useBeatSync = true` — the last of which is honored only by the constructor that receives beat times, so it has no effect on `detectChords()`. Public bindings expose chord roots, qualities, timing, confidence, and optional inversion/key/HMM options depending on the binding.
:::

Related: [Chroma Features](./chroma-features.md), [Key Detection](./key-detection.md), [Beats and Downbeats](./beats-downbeats.md)
