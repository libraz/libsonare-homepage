---
title: Audio Repair Workflow
description: Choose, measure, and apply libsonare's offline repair stages for noise, hum, transient damage, and diffuse reverb.
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

The denoise detector needs at least `nFft` samples and rejects a shorter buffer. The dereverb detector pads a shorter buffer for analysis. Keep those different contracts in mind when you process short clips.

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

## Offline contract

- The `masteringRepair*` functions consume a complete buffer and return a new buffer or a result containing new channel buffers. They are offline operations, not streaming or AudioWorklet stages.
- All six repair stages preserve input length in their mono and stereo forms. Denoise and dereverb also provide linked forms for more than two channels. The separate `masteringRepairTrimSilence` utility is the boundary operation that can shorten a buffer.
- Denoise analysis rejects an input shorter than `nFft`; dereverb pads a short input for analysis and repair. Other validation rules are in the [JavaScript mastering API](./js-api-mastering.md).
- Repair does not match LUFS or add gain to make the result appear equally loud. Measure loudness separately and compare at a controlled playback gain.

The [DSP implementation notes](./dsp-implementation.md#repair) explain the classical algorithms and their real-time boundary. For the exact overloads and report fields, use the [JavaScript mastering API](./js-api-mastering.md).

<SonareDemo id="repair-denoise" />

This embedded A/B uses the classical denoiser and does not apply loudness matching. It is a listening aid for the offline comparison workflow; select a repair stage only after inspecting the source.
