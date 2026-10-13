---
title: Repairing Broadband Noise and Hum
description: Detect a noise floor or mains hum, choose the matching classical repair stage, and preserve channel relationships in libsonare.
---

# Repairing Broadband Noise and Hum

Broadband noise and mains hum are different defects. A denoiser estimates a time-varying spectrum and applies a gain mask. A dehummer tracks a fundamental and its harmonics. Use the detector for the defect you actually hear, and check that a sustained musical tone is not being mistaken for noise.

::: info Terms on this page
- **STFT** (short-time Fourier transform): the signal cut into overlapping frames of `nFft` samples, `hopLength` apart, each turned into a spectrum of frequency bins. See [Spectrogram and STFT](./glossary/analysis/spectrogram-stft.md).
- **Gain mask**: one gain between a floor and 1 per bin and frame; the denoiser multiplies the spectrum by it and converts back to audio.
- **Noise estimator**: how the noise level in each bin is worked out. `quantile` averages the quietest 10% of frames into one fixed spectrum; `mcra`, `imcra` and `spp` track the noise frame by frame and can follow a changing floor.
- **MMSE-STSA / LogMMSE**: gain rules that set each bin's gain from its estimated signal-to-noise ratio; **spectral subtraction** subtracts the noise power instead. The decision-directed smoothing (`ddAlpha`) keeps the gains from flickering into "musical noise".
- **Fundamental and harmonics**: mains hum is a tone at 50 or 60 Hz plus whole-number multiples of it. `subtract` mode cancels each one with a tracked sine; `notch` mode filters each one out with a narrow notch.
:::

## Choose the stage

| Defect | Detect with | Repair with | Main risk |
|---|---|---|---|
| Steady hiss, mic floor, or tape noise | `masteringRepairDetectNoiseFloor` | `masteringRepairDenoiseClassical` | Quiet musical material can be pulled down with the estimated floor. |
| A 50/60 Hz tone and harmonics | `masteringRepairDetectHum` | `masteringRepairDehum` | A notch can remove intentional content at the same frequencies. |

The hum detector only reports a stationary line: a repeating kick reads `fundamentalProminence` 1.0, a linear ratio where 1.0 means no peak (it is not a lock flag). Neither stage is a loudness processor. Neither separates a source from a finished mix, and neither repairs clicks, clipping, or room reverb.

## Detect first, then apply

The request-object form makes the sample rate and options explicit. `decodedMonoPcm` must be a `Float32Array`. A buffer shorter than `nFft` is padded for the analysis and comes back at its own length.

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
| `noiseEstimator` | `quantile` (default), `mcra`, `imcra`, `spp` | Select how the noise spectrum is tracked. A chain override takes the same names (`repair.denoise.noiseEstimator`, `repair.denoise.mode`, `repair.dehum.mode`). The streaming mastering chain defaults to `spp` and refuses `quantile` by name; the capability catalog describes that realtime insert, so it lists `spp` as the default and leaves out `quantile`. |
| `nFft` / `hopLength` | `1024` / `256` by default | Set the STFT window length and hop. See the constraints below. |
| `reductionDb` | `26` by default, finite and in `[0, 120]` | Set the deepest attenuation of any gain-mask bin. It is a residual-noise floor, not a target loudness. |
| `noiseEstimationQuantile` | `0.1` by default | Fraction of the quietest frames used by the quantile estimator. |
| `ddAlpha`, `speechPresenceGain`, `gainSmoothing` | See the API type | Control decision-directed smoothing and the MMSE gain path. |

At `reductionDb: 26`, the mask floor is a linear gain of about `0.0501`, or a maximum per-bin attenuation of 26 dB; it does not promise that the broadband noise itself becomes 26 dB quieter. A larger value allows deeper attenuation, but it does not make the estimate more reliable. The report's `maxReductionDb` and `floorLimitedFraction` show whether this bound controlled the result.

`nFft` must be a power of two from `4` through `524288`. `hopLength` must be in `(0, nFft / 2]`, and the periodic-Hann analysis window with the symmetric-Hann synthesis window must cover every overlap residue; a pair that leaves one uncovered is rejected. Offline mono, stereo, and linked repair and `StreamingDenoise` (including the `StreamingMasteringChain` live path) share this check. Streaming additionally requires a recursive estimator (`mcra`, `imcra`, or `spp`).

## Dehum settings

`masteringRepairDehum` removes the fundamental and its harmonics. Every option has an upper bound; a larger value throws `InvalidParameter`.

