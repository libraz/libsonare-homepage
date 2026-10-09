---
title: Mastering Assistant API
description: The libsonare explainable mastering helpers — masteringAudioProfile, masteringAssistantSuggest, and masteringStreamingPreview — with the exact JSON they return and how to turn a suggestion into a rendered master.
---

# Mastering Assistant API

libsonare provides three **JSON-returning** mastering helpers for apps that need *explainable* decisions, not just rendered audio. They run **local DSP analysis only** — no upload and no remote model — and hand back structured JSON your UI can inspect, store in a report, or display. The assistant starts from the preset you provide and uses `streaming` when you omit it.

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
const suggestion = JSON.parse(masteringAssistantSuggest(samples, sampleRate, { preset: 'pop', targetLufs: -14, ceilingDb: -1 }));
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
    samples, sample_rate=sr, params={"preset": "pop", "targetLufs": -14, "ceilingDb": -1}))
preview    = json.loads(sonare.mastering_streaming_preview(samples, sample_rate=sr, platforms=[
    {"name": "YouTube", "targetLufs": -14, "ceilingDb": -1},
    {"name": "Podcast", "targetLufs": -16, "ceilingDb": -1},
]))
```

```bash [CLI]
sonare mastering-profile source.wav
sonare mastering-suggest source.wav --preset pop --params targetLufs=-14,ceilingDb=-1
sonare mastering-streaming source.wav \
  --platforms '[{"name":"YouTube","targetLufs":-14,"ceilingDb":-1},{"name":"Podcast","targetLufs":-16,"ceilingDb":-1}]'
```

:::

### Typed results

The helpers return JSON strings, and their declared types carry the parsed shape. In TypeScript, `masteringAudioProfile` returns `TypedJson<MasteringAudioProfile>`, `masteringAssistantSuggest` returns `TypedJson<MasteringAssistantResult>`, and `masteringStreamingPreview` returns `TypedJson<MasteringStreamingPreviewResult>` (the stereo forms return the same types). `TypedJson<R>` is a plain `string` at run time; `JsonResult<J>` reads the result type back, so a parse can be annotated without restating the shape:

```typescript
import { masteringAudioProfile, type JsonResult } from '@libraz/libsonare';

