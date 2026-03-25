# Native Bindings

libsonare provides native bindings for desktop platforms. See the individual API pages for each language:

- **[Python API](/docs/python-api)** — cffi-based bindings with pre-built wheels on PyPI
- **Node.js (N-API)** — Native addon for direct C++ performance (documented below)

## Comparison

| | WebAssembly | Python | Node.js (N-API) |
|---|---|---|---|
| **Platform** | Browser | Desktop | Desktop |
| **Distribution** | npm (`@libraz/libsonare`) | PyPI (`pip install libsonare`) | Source |
| **Build** | Emscripten | Pre-built wheels (or CMake + pip) | CMake + cmake-js |
| **Performance** | Near-native | Native | Native |
| **Streaming** | Yes | No | No |
| **File I/O** | No | Yes | Yes |
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
console.log(`Key: ${result.key.root} ${result.key.mode}`);
console.log(`Beats: ${result.beatTimes.length}`);

// Cleanup
audio.destroy();
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

audio.destroy();
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

audio.destroy();
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
| `Audio.fromFile(path)` | Load WAV/MP3 from disk |
| `Audio.fromBuffer(samples, sampleRate?)` | Create from `Float32Array` |
| `Audio.fromMemory(data)` | Decode from `Buffer` / `Uint8Array` |
| `audio.getData()` | `Float32Array` of samples |
| `audio.getSampleRate()` | Sample rate (Hz) |
| `audio.getDuration()` | Duration (seconds) |
| `audio.getLength()` | Number of samples |
| `audio.destroy()` | Free native memory |

#### Analysis Functions

| Function | Return Type | Description |
|----------|-------------|-------------|
| `detectBpm(samples, sampleRate?)` | `number` | Tempo in BPM |
| `detectKey(samples, sampleRate?)` | `Key` | Root, mode, confidence |
| `detectBeats(samples, sampleRate?)` | `Float32Array` | Beat timestamps |
| `detectOnsets(samples, sampleRate?)` | `Float32Array` | Onset timestamps |
| `analyze(samples, sampleRate?)` | `AnalysisResult` | Full analysis |
| `version()` | `string` | Library version |

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

#### Types

```typescript
interface Key {
  root: string;        // "C", "C#", "D", ...
  mode: string;        // "major" | "minor"
  confidence: number;
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
