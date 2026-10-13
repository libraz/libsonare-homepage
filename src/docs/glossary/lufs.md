---
title: LUFS
description: Loudness Units relative to Full Scale for mastering and streaming targets.
---

# LUFS

LUFS (Loudness Units relative to Full Scale) measures perceived loudness — how loud audio actually feels to a listener over time. This is more useful for mastering than raw peak level (the highest instantaneous sample value), because a single loud peak says little about how loud the whole track feels.
Two tracks can have the same peak value while one feels much louder because it stays close to its peak for more of its duration — its waveform is "denser", fuller, with less variation between loud and quiet moments. LUFS is the meter that helps describe that difference.

| Target | Common Use |
|--------|------------|
| -14 LUFS | General streaming music targets such as Spotify and YouTube. |
| -16 LUFS | Speech, podcasts, Apple-oriented targets, and more dynamic music. |
| -9 LUFS | The engine's `club` and `cd` delivery target (with a -0.3 dBTP ceiling), chosen for density rather than taken from a published standard. |

## Why It Matters

If two masters are compared without matching loudness, the louder one usually sounds better at first. This is why the `/mastering` demo enables loudness-matched A/B playback by default.

Loudness is only one delivery constraint. A master also needs enough [True Peak Safety](./concepts/true-peak-safety.md), and its [Dynamic Range](./concepts/dynamic-range.md) should fit the musical intent.

<SonareDemo id="loudness-meter" />

## How It Is Computed

LUFS is defined by ITU-R BS.1770. It is a mean-square (power) measurement, so it uses the `10 · log10` form of the decibel ([Audio Basics](./concepts/audio-basics.md#amplitude-and-db)), with a filter in front that makes it follow hearing more closely than a plain RMS meter.

| Step | What happens |
|------|--------------|
| K-weighting | Each channel passes through a high-shelf filter that lifts the upper frequencies by about 4 dB (the effect of the head on incoming sound) and a high-pass that discounts deep bass, where hearing is less sensitive. |
| Mean square per block | The weighted signal is squared and averaged over 400 ms blocks that start every 100 ms (75% overlap). |
| Channel sum | The channels' block powers are added. Left, right, and center count once each, and the LFE channel is left out. A surround channel counts about 1.41 times (+1.5 dB) when its loudspeaker sits to the side (the 5.1 surrounds and the 7.1 side pair), and once when it sits behind (the 7.1 back pair and the quad surrounds). |
| Decibels | `loudness = -0.691 + 10 · log10(sum)`. The -0.691 cancels the K-weighting's gain at 1 kHz. |
| Gating and averaging | For the integrated reading, the gates below decide which blocks count, and the survivors are averaged as power. |

**Momentary** loudness is a single 400 ms block and **short-term** loudness a 3 s window; the integrated reading covers the whole programme. Differences are counted in LU, and 1 LU is the same step as 1 dB. Two anchors make the scale concrete: a 1 kHz sine peaking at full scale in a mono file reads about -3.0 LUFS (its RMS is -3.01 dBFS), and the same sine in both channels of a stereo file reads about 0 LUFS, because the two channels' powers add.

## What "Gated" Means

An integrated LUFS reading is not the average of the whole file. Loudness is measured in short blocks, and two gates decide which blocks are allowed to count: an **absolute** gate at -70 LUFS drops silence outright, then a **relative** gate 10 LU below the surviving average drops the quiet material as well.

<LoudnessGateFigure
  title="Which blocks reach the average"
  caption="In this example, the intro falls below the relative gate and is excluded. A quieter passage above the gate still contributes to the average. Adding a long silent tail does not lower integrated LUFS."
/>

Silence below the absolute gate is excluded. A fade-in or spoken intro can lower integrated LUFS if its blocks remain above the relative gate; only blocks below the threshold are excluded. The meter evaluates the whole programme that passes the gates, including speech when present.

## Choosing a Target

If you are unsure, start at -14 LUFS. It is a practical target for many music and video platforms, and it usually does not require crushing the limiter to reach.

Speech and podcasts often work better with a little more room, such as -16 LUFS, because intelligibility and comfort matter more than maximum density. Dance and club-style masters may sit much closer to full scale (the engine's `club` and `cd` targets use -9 LUFS), but only when the low end remains controlled, the true peak ceiling is safe, and the result is not fatiguing.

When a streaming platform applies its own normalization, masters that overshoot the target are simply turned down on playback. Overshooting therefore does not always give you a loudness win — a master driven hard into a deep limiter can end up with the same playback loudness as a gentler one, just with less punch left after the platform pulls it down.

## Do Not Chase the Number

Hitting a LUFS target is not sufficient evidence that the master is good. A master can land on the target while the limiter has crushed transients, the low end has thinned, or the sibilants have started to bite.

The opposite is also true: for some material, sitting a little below the target sounds more natural. For acoustic, speech, and sparse music, loudness-matched A/B and cross-environment checks are usually more informative than chasing the last decibel.

## Measure it in libsonare

`lufs` returns the integrated reading, the momentary and short-term values at the end of the file, and the loudness range.

::: code-group

```typescript [Browser]
import { init, lufs } from '@libraz/libsonare';

await init();

const { integratedLufs, shortTermLufs, loudnessRange } = lufs(samples, sampleRate);
```

```python [Python]
import libsonare as sonare

result = sonare.Audio.from_file("song.wav").lufs()
result.integrated_lufs, result.short_term_lufs, result.loudness_range
```

```bash [CLI]
sonare lufs song.wav            # integrated, momentary and short-term LUFS, and loudness range
sonare lufs song.wav --series --json   # adds the momentary and short-term series
```

:::

:::: details Implementation notes

libsonare's loudness measurement follows the gated integrated LUFS model defined by ITU-R BS.1770 and the EBU R128 family of recommendations. Target LUFS and limiter ceiling are kept as separate decisions: the LUFS target controls perceived integrated level, while the ceiling controls the maximum sample or true peak level.

Keeping them separate makes it possible to distinguish useful states: a master can be loud enough but peak-unsafe, or peak-safe but still below the target. The demo report therefore exposes input LUFS, output LUFS, and applied gain separately.

::::

Related: [Loudness Matching and A/B Comparison](./concepts/loudness-matching.md), [True Peak](./true-peak.md), [Dynamic Range](./concepts/dynamic-range.md)
