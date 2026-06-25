---
title: Time Stretch and Pitch Shift
description: The phase vocoder, resampling, the time/pitch trade, and why large moves create artifacts — how libsonare changes duration and pitch independently.
---

# Time Stretch and Pitch Shift

Speeding up a tape changes pitch *and* duration together. Modern editing DSP separates them.

| Operation | What changes | What should stay stable |
|-----------|--------------|--------------------------|
| **Time stretch** | Length | Pitch |
| **Pitch shift** | Pitch | Length |

This page explains the machinery behind that separation and grounds it in libsonare's stretch backend. For the vocabulary first, read [Editing Basics](../concepts/editing-basics.md).

## The phase vocoder

The core tool is the **phase vocoder**.

At a high level, it does three things:

1. Run an STFT to split audio into short time-frequency frames.
2. Resample those frames along the time axis, changing how quickly they advance.
3. Rebuild phase so partials stay continuous instead of smearing.

The hard part is **phase coherence**. The STFT splits each frame into frequency *bins* — one slot per narrow band of frequencies. When frames are spaced differently than they were analyzed, the phase in each bin has to be re-propagated so the individual frequency components (the *partials* that make up the sound) stay continuous. If that goes wrong, you hear the classic "phasey" or metallic artifact.

## Two operations, one backend

| Operation | Changes | Keeps | How |
|-----------|---------|-------|-----|
| Time stretch | Duration | Pitch | Phase vocoder rescales the time axis |
| Pitch shift | Pitch | Duration | Time-stretch by a ratio, then resample back to the original length |

This is why pitch shift and time stretch share a backend: a pitch shift is a time stretch followed by resampling. `rate > 1.0` shortens a clip; `semitones = 12` shifts up an octave.

<SonareDemo id="time-stretch" />

<SonareDemo id="pitch-shift" />

## Why large moves create artifacts

Both operations invent or discard information.

| Edit | What can go wrong |
|------|-------------------|
| Stretch a sound to twice its length | Much of the new audio is synthesized from phase assumptions |
| Shift a voice up a fifth | Formants move too unless corrected |
| Make a large transient edit | Attacks can soften or smear |

Small moves stay transparent because the assumptions still hold. Large moves expose the assumptions as smearing, transient softening, or a "chipmunk" timbre.

Practical rule: keep edits conservative for natural results, and treat big moves as deliberate creative effects.

::: details How libsonare implements stretching
libsonare's `timeStretch` and `pitchShift` sit on a phase-vocoder core (`phase_vocoder`) combined with resampling for the pitch axis, selected through a `StretchBackend`. A pitch shift is implemented as a time-stretch by the pitch ratio followed by a resample back to the original duration. The same core underlies `noteStretch` (region-bounded stretching) and the pitch path of `voiceChange`. All operate on decoded mono `Float32Array` / sample sequences; quality degrades gracefully with the size of the move, so conservative ratios stay artifact-free.
:::

Related: [Editing Basics](../concepts/editing-basics.md), [Pitch Correction](./pitch-correction.md), [Voice and Formant](./voice-formant.md), [Editing DSP](../../editing-dsp.md)
