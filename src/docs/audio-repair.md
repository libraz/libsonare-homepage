---
title: Audio Repair Workflow
description: Choose, measure, and apply libsonare's repair stages for noise, hum, transient damage, and diffuse reverb.
---

# Audio Repair Workflow

Repair starts with evidence. A click, a clipped peak, a mains hum, a steady noise floor, and a diffuse room tail need different measurements and different algorithms. Measure the original buffer first, choose only the stages the evidence supports, then listen again at the same playback gain.

If *dBFS*, *noise floor*, or *clipping* are unfamiliar, read [Audio Basics](./glossary/concepts/audio-basics.md) first — this page assumes that vocabulary and focuses on which repair stage to run.

The six repair stages are classical DSP. They reconstruct or attenuate part of the signal; they do not recover an original recording that was never captured. The stages run in one fixed order inside a mastering chain; when you combine the one-shot APIs, apply that same order yourself.

::: info Terms on this page
- **Detector**: a measurement that reports evidence for one defect (counts, levels, fractions) without changing the audio.
- **Linked**: one gain mask computed from all channels together and applied to each, so the level and timing relationship between channels does not move.
- **Causal**: a stage that needs only the audio it has already seen, plus a fixed delay, so it can run on a live stream; a non-causal stage needs the whole buffer.
- **Latency and tail**: latency is how many samples late a realtime stage's output is; tail is how many samples of output keep coming after the input stops.
- **Streaming-safe noise estimator**: the `spp` estimator, which tracks the noise frame by frame instead of ranking the whole file, so the same denoise can run offline and live.
:::

## Choose the defect

| What you hear or see | Measure first | Candidate stage | Do not use it as a substitute for |
|---|---|---|---|
| A steady broadband hiss or equipment floor | `masteringRepairDetectNoiseFloor` | `denoise` | Removing a tonal hum or a clipped peak |
| A narrow 50/60 Hz tone and harmonics | `masteringRepairDetectHum` | `dehum` | Broadband denoising of the whole spectrum |
| Isolated discontinuities or pops | `masteringRepairDetectClicks` | `declick` | Repairing a flat-topped waveform |
| Flat-topped peaks or a hard digital ceiling | `masteringRepairDetectClipping` | `declip` | Restoring samples that were overwritten for a long time |
| Many short, sample-scale surface defects | `masteringRepairDetectCrackle` | `decrackle` | Removing a sustained noise floor |
| A sustained, diffuse tail after the direct sound | `masteringRepairDetectReverb` | `dereverb` | Room-impulse-response deconvolution |

