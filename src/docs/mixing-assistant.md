---
title: Mixing Assistant
description: The offline mixing assistant — it measures a set of tracks, returns a mixer scene with a written reason for every decision, and never touches the audio.
---

# Mixing Assistant

Hand the assistant a set of tracks and it measures each one, measures what happens *between* them, and returns a **mixer scene**: input trims, faders, pans and widths, corrective EQ, dynamics, effect buses and sends — with a written reason for every decision it made.

::: warning It suggests; it does not apply
No audio is processed and none is emitted. The assistant reads your buffers and returns parameters. Handing that scene to the mixer is your own explicit `Mixer.fromSceneJson` step, and there is deliberately no convenience entry point that collapses the two halves — a mix has no single right answer, so the moment where a human accepts or edits the proposal is the point of the API, not friction in it.
:::

If strips, sends, and buses are new vocabulary, read [Mixing Basics](./glossary/concepts/mixing-basics.md) and the [Mixing Engine](./mixing.md) guide first. The scene document itself is specified field by field in [Mixing Scene JSON](./mixing-scene-json.md).

## What You Will Learn

By the end of this page you should be able to:

- call the assistant on a set of tracks and read the scene, the per-track measurements, and the explanation it returns;
- turn a suggestion into an actual mix as the deliberate two-step it is;
- predict what the assistant will decline to do — above all how little EQ it proposes, and why;
- tell a degenerate input from a rejected one, and probe whether the build carries the assistant at all.

## The common case

Measure the tracks, look at the reasons, load the scene.

::: code-group

```typescript [Node]
import { suggestMixScene, Mixer } from '@libraz/libsonare-native';

const result = suggestMixScene({
  sampleRate,
  tracks: [
    { id: 'kick',   name: 'Kick',   left: kick },
    { id: 'bass',   name: 'Bass',   left: bass },
    { id: 'guitar', name: 'Gtr L',  left: guitarL, right: guitarR },
    { id: 'vocal',  name: 'Lead Vox', left: vocal },
  ],
  options: { targetTrackLufs: -18, suggestionStrength: 0.8 },
});

for (const line of result.explanation) console.log(line);

// Nothing has happened to any audio yet. This is the step that applies it.
const mixer = Mixer.fromSceneJson(JSON.stringify(result.scene), sampleRate);
```

```python [Python]
import json

import libsonare as sonare

result = sonare.suggest_mix_scene(
    [
        sonare.MixTrackInput("kick", kick, name="Kick"),
        sonare.MixTrackInput("bass", bass, name="Bass"),
        sonare.MixTrackInput("guitar", guitar_l, guitar_r, name="Gtr L"),
        sonare.MixTrackInput("vocal", vocal, name="Lead Vox"),
    ],
    sample_rate=sample_rate,
    target_track_lufs=-18.0,
    suggestion_strength=0.8,
)

for line in result["explanation"]:
    print(line)

mixer = sonare.Mixer.from_scene_json(json.dumps(result["scene"]), sample_rate)
```

```bash [CLI]
sonare suggest-mix \
  --input kick=kick.wav --input bass=bass.wav \
  --input guitar=guitar.wav --input vocal=vocal.wav \
  --sample-rate 48000 \
  --params targetTrackLufs=-18,suggestionStrength=0.8 \
  --scene-out scene.json
```

:::

::: tip The track name is a hint, not a label
`name` feeds source classification. For a class the classifier can measure it only nudges confidence and cannot select the class by itself. For the four classes no measurement separates — `keys`, `strings`, `backing`, `fx` — the name is the only thing that can supply the class at all, and only when the measurement came back with no answer. Pass the name you show the user; nothing depends on a naming convention.
:::

## Rule-based, not learned

There is no trained model here, no statistical classifier, and no learned parameter anywhere in the assistant. Source classification is a single-layer decision table over measured features — spectral centroid, rolloff, flatness, onset density, sustain ratio, voicing — and every decision downstream of it is a rule with a threshold you can read in the source.

