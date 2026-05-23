---
title: Delivery Targets
description: How platform loudness targets, true-peak ceiling, and custom LUFS choices affect a rendered master.
---

# Delivery Targets

Delivery Targets are the loudness and peak-safety choices you make for the place where the track will be published.

The demo exposes common platform-style targets such as Spotify, YouTube, Apple Music, TikTok, and Custom. These are practical starting points, not universal rules.

## Loudness Target

The loudness target is the integrated LUFS value the renderer aims for after processing.

| Target | Practical use |
|--------|---------------|
| `-14 LUFS` | A balanced streaming-style target for many music releases. |
| `-16 LUFS` | Useful for Apple Music style targets, podcasts, speech, or more headroom. |
| Custom | Useful when you know a delivery spec or want to audition a different loudness. |

Louder is not automatically better. If the target forces the limiter to work too hard, the master can lose punch and still be turned down by the platform.

## True-Peak Ceiling

The ceiling protects the rendered file from peaks that may appear during reconstruction or codec conversion. A common streaming-oriented starting point is around `-1 dBTP`.

Use a lower ceiling, such as `-2 dBTP`, when you want more codec safety. Use a tighter ceiling only when the delivery path is known and controlled.

## Signs to Back Off

If kick, snare, and consonants start to flatten right after you raise the target, the chain is gaining density rather than loudness. Lower the target or relax the dynamics before doing anything else. Raising the ceiling to compensate increases the risk of clipping after codec conversion, so it should not be the first move.

If lowering the target barely changes the musical impact, prefer the safer setting. When the platform is likely to turn the master down anyway, a slightly lower target often preserves more punch on playback.

## Choosing A Target

Start with the destination, then listen to the material:

1. Pick the closest platform preset.
2. Render once without over-tuning.
3. Check whether the limiter is audibly changing the groove or transient impact.
4. If the master feels smaller, lower the target or loosen the dynamics before raising loudness again.
5. Export the JSON report so the target, ceiling, and chain stages are documented.

:::: details Implementation notes

The demo maps platform choices to a LUFS target and passes that target into libsonare's loudness stage. The true-peak limiter and loudness optimizer share the ceiling value so final gain is capped against peak safety.

The exported report records the selected preset, platform, target LUFS, tuning values, source metrics, rendered metrics, and stage names. This makes the browser render reproducible enough to use as a starting point for CLI or application integration.

When the ceiling constraint is reached before the LUFS target, the implementation favors peak safety. In that state, pushing the target higher will not raise output loudness as expected. Reading the report's applied gain alongside output LUFS makes it easier to separate a target-setting problem from a problem in the earlier dynamics or low-end stages.

::::

Related: [LUFS](../lufs.md), [True Peak Safety](../concepts/true-peak-safety.md), [Stereo, Limiter, and Loudness Controls](./stereo-limiter-loudness.md)
