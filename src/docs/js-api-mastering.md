---
title: JavaScript/TypeScript Mastering API
description: The mastering chain, named processors, presets, streaming mastering, and the mixing API of the libsonare JavaScript/TypeScript package.
---

# JavaScript/TypeScript Mastering API

## Mastering API

The browser package includes the same named mastering processors used by the `/mastering` demo. Decode audio with the Web Audio API, pass `Float32Array` channel buffers to libsonare, then export the returned samples as WAV in your application.

This section lists the JS entry points and their result/config types. For what each processor does, the preset list, and the analysis/assistant JSON, see [Mastering Processors](./mastering-processors.md) and [Mastering Assistant](./mastering-assistant.md).

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

The explainable-mastering helpers — `masteringAudioProfile(...)`, `masteringAssistantSuggest(...)`, and `masteringStreamingPreview(...)` — return JSON strings; see [Mastering Assistant](./mastering-assistant.md) for their exact shapes, accepted options, and how to turn a suggestion into a rendered master. Reference-track workflows use `masteringPairProcessorNames()` and `masteringPairAnalyze()` (matched sample rate and comparable duration).

#### Stereo entry points for the explainable helpers

Each of the three has a stereo counterpart that measures the channel pair directly. They are **request-object only** — there is no positional overload, and a positional call throws.

```typescript
function masteringAudioProfileStereo(request: MasteringStereoParamsRequest): string
function masteringAssistantSuggestStereo(request: MasteringStereoParamsRequest): string
function masteringStreamingPreviewStereo(request: MasteringStreamingPreviewStereoRequest): string

interface MasteringStereoParamsRequest {
  left: Float32Array;
  right: Float32Array;
  sampleRate?: number;
  params?: MasteringProcessorParams;
}

interface MasteringStreamingPreviewStereoRequest {
  left: Float32Array;
  right: Float32Array;
  sampleRate?: number;
  platforms?: StreamingPlatform[];
}
```

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

Use them for anything stereo. The mono helpers measure a `0.5 * (left + right)` downmix, and on decorrelated material that downmix reads about 6 dB low — so the integrated loudness, the normalization gain derived from it, and the ceiling-risk judgement are all under-reported by the same amount. Measured on a decorrelated pink-noise pair (48 kHz, 4 s), the downmix path reported **-22.55 LUFS** against the stereo path's **-16.44 LUFS**, a **6.11 dB** gap, and Spotify `normalizationGainDb` came out at **+8.55** through the downmix versus **+2.44** through the stereo path. On a correlated pair the gap shrinks to 3.01 dB, which is just the halving; the remaining ~3 dB is the decorrelation.

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
}

interface LoudnessMatchResult {
  samples: Float32Array;        // source, at reference's loudness
  sampleRate: number;
  referenceLufs: number;        // BS.1770 integrated
  sourceLufs: number;           // before the gain
  appliedGainDb: number;        // referenceLufs - sourceLufs
  matchedTruePeakDbtp: number;  // true peak after the gain
}
```

Request-object only. The two buffers may differ in length — each is measured on its own program.

::: warning The gain is uncapped, and the result can exceed 0 dBTP
`appliedGainDb` has no upper bound and no headroom clamp is applied, so `matchedTruePeakDbtp` can come back **above `0`**. That is deliberate: clamping for headroom would silently no-op the match for any source already near full scale, which is exactly the case an A/B is most often set up to examine. Check `matchedTruePeakDbtp` yourself and attenuate the pair together if you are about to render rather than audition.

When either take is silent or sits below the measurement gate, its LUFS field is **non-finite** and `appliedGainDb` is `0` — the source comes back unchanged. Test `Number.isFinite(result.sourceLufs)` before presenting a figure.
:::

`masteringStreamingPreviewStereo` treats `platforms` exactly as the mono helper does: omit it or pass an empty array and the preview falls back to the built-in Spotify / Apple Music / YouTube set, returning three rows rather than throwing.

### StreamingEqualizer

`StreamingEqualizer` is the block-by-block EQ object used for realtime-safe processing: up to 24 bands, zero-latency/natural/linear phase modes, dynamic EQ, mid/side processing, external sidechain input, spectrum snapshots, and offline reference matching. In the WASM package, call `init()` first and `delete()` when done.

```typescript
import { init, StreamingEqualizer } from '@libraz/libsonare';
await init();