const profile: JsonResult<ReturnType<typeof masteringAudioProfile>> = JSON.parse(
  masteringAudioProfile(samples, sampleRate),
);
profile.spectral.midRmsDb;      // number
profile.defects.measured;       // boolean
```

`MasteringAssistantResult.profile` is the flat `MasteringAssistantProfile` (`integratedLufs` is `null` for a silent or below-gate input), `chainConfig` is a `MasteringChainConfigDocument` (`version: 1 | 2`), and each streaming-preview row has `integratedLufs: number | null`. Python declares `MasteringAudioProfile`, `MasteringAssistantResult`, and `MasteringStreamingPreviewResult` as `TypedDict`s in `libsonare`.

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

A read-only summary of the input: how loud it is, how its energy is spread across the spectrum, how dynamic it is, and whether the optional defect detectors found damage. Nothing is processed.

Optional `params` accept either JS-style or Python-style names: `nFft`/`n_fft` (default `2048`), `hopLength`/`hop_length` (default `512`) — both are sample counts at 48 kHz, rescaled to the input's rate, and band levels are normalised so they agree across rates, `truePeakOversample`/`true_peak_oversample` (default `4`), and `detectDefects`/`detect_defects` (default `false`).

::: info Why oversample for true peak?
Stored samples have fixed positions, but a band-limited reconstruction can peak *between* them. Here, a 4× interpolation filter estimates those inter-sample peaks. The reported `truePeakDb` approximates the reconstructed signal under that filter; it is not a measurement of a particular converter's analogue output. Higher factors can improve the estimate but cost more CPU.
:::

Use this result to explain the input, not to judge it. A profile can tell you that the source is already loud, dark, dense, or transient-heavy. It does not mean the source has passed or failed mastering.

| What it does | What it does not do |
|--------------|---------------------|
| Measures loudness, true peak, crest factor, spectrum, dynamics, and optional defects | It does not change the audio |
| Gives your UI facts to display before rendering | It does not choose final settings by itself |

The example is the profile of a synthetic four-second loop (kick, hats, and a pad, soft-clipped), so its numbers are only illustrative:

```json
{
  "durationSec": 4,
  "bpm": 119.87,
  "bpmConfidence": 0.76,
  "loudness": {
    "integratedLufs": -9.47,
    "lraLu": 0.02,
    "truePeakDb": -1.94,
    "crestFactorDb": 6.22
  },
  "spectral": {
    "subRmsDb": -29.0, "lowRmsDb": -9.29, "lowMidRmsDb": -15.2, "midRmsDb": -25.5,
    "highMidRmsDb": -43.0, "highRmsDb": -41.44, "airRmsDb": -38.54,
    "centroidHz": 1100.33, "flatness": 0.0017, "rolloffHz": 2327.98
  },
  "dynamics": { "shortTermLufsStd": 0.009, "attackDensity": 3.75, "sustainRatio": 0.997 },
  "defects": { "measured": false }
}
```

`defects` is abbreviated here: with `detectDefects` off, `measured` is `false` and every other defect field is present at its default rather than a reading.

| Group | Field | Meaning |
|-------|-------|---------|
| `loudness` | `integratedLufs` | Overall [loudness](./glossary/lufs.md) (EBU R128) |
| | `lraLu` | Loudness range — how much the loudness moves over time |
| | `truePeakDb` | Inter-sample [true peak](./glossary/true-peak.md) |
| | `crestFactorDb` | Peak-to-RMS contrast — high = punchy, low = dense ([crest factor](./glossary/concepts/crest-factor.md)) |
| `spectral` | `subRmsDb` … `airRmsDb` | Energy per band (sub → air) in dBFS, on the mean-square convention of the noise fields: a full-scale sine reads −3.01 dBFS in its band |
| | `centroidHz` | Spectral "center of mass" — a brightness proxy |
| | `flatness` | 0 = tonal, 1 = noise-like |
| | `rolloffHz` | Frequency below which most energy sits |
| `dynamics` | `attackDensity` | Onsets per second whose percussive rise clears a fixed floor, so a steady tone reads 0 |
| | `sustainRatio` | How sustained vs. transient the material is |
| `defects` | object | Defect counters and measurements; `measured` is `false` unless `detectDefects` is enabled |

::: info Reading the spectral bands
The `*RmsDb` fields go from low to high frequency: `sub` (deep bass) → `low`/`lowMid` (bass and warmth) → `mid` (body, vocals) → `highMid`/`high` (presence, clarity) → `air` (top-end sparkle).

They are dBFS on the mean-square convention of the profile's noise fields, so a band can be read against the noise floor and the other bands on one scale: a full-scale 1 kHz sine reads −3.01 dBFS in its band (measured −3.03 in the `mid` band) and −49 dBFS or lower elsewhere. The loop above reads `lowRmsDb: -9.29`, the loudest band, because the kick and pad sit there. Because music has a natural downward spectral tilt, `air` reads far below `low` on essentially every normal master, so comparing the bands against each other would call almost any track dark. Judge dark versus bright by comparing a band against the *same* band on a reference track or on a previous render.
:::

::: details What do loudness range, attack density, and sustain ratio mean?
- **Loudness range (LRA, in LU)** — how much the perceived loudness swings across the track. A high value means it gets noticeably quieter and louder (a dynamic classical piece); a low value means it stays at roughly one level (a dense EDM master). "LU" (loudness units) is the same scale as LUFS, measured as a spread rather than an absolute.
- **Attack density** — roughly how many sharp note/drum onsets happen per second. Only onset peaks above a fixed floor of percussive rise count, so a steady tone reads 0. High = busy and percussive, low = sparse or sustained.
- **Sustain ratio** (0–1) — whether the material is dominated by long held tones (near 1) or short bursts and attacks (near 0). It is measured separately from attack density (from the RMS envelope, not the onsets) but usually moves in the opposite direction.

Attack density, sustain ratio, and the mixing classifier's hit detection measure against the event maximum with the loudest events set aside: one per 10 s of audio, up to two. Under 10 s nothing is set aside.
- **Short-term LUFS std-dev** — how much the moment-to-moment loudness wobbles. A higher number means the level is restless; near zero means it sits very steadily.
:::

::: warning These are measurements, not verdicts
A `crestFactorDb` of 5.8 is not "bad" — it just describes the signal. Use the profile to *understand* the source and to decide what to change, not as a pass/fail score.
:::

## `masteringAssistantSuggest` — propose a chain

Builds on the profile to propose a ready-to-render mastering chain, plus a human-readable rationale. The third argument carries your intent and the base preset (`preset`, `targetLufs`, `ceilingDb`, …).

Accepted keys are `preset`, `targetPlatform`/`target_platform`, `targetLufs`/`target_lufs`, `ceilingDb`/`ceiling_db`, `enableRepair`/`enable_repair`, `preferStreamingSafe`/`prefer_streaming_safe`, and `speechMonoAmount`/`speech_mono_amount`. `preset` and `targetPlatform` take names; the other keys are numeric or boolean.

::: details What the optional intent keys do
`preset` chooses the chain to start from and defaults to `streaming`; the assistant never infers it from the audio. `targetPlatform` applies its loudness and ceiling only for targets with an explicit rule (`broadcast`, `podcast`, `club`, or `cd`), and only for values you have not supplied. `streaming`, `youtube`, `audiobook`, and `cinema` are accepted names but leave the assistant's current target and ceiling unchanged. `enableRepair` turns on the cleanup stages (declick, denoise, etc.) when the source has defects. The declip stage is proposed only when runs of samples sit pinned at one level and no channel holds audio louder than that level, since the shared threshold would otherwise rewrite unclipped audio; mono input is held to the same rule, and the `explanation` then reads `declip withheld`. `preferStreamingSafe` selects the streaming-safe denoise estimator when repair is enabled. `speechMonoAmount` (0–1) controls how much the speech preset collapses side energy below its 120 Hz mono-maker crossover.
:::

Think of this helper as a preset generator with an explanation. It returns a full starting point that your app can render directly, but the intended workflow is still editable.

| Part of the output | How to use it |
|--------------------|---------------|
| `chainConfig.params` | Fill controls or pass as `masterAudio` overrides |
| `explanation` | Show why stages were enabled or tuned |
| `preset` input | Choose the base preset before calling the assistant |
| `profile` | Keep the suggestion self-contained in reports |

```json
{
  "chainConfig": {
    "version": 1,
    "params": {
      "eq.tilt.enabled": true,
      "eq.tilt.tiltDb": 0.5,
      "dynamics.transientShaper.enabled": true,
      "dynamics.compressor.enabled": true,
      "saturation.exciter.enabled": true,
      "stereo.imager.enabled": true,
      "loudness.enabled": true,
      "loudness.targetLufs": -14,
      "loudness.ceilingDb": -1
    }
  },
  "explanation": [
    "base preset: pop",
    "target loudness and ceiling applied from AssistantConfig"
  ],
  "profile": { "integratedLufs": -9.47, "truePeakDb": -1.94, "crestFactorDb": 6.22, "...": "flattened profile" }
}
```

| Field | Meaning |
|-------|---------|
| `chainConfig.params` | The **full proposed chain** as flat dot-notation keys (`stage.processor.param`). `*.enabled` is a JSON boolean (`true`/`false`). **These are the same keys `masterAudio` overrides accept**, so the suggestion can be rendered directly. |
| `explanation` | Plain-language reasons for each decision — show these in your UI so the choice is transparent. |
| `profile` | A flattened copy of the source profile, so a suggestion is self-contained. |

::: details The params object covers the whole default chain
The example above is trimmed. The real `params` map contains **every** parameter in the selected preset's chain — repair stages, EQ, dynamics, saturation, stereo, the true-peak limiter, and loudness — each with its full parameter set and an `enabled` flag. The assistant starts from the named preset, applies the requested target and ceiling, adds the speech preset's low-frequency mono-maker stage for `speech`, and can enable measured repair stages when `enableRepair` is true. Treat the map as an overridable snapshot of the whole chain, not a sparse diff.
:::

### Turning a suggestion into a master

Because `chainConfig.params` uses `masterAudio`'s override keys, rendering the suggestion is one call. Choose the base preset explicitly, pass the same name to the assistant and to `masterAudio`, and pass the whole params map as overrides:

::: code-group

```typescript [Browser]
const basePreset = 'pop';
const suggestion = JSON.parse(masteringAssistantSuggest(samples, sampleRate, { preset: basePreset, targetLufs: -14, ceilingDb: -1 }));

