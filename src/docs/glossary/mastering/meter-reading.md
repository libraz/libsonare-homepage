---
title: Reading Mastering Meters
description: How to interpret LUFS, peak, crest factor, correlation, phase, and stereo image together.
---

# Reading Mastering Meters

Mastering meters are useful only when read together. A single number cannot tell you whether a master is good.

The browser demo shows loudness, peak level, crest factor, correlation, phase scope, and stereo image. These meters answer different questions: how loud it is, how safe it is, how dense it is, and whether the stereo image will translate.

## The Main Readings

| Meter | Question it answers |
|-------|---------------------|
| Output LUFS | Is the master near the chosen delivery target? |
| Peak / True Peak | Is there enough peak safety for playback and conversion? |
| Crest Factor | Does the track still have peak-to-average movement? |
| Correlation | Is the stereo image likely to survive mono playback? |
| Phase Scope | Is the stereo field balanced or unstable? |
| Stereo Image | Is width coming from useful side energy or risky spread? |

## What To Check First

Start with loudness and peak safety. A master that misses the target or clips is not ready.

Then check crest factor and correlation. A track can hit the target and still feel lifeless if the crest factor is too low. A track can sound wide in headphones and still collapse badly in mono if correlation is unstable.

## Do Not Chase Perfect Numbers

Different genres behave differently. Dense EDM, sparse acoustic music, speech, and AI-generated music should not land on identical crest factor or stereo values.

Use the meters to catch problems, then confirm by listening:

1. Compare before and after with loudness matching enabled.
2. Listen for lost punch, harshness, pumping, and stereo imbalance.
3. Check whether the reference track is in the same range, not whether the numbers are identical.

:::: details Implementation notes

The demo computes lightweight visual metrics in the Vue component for immediate feedback. Peak, RMS, crest factor, and correlation are sampled from the source or rendered buffers with a stride for responsiveness. The phase scope and stereo image are visualization aids; the authoritative processing metrics are the values returned by the libsonare render and included in the JSON report. The UI numbers and the report numbers can therefore look slightly different, because the immediate UI metrics and the post-render measurement come from separate paths.

The preset validation script separately checks generated test signals through the mastering chain, ensuring the configured presets produce finite LUFS values, bounded peak levels, and expected stage names. This catches breakage in the processor wiring or inconsistencies in preset definitions during the pre-release verification phase, before any of it reaches the demo or downstream users.

::::

Related: [LUFS](../lufs.md), [True Peak](../true-peak.md), [Crest Factor](../concepts/crest-factor.md), [Mono Compatibility](../concepts/mono-compatibility.md)
