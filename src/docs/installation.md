# Installation

Use this page after [Getting Started](./getting-started.md), when you already know which runtime you want.

## What You Will Learn

By the end of this page you should be able to:

- install the browser/WASM npm package, Python package, or source build for the right use case;
- understand why the npm package does not install the `sonare` CLI;
- decide when you need FFmpeg-enabled decoding instead of the default WAV/MP3 support;
- build from source only when wheels or prebuilt packages do not cover your target.

## Which Install Do You Need?

| You are building... | Install |
|---------------------|---------|
| Browser app | `npm install @libraz/libsonare` |
| Python script or notebook | `pip install libsonare` |
| Terminal batch workflow | `pip install libsonare` and use `sonare` |
| Node native service or desktop tool | Build `bindings/node` as `@libraz/libsonare-native` |
| C++ integration or custom WASM build | Build from source |

::: tip Choose by where the app runs
For a browser UI, start with npm / WASM. For notebooks or local scripts, start with PyPI. For terminal checks, use the `sonare` CLI installed by the PyPI package. Reach for Node native or a C++ build when WASM or Python is not enough for performance, distribution, or existing-code integration.
:::

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

### WASM package subpaths

The package also publishes subpath exports for worklet and asset-loading use
cases. Most app code should import from the main `@libraz/libsonare` entry.

| Import | Use |
|--------|-----|
| `@libraz/libsonare` | Main TypeScript API: initialization, analysis, features, mastering, mixing, and realtime classes |
| `@libraz/libsonare/worklet` | AudioWorklet bridge helpers, including `SonareRealtimeEngineNode`, `SonareEngine`, and worklet-side lifecycle exports |
| `@libraz/libsonare/rt` | Reduced `sonare-rt` module factory for AudioWorklet realtime-engine hot paths |
| `@libraz/libsonare/wasm` | Raw main WASM asset for bundlers or custom loaders |
| `@libraz/libsonare/rt-wasm` | Raw reduced realtime WASM asset for custom worklet integration |

## Python (pip)

Requires Python 3.11 or later (3.11, 3.12, 3.13).

```bash
pip install libsonare
```

This installs the Python library and the `sonare` CLI command. See [CLI Reference](/docs/cli) for command-line usage.

The PyPI wheels are built for deterministic installation and decode WAV and
MP3 by default. To load M4A, AAC, FLAC, OGG, Opus, or other FFmpeg-supported
formats directly, build a wheel from source with FFmpeg enabled. The
`SONARE_FFMPEG` flag is consumed by the wheel-builder script, not by `pip`, so
clone the repository and run the build script:

```bash
git clone https://github.com/libraz/libsonare.git
cd libsonare
SONARE_FFMPEG=1 bash bindings/python/build_wheel.sh
pip install bindings/python/dist/*.whl
```

FFmpeg-enabled builds require FFmpeg development libraries. On macOS, install
them with `brew install ffmpeg`. On Debian/Ubuntu, install `libavformat-dev
libavcodec-dev libavutil-dev libswresample-dev`.

## Building from Source

::: info What does source build mean?
Instead of using a published npm or PyPI package, you compile the C++ core and bindings on your machine. This is useful for custom FFmpeg support, unsupported platforms, or development changes, but normal package installation is the simpler starting point.
:::

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
# cmake .. -DBUILD_ACOUSTIC_SIM=ON  # enable geometric room acoustics (default ON)

make -j$(nproc)

# Build WebAssembly (run from the repository root, not from build/)
cd .. && make wasm
```

## Native Bindings (Python / Node.js)

For desktop use, native bindings provide direct C++ performance. Python is
available from PyPI; the Node.js N-API binding is currently built from source.
See the [Native Bindings](/docs/native-bindings) page for details.

The Node.js native binding uses Yarn 4 and requires Node.js 22 or later:

```bash
git clone https://github.com/libraz/libsonare.git
cd libsonare/bindings/node
yarn install
yarn build
```

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

### Python

```python
from libsonare import Audio

# Reads WAV/MP3 (rebuild with FFmpeg for M4A/FLAC/OGG/Opus)
audio = Audio.from_file("audio.mp3")

# Detect BPM
bpm = audio.detect_bpm()

# Detect key
key = audio.detect_key()

# Full analysis
result = audio.analyze()
```

The same `sonare` CLI ships with the package — see the
[CLI Reference](/docs/cli) for terminal usage and JSON output.

### CLI

```bash
pip install libsonare

# Quick terminal checks
sonare bpm audio.mp3
sonare key audio.mp3

# Machine-readable full analysis
sonare analyze audio.mp3 --json > analysis.json
```

### C++

```cpp
#include <quick.h>

// Detect BPM
float bpm = sonare::quick::detect_bpm(samples, size, sample_rate);

// Detect key
sonare::Key key = sonare::quick::detect_key(samples, size, sample_rate);

// Full analysis
sonare::AnalysisResult result = sonare::quick::analyze(samples, size, sample_rate);
```

For acoustic metrics, use `sonare::quick::analyze_impulse_response()` for measured
impulse responses and `sonare::quick::detect_acoustic()` for blind estimates.
For geometric room acoustics:

- include the header for the feature you use: `acoustic/rir_synthesizer.h`, `analysis/room_estimator.h`, or `effects/acoustic/room_morph.h`;
- build with `BUILD_ACOUSTIC_SIM=ON`.
