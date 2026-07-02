---
title: Mastering Assistant API
description: The libsonare explainable mastering helpers — masteringAudioProfile, masteringAssistantSuggest, and masteringStreamingPreview — with the exact JSON they return and how to turn a suggestion into a rendered master.
---

# Mastering Assistant API

libsonare provides three **JSON-returning** mastering helpers for apps that need *explainable* decisions, not just rendered audio. They run **local DSP analysis only** — no upload, no remote model, no hidden preset — and hand back structured JSON your UI can inspect, store in a report, or display.

If "LUFS", "true peak", "crest factor", or "tonal balance" are unfamiliar, read [What Is Mastering?](./glossary/concepts/what-is-mastering.md) and [Reading Mastering Meters](./glossary/mastering/meter-reading.md) first — this page assumes the vocabulary and focuses on the JSON contract.

::: info The assistant is not an auto-master button
Here, an assistant means a helper API that measures the source and explains why a processing direction may make sense. The actual sound is created later, after the user accepts or edits the suggestion and passes it to a rendering API.
:::

For a first implementation, read this page in order:

1. Use `masteringAudioProfile(...)` to show the user what the source looks like.
2. Use `masteringAssistantSuggest(...)` to pre-fill an editable mastering chain.
3. Render only after the user accepts or edits the suggestion.
4. Use `masteringStreamingPreview(...)` to explain what delivery platforms will do to loudness.

::: tip Where the assistant fits
The assistant **describes and proposes**; it never decides for you. A good flow is: *profile* the source → *suggest* a direction → let the user adjust → *render* → *preview* how streaming platforms will play it back. Keep listening in the loop; the JSON seeds the UI, it does not replace your ears.
:::

Think of the three helpers as three separate buttons in a UI:

| Button | What the user expects | Helper |
|--------|-----------------------|--------|
| Analyze source | "Tell me what is in this file." | `masteringAudioProfile` |
| Suggest starting chain | "Fill in reasonable settings I can edit." | `masteringAssistantSuggest` |
| Check delivery | "Tell me what YouTube/Podcast/etc. will do to the loudness." | `masteringStreamingPreview` |

## What You Will Learn

By the end of this page you should be able to:

- separate source profiling, chain suggestion, rendering, and delivery preview into distinct UI steps;
- parse the three JSON-returning helpers and know which fields are measurements vs suggestions;
- turn an assistant suggestion into a `masteringChain` render while still allowing user control;
- explain why these helpers are local DSP analysis, not a remote automatic-mastering service.

## The three APIs at a glance

| Step | JavaScript | Python | Returns |
|------|------------|--------|---------|
| Inspect the source | `masteringAudioProfile(samples, sr)` | `mastering_audio_profile(...)` | A measurement profile |
| Propose a chain | `masteringAssistantSuggest(samples, sr, params)` | `mastering_assistant_suggest(...)` | A full chain config + rationale |
| Preview delivery | `masteringStreamingPreview(samples, sr, platforms)` | `mastering_streaming_preview(...)` | Per-platform normalization |

All three return a **JSON string** — call `JSON.parse` (JS) or `json.loads` (Python). The schema is identical across the C, Node, Python, and WASM bindings. The PyPI `sonare` CLI also exposes all three: `sonare mastering-profile`, `sonare mastering-suggest`, and `sonare mastering-streaming` print the same JSON to stdout.

The three helpers answer different questions:

| Helper | Main question | Measurement or suggestion? |
|--------|---------------|----------------------------|
| `masteringAudioProfile` | "What is in this source?" | Measurement only |
| `masteringAssistantSuggest` | "What chain would be a reasonable starting point?" | Suggestion based on the profile |
| `masteringStreamingPreview` | "How will platforms turn this up or down?" | Delivery simulation from measured loudness |

::: code-group

```typescript [Browser]
import { init, masteringAudioProfile, masteringAssistantSuggest, masteringStreamingPreview } from '@libraz/libsonare';
await init();

const profile    = JSON.parse(masteringAudioProfile(samples, sampleRate));
const suggestion = JSON.parse(masteringAssistantSuggest(samples, sampleRate, { targetLufs: -14, ceilingDb: -1 }));
const preview    = JSON.parse(masteringStreamingPreview(samples, sampleRate, [
  { name: 'YouTube',  targetLufs: -14, ceilingDb: -1 },
  { name: 'Podcast',  targetLufs: -16, ceilingDb: -1 },
]));
```

