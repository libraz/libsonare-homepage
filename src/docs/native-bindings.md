# Native Bindings

libsonare provides native bindings for desktop platforms. See the individual API pages for each language:

- **[Python API](/docs/python-api)** — ctypes-based bindings with wheels on PyPI
- **Node.js (N-API)** — Native addon for direct C++ performance (documented below)

## Comparison

| | WebAssembly | Python | Node.js (N-API) |
|---|---|---|---|
| **Platform** | Browser | Desktop | Desktop |
| **Distribution** | npm (`@libraz/libsonare`) | PyPI (`pip install libsonare`) | Source (`bindings/node`) |
| **Build** | Emscripten | Pre-built wheels (or CMake + pip) | CMake + cmake-js |
| **Performance** | Near-native | Native | Native |
| **Streaming** | Yes | No | No |
| **File I/O** | No; pass decoded samples | WAV/MP3 by default; FFmpeg formats in FFmpeg builds | WAV/MP3 by default; FFmpeg formats in FFmpeg builds |
| **Effects** | Yes | Yes | Yes |
| **Feature Extraction** | Yes | Yes | Yes |
| **Unit Conversions** | Yes | Yes | Yes |

---

## Node.js (N-API)

The Node.js binding is a native addon built with **N-API**, providing direct C++ performance without WebAssembly overhead.

### Requirements

- Node.js 22+
- CMake 3.16+
- C++17 compiler
- Yarn 4+

### Installation

```bash
git clone https://github.com/libraz/libsonare.git
cd libsonare/bindings/node
yarn install
yarn build
```

## Mastering API

Node users can choose between the WASM npm package and the native addon:

| Package | Use when |
|---------|----------|
| `@libraz/libsonare` | You want the same API as the browser demo or need Web-compatible WASM. |
| `@libraz/libsonare-native` | You need native file decoding or native runtime performance in Node.js. |

```typescript
import {
  init,
  masterAudioStereo,
  masteringChainStereo,
  masteringChainStereoWithProgress,
  masteringPresetNames,
  masteringPairAnalyze,
  masteringProcessorNames,
} from '@libraz/libsonare'

await init()

console.log(masteringProcessorNames())
console.log(masteringPresetNames())

const mastered = masteringChainStereo(left, right, sampleRate, {
  dynamics: {
    compressor: {
      thresholdDb: -18,
      ratio: 2.2,
      autoMakeup: true,
    },
  },
  loudness: {
    targetLufs: -14,
    ceilingDb: -1,
    truePeakOversample: 4,
  },
})
console.log(mastered.outputLufs, mastered.stages)

const presetMaster = masterAudioStereo(left, right, sampleRate, 'pop', {
  'loudness.targetLufs': -14,
})
console.log(presetMaster.outputLufs, presetMaster.stages)

const matchReport = JSON.parse(
  masteringPairAnalyze('match.referenceLoudness', source, reference, sampleRate),
)

const masteredWithProgress = masteringChainStereoWithProgress(left, right, sampleRate, {
  loudness: { targetLufs: -14, ceilingDb: -1, truePeakOversample: 4 },
}, (progress, stage) => {
  console.log(`render ${(progress * 100).toFixed(0)}%: ${stage}`)
})
console.log(masteredWithProgress.outputLufs)
```

For long offline renders, use `masteringChainWithProgress()` or `masteringChainStereoWithProgress()` and update your Node or browser UI from the progress callback.

The WASM package exposes the same camelCase mastering API names as the browser demo: `mastering()`, `masteringPresetNames()`, `masterAudio()`, `masterAudioStereo()`, `masteringChain()`, `masteringChainStereo()`, `masteringChainWithProgress()`, `masteringChainStereoWithProgress()`, `masteringProcessorNames()`, `masteringProcess()`, `masteringProcessStereo()`, `masteringPairProcessorNames()`, `masteringPairProcess()`, `masteringPairAnalysisNames()`, `masteringPairAnalyze()`, `masteringStereoAnalysisNames()`, `masteringStereoAnalyze()`, and the `StreamingMasteringChain` class for block-by-block rendering.

