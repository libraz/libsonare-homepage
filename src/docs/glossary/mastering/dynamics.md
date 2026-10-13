---
title: Dynamics Controls
description: How threshold, ratio, attack, release, and knee shape mastering compression.
---

# Dynamics Controls

Dynamics controls decide how much movement the master keeps. In the demo they drive the compressor stage and the Quick Master Dynamics macro.

This is one topic, not five separate decisions. Threshold, ratio, attack, release, and knee only make sense together.

::: tip Tune the five together, with your ears
Changing one control shifts what the others do, so judge the *result*, not each knob in isolation. Always check it against a loudness-matched [A/B Comparison](../concepts/loudness-matching.md): compression that only sounds "better" because it got louder is not actually better.
:::

## Threshold, Ratio, Attack, Release, Knee

A compressor watches the level of the signal and turns it down while that level is above a chosen point. Five controls describe how:

- **Threshold** is the level (in dBFS) where compression starts. Below it the compressor does nothing.
- **Ratio** sets how much a level above the threshold is allowed to rise. At 4:1, every 4 dB the input goes over the threshold comes out as only 1 dB over.
- **Attack** is how quickly the gain comes down once the level crosses the threshold; **release** is how quickly it recovers once the level falls back. Each time is one time constant: the gain covers about 63% of its move toward the target in the set time, not all of it.
- **Knee** decides whether compression begins abruptly at the threshold (hard knee) or eases in over a few dB around it (soft knee).

The amount the compressor is turning the signal down at any moment is the **gain reduction** (GR), in dB. Because compression only ever lowers the level, a compressor usually adds a fixed **makeup gain** afterwards to bring the average back up.

With a hard knee and the threshold at −20 dBFS, the static curve works out like this:

| Input level | Over threshold | Output at 2:1 (GR) | Output at 4:1 (GR) | Output at ∞:1 (GR) |
|---|---:|---|---|---|
| −26 dBFS | — | −26 (0 dB) | −26 (0 dB) | −26 (0 dB) |
| −16 dBFS | 4 dB | −18 (2 dB) | −19 (3 dB) | −20 (4 dB) |
| −12 dBFS | 8 dB | −16 (4 dB) | −18 (6 dB) | −20 (8 dB) |
| −8 dBFS | 12 dB | −14 (6 dB) | −17 (9 dB) | −20 (12 dB) |

::: info Compressor or limiter?
A **limiter** is a compressor taken to the extreme: an effectively infinite ratio (the ∞:1 column above), a very fast attack, and usually lookahead so it can act before a peak arrives. Its job is different too. A compressor shapes how the level moves and sounds; a limiter sits last in the chain and only guarantees that peaks never pass a ceiling. In mastering the compressor works gently on the whole track, and the [true-peak limiter](./stereo-limiter-loudness.md#true-peak-limiter) catches whatever is left.
:::

| Control | Listen for |
|---------|------------|
| Threshold | How much of the song is being compressed. |
| Ratio | How dense or pinned the loud sections feel. |
| Attack | Whether drums and consonants keep their front edge. |
| Release | Whether the master breathes naturally or pumps. |
| Knee | Whether compression grabs suddenly or eases in. |

<SonareDemo id="compressor-curve" />

## Practical Workflow

1. Start with a gentle ratio (about 1.5:1 to 2:1 on a full mix) and a soft knee.
2. Lower threshold until loud sections show controlled reduction, typically 1 to 3 dB of gain reduction on the peaks of a master.
3. Adjust attack so transients (the short level spikes at the front of drum hits and consonants) are controlled but not flattened. Around 10 to 30 ms lets the front of a hit through; shorter attacks dull it.
4. Adjust release so the gain returns with the groove, often somewhere between 100 and 300 ms. Too short and the level flutters; too long and the compressor never recovers between hits.
5. Use loudness-matched A/B before deciding the compression is better.

## Parallel compression

Compression does not have to be all-or-nothing. **Parallel** (or "New York") compression blends a heavily compressed copy of the signal *under* the untouched dry signal. The dry copy keeps the transients and punch; the squashed copy adds body and lifts the quiet detail. A blend control sets how much of the compressed copy is mixed in — at 100% you hear only the compressor, and as you lower it the dry dynamics return.

<SonareDemo id="parallel-compression" />

## Multiband compression

The compressor described above acts on the whole signal at once. libsonare's mastering chain also supports a **multiband compressor** that splits the signal into frequency bands and compresses each one independently — useful when only one register is misbehaving (a boomy low end, a harsh top) and squashing the whole mix would cost more than it fixes.

::: tip Choose the number of bands
WASM, Node, and Python can configure 2–64 bands through `dynamics.multibandComp.crossover` and a `bands` array of independent compressor settings. The C ABI expresses the same configuration through indexed flat keys such as `dynamics.multibandComp.bands.<i>.<field>` and `dynamics.multibandComp.crossover.cutoffsHz.<i>`. One band is refused. The fixed low/mid/high keys remain a three-band shorthand. A JSON chain document uses schema version 2 for the structured form; schema version 1 uses the shorthand. See [Mastering Chain Config](../../js-api-types.md#masteringchainconfig) for the fields and [Mastering Processors](../../mastering-processors.md) for chain parameters.
:::

How the bands are split, and what each crossover mode does at the cutoffs, is on [Crossover Slope and Mode](./crossover.md).

## In libsonare

Studio exposes threshold, ratio, attack, and release directly. Knee is part of the underlying compressor model and preset design, but it is not a first-line control in the browser UI.

:::: details Implementation notes

libsonare evaluates a detector level in dB and compares it with the threshold. Stereo detection is linked: one detector level is derived from all channels and the same gain is applied to every channel, so the stereo image does not pull sideways. How that linked level is formed depends on the detector — peak takes the loudest channel at that sample, while the RMS detectors take the mean power across channels, so anti-correlated content does not collapse the detected level.

The hard-knee static curve is conceptually:

```text
over_db = input_db - threshold_db
gain_reduction_db = over_db * (1 - 1 / ratio)
```

Soft knee replaces the abrupt corner around threshold with a quadratic transition. Attack and release then smooth the target reduction into a continuous gain envelope. The detector can measure the incoming level in different ways: peak (the instantaneous maximum, reacts fastest), RMS (a short running average over 10 ms, closer to perceived loudness), or a slow RMS selected as `logRms` (despite the name, a linear RMS average like the default, taken over a longer 50 ms window, so it estimates the sustained level and ignores brief transients). RMS is the default. The choice changes how twitchy the compressor is. That detector smoothing is separate from attack/release envelope timing.

Auto-makeup is an open-loop estimate, not a measurement: it is computed once per block from threshold and ratio alone as `0.5 × max(0, -thresholdDb) × (1 - 1/ratio)` dB. For a negative threshold and a hard knee, this is half the theoretical reduction at a 0 dBFS detector level; a signal exactly at threshold has no hard-knee reduction to restore. The half factor limits overcompensation for programme material whose level varies over time. Auto-makeup and manual makeup are mutually exclusive — any non-zero `makeupGainDb` overrides the automatic value rather than adding to it. Final loudness landing is still the responsibility of the loudness optimizer that sits after the compressor in the chain.

::::

Related: [Dynamic Range](../concepts/dynamic-range.md), [Crest Factor](../concepts/crest-factor.md), [A/B Comparison](../concepts/loudness-matching.md)
