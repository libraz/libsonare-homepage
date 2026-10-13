---
title: Node.js Native Types
description: TypeScript type definitions and the exported type index of the @libraz/libsonare-native package.
---

# Node.js Native Types

This page lists the TypeScript interfaces, unions, and exported type names of the `@libraz/libsonare-native` package. For the functions and classes that use them, see [Node.js Native API](./node-api.md) and [Node.js Native Analysis and Effects](./node-api-analysis.md).

## Types

```typescript
interface Key {
  root: number;        // Pitch-class number, 0..11 (C = 0), as on WASM and Python
  mode: KeyMode;       // 'major' | 'minor' | 'dorian' | 'phrygian' | 'lydian' | 'mixolydian' | 'locrian'
  confidence: number;  // detectKey: softmax share in [0, 1); analyze(): chord-refined, up to 1
  name: string;        // "C major", "A minor"
  shortName: string;   // "C", "Am"
}

interface KeyDetection extends Key {
  tuning: number; // semitone fraction used for the chroma (given or measured)
}

interface TimeSignature {
  numerator: number;
  denominator: number;
  confidence: number;  // MeterEstimate.timeSignature: margin over the runner-up;
                       // MeterEstimate.candidates[]: share of summed support
}

interface BpmHypothesis {
  value: number;
  confidence: number;
  relation: 'primary' | 'half' | 'double' | 'other';
}

// One chord from detectChords(...). root/bass/quality are string labels;
// rootName/bassName carry the canonical core spelling, identical on every
// language binding. The quality union is the binding's own spelling — the
// C++ enum names the same 25 qualities differently.
interface Chord {
  root: string;
  bass: string;
  rootName: string;
  bassName: string;
  quality:
    | 'major' | 'minor' | 'diminished' | 'augmented'
    | 'dominant7' | 'major7' | 'minor7'
    | 'sus2' | 'sus4' | 'add9' | 'minorAdd9'
    | 'dim7' | 'halfDim7'
    | 'major9' | 'dominant9' | 'sus2Add4'
    | 'major6' | 'minor6' | 'minorMajor7' | 'dominant7Sus4'
    | 'dominant11' | 'dominant13' | 'dominant7Flat9' | 'dominant7Sharp9'
    | 'unknown';
  name: string;        // Canonical symbol, e.g. "Cmaj7", "Am/C", "N.C."
  start: number;       // Seconds
  end: number;         // Seconds
  duration: number;    // Seconds — end minus start
  confidence: number;
}

interface ChordAnalysisResult {
  chords: Chord[];
  tuning: number; // semitone fraction used for the chroma (given or measured)
}

type ChordFunction = 'tonic' | 'subdominant' | 'dominant' | 'chromatic' | 'none';

// A timed chord plus its place in a key, from chordFunctionalAnalysis(...) and chordFunctions(...).
type FunctionalChord<T = Chord> = T & {
  roman: string;            // 'I', 'V7'; 'N.C.' when the chord is unknown
  function: ChordFunction;
};

// The key chordFunctions(...) reads; detectKey's result fits as it is.
interface ChordFunctionsKey {
  root: string | number;    // pitch-class name or number
  mode: KeyMode | number;   // mode name or Mode ordinal
}

// 0=Intro, 1=Verse, 2=PreChorus, 3=Chorus, 4=Bridge, 5=Instrumental,
// 6=Outro, 7=Unknown.
type SectionTypeOrdinal = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

// One section from analyzeSections(...).
interface Section {
  type: SectionTypeOrdinal;
  name: string;        // Human-readable, e.g. "Chorus"
  start: number;       // Seconds
  end: number;         // Seconds
  energyLevel: number; // Relative energy, [0, 1]
  confidence: number;  // [0, 1]
}

// The chord shape inside AnalysisResult. Unlike the standalone Chord above,
// root and bass are pitch-class ordinals (0..11, C = 0) and quality is a
// ChordQuality ordinal; `name` carries the readable symbol either way.
interface AnalysisChord {
  root: number;
  bass: number;
  quality: number;
  start: number;
  end: number;
  confidence: number;
  name: string;        // e.g. "Cmaj7"
  romanNumeral: string; // relative to AnalysisResult.key; empty for N.C.
}

// The section shape inside AnalysisResult: the same fields as Section.
interface AnalysisSection {
  type: SectionTypeOrdinal;
  start: number;
  end: number;
  energyLevel: number;
  confidence: number;
  name: string;
}

interface AnalysisBeat {
  time: number;        // Seconds
  strength: number;    // Raw, unbounded onset-envelope frame nearest this beat
}

// Beat-level evidence the downbeat and meter decisions score — their input,
// not their output. Each stream runs parallel to beats, one value per beat.
// An empty stream means the analysis could not produce it, not that every
// beat scored zero.
interface BeatObservations {
  onsetStrength: number[];       // Windowed onset aggregate around each beat
  lowFrequencyEnergy: number[];  // Empty when the analysis ran without audio
  chordChange: number[];         // Empty until chords are analyzed
}

interface AnalysisResult {
  bpm: number;
  bpmConfidence: number;
  bpmCandidates: BpmHypothesis[];
  key: Key;
  timeSignature: TimeSignature;
  timeSignatureCandidates: TimeSignature[];
  beatTimes: Float32Array;                       // Derived from beats[].time
  beats: AnalysisBeat[];
  beatObservations: BeatObservations;            // Per-beat evidence
  beatLocalBpm: number[];                        // Empty unless computeTempoCurve
  downbeatIndices: number[];                     // Indices into beats
  downbeatPhase: number;                         // Beat index the first bar starts on
  chords: AnalysisChord[];                       // Detected chord progression
  sections: AnalysisSection[];                   // Song-structure sections
  timbre: AnalysisTimbre;                        // Aggregate timbre summary
  dynamics: AnalysisDynamics;                    // Aggregate dynamics summary
  rhythm: AnalysisRhythm;                        // Aggregate rhythm summary
  melody: AnalysisMelody;                        // Melody-contour summary
  form: string;                                  // Musical form label, e.g. "AABA"
  tuning: number;                                // Semitone fraction used for the chromagrams
}
// analyze() returns the full result above. The dedicated detect*/analyze*
// functions remain available for targeted or parameterized analysis.

interface HpssResult {
  harmonic: Float32Array;
  percussive: Float32Array;
  sampleRate: number;
}

interface StftResult {
  nBins: number;
  nFrames: number;
  nFft: number;
  hopLength: number;
  sampleRate: number;
  magnitude: Float32Array;  // nBins × nFrames, row-major
  power: Float32Array;      // nBins × nFrames, row-major
}

interface StftDbResult {
  nBins: number;
  nFrames: number;
  db: Float32Array;         // Power in decibels
}

interface MelSpectrogramResult {
  nMels: number;
  nFrames: number;
  sampleRate: number;
  hopLength: number;
  nFft: number;
  fmin: number;            // Lower Mel edge in Hz, as applied
  fmax: number;            // Upper edge as applied; Nyquist when the request used 0
  htk: boolean;
  isDb: boolean;           // false for a forward transform: power is linear
  power: Float32Array;      // nMels × nFrames, row-major
  db: Float32Array;         // nMels × nFrames, row-major
}

interface MfccResult {
  nMfcc: number;
  nFrames: number;
  sampleRate: number;
  hopLength: number;
  nFft: number;
  nMels: number;
  fmin: number;
  fmax: number;            // As applied
  htk: boolean;
  isDb: boolean;           // Always false: coefficients are a cepstrum
  lifter: number;          // 0 means none
  coefficients: Float32Array;  // nMfcc × nFrames, row-major
}

interface ChromaResult {
  nChroma: number;
  nFrames: number;
  sampleRate: number;
  hopLength: number;
  features: Float32Array;   // nChroma × nFrames, row-major
  meanEnergy: number[];     // nChroma values
}

interface PitchResult {
  f0: Float32Array;         // Fundamental frequency per frame (Hz)
  voicedProb: Float32Array; // Voicing probability per frame (0–1)
  voicedFlag: boolean[];    // Voiced/unvoiced decision per frame
  nFrames: number;
  medianF0: number;
  meanF0: number;
}

// Per-frame voicing decision, one entry per f0Hz frame. Accepted by the
// `voiced` argument and by PitchCorrectOptions.voiced.
type VoicedFlags =
  | Int32Array
  | Uint8Array
  | Float32Array
  | readonly number[]
  | readonly boolean[];

type MasteringAssistantParams = Record<string, number | boolean | string>;

interface MasteringAssistantSuggestStereoRequest {
  left: Float32Array;
  right: Float32Array;
  sampleRate?: number;
  params?: MasteringAssistantParams;
}

interface MasteringAudioProfileStereoRequest {
  left: Float32Array;
  right: Float32Array;
  sampleRate?: number;
  params?: Record<string, number | boolean>;
}

interface MasteringStreamingPreviewStereoRequest {
  left: Float32Array;
  right: Float32Array;
  sampleRate?: number;
  platforms?: StreamingPlatform[];
}

interface MeteringStereoRequest {
  left: Float32Array;
  right: Float32Array;
  sampleRate?: number;
  validate?: boolean;
}

// Equivalent-room estimate from estimateRoom(...); lengths in metres.
interface RoomEstimateResult {
  volume: number;               // m^3; NaN with confidence 0 when no decay could be measured
  lengthM: number;
  widthM: number;
  heightM: number;
  drrDb: number;                // direct-to-reverberant ratio
  confidence: number;
  bandAbsorption: Float32Array; // per octave band, same length as rt60Bands
  rt60Bands: Float32Array;      // seconds per octave band
}
```