### StreamingMasteringChain

The native addon (and the WASM package) exposes a `StreamingMasteringChain`
class for incremental rendering — for example when bridging an Electron app,
worker, or audio capture pipeline. It accepts the same nested config as
`masteringChain()` and renders one block at a time.

```typescript
import { StreamingMasteringChain } from '@libraz/libsonare-native';

const chain = new StreamingMasteringChain({
  eq: { tiltDb: 0.5 },
  dynamics: { compressor: { thresholdDb: -20 } },
  loudness: { targetLufs: -14, ceilingDb: -1, truePeakOversample: 4 },
});

chain.prepare(48000, /*maxBlockSize=*/512, /*numChannels=*/2);

const monoOut = chain.processMono(monoBlock);
const { left, right } = chain.processStereo(leftBlock, rightBlock);

console.log(chain.stageNames(), chain.latencySamples());
chain.reset();   // clear state without rebuilding
```

Stereo-only stages are skipped when `numChannels === 1`. The WASM build also
exposes `chain.delete()` to release the underlying handle; the native addon
releases its handle on GC.

Related mastering guides: [Browser local processing](./glossary/concepts/browser-local-processing.md), [Reference match](./glossary/mastering/reference-match.md), [Quality checklist](./glossary/mastering/quality-checklist.md).

`@libraz/libsonare-native` is currently intended to be built from
`bindings/node` in the source tree. To use it from another project, reference
the built local package through your workspace or a `file:` dependency.

The native build auto-detects FFmpeg development libraries via `pkg-config`.
Without FFmpeg it decodes WAV and MP3. To require or disable FFmpeg explicitly:

```bash
SONARE_FFMPEG=1 yarn build  # require FFmpeg-backed decoding
SONARE_FFMPEG=0 yarn build  # force WAV/MP3-only decoding
```

### Usage

```typescript
import {
  Audio, analyze, detectBpm, detectKey, detectBeats, version
} from '@libraz/libsonare-native';

// Load audio
const audio = Audio.fromFile('music.mp3');
const samples = audio.getData();
const sampleRate = audio.getSampleRate();

// Individual analysis
const bpm = detectBpm(samples, sampleRate);
const key = detectKey(samples, sampleRate);
const beats = detectBeats(samples, sampleRate);

// Full analysis
const result = analyze(samples, sampleRate);
console.log(`BPM: ${result.bpm}`);
console.log(`Key: ${result.key.name}`);     // "C major"
console.log(`Beats: ${result.beatTimes.length}`);
```

#### Audio Effects

```typescript
import { Audio } from '@libraz/libsonare-native';

const audio = Audio.fromFile('music.mp3');

// Harmonic-Percussive Source Separation
const hpssResult = audio.hpss();
const harmonic = audio.harmonic();
const percussive = audio.percussive();

// Time stretch / pitch shift
const stretched = audio.timeStretch(1.5);      // 1.5x speed
const shifted = audio.pitchShift(2.0);         // Up 2 semitones

// Normalize and trim silence
const normalized = audio.normalize(0.0);        // 0 dB
const trimmed = audio.trim(-60.0);
```

#### Feature Extraction

```typescript
import { Audio } from '@libraz/libsonare-native';

const audio = Audio.fromFile('music.mp3');

// Spectrogram features
const stftResult = audio.stft(2048, 512);
const mel = audio.melSpectrogram(2048, 512, 128);
const mfcc = audio.mfcc(2048, 512, 128, 13);
const chroma = audio.chroma(2048, 512);

// Spectral features
const centroid = audio.spectralCentroid();
const bandwidth = audio.spectralBandwidth();
const rolloff = audio.spectralRolloff();
const flatness = audio.spectralFlatness();
const zcr = audio.zeroCrossingRate();
const rms = audio.rmsEnergy();

// Pitch detection
const pitchYin = audio.pitchYin();
const pitchPyin = audio.pitchPyin();
console.log(`Median F0: ${pitchPyin.medianF0.toFixed(1)} Hz`);
```

