---
title: Node.js Native Analysis and Effects
description: Analysis, effects, and feature-extraction functions of the @libraz/libsonare-native package.
---

# Node.js Native Analysis and Effects

This page covers the analysis, effects, and feature-extraction functions of the `@libraz/libsonare-native` package. For usage, errors, the `Audio` class, cleanup, conversions, metering, mastering analysis, and streaming classes, see [Node.js Native API](./node-api.md); for the exported TypeScript types, see [Node.js Native Types](./node-api-types.md).

## Analysis Functions

| Function | Return Type | Description |
|----------|-------------|-------------|
| `detectBpm(samples, sampleRate?)` | `number` | Tempo in BPM |
| `detectKey(samples, sampleRate?)` | `Key` | Root, mode, confidence |
| `detectBeats(samples, sampleRate?)` | `Float32Array` | Beat timestamps |
| `detectOnsets(samples, sampleRate?)` | `Float32Array` | Onset timestamps |
| `detectChords(samples, sampleRate?, minDuration?, smoothingWindow?, threshold?, useTriadsOnly?, nFft?, hopLength?, useBeatSync?, useHmm?, hmmBeamWidth?, useKeyContext?, keyRoot?, keyMode?, detectInversions?, chromaMethod?)` | `ChordAnalysisResult` | Chord progression with timings. Frames below `threshold` are returned as explicit `N.C.` intervals; trailing options enable HMM smoothing, key context, inversions, and the chroma method (`'stft'` default) |
| `detectDownbeats(samples, sampleRate?)` | `Float32Array` | Downbeat (bar-start) timestamps |
| `detectKeyCandidates(samples, sampleRate?, options?)` | `KeyCandidate[]` | Ranked key candidates with correlation scores |
| `analyze(samples, sampleRate?, options?)` | `AnalysisResult` | All-in-one analysis in one call: BPM and ranked BPM hypotheses, key, time signature and ranked time-signature candidates, beats, chords, sections, timbre, dynamics, rhythm, melody, and form. The dedicated `detect*`/`analyze*` functions below remain available for targeted or parameterized analysis |
| `analyzeWithProgress(samples, sampleRate?, onProgress?)` | `AnalysisResult` | Same as `analyze` with a `(progress, stage)` callback for long inputs |
| `estimateMeter(request)` | `MeterEstimate` | Score a meter over a caller-supplied beat series, without audio and without re-running analysis. Request-only — takes `EstimateMeterRequest` |
| `analyzeBpm(samples, sampleRate?, options?)` | `BpmAnalysisResult` | Tempo with confidence and alternate candidates. `options`: `bpmMin`, `bpmMax`, `startBpm`, `nFft`, `hopLength`, `maxCandidates` |
| `analyzeRhythm(samples, sampleRate?, options?)` | `RhythmResult` | Time signature, groove, syncopation. `options`: `bpmMin`, `bpmMax`, `startBpm`, `nFft`, `hopLength` |
| `analyzeDynamics(samples, sampleRate?, options?)` | `DynamicsResult` | Dynamic range, loudness range, crest factor. `options`: `windowSec`, `hopLength`, `compressionThreshold` |
| `analyzeTimbre(samples, sampleRate?, options?)` | `TimbreResult` | Brightness, warmth, density, roughness, complexity, plus per-window `timbreOverTime`. `options`: `nFft`, `hopLength`, `nMels`, `nMfcc`, `windowSec` |
| `analyzeSections(samples, sampleRate?, options?)` | `Section[]` | Structural sections (intro/verse/chorus…) with timings. `options`: `nFft`, `hopLength`, `minSectionSec`. Long inputs may use a pooled boundary grid; use each section's `start` / `end` for placement |
| `detectBoundaries(request)` | `BoundaryResult` | Structural transitions plus the novelty curve they were picked from, and the grid both live on. `request`: `samples`, `sampleRate`, `nFft`, `hopLength`, `kernelSize`, `threshold`, `absoluteThreshold`, `nMfcc`, `nChroma`, `peakDistance`, `useMfcc`, `useChroma`. Reach for it when you want to apply your own threshold rather than take `analyzeSections`' labelled spans |
| `analyzeMelody(samples, sampleRate?, options?)` | `MelodyResult` | Lead-melody contour (F0 per frame). `options`: `fmin`, `fmax`, `frameLength`, `hopLength`, `threshold`, `usePyin`, `center` |
| `detectAcoustic(samples, sampleRate?, options?)` | `AcousticResult` | Room acoustics from a recording (RT60 — the time reverberation takes to decay 60 dB — and related measures). `options`: `nOctaveBands`, `nThirdOctaveSubbands`, `minDecayDb`, `noiseFloorMarginDb` |
| `analyzeImpulseResponse(samples, sampleRate?, nOctaveBands?, minDecayDb?)` | `AcousticResult` | Room acoustics from a measured impulse response; `minDecayDb` controls the decay-fit threshold (default `30`) |
| `estimateRoom(samples, sampleRate?, options?)` | `RoomEstimateResult` | Equivalent-room estimate with volume, dimensions, DRR (direct-to-reverberant ratio), absorption bands, RT60 bands, and confidence |
| `synthesizeRir(options?)` | `RirResult` | Mono RIR (room impulse response) from shoebox geometry |
| `roomMorph(samples, sampleRate, options?)` | `Float32Array` | Offline creative morph toward a target room |
| `lufs(samples, sampleRate?)` | `LufsResult` | Integrated, final momentary/short-term windows, their EBU R128 maxima (Max-M / Max-S), and loudness range |
| `lufsInterleaved(samples, channels, sampleRate?)` | `LufsResult` | Channel-weighted multichannel loudness from interleaved samples |
| `ebur128LoudnessRange(samples, sampleRate?)` | `number` | Standards-compliant EBU R128 loudness range (LRA) in LU |
| `momentaryLufs(samples, sampleRate?)` | `Float32Array` | Momentary loudness (400 ms) per step |
| `shortTermLufs(samples, sampleRate?)` | `Float32Array` | Short-term loudness (3 s) per step |
| `version()` | `string` | Library version |
| `voiceChangerAbiVersion()` | `number` | ABI version of the realtime voice-changer POD config; separate from preset JSON `schemaVersion` |
| `voiceCharacterPresetId(preset)` | `VoicePresetId \| null` | Canonical voice-character preset ID; an unknown numeric ordinal returns `null`, while an unknown string ID throws |
| `realtimeVoiceChangerPresetConfig(preset)` | `RealtimeVoiceChangerConfig` | Resolved flat POD config for a built-in voice preset, without JSON parsing. Throws on an unknown preset name or out-of-range ordinal |
| `hasFfmpegSupport()` | `boolean` | Whether the loaded native addon can decode via FFmpeg |

