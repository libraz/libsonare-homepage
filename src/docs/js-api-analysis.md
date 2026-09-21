---
title: JavaScript/TypeScript Analysis API
description: Analysis functions, feature extraction, scale quantization, unit conversion, librosa-compatible helpers, and resampling in the libsonare JavaScript/TypeScript package.
---

# JavaScript/TypeScript Analysis API

## Analysis Functions

### `detectBpm(samples, sampleRate)`

Detect BPM (tempo) from audio samples.

::: info Use Cases
- **DJ Software**: Match tempos between tracks for seamless mixing
- **Music Players**: Display tempo information, auto-generate playlists by tempo
- **Fitness Apps**: Match music to workout intensity
- **Beat Sync**: Synchronize visualizations or animations to music
:::

```typescript
function detectBpm(samples: Float32Array, sampleRate?: number): number
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `samples` | `Float32Array` | Mono audio samples (range -1.0 to 1.0) |
| `sampleRate?` | `number` | Sample rate in Hz (default: 22050; e.g., 44100) |

::: warning Always pass the real sample rate
Although `sampleRate` is optional here (defaulting to 22050 Hz), decoded browser audio is almost always 44100 or 48000 Hz. Pass the buffer's actual `audioBuffer.sampleRate`, or the reported BPM will be wrong. The same holds for `detectKey`, `detectBeats`, and `analyze`: their `sampleRate` is optional with the same 22050 Hz default, so pass the real rate to those as well.
:::

**Returns:** Detected BPM as a number.

```typescript
const bpm = detectBpm(samples, sampleRate);
console.log(`BPM: ${bpm}`);  // "BPM: 120"
```

### `detectKey(samples, sampleRate)`

Detect musical key from audio samples. Returns the root note (C, D, E...) and mode (major/minor).

::: info Use Cases
- **Harmonic Mixing**: DJs match keys for smooth transitions (Camelot wheel)
- **Transposition**: Suggest key changes to match vocal range
- **Music Recommendation**: Find songs in compatible keys
- **Practice Tools**: Display key for musicians to play along
:::

```typescript
function detectKey(samples: Float32Array, sampleRate?: number): Key  // sampleRate default: 22050
```

**Returns:** `Key` object

```typescript
interface Key {
  root: PitchClass;      // 0-11 (C=0, B=11)
  mode: Mode;            // Major, Minor, or modal value; see Mode enum
  confidence: number;    // posterior share in [0, 1); see below
  name: string;          // "C major", "A minor"
  shortName: string;     // "C", "Am"
}