const eq = new StreamingEqualizer({ sampleRate: 48000, maxBlockSize: 512 });
try {
  eq.setBand(0, {
    type: 'HighShelf',
    frequencyHz: 8000,
    gainDb: 4,
    q: 0.7,
    enabled: true,
  });
  eq.setPhaseMode(1); // 1 = zero-latency, 2 = natural, 3 = linear
  eq.setAutoGain(true);

  const { left, right } = eq.processStereo(leftBlock, rightBlock);
  console.log(eq.spectrum(), eq.latencySamples(), left, right);
} finally {
  eq.delete();
}
```

Source-built C++ CLI equivalents for file-based EQ and filtering:

```bash [C++ CLI]
sonare eq track.wav --type 2 --frequency-hz 8000 --gain-db 4 --q 0.7 -o eq.wav
sonare filter track.wav --type hp --cutoff 80 -o filtered.wav
```

### StreamingRetune

`StreamingRetune` is the block-by-block mono pitch retune object. It maintains grain and delay state across calls, so use `prepare()` before the first block and `delete()` when done.

```typescript
import { init, StreamingRetune } from '@libraz/libsonare';
await init();

const retune = new StreamingRetune({ semitones: 3, mix: 1, grainSize: 0 });
retune.prepare(48000, 512);

try {
  const out = retune.processMono(inputBlock);
  retune.setConfig({ semitones: -2, mix: 0.75 });
  console.log(out, retune.config(), retune.grainSize());
} finally {
  retune.delete();
}
```

Closest CLI equivalents for offline files from the source-built C++ CLI:

```bash [C++ CLI]
sonare pitch-shift vocal.wav --semitones 3 -o shifted.wav
sonare voice-change vocal.wav --pitch-semitones 3 --formant-factor 1.0 -o voice.wav
```

### RealtimeVoiceChanger

`RealtimeVoiceChanger` is the preset-based live voice chain (high-pass, gate, retune, formant, EQ, compressor, de-esser, reverb, and limiter stages) that keeps state across audio blocks. Use it for monitoring, AudioWorklet-style processing, or chunked voice rendering where `voiceChange(...)` is too simple. Factory preset IDs come from `realtimeVoiceChangerPresetNames()`; preset JSON is fetched with `realtimeVoiceChangerPresetJson(...)` and checked with `validateRealtimeVoiceChangerPresetJson(...)` (schema version `1`). `RealtimeVoiceChangerConfigInput` is strict: use one of the six `VoicePresetId` strings or a preset object with either a `dsp` object or a `macros` object, never both.

```typescript
import { init, RealtimeVoiceChanger, realtimeVoiceChangerPresetNames } from '@libraz/libsonare';
await init();