Default sample rates differ by helper family:

| Helper family | Default `sampleRate` |
|---------------|----------------------|
| Music analysis, effects, feature, and loudness helpers | `22050` |
| `analyzeImpulseResponse`, `detectAcoustic`, `estimateRoom`, and `synthesizeRir` in the native addon | `48000` |

Common helpers are also available as `Audio` instance methods, as noted in the `Audio` section.

The tables below document the Node native API. The WASM package uses the same camelCase names, but functions with a required argument after `sampleRate` require that `sampleRate` position to be supplied. See [JavaScript API](./js-api.md) for the browser signatures.

### `analyze()` options

`analyze(...)` takes an options object as its third argument, or the same fields
directly on the request object. It covers the whole pipeline in one place:

| Option | Default | Description |
|--------|---------|-------------|
| `nFft` / `hopLength` | `2048` / `512` | STFT resolution shared across the pipeline |
| `bpmMin` / `bpmMax` / `startBpm` | `60` / `200` / `120` | Tempo search range and prior |
| `useTriadsOnly` | `true` | Restrict the chord search to triads |
| `useHpss` | `true` | Harmonic-only chroma for chord and key detection |
| `chromaHighpassHz` | `80` | Chroma high-pass cutoff in Hz (`0` disables) |
| `useBassWeighted` | `true` | Bass-weighted chroma combination |
| `chromaHopMultiplier` | `4` | Chroma hop multiplier; larger is faster |
| `useChordHmm`, `useChordKeyContext`, `chordHmmBeamWidth`, `detectChordInversions` | — | Chord post-processing, matching the trailing options on `detectChords(...)` |
| `adaptiveTempo` | `false` | Track a locally updated tempo prior through beat tracking |
| `tempoUpdateIntervalBeats` | `8` | Local tempo context length in beats; read only when `adaptiveTempo` is set |
| `computeTempoCurve` | `false` | Decode a per-beat local tempo curve into `beatLocalBpm` |
| `meterCandidateNumerators` | `[3, 4, 6]` | Meter numerators the estimator scores. At most 16 entries, each in `[2, 32]`; an empty list is rejected rather than restoring the default, and widening the set does not force a wider meter |
| `meterDenominator` | `4` | Beat unit reported for the detected meter, a power of two in `[1, 32]`. The estimator still reports 8 on its own when it resolves a compound meter |

