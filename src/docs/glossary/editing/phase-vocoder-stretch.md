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

1. Run an STFT (short-time Fourier transform) to split audio into short time-frequency frames.
2. Read spectral frames at positions corresponding to the new timeline, interpolating where needed.
3. Estimate each bin's phase advance from consecutive analysis frames and accumulate it on the output timeline.

Step 1 uses the same STFT principle as spectral analysis, though individual features can choose different window and hop settings. [Spectrogram and STFT](../analysis/spectrogram-stft.md) illustrates how frames are cut.

The hard part is **phase coherence**. The STFT splits each frame into frequency *bins* — one slot per narrow band of frequencies. When frames are spaced differently than they were analyzed, the phase in each bin has to be re-propagated so the individual frequency components (the *partials* that make up the sound) stay continuous. If that goes wrong, you hear the classic "phasey" or metallic artifact.

The output reads spectral frames along a new time axis. For example, a slower read spreads the changing spectrum over more output frames. It does not shorten audio by dropping waveform slices or lengthen it by duplicating them: estimated phase advances keep each frequency component moving continuously between synthesized frames.

## Two operations, one backend

| Operation | Changes | Keeps | How |
|-----------|---------|-------|-----|
| Time stretch | Duration | Pitch | Phase vocoder rescales the time axis |
| Pitch shift | Pitch | Approximate duration | Time-stretch at the reciprocal pitch ratio, then resample at the shifted rate |

This is why pitch shift and time stretch share a backend: a pitch shift is a time stretch followed by resampling. `rate > 1.0` shortens a clip; `semitones = 12` shifts up an octave.

To picture a shift up a semitone: use a stretch rate of `1 / 2^(1/12)` to make the audio slightly longer, then resample it at roughly `2^(1/12)` times the original rate. Rounding in the resampling step can leave a small sample-count difference.

<SonareDemo id="time-stretch" />

<SonareDemo id="pitch-shift" />

## Why large moves create artifacts

Both operations invent or discard information.

| Edit | What can go wrong |
|------|-------------------|
| Stretch a sound to twice its length | Much of the new audio is synthesized from phase assumptions |
| Shift a voice up a fifth | Formants move too unless corrected |
| Make a large transient edit | Attacks can soften or smear |

Small moves stay transparent because the assumptions still hold. Large moves expose the assumptions as smearing, transient softening — a transient being the sharp attack at the start of a note or a drum hit — or a "chipmunk" timbre.

Practical rule: keep edits conservative for natural results, and treat big moves as deliberate creative effects.

::: details How libsonare implements stretching
libsonare's default `NativeSpectral` backend uses a *peak-locked* phase vocoder (`phase_vocoder_phaselocked`), with resampling for pitch changes. Peak locking keeps bins near a spectral peak phase-consistent and can reduce phasey artifacts. A plain `phase_vocoder` is also available through the C++ backend choice; the JavaScript and Python entry points use the native spectral path. For an upward pitch ratio `R`, pitch shift first stretches at rate `1/R`, then resamples at the effective rate `sampleRate × R`. `noteStretch` and the pitch path of `voiceChange` also use spectral editing. These functions operate on decoded mono samples.

Artifacts depend on the source and stretch ratio. Transients and dense mixtures can be more sensitive than sustained tones, even for small edits. The configured STFT window and hop also affect the result; a passage that must stay bit-exact should bypass the stretcher.
:::

Related: [Editing Basics](../concepts/editing-basics.md), [Pitch Correction](./pitch-correction.md), [Voice and Formant](./voice-formant.md), [Editing DSP](../../editing-dsp.md)
