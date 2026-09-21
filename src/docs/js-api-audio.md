---
title: JavaScript/TypeScript Audio and Streaming API
description: The Audio class, offline metering, and the incremental streaming API of the libsonare JavaScript/TypeScript package.
---

# JavaScript/TypeScript Audio and Streaming API

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

`async`; returns `Promise<Audio>`. Tries `Audio.fromMemory` first. If the bundled decoder cannot read the format, it uses the browser codec stack (`AudioContext.decodeAudioData`) for formats such as AAC, OGG, and FLAC. Browser-decoded multi-channel audio is mixed down to mono so the returned `Audio` object still contains one sample stream. Accepts an optional `BrowserAudioDecodeOptions` (`audioContext` / `createAudioContext` / `targetSampleRate`); a context this helper creates itself is closed afterward.

```typescript
const audio = await Audio.fromMemoryWithBrowserFallback(
  new Uint8Array(await file.arrayBuffer()),
);
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

All parameters (e.g., `nFft`, `hopLength`, `nMels`) have the same defaults as the standalone functions.

## Metering

Standalone meters report level, dynamics, and stereo-image statistics from a decoded buffer. They are independent of the mastering chain and the streaming engine: pass a `Float32Array` or a left/right pair and get back a value or report. Every function accepts optional `options` with a `validate` flag (default `true`); set `validate: false` on hot paths to skip the O(n) JavaScript-side NaN/Inf pre-scan. It is not a way to push non-finite samples into the core — the native layer always re-validates, so a NaN/Inf buffer still throws, just with a generic native message instead of one naming the offending index. Empty-buffer checks always run.

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

Reach for it whenever the two channels may be out of phase. An inverted pair cancels in the downmix, which understates RMS and so overstates crest factor: on a fully inverted pair the stereo meter reads **11.64 dB** while the downmix path reads **0.00 dB**.

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
  sampleRate: number;       // of BOTH buffers, [8000, 384000]; resample first if they differ
  hopLength?: number;       // chroma hop in samples; omit = 512. Positive integer; 0 is refused, not defaulted
  binsPerOctave?: number;   // CQT bins per octave; omit = 12. Positive multiple of 12; 0 is refused
}
interface AlignTakeToReferenceResult {
  anchors: ProjectWarpAnchor[];   // >= 2 finite, strictly increasing { warpSample, sourceSample }
  alignment: { meanResidualFrames: number; referenceFrames: number; takeFrames: number };
}
```

Aligns the two chromagrams and reduces the path to anchors `Project.setWarpMap` accepts for the **take's** clip: `warpSample` is a position on the reference timeline, `sourceSample` the matching position in the take. It refuses, with a `RangeError`, an empty or non-finite buffer or a `sampleRate` outside the range, and with `SonareError` `InvalidParameter` a `0` resolution field, a signal too short for two chroma frames, or a pair that yields no two distinct anchors — an unalignable pair is reported rather than answered with a map you cannot use. `alignment` never fails the call: `takeFrames / referenceFrames` is the overall rate difference the anchors encode and `meanResidualFrames` how far the path strayed from a constant rate; apply your own threshold. Where this sits in the capture-and-comp workflow is on [Recording and Takes](./recording-and-takes.md).

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

`addStrip` throws on a duplicate id, a `truePeakOversample` outside `[0, 16]`, a wrong-typed metering field, or a `metering` that is not a plain object, and the strip is not added. Metering is fixed when the strip is built — there is no setter. A strip with no explicit connection is routed to the master at compile, so the new strip is audible without a scene edit; what the caller must change is the input: `processStereo` requires one channel pair per strip, so it throws until the arrays grow by one at the new index. Scenes, routing, and compile timing are on [Mixing Engine](./mixing.md).

`settle` is required before an **offline render from a freshly configured strip**. Every level control is smoothed for a live fader (~5 ms), so the first block after `setFaderDb` / `setPan` / `setWidth` / `setInputTrimDb` — or after `fromSceneJson` itself, whose fader smoother starts at unity — opens at the smoother's start and glides to the target: a one-strip scene at −3 dB measured 5.8 dB hot on its first sample. Call it after the last control change and before the first block; in a live loop the glide is the point and the call is unnecessary. It clears nothing — automation, meters, and insert state are untouched — and rejects an out-of-range index.

## Streaming API

The Streaming API enables real-time audio analysis for visualizations and live monitoring. Unlike batch analysis, streaming processes audio chunk by chunk with minimal latency.