The numbers those rules start from are studio convention. Where a published survey of professional practice has measured the same quantity, the convention was checked against it rather than simply asserted: the reverb return level, the reverb pre-delay, the lead vocal's position, the width of a wide pan, and the frequency ordering of the compression ratios all trace to P. Pestana and J. D. Reiss, *Intelligent Audio Production Strategies Informed by Best Practices*, AES 53rd International Conference on Semantic Audio, London, 2014.

::: info Why this matters for your UI
A rule-based assistant can always say why. That is what makes `explanation` a real feature rather than generated commentary — each line is emitted by the rule that produced the change, at the moment it produced it. Nothing summarises or paraphrases afterwards.
:::

## Entry points

| Surface | Entry point | Shape |
|---------|-------------|-------|
| WASM (`@libraz/libsonare`) | `suggestMixScene(request)` | One request object: `{ tracks, sampleRate, options? }`. Synchronous. Returns `MixAssistantResult`. |
| Node (`@libraz/libsonare-native`) | `suggestMixScene(request)` | Same request object and same result. Synchronous. |
| Python (`libsonare`) | `suggest_mix_scene(tracks, *, sample_rate, ...)` | Tracks positional, every option a snake_case keyword. Returns a `dict`. |
| C ABI | `sonare_mixing_assistant_suggest_scene_json(...)` | Flat C arrays plus a `SonareMasteringParam` list; writes JSON to `char** json_out`. |

`sampleRate` is required on every surface — there is no default.

Each has a `...Json` sibling that returns the serialized document instead of a parsed one: `suggestMixSceneJson`, `suggest_mix_scene_json`, and — on the C side — `sonare_mixing_assistant_suggest` for the full result against `sonare_mixing_assistant_suggest_scene_json` for just the scene. That last pair exists so a caller that only wants to apply a suggestion does not have to dig the scene out of the fuller document and re-serialize it. Free the C string with `sonare_free_string`.

The enumerated source-class names are available at runtime as `mixSourceClassNames()` / `mix_source_class_names()`, with `mixSourceClassFromName(name)` for the reverse lookup.

## Options

The option set is deliberately flat — no nested groups, no per-domain sub-objects. Every field is optional, and an omitted key is never forwarded, so the core default stands.

