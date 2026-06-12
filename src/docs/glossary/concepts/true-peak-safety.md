---
title: True Peak Safety
description: How true-peak margin prevents clipping after reconstruction, codec conversion, and streaming playback.
---

# True Peak Safety

True peak safety is the practice of leaving enough margin so a mastered file does not clip after reconstruction, codec conversion, or streaming playback.

Sample peaks only show the values stored in the digital file. Playback systems and encoders reconstruct a continuous waveform between those samples. That reconstructed waveform can exceed the stored sample peaks, creating an inter-sample peak. A master that looks safe at sample level can still distort after conversion.

<SonareDemo id="loudness-meter" />

## Why Sample Peak Is Not Enough

A digital audio file is a series of points, not a complete curve. When a DAC or encoder turns those points back into sound, it reconstructs the curve implied by the samples. The curve can rise above the points.

This matters most when:

| Situation | Risk |
|-----------|------|
| Lossy encoding | MP3, AAC, or Opus conversion can create new peaks. |
| Loud limiting | Dense masters leave less room for reconstruction overshoot. |
| Streaming normalization | Playback pipelines may transcode or process the file. |
| Consumer devices | Some playback chains handle near-0 dBFS material poorly. |

True-peak measurement estimates this by oversampling the signal before checking peaks.

## Practical Ceiling

A common release ceiling is around `-1 dBTP`. Some workflows use `-2 dBTP` for extra codec safety; others use a tighter ceiling when the destination is known and controlled.

The ceiling is not a loudness target. It is a safety margin. You can have a quiet file with unsafe peaks or a loud file that stays within true-peak limits.

## Limiter Lookahead

A true-peak limiter needs time to react before the peak arrives. Lookahead gives the limiter that time. Too little lookahead can miss fast peaks. Too much lookahead can increase latency and may change transient feel.

In offline mastering, a few milliseconds of lookahead is usually acceptable because playback latency does not matter. In live or interactive systems, latency matters more.

## In libsonare

The libsonare mastering chain uses a true-peak limiter stage and exposes ceiling and lookahead controls in Studio mode. The WASM ISP benchmark checks the browser path with 4x oversampling (the minimum required by ITU-R BS.1770-4 for true-peak measurement) and a sliding-max guard so peak detection stays fast enough for local rendering.

:::: details Implementation notes

The safety check uses the same principle as true-peak metering: estimate the reconstructed waveform by oversampling, then evaluate the highest sample on that denser grid. A limiter that only clamps original samples can still leave inter-sample overs, so the guard has to observe the oversampled path, not just the input buffer.

Lookahead and release are coupled.

Lookahead gives the limiter a chance to begin attenuation before the peak. Release determines how quickly it returns to unity gain.

Very short release can produce modulation. Very long release can dull transients and reduce loudness headroom. The practical setting is a compromise between codec safety, transient preservation, and audible gain movement.

::::

Related: [True Peak](../true-peak.md), [LUFS](../lufs.md), [Loudness Matching](./loudness-matching.md)
