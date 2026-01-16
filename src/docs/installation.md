# Installation

## npm (Browser/Node.js)

::: warning Package Not Published
The npm package `@libraz/sonare` is currently in beta and not yet publicly available. For now, build from source or use the WASM files directly from the repository.
:::

```bash
# Not yet available - coming soon
npm install @libraz/sonare
# or
yarn add @libraz/sonare
```

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

## Usage

### Browser

```typescript
import { init, detectBpm, detectKey, analyze } from '@libraz/sonare';

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