const mastered = masterAudio(samples, sampleRate, basePreset, suggestion.chainConfig.params);
console.log(mastered.report.before.integratedLufs, '→', mastered.report.after.integratedLufs);
console.log(mastered.report.bandEnergyDeltaDb.length); // 32 frequency bands
```

```typescript [Node]
const basePreset = 'pop';
const suggestion = JSON.parse(masteringAssistantSuggest(samples, sampleRate, { preset: basePreset, targetLufs: -14, ceilingDb: -1 }));

const mastered = masterAudio(samples, sampleRate, basePreset, suggestion.chainConfig.params);
console.log(mastered.report.before.integratedLufs, '→', mastered.report.after.integratedLufs);
console.log(mastered.report.bandEnergyDeltaDb.length); // 32 frequency bands
```

```python [Python]
base_preset = "pop"
suggestion = json.loads(sonare.mastering_assistant_suggest(
    samples, sample_rate=sr, params={"preset": base_preset, "targetLufs": -14, "ceilingDb": -1}))

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
sonare mastering-suggest source.wav --preset pop \
  --target-lufs -14 --ceiling-db -1 --config-out suggestion-chain.json
sonare mastering source.wav --chain-config suggestion-chain.json \
  --report mastering-report.json -o master.wav
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
    { "name": "YouTube", "integratedLufs": -9.47, "truePeakDb": -1.94, "normalizationGainDb": -4.53, "ceilingRisk": false },
    { "name": "Podcast", "integratedLufs": -9.47, "truePeakDb": -1.94, "normalizationGainDb": -6.53, "ceilingRisk": false }
  ]
}
```

| Field | Meaning |
|-------|---------|
| `integratedLufs` / `truePeakDb` | The measured source values (same for every platform) |
| `normalizationGainDb` | The gain the platform will apply to hit its target — **negative means it turns you down** |
| `ceilingRisk` | `true` if normalization would push the signal past the platform ceiling |

::: warning Louder is not better on streaming
A master at −9.5 LUFS is not "louder" on YouTube — the platform applies the `normalizationGainDb` (here −4.5 dB) to bring everyone to roughly the same loudness, so over-compressing just sacrifices dynamics for no loudness gain. See [Delivery Targets](./glossary/mastering/delivery-targets.md) and [Loudness Matching](./glossary/concepts/loudness-matching.md).
:::

<SonareDemo id="loudness-meter" />

## Stereo sources

The three helpers above take a single buffer. To use them on a stereo track you have to hand them a `0.5 * (left + right)` downmix, and that downmix is not a neutral stand-in for the pair: it measures quieter than the program actually is, because content that differs between the channels partly cancels when you sum them.

The size of the error depends on how correlated the two channels are. Measuring a decorrelated pink-noise pair (48 kHz, 4 s), the downmix reports **−18.45 LUFS** where the stereo path reports **−12.43 LUFS** — a **6.03 dB** under-read. On a pair whose channels are identical the gap is 3.01 dB, and all of it comes from the stereo side: BS.1770 sums the two channels' mean squares, while the downmix of identical channels is not attenuated at all (`0.5 * (L + L)` is just `L`). The remaining ~3 dB on the decorrelated pair is the cancellation in the downmix itself. Wide, reverberant, or heavily stereo-imaged material sits near the larger figure.

That single measurement propagates:

| What reads low | Consequence |
|----------------|-------------|
| Integrated loudness in the profile | The source looks quieter than it is |
| The suggested loudness stage | The proposed chain aims to add gain that is not needed |
| `normalizationGainDb` in the delivery preview | The platform looks like it will turn you up more than it will |
| `ceilingRisk` | Follows from that loudness, so a real ceiling risk can read as safe |

On the same decorrelated pair, a −14 LUFS target reports `normalizationGainDb` **+4.45** through the mono path against **−1.57** through the stereo path — the mono answer overstates the available headroom by the full 6 dB.

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
