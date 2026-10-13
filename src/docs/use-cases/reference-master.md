---
title: Match a Reference Track
description: Close the tonal and loudness gap between your mix and a commercial reference, measurably, from the CLI — and know what a reference match cannot fix.
---

# Match a Reference Track

This page compares a mix with a commercial reference, measures loudness and tonal balance, applies a stereo-safe correction, and measures again. Reference matching changes tone and gain; it does not change arrangement, performance, or mix balance.

::: info What you need
- **Install:** `pip install libsonare` (Python 3.11 or later). The Node tabs need `npm install @libraz/libsonare` (Node.js 22.12 or later).
- **`mix.wav`:** your stereo mix. This page uses the 48 kHz mixdown (11.5 s, 553053 frames) that [Mix and Master a Song in the CLI](./cli-mix-and-master.md) renders from its four test stems.
- **`reference.wav`:** the commercial track you are aiming at, as WAV or MP3, ideally at the same sample rate as your mix.
- **To reproduce the numbers here:** this page's `reference.wav` is `mix.wav` with one EQ tilt applied, so the walkthrough has a known answer. Make the same pair with `sonare mastering-processor mix.wav --processor eq.tilt --params "tiltDb=4" -o reference.wav`.
:::

## What You Will Learn

By the end of this page you should be able to:

- measure the loudness and tonal gap between a mix and a reference before touching either file;
- read a four-band tonal-balance deviation and recognize when its shape calls for a tilt, a pair of shelves, or a full parametric EQ;
- apply that correction through the entry point that keeps your stereo pair intact, instead of the pair commands that fold to mono first;
- state plainly what reference matching does not do.

## The whole job

```bash
#!/usr/bin/env bash
set -euo pipefail

# 1. Characterize the reference on its own terms.
sonare mastering-profile reference.wav --json

# 2. Measure the loudness gap between mix and reference.
sonare mastering-pair-analyze mix.wav --reference reference.wav \
  --analysis match.referenceLoudness --json

# 3. Measure the tonal gap, band by band.
sonare mastering-pair-analyze mix.wav --reference reference.wav \
  --analysis match.tonalBalance --json

# 4. Apply the correction on the stereo pair, not a mono downmix.
sonare mastering-processor mix.wav --processor eq.tilt \
  --params "tiltDb=4" -o tilted.wav --json

# 5. Confirm it closed both gaps.
sonare mastering-pair-analyze tilted.wav --reference reference.wav \
  --analysis match.tonalBalance --json
sonare mastering-pair-analyze tilted.wav --reference reference.wav \
  --analysis match.referenceLoudness --json
```

<FlowDiagram
  title="Measure, diagnose, correct, confirm"
  direction="LR"
  :nodes="[
    { id: 'mix', label: 'mix.wav', col: 0, row: 0, variant: 'muted' },
    { id: 'ref', label: 'reference.wav', col: 0, row: 1, variant: 'muted' },
    { id: 'profile', label: 'mastering-profile', col: 1, row: 1 },
    { id: 'loud', label: 'referenceLoudness', col: 1, row: 0 },
    { id: 'tonal', label: 'tonalBalance', col: 2, row: 0 },
    { id: 'diagnose', label: 'Read the shape', col: 3, row: 0, variant: 'decision' },
    { id: 'correct', label: 'eq.tilt (stereo)', col: 4, row: 0, variant: 'accent' },
    { id: 'out', label: 'tilted.wav', col: 5, row: 0, variant: 'success' },
    { id: 'confirm', label: 'Re-measure', col: 5, row: 1, variant: 'muted' }
  ]"
  :edges="[
    { from: 'ref', to: 'profile' },
    { from: 'mix', to: 'loud', label: 'audio', style: 'dashed' },
    { from: 'ref', to: 'loud', label: 'audio', style: 'dashed' },
    { from: 'mix', to: 'tonal', style: 'dashed' },
    { from: 'ref', to: 'tonal', style: 'dashed' },
    { from: 'loud', to: 'diagnose' },
    { from: 'tonal', to: 'diagnose' },
    { from: 'diagnose', to: 'correct' },
    { from: 'mix', to: 'correct', label: 'audio', style: 'dashed' },
    { from: 'correct', to: 'out' },
    { from: 'out', to: 'confirm', style: 'dashed' },
    { from: 'ref', to: 'confirm', label: 'audio', style: 'dashed' }
  ]"
  caption="Everything up to the diagnosis is measurement; the mix is only touched once, and re-measuring afterward is what turns a guess into a confirmed correction."
