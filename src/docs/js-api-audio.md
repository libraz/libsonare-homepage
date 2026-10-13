---
title: JavaScript/TypeScript Audio, Metering and Mixing API
description: The Audio class, offline metering, take alignment, mixer strips, and the mixing API of the libsonare JavaScript/TypeScript package.
---

# JavaScript/TypeScript Audio, Metering and Mixing API

## Audio Class

The `Audio` class is the method-style entry point for common one-shot functions. It stores the samples and sample rate internally, so you do not need to pass them to every call. More specialized helpers, such as section/melody/timbre/dynamics analysis and room-acoustic estimation, remain standalone functions in the WASM package.

### `Audio.fromBuffer(samples, sampleRate)`

Create an Audio instance from raw sample data.

```typescript
const audio = Audio.fromBuffer(samples, 44100);
```

`sampleRate` is optional and defaults to `48000`. Always pass the buffer's actual sample rate, since the stored value feeds every instance method.

### `Audio.fromMemory(bytes)`

Decode encoded audio bytes (`Uint8Array`) such as WAV or MP3 with the native WASM decoder and return an `Audio` instance. Throws a `SonareError` when the format is not supported by the bundled decoder.

```typescript
const audio = Audio.fromMemory(new Uint8Array(await file.arrayBuffer()));
```

### `Audio.fromMemoryWithBrowserFallback(bytes, options?)`

`async`; returns `Promise<Audio>`. Tries `Audio.fromMemory` first. If the bundled decoder cannot read the format, it uses the browser codec stack (`AudioContext.decodeAudioData`) for formats such as AAC, OGG, and FLAC. Browser-decoded multi-channel audio is folded to mono with the same ITU-R BS.775 rule the native decoder applies (`downmix`, below), so a file yields the same samples whichever decoder ran and the returned `Audio` object still contains one sample stream. Accepts an optional `BrowserAudioDecodeOptions` (`audioContext` / `createAudioContext` / `targetSampleRate`); a context this helper creates itself is closed afterward.

```typescript
const audio = await Audio.fromMemoryWithBrowserFallback(
  new Uint8Array(await file.arrayBuffer()),
);
```

### `decodeChannels(bytes)`

`Audio.fromMemory` folds a multichannel file to mono while decoding. `decodeChannels` decodes the same formats but keeps every channel, returning `{ sampleRate, channels }` with one `Float32Array` plane per source channel in the source's own order (a 5.1 file arrives as `L R C LFE Ls Rs`).

### `decodeChannelsWithBrowserFallback(bytes, options?)`

`async`; returns `Promise<DecodedChannels>`, the same `{ sampleRate, channels }` as `decodeChannels`. Formats the bundled decoder does not carry (AAC, OGG, FLAC) go through the browser codec stack as in `Audio.fromMemoryWithBrowserFallback`, taking the same `BrowserAudioDecodeOptions`, and every channel the browser returns is kept.

### `downmix(channels, targetLayout, options?)`

Narrows planes to a smaller layout with the ITU-R BS.775 rule: center and surround enter the front pair at -3 dB and the LFE plane is dropped. `targetLayout` is `0` mono, `1` stereo, `2` 5.1, `3` 7.1; the source layout is named by the channel count (1, 2, 6 or 8), and any other count folds to mono as the unweighted mean. The fold is not normalized, so a source with several full-scale planes can pass full scale (six planes of 1.0 fold to 2.414 on a stereo target). The optional third argument `{ normalize, includeLfe }` changes that: `normalize: true` scales the fold so the worst case (every input at full scale, in phase) stays at or below unity, a peak divisor rather than a loudness match, and `includeLfe: true` folds the LFE plane into the front pair at -3 dB instead of dropping it. Both default to `false`. An upmix or unknown layout throws `SonareError` (`InvalidParameter`); no channels, planes of differing length, or a `targetLayout` that is not an integer in the 32-bit range throw `RangeError`, and a non-number `targetLayout` throws `TypeError`.

