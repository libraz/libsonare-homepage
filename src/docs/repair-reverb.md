---
title: Repairing Diffuse Reverb
description: Measure a late diffuse tail, configure libsonare's offline classical dereverberator, and understand its room-estimate limits.
---

# Repairing Diffuse Reverb

`masteringRepairDereverbClassical` is for a sustained, diffuse tail that masks the direct sound. It uses STFT-domain spectral subtraction and can run an optional WPE pre-stage. It is an offline restoration pass, not room-impulse-response deconvolution and not a way to recover a perfectly dry source.

## Detect before dereverb

The detector reports the statistic used by the dereverberator. It does not calculate an ISO 3382 RT60. Use `estimateRoom` when you need an equivalent-room estimate and inspect its confidence before using it to configure the repair.

```ts
import {
  estimateRoom,
  init,
  masteringRepairDereverbClassical,
  masteringRepairDereverbConfigForRoom,
  masteringRepairDetectReverb,
} from '@libraz/libsonare';

await init();

const detection = masteringRepairDetectReverb({
  samples,
  sampleRate,
});
const estimate = estimateRoom(samples, sampleRate, { nOctaveBands: 6 });
console.log(detection.lateDecayRatioDb, detection.latePredictability);
console.log(estimate.confidence, estimate.rt60Bands, estimate.volume);

const config = masteringRepairDereverbConfigForRoom(estimate, {
  attenuation: 0.7,
});
const cleaned = masteringRepairDereverbClassical({
  samples,
  sampleRate,
  ...config,
});
```

The `configForRoom` call reads the room estimate and returns a complete dereverb configuration. A real workflow still needs an audition: a low-confidence room estimate or a tail that is actually musical may not justify the pass.

## What the room config changes

`masteringRepairDereverbConfigForRoom` reads only `volume` and `rt60Bands` from the `estimateRoom` result. It changes two timing parameters and leaves the amount of removal under your control.

| Option | How to use it |
|---|---|
| `t60Sec` | Derived from the mid-band RT60 estimate. If the relevant bands did not converge, the helper uses the documented fallback from the available bands. |
| `lateDelayMs` | Derived from the estimated volume as a mixing-time delay, which marks the late diffuse region. |
| `attenuation`, `threshold`, `overSubtraction`, `spectralFloor` | Keep or override these amount and gate controls; they are not replaced by room geometry. `threshold` and `attenuation` are validated in the `[0, 1]` range. |
| `nFft`, `hopLength` | Set the STFT geometry. |
| `wpeEnabled`, `wpeIterations`, `wpeTaps`, `wpeStrength` | Enable and shape the optional WPE pre-stage. WPE analysis is otherwise off by default. |

The [Room Acoustics](./acoustic-analysis.md) page explains equivalent-room estimates, RT60 bands, and confidence. Its `roomMorph` effect adds a target-room character; it is a different operation from dereverberation.

## Keep channels linked

Use the stereo or linked entry point for multichannel material so one mask controls the set. The common mask preserves interchannel level and phase relationships.

```ts
import {
  masteringRepairDereverbClassicalLinked,
  masteringRepairDereverbClassicalStereo,
} from '@libraz/libsonare';

const stereo = masteringRepairDereverbClassicalStereo({
  left,
  right,
  sampleRate,
  attenuation: 0.7,
});

const linked = masteringRepairDereverbClassicalLinked({
  channels: [frontLeft, frontRight, centre],
  sampleRate,
  attenuation: 0.7,
});
console.log(stereo.report.meanReductionDb, linked.report.suppressedFraction);
```

The dereverb detector and repair pad an input shorter than `nFft` for analysis. All channels in a stereo or linked call must have the same length. The report contains ratios and fractions, so its values do not acquire the channel-count offset of the denoise floor measurement.

## Listen to the existing demo

<SonareDemo id="mastering-restoration" />

This embedded restoration example applies only the classical dereverberator. It does not run a dedicated declick, dehum, or denoise stage. The pass can change tails and timbre, and the comparison does not add loudness matching.

## Limits

The reverb detector is a module-specific late-decay and optional predictability measurement, not a room-acoustic standard. Dereverb attenuates diffuse sustained energy; it does not remove every early reflection, reconstruct a room impulse response, or separate overlapping sources. It can mistake a held note or other sustained musical material for a tail. Keep the untreated signal, compare at the same playback gain, and use the [Audio Repair Workflow](./audio-repair.md) to place dereverb last after the other supported repairs.

For exact overloads and report fields, see the [JavaScript mastering API](./js-api-mastering.md).
