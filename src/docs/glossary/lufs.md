---
title: LUFS
description: Loudness Units relative to Full Scale for mastering and streaming targets.
---

# LUFS

LUFS measures perceived loudness. It is more useful for mastering than raw peak level because it approximates how loud audio feels over time.
Two tracks can have the same peak value while one feels much louder because it is denser for more of its duration. LUFS is the meter that helps describe that difference.

| Target | Common Use |
|--------|------------|
| -14 LUFS | General streaming music targets such as Spotify and YouTube. |
| -16 LUFS | Speech, podcasts, Apple-oriented targets, and more dynamic music. |
| -12 LUFS | Louder dance or club-style masters where density is intentional. |

## Why It Matters

If two masters are compared without matching loudness, the louder one usually sounds better at first. This is why the `/mastering` demo enables loudness-matched A/B playback by default.

Loudness is only one delivery constraint. A master also needs enough [True Peak Safety](./concepts/true-peak-safety.md), and its [Dynamic Range](./concepts/dynamic-range.md) should fit the musical intent.

<SonareDemo id="loudness-meter" />

## Choosing a Target

If you are unsure, start at -14 LUFS. It is a practical target for many music and video platforms, and it usually does not require crushing the limiter to reach.

Speech and podcasts often work better with a little more room, such as -16 LUFS, because intelligibility and comfort matter more than maximum density. Dance and club-style masters may sit closer to -12 LUFS, but only when the low end remains controlled, the true peak ceiling is safe, and the result is not fatiguing.

When a streaming platform applies its own normalization, masters that overshoot the target are simply turned down on playback. Overshooting therefore does not always give you a loudness win — a master driven hard into a deep limiter can end up with the same playback loudness as a gentler one, just with less punch left after the platform pulls it down.

## Do Not Chase the Number

Hitting a LUFS target is not sufficient evidence that the master is good. A master can land on the target while the limiter has crushed transients, the low end has thinned, or the sibilants have started to bite.

The opposite is also true: for some material, sitting a little below the target sounds more natural. For acoustic, speech, and sparse music, loudness-matched A/B and cross-environment checks are usually more informative than chasing the last decibel.

:::: details Implementation notes

libsonare's loudness measurement follows the gated integrated LUFS model defined by ITU-R BS.1770 and the EBU R128 family of recommendations. Target LUFS and limiter ceiling are kept as separate decisions: the LUFS target controls perceived integrated level, while the ceiling controls the maximum sample or true peak level.

Keeping them separate makes it possible to distinguish useful states: a master can be loud enough but peak-unsafe, or peak-safe but still below the target. The demo report therefore exposes input LUFS, output LUFS, and applied gain separately.

::::

Related: [A/B comparison](./ab-comparison.md), [True Peak](./true-peak.md), [Dynamic Range](./concepts/dynamic-range.md)
