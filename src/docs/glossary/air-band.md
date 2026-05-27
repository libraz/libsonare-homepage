---
title: Air Band
description: High-frequency air-band processing for mastering and AI-generated sources.
---

# Air Band

The air band is the very high frequency region, roughly above 10-12 kHz.

It contributes:

| Quality | What it means |
|---------|---------------|
| Openness | The mix feels less covered or dull |
| Shimmer | Cymbals, breath, and bright textures feel more present |
| Perceived detail | Small high-frequency cues become easier to notice |
This region carries more of the breath, cymbal edge, room tail, and surface texture than the actual musical pitch. Small moves can make a master feel clearer, but excessive moves often reveal hiss, sibilance, or a brittle top end before they reveal useful detail.

## AI-Generated Sources

Some generated music has a dull or sharply limited upper band. Air-band synthesis and high-frequency excitation can help restore perceived openness.

Use restraint: too much air can sound brittle or noisy.

When a source falls off sharply around 16 kHz, a normal high-shelf EQ may not be enough because there is little useful material to boost. In that case, treat air-band processing as a way to infer a natural upper edge from the remaining harmonics and noise floor, not as a replacement for missing recording detail.

## In Studio Mode

Use Air band amount together with Exciter amount. Raise it slowly and compare with loudness matching enabled.
Start with Air Band, then add Exciter only if the master still feels dull. Exciter changes harmonic character, so it affects texture as well as brightness.

A good setting usually sounds like the ceiling opened slightly. A bad setting makes cymbals papery, vocals sharp on sibilants, or silent sections noisier.

## Listening Checks

Check the change on at least three moments: a vocal line, a cymbal or hi-hat passage, and a quiet tail or breakdown. Air-band processing that helps only the loud chorus but makes the quiet sections hiss is usually too strong.

Use short A/B switches. If the processed version only sounds better because it is louder or sharper in the first second, lower the amount and listen again. The useful change should remain after the surprise wears off: clearer breath, cleaner room tail, and a top end that still belongs to the midrange.

:::: details Implementation notes

Air-band processing runs before the final loudness optimizer. That order lets the limiter and LUFS stage evaluate the true final result after high-frequency reconstruction has changed peak behavior.

The demo keeps Air Band Amount and Exciter Amount separate because they solve different problems. Air Band primarily restores the upper edge; Exciter increases harmonic density. Moving one at a time makes the cause of each audible change easier to identify.

For generated material, be conservative when the detected upper band is mostly noise. Boosting or synthesizing too much "air" can make the artifact easier to hear.

A safer workflow is:

1. Add a small amount of high-band reconstruction.
2. Let the limiter and loudness stage re-check peak behavior.
3. Adjust the amount before moving the shelf frequency.

Studio mode exposes the air-band shelf frequency, but pushing it too high often amplifies noise more than musical content. In most cases, leave the frequency near its default and move only the amount.

::::

Related: [Mastering](./mastering.md), [A/B comparison](./ab-comparison.md)
