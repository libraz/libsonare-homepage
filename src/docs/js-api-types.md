---
title: JavaScript/TypeScript Types and Errors
description: Type definitions, enumerations, error handling, and the type export index of the libsonare JavaScript/TypeScript package.
---

# JavaScript/TypeScript Types and Errors

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
  chords: Chord[];
  sections: Section[];
  timbre: Timbre;
  dynamics: Dynamics;
  rhythm: RhythmFeatures;
  melody: MelodyContour;
  form: string;  // e.g., "IABABCO"
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
a per-beat flag. `downbeatPhase` is the meter estimator's phase — the beat index
the first measure starts on, in `[0, timeSignature.numerator)` — so
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
tempo, not `bpm` resampled — which also means a curve decoded from a fixed beat
grid describes that grid, so measuring a tempo that actually moves wants
`adaptiveTempo` set as well.

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

To score accents — to decide which beats are strong — use
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
```

`duration` is derived from `end - start` — the core carries only the two
endpoints — so it is a convenience, not an independent measurement. Filtering
passing chords out of a progression reads better through it than through the
subtraction.

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
  confidence: number;
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

### MasteringChainConfig

`masteringChain*` and `StreamingMasteringChain` use the nested config schema below. Every key is optional. Only the stages you set are activated.

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

`repair.denoise.reductionDb` (also reachable via the flat `repair.reductionDb` alias) sets the deepest attenuation, in dB, the gain mask may apply to any bin; it defaults to 26. The older `gainFloor` spelling — a linear floor rather than a dB depth — is still accepted and converted (`dB = -20*log10(gainFloor)`); the conversion carries the old validity range with it, so a floor above unity becomes a negative depth and is refused the same way.

::: details Full interface (click to expand)

```typescript
interface MasteringChainConfig {
  repair?: {
    denoise?: boolean;
    nFft?: number; hopLength?: number; ddAlpha?: number; reductionDb?: number;
    /** @deprecated Use `reductionDb`; converted to it (dB = -20*log10(gainFloor)). */
    gainFloor?: number;
    declip?: { enabled?: boolean; clipThreshold?: number; lpcOrder?: number;
               iterations?: number; lpcBlend?: number; };
    decrackle?: { enabled?: boolean; threshold?: number;
                  /** 0 = median, 1 = wavelet shrinkage. */
                  mode?: number; levels?: number; };
    dehum?: { enabled?: boolean; fundamentalHz?: number; harmonics?: number;
              q?: number; adaptive?: boolean; searchRangeHz?: number;
              adaptation?: number; frameSize?: number; pllBandwidth?: number; };
    declick?: { threshold?: number; neighborRatio?: number; maxClickSamples?: number;
                lpcOrder?: number; residualRatio?: number; };
    dereverb?: { threshold?: number; attenuation?: number; nFft?: number;
                 hopLength?: number; t60Sec?: number; lateDelayMs?: number;
                 overSubtraction?: number; spectralFloor?: number;
                 wpeEnabled?: boolean; wpeIterations?: number; wpeTaps?: number;
                 wpeStrength?: number; };
  };
  eq?: {
    /** Canonical nested tilt stage. */
    tilt?: { enabled?: boolean; tiltDb?: number; pivotHz?: number };
    /** @deprecated Use `eq.tilt.tiltDb`. */
    tiltDb?: number;
    /** @deprecated Use `eq.tilt.pivotHz`. */
    pivotHz?: number;
  };
  dynamics?: {
    compressor?: { thresholdDb?: number; ratio?: number; attackMs?: number;
                   releaseMs?: number; kneeDb?: number; makeupGainDb?: number;
                   autoMakeup?: boolean; };
    deesser?: { frequencyHz?: number; thresholdDb?: number; ratio?: number;
                attackMs?: number; releaseMs?: number; rangeDb?: number;
                bandpassQ?: number; };
    transientShaper?: { attackGainDb?: number; sustainGainDb?: number;
                        fastAttackMs?: number; fastReleaseMs?: number;
                        slowAttackMs?: number; slowReleaseMs?: number;
                        sensitivity?: number; maxGainDb?: number;
                        gainSmoothingMs?: number; lookaheadMs?: number; };
    multibandComp?: { lowCutoffHz?: number; highCutoffHz?: number;
                      lowThresholdDb?: number;  lowRatio?: number;
                      lowAttackMs?: number;     lowReleaseMs?: number;
                      midThresholdDb?: number;  midRatio?: number;
                      midAttackMs?: number;     midReleaseMs?: number;
                      highThresholdDb?: number; highRatio?: number;
                      highAttackMs?: number;    highReleaseMs?: number; };
  };
  saturation?: {
    tape?: { driveDb?: number; saturation?: number; hysteresis?: number;
             outputGainDb?: number; speedIps?: number; headBumpDb?: number;
             bias?: number; gapLoss?: number; };
    exciter?: { frequencyHz?: number; driveDb?: number; amount?: number;
                q?: number; evenOddMix?: number; };
  };
  spectral?: {
    airBand?: { amount?: number; shelfFrequencyHz?: number;
                dynamicThresholdDb?: number; dynamicRangeDb?: number; };
  };
  stereo?: {
    imager?: { width?: number; outputGainDb?: number;
               decorrelationAmount?: number; preserveEnergy?: boolean; };
    monoMaker?: { amount?: number; frequencyHz?: number };
  };
  maximizer?: {
    truePeakLimiter?: { ceilingDb?: number; lookaheadMs?: number;
                        releaseMs?: number; oversampleFactor?: number;
                        applyGainAtInputRate?: boolean; };
  };
  loudness?: { targetLufs?: number; ceilingDb?: number;
               truePeakOversample?: number; };
}