#### Unit Conversions

```typescript
import {
  hzToMel, melToHz, hzToMidi, midiToHz,
  hzToNote, noteToHz, framesToTime, timeToFrames
} from '@libraz/libsonare-native';

hzToMel(440);        // → Mel scale value
melToHz(549.64);     // → Hz
hzToMidi(440);       // → 69
midiToHz(69);        // → 440
hzToNote(440);       // → "A4"
noteToHz('A4');      // → 440

framesToTime(100, 22050, 512);  // → seconds
timeToFrames(2.32, 22050, 512); // → frame index
```

### API Reference

#### Audio

| Method | Description |
|--------|-------------|
| `Audio.fromFile(path)` | Load WAV/MP3 from disk; also FFmpeg-supported formats when built with FFmpeg |
| `Audio.fromBuffer(samples, sampleRate?)` | Create from `Float32Array` |
| `Audio.fromMemory(data)` | Decode encoded audio bytes with the same format support as `fromFile` |
| `audio.getData()` | `Float32Array` of samples |
| `audio.getSampleRate()` | Sample rate (Hz) |
| `audio.getDuration()` | Duration (seconds) |
| `audio.getLength()` | Number of samples |
| `audio.destroy()` | Release the native handle. Optional — the addon also cleans up on GC, but call this for deterministic cleanup of long-lived processes |

The `Audio` instance also exposes every analysis, effects, and feature
function listed below as a method (e.g. `audio.detectBpm()`,
`audio.masteringChain(config)`), with the same defaults.

#### Analysis Functions

| Function | Return Type | Description |
|----------|-------------|-------------|
| `detectBpm(samples, sampleRate?)` | `number` | Tempo in BPM |
| `detectKey(samples, sampleRate?)` | `Key` | Root, mode, confidence |
| `detectBeats(samples, sampleRate?)` | `Float32Array` | Beat timestamps |
| `detectOnsets(samples, sampleRate?)` | `Float32Array` | Onset timestamps |
| `detectChords(samples, sampleRate?, minDuration?, smoothingWindow?, threshold?, useTriadsOnly?, nFft?, hopLength?, useBeatSync?)` | `ChordAnalysisResult` | Chord progression with timings |
| `analyze(samples, sampleRate?)` | `AnalysisResult` | Full analysis (BPM, key, beats, chords, sections, timbre, dynamics, rhythm, form) |
| `analyzeBpm(samples, sampleRate?, bpmMin?, bpmMax?, startBpm?, nFft?, hopLength?, maxCandidates?)` | `BpmAnalysisResult` | Tempo with confidence and alternate candidates |
| `analyzeRhythm(samples, sampleRate?, bpmMin?, bpmMax?, startBpm?, nFft?, hopLength?)` | `RhythmResult` | Time signature, groove, syncopation |
| `analyzeDynamics(samples, sampleRate?, windowSec?, hopLength?, compressionThreshold?)` | `DynamicsResult` | Dynamic range, loudness range, crest factor |
| `analyzeTimbre(samples, sampleRate?, nFft?, hopLength?, nMels?, nMfcc?, windowSec?)` | `TimbreResult` | Brightness, warmth, density, roughness, complexity |
| `version()` | `string` | Library version |
| `hasFfmpegSupport()` | `boolean` | Whether the loaded native addon can decode via FFmpeg |

Default `sampleRate` is `22050`. All functions also available as `Audio` instance methods.

#### Effects Functions

