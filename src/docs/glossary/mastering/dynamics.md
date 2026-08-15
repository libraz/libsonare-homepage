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
3. Adjust attack so transients — the short level spikes at the front of drum hits and consonants — are controlled but not flattened.
4. Adjust release so the gain returns with the groove.
5. Use loudness-matched A/B before deciding the compression is better.

## Parallel compression

Compression does not have to be all-or-nothing. **Parallel** (or "New York") compression blends a heavily compressed copy of the signal *under* the untouched dry signal. The dry copy keeps the transients and punch; the squashed copy adds body and lifts the quiet detail. A blend control sets how much of the compressed copy is mixed in — at 100% you hear only the compressor, and as you lower it the dry dynamics return.

<SonareDemo id="parallel-compression" />

## Multiband compression

The compressor described above acts on the whole signal at once. libsonare's mastering chain also supports a **multiband compressor** that splits the signal into frequency bands and compresses each one independently — useful when only one register is misbehaving (a boomy low end, a harsh top) and squashing the whole mix would cost more than it fixes.

::: warning Not reachable from the browser demo
The demo's `masteringChain()` config exposes only a fixed three-band shorthand (`dynamics.multibandComp.lowThresholdDb`, `midRatio`, `highAttackMs`, and so on — low/mid/high, never more). An arbitrary band count (validated to between 1 and 64 bands) is a JSON-document-level feature: it requires the mastering CLI's `--config <file>` pointing at a **chain config schema version 2**, where `dynamics.multibandComp` becomes a structured object — a `crossover` plus a `bands` array of independent compressor configs — instead of the flat low/mid/high keys. Schema version 1, and the browser's TypeScript config object, cannot express more than three bands.
:::

## In libsonare

Studio exposes threshold, ratio, attack, and release directly. Knee is part of the underlying compressor model and preset design, but it is not a first-line control in the browser UI.

:::: details Implementation notes

libsonare evaluates a detector level in dB and compares it with the threshold. Stereo detection is linked: one detector level is derived from all channels and the same gain is applied to every channel, so the stereo image does not pull sideways. How that linked level is formed depends on the detector — peak takes the loudest channel at that sample, while the RMS detectors take the mean power across channels, so anti-correlated content does not collapse the detected level.

The hard-knee static curve is conceptually:

```text
over_db = input_db - threshold_db
gain_reduction_db = over_db * (1 - 1 / ratio)
```

Soft knee replaces the abrupt corner around threshold with a quadratic transition. Attack and release then smooth the target reduction into a continuous gain envelope. The detector can measure the incoming level in different ways: peak (the instantaneous maximum, reacts fastest), RMS (a short running average over 10 ms, closer to perceived loudness), or log-RMS (the same linear RMS average taken over a longer 50 ms window, so it estimates the sustained level and ignores brief transients). RMS is the default. The choice changes how twitchy the compressor is. That detector smoothing is separate from attack/release envelope timing.

Auto-makeup is an open-loop estimate, not a measurement: it is computed once per block from threshold and ratio alone, as half of the makeup that would exactly restore a signal sitting at the threshold. The half factor is deliberate, because real program material averages well below threshold and the full figure overshoots. Auto-makeup and manual makeup are mutually exclusive — any non-zero `makeupGainDb` overrides the automatic value rather than adding to it. Final loudness landing is still the responsibility of the loudness optimizer that sits after the compressor in the chain.

::::

Related: [Dynamic Range](../concepts/dynamic-range.md), [Crest Factor](../concepts/crest-factor.md), [A/B Comparison](../ab-comparison.md)