/>

## Step 1 — Characterize the reference on its own terms

Before comparing anything, find out what the reference actually is:

```bash
sonare mastering-profile reference.wav --json
```

```json
{
  "duration_sec": 11.52,
  "bpm": 119.87, "bpm_confidence": 0.59,
  "loudness": { "integrated_lufs": -24.57, "true_peak_db": -1.18,
                "crest_factor_db": 25.56, "lra_lu": 6.88 },
  "spectral": { "centroid_hz": 2981.68, "rolloff_hz": 6169.37,
                "sub_rms_db": -37.94, "low_rms_db": -31.55, "air_rms_db": -43.08 },
  "dynamics": { "short_term_lufs_std": 26.72, "attack_density": 0.52,
                "sustain_ratio": 0.27 },
  "defects": { "measured": false, /* ... */ }
}
```

The CLI renders the binding's camelCase profile keys as snake_case. `defects` is abbreviated: `measured` is `false` and the damage fields hold defaults unless you ask for the measurement with `--params detectDefects=1`. One call gives you tempo, loudness, spectral shape, and dynamics for the file you are chasing — the same measured fields [Mastering Assistant](../mastering-assistant.md) profiles for your own mix. Read this before the comparison, with one caution: `mastering-profile` folds a stereo file to mono before it measures (it says so on stderr), so -24.57 LUFS is the loudness of the mono fold, not of the stereo track. Measured as a stereo pair, this reference reads -21.33 LUFS: Step 5's `tilted.wav` is the same audio, and `mastering-processor` reports it in stereo. Either way it is quiet by streaming standards, which matters later when you decide whether to actually chase its loudness or just its tone.

Three of those `loudness` fields are what the meter below reports on a playing clip: integrated LUFS is the single number the next step will compare against your mix, true peak is the ceiling, and LRA is how far the loudness moves over the programme. A reference with a wide LRA hides a lot of motion behind its one integrated figure — matching that figure alone will not make your mix move the same way.

<SonareDemo id="loudness-meter" />

## Step 2 — Measure the loudness gap

::: code-group

```bash [CLI]
sonare mastering-pair-analyze mix.wav --reference reference.wav \
  --analysis match.referenceLoudness --json
```

```typescript [Node]
import { readFileSync } from 'node:fs';
import { Audio, init, masteringPairAnalyze } from '@libraz/libsonare';

await init();
// Each file folded to mono, as the CLI does.
const load = (path: string) => Audio.fromMemory(new Uint8Array(readFileSync(path)));
const mix = load('mix.wav');
const reference = load('reference.wav');
const result = JSON.parse(masteringPairAnalyze({
  analysisName: 'match.referenceLoudness',
  source: mix.data, reference: reference.data,
  sampleRate: mix.sampleRate, referenceSampleRate: reference.sampleRate,
}));
```

```python [Python]
import json
import libsonare as sonare
from libsonare import Audio

# Each file folded to mono, as the CLI does.
with Audio.from_file("mix.wav") as m, Audio.from_file("reference.wav") as r:
    mix, reference, sr, ref_sr = m.data, r.data, m.sample_rate, r.sample_rate
result = json.loads(sonare.mastering_pair_analyze(
    "match.referenceLoudness", mix, reference, sr, reference_sample_rate=ref_sr))
```

:::

```json
{ "gain_to_match_db": -0.86, "reference_lufs": -24.57, "source_lufs": -23.71 }
```

The library calls return the same fields in camelCase (`gainToMatchDb`, `referenceLufs`, `sourceLufs`), and take one mono array per file. `gain_to_match_db` is the gain that lands the source on the reference's loudness: `source_lufs + gain_to_match_db = reference_lufs`. Here the mix is 0.9 dB hotter than the reference, so a negative number brings it down to match.