```python [Python]
import json
import libsonare as sonare

profile    = json.loads(sonare.mastering_audio_profile(samples, sample_rate=sr))
suggestion = json.loads(sonare.mastering_assistant_suggest(
    samples, sample_rate=sr, params={"targetLufs": -14, "ceilingDb": -1}))
preview    = json.loads(sonare.mastering_streaming_preview(samples, sample_rate=sr, platforms=[
    {"name": "YouTube", "targetLufs": -14, "ceilingDb": -1},
    {"name": "Podcast", "targetLufs": -16, "ceilingDb": -1},
]))
```

```bash [CLI]
sonare mastering-profile source.wav
sonare mastering-suggest source.wav --params targetLufs=-14,ceilingDb=-1
sonare mastering-streaming source.wav \
  --platforms '[{"name":"YouTube","targetLufs":-14,"ceilingDb":-1},{"name":"Podcast","targetLufs":-16,"ceilingDb":-1}]'
```

:::

::: warning Short clips: profile and suggest need real spectral content
`masteringAudioProfile` and `masteringAssistantSuggest` run a full STFT-based analysis (default `nFft` = 2048) and throw a `SonareError` on clips too short to fill an analysis window. Two thresholds matter: a buffer shorter than ~512 samples will throw outright, and a buffer shorter than one full window (`nFft`, default 2048 samples) has too little spectral content for a meaningful profile. Guard at one full window to be safe. `masteringStreamingPreview` only measures loudness, so it tolerates any non-empty buffer (it just requires a non-empty audio buffer and a non-empty platform list). When feeding short captures or file-picker selections from the UI, guard the profile/suggest calls with a minimum-length check, and wrap them in `try`/`catch` using `isSonareError`, before passing the buffer.

```typescript [Browser]
import { masteringAudioProfile, isSonareError } from '@libraz/libsonare';

const MIN_ANALYSIS_SAMPLES = 2048; // one default analysis window (nFft)
if (samples.length < MIN_ANALYSIS_SAMPLES) {
  // Too short to profile — skip or pad before analyzing.
} else {
  try {
    const profile = JSON.parse(masteringAudioProfile(samples, sampleRate));
    // …
  } catch (err) {
    if (isSonareError(err)) {
      // Surface a "clip too short / no spectral content" message in the UI.
    } else {
      throw err;
    }
  }
}
```
:::

## `masteringAudioProfile` — measure the source

A read-only summary of the input: how loud it is, how its energy is spread across the spectrum, how dynamic it is, and which genres it resembles. Nothing is processed.

Optional `params` are numeric and accept either JS-style or Python-style names: `nFft`/`n_fft` (default `2048`), `hopLength`/`hop_length` (default `512`), and `truePeakOversample`/`true_peak_oversample` (default `4`).

::: info Why oversample for true peak?
Digital peaks are sampled at fixed points, but the real waveform can rise *between* those samples. Oversampling re-measures the signal at a higher rate (here 4×) to catch these inter-sample peaks, so the reported `truePeakDb` reflects what a converter actually outputs. Higher factors are more accurate but cost more CPU.
:::

Use this result to explain the input, not to judge it. A profile can tell you that the source is already loud, dark, dense, or transient-heavy. It does not mean the source has passed or failed mastering.

| What it does | What it does not do |
|--------------|---------------------|
| Measures loudness, true peak, crest factor, spectrum, dynamics, and genre candidates | It does not change the audio |
| Gives your UI facts to display before rendering | It does not choose final settings by itself |

```json
{
  "durationSec": 2,
  "bpm": 89.5,
  "bpmConfidence": 0.24,
  "loudness": {
    "integratedLufs": -8.71,
    "lraLu": 0,
    "truePeakDb": -2.41,
    "crestFactorDb": 5.76
  },
  "spectral": {
    "subRmsDb": 6.37, "lowRmsDb": 40.35, "lowMidRmsDb": 13.26, "midRmsDb": 23.56,
    "highMidRmsDb": -1.96, "highRmsDb": -1.99, "airRmsDb": -1.92,
    "centroidHz": 5806.83, "flatness": 0.0035, "rolloffHz": 15386.5
  },
  "dynamics": { "shortTermLufsStd": 0, "attackDensity": 3, "sustainRatio": 1 },
  "genreCandidates": [
    { "name": "hipHop", "score": 0.70 },
    { "name": "edm",    "score": 0.65 },
    { "name": "pop",    "score": 0.45 }
  ]
}
```