`Key.root` is a number, the form `detectChords` and `chordFunctions` take back: the `keyRoot` / `keyMode` inputs of `detectChords`, `chordFunctionalAnalysis` and `Audio.chordFunctionalAnalysis` and the `key` of `chordFunctions` accept a pitch-class name (`'C#'`) or number and a mode name or `Mode` ordinal, so a detected key passes straight back. An unknown name is a `RangeError` naming the field. `Chord.root` and `Chord.bass` remain string labels.

### What `Key.confidence` measures

`Key.confidence` from `detectKey` and `detectKeyCandidates` is a softmax over the
profile correlation of every scored candidate. It lies in `[0, 1)`, the candidates' confidences sum to 1, and a
share of 24 candidates therefore cannot reach 1. It falls as the runner-up
closes in, so two keys that split the evidence — a relative major and minor,
typically — each report about half.

Read it as how decisively the chroma picked one candidate out of the set, **not
as how often that pick is right**: nothing here is calibrated against annotated
recordings, so a confident wrong answer is entirely possible. A pipeline that
branches on it has to pick its own threshold against its own material.

`analyze()` is different. It refines its key against the detected chords, so
`AnalysisResult.key` can name a different key than `detectKey` on the same
input, and its `confidence` is a combined score that can reach 1 rather than a
softmax share. Use `detectKey` when you need the share reading.

