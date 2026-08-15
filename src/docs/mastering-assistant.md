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

Each of the three has a stereo counterpart that takes a left/right pair instead of one buffer. They return the same JSON schema, so everything on this page applies to both — see [Stereo sources](#stereo-sources) for when the mono entry point is the wrong tool.

| Step | Mono | Stereo |
|------|------|--------|
| Inspect the source | `masteringAudioProfile` | `masteringAudioProfileStereo` |
| Propose a chain | `masteringAssistantSuggest` | `masteringAssistantSuggestStereo` |
| Preview delivery | `masteringStreamingPreview` | `masteringStreamingPreviewStereo` |

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

::: warning Short clips: profile and suggest work, but need real spectral content to be meaningful
`masteringAudioProfile` and `masteringAssistantSuggest` run a full [STFT](./glossary/analysis/spectrogram-stft.md) (short-time Fourier transform — a frequency analysis taken over short successive windows) based analysis (default `nFft` = 2048). They only reject a **completely empty** buffer (`SonareError`, "audio input must be a non-empty buffer") — any non-empty buffer, however short, is accepted and processed. The `nFft`-sized window (default 2048 samples) is advisory, not an error condition: a buffer shorter than one full window has too little spectral content to produce a meaningful profile, so treat "shorter than `nFft`" as a quality warning to show the user, not a failure to guard against. `masteringStreamingPreview` only measures loudness, so it tolerates any non-empty audio buffer; an empty `platforms` list is also fine — it falls back to a built-in default set (Spotify, Apple Music, YouTube). When feeding short captures or file-picker selections from the UI, wrap the profile/suggest calls in `try`/`catch` using `isSonareError` to handle the empty-buffer case, and consider a soft length hint (rather than a hard block) for buffers shorter than `nFft`.

```typescript [Browser]
import { masteringAudioProfile, isSonareError } from '@libraz/libsonare';

const ONE_ANALYSIS_WINDOW = 2048; // default nFft — a quality hint, not a hard limit
const shortClip = samples.length < ONE_ANALYSIS_WINDOW; // show a "limited spectral content" note

try {
  const profile = JSON.parse(masteringAudioProfile(samples, sampleRate));
  if (shortClip) {
    // Still succeeded — flag the result as low-confidence in the UI.
  }
} catch (err) {
  if (isSonareError(err)) {
    // Only a completely empty buffer reaches here.
  } else {
    throw err;
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
| `spectral` | `subRmsDb` … `airRmsDb` | Relative energy per band (sub → air) on an internal scale, not dBFS — compare against a reference, not across bands |
| | `centroidHz` | Spectral "center of mass" — a brightness proxy |
| | `flatness` | 0 = tonal, 1 = noise-like |
| | `rolloffHz` | Frequency below which most energy sits |
| `dynamics` | `attackDensity` | How busy the transients are |
| | `sustainRatio` | How sustained vs. transient the material is |
| `genreCandidates` | `[{name, score}]` | Best-matching styles; the top one seeds the suggestion's base preset |

::: info Reading the spectral bands
The `*RmsDb` fields go from low to high frequency: `sub` (deep bass) → `low`/`lowMid` (bass and warmth) → `mid` (body, vocals) → `highMid`/`high` (presence, clarity) → `air` (top-end sparkle).

They are relative band levels on an internal FFT scale, not dBFS — the example above reads `lowRmsDb: 40.35`, well above 0. And because music has a natural downward spectral tilt, `air` reads far below `low` on essentially every normal master, so comparing the bands against each other would call almost any track dark. Judge dark versus bright by comparing a band against the *same* band on a reference track or on a previous render. The genre heuristics inside the library work the same way: their dull/lo-fi test is `air` sitting more than 22 dB below `mid`, not below 0.
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
      "eq.tilt.enabled": true,
      "eq.tilt.tiltDb": -0.5,
      "dynamics.transientShaper.enabled": true,
      "dynamics.compressor.enabled": true,
      "dynamics.compressor.thresholdDb": -18,
      "saturation.tape.enabled": true,
      "spectral.airBand.enabled": true,
      "maximizer.truePeakLimiter.enabled": true,
      "maximizer.truePeakLimiter.ceilingDb": -1,
      "loudness.enabled": true,
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
| `chainConfig.params` | The **full proposed chain** as flat dot-notation keys (`stage.processor.param`). `*.enabled` is a JSON boolean (`true`/`false`). **These are the same keys `masterAudio` overrides accept**, so the suggestion can be rendered directly. |
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
console.log(mastered.report.before.integratedLufs, '→', mastered.report.after.integratedLufs);
console.log(mastered.report.bandEnergyDeltaDb.length); // 32 frequency bands
```

```typescript [Node]
const suggestion = JSON.parse(masteringAssistantSuggest(samples, sampleRate, { targetLufs: -14, ceilingDb: -1 }));
const basePreset = suggestion.genreCandidates[0].name;

const mastered = masterAudio(samples, sampleRate, basePreset, suggestion.chainConfig.params);
console.log(mastered.report.before.integratedLufs, '→', mastered.report.after.integratedLufs);
console.log(mastered.report.bandEnergyDeltaDb.length); // 32 frequency bands
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
assert mastered.report is not None
print(mastered.report.before.integrated_lufs, "→", mastered.report.after.integrated_lufs)
print(len(mastered.report.band_energy_delta_db))  # 32 frequency bands
```

```bash [CLI]
sonare mastering source.wav --target-lufs -14 --ceiling-db -1 \
  --report mastering-report.json -o master.wav
sonare mastering-processors
```

:::

The result keeps the convenient top-level loudness fields and adds a `report` for before/after UI. Each side includes integrated, maximum momentary, and maximum short-term LUFS, true peak, and loudness range. The report also carries applied gain, maximum gain reduction, whether the peak ceiling limited the loudness target, and 32 after-minus-before band-energy deltas. The CLI writes the same report shape with snake_case keys when `--report` is supplied.

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

## Stereo sources

The three helpers above take a single buffer. To use them on a stereo track you have to hand them a `0.5 * (left + right)` downmix, and that downmix is not a neutral stand-in for the pair: it measures quieter than the program actually is, because content that differs between the channels partly cancels when you sum them.

The size of the error depends on how correlated the two channels are. Measuring a decorrelated pair at 48 kHz, the downmix reports **−22.55 LUFS** where the stereo path reports **−16.44 LUFS** — a **6.11 dB** under-read. On a pair whose channels are identical the gap is 3.01 dB, and all of it comes from the stereo side: BS.1770 sums the two channels' mean squares, while the downmix of identical channels is not attenuated at all (`0.5 * (L + L)` is just `L`). The remaining ~3 dB on the decorrelated pair is the cancellation in the downmix itself. Wide, reverberant, or heavily stereo-imaged material sits near the larger figure.

That single measurement propagates:

| What reads low | Consequence |
|----------------|-------------|
| Integrated loudness in the profile | The source looks quieter than it is |
| The suggested loudness stage | The proposed chain aims to add gain that is not needed |
| `normalizationGainDb` in the delivery preview | The platform looks like it will turn you up more than it will |
| `ceilingRisk` | Follows from that loudness, so a real ceiling risk can read as safe |

On the same decorrelated pair, the Spotify row reports `normalizationGainDb` **+8.55** through the mono path against **+2.44** through the stereo path — the mono answer overstates the available headroom by the full 6 dB.

So reach for the stereo entry points whenever the source is genuinely stereo. Pass `left` and `right` and the helpers measure the pair directly, with BS.1770 channel summing for integrated loudness and the larger of the two channel true peaks.

```typescript
import { init, masteringAudioProfileStereo, masteringStreamingPreviewStereo } from '@libraz/libsonare';

await init();

// Request form only — these entry points have no positional overload.
const profile = JSON.parse(masteringAudioProfileStereo({ left, right, sampleRate }));
console.log(profile.loudness.integratedLufs);

// Omitting `platforms` falls back to Spotify / Apple Music / YouTube.
const preview = JSON.parse(masteringStreamingPreviewStereo({ left, right, sampleRate }));
```

```python
import json
import libsonare as sonare

profile = json.loads(sonare.mastering_audio_profile_stereo(left, right, sample_rate=sample_rate))
preview = json.loads(sonare.mastering_streaming_preview_stereo(left, right, sample_rate=sample_rate))
```

::: info Only the loudness block changes
The stereo profile measures its `loudness` block from both channels — integrated LUFS and LRA from the channel-summed program, true peak as the larger of the two. The `spectral`, `dynamics`, and tempo fields describe shape and timing rather than absolute level, so they are still measured on the downmix. That is deliberate: it keeps them directly comparable with `masteringAudioProfile` on the same material.
:::

`masteringAssistantSuggestStereo` profiles through `masteringAudioProfileStereo`, so its loudness stage is built on the channel-summed program rather than on a downmix reading 6 dB low. The rest of the suggestion — the processor selection and the rationale text — has the same shape as the mono call.

## Related

- [Mastering Processors](./mastering-processors.md) — the processor ids and presets the suggestion references
- [Mastering Implementation](./mastering-implementation.md) — the chain path that actually renders
- [Delivery Targets](./glossary/mastering/delivery-targets.md) · [Reading Mastering Meters](./glossary/mastering/meter-reading.md) · [Quality Checklist](./glossary/mastering/quality-checklist.md)
