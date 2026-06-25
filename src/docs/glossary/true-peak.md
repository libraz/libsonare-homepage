---
title: True Peak
description: Why true peak limiting matters for browser and streaming mastering.
---

# True Peak

True Peak estimates the highest level a signal will actually reach when it is played back. Digital audio is stored as a series of separate sample points; on playback those points are smoothed back into a continuous waveform. That reconstructed waveform can rise higher between two samples than either sample itself, and True Peak estimates that in-between maximum.

A file can have sample peaks below 0 dBFS and still clip after conversion or playback reconstruction.
This is the inter-sample peak problem. The visible sample points can look safe while the reconstructed analog-like waveform rises above the limit between those points.

<SonareDemo id="loudness-meter" />

## Practical Starting Point

A common release ceiling is around `-1 dBTP`. The libsonare demo uses a true-peak limiter stage and exposes ceiling and lookahead controls in Studio mode.

For the delivery-safety side of this topic, see [True Peak Safety](./concepts/true-peak-safety.md).

`-1 dBTP` is not a universal law, but it is a practical starting point because it leaves room for platform encoding and playback reconstruction. If raising the ceiling adds harshness or distortion after export, prioritize safety over a small loudness increase.

## Related Controls

| Control | Meaning |
|---------|---------|
| Ceiling | The maximum allowed reconstructed peak level. |
| Lookahead | How early the limiter can react before a peak arrives. |
| Release | How quickly the limiter recovers after reducing peaks. |

## What to Check by Ear

True peak problems often appear where kick and bass hit together, where cymbals are loud in a chorus, or after saturation creates sharp peaks. Listen for small bursts of grit, splashy cymbals, or low-end clicks that were not present before limiting.

If lowering the ceiling barely changes the sound, choose the safer setting. If lowering it removes punch immediately, do not solve the whole problem at the limiter; revisit dynamics, saturation, or input level earlier in the chain.

Even when the sample-peak meter looks safe, codec conversion and device-side reconstruction can lift peaks.

Typical material may rise by roughly +0.5 to +1 dB. In harder cases, especially when low and high energy hit together, peaks can rise by around +2 dB.

Right before release, check both the exported WAV and a quick render through the expected delivery codec, such as MP3, AAC, or Opus.

:::: details Implementation notes

True peak detection is different from sample peak detection. It estimates the maximum level between samples using oversampling or a polyphase filter.

The demo limiter has lookahead, so it can prepare gain reduction before a peak arrives rather than reacting after the peak has already clipped. Longer lookahead can be safer, but excessive values may soften transient feel.

::::

Related: [True Peak Safety](./concepts/true-peak-safety.md), [Mastering](./mastering.md), [LUFS](./lufs.md)