const changer = new RealtimeVoiceChanger(realtimeVoiceChangerPresetNames()[1]); // e.g. "bright-idol"
changer.prepare(48000, /*maxBlockSize=*/128, /*channels=*/1);
try {
  const out = changer.processMono(inputBlock);
  const realtime = changer.createRealtimeMonoBuffer(128); // zero-copy WASM heap view
  realtime.input.set(inputBlock.subarray(0, 128));
  realtime.process();
  console.log(out, realtime.output, changer.latencySamples());
} finally {
  changer.delete();
}
```

The zero-copy buffer helpers (`createRealtimeMonoBuffer`, `createRealtimeInterleavedBuffer`, `createRealtimePlanarBuffer`) return changer-owned WASM heap views; reuse them inside a realtime loop and discard after `delete()`. See [Realtime Voice Changer](./realtime-voice-changer.md) for the preset list and chain stages.

### `voiceChangeRealtime(samples, sampleRate?, preset?, options?)`

`voiceChangeRealtime(...)` is the offline whole-buffer convenience function around `RealtimeVoiceChanger`. It internally constructs and prepares a changer, runs the per-block render loop for you, then disposes it — matching the Python `voice_change_realtime` and Node equivalents — so callers do not manage the stateful object themselves.

```typescript
function voiceChangeRealtime(
  samples: Float32Array,
  sampleRate?: number, // default 48000
  preset?: RealtimeVoiceChangerConfigInput,
  options?: {
    channels?: 1 | 2;   // default 1 (mono); 2 = interleaved stereo (L0,R0,L1,R1,...)
    /** @deprecated Ignored — the shared C-ABI renderer uses a fixed block size. */
    blockSize?: number;
  },
): Float32Array  // same layout/length as the input
```

Use this when you already have the full buffer. Reach for [`RealtimeVoiceChanger`](#realtimevoicechanger) for manual block-by-block live use, and `voiceChange(...)` when you only need a one-shot pitch/formant change without the full preset chain.

### StreamingMasteringChain

For real-time or memory-constrained use cases, such as processing audio block-by-block from `AudioWorklet` or a stream, the WASM module exposes `StreamingMasteringChain`. It accepts a `StreamingMasteringChainConfig`, which extends `masteringChain()`'s `MasteringChainConfig` with two optional streaming-only fields:

- `loudnessStaticGainDb` — a precomputed static loudness gain in dB (e.g. `targetLufs - measuredIntegratedLufs`), applied per block so a preset's streaming preview matches its offline render with a `loudness` stage enabled.
- `loudnessStaticGainPeakDb` — the offline-measured source true-peak in dBFS. When set, the static gain is clamped to `loudness.ceilingDb - loudnessStaticGainPeakDb` so the streaming limiter does not receive a hotter input than the offline chain.

It otherwise prepares processor state for a fixed block size and applies the chain incrementally.

```typescript
import { init, StreamingMasteringChain } from '@libraz/libsonare';
await init();

const chain = new StreamingMasteringChain({
  eq: { tilt: { tiltDb: 0.5 } },
  dynamics: { compressor: { thresholdDb: -20 } },
  maximizer: { truePeakLimiter: { ceilingDb: -1, oversampleFactor: 4 } },
});

chain.prepare(48000, /*maxBlockSize=*/512, /*numChannels=*/2);

// Use the path that matches the prepared channel count: processMono() /
// flushMono() after prepare(..., 1), processStereo() / flushStereo() after
// prepare(..., 2). Mixing them throws a num_channels mismatch.
const { left, right } = chain.processStereo(leftBlock, rightBlock);

console.log(chain.stageNames());      // ['eq.tilt', 'dynamics.compressor', ...]
console.log(chain.latencySamples());  // total latency reported by active stages

// After the last input block, drain the chain latency and the finite tails.
let tail: { left: Float32Array; right: Float32Array };
while ((tail = chain.flushStereo()).left.length > 0) {
  write(tail.left, tail.right);
}