const KeyProfile = {
  KrumhanslSchmuckler: 0,
  Temperley: 1,
  Shaath: 2,
  FaraldoEDMT: 3,
  FaraldoEDMA: 4,
  FaraldoEDMM: 5,
  BellmanBudge: 6,
} as const;
```

```typescript
const key = detectKey(samples, sampleRate);
console.log(`Key: ${key.name}`);        // "C major"
console.log(`Confidence: ${(key.confidence * 100).toFixed(1)}%`);
```

::: warning What `confidence` measures
`confidence` is a **softmax over every scored candidate's profile correlation**.
Its range is `[0, 1)`, all candidates' confidences sum to `1`, and with 24
candidates in the set no single share can reach `1` — a decisive result looks
like `0.3`, not `0.95`.

It says how sharply the chroma picked one candidate out of the set, **not how
often that pick is right**: nothing here is calibrated against annotated
recordings, so a high share on a modally ambiguous piece is a confident wrong
answer, not a reliable one. Compare shares against each other rather than
against a fixed threshold you carried over from a calibrated classifier.

`KeyCandidate.key.confidence` carries the same posterior share, while
`KeyCandidate.correlation` stays the raw profile correlation the softmax was
computed from.
:::

### `detectBeats(samples, sampleRate)`

Detect beat times from audio samples. Returns exact timestamps of each beat.

::: info Use Cases
- **Music Visualization**: Trigger effects on each beat
- **Rhythm Games**: Generate note charts from audio
- **Video Editing**: Auto-cut to the beat
- **Loop Creation**: Find perfect loop points
:::

```typescript
function detectBeats(samples: Float32Array, sampleRate?: number): Float32Array  // sampleRate default: 22050
```

**Returns:** Float32Array of beat times in seconds

```typescript
const beats = detectBeats(samples, sampleRate);
console.log(`Found ${beats.length} beats`);
for (let i = 0; i < beats.length; i++) {
  console.log(`Beat ${i + 1}: ${beats[i].toFixed(3)}s`);
}
```

### `detectOnsets(samples, sampleRate)`

Detect onset times (note attacks) from audio samples. More granular than beats - captures every note/hit.

::: info Use Cases
- **Drum Transcription**: Detect individual drum hits
- **Audio-to-MIDI**: Convert audio to note events
- **Sample Slicing**: Automatically segment audio at transients
:::

```typescript
function detectOnsets(samples: Float32Array, sampleRate?: number): Float32Array  // sampleRate default: 22050
```

**Returns:** Float32Array of onset times in seconds

### `analyze(samples, sampleRate)` <Badge type="warning" text="Heavy" />

Perform the all-in-one music analysis. Returns BPM, key, beats, chords, sections, timbre, and more.

::: info Use Cases
- **Music Library Management**: Auto-tag songs with metadata
- **Music Production**: Analyze reference tracks
- **DJ Preparation**: Get all track info at once
- **Music Education**: Study song structure
:::

::: tip Performance
This is the heaviest API. For long audio files (>3 minutes), consider using `analyzeWithProgress` to show progress, or analyze only relevant segments.
:::

```typescript
function analyze(request: MusicAnalyzeRequest): AnalysisResult
function analyze(
  samples: Float32Array,
  sampleRate?: number,             // default 22050
  options?: MusicAnalyzeOptions,
): AnalysisResult

interface MusicAnalyzeOptions {
  // Framing
  nFft?: number;                   // default 2048
  hopLength?: number;              // default 512

  // Tempo and beats
  bpmMin?: number;                 // default 60
  bpmMax?: number;                 // default 200
  startBpm?: number;               // default 120
  adaptiveTempo?: boolean;         // track a local tempo prior; default false
  tempoUpdateIntervalBeats?: number; // local tempo context, in beats; default 8
  computeTempoCurve?: boolean;     // fill beatLocalBpm; default false

  // Meter
  meterCandidateNumerators?: number[]; // default [3, 4, 6]; 1-16 entries, each 2-32
  meterDenominator?: number;       // default 4; a power of two in [1, 32]