### Chord-tone anagrams

::: warning A sixth and a seventh can spell the same notes
A `major6` spells the same four pitch classes as the `minor7` a minor third
below it, a `minor6` the same as the `halfDim7` a minor third below, and a
`dominant7Sus4` the same as the `sus2Add4` a fourth above. Nothing in a
chromagram separates a pair like that, so the established reading stays the
default and only bass evidence promotes the sixth.
:::

### Reading the beat fields

`downbeatIndices` indexes into `beats` — it is a membership check on the beat
grid, not a separate time series, so it is not the same length as `beats`.
`downbeatPhase` is the beat index the first measure starts on.

Each beat's `strength` is a single **raw, unbounded** onset-envelope frame: its
scale depends on the material, and it shifts with beat-position jitter because
nothing is averaged around the beat. `beatObservations.onsetStrength` is the
windowed value the library's own downbeat pass scores, and is the intended
accent source for anything that reads accents — `estimateMeter(...)` above, or a
renderer drawing beat emphasis.

The native package also exports TypeScript helper types for option objects, callbacks, streaming snapshots, and realtime engine messages. Use these names when annotating application code instead of re-declaring the shapes locally.

| Area | Exported types |
|------|----------------|
| Analysis options/results | `AnalysisProgressCallback`, `AnalysisBeat`, `BeatObservations`, `BpmCandidate`, `Chord`, `ChordAnalysisResult`, `AnalysisChord`, `AnalysisSection`, `ChordChromaMethod`, `EstimateMeterRequest`, `KeyMode`, `KeyProfile`, `MelodyPoint`, `MeterEstimate`, `Section`, `SectionTypeOrdinal`, `TempogramMode`, `TrimSilenceMode`, `DetectKeyOptions`, `KeyDetection`, `ChordFunction`, `ChordFunctionsInput`, `ChordFunctionsKey`, `FunctionalChord`, `ScaleName` |
| Decoding | `DecodedChannels`, `ChannelLayout` |
| Feature extraction | `DecomposeStemsRequest`, `DecomposeStemsResult`, `DecomposeStemsLinkedRequest`, `DecomposeStemsLinkedResult`, `NoteSegment`, `NoteSegmentsRequest` |
| Streaming analysis | `StreamAnalyzerConfig`, `StreamAnalyzerStats`, `StreamFramesSoa`, `StreamProgressiveEstimate`, `StreamChordChange`, `StreamBarChord`, `StreamPatternScore` |
| Mastering and metering | `MasteringPreset`, `MasteringInsertParamInfo`, `MasteringInsertTiming`, `MasteringProcessorCatalogEntry`, `MasteringInsertSlot`, `SoloProcessor`, `StreamingPlatform`, `DynamicsProcessorResult`, `CompressorDetector`, `DecrackleMode`, `DenoiseClassicalMode`, `DenoiseClassicalNoiseEstimator`, `EqBandInput`, `EqPhaseMode`, `EqSpectrumSnapshot`, `NormalizeMode`, `MasteringRepairStage`, `MasteringRepairStageName`, `MasteringRepairAnalysis`, `MasteringRepairAnalyzeRequest`, `MasteringRepairApplyRequest`, `MasteringRepairApplyResult`, `MasteringRepairStageReports`, `StreamingLoudnessGainRequest`, `StreamingLoudnessGainStereoRequest`, `StreamingLoudnessGainResult` |
| Capability catalog | `Capabilities`, `CapabilityCatalog`, `CapabilityCatalogParameter`, `CapabilityCatalogProcessor`, `CapabilityCatalogPresets`, `CapabilityCatalogMasteringPreset`, `CapabilityCatalogChain`, `CapabilityCatalogChainStage`, `CapabilityCatalogChainList`, `CapabilityCatalogChainAlias`, `MasteringInsertParamChoice`, `MasteringInsertParamUnit`, `MasteringInsertParamScale`, `MasteringInsertParamRelation`, `MasteringInsertParamDependency` |
| Stereo mastering and metering requests | `MasteringAssistantSuggestStereoRequest`, `MasteringAudioProfileStereoRequest`, `MasteringStreamingPreviewStereoRequest`, `MeteringStereoRequest`, `NormalizeStereoRequest`, `NormalizeStereoResult` |
| Pitch correction | `PitchCorrectOptions`, `VoicedFlags`, `AutoTuneKey`, `AutoTuneOptions`, `AutoTuneResult` |
| Room acoustics | `AcousticModeName`, `MaterialPresetName`, `RoomGeometryFromEstimateOptions`, `RoomMorphOptions`, `RoomMorphResult`, `RoomMorphStereoResult`, `RoomPlacement` |
| Mastering chain config | `MasteringChainConfig`, `MasteringChainConfigDocument`, `MultibandCompressorBand` |
| Synth descriptors | `SynthParamInfo`, `SynthParamCondition`, `SynthPatch`, `SynthEngineMode` |
| Mixing | `AutomationCurve`, `GoniometerPoint`, `MeterTap`, `MixMeterSnapshot`, `MixResult`, `MixerProcessResult`, `PanLaw`, `PanLawName`, `PanLawInput`, `PanMode`, `SendTiming`, `SidechainCheck`, `SidechainRefusal` |
| Realtime voice | `VoicePresetId`, `VoicePresetCategory`, `RealtimeVoiceChangerPresetMetadata`, `RealtimeVoiceChangerPreset`, `RealtimeVoiceChangerConfigInput`, `RealtimeVoiceChangerConfig`, `RealtimeVoiceChangerOptions` |
| Realtime engine graph | `EngineGraphSpec`, `EngineGraphNode`, `EngineGraphNodeType`, `EngineGraphConnection`, `EngineGraphMix`, `EngineGraphParameterBinding`, `EngineParameterInfo` |
| Realtime engine transport | `EngineTransportState`, `EngineMarker`, `EngineClip`, `EngineAutomationPoint`, `EngineAutomationPointCurve`, `EngineMetronomeConfig`, `EngineTrackMonitorMode` |
| Project metadata and automation | `ExternalInstrument`, `ExternalInstrumentEvent`, `ProjectAssistSidecar`, `ProjectAssistSidecarInput`, `ProjectAutomationTargetKind`, `ProjectAutomationLaneDesc` |
| Realtime engine jobs/telemetry | `EngineBounceOptions`, `EngineBounceResult`, `EngineFreezeOptions`, `EngineFreezeResult`, `EngineCaptureStatus`, `EngineTelemetry`, `EngineTelemetryType`, `EngineTelemetryError`, `EngineMeterTelemetry` |

