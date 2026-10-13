---
title: JavaScript/TypeScript Types and Enumerations
description: Type definitions, enumerations, and the type export index of the libsonare JavaScript/TypeScript package.
---

# JavaScript/TypeScript Types and Enumerations

## Types

### AnalysisResult

```typescript
interface AnalysisResult {
  bpm: number;
  bpmConfidence: number;
  bpmCandidates: BpmHypothesis[];          // Ranked, best first
  key: Key;
  timeSignature: TimeSignature;
  timeSignatureCandidates: TimeSignature[]; // Ranked, best first
  beatTimes: Float32Array;  // Convenience copy of beats[].time, useful for librosa-style code
  beats: Beat[];            // Beat objects with per-beat strength
  downbeatIndices: number[];        // Indices into beats[] that start a measure
  downbeatPhase: number;            // Beat index the first measure starts on
  beatObservations: BeatObservations;  // Per-beat evidence, parallel to beats[]
  beatLocalBpm: number[];           // Smoothed local tempo per beat; opt-in
  chords: AnalysisChord[];
  sections: Section[];
  timbre: Timbre;
  dynamics: Dynamics;
  rhythm: RhythmFeatures;
  melody: MelodyContour;
  form: string;  // e.g., "IABABCO"
  tuning: number; // semitone fraction used for the chromagrams (given or measured)
}

interface BpmHypothesis {
  value: number;
  confidence: number;
  /** How this hypothesis relates to the reported `bpm`. */
  relation: 'primary' | 'half' | 'double' | 'other';
}

// Beat-level evidence behind the downbeat and meter decisions. One object of
// three parallel streams, each holding one value per entry of `beats`.
interface BeatObservations {
  onsetStrength: number[];       // Beat-local onset-strength window
  lowFrequencyEnergy: number[];  // Beat-local low-frequency energy
  chordChange: number[];         // Per-beat chord-change evidence
}
```

`downbeatIndices` **indexes `beats`** rather than running alongside it: it is
shorter than `beats`, and `beats[downbeatIndices[k]]` is the k-th downbeat. Ask
whether a beat is a downbeat with a membership check on the list, not by reading
a per-beat flag. `downbeatPhase` is the meter estimator's phase (the beat index
the first measure starts on, in `[0, timeSignature.numerator)`), so
`downbeatIndices` normally begins at that value. It is not re-derived when the
downbeats are refined against chord and low-frequency evidence, so the two can
legitimately disagree; the list is the result, the phase is the starting guess.

`beatObservations` is where accent evidence lives, and each of its three streams
runs parallel to `beats`. An **empty** stream means the analysis could not
produce it, which is not the same as every beat scoring zero: `lowFrequencyEnergy`
is empty when the analysis ran without audio, and `chordChange` is empty until
chords have been analyzed. Check the length before indexing.

`beatLocalBpm` is the smoothed local tempo at each beat, parallel to `beats` and
in BPM. It is **empty unless you asked for it** with `computeTempoCurve`, and
empty regardless when fewer than two beats were detected. Its last entry repeats
the tempo of the interval leading into the final beat. It is genuine local
tempo, not `bpm` resampled. A curve decoded from a fixed beat
grid therefore describes that grid, so measuring a tempo that actually moves wants
`adaptiveTempo` set as well. The values are continuous rather than quantized to
a fixed tempo grid. Each value is a weighted local average of neighboring
inter-beat intervals in log-tempo space, so a changing tempo can lag by a few
beats.

`bpm` and `timeSignature` are the winners; the two `*Candidates` arrays are the
ranked field behind them. They matter because tempo is genuinely ambiguous —
a half-time feel and its double are both defensible readings of the same track.
Rather than showing one number and hoping, offer the alternates:

```typescript
const { bpm, bpmCandidates } = analyze({ samples, sampleRate });
const halfTime = bpmCandidates.find((c) => c.relation === 'half');
if (halfTime && halfTime.confidence > 0.4) {
  offerAlternative(halfTime.value);   // "or 84 BPM?"
}
```

The same arrays are on the C ABI, Node, and Python.

### Beat

```typescript
interface Beat {
  time: number;      // seconds
  strength: number;  // raw onset-envelope value at the beat's frame; unbounded
}
```

::: warning `strength` is not a salience score
`strength` is **a single raw frame of the onset envelope**, sampled at the beat's
frame. It is not normalized, not relative, and not bounded to `0..1`: its scale
depends on the material, so the same figure means different things in two
tracks, and because it is one frame rather than a window it moves with any
jitter in the beat position.

To score accents and decide which beats are strong, use
`AnalysisResult.beatObservations.onsetStrength`, the windowed aggregate the
library's own downbeat pass scores. Reach for `Beat.strength` only when you
genuinely want the envelope value at that instant.
:::

### Chord

```typescript
interface Chord {
  root: PitchClass;
  bass: PitchClass;     // bass note for inversions
  rootName: string;     // Canonical core spelling, stable across bindings
  bassName: string;     // Canonical core spelling, stable across bindings
  quality: ChordQuality;
  start: number;       // seconds
  end: number;         // seconds
  duration: number;    // seconds; derived from end - start
  confidence: number;
  name: string;        // "C", "Am", "G7"
}

interface AnalysisChord extends Chord {
  romanNumeral: string; // relative to AnalysisResult.key; empty for N.C.
}
```