| Key (JS) | Type | Default | Meaning |
|---|---|---|---|
| `targetTrackLufs` | number | `-18.0` | Integrated-loudness target per track. Absolute, not an average over the loaded set — a quiet session is staged up, not left where it is. |
| `suggestionStrength` | number | `1.0` | In `[0, 1]`; scales every level-like decision. |
| `eqMaxCutDb` | number | `4.0` | Ceiling on any single suggested cut. |
| `mixBusHeadroomDbtp` | number | `-6.0` | Target for the static master trim. |
| `tempoBpm` | number | `0.0` | `0` selects the transport's own fallback tempo. A positive value outside 20–400 is refused, not clamped. |
| `enableStructure` | boolean | `true` | Bus topology and routing. |
| `enableGain` | boolean | `true` | Input trims and loudness staging. |
| `enableBalance` | boolean | `true` | Faders. |
| `enableEq` | boolean | `true` | Corrective EQ. |
| `enableDynamics` | boolean | `true` | Compression. |
| `enableImage` | boolean | `true` | Pan and width. |
| `enableHighPass` | boolean | **`false`** | Per-track high-pass. Off by default — see [below](#the-reluctant-eq-and-enablehighpass). |
| `nFft` | number | `2048` | Shared [STFT](./glossary/analysis/spectrogram-stft.md) geometry. |
| `hopLength` | number | `512` | |

Python takes the same keys in snake_case (`target_track_lufs`, `enable_high_pass`, `n_fft`, …). The C ABI takes the camelCase spellings as `SonareMasteringParam` entries.

::: warning `suggestionStrength: 0` is not an empty suggestion
It scales the level-like decisions toward nothing, but bus topology, routing, polarity, alignment delay and the low-end mono fold do not scale — they are structural, and a half-applied routing graph is not a mix. Zero therefore still returns a scene with buses, sends and corrections in it. To suggest nothing in a domain, switch that domain off.
:::

::: info A disabled domain is not measured either
`enableEq: false` does not mean "measure the overlaps but propose no cuts" — the domain is not evaluated at all, so the measurements feeding it are not taken. Turning domains off is a way to make the call cheaper, not a way to get the analysis without the advice.
:::

## What comes back

`MixAssistantResult` has four fields.

| Field | Type | What it is |
|-------|------|------------|
| `scene` | `MixSceneDocument` | The document `Mixer.fromSceneJson` reads, in the [Mixing Scene JSON](./mixing-scene-json.md) schema. |
| `tracks` | `MixAssistantTrackProfile[]` | Per-track measurements, in input order. |
| `mix` | `MixAssistantMixProfile` | What was measured *between* tracks. |
| `explanation` | `string[]` | Reasons, in application order. |

### `tracks` — what each track is

| Field | Meaning |
|-------|---------|
| `stripId`, `name` | As you passed them. |
| `source` | The classified source, one of `unknown` `kick` `snare` `hiHat` `tom` `cymbal` `bass` `guitar` `keys` `strings` `lead` `vocal` `backing` `percussion` `fx`. |
| `sourceConfidence` | How sure the decision table was. |
| `usable` | `false` when the track could not be measured. An unusable track gets no suggestions at all, rather than suggestions of zero. |
| `exclusionReason` | Why, in words, when `usable` is `false`. |
| `channelCount`, `durationSec` | Shape of the buffer. |
| `integratedLufs` | `number \| null`. **`null` where the measurement is `-Infinity`** — a track with no gated block — because JSON has no number for it. |
| `truePeakDb`, `crestFactorDb` | Level and peak-to-RMS contrast. |
| `spectralCentroidHz`, `spectralFlatness` | Brightness and noisiness. |
| `attackDensity`, `sustainRatio` | How transient against how sustained. |
| `bandOccupancy` | The track's share of its own energy per band. |

`bandOccupancy` is keyed by seven band names, and the ranges are worth memorizing because every EQ reason is phrased in them:

| Band | Range |
|------|-------|
| `sub` | 20–60 Hz |
| `low` | 60–250 Hz |
| `lowMid` | 250–500 Hz |
| `mid` | 500 Hz – 2 kHz |
| `highMid` | 2–6 kHz |
| `high` | 6–12 kHz |
| `air` | 12 kHz – Nyquist |

### `mix` — what happens between tracks

| Field | What it holds |
|-------|---------------|
| `trackCount` | How many tracks were profiled. |
| `bandDominance[]` | Which track masks which, in which band, and by how much (`masker`, `maskee`, `band`, `ratio`, `validFrames`). |
| `alignment[]` | Pairwise timing and polarity (`reference`, `target`, `lagSamples`, `correlation`, `polarityOpposed`). |
| `crowdedBands[]` | Bands the whole session is competing in. |
| `monoRisks[]` | Strips that will partly disappear in mono (`correlation`, `width`, `wideLowEnd`). |

## Reading the explanation

`explanation` is assembled from each delta as it is applied and never re-summarised, so reading it top to bottom retraces how the scene was built. It is empty when every domain is disabled or no track is usable.

The reluctance is visible in the text. An EQ reason names the frequency, says whether that frequency was *measured* or fell back to the band centre, and gives **both** parts' shares:

```text
carved 3.2 dB at 1247 Hz (measured overlap in mid, which vocal needs at 41.6%
of its energy and guitar can spare at 12.4% of its own) out of guitar to make
room for the parts it shares those bands with
```

If a cut ran into `eqMaxCutDb`, the line says so rather than pretending the collision was solved:

```text
…; the mid cut was held at the 4.0 dB ceiling, so the collision is only partly resolved
```

These are good inline captions for an editable control. A user who can see that the vocal needs 41.6% of its energy in that band, and the guitar only 12.4%, can disagree with the number and still agree with the reasoning.

## Turning a suggestion into a mix

Two steps, always, and they are separate on purpose.

::: code-group

```typescript [Node]
const result = suggestMixScene({ sampleRate, tracks });
// …show result.explanation, let the user edit result.scene…
const mixer = Mixer.fromSceneJson(JSON.stringify(result.scene), sampleRate);
```

```python [Python]
result = sonare.suggest_mix_scene(tracks, sample_rate=sample_rate)
# …show result["explanation"], let the user edit result["scene"]…
mixer = sonare.Mixer.from_scene_json(json.dumps(result["scene"]), sample_rate)
```

```bash [CLI]
sonare suggest-mix --input kick=kick.wav --input vocal=vocal.wav --scene-out scene.json
sonare mix --scene scene.json --input kick=kick.wav --input vocal=vocal.wav
```

:::

`suggest-mix` is on both command-line front-ends. The second command is not: **`mix --scene` is Python-only**, so a shell pipeline that renders the suggested scene end to end needs the PyPI `sonare` CLI for its second half.

The scene the assistant writes is an ordinary mixer scene — lanes, faders, sends, buses. The demo below is that mixer, not the assistant, but it is the thing the suggestion turns into, so it is a good place to build the intuition for what a scene *is* before reading one:

<SonareDemo id="engine-lane-mixer" />

## The reluctant EQ, and `enableHighPass`

The assistant proposes far less EQ than a first-time reader expects, and that is the design rather than a gap in it.

A band is carved only where one part is **built around** that band and the other **can spare** it — measured as each track's share of its own energy there. Two parts colliding in a band they are both made of get nothing, because there is no version of that cut which does not take the foundation out of one of them. A kick and a bass both living at 80 Hz is an arrangement problem, and an EQ that pretends otherwise just makes one of them thin.

When a cut is justified, its centre frequency is measured inside the band rather than taken from the band's midpoint. A band here runs up to two octaves, so the midpoint can sit an octave away from the overlap the cut was justified by — which is exactly how a well-reasoned cut lands on the wrong note. The reason string tells you which of the two happened.

::: info Why the per-track high-pass is off
`enableHighPass` defaults to `false`. The same survey of professional practice found the blanket per-track high-pass seldom used in studio mixing and unsupported by subjective testing, so it is not something to apply by default on the grounds that it is traditional.

Switched on, the filter is proposed from the track's **measured energy below its register**, not from its class label. A part written low keeps what it plays — the corner follows the recording, not the assumption that a guitar has nothing under 80 Hz.
:::

## Two behaviours to state plainly

**Degenerate input is not an error.** No tracks, silent tracks, a track too short to measure, a non-positive sample rate, a NaN or an infinity in a buffer — none of these throw. The call succeeds and returns an empty scene, an empty explanation, and a per-track `exclusionReason` naming what was wrong:

| `exclusionReason` | Cause |
|-------------------|-------|
| `track has no samples` | Null buffer or zero frames. |
| `track sample rate is not positive` | |
| `track has non-finite samples` | A NaN or an infinity — named as such rather than diagnosed as silence. |
| `track is shorter than the minimum measurable duration` | |
| `track is silent` | |
| `track has no energy in the analysis bands` | |

**A duplicate track id is the one rejected input.** It raises `InvalidParameter` (a `RangeError` in Node, `SonareValueError` in Python) rather than being absorbed, because a scene with two strips of the same id is a scene the mixer refuses to load — accepting it here would only move the failure somewhere harder to read.

## Availability

The assistant is a separable build unit. `BUILD_MIXING_ASSISTANT` defaults to **ON** and forces `BUILD_MIXING` on when set, but `SONARE_WASM_ANALYSIS_ONLY` forces it **off** — so an analysis-only WASM module does not carry it.

::: warning Probe the capability, not the symbol
```typescript
import { capabilities } from '@libraz/libsonare';

if (capabilities().features.mixingAssistant) {
  // safe to call
}
```
`typeof suggestMixScene === 'function'` is **not** a valid probe. The entry points stay registered in a build without the assistant and throw when called — the C ABI returns `SONARE_ERROR_NOT_SUPPORTED` — so the symbol is present either way.
:::

## Related

- [Mixing Scene JSON](./mixing-scene-json.md) — the schema of the `scene` the assistant returns
- [Mixing Engine](./mixing.md) — the mixer that loads it
- [Mastering Assistant](./mastering-assistant.md) — the same explain-then-decide shape, one stage later
- [Channel Strip](./glossary/mixing/channel-strip.md) · [Buses and Sends](./glossary/mixing/buses-sends.md) · [Pan and Stereo Width](./glossary/mixing/pan-width.md) · [Mono Compatibility](./glossary/concepts/mono-compatibility.md)
