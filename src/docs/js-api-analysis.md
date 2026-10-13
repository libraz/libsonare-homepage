---
title: JavaScript/TypeScript Analysis API
description: Analysis functions, scale quantization, unit conversion, and resampling in the libsonare JavaScript/TypeScript package. Feature extraction and librosa-compatible helpers live on their own pages.
---

# JavaScript/TypeScript Analysis API

This page covers the core analysis functions for the libsonare JavaScript/TypeScript package: BPM/key/beat/onset detection, the all-in-one `analyze()` call and its focused helpers, structural boundary and meter estimation, and Roman-numeral chord analysis. Two related references live alongside it: [Feature Extraction](./js-api-features.md) covers STFT, mel/MFCC, chroma, spectral features, pitch detection, and the CQT/VQT/decomposition family, and [Helpers and Conversions](./js-api-helpers.md) covers the argument-for-argument librosa ports for pre-emphasis, test-signal generation, spectral reconstruction, structure, segmentation, and tempograms, along with scale quantization, unit conversion, resampling, and `chordFunctions`.

## Analysis Functions

### `detectBpm(samples, sampleRate)`

Detect BPM (tempo) from audio samples. For how the tempo is found and why half and double readings happen, see [Tempo and BPM](./glossary/analysis/tempo-bpm.md).

<SonareDemo id="beat-tracking" />

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