::: warning `useTriadsOnly` points the other way here
In the unified `analyze()` path `useTriadsOnly` is **`true`**, while the
standalone `detectChords(...)` defaults it to `false`. So `analyze()` searches
triads alone — and reports no sevenths or extensions — until the caller passes
`useTriadsOnly: false`.
:::

`computeTempoCurve` is off because the curve is an extra output rather than a
better analysis: nothing else in the result changes, so a caller who never reads
it would pay a decode over the beat grid for nothing. The curve also describes
the beat grid it was decoded from, and beat tracking holds a fixed tempo prior
unless `adaptiveTempo` is set as well — measuring a tempo that actually moves
needs both options.

### `estimateMeter(...)`

`estimateMeter(...)` scores a meter over a **caller-supplied beat series**. It
reads only per-beat times and accent values, never audio, so an existing
analysis — or an arbitrary span of one — can be re-scored without re-running the
pipeline. For the underlying concept, see
[Meter and grouping](./glossary/analysis/meter-and-grouping.md).

```typescript
const result = analyze(samples, sampleRate);

const meter = estimateMeter({
  beatTimes: result.beats.map((beat) => beat.time),
  beatStrengths: result.beatObservations.onsetStrength,
  candidateNumerators: [3, 4, 5, 6, 7],
});

console.log(meter.searched, meter.timeSignature.numerator, meter.grouping);
```

| Field | Default | Description |
|-------|---------|-------------|
| `beatTimes` | — | Beat positions in seconds, non-decreasing |
| `beatStrengths` | — | Per-beat accent, the same length as `beatTimes`. The series is divided by its own maximum before scoring, so it needs no pre-scaling |
| `candidateNumerators` | `[3, 4, 6]` | Numerators to score; at most 16 entries, each in `[2, 32]` |
| `denominator` | `4` | Beat unit reported for the detected meter |
| `downbeatWeight` / `measureWeight` / `subdivisionWeight` | `1` / `0.5` / `0.15` | Scoring weights for the first beat of each measure, measure-to-measure accent agreement, and the subdivision pattern |

Two sources are supported for `beatStrengths`: `beatObservations.onsetStrength`,
the windowed value the library's own downbeat pass scores, and `beats[].strength`,
a single unwindowed frame of the same envelope. Reading `onsetEnvelope(...)` at
`timeToFrames(...)` for each beat is not a third: a hop counted in samples frames
a different span of time at each rate, so one waveform at 32000, 44100 and
48000 Hz — beat times identical — produced winning numerators of 6, 3 and 4, and
a window around each beat does not remove the dependence.

Two properties decide whether the answer means anything:

- **The default candidate set is `{3, 4, 6}`.** An odd meter is reported only if
  its numerator was asked for, so a seven needs it listed explicitly.
- **`searched` is `false` when the beat series was under eight beats.** Every
  other field then carries a fixed fallback rather than a result — including
  `timeSignature.confidence`, which reads `0`, so an unchecked read degrades
  toward "no idea" rather than toward a middling detection. Read `searched`
  before treating a short span's answer as a detection.

`grouping` reports how the bar divides into accent groups, so a seven comes back
as `[3, 2, 2]` rather than as a bare seven, and it always sums to the numerator.
A single entry means no internal division was resolved. `candidateScores` is
standardized and signed, listed in the order the request gave the numerators:
zero is the level a numerator reaches on beats carrying no meter, so only the
ordering and the gaps between entries carry meaning, and a score grows with the
square root of how many beats were scored. `candidates` is ordered by descending
support instead, so match the two on `numerator` rather than by index.
`confidence` also changes meaning between its two homes: on `timeSignature` it is
derived from the margin over the runner-up, on a `candidates` entry it is that
candidate's share of the summed support (the entries sum to one), so the two
must not share a threshold.