| Group | Field | Meaning |
|-------|-------|---------|
| `loudness` | `integratedLufs` | Overall [loudness](./glossary/lufs.md) (EBU R128) |
| | `lraLu` | Loudness range — how much the loudness moves over time |
| | `truePeakDb` | Inter-sample [true peak](./glossary/true-peak.md) |
| | `crestFactorDb` | Peak-to-RMS contrast — high = punchy, low = dense ([crest factor](./glossary/concepts/crest-factor.md)) |
| `spectral` | `subRmsDb` … `airRmsDb` | Energy per band (sub → air), for spotting a dark or bright balance |
| | `centroidHz` | Spectral "center of mass" — a brightness proxy |
| | `flatness` | 0 = tonal, 1 = noise-like |
| | `rolloffHz` | Frequency below which most energy sits |
| `dynamics` | `attackDensity` | How busy the transients are |
| | `sustainRatio` | How sustained vs. transient the material is |
| `genreCandidates` | `[{name, score}]` | Best-matching styles; the top one seeds the suggestion's base preset |

::: info Reading the spectral bands
The `*RmsDb` fields go from low to high frequency: `sub` (deep bass) → `low`/`lowMid` (bass and warmth) → `mid` (body, vocals) → `highMid`/`high` (presence, clarity) → `air` (top-end sparkle). Comparing them tells you whether a mix leans dark (strong lows) or bright (strong air).
:::

::: details What do loudness range, attack density, and sustain ratio mean?
- **Loudness range (LRA, in LU)** — how much the perceived loudness swings across the track. A high value means it gets noticeably quieter and louder (a dynamic classical piece); a low value means it stays at roughly one level (a dense EDM master). "LU" (loudness units) is the same scale as LUFS, measured as a spread rather than an absolute.
- **Attack density** — roughly how many sharp note/drum onsets happen per second. High = busy and percussive, low = sparse or sustained.
- **Sustain ratio** (0–1) — whether the material is dominated by long held tones (near 1) or short bursts and attacks (near 0). It is measured separately from attack density (from the RMS envelope, not the onsets) but usually moves in the opposite direction.
- **Short-term LUFS std-dev** — how much the moment-to-moment loudness wobbles. A higher number means the level is restless; near zero means it sits very steadily.
:::

::: warning These are measurements, not verdicts
A `crestFactorDb` of 5.8 is not "bad" — it just describes the signal. Use the profile to *understand* the source and to decide what to change, not as a pass/fail score.
:::

## `masteringAssistantSuggest` — propose a chain

Builds on the profile to propose a ready-to-render mastering chain, plus a human-readable rationale. The third argument carries your intent (`targetLufs`, `ceilingDb`, …).

Accepted intent keys are `targetLufs`/`target_lufs`, `ceilingDb`/`ceiling_db`, `enableRepair`/`enable_repair`, `preferStreamingSafe`/`prefer_streaming_safe`, and `speechMonoAmount`/`speech_mono_amount`.

::: details What the optional intent keys do
`enableRepair` turns on the cleanup stages (declick, denoise, etc.) when the source has defects. `preferStreamingSafe` biases the suggestion toward a safe ceiling and target for streaming delivery rather than maximum loudness. `speechMonoAmount` (0–1) collapses the low/center of speech toward mono for intelligibility on small or mono speakers.
:::

Think of this helper as a preset generator with an explanation. It returns a full starting point that your app can render directly, but the intended workflow is still editable.

| Part of the output | How to use it |
|--------------------|---------------|
| `chainConfig.params` | Fill controls or pass as `masterAudio` overrides |
| `explanation` | Show why stages were enabled or tuned |
| `genreCandidates` | Pick the base preset or show alternatives |
| `profile` | Keep the suggestion self-contained in reports |

```json
{
  "chainConfig": {
    "version": 1,
    "params": {
      "eq.tilt.enabled": 1,
      "eq.tilt.tiltDb": -0.5,
      "dynamics.transientShaper.enabled": 1,
      "dynamics.compressor.enabled": 1,
      "dynamics.compressor.thresholdDb": -18,
      "saturation.tape.enabled": 1,
      "spectral.airBand.enabled": 1,
      "maximizer.truePeakLimiter.enabled": 1,
      "maximizer.truePeakLimiter.ceilingDb": -1,
      "loudness.enabled": 1,
      "loudness.targetLufs": -14,
      "loudness.ceilingDb": -1
    }
  },
  "explanation": [
    "base preset selected from top genre candidate: hipHop",
    "target loudness and ceiling applied from AssistantConfig",
    "air band enabled because the spectral profile is dark",
    "transient shaper enabled for dense attacks"
  ],
  "genreCandidates": [ { "name": "hipHop", "score": 0.70 } ],
  "profile": { "integratedLufs": -8.7, "truePeakDb": -2.43, "crestFactorDb": 5.75, "...": "flattened profile" }
}
```

