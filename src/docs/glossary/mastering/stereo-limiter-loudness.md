---
title: Stereo, Limiter, and Loudness Controls
description: How width, true-peak limiting, loudness target, and output rendering finish the master.
---

# Stereo, Limiter, and Loudness Controls

The final part of the mastering chain decides how wide the master feels, how safely peaks are controlled, and where the rendered file lands in loudness.

These controls should be judged together. A wider master can change peak behavior. A louder target can force the limiter harder. A lower ceiling can protect codec conversion but may reduce available loudness.

## Stereo Width

Width is easiest to understand through mid/side (M/S). Any left/right pair can be rewritten as two other signals: **mid**, `M = (L + R) / 2`, what the two channels have in common (the center: vocal, kick, bass), and **side**, `S = (L − R) / 2`, what differs between them (the width). `L = M + S` and `R = M − S` turn them back into left and right, so nothing is lost.

Stereo Width scales the side signal: above 1 the side gets louder and the image wider, below 1 it gets quieter and the image narrower, and 0 leaves only the mid, which is mono. Wider settings can make a master feel larger, but they can weaken mono compatibility or make low frequencies unstable. When the track is folded to mono, the side cancels out completely, so whatever width added is exactly what a mono listener loses:

<SonareDemo id="mono-fold" />

Use loudness-matched A/B and check correlation. For speech, keep width conservative.

Width changes also move the overall level. The energy compensation applied with the width change is a fixed, signal-independent gain, so it only cancels out on material whose mid and side energy happen to be equal — and in a normal mix the side is far quieter than the mid. Re-check loudness after moving Stereo Width instead of assuming the level held.

The most reliable warning sign is the mono check: if the core of the vocal, kick, bass, or snare thins out when you collapse to mono, back off. A setting that sounds impressive in stereo but hollows out the center is not a mastering improvement — it is a balance shift in disguise.

::: warning Always check width in mono
Collapse to mono before committing to a width setting. If the center cores thin out, the width is too high. The limiter is your last safety net, not a density tool — if it is working deep at all times, fix the low end, compressor, and input gain earlier in the chain instead of raising the ceiling.
:::

## True Peak Limiter

The True Peak Limiter holds the file's own peaks under the ceiling, including the peaks that appear between digital samples when the waveform is reconstructed. It cannot see what happens later: a lossy encoder (AAC, MP3, Opus) changes the waveform and can raise its peaks again after the file has left the limiter. The distance between the ceiling and 0 dBTP is the margin that absorbs that. Limiter Ceiling is the final safety limit, commonly around `-1 dBTP` for streaming-style delivery — dBTP means decibels true peak, the peak measured between samples rather than at the sample points.

If the limiter is working deep at all times, do not solve it by relaxing the ceiling first. Revisit the low-end balance, the compressor, and input gain earlier in the chain. The limiter is the last safety net, not the main density tool for the mix.

<SonareDemo id="limiter-gr" />

## Lookahead and True Peak Safety

Lookahead lets the limiter see fast peaks before they reach the output. The limiter delays the audio by the lookahead time while it measures the undelayed signal, so the gain can already be ramping down when a peak arrives instead of clamping it in a single sample. That delay is also latency: `maximizer.truePeakLimiter` defaults to 1 ms of lookahead, 50 ms of release and 4x oversampling, and reports 129 samples of latency at 48 kHz, the lookahead plus the delay of its oversampling filters and its output peak guard. Around 1 ms is enough for most material. Too little can distort sharp peaks; too much increases latency and can soften impact.

## Loudness Target

The Loudness Target is the integrated [LUFS](../lufs.md) (Loudness Units relative to Full Scale) goal for the rendered file — a *gated* average across the whole track, so silence and the quietest passages are excluded before the mean is taken. The [mastering demo](/mastering) uses common platform-style targets such as `-14 LUFS` and `-16 LUFS`, plus a custom target.

The meter below reads integrated LUFS, true peak and loudness range from a playing clip.

<SonareDemo id="loudness-meter" />


