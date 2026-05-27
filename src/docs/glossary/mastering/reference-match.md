---
title: Reference Match
description: How to use a finished release as a calibration target without copying it blindly.
---

# Reference Match

Reference Match compares your source against a finished release and uses that comparison to guide tone and loudness decisions.

A reference is not a magic "make mine sound like this" button. It is a calibration tool. The goal is to notice whether your master is too dark, too bright, too narrow, too dense, or too quiet for the style you are aiming at.

::: warning A reference calibrates; it does not transplant
Forcing a sparse track toward a dense commercial master throws off not just EQ but the dynamics and stereo decisions that follow. If the match makes the track lose its own identity, the match strength is too high — lower it or use the reference for tonal comparison only.
:::

## What It Is For

Use Reference Match when you have a target release that is close to your track in arrangement, genre, density, and delivery context.

Good uses:

- Checking whether the low end is in the same ballpark.
- Comparing brightness without relying on memory.
- Spotting an overly narrow or overly wide stereo image.
- Testing whether your loudness target is realistic for the material.

Poor uses:

- Forcing a sparse acoustic track to match a dense EDM master.
- Copying a reference EQ curve without listening.
- Treating a mastered commercial release as a guarantee that your mix is ready.

## Workflow

1. Load your source and render a first master.
2. Drop a reference track into the Reference panel.
3. Compare crest factor, peak level, and stereo correlation.
4. Use Match Reference EQ only as a starting point.
5. Re-listen with loudness matching enabled.
6. Undo the move mentally if the track loses its own musical identity.

## Signs to Back Off

If the master sounds closer to the reference but loses the vocal distance, low-end groove, or arrangement space that defined the original track, the match strength is too high. A reference is a coordinate to navigate by, not a destination to copy.

References that differ from the source in genre or density are especially risky. Forcing a sparse track toward a dense commercial master can throw off not only EQ but also the dynamics and stereo decisions that follow. In those cases it is safer to swap the reference, lower the match strength, or use the reference only for tonal comparison.

## What The Demo Does

The browser demo uses the reference file locally. It does not upload either file.

When you choose reference matching, the worker compares source and reference channels and applies a constrained match-EQ process. The match is intentionally limited: it uses smoothing and a maximum gain range so the result behaves like a mastering adjustment rather than a brittle spectral copy.

:::: details Implementation notes

The worker trims the source and reference to a shared duration, then runs `match.applyMatchEq` for left and right channels. The current demo uses a maximum match gain of 6 dB and 5 smoothing bins. Those limits matter because a raw spectral difference curve can contain narrow notches and spikes that are not musically useful.

The operation compares one source file with one reference file, so sample rate matters.

If the reference sample rate differs from the source, the composable linearly resamples the reference before sending it to the worker. That is accurate enough for analysis alignment in the demo. Final mastering still happens through the normal libsonare chain.

The match result is also stored as metrics in the report, so it can guide manual EQ adjustments in Studio mode.

::::

Related: [Reference Track](../concepts/reference-track.md), [A/B Comparison](../ab-comparison.md), [Tone and Air Controls](./tone-air.md)
