---
title: Reading Mastering Meters
description: How to interpret LUFS, peak, crest factor, correlation, phase, and stereo image together.
---

# Reading Mastering Meters

Mastering meters are useful only when read together. A single number cannot tell you whether a master is good.

The browser demo shows loudness, peak level, crest factor, correlation, phase scope, and stereo image. These meters answer different questions: how loud it is, how safe it is, how dense it is, and whether the stereo image will translate.

::: tip Read meters in groups, then trust your ears
No single reading proves a master is good. Loudness + peak answer "is it on target and safe"; crest factor + correlation answer "is it still alive and mono-safe". Use the meters to *catch* problems, then confirm them by listening.
:::

## The Main Readings

| Meter | Question it answers |
|-------|---------------------|
| Output LUFS | Is the master near the chosen delivery target? |
| Peak / True Peak | Is there enough peak safety for playback and conversion? |
| Crest Factor | Does the track still have peak-to-average movement? |
| Correlation | Is the stereo image likely to survive mono playback? |
| Phase Scope | Is the stereo field balanced or unstable? |
| Stereo Image | Is width coming from useful side energy or risky spread? |

<SonareDemo id="loudness-meter" />

## What To Check First

Start with loudness and peak safety. A master that misses the target or clips is not ready.

Then check crest factor and correlation. A track can hit the target and still feel lifeless if the crest factor is too low. A track can sound wide in headphones and still collapse badly in mono if correlation is unstable.

## Do Not Chase Perfect Numbers

Different genres behave differently. Dense EDM, sparse acoustic music, speech, and AI-generated music should not land on identical crest factor or stereo values.

Use the meters to catch problems, then confirm them by listening:

1. Compare before and after with loudness matching enabled.
2. Listen for lost punch, harshness, pumping, and stereo imbalance.
3. Check whether the reference track is in the same range, not whether the numbers are identical.

:::: details Implementation notes

The demo uses two measurement paths:

| Path | Purpose | Where it appears |
|------|---------|------------------|
| Lightweight UI metrics | Immediate feedback while interacting | Vue components |
| Authoritative render metrics | Values to keep in the report | libsonare render result and JSON report |

Peak, RMS, crest factor, and correlation in the UI are sampled from the source or rendered buffers with a stride so the interface stays responsive. The phase scope and stereo image are visualization aids.

Because the UI metrics and the post-render metrics come from separate paths, the numbers can differ slightly. Treat the JSON report as the processing record.

The preset validation script runs generated test signals through the mastering chain.

It checks three practical things:

| Check | Why it matters |
|-------|----------------|
| Finite LUFS values | The loudness path did not produce invalid numbers. |
| Bounded peak levels | The chain did not create runaway output. |
| Expected stage names | The preset wiring still matches the public report shape. |

This catches processor wiring breakage or preset-definition inconsistencies before they reach the demo or downstream users.

::::

Related: [LUFS](../lufs.md), [True Peak](../true-peak.md), [Crest Factor](../concepts/crest-factor.md), [Mono Compatibility](../concepts/mono-compatibility.md)