interface MasteringResult {
  samples: Float32Array;
  sampleRate: number;
  inputLufs: number;
  outputLufs: number;
  appliedGainDb: number;
  loudnessTargetLimited?: boolean;
  latencySamples?: number;
}
interface MasteringChainResult extends MasteringResult {
  stages: string[];
  outputTruePeakDbtp: number;
  outputLra: number;
  loudnessTargetLimited: boolean;
  stageGainReductions: StageGainReduction[];
  report: MasteringReport;
}
interface MasteringStereoResult {
  left: Float32Array;
  right: Float32Array;
  sampleRate: number;
  inputLufs: number;
  outputLufs: number;
  appliedGainDb: number;
  latencySamples: number;
}
// Returned by masteringChainStereo / masterAudioStereo (and their
// WithProgress variants); MasteringStereoResult is the return type of
// masteringProcessStereo. There is no latencySamples field — the offline
// chain output is already latency-compensated.
interface MasteringChainStereoResult {
  left: Float32Array;
  right: Float32Array;
  sampleRate: number;
  inputLufs: number;
  outputLufs: number;
  appliedGainDb: number;
  stages: string[];
  outputTruePeakDbtp: number;
  outputLra: number;
  loudnessTargetLimited: boolean;
  stageGainReductions: StageGainReduction[];
  report: MasteringReport;
}
// MasteringStereoChainResult is a @deprecated alias for
// MasteringChainStereoResult, retained for source compatibility with the
// Node and Python bindings.
```

:::

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
- a `7sus4` spells the `sus2add4` a fourth below it (`C7sus4` = `Gsus2add4`).

Nothing in a chromagram separates those pairs — the two readings are the same
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

## Error Handling

All functions throw if the module is not initialized — call `await init()` first.

Native (C++) failures throw a structured **`SonareError`**: an `Error` subclass carrying a numeric `code` and its canonical `codeName`, mirroring the C ABI error enum. The same failure reports the same numeric code on every binding (WASM, Node native, Python, C ABI), so you can branch on the cause instead of matching message text. The package exports the `ErrorCode` enum, the `SonareError` class, and an `isSonareError(value)` type guard.

The facades consistently reject non-finite numbers, invalid enum/index values, and oversized resources before they reach DSP or serialization. Treat these failures as invalid input; do not rely on a binding silently clamping or accepting malformed values.

```typescript
import { ErrorCode, isSonareError, Mixer } from '@libraz/libsonare';