### Asynchronous variants (Node only)

The Node addon also exposes Promise-returning variants. They run the DSP pipeline on a libuv worker thread, so the JS event loop is not blocked.

These functions resolve with the same shape as their synchronous counterparts and are Node-native-only. Browser code can instead use `OfflineWorkerClient` from `@libraz/libsonare/worker`; it provides task-based analysis and mastering in a Web Worker rather than these identically named functions.

Progress callbacks are not available on the async path. If you need progress updates, use the synchronous call with `onProgress`. If you only need concurrency, run several async calls in parallel.

| Function | Return Type | Description |
|----------|-------------|-------------|
| `analyzeAsync(samples, sampleRate?)` | `Promise<AnalysisResult>` | Async variant of `analyze(...)` |
| `masterAudioAsync(samples, sampleRate?, presetName?, overrides?)` | `Promise<MasteringChainResult>` | Async variant of `masterAudio(...)` |
| `masterAudioStereoAsync(left, right, sampleRate?, presetName?, overrides?)` | `Promise<MasteringChainStereoResult>` | Async variant of `masterAudioStereo(...)` |

## Effects Functions

| Function | Return Type | Description |
|----------|-------------|-------------|
| `hpss(samples, sr?, kernelHarmonic?, kernelPercussive?, nFft?, hopLength?, hardMask?)` | `HpssResult` | Harmonic-Percussive Source Separation; `nFft=2048`, `hopLength=512`, `hardMask=false` by default |
| `hpssWithResidual(samples, sr?, kernelHarmonic?, kernelPercussive?, nFft?, hopLength?, hardMask?)` | `HpssWithResidualResult` | HPSS with harmonic, percussive, and residual outputs; accepts the same STFT/mask options |
| `harmonic(samples, sr?)` | `Float32Array` | Extract harmonic component |
| `percussive(samples, sr?)` | `Float32Array` | Extract percussive component |
| `timeStretch(samples, sampleRate, rate, nFft?, hopLength?)` | `Float32Array` | Time-stretch without pitch change; defaults to `nFft=2048`, `hopLength=512` |
| `phaseVocoder(samples, sampleRate, rate, nFft?, hopLength?)` | `Float32Array` | Direct phase-vocoder time scaling |
| `pitchShift(samples, sampleRate, semitones, nFft?, hopLength?)` | `Float32Array` | Pitch-shift without tempo change; defaults to `nFft=2048`, `hopLength=512` |
| `remix(samples, intervals, sr?, alignZeros?)` | `Float32Array` | Reorder or concatenate sample intervals |
| `remixAlignedIntervals(samples, intervals, sr?, alignZeros?)` | `Int32Array` | The cut points `remix` would use, without cutting: one clamped `(start, end)` pair per input interval, flattened. `alignZeros` defaults to `true` here |
| `normalize(samples, sr?, targetDb?, mode?)` | `Float32Array` | Normalize to target peak or RMS dB (`mode`: `'peak'` or `'rms'`, default: `'peak'`) |
| `normalizeStereo(request)` | `NormalizeStereoResult` | Normalize a channel pair on a level measured across both channels. Request-only — takes `NormalizeStereoRequest` |
| `trim(samples, sr?, thresholdDb?, frameLength?, hopLength?)` | `Float32Array` | Trim silence (defaults: `-60.0` dB, `frameLength=2048`, `hopLength=512`) |
| `resample(samples, srcSr, targetSr)` | `Float32Array` | Resample to target sample rate |
| `pitchCorrectToMidi(samples, sr, currentMidi, targetMidi)` | `Float32Array` | Retune a held note from one MIDI pitch to another |
| `pitchCorrectToMidiTimevarying(samples, f0Hz, targetMidi, sr?, hopLength?, voiced?, voicedProb?)` | `Float32Array` | Retune a tracked pitch contour to a fixed note, frame by frame. `voiced` takes the `VoicedFlags` union |
| `pitchCorrectTimevarying(samples, f0Hz, sr?, hopLength?, options?)` | `Float32Array` | Snap a tracked pitch contour to a scale or a fixed note; `options` is `PitchCorrectOptions`, whose `voiced` field takes the same `VoicedFlags` union |
| `noteStretch(samples, sr?, options?)` | `Float32Array` | Time-stretch a single note span in place; `options` is `{ onsetSample, offsetSample, stretchRatio }` |
| `voiceChange(samples, sr?, options?)` | `Float32Array` | Pitch + formant shift for voice transformation; `options` is `{ pitchSemitones, formantFactor }` |

