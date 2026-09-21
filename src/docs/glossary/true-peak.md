---
title: True Peak
description: Why true peak limiting matters for browser and streaming mastering.
---

# True Peak

True Peak estimates the highest level a signal will actually reach when it is played back. Digital audio is stored as a series of separate sample points; on playback those points are smoothed back into a continuous waveform. That reconstructed waveform can rise higher between two samples than either sample itself, and True Peak estimates that in-between maximum.

A file can have sample peaks below 0 dBFS and still clip after conversion or playback reconstruction.
This is the inter-sample peak (ISP) problem. The visible sample points can look safe while the reconstructed analog-like waveform rises above the limit between those points.

<SonareDemo id="inter-sample-peak" />

## Practical Starting Point

A common release ceiling is around `-1 dBTP` — decibels true peak, the same dB scale as sample peak but measured on the reconstructed waveform. The libsonare demo uses a true-peak limiter stage and exposes ceiling and lookahead controls in Studio mode.

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

## Relationship to LUFS

The true-peak ceiling is a separate constraint from the loudness target. Raising the ceiling because you want more LUFS is a risky trade: it buys a little level now and pays for it with clipping after codec conversion or device-side reconstruction.

If the loudness target is out of reach, look first at how much gain reduction the limiter is doing. When it is working deep the whole time, the natural fix is earlier in the chain — input gain, compression, low-end balance — not the ceiling. How the loudness stage drives the limiter, and how far it is allowed to, is on [Stereo, Limiter, and Loudness Controls](./mastering/stereo-limiter-loudness.md).

## Sample-Accurate Limiting

The libsonare true-peak limiter enforces its ceiling per sample at the oversampled rate, and every stage inside it — lookahead, gain smoothing, the guard after decimation — is sample-serial and carries its state across calls. Nothing in the output is derived from a whole-block statistic. That is what sample-accurate means here, and it has one consequence a bounce depends on: the output does not depend on how the host chunks the audio. The same material limited in 256-sample callbacks, in 16384-sample blocks, in one offline pass, or in ragged splits that land mid-transient comes out identical, sample for sample.

Why this is the property that matters: a render is reproducible only if the host's buffer size is not an input to the sound. The streaming chain and the offline chain drive the same limiter, so at this stage a streaming preview at 512-sample blocks and an offline render of the same file agree, and a WAV exported again under a different buffer setting is the same WAV. A limiter that rescaled each block by that block's own maximum would drag every sample in the block down for one ringing one, and its level would become a function of the block size — which is what a block-independent design rules out.

The price is a small residue at the ceiling. Bounding each sample rather than forcing a block's measured peak exactly onto the ceiling lets the reconstructed peak read very slightly over it when measured at a finer oversampling than the limiter runs at: about +0.02 dB for a 4x limiter read by an 8x meter, flat across drive, so it does not grow as the limiter is pushed harder. A meter at the same oversampling as the limiter sees the ceiling held exactly, and a higher `oversampleFactor` pushes the residue down. The chain's reported `outputTruePeakDbtp` follows the limiter's own factor for this reason; compare it against an independent measurement only at the same factor.

:::: details Implementation notes

True peak detection is different from sample peak detection: it oversamples the signal and takes the maximum of the reconstructed waveform rather than of the stored sample points. libsonare performs that oversampling with a polyphase interpolation filter, evaluating the reconstruction at each intermediate phase — the polyphase filter is how the oversampling is done, not an alternative to it. The meter supports 1x, 2x, 4x, 8x, and 16x, and the demo defaults to 4x.

The demo limiter has lookahead, so it can prepare gain reduction before a peak arrives rather than reacting after the peak has already clipped. Longer lookahead can be safer, but excessive values may soften transient feel.

The ceiling guarantee belongs to the default polyphase path, which limits the oversampled signal and decimates the result. The `applyGainAtInputRate` option computes the gain envelope at the oversampled rate but applies it to the base-rate signal; it is best-effort and does not guarantee the inter-sample ceiling, because the limited signal is never re-synthesised at the oversampled rate. Leave it off; the default path is the one that guarantees the ceiling.

::::

Related: [True Peak Safety](./concepts/true-peak-safety.md), [Mastering](./mastering.md), [LUFS](./lufs.md)