```typescript
import { init, decodeChannels, downmix } from '@libraz/libsonare';

await init();

const { sampleRate, channels } = decodeChannels(bytes);
const stereo = channels.length > 2 ? downmix(channels, 1) : channels;
```

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `audio.data` | `Float32Array` | Raw audio samples |
| `audio.length` | `number` | Number of samples |
| `audio.sampleRate` | `number` | Sample rate (Hz) |
| `audio.duration` | `number` | Duration (seconds) |

### Instance Methods

Common one-shot helpers are available as instance methods: `samples` and `sampleRate` are supplied automatically. Focused helpers such as `analyzeSections(...)`, `analyzeMelody(...)`, `analyzeDynamics(...)`, `analyzeTimbre(...)`, and the room-acoustic functions remain standalone calls.

```typescript
import {
  init,
  Audio,
  analyzeSections,
  analyzeMelody,
  analyzeDynamics,
  analyzeTimbre,
  detectAcoustic,
} from '@libraz/libsonare';

await init();

const audio = Audio.fromBuffer(samples, 44100);

// Analysis
const bpm = audio.detectBpm();
const key = audio.detectKey();
const keyCandidates = audio.detectKeyCandidates();
const beats = audio.detectBeats();
const downbeats = audio.detectDownbeats();
const onsets = audio.detectOnsets();
const result = audio.analyze();
const chords = audio.detectChords({ useHmm: true });
const sections = analyzeSections(audio.data, audio.sampleRate);
const melody = analyzeMelody(audio.data, audio.sampleRate);
const dynamics = analyzeDynamics(audio.data, audio.sampleRate);
const timbre = analyzeTimbre(audio.data, audio.sampleRate);
const acoustic = detectAcoustic(audio.data, audio.sampleRate);

// Effects
const { harmonic, percussive } = audio.hpss();
const corrected = audio.pitchCorrectToMidi(68.7, 69);
const held = audio.noteStretch({ onsetSample: 12000, offsetSample: 24000, stretchRatio: 1.25 });
const voice = audio.voiceChange({ pitchSemitones: 3, formantFactor: 1.05 });
const stretched = audio.timeStretch(1.5);
const shifted = audio.pitchShift(2);
const normalized = audio.normalize(-3.0);
const trimmed = audio.trim(-60.0);

// Feature extraction
const stftResult = audio.stft();
const mel = audio.melSpectrogram();
const mfcc = audio.mfcc();
const chroma = audio.chroma();
const nnls = audio.nnlsChroma();
const env = audio.onsetEnvelope();
const loudness = audio.lufs();
const centroid = audio.spectralCentroid();
const bandwidth = audio.spectralBandwidth();
const rolloff = audio.spectralRolloff();
const flatness = audio.spectralFlatness();
const zcr = audio.zeroCrossingRate();
const rms = audio.rmsEnergy();
const pitch = audio.pitchPyin();

// Resampling
const resampled = audio.resample(22050);
```

All parameters (e.g., `nFft`, `hopLength`, `nMels`) have the same defaults as the standalone functions. The full method list by family:

| Family | Methods |
|---|---|
| Analysis | `detectBpm`, `detectKey`, `detectKeyCandidates`, `detectBeats`, `detectDownbeats`, `detectOnsets`, `detectChords`, `chordFunctionalAnalysis`, `analyze`, `analyzeWithProgress` |
| Separation and editing | `hpss`, `harmonic`, `percussive`, `timeStretch`, `pitchShift`, `pitchCorrectToMidi`, `noteStretch`, `noteMove`, `voiceChange`, `normalize`, `trim`, `resample` |
| Mastering | `mastering`, `masteringChain`, `masterAudio`, `masteringProcess` (see [Mastering API](./js-api-mastering.md)) |
| Spectral features | `stft`, `stftDb`, `melSpectrogram`, `mfcc`, `chroma`, `nnlsChroma`, `onsetEnvelope`, `spectralCentroid`, `spectralBandwidth`, `spectralRolloff`, `spectralFlatness`, `zeroCrossingRate`, `rmsEnergy`, `pitchYin`, `pitchPyin` |
| Loudness | `lufs`, `momentaryLufs`, `shortTermLufs`, `ebur128LoudnessRange` |
| Level meters | `peakDb`, `rmsDb`, `dcOffset`, `crestFactorDb`, `silenceRatio`, `truePeakDb`, `detectClipping`, `dynamicRange`, `spectrum`, `spectrumFrame` |