`trim(...)` is the simple threshold edit helper. `trimSilence(...)` below is
the librosa-compatible frame/RMS helper that returns the original sample range.

`hpss(...)` and `hpssWithResidual(...)` default their median-filter kernels to
`kernelHarmonic=31` and `kernelPercussive=31`. The request-object forms use the
same names (`nFft`, `hopLength`, and `hardMask`) as the positional overloads.

### Cutting a stereo take with `remix`

Zero-crossing snapping is a per-signal decision, so calling `remix(...)` channel
by channel snaps each channel to a different frame and drifts a stereo take
apart. Resolve one cut set from one channel with `remixAlignedIntervals(...)`
and apply that same set to every channel. The two entry points point opposite
ways by default: `remix` has `alignZeros` false, `remixAlignedIntervals` has it
true.

Two guards stop a slice from vanishing under snapping. A signal with no sign
change at all — silence, a DC offset, any constant — is not snapped, and a slice
that had content but collapses to empty after snapping keeps its unsnapped
boundaries.

### Normalizing a channel pair

`normalizeStereo({ left, right, sampleRate?, targetDb?, mode? })` applies **one**
gain to both channels, so the stereo image is preserved. A per-channel gain
would lift the quieter side until the two levels matched, which is a balance
change rather than a normalization. That is why the result carries a single
`appliedGainDb` and not a pair, and why a silent pair comes back untouched at
exactly `0`. `mode: 'peak'` (the default) drives the peak of the pair to
`targetDb`, so the louder channel lands on it and the other keeps its distance
below; `mode: 'rms'` drives the root mean square over both channels' samples
together — the quadratic mean of the per-channel figures, not their average —
and hard-clips the result to [-1, 1].

Unlike the mono `normalize(...)`, whose `targetDb` default is `0` in both modes,
`normalizeStereo` defaults `targetDb` **by mode**: `0` for `'peak'` and `-20`
for `'rms'`. 0 dBFS RMS is not a usable target, since the peaks sit well above
the RMS and effectively all of them would clip.

`VoicedFlags` is `Int32Array | Uint8Array | Float32Array | readonly number[] |
readonly boolean[]`, so the `boolean[]` that `PitchResult.voicedFlag` hands back
goes straight into pitch correction with no conversion step:

```typescript
const pitch = pitchPyin(samples, sampleRate);
const tuned = pitchCorrectToMidiTimevarying(
  samples,
  pitch.f0,
  69,
  sampleRate,
  512,
  pitch.voicedFlag,   // boolean[] accepted as-is
);
```

`voicedProb` derives the voicing decision **only** when `voiced` is omitted — a
frame at or above 0.5 counts as voiced. When `voiced` is supplied, `voicedProb`
is ignored entirely; in particular it does not scale the per-frame correction
amount, so passing both is identical to passing `voiced` alone. The same holds
for `PitchCorrectOptions.voicedProb` on `pitchCorrectTimevarying(...)`.

::: warning Correction strength is not weighted by `voicedProb`
A caller who relied on the correction being scaled by `voicedProb` will hear
**stronger correction in the low register**. pYIN's voiced probability is a
frequency-dependent observation mass that rises with the fundamental rather than
tracking confidence, so using it as a weight silently under-corrected low
registers.
:::

`voiced` and `voicedProb` must each be the same length as `f0Hz`. A mismatch
throws a `RangeError` (`'voiced must have the same length as f0Hz'`), not a
`SonareError`, so `isSonareError` does not catch it.

## Feature Extraction Functions

