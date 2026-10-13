---
title: JavaScript/TypeScript Mastering API
description: The mastering chain, named processors, presets, one-shot dynamics and repair processors, of the libsonare JavaScript/TypeScript package; the mixing API is on the audio page. Streaming processors and the chain config schema live on their own pages.
---

# JavaScript/TypeScript Mastering API

This page covers the offline mastering entry points of the libsonare JavaScript/TypeScript package: the chain and preset calls, the explainable-mastering helpers, the one-shot dynamics and repair processors. Two related references live alongside it: [Streaming and Realtime API](./js-api-streaming.md) covers `StreamingEqualizer`, `StreamingRetune`, `RealtimeVoiceChanger`, `voiceChangeRealtime(...)`, and `StreamingMasteringChain`, and the `MasteringChainConfig` schema with its result types is on [Types and Enumerations](./js-api-types.md#masteringchainconfig).

## Mastering API

The browser package includes the same named mastering processors that the `/mastering` demo runs as inserts on the realtime engine. Decode audio with the Web Audio API, pass `Float32Array` channel buffers to libsonare, then export the returned samples as WAV in your application.

This section lists the JS entry points and their result/config types. For what each processor does, the preset list, and the analysis/assistant JSON, see [Mastering Processors](./mastering-processors.md) and [Mastering Assistant](./mastering-assistant.md).

### Which entry point

| You have | Use |
|---|---|
| One named processor to run | `masteringProcess()` |
| A preset, with optional overrides | `masterAudio()` / `masterAudioStereo()` |
| A full stage config | `masteringChain()` / `masteringChainStereo()` |
| Audio arriving block by block | `StreamingMasteringChain`, with `streamingLoudnessGain()` for its loudness stage |
| No idea where to start | `masteringAssistantSuggestChain()`, then `masterAudio({ overrides })` |

### Named functions

| Purpose | Function |
|---------|----------|
| Apply simple loudness mastering | `mastering()` |
| List built-in mastering presets | `masteringPresetNames()` |
| Expand one preset into flat chain parameters | `masteringPresetParams(preset)` |
| Apply a preset to mono audio | `masterAudio()` |
| Apply a preset to stereo audio | `masterAudioStereo()` |
| Apply a preset to mono audio with progress | `masterAudioWithProgress()` |
| Apply a preset to stereo audio with progress | `masterAudioStereoWithProgress()` |
| Run a full mono chain | `masteringChain()` |
| Run a full stereo chain | `masteringChainStereo()` |
| Run a full mono chain with progress | `masteringChainWithProgress()` |
| Run a full stereo chain with progress | `masteringChainStereoWithProgress()` |
| Run block-by-block EQ | `StreamingEqualizer` |
| Run a streaming chain (block-by-block) | `StreamingMasteringChain` |
| Measure the loudness numbers a streaming chain is built with | `streamingLoudnessGain()` / `streamingLoudnessGainStereo()` |
| Summarize source audio for mastering decisions | `masteringAudioProfile()` |
| Summarize a stereo pair for mastering decisions | `masteringAudioProfileStereo()` |
| Suggest mastering moves from source analysis | `masteringAssistantSuggest()` |
| Suggest mastering moves from a stereo pair | `masteringAssistantSuggestStereo()` |
| Take just the suggested chain, ready to use as `overrides` | `masteringAssistantSuggestChain()` / `masteringAssistantSuggestChainStereo()` |
| Preview loudness targets for delivery platforms | `masteringStreamingPreview()` |
| Preview delivery loudness for a stereo pair | `masteringStreamingPreviewStereo()` |
| List mono/stereo processors | `masteringProcessorNames()` |
| Get machine-readable processor classifications | `masteringProcessorCatalog()` |
| List chain insert processors | `masteringInsertNames()` |
| List the parameter keys an insert accepts | `masteringInsertParamNames(name)` |
| Describe construction keys and realtime insert parameters | `masteringInsertParamInfo(name, sampleRate?)` |
| Measure configured insert latency and tail | `masteringInsertTiming(name, params, sampleRate)` |
| Process mono audio | `masteringProcess()` |
| Process stereo audio | `masteringProcessStereo()` |
| List pair processors | `masteringPairProcessorNames()` |
| Process source/reference pair | `masteringPairProcess()` / `masteringPairProcessStereo()` |
| List pair analyses | `masteringPairAnalysisNames()` |
| Analyze source/reference pair | `masteringPairAnalyze()` |
| List stereo analyses | `masteringStereoAnalysisNames()` |
| Analyze stereo channels | `masteringStereoAnalyze()` |
| Analyze and repair any channel count in one call | `masteringRepairAnalyze()` / `masteringRepairApply()` — see [Audio Repair Workflow](./audio-repair.md#measure-and-repair-in-one-call) |

```typescript
import { init, masterAudioStereo, masteringChainStereo } from '@libraz/libsonare'

await init()

// Full chain with explicit stage config
const result = masteringChainStereo(left, right, sampleRate, {
  spectral: { airBand: { amount: 0.35, shelfFrequencyHz: 14000 } },
  maximizer: { truePeakLimiter: { ceilingDb: -1, oversampleFactor: 4 } },
  loudness: { targetLufs: -14, ceilingDb: -1, truePeakOversample: 4 },
})
console.log(result.outputLufs, result.outputTruePeakDbtp, result.outputLra)
if (result.loudnessTargetLimited) {
  console.warn('The true-peak ceiling prevented the requested LUFS target.')
}
console.log(result.stageGainReductions)

// Preset with nested overrides (the typed MasteringChainConfig shape)
const presetResult = masterAudioStereo(left, right, sampleRate, 'pop', {
  loudness: { targetLufs: -14 },
  maximizer: { truePeakLimiter: { releaseMs: 50 } },
})
```

::: warning In request-object form, stage config sits under `config`
`masteringChain({ samples, sampleRate, config: { loudness: { targetLufs: -14 } } })` applies the target. A `loudness` key written beside `samples` (`masteringChain({ samples, sampleRate, loudness: { targetLufs: -14 } })`) throws a `TypeError` that names the key and points to `config`. The same holds for `masteringChainStereo` and the `*WithProgress` variants. The positional form takes the config as its last argument, and `masterAudio` takes its overrides as `overrides`.
:::

Each of these has a `*WithProgress` variant taking an `(progress, stage) => void` callback. `masteringProcess(...)` / `masteringProcessStereo(...)` run one named processor, and `masteringStereoAnalyze(...)` returns a JSON report.

Offline chain and preset results include `outputTruePeakDbtp`, `outputLra`, `loudnessTargetLimited`, and `stageGainReductions`.

When `loudnessTargetLimited` is true, the true-peak ceiling prevented the requested LUFS target. Report `outputLufs`, not the requested target. Each `StageGainReduction` gives the most recent gain reduction for one dynamics or maximizer stage.

#### `report` — before and after in one object

Every offline chain result also carries a `report`, which is the "what did this
actually do" summary you would otherwise assemble by measuring the input
yourself:

```typescript
interface MasteringReport {
  before: MasteringLoudnessSummary;
  after: MasteringLoudnessSummary;
  appliedGainDb: number;
  maxGainReductionDb: number;
  loudnessTargetLimited: boolean;
  /** 32 logarithmically spaced after-minus-before energy deltas, in dB. */
  bandEnergyDeltaDb: Float32Array;
}

interface MasteringLoudnessSummary {
  integratedLufs: number;
  maxMomentaryLufs: number;
  maxShortTermLufs: number;
  truePeakDbtp: number;
  loudnessRange: number;
}
```

```typescript
const { report } = masteringChainStereo(left, right, sampleRate, config);
console.log(report.before.integratedLufs, '→', report.after.integratedLufs);
console.log(report.after.loudnessRange - report.before.loudnessRange, 'LU of range change');
drawTiltCurve(report.bandEnergyDeltaDb);   // 32 bands, positive = brighter after
```

The same object is mirrored on the C ABI, ctypes, Node, Python, and both CLI
report files, so a report exported from the CLI and one read in the browser have
the same shape.

The explainable-mastering helpers — `masteringAudioProfile(...)`, `masteringAssistantSuggest(...)`, and `masteringStreamingPreview(...)` — return JSON strings typed as `TypedJson<MasteringAudioProfile>`, `TypedJson<MasteringAssistantResult>`, and `TypedJson<MasteringStreamingPreviewResult>` (`JsonResult<J>` reads the parsed type back); see [Mastering Assistant](./mastering-assistant.md) for their exact shapes, accepted options, and how to turn a suggestion into a rendered master. Reference-track workflows use `masteringPairProcessorNames()` and `masteringPairAnalyze()` (matched sample rate and comparable duration). `masteringPairProcess()` runs a mono two-input `match.*` processor; its stereo counterpart `masteringPairProcessStereo()` is described below.

#### Stereo entry points for the explainable helpers

Each of the three has a stereo counterpart that measures the channel pair directly. They are **request-object only** — there is no positional overload, and a positional call throws a `TypeError`.

```typescript
function masteringAudioProfileStereo(request: MasteringStereoParamsRequest): TypedJson<MasteringAudioProfile>
function masteringAssistantSuggestStereo(request: MasteringAssistantStereoParamsRequest): TypedJson<MasteringAssistantResult>
function masteringStreamingPreviewStereo(request: MasteringStreamingPreviewStereoRequest): TypedJson<MasteringStreamingPreviewResult>

interface MasteringStereoParamsRequest {
  left: Float32Array;
  right: Float32Array;
  sampleRate?: number;
  params?: MasteringProcessorParams;
}

type MasteringAssistantParams = Record<string, number | boolean | string>;

interface MasteringAssistantStereoParamsRequest {
  left: Float32Array;
  right: Float32Array;
  sampleRate?: number;
  params?: MasteringAssistantParams;
}

interface MasteringStreamingPreviewStereoRequest {
  left: Float32Array;
  right: Float32Array;
  sampleRate?: number;
  platforms?: StreamingPlatform[];
}
```

`MasteringAssistantParams` accepts `number | boolean | string` values for assistant options such as a target platform or preset. `MasteringStereoParamsRequest` remains the profile request shape, whose `params` values are `number | boolean`.

```typescript
const profile = JSON.parse(masteringAudioProfileStereo({ left, right, sampleRate }));
const suggestion = JSON.parse(masteringAssistantSuggestStereo({ left, right, sampleRate }));
const preview = JSON.parse(
  masteringStreamingPreviewStereo({
    left,
    right,
    sampleRate,
    platforms: [{ name: 'Spotify', targetLufs: -14, ceilingDb: -1 }],
  }),
);
```

Use them for anything stereo. The mono helpers measure a `0.5 * (left + right)` downmix, and on decorrelated material that downmix reads about 6 dB low — so the integrated loudness, the normalization gain derived from it, and the ceiling-risk judgment are all under-reported by the same amount. Measured on a decorrelated pink-noise pair (48 kHz, 4 s), the downmix path reported **-18.45 LUFS** against the stereo path's **-12.43 LUFS**, a **6.03 dB** gap, and a -14 LUFS target's `normalizationGainDb` came out at **+4.45** through the downmix versus **-1.57** through the stereo path. On a correlated pair the gap shrinks to 3.01 dB, which is just the halving; the remaining ~3 dB is the decorrelation.

Only the `loudness` block of the stereo profile is measured from both channels: integrated LUFS and LRA come from the channel-summed program, and the true peak is the larger of the two. The spectral, dynamics, and tempo fields describe shape and timing rather than absolute level, so they stay measured on the downmix and remain directly comparable with `masteringAudioProfile`.

#### Taking the chain without the document

`masteringAssistantSuggest(...)` answers with the whole assistant document as a
JSON string, and the chain it proposes is one block inside it. When the chain is
all you want, these hand it over directly — already the flat
`{ key: number | boolean }` map, no JSON parsing and no digging:

```typescript
function masteringAssistantSuggestChain(
  request: MasteringAssistantParamsRequest,
): Record<string, number | boolean>

function masteringAssistantSuggestChainStereo(
  request: MasteringAssistantStereoParamsRequest,
): Record<string, number | boolean>
```

The map is exactly the shape `mastering(...)` and `masterAudio(...)` take as
`overrides` — `masterAudioStereo(...)` for the stereo one — so the suggestion can
be applied without a translation step:

```typescript
const chain = masteringAssistantSuggestChainStereo({ left, right, sampleRate });
const mastered = masterAudioStereo({ left, right, sampleRate, overrides: chain });
```

Both are request-object only, and the stereo one measures the pair directly for
the same reason the other stereo entry points do. Python spells them
`mastering_assistant_suggest_chain` and
`mastering_assistant_suggest_chain_stereo`.

#### `streamingLoudnessGain(request)`

A `StreamingMasteringChain` cannot measure whole-signal loudness, so its loudness stage needs a precomputed static gain. `streamingLoudnessGain` runs the offline chain described by `config` up to the loudness stage and measures there, so the gain it returns is the one `masteringChain` applies, ceiling clamp included.

```typescript
function streamingLoudnessGain(request: StreamingLoudnessGainRequest): StreamingLoudnessGainResult
function streamingLoudnessGainStereo(request: StreamingLoudnessGainStereoRequest): StreamingLoudnessGainResult
// request: { samples | left + right: Float32Array; sampleRate?: number; config?: MasteringChainConfig }

interface StreamingLoudnessGainResult {
  loudnessStaticGainDb: number;  // the gain the offline loudness stage applies
  truePeakDb: number;            // dBTP of the loudness stage's input; -120 for digital silence
  integratedLufs: number;        // LUFS of that input; -Infinity below the absolute gate
}
```

```typescript
const config = { loudness: { enabled: true, targetLufs: -14, ceilingDb: -1 } };
const { loudnessStaticGainDb, truePeakDb } = streamingLoudnessGain({ samples, sampleRate, config });
const chain = new StreamingMasteringChain({
  ...config,
  loudnessStaticGainDb,
  loudnessStaticGainPeakDb: truePeakDb,
});
```

The measurement is taken at the loudness stage's input, where the offline chain measures it, not on the source. The gain is computed from `config.loudness` whether or not the stage is enabled, and a silent or below-gate input yields 0 dB. On a soft-clipped synthetic loop at -9.47 LUFS with a -14 LUFS target and -1 dBTP ceiling the gain was -4.53 dB, equal to the chain's `report.appliedGainDb`. The stereo form sums the two channels with BS.1770 weights. Python spells them `streaming_loudness_gain` and `streaming_loudness_gain_stereo` and returns a `StreamingLoudnessGain` with `loudness_static_gain_db`, `true_peak_db`, and `integrated_lufs`.

#### `masteringPlatformNames()`

```typescript
function masteringPlatformNames(): string[]
```

The delivery targets accepted as `targetPlatform`, in index order — `'streaming'`, `'broadcast'`, `'club'` and whatever else the loaded build carries. It is read from the library rather than hardcoded in the binding, so a target added to the core shows up here without a binding change. Populate a picker from it instead of shipping your own list.

#### `masteringAbMatchLoudness(request)`

Gain-match one take to another's loudness so an A/B comparison is about tone, not level.

```typescript
function masteringAbMatchLoudness(request: MasteringAbMatchLoudnessRequest): LoudnessMatchResult

interface MasteringAbMatchLoudnessRequest {
  source: Float32Array;      // the take that gets the gain
  reference: Float32Array;   // returned untouched
  sampleRate?: number;       // default 22050
  referenceSampleRate?: number; // default: sampleRate; resampled onto sampleRate before it is measured
}

interface LoudnessMatchResult {
  samples: Float32Array;        // source, at reference's loudness
  sampleRate: number;
  referenceLufs: number;        // BS.1770 integrated
  sourceLufs: number;           // before the gain
  appliedGainDb: number;        // the gain that lands the remeasured source on referenceLufs
  matchedTruePeakDbtp: number;  // true peak after the gain
}
```

Request-object only. The two buffers may differ in length — each is measured on its own program — and the reference may be recorded at its own rate through `referenceSampleRate`.

::: warning The gain is uncapped, and the result can exceed 0 dBTP
`appliedGainDb` is the gain that lands the *remeasured* source on `referenceLufs`: it equals `referenceLufs - sourceLufs` unless the gain moves blocks across the absolute gate, in which case it is solved for the target. It has no upper bound and no headroom clamp is applied, so `matchedTruePeakDbtp` can come back **above `0`**. That is deliberate: clamping for headroom would silently no-op the match for any source already near full scale, which is exactly the case an A/B is most often set up to examine. Check `matchedTruePeakDbtp` yourself and attenuate the pair together if you are about to render rather than audition.

When either take is silent or sits below the measurement gate, its LUFS field is **non-finite** and `appliedGainDb` is `0` — the source comes back unchanged. Test `Number.isFinite(result.sourceLufs)` before presenting a figure.
:::

`masteringStreamingPreviewStereo` treats `platforms` exactly as the mono helper does: omit it or pass an empty array and the preview falls back to the built-in Spotify / Apple Music / YouTube set, returning three rows rather than throwing.

#### `masteringAbMatchLoudnessStereo(request)`

```typescript
function masteringAbMatchLoudnessStereo(request: MasteringAbMatchLoudnessStereoRequest): LoudnessMatchStereoResult
// request: { sourceLeft, sourceRight, referenceLeft, referenceRight: Float32Array; sampleRate?: number; referenceSampleRate?: number } -> { left, right, sampleRate, referenceLufs, sourceLufs, appliedGainDb, matchedTruePeakDbtp }
```

The stereo form of `masteringAbMatchLoudness`: one gain, measured on the stereo program, goes to both source channels, so the left/right balance is unchanged. Request-object only; each pair's two channels must be equal in length or the call throws a `RangeError`, and the source and reference pairs may differ. Measured on decorrelated pink noise: -12.43 LUFS matched to -1.99 LUFS applied 10.44 dB, and both channels came back at 3.3256 times their input RMS. `matchedTruePeakDbtp` is the maximum over both channels. The uncapped gain and the non-finite LUFS of a silent take behave as in the mono call: a silent source gave `sourceLufs` of `-Infinity`, `appliedGainDb` of `0`, and unchanged samples.

#### `masteringPairProcessStereo(request)`

```typescript
function masteringPairProcessStereo(request: MasteringPairProcessStereoRequest): MasteringStereoResult
// request: { processorName: 'match.abCrossfade', sourceLeft, sourceRight, referenceLeft, referenceRight, sampleRate?, referenceSampleRate?, params? }; the positional form is in that order and has no reference rate
```

`match.abCrossfade` is the only `StereoPairProcessor`; any other name throws a `SonareError` (`unsupported stereo pair processor`). The result is a static linear blend, `(1 - mix) * source + mix * reference`, as long as the shorter pair. `mix` defaults to `0.5` and must lie in `[0, 1]` (outside it the call throws a `SonareError`); `0` returns the source and `1` the reference. Measured on in-phase tones (source RMS 0.0707, reference RMS 0.2828): the default gave 0.1768, `mix: 0.25` gave 0.1237, a 4 s source against a 2 s reference returned 2 s, and `latencySamples` was 0.

#### A reference at its own sample rate

`masteringPairProcess`, `masteringPairProcessStereo`, `masteringPairAnalyze`, `masteringAbMatchLoudness`, `masteringAbMatchLoudnessStereo` and the options of `StreamingEqualizer.match` (`EqMatchOptions`) take `referenceSampleRate` in the request form. Omitted, the reference is at `sampleRate`. A reference at another rate is resampled onto the source's rate before it is processed or measured; equal rates are processed untouched. A delay estimate (`match.estimateReferenceDelaySamples`) is reported in source-rate samples. `StreamingEqualizer.match` needs no equal-length buffers. The positional forms carry no reference rate and treat both buffers as being at `sampleRate`.

#### `lufsSeriesInterleaved(...)`

Momentary (400 ms) and short-term (3 s) LUFS series over a multichannel program, with the BS.1770-4 channel sum. The mono `momentaryLufs` / `shortTermLufs` on [Features](./js-api-features.md) measure one channel each; this is their multichannel counterpart.

```typescript
function lufsSeriesInterleaved(request: LufsSeriesInterleavedRequest): LufsSeriesResult
function lufsSeriesInterleaved(samples: Float32Array, channels: number, sampleRate?: number, options?: ValidateOptions): LufsSeriesResult

interface LufsSeriesInterleavedRequest {
  samples: Float32Array;   // interleaved: frames * channels values
  channels: number;        // positive integer
  sampleRate?: number;     // default 22050 — pass the buffer's real rate
  validate?: boolean;
}

interface LufsSeriesResult {
  momentary: Float32Array;  // 400 ms series
  shortTerm: Float32Array;  // 3 s series
}
```

The buffer is the same interleaved layout `lufsInterleaved` takes (`L0, R0, L1, R1, …`), which is also what a decoder hands you, so nothing has to be split per channel before measuring. The frame count is derived from it: `samples.length / channels`. A length that is not a multiple of `channels` throws a `RangeError`; a *wrong* `channels` that still divides the length does not throw and reads the buffer under the wrong layout, so take the count from the decoder rather than assuming stereo.

It exists because a multichannel series cannot be assembled from mono ones. BS.1770 sums the K-weighted per-channel block energies and only then converts to LUFS, so running `momentaryLufs` per channel and combining in dB gives a different number, and a `0.5 * (left + right)` downmix reads low on decorrelated material, the same trap the stereo helpers above exist to avoid. Both series fall out of one K-weighting pass, which is why the result always carries both; there is nothing to save by asking for one. With `channels: 1` the two series match the mono meters element for element.

`sampleRate` has to be the buffer's actual rate: K-weighting is sample-rate dependent, so the `22050` default gives a wrong answer for real audio rather than an error. A signal shorter than a window yields an empty array for that series, not an error, so `shortTerm` can be empty while `momentary` is not.

### Amp preset catalog

`masteringAmpPresetCatalog()` returns the built-in amp-sim rigs as `{ index, name, params }` objects. `index` selects the rig through `saturation.ampSim`'s `presetIndex`; `params` contains its resolved numeric and boolean controls before user overrides. Save the index and explicit overrides in a project so the engine can supply the rig's defaults when it is loaded.

### Preset parameters and configured insert timing

`masteringPresetNames()` is the compact name list. `capabilityCatalog().masteringPresets` adds one metadata object per name: `kind` is `mastering` or `restoration`, and restoration entries have `null` for `targetLufs`, `truePeakCeilingDb`, and `maxLimiterGainReductionDb`.

```typescript
function masteringPresetParams(preset: MasteringPreset): Record<string, number | boolean>
```

`masteringPresetParams` returns the flat numeric/boolean map used by the assistant chain and accepted as the `overrides` argument of `masterAudio` and `masterAudioStereo`. Unknown preset names throw, and a preset, processor, analysis or platform name with an embedded NUL is refused with a `RangeError` naming the field.

The catalog's `latencySamples` and `tailSamples` values are representative defaults. Query a prepared configuration when those values matter for routing or scheduling:

```typescript
function masteringInsertTiming(
  name: string,
  params: Record<string, number | boolean | string | number[]>,
  sampleRate: number,
): { latencySamples: number; tailSamples: number }
```

`masteringInsertTiming` applies the supplied construction parameters and returns the exact latency and tail for that sample rate. It accepts every value type the insert's parameter descriptor declares — numbers, booleans, enum names, and the string and array keys such as the amp-sim `preset` and `cabIrF32Base64`, the convolution `irF32Base64` and the room-morph `bandAbsorption` / `bandScattering` — checked against the descriptor's `type`, so the query reproduces the insert a scene or strip builds. A value of the wrong type is a `TypeError`, a non-finite number a `RangeError`. Unknown keys and invalid sample rates throw a `SonareError`, as does a processor that cannot be prepared. Passing `{}` at 48 kHz gives the default configuration represented by the processor catalog; use the actual insert parameters when a topology or slot changes the timing.

Related mastering guides: [Processing chain](./glossary/mastering.md), [Tone and air](./glossary/mastering/tone-air.md), [Dynamics](./glossary/mastering/dynamics.md), [Stereo, limiter, and loudness](./glossary/mastering/stereo-limiter-loudness.md), [Reference match](./glossary/mastering/reference-match.md).

### Standalone dynamics and repair processors

Every named stage is also a one-shot function, so you can run a single processor without assembling a chain. The dynamics processors return a `DynamicsResult` (the processed `samples` plus `latencySamples`, the processor's lookahead latency in samples); the repair processors return a `Float32Array`.

```typescript
// Offline dynamics
function masteringDynamicsCompressor(samples: Float32Array, sampleRate: number, options?: CompressorOptions): DynamicsResult
function masteringDynamicsGate(samples: Float32Array, sampleRate: number, options?: GateOptions): DynamicsResult
function masteringDynamicsTransientShaper(samples: Float32Array, sampleRate: number, options?: TransientShaperOptions): DynamicsResult

// Offline repair
function masteringRepairDeclick(samples: Float32Array, sampleRate: number, options?: DeclickOptions): Float32Array
function masteringRepairDeclip(samples: Float32Array, sampleRate: number, options?: DeclipOptions): Float32Array
function masteringRepairDecrackle(samples: Float32Array, sampleRate: number, options?: DecrackleOptions): Float32Array
function masteringRepairDehum(samples: Float32Array, sampleRate: number, options?: DehumOptions): Float32Array
function masteringRepairDenoiseClassical(samples: Float32Array, sampleRate: number, options?: DenoiseClassicalOptions): Float32Array
function masteringRepairDereverbClassical(samples: Float32Array, sampleRate: number, options?: DereverbClassicalOptions): Float32Array
function masteringRepairTrimSilence(samples: Float32Array, sampleRate: number, options?: TrimSilenceOptions): Float32Array
```

<SonareDemo id="compressor-curve" />

The one-shot repair helpers and the chain-config repair stages are offline. `StreamingMasteringChain` rejects `repair.declick`, `repair.declip`, `repair.decrackle`, `repair.dehum`, and `repair.dereverb`, and accepts `repair.denoise` with a causal noise estimator (`mcra`, `imcra`, or the default `spp`); `quantile` is refused by name. Four of the repair processors — `repair.decrackle`, `repair.dehum`, `repair.denoiseClassical`, and `repair.dereverbClassical` — are also causal realtime inserts under those ids; see [Audio Repair Workflow](./audio-repair.md#realtime-inserts). See [Dynamics](./glossary/mastering/dynamics.md) and [Repair](./glossary/mastering/repair.md).

<SonareDemo id="repair-denoise" />

#### Stereo and linked repair

Each repair processor has a stereo counterpart that takes the channel pair
together. They exist because repair decisions are not always per-channel: a click
is one physical event on both channels, and a denoiser that builds a different
mask per channel moves the stereo image while it works. Every entry below accepts
a request object **or** a positional call; the positional `sampleRate` is
required, while the request form defaults it to `22050`. Channels must be the
same length, and each takes the same options interface as its mono form.

```typescript
function masteringRepairDeclickStereo(request: MasteringRepairDeclickStereoRequest): MasteringRepairDeclickStereoResult
function masteringRepairDeclipStereo(request: MasteringRepairDeclipStereoRequest): MasteringRepairDeclipStereoResult
function masteringRepairDecrackleStereo(request: MasteringRepairDecrackleStereoRequest): MasteringRepairDecrackleStereoResult
function masteringRepairDehumStereo(request: MasteringRepairDehumStereoRequest): MasteringRepairDehumStereoResult
function masteringRepairDenoiseClassicalStereo(request: MasteringRepairDenoiseClassicalStereoRequest): MasteringRepairDenoiseClassicalStereoResult
function masteringRepairDereverbClassicalStereo(request: MasteringRepairDereverbClassicalStereoRequest): MasteringRepairDereverbClassicalStereoResult
function masteringRepairTrimSilenceStereo(request: MasteringRepairTrimSilenceStereoRequest): MasteringRepairTrimSilenceStereoResult

// N-channel forms of the two fully linked processors
function masteringRepairDenoiseClassicalLinked(request: MasteringRepairDenoiseClassicalLinkedRequest): MasteringRepairDenoiseClassicalLinkedResult
function masteringRepairDereverbClassicalLinked(request: MasteringRepairDereverbClassicalLinkedRequest): MasteringRepairDereverbClassicalLinkedResult
```

The result **shape tells you how much was linked**: two reports mean the channels were processed separately enough to need them, one report means one decision covered both channels.

| Processor | What is shared | Result shape | Notes |
|---|---|---|---|
| declick | The *selection*: a run either channel detects is repaired in both, each channel filling from its own samples and AR model | `{ left, right, leftReport, rightReport }` | The two reports genuinely differ. A merged run can exceed `maxClickSamples` |
| declip | The union of both channels' clipped runs; a channel with no clipped sample stays untouched | `{ left, right, leftReport, rightReport }` | `linkedRuns` is `0` for a plateau clipped in one channel only. Runs longer than 512 samples fall back to interpolation, a fixed cap independent of `lpcOrder` and the sample rate |
| decrackle | Nothing: crackle is surface damage with no common event | `{ left, right, leftReport, rightReport }` | The entry centralizes the reports and the channel-length contract. Fields of the mode you did not choose read `0` |
| dehum | Only with `adaptive` set: the tracker reads the channel mean and both cascades follow one frequency | `{ left, right, leftReport, rightReport }` | `appliedFundamentalHz` and `fundamentalDriftHz` are identical in both reports, while each `detected` measures its own channel. With `adaptive` clear (the default) the channels are independent |
| denoise, dereverb | Everything: the gain mask is built from channel-summed power and applied unchanged to every channel | `{ left, right, report }` | Interchannel level and phase cannot move. The `Linked` variants take `channels: Float32Array[]`; one channel reproduces the mono entry bit for bit, two reproduce the stereo entry |
| trim silence | The union of the per-channel keep ranges, erring toward keeping because trimming is destructive; never a downmix | `{ left, right, report, leftRange, rightRange }` | `leftRange` and `rightRange` are each channel's own detected range, for inspection |

Every repair processor and detector pads an input shorter than `nFft` instead of refusing it.

::: warning Comparing reports across channel counts
`DenoiseReport.detected` is *absolute* and measured on the summed set, so N identical channels read `10*log10(N)` above one: about +3.01 dB at two, +4.77 dB at three. A stereo `floorDbfs` is not comparable with a mono one. `DereverbReport` is made of ratios and fractions, so it is channel-count invariant and compares directly.
:::

`masteringRepairTrimSilenceStereo` is the **only** repair entry point that
shortens its input: `result.left.length` is the output length and both channels
come back equal. A pair in which neither channel carries signal returns **two
empty arrays and succeeds** — no throw, no null. `report.range` is then
`(inputLength, inputLength)`, which makes `removedHeadSamples` the whole input
and `removedTailSamples` zero; the two still sum correctly, only the split is
arbitrary. Option liveness follows `mode`: `threshold` acts only in `'peak'`,
`gateLufs` and `windowMs` only in `'lufsGated'`, and setting an inert option is
silent rather than an error. Gated mode compares an **unweighted RMS** over a
`windowMs` window against `gateLufs`, so the gated quantity is dBFS and not
BS.1770 loudness.

#### Detection without repair

These run the analysis half of a repair processor and stop before it touches
audio, so you can decide whether a repair is warranted — and show the user why —
without rendering anything. Each returns a report only. All take the same options
interface as the processor they measure, and accept a request object or a
positional call.

```typescript
function masteringRepairDetectClicks(request: MasteringRepairDetectClicksRequest): ClickDetection
function masteringRepairDetectClipping(request: MasteringRepairDetectClippingRequest): ClipDetection
function masteringRepairDetectCrackle(request: MasteringRepairDetectCrackleRequest): CrackleDetection
function masteringRepairDetectHum(request: MasteringRepairDetectHumRequest): HumDetection
function masteringRepairDetectNoiseFloor(request: MasteringRepairDetectNoiseFloorRequest): NoiseDetection
function masteringRepairDetectReverb(request: MasteringRepairDetectReverbRequest): ReverbDetection
function masteringRepairDetectTrimRange(request: MasteringRepairDetectTrimRangeRequest): TrimRange
function masteringRepairDetectTrimRangeStereo(request: MasteringRepairDetectTrimRangeStereoRequest): TrimRange

interface TrimRange {
  first: number;          // half-open, in INPUT-buffer coordinates
  lastExclusive: number;
}
```

| Function | What it measures | Watch for |
|---|---|---|
| `masteringRepairDetectClicks` | The same LPC analysis the repair runs, with runs counted only where they stand above the local transient level, so a drum hit is not a click | Repair options shape the count; the repair itself still acts inside transients, so the samples it replaces can exceed the detected count. A large `rejected` means `maxClickSamples` or `neighborRatio` is too tight, not that the material is clean |
| `masteringRepairDetectClipping` | Reads only `clipThreshold`; `lpcOrder`, `iterations` and `lpcBlend` are validated and then unread, and `sampleRate` is validated but never read | Compare `longestRunSamples` against the 512-sample cap to predict the interpolation fallback. The four flat-top fields look for three or more bit-identical samples within 1 dB of peak, which catches material that was clipped and then attenuated |
| `masteringRepairDetectCrackle` | Always the median criterion, whatever `mode` says, because wavelet shrinkage never decides that a sample *is* crackle; samples are counted only where they stand above the local transient level, so percussion reads as clean | The counts do not describe what a wavelet-mode repair removes, but they give the same answer before you have chosen a mode |
| `masteringRepairDetectHum` | Always the estimation path regardless of `adaptive`, since the fixed path never looks for hum; a candidate has to be a stationary line through most of each analysis frame, so a repeating kick does not qualify | `fundamentalProminence` is a linear ratio, the winner's projected energy over the median candidate, so `1.0` means no peak was found at all (a repeating kick reads exactly `1.0`); it is not a lock flag. `harmonicDbfs` covers every `k*f0` the sample rate carries, not only the notched ones, and a harmonic at or past Nyquist reads the dB floor |
| `masteringRepairDetectNoiseFloor` | Stops before the gain mask, so there is no attenuation figure | `floorDbfs` is absolute: compare it only against a figure taken over the same channel count |
| `masteringRepairDetectReverb` | What the dereverb itself measures while deciding how much to subtract; **not** an ISO 3382 RT60 (use `estimateRoom(...)` for that) | `lateDecayRatioDb` runs counter-intuitively: *less* negative means *more* reverberant. `latePredictability` is exactly `0` under the default config, because the WPE stage runs only with `wpeEnabled` |
| `masteringRepairDetectTrimRange` | The range the repair would cut **to**, with `paddingSamples` already inside it, not the detected extent of the signal | Nothing above threshold yields `(length, length)` |
| `masteringRepairDetectTrimRangeStereo` | The union of the per-channel ranges | A channel with nothing above threshold contributes **no edge** at all rather than an edge at the buffer end, so a silent channel united with an active one is exactly the active channel's range |

Flat-top detection has two failure modes. A genuinely flat-topped waveform is a false positive, and any per-sample perturbation (a downmix, a resample, lossy coding) erases a true flat top. **Detect each channel separately, before any downmix, never on the mixed-down result.**

#### `masteringRepairDereverbConfigForRoom(...)`

Turn a room measurement into a dereverb config.

```typescript
function masteringRepairDereverbConfigForRoom(
  request: MasteringRepairDereverbConfigForRoomRequest,
): Required<DereverbClassicalOptions>
function masteringRepairDereverbConfigForRoom(
  estimate: RoomEstimateResult,
  config?: DereverbClassicalOptions,
): Required<DereverbClassicalOptions>
```

It reads only `volume` and `rt60Bands` from the `estimateRoom(...)` result and
returns a **complete** config — every field present, nothing optional — so you can
show the user what will run before running it. Exactly two fields come back
changed: `t60Sec` (the mid-frequency reverberation time, the mean of the 500 Hz
and 1 kHz octaves) and `lateDelayMs` (the Polack mixing time, `sqrt(volume)` ms).

`attenuation`, `threshold`, `overSubtraction` and `spectralFloor` are **never
written**: how much reverb to remove is taste, not measurement, and the function
declines to guess. A band that did not converge leaves its own field alone, and a
low-`confidence` estimate is still applied — filter the estimate yourself if you
do not want that. Config fields you omit resolve to the library default rather
than to zero. One edge to watch: if neither mid band converged, `t60Sec` falls
back to the mean of whatever bands did, at which point it is no longer a
mid-frequency figure.

#### `masteringRepairNoiseBandBins(...)`

```typescript
function masteringRepairNoiseBandBins(request?: MasteringRepairNoiseBandBinsRequest): Int32Array
function masteringRepairNoiseBandBins(nFft?: number, sampleRate?: number): Int32Array

interface MasteringRepairNoiseBandBinsRequest {
  nFft?: number;        // default 1024; must be a positive power of two
  sampleRate?: number;  // default 22050; must be positive
}
```

Returns the **33** bin indices behind `NoiseDetection.bandFloorDbfs` — 32 bands
plus the one-past-the-end index, non-decreasing, where band `k` covers one-sided
bins `[bins[k], bins[k+1])` and bin `b` sits at `b * sampleRate / nFft` Hz. It
takes no denoise config, because only the analysis geometry decides the grid.

This exists to resolve one specific ambiguity. The geometric band edges are
rounded to bins, so a band narrower than the bin spacing comes out **empty**
(`bins[k] === bins[k + 1]`), and its `bandFloorDbfs[k]` reads the floor sentinel
because no bin landed in it — not because that region was quiet. Nothing in the
band array distinguishes the two, and the band count alone cannot recover it;
this grid can. Label an empty band as "not measured" rather than plotting a
floor-level bar.
