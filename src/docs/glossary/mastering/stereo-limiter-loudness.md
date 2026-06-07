---
title: Stereo, Limiter, and Loudness Controls
description: How width, true-peak limiting, loudness target, and output rendering finish the master.
---

# Stereo, Limiter, and Loudness Controls

The final part of the mastering chain decides how wide the master feels, how safely peaks are controlled, and where the rendered file lands in loudness.

These controls should be judged together. A wider master can change peak behavior. A louder target can force the limiter harder. A lower ceiling can protect codec conversion but may reduce available loudness.

## Stereo Width

Stereo Width adjusts side energy. Wider settings can make a master feel larger, but they can weaken mono compatibility or make low frequencies unstable.

Use loudness-matched A/B and check correlation. For speech, keep width conservative.

The most reliable warning sign is the mono check: if the core of the vocal, kick, bass, or snare thins out when you collapse to mono, back off. A setting that sounds impressive in stereo but hollows out the center is not a mastering improvement — it is a balance shift in disguise.

::: warning Always check width in mono
Collapse to mono before committing to a width setting. If the center cores thin out, the width is too high. The limiter is your last safety net, not a density tool — if it is working deep at all times, fix the low end, compressor, and input gain earlier in the chain instead of raising the ceiling.
:::

## True Peak Limiter

The True Peak Limiter catches peaks that can appear between digital samples after reconstruction or codec conversion. Limiter Ceiling is the final safety limit, commonly around `-1 dBTP` for streaming-style delivery.

If the limiter is working deep at all times, do not solve it by relaxing the ceiling first. Revisit the low-end balance, the compressor, and input gain earlier in the chain. The limiter is the last safety net, not the main density tool for the mix.

## Lookahead and True Peak Safety

Lookahead lets the limiter see fast peaks before they reach the output. A few milliseconds is usually enough for offline rendering. Too little can distort sharp peaks; too much increases latency and can soften impact.

## Loudness Target

The Loudness Target is the integrated LUFS goal for the rendered file. The demo uses common platform-style targets such as `-14 LUFS` and `-16 LUFS`, plus a custom target.

## Output Render

The browser demo renders locally and exports stereo 16-bit PCM WAV plus a JSON report. Audio is not uploaded.

:::: details Implementation notes

libsonare's stereo imager uses mid/side processing with energy preservation and optional decorrelation.

The true-peak limiter uses lookahead, linked peak detection, and an oversampled true-peak path.

The loudness optimizer measures the rendered signal, computes the gain needed to reach the LUFS target, and caps that gain against the true-peak ceiling.

The demo defaults to 4x true-peak handling and reports the executed stage names in the JSON export, so the final chain is auditable.

When the ceiling and the LUFS target conflict, the design favors peak safety. A state like "the LUFS target was missed but the true-peak limit was reached" is possible.

That state is identifiable from the report's applied gain and output LUFS values.

::::

Related: [True Peak](../true-peak.md), [True Peak Safety](../concepts/true-peak-safety.md), [Loudness Matching](../concepts/loudness-matching.md), [Mono Compatibility](../concepts/mono-compatibility.md)