::: info Why the same `mix.wav` reads -23.71 here and -20.49 in Step 5
Every `mastering-pair-analyze` and `mastering-profile` number on this page is measured on the mono fold of each file. `mastering-processor` in Step 5 keeps the stereo pair and reports -20.49 LUFS for the same mix. The 3.21 dB gap is the fold, not a disagreement: [LUFS](../glossary/lufs.md) sums the power of both channels, and averaging two similar channels into one loses about 3 dB (see the stereo note in [Mix and Master a Song in the CLI](./cli-mix-and-master.md#step-6-—-believe-the-right-number)). Both files are folded the same way, so the **gap** between mix and reference, 0.9 dB, is the trustworthy number. Compare fold to fold or stereo to stereo, never one with the other.
:::

::: tip Matching loudness is not the same as choosing a target
This number says "your mix and the reference differ by 0.9 dB," not "master to -24.57 LUFS." A reference pulled from a different era or platform can sit well off a current delivery target — see [Delivery Targets](../glossary/mastering/delivery-targets.md) before treating `reference_lufs` as the number to land on.
:::

## Step 3 — Measure the tonal gap, band by band

::: code-group

```bash [CLI]
sonare mastering-pair-analyze mix.wav --reference reference.wav \
  --analysis match.tonalBalance --json
```

```typescript [Node]
// mix, reference: loaded in Step 2
const result = JSON.parse(masteringPairAnalyze({
  analysisName: 'match.tonalBalance',
  source: mix.data, reference: reference.data,
  sampleRate: mix.sampleRate, referenceSampleRate: reference.sampleRate,
}));
```

```python [Python]
# mix, reference, sr, ref_sr: loaded in Step 2
result = json.loads(sonare.mastering_pair_analyze(
    "match.tonalBalance", mix, reference, sr, reference_sample_rate=ref_sr))
```

:::

```json
{
  "bands": [
    { "low_hz": 20,    "high_hz": 250,   "reference_db": 17.00,  "source_db": 19.00,  "deviation_db": 2.00 },
    { "low_hz": 250,   "high_hz": 2000,  "reference_db": 5.24,   "source_db": 5.11,   "deviation_db": -0.13 },
    { "low_hz": 2000,  "high_hz": 8000,  "reference_db": -6.00,  "source_db": -7.98,  "deviation_db": -1.97 },
    { "low_hz": 8000,  "high_hz": 20000, "reference_db": -11.13, "source_db": -13.13, "deviation_db": -2.00 }
  ]
}
```

`deviation_db` is `source_db - reference_db`: positive means the mix runs hotter than the reference in that band. Reading down the table, the shape is unmistakable — the mix is about 2 dB hot at the bottom, roughly matched through the low-mids, and about 2 dB dark across everything above 2 kHz. That is not four independent problems; it is one problem, seen through four windows.

For finer resolution than four bands, `match.tonalBalanceLogBands` reports the same deviation across 32 log-spaced bands, and `match.matchEqCurve` returns a full frequency-response correction curve rather than a banded summary — the shape [Reference Match](../glossary/mastering/reference-match.md)'s browser demo works from directly.

## Step 4 — Pick the correction: tilt, shelf, or full EQ

A deviation that swings smoothly from positive at one end to negative at the other, crossing zero once, is a **tilt** — a single pivot with the low side and the high side moving in opposite directions. That is exactly [`eq.tilt`](../mastering-processors.md)'s job: one `tiltDb` knob and a `pivotHz` (1000 Hz by default), applied through [`mastering-processor`](../mastering-processors.md).

Read the tilt amount off the two extreme bands: the low band needs about -2 dB, the high band needs about +2 dB, so `tiltDb ≈ (low-band deviation) - (high-band deviation) = 2.00 - (-2.00) = 4.0`. Treat that as a starting point, not a final answer — the whole reason for Step 6 is to confirm it rather than trust the arithmetic.

The demo sweeps `tilt` on a full mix. The spectrum rotates around the pivot, so the low and high sides move in opposite directions.

<SonareDemo id="tilt-eq" />

Three processors can make the correction, and the shape of the deviation picks one:

| Deviation shape | Processor | Key params | Result on this fixture |
|---|---|---|---|
| One smooth swing that crosses zero once | `eq.tilt` | `tiltDb`, `pivotHz` (1000 Hz by default) | 0.00 dB in all four bands |
| Low and high corrections with different pivots, such as trimming below 250 Hz but lifting only above 8 kHz | `eq.shelving` | `lowFrequencyHz`, `lowGainDb`, `highFrequencyHz`, `highGainDb` | 0.28 / 0.11 / -0.13 / -0.001 dB with `lowFrequencyHz=250, lowGainDb=-2, highFrequencyHz=2000, highGainDb=2` |
| A narrow dip or peak inside one band, which neither a single pivot nor two shelves can isolate | `eq.equalizer` (up to 24 bands, each a peak, shelf, or tilt) | `band0.*` through `band23.*` | Not used |

Two shelves cannot reproduce one continuous slope exactly, which is why `eq.shelving` lands close but not as clean as the tilt.

This fixture's deviation is a clean tilt, so `eq.tilt` is the right tool and the one this page carries through.

## Step 5 — Apply it on the stereo pair

```bash
sonare mastering-processor mix.wav --processor eq.tilt \
  --params "tiltDb=4" -o tilted.wav --json
```

```json
{ "processor": "eq.tilt", "input_lufs": -20.49, "output_lufs": -21.33,
  "applied_gain_db": 0.0, "sample_rate": 48000, "output": "tilted.wav",
  "stereo": true }
```

`"stereo": true` is the field to check. `mastering-processor` decides its entry point from the source file's own channel count — a stereo `mix.wav` takes the stereo path automatically, for `eq.tilt` or any other solo processor, with no flag to remember.

::: danger `mastering-pair-processor` folds to mono; `mastering-processor` does not
The pair commands are a different code path, and they downmix unconditionally:

```bash
sonare mastering-pair-processor mix.wav --processor match.applyMatchEq \
  --reference reference.wav -o matched.wav --json
# warning: 2-channel input is downmixed to mono by this CLI command
# {"processor": "match.applyMatchEq", "input_lufs": -23.71, "output_lufs": -24.50, ...}
```

`matched.wav` comes out with `channels: 1`. Re-measuring `match.tonalBalance` against it shows the curve fit is good — 0.29 / 0.004 / -0.001 / -0.07 dB — but that quality bought you a mono file.

Reach for `match.applyMatchEq` on the CLI when the deliverable is genuinely mono, such as a podcast or a voice track. For a stereo deliverable, either use a shape-matched solo processor through `mastering-processor` as above, or work through the library directly: `mastering_pair_process()` takes one flat array per call, so calling it once for the left channel against the reference's left channel and once for the right against the reference's right — the same way [Reference Match](../glossary/mastering/reference-match.md)'s browser demo does it — gets you the fitted curve without discarding the channels. See the [Python API](../python-api.md) for the call shape.
:::

## Step 6 — Confirm convergence

```bash
sonare mastering-pair-analyze tilted.wav --reference reference.wav \
  --analysis match.tonalBalance --json
# all four deviation_db values: 0.00

sonare mastering-pair-analyze tilted.wav --reference reference.wav \
  --analysis match.referenceLoudness --json
# {"gain_to_match_db": 0, "reference_lufs": -24.57, "source_lufs": -24.57}
```

The tonal correction closed the loudness gap too, on this file — but treat that as a property of this fixture, not a rule. `reference.wav` here differs from `mix.wav` by exactly one edit, an EQ tilt, and tilting the spectrum shifts measured LUFS along with it because the loudness curve is not flat across frequency; correcting the one edit undid both effects at once. In general, a tonal move and a loudness move are independent, and the honest sequence is: apply the tonal correction, then re-run `match.referenceLoudness` on the result — not on the untouched mix — because the tonal move itself will have shifted the number.

## What Reference Matching Cannot Do

::: warning A matched curve moves tone, not decisions
Everything on this page adjusts EQ and gain. None of it touches arrangement, performance, or mix balance. If your chorus never lifts, if a doubled guitar buries the vocal, or if the arrangement is thinner than the reference's, a matched tonal curve will not fix any of it — it will just make the same thin, buried mix a little brighter. [Reference Match](../glossary/mastering/reference-match.md) puts it plainly: a reference calibrates, it does not transplant. If matching pulls a sparse track toward a dense one and it starts losing its own identity, the fix is to back off the match, not to push it further.
:::

## Where to go next

- Build the full chain this correction feeds into — [Mix and Master a Song in the CLI](./cli-mix-and-master.md).
- Turn the final loudness and true-peak numbers into a pass/fail gate — [Gate a Delivery in CI](./delivery-check.md).
- Read the decision rules behind every processor named here — [Mastering Assistant](../mastering-assistant.md) and [Mastering Processors](../mastering-processors.md).
