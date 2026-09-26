---
title: JavaScript/TypeScript Feature Extraction API
description: STFT, mel/MFCC, chroma, spectral features, pitch detection, and the CQT/VQT/decomposition family in the libsonare JavaScript/TypeScript package.
---

# JavaScript/TypeScript Feature Extraction API

Feature-extraction functions for the libsonare JavaScript/TypeScript package; see [Analysis API](./js-api-analysis.md) for BPM/key/beat detection, the all-in-one `analyze()` call, and unit conversions.

## Feature Extraction

### `stft(samples, sampleRate, nFft?, hopLength?)` <Badge type="info" text="Medium" />

Compute Short-Time Fourier Transform.

```typescript
function stft(
  samples: Float32Array,
  sampleRate?: number, // default: 22050
  nFft?: number,      // default: 2048
  hopLength?: number  // default: 512
): StftResult

interface StftResult {
  nBins: number;
  nFrames: number;
  nFft: number;
  hopLength: number;
  sampleRate: number;
  magnitude: Float32Array;
  power: Float32Array;
}
```

### `stftDb(samples, sampleRate, nFft?, hopLength?)` <Badge type="info" text="Medium" />

Compute STFT and return in dB scale.

```typescript
function stftDb(
  samples: Float32Array,
  sampleRate?: number, // default: 22050
  nFft?: number,      // default: 2048
  hopLength?: number  // default: 512
): { nBins: number; nFrames: number; db: Float32Array }
```

### `melSpectrogram(samples, sampleRate, nFft?, hopLength?, nMels?)` <Badge type="info" text="Medium" />

Compute Mel spectrogram. Frequency representation that matches human pitch perception.

```typescript
function melSpectrogram(
  samples: Float32Array,
  sampleRate?: number, // default: 22050
  nFft?: number,      // default: 2048
  hopLength?: number, // default: 512
  nMels?: number,     // default: 128
  fmin?: number,      // default: 0 (librosa default)
  fmax?: number,      // default: 0 = sampleRate / 2
  htk?: boolean       // default: false = Slaney formula; true = HTK
): MelSpectrogramResult

interface MelSpectrogramResult {
  nMels: number;
  nFrames: number;
  sampleRate: number;
  hopLength: number;
  power: Float32Array;
  db: Float32Array;
}
```

### `mfcc(samples, sampleRate, nFft?, hopLength?, nMels?, nMfcc?)` <Badge type="info" text="Medium" />

Compute MFCC (Mel-Frequency Cepstral Coefficients). Compact representation of spectral envelope.

```typescript
function mfcc(
  samples: Float32Array,
  sampleRate?: number, // default: 22050
  nFft?: number,      // default: 2048
  hopLength?: number, // default: 512
  nMels?: number,     // default: 128
  nMfcc?: number,     // default: 20
  fmin?: number,      // default: 0 (librosa default)
  fmax?: number,      // default: 0 = sampleRate / 2
  htk?: boolean,      // default: false = Slaney formula; true = HTK
  lifter?: number     // default: 0 = no liftering
): MfccResult

interface MfccResult {
  nMfcc: number;
  nFrames: number;
  coefficients: Float32Array;
}
```

Set `fmin`/`fmax` to bound the Mel band edges, and pass `htk: true` to use the
HTK Mel formula instead of Slaney. `lifter` matches librosa's `lifter` argument
(cepstral/sinusoidal liftering that de-emphasizes higher cepstral coefficients);
`0` disables liftering. The inverse helpers (`melToStft`, `melToAudio`,
`mfccToAudio`) take matching `fmin`/`fmax`/`htk` arguments, so a round-trip stays
consistent when you keep the same values on both sides.

### `chroma(samples, sampleRate, nFft?, hopLength?)` <Badge type="info" text="Medium" />

