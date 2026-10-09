---
title: Audio Repair Workflow
description: Choose, measure, and apply libsonare's repair stages for noise, hum, transient damage, and diffuse reverb.
---

# Audio Repair Workflow

Repair starts with evidence. A click, a clipped peak, a mains hum, a steady noise floor, and a diffuse room tail need different measurements and different algorithms. Measure the original buffer first, choose only the stages the evidence supports, then listen again at the same playback gain.

The six repair stages are classical DSP. They reconstruct or attenuate part of the signal; they do not recover an original recording that was never captured. The stages run in one fixed order inside a mastering chain; when you combine the one-shot APIs, apply that same order yourself.

## Choose the defect

| What you hear or see | Measure first | Candidate stage | Do not use it as a substitute for |
|---|---|---|---|
| A steady broadband hiss or equipment floor | `masteringRepairDetectNoiseFloor` | `denoise` | Removing a tonal hum or a clipped peak |
| A narrow 50/60 Hz tone and harmonics | `masteringRepairDetectHum` | `dehum` | Broadband denoising of the whole spectrum |
| Isolated discontinuities or pops | `masteringRepairDetectClicks` | `declick` | Repairing a flat-topped waveform |
| Flat-topped peaks or a hard digital ceiling | `masteringRepairDetectClipping` | `declip` | Restoring samples that were overwritten for a long time |
| Many short, sample-scale surface defects | `masteringRepairDetectCrackle` | `decrackle` | Removing a sustained noise floor |
| A sustained, diffuse tail after the direct sound | `masteringRepairDetectReverb` | `dereverb` | Room-impulse-response deconvolution |
| Unwanted silence at the beginning or end | `masteringRepairDetectTrimRange` | `masteringRepairTrimSilence` (separate utility) | It is not one of the six repair stages. See the [CLI recording-cleanup workflow](./use-cases/recording-cleanup.md). |

The detectors report what their corresponding algorithm measures. They are not a universal damage score, and a non-zero result still needs an audition. In particular, a full-scale sine or a square wave can look clipped to a time-domain detector even when it was intentional.

## Measure before repair

These detectors are exported by the WebAssembly package. `samples` below is a decoded mono `Float32Array`; keep the original sample rate instead of resampling only for the detector.

```ts
import {
  init,
  masteringRepairDetectClipping,
  masteringRepairDetectClicks,
  masteringRepairDetectCrackle,
  masteringRepairDetectHum,
  masteringRepairDetectNoiseFloor,
  masteringRepairDetectReverb,
} from '@libraz/libsonare';

await init();

const reports = {
  clipping: masteringRepairDetectClipping(samples, sampleRate),
  clicks: masteringRepairDetectClicks(samples, sampleRate),
  crackle: masteringRepairDetectCrackle(samples, sampleRate),
  hum: masteringRepairDetectHum(samples, sampleRate),
  noise: masteringRepairDetectNoiseFloor(samples, sampleRate),
  reverb: masteringRepairDetectReverb(samples, sampleRate),
};

console.log(reports);
```

The denoise and dereverb detectors pad a buffer shorter than `nFft` for analysis, so a short clip is measured rather than refused. A 512-sample input to `masteringRepairDenoiseClassical` returns a 512-sample result.

## Fixed stage order

When more than one defect is present, apply only the selected stages in this order. This is also the order used by the repair slot in `masterAudio` and `masteringChain`.

| Order | Stage | Why this position matters |
|---:|---|---|
| 1 | `declip` | A flat clipped region can hide the transient that the click detector needs to see. |
| 2 | `declick` | Repair isolated discontinuities after clipped peaks have been reconstructed. |
| 3 | `decrackle` | Smooth dense, sample-scale surface defects after the larger impulses are gone. |
| 4 | `dehum` | Remove the tracked fundamental and harmonics before estimating broadband noise. |
| 5 | `denoise` | Estimate and attenuate the remaining stationary spectral floor. |
| 6 | `dereverb` | Run last because a broadband floor can look like a sustained late tail. |

The order does not mean that every stage should run. A clean recording should skip the stages whose detectors do not support them. Re-run the relevant detector after a strong repair and keep the before/after reports with the rendered file.

## Restoration presets

The restoration presets are named chain configurations, not new algorithms. They enable repair stages only and do not add loudness normalization, a target, or a final limiter. Their current stage choices are:

| Preset | Intended source | Enabled repair stages |
|---|---|---|
| `vinyl` | LP transfer with clicks, crackle, and a noise floor | `declick`, `decrackle`, `denoise` |
| `tapeHiss` | Tape transfer whose main defect is broadband hiss | `denoise` |
| `fieldRecording` | Location recording with noise, possible hum, and room tail | `denoise`, adaptive `dehum`, `dereverb` |
| `voiceMemo` | Phone or laptop capture with possible clipping, noise, and room tail | `declip`, `denoise`, `dereverb` |
| `shellac78` | 78 rpm transfer with wider clicks and denser surface noise | `declick`, `decrackle`, deeper `denoise` |