::: tip When to Use
- **Batch API**: Pre-recorded files, all-in-one analysis (BPM, key, chords, sections)
- **Streaming API**: Live audio, visualizations, real-time feedback
:::

This section is the `StreamAnalyzer` type/class reference. For the runnable recipe, the AudioWorklet bridge, output-format details, and the progressive-estimate walkthrough, see [Realtime and Streaming](./realtime-streaming.md).

### StreamConfig

Configuration options for StreamAnalyzer.

```typescript
interface StreamConfig {
  sampleRate?: number;         // default: 44100 (stream default, not 22050)
  nFft?: number;               // default: 2048
  hopLength?: number;          // default: 512
  nMels?: number;              // default: 128
  fmin?: number;               // default: 0
  fmax?: number;               // default: 0 (= sr/2)
  tuningRefHz?: number;        // default: 440
  computeMel?: boolean;        // default: true
  computeChroma?: boolean;     // default: true
  computeOnset?: boolean;      // default: true
  computeSpectral?: boolean;   // default: true
  emitEveryNFrames?: number;   // default: 1 (no throttling)
  magnitudeDownsample?: number;// default: 1
  maxPendingFrames?: number;   // default: 4096; overflow drops newly produced output frames
  maxProgressionEntries?: number; // default: 4096; cap for each retained chord/bar progression, overflow drops oldest
  keyUpdateIntervalSec?: number;  // default: 5
  bpmUpdateIntervalSec?: number;  // default: 10
  window?: number;             // 0=Hann (default), 1=Hamming, 2=Blackman, 3=Rectangular
  outputFormat?: 0;            // legacy; omit it or use Float32 (0)
}
```

