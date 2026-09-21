---
title: Node.js Native Types
description: TypeScript type definitions and the exported type index of the @libraz/libsonare-native package.
---

# Node.js Native Types

This page lists the TypeScript interfaces, unions, and exported type names of the `@libraz/libsonare-native` package. For the functions and classes that use them, see [Node.js Native API](./node-api.md) and [Node.js Native Analysis and Effects](./node-api-analysis.md).

## Types

```typescript
interface Key {
  root: string;        // Pitch-class name, e.g. "C", "C#", "A"
  mode: string;        // Mode name, e.g. "major", "minor"
  confidence: number;  // Softmax over every scored candidate, in [0, 1)
  name: string;        // "C major", "A minor"
  shortName: string;   // "C", "Am"
}

interface TimeSignature {
  numerator: number;
  denominator: number;
  confidence: number;
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
  power: Float32Array;      // nMels × nFrames, row-major
  db: Float32Array;         // nMels × nFrames, row-major
}

interface MfccResult {
  nMfcc: number;
  nFrames: number;
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

interface MasteringAssistantSuggestStereoRequest {
  left: Float32Array;
  right: Float32Array;
  sampleRate?: number;
  params?: Record<string, number | boolean>;
}

// Same fields; a distinct name for the profile entry point.
interface MasteringAudioProfileStereoRequest extends MasteringAssistantSuggestStereoRequest {}

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
```

### What `Key.confidence` measures

`Key.confidence` is a softmax over the profile correlation of every scored
candidate. It lies in `[0, 1)`, the candidates' confidences sum to 1, and a
share of 24 candidates therefore cannot reach 1. It falls as the runner-up
closes in, so two keys that split the evidence — a relative major and minor,
typically — each report about half.

Read it as how decisively the chroma picked one candidate out of the set, **not
as how often that pick is right**: nothing here is calibrated against annotated
recordings, so a confident wrong answer is entirely possible. A pipeline that
branches on it has to pick its own threshold against its own material.

### Chord-tone anagrams

::: warning A sixth and a seventh can spell the same notes
A `major6` spells the same four pitch classes as the `minor7` a minor third
below it, a `minor6` the same as the `halfDim7` a minor third below, and a
`dominant7Sus4` the same as the `sus2Add4` a fourth below. Nothing in a
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
| Analysis options/results | `AnalysisProgressCallback`, `AnalysisBeat`, `BeatObservations`, `BpmCandidate`, `Chord`, `ChordAnalysisResult`, `AnalysisChord`, `AnalysisSection`, `ChordChromaMethod`, `EstimateMeterRequest`, `KeyMode`, `KeyProfile`, `MelodyPoint`, `MeterEstimate`, `Section`, `SectionTypeOrdinal`, `TempogramMode`, `TrimSilenceMode` |
| Feature extraction | `DecomposeStemsRequest`, `DecomposeStemsResult`, `NoteSegment`, `NoteSegmentsRequest` |
| Streaming analysis | `StreamAnalyzerConfig`, `StreamAnalyzerStats`, `StreamFramesSoa`, `StreamProgressiveEstimate`, `StreamChordChange`, `StreamBarChord`, `StreamPatternScore` |
| Mastering and metering | `MasteringPreset`, `SoloProcessor`, `StreamingPlatform`, `DynamicsProcessorResult`, `CompressorDetector`, `DecrackleMode`, `DenoiseClassicalMode`, `DenoiseClassicalNoiseEstimator`, `EqBandInput`, `EqPhaseMode`, `EqSpectrumSnapshot`, `NormalizeMode` |
| Stereo mastering and metering requests | `MasteringAssistantSuggestStereoRequest`, `MasteringAudioProfileStereoRequest`, `MasteringStreamingPreviewStereoRequest`, `MeteringStereoRequest`, `NormalizeStereoRequest`, `NormalizeStereoResult` |
| Pitch correction | `PitchCorrectOptions`, `VoicedFlags` |
| Mixing | `AutomationCurve`, `GoniometerPoint`, `MeterTap`, `MixMeterSnapshot`, `MixResult`, `MixerProcessResult`, `PanLaw`, `PanLawName`, `PanLawInput`, `PanMode`, `SendTiming` |
| Realtime voice | `VoicePresetId`, `VoicePresetCategory`, `RealtimeVoiceChangerPresetMetadata`, `RealtimeVoiceChangerPreset`, `RealtimeVoiceChangerConfigInput`, `RealtimeVoiceChangerConfig`, `RealtimeVoiceChangerOptions` |
| Realtime engine graph | `EngineGraphSpec`, `EngineGraphNode`, `EngineGraphNodeType`, `EngineGraphConnection`, `EngineGraphMix`, `EngineGraphParameterBinding`, `EngineParameterInfo` |
| Realtime engine transport | `EngineTransportState`, `EngineMarker`, `EngineClip`, `EngineAutomationPoint`, `EngineAutomationPointCurve`, `EngineMetronomeConfig`, `EngineTrackMonitorMode` |
| Project metadata and automation | `ProjectAssistSidecar`, `ProjectAssistSidecarInput`, `ProjectAutomationTargetKind`, `ProjectAutomationLaneDesc` |
| Realtime engine jobs/telemetry | `EngineBounceOptions`, `EngineBounceResult`, `EngineFreezeOptions`, `EngineFreezeResult`, `EngineCaptureStatus`, `EngineTelemetry`, `EngineTelemetryType`, `EngineTelemetryError`, `EngineMeterTelemetry` |
