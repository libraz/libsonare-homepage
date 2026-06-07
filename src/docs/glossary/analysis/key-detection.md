---
title: Key Detection
description: Tonal center, major/minor mode, chroma profiles, and confidence — how libsonare estimates the key of a track.
---

# Key Detection

**Key detection** estimates the tonal center of a track: the root pitch class and mode, such as C major or A minor. In libsonare this is a chroma-based estimate, so it is best read as "which pitch-class profile best explains the audio" rather than a human music-theory judgment.

## Tonic and mode

A key has two parts:

| Part | Meaning |
|------|---------|
| Tonic | The pitch class that feels like home, such as the "A" in A minor |
| Mode | The interval pattern built on that tonic, usually major or minor |

Major usually sounds bright and resolved. Minor usually sounds darker.

Twelve tonics times two common modes gives 24 candidate keys. Naming a key means choosing the tonic-and-mode pair that best fits which notes the track emphasizes.

Relative pairs such as C major and A minor share the same seven notes, so mode is often the easier half to get wrong.

## From chroma to key

Key detection starts from a mean chroma vector: the 12 pitch-class bins are averaged over the material, optionally after preparation such as HPSS, loudness weighting, or high-pass filtering. libsonare compares that vector with rotated key profiles for each candidate root and mode.

The default compatible profile is Krumhansl-Schmuckler. The implementation can also use profile families such as Shaath, Faraldo EDM variants, Bellman-Budge, and Temperley; `genreHint` can steer the choice, and `auto` keeps the historical behavior unless another profile has clearly stronger evidence.

<SonareDemo id="chromagram" />

## Confidence is relative

The confidence value reflects how strongly the best profile wins against alternatives. It is not proof that the track has one unambiguous key. Modal mixture, key changes, sparse arrangements, heavy percussion, or detuned material can all lower confidence or make neighboring keys plausible.

Use `detectKeyCandidates` when the runner-up matters. For UI, showing the top candidate plus confidence is usually better than treating the key as a fixed label.

::: details How libsonare computes it
`KeyAnalyzer` computes chroma with default `n_fft = 4096` and `hop_length = 512`, then scores root/mode candidates by profile correlation. Options can enable harmonic HPSS input, RMS loudness weighting, a high-pass cutoff, explicit candidate modes, and genre/profile hints. `estimate_key_from_chords` and `refine_key_with_chords` provide chord-progression-aware helpers in the native layer, while the JS/Python detection helpers expose chroma-profile key estimates and candidate lists.
:::

Related: [Chroma Features](./chroma-features.md), [Chord Recognition](./chord-recognition.md), [MIR Overview](../concepts/mir-overview.md)