chain.reset();   // clear processor state without re-preparing
chain.delete();  // release the WASM handle (call when done)
```

`flushMono()` / `flushStereo()` emit the delayed audio plus finite processor
tails once you have no more input. Call until an empty result comes back.
Without the flush, a bounce built from a streaming chain loses its last
`latencySamples()` samples and any reverb or limiter tail. The first
`latencySamples()` samples of the concatenated stream are the chain's delay and
should be dropped for a time-aligned result.

Stereo-only stages are skipped when `numChannels === 1`. The chain-config repair stages (`repair.declick`, `repair.dereverb`, `repair.denoise`, `repair.declip`, `repair.decrackle`, `repair.dehum`) are offline-only and throw if enabled on the streaming constructor — run them through `masteringChain*` / `masterAudio*`, or the one-shot `masteringRepair*` helpers. The `loudness` stage also throws unless you supply `loudnessStaticGainDb` (optionally with `loudnessStaticGainPeakDb`), since the streaming chain cannot measure whole-signal integrated LUFS. Call `reset()` between independent songs and `delete()` to free the handle.

The named mastering API families are:

| Purpose | Function |
|---------|----------|
| Apply simple loudness mastering | `mastering()` |
| List built-in mastering presets | `masteringPresetNames()` |
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
| List realtime-automatable insert parameters | `masteringInsertParamInfo(name)` |
| Process mono audio | `masteringProcess()` |
| Process stereo audio | `masteringProcessStereo()` |
| List pair processors | `masteringPairProcessorNames()` |
| Process source/reference pair | `masteringPairProcess()` |
| List pair analyses | `masteringPairAnalysisNames()` |
| Analyze source/reference pair | `masteringPairAnalyze()` |
| List stereo analyses | `masteringStereoAnalysisNames()` |
| Analyze stereo channels | `masteringStereoAnalyze()` |

Related mastering guides: [Processing chain](./glossary/mastering.md), [Tone and air](./glossary/mastering/tone-air.md), [Dynamics](./glossary/mastering/dynamics.md), [Stereo, limiter, and loudness](./glossary/mastering/stereo-limiter-loudness.md), [Reference match](./glossary/mastering/reference-match.md).

### Standalone dynamics and repair processors

Every named stage is also a one-shot function, so you can run a single processor without assembling a chain. The dynamics processors return a `DynamicsResult` (the processed `samples` plus `latencySamples`, the processor's look-ahead latency in samples); the repair processors return a `Float32Array`.

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

The repair stages are offline-only and are rejected by `StreamingMasteringChain` — run them with these one-shot helpers or inside `masteringChain*`/`masterAudio*`. See [Dynamics](./glossary/mastering/dynamics.md) and [Repair](./glossary/mastering/repair.md).

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

The result **shape tells you how much was linked**, and there are three of them:

| Result shape | Entry points | What the shape means |
|--------------|--------------|----------------------|
| `{ left, right, leftReport, rightReport }` | declick, declip, decrackle, dehum | The channels were processed separately enough to need two reports. |
| `{ left, right, report }` | denoise, dereverb | One decision covered both channels, so there is one report. |
| `{ left, right, report, leftRange, rightRange }` | trim silence | One cut, plus each channel's own detected range for inspection. |

How each one links:

- **Declick** shares the *selection*: a run either channel detects is repaired in
  both, but each channel fills from its own samples and its own AR model, so the
  two reports genuinely differ. A merged run can exceed `maxClickSamples`.
- **Declip** takes the union of both channels' clipped runs, but leaves a channel
  untouched where it has no clipped sample. `linkedRuns` is therefore `0` for a
  plateau clipped in one channel only, and non-zero only where both clip with
  different extents. Runs longer than 512 samples fall back to interpolation —
  a fixed cap, not something derived from `lpcOrder` or the sample rate.
- **Decrackle** links nothing: crackle is surface damage with no common event, so
  the channels are fully independent. The entry exists to centralize the reports
  and the channel-length contract. Fields belonging to the mode you did not
  choose read `0` — expected, not unfilled.
- **Dehum** links only when `adaptive` is set: the tracker then reads the channel
  mean and both cascades follow one frequency, so `appliedFundamentalHz` and
  `fundamentalDriftHz` are identical in both reports by construction while each
  `detected` still measures its own channel. With `adaptive` clear, which is the
  default, the two channels are independent.
- **Denoise** and **dereverb** are **fully linked**: the gain mask is built from
  channel-summed power and applied unchanged to every channel, so interchannel
  level and phase cannot move. That is why they return a single `report`. The
  `Linked` variants are the same processors over `channels: Float32Array[]` —
  one channel reproduces the mono entry bit for bit, two reproduce the stereo
  entry plane for plane.
- **Trim silence** scans each channel and takes the **union** of the keep ranges,
  erring toward keeping, since trimming is destructive. It never reads a downmix.

::: warning Two asymmetries between denoise and dereverb that bite
**Short input.** `masteringRepairDenoiseClassical*` **rejects** a buffer shorter
than `nFft`; `masteringRepairDereverbClassical*` **pads** it. The same
too-short take therefore throws through one and succeeds through the other.

**Comparing reports across channel counts.** `DenoiseReport.detected` is
*absolute* and measured on the summed set, so N identical channels read
`10*log10(N)` above one — about +3.01 dB at two, +4.77 dB at three. A stereo
`floorDbfs` is not comparable with a mono one. `DereverbReport` is made of ratios
and fractions, so it is channel-count invariant and compares directly.
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

What each one actually measures, where it differs from the obvious reading:

- **`masteringRepairDetectClicks`** runs the same LPC analysis the repair runs, so
  a counted run is one the repair would act on — and repair options shape the
  count. A large `rejected` means `maxClickSamples` or `neighborRatio` is too
  tight, not that the material is clean.
- **`masteringRepairDetectClipping`** reads only `clipThreshold` from the
  options; `lpcOrder`, `iterations` and `lpcBlend` are validated and then unread,
  and `sampleRate` is validated but never read. Compare `longestRunSamples`
  against the 512-sample cap to predict the interpolation fallback. The four
  flat-top fields answer a different question — three or more bit-identical
  samples within 1 dB of peak — which catches material that was clipped and then
  attenuated. Both failure modes are real: a genuinely flat-topped waveform is a
  false positive, and any per-sample perturbation (a downmix, a resample, lossy
  coding) erases a true flat top. **Detect each channel separately, before any
  downmix, never on the mixed-down result.**
- **`masteringRepairDetectCrackle`** always measures by the median criterion
  whatever `mode` says, because wavelet shrinkage never decides that a sample
  *is* crackle. The counts therefore do not describe what a wavelet-mode repair
  removes — but they give the same answer before you have chosen a mode.
- **`masteringRepairDetectHum`** always runs the estimation path regardless of
  `adaptive`, since the fixed path never looks for hum.
  `fundamentalProminence` is the winner's projected energy over the median
  candidate, so **`1.0` means no peak was found at all** — it is not a lock flag,
  and a value near 1 is the negative result. `harmonicDbfs` covers every `k*f0`
  the sample rate carries, not only the notched ones, and a harmonic at or past
  Nyquist reads the dB floor.
- **`masteringRepairDetectNoiseFloor`** stops before the gain mask, which is why
  there is no attenuation figure. It **throws** for a buffer shorter than `nFft`.
  `floorDbfs` is absolute, so compare it only against a figure taken over the
  same channel count.
- **`masteringRepairDetectReverb`** is **not an ISO 3382 RT60** — use
  `estimateRoom(...)` for that. It reports what the dereverb itself measures while
  deciding how much to subtract. It **pads** a buffer shorter than `nFft`, the
  opposite of the noise-floor entry. `lateDecayRatioDb` runs counter-intuitively:
  *less* negative means *more* reverberant. Under a default config
  `latePredictability` is exactly `0`, because the WPE stage runs only with
  `wpeEnabled`.
- **`masteringRepairDetectTrimRange`** returns the range the repair would cut
  **to**, with `paddingSamples` already inside it — not the detected extent of
  the signal. Nothing above threshold yields `(length, length)`.
- **`masteringRepairDetectTrimRangeStereo`** scans per channel and takes the
  union, and a channel with nothing above threshold contributes **no edge** at
  all rather than an edge at the buffer end. A union of a silent channel with an
  active one is therefore exactly the active channel's range, where a naive
  min/max would have kept the whole tail.

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

### MasteringChainConfig

`masteringChain*` and `StreamingMasteringChain` use the nested config schema below. Every key is optional. Only the stages you set are activated.

Stages always run in a fixed order:

<FlowDiagram
  title="Mastering chain order"
  :nodes="[
    { id: 'repair', label: 'Repair', col: 0, row: 0, variant: 'accent' },
    { id: 'eq', label: 'EQ', col: 1, row: 0 },
    { id: 'dynamics', label: 'Dynamics', col: 2, row: 0 },
    { id: 'saturation', label: 'Saturation', col: 3, row: 0 },
    { id: 'spectral', label: 'Spectral', col: 4, row: 0 },
    { id: 'stereo', label: 'Stereo', col: 5, row: 0 },
    { id: 'maximizer', label: 'Maximizer', col: 6, row: 0 },
    { id: 'loudness', label: 'Loudness', col: 7, row: 0, variant: 'success' }
  ]"
  :edges="[
    { from: 'repair', to: 'eq' },
    { from: 'eq', to: 'dynamics' },
    { from: 'dynamics', to: 'saturation' },
    { from: 'saturation', to: 'spectral' },
    { from: 'spectral', to: 'stereo' },
    { from: 'stereo', to: 'maximizer' },
    { from: 'maximizer', to: 'loudness' }
  ]"
  caption="Only the stages you configure are activated, but whichever are enabled run in this order."
/>

`masterAudio*` starts from a preset and accepts overrides using the same key names in flat dot-notation form, such as `"dynamics.compressor.thresholdDb"`.

`maximizer.truePeakLimiter.releaseMs` controls the post-limiter release time. Omit it to keep the preset/config default of 50 ms; if you provide a flat override, the value is applied directly. `maximizer.truePeakLimiter.applyGainAtInputRate` applies static loudness gain before oversampling when set, which is useful when you need that gain staged at the source rate for host parity.

`repair.denoise.reductionDb` (also reachable via the flat `repair.reductionDb` alias) sets the deepest attenuation, in dB, the gain mask may apply to any bin; it defaults to 26. The older `gainFloor` spelling — a linear floor rather than a dB depth — is still accepted and converted (`dB = -20*log10(gainFloor)`); the conversion carries the old validity range with it, so a floor above unity becomes a negative depth and is refused the same way.

::: details Full interface (click to expand)

```typescript
interface MasteringChainConfig {
  repair?: {
    denoise?: boolean;
    nFft?: number; hopLength?: number; ddAlpha?: number; reductionDb?: number;
    /** @deprecated Use `reductionDb`; converted to it (dB = -20*log10(gainFloor)). */
    gainFloor?: number;
    declip?: { enabled?: boolean; clipThreshold?: number; lpcOrder?: number;
               iterations?: number; lpcBlend?: number; };
    decrackle?: { enabled?: boolean; threshold?: number;
                  /** 0 = median, 1 = wavelet shrinkage. */
                  mode?: number; levels?: number; };
    dehum?: { enabled?: boolean; fundamentalHz?: number; harmonics?: number;
              q?: number; adaptive?: boolean; searchRangeHz?: number;
              adaptation?: number; frameSize?: number; pllBandwidth?: number; };
    declick?: { threshold?: number; neighborRatio?: number; maxClickSamples?: number;
                lpcOrder?: number; residualRatio?: number; };
    dereverb?: { threshold?: number; attenuation?: number; nFft?: number;
                 hopLength?: number; t60Sec?: number; lateDelayMs?: number;
                 overSubtraction?: number; spectralFloor?: number;
                 wpeEnabled?: boolean; wpeIterations?: number; wpeTaps?: number;
                 wpeStrength?: number; };
  };
  eq?: {
    /** Canonical nested tilt stage. */
    tilt?: { enabled?: boolean; tiltDb?: number; pivotHz?: number };
    /** @deprecated Use `eq.tilt.tiltDb`. */
    tiltDb?: number;
    /** @deprecated Use `eq.tilt.pivotHz`. */
    pivotHz?: number;
  };
  dynamics?: {
    compressor?: { thresholdDb?: number; ratio?: number; attackMs?: number;
                   releaseMs?: number; kneeDb?: number; makeupGainDb?: number;
                   autoMakeup?: boolean; };
    deesser?: { frequencyHz?: number; thresholdDb?: number; ratio?: number;
                attackMs?: number; releaseMs?: number; rangeDb?: number;
                bandpassQ?: number; };
    transientShaper?: { attackGainDb?: number; sustainGainDb?: number;
                        fastAttackMs?: number; fastReleaseMs?: number;
                        slowAttackMs?: number; slowReleaseMs?: number;
                        sensitivity?: number; maxGainDb?: number;
                        gainSmoothingMs?: number; lookaheadMs?: number; };
    multibandComp?: { lowCutoffHz?: number; highCutoffHz?: number;
                      lowThresholdDb?: number;  lowRatio?: number;
                      lowAttackMs?: number;     lowReleaseMs?: number;
                      midThresholdDb?: number;  midRatio?: number;
                      midAttackMs?: number;     midReleaseMs?: number;
                      highThresholdDb?: number; highRatio?: number;
                      highAttackMs?: number;    highReleaseMs?: number; };
  };
  saturation?: {
    tape?: { driveDb?: number; saturation?: number; hysteresis?: number;
             outputGainDb?: number; speedIps?: number; headBumpDb?: number;
             bias?: number; gapLoss?: number; };
    exciter?: { frequencyHz?: number; driveDb?: number; amount?: number;
                q?: number; evenOddMix?: number; };
  };
  spectral?: {
    airBand?: { amount?: number; shelfFrequencyHz?: number;
                dynamicThresholdDb?: number; dynamicRangeDb?: number; };
  };
  stereo?: {
    imager?: { width?: number; outputGainDb?: number;
               decorrelationAmount?: number; preserveEnergy?: boolean; };
    monoMaker?: { amount?: number; frequencyHz?: number };
  };
  maximizer?: {
    truePeakLimiter?: { ceilingDb?: number; lookaheadMs?: number;
                        releaseMs?: number; oversampleFactor?: number;
                        applyGainAtInputRate?: boolean; };
  };
  loudness?: { targetLufs?: number; ceilingDb?: number;
               truePeakOversample?: number; };
}

