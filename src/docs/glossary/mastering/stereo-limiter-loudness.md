---
title: Stereo, Limiter, and Loudness Controls
description: How width, true-peak limiting, loudness target, and output rendering finish the master.
---

# Stereo, Limiter, and Loudness Controls

The final part of the mastering chain decides how wide the master feels, how safely peaks are controlled, and where the rendered file lands in loudness.

These controls should be judged together. A wider master can change peak behavior. A louder target can force the limiter harder. A lower ceiling can protect codec conversion but may reduce available loudness.

<SonareDemo id="loudness-meter" />

## Stereo Width

Stereo Width adjusts side energy. Wider settings can make a master feel larger, but they can weaken mono compatibility or make low frequencies unstable.

Use loudness-matched A/B and check correlation. For speech, keep width conservative.

Width changes also move the overall level. The energy compensation applied with the width change is a fixed, signal-independent gain, so it only cancels out on material whose mid and side energy happen to be equal — and in a normal mix the side is far quieter than the mid. Re-check loudness after moving Stereo Width instead of assuming the level held.

The most reliable warning sign is the mono check: if the core of the vocal, kick, bass, or snare thins out when you collapse to mono, back off. A setting that sounds impressive in stereo but hollows out the center is not a mastering improvement — it is a balance shift in disguise.

::: warning Always check width in mono
Collapse to mono before committing to a width setting. If the center cores thin out, the width is too high. The limiter is your last safety net, not a density tool — if it is working deep at all times, fix the low end, compressor, and input gain earlier in the chain instead of raising the ceiling.
:::

## True Peak Limiter

The True Peak Limiter catches peaks that can appear between digital samples after reconstruction or codec conversion. Limiter Ceiling is the final safety limit, commonly around `-1 dBTP` for streaming-style delivery — dBTP means decibels true peak, the peak measured between samples rather than at the sample points.

If the limiter is working deep at all times, do not solve it by relaxing the ceiling first. Revisit the low-end balance, the compressor, and input gain earlier in the chain. The limiter is the last safety net, not the main density tool for the mix.

## Lookahead and True Peak Safety

Lookahead lets the limiter see fast peaks before they reach the output. A few milliseconds is usually enough for offline rendering. Too little can distort sharp peaks; too much increases latency and can soften impact.

## Loudness Target

The Loudness Target is the integrated [LUFS](../lufs.md) (Loudness Units relative to Full Scale) goal for the rendered file — a *gated* average across the whole track, so silence and the quietest passages are excluded before the mean is taken. The demo uses common platform-style targets such as `-14 LUFS` and `-16 LUFS`, plus a custom target.

## Output Render

The browser demo renders locally and exports stereo 16-bit PCM WAV plus a JSON report. Audio is not uploaded.

:::: details Implementation notes

libsonare's stereo imager uses mid/side processing: it splits the stereo signal into a "mid" part (what is common to both channels, the center) and a "side" part (what differs between them, the width), then adjusts the side level. This is the mechanism behind the side energy that Stereo Width controls. Decorrelation is available as an option on top of it.

Energy compensation, when enabled, multiplies both mid and side by `sqrt(2 / (1 + width^2))`. That gain is derived from the width setting alone and never from the current samples, which keeps the stage linear and free of intermodulation products — but it holds total energy constant only under the assumption that mid and side carry equal power. Programme material rarely does, so widening still lowers the level a little and narrowing raises it.

The true-peak limiter uses lookahead, linked peak detection, and an oversampled true-peak path.

The loudness optimizer measures the rendered signal, computes the gain needed to reach the LUFS target, and caps that gain against the true-peak ceiling.

The demo defaults to 4x true-peak handling and reports the executed stage names in the JSON export, so the final chain is auditable.

When the ceiling and the LUFS target conflict, the design favors peak safety. A state like "the LUFS target was missed but the true-peak limit was reached" is possible.

That state is identifiable from the report's applied gain and output LUFS values.

::::

Related: [True Peak](../true-peak.md), [True Peak Safety](../concepts/true-peak-safety.md), [Loudness Matching](../concepts/loudness-matching.md), [Mono Compatibility](../concepts/mono-compatibility.md)