try {
  const mixer = Mixer.fromSceneJson(sceneJson, 48000, 512);
} catch (error) {
  if (isSonareError(error) && error.code === ErrorCode.InvalidState) {
    // 'failed to build mixer from scene JSON: send timing must be a string ("pre" or "post")'
    console.error(`scene rejected: ${error.codeName}: ${error.message}`);
  } else {
    throw error;
  }
}
```

`Mixer.fromSceneJson` reports **`InvalidState`**, not `InvalidParameter`, for
every way a scene can fail to build — a rejected field value and malformed JSON
alike. The construction is wrapped, so the underlying complaint arrives as the
tail of a `failed to build mixer from scene JSON: <inner>` message rather than as
its own code; branch on `InvalidState` and show the message to locate the field.

| `ErrorCode` | Value |
|-------------|-------|
| `Ok` | `0` |
| `FileNotFound` | `1` |
| `InvalidFormat` | `2` |
| `DecodeFailed` | `3` |
| `InvalidParameter` | `4` |
| `OutOfMemory` | `5` |
| `NotSupported` | `6` |
| `InvalidState` | `7` |
| `Cancelled` | `8` |
| `EncodeFailed` | `9` |
| `Unknown` | `99` |

The codes match Python's `SonareError.code` and the C ABI `SonareError` enum, and the Python CLI maps them onto its [exit codes](./cli.md#exit-codes).

## Type Export Index

The WASM package exports TypeScript helper types in addition to functions and classes. Use these when typing options, realtime buffers, and callback payloads.

| Area | Exported types/constants |
|------|--------------------------|
| Environment and engine | `EXPECTED_ENGINE_ABI_VERSION`, `EXPECTED_PROJECT_ABI_VERSION`, `EngineCapabilities`, `ProgressCallback` |
| Engine lane mixer, markers, and MIDI clips | `EngineTrackLane`, `EngineTrackSend`, `EngineBus`, `EngineMarker`, `EngineMidiClipSchedule`, `EngineMidiEvent`, `ExternalMidiEvent`, `MarkerKind`, `ProjectMarker` |
| Key/chord/rhythm/timbre analysis | `ChordDetectionOptions`, `KeyProfileName`, `RhythmAnalysisResult`, `TimbreAnalysisResult`, `TimbreFrame`, `DynamicsAnalysisResult` |
| Spectral, pitch, and feature transforms | `MelPowerResult`, `StftPowerResult`, `PitchCorrectOptions`, `VoicedFlags`, `SpectralRegionOp`, `SpectralEditOptions`, `TempogramMode` |
| Paged clip streaming | `ClipPageStreamerEngine`, `ClipPageStreamerOptions`, `ClipPageStreamSource`, `OpfsClipStream`, `OpfsClipStreamOptions`, `OpfsClipPageProviderOptions` |
| Mastering | `MasteringProcessorParams`, `MasteringProcessorCatalogEntry`, `MasteringInsertParamInfo`, `MasteringChannelPolicy`, `MasteringChainStereoResult`, `MasteringStereoParamsRequest`, `MasteringStreamingPreviewStereoRequest` |
| Metering requests | `MeteringStereoRequest`, `MeteringStereoDecimatedRequest` |
| Streaming retune | `StreamingRetuneConfig` |
| Streaming EQ | `StreamingEqualizerConfig`, `EqBandType`, `EqBandPhase`, `EqCoeffMode`, `EqMatchOptions`, `EqStereoPlacement` |
| Realtime voice | `VoicePresetId`, `RealtimeVoiceChangerConfigInput`, `RealtimeVoiceChangerPodConfig`, `RealtimeVoiceChangerMonoBuffer`, `RealtimeVoiceChangerInterleavedBuffer`, `RealtimeVoiceChangerPlanarBuffer` |
| Mixing and Worklet realtime buffers | `MixerRealtimeBuffer`, `SonareScopeRingBuffer`, `SonareScopeRingReadResult`, `SonareWorkletScopeSnapshot` |
| Project and engine automation | `ProjectAssistSidecar`, `ProjectAssistSidecarInput`, `ProjectAutomationTargetKind`, `EngineTrackMonitorMode`, `TrackMonitorMode` |
| Pan-law inputs | `PanLaw`, `PanLawName`, `PanLawInput` |

`SurroundPan` (the parameter type of `Mixer.setSurroundPan`) is not part of the package's public export list — type it inline or with a local alias rather than importing it.