Unwanted silence at the start or end is a separate utility, `masteringRepairTrimSilence` (detect it with `masteringRepairDetectTrimRange`); see [Trimming silence](#trimming-silence) and the [CLI recording-cleanup workflow](./use-cases/recording-cleanup.md).

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

<RepairStagesFigure
  title="Repair stages in run order"
  caption="Each detector enables one stage. Short-time defects are repaired first, then the sustained ones, so every detector and estimator sees material the stage before it has already cleaned."
/>

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

`masteringRepairAnalyze` runs all six detectors on every channel and returns the stages the evidence supports, each with its settings. `masteringRepairApply` runs those stages, or your own, over a channel set of any size. The recommendation is the same repair selection the [mastering assistant](./mastering-assistant.md#masteringassistantsuggest-—-propose-a-chain) makes when `enableRepair` is on.

::: code-group

```ts [Browser]
import { ErrorCode, init, isSonareError, masteringRepairAnalyze, masteringRepairApply } from '@libraz/libsonare';

await init();

const analysis = masteringRepairAnalyze({ channels: [left, right], sampleRate });
console.log(analysis.recommended.map((s) => s.stage), analysis.explanation);

let userPressedStop = false; // set from a Stop button
try {
  const { channels, reports } = masteringRepairApply({
    channels: [left, right],
    sampleRate,
    stages: analysis.recommended,
    onProgress: (fraction, stage) => console.log(stage, fraction), // "repair.declick", 0.33
    cancel: () => userPressedStop,
  });
} catch (error) {
  if (isSonareError(error) && error.code === ErrorCode.Cancelled) {
    // The user stopped the run; nothing was returned.
  } else {
    throw error;
  }
}
```

```python [Python]
import libsonare

analysis = libsonare.mastering_repair_analyze([left, right], 48000)
print([s["stage"] for s in analysis["recommended"]], analysis["explanation"])

result = libsonare.mastering_repair_apply(
    [left, right], 48000, stages=analysis["recommended"]
)
print(result.reports[0].stage)  # the first stage that ran, e.g. "declick"
cleaned = result.channels
```

```bash [CLI]
# Measure and report only; writes nothing
sonare repair noisy.wav --detect --json

# Measure, choose the stages, repair, and say why each was chosen
sonare repair noisy.wav -o clean.wav --explain
```

:::

Node uses the same names as the browser build. `masteringRepairAnalyze` returns:

| Field | Meaning |
|---|---|
| `defects` | The channels' detector results, aggregated |
| `channels` | Each channel's own `defects`, in input order |
| `declipThresholdSafe` | Whether a declip at the measured flat level leaves louder unclipped audio alone; when `false`, declip is withheld from `recommended` |
| `integratedLufs` | Programme loudness the noise floor is compared against |
| `recommended` | The supported stages in application order, each with every setting; pass it to `masteringRepairApply` as it stands |
| `explanation` | Why each stage was or was not chosen |

Dereverb is never recommended, because the late-decay statistic cannot tell a sustaining dry source from a reverberant one. When a denoise is recommended it uses the streaming-safe noise estimator unless you pass `preferStreamingSafe: false` (Python `prefer_streaming_safe=False`).

How `stages` and the reports are spelled:

| Where | Spelling |
|---|---|
| `stage` in `stages`, and `reports[].stage` | The bare name (`declick`). `repair.declick` is refused. |
| Setting names beside `stage` | The catalog parameters of the matching processor (`repair.declick` has `maxClickSamples`). A setting left out takes its default; an unknown setting, a repeated stage, or an out-of-range value is refused with `InvalidParameter`. |
| The `onProgress` stage argument | `repair.<stage>` |

- The stages run in the fixed order above whatever order the array gives.
- Declip, declick, and dehum decide over the whole channel set: a defect found in one channel is repaired in all of them, and dehum tracks one fundamental. Decrackle runs each channel alone. Denoise and dereverb apply one linked mask. The first three groups report once per channel (`scope: 'channel'`); the linked stages report once for the set (`scope: 'linked'`).
- `onProgress` is called after each stage with the fraction done. When `cancel` returns true after a report, the call throws a `SonareError` with code `Cancelled`.

The individual detectors and stages carry the same `mastering_repair_` prefix in Python (`mastering_repair_detect_hum`, `mastering_repair_declick_stereo`, `mastering_repair_denoise_classical_linked`, `mastering_repair_dereverb_config_for_room`, `mastering_repair_noise_band_bins`). The CLI command is described in [CLI reference](./cli.md#repair) and the [recording-cleanup workflow](./use-cases/recording-cleanup.md).

## Realtime inserts

Four of the stages are causal and run as realtime mixer inserts under their catalog ids. Each reproduces its offline function for the same settings, delayed by the latency the instance reports. Denoise and dereverb link their masks across the insert's channels.

| Insert | Latency | Tail | Cost |
|---|---:|---:|---|
| `repair.decrackle` (median mode) | 1 | 1 | low |
| `repair.dehum` | 0 | 146567 | low |
| `repair.denoiseClassical` | 1279 | 1023 | moderate |
| `repair.dereverbClassical` (subtraction mask) | 1023 | 1023 | moderate |

Latency and tail are in samples, at 48 kHz with default settings. `masteringInsertTiming(name, params, sampleRate)` returns the figures for your own configuration, and a bounce must keep pulling output for `tailSamples` after the input ends so the tail is not cut off (`repair.dehum` rings for about 3 s).

A setting that needs the whole signal is refused by name: wavelet decrackle (`mode: 1`), WPE, and the quantile noise estimator (`noiseEstimator: 0`), so the insert's denoise estimator defaults to `spp`. In a mixer scene an enum setting is the choice's number, not its name:

```json
{ "processor": "repair.denoiseClassical", "slot": "pre", "params": { "reductionDb": 20, "noiseEstimator": 3 } }
```

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
