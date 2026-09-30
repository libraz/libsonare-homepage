---
title: Repairing Broadband Noise and Hum
description: Detect a noise floor or mains hum, choose the matching classical repair stage, and preserve channel relationships in libsonare.
---

# Repairing Broadband Noise and Hum

Broadband noise and mains hum are different defects. A denoiser estimates a time-varying spectrum and applies a gain mask. A dehummer tracks a fundamental and its harmonics. Use the detector for the defect you actually hear, and check that a sustained musical tone is not being mistaken for noise.

## Choose the stage

| Defect | Detect with | Repair with | Main risk |
|---|---|---|---|
| Steady hiss, mic floor, or tape noise | `masteringRepairDetectNoiseFloor` | `masteringRepairDenoiseClassical` | Quiet musical material can be pulled down with the estimated floor. |
| A 50/60 Hz tone and harmonics | `masteringRepairDetectHum` | `masteringRepairDehum` | A notch can remove intentional content at the same frequencies. |

Neither stage is a loudness processor. Neither separates a source from a finished mix, and neither repairs clicks, clipping, or room reverb.

## Detect first, then apply

The request-object form makes the sample rate and options explicit. `decodedMonoPcm` must be a `Float32Array`, and the denoise buffer must contain at least `nFft` samples.

```ts
import {
  init,
  masteringRepairDenoiseClassical,
  masteringRepairDehum,
  masteringRepairDetectHum,
  masteringRepairDetectNoiseFloor,
} from '@libraz/libsonare';

await init();

const sampleRate = 48_000;
const samples = decodedMonoPcm;
const noise = masteringRepairDetectNoiseFloor({
  samples,
  sampleRate,
  nFft: 1024,
});
const hum = masteringRepairDetectHum({ samples, sampleRate });

console.log(noise.floorDbfs, noise.bandFloorDbfs);
console.log(hum.fundamentalHz, hum.harmonics, hum.harmonicDbfs);

// Keep only the stages supported by the reports and an audition.
const dehummed = masteringRepairDehum({
  samples,
  sampleRate,
  adaptive: true,
});
const cleaned = masteringRepairDenoiseClassical({
  samples: dehummed,
  sampleRate,
  reductionDb: 26,
});
```

The example follows the fixed repair order: dehum precedes denoise. In an application, make each call conditional on the report and the listening decision rather than treating a positive measurement as permission to remove all of it.

## Denoise settings

`masteringRepairDenoiseClassical` is an STFT-domain classical denoiser. Its options are the public TypeScript `DenoiseClassicalOptions`; use the API reference for the complete overload list.

| Option | Values or default | Use |
|---|---|---|
| `mode` | `logMmse` (default), `mmseStsa`, `spectralSubtraction` | Select the gain function. Spectral subtraction also reads `overSubtraction` and `spectralFloor`. |
| `noiseEstimator` | `quantile` (default), `mcra`, `imcra`, `spp` | Select how the noise spectrum is tracked. |
| `nFft` / `hopLength` | `1024` / `256` by default | Set the STFT geometry. `nFft` must be a positive power of two. |
| `reductionDb` | `26` by default, finite and non-negative | Set the deepest attenuation of any gain-mask bin. It is a residual-noise floor, not a target loudness. |
| `noiseEstimationQuantile` | `0.1` by default | Fraction of the quietest frames used by the quantile estimator. |
| `ddAlpha`, `speechPresenceGain`, `gainSmoothing` | See the API type | Control decision-directed smoothing and the MMSE gain path. |

At `reductionDb: 26`, the mask floor is a linear gain of about `0.0501`, or a maximum per-bin attenuation of 26 dB; it does not promise that the broadband noise itself becomes 26 dB quieter. A larger value allows deeper attenuation, but it does not make the estimate more reliable. The report's `maxReductionDb` and `floorLimitedFraction` show whether this bound controlled the result.

## Channel handling

Use the mono entry point for one channel, the stereo entry point for a left/right pair, and the linked entry point for any number of channels with one shared mask.

```ts
import {
  masteringRepairDenoiseClassicalLinked,
  masteringRepairDenoiseClassicalStereo,
} from '@libraz/libsonare';

const stereo = masteringRepairDenoiseClassicalStereo({
  left,
  right,
  sampleRate,
  reductionDb: 26,
});

const linked = masteringRepairDenoiseClassicalLinked({
  channels: [frontLeft, frontRight, centre],
  sampleRate,
  reductionDb: 26,
});
```

The stereo and linked forms build the mask from summed channel power and apply it unchanged to every channel. This keeps interchannel level and phase differences from moving. Their report has one pair- or set-level measurement. `floorDbfs` is absolute and rises by about 3.01 dB for two identical channels and 4.77 dB for three, so compare it only with a measurement made over the same channel count. All input channels must have the same length and at least `nFft` samples.

`masteringRepairDehumStereo` keeps separate filter state per channel. With `adaptive: true`, both channels follow one tracked fundamental; with the default `adaptive: false`, each channel filters the configured frequency independently.

## Read the result

`masteringRepairDetectNoiseFloor` reports `floorDbfs` and a 32-band `bandFloorDbfs` shape before any gain mask is applied. It does not report attenuation. The denoise report does:

- `meanReductionDb` is the mean attenuation of the mask;
- `maxReductionDb` is the deepest attenuation applied;
- `floorLimitedFraction` is the fraction of mask cells that reached `reductionDb`.

These values describe what the processor did. They are not LUFS matching and they do not prove that the remaining noise is inaudible. Measure integrated loudness separately if the delivery target requires it.

## Listen to the existing demo

<SonareDemo id="repair-denoise" />

This is the existing classical denoise A/B. It compares the processed buffer without added loudness matching, so changes in noise and timbre remain audible.

## Limits

The denoiser estimates noise from the buffer itself. A calibration tone, drone, or long held note can be treated as noise by the estimator and attenuated along with the floor. Classical denoise is also not DNN restoration or source separation. The detector and repair are offline; a shorter-than-`nFft` input is rejected rather than padded. See [Audio Repair Workflow](./audio-repair.md) for the shared order and [JavaScript mastering API](./js-api-mastering.md) for exact report types.