## Metering

Standalone meters report level, dynamics, and stereo-image statistics from a decoded buffer. Background: [Crest factor](./glossary/concepts/crest-factor.md), [Dynamic range](./glossary/concepts/dynamic-range.md), [Mono compatibility](./glossary/concepts/mono-compatibility.md) and [True peak](./glossary/true-peak.md). They are independent of the mastering chain and the streaming engine: pass a `Float32Array` or a left/right pair and get back a value or report. Every function accepts optional `options` with a `validate` flag (default `true`); set `validate: false` on hot paths to skip the O(n) JavaScript-side NaN/Inf pre-scan. It is not a way to push non-finite samples into the core — the native layer always re-validates, so a NaN/Inf buffer still throws, just with a generic native message instead of one naming the offending index. Empty-buffer checks always run.

### Single-channel level meters

```typescript
// Sample peak, dBFS
function meteringPeakDb(samples: Float32Array, sampleRate?: number, options?: ValidateOptions): number
// RMS level, dBFS
function meteringRmsDb(samples: Float32Array, sampleRate?: number, options?: ValidateOptions): number
// Crest factor (peak − RMS), dB
function meteringCrestFactorDb(samples: Float32Array, sampleRate?: number, options?: ValidateOptions): number
// Mean (DC) offset, linear amplitude
function meteringDcOffset(samples: Float32Array, sampleRate?: number, options?: ValidateOptions): number
// Inter-sample (true) peak, dBFS. oversampleFactor is a power of two in 1..16 (0 / omit = 4)
function meteringTruePeakDb(samples: Float32Array, sampleRate?: number, oversampleFactor?: number, options?: ValidateOptions): number
// Fraction of frames below thresholdDb, in [0, 1]. thresholdDb default -45,
// frameLength default 1024, hopLength default 256.
function meteringSilenceRatio(
  samples: Float32Array,
  sampleRate?: number,
  thresholdDb?: number,
  frameLength?: number,
  hopLength?: number,
  options?: ValidateOptions
): number
```

<SonareDemo id="inter-sample-peak" />

### Stereo level meters

A level meter that reads both channels instead of the `0.5 * (left + right)` downmix the single-channel meters need. Unlike the meters above, it is **request-object only** — there is no positional overload, and a positional call throws.

```typescript
// Crest factor over a channel pair, dB. Peak is taken across both channels
// and RMS is measured over the two together.
function meteringCrestFactorDbStereo(request: MeteringStereoRequest): number

interface MeteringStereoRequest extends ValidateOptions {
  left: Float32Array;
  right: Float32Array;
  sampleRate?: number;
}
```

```typescript
const crestDb = meteringCrestFactorDbStereo({ left, right, sampleRate });
```

Reach for it whenever the two channels may be out of phase. An inverted pair cancels in the downmix, so the single-channel path sees silence: on a fully inverted pair the stereo meter reads the signal's own crest factor (3.01 dB for a sine) while the downmix path reads **0.00 dB**.

<SonareDemo id="mono-fold" />

`meteringStereoCorrelation` and `meteringStereoWidth` accept the same `MeteringStereoRequest` shape alongside their positional forms.

### Clipping and dynamic range