| Function | Return Type | Description |
|----------|-------------|-------------|
| `stft(samples, sr?, nFft?, hopLength?)` | `StftResult` | Short-Time Fourier Transform |
| `stftDb(samples, sr?, nFft?, hopLength?)` | `StftDbResult` | STFT in decibels |
| `melSpectrogram(samples, sr?, nFft?, hopLength?, nMels?)` | `MelSpectrogramResult` | Mel spectrogram |
| `mfcc(samples, sr?, nFft?, hopLength?, nMels?, nMfcc?, fmin?, fmax?, htk?, lifter?)` | `MfccResult` | Mel-Frequency Cepstral Coefficients (`lifter` default 0 = no liftering) |
| `chroma(samples, sr?, nFft?, hopLength?)` | `ChromaResult` | Chroma features |
| `spectralCentroid(samples, sr?, nFft?, hopLength?)` | `Float32Array` | Spectral centroid per frame |
| `spectralBandwidth(samples, sr?, nFft?, hopLength?)` | `Float32Array` | Spectral bandwidth per frame |
| `spectralRolloff(samples, sr?, nFft?, hopLength?, rollPercent?)` | `Float32Array` | Spectral rolloff per frame |
| `spectralFlatness(samples, sr?, nFft?, hopLength?)` | `Float32Array` | Spectral flatness per frame |
| `spectralContrast(samples, sr?, nFft?, hopLength?, nBands?, fmin?, quantile?)` | `Matrix2dResult` | Spectral contrast, shape `(nBands + 1) x nFrames` |
| `spectralEdit(samples, sr, ops?, options?)` | `Float32Array` | Region-based STFT edit with `gain`, `attenuate`, `mute`, or `heal` ops |
| `polyFeatures(samples, sr?, nFft?, hopLength?, order?)` | `Matrix2dResult` | Per-frame polynomial spectral coefficients |
| `zeroCrossingRate(samples, sr?, frameLength?, hopLength?)` | `Float32Array` | Zero-crossing rate per frame |
| `zeroCrossings(samples, threshold?, refMagnitude?, pad?, zeroPos?)` | `Int32Array` | Zero-crossing sample indices |
| `rmsEnergy(samples, sr?, frameLength?, hopLength?)` | `Float32Array` | RMS energy per frame |
| `pitchYin(samples, sr?, frameLength?, hopLength?, fmin?, fmax?, threshold?, fillNa?)` | `PitchResult` | YIN pitch estimation; unvoiced `f0` stays `NaN` unless `fillNa` is true |
| `pitchPyin(samples, sr?, frameLength?, hopLength?, fmin?, fmax?, threshold?, fillNa?)` | `PitchResult` | pYIN pitch estimation; unvoiced `f0` stays `NaN` unless `fillNa` is true |
| `pitchTuning(frequencies, resolution?, binsPerOctave?)` | `number` | Tuning offset from frequencies |
| `estimateTuning(samples, sr?, nFft?, hopLength?, resolution?, binsPerOctave?)` | `number` | Tuning offset from audio |
| `cqt(samples, sr?, hopLength?, fmin?, nBins?, binsPerOctave?)` | `CqtResult` | Constant-Q transform magnitude |
| `vqt(samples, sr?, hopLength?, fmin?, nBins?, binsPerOctave?, gamma?)` | `CqtResult` | Variable-Q transform magnitude (`gamma` controls Q) |
| `chromaCqt(samples, sr?, hopLength?, nChroma?)` | `{ nChroma, nFrames, data }` | Constant-Q chromagram (`librosa.feature.chroma_cqt` equivalent) |
| `nnlsChroma(samples, sr?, options?)` | `{ nChroma, nFrames, data }` | NNLS chromagram (note-activation chroma); `options.hopLength` defaults to `512` |
| `decompose(s, nFeatures, nFrames, nComponents, nIter?, beta?, init?)` | `DecomposeResult` | NMF (non-negative matrix factorization) factor matrices from a row-major spectrogram, with selectable `init` (`'random'` default, `'nndsvd'`) |
| `decomposeStems(request)` | `DecomposeStemsResult` | NMF separation that carries the original phase, so each component is directly listenable. Request-only — takes `DecomposeStemsRequest` |
| `noteSegments(request)` | `NoteSegment[]` | Segment a caller-supplied monophonic F0 track into stable note regions. Request-only — takes `NoteSegmentsRequest` |
| `hybridCqt(samples, sr?, hopLength?, fmin?, nBins?, binsPerOctave?)` | `CqtResult` | Hybrid CQT magnitude (true CQT in low bins, pseudo-CQT in high bins) |
| `pseudoCqt(samples, sr?, hopLength?, fmin?, nBins?, binsPerOctave?)` | `CqtResult` | Approximate (pseudo) CQT magnitude (single FFT) |
| `bassChroma(samples, sr?, hopLength?, nChroma?)` | `ChromaResult` | Bass-focused chroma (low-register pitch-class distribution) |
| `chromaCens(samples, sr?, hopLength?, nChroma?)` | `ChromaResult` | CENS energy-normalized/smoothed chroma |
| `onsetStrengthMulti(samples, sr?, nFft?, hopLength?, nMels?, nBands?)` | `{ nBands, nFrames, data }` | Multi-band onset strength (`nBands` default 3; `data` row-major `[nBands x nFrames]`) |
| `nnFilter(s, nFeatures, nFrames, aggregate?, k?, width?)` | `Matrix2dResult` | Nearest-neighbor filtering |
| `onsetEnvelope(samples, sr?, nFft?, hopLength?, nMels?)` | `Float32Array` | Onset strength envelope — how sharply energy rises per frame; the input to the tempogram family |

