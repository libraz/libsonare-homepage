# Installation

## npm (Browser / WASM)

Requires Node.js 18.0.0 or later.

`@libraz/libsonare` is the WebAssembly package. It does not decode files by
itself; pass decoded mono `Float32Array` samples from the Web Audio API or
another JavaScript decoder.

This npm package is for browser/WebAssembly use. It does not install the
`sonare` CLI. For the command-line tool, install the Python package from PyPI
with `pip install libsonare`.

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

## Python (pip)

Requires Python 3.11 or later (3.11, 3.12, 3.13).

```bash
pip install libsonare
```

This installs the Python library and the `sonare` CLI command. See [CLI Reference](/docs/cli) for command-line usage.

The PyPI wheels are built for deterministic installation and decode WAV and
MP3 by default. To load M4A, AAC, FLAC, OGG, Opus, or other FFmpeg-supported
formats directly, rebuild from source with FFmpeg enabled:

```bash
SONARE_FFMPEG=1 pip install libsonare --no-binary libsonare
```

FFmpeg-enabled builds require FFmpeg development libraries. On macOS, install
them with `brew install ffmpeg`. On Debian/Ubuntu, install `libavformat-dev
libavcodec-dev libavutil-dev libswresample-dev`.

## Building from Source

### Prerequisites

- CMake 3.16+
- C++17 compatible compiler (GCC or Clang on the supported Linux/macOS targets)
- Optional FFmpeg development libraries for M4A/AAC/FLAC/OGG/Opus decoding
- Emscripten (for WebAssembly build)

### Build Steps

```bash
# Clone the repository
git clone https://github.com/libraz/libsonare.git
cd libsonare

# Build native library
mkdir build && cd build
cmake ..                         # auto-detect FFmpeg
# cmake .. -DSONARE_WITH_FFMPEG=ON  # require FFmpeg-backed decoding

make -j$(nproc)

# Build WebAssembly (run from the repository root, not from build/)
cd .. && make wasm
```

## Native Bindings (Python / Node.js)

For desktop use, native bindings provide direct C++ performance. Python is
available from PyPI; the Node.js N-API binding is currently built from source.
See the [Native Bindings](/docs/native-bindings) page for details.

## Usage

### Browser

```typescript
import { init, detectBpm, detectKey, analyze } from '@libraz/libsonare';

// Initialize WASM module
await init();

// Get audio samples from AudioContext
const audioContext = new AudioContext();
const response = await fetch('audio.mp3');
const arrayBuffer = await response.arrayBuffer();
const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
const samples = audioBuffer.getChannelData(0);

// Detect BPM
const bpm = detectBpm(samples, audioBuffer.sampleRate);

// Detect key
const key = detectKey(samples, audioBuffer.sampleRate);

// Full analysis
const result = analyze(samples, audioBuffer.sampleRate);
```

For stereo files, downmix to mono first instead of passing only one channel if
you need both channels represented.

### C++

```cpp
#include <sonare/quick.h>

// Detect BPM
float bpm = sonare::quick::detect_bpm(samples, size, sample_rate);

// Detect key
sonare::Key key = sonare::quick::detect_key(samples, size, sample_rate);

// Full analysis
sonare::AnalysisResult result = sonare::quick::analyze(samples, size, sample_rate);
```