```typescript
function meteringDetectClipping(
  samples: Float32Array,
  sampleRate?: number,
  options?: MeteringDetectClippingOptions
): ClippingReport

interface MeteringDetectClippingOptions extends ValidateOptions {
  threshold?: number;        // linear absolute threshold, default 0.999
  minRegionSamples?: number; // minimum run length to report, default 1
}

function meteringDynamicRange(
  samples: Float32Array,
  sampleRate?: number,
  options?: MeteringDynamicRangeOptions
): DynamicRangeReport

interface MeteringDynamicRangeOptions extends ValidateOptions {
  windowSec?: number;      // 0 / omit = 3 s
  hopSec?: number;         // 0 / omit = 1 s
  lowPercentile?: number;  // omit or negative = 0.10 (0 is a literal 0th percentile)
  highPercentile?: number; // omit or negative = 0.95
}

interface ClippingReport {
  clippedSamples: number;
  clippingRatio: number;
  maxClippedPeak: number;
  regions: ClippingRegion[];
}
interface ClippingRegion {
  startSample: number;
  endSample: number;
  length: number;
  peak: number;
}
interface DynamicRangeReport {
  dynamicRangeDb: number;
  lowPercentileDb: number;
  highPercentileDb: number;
  windowRmsDb: Float32Array;
}
```

### Stereo image

```typescript
// Uncentered channel correlation (cosine similarity), −1..1
function meteringStereoCorrelation(left: Float32Array, right: Float32Array, sampleRate?: number, options?: ValidateOptions): number
// Mid/side stereo width: 0 = mono, ~1 = wide stereo; unbounded above
// (Infinity when the mid signal is silent, such as fully out-of-phase audio)
function meteringStereoWidth(left: Float32Array, right: Float32Array, sampleRate?: number, options?: ValidateOptions): number
// Mid/side point series. One point per sample by default; pass maxPoints for a
// display-sized, deterministically decimated point set (0 / >= length = one point per sample).
function meteringVectorscope(left: Float32Array, right: Float32Array, sampleRate?: number, options?: ScopeOptions): VectorscopeReport
// Phase-scope point series plus summary stats. maxPoints decimates the point cloud the same way;
// the summary stats are always computed over the full-resolution signal.
function meteringPhaseScope(left: Float32Array, right: Float32Array, sampleRate?: number, options?: ScopeOptions): PhaseScopeReport

interface ScopeOptions extends ValidateOptions {
  maxPoints?: number;   // 0 / omit / >= length = one point per input sample
}

// Deprecated aliases: pass maxPoints to meteringVectorscope / meteringPhaseScope instead.
// They simply delegate and are kept for backward compatibility.
function meteringVectorscopeDecimated(left: Float32Array, right: Float32Array, sampleRate?: number, maxPoints?: number, options?: ValidateOptions): VectorscopeReport
function meteringPhaseScopeDecimated(left: Float32Array, right: Float32Array, sampleRate?: number, maxPoints?: number, options?: ValidateOptions): PhaseScopeReport

interface VectorscopeReport {
  mid: Float32Array;
  side: Float32Array;
}
interface PhaseScopeReport {
  mid: Float32Array;
  side: Float32Array;
  radius: Float32Array;
  angleRad: Float32Array;
  correlation: number;
  averageAbsAngleRad: number;
  maxRadius: number;
}
```

`meteringStereoCorrelation`, `meteringStereoWidth`, `meteringVectorscope`, and `meteringPhaseScope` require `left` and `right` to be the same length.

`meteringStereoWidth` is a side-to-mid energy ratio, not a normalized percentage: `0` is pure mono, around `1` is a wide stereo signal, and larger finite values mean increasingly decorrelated or out-of-phase content. Do not clamp it to `2`; when the mid channel is silent it deliberately returns `Infinity`.

### Spectrum snapshot

`meteringSpectrum` is Welch-averaged over the **whole** signal (split into 50%-overlapping Hann frames whose power spectra are averaged). For a true single-frame snapshot that is not time-averaged, use `meteringSpectrumFrame`, whose `frameOffset` positional argument selects where the analysis frame starts.