Common defaults: `nFft=2048`, `hopLength=512`, `nMels=128`, `nMfcc=20`, pitch `fmin=65.0`, `fmax=2093.0`, `threshold=0.1`, and `rollPercent=0.85`.

CQT/VQT use `fmin=32.70319566` Hz (C1), `nBins=84`, and `binsPerOctave=12`. VQT's default `gamma=-1` selects automatic ERB-derived bandwidth. `chromaCqt` defaults to `nChroma=12`, `nBins=252`, and `binsPerOctave=36`; `bassChroma` and `chromaCens` default to `nChroma=12`. `onsetStrengthMulti` defaults to `nBands=3`. `decompose` defaults to `nIter=50`, `beta=2`, and `init='random'`.

### `decompose` versus `decomposeStems`

`decompose(...)` returns the W/H factors of a *magnitude* spectrogram. Those
factors carry no phase, so reconstructing from them needs a phase estimator, and
an estimated phase does not hold up as a stem. `decomposeStems(...)` builds a
per-component soft mask from the same factorization and applies it to the
**original complex** spectrogram, so every component keeps the source's phase.
The masks sum to one wherever the model has energy and the inverse STFT is
linear, so the components sum back to the input.

`maskPower` sets how hard the mask separates: `1` (the default) keeps the
magnitude ratio, `2` is the Wiener-style power ratio, which separates harder at
the cost of more artifacts on overlapping partials. `decomposeStems` defaults to
`nComponents=4`, `nFft=2048`, `hopLength=512`, `nIter=100`, `beta=2`, and
`init='random'`, and returns `components` — one signal per component, each the
length of the input — alongside the `w`/`h` matrices and `sampleRate`.

::: warning NNDSVD factors will not match stored ones
NNDSVD seeding is computed in double precision. A magnitude spectrogram's
trailing singular vectors sit at single precision's noise floor, so a float seed
depended on summation order, and wasm32 and arm64 answered with different
components; the double-precision seed makes the result reproducible across
builds. Shapes, non-negativity and reconstruction quality are unaffected — this
is reproducibility, not accuracy — but a caller holding **stored factors**, or
comparing against an older stem render, will find them different.
:::

### `noteSegments`

`noteSegments({ f0Hz, voicedProb, frameRate, ... })` segments a caller-supplied
monophonic F0 track into stable note regions, one `NoteSegment` per region with
`frameStart`, `frameEnd`, `startSeconds`, `endSeconds`, and `medianCents`. The
tuning fields are `segmentationThresholdCents` (default `50`), `minNoteMs`
(default `30`), `referenceHz` (default `440`), and `voicedThreshold` (default
`0.5`), the value of `voicedProb` at or above which a frame counts as voiced.

::: warning Do not feed pYIN's `voicedProb` straight in
`voicedProb` is the frame's voiced observation **mass**, and for a fixed frame
length it rises with F0 rather than tracking confidence. A fixed threshold
therefore silently returns **no segments at all** for low-register material.
Pass `pitchPyin`'s `voicedFlag` converted to `0`/`1`, or lower `voicedThreshold`.
:::

