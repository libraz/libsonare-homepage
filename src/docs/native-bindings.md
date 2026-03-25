# Native Bindings

libsonare provides native bindings for **Python** and **Node.js** for high-performance audio analysis on desktop platforms.

## Python

The Python binding uses **cffi** to interface with the C API. Pre-built wheels are available on PyPI for Linux (x86_64, aarch64) and macOS (Apple Silicon).

### Installation

```bash
pip install libsonare
```

This also installs the `sonare` CLI command. See [CLI Reference](/docs/cli) for details.

### Building from Source (alternative)

If pre-built wheels are not available for your platform, you can build from source:

```bash
git clone https://github.com/libraz/libsonare.git
cd libsonare
cmake -B build -DCMAKE_BUILD_TYPE=Release -DBUILD_SHARED=ON
cmake --build build -j

cd bindings/python
pip install -e .
```

**Requirements for building from source:**

- Python 3.11+
- CMake 3.16+
- C++17 compiler (GCC 9+, Clang 10+, MSVC 2019+)

### Usage

```python
from libsonare import Audio, analyze, detect_bpm, detect_key, detect_beats

# Load audio from file
audio = Audio.from_file("music.mp3")

# Individual analysis
bpm = detect_bpm(audio.data, audio.sample_rate)
key = detect_key(audio.data, audio.sample_rate)
beats = detect_beats(audio.data, audio.sample_rate)

# Full analysis
result = analyze(audio.data, audio.sample_rate)
print(f"BPM: {result.bpm} ({result.bpm_confidence:.0%})")
print(f"Key: {result.key}")
print(f"Time Signature: {result.time_signature}")
print(f"Beats: {len(result.beat_times)} detected")
```

#### Audio Effects

```python
from libsonare import Audio

audio = Audio.from_file("music.mp3")

# Harmonic-Percussive Source Separation
hpss_result = audio.hpss()
harmonic = audio.harmonic()
percussive = audio.percussive()

# Time stretch / pitch shift
stretched = audio.time_stretch(rate=1.5)       # 1.5x speed
shifted = audio.pitch_shift(semitones=2.0)     # Up 2 semitones

# Normalize and trim silence
normalized = audio.normalize(target_db=-3.0)
trimmed = audio.trim(threshold_db=-60.0)

# Resample
resampled = audio.resample(target_sr=44100)
```

#### Feature Extraction

```python
from libsonare import Audio

audio = Audio.from_file("music.mp3")

# Spectrogram features
stft_result = audio.stft(n_fft=2048, hop_length=512)
mel = audio.mel_spectrogram(n_fft=2048, hop_length=512, n_mels=128)
mfcc = audio.mfcc(n_fft=2048, hop_length=512, n_mels=128, n_mfcc=20)
chroma = audio.chroma(n_fft=2048, hop_length=512)

# Spectral features
centroid = audio.spectral_centroid()
bandwidth = audio.spectral_bandwidth()
rolloff = audio.spectral_rolloff(roll_percent=0.85)
flatness = audio.spectral_flatness()
zcr = audio.zero_crossing_rate()
rms = audio.rms_energy()

# Pitch detection
pitch_yin = audio.pitch_yin(fmin=65.0, fmax=2093.0)
pitch_pyin = audio.pitch_pyin(fmin=65.0, fmax=2093.0)
print(f"Median F0: {pitch_pyin.median_f0:.1f} Hz")
```

#### Unit Conversions

```python
from libsonare import hz_to_mel, mel_to_hz, hz_to_midi, midi_to_hz
from libsonare import hz_to_note, note_to_hz, frames_to_time, time_to_frames

hz_to_mel(440.0)       # → Mel scale value
mel_to_hz(549.64)      # → Hz
hz_to_midi(440.0)      # → 69.0
midi_to_hz(69.0)       # → 440.0
hz_to_note(440.0)      # → "A4"
note_to_hz("A4")       # → 440.0

frames_to_time(100, sr=22050, hop_length=512)  # → seconds
time_to_frames(2.32, sr=22050, hop_length=512) # → frame index
```

### API Reference

#### Audio

| Method | Description |
|--------|-------------|
| `Audio.from_file(path)` | Load WAV/MP3 from disk |
| `Audio.from_buffer(data, sample_rate)` | Create from float samples |
| `Audio.from_memory(data)` | Decode from binary WAV/MP3 in memory |
| `audio.data` | Raw float samples |
| `audio.sample_rate` | Sample rate (Hz) |
| `audio.duration` | Duration (seconds) |
| `audio.length` | Number of samples |
| `audio.close()` | Free native memory |

Supports context manager for automatic cleanup:

```python
with Audio.from_file("music.mp3") as audio:
    result = audio.analyze()
```

#### Analysis Functions

| Function | Return Type | Description |
|----------|-------------|-------------|
| `detect_bpm(samples, sample_rate)` | `float` | Tempo in BPM |
| `detect_key(samples, sample_rate)` | `Key` | Root, mode, confidence |
| `detect_beats(samples, sample_rate)` | `list[float]` | Beat timestamps (seconds) |
| `detect_onsets(samples, sample_rate)` | `list[float]` | Onset timestamps (seconds) |
| `analyze(samples, sample_rate)` | `AnalysisResult` | Full analysis |
| `version()` | `str` | Library version |

All functions also available as `Audio` instance methods (e.g., `audio.detect_bpm()`).

#### Effects Functions