```typescript
function meteringSpectrum(
  samples: Float32Array,
  sampleRate?: number,
  options?: SpectrumOptions & ValidateOptions
): SpectrumReport

// True single-frame snapshot (one Hann-windowed nFft FFT), NOT time-averaged like meteringSpectrum.
// The analysis frame spans [frameOffset, frameOffset + nFft); samples past the end are zero-padded.
function meteringSpectrumFrame(
  samples: Float32Array,
  sampleRate?: number,
  frameOffset?: number,
  options?: SpectrumOptions & ValidateOptions
): SpectrumReport

interface SpectrumOptions {
  nFft?: number;                 // 0 / omit = 2048
  applyOctaveSmoothing?: boolean;
  octaveFraction?: number;       // e.g. 3 = 1/3-octave; 0 / omit = 3
  dbRef?: number;                // 0 / omit = 1.0
  dbAmin?: number;               // 0 / omit = library floor
}
interface SpectrumReport {
  frequencies: Float32Array;
  magnitude: Float32Array;
  power: Float32Array;
  db: Float32Array;
  nFft: number;
  sampleRate: number;
}
```

## Takes: alignment and shared silence

### `alignTakeToReference(request)`

```typescript
function alignTakeToReference(request: AlignTakeToReferenceRequest): AlignTakeToReferenceResult

interface AlignTakeToReferenceRequest {
  reference: Float32Array;  // guide take or backing track; non-empty, all finite
  take: Float32Array;       // the take to place under it; same constraints
  sampleRate: number;       // of reference, [8000, 384000]; also of take unless takeSampleRate is set
  takeSampleRate?: number;  // of take, [8000, 384000]; omit = sampleRate. Resampled onto sampleRate
  hopLength?: number;       // chroma hop in samples at sampleRate; omit or 0 = 512. Positive integer
  binsPerOctave?: number;   // CQT bins per octave; omit or 0 = 12. Positive multiple of 12
}
interface AlignTakeToReferenceResult {
  anchors: ProjectWarpAnchor[];   // >= 2 finite, strictly increasing { warpSample, sourceSample }
  alignment: { meanResidualFrames: number; referenceFrames: number; takeFrames: number };
}
```

Aligns the two chromagrams and reduces the path to anchors `Project.setWarpMap` accepts for the **take's** clip: `warpSample` is a position on the reference timeline, `sourceSample` the matching position in the take. Anchors and `hopLength` are in samples at `sampleRate`. It refuses, with a `RangeError`, an empty or non-finite buffer or a `sampleRate` or `takeSampleRate` outside the range (including `0`, which is never a default), and with `SonareError` `InvalidParameter` a negative resolution field, a `binsPerOctave` that is not a multiple of 12, a signal too short for two chroma frames, or a pair that yields no two distinct anchors — an unalignable pair is reported rather than answered with a map you cannot use. `alignment` never fails the call: `takeFrames / referenceFrames` is the overall rate difference the anchors encode and `meanResidualFrames` how far the path strayed from a constant rate; apply your own threshold. Where this sits in the capture-and-comp workflow is on [Recording and Takes](./recording-and-takes.md).

### `splitSilenceCommonWithReport(request)`

```typescript
function splitSilenceCommonWithReport(request: SplitSilenceCommonRequest): {
  intervals: Int32Array;       // exactly what splitSilenceCommon returns for the same request
  report: SilenceCommonReport;
}
interface SilenceCommonReport {
  silenceCeilingDb: number;    // largest topDb at which EVERY signal still shows silence
  maxSignalIntervals: number;  // intervals the most fragmented signal produced alone, before the union merges
  minSignalIntervals: number;  // the same for the least fragmented signal
}
```