Read the exact preset parameters in [Mastering Processors](./mastering-processors.md#restoration-presets). A preset is a starting point: inspect the source and the report before keeping its output.

## Measure and repair in one call

`masteringRepairAnalyze` runs all six detectors on every channel and returns the defects per channel, the aggregate, whether a declip at the measured flat level leaves louder audio alone (`declipThresholdSafe`), and the stages the evidence supports in `recommended`, each with its settings. It never recommends dereverb, because the late-decay statistic cannot tell a sustaining dry source from a reverberant one. `masteringRepairApply` takes those stages, or your own, and runs them over a channel set of any size.

```ts
import { init, masteringRepairAnalyze, masteringRepairApply } from '@libraz/libsonare';

await init();

const analysis = masteringRepairAnalyze({ channels: [left, right], sampleRate });
console.log(analysis.recommended.map((s) => s.stage), analysis.explanation);

const { channels, reports } = masteringRepairApply({
  channels: [left, right],
  sampleRate,
  stages: analysis.recommended,
  onProgress: (fraction, stage) => console.log(stage, fraction), // "repair.declick", 0.5
  cancel: () => userPressedStop,
});
```

- `stages` is `[{ stage, ...settings }]`. The settings are the stage's catalog parameters (`repair.declick`, `repair.dehum`, `repair.denoiseClassical`, ...); a setting left out takes the default, and an unknown setting, a repeated stage, or an out-of-range value is refused with `InvalidParameter`.
- The stages run in the fixed order above whatever order the array gives.
- Declip, declick, and dehum decide over the whole channel set: a defect found in one channel is repaired in all of them, and dehum tracks one fundamental. Decrackle runs each channel alone. Denoise and dereverb apply one linked mask. The first three groups report once per channel (`scope: 'channel'`); the linked stages report once for the set (`scope: 'linked'`).
- `onProgress` is called after each stage with the fraction done and `repair.<stage>`. When `cancel` returns true after a report, the call throws a `SonareError` with code `Cancelled`.

The same pair exists on Node under the same names and in Python as `mastering_repair_analyze(channels, sample_rate)` and `mastering_repair_apply(channels, sample_rate, stages=[...], on_progress=..., cancel=...)`, which also accept a 2-D `(channels, frames)` array. The Python result exposes `.channels` and `.reports`. The individual detectors and stages follow the same `mastering_repair_` prefix in Python (`mastering_repair_detect_hum`, `mastering_repair_declick_stereo`, `mastering_repair_denoise_classical_linked`, `mastering_repair_dereverb_config_for_room`, `mastering_repair_noise_band_bins`).

## Realtime inserts

Four of the stages are causal and run as realtime mixer inserts under their catalog ids: `repair.decrackle` (median mode), `repair.dehum`, `repair.denoiseClassical`, and `repair.dereverbClassical` (subtraction mask). Each reproduces its offline function for the same settings, delayed by the latency the instance reports. A setting that needs the whole signal (wavelet decrackle, WPE, the quantile noise estimator) is refused by name, and the insert's denoise estimator defaults to `spp`. Denoise and dereverb link their masks across the insert's channels.

`repair.declick`, `repair.declip`, and `repair.trimSilence` are offline only; the capability catalog marks them `causal: false`. See [Effects Inserts](./effects-inserts.md) for how a host reads the catalog.

## Trimming silence

`masteringRepairTrimSilence` keeps a margin around the signal: `paddingSamples`, or `paddingSec` for the same margin in seconds rounded to the nearest sample. Give one or the other. At 22.05 kHz, `paddingSec: 0.1` on a 1 s tone with 1 s of silence on each side returns 26460 samples (1.2 s); the same input without padding returns 22050. A negative padding throws `RangeError`.

Accepted ranges: `threshold` in `[0, 1]`, `paddingSamples` up to `960000`, `windowMs` in `(0, 10000]`, and `gateLufs` in `[-144, 0]` for `lufsGated` mode. A value outside them throws `InvalidParameter`.

## Offline contract

- The `masteringRepair*` functions consume a complete buffer and return a new buffer or a result containing new channel buffers. Apart from the four realtime inserts above, they are offline operations.
- All six repair stages preserve input length in their mono and stereo forms. Denoise and dereverb also provide linked forms for more than two channels. The separate `masteringRepairTrimSilence` utility is the boundary operation that can shorten a buffer.
- Denoise and dereverb pad an input shorter than `nFft` for analysis and return it at its own length. Every stage refuses a setting above its upper bound; the bounds are listed on the stage pages. Other validation rules are in the [JavaScript mastering API](./js-api-mastering.md).
- Repair does not match LUFS or add gain to make the result appear equally loud. Measure loudness separately and compare at a controlled playback gain.

The [DSP implementation notes](./dsp-implementation.md#repair) explain the classical algorithms and their real-time boundary. For the exact overloads and report fields, use the [JavaScript mastering API](./js-api-mastering.md).

<SonareDemo id="repair-denoise" />

This embedded A/B uses the classical denoiser and does not apply loudness matching. It is a listening aid for the offline comparison workflow; select a repair stage only after inspecting the source.
