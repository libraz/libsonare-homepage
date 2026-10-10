---
title: JavaScript/TypeScript Analysis API
description: Analysis functions, scale quantization, unit conversion, and resampling in the libsonare JavaScript/TypeScript package. Feature extraction and librosa-compatible helpers live on their own pages.
---

# JavaScript/TypeScript Analysis API

This page covers the core analysis functions for the libsonare JavaScript/TypeScript package: BPM/key/beat/onset detection, the all-in-one `analyze()` call and its focused helpers, structural boundary and meter estimation, and Roman-numeral chord analysis. Two related references live alongside it: [Feature Extraction](./js-api-features.md) covers STFT, mel/MFCC, chroma, spectral features, pitch detection, and the CQT/VQT/decomposition family, and [Helpers and Conversions](./js-api-helpers.md) covers the argument-for-argument librosa ports for pre-emphasis, test-signal generation, spectral reconstruction, structure, segmentation, and tempograms, along with scale quantization, unit conversion, resampling, and `chordFunctions`.

## Where the sections went

| Section | Page |
|---|---|
| Feature Extraction | [Feature Extraction](./js-api-features.md) |
| librosa-Compatible Helpers | [Helpers and Conversions](./js-api-helpers.md) |
| Scale Quantization, Unit Conversion, Resampling, `chordFunctions` | [Helpers and Conversions](./js-api-helpers.md#scale-quantization) |

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

Detect musical key from audio samples. Returns the root note (C, D, E...), the mode (major, minor, or a church mode), and the tuning the chroma was built with.

::: info Use Cases
- **Harmonic Mixing**: DJs match keys for smooth transitions (Camelot wheel)
- **Transposition**: Suggest key changes to match vocal range
- **Music Recommendation**: Find songs in compatible keys
- **Practice Tools**: Display key for musicians to play along
:::

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

### `transcribe(request)`

`transcribe` turns mono audio into note-on/note-off `ProjectMidiEvent[]` on a constant-tempo PPQ grid. Pass `tempoBpm` to choose that grid, or omit it to detect the tempo. The result reports `noteCount` separately (always half `events.length`) and does not install a tempo map on a project.

```typescript
interface TranscribeRequest {
  samples: Float32Array;
  sampleRate: number;
  tempoBpm?: number;  // omit to detect
  polyphonic?: boolean;
  referenceHz?: number | 'auto';  // tuning reference in Hz; default 440, 'auto' measures it
  // Other TranscribeOptions detector settings are optional.
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

When the PPQ grid should follow a project tempo map, use `Project.transcribeToClip(...)` instead; its request has no `tempoBpm` and it returns the number of notes written.

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
| Chords | `detectChords(samples, sampleRate, options?)` | Returns `{ chords, tuning }`: the chord segments and the tuning used. Options include HMM smoothing, key context, inversions, `chromaMethod: 'stft' \| 'nnls'`, and `tuning`. |
| Chord functions | `chordFunctions({ chords, key })` | Adds a Roman numeral and a harmonic function to chords you already have, without re-detecting. |
| Sections | `analyzeSections(samples, sampleRate, ...)` | Song-structure sections such as intro, verse, chorus, bridge, and outro. Long inputs keep accurate `start` / `end` times even when the internal boundary grid is pooled. |
| Structural boundaries | `detectBoundaries(request)` | The transitions alone, plus the novelty curve they were picked from. Use it when you want to apply your own threshold. |
| Melody | `analyzeMelody(samples, sampleRate, ...)` | Monophonic melody contour based on pitch tracking. |

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
| `threshold` | 0.3 | Relative novelty threshold: the fraction of the largest novelty event within `referenceWindow` of a peak that the peak must reach |
| `absoluteThreshold` | 0.005 | Novelty floor applied to the raw response *before* that scaling |
| `nMfcc` | 13 | Number of MFCC coefficients |
| `nChroma` | 12 | Number of chroma bins |
| `peakDistance` | 2.0 | Minimum spacing between peaks, in seconds |
| `referenceWindow` | 60 | One-sided span in seconds the relative threshold is measured over. `0` disables the relative threshold; a value at least the track length makes the reference whole-track |
| `useMfcc` | `true` | Use MFCC features |
| `useChroma` | `true` | Use chroma features |

::: tip The two thresholds do different jobs
`threshold` asks how prominent a peak is *among its neighbours*: each peak is
gated against the largest novelty within `referenceWindow` seconds on either
side, not against the whole track's maximum, so a dominant change does not hide
weaker section changes far from it. A lone dominant event, one that no other
event in the window comes within 30% of, is set aside from that
reference. It says nothing about how much the features actually changed.
`absoluteThreshold` is the floor that asks whether anything changed at all. Setting it to `0` does not make the detector more sensitive in a
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
frame for frame, so with neither enabled there is nothing to combine. A negative
or non-finite `referenceWindow` throws `RangeError`.

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
relative to the given key. It runs chord detection internally, then labels each
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