  // Chroma and chords
  useTriadsOnly?: boolean;         // default true here; see below
  useHpss?: boolean;               // default true
  chromaHighpassHz?: number;       // default 80; 0 disables
  useBassWeighted?: boolean;       // default true
  chromaHopMultiplier?: number;    // default 4
  useChordHmm?: boolean;           // default false
  useChordKeyContext?: boolean;    // default false
  chordHmmBeamWidth?: number;      // default 24
  detectChordInversions?: boolean; // default false
}
```

**Returns:** Complete `AnalysisResult`. A single `analyze()` call returns the
full result — chords, sections, timbre, dynamics, rhythm, melody, form, and
per-beat strength — on every binding, so you rarely need the focused helpers
unless you only want one field.

::: warning `useTriadsOnly` defaults to `true` in `analyze()`
The unified path defaults `useTriadsOnly` to **`true`** even though the
standalone chord API defaults it to `false`. Until you pass
`useTriadsOnly: false`, `analyze()` searches triads alone — a seventh chord
comes back as the triad inside it, and a result that looks harmonically flat next
to `detectChords()` on the same audio is usually this and not a detection
failure.
:::

`meterCandidateNumerators` **widens the search, it does not force the result**:
the estimator still has to find support for a numerator before reporting it. But
the reverse holds absolutely — a numerator you did not ask for cannot be
reported, so a 5/4 or 7/8 piece analysed with the default `[3, 4, 6]` comes back
as a four. `meterDenominator` is reported as requested; the estimator will still
report `8` on its own when it resolves a compound meter.

`computeTempoCurve` is the switch that fills `beatLocalBpm`, and it is off
because the curve is an extra output rather than a refinement. The curve
describes the beat grid it was decoded from, so a track whose tempo genuinely
drifts wants `adaptiveTempo` as well — otherwise you get a local reading of a
grid that was laid down at a fixed tempo.

```typescript
const result = analyze(samples, sampleRate);
console.log(`BPM: ${result.bpm}`);
console.log(`Key: ${result.key.name}`);
console.log(`Chords: ${result.chords.length}`);
console.log(`Form: ${result.form}`);  // e.g., "IABABCO"
```

### `analyzeWithProgress(samples, sampleRate, onProgress)` <Badge type="warning" text="Heavy" />

Perform the same all-in-one analysis with progress reporting.

```typescript
function analyzeWithProgress(
  samples: Float32Array,
  sampleRate: number | undefined,  // undefined applies the 22050 default
  onProgress: (progress: number, stage: string) => void
): AnalysisResult
```

`sampleRate` is positional (before the callback) but accepts `undefined`, which uses the same 22050 Hz default as `analyze`. Pass the buffer's real rate.

**Progress Stages:**

| Stage | Description | Progress |
|-------|-------------|----------|
| `"features"` | Feature precomputation | 0.0 |
| `"bpm"` | BPM detection | 0.15 |
| `"key"` | Key detection | 0.15 |
| `"beats"` | Beat tracking | 0.25 |
| `"chords"` | Chord recognition | 0.40 |
| `"sections"` | Section detection | 0.55 |
| `"timbre"` | Timbre analysis | 0.70 |
| `"dynamics"` | Dynamics analysis | 0.80 |
| `"rhythm"` | Rhythm analysis | 0.90 |
| `"melody"` | Melody contour extraction | 0.95 |
| `"complete"` | Finished | 1.0 |

```typescript
const result = analyzeWithProgress(samples, sampleRate, (progress, stage) => {
  console.log(`${stage}: ${Math.round(progress * 100)}%`);
});
```

### Focused analysis helpers

::: tip One call is usually enough
`analyze()` already returns chords, sections, timbre, dynamics, rhythm, melody, form, and per-beat strength. Reach for a focused helper only when you want a single field or need options the high-level call hides.
:::

Use the focused helpers when the default `analyze(...)` result is either too broad or not detailed enough. They share the same mono `Float32Array` input model but expose options that are hidden by the high-level call.

| Task | Function | Notes |
|------|----------|-------|
| Downbeat/bar starts | `detectDownbeats(samples, sampleRate)` | Returns seconds for likely bar starts. Pair with `detectBeats` for grid displays. |
| Ranked key candidates | `detectKeyCandidates(samples, sampleRate, options?)` | Useful when the top key is ambiguous or when you want profile/mode filtering. |
| Detailed tempo candidates | `analyzeBpm(samples, sampleRate, ...)` | Returns the best BPM plus alternate candidates and tempo evidence. |
| Rhythm character | `analyzeRhythm(samples, sampleRate, ...)` | Reports groove, syncopation, and regularity style features. |
| Dynamics | `analyzeDynamics(samples, sampleRate, ...)` | Dynamic range, loudness range, crest factor, and compression flag. |
| Timbre | `analyzeTimbre(samples, sampleRate, ...)` | Brightness, warmth, density, roughness, and complexity. |
| Chords | `detectChords(samples, sampleRate, options?)` | Returns `{ chords }` of chord segments; options include HMM smoothing, key context, inversions, and `chromaMethod: 'stft' \| 'nnls'`. |
| Sections | `analyzeSections(samples, sampleRate, ...)` | Song-structure sections such as intro, verse, chorus, bridge, and outro. Long inputs keep accurate `start` / `end` times even when the internal boundary grid is pooled. |
| Structural boundaries | `detectBoundaries(request)` | The transitions alone, plus the novelty curve they were picked from. Use it when you want to apply your own threshold. |
| Melody | `analyzeMelody(samples, sampleRate, ...)` | Monophonic melody contour based on pitch tracking. |

```typescript
const keys = detectKeyCandidates(samples, sampleRate, {
  modes: [Mode.Major, Mode.Minor],
  profile: 'krumhansl',
  genreHint: 'pop',
});