interface MasteringResult {
  samples: Float32Array;
  sampleRate: number;
  inputLufs: number;
  outputLufs: number;
  appliedGainDb: number;
  loudnessTargetLimited?: boolean;
  latencySamples?: number;
}
interface MasteringChainResult extends MasteringResult {
  stages: string[];
  outputTruePeakDbtp: number;
  outputLra: number;
  loudnessTargetLimited: boolean;
  stageGainReductions: StageGainReduction[];
  report: MasteringReport;
}
interface MasteringStereoResult {
  left: Float32Array;
  right: Float32Array;
  sampleRate: number;
  inputLufs: number;
  outputLufs: number;
  appliedGainDb: number;
  latencySamples: number;
}
// Returned by masteringChainStereo / masterAudioStereo (and their
// WithProgress variants); MasteringStereoResult is the return type of
// masteringProcessStereo. There is no latencySamples field — the offline
// chain output is already latency-compensated.
interface MasteringChainStereoResult {
  left: Float32Array;
  right: Float32Array;
  sampleRate: number;
  inputLufs: number;
  outputLufs: number;
  appliedGainDb: number;
  stages: string[];
  outputTruePeakDbtp: number;
  outputLra: number;
  loudnessTargetLimited: boolean;
  stageGainReductions: StageGainReduction[];
  report: MasteringReport;
}
// MasteringStereoChainResult is a @deprecated alias for
// MasteringChainStereoResult, retained for source compatibility with the
// Node and Python bindings.
```

:::

The glossary mastering guides explain when to reach for each section:
[Repair](./glossary/mastering/repair.md), [Tone and Air](./glossary/mastering/tone-air.md),
[Dynamics](./glossary/mastering/dynamics.md),
[Stereo, Limiter, Loudness](./glossary/mastering/stereo-limiter-loudness.md).

## Mixing API

The WASM package exposes the libsonare mixing engine. `mixStereo(...)` is a compact one-shot renderer for stem arrays. `Mixer` is a persistent scene-based mixer with channel strips, buses, sends, VCA groups, automation, strip meters, and goniometer buffers.

```typescript
import {
  Mixer,
  mixStereo,
  mixingScenePresetJson,
  mixingScenePresetNames,
} from '@libraz/libsonare';

