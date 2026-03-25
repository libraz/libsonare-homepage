# Installation

## npm (Browser/Node.js)

Requires Node.js 18.0.0 or later.

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

## Building from Source

### Prerequisites

- CMake 3.16+
- C++17 compatible compiler (GCC 9+, Clang 10+, MSVC 2019+)
- Emscripten (for WebAssembly build)

### Build Steps

```bash
# Clone the repository
git clone https://github.com/libraz/libsonare.git
cd libsonare

# Build native library
mkdir build && cd build
cmake ..
make -j$(nproc)

# Build WebAssembly
make build-wasm
```

## Native Bindings (Python / Node.js)

For desktop use, native bindings provide direct C++ performance. See the [Native Bindings](/docs/native-bindings) page for Python and Node.js installation and usage.

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