const { chords } = detectChords(samples, sampleRate, {
  useHmm: true,
  useKeyContext: true,
  keyRoot: keys[0].key.root,
  keyMode: keys[0].key.mode,
  chromaMethod: 'nnls',
});

const sections = analyzeSections(samples, sampleRate);
```

### `detectBoundaries(request)`

Where `analyzeSections` hands back labelled spans, `detectBoundaries` hands back
the transitions themselves *and* the novelty curve they were picked from. That
curve is the reason to reach for this one: a caller that wants its own threshold
cannot recover it from a list of finished sections.

```typescript
const { boundaries, noveltyCurve, noveltyPeak, sampleRate: gridRate } =
  detectBoundaries({ samples, sampleRate: 44100 });

for (const { time, strength } of boundaries) {
  console.log(`${time.toFixed(2)}s  ${strength.toFixed(3)}`);
}
```

| Option | Default | Description |
|--------|---------|-------------|
| `sampleRate` | 22050 | Sample rate of `samples` |
| `nFft` | 2048 | FFT size for the structural features |
| `hopLength` | 512 | Hop length in samples |
| `kernelSize` | 64 | Checkerboard kernel size, in frames |
| `threshold` | 0.3 | Relative novelty threshold, applied *after* the curve is scaled by its own maximum |
| `absoluteThreshold` | 0.005 | Novelty floor applied to the raw response *before* that scaling |
| `nMfcc` | 13 | Number of MFCC coefficients |
| `nChroma` | 12 | Number of chroma bins |
| `peakDistance` | 2.0 | Minimum spacing between peaks, in seconds |
| `useMfcc` | `true` | Use MFCC features |
| `useChroma` | `true` | Use chroma features |

::: tip The two thresholds do different jobs
`threshold` asks how prominent a peak is *within this track*; because the curve
is scaled by its own maximum first, it says nothing about how much the features
actually changed. `absoluteThreshold` is the floor that asks whether anything
changed at all. Setting it to `0` does not make the detector more sensitive in a
useful way — self-scaling turns residual fluctuation into peaks of 1.0, so a
stationary input then segments anyway.

Lowering the floor also will not recover level-only structure. A level change
turns the feature vector about five times less than a comparable pitch change,
which lands it below what steady noise produces, so the noise is admitted first.
:::

The result carries the grid it was measured on, not the source's: input above
22050 Hz is resampled before any feature is computed, so `boundary.frame` is
uninterpretable without the returned `sampleRate`, `hopLength`, `nFrames`, and
`frameStride`. Use `boundary.time` for sample or second mapping either way.
`noveltyCurve` is scaled by its own maximum; recover the raw response with
`noveltyCurve[i] * noveltyPeak`.

Passing `useMfcc: false` together with `useChroma: false` throws
`SonareError` with `InvalidParameter`: the two feature streams are combined
frame for frame, so with neither enabled there is nothing to combine.

### `estimateMeter(request)`

Score a beat series against a set of candidate time signatures and report the
winner, the phase of the first measure, and how the measure divides internally.
It takes beats and accents rather than audio, so it runs on a grid you already
have — from `analyze()`, from a DAW, or from a tapped tempo — without a second
pass over the samples. For what a meter is and how grouping differs from a time
signature, see [Meter and grouping](./glossary/analysis/meter-and-grouping.md).

```typescript
function estimateMeter(request: EstimateMeterRequest): MeterEstimate