`duration` is derived from `end - start`; the core carries only the two endpoints.

### Section

```typescript
interface Section {
  type: SectionType;
  start: number;
  end: number;
  energyLevel: number;
  confidence: number;
  name: string;  // "Intro", "Verse 1", "Chorus"
}
```

### TimeSignature

```typescript
interface TimeSignature {
  numerator: number;    // e.g., 4
  denominator: number;  // e.g., 4
  confidence: number;   // MeterEstimate.timeSignature: margin over the runner-up;
                        // MeterEstimate.candidates[]: share of summed support
}
```

### Timbre

```typescript
interface Timbre {
  brightness: number;   // 0.0 to 1.0
  warmth: number;
  density: number;
  roughness: number;
  complexity: number;
}

interface TimbreFrame {
  brightness: number;
  warmth: number;
  density: number;
  roughness: number;
  complexity: number;
}

interface TimbreAnalysisResult extends TimbreFrame {
  spectralCentroid: Float32Array;
  spectralFlatness: Float32Array;
  spectralRolloff: Float32Array;
  timbreOverTime: TimbreFrame[];
}
```

### Dynamics

```typescript
interface Dynamics {
  dynamicRangeDb: number;
  peakDb: number;
  rmsDb: number;
  loudnessRangeDb: number;
  crestFactor: number;
  isCompressed: boolean;
}
```

### RhythmFeatures

```typescript
interface RhythmFeatures {
  syncopation: number;
  grooveType: string;  // "straight", "shuffle", "swing"
  patternRegularity: number;
  tempoStability: number;
  timeSignature: TimeSignature;
}
```

### MelodyContour

```typescript
interface MelodyContour {
  pitchRangeOctaves: number;
  pitchStability: number;
  meanFrequency: number;
  vibratoRate: number;     // Hz
  pitches: MelodyPoint[];  // per-frame pitch trajectory
}
```

### MelodyPoint

```typescript
interface MelodyPoint {
  time: number;        // frame time in seconds
  frequency: number;   // estimated f0 in Hz (0 when unvoiced)
  confidence: number;  // voicing confidence, 0.0 to 1.0
}
```

### Focused analysis results

The focused `analyze*` helpers return these. Each is the matching `analyze()` sub-object plus the fields shown:

