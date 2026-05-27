---
title: Mastering Quality Checklist
description: A practical final check before exporting a mastered file.
---

# Mastering Quality Checklist

Use this checklist before treating a render as finished. It is deliberately short: mastering quality comes from focused checks, not from touching every control.

## Before Rendering

- The source is not clipped before mastering.
- The selected preset matches the source style.
- The delivery target is realistic for the material.
- Repair is used only when there is an actual noise or artifact problem.
- Stereo width is conservative enough for mono playback.

## After Rendering

- Output LUFS is near the chosen target.
- Peak safety is reasonable for the delivery path.
- Loudness-matched A/B still sounds better, not merely louder.
- Drums, consonants, and transients have not been flattened.
- Low end is controlled but not smaller.
- Vocals or lead elements still sit in front.
- Correlation and phase scope do not suggest severe mono problems.
- The reference track is used as a context check, not as a copy target.

## If A Check Fails

Do not fix every failed check with the same control. Route the problem back to the part of the chain that can actually change it:

| Symptom | First place to revisit |
|---------|------------------------|
| Target LUFS is missed because the limiter works too hard | [Stereo, Limiter, and Loudness Controls](./stereo-limiter-loudness.md) |
| Vocals became sharp, cymbals became brittle, or hiss increased | [Tone and Air Controls](./tone-air.md) |
| Drums lost punch or consonants feel flattened | [Dynamics Controls](./dynamics.md) |
| Noise reduction leaves pumping, dullness, or watery tails | [Repair and Input Controls](./repair.md) |
| The master collapses or becomes hollow in mono | [Stereo, Limiter, and Loudness Controls](./stereo-limiter-loudness.md) |
| The reference sounds better but the mix identity disappears | [Reference Match](./reference-match.md) |

If several checks fail at once, move earlier in the chain. Fixing input, repair, and broad tone first usually makes later dynamics and limiting behave more predictably.

## When To Stop

Stop when the master translates and the musical intent is still intact. Do not keep processing just because another control is available.

::: tip If the next move is vague, go listen elsewhere
A car, a phone speaker, cheap earbuds, and a quiet playback level reveal more than another 30 minutes of parameter changes. Export the render and check translation before touching anything else.
:::

If the next move is vague, export the current render and listen elsewhere. A car, phone speaker, cheap earbuds, and quiet playback level often reveal more than another 30 minutes of parameter changes.

:::: details Implementation notes

The demo exports a WAV and a JSON report. Keep both while evaluating. The WAV is the listening artifact; the JSON records the preset, platform, target LUFS, tuning values, source metrics, rendered metrics, reference metrics, and stage names. That makes it possible to return to the same decision later or translate the settings into CLI/application usage.

Treat the report as traceability, not as proof that the render is good. A render can meet numeric targets and still fail the listening checks above. The intended workflow is report first for reproducibility, loudness-matched A/B second for bias control, and external playback third for translation.

::::

Related: [A/B Comparison](../ab-comparison.md), [Reference Match](./reference-match.md), [Error Recovery](./error-recovery.md)