| Field | Meaning |
|-------|---------|
| `chainConfig.params` | The **full proposed chain** as flat dot-notation keys (`stage.processor.param`). `*.enabled` is `1`/`0`. **These are the same keys `masterAudio` overrides accept**, so the suggestion can be rendered directly. |
| `explanation` | Plain-language reasons for each decision — show these in your UI so the choice is transparent. |
| `genreCandidates` | The same ranked styles as the profile; the top one is the base preset. |
| `profile` | A flattened copy of the source profile, so a suggestion is self-contained. |

::: details The params object covers the whole default chain
The example above is trimmed. The real `params` map contains **every** parameter of the default chain — all repair stages (declick, declip, decrackle, dehum, dereverb, denoise), EQ, de-esser, transient shaper, compressor, multiband, saturation (tape/exciter), air band, stereo, the true-peak limiter, and the loudness stage — each with its full parameter set and an `enabled` flag. The assistant flips `enabled` and tunes a few values based on the profile; everything else stays at its documented default. Treat the map as an overridable snapshot of the whole chain, not a sparse diff.
:::

### Turning a suggestion into a master

Because `chainConfig.params` uses `masterAudio`'s override keys, rendering the suggestion is one call — use the top genre candidate as the base preset and pass the whole params map, not just the few keys shown above, as overrides:

::: code-group

```typescript [Browser]
const suggestion = JSON.parse(masteringAssistantSuggest(samples, sampleRate, { targetLufs: -14, ceilingDb: -1 }));
const basePreset = suggestion.genreCandidates[0].name;        // e.g. "hipHop"

const mastered = masterAudio(samples, sampleRate, basePreset, suggestion.chainConfig.params);
// mastered: { samples, sampleRate, inputLufs, outputLufs, appliedGainDb, stages }
```

```python [Python]
suggestion = json.loads(sonare.mastering_assistant_suggest(
    samples, sample_rate=sr, params={"targetLufs": -14, "ceilingDb": -1}))
base_preset = suggestion["genreCandidates"][0]["name"]        # e.g. "hipHop"

mastered = sonare.master_audio(
    samples, sample_rate=sr,
    preset_name=base_preset,
    overrides=suggestion["chainConfig"]["params"],
)
# mastered: samples, sample_rate, input_lufs, output_lufs, applied_gain_db, stages
```

```bash [CLI]
sonare mastering source.wav --target-lufs -14 --ceiling-db -1 -o master.wav
sonare mastering-processors
```

:::

::: tip Let the user edit between suggest and render
The intended pattern is to render `chainConfig.params` into editable UI controls, let the user nudge values, then pass the *edited* map to `masterAudio`. The `explanation[]` strings make good inline captions for why each stage is on.
:::

## `masteringStreamingPreview` — preview delivery

Given the source and a list of target platforms, it reports how each platform's loudness normalization will play your audio back — so you can see *before* rendering whether a platform will turn you down and whether the ceiling is at risk.

The input `platforms` are `StreamingPlatform` objects (`name`, `targetLufs`, `ceilingDb`):

This helper is easiest to read as a "what will the platform do?" report.

| Situation | Meaning |
|-----------|---------|
| `normalizationGainDb` is negative | The platform will turn the audio down |
| `normalizationGainDb` is positive | The platform may turn the audio up |
| `ceilingRisk` is `true` | That gain could push peaks past the platform ceiling |

```json
{
  "platforms": [
    { "name": "YouTube", "integratedLufs": -8.70, "truePeakDb": -2.43, "normalizationGainDb": -5.30, "ceilingRisk": false },
    { "name": "Podcast", "integratedLufs": -8.70, "truePeakDb": -2.43, "normalizationGainDb": -7.30, "ceilingRisk": false }
  ]
}
```

| Field | Meaning |
|-------|---------|
| `integratedLufs` / `truePeakDb` | The measured source values (same for every platform) |
| `normalizationGainDb` | The gain the platform will apply to hit its target — **negative means it turns you down** |
| `ceilingRisk` | `true` if normalization would push the signal past the platform ceiling |

::: warning Louder is not better on streaming
A master at −8 LUFS is not "louder" on YouTube — the platform applies the `normalizationGainDb` (here −5.3 dB) to bring everyone to roughly the same loudness, so over-compressing just sacrifices dynamics for no loudness gain. See [Delivery Targets](./glossary/mastering/delivery-targets.md) and [Loudness Matching](./glossary/concepts/loudness-matching.md).
:::

<SonareDemo id="loudness-meter" />

## Related

- [Mastering Processors](./mastering-processors.md) — the processor ids and presets the suggestion references
- [Mastering Implementation](./mastering-implementation.md) — the chain path that actually renders
- [Delivery Targets](./glossary/mastering/delivery-targets.md) · [Reading Mastering Meters](./glossary/mastering/meter-reading.md) · [Quality Checklist](./glossary/mastering/quality-checklist.md)