`CapabilityCatalog.masteringPresets` contains entries with `name`, `kind`, `targetLufs`, `truePeakCeilingDb`, and `maxLimiterGainReductionDb`; restoration entries set the three numeric fields to `null`. `CapabilityCatalogProcessor.slots` describes conditional parameter groups, and `MasteringInsertParamInfo` adds the corresponding `slot` to each descriptor. The catalog's `chain` section (`CapabilityCatalogChain`) describes every flat mastering chain key: the stages (`CapabilityCatalogChainStage`), the indexed lists with their item counts (`CapabilityCatalogChainList`), the keys no processor carries, and every alias spelling (`CapabilityCatalogChainAlias`); `presets.playbackRoom` is always present. A descriptor's `unit` is a `MasteringInsertParamUnit` (a closed set, `null` for non-numeric keys), `scale` a `MasteringInsertParamScale` (`'linear'` or `'log'`), and `dependsOn` a list of `MasteringInsertParamDependency` (`key`, `relation`, `factor`, read as `this <relation> factor * sibling`) whose `relation` is a `MasteringInsertParamRelation`; `coupledWith` is a `string[]` of the other siblings that move the key's accepted range (`min` / `max` are measured with them at their defaults); `uiMin` and `uiMax` give the display range. Every processor entry also carries `causal`. `masteringInsertTiming(name, params, sampleRate)` returns `MasteringInsertTiming` with `latencySamples` and `tailSamples`, while `masteringPresetParams(preset)` returns a flat `Record<string, number | boolean>` suitable for `masterAudio({ samples, overrides })`.