Compute chromagram (pitch class distribution). Maps all frequencies to 12 pitch classes (C, C#, D, ..., B).

<SonareDemo id="chromagram" />

```typescript
function chroma(
  samples: Float32Array,
  sampleRate?: number, // default: 22050
  nFft?: number,      // default: 2048
  hopLength?: number  // default: 512
): ChromaResult

interface ChromaResult {
  nChroma: number;        // 12
  nFrames: number;
  sampleRate: number;
  hopLength: number;
  features: Float32Array;
  meanEnergy: number[];   // [12] per pitch class
}
```

### Spectral Features

```typescript
// Spectral centroid (center of mass) in Hz
function spectralCentroid(
  samples: Float32Array,
  sampleRate?: number,  // default: 22050
  nFft?: number,
  hopLength?: number
): Float32Array

// Spectral bandwidth in Hz
function spectralBandwidth(
  samples: Float32Array,
  sampleRate?: number,  // default: 22050
  nFft?: number,
  hopLength?: number,
  p?: number             // Minkowski exponent, default: 2
): Float32Array

// Spectral rolloff frequency in Hz
function spectralRolloff(
  samples: Float32Array,
  sampleRate?: number,  // default: 22050
  nFft?: number,
  hopLength?: number,
  rollPercent?: number  // default: 0.85
): Float32Array

// Spectral flatness (0 = tonal, 1 = noise-like)
function spectralFlatness(
  samples: Float32Array,
  sampleRate?: number,  // default: 22050
  nFft?: number,
  hopLength?: number
): Float32Array

// Spectral contrast matrix, shape (nBands + 1) x nFrames
function spectralContrast(
  samples: Float32Array,
  sampleRate?: number,
  nFft?: number,
  hopLength?: number,
  nBands?: number,
  fmin?: number,
  quantile?: number
): Matrix2dResult

// Per-frame polynomial spectral coefficients, shape (order + 1) x nFrames
function polyFeatures(
  samples: Float32Array,
  sampleRate?: number,
  nFft?: number,
  hopLength?: number,
  order?: number
): Matrix2dResult

// Zero crossing rate
function zeroCrossingRate(
  samples: Float32Array,
  sampleRate?: number,  // default: 22050
  frameLength?: number,
  hopLength?: number
): Float32Array

// Sample indices where the waveform crosses zero
function zeroCrossings(
  samples: Float32Array,
  threshold?: number,
  refMagnitude?: boolean,
  pad?: boolean,
  zeroPos?: boolean
): Int32Array

// RMS energy
function rmsEnergy(
  samples: Float32Array,
  sampleRate?: number,  // default: 22050
  frameLength?: number,
  hopLength?: number
): Float32Array
```

### Waveform Peaks <Badge type="info" text="WASM/Node" />

Per-channel min/max buckets for drawing a waveform overview without shipping the full sample array to the UI. `samplesPerBucket` sets the bucket width (default 512); `waveformPeakPyramid` returns one report per zoom level.

```typescript
function waveformPeaks(
  samples: Float32Array,   // interleaved when channels > 1
  channels: number,
  options?: { samplesPerBucket?: number },  // default 512
): WaveformPeaksReport

function waveformPeakPyramid(
  samples: Float32Array,
  channels: number,
  options?: { samplesPerBucketLevels?: number[] },  // default [512, 1024, 2048, 4096]
): WaveformPeaksReport[]

interface WaveformPeaksReport {
  min: Float32Array;        // channel-major
  max: Float32Array;        // channel-major
  channels: number;
  bucketCount: number;
  samplesPerBucket: number;
}
```

### CQT, VQT, NNLS chroma, inverse features, and loudness

These functions are not just "more features"; they solve different modeling problems:

| Need | Use | Why |
|------|-----|-----|
| Log-frequency pitch representation | `cqt(...)`, `pseudoCqt(...)`, `hybridCqt(...)` | Constant-Q bins align well with musical pitch over octaves; pseudo/hybrid variants trade accuracy and speed across bins. |
| Variable bandwidth pitch representation | `vqt(...)` | Like CQT, but with a bandwidth offset for low-frequency stability. |
| Chord-friendly chroma | `chromaCqt(...)`, `nnlsChroma(...)`, `chromaCens(...)`, `bassChroma(...)` | Constant-Q, NNLS, CENS, and low-register chroma variants can be cleaner for chord or bass-register work than plain STFT chroma. |
| Spectral shape detail | `spectralContrast(...)`, `polyFeatures(...)`, `zeroCrossings(...)`, `onsetStrengthMulti(...)` | Librosa-compatible contrast bands, polynomial coefficients, zero-crossing indices, and multi-band onset strength. |
| Pitch/tuning offset | `pitchTuning(...)`, `estimateTuning(...)` | Estimate tuning in fractions of a bin from detected frequencies or directly from audio. |
| Decomposition and remixing | `decompose(...)`, `decomposeWithInit(...)`, `decomposeStems(...)`, `decomposeStemsLinked(...)`, `nnFilter(...)`, `remix(...)`, `remixAlignedIntervals(...)`, `phaseVocoder(...)`, `hpssWithResidual(...)` | NMF factorization, selectable NMF initialization, mono and linked multichannel stem output, nearest-neighbor filtering, interval remixing, channel-consistent cut points, time scaling, and HPSS residual output. |
| Reconstruct approximate audio/features | `melToStft`, `melToAudio`, `mfccToMel`, `mfccToAudio`, `cqtToAudio`, `vqtToAudio` | Griffin-Lim based inverse paths for visualization, debugging, and feature round-trips. CQT/VQT inputs are magnitude matrices. |
| Delivery loudness measurements | `lufs`, `lufsInterleaved`, `momentaryLufs`, `shortTermLufs`, `ebur128LoudnessRange` | ITU-R BS.1770 / EBU R128 style loudness values, including multichannel integrated loudness and LRA (loudness range — how much the loudness varies over the program). |

```typescript
const cqtResult = cqt(samples, sampleRate, 512, 32.7, 84, 12);
const vqtResult = vqt(samples, sampleRate, 512, 32.7, 84, 12, -1);
const pseudo = pseudoCqt(samples, sampleRate);
const hybrid = hybridCqt(samples, sampleRate);
const cqtChroma = chromaCqt(samples, sampleRate);
const nnls = nnlsChroma(samples, sampleRate, { hopLength: 512 });
const cens = chromaCens(samples, sampleRate);
const bass = bassChroma(samples, sampleRate);
const loudness = lufs(samples, sampleRate);

const contrast = spectralContrast(samples, sampleRate);
const poly = polyFeatures(samples, sampleRate);
const crossings = zeroCrossings(samples);
const onsetBands = onsetStrengthMulti(samples, sampleRate);
const tuning = estimateTuning(samples, sampleRate);
const offset = pitchTuning(pitch.f0);
const { w, h } = decompose(spectrogram, nFeatures, nFrames, 8);
const warmStarted = decomposeWithInit(spectrogram, nFeatures, nFrames, 8, 50, 2.0, 'nndsvd');
const filtered = nnFilter(spectrogram, nFeatures, nFrames);
const remixed = remix(samples, Int32Array.from([0, sampleRate, sampleRate, 2 * sampleRate]));
const stretched = phaseVocoder(samples, sampleRate, 1.5);
const hpssResidual = hpssWithResidual(samples, sampleRate);
const multichannel = lufsInterleaved(interleavedStereo, 2, sampleRate);
const lra = ebur128LoudnessRange(samples, sampleRate);
const reconstructed = melToAudio(mel.power, mel.nMels, mel.nFrames, sampleRate);
const cqtPreview = cqtToAudio(cqtResult.magnitude, cqtResult.nBins, cqtResult.nFrames, sampleRate, 512, 32.7, 12);
const vqtPreview = vqtToAudio(vqtResult.magnitude, vqtResult.nBins, vqtResult.nFrames, sampleRate, 512, 32.7, 12, 0, 32);
```

`chromaCqt(samples, sampleRate?, hopLength?, nChroma?)` is the direct
`librosa.feature.chroma_cqt` equivalent (log-frequency / constant-Q pitch
folding), while `nnlsChroma(samples, sampleRate?, options?)` is a distinct
note-activation chroma built on NNLS (non-negative least squares) that
suppresses harmonic leakage — often cleaner
for chord or bass-register work. Its `options.hopLength` defaults to `512`.

Closest CLI equivalents from the source-built C++ CLI:

```bash [C++ CLI]
sonare cqt song.wav
sonare vqt song.wav
sonare nnls-chroma song.wav
sonare lufs song.wav --json
sonare mel-to-audio song.wav -o mel-preview.wav
```

For reconstruction limits and parameter notes, see [Inverse Features](./inverse-features.md). For librosa-parity details, see [librosa Compatibility](./librosa-compatibility.md).

### `decomposeStems(request)` <Badge type="warning" text="Heavy" />

Factorize a recording with NMF into `nComponents` **unnamed** components and
return each one as **audio**, not as factors.

```typescript
function decomposeStems(request: DecomposeStemsRequest): DecomposeStemsResult

interface DecomposeStemsRequest {
  samples: Float32Array;
  sampleRate: number;
  nComponents?: number;   // default 4
  nFft?: number;          // default 2048
  hopLength?: number;     // default 512
  nIter?: number;         // default 100
  beta?: number;          // default 2 (Frobenius); 1 = Kullback-Leibler
  init?: 'random' | 'nndsvd';  // default 'random'
  maskPower?: number;     // default 1; must be >= 1
}

interface DecomposeStemsResult {
  components: Float32Array[];  // One signal per component, each the input's length
  w: Float32Array;             // [nBins x nComponents], row-major
  h: Float32Array;             // [nComponents x nFrames], row-major
  sampleRate: number;
}
```

This is the entry point to reach for when you want stems, and `decompose` is
not. `decompose` factorizes a **magnitude** spectrogram and hands back `w` and
`h`; magnitudes carry no phase, so turning a factor back into audio needs a phase
estimator, and what comes out is a reconstruction rather than a piece of the
recording. `decomposeStems` runs the same factorization but uses it to build a
per-component **soft mask**, which it applies to the **original complex**
spectrogram. Every component therefore keeps the source's own phase, and because
the masks sum to one wherever the model has energy and the inverse STFT is
linear, the components **sum back to the input**.

`maskPower` sets how hard the masks separate: `1` is the magnitude ratio, `2` is
the Wiener-style power ratio, which separates more aggressively at the cost of
more artefacts where partials overlap. Values in between are allowed; below `1`
is not.

Request-object form only — there is no positional overload. `nComponents` is
optional here and defaults to `4`, unlike `decompose`, where it is required.

**This is not HPSS.** The components carry no label: `components[1]` is whatever
repeating spectral pattern the factorization settled on, and which index a
voice or a kick lands in changes with `init`, `nIter` and the material, so
audition them to learn what each holds. `hpss` and `hpssWithResidual` on
[Audio Effects](./js-api-effects.md) answer a different question — they split by
median filtering into exactly two **labelled** parts, harmonic and percussive
(plus the residual). Reach for HPSS when the question is "sustained versus
struck"; reach for `decomposeStems` when it is "which recurring patterns make up
this recording".

::: warning NNDSVD seeding is computed in double precision
With `init: 'nndsvd'`, the SVD warm start is computed in double precision. This
is what makes the seed **reproducible**: a magnitude spectrogram's trailing
singular vectors sit right at single precision's noise floor, so a float seed
depends on the order the target happened to sum in, and two platforms answer with
different components for the same input. Double precision removes that
dependence.

It is a reproducibility property, not an accuracy one — shapes, non-negativity
and reconstruction quality are unchanged. But the factors themselves are not the
same numbers a float seed produced. If you have **stored `w`/`h` matrices**, or
you are diffing a stem render against one you rendered earlier, expect them to
differ; re-derive stored factors rather than assuming a mismatch is a bug. The
same applies to `decomposeWithInit(..., 'nndsvd')` and `decomposeStemsLinked(...)`.
:::

### `decomposeStemsLinked(request)` <Badge type="warning" text="Heavy" />

Use this form for a multichannel recording when every channel must use one shared
separation while keeping its own stereo image.

```typescript
function decomposeStemsLinked(
  request: DecomposeStemsLinkedRequest,
): DecomposeStemsLinkedResult

interface DecomposeStemsLinkedRequest {
  channels: Float32Array[];  // at least one, all the same length, at most 64
  sampleRate?: number;       // default 22050
  nComponents?: number;      // default 4
  nFft?: number;             // default 2048
  hopLength?: number;        // default 512
  nIter?: number;            // default 100
  beta?: number;             // default 2 (Frobenius); 1 = Kullback-Leibler
  init?: 'random' | 'nndsvd';  // default 'random'
  maskPower?: number;        // default 1; must be >= 1
}

interface DecomposeStemsLinkedResult {
  components: Float32Array[][];  // components[k][c], each input-length
  w: Float32Array;                // [nBins x nComponents], row-major
  h: Float32Array;                // [nComponents x nFrames], row-major
  sampleRate: number;
}
```

The function averages channel magnitudes to fit one NMF model and one set of
soft masks. It applies each mask unchanged to each channel's original complex
spectrogram, so interchannel level and phase differences stay in place. Pass at
least one same-length channel and no more than 64 channels. `w` and `h` describe
the shared factorization. With one channel, this result is bit-identical to
`decomposeStems(...)` with the same options. All NMF option defaults match
`decomposeStems(...)`.

### `remixAlignedIntervals(...)`

Resolve one set of cut points from one signal so the **same** cuts can be applied
to every channel.

```typescript
function remixAlignedIntervals(request: RemixRequest): Int32Array
function remixAlignedIntervals(
  samples: Float32Array,
  intervals: Int32Array | ArrayLike<number>,  // flat (start, end) pairs
  sampleRate?: number,     // default 22050
  alignZeros?: boolean,    // default true
): Int32Array
```

Zero-crossing snapping is a **per-signal** decision: a cut point nudged to the
nearest zero crossing lands on a different sample in the left channel than in the
right, because the two channels cross zero at different times. Calling `remix`
channel by channel with `alignZeros` therefore snaps each channel to its own
frame and drifts a stereo take apart — a small, cumulative desync that is hard to
spot until it is in the master. `remixAlignedIntervals` returns the snapped
`(start, end)` pairs as a flat `Int32Array` instead of audio, so you resolve them
once against one channel and then hand the identical list to `remix` for each
channel with `alignZeros: false`.

Note the defaults differ on purpose: `remix` has `alignZeros` **`false`**, while
`remixAlignedIntervals` has it **`true`** — snapping is the reason this function
exists. Two guards keep the snap safe: a signal with no sign change at all is not
snapped, and a slice that would collapse to empty keeps its unsnapped boundaries.

```typescript
const cuts = Int32Array.from([0, sampleRate, 2 * sampleRate, 3 * sampleRate]);
const aligned = remixAlignedIntervals(left, cuts, sampleRate);
const outLeft = remix(left, aligned, sampleRate, false);
const outRight = remix(right, aligned, sampleRate, false);
```

### Pitch Detection <Badge type="info" text="Medium" />

```typescript
// YIN algorithm
function pitchYin(
  samples: Float32Array,
  sampleRate?: number,   // default: 22050
  frameLength?: number,  // default: 2048
  hopLength?: number,    // default: 512
  fmin?: number,         // default: 65 Hz
  fmax?: number,         // default: 2093 Hz
  threshold?: number,    // default: 0.1
  fillNa?: boolean       // retained for compatibility; YIN always returns finite f0
): PitchResult

// pYIN algorithm (probabilistic YIN with HMM smoothing)
function pitchPyin(
  samples: Float32Array,
  sampleRate?: number,   // default: 22050
  frameLength?: number,
  hopLength?: number,
  fmin?: number,
  fmax?: number,
  threshold?: number,
  fillNa?: boolean       // default: false; true writes 0 for unvoiced f0 frames
): PitchResult

interface PitchResult {
  f0: Float32Array;
  voicedProb: Float32Array;
  voicedFlag: boolean[];
  nFrames: number;
  medianF0: number;
  meanF0: number;
}
```

YIN returns a finite estimate for every frame, including frames marked unvoiced by `voicedFlag`.

pYIN keeps `NaN` for unvoiced frames by default. Set its `fillNa: true` when a downstream numeric pipeline should use `0` instead.


## Notes and struck sounds

These four sit between analysis and editing: each measures something the audio
does not state, and hands back an object a host edits and renders.

### `analyzePolyphonic(request)` <Badge type="warning" text="Heavy" />

```typescript
function analyzePolyphonic(request: AnalyzePolyphonicRequest): PolyphonicAnalysis
```

Separates the notes of a chord so one of them can be edited and the rest left
alone. It returns a **handle, not a result**: the analysis owns the source's
complex spectrogram plus the bins each note claimed, which is the input again
plus the claims, and keeping it is what makes re-rendering an edit free.

`destroy()` it as soon as you are done. Using it afterwards throws
`InvalidState` rather than reaching a freed object. What crosses into JavaScript
is only what a host acts on — the notes, each note's pending edit, the per-frame
voice count, and per note a pitch, a level and a salience curve. The
spectrogram, the masks and the per-bin weights never do, and no method reports a
per-bin figure.

`sampleRate` is required rather than defaulted: every duration in the chain is
converted to samples with it, so a wrong value analyses differently without
failing.

### `decomposeNotePitch(request)`

```typescript
function decomposeNotePitch(request: DecomposeNotePitchRequest): PitchDecompositionResult
```

Splits one note's pitch curve into the three things it carries at once: the
centre that was aimed at, the slow wander around it, and the periodic
oscillation on top. Editing any one of them needs them separated first.

`vibratoCutoffHz` is the only thing deciding where drift ends and vibrato
begins. **Hand the same cutoff to `renderNotes`**, or it edits a curve nobody was
shown.

Frames whose F0 is unusable carry no measurement, so the curve is held at the
nearest usable neighbour across them; both curves therefore have an entry
everywhere, and a host marking the held ones reads them off `f0Hz`. A note with
no usable pitch comes back as a zero `centreHz` and two empty curves — that is a
measurement that came up empty, not a bad argument.

### `extractPercussiveEvents(request)` and `renderPercussiveEvents(request)`

```typescript
function extractPercussiveEvents(request: ExtractPercussiveEventsRequest): PercussiveEvent[]
function renderPercussiveEvents(request: RenderPercussiveEventsRequest): Float32Array
```

A pair. The first locates struck sounds in audio alone — each event is a span in
source samples, its detector strength, the percussive peak over the span, the
share of the span's energy the separation called percussive, and an identity
edit. Edit the events, hand them to the second, and get the audio back. **The
source is never mutated, and a set whose edits are all identity renders back to
the input.**

Both take the same separation options, and both need `sampleRate` for the same
reason: it converts `maxEventMs` and `fadeMs` into samples.

Two defaults are worth knowing. `minPercussiveRatio` defaults to `0`, which
means keep everything; raising it helps on material that is mostly drums and
hurts on a dense mix, where it also drops real hits sitting over a loud sustain.
`fadeMs` defaults to 5 ms and shapes the signal being **subtracted**, so there is
no way to ask for a hard cut — squaring it off would leave a step. There is
deliberately no matching fade-in: a span opens in front of its transient where
the percussive component is near-silent.

The separation's median kernels must be odd and positive; an even one is
rejected rather than rounded. `1` is legal and degenerate — a length-1 median is
the identity, so both components come back as the source.