| Function | Return Type | Description |
|----------|-------------|-------------|
| `hpss(samples, sr, kernel_harmonic?, kernel_percussive?)` | `HpssResult` | Harmonic-Percussive Source Separation |
| `harmonic(samples, sr)` | `list[float]` | Extract harmonic component |
| `percussive(samples, sr)` | `list[float]` | Extract percussive component |
| `time_stretch(samples, sr, rate)` | `list[float]` | Time-stretch without pitch change |
| `pitch_shift(samples, sr, semitones)` | `list[float]` | Pitch-shift without tempo change |
| `normalize(samples, sr, target_db?)` | `list[float]` | Normalize to target dB (default: -3.0) |
| `trim(samples, sr, threshold_db?)` | `list[float]` | Trim silence (default: -60.0 dB) |
| `resample(samples, src_sr, target_sr)` | `list[float]` | Resample to target sample rate |

#### Feature Extraction Functions

| Function | Return Type | Description |
|----------|-------------|-------------|
| `stft(samples, sr, n_fft?, hop_length?)` | `StftResult` | Short-Time Fourier Transform |
| `stft_db(samples, sr, n_fft?, hop_length?)` | `tuple` | STFT in decibels |
| `mel_spectrogram(samples, sr, n_fft?, hop_length?, n_mels?)` | `MelSpectrogramResult` | Mel spectrogram |
| `mfcc(samples, sr, n_fft?, hop_length?, n_mels?, n_mfcc?)` | `MfccResult` | Mel-Frequency Cepstral Coefficients |
| `chroma(samples, sr, n_fft?, hop_length?)` | `ChromaResult` | Chroma features (pitch class distribution) |
| `spectral_centroid(samples, sr, n_fft?, hop_length?)` | `list[float]` | Spectral centroid per frame |
| `spectral_bandwidth(samples, sr, n_fft?, hop_length?)` | `list[float]` | Spectral bandwidth per frame |
| `spectral_rolloff(samples, sr, n_fft?, hop_length?, roll_percent?)` | `list[float]` | Spectral rolloff per frame |
| `spectral_flatness(samples, sr, n_fft?, hop_length?)` | `list[float]` | Spectral flatness per frame |
| `zero_crossing_rate(samples, sr, frame_length?, hop_length?)` | `list[float]` | Zero-crossing rate per frame |
| `rms_energy(samples, sr, frame_length?, hop_length?)` | `list[float]` | RMS energy per frame |
| `pitch_yin(samples, sr, frame_length?, hop_length?, fmin?, fmax?, threshold?)` | `PitchResult` | YIN pitch estimation |
| `pitch_pyin(samples, sr, frame_length?, hop_length?, fmin?, fmax?, threshold?)` | `PitchResult` | pYIN pitch estimation |

Default parameters: `n_fft=2048`, `hop_length=512`, `n_mels=128`, `n_mfcc=20`, `fmin=65.0`, `fmax=2093.0`, `threshold=0.3`, `roll_percent=0.85`.

#### Conversion Functions

| Function | Description |
|----------|-------------|
| `hz_to_mel(hz)` | Hertz → Mel scale |
| `mel_to_hz(mel)` | Mel scale → Hertz |
| `hz_to_midi(hz)` | Hertz → MIDI note number |
| `midi_to_hz(midi)` | MIDI note number → Hertz |
| `hz_to_note(hz)` | Hertz → note name (e.g., "A4") |
| `note_to_hz(note)` | Note name → Hertz |
| `frames_to_time(frames, sr, hop_length)` | Frame index → seconds |
| `time_to_frames(time, sr, hop_length)` | Seconds → frame index |

#### Types

```python
class PitchClass(IntEnum):
    C, Cs, D, Ds, E, F, Fs, G, Gs, A, As, B

class Mode(IntEnum):
    MAJOR = 0
    MINOR = 1

@dataclass(frozen=True)
class Key:
    root: PitchClass
    mode: Mode
    confidence: float

@dataclass(frozen=True)
class TimeSignature:
    numerator: int
    denominator: int
    confidence: float

@dataclass(frozen=True)
class AnalysisResult:
    bpm: float
    bpm_confidence: float
    key: Key
    time_signature: TimeSignature
    beat_times: list[float]

@dataclass(frozen=True)
class HpssResult:
    harmonic: list[float]
    percussive: list[float]
    length: int
    sample_rate: int

@dataclass(frozen=True)
class StftResult:
    n_bins: int
    n_frames: int
    n_fft: int
    hop_length: int
    sample_rate: int
    magnitude: list[float]   # n_bins × n_frames, row-major
    power: list[float]       # n_bins × n_frames, row-major

@dataclass(frozen=True)
class MelSpectrogramResult:
    n_mels: int
    n_frames: int
    sample_rate: int
    hop_length: int
    power: list[float]       # n_mels × n_frames, row-major
    db: list[float]          # n_mels × n_frames, row-major

@dataclass(frozen=True)
class MfccResult:
    n_mfcc: int
    n_frames: int
    coefficients: list[float]  # n_mfcc × n_frames, row-major

@dataclass(frozen=True)
class ChromaResult:
    n_chroma: int
    n_frames: int
    sample_rate: int
    hop_length: int
    features: list[float]    # n_chroma × n_frames, row-major
    mean_energy: list[float] # n_chroma values

@dataclass(frozen=True)
class PitchResult:
    n_frames: int
    f0: list[float]          # Fundamental frequency per frame (Hz)
    voiced_prob: list[float] # Voicing probability per frame (0–1)
    voiced_flag: list[bool]  # Voiced/unvoiced decision per frame
    median_f0: float
    mean_f0: float
```

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

---

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
