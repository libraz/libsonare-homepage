---
title: JavaScript/TypeScript Analysis API
description: Analysis functions, scale quantization, unit conversion, and resampling in the libsonare JavaScript/TypeScript package. Feature extraction and librosa-compatible helpers live on their own pages.
---

# JavaScript/TypeScript Analysis API

This page covers the core analysis functions for the libsonare JavaScript/TypeScript package: BPM/key/beat/onset detection, the all-in-one `analyze()` call and its focused helpers, structural boundary and meter estimation, plus scale quantization, unit conversion, and resampling. Two related references live alongside it: [Feature Extraction](./js-api-features.md) covers STFT, mel/MFCC, chroma, spectral features, pitch detection, and the CQT/VQT/decomposition family, and [librosa-Compatible Helpers](./js-api-helpers.md) covers the argument-for-argument librosa ports for pre-emphasis, test-signal generation, spectral reconstruction, structure, segmentation, and tempograms.

## Where the sections went

| Section | Page |
|---|---|
| Feature Extraction | [Feature Extraction](./js-api-features.md) |
| librosa-Compatible Helpers | [librosa-Compatible Helpers](./js-api-helpers.md) |

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