| Function | Return Type | Description |
|----------|-------------|-------------|
| `hpss(samples, sr?, kernelHarmonic?, kernelPercussive?)` | `HpssResult` | Harmonic-Percussive Source Separation |
| `harmonic(samples, sr?)` | `Float32Array` | Extract harmonic component |
| `percussive(samples, sr?)` | `Float32Array` | Extract percussive component |
| `timeStretch(samples, sr?, rate)` | `Float32Array` | Time-stretch without pitch change |
| `pitchShift(samples, sr?, semitones)` | `Float32Array` | Pitch-shift without tempo change |
| `normalize(samples, sr?, targetDb?)` | `Float32Array` | Normalize to target dB (default: 0.0) |
| `trim(samples, sr?, thresholdDb?)` | `Float32Array` | Trim silence (default: -60.0 dB) |
| `resample(samples, srcSr, targetSr)` | `Float32Array` | Resample to target sample rate |

#### Feature Extraction Functions

| Function | Return Type | Description |
|----------|-------------|-------------|
| `stft(samples, sr?, nFft?, hopLength?)` | `StftResult` | Short-Time Fourier Transform |
| `stftDb(samples, sr?, nFft?, hopLength?)` | `StftDbResult` | STFT in decibels |
| `melSpectrogram(samples, sr?, nFft?, hopLength?, nMels?)` | `MelSpectrogramResult` | Mel spectrogram |
| `mfcc(samples, sr?, nFft?, hopLength?, nMels?, nMfcc?)` | `MfccResult` | Mel-Frequency Cepstral Coefficients |
| `chroma(samples, sr?, nFft?, hopLength?)` | `ChromaResult` | Chroma features |
| `spectralCentroid(samples, sr?, nFft?, hopLength?)` | `Float32Array` | Spectral centroid per frame |
| `spectralBandwidth(samples, sr?, nFft?, hopLength?)` | `Float32Array` | Spectral bandwidth per frame |
| `spectralRolloff(samples, sr?, nFft?, hopLength?, rollPercent?)` | `Float32Array` | Spectral rolloff per frame |
| `spectralFlatness(samples, sr?, nFft?, hopLength?)` | `Float32Array` | Spectral flatness per frame |
| `zeroCrossingRate(samples, sr?, frameLength?, hopLength?)` | `Float32Array` | Zero-crossing rate per frame |
| `rmsEnergy(samples, sr?, frameLength?, hopLength?)` | `Float32Array` | RMS energy per frame |
| `pitchYin(samples, sr?, frameLength?, hopLength?, fmin?, fmax?, threshold?)` | `PitchResult` | YIN pitch estimation |
| `pitchPyin(samples, sr?, frameLength?, hopLength?, fmin?, fmax?, threshold?)` | `PitchResult` | pYIN pitch estimation |

Default parameters: `nFft=2048`, `hopLength=512`, `nMels=128`, `nMfcc=13`, `fmin=65.0`, `fmax=2093.0`, `threshold=0.3`, `rollPercent=0.85`.

#### librosa-Compatible Helpers

Added in libsonare 1.1.0. These mirror the corresponding `librosa` functions —
see [librosa Compatibility](./librosa-compatibility.md) for the full mapping.

::: tip What each helper is for
- **`preemphasis` / `deemphasis`** — classic one-tap IIR pre-processing on the waveform.
- **`trimSilence` / `splitSilence`** — trim leading/trailing silence or split on silent gaps.
- **`frameSignal` / `padCenter` / `fixLength` / `fixFrames`** — framing and size-alignment utilities for fixed-frame DSP.
- **`peakPick` / `vectorNormalize`** — peak detection on 1-D signals and vector-norm normalisation.
- **`pcen`** — dynamic range compression for mel spectrograms.
- **`tonnetz`** — projects chroma into a 6-D harmonic space.
- **`tempogram` / `plp`** — time-varying tempo representation and dominant local pulse.
:::

