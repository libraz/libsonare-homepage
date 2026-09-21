---
title: JavaScript/TypeScript librosa-Compatible Helpers
description: Argument-for-argument librosa ports for pre-emphasis, test-signal generation, spectral reconstruction, structure, segmentation, and tempograms in the libsonare JavaScript/TypeScript package.
---

# JavaScript/TypeScript librosa-Compatible Helpers

librosa-parity helper functions for the libsonare JavaScript/TypeScript package; see [Analysis API](./js-api-analysis.md) for BPM/key/beat detection, the all-in-one `analyze()` call, and unit conversions.

## librosa-Compatible Helpers

These librosa-parity helpers match the corresponding `librosa` functions and are
exposed across the WASM, Node, and Python bindings. The signatures are below; for
the librosa function each one maps to argument-for-argument, and when to reach for
it, see [librosa Compatibility](/docs/librosa-compatibility).

### Pre-emphasis / De-emphasis

```typescript
function preemphasis(samples: Float32Array, coef?: number, zi?: number): Float32Array  // coef default 0.97
function deemphasis(samples: Float32Array, coef?: number, zi?: number): Float32Array
```

`zi` provides an initial condition (a previous frame's tail) when streaming.

### Test-signal generation

Deterministic signals for fixtures, calibration, and click tracks — no asset
files needed.

```typescript
function tone(request?: ToneRequest): Float32Array
function chirp(request?: ChirpRequest): Float32Array
function clicks(request: ClicksRequest): Float32Array
```

### Spectral reconstruction and pitch candidates

```typescript
function griffinLim(request: GriffinLimRequest): Float32Array
function reassignedSpectrogram(request: ReassignedSpectrogramRequest): ReassignedSpectrogramResult
function piptrack(request: PiptrackRequest): PiptrackResult
function melDelta(request: MelDeltaRequest): Float32Array
function spectralFlux(request: SpectralFrameRequest & { lag?: number }): Float32Array
function onsetBacktrack(request: OnsetBacktrackRequest): Int32Array
```

`griffinLim` reconstructs audio from an STFT magnitude matrix; `melToAudio` and
`mfccToAudio` are the mel-domain wrappers around it. `onsetBacktrack` moves
detected onset frames back to the preceding energy minimum, which is what you
want before slicing at an onset.

`spectralBandwidth` takes a configurable Minkowski exponent `p` (positional
argument 5, or `p` on the request object) rather than assuming `p = 2`.

### Structure and self-similarity

The segmentation family builds the matrices structural analysis is made of.

```typescript
function segmentCrossSimilarity(request: SegmentCrossSimilarityRequest): SegmentMatrix
function segmentRecurrenceMatrix(request: SegmentRecurrenceMatrixRequest): SegmentMatrix
function segmentRecurrenceToLag(request: SegmentRecurrenceToLagRequest): SegmentMatrix
function segmentLagToRecurrence(request: SegmentLagToRecurrenceRequest): SegmentMatrix
function segmentPathEnhance(request: SegmentPathEnhanceRequest): SegmentMatrix
function segmentSubsegment(request: SegmentSubsegmentRequest): Int32Array
function segmentAgglomerative(request: SegmentAgglomerativeRequest): Int32Array
```

`analyzeSections(...)` is the packaged answer for "where are the sections". Reach
for these when you want the intermediate matrices — to draw a self-similarity
plot, or to run your own boundary detection over an enhanced recurrence matrix.

### Note segmentation

Turn a monophonic F0 track into stable note regions. Pass a track you already
have (from `pitchYin` / `pitchPyin`, or from your own tracker) together with the
frame cadence that produced it.

```typescript
interface NoteSegmentsRequest {
  f0Hz: Float32Array;
  voicedProb: Float32Array;
  /** Frames per second of the supplied track. */
  frameRate: number;
  segmentationThresholdCents?: number;  // default 50
  minNoteMs?: number;                   // default 30
  referenceHz?: number;                 // default 440 (A4)
  /** Voicing threshold applied to `voicedProb`. */
  voicedThreshold?: number;             // default 0.5
}

function noteSegments(request: NoteSegmentsRequest): Array<{
  frameStart: number;    // half-open frame bounds: [frameStart, frameEnd)
  frameEnd: number;
  startSeconds: number;
  endSeconds: number;
  medianCents: number;
}>
```

`f0Hz` and `voicedProb` must be the same non-zero length. Zero-Hz frames and
values below `voicedThreshold` (default `0.5`) count as unvoiced and break a
note.

::: danger Do not pass `pitchPyin`'s `voicedProb` here
Despite the field name, this is **not** the place for pYIN's `voicedProb`. That
value is the frame's voiced observation **mass**, and for a fixed frame length it
rises with F0 — it tracks pitch height, not confidence. Fed to a fixed threshold
it silently returns **no segments at all** for low-register material: a steady
tone below roughly C5 never reaches `0.5`, so every frame reads as unvoiced and
the function returns an empty array with no error to explain it.

Pass the **flags** instead — `PitchResult.voicedFlag` converted to `0`/`1` — or,
if you must use a probability-like series, lower `voicedThreshold` to suit the
register you are working in.
:::

### Silence Trim / Split

```typescript
function trimSilence(
  samples: Float32Array,
  topDb?: number,        // default 60
  frameLength?: number,  // default 2048
  hopLength?: number,    // default 512
): { audio: Float32Array; startSample: number; endSample: number }

function splitSilence(
  samples: Float32Array,
  topDb?: number,
  frameLength?: number,
  hopLength?: number,
): Int32Array  // flat [start0, end0, start1, end1, ...]

function splitSilenceCommon(request: {
  signals: Float32Array[];
  topDb?: number;         // default 60
  frameLength?: number;   // default 2048
  hopLength?: number;     // default 512
}): Int32Array            // same flat pair layout
```

`trimSilence` (`librosa.effects.trim`) uses frame RMS and a `topDb` distance below
the peak RMS, returning the trimmed audio plus the original `[startSample, endSample)`
range — distinct from the simpler `trim(samples, sampleRate, thresholdDb)`.
`splitSilence` (`librosa.effects.split`) returns non-silent intervals as sample-index pairs.

`splitSilenceCommon` answers the same question for **several takes of one part at
once**. What takes have in common is the silence, not the sound: one take breathes
where another sustains, so a cut point chosen from a single take lands mid-phrase
in the others. It returns the union of what `splitSilence` reports for each signal,
merged where intervals touch — so every gap *between* the returned intervals is
quiet in all of them simultaneously, and a cut placed there is safe in every take.

```typescript
const cuts = splitSilenceCommon({ signals: [takeA, takeB, takeC], topDb: 55 });
```

Takes of unequal length need no padding: a signal shorter than the longest simply
contributes nothing past its own end. Passing a single signal returns exactly what
`splitSilence` would.

### Frame / Pad / Length Helpers

```typescript
function frameSignal(
  samples: Float32Array,
  frameLength: number,
  hopLength: number,
): { nFrames: number; frames: Float32Array }  // row-major

function padCenter(values: Float32Array, targetSize: number, padValue?: number): Float32Array
function fixLength(values: Float32Array, targetSize: number, padValue?: number): Float32Array
function fixFrames(frames: Int32Array, xMin?: number, xMax?: number, pad?: boolean): Int32Array
```

`frameSignal` is `librosa.util.frame`; `padCenter`, `fixLength`, and `fixFrames`
mirror the `librosa.util` helpers of the same names.

### Peak Picking / Vector Normalize

```typescript
function peakPick(
  values: Float32Array,
  preMax: number,
  postMax: number,
  preAvg: number,
  postAvg: number,
  delta: number,
  wait: number,
): Int32Array  // peak indices

function vectorNormalize(
  values: Float32Array,
  normType?: number,  // 0 = inf, 1 = L1, 2 = L2, 3 = power (default 0)
  threshold?: number, // default 1e-12
): Float32Array
```

`peakPick` is `librosa.util.peak_pick` (post-processing for 1-D signals such as
onset envelopes); `vectorNormalize` is `librosa.util.normalize`. See
[librosa Compatibility](/docs/librosa-compatibility) for the `peakPick` window
parameters and each `normType`.

### PCEN (Per-Channel Energy Normalization)

```typescript
function pcen(
  values: Float32Array,
  nBins: number,
  nFrames: number,
  options?: {
    sampleRate?: number;
    hopLength?: number;
    timeConstant?: number;  // default 0.4
    gain?: number;          // default 0.98
    bias?: number;          // default 2.0
    power?: number;         // default 0.5
    eps?: number;           // default 1e-6
  },
): Float32Array
```

`pcen` matches `librosa.pcen`. Input is a row-major `[nBins x nFrames]`
mel spectrogram; output uses the same layout.

### Tonnetz / Tempogram / PLP

```typescript
function tonnetz(
  chromagram: Float32Array,   // row-major [nChroma x nFrames]
  nChroma: number,
  nFrames: number,
): Float32Array               // [6 x nFrames]

function tempogram(
  onsetEnvelope: Float32Array,
  sampleRate: number,
  hopLength?: number,         // default 512
  winLength?: number,         // default 384
  mode?: 'autocorrelation' | 'auto' | 'ac' | 'cosine' | 0 | 1,  // default 'autocorrelation'
): { nFrames: number; winLength: number; data: Float32Array }

function fourierTempogram(
  onsetEnvelope: Float32Array,
  sampleRate?: number,
  hopLength?: number,
  winLength?: number,
): { nBins: number; nFrames: number; data: Float32Array }

function cyclicTempogram(
  onsetEnvelope: Float32Array,
  sampleRate: number,
  hopLength?: number,
  winLength?: number,
  bpmMin?: number,            // default 60
  nBins?: number,             // default 60
): { nFrames: number; nBins: number; data: Float32Array }

function tempogramRatio(
  tempogramData: Float32Array,
  winLength?: number,
  sampleRate?: number,
  hopLength?: number,
  factors?: Float32Array | number[], // default [0.5, 1, 2, 3, 4]
): Float32Array

function plp(
  onsetEnvelope: Float32Array,
  sampleRate: number,
  hopLength?: number,
  tempoMin?: number,          // default 30
  tempoMax?: number,          // default 300
  winLength?: number,
): Float32Array
```

For `tempogram`, `mode: 'cosine'` selects the window-local cosine-similarity
variant (`'auto'`, `'ac'`, `0`, and `1` aliases are also accepted). See
[librosa Compatibility](/docs/librosa-compatibility) for the librosa feature each
helper maps to, and [Realtime and Streaming](./realtime-streaming.md#tempograms-from-an-onset-envelope)
for when to use each.