| Option | Default | Accepted | Use |
|---|---|---|---|
| `fundamentalHz` | `50` | `(0, 5000]` | Mains frequency to remove; set `60` where the supply is 60 Hz. |
| `harmonics` | `4` | `[1, 16]` | Number of harmonics, fundamental included. |
| `mode` | `subtract` | `subtract`, `notch` | Cancel the tracked sinusoids, or filter with notches. |
| `q` | `20` | `(0, 100]` | Selectivity of each canceller or notch. |
| `adaptive` | `false` | boolean | Search for the actual fundamental instead of trusting `fundamentalHz`. |
| `searchRangeHz` | `2` | `[0, 100]` | Half-width of the adaptive search around `fundamentalHz`. |
| `adaptation`, `pllBandwidth` | `0.25`, `0.01` | `[0, 1]` | Adaptive tracking speed. |
| `frameSize` | `2048` | `[16, 16384]` | Analysis frame of the adaptive tracker. |

In `subtract` mode each harmonic canceller starts from a joint least-squares fit of all the harmonic references over the opening window instead of from zero, so a short clip is attenuated from its first samples. When the window is too short to tell the harmonics apart, the cancellers are left unseeded. On a 0.25 s clip carrying 50 Hz and 100 Hz hum under a 440 Hz tone at 22.05 kHz, the RMS of the first 1000 samples fell from 0.1675 to 0.0355, which is the tone alone.

<SonareDemo id="repair-dehum" />

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
  channels: [frontLeft, frontRight, center],
  sampleRate,
  reductionDb: 26,
});
```

The stereo and linked forms build the mask from summed channel power and apply it unchanged to every channel. This keeps interchannel level and phase differences from moving. Their report has one pair- or set-level measurement. `floorDbfs` is absolute and rises by about 3.01 dB for two identical channels and 4.77 dB for three, so compare it only with a measurement made over the same channel count. All input channels must have the same length; one shorter than `nFft` is padded for the analysis.

`masteringRepairDehumStereo` keeps independent filter or canceller state per channel, but with `adaptive: true` it tracks one fundamental for both. It chooses the channel with the stronger hum as the tracking reference, searches from the summed projected energy of both original channels, and sends one tracked fundamental to both paths. Hum on only one side and opposite-phase hum therefore remain visible to the tracker, while each channel's amplitude and phase are handled by its own state. With the default `adaptive: false`, each channel filters the configured frequency independently.

## Read the result

`masteringRepairDetectNoiseFloor` reports `floorDbfs` and a 32-band `bandFloorDbfs` shape before any gain mask is applied. It does not report attenuation. `masteringRepairNoiseBandBins({ nFft, sampleRate })` returns the 33 bin edges of those 32 bands, so band `k` spans bins `bins[k]` to `bins[k + 1]`; a band whose edges coincide is empty, and its level is a fixed placeholder value, not a measurement.

The mono denoise call returns only the samples. For the attenuation numbers, call `masteringRepairDenoiseClassicalStereo` or `masteringRepairDenoiseClassicalLinked` (a one-channel linked call works) or `masteringRepairApply`. Their report contains:

- `meanReductionDb` is the mean attenuation of the mask;
- `maxReductionDb` is the deepest attenuation applied;
- `floorLimitedFraction` is the fraction of mask cells that reached `reductionDb`.

These values describe what the processor did. They are not LUFS matching and they do not prove that the remaining noise is inaudible. Measure integrated loudness separately if the delivery target requires it.

## Listen to a denoise A/B

<SonareDemo id="repair-denoise" />

This A/B uses the classical denoiser and applies no loudness matching, so changes in noise and timbre remain audible.

## Limits

The denoiser estimates noise from the buffer itself. A calibration tone, drone, or long held note can be treated as noise by the estimator and attenuated along with the floor. Classical denoise is not a learned model either: speech-enhancement networks generally remove noise from voice more cleanly, especially noise that changes over time, while this denoiser is deterministic and needs no model weights. See [Signal processing versus learned models](./source-separation.md#signal-processing-versus-learned-models). The detector and classical helper calls are offline; `StreamingDenoise` and `StreamingMasteringChain` provide block processing for denoise with `mcra`, `imcra`, or `spp`, while the whole-signal `quantile` estimator is rejected. See [Audio Repair Workflow](./audio-repair.md) for the shared order and [JavaScript mastering API](./js-api-mastering.md) for exact report types.
