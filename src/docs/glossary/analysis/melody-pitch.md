---
title: Melody and Pitch
description: Fundamental frequency (F0), pitch tracking, YIN and pYIN, monophonic vs polyphonic, and voicing — how libsonare follows the melody line.
---

# Melody and Pitch

**Pitch tracking** follows the fundamental frequency of a sound over time. It is the backbone of melody extraction, vocal tuning checks, and transcription-style workflows.

Unlike [chroma](./chroma-features.md), which folds octaves away, pitch tracking keeps the exact frequency. This page expands the pitch section of [MIR Overview](../concepts/mir-overview.md).

## Fundamental frequency (F0)

A pitched sound has a periodic waveform and often a series of spectral **partials**. The **fundamental frequency (F0)** is the frequency that governs that periodicity and, for harmonic sounds, the spacing between partials. F0 may be absent as a spectral component while still determining perceived pitch; this is the missing fundamental. Inharmonic sounds such as bells and cymbals can have partials without a single well-defined F0. For voices and for bowed or blown instruments, partials often sit near integer multiples of F0, so they are called harmonics.

For example, when a singer holds A4, the F0 is 440 Hz. The recording often contains energy near 880 Hz, 1320 Hz, and other multiples.

The pitch you *perceive* generally corresponds to F0. That is why pitch tracking is really **F0 estimation** over time. The task is to infer the waveform's periodicity rather than choose the lowest or loudest spectral peak.

::: tip The integer-multiple picture has two limits
Stiff strings are progressively sharp of the ideal series — a piano's upper partials land tens of cents above exact multiples — and struck idiophones such as bells, cymbals, and drums have partials with no integer relation and often no well-defined F0 at all. A pitched sound can still have a perceptual F0 when its F0 component is missing from the spectrum. The lowest or loudest observed peak is therefore not a reliable F0 rule; the estimators below infer F0 from waveform periodicity instead of selecting a spectral maximum.
:::

## YIN and pYIN

libsonare offers two related estimators:

- **YIN** finds F0 in the time domain using a difference function: it looks for the lag at which the waveform best repeats itself, then converts that period to frequency. It is accurate and cheap for clean monophonic audio.
- **pYIN** (probabilistic YIN) wraps YIN in a probabilistic model that tracks multiple F0 candidates over time and also estimates **voicing** — whether a frame is pitched at all. That makes it more robust on real recordings, where silences, breaths, and noise would otherwise produce spurious pitches.

## Monophonic vs polyphonic

These estimators assume **monophonic** input: one note at a time, such as a solo voice, lead line, or bass.

::: warning Bass needs a lower `fmin` than the default
`fmin` defaults to 65 Hz (C2) and `fmax` to 2093 Hz (C7), so out of the box the trackers cover roughly C2–C7. An open low E on an electric bass is 41.2 Hz and a five-string low B is 30.9 Hz — both below the search range, so they come back as a harmonic or pinned to the range edge. Lower `fmin` explicitly for bass work, and lengthen `frameLength` to match: the YIN lag search is capped at half the frame, so a 2048-sample frame at 44.1 kHz cannot resolve anything under about 43 Hz however low you set `fmin`.
:::

These estimators are also not chord transcribers. If you feed them a full mix or a chord, the single-F0 assumption breaks down.

To track a melody inside a busy track, isolate the line first with a stem, [HPSS](./mel-mfcc-timbre.md) (harmonic/percussive separation), or source separation. Then run pitch tracking on the cleaner signal.

## Voicing: when there is no pitch

Not every frame has a pitch. Rests, unvoiced consonants ("s", "t"), and percussion have no clear F0. A naive tracker will still report some number for these frames, producing a jumpy, meaningless line. Voicing detection, which pYIN is designed to provide, marks those frames as unpitched so the melody line has gaps where the music does.

pYIN returns that decision twice over, and the two are not interchangeable. `voiced` is the Viterbi path's voiced/unvoiced state — the decision itself, and what a consumer should gate on.

::: warning `voicedProb` rises with pitch, not with confidence
`voicedProb` is not a signal-quality confidence. It is the frame's voiced observation *mass*: the summed probability of its voiced pitch hypotheses. That mass depends on how many periods of the pitch fit inside the analysis frame, because the difference-function troughs of a long period measured over a short frame are shallower. For a fixed frame length it therefore climbs with F0 even when the signal is identical — a steady three-harmonic tone at 2048 samples / 48 kHz averages well under 0.1 at C2 and around 0.5 at C5, with every frame flagged voiced throughout.

Two consequences follow:

- a fixed threshold on it silently returns no note segments at all for low-register material. Pass the `voiced` flags as 0.0/1.0 instead, or lower `voicedThreshold` (default 0.5);
- it is not a correction weight. Time-varying pitch correction does not scale its per-frame correction amount by it — it reads the value only to derive voicing when no explicit `voiced` array is supplied, so passing one alongside `voiced` changes nothing.
:::

<SonareDemo id="melody-contour" />

::: details How libsonare tracks pitch
libsonare implements YIN and pYIN for F0 estimation on monophonic audio. `analyzeMelody` / `MelodyAnalyzer` uses frame-by-frame YIN frequency and confidence, then computes mean frequency, pitch range, stability, and a simple vibrato-rate estimate. Lower-level `pitchYin` / `pitchPyin` APIs expose YIN and pYIN tracks directly. Results can be converted to MIDI note numbers for tuning and editing workflows. Pitch tracking is most reliable on isolated, clearly pitched material and degrades on polyphonic or noisy mixes.
:::

Related: [Chroma Features](./chroma-features.md), [Mel, MFCC, and Timbre](./mel-mfcc-timbre.md), [Editing Basics](../concepts/editing-basics.md), [MIR Overview](../concepts/mir-overview.md)
