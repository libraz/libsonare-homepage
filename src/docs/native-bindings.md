# Native Bindings

libsonare provides native bindings for **Python** and **Node.js** for high-performance audio analysis on desktop platforms. Unlike the WebAssembly build, native bindings must be built from source.

::: info Not Distributed via npm/PyPI
Native bindings are not published to package registries. Build from source following the instructions below.
:::

## Python

The Python binding uses **ctypes** to interface with the shared library (`libsonare.so` / `libsonare.dylib` / `sonare.dll`).

### Requirements

- Python 3.11+
- CMake 3.16+
- C++17 compiler (GCC 9+, Clang 10+, MSVC 2019+)

### Installation

```bash
# Clone and build the shared library
git clone https://github.com/libraz/libsonare.git
cd libsonare
cmake -B build -DCMAKE_BUILD_TYPE=Release -DBUILD_SHARED=ON
cmake --build build -j

# Install the Python package
cd bindings/python
pip install -e .
```

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

#### Analysis Functions

| Function | Return Type | Description |
|----------|-------------|-------------|
| `detect_bpm(samples, sample_rate)` | `float` | Tempo in BPM |
| `detect_key(samples, sample_rate)` | `Key` | Root, mode, confidence |
| `detect_beats(samples, sample_rate)` | `list[float]` | Beat timestamps (seconds) |
| `detect_onsets(samples, sample_rate)` | `list[float]` | Onset timestamps (seconds) |
| `analyze(samples, sample_rate)` | `AnalysisResult` | Full analysis |
| `version()` | `str` | Library version |

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
class AnalysisResult:
    bpm: float
    bpm_confidence: float
    key: Key
    time_signature: TimeSignature
    beat_times: list[float]
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

Default `sampleRate` is `22050`.

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
```

---

## Comparison

| | WebAssembly | Python | Node.js (N-API) |
|---|---|---|---|
| **Platform** | Browser | Desktop | Desktop |
| **Distribution** | npm (planned) | Source | Source |
| **Build** | Emscripten | CMake + pip | CMake + cmake-js |
| **Performance** | Near-native | Native | Native |
| **Streaming** | Yes | No | No |
| **File I/O** | No | Yes | Yes |