Same request (`signals`, `topDb` 60, `frameLength` 2048, `hopLength` 512), same intervals, same refusals as `splitSilenceCommon` on [Helpers](./js-api-helpers.md). "Common" is the union of every take's sounding intervals, so each gap is silent in all of them. The report exists because one interval covering everything has three causes the interval list cannot separate. Read `silenceCeilingDb` against the `topDb` you passed: near 0, some take never stops sounding and no threshold helps; below `topDb`, the threshold was too loose, and a `topDb` under the ceiling cuts the same input; at or above `topDb` with still one interval, every take has silence but not in the same place — the case for `alignTakeToReference`. The counts describe shape only: a take that sounds once and stops counts 1, exactly like one with no silence at all.

### `remixAlignedIntervals(...)`

`remixAlignedIntervals` consumes one channel's samples plus a flat `(start, end)` interval list — the shape `splitSilenceCommon` returns — and produces that list snapped to zero crossings, so `remix` can cut every channel on identical frames. It does not take `alignTakeToReference` output; those are warp anchors, not cut points. Full entry: [`remixAlignedIntervals`](./js-api-features.md#remixalignedintervals).

## Mixer strips: `addStrip` and `settle`

```typescript
// Append a strip to a built mixer. Returns nothing: address it by index afterwards, and
// stripById(id) === the stripCount() before the call. Marks the graph dirty until compile() / processStereo().
addStrip(id: string, metering?: StripMeteringOptions): void

interface StripMeteringOptions {
  enabled?: boolean;            // both meters; false drops them (~145 KB per strip instead of ~1.4 MB at 48 kHz). Default true
  lufs?: boolean;               // LUFS measurement. Default true
  truePeak?: boolean;           // inter-sample peak measurement. Default true
  truePeakOversample?: number;  // [0, 16], resolved to 2x / 4x / 8x; 0 / omit = 4x
}

// Snap the strip's input-trim, fader, pan, and width smoothers to their set values.
settle(stripIndex: number): void
```

`addStrip` throws on a duplicate id, a `truePeakOversample` outside `[0, 16]`, a wrong-typed metering field, or a `metering` that is not a plain object, and the strip is not added. Metering is fixed when the strip is built — there is no setter. A strip with no explicit connection is routed to the master at compile, so the new strip is audible without a scene edit; what the caller may need to change is the input: `processStereo` takes up to one channel pair per strip and renders a strip without a pair as silence, so the new strip stays silent until the arrays grow by one at the new index. `processStereoInto` requires exactly `stripCount()` pairs (a `RangeError` otherwise), so grow its arrays after `addStrip` in a worklet loop. More pairs than strips throws. Scenes, routing, and compile timing are on [Mixing Engine](./mixing.md); the concepts are in [Channel strip](./glossary/mixing/channel-strip.md), [Buses and sends](./glossary/mixing/buses-sends.md) and [Automation and metering](./glossary/mixing/automation-metering.md).

`settle` is required before an **offline render from a freshly configured strip**. Every level control is smoothed for a live fader (~5 ms), so the first block after `setFaderDb` / `setPan` / `setWidth` / `setInputTrimDb` — or after `fromSceneJson` itself, whose fader smoother starts at unity — opens at the smoother's start and glides to the target: the first sample of a one-strip scene at −3 dB measured 3 dB hot, the full distance from unity to the target. Call it after the last control change and before the first block; in a live loop the glide is the point and the call is unnecessary. It clears nothing — automation, meters, and insert state are untouched — and rejects an out-of-range index.

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
mixer.sceneWarnings(); // non-fatal scene-load warnings: insert params no processor reads (typos), sends to an undeclared bus
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

A send to a bus the scene never declares still loads, with the implicit aux bus created, and adds a scene warning naming the strip and the bus (`send 'vocal' targets undeclared bus 'nowhere'; created as implicit aux`).

`Mixer.createRealtimeBuffer()` and `processStereoInto(...)` are intended for AudioWorklet-style render loops where avoiding per-block allocation matters. `processStereo` and `processStereoInto` both accept fewer input channels than the mixer has strips, leaving the remaining strips silent, and throw a `RangeError` naming both counts when given more (`got 3 input channels for a 2-strip mixer`). See [Mixing Engine](./mixing.md) for scene and routing details.