The loudness stage is not a gain trim that stops when the peaks touch the ceiling. It measures its input, computes the static gain (`target − current`, solved by remeasuring at the candidate gain; see [Mastering Processors](../../mastering-processors.md#processor-families-in-plain-english)), applies it, and then runs the true-peak limiter at the ceiling. On peak-normalized material — the ordinary case for a finished mix — the headroom below the ceiling is close to 0 dB, so a stage that only trimmed within that headroom could never move the loudness at all, however far away the target was. The limiter is what makes the target reachable: the static gain is allowed to push the signal over the ceiling, and the limiter brings it back under.

`maxLimiterGainReductionDb` bounds that push. It is a depth in dB, `12` by default, and must be finite and non-negative. The static gain may exceed the peak headroom toward the ceiling by at most this much, so the stage never asks the limiter for more than roughly 12 dB of reduction on the way to the target. It only ever bounds gain up to `target − current`, so it cannot make a master louder than the target asks for; what it decides is how peaky an input the stage will still try to normalize. `0` restores a strict headroom clamp, under which peak-normalized input keeps its input loudness whatever target is set.

When the bound is reached, the caller does not get the target. The static gain stops at `headroom + maxLimiterGainReductionDb`, the ceiling still holds — it holds at every setting — and the rendered file lands below the requested LUFS. The result says so rather than implying it: `loudnessTargetLimited` is true, `outputLufs` is the loudness actually achieved, and `appliedGainDb` is the static gain alone, without the limiter's reduction. Even inside the bound the stage does not iterate: one pass computes the gain, the limiter takes some of it back, and that shortfall is reported the same way. The full parameter table for the stage is in [Mastering Processors](../../mastering-processors.md).

## Output Render

The browser demo renders locally and exports a stereo WAV at 16-bit, 24-bit or 32-bit float (dither applies to the integer formats) plus a JSON report. Audio is not uploaded.

:::: details Implementation notes

libsonare's stereo imager works in the mid/side form described under [Stereo Width](#stereo-width): it multiplies the side signal by the width and converts back to left/right. Decorrelation is available as an option on top of it.

Energy compensation, when enabled, multiplies both mid and side by `sqrt(2 / (1 + width^2))`. That gain is derived from the width setting alone and never from the current samples, which keeps the stage linear and free of intermodulation products — but it holds total energy constant only under the assumption that mid and side carry equal power. Programme material rarely does, so widening still lowers the level a little and narrowing raises it.

The true-peak limiter uses lookahead, linked peak detection, and an oversampled true-peak path.

The loudness stage measures its input, computes the gain needed to reach the LUFS target, and caps that gain at the ceiling headroom plus `maxLimiterGainReductionDb`. The true-peak limiter it then runs is built from one shared configuration that the standalone `maximizer.loudnessOptimize` processor and the in-chain `loudness` stage both use, so every loudness path limits alike. The limiter's own reduction is reported as the `loudness.optimize` stage gain reduction, separately from `appliedGainDb`.

The mastering demo defaults to 4x true-peak handling and reports the executed stage names in the JSON export, so the final chain is auditable.

When the ceiling and the LUFS target conflict, the design favors peak safety. A state like "the LUFS target was missed but the true-peak limit was reached" is possible.

That state is identifiable from the report's applied gain and output LUFS values, and the chain result flags it directly as `loudnessTargetLimited`.

A streaming chain cannot look ahead at a whole file, so it takes the loudness gain as a number. `streamingLoudnessGain` / `streamingLoudnessGainStereo` (Python: `streaming_loudness_gain` / `streaming_loudness_gain_stereo`) run the offline chain up to its loudness stage and return the gain it would apply, ceiling clamp included, together with the true peak that clamp used; the value is 0 dB for silence. Hand both to `StreamingMasteringChain` as `loudnessStaticGainDb` and `loudnessStaticGainPeakDb`.

::::

Related: [True Peak](../true-peak.md), [True Peak Safety](../concepts/true-peak-safety.md), [Loudness Matching](../concepts/loudness-matching.md), [Mono Compatibility](../concepts/mono-compatibility.md)