interface EstimateMeterRequest {
  beatTimes: ArrayLike<number>;      // Beat positions in seconds, non-decreasing
  beatStrengths: ArrayLike<number>;  // One accent value per beat, same length
  candidateNumerators?: number[];    // default [3, 4, 6]; 1-16 entries, each 2-32
  denominator?: number;              // default 4; a power of two in [1, 32]
  downbeatWeight?: number;           // default 1
  measureWeight?: number;            // default 0.5
  subdivisionWeight?: number;        // default 0.15
  compoundSubdivisionThreshold?: number;  // default 0.85
}

interface MeterEstimate {
  timeSignature: TimeSignature;   // The selected signature
  downbeatPhase: number;          // Beat index the first measure starts on
  searched: boolean;              // false when the series was too short to score
  grouping: number[];             // Beats per accent group; sums to the numerator
  candidateScores: number[];      // One score per requested numerator, in order
  candidates: TimeSignature[];    // Signatures ranked by descending support
}
```

There is no positional form — `estimateMeter` takes a request object only. The
accent series is divided by its own maximum, so it needs no pre-scaling;
`AnalysisResult.beatObservations.onsetStrength` is the intended source, and
`beats[].strength` works but is the raw single-frame value described under
[Beat](./js-api-types.md#beat).

::: warning An odd meter is only reported if you asked for its numerator
The default candidate set is `{3, 4, 6}`. A numerator outside the set cannot win,
so a 5/4 or 7/8 piece analysed with the defaults comes back as a four with no
indication that the right answer was never on the ballot. Widening the set does
not force an odd reading — the estimator still needs support for it — so pass the
numerators your material might actually use.
:::

::: warning `searched: false` means every other field is a fallback
When the beat series holds **fewer than eight beats**, there is not enough to
score any candidate and the estimator returns a fixed fallback instead of a
result: `4/<requested denominator>`, `downbeatPhase` `0`, `grouping` `[4]`,
all-zero `candidateScores`, and a single-entry `candidates`.

**`timeSignature.confidence` is part of the fallback** — it reads `0.5`, which is
a constant and not a measurement. Check `searched` before you show a confidence
or branch on one; a `0.5` from a too-short series is indistinguishable by value
from a genuinely middling score. An empty `beatTimes` throws rather than falling
back; one to seven beats returns the fallback.
:::

`grouping` is where an aksak meter shows itself: `[3, 2, 2]` is a 7/8 grouped
three-two-two, while `[2, 2]` is an ordinary four. A **single** entry means no
internal division was resolved — either the numerator has none, or the measure
was too wide to search, or the series was too short — so `[4]` and `[2, 2]` are
different answers, not two spellings of one.

`candidateScores` and `candidates` are **not** indexed alike, and mixing them up
is the easy mistake here. `candidateScores[k]` is the score of the k-th
*requested* numerator, in the order you passed them; `candidates[k]` is the k-th
*best* hypothesis, ordered by descending support. The scores are standardized and
signed — zero is the no-meter level and a negative score sits below the noise —
and they grow with the square root of the number of beats scored, so compare them
within one result, never across two.

### `chordFunctionalAnalysis(samples, keyRoot, keyMode, sampleRate?, options?)`

Functional (Roman-numeral) harmonic analysis of the detected chord progression,
relative to the given key. It runs chord detection internally and labels each
detected chord, so pass the same `keyRoot`/`keyMode` you get from `detectKey(...)`
and the same `options` you would give `detectChords(...)`.

```typescript
function chordFunctionalAnalysis(
  samples: Float32Array,
  keyRoot: PitchClass,
  keyMode?: Mode,
  sampleRate?: number,
  options?: ChordDetectionOptions,
): string[]   // one Roman-numeral label per detected chord, e.g. ["I", "IV", "V", "vi"]
```

```typescript
const key = detectKey(samples, sampleRate);
const roman = chordFunctionalAnalysis(samples, key.root, key.mode, sampleRate);
console.log(roman);  // e.g. ["I", "IV", "V", "vi"]
```

`detectKey(...)` and `detectKeyCandidates(...)` accept the same
`KeyDetectionOptions` includes:

| Option group | Values |
|--------------|--------|
| Controls | `modes`, `profile`, `genreHint`, `useHpss`, `loudnessWeighted`, `highPassHz` |
| Profile names | `ks`, `krumhansl`, `temperley`, `shaath`, `keyfinder`, `faraldo-edmt` / `edmt`, `faraldo-edma` / `edma`, `faraldo-edmm` / `edmm`, `bellman-budge` / `bellman` |
| Genre hints | `auto`, `edm`, `electronic`, `dance`, `pop`, `classical`, `jazz` |

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
| Decomposition and remixing | `decompose(...)`, `decomposeWithInit(...)`, `decomposeStems(...)`, `nnFilter(...)`, `remix(...)`, `remixAlignedIntervals(...)`, `phaseVocoder(...)`, `hpssWithResidual(...)` | NMF factorization, selectable NMF initialization, mask-based stem output, nearest-neighbor filtering, interval remixing, channel-consistent cut points, time scaling, and HPSS residual output. |
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

Factorize a recording and return the components as **audio**, not as factors.

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
same applies to `decomposeWithInit(..., 'nndsvd')`.
:::

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

## Scale Quantization

12-TET (twelve-tone equal temperament) scale helpers for building pitch-correction targets. `modeMask` is a 12-bit mask where bit *i* enables the *i*-th pitch class relative to `root` (a `PitchClass`, C = 0); natural major is `0b101010110101`. `referenceMidi` is the tuning anchor (pass `0` for A4 = 69).

```typescript
// Snap a (possibly fractional) MIDI number to the nearest enabled pitch class
function scaleQuantizeMidi(root: number, modeMask: number, midi: number, referenceMidi?: number): number
// Correction (quantized − input), in semitones
function scaleCorrectionSemitones(root: number, modeMask: number, midi: number, referenceMidi?: number): number
// Is pitchClass (0..11) enabled by modeMask relative to root?
function scalePitchClassEnabled(root: number, modeMask: number, pitchClass: number): boolean
```

Pair `scaleQuantizeMidi(...)` with `pitchCorrectToMidi(...)` to retune a detected note to the nearest scale degree.

## Unit Conversion

These functions are lightweight and fast.

```typescript
// Hz <-> Mel (Slaney formula)
function hzToMel(hz: number): number
function melToHz(mel: number): number

