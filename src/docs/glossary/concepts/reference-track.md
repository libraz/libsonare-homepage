---
title: Reference Track
description: How to use a reference track without blindly copying another master.
---

# Reference Track

A reference track is a finished song or master used as a comparison point. It helps answer a practical question: "What should this feel like when it is done?"

References are useful because memory is unreliable. After working on a track for a while, the current sound starts to feel normal. A reference gives you an external anchor for loudness, brightness, low-end balance, stereo width, vocal presence, and density.

## What A Reference Is For

A good reference is not a target to copy exactly. It is a calibrated comparison.

Use it to notice broad differences:

| Area | Useful question |
|------|-----------------|
| Loudness | Is my master in the same practical range, or only louder in the room? |
| Low end | Is the bass controlled, or does it blur the groove? |
| Midrange | Are vocals and lead elements stable enough? |
| High end | Is the top end open, harsh, or dull? |
| Stereo | Is the width helping the track, or weakening [mono](./mono-compatibility.md) focus? |
| Density | Does the master feel finished without crushing movement? |

The reference should match the intended style, arrangement density, and release context. A sparse acoustic track should not be forced to behave like a dense dance master.

## Common Mistakes

The most common mistake is comparing references without [matching loudness](./loudness-matching.md). A commercial reference may be louder or denser than your mix, and that can make it seem better for the wrong reason.

Another mistake is choosing a reference with a different arrangement. If the reference has fewer instruments, a brighter vocal, or a different bass role, copying its spectral shape may make your track worse.

Use references to guide decisions, not to erase the identity of the source.

## Reference Match EQ

Reference Match EQ compares the spectrum of the source and reference, then applies a limited EQ curve to move the source closer. This can be useful for learning and for gentle tonal alignment.

It should be constrained. Large match-EQ moves often indicate that the source mix is fundamentally different from the reference. In that case, broad manual EQ or mix revision is usually safer than exact matching.

<SonareDemo id="tilt-eq" />

## Measure it in libsonare

The comparison starts with the loudness and crest readings from [LUFS](../lufs.md) and [crest factor](./crest-factor.md), then moves to the spectrum. `match.tonalBalance` reports per-band levels for both tracks, and `match.matchEqCurve` returns the gain curve that would move the source toward the reference. Both come back as JSON from the pair-analysis call.

::: code-group

```typescript [Browser]
import { init, lufs, meteringCrestFactorDb, masteringPairAnalyze } from '@libraz/libsonare';

await init();

const sourceLufs = lufs(source, sampleRate).integratedLufs;
const referenceLufs = lufs(reference, referenceSampleRate).integratedLufs;
const lufsGap = referenceLufs - sourceLufs;
const crestGap = meteringCrestFactorDb(reference, referenceSampleRate)
  - meteringCrestFactorDb(source, sampleRate);

const curve = JSON.parse(masteringPairAnalyze({
  analysisName: 'match.matchEqCurve',
  source,
  reference,
  sampleRate,
  referenceSampleRate,   // resampled onto sampleRate when it differs
}));
// curve.frequencies and curve.gainDb
```

```python [Python]
import json
import libsonare as sonare

source_lufs = sonare.lufs(source, sample_rate).integrated_lufs
reference_lufs = sonare.lufs(reference, reference_sample_rate).integrated_lufs
lufs_gap = reference_lufs - source_lufs

curve = json.loads(sonare.mastering_pair_analyze(
    "match.matchEqCurve", source, reference, sample_rate,
    reference_sample_rate=reference_sample_rate,
))
```

```bash [CLI]
sonare mastering-pair-analyze source.wav --analysis match.matchEqCurve --reference reference.wav
sonare mastering-pair-analyze source.wav --analysis match.tonalBalance --reference reference.wav
```

:::

## In The libsonare Demo

The demo lets you load a reference track for comparison. It displays basic reference metrics and can run Reference Match EQ through the local WebAssembly worker.

The match operation is intentionally limited. The returned curve is smoothed over about a sixth of an octave and fitted with four peak bands of at most 6 dB each, so the result stays closer to a mastering move than a brittle copy of the reference spectrum.

:::: details Implementation notes

Reference files are decoded locally in the browser just like the source file. If the reference sample rate differs from the source sample rate, the worker resamples the reference onto the source's rate with the engine's `resample` when it is loaded. Called directly, the match functions take `referenceSampleRate` and do that resampling themselves.

The match-EQ path mixes source and reference to mono, compares their spectra, smooths the difference, then constrains the maximum gain change. This is deliberate: raw spectral differences contain narrow spikes and notches that are usually not useful mastering moves.

::::

Related: [Loudness Matching](./loudness-matching.md), [Dynamic Range](./dynamic-range.md), [Mono Compatibility](./mono-compatibility.md), [LUFS](../lufs.md)