mixingScenePresetNames(); // ['vocalReverbSend', ...]

const offline = mixStereo([vocalL, musicL], [vocalR, musicR], sampleRate, {
  inputTrimDb: [3, 0],
  faderDb: [-3, -12],
  pan: [0, -0.2],
  width: [1, 0.9],
  muted: [false, false],
});

const mixer = Mixer.fromSceneJson(mixingScenePresetJson('vocalReverbSend'), sampleRate, 512);
mixer.sceneWarnings(); // non-fatal scene-load warnings: insert params no processor reads (typos)
const latency = mixer.latencySamples(); // compiled graph latency for dry/wet alignment
const block = mixer.processStereo([vocalBlockL, musicBlockL], [vocalBlockR, musicBlockR]);
const meter = mixer.stripMeter(0, 'postFader');

mixer.scheduleFaderAutomation(0, sampleRate * 8, -6, 's-curve');
mixer.schedulePanAutomation(0, sampleRate * 8, -0.25, 'linear');
mixer.scheduleSendAutomation(0, 0, sampleRate * 12, -12, 'hold');

const goniometer = mixer.readGoniometerLatest(0, 256);
const sceneJson = mixer.toSceneJson();
mixer.delete();
```

`Mixer.createRealtimeBuffer()` and `processStereoInto(...)` are intended for AudioWorklet-style render loops where avoiding per-block allocation matters. See [Mixing Engine](./mixing.md) for scene and routing details.