// Hz <-> MIDI note number (A4 = 440 Hz = 69)
function hzToMidi(hz: number): number
function midiToHz(midi: number): number

// Hz <-> Note name
function hzToNote(hz: number): string      // "A4", "C#5"
function noteToHz(note: string): number

// Time <-> Frames
function framesToTime(frames: number, sr: number, hopLength: number): number
function timeToFrames(time: number, sr: number, hopLength: number): number

// Frames <-> Samples (librosa.frames_to_samples / samples_to_frames)
function framesToSamples(frames: number, hopLength?: number, nFft?: number): number
function samplesToFrames(samples: number, hopLength?: number, nFft?: number): number

// dB conversions (vectorised)
function powerToDb(values: Float32Array, ref?: number, amin?: number, topDb?: number): Float32Array
function amplitudeToDb(values: Float32Array, ref?: number, amin?: number, topDb?: number): Float32Array
function dbToPower(values: Float32Array, ref?: number): Float32Array
function dbToAmplitude(values: Float32Array, ref?: number): Float32Array
```

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

## Resampling

### `resample(samples, srcSr, targetSr)` <Badge type="info" text="Medium" />

High-quality resampling using r8brain algorithm.

```typescript
function resample(
  samples: Float32Array,
  srcSr: number,
  targetSr: number
): Float32Array
```
