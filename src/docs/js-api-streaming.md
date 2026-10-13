---
title: JavaScript/TypeScript Streaming and Realtime API
description: Block-by-block EQ, pitch retune, the realtime voice changer, the streaming mastering chain, and the incremental StreamAnalyzer of the libsonare JavaScript/TypeScript package.
---

# JavaScript/TypeScript Streaming and Realtime API

Block-by-block processors for the libsonare JavaScript/TypeScript package: `StreamingEqualizer`, `StreamingRetune`, `RealtimeVoiceChanger` with its `voiceChangeRealtime(...)` convenience call, `StreamingMasteringChain`, and the incremental `StreamAnalyzer`; see [Mastering API](./js-api-mastering.md) for the offline chain, presets, and one-shot processors.

## StreamingEqualizer

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

For a first-order low or high shelf, set the band's `slopeDbOct` to `6`. Its `frequencyHz` is then where the shelf reaches half its gain change in dB, and `q` has no effect. Leaving `slopeDbOct` unset uses the regular shelf design shown above.

CLI equivalents for file-based EQ and filtering. `eq` exists in both the Python and the C++ CLI; `filter` only in the source-built C++ CLI.

```bash
sonare eq track.wav --type 2 --frequency-hz 8000 --gain-db 4 --q 0.7 -o eq.wav
# C++ CLI only
sonare filter track.wav --type hp --cutoff 80 -o filtered.wav
```

`eq --type` takes the band type ordinal in the order of `EqBandType`, so `9` is the all-pass band on both CLIs. Linear-phase mode refuses an all-pass band by name.

