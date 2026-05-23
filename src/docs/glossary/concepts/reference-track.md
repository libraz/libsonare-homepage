---
title: Reference Track
description: How to use a reference track without blindly copying another master.
---

# Reference Track

A reference track is a finished song or master used as a comparison point. It helps answer a practical question: "What should this feel like when it is done?"

References are useful because memory is unreliable. After working on a track for a while, the current sound starts to feel normal. A reference gives you an external anchor for loudness, brightness, low-end balance, stereo width, vocal presence, and density.

## What A Reference Is For

A good reference is not a target to copy exactly. It is a calibrated comparison.

Use it to notice broad differences:

| Area | Useful question |
|------|-----------------|
| Loudness | Is my master in the same practical range, or only louder in the room? |
| Low end | Is the bass controlled, or does it blur the groove? |
| Midrange | Are vocals and lead elements stable enough? |
| High end | Is the top end open, harsh, or dull? |
| Stereo | Is the width helping the track, or weakening mono focus? |
| Density | Does the master feel finished without crushing movement? |

The reference should match the intended style, arrangement density, and release context. A sparse acoustic track should not be forced to behave like a dense dance master.

## Common Mistakes

The most common mistake is comparing references without matching loudness. A commercial reference may be louder or denser than your mix, and that can make it seem better for the wrong reason.

Another mistake is choosing a reference with a different arrangement. If the reference has fewer instruments, a brighter vocal, or a different bass role, copying its spectral shape may make your track worse.

Use references to guide decisions, not to erase the identity of the source.

## Reference Match EQ

Reference Match EQ compares the spectrum of the source and reference, then applies a limited EQ curve to move the source closer. This can be useful for learning and for gentle tonal alignment.

It should be constrained. Large match-EQ moves often indicate that the source mix is fundamentally different from the reference. In that case, broad manual EQ or mix revision is usually safer than exact matching.

## In The libsonare Demo

The demo lets you load a reference track for comparison. It displays basic reference metrics and can run Reference Match EQ through the local WebAssembly worker.

The match operation is intentionally limited. It uses smoothing and maximum gain limits so the result stays closer to a mastering move than a brittle copy of the reference spectrum.

:::: details Implementation notes

Reference files are decoded locally in the browser just like the source file. If the reference sample rate differs from the source sample rate, the composable resamples the reference before sending both buffers to the worker.

The match-EQ path compares source and reference spectra per channel, applies smoothing, then constrains the maximum gain change. This is deliberate: raw spectral differences contain narrow spikes and notches that are usually not useful mastering moves.

::::

Related: [Loudness Matching](./loudness-matching.md), [Dynamic Range](./dynamic-range.md), [Mono Compatibility](./mono-compatibility.md), [LUFS](../lufs.md)
