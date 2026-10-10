---
title: Repairing Clipping, Clicks, and Crackle
description: Detect and repair impulsive defects with libsonare's declip, declick, and decrackle stages, including their stereo contracts.
---

# Repairing Clipping, Clicks, and Crackle

Clipping, clicks, and crackle are all short-time defects, but their evidence is different. Clipping creates runs at or near a ceiling, a click is an isolated discontinuity, and crackle is a dense set of sample-scale deviations. Detect each defect before choosing its reconstruction method.

## Select a detector

| Defect | Detector | Repair stage | What to inspect |
|---|---|---|---|
| A flat-topped or over-threshold peak | `masteringRepairDetectClipping` | `masteringRepairDeclip` | `sampleCount`, `runCount`, and `longestRunSamples`; long runs use an interpolation fallback. |
| An isolated impulse-like discontinuity | `masteringRepairDetectClicks` | `masteringRepairDeclick` | `count`, `rejected`, `longestRunSamples`, and `perSecond`. |
| Dense sample-scale surface damage | `masteringRepairDetectCrackle` | `masteringRepairDecrackle` | `sampleCount`, `sampleFraction`, and `perSecond`. |

Detection is source-dependent. A square wave, pulse train, or fully limited signal can look like a flat top, while downmixing, resampling, or lossy coding can erase a real flat top. Inspect each original channel before any downmix.

## Detect in repair order

The following mono workflow detects again after each selected stage, so later measurements see the waveform that the previous repair produced.

```ts
import {
  init,
  masteringRepairDeclick,
  masteringRepairDeclip,
  masteringRepairDecrackle,
  masteringRepairDetectClicks,
  masteringRepairDetectClipping,
  masteringRepairDetectCrackle,
} from '@libraz/libsonare';

await init();

let repaired = samples;
const clipping = masteringRepairDetectClipping(repaired, sampleRate);
if (clipping.sampleCount > 0) {
  repaired = masteringRepairDeclip(repaired, sampleRate);
}

const clicks = masteringRepairDetectClicks(repaired, sampleRate);
if (clicks.count > 0) {
  repaired = masteringRepairDeclick(repaired, sampleRate);
}

const crackle = masteringRepairDetectCrackle(repaired, sampleRate);
if (crackle.sampleCount > 0) {
  repaired = masteringRepairDecrackle(repaired, sampleRate);
}
```

The positive-count checks are only a starting point. Review the waveform and audition each change; a detector cannot know whether a clipped-looking waveform was intentional.

## Listen to a transient-repair A/B

<SonareDemo id="repair-clicks" />

This A/B uses the real WASM declicker on a damaged vinyl-style clip. It does not inject noise, match loudness, or run declip/decrackle/dehum. The source still contains hum, hiss, crackle, and musical attacks, so use it to hear the local click repair rather than as a promise that every defect is removed.

## Preserve a stereo image

For stereo, pass both channels to the paired functions. Calling the mono function on each side independently can repair one channel while leaving a matching event in the other channel untouched.

```ts
import {
  masteringRepairDeclickStereo,
  masteringRepairDeclipStereo,
  masteringRepairDecrackleStereo,
} from '@libraz/libsonare';

const declipped = masteringRepairDeclipStereo({
  left,
  right,
  sampleRate,
});
const declicked = masteringRepairDeclickStereo({
  left: declipped.left,
  right: declipped.right,
  sampleRate,
});
const decrackled = masteringRepairDecrackleStereo({
  left: declicked.left,
  right: declicked.right,
  sampleRate,
});
console.log(decrackled.leftReport, decrackled.rightReport);
```

`declipStereo` takes the union of both channels' clipped runs. A channel with no clipped sample in a union run is left untouched there; each channel still gets its own reconstruction and report. `declickStereo` repairs a run selected by either channel in both channels, while each fill uses that channel's own samples and LPC model. `decrackleStereo` processes each channel independently because surface scratches do not form a shared event.

## Read the reports

| Stage | Useful report fields | Interpretation |
|---|---|---|
| Declip | `lpcReconstructedRuns`, `interpolatedRuns`, `repairedSamples` | A run longer than 512 samples uses cubic or linear interpolation; LPC options do not change that fallback. |
| Declick | `detected.rejected`, `repairedRuns`, `linkedRuns`, `lpcModelUsed` | A large `rejected` count usually means `maxClickSamples` or `neighborRatio` is too tight, not that the recording is clean. |
| Decrackle | `replacedSamples` or `shrunkCoefficients` | The detector always uses the median criterion. Wavelet mode removes detail coefficients without declaring each removed sample to be crackle. |

The detector and repair use signal-level thresholds, not a promise that every damaged sample can be restored. Clipping discards information; reconstruction estimates the missing shape from nearby samples. Keep the original and compare the result at a controlled playback gain.

In a chain config or override, `repair.decrackle.mode` takes `median` (0) or `waveletShrinkage` (1); any other value is refused with `unknown decrackle mode`.

## Settings and accepted ranges

Each option has an upper bound. A value above it throws `InvalidParameter` on every surface, including the named-processor path.

| Stage | Option | Default | Accepted |
|---|---|---|---|
| Declick | `threshold` | `0.8` | `(0, 10]` |
| Declick | `neighborRatio` | `4` | `(0, 100]` |
| Declick | `maxClickSamples` | `8` | `[1, 512]`; 512 is the longest gap the AR fill solves |
| Declick | `lpcOrder` | `20` | `[0, 2048]` |
| Declick | `residualRatio` | `8` | `(0, 1000]` |
| Declip | `clipThreshold` | `0.98` | `(0, 1]` |
| Declip | `lpcOrder` | `36` | `[0, 2048]` |
| Declip | `iterations` | `2` | `[1, 8]` |
| Declip | `lpcBlend` | `0.65` | `[0, 1]` |
| Decrackle | `threshold` | `0.4` | `(0, 1000]` |
| Decrackle | `levels` | `4` | `[1, 24]` |

Declick fills every selected run linearly between its two anchoring samples before any run is solved with the AR model, so the context an AR solve reads never contains a click that has not been repaired yet. Runs that touch or overlap, including those selected by different channels in the stereo form, are joined into one region, because a neighbouring click cannot anchor the fill.

The causal stages, decrackle in median mode among them, also run as realtime inserts; declick and declip do not. See [Audio Repair Workflow](./audio-repair.md#realtime-inserts).

## Limits and the shared order

The complete repair order is `declip → declick → decrackle → dehum → denoise → dereverb`. Clipping is first because a flat region can hide a click; the remaining impulsive stages run before spectral noise and reverb estimation. The functions here are offline whole-buffer operations (decrackle also exists as a realtime insert) and do not perform LUFS matching. For the broader decision flow, see [Audio Repair Workflow](./audio-repair.md), and for exact option types see the [JavaScript mastering API](./js-api-mastering.md).