`nonFiniteDiscardCount()` counts the processed blocks in which a non-finite sample reached the EQ and its recursive filter state was discarded; see [Non-finite input](#non-finite-input).

## StreamingRetune

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

<SonareDemo id="pitch-correct" />

Closest CLI equivalents for offline files (both the Python and the C++ CLI):

```bash
sonare pitch-shift vocal.wav --semitones 3 -o shifted.wav
sonare voice-change vocal.wav --pitch-semitones 3 --formant-factor 1.0 -o voice.wav
```

## RealtimeVoiceChanger

`RealtimeVoiceChanger` is the preset-based live voice chain (high-pass, gate, retune, formant, EQ, compressor, de-esser, reverb, and limiter stages) that keeps state across audio blocks. Use it for monitoring, AudioWorklet-style processing, or chunked voice rendering where `voiceChange(...)` is too simple. Factory preset IDs come from `realtimeVoiceChangerPresetNames()`; preset JSON is fetched with `realtimeVoiceChangerPresetJson(...)` and checked with `validateRealtimeVoiceChangerPresetJson(...)` (schema version `1`). `RealtimeVoiceChangerConfigInput` is strict: use one of the six `VoicePresetId` strings or a preset object with either a `dsp` object or a `macros` object, never both.

```typescript
import { init, RealtimeVoiceChanger, realtimeVoiceChangerPresetNames } from '@libraz/libsonare';
await init();

const changer = new RealtimeVoiceChanger('bright-idol');
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

The six factory presets are `neutral-monitor`, `bright-idol`, `soft-whisper`, `deep-narrator`, `robot-mascot` and `dark-villain`; `realtimeVoiceChangerPresetNames()` returns the same list at runtime.

| Task | Methods |
|---|---|
| Configure | The constructor (passing `sampleRate` prepares immediately), `prepare(sampleRate, maxBlockSize?, channels?)`, `setConfig(config)`, `setPodConfig(config)` (a flat, pre-normalized config for AudioWorklet control messages), `configJson()` |
| Process, allocating the result | `processMono(samples)`, `processInterleaved(samples, channels)` |
| Process into your own array | `processMonoInto(samples, output)`, `processInterleavedInto(samples, channels, output)` |
| Zero-copy | `createRealtimeMonoBuffer`, `createRealtimeInterleavedBuffer`, `createRealtimePlanarBuffer`, or the lower-level `get*Buffer` plus `processPreparedMono` / `processPreparedInterleaved` / `processPreparedPlanar` |
| State | `reset()`, `latencySamples()`, `nonFiniteDiscardCount()`, `delete()` / `destroy()` |

The zero-copy buffer helpers return changer-owned WASM heap views; reuse them inside a realtime loop and discard after `delete()`. See [Realtime Voice Changer](./realtime-voice-changer.md) for the preset list and the order of the chain stages, and [Realtime safety](./glossary/realtime/realtime-safety.md) for what a realtime loop may and may not do.

<SonareDemo id="formant-shift" />

## `voiceChangeRealtime(samples, sampleRate?, preset?, options?)`

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

## StreamingMasteringChain

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
chain.setParameter('eq.tilt.tiltDb', 1.0);

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

`setParameter(key, value)` updates one realtime-safe parameter on a prepared chain. The write is serialized at a block boundary while the chain keeps its processor instances, audio history, and latency. Keys use their full dotted form, such as `eq.tilt.tiltDb`; only realtime-safe keys belonging to enabled stages are available. A multiband stage retargets every band live through `dynamics.multibandComp.band<i>.<field>` (`thresholdDb`, `ratio`, `attackMs`, `releaseMs`, `makeupGainDb`), not only the low/mid/high threshold, ratio, attack and release. Structural keys, keys from disabled stages, and unknown keys are rejected. Serialize calls to `setParameter()` with `process*()`, `flush*()`, `reset()`, and `prepare()`; parameter changes take effect at the boundary and are not smoothed automatically.

`flushMono()` / `flushStereo()` emit the delayed audio plus finite processor
tails once you have no more input. Call until an empty result comes back.
Without the flush, a bounce built from a streaming chain loses its last
`latencySamples()` samples and any reverb or limiter tail. The first
`latencySamples()` samples of the concatenated stream are the chain's delay and
should be dropped for a time-aligned result.

`nonFiniteDiscardCount()` and `nonFiniteSubstitutionCount()` report degraded input; see [Non-finite input](#non-finite-input). Stereo-only stages are skipped when `numChannels === 1`. Of the chain-config repair stages, only `repair.denoise` runs on the streaming chain, and only with a causal noise estimator (`noiseEstimator` 1 = MCRA, 2 = IMCRA or 3 = speech-presence probability, or the `mcra` / `imcra` / `spp` name). It defaults to `spp`, so `repair.denoise.enabled` alone prepares; the quantile estimator (0, `quantile`) ranks the whole signal's frames, so the constructor refuses it by name. `repair.declick`, `repair.dereverb`, `repair.declip`, `repair.decrackle` and `repair.dehum` throw if enabled here — run them through `masteringChain*` / `masterAudio*`, the one-shot `masteringRepair*` helpers, or as [realtime inserts](./audio-repair.md#realtime-inserts) where the stage has one. The `loudness` stage also throws unless you supply `loudnessStaticGainDb` (optionally with `loudnessStaticGainPeakDb`), since the streaming chain cannot measure whole-signal integrated LUFS. Call `reset()` between independent songs and `delete()` to free the handle.

## Streaming API

The Streaming API enables real-time audio analysis for visualizations and live monitoring. Unlike batch analysis, streaming processes audio chunk by chunk with minimal latency. Background: [Streaming analysis](./glossary/realtime/streaming-analysis.md).

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
  nFft?: number;               // default: 2048, in samples at 44100 Hz
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

`nFft` is a duration written as samples at 44100 Hz: on a stream at a lower `sampleRate` the window is rescaled to the analysis rate (never shorter than `hopLength`), and `hopLength` stays in input samples. The emitted bin count follows the FFT length the window is zero-padded to, not `nFft / 2 + 1`.

There is no `computeMagnitude` flag: passing it makes the constructor throw,
because magnitude frames are not exposed by the StreamAnalyzer read paths. Use `stft`/`stftDb` offline or the spectrum
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

  // Flush the tail at end of stream: drains the high-rate resampler tail and
  // zero-pads the final partial frame. A repeat call is a no-op; process()
  // afterwards throws until reset().
  finalize(): void;

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
  name: string;         // chord symbol, e.g. "C", "C#m", "N.C."
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
  name: string;         // chord symbol, spelled as the batch analysis spells it
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
  nonFiniteDiscardBlocks: number;         // process() calls in which a non-finite sample was replaced
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
  keyName: string | null;       // e.g. "A minor"; null while no key is estimated
  keyShortName: string | null;  // e.g. "Am"; null while no key is estimated

  // Chord estimation (current)
  chordRoot: PitchClass;
  chordQuality: ChordQuality;
  chordName: string;        // current chord symbol; "N.C." while none is detected
  chordConfidence: number;  // 0-1
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

The key is estimated from the stream's own 186 ms chroma, so it trails the input by up to about a quarter second more than the frame outputs do. Every confidence, including per-frame `chordConfidence` and each `ChordChange` / `BarChord` confidence, stays in 0-1. `keyName`, `keyShortName` and `chordName` spell the estimate the way the batch analysis does, so a UI can show them without mapping `key` / `chordRoot` itself.

### Non-finite input

A NaN or infinity in the input does not raise an error in the processors below; each replaces it or discards the state it reached, so the output stays finite while no longer describing the input. These counters are the only report that happened.

| Object | Counter | Counts | Cleared by |
|---|---|---|---|
| `StreamAnalyzer` | `stats().nonFiniteDiscardBlocks` | `process()` calls in which a non-finite sample was replaced | `reset()` |
| `StreamingEqualizer` | `nonFiniteDiscardCount()` | Processed blocks in which a filter's recursive state was discarded | never |
| `RealtimeVoiceChanger` | `nonFiniteDiscardCount()` | Processed blocks in which the chain discarded its own state | never |
| `StreamingMasteringChain` | `nonFiniteDiscardCount()` | Processing calls in which a stage discarded its recursive state | `prepare()` |
| `StreamingMasteringChain` | `nonFiniteSubstitutionCount()` | Samples a true-peak limiter replaced with a finite value | `prepare()` |

The unit is a block or call, never a sample or a channel. `StreamingMasteringChain` is the exception to the rule above: a non-finite sample in its input is rejected with `InvalidParameter` before any stage runs.

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

