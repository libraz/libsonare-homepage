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

Relative pairs such as C major and A minor share all seven notes, so a chroma profile can easily prefer the wrong one — and that mistake moves the tonic as well as the mode. Mode-only confusion comes from the *parallel* pair instead (C major vs C minor), which shares only four of its seven scale degrees. The two are worth separating when you judge results: a relative swap means the profile match landed on the wrong rotation, a parallel swap means the major/minor evidence was weak.

## From chroma to key

Key detection starts from a mean chroma vector: the 12 pitch-class bins are averaged over the material, optionally after preparation such as [HPSS](../../source-separation.md) (which suppresses percussion so harmony reads more cleanly), loudness weighting, or high-pass filtering. libsonare compares that vector with rotated key profiles for each candidate root and mode.

A key profile is a 12-number template of how strongly each pitch class is expected to appear in a given key. The default profile is Krumhansl-Schmuckler, a classic set of reference pitch-class weights derived from listener experiments. The implementation can also use other profile families (Shaath, Faraldo EDM variants, Bellman-Budge, and Temperley), each tuned for different material; `genreHint` can steer the choice, and `auto` keeps the historical behavior unless another profile has clearly stronger evidence.

The candidate set is the 24 major and minor keys by default. `modes` widens it to the five church modes (`'modal'`) or to all seven (`'all'`).

::: warning The modal profiles do not have the standing the major/minor ones do
Every major and minor profile above is a published one, derived from listening experiments or from a corpus. The five modal profiles (Dorian, Phrygian, Lydian, Mixolydian, Locrian) are not: they are a stated construction in the same shape, built from six named weights that put the tonic highest, then its fifth and third, then the degree that separates the mode from its major or minor neighbour, then the remaining scale tones, with everything outside the scale suppressed. The ordering is what carries the meaning; the exact numbers only place each weight between its neighbours. No probe-tone study or annotated corpus stands behind them, so read a modal result as a plausible heuristic rather than as a measurement — see the [FAQ](../../faq.md) for the full account.
:::

<SonareDemo id="chromagram" />

## Confidence is relative

`Key.confidence` is a **softmax over the profile correlation of every candidate that was scored**. That shape, not a rule of thumb, is what the number means, and four consequences follow from it directly:

- it lands in `[0, 1)`, and the confidences of one analysis sum to 1;
- a share of 24 candidates cannot reach 1, so a value here is not comparable with one from a two-way decision;
- two keys splitting the same evidence — a relative major and minor, typically — each report about half;
- on silence every candidate reports the same small share, because nothing separates them.

::: warning Confidence is a belief, not an accuracy
It says how decisively the chroma picked one candidate out of the set. It does not say how often that pick is right: nothing here is calibrated against annotated recordings, so a confident wrong answer is entirely possible. A pipeline that branches on the value has to pick its own threshold against its own material.
:::

### Reading the number

The softmax has a fixed temperature, `kConfidenceTemperature` = 0.08 of correlation. At that gap the winner outweighs the runner-up by a factor of *e*; at twice it by about 7:1; at a 0.2 gap by about 12:1. Two things follow. Only the *gaps* between candidates matter: the best correlation is subtracted from every candidate before exponentiating, so a winning correlation of 0.9 and one of 0.2 report the same confidence if the field behind them has the same shape. And with 24 candidates the value is dominated by the runner-up: once everything else is far behind, the confidence is close to 1 / (1 + *e*^(−gap / 0.08)), so a 0.2 lead reads about 0.92 whether the input was a whole song or four bars.

That is why a short or thin excerpt can read high. A few sustained notes correlate weakly with every profile — nothing fits well — but one profile still fits less badly than the rest, and the softmax reports that lead as belief. The blend this replaced put half its weight on the winner's own correlation and could not read high without a good absolute fit; it survives as `evidence_score()` (C++ only), which is what the analyzer compares when choosing between chroma front-ends, because a posterior mechanically shrinks as the candidate set widens whether or not the evidence changed, and a margin does not. For the absolute fit read `KeyCandidate.correlation`, which stays the raw value the softmax was computed from.

Use the confidence to rank candidates within one analysis, to show how divided the decision is, and to flag relative-key ambiguity — two entries near 0.5. Do not use it to say how well the track fits its key at all (that is the correlation), to compare analyses that scored different candidate sets (`modes` changes the denominator), or as an accuracy: nothing here is calibrated.

Confidence is also not proof that the track has one unambiguous key. Modal mixture (borrowing chords from the parallel major or minor), key changes, sparse arrangements, heavy percussion, or detuned material can all lower it or make neighboring keys plausible.

Use `detectKeyCandidates` when the runner-up matters. For UI, showing the top candidate plus confidence is usually better than treating the key as a fixed label.

::: details How libsonare computes it
`KeyAnalyzer` computes chroma with default `n_fft = 4096` and `hop_length = 512`, then scores root/mode candidates by profile correlation. `assign_posterior_confidences` subtracts the best correlation from each, divides by `kConfidenceTemperature`, exponentiates and normalizes; `evidence_score()` is half the winner's rescaled correlation plus half its gap over the runner-up capped at `kFullDistinctivenessGap` (0.2). Options can enable harmonic HPSS input, RMS loudness weighting, a high-pass cutoff, explicit candidate modes, and genre/profile hints. `estimate_key_from_chords` and `refine_key_with_chords` provide chord-progression-aware helpers in the native layer — they report the progression's diatonic share in the `confidence` field rather than the softmax posterior described above — while the JS/Python detection helpers expose chroma-profile key estimates and candidate lists.
:::

Related: [Chroma Features](./chroma-features.md), [Chord Recognition](./chord-recognition.md), [MIR Overview](../concepts/mir-overview.md)