Detect musical key from audio samples. Returns the root note (C, D, E...), the mode (major, minor, or a church mode), and the tuning the chroma was built with. Background: [Key detection](./glossary/analysis/key-detection.md). The options (`profile`, `modes`, `genreHint` and the rest) are tabulated under [Key detection options](./js-api-helpers.md#key-detection-options).

```typescript
function detectKey(request: DetectKeyRequest): KeyDetection
function detectKey(
  samples: Float32Array,
  sampleRate?: number,             // default: 22050
  options?: DetectKeyOptions,
): KeyDetection
```

**Returns:** `KeyDetection` object

```typescript
type KeyMode = 'major' | 'minor' | 'dorian' | 'phrygian' | 'lydian' | 'mixolydian' | 'locrian';

interface Key {
  root: PitchClass;      // 0-11 (C=0, B=11)
  mode: KeyMode;         // a name, not a Mode ordinal
  confidence: number;    // posterior share in [0, 1); see below
  name: string;          // "C major", "A minor"
  shortName: string;     // "C", "Am"
}

interface KeyDetection extends Key {
  tuning: number;        // semitone fraction the chroma was built with
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
console.log(key.mode);                  // 'major'
```

`detectKey`, `detectKeyCandidates` and `analyze` report `mode` as a name, as the Node package does. `keyRoot` / `keyMode` of `detectChords` and `chordFunctionalAnalysis`, and the `key` of `chordFunctions`, take a pitch-class name (`'C#'`) or number and a mode name or a `Mode` ordinal (`Mode.Major` is `0`), so a detected key passes straight back; an unknown name is a `RangeError` naming the field. `modes` and `scaleMaskForMode` accept either spelling too.

The chroma is read at concert A440 unless `tuning` says otherwise. `tuning` is a semitone fraction in `[-0.5, 0.5)`, and `'auto'` measures it from the audio. The value used, given or measured, comes back as `KeyDetection.tuning`; `analyze()` and `detectChords()` report theirs the same way (`AnalysisResult.tuning`, `ChordAnalysisResult.tuning`). To work in Hz instead, see [`tuningToReferenceHz` and `referenceHzToTuning`](./js-api-helpers.md#unit-conversion).

```typescript
const { name, tuning } = detectKey(samples, sampleRate, { tuning: 'auto' });
```

::: warning What `confidence` measures
`confidence` is a **softmax over every scored candidate's profile correlation**.
Its range is `[0, 1)` and all candidates' confidences sum to `1`. A clean tonal
passage can read above 0.9, closely related keys split the share between them,
and silence reads about 1/24 for every candidate.

It says how sharply the chroma picked one candidate out of the set, **not how
often that pick is right**: nothing here is calibrated against annotated
recordings, so a high share on a modally ambiguous piece is a confident wrong
answer, not a reliable one. Compare the winner with the runner-up rather than
against a fixed threshold carried over from a calibrated classifier.

`KeyCandidate.key.confidence` carries the same posterior share, while
`KeyCandidate.correlation` stays the raw profile correlation the softmax was
computed from.
:::

### `detectBeats(samples, sampleRate)`

Detect beat times from audio samples. Returns exact timestamps of each beat. See [Beats and downbeats](./glossary/analysis/beats-downbeats.md).

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

Detect onset times (note attacks) from audio samples. More granular than beats: it captures every note or hit. See [Onset detection](./glossary/analysis/onset-detection.md).

```typescript
function detectOnsets(request: DetectOnsetsRequest): Float32Array
function detectOnsets(
  samples: Float32Array,
  sampleRate?: number,             // default: 22050
  options?: OnsetDetectOptions,
): Float32Array
```

**Returns:** Float32Array of onset times in seconds

| Option | Default | Meaning |
|---|---|---|
| `nFft` | 2048 | Window length in samples at 22050 Hz, rescaled to the input rate |
| `hopLength` | 512 | Hop in samples of the input |
| `threshold` | 0 | Minimum onset strength; `0` picks it adaptively |
| `preMax`, `postMax` | 1, 1 | Frames before and after a peak that must not exceed it |
| `preAvg`, `postAvg` | 3, 4 | Frames averaged before and after a peak for the adaptive floor |
| `delta` | 0.06 | Offset added to that average |
| `wait` | 1 | Minimum frames between two onsets |
| `backtrack` | `false` | Move each onset back to the preceding local minimum |
| `backtrackRange` | 10 | Farthest a backtrack may travel, in frames |

### `analyze(samples, sampleRate)` <Badge type="warning" text="Heavy" />

Perform the all-in-one music analysis. Returns BPM, key, beats, chords, sections, timbre, and more.

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
  nFft?: number;                   // default 2048; samples at 22050 Hz, see below
  hopLength?: number;              // default 512; samples of the input

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

  // Tuning
  tuning?: number | 'auto';        // default 0 (A440); semitone fraction in [-0.5, 0.5)
}
```

`nFft` is a window length in samples **at 22050 Hz** and is rescaled to the input rate, so the window covers the same duration at 44100 Hz or 48000 Hz; `hopLength` stays in samples of the input. The same holds for the tempo, beat, onset, key, rhythm, chord and timbre helpers, so results at different rates agree and 22050 Hz input is read as written. `tuning` shifts every chroma the analysis builds (key, chords, sections), and `'auto'` measures it; the value used is `result.tuning`.

**Returns:** Complete `AnalysisResult`. A single `analyze()` call returns the
full result — chords, sections, timbre, dynamics, rhythm, melody, form, and
per-beat strength — on every binding, so you rarely need the focused helpers
unless you only want one field. Chords in the result carry `romanNumeral`
relative to `result.key`; it is an empty string for `N.C.`.

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
reported, so a 5/4 or 7/8 piece analyzed with the default `[3, 4, 6]` comes back
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
function analyzeWithProgress(request: AnalyzeWithProgressRequest): AnalysisResult
function analyzeWithProgress(
  samples: Float32Array,
  sampleRate: number | undefined,  // undefined applies the 22050 default
  onProgress: (progress: number, stage: string) => void,
  options?: MusicAnalyzeOptions,
): AnalysisResult

interface AnalyzeWithProgressRequest {
  samples: Float32Array;
  sampleRate?: number;
  onProgress?: (progress: number, stage: string) => void;
  cancel?: () => boolean;          // return true to stop; the call throws
  options?: MusicAnalyzeOptions;   // the same fields and defaults as analyze()
}
```

`sampleRate` is positional (before the callback) but accepts `undefined`, which uses the same 22050 Hz default as `analyze`. Pass the buffer's real rate.

::: tip In the request form, options go beside `samples` or under `options`
`analyzeWithProgress({ samples, sampleRate, bpmMin: 90, bpmMax: 140 })` and `analyzeWithProgress({ samples, sampleRate, options: { bpmMin: 90, bpmMax: 140 } })` apply the same range, as in `analyze`. A field given both ways takes the `options` value, and a key that is not an analysis option throws a `TypeError` naming it. The call is synchronous, so it blocks the thread it runs on; in a page, run it through the [worker client](./wasm-advanced.md) to keep the UI painting.
:::

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

### `transcribe(request)`

`transcribe` turns mono audio into note-on/note-off `ProjectMidiEvent[]` on a constant-tempo PPQ grid. Pass `tempoBpm` to choose that grid, or omit it to detect the tempo. The result reports `noteCount` separately (always half `events.length`) and does not install a tempo map on a project.

```typescript
interface TranscribeRequest {
  samples: Float32Array;
  sampleRate: number;
  tempoBpm?: number;  // omit to detect
  polyphonic?: boolean;
  referenceHz?: number | 'auto';  // tuning reference in Hz; default 440, 'auto' measures it
  // Further optional detector settings: see the table below.
}

interface TranscribeResult {
  events: ProjectMidiEvent[];
  noteCount: number;
  tempoBpm: number;
  tuning: number;     // semitone fraction the note numbers were measured against
}

function transcribe(request: TranscribeRequest): TranscribeResult
```

```typescript
const { events, noteCount, tempoBpm } = transcribe({
  samples,
  sampleRate,
  tempoBpm: 120,
  polyphonic: true,
});
project.setMidiEvents(clipId, events);
console.log(noteCount, tempoBpm);
```

Every field is optional except `samples` and `sampleRate`. Omitting a field takes its default; a value outside the field's domain throws a `RangeError`, and a written `0` on a field whose domain excludes it is out of domain rather than a request for the default (only `group` and `channel` accept `0` as a value). The sample rate must be in `[8000, 384000]`.

| Field | Default | Meaning |
|---|---|---|
| `polyphonic` | `false` | `true` reads the multi-F0 chain, which finds overlapping notes; `false` cuts a single pYIN pitch line into notes |
| `referenceHz` | `440` | Tuning reference in Hz the MIDI note numbers are measured against (finite, positive), or `'auto'` to measure it from the audio. `TranscribeResult.tuning` reports what was used |
| `fmin`, `fmax` | `65`, `2093` mono; `55`, `1760` poly | F0 tracker range in Hz. Omit an endpoint for the path's default; explicit values are positive and `fmax` must exceed `fmin`. On the polyphonic path an `fmin` below the cent spectrum's floor lowers that floor, and a note found above `fmax` is dropped rather than reported an octave low |
| `minNoteMs` | `30` mono, `60` poly | Shortest span kept as a note, in milliseconds. Positive; refused together with `minNoteDivision` |
| `minNoteDivision` | none | Shortest note as a note value: `n` keeps notes from a `1/n` note up at the transcription tempo. Integer in `[1, 128]`; refused together with `minNoteMs`. The only setting that reads the tempo |
| `segmentationThresholdCents` | `50` | Pitch movement that ends one note and starts the next. Positive |
| `velocityFloorDb` | `-48` | Level mapped to velocity 1, in dBFS; must be negative. Does not drop notes: a note more than 36 dB under the take's loudest notes, or under -80 dBFS, is dropped whatever this is |
| `fixedVelocity` | none (level is mapped) | Integer in `[1, 127]` giving every note that velocity. The level gate still drops tails and ghosts |
| `maxPolyphony` | `10` | Polyphonic only. Voices one frame may hold, integer in `[1, 64]` |
| `minFramePeakRatio` | `0.20` | Polyphonic only. A frame's search stops below this share of its first peak, in `[0, 1]`; `0` is a real 0 (no cut) |
| `minRidgePeakRatio` | `0.10` | Polyphonic only. A ridge ends below this share of its own running peak, in `[0, 1]`; `0` is a real 0 (no cut) |
| `reattackRatio` | `2.0` | Polyphonic only. Splits a ridge where its salience climbs past this multiple of the level just before, so the same pitch struck again while it sounds becomes a new note. Must be above `1`; `0` turns the split off |
| `group`, `channel` | `0`, `0` | UMP group and MIDI channel the events are emitted on, each `0..15` |

`maxPolyphony`, `minFramePeakRatio`, `minRidgePeakRatio` and `reattackRatio` are refused on the monophonic path. [Audio to Notes](./audio-to-notes.md#options-and-limits) explains how these limits behave on real material and where the polyphonic path is known to fall short.

When the PPQ grid should follow a project tempo map, use `Project.transcribeToClip(...)` instead; its request has no `tempoBpm` and it returns the number of notes written.

### Focused analysis helpers

::: tip One call is usually enough
`analyze()` already returns chords, sections, timbre, dynamics, rhythm, melody, form, and per-beat strength. Reach for a focused helper when you want a single field or need options the high-level call hides.
:::

The helpers take the same mono `Float32Array` as the rest of the page. Each also accepts a request object (`{ samples, sampleRate, ...options }`).

| Task | Function | Returns |
|------|----------|---------|
| Bar starts | `detectDownbeats(samples, sampleRate)` | Seconds of likely bar starts. Pair with `detectBeats` for grid displays. See [Beats and downbeats](./glossary/analysis/beats-downbeats.md) |
| Ranked key candidates | `detectKeyCandidates(samples, sampleRate, options?)` | Every key with its confidence, best first. Use it when the top key is ambiguous or you want profile or mode filtering |
| Tempo candidates | `analyzeBpm(...)` | `bpm`, `confidence`, `candidates` (the chosen tempo first, then the rest by vote share), `autocorrelation`, `tempogram` |
| Rhythm character | `analyzeRhythm(...)` | `timeSignature`, `syncopation`, `grooveType`, `patternRegularity`, `tempoStability`, `bpm`, `beatIntervals` |
| Dynamics | `analyzeDynamics(...)` | The `Dynamics` fields plus `loudnessTimes` and `loudnessRmsDb` |
| Timbre | `analyzeTimbre(...)` | The `Timbre` fields plus `spectralCentroid`, `spectralFlatness`, `spectralRolloff` and `timbreOverTime` |
| Chords | `detectChords(samples, sampleRate, options?)` | `{ chords, tuning }`: the chord segments and the tuning used. See [Chord recognition](./glossary/analysis/chord-recognition.md) |
| Chord functions | `chordFunctions({ chords, key })` | Adds a Roman numeral and a harmonic function to chords you already have, without re-detecting |
| Sections | `analyzeSections(...)` | Labeled spans such as intro, verse, chorus, bridge and outro. Long inputs keep accurate `start` / `end` times even when the internal boundary grid is pooled. See [Section structure](./glossary/analysis/section-structure.md) |
| Structural boundaries | `detectBoundaries(request)` | The transitions alone, plus the novelty curve they were picked from |
| Melody | `analyzeMelody(...)` | `points`, `pitchRangeOctaves`, `pitchStability`, `meanFrequency`, `vibratoRate` (note `points`, not `pitches`). See [Melody and pitch](./glossary/analysis/melody-pitch.md) |

Options for the helpers that take them, all optional:

| Helper | Option | Default |
|---|---|---|
| `analyzeBpm` | `bpmMin`, `bpmMax` | 30, 300 (`analyze()` searches 60 to 200) |
| | `startBpm` | 120 |
| | `maxCandidates` | 5 |
| | `nFft`, `hopLength` | 2048 (at 22050 Hz), 512 |
| `analyzeRhythm` | `bpmMin`, `bpmMax`, `startBpm` | 60, 200, 120 |
| | `nFft`, `hopLength` | 2048 (at 22050 Hz), 512 |
| `analyzeDynamics` | `windowSec` | 0.4 |
| | `hopLength` | 512 |
| | `compressionThreshold` | 6 (crest factor in dB below which `isCompressed` is set) |
| `analyzeTimbre` | `nMels`, `nMfcc` | 128, 13 |
| | `windowSec` | 0.5 |
| | `nFft`, `hopLength` | 2048 (at 22050 Hz), 512 |
| `analyzeSections` | `minSectionSec` | 4 |
| | `nFft`, `hopLength` | 2048, 512 |
| `analyzeMelody` | `fmin`, `fmax` | 65 Hz, 2093 Hz |
| | `frameLength`, `hopLength` | 2048 (at 22050 Hz), 256 |
| | `threshold` | 0.1 (voicing confidence in `[0, 1]`) |
| | `usePyin` | `false`; `true` gives a smoother, less octave-jumpy contour |
| | `center` | `true` (pYIN only) |

`detectChords` takes `minDuration`, `smoothingWindow`, `threshold`, `useTriadsOnly`, `nFft`, `hopLength`, `useBeatSync`, `useHmm`, `hmmBeamWidth`, `useKeyContext`, `keyRoot`, `keyMode`, `detectInversions`, `chromaMethod: 'stft' | 'nnls'` and `tuning`. `detectKeyCandidates` takes the same options as `detectKey` except `tuning` (see [Key detection options](./js-api-helpers.md#key-detection-options)).

```typescript
const keys = detectKeyCandidates(samples, sampleRate, {
  modes: ['major', 'minor'],
  profile: 'krumhansl',
  genreHint: 'pop',
});

const { chords } = detectChords(samples, sampleRate, {
  useHmm: true,
  useKeyContext: true,
  keyRoot: keys[0].key.root,
  keyMode: keys[0].key.mode,       // a detected key passes straight back
  chromaMethod: 'nnls',
});

const sections = analyzeSections(samples, sampleRate);
```

### `detectBoundaries(request)`

Where `analyzeSections` hands back labeled spans, `detectBoundaries` hands back
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
| `threshold` | 0.3 | Relative novelty threshold: the fraction of the largest novelty event within `referenceWindow` of a peak that the peak must reach |
| `absoluteThreshold` | 0.005 | Novelty floor applied to the raw response *before* that scaling |
| `nMfcc` | 13 | Number of MFCC coefficients |
| `nChroma` | 12 | Number of chroma bins |
| `peakDistance` | 2.0 | Minimum spacing between peaks, in seconds |
| `referenceWindow` | 60 | One-sided span in seconds the relative threshold is measured over. `0` disables the relative threshold; a value at least the track length makes the reference whole-track |
| `useMfcc` | `true` | Use MFCC features |
| `useChroma` | `true` | Use chroma features |

| Threshold | Question it answers |
|---|---|
| `threshold` | How prominent is this peak among its neighbors? Each peak is gated against the largest novelty within `referenceWindow` seconds on either side, not against the whole track's maximum, so a dominant change does not hide weaker ones far from it. A lone event that no other event in the window comes within 30% of is set aside from that reference |
| `absoluteThreshold` | Did anything change at all? A floor on the raw response, applied before the relative scaling |

`threshold` says nothing about how much the features changed. Setting `absoluteThreshold` to `0` does not make the detector usefully more sensitive: the self-scaling turns residual fluctuation into peaks of 1.0, so a stationary input then segments anyway. Lowering the floor also will not recover level-only structure, because a level change moves the feature vector about five times less than a comparable pitch change, which puts it below what steady noise produces.

The result carries the grid it was measured on, not the source's: input above
22050 Hz is resampled before any feature is computed, so `boundary.frame` is
uninterpretable without the returned `sampleRate`, `hopLength`, `nFrames`, and
`frameStride`. Use `boundary.time` for sample or second mapping either way.
`noveltyCurve` is scaled by its own maximum; recover the raw response with
`noveltyCurve[i] * noveltyPeak`.

Passing `useMfcc: false` together with `useChroma: false` throws
`SonareError` with `InvalidParameter`: the two feature streams are combined
frame for frame, so with neither enabled there is nothing to combine. A negative
or non-finite `referenceWindow` throws `RangeError`.

### `estimateMeter(request)`

Score a beat series against a set of candidate time signatures and report the
winner, the phase of the first measure, and how the measure divides internally.
It takes beats and accents rather than audio, so it runs on a grid you already
have — from `analyze()`, from a DAW, or from a tapped tempo — without a second
pass over the samples. For what a meter is and how grouping differs from a time
signature, see [Meter and grouping](./glossary/analysis/meter-and-grouping.md).

<SonareDemo id="meter-estimate" />

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
  timeSignature: TimeSignature;   // The selected signature; confidence is margin-derived
  downbeatPhase: number;          // Beat index the first measure starts on
  searched: boolean;              // false when the series was too short to score
  grouping: number[];             // Beats per accent group; sums to the numerator
  candidateScores: number[];      // One score per requested numerator, in order
  candidates: TimeSignature[];    // Ranked by descending support; confidence is a share
}
```

There is no positional form — `estimateMeter` takes a request object only. Two
sources are supported for `beatStrengths`: `AnalysisResult.beatObservations.onsetStrength`,
the intended one, and `beats[].strength`, the raw single-frame value described
under [Beat](./js-api-types.md#beat). Neither needs pre-scaling — the series is
divided by its own maximum before scoring, so only the accent contrast within it
is read.

::: warning A hand-assembled accent series is sample-rate dependent
Reading `onsetEnvelope` at `timeToFrames(beatTime, sr, hopLength)` for each beat
is not a third source. A hop counted in samples frames a different span of time
at each rate, so one waveform sampled at 32000, 44100 and 48000 Hz — beat times
identical to the sample — produced winning numerators of 6, 3 and 4, and widening
the read to a window around each beat does not remove the dependence. A browser
decodes at the output device's rate, so a series built this way gives a different
answer per visitor for the same clip. Use one of the two sources above.
:::

::: warning An odd meter is only reported if you asked for its numerator
The default candidate set is `{3, 4, 6}`. A numerator outside the set cannot win,
so a 5/4 or 7/8 piece analyzed with the defaults comes back as a four with no
indication that the right answer was never on the ballot. Widening the set does
not force an odd reading — the estimator still needs support for it — so pass the
numerators your material might actually use.
:::

::: warning `searched: false` means every other field is a fallback
When the beat series holds **fewer than eight beats**, there is not enough to
score any candidate and the estimator returns a fixed fallback instead of a
result: `4/<requested denominator>`, `downbeatPhase` `0`, `grouping` `[4]`,
all-zero `candidateScores`, and a single-entry `candidates`.

**`timeSignature.confidence` is part of the fallback** — it reads `0`, so an
unchecked read degrades toward "no idea" rather than toward a middling detection.
`searched` is still what separates a fallback from a result; check it before you
show a confidence or branch on one. An empty `beatTimes` throws rather than
falling back; one to seven beats returns the fallback.
:::

`timeSignature.confidence` and `candidates[k].confidence` share a field name but
carry different quantities. On `timeSignature` it is derived from the margin over
the runner-up; on a `candidates` entry it is that candidate's share of the summed
support, so the entries sum to one. The two are not comparable and must not share
a threshold — read the field you mean rather than whichever is to hand.

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
relative to the given key ([Chord recognition](./glossary/analysis/chord-recognition.md)). It runs chord detection internally, then labels each
detected chord, so give it the same `options` you would give `detectChords(...)`.

It returns the timed chord entries themselves: every `Chord` field (`root`, `bass`,
`quality`, `start`, `end`, `duration`, `confidence`, `name`) plus `roman` and
`function`. There is no pairing to keep in step with a separate `detectChords(...)`
call. `analyze(...)` performs its own chord detection with its own settings, and
each chord in its result carries `romanNumeral` relative to `result.key`
(an empty string for `N.C.`).

```typescript
function chordFunctionalAnalysis(
  samples: Float32Array,
  keyRoot: PitchClass | PitchClassName,
  keyMode?: Mode | KeyMode,        // default Mode.Major
  sampleRate?: number,
  options?: ChordDetectionOptions,
): FunctionalChord[]

type ChordFunction = 'tonic' | 'subdominant' | 'dominant' | 'chromatic' | 'none';

type FunctionalChord = Chord & {
  roman: string;                   // 'I', 'V7', 'vi'; 'N.C.' for an unknown chord
  function: ChordFunction;         // 'chromatic' for a root outside the key's scale
};
```

```typescript
const key = detectKey(samples, sampleRate);
const functional = chordFunctionalAnalysis(samples, key.root, key.mode, sampleRate);

for (const { start, name, roman, function: role } of functional) {
  console.log(`${start.toFixed(1)}s  ${name}  ${roman}  ${role}`);  // e.g. "0.0s  C  I  tonic"
}
```
