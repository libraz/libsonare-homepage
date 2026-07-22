# JavaScript/TypeScript API Reference

API reference for the libsonare JavaScript/TypeScript package.

## Overview

libsonare provides audio analysis, mastering, mixing, and editing DSP capabilities for web applications. The npm package is the WebAssembly build. In practice, most functions expect decoded `Float32Array` PCM: the raw sample values after an MP3, WAV, or other file has already been decoded. For loading, the `Audio.fromMemory*` factories can decode encoded bytes in memory (a native WASM decoder for WAV/MP3, plus an optional browser decoder for AAC/OGG/FLAC).

For a first browser integration, keep the path narrow:

1. call `await init()` once when your app starts;
2. decode the user file into samples and keep its `sampleRate`;
3. call one small function such as `detectBpm(samples, sampleRate)`;
4. only then move to `analyze`, mastering, mixing, or streaming APIs.

| Category | Functions | Use Cases |
|----------|-----------|-----------|
| **Quick Analysis** | `detectBpm`, `detectKey`, `detectBeats` | DJ apps, music players, beat sync |
| **All-In-One Analysis** | `analyze`, `analyzeWithProgress` | Music production, song metadata |
| **Audio Effects** | `hpss`, `timeStretch`, `pitchShift`, `spectralEdit` | Remixing, practice tools, region repair |
| **Features** | `melSpectrogram`, `chroma`, `mfcc` | ML input, visualization |
| **Mastering** | `masterAudio`, `masteringChain`, `StreamingMasteringChain` | LUFS targets, true-peak limiting, presets, streaming chains |
| **Mixing** | `mixStereo`, `Mixer`, `mixingScenePresetNames` | Stem mixing, routing, automation, meters |
| **Editing DSP** | `pitchCorrectToMidi`, `noteStretch`, `spectralEdit`, `voiceChange`, `StreamingRetune`, `RealtimeVoiceChanger` | Vocal tuning, note edits, pitch/formant changes |
| **Audio Class** | `Audio.fromBuffer`, `Audio.fromMemory`, `Audio.fromMemoryWithBrowserFallback` | File-loading helper and method-style access for common functions |

::: tip Terminology
New to audio analysis? See the [Glossary](/docs/glossary) for explanations of terms like BPM, STFT, Chroma, and more.
:::

::: info Most functions take decoded PCM, not a file path
Most browser functions do not take an MP3 or WAV path; they take decoded PCM samples plus `sampleRate`. To go from encoded bytes to samples, either decode with the Web Audio API (`AudioContext.decodeAudioData`) yourself, or use the `Audio.fromMemory` / `Audio.fromMemoryWithBrowserFallback` factories below. They decode encoded bytes in memory: WAV/MP3 with the bundled WASM decoder, and AAC/OGG/FLAC through browser decoding when needed.
:::

For a cross-binding feature map, see [Feature Map](./api-surface.md). For the mastering processor registry and mixing scene format, see [Mastering Processors](./mastering-processors.md) and [Mixing Scene JSON](./mixing-scene-json.md).

## How To Read This Reference

Read this page in three passes:

