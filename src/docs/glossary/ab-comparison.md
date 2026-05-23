---
title: A/B Loudness Matching
description: How to compare source and mastered audio without volume bias.
---

# A/B Loudness Matching

A/B comparison switches between source and processed audio. Loudness matching lowers the louder side so the comparison is based on tone, dynamics, width, and peak behavior rather than simple volume.

For a deeper explanation of the listening bias and when to disable matching, see [Loudness Matching](./concepts/loudness-matching.md).

## Recommended Workflow

1. Render the master.
2. Keep Match loudness enabled.
3. Switch between Before and After while listening to the same section.
4. Disable Match loudness only when checking final delivery level.

## What to Listen For

Do not ask only whether the master is louder. Ask whether the problems are smaller. Check whether the low end is steadier, the vocal or lead part is easier to follow, cymbals and sibilants remain comfortable, and the loudest chorus is not being pinned by the limiter.

Avoid judging from one short loop. The intro, loudest chorus, bass-heavy section, and near-silent parts can reveal different side effects. Denoise, exciter, and stereo width changes are especially easy to overdo in quiet passages or on headphones.

## When to Disable Matching

Loudness matching is a decision aid, not the final delivery check. Disable it when verifying the actual exported level, the true peak ceiling, and the WAV file that will be delivered.

Cross-environment checks follow the same logic. Phone speakers, cheap earbuds, car stereos, and low-volume playback are easier to judge with matching off, because translation issues are about absolute loudness, low-end balance, and sibilance — not the comparison fairness that matching exists to enforce.

:::: details Implementation notes

The demo compares input LUFS and output LUFS after rendering, then applies playback gain to the louder side during A/B playback. It does not rewrite either audio file for comparison.

That is enough for listening decisions, but it does not alter the exported master. Exported LUFS and true peak are produced by the mastering chain itself and reported separately.

::::

Related: [Loudness Matching](./concepts/loudness-matching.md), [LUFS](./lufs.md), [Mastering](./mastering.md)