| Helper | Result type | Fields beyond the `analyze()` sub-object |
|--------|-------------|-------------------------------------------|
| `analyzeBpm` | `BpmAnalysisResult` | `bpm`, `confidence`, `candidates: BpmCandidate[]` (`{ bpm, confidence }`; `candidates[0]` is the chosen tempo, the rest follow by vote share), `autocorrelation`, `tempogram` |
| `analyzeRhythm` | `RhythmAnalysisResult` | `RhythmFeatures` plus `bpm` (the beat tracker's refined tempo) and `beatIntervals` |
| `analyzeDynamics` | `DynamicsResult` (alias `DynamicsAnalysisResult`, deprecated) | `Dynamics` plus `loudnessTimes` and `loudnessRmsDb` (parallel `Float32Array`s) |
| `analyzeTimbre` | `TimbreAnalysisResult` | `Timbre` plus `spectralCentroid`, `spectralFlatness`, `spectralRolloff`, `timbreOverTime` |
| `analyzeMelody` | `MelodyResult` | the `MelodyContour` summary fields, with the trajectory under `points: MelodyPoint[]` (`melody.pitches` in `analyze()`) |

### RoomMorphResult

`roomMorph(...)` returns the morphed audio together with what the target-room synthesis had to change to produce it:

```typescript
interface RoomMorphResult {
  audio: Float32Array;           // input length plus the target room's reverb tail
  sampleRate: number;
  diagnostics: RirDiagnostic[];  // every diagnostic the synthesis reported, in order
}

interface RirDiagnostic {
  code: string;       // stable id, e.g. 'acoustic.rir_length_clamped'
  message: string;
  severity: 'info' | 'warning' | 'error';
}
```

An unusable morph throws, and so does an unusable `synthesizeRir(...)` call, so neither result has an error flag and every entry in `diagnostics` is recoverable. Branch on `code`: `acoustic.ism_order_clamped` (image-source order reduced to the safe maximum), `acoustic.rir_length_clamped` (tail cut against `maxSeconds` or against a resource limit), `acoustic.rir_length_floored` (`maxSeconds` is shorter than the direct sound's flight time), `acoustic.rir_tail_truncated` (`maxSeconds` cuts the longest band before it decays by 60 dB) and `acoustic.no_late_tail` (no diffuse tail produced) each mean the morph went through a room other than the one requested, and none is visible in the audio itself. `synthesizeRir(...)` reports the same shape on `RirResult.diagnostics`. The C ABI publishes the same entries structurally (`sonare_last_diagnostic_count()`, `sonare_last_diagnostic_code(i)`, `sonare_last_diagnostic_message(i)`, `sonare_last_diagnostic_severity(i)`), so a caller there branches on the code too rather than parsing the joined `sonare_last_warning_message()` string.

### RoomMorphStereoResult

`roomMorphStereo({ left, right, sampleRate?, receiverSpacingM?, ... })` takes the same room options as `roomMorph(...)` and returns one morphed channel per input channel. The target room is heard at two omnidirectional receivers `receiverSpacingM` apart across the listener (metres, in (0, 4], default 0.5); each channel is convolved with its own receiver's response. `RoomMorphStereoResult` is `{ left, right, sampleRate, diagnostics }`: both `Float32Array` channels are the input length plus the reverb tail, and `diagnostics` carries the same codes as `RoomMorphResult.diagnostics`. Channels of different length, or a `receiverSpacingM` that is non-finite or outside (0, 4], throw `RangeError`. `sampleRate` defaults to 48000.

### Room estimate and RIR types

```typescript
interface RoomEstimateResult {
  volume: number;                // m^3; NaN with confidence 0 when no decay was measurable
  lengthM: number;               // the names synthesizeRir takes
  widthM: number;
  heightM: number;
  drrDb: number;
  confidence: number;
  bandAbsorption: Float32Array;
  rt60Bands: Float32Array;
}

interface RirResult {
  rir: Float32Array;
  sampleRate: number;
  diagnostics: RirDiagnostic[];  // warnings only; an unusable synthesis throws
}

type MaterialPresetName = 'none' | 'concrete' | 'wood' | 'curtain' | 'carpet' | 'glass';
type AcousticModeName = 'auto' | 'blind' | 'impulse_response';
interface RoomPlacement { x: number; y: number; z: number }  // meters
```

`materialPreset` and the estimate `mode` take these names only; a number is a `TypeError`. `roomGeometryFromEstimate(...)` turns a `RoomEstimateResult` into `RoomGeometryOptions` for `synthesizeRir(...)`; the result also carries `source` and `listener` (the default placement scaled per axis into the estimated room, identical to the default at 7 x 5 x 3) and a scalar `absorption` (the mean of the finite bands), and positions you pass override the scaled ones (see [Room Acoustics](./acoustic-analysis.md#from-an-estimate-to-a-synthesized-rir)).

### MasteringChainConfig

`masteringChain*` and `StreamingMasteringChain` use the nested config schema below. Every key is optional. Only the stages you set are activated; every stage object below (the `denoise` object form, `tilt`, `compressor`, `loudness` and the rest) also accepts `enabled?: boolean` to switch that stage explicitly (the listing omits it rather than repeat it), and flat dot-notation keys such as `"dynamics.compressor.thresholdDb"` are accepted on the same object and reach the core unchanged.

Stages always run in a fixed order:

<FlowDiagram
  title="Mastering chain order"
  :nodes="[
    { id: 'repair', label: 'Repair', col: 0, row: 0, variant: 'accent' },
    { id: 'eq', label: 'EQ', col: 1, row: 0 },
    { id: 'dynamics', label: 'Dynamics', col: 2, row: 0 },
    { id: 'saturation', label: 'Saturation', col: 3, row: 0 },
    { id: 'spectral', label: 'Spectral', col: 4, row: 0 },
    { id: 'stereo', label: 'Stereo', col: 5, row: 0 },
    { id: 'maximizer', label: 'Maximizer', col: 6, row: 0 },
    { id: 'loudness', label: 'Loudness', col: 7, row: 0, variant: 'success' }
  ]"
  :edges="[
    { from: 'repair', to: 'eq' },
    { from: 'eq', to: 'dynamics' },
    { from: 'dynamics', to: 'saturation' },
    { from: 'saturation', to: 'spectral' },
    { from: 'spectral', to: 'stereo' },
    { from: 'stereo', to: 'maximizer' },
    { from: 'maximizer', to: 'loudness' }
  ]"
  caption="Only the stages you configure are activated, but whichever are enabled run in this order."
/>

`masterAudio*` starts from a preset and accepts overrides using the same key names in flat dot-notation form, such as `"dynamics.compressor.thresholdDb"`.

`maximizer.truePeakLimiter.releaseMs` controls the post-limiter release time. Omit it to keep the preset/config default of 50 ms; if you provide a flat override, the value is applied directly. `maximizer.truePeakLimiter.applyGainAtInputRate` applies static loudness gain before oversampling when set, which is useful when you need that gain staged at the source rate for host parity.

`repair.denoise.reductionDb` (also reachable via the flat `repair.reductionDb` alias) sets the deepest attenuation, in dB, the gain mask may apply to any bin; it defaults to 26. The older `gainFloor` spelling (a linear floor rather than a dB depth) is still accepted and converted (`dB = -20*log10(gainFloor)`); the conversion carries the old validity range with it, so a floor above unity becomes a negative depth and is refused the same way.

::: details Full interface (click to expand)

```typescript
interface MasteringChainConfig {
  repair?: {
    denoise?: boolean | { mode?: number | 'logMmse' | 'mmseStsa' | 'spectralSubtraction';
                          noiseEstimator?: number | 'quantile' | 'mcra' | 'imcra' | 'spp'; nFft?: number;
                          hopLength?: number; ddAlpha?: number; reductionDb?: number;
                          gainFloor?: number; overSubtraction?: number;
                          spectralFloor?: number; noiseEstimationQuantile?: number;
                          speechPresenceGain?: boolean; gainSmoothing?: boolean; };
    nFft?: number; hopLength?: number; ddAlpha?: number; reductionDb?: number;
    /** @deprecated Use `denoise.reductionDb`; converted to it (dB = -20*log10(gainFloor)). */
    gainFloor?: number;
    declip?: { clipThreshold?: number; lpcOrder?: number; iterations?: number; lpcBlend?: number; };
    decrackle?: { threshold?: number; levels?: number;
                  mode?: number | 'median' | 'waveletShrinkage'; };
    dehum?: { fundamentalHz?: number; harmonics?: number; q?: number; adaptive?: boolean;
              searchRangeHz?: number; adaptation?: number; frameSize?: number;
              pllBandwidth?: number;
              mode?: number | 'subtract' | 'notch'; };
    declick?: { threshold?: number; neighborRatio?: number; maxClickSamples?: number;
                lpcOrder?: number; residualRatio?: number; };
    dereverb?: { threshold?: number; attenuation?: number; nFft?: number; hopLength?: number;
                 t60Sec?: number; lateDelayMs?: number; overSubtraction?: number;
                 spectralFloor?: number; wpeEnabled?: boolean; wpeIterations?: number;
                 wpeTaps?: number; wpeStrength?: number; };
  };
  eq?: {
    /** Canonical nested tilt stage. */
    tilt?: { tiltDb?: number; pivotHz?: number };
    /** @deprecated Use `eq.tilt.tiltDb`. */
    tiltDb?: number;
    /** @deprecated Use `eq.tilt.pivotHz`. */
    pivotHz?: number;
  };
  dynamics?: {
    compressor?: { thresholdDb?: number; ratio?: number; attackMs?: number; releaseMs?: number;
                   kneeDb?: number; makeupGainDb?: number; autoMakeup?: boolean; };
    deesser?: { frequencyHz?: number; thresholdDb?: number; ratio?: number; attackMs?: number;
                releaseMs?: number; rangeDb?: number; bandpassQ?: number; };
    transientShaper?: { attackGainDb?: number; sustainGainDb?: number; fastAttackMs?: number;
                        fastReleaseMs?: number; slowAttackMs?: number; slowReleaseMs?: number;
                        sensitivity?: number; maxGainDb?: number; gainSmoothingMs?: number;
                        lookaheadMs?: number; };
    multibandComp?: { lowCutoffHz?: number; highCutoffHz?: number;
                      lowThresholdDb?: number;  lowRatio?: number;
                      lowAttackMs?: number;     lowReleaseMs?: number;
                      midThresholdDb?: number;  midRatio?: number;
                      midAttackMs?: number;     midReleaseMs?: number;
                      highThresholdDb?: number; highRatio?: number;
                      highAttackMs?: number;    highReleaseMs?: number;
                      /** Arbitrary band count (2..64); `cutoffsHz` sets it to length + 1. */
                      crossover?: { cutoffsHz?: number[]; slope?: 'lr2' | 'lr4' | 'lr8' | number;
                                    mode?: 'linkwitzRiley' | 'butterworth' | 'bessel' | 'firLinearPhase' | number;
                                    firKernelSize?: number; };
                      /** Per-band compressor settings by band index. */
                      bands?: MultibandCompressorBand[]; };
  };
  saturation?: {
    tape?: { driveDb?: number; saturation?: number; hysteresis?: number; outputGainDb?: number;
             speedIps?: number; headBumpDb?: number; bias?: number; gapLoss?: number;
             oversampleFactor?: number; };
    exciter?: { frequencyHz?: number; driveDb?: number; amount?: number; q?: number;
                evenOddMix?: number; aliasing?: number; };
  };
  spectral?: {
    airBand?: { amount?: number; shelfFrequencyHz?: number;
                dynamicThresholdDb?: number; dynamicRangeDb?: number; };
  };
  stereo?: {
    imager?: { width?: number; outputGainDb?: number; decorrelationAmount?: number;
               preserveEnergy?: boolean; };
    monoMaker?: { amount?: number; frequencyHz?: number };
  };
  maximizer?: {
    truePeakLimiter?: { ceilingDb?: number; lookaheadMs?: number; releaseMs?: number;
                        oversampleFactor?: number; applyGainAtInputRate?: boolean; };
  };
  loudness?: { targetLufs?: number; ceilingDb?: number; truePeakOversample?: number;
               releaseMs?: number; applyGainAtInputRate?: boolean;
               maxLimiterGainReductionDb?: number; };
  /** Flat dot-notation keys are accepted alongside the nested form. */
  [flatKey: `${string}.${string}`]: number | boolean | undefined;
}

interface MasteringResult {              // masteringProcess, masteringPairProcess
  samples: Float32Array;
  sampleRate: number;
  inputLufs: number;
  outputLufs: number;
  appliedGainDb: number;
  loudnessTargetLimited?: boolean;
  latencySamples?: number;
  nonFiniteSubstitutionCount: number;    // samples a limiter replaced with a finite value
}
interface MasteringChainResult {         // masteringChain / masterAudio (and WithProgress)
  samples: Float32Array;                 // latency-compensated; there is no latencySamples
  sampleRate: number;
  inputLufs: number;
  outputLufs: number;
  appliedGainDb: number;
  stages: string[];
  outputTruePeakDbtp: number;
  outputLra: number;
  loudnessTargetLimited: boolean;
  nonFiniteSubstitutionCount: number;
  stageGainReductions: StageGainReduction[];
  report: MasteringReport;
}
interface MasteringStereoResult {        // masteringProcessStereo
  left: Float32Array;
  right: Float32Array;
  sampleRate: number;
  inputLufs: number;
  outputLufs: number;
  appliedGainDb: number;
  latencySamples: number;
  loudnessTargetLimited: boolean;
  nonFiniteSubstitutionCount: number;
}
// masteringChainStereo / masterAudioStereo (and WithProgress) return
// MasteringChainStereoResult: MasteringChainResult with left/right in place of
// samples. MasteringStereoChainResult is a @deprecated alias for it.
```

:::

Enum-valued repair keys take an ordinal or its name; the ordinals run from `0` in the order listed: `denoise.mode` (`'logMmse'`, `'mmseStsa'`, `'spectralSubtraction'`), `denoise.noiseEstimator` (`'quantile'`, `'mcra'`, `'imcra'`, `'spp'`), `decrackle.mode` (`'median'`, `'waveletShrinkage'`), and `dehum.mode` (`'subtract'`, `'notch'`).

The multiband compressor is configured from every chain call, not only from a version 2 chain document. `crossover.cutoffsHz` replaces the cutoff list and sets the band count (up to 64); `bands` addresses each band by index with a `MultibandCompressorBand`: `thresholdDb`, `ratio`, `attackMs`, `releaseMs`, `kneeDb`, `makeupGainDb`, `autoMakeup`, `detector` (`'peak'`, `'rms'`, `'logRms'` or the ordinal), `sidechainHpfEnabled`, `sidechainHpfHz`, `pdrTimeMs` and `pdrReleaseScale`, all optional (an omitted field keeps the base value). As flat keys these are `dynamics.multibandComp.crossover.cutoffsHz.<i>` and `dynamics.multibandComp.bands.<i>.<field>`, beside the in-place `cutoff<i>Hz` / `band<i>.<field>` spellings and the low/mid/high shorthand. Key order does not matter, and two spellings of one field in one call are refused. A stage with a single band is refused (`multiband stage needs at least two bands; one band is the compressor stage`). Enum names resolve on `dynamics.compressor.detector` and on the multiband slope, mode and per-band detector keys. With unity ratios the Linkwitz-Riley bands sum flat at the cutoff (0.00 dB at `lr2` and `lr4`), while the Butterworth and Bessel bands do not cancel there but add up: a 1 kHz tone at a 1 kHz cutoff reads +3.01 dB for Butterworth at `lr2` and `lr4`, and +2.68 dB (`lr2`) and +1.69 dB (`lr4`) for Bessel.

The glossary mastering guides explain when to reach for each section:
[Repair](./glossary/mastering/repair.md), [Tone and Air](./glossary/mastering/tone-air.md),
[Dynamics](./glossary/mastering/dynamics.md),
[Stereo, Limiter, Loudness](./glossary/mastering/stereo-limiter-loudness.md).

## Enumerations

### PitchClass

```typescript
const PitchClass = {
  C: 0, Cs: 1, D: 2, Ds: 3, E: 4, F: 5,
  Fs: 6, G: 7, Gs: 8, A: 9, As: 10, B: 11
} as const;
```

### Mode

`Mode` is the ordinal enum. Results report the mode as a name (`KeyMode`), so `detectKey`, `detectKeyCandidates`, `analyze` and `autoTune` return `mode: 'major'`, `'minor'`, `'dorian'`, and so on; do not compare it against `Mode.Major`. Inputs take either: `keyRoot` / `keyMode` of `detectChords`, `chordFunctionalAnalysis` and `Audio.chordFunctionalAnalysis` (request and positional forms), `chordFunctions`' `key` and `autoTune`'s `key` accept a pitch-class name (`'C#'`, `PitchClassName`) or number and a mode name or `Mode` ordinal, so a detected key passes straight back. An unknown name is a `RangeError` naming the field.

`KeyMode` is `'major' | 'minor' | 'dorian' | 'phrygian' | 'lydian' | 'mixolydian' | 'locrian'`; `PitchClassName` is `'C' | 'C#' | ... | 'B'` (sharps only).

```typescript
const Mode = {
  Major: 0,
  Minor: 1,
  Dorian: 2,
  Phrygian: 3,
  Lydian: 4,
  Mixolydian: 5,
  Locrian: 6
} as const;
```

### ChordQuality

```typescript
const ChordQuality = {
  Major: 0, Minor: 1, Diminished: 2, Augmented: 3,
  Dominant7: 4, Major7: 5, Minor7: 6, Sus2: 7, Sus4: 8,
  Unknown: 9, Add9: 10, MinorAdd9: 11, Dim7: 12,
  HalfDim7: 13, Major9: 14, Dominant9: 15, Sus2Add4: 16,
  Major6: 17, Minor6: 18, MinorMajor7: 19, Dominant7Sus4: 20,
  Dominant11: 21, Dominant13: 22,
  Dominant7Flat9: 23, Dominant7Sharp9: 24
} as const;
```

::: warning Sixths, `m7b5` and `7sus4` are anagrams of chords you already have
Three of these qualities share their exact pitch-class set with a quality that
was already in the enum, transposed:

- a `maj6` spells the `m7` a minor third below it (`C6` = `Am7`),
- a `min6` spells the `m7b5` a minor third below it (`Cm6` = `Am7b5`),
- a `7sus4` spells the `sus2add4` a fourth above it (`C7sus4` = `Fsus2add4`).

Nothing in a chromagram separates those pairs: the two readings are the same
twelve-dimensional vector. The detector therefore keeps the established reading
as the default and only promotes the sixth when the **bass** supports it, so a
passage a musician would write as `C6` will usually be reported as `Am7` unless
the bass sits on C. Treat `Major6` and `Minor6` as evidence about the bass, not
as a correction the detector will make from harmony alone.
:::

### SectionType

```typescript
const SectionType = {
  Intro: 0, Verse: 1, PreChorus: 2, Chorus: 3,
  Bridge: 4, Instrumental: 5, Outro: 6, Unknown: 7
} as const;
```

## Type Export Index

The WASM package exports TypeScript helper types in addition to functions and classes. Use these when typing options, realtime buffers, and callback payloads.

| Area | Exported types/constants |
|------|--------------------------|
| Environment and engine | `EXPECTED_ABI_VERSION`, `EXPECTED_ENGINE_ABI_VERSION`, `EXPECTED_PROJECT_ABI_VERSION`, `EngineCapabilities`, `ProgressCallback` |
| Engine lane mixer, markers, and MIDI clips | `EngineTrackLane`, `EngineTrackSend`, `EngineBus`, `EngineMarker`, `EngineMidiClipSchedule`, `EngineMidiEvent`, `ExternalMidiEvent`, `MarkerKind`, `ProjectMarker` |
| Key/chord/rhythm/timbre analysis | `ChordDetectionOptions`, `KeyMode`, `PitchClassName`, `KeyProfileName`, `BpmAnalysisResult`, `BpmCandidate`, `RhythmAnalysisResult`, `TimbreAnalysisResult`, `TimbreFrame`, `DynamicsResult`, `DynamicsAnalysisResult`, `MelodyResult` |
| Workers | `OfflineWorkerClient`, `OfflineWorkerClientOptions`, `OfflineWorkerCallOptions`, `OfflineWorkerProgress`, `OfflineWorkerTask`, `OfflineWorker`; see [Web Worker Usage](./wasm-advanced.md#web-worker-usage) |
| Spectral, pitch, and feature transforms | `MelPowerResult`, `StftMagnitudeResult`, `PitchCorrectOptions`, `VoicedFlags`, `SpectralRegionOp`, `SpectralEditOptions`, `TempogramMode`, `HarmonicRequest`, `HpssRequest`, `PercussiveRequest`, `AutoTuneRequest`, `PitchShiftRequest`, `TimeStretchRequest` |
| Paged clip streaming | `ClipPageStreamerEngine`, `ClipPageStreamerOptions`, `ClipPageStreamSource`, `OpfsClipStream`, `OpfsClipStreamOptions`, `OpfsClipPageProviderOptions` |
| Mastering and capability catalog | `MasteringProcessorParams`, `MasteringProcessorCatalogEntry`, `MasteringInsertParamInfo`, `MasteringInsertParamChoice`, `MasteringInsertSlot`, `MasteringInsertTiming`, `CapabilityCatalog`, `CapabilityCatalogParameter`, `CapabilityCatalogProcessor`, `CapabilityCatalogPresets`, `CapabilityCatalogMasteringPreset`, `CapabilityCatalogChain`, `CapabilityCatalogChainStage`, `CapabilityCatalogChainList`, `CapabilityCatalogChainAlias`, `MultibandCompressorBand`, `MasteringInsertParamDependency`, `MasteringChannelPolicy`, `MasteringChainStereoResult`, `MasteringStereoParamsRequest`, `MasteringStreamingPreviewStereoRequest`, `MeteringStereoRequest`, `MeteringStereoDecimatedRequest` |
| Streaming retune and EQ | `StreamingRetuneConfig`, `StreamingEqualizerConfig`, `EqBandType`, `EqBandPhase`, `EqCoeffMode`, `EqMatchOptions`, `EqStereoPlacement` |
| Realtime voice | `VoicePresetId`, `RealtimeVoiceChangerConfigInput`, `RealtimeVoiceChangerPodConfig`, `RealtimeVoiceChangerMonoBuffer`, `RealtimeVoiceChangerInterleavedBuffer`, `RealtimeVoiceChangerPlanarBuffer` |
| Mixing and Worklet realtime buffers | `MixerRealtimeBuffer`, `SonareScopeRingBuffer`, `SonareScopeRingReadResult`, `SonareWorkletScopeSnapshot` |
| Project and engine automation | `ProjectAssistSidecar`, `ProjectAssistSidecarInput`, `ProjectAutomationTargetKind`, `EngineTrackMonitorMode`, `TrackMonitorMode` |
| Pan-law inputs | `PanLaw`, `PanLawName`, `PanLawInput` |
| Controller and articulation value tables | `CONTROLLER_INPUTS`, `CONTROLLER_AXES`, `ARTICULATIONS` |
| Project automation target aliases | `PROJECT_AUTOMATION_TARGET_OPAQUE` (0), `PROJECT_AUTOMATION_TARGET_TRACK_FADER_DB` (1), `PROJECT_AUTOMATION_TARGET_TRACK_PAN` (2), `AutomationTargetKind` |
| Vocal edit handles | `VocalEditDraft`, `VocalRenderJob`, `VocalRenderSnapshot`; see [Vocal Editing](./vocal-editing.md) |

`SurroundPan` (the parameter type of `Mixer.setSurroundPan`) is not part of the package's public export list, so type it inline or with a local alias rather than importing it.

### Literal unions and enum-like tables

These exported string-literal unions name the values a field or call accepts. Each synth vocabulary also accepts the value's ordinal. `synthEnumTables()` returns the runtime tables represented by `SynthEnumTables` as `string[]`; the `retrigger` table is exported separately as `SYNTH_RETRIGGERS`.

| Type | Values | Where it appears |
|------|--------|------------------|
| `SynthEngineMode` | `'default'`, `'subtractive'`, `'fm'`, `'karplus-strong'`, `'modal'`, `'additive'`, `'percussion'`, `'piano'`, `'pipe-organ'`, `'bowed-string'`, `'reed'`, `'brass'`, `'flute'`, `'plucked-string'`, `'vocal'`, `'free-reed'`, `'harpsichord'`, `'sample'` | `SynthPatch.engineMode`; a patch that sets only an engine mode voices that engine's base preset; `'sample'` is silent until a bank is supplied |
| `SynthOscWaveform` | `'default'`, `'sine'`, `'saw'`, `'square'`, `'triangle'`, `'noise'` | `SynthPatch.waveform` |
| `SynthFilterModel` | `'default'`, `'svf'`, `'transistor-ladder'`, `'diode-ladder'`, `'sallen-key'` | `SynthPatch.filterModel` |
| `SynthFilterOutput` | `'default'`, `'lowpass'`, `'bandpass'`, `'highpass'` | `SynthPatch.filterOutput` (SVF only) |
| `SynthBodyType` | `'default'`, `'none'`, `'guitar'`, `'violin'`, `'wood-tube'`, `'brass-bell'`, `'vocal'` | `SynthPatch.body` |
| `SynthRetrigger` | `'default'`, `'free'`, `'note'` | `SynthPatch.retrigger`; exported as `SynthRetrigger` and `SYNTH_RETRIGGERS` on Node/WASM |
| `SynthModSource` | `'none'`, `'amp-env'`, `'filter-env'`, `'lfo1'`, `'lfo2'`, `'velocity'`, `'key-track'`, `'mod-wheel'`, `'random'`, `'breath'`, `'aftertouch'`, `'expression-cc'`, `'pitch-bend'` | `SynthModRouting.source` |
| `SynthModDestination` | `'none'`, `'pitch-cents'`, `'cutoff-cents'`, `'amp-gain'`, `'pan-units'`, `'resonance-q'`, `'vibrato-depth-cents'`, `'filter-env-depth'`, `'lfo1-rate-scale'`, `'excitation-force'`, `'excitation-position'`, `'excitation-brightness'`, `'spectrum-morph'` | `SynthModRouting.destination` |
| `SampleLoopMode` / `SampleKeyTrack` | `'default'`, `'none'`, `'continuous'`, `'key-down'` / `'default'`, `'on'`, `'off'` | `SynthPatch.sampleLoop` / `SynthPatch.sampleKeyTrack` |
| `SampleDescLoopMode` | `'none'`, `'continuous'`, `'key-down'` | `SampleDesc.loopMode`; the recording's own loop mode, a different set from `SampleLoopMode` |
| `BuiltinSynthWaveform` | `'sine'`, `'saw'`, `'sawtooth'`, `'square'`, `'triangle'`, or `0`–`3` | `BuiltinSynthConfig.waveform` |
| `ControllerInput` / `ControllerAxis` | `'control-change'`, `'channel-pressure'`, `'poly-pressure'`, `'pitch-bend'`, `'velocity'` / `'none'`, `'excitation'`, `'position'`, `'brightness'`, `'morph'`, `'loudness'`, `'pitch-cents'`, `'vibrato-depth'` | `ControllerBinding.input` / `.axis` for `RealtimeEngine.bindController` |
| `Articulation` | `'poly'`, `'mono-retrigger'`, `'mono-legato'` | `RealtimeEngine.setArticulation` |
| `MpeDimension` / `NoteTracking` | `'bend'`, `'pressure'`, `'timbre'` / `'last'`, `'lowest'`, `'highest'`, `'all'` | `RealtimeEngine.setControllerNoteTracking` |
| `SourceBackend` | `'sf2'`, `'synth'` | `Sf2ProgramStatus.backend` from `Project.soundFontManifest` |
| `EngineCaptureSource` | `'output'`, `'input'`, or the ordinal | `RealtimeEngine.setCaptureSource` |
| `ProjectTrackKind` | `'audio'`, `'midi'`, `'aux'`, or `0`–`2` | `Project.addTrack`, `Project.setTrackKind` |
| `ProjectLoopMode` | `'off'`, `'loop'`, or `0`–`1` | `Project.setClipLoop` |
| `ProjectFadeCurve` | `'linear'`, `'equal-power'` (also `'equal_power'`, `'equalPower'`, `'equalpower'`), `'exponential'`/`'exp'`, `'logarithmic'`/`'log'`, or `0`–`2` | `ProjectClipFade.curve` for `Project.setClipFade` |
| `MasteringProcessorCategory` | `'dynamics'`, `'effects'`, `'eq'`, `'final'`, `'maximizer'`, `'multiband'`, `'other'`, `'reference'`, `'repair'`, `'saturation'`, `'spectral'`, `'stereo'` | `MasteringProcessorCatalogEntry.category` from `masteringProcessorCatalog()` |
| `MasteringRealtimeCost` | `'low'`, `'moderate'`, `'high'` | `MasteringProcessorCatalogEntry.realtimeCost` (`null` when unrated) |
| `PairProcessor` | `'match.applyMatchEq'`, `'match.alignReferenceToSource'`, `'match.abSwitch'`, `'match.abCrossfade'` | `processorName` of `masteringPairProcess`; listed by `masteringPairProcessorNames()` |
| `PairAnalysis` | `'match.referenceLoudness'`, `'match.tonalBalance'`, `'match.tonalBalanceLogBands'`, `'match.matchEqCurve'`, `'match.estimateReferenceDelaySamples'` | `analysisName` of `masteringPairAnalyze`; listed by `masteringPairAnalysisNames()` |
| `StereoAnalysis` | `'stereo.monoCompatCheck'`, `'stereo.monoCompatCheckLogBands'` | `analysisName` of `masteringStereoAnalyze`; listed by `masteringStereoAnalysisNames()` |
| `DehumMode` | `'subtract'`, `'notch'` | `mode` of `masteringRepairDehum` |
| `MixAnalysisBand` | `'sub'`, `'low'`, `'lowMid'`, `'mid'`, `'highMid'`, `'high'`, `'air'` | keys of `MixBandOccupancy`; `MixCrowdedBand.band` in the mix assistant's analysis |
| `SpectralEditMode` / `SpectralEditWindow` | `'gain'`, `'attenuate'`, `'mute'`, `'heal'` / `'hann'`, `'hamming'`, `'blackman'`, `'rectangular'`, `'rect'` | `SpectralRegionOp.mode` / `SpectralEditOptions.window` for `spectralEdit` |
| `NoteTargetUnmatchedPolicy` | `'leave'` (default), `'mute'`, `'nearest'` | `unmatchedPolicy` of `assignNoteTargets` |

`MasteringInsertParamInfo` and `CapabilityCatalogParameter` use `id: number | null`, `choices: MasteringInsertParamChoice[] | null`, and `slot: string | null`. `CapabilityCatalogProcessor.slots` lists the conditional key groups described by `MasteringInsertSlot`. `CapabilityCatalog.masteringPresets` contains entries with `name`, `kind`, `targetLufs`, `truePeakCeilingDb`, and `maxLimiterGainReductionDb`; the three numeric fields are `null` for restoration presets. `SynthParamInfo` (returned by `synthEngineParamInfo(engineMode)` and `synthPatchParamInfo()`) has `name`, `type` (`'number'` or `'boolean'`), optional `integer`, `min` and `max`, `default` (`number | boolean`; a boolean for a switch) and `unit`, plus an optional `activeWhen` list of `SynthParamCondition` (`key`, `scope` `'engine'` or `'patch'`, `relation` one of `'eq'`, `'ne'`, `'gt'`, `'ge'`, `'lt'`, `'le'`, and `value`) as `SynthParamCondition[][]`: the field reaches the voice when every condition of at least one inner list holds; it is absent for an unconditional field, and a field without it may still act only under a performance or saturate past some value; `synthEngineParamInfo` is `[]` for the modes that have no section. For the voice-start behavior of `SynthPatch.retrigger`, see [Built-in Synthesizer](./native-synth.md#the-synthpatch-object).