| Function | Return Type | Description |
|----------|-------------|-------------|
| `preemphasis(samples, coef?, zi?)` | `Float32Array` | Pre-emphasis filter |
| `deemphasis(samples, coef?, zi?)` | `Float32Array` | Inverse pre-emphasis |
| `trimSilence(samples, topDb?, frameLength?, hopLength?)` | `{ audio: Float32Array; startSample: number; endSample: number }` | `librosa.effects.trim` |
| `splitSilence(samples, topDb?, frameLength?, hopLength?)` | `Int32Array` | `librosa.effects.split` — flat `[start0, end0, start1, end1, ...]` |
| `frameSignal(samples, frameLength, hopLength)` | `{ nFrames: number; frames: Float32Array }` | `librosa.util.frame` (row-major) |
| `padCenter(values, size, padValue?)` | `Float32Array` | `librosa.util.pad_center` |
| `fixLength(values, size, padValue?)` | `Float32Array` | `librosa.util.fix_length` |
| `fixFrames(frames, xMin?, xMax?, pad?)` | `Int32Array` | `librosa.util.fix_frames` |
| `peakPick(values, preMax, postMax, preAvg, postAvg, delta, wait)` | `Int32Array` | `librosa.util.peak_pick` |
| `vectorNormalize(values, normType?, threshold?)` | `Float32Array` | `librosa.util.normalize`. `normType`: 0=inf, 1=L1, 2=L2, 3=power |
| `pcen(values, nBins, nFrames, options?)` | `Float32Array` | `librosa.pcen` (row-major mel input) |
| `tonnetz(chromagram, nChroma, nFrames)` | `Float32Array` | `librosa.feature.tonnetz` (`[6 x nFrames]`) |
| `tempogram(onsetEnvelope, sr?, hopLength?, winLength?)` | `{ nFrames: number; winLength: number; data: Float32Array }` | `librosa.feature.tempogram` |
| `plp(onsetEnvelope, sr?, hopLength?, tempoMin?, tempoMax?, winLength?)` | `Float32Array` | `librosa.beat.plp` |

#### Conversion Functions

| Function | Description |
|----------|-------------|
| `hzToMel(hz)` | Hertz → Mel scale |
| `melToHz(mel)` | Mel scale → Hertz |
| `hzToMidi(hz)` | Hertz → MIDI note number |
| `midiToHz(midi)` | MIDI note number → Hertz |
| `hzToNote(hz)` | Hertz → note name (e.g., "A4") |
| `noteToHz(note)` | Note name → Hertz |
| `framesToTime(frames, sr, hopLength)` | Frame index → seconds |
| `timeToFrames(time, sr, hopLength)` | Seconds → frame index |
| `framesToSamples(frames, hopLength?, nFft?)` | Frame index → sample index (`librosa.frames_to_samples`) |
| `samplesToFrames(samples, hopLength?, nFft?)` | Sample index → frame index (`librosa.samples_to_frames`) |
| `powerToDb(values, ref?, amin?, topDb?)` | Power → dB (`librosa.power_to_db`) |
| `amplitudeToDb(values, ref?, amin?, topDb?)` | Amplitude → dB (`librosa.amplitude_to_db`) |
| `dbToPower(values, ref?)` | dB → power |
| `dbToAmplitude(values, ref?)` | dB → amplitude |

#### Types

```typescript
interface Key {
  root: number;        // PitchClass: 0=C, 1=C#, ..., 11=B
  mode: number;        // Mode: 0=Major, 1=Minor
  confidence: number;
  name: string;        // "C major", "A minor"
  shortName: string;   // "C", "Am"
}

interface TimeSignature {
  numerator: number;
  denominator: number;
  confidence: number;
}

interface AnalysisResult {
  bpm: number;
  bpmConfidence: number;
  key: Key;
  timeSignature: TimeSignature;
  beatTimes: Float32Array;
  beats: Array<{ time: number; strength: number }>;
  chords: Chord[];
  sections: Section[];
  timbre: Timbre;
  dynamics: Dynamics;
  rhythm: RhythmFeatures;
  form: string;  // e.g. "IABABCO"
}

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
```