`outputFormat` is retained only for source compatibility and must be `0` when
provided. Choose a quantized read explicitly with `readFramesU8` or
`readFramesI16`; analysis itself always runs in float. See [Realtime and
Streaming](./realtime-streaming.md#reading-frames-and-output-format).

The legacy `computeMagnitude` flag is no longer supported; passing it makes the
constructor throw. The flag was removed because magnitude frames are not exposed
by the StreamAnalyzer read paths; use `stft`/`stftDb` offline or the spectrum
metering helpers for magnitude data.

`streamAnalyzerConfigDefaults()` returns a fully-populated `StreamConfigDefaults`
object (a `Required<StreamConfig>`) holding the library's default values for
every field above. Use it to seed a settings UI or to compute a diff against a
user-supplied config; `StreamAnalyzer` itself applies these same defaults for any
field you omit.

### StreamAnalyzer Class

```typescript
class StreamAnalyzer {
  constructor(config: StreamConfig);

  // Process audio chunk (internal offset tracking)
  process(samples: Float32Array): void;

  // Process with an explicit, contiguous sample offset. A gap, seek, or switch
  // from process() requires reset() first.
  processWithOffset(samples: Float32Array, sampleOffset: number): void;

  // Number of frames ready to read
  availableFrames(): number;

  // Read processed frames (full float precision)
  readFrames(maxFrames: number): FrameBuffer;

  // Quantized reads for bandwidth-reduced transfer / visualization
  // (optional quantizeConfig widens quantization ranges for unusually loud/quiet streams;
  // see Realtime and Streaming → custom quantization ranges)
  readFramesU8(maxFrames: number, quantizeConfig?: StreamQuantizeConfig): StreamFramesU8;   // Uint8 feature arrays
  readFramesI16(maxFrames: number, quantizeConfig?: StreamQuantizeConfig): StreamFramesI16; // Int16 feature arrays

  // Reset state for new stream
  reset(baseSampleOffset?: number): void;

  // Get statistics and estimates that update as audio arrives
  stats(): AnalyzerStats;

  // Total frames processed
  frameCount(): number;

  // Current time position (seconds)
  currentTime(): number;

  // Get the sample rate
  sampleRate(): number;

  // Set expected total duration for pattern lock timing
  setExpectedDuration(durationSeconds: number): void;

  // Set normalization gain for loud/compressed audio
  setNormalizationGain(gain: number): void;

  // Set tuning reference frequency (default: 440 Hz)
  setTuningRefHz(refHz: number): void;

  // Release resources (call when done). `delete()` is canonical; `dispose()` is an alias.
  delete(): void;
  dispose(): void;
}
```

### FrameBuffer

Structure-of-Arrays format for efficient transfer via `postMessage`.

```typescript
interface FrameBuffer {
  nFrames: number;
  nMels: number;
  nChroma: number;             // 12 when chroma is present; otherwise 0
  featureFlags: number;        // MEL=1, CHROMA=2, ONSET=4, SPECTRAL=8
  timestamps: Float32Array;      // [nFrames]
  mel: Float32Array;             // [nFrames * nMels], empty if MEL is absent
  chroma: Float32Array;          // [nFrames * nChroma], empty if CHROMA is absent
  onsetStrength: Float32Array;   // [nFrames], empty if ONSET is absent
  rmsEnergy: Float32Array;       // [nFrames]
  spectralCentroid: Float32Array;// [nFrames], empty if SPECTRAL is absent
  spectralFlatness: Float32Array;// [nFrames], empty if SPECTRAL is absent
  chordRoot: Int32Array;         // [nFrames], empty if CHROMA is absent
  chordQuality: Int32Array;      // [nFrames], empty if CHROMA is absent
  chordConfidence: Float32Array; // [nFrames], empty if CHROMA is absent
}
```

### ChordChange

A detected chord change in the progression.

```typescript
interface ChordChange {
  root: PitchClass;
  quality: ChordQuality;
  startTime: number;
  confidence: number;
}
```

### BarChord

A chord detected at bar boundary (beat-synchronized).

```typescript
interface BarChord {
  barIndex: number;
  root: PitchClass;
  quality: ChordQuality;
  startTime: number;
  confidence: number;
}
```

### PatternScore

Match score for a known chord progression pattern.

```typescript
interface PatternScore {
  name: string;   // pattern name (e.g., "royalRoad", "pop")
  score: number;  // match score (0-1)
}
```

### AnalyzerStats

```typescript
interface AnalyzerStats {
  totalFrames: number;
  totalSamples: number;
  durationSeconds: number;
  pendingFrames: number;       // unread frames currently buffered
  droppedOutputFrames: number; // newly produced frames dropped at the configured cap
  droppedChordProgressionEntries: number; // oldest chord-history entries dropped at the configured cap
  droppedBarProgressionEntries: number;   // oldest bar-history entries dropped at the configured cap
  estimate: ProgressiveEstimate;
}
```

### ProgressiveEstimate

BPM, key, and chord estimates that improve over time as more audio is processed.

```typescript
interface ProgressiveEstimate {
  // BPM estimation
  bpm: number;              // 0 if not yet estimated
  bpmConfidence: number;    // 0-1, increases over time
  bpmCandidateCount: number;

  // Key estimation
  key: PitchClass;          // 0-11 (C-B)
  keyMinor: boolean;
  keyConfidence: number;    // 0-1, increases over time

  // Chord estimation (current)
  chordRoot: PitchClass;
  chordQuality: ChordQuality;
  chordConfidence: number;
  chordStartTime: number;
  chordProgression: ChordChange[];     // detected chord changes
  barChordProgression: BarChord[];     // bar-synchronized chords
  currentBar: number;                  // current bar index
  barDuration: number;                 // bar duration in seconds

  // Pattern detection
  votedPattern: BarChord[];            // voted chord for each pattern position
  patternLength: number;              // length of repeating pattern (default: 4 bars)
  detectedPatternName: string;        // best matching pattern name (e.g., "royalRoad")
  detectedPatternScore: number;       // match score (0-1)
  allPatternScores: PatternScore[];   // all known pattern scores

  // Statistics
  accumulatedSeconds: number;
  usedFrames: number;
  updated: boolean;         // true if estimate changed this frame
}
```

### Usage, AudioWorklet integration, and timing

The runnable `StreamAnalyzer` recipe — feeding blocks from an `AudioWorklet`,
reading frames, throttling with `emitEveryNFrames`, and mapping the `FrameBuffer`
stream-time timestamps onto `AudioContext.currentTime` — lives on
[Realtime and Streaming](./realtime-streaming.md), with the AudioWorklet handshake
and data-flow diagrams.

::: tip Releasing WASM objects
`StreamAnalyzer`, `Mixer`, `StreamingEqualizer`, and `StreamingMasteringChain` are
**embind** handles onto WASM heap memory that the JavaScript garbage collector cannot
reclaim — call `delete()` when done (`StreamAnalyzer` also accepts `dispose()`, and
some classes expose `destroy()` as an alias). Plain functions like `analyze()` return
ordinary JS values and need no cleanup. Node native cleanup differs; see
[Native Bindings](./native-bindings.md).
:::