1. Start with [Pick The Smallest API That Solves The Job](#pick-the-smallest-api-that-solves-the-job) and choose one function family.
2. Read only the section for that family, then run one recipe from [Examples](./examples.md).
3. Come back to the full type definitions when you need exact return shapes, optional parameters, or runtime parity.

For browser apps, keep the core rule in mind: initialize WASM with `await init()`, decode files to PCM first, then pass `Float32Array` samples plus the original `sampleRate`.

## One-shot request objects

The top-level one-shot analysis, effects, mastering, metering, feature, mixer, and voice-changer APIs use a named **request object** as their canonical form. Every input is named, optional settings can grow without changing argument order, and TypeScript can guide you to the matching `*Request` type. Positional forms are compatibility overloads with identical defaults, validation, errors, results, and progress behavior.

```typescript
// Preferred request-object form
const bpm = detectBpm({ samples, sampleRate });
const mastered = masterAudio({
  samples,
  sampleRate,
  preset: 'pop',
  overrides: { loudness: { targetLufs: -14 } },
  onProgress: (progress, stage) => console.log(stage, progress),
});

// Still supported for existing callers
const legacyBpm = detectBpm(samples, sampleRate);
```

The request fields use the same camelCase names on the Node and WASM packages. Python remains keyword-oriented (`detect_bpm(samples, sample_rate=...)`), rather than adopting a JavaScript-style options object.

## Pick The Smallest API That Solves The Job

The package is broad, so start from the task rather than the function list:

| You need | Start with | Why |
|----------|------------|-----|
| One tempo/key/beat value for a track | `detectBpm`, `detectKey`, `detectBeats` | Fast, direct answers without building the all-in-one analysis object |
| Metadata for a whole song | `analyze` or the focused `analyze*` helpers | `analyze` gives the common summary; focused helpers expose more detail |
| A live visualizer or updating BPM/key/chord UI | `StreamAnalyzer` | Processes small audio blocks and lets the UI read the newest frames |
| Browser mastering or delivery preview | `masterAudio*`, `masteringChain*`, `StreamingMasteringChain` | Use presets first, then move to named processors when you need control |
| Stem balance, sends, buses, or meters | `mixStereo` or `Mixer` | One-shot mix first; persistent scene mixer when routing matters |
| Vocal/note/spectral edits | `pitchCorrectToMidi`, `noteStretch`, `spectralEdit`, `voiceChange`, `StreamingRetune`, `RealtimeVoiceChanger` | Editing DSP changes the signal rather than analyzing it |
| Room decay, clarity, equivalent-room estimates, or generated room character | `analyzeImpulseResponse`, `detectAcoustic`, `estimateRoom`, `synthesizeRir`, `roomMorph` | These describe or apply the recording space, not the music |

## Installation

::: code-group

```bash [npm]
npm install @libraz/libsonare
```

```bash [yarn]
yarn add @libraz/libsonare
```

```bash [pnpm]
pnpm add @libraz/libsonare
```

:::

## Import

```typescript
import {
  init,
  Audio,
  detectBpm,
  detectKey,
  detectBeats,
  detectOnsets,
  analyze,
  analyzeWithProgress,
  version
} from '@libraz/libsonare';
```

## Initialization

### `init(options?)`

Initialize the WASM module. Must be called before any analysis functions.

```typescript
async function init(options?: {
  locateFile?: (path: string, prefix: string) => string;
}): Promise<void>
```

**Example:**

```typescript
import { init, detectBpm } from '@libraz/libsonare';

// Basic initialization
await init();

// With custom file location
await init({
  locateFile: (path, prefix) => `/custom/wasm/path/${path}`
});
```

### `isInitialized()`

Check if the module is initialized.

```typescript
function isInitialized(): boolean
```

### `version()`

Get the library version.

```typescript
function version(): string  // e.g., "{{ wasmMeta.version }}"
```

### `abiVersion()`

Returns the aggregate native ABI version across the C POD surfaces. Persist or compare it when loading a prebuilt binary so an incompatible JS/native artifact pair fails early.

```typescript
function abiVersion(): number
```

### `projectAbiVersion()`

ABI version of the project/editing POD API used by `Project` serialization, bounce, and realtime-engine clip exchange.

```typescript
function projectAbiVersion(): number
```

### `voiceChangerAbiVersion()`

ABI version of the realtime voice-changer POD config used by native and FFI APIs. This is separate from preset JSON `schemaVersion`, currently `1`. Check user-authored presets with `validateRealtimeVoiceChangerPresetJson(...)` before accepting them.

```typescript
function voiceChangerAbiVersion(): number
```

### Voice Preset Accessors

Use these when you need the canonical voice-character preset ID or the resolved flat POD config without parsing preset JSON.

```typescript
function voiceCharacterPresetId(preset: VoicePresetId | number): string | null
function realtimeVoiceChangerPresetConfig(preset: VoicePresetId | number): RealtimeVoiceChangerPodConfig | null
```

In v1.5.1 the resolved `RealtimeVoiceChangerPodConfig` uses camelCase keys on both JavaScript surfaces (`inputGainDb`, `wetMix`, `formantFactor`, `limiterIspCeilingDbtp`, and so on). The equivalent C and Python POD fields remain snake_case.

### Realtime environment helpers

These helpers describe the runtime capabilities used by [`RealtimeEngine`](./realtime-engine.md). Use them before wiring AudioWorklet/SharedArrayBuffer paths, especially when the page may run under different browser isolation policies.

```typescript
function engineAbiVersion(): number
function engineCapabilities(): {
  engineAbiVersion: number;
  expectedEngineAbiVersion: number;
  abiCompatible: boolean;
  sharedArrayBuffer: boolean;
  atomics: boolean;
  audioWorklet: boolean;
  mode: 'sab' | 'postMessage';
}
function hasFfmpegSupport(): boolean
```

`hasFfmpegSupport()` reports whether the loaded build can decode through FFmpeg. The browser/WASM npm package works on decoded PCM and normally returns `false`; Python/native builds are the intended place to decode files directly.

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
  confidence: number;    // 0.0 to 1.0
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
function detectOnsets(samples: Float32Array, sampleRate: number): Float32Array
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
function analyze(samples: Float32Array, sampleRate?: number): AnalysisResult  // sampleRate default: 22050
```

**Returns:** Complete `AnalysisResult`. A single `analyze()` call returns the
full result — chords, sections, timbre, dynamics, rhythm, melody, form, and
per-beat strength — on every binding, so you rarely need the focused helpers
unless you only want one field.

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

### `chordFunctionalAnalysis(samples, keyRoot, keyMode, sampleRate?, options?)`

Functional (Roman-numeral) harmonic analysis of the detected chord progression,
relative to the given key. It runs chord detection internally and labels each
detected chord, so pass the same `keyRoot`/`keyMode` you get from `detectKey(...)`
and the same `options` you would give `detectChords(...)`.

```typescript
function chordFunctionalAnalysis(
  samples: Float32Array,
  keyRoot: PitchClass,
  keyMode: Mode,
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

## Room Acoustics

These functions describe or apply the recording space rather than the song itself.

| Goal | Use |
|------|-----|
| Measure a clean impulse response | `analyzeImpulseResponse(...)` |
| Estimate room decay from ordinary audio | `detectAcoustic(...)` |
| Fit a practical room model from audio | `estimateRoom(...)` |
| Create a mono room impulse response from dimensions | `synthesizeRir(...)` |
| Add a target-room character as an effect | `roomMorph(...)` |

::: info RIR and room morphing
**RIR** means room impulse response: samples that describe how a room reacts to a short sound. `roomMorph(...)` is a creative effect, not dereverberation.
:::

```typescript
const ir = analyzeImpulseResponse(impulseResponseSamples, sampleRate, 6);
console.log(ir.rt60, ir.edt, ir.c50, ir.c80, ir.confidence);

const blind = detectAcoustic(roomRecording, sampleRate, {
  nOctaveBands: 6,
  nThirdOctaveSubbands: 24,
  minDecayDb: 30,
  noiseFloorMarginDb: 10,
});
console.log(blind.isBlind, blind.rt60Bands);

const estimate = estimateRoom(roomRecording, sampleRate, {
  referenceAbsorption: 0.15,
  nOctaveBands: 6,
});
console.log(estimate.volume, estimate.length, estimate.width, estimate.height);
console.log(estimate.drrDb, estimate.confidence, estimate.absorptionBands);

const rir = synthesizeRir({ lengthM: 7, widthM: 5, heightM: 3, absorption: 0.2 });
console.log(rir.sampleRate, rir.rir.length, rir.hasError);

const morphed = roomMorph(samples, sampleRate, { lengthM: 12, widthM: 9, heightM: 4, wet: 0.6 });
```

See [Room Acoustics](./acoustic-analysis.md) for how to interpret RT60, EDT, C50, C80, D50, band arrays, room estimates, generated RIRs, and confidence.

## Audio Effects

### `hpss(samples, sampleRate, kernelHarmonic?, kernelPercussive?)` <Badge type="warning" text="Heavy" />

Harmonic-Percussive Source Separation. Splits audio into tonal (vocals, synths) and transient (drums) components.

::: info Use Cases
- **Remixing**: Isolate drums or remove them
- **Karaoke**: Extract instrumental by removing vocals (use harmonic)
- **Better Analysis**: Use harmonic-only for cleaner chord detection
- **Drum Extraction**: Get just the percussion for sampling
:::

<SonareDemo id="waveform-harmonics" />

::: tip Performance
HPSS requires STFT computation and median filtering. Processing time scales with audio duration.
:::

```typescript
function hpss(
  samples: Float32Array,
  sampleRate: number,
  kernelHarmonic?: number,    // default: 31
  kernelPercussive?: number   // default: 31
): HpssResult

interface HpssResult {
  harmonic: Float32Array;
  percussive: Float32Array;
  sampleRate: number;
}
```

### `harmonic(samples, sampleRate)` <Badge type="warning" text="Heavy" />

Extract harmonic component from audio.

```typescript
function harmonic(samples: Float32Array, sampleRate: number): Float32Array
```

### `percussive(samples, sampleRate)` <Badge type="warning" text="Heavy" />

Extract percussive component from audio.

```typescript
function percussive(samples: Float32Array, sampleRate: number): Float32Array
```

### `timeStretch(samples, sampleRate, rate)` <Badge type="warning" text="Heavy" />

Time-stretch audio without changing pitch. Rate < 1.0 = slower, > 1.0 = faster.

::: info Use Cases
- **Practice Tools**: Slow down music to learn difficult passages
- **DJ Mixing**: Match tempos between tracks
- **Podcast Editing**: Speed up/slow down speech
- **Music Production**: Fit samples to project tempo
:::

<SonareDemo id="time-stretch" />

::: tip Performance
Uses phase vocoder algorithm. Processing time increases with audio duration.
:::

```typescript
function timeStretch(
  samples: Float32Array,
  sampleRate: number,
  rate: number   // 0.5 = half speed, 2.0 = double speed
): Float32Array
```

### `pitchShift(samples, sampleRate, semitones)` <Badge type="warning" text="Heavy" />

Pitch-shift audio without changing duration. Measured in semitones (+12 = one octave up).

::: info Use Cases
- **Key Matching**: Transpose songs to match for mixing
- **Vocal Tuning**: Correct or adjust vocal pitch
- **Creative Effects**: Create harmonies, chipmunk/deep voice effects
- **Instrument Practice**: Transpose to comfortable key
:::

::: tip Performance
Combines time stretching and resampling. Processing time increases with audio duration.
:::

```typescript
function pitchShift(
  samples: Float32Array,
  sampleRate: number,
  semitones: number   // +12 = one octave up
): Float32Array
```

### Editing DSP

These functions change the signal itself rather than only analyzing it. They are
also available as `Audio` instance methods, where the stored `sampleRate` is
used automatically.

```typescript
function pitchCorrectToMidi(
  samples: Float32Array,
  sampleRate: number,
  currentMidi: number,
  targetMidi: number,
): Float32Array

// Retune a tracked pitch contour to a fixed target note, frame by frame.
// f0Hz is a per-frame f0 track (e.g. from pitchYin/pitchPyin), aligned to
// hopLength. Pass the matching voiced/voicedProb arrays to skip unvoiced
// frames; unvoiced or NaN frames are left untouched.
function pitchCorrectToMidiTimevarying(
  samples: Float32Array,
  f0Hz: Float32Array,
  targetMidi: number,
  sampleRate: number,
  hopLength: number,
  voiced?: Int32Array,
  voicedProb?: Float32Array,
): Float32Array

// Snap a tracked pitch contour to a musical scale (auto-tune) or a fixed note.
// mode 'scale' pulls every voiced frame to the nearest enabled scale tone;
// mode 'midi' (the default) behaves like pitchCorrectToMidiTimevarying.
function pitchCorrectTimevarying(
  samples: Float32Array,
  f0Hz: Float32Array,       // per-frame f0 track aligned to hopLength
  sampleRate?: number,      // default 22050
  hopLength?: number,       // default 512
  options?: PitchCorrectOptions,
): Float32Array

interface PitchCorrectOptions {
  mode?: 'midi' | 'scale';         // default 'midi'
  targetMidi?: number;             // fixed note for 'midi' mode; default 69 (A4)
  scaleRoot?: number;              // scale root pitch class 0-11; default 0 (C)
  scaleModeMask?: number;          // 12-bit degree mask; default C major
  referenceMidi?: number;          // scale-grid anchor; default 69 (A4)
  retuneAmount?: number;           // 0 = bypass, 1 = full snap; default 1
  maxCorrectionSemitones?: number; // per-frame clamp in semitones; default 12
  retuneSpeedMs?: number;          // glide time constant; default 50
  vibratoThresholdCents?: number;  // corrections below this are bypassed; default 20
  voiced?: Int32Array;             // per-frame voiced flags (non-zero = voiced)
  voicedProb?: Float32Array;       // per-frame voicing probability 0-1
}

function noteStretch(
  samples: Float32Array,
  sampleRate: number,
  options?: {
    onsetSample?: number,    // note onset position in samples
    offsetSample?: number,   // note offset position in samples
    stretchRatio?: number,   // >1 lengthens the region, <1 shortens it
  },
): Float32Array

function spectralEdit(
  samples: Float32Array,
  sampleRate: number,
  ops?: Array<{
    startSample?: number;
    endSample?: number;
    lowHz?: number;
    highHz?: number;
    gainDb?: number;
    mode?: 'gain' | 'attenuate' | 'mute' | 'heal';
  }>,
  options?: {
    nFft?: number;
    hopLength?: number;
    window?: 'hann' | 'hamming' | 'blackman' | 'rectangular';
    healRadiusFrames?: number;
  },
): Float32Array

function voiceChange(
  samples: Float32Array,
  sampleRate?: number,        // default: 22050
  options?: {
    pitchSemitones?: number,  // negative shifts down; default 0
    formantFactor?: number,   // >1 brightens, <1 darkens; default 1.0
  },
): Float32Array
```

CLI equivalents:

```bash
sonare pitch-correct vocal.wav --current-midi 68.7 --target-midi 69 -o corrected.wav
sonare note-stretch take.wav --onset 12000 --offset 24000 --ratio 1.25 -o held.wav
sonare voice-change vocal.wav --pitch-semitones 3 --formant-factor 1.05 -o voice.wav
```

`pitchCorrectTimevarying(...)` is the scale-snap auto-tune path; see [Editing DSP](./editing-dsp.md) for the scale masks, `mode`, and retune-feel options in full. See [Spectral Editing](./spectral-editing.md) for region examples and option notes.

### `normalize(samples, sampleRate, targetDb?)`

Normalize audio to target peak level.

```typescript
function normalize(
  samples: Float32Array,
  sampleRate: number,
  targetDb?: number   // default: 0.0 (full scale)
): Float32Array
```

### `trim(samples, sampleRate, thresholdDb?)`

Trim silence from beginning and end of audio.

```typescript
function trim(
  samples: Float32Array,
  sampleRate: number,
  thresholdDb?: number   // default: -60.0
): Float32Array
```

This is the simple `Audio`-level threshold trim. For librosa-compatible
frame/RMS silence detection that also returns the original start/end sample
range, use `trimSilence(...)` below.

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
  sampleRate: number,
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
  sampleRate: number,
  nFft?: number,
  hopLength?: number
): Float32Array

// Spectral bandwidth in Hz
function spectralBandwidth(
  samples: Float32Array,
  sampleRate: number,
  nFft?: number,
  hopLength?: number
): Float32Array

// Spectral rolloff frequency in Hz
function spectralRolloff(
  samples: Float32Array,
  sampleRate: number,
  nFft?: number,
  hopLength?: number,
  rollPercent?: number  // default: 0.85
): Float32Array

// Spectral flatness (0 = tonal, 1 = noise-like)
function spectralFlatness(
  samples: Float32Array,
  sampleRate: number,
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
  sampleRate: number,
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
  sampleRate: number,
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
| Decomposition and remixing | `decompose(...)`, `decomposeWithInit(...)`, `nnFilter(...)`, `remix(...)`, `phaseVocoder(...)`, `hpssWithResidual(...)` | NMF factorization, selectable NMF initialization, nearest-neighbor filtering, interval remixing, time scaling, and HPSS residual output. |
| Reconstruct approximate audio/features | `melToStft`, `melToAudio`, `mfccToMel`, `mfccToAudio`, `cqtToAudio`, `vqtToAudio` | Griffin-Lim based inverse paths for visualization, debugging, and feature round-trips. CQT/VQT inputs are magnitude matrices. |
| Delivery loudness measurements | `lufs`, `lufsInterleaved`, `momentaryLufs`, `shortTermLufs`, `ebur128LoudnessRange` | ITU-R BS.1770 / EBU R128 style loudness values, including multichannel integrated loudness and LRA. |

```typescript
const cqtResult = cqt(samples, sampleRate, 512, 32.7, 84, 12);
const vqtResult = vqt(samples, sampleRate, 512, 32.7, 84, 12, 0);
const pseudo = pseudoCqt(samples, sampleRate);
const hybrid = hybridCqt(samples, sampleRate);
const cqtChroma = chromaCqt(samples, sampleRate);
const nnls = nnlsChroma(samples, sampleRate);
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
const stretched = phaseVocoder(samples, 1.5, sampleRate);
const hpssResidual = hpssWithResidual(samples, sampleRate);
const multichannel = lufsInterleaved(interleavedStereo, 2, sampleRate);
const lra = ebur128LoudnessRange(samples, sampleRate);
const reconstructed = melToAudio(mel.power, mel.nMels, mel.nFrames, sampleRate);
const cqtPreview = cqtToAudio(cqtResult.magnitude, cqtResult.nBins, cqtResult.nFrames, sampleRate, 512, 32.7, 12);
const vqtPreview = vqtToAudio(vqtResult.magnitude, vqtResult.nBins, vqtResult.nFrames, sampleRate, 512, 32.7, 12, 0, 32);
```

`chromaCqt(samples, sampleRate?, hopLength?, nChroma?)` is the direct
`librosa.feature.chroma_cqt` equivalent (log-frequency / constant-Q pitch
folding), while `nnlsChroma` is a distinct note-activation (NNLS) chroma that
suppresses harmonic leakage — often cleaner for chord or bass-register work.

Closest CLI equivalents from the source-built C++ CLI:

```bash [C++ CLI]
sonare cqt song.wav
sonare vqt song.wav
sonare nnls-chroma song.wav
sonare lufs song.wav --json
sonare mel-to-audio song.wav -o mel-preview.wav
```

For reconstruction limits and parameter notes, see [Inverse Features](./inverse-features.md). For librosa-parity details, see [librosa Compatibility](./librosa-compatibility.md).

### Pitch Detection <Badge type="info" text="Medium" />

```typescript
// YIN algorithm
function pitchYin(
  samples: Float32Array,
  sampleRate: number,
  frameLength?: number,  // default: 2048
  hopLength?: number,    // default: 512
  fmin?: number,         // default: 65 Hz
  fmax?: number,         // default: 2093 Hz
  threshold?: number,    // default: 0.3
  fillNa?: boolean       // default: false; true writes 0 for unvoiced f0 frames
): PitchResult

// pYIN algorithm (probabilistic YIN with HMM smoothing)
function pitchPyin(
  samples: Float32Array,
  sampleRate: number,
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

By default, unvoiced `f0` frames remain `NaN`. Set `fillNa: true` when a downstream numeric pipeline cannot carry `NaN` and should treat unvoiced frames as `0`.

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

## Metering

Standalone meters report level, dynamics, and stereo-image statistics from a decoded buffer. They are independent of the mastering chain and the streaming engine: pass a `Float32Array` or a left/right pair and get back a value or report. Every function accepts optional `options` with a `validate` flag (default `true`); set `validate: false` to skip NaN/Inf input checks on hot paths.

### Single-channel level meters

```typescript
// Sample peak, dBFS
function meteringPeakDb(samples: Float32Array, sampleRate?: number, options?: ValidateOptions): number
// RMS level, dBFS
function meteringRmsDb(samples: Float32Array, sampleRate?: number, options?: ValidateOptions): number
// Crest factor (peak − RMS), dB
function meteringCrestFactorDb(samples: Float32Array, sampleRate?: number, options?: ValidateOptions): number
// Mean (DC) offset, linear amplitude
function meteringDcOffset(samples: Float32Array, sampleRate?: number, options?: ValidateOptions): number
// Inter-sample (true) peak, dBFS. oversampleFactor is a power of two in 1..16 (0 / omit = 4)
function meteringTruePeakDb(samples: Float32Array, sampleRate?: number, oversampleFactor?: number, options?: ValidateOptions): number
```

### Clipping and dynamic range

```typescript
function meteringDetectClipping(
  samples: Float32Array,
  sampleRate?: number,
  options?: MeteringDetectClippingOptions
): ClippingReport

interface MeteringDetectClippingOptions extends ValidateOptions {
  threshold?: number;        // linear absolute threshold, default 0.999
  minRegionSamples?: number; // minimum run length to report, default 1
}

function meteringDynamicRange(
  samples: Float32Array,
  sampleRate?: number,
  options?: MeteringDynamicRangeOptions
): DynamicRangeReport

interface MeteringDynamicRangeOptions extends ValidateOptions {
  windowSec?: number;      // 0 / omit = 3 s
  hopSec?: number;         // 0 / omit = 1 s
  lowPercentile?: number;  // omit or negative = 0.10 (0 is a literal 0th percentile)
  highPercentile?: number; // omit or negative = 0.95
}

interface ClippingReport {
  clippedSamples: number;
  clippingRatio: number;
  maxClippedPeak: number;
  regions: ClippingRegion[];
}
interface ClippingRegion {
  startSample: number;
  endSample: number;
  length: number;
  peak: number;
}
interface DynamicRangeReport {
  dynamicRangeDb: number;
  lowPercentileDb: number;
  highPercentileDb: number;
  windowRmsDb: Float32Array;
}
```

### Stereo image

```typescript
// Pearson correlation between channels, −1..1
function meteringStereoCorrelation(left: Float32Array, right: Float32Array, sampleRate?: number, options?: ValidateOptions): number
// Mid/side stereo width: 0 = mono, ~1 = wide stereo; unbounded above
// (Infinity when the mid signal is silent, such as fully out-of-phase audio)
function meteringStereoWidth(left: Float32Array, right: Float32Array, sampleRate?: number, options?: ValidateOptions): number
// Per-sample mid/side point series
function meteringVectorscope(left: Float32Array, right: Float32Array, sampleRate?: number, options?: ValidateOptions): VectorscopeReport
// Phase-scope point series plus summary stats
function meteringPhaseScope(left: Float32Array, right: Float32Array, sampleRate?: number, options?: ValidateOptions): PhaseScopeReport

// Display-sized mid/side vectorscope: like meteringVectorscope but the point series is
// deterministically decimated to at most maxPoints (0 / >= length = one point per sample).
function meteringVectorscopeDecimated(left: Float32Array, right: Float32Array, sampleRate?: number, maxPoints?: number, options?: ValidateOptions): VectorscopeReport
// Display-sized phase scope: like meteringPhaseScope but the point series is decimated to at
// most maxPoints; summary stats are still computed over the full-resolution signal.
function meteringPhaseScopeDecimated(left: Float32Array, right: Float32Array, sampleRate?: number, maxPoints?: number, options?: ValidateOptions): PhaseScopeReport

interface VectorscopeReport {
  mid: Float32Array;
  side: Float32Array;
}
interface PhaseScopeReport {
  mid: Float32Array;
  side: Float32Array;
  radius: Float32Array;
  angleRad: Float32Array;
  correlation: number;
  averageAbsAngleRad: number;
  maxRadius: number;
}
```

`meteringStereoCorrelation`, `meteringStereoWidth`, `meteringVectorscope`, and `meteringPhaseScope` require `left` and `right` to be the same length.

`meteringStereoWidth` is a side-to-mid energy ratio, not a normalized percentage: `0` is pure mono, around `1` is a wide stereo signal, and larger finite values mean increasingly decorrelated or out-of-phase content. Do not clamp it to `2`; when the mid channel is silent it deliberately returns `Infinity`.

### Spectrum snapshot

`meteringSpectrum` is Welch-averaged over the **whole** signal (split into 50%-overlapping Hann frames whose power spectra are averaged). For a true single-frame snapshot that is not time-averaged, use `meteringSpectrumFrame`, whose `frameOffset` positional argument selects where the analysis frame starts.

```typescript
function meteringSpectrum(
  samples: Float32Array,
  sampleRate?: number,
  options?: SpectrumOptions & ValidateOptions
): SpectrumReport

// True single-frame snapshot (one Hann-windowed nFft FFT), NOT time-averaged like meteringSpectrum.
// The analysis frame spans [frameOffset, frameOffset + nFft); samples past the end are zero-padded.
function meteringSpectrumFrame(
  samples: Float32Array,
  sampleRate?: number,
  frameOffset?: number,
  options?: SpectrumOptions & ValidateOptions
): SpectrumReport

interface SpectrumOptions {
  nFft?: number;                 // 0 / omit = 2048
  applyOctaveSmoothing?: boolean;
  octaveFraction?: number;       // e.g. 3 = 1/3-octave; 0 / omit = 3
  dbRef?: number;                // 0 / omit = 1.0
  dbAmin?: number;               // 0 / omit = library floor
}
interface SpectrumReport {
  frequencies: Float32Array;
  magnitude: Float32Array;
  power: Float32Array;
  db: Float32Array;
  nFft: number;
  sampleRate: number;
}
```

## Scale Quantization

12-TET scale helpers for building pitch-correction targets. `modeMask` is a 12-bit mask where bit *i* enables the *i*-th pitch class relative to `root` (a `PitchClass`, C = 0); natural major is `0b101010110101`. `referenceMidi` is the tuning anchor (pass `0` for A4 = 69).

```typescript
// Snap a (possibly fractional) MIDI number to the nearest enabled pitch class
function scaleQuantizeMidi(root: number, modeMask: number, midi: number, referenceMidi?: number): number
// Correction (quantized − input), in semitones
function scaleCorrectionSemitones(root: number, modeMask: number, midi: number, referenceMidi?: number): number
// Is pitchClass (0..11) enabled by modeMask relative to root?
function scalePitchClassEnabled(root: number, modeMask: number, pitchClass: number): boolean
```

Pair `scaleQuantizeMidi(...)` with `pitchCorrectToMidi(...)` to retune a detected note to the nearest scale degree.

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
```

`trimSilence` (`librosa.effects.trim`) uses frame RMS and a `topDb` distance below
the peak RMS, returning the trimmed audio plus the original `[startSample, endSample)`
range — distinct from the simpler `trim(samples, sampleRate, thresholdDb)`.
`splitSilence` (`librosa.effects.split`) returns non-silent intervals as sample-index pairs.

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

## Audio Class

The `Audio` class is the method-style entry point for common one-shot functions. It stores the samples and sample rate internally, so you do not need to pass them to every call. More specialized helpers, such as section/melody/timbre/dynamics analysis and room-acoustic estimation, remain standalone functions in the WASM package.

### `Audio.fromBuffer(samples, sampleRate)`

Create an Audio instance from raw sample data.

```typescript
const audio = Audio.fromBuffer(samples, 44100);
```

`sampleRate` is optional and defaults to `48000`. Always pass the buffer's
actual sample rate, since the stored value feeds every instance method.

### `Audio.fromMemory(bytes)`

Decode encoded audio bytes (`Uint8Array`) such as WAV or MP3 with the native WASM decoder and return an `Audio` instance. Throws a `SonareError` when the format is not supported by the bundled decoder.

```typescript
const audio = Audio.fromMemory(new Uint8Array(await file.arrayBuffer()));
```

### `Audio.fromMemoryWithBrowserFallback(bytes, options?)`

`async`; returns `Promise<Audio>`. Tries `Audio.fromMemory` first. If the bundled decoder cannot read the format, it uses the browser codec stack (`AudioContext.decodeAudioData`) for formats such as AAC, OGG, and FLAC. Browser-decoded multi-channel audio is mixed down to mono so the returned `Audio` object still contains one sample stream. Accepts an optional `BrowserAudioDecodeOptions` (`audioContext` / `createAudioContext` / `targetSampleRate`); a context this helper creates itself is closed afterward.

```typescript
const audio = await Audio.fromMemoryWithBrowserFallback(
  new Uint8Array(await file.arrayBuffer()),
);
```

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `audio.data` | `Float32Array` | Raw audio samples |
| `audio.length` | `number` | Number of samples |
| `audio.sampleRate` | `number` | Sample rate (Hz) |
| `audio.duration` | `number` | Duration (seconds) |

### Instance Methods

Common one-shot helpers are available as instance methods: `samples` and `sampleRate` are supplied automatically. Focused helpers such as `analyzeSections(...)`, `analyzeMelody(...)`, `analyzeDynamics(...)`, `analyzeTimbre(...)`, and the room-acoustic functions remain standalone calls.

```typescript
import {
  init,
  Audio,
  analyzeSections,
  analyzeMelody,
  analyzeDynamics,
  analyzeTimbre,
  detectAcoustic,
} from '@libraz/libsonare';

await init();

const audio = Audio.fromBuffer(samples, 44100);

// Analysis
const bpm = audio.detectBpm();
const key = audio.detectKey();
const keyCandidates = audio.detectKeyCandidates();
const beats = audio.detectBeats();
const downbeats = audio.detectDownbeats();
const onsets = audio.detectOnsets();
const result = audio.analyze();
const chords = audio.detectChords({ useHmm: true });
const sections = analyzeSections(audio.data, audio.sampleRate);
const melody = analyzeMelody(audio.data, audio.sampleRate);
const dynamics = analyzeDynamics(audio.data, audio.sampleRate);
const timbre = analyzeTimbre(audio.data, audio.sampleRate);
const acoustic = detectAcoustic(audio.data, audio.sampleRate);

// Effects
const { harmonic, percussive } = audio.hpss();
const corrected = audio.pitchCorrectToMidi(68.7, 69);
const held = audio.noteStretch({ onsetSample: 12000, offsetSample: 24000, stretchRatio: 1.25 });
const voice = audio.voiceChange({ pitchSemitones: 3, formantFactor: 1.05 });
const stretched = audio.timeStretch(1.5);
const shifted = audio.pitchShift(2);
const normalized = audio.normalize(-3.0);
const trimmed = audio.trim(-60.0);

// Feature extraction
const stftResult = audio.stft();
const mel = audio.melSpectrogram();
const mfcc = audio.mfcc();
const chroma = audio.chroma();
const nnls = audio.nnlsChroma();
const env = audio.onsetEnvelope();
const loudness = audio.lufs();
const centroid = audio.spectralCentroid();
const bandwidth = audio.spectralBandwidth();
const rolloff = audio.spectralRolloff();
const flatness = audio.spectralFlatness();
const zcr = audio.zeroCrossingRate();
const rms = audio.rmsEnergy();
const pitch = audio.pitchPyin();

// Resampling
const resampled = audio.resample(22050);
```

All parameters (e.g., `nFft`, `hopLength`, `nMels`) have the same defaults as the standalone functions.

## Streaming API

The Streaming API enables real-time audio analysis for visualizations and live monitoring. Unlike batch analysis, streaming processes audio chunk by chunk with minimal latency.

::: tip When to Use
- **Batch API**: Pre-recorded files, all-in-one analysis (BPM, key, chords, sections)
- **Streaming API**: Live audio, visualizations, real-time feedback
:::

This section is the `StreamAnalyzer` type/class reference. For the runnable recipe, the AudioWorklet bridge, output-format details, and the progressive-estimate walkthrough, see [Realtime and Streaming](./realtime-streaming.md).

### StreamConfig

Configuration options for StreamAnalyzer.

```typescript
interface StreamConfig {
  sampleRate?: number;         // default: 44100 (stream default, not 22050)
  nFft?: number;               // default: 2048
  hopLength?: number;          // default: 512
  nMels?: number;              // default: 128
  fmin?: number;               // default: 0
  fmax?: number;               // default: 0 (= sr/2)
  tuningRefHz?: number;        // default: 440
  computeMel?: boolean;        // default: true
  computeChroma?: boolean;     // default: true
  computeOnset?: boolean;      // default: true
  computeSpectral?: boolean;   // default: true
  emitEveryNFrames?: number;   // default: 1 (no throttling)
  magnitudeDownsample?: number;// default: 1
  maxPendingFrames?: number;   // default: 4096; overflow drops newly produced output frames
  maxProgressionEntries?: number; // default: 4096; cap for each retained chord/bar progression, overflow drops oldest
  keyUpdateIntervalSec?: number;  // default: 5
  bpmUpdateIntervalSec?: number;  // default: 10
  window?: number;             // 0=Hann (default), 1=Hamming, 2=Blackman, 3=Rectangular
  outputFormat?: 0;            // legacy; omit it or use Float32 (0)
}
```

`outputFormat` is retained only for source compatibility and must be `0` when
provided. Choose a quantized read explicitly with `readFramesU8` or
`readFramesI16`; analysis itself always runs in float. See [Realtime and
Streaming](./realtime-streaming.md#reading-frames-and-output-format).

The legacy `computeMagnitude` flag is no longer supported; passing it makes the
constructor throw. The flag was removed because magnitude frames are not exposed
by the StreamAnalyzer read paths; use `stft`/`stftDb` offline or the spectrum
metering helpers for magnitude data.

`streamAnalyzerConfigDefaults()` returns a fully-populated `StreamConfigDefaults`
object (a `Required<StreamConfig>`) holding the library's default values for
every field above. Use it to seed a settings UI or to compute a diff against a
user-supplied config; `StreamAnalyzer` itself applies these same defaults for any
field you omit.

### StreamAnalyzer Class

```typescript
class StreamAnalyzer {
  constructor(config: StreamConfig);

  // Process audio chunk (internal offset tracking)
  process(samples: Float32Array): void;

  // Process with an explicit, contiguous sample offset. A gap, seek, or switch
  // from process() requires reset() first.
  processWithOffset(samples: Float32Array, sampleOffset: number): void;

  // Number of frames ready to read
  availableFrames(): number;

  // Read processed frames (full float precision)
  readFrames(maxFrames: number): FrameBuffer;

  // Quantized reads for bandwidth-reduced transfer / visualization
  // (optional quantizeConfig widens quantization ranges for unusually loud/quiet streams;
  // see Realtime and Streaming → custom quantization ranges)
  readFramesU8(maxFrames: number, quantizeConfig?: StreamQuantizeConfig): StreamFramesU8;   // Uint8 feature arrays
  readFramesI16(maxFrames: number, quantizeConfig?: StreamQuantizeConfig): StreamFramesI16; // Int16 feature arrays

  // Reset state for new stream
  reset(baseSampleOffset?: number): void;

  // Get statistics and estimates that update as audio arrives
  stats(): AnalyzerStats;

  // Total frames processed
  frameCount(): number;

  // Current time position (seconds)
  currentTime(): number;

  // Get the sample rate
  sampleRate(): number;

  // Set expected total duration for pattern lock timing
  setExpectedDuration(durationSeconds: number): void;

  // Set normalization gain for loud/compressed audio
  setNormalizationGain(gain: number): void;

  // Set tuning reference frequency (default: 440 Hz)
  setTuningRefHz(refHz: number): void;

  // Release resources (call when done). `delete()` is canonical; `dispose()` is an alias.
  delete(): void;
  dispose(): void;
}
```

### FrameBuffer

Structure-of-Arrays format for efficient transfer via `postMessage`.

```typescript
interface FrameBuffer {
  nFrames: number;
  nMels: number;
  nChroma: number;             // 12 when chroma is present; otherwise 0
  featureFlags: number;        // MEL=1, CHROMA=2, ONSET=4, SPECTRAL=8
  timestamps: Float32Array;      // [nFrames]
  mel: Float32Array;             // [nFrames * nMels], empty if MEL is absent
  chroma: Float32Array;          // [nFrames * nChroma], empty if CHROMA is absent
  onsetStrength: Float32Array;   // [nFrames], empty if ONSET is absent
  rmsEnergy: Float32Array;       // [nFrames]
  spectralCentroid: Float32Array;// [nFrames], empty if SPECTRAL is absent
  spectralFlatness: Float32Array;// [nFrames], empty if SPECTRAL is absent
  chordRoot: Int32Array;         // [nFrames], empty if CHROMA is absent
  chordQuality: Int32Array;      // [nFrames], empty if CHROMA is absent
  chordConfidence: Float32Array; // [nFrames], empty if CHROMA is absent
}
```

### ChordChange

A detected chord change in the progression.

```typescript
interface ChordChange {
  root: PitchClass;
  quality: ChordQuality;
  startTime: number;
  confidence: number;
}
```

### BarChord

A chord detected at bar boundary (beat-synchronized).

```typescript
interface BarChord {
  barIndex: number;
  root: PitchClass;
  quality: ChordQuality;
  startTime: number;
  confidence: number;
}
```

### PatternScore

Match score for a known chord progression pattern.

```typescript
interface PatternScore {
  name: string;   // pattern name (e.g., "royalRoad", "pop")
  score: number;  // match score (0-1)
}
```

### AnalyzerStats

```typescript
interface AnalyzerStats {
  totalFrames: number;
  totalSamples: number;
  durationSeconds: number;
  pendingFrames: number;       // unread frames currently buffered
  droppedOutputFrames: number; // newly produced frames dropped at the configured cap
  droppedChordProgressionEntries: number; // oldest chord-history entries dropped at the configured cap
  droppedBarProgressionEntries: number;   // oldest bar-history entries dropped at the configured cap
  estimate: ProgressiveEstimate;
}
```

### ProgressiveEstimate

BPM, key, and chord estimates that improve over time as more audio is processed.

```typescript
interface ProgressiveEstimate {
  // BPM estimation
  bpm: number;              // 0 if not yet estimated
  bpmConfidence: number;    // 0-1, increases over time
  bpmCandidateCount: number;

  // Key estimation
  key: PitchClass;          // 0-11 (C-B)
  keyMinor: boolean;
  keyConfidence: number;    // 0-1, increases over time

  // Chord estimation (current)
  chordRoot: PitchClass;
  chordQuality: ChordQuality;
  chordConfidence: number;
  chordStartTime: number;
  chordProgression: ChordChange[];     // detected chord changes
  barChordProgression: BarChord[];     // bar-synchronized chords
  currentBar: number;                  // current bar index
  barDuration: number;                 // bar duration in seconds

  // Pattern detection
  votedPattern: BarChord[];            // voted chord for each pattern position
  patternLength: number;              // length of repeating pattern (default: 4 bars)
  detectedPatternName: string;        // best matching pattern name (e.g., "royalRoad")
  detectedPatternScore: number;       // match score (0-1)
  allPatternScores: PatternScore[];   // all known pattern scores

  // Statistics
  accumulatedSeconds: number;
  usedFrames: number;
  updated: boolean;         // true if estimate changed this frame
}
```

### Usage, AudioWorklet integration, and timing

The runnable `StreamAnalyzer` recipe — feeding blocks from an `AudioWorklet`,
reading frames, throttling with `emitEveryNFrames`, and mapping the `FrameBuffer`
stream-time timestamps onto `AudioContext.currentTime` — lives on
[Realtime and Streaming](./realtime-streaming.md), with the AudioWorklet handshake
and data-flow diagrams.

::: tip Releasing WASM objects
`StreamAnalyzer`, `Mixer`, `StreamingEqualizer`, and `StreamingMasteringChain` are
**embind** handles onto WASM heap memory that the JavaScript garbage collector cannot
reclaim — call `delete()` when done (`StreamAnalyzer` also accepts `dispose()`, and
some classes expose `destroy()` as an alias). Plain functions like `analyze()` return
ordinary JS values and need no cleanup. Node native cleanup differs; see
[Native Bindings](./native-bindings.md).
:::

## Types

### AnalysisResult

```typescript
interface AnalysisResult {
  bpm: number;
  bpmConfidence: number;
  key: Key;
  timeSignature: TimeSignature;
  beatTimes: Float32Array;  // Convenience copy of beats[].time, useful for librosa-style code
  beats: Beat[];            // Beat objects with per-beat strength
  chords: Chord[];
  sections: Section[];
  timbre: Timbre;
  dynamics: Dynamics;
  rhythm: RhythmFeatures;
  melody: MelodyContour;
  form: string;  // e.g., "IABABCO"
}
```

### Beat

```typescript
interface Beat {
  time: number;      // seconds
  strength: number;  // 0.0 to 1.0
}
```

### Chord

```typescript
interface Chord {
  root: PitchClass;
  bass: PitchClass;     // bass note for inversions
  quality: ChordQuality;
  start: number;       // seconds
  end: number;         // seconds
  confidence: number;
  name: string;        // "C", "Am", "G7"
}
```

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
  HalfDim7: 13, Major9: 14, Dominant9: 15, Sus2Add4: 16
} as const;
```

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

Since v1.5.1, the facades consistently reject non-finite numbers, invalid enum/index values, and oversized resources before they reach DSP or serialization. Treat these failures as invalid input; do not rely on a binding silently clamping or accepting malformed values.

```typescript
import { ErrorCode, isSonareError, Mixer } from '@libraz/libsonare';

try {
  const mixer = Mixer.fromSceneJson(sceneJson, 48000, 512);
} catch (error) {
  if (isSonareError(error) && error.code === ErrorCode.InvalidParameter) {
    // e.g. 'send timing must be a string ("pre" or "post")'
    console.error(`scene rejected: ${error.codeName}: ${error.message}`);
  } else {
    throw error;
  }
}
```

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
| `Unknown` | `99` |

The codes match Python's `SonareError.code` and the C ABI `SonareError` enum, and the Python CLI maps them onto its [exit codes](./cli.md#exit-codes).

## Mastering API

The browser package includes the same named mastering processors used by the `/mastering` demo. Decode audio with the Web Audio API, pass `Float32Array` channel buffers to libsonare, then export the returned samples as WAV in your application.

This section lists the JS entry points and their result/config types. For what each processor does, the preset list, and the analysis/assistant JSON, see [Mastering Processors](./mastering-processors.md) and [Mastering Assistant](./mastering-assistant.md).

```typescript
import { init, masterAudioStereo, masteringChainStereo } from '@libraz/libsonare'

await init()

// Full chain with explicit stage config
const result = masteringChainStereo(left, right, sampleRate, {
  spectral: { airBand: { amount: 0.35, shelfFrequencyHz: 14000 } },
  maximizer: { truePeakLimiter: { ceilingDb: -1, oversampleFactor: 4 } },
  loudness: { targetLufs: -14, ceilingDb: -1, truePeakOversample: 4 },
})
console.log(result.outputLufs, result.outputTruePeakDbtp, result.outputLra)
console.log(result.stageGainReductions)

// Preset with flat dot-notation overrides
const presetResult = masterAudioStereo(left, right, sampleRate, 'pop', {
  'loudness.targetLufs': -14,
  'maximizer.truePeakLimiter.releaseMs': 50,
})
```

Each of these has a `*WithProgress` variant taking an `(progress, stage) => void` callback. `masteringProcess(...)` / `masteringProcessStereo(...)` run one named processor, and `masteringStereoAnalyze(...)` returns a JSON report.

Offline chain and preset results include `outputTruePeakDbtp` (the output true peak at the configured loudness oversample factor), `outputLra` (EBU R128 loudness range in LU), and `stageGainReductions`. Each `StageGainReduction` names a dynamics/maximizer stage and reports its most recent gain reduction in dB (zero or negative), so a delivery ceiling can be checked without an extra oversampled scan.

The explainable-mastering helpers — `masteringAudioProfile(...)`, `masteringAssistantSuggest(...)`, and `masteringStreamingPreview(...)` — return JSON strings; see [Mastering Assistant](./mastering-assistant.md) for their exact shapes, accepted options, and how to turn a suggestion into a rendered master. Reference-track workflows use `masteringPairProcessorNames()` and `masteringPairAnalyze()` (matched sample rate and comparable duration).

### StreamingEqualizer

`StreamingEqualizer` is the block-by-block EQ object used for realtime-safe processing: up to 24 bands, zero-latency/natural/linear phase modes, dynamic EQ, mid/side processing, external sidechain input, spectrum snapshots, and offline reference matching. In the WASM package, call `init()` first and `delete()` when done.

```typescript
import { init, StreamingEqualizer } from '@libraz/libsonare';
await init();

const eq = new StreamingEqualizer({ sampleRate: 48000, maxBlockSize: 512 });
try {
  eq.setBand(0, {
    type: 'HighShelf',
    frequencyHz: 8000,
    gainDb: 4,
    q: 0.7,
    enabled: true,
  });
  eq.setPhaseMode(1); // 1 = zero-latency, 2 = natural, 3 = linear
  eq.setAutoGain(true);

  const { left, right } = eq.processStereo(leftBlock, rightBlock);
  console.log(eq.spectrum(), eq.latencySamples(), left, right);
} finally {
  eq.delete();
}
```

Source-built C++ CLI equivalents for file-based EQ and filtering:

```bash [C++ CLI]
sonare eq track.wav --type 2 --frequency-hz 8000 --gain-db 4 --q 0.7 -o eq.wav
sonare filter track.wav --type hp --cutoff 80 -o filtered.wav
```

### StreamingRetune

`StreamingRetune` is the block-by-block mono pitch retune object. It maintains grain and delay state across calls, so use `prepare()` before the first block and `delete()` when done.

```typescript
import { init, StreamingRetune } from '@libraz/libsonare';
await init();

const retune = new StreamingRetune({ semitones: 3, mix: 1, grainSize: 0 });
retune.prepare(48000, 512);

try {
  const out = retune.processMono(inputBlock);
  retune.setConfig({ semitones: -2, mix: 0.75 });
  console.log(out, retune.config(), retune.grainSize());
} finally {
  retune.delete();
}
```

Closest CLI equivalents for offline files from the source-built C++ CLI:

```bash [C++ CLI]
sonare pitch-shift vocal.wav --semitones 3 -o shifted.wav
sonare voice-change vocal.wav --pitch-semitones 3 --formant-factor 1.0 -o voice.wav
```

### RealtimeVoiceChanger

`RealtimeVoiceChanger` is the preset-based live voice chain (high-pass, gate, retune, formant, EQ, compressor, de-esser, reverb, and limiter stages) that keeps state across audio blocks. Use it for monitoring, AudioWorklet-style processing, or chunked voice rendering where `voiceChange(...)` is too simple. Factory preset IDs come from `realtimeVoiceChangerPresetNames()`; preset JSON is fetched with `realtimeVoiceChangerPresetJson(...)` and checked with `validateRealtimeVoiceChangerPresetJson(...)` (schema version `1`).

```typescript
import { init, RealtimeVoiceChanger, realtimeVoiceChangerPresetNames } from '@libraz/libsonare';
await init();

const changer = new RealtimeVoiceChanger(realtimeVoiceChangerPresetNames()[1]); // e.g. "bright-idol"
changer.prepare(48000, /*maxBlockSize=*/128, /*channels=*/1);
try {
  const out = changer.processMono(inputBlock);
  const realtime = changer.createRealtimeMonoBuffer(128); // zero-copy WASM heap view
  realtime.input.set(inputBlock.subarray(0, 128));
  realtime.process();
  console.log(out, realtime.output, changer.latencySamples());
} finally {
  changer.delete();
}
```

The zero-copy buffer helpers (`createRealtimeMonoBuffer`, `createRealtimeInterleavedBuffer`, `createRealtimePlanarBuffer`) return changer-owned WASM heap views; reuse them inside a realtime loop and discard after `delete()`. See [Realtime Voice Changer](./realtime-voice-changer.md) for the preset list and chain stages.

### `voiceChangeRealtime(samples, sampleRate?, preset?, options?)`

`voiceChangeRealtime(...)` is the offline whole-buffer convenience function around `RealtimeVoiceChanger`. It internally constructs and prepares a changer, runs the per-block render loop for you, then disposes it — matching the Python `voice_change_realtime` and Node equivalents — so callers do not manage the stateful object themselves.

```typescript
function voiceChangeRealtime(
  samples: Float32Array,
  sampleRate?: number, // default 48000
  preset?: VoicePresetId | number | RealtimeVoiceChangerConfigInput,
  options?: {
    channels?: 1 | 2;   // default 1 (mono); 2 = interleaved stereo (L0,R0,L1,R1,...)
    blockSize?: number; // default 512
  },
): Float32Array  // same layout/length as the input
```

Use this when you already have the full buffer. Reach for [`RealtimeVoiceChanger`](#realtimevoicechanger) for manual block-by-block live use, and `voiceChange(...)` when you only need a one-shot pitch/formant change without the full preset chain.

### StreamingMasteringChain

For real-time or memory-constrained use cases, such as processing audio block-by-block from `AudioWorklet` or a stream, the WASM module exposes `StreamingMasteringChain`. It accepts a `StreamingMasteringChainConfig`, which extends `masteringChain()`'s `MasteringChainConfig` with two optional streaming-only fields:

- `loudnessStaticGainDb` — a precomputed static loudness gain in dB (e.g. `targetLufs - measuredIntegratedLufs`), applied per block so a preset's streaming preview matches its offline render with a `loudness` stage enabled.
- `loudnessStaticGainPeakDb` — the offline-measured source true-peak in dBFS. When set, the static gain is clamped to `loudness.ceilingDb - loudnessStaticGainPeakDb` so the streaming limiter does not receive a hotter input than the offline chain.

It otherwise prepares processor state for a fixed block size and applies the chain incrementally.

```typescript
import { init, StreamingMasteringChain } from '@libraz/libsonare';
await init();

const chain = new StreamingMasteringChain({
  eq: { tiltDb: 0.5 },
  dynamics: { compressor: { thresholdDb: -20 } },
  maximizer: { truePeakLimiter: { ceilingDb: -1, oversampleFactor: 4 } },
});

chain.prepare(48000, /*maxBlockSize=*/512, /*numChannels=*/2);

const monoOut = chain.processMono(monoBlock);                // 1ch
const { left, right } = chain.processStereo(leftBlock, rightBlock); // 2ch

console.log(chain.stageNames());      // ['eq.tilt', 'dynamics.compressor', ...]
console.log(chain.latencySamples());  // total latency reported by active stages

chain.reset();   // clear processor state without re-preparing
chain.delete();  // release the WASM handle (call when done)
```

Stereo-only stages are skipped when `numChannels === 1`. The chain-config repair stages (`repair.declick`, `repair.dereverb`, `repair.denoise`) are offline-only and throw if enabled on the streaming constructor — run them through `masteringChain*` / `masterAudio*`, or the one-shot `masteringRepair*` helpers (the `declip`/`decrackle`/`dehum` processors are not part of the chain config and run only through those helpers). The `loudness` stage also throws unless you supply `loudnessStaticGainDb` (optionally with `loudnessStaticGainPeakDb`), since the streaming chain cannot measure whole-signal integrated LUFS. Call `reset()` between independent songs and `delete()` to free the handle.

The named mastering API families are:

| Purpose | Function |
|---------|----------|
| Apply simple loudness mastering | `mastering()` |
| List built-in mastering presets | `masteringPresetNames()` |
| Apply a preset to mono audio | `masterAudio()` |
| Apply a preset to stereo audio | `masterAudioStereo()` |
| Apply a preset to mono audio with progress | `masterAudioWithProgress()` |
| Apply a preset to stereo audio with progress | `masterAudioStereoWithProgress()` |
| Run a full mono chain | `masteringChain()` |
| Run a full stereo chain | `masteringChainStereo()` |
| Run a full mono chain with progress | `masteringChainWithProgress()` |
| Run a full stereo chain with progress | `masteringChainStereoWithProgress()` |
| Run block-by-block EQ | `StreamingEqualizer` |
| Run a streaming chain (block-by-block) | `StreamingMasteringChain` |
| Summarize source audio for mastering decisions | `masteringAudioProfile()` |
| Suggest mastering moves from source analysis | `masteringAssistantSuggest()` |
| Preview loudness targets for delivery platforms | `masteringStreamingPreview()` |
| List mono/stereo processors | `masteringProcessorNames()` |
| Get machine-readable processor classifications | `masteringProcessorCatalog()` |
| List chain insert processors | `masteringInsertNames()` |
| List the parameter keys an insert accepts | `masteringInsertParamNames(name)` |
| List realtime-automatable insert parameters | `masteringInsertParamInfo(name)` |
| Process mono audio | `masteringProcess()` |
| Process stereo audio | `masteringProcessStereo()` |
| List pair processors | `masteringPairProcessorNames()` |
| Process source/reference pair | `masteringPairProcess()` |
| List pair analyses | `masteringPairAnalysisNames()` |
| Analyze source/reference pair | `masteringPairAnalyze()` |
| List stereo analyses | `masteringStereoAnalysisNames()` |
| Analyze stereo channels | `masteringStereoAnalyze()` |

Related mastering guides: [Processing chain](./glossary/mastering.md), [Tone and air](./glossary/mastering/tone-air.md), [Dynamics](./glossary/mastering/dynamics.md), [Stereo, limiter, and loudness](./glossary/mastering/stereo-limiter-loudness.md), [Reference match](./glossary/mastering/reference-match.md).

### Standalone dynamics and repair processors

Every named stage is also a one-shot function, so you can run a single processor without assembling a chain. The dynamics processors return a `DynamicsResult` (the processed `samples` plus `latencySamples`, the processor's look-ahead latency in samples); the repair processors return a `Float32Array`.

```typescript
// Offline dynamics
function masteringDynamicsCompressor(samples: Float32Array, sampleRate: number, options?: CompressorOptions): DynamicsResult
function masteringDynamicsGate(samples: Float32Array, sampleRate: number, options?: GateOptions): DynamicsResult
function masteringDynamicsTransientShaper(samples: Float32Array, sampleRate: number, options?: TransientShaperOptions): DynamicsResult

// Offline repair
function masteringRepairDeclick(samples: Float32Array, sampleRate: number, options?: DeclickOptions): Float32Array
function masteringRepairDeclip(samples: Float32Array, sampleRate: number, options?: DeclipOptions): Float32Array
function masteringRepairDecrackle(samples: Float32Array, sampleRate: number, options?: DecrackleOptions): Float32Array
function masteringRepairDehum(samples: Float32Array, sampleRate: number, options?: DehumOptions): Float32Array
function masteringRepairDenoiseClassical(samples: Float32Array, sampleRate: number, options?: DenoiseClassicalOptions): Float32Array
function masteringRepairDereverbClassical(samples: Float32Array, sampleRate: number, options?: DereverbClassicalOptions): Float32Array
function masteringRepairTrimSilence(samples: Float32Array, sampleRate: number, options?: TrimSilenceOptions): Float32Array
```

The repair stages are offline-only and are rejected by `StreamingMasteringChain` — run them with these one-shot helpers or inside `masteringChain*`/`masterAudio*`. See [Dynamics](./glossary/mastering/dynamics.md) and [Repair](./glossary/mastering/repair.md).

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

::: details Full interface (click to expand)

```typescript
interface MasteringChainConfig {
  repair?: {
    denoise?: boolean;
    nFft?: number; hopLength?: number; ddAlpha?: number; gainFloor?: number;
    declick?: { threshold?: number; neighborRatio?: number; maxClickSamples?: number;
                lpcOrder?: number; residualRatio?: number; };
    dereverb?: { threshold?: number; attenuation?: number; nFft?: number;
                 hopLength?: number; t60Sec?: number; lateDelayMs?: number;
                 overSubtraction?: number; spectralFloor?: number;
                 wpeEnabled?: boolean; wpeIterations?: number; wpeTaps?: number;
                 wpeStrength?: number; };
  };
  eq?: { tiltDb?: number; pivotHz?: number };
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
    monoMaker?: { amount?: number };
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
  latencySamples?: number;
}
interface MasteringChainResult extends MasteringResult { stages: string[] }
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
// masteringProcessStereo.
interface MasteringStereoChainResult {
  left: Float32Array;
  right: Float32Array;
  sampleRate: number;
  inputLufs: number;
  outputLufs: number;
  appliedGainDb: number;
  stages: string[];
  latencySamples?: number;
}
```

:::

The glossary mastering guides explain when to reach for each section:
[Repair](./glossary/mastering/repair.md), [Tone and Air](./glossary/mastering/tone-air.md),
[Dynamics](./glossary/mastering/dynamics.md),
[Stereo, Limiter, Loudness](./glossary/mastering/stereo-limiter-loudness.md).

## Mixing API

The WASM package exposes the libsonare mixing engine. `mixStereo(...)` is a compact one-shot renderer for stem arrays. `Mixer` is a persistent scene-based mixer with channel strips, buses, sends, VCA groups, automation, strip meters, and goniometer buffers.

```typescript
import {
  Mixer,
  mixStereo,
  mixingScenePresetJson,
  mixingScenePresetNames,
} from '@libraz/libsonare';

mixingScenePresetNames(); // ['vocalReverbSend', ...]

const offline = mixStereo([vocalL, musicL], [vocalR, musicR], sampleRate, {
  inputTrimDb: [3, 0],
  faderDb: [-3, -12],
  pan: [0, -0.2],
  width: [1, 0.9],
  muted: [false, false],
});

const mixer = Mixer.fromSceneJson(mixingScenePresetJson('vocalReverbSend'), sampleRate, 512);
mixer.sceneWarnings(); // non-fatal scene-load warnings: insert params no processor reads (typos)
const latency = mixer.latencySamples(); // compiled graph latency for dry/wet alignment
const block = mixer.processStereo([vocalBlockL, musicBlockL], [vocalBlockR, musicBlockR]);
const meter = mixer.stripMeter(0, 'postFader');

mixer.scheduleFaderAutomation(0, sampleRate * 8, -6, 's-curve');
mixer.schedulePanAutomation(0, sampleRate * 8, -0.25, 'linear');
mixer.scheduleSendAutomation(0, 0, sampleRate * 12, -12, 'hold');

const goniometer = mixer.readGoniometerLatest(0, 256);
const sceneJson = mixer.toSceneJson();
mixer.delete();
```

`Mixer.createRealtimeBuffer()` and `processStereoInto(...)` are intended for AudioWorklet-style render loops where avoiding per-block allocation matters. See [Mixing Engine](./mixing.md) for scene and routing details.

## Projects, instruments & live MIDI

The package also exposes the project, synthesis, and live-input APIs used to
turn MIDI/clip arrangements into audio. These are summarized here; each topic has
a dedicated guide.

| Goal | Use | Guide |
|------|-----|-------|
| Build/load a clip + MIDI arrangement and edit it | `Project` (`Project.fromJson`, `toSceneJson`, MIDI event helpers) | [Project Editing](./project-editing.md) |
| Render a project to audio | `project.bounceWithSynthInstrument(s)` | [Project Bounce](./project-bounce.md) |
| Pick a built-in synth voice | `synthPresetNames()`, `synthPresetPatch(name)`, `engine.setSynthInstrument(...)` | [Native Synth](./native-synth.md) |
| Play through a SoundFont | `project.loadSoundFont(bytes)` / `engine.loadSoundFont(bytes)` | [SoundFont Player](./soundfont-player.md) |
| Schedule MIDI clips into the live engine, sample-accurately | `engine.setMidiClips(...)`, `engine.sampleAtPpq(ppq)` | [Realtime Engine](./realtime-engine.md#midi-clip-scheduling-and-sampleatppq) |
| Mix the engine's tracks live with lanes, buses, sends, and strips | `engine.setTrackLanes(...)`, `engine.setTrackBuses(...)`, strip JSON setters | [Realtime Engine](./realtime-engine.md#track-lanes-buses-and-channel-strips) |
| Send a track to external MIDI hardware and optionally forward clock/transport | `engine.setMidiDestinationExternal(...)`, `engine.setExternalMidiClockEnabled(...)`, `engine.drainExternalMidi(...)`; Worklet facade: `onMidiOut(...)` | [Realtime Engine](./realtime-engine.md#sending-a-track-to-external-midi-gear) |
| Drive the engine from a hardware/Web MIDI device | `bindWebMidi(engine, ...)` <Badge type="info" text="Browser only" /> | [MIDI Input](./midi-input.md) |
| Feed a live microphone into the engine | `bindMicrophoneInput(context, engine, ...)` <Badge type="info" text="Browser only" /> | [Recording and Takes](./recording-and-takes.md) |

```typescript
import { Project, synthPresetNames } from '@libraz/libsonare';

const project = Project.fromJson(projectJson);
const audio = project.bounceWithSynthInstrument(synthPresetNames()[0]);
```

`bounceWithSynthInstrument(...)` accepts either one instrument or an array of
instruments, one per destination. Each entry may be a preset name (a `"va:"`
routing prefix is allowed), an explicit `SynthPatch`, or `null` for the init
patch.

`bindWebMidi(...)` and `bindMicrophoneInput(...)` are browser-only helpers that
wire Web MIDI / a `MediaStream` into a live `RealtimeEngine`. See
[Realtime Engine](./realtime-engine.md) for the engine itself.

## Type Export Index

The WASM package exports TypeScript helper types in addition to functions and classes. Use these when typing options, realtime buffers, and callback payloads.

| Area | Exported types/constants |
|------|--------------------------|
| Environment and engine | `EXPECTED_ENGINE_ABI_VERSION`, `EXPECTED_PROJECT_ABI_VERSION`, `EngineCapabilities`, `ProgressCallback` |
| Engine lane mixer, markers, and MIDI clips | `EngineTrackLane`, `EngineTrackSend`, `EngineBus`, `EngineMarker`, `EngineMidiClipSchedule`, `EngineMidiEvent`, `ExternalMidiEvent`, `MarkerKind`, `ProjectMarker`, `SurroundPan` |
| Key/chord/rhythm/timbre analysis | `ChordDetectionOptions`, `KeyProfileName`, `RhythmAnalysisResult`, `TimbreAnalysisResult`, `TimbreFrame`, `DynamicsAnalysisResult` |
| Spectral, pitch, and feature transforms | `MelPowerResult`, `StftPowerResult`, `PitchCorrectOptions`, `SpectralRegionOp`, `SpectralEditOptions`, `TempogramMode` |
| Paged clip streaming | `ClipPageStreamerEngine`, `ClipPageStreamerOptions`, `ClipPageStreamSource`, `OpfsClipStream`, `OpfsClipStreamOptions`, `OpfsClipPageProviderOptions` |
| Mastering | `MasteringProcessorParams`, `MasteringProcessorCatalogEntry`, `MasteringInsertParamInfo`, `MasteringChannelPolicy`, `MasteringStereoChainResult` |
| Streaming retune | `StreamingRetuneConfig` |
| Streaming EQ | `StreamingEqualizerConfig`, `EqBandType`, `EqBandPhase`, `EqCoeffMode`, `EqMatchOptions`, `EqStereoPlacement` |
| Realtime voice | `VoicePresetId`, `RealtimeVoiceChangerConfigInput`, `RealtimeVoiceChangerPodConfig`, `RealtimeVoiceChangerMonoBuffer`, `RealtimeVoiceChangerInterleavedBuffer`, `RealtimeVoiceChangerPlanarBuffer` |
| Mixing and Worklet realtime buffers | `MixerRealtimeBuffer`, `SonareScopeRingBuffer`, `SonareScopeRingReadResult`, `SonareWorkletScopeSnapshot` |

## Performance Summary

| API | Load | Notes |
|-----|------|-------|
| `StreamAnalyzer` | <Badge type="tip" text="Real-time" /> | Per-chunk processing, ~2ms/frame, updating BPM/key/chord estimation |
| `Mixer` | <Badge type="tip" text="Real-time" /> | Scene-based block processing with automation and meters |
| `analyze` / `analyzeWithProgress` | <Badge type="warning" text="Heavy" /> | All-in-one analysis pipeline |
| `hpss` / `harmonic` / `percussive` | <Badge type="warning" text="Heavy" /> | STFT + median filtering |
| `timeStretch` | <Badge type="warning" text="Heavy" /> | Phase vocoder |
| `pitchShift` | <Badge type="warning" text="Heavy" /> | Time stretch + resample |
| `stft` / `stftDb` | <Badge type="info" text="Medium" /> | Multiple FFT operations |
| `melSpectrogram` / `mfcc` | <Badge type="info" text="Medium" /> | STFT + filterbank |
| `chroma` | <Badge type="info" text="Medium" /> | STFT + chroma filterbank |
| `pitchYin` / `pitchPyin` | <Badge type="info" text="Medium" /> | Per-frame pitch detection |
| `resample` | <Badge type="info" text="Medium" /> | High-quality resampling |
| `detectBpm` / `detectKey` | Light | Single result |
| `detectBeats` / `detectOnsets` | Light | Frame-based detection |
| Unit conversion functions | Light | Pure computation |
| `normalize` / `trim` | Light | Simple processing |

## Bundle Size

| File | Size | Gzipped |
|------|------|---------|
| `sonare.js` | ~{{ wasmMeta.sonareJs.sizeKB }} KB | ~{{ wasmMeta.sonareJs.gzipKB }} KB |
| `index.js` | ~{{ wasmMeta.indexJs.sizeKB }} KB | ~{{ wasmMeta.indexJs.gzipKB }} KB |
| `sonare.wasm` | ~{{ wasmMeta.wasm.sizeKB }} KB | ~{{ wasmMeta.wasm.gzipKB }} KB |
| **Total** | ~{{ wasmMeta.total.sizeKB }} KB | ~{{ wasmMeta.total.gzipKB }} KB |

## Browser Support

| Browser | Minimum Version |
|---------|-----------------|
| Chrome | 57+ |
| Firefox | 52+ |
| Safari | 11+ |
| Edge | 16+ |

Requirements: WebAssembly, ES2017+ (async/await), Web Audio API
