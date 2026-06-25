---
title: Dynamics Controls
description: How threshold, ratio, attack, release, and knee shape mastering compression.
---

# Dynamics Controls

Dynamics controls decide how much movement the master keeps. In the demo they drive the compressor stage and the Quick Master Dynamics macro.

This is one topic, not five separate decisions. Threshold, ratio, attack, release, and knee only make sense together.

::: tip Tune the five together, with your ears
Changing one control shifts what the others do, so judge the *result*, not each knob in isolation. Always check it against a loudness-matched [A/B Comparison](../ab-comparison.md): compression that only sounds "better" because it got louder is not actually better.
:::

## Threshold, Ratio, Attack, Release, Knee

Threshold decides where compression starts. Ratio decides how strongly levels above that point are reduced. Attack decides how quickly gain reduction arrives. Release decides how quickly it lets go. Knee decides whether compression begins abruptly or gradually near the threshold.

| Control | Listen for |
|---------|------------|
| Threshold | How much of the song is being compressed. |
| Ratio | How dense or pinned the loud sections feel. |
| Attack | Whether drums and consonants keep their front edge. |
| Release | Whether the master breathes naturally or pumps. |
| Knee | Whether compression grabs suddenly or eases in. |

<SonareDemo id="compressor-curve" />

## Practical Workflow

1. Start with moderate ratio and a soft knee.
2. Lower threshold until loud sections show controlled reduction.
3. Adjust attack so transients are controlled but not flattened.
4. Adjust release so the gain returns with the groove.
5. Use loudness-matched A/B before deciding the compression is better.

## Parallel compression

Compression does not have to be all-or-nothing. **Parallel** (or "New York") compression blends a heavily compressed copy of the signal *under* the untouched dry signal. The dry copy keeps the transients and punch; the squashed copy adds body and lifts the quiet detail. A blend control sets how much of the compressed copy is mixed in — at 100% you hear only the compressor, and as you lower it the dry dynamics return.

<SonareDemo id="parallel-compression" />

## In libsonare

Studio exposes threshold, ratio, attack, and release directly. Knee is part of the underlying compressor model and preset design, but it is not a first-line control in the browser UI.

:::: details Implementation notes

libsonare evaluates a detector level in dB and compares it with the threshold. Stereo detection is linked: the loudest channel at a sample decides the gain reduction, and that same gain is applied to both channels so the stereo image does not pull sideways.

The hard-knee static curve is conceptually:

```text
over_db = input_db - threshold_db
gain_reduction_db = over_db * (1 - 1 / ratio)
```

Soft knee replaces the abrupt corner around threshold with a quadratic transition. Attack and release then smooth the target reduction into a continuous gain envelope. The detector can measure the incoming level in different ways: peak (the instantaneous maximum, reacts fastest), RMS (a short running average, closer to perceived loudness), or log-RMS (that same average computed in decibels). The choice changes how twitchy the compressor is. That detector smoothing is separate from attack/release envelope timing.

When auto-makeup is enabled, the compressor restores the average level that compression removed before passing the signal downstream. The restoration tracks average loudness, not peak level — final loudness landing is still the responsibility of the loudness optimizer that sits after the compressor in the chain.

::::

Related: [Dynamic Range](../concepts/dynamic-range.md), [Crest Factor](../concepts/crest-factor.md), [A/B Comparison](../ab-comparison.md)
