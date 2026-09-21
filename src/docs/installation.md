# Installation

Use this page after [Getting Started](./getting-started.md), when you already know which runtime you want.

## What You Will Learn

By the end of this page you should be able to:

- install the browser/WASM npm package, Python package, or source build for the right use case;
- understand why the npm package does not install the `sonare` CLI;
- decide when you need FFmpeg-enabled decoding instead of the default WAV/MP3 support;
- build from source only when wheels or prebuilt packages do not cover your target;
- install the C++ library under a prefix and link it from your own CMake project with `find_package(sonare)`.

## Which Install Do You Need?

| You are building... | Install |
|---------------------|---------|
| Browser app | `npm install @libraz/libsonare` |
| Python script or notebook | `pip install libsonare` |
| Terminal batch workflow | `pip install libsonare` and use `sonare` |
| Node native service or desktop tool | Build `bindings/node` as `@libraz/libsonare-native` |
| C++ integration | Build from source, `cmake --install`, then `find_package(sonare)` |
| Custom WASM build | Build from source with Emscripten |

::: tip Choose by where the app runs
For a browser UI, start with npm / WASM. For notebooks or local scripts, start with PyPI. For terminal checks, use the `sonare` CLI installed by the PyPI package. Reach for Node native or a C++ build when WASM or Python is not enough for performance, distribution, or existing-code integration.
:::

If you are unsure, pick the path that lets you run one command today:

- **Website or Vite/Vue/React app** — install the npm package and call `await init()` before analysis.
- **Local data work** — install the Python package and start with `Audio.from_file(...)`.
- **No code yet** — install the Python package and run `sonare bpm audio.mp3` or `sonare analyze audio.mp3 --json`.

You can switch runtimes later. The core analysis and DSP behavior is shared; the install choice mostly decides how you feed audio in and where the results are consumed.

## npm (Browser / WASM)

Requires Node.js 18.0.0 or later.

`@libraz/libsonare` is the WebAssembly package. Most APIs are sample-based:
pass decoded mono `Float32Array` samples. For loading convenience,
`Audio.fromMemory(...)` can decode WAV/MP3 bytes in memory, and
`Audio.fromMemoryWithBrowserFallback(...)` can fall back to the browser codec
stack for formats such as AAC, OGG, and FLAC.

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
| `@libraz/libsonare/analysis` | Analysis-only module, built without mastering, mixing, realtime, or project bindings — a much smaller download when all you need is MIR (Music Information Retrieval) |
| `@libraz/libsonare/worklet` | AudioWorklet bridge helpers, including `SonareRealtimeEngineNode`, `SonareEngine`, and worklet-side lifecycle exports |
| `@libraz/libsonare/worker` | `OfflineWorkerClient`, which runs one-shot analysis and mastering calls in a dedicated Worker |
| `@libraz/libsonare/wasm` | Raw main WASM asset for bundlers or custom loaders |
| `@libraz/libsonare/schemas/realtime-voice-changer-preset.schema.json` | JSON Schema for a voice-changer preset document |
| `@libraz/libsonare/schemas/realtime-voice-changer-preset-pack.schema.json` | JSON Schema for a preset pack |

::: tip Pick the analysis bundle when you only analyze
`@libraz/libsonare/analysis` compiles the same DSP with the mastering, mixing,
realtime, and project surfaces left out. CI records its size in a report, but
size growth alone does not fail the build. If
your page detects BPM, key, chords, or draws a spectrogram and never masters or
mixes, importing it instead of the main entry cuts the WASM download
substantially.
:::

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

## Supported Platforms

The declared supported platforms are **Linux, macOS, WebAssembly, and WSL2**.

| Platform | Notes |
|----------|-------|
| Linux | Wheels are built inside matching manylinux 2.28 images, repaired with `auditwheel`, and checked against glibc 2.31 |
| macOS | Targets macOS 11.0 and later |
| WebAssembly | Any browser with WebAssembly; no SharedArrayBuffer required for the default path |
| WSL2 | The supported way to build and run on a Windows machine |

::: warning Native Windows builds are rejected
A Windows CMake configuration fails with a pointer to WSL2 rather than
half-configuring. Use WSL2 for native builds on Windows. The npm WebAssembly
package works in any browser on Windows — this limit is about compiling the
native library, not about running the browser build.
:::

The published artifacts are the WebAssembly npm package, the Python wheel, and
the native CLI release archives. Native CLI archives are published for Linux
`x86_64` and `aarch64`, and macOS `arm64`. The Node native binding is marked
private and is installed as a local dependency only — see
[Native Bindings](/docs/native-bindings).

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

# Configure and build the native library
cmake -S . -B build -DCMAKE_BUILD_TYPE=Release   # auto-detect FFmpeg
# ... -DSONARE_WITH_FFMPEG=ON   # require FFmpeg-backed decoding
# ... -DBUILD_ACOUSTIC_SIM=ON   # geometric room acoustics (default ON)
cmake --build build --parallel

# Build WebAssembly (from the repository root)
make wasm
```

The native build leaves the archives and the CLI under `build/`. Installing them under a prefix, and linking them from another project, is the [next section](#installing-the-c-library).

::: warning Rebuild the shared library and the binding together
The Python binding refuses a shared library built from a different tree, so a locally built `.so` / `.dylib` and the binding that loads it have to come from the same checkout. After pulling a version that changes a C struct layout, rebuild the library rather than pointing the new binding at the old artifact. Installing the published wheel instead avoids the problem entirely, since it ships a matched pair.
:::

## Installing the C++ Library

A source build is also the only way to obtain the C++ library — no prebuilt archives are published — but a consumer does not have to reference the build tree. `cmake --install` copies everything a downstream CMake project needs under one prefix:

```bash
cmake --install build --prefix /your/prefix
```

Omit `--prefix` and the files land under CMake's default, `/usr/local` on Linux and macOS; `-DCMAKE_INSTALL_PREFIX=/your/prefix` at configure time sets the same thing. What lands where (`lib` is `lib64` on the Linux distributions where `GNUInstallDirs` says so):

| Path under the prefix | Contents |
|-----------------------|----------|
| `lib/` | One static archive per subsystem (`libsonare_core.a`, `libsonare_midi.a`, ...), the vendored FFTs as `libsonare_kissfft.a` and `libsonare_pffft.a`, and `libsonare.so` / `.dylib` when built with `BUILD_SHARED=ON` |
| `include/sonare/` | The C ABI headers, included as `<sonare/sonare_c.h>` |
| `include/sonare/cpp/` | The C++ header tree, installed whole so its relative includes resolve; reachable as `<sonare/cpp/sonare.h>` through the include root or as the in-tree `"sonare.h"` |
| `lib/cmake/sonare/` | `sonareConfig.cmake`, `sonareConfigVersion.cmake` and `sonareTargets.cmake` — what `find_package(sonare)` loads |
| `lib/pkgconfig/sonare.pc` | Shared build only: pkg-config describes one library, and the static configuration is a dependency-ordered set of archives |
| `bin/sonare-cli` | The native CLI, when `BUILD_CLI` is on (the default) |

The install rules exist only when libsonare is the top-level project of a native configuration. `SONARE_INSTALL` defaults to `ON` there and to `OFF` under `add_subdirectory()` or `BUILD_WASM`: a parent project decides what its own install step contains, and the WebAssembly build produces an embind module rather than a C++ library.

There are no install-time components. `cmake --install --component` has nothing to select, because what an installation contains is decided at configure time by the `BUILD_*` options: an installation configured with `-DBUILD_MIXING=OFF` has no mixing archive, and its package file says so. "Component" on the consumer side means something else, covered next. See [Linking only the built-in instruments](./cpp-api.md#linking-only-the-built-in-instruments) for a trimmed configuration.

### Consuming with find_package

The package name is `sonare`, the namespace is `sonare::`, and the target to link is `sonare::sonare`. A complete consumer project:

```cmake
cmake_minimum_required(VERSION 3.16)
project(my_app LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

find_package(sonare REQUIRED)

add_executable(my_app main.cpp)
target_link_libraries(my_app PRIVATE sonare::sonare)
```

```cpp
// main.cpp
#include <iostream>
#include <sonare/cpp/sonare.h>

int main(int argc, char** argv) {
  const auto audio = sonare::Audio::from_file(argv[1]);
  const auto result = sonare::MusicAnalyzer(audio).analyze();
  std::cout << "BPM: " << result.bpm << "\nKey: " << result.key.to_string() << "\n";
}
```

`sonare::sonare` is an aggregate over every static archive the installation was built with, so you do not have to work out which ones your calls need or what order they go in. Each subsystem is also exported on its own — `sonare::midi` alone is enough for an app that only renders MIDI through the built-in instruments — and naming one as a component turns a missing subsystem into a configure-time error instead of an undefined symbol at link time:

```cmake
find_package(sonare REQUIRED COMPONENTS midi)
target_link_libraries(app PRIVATE sonare::midi)
```

Components map to the exported target names, not to the `BUILD_*` options: `BUILD_ACOUSTIC_SIM` produces `sonare::acoustic`, so the component is `acoustic`. [Link targets](./cpp-api.md#link-targets) has the full list.

**Where `find_package` looks.** CMake searches the standard system prefixes, `/usr` and `/usr/local` among them, so an installation under the default prefix is found with no further setup. Anywhere else, `find_package(sonare)` stops with `Could not find a package configuration file provided by "sonare"` until the consumer is pointed at the prefix:

```bash
cmake -S . -B build -DCMAKE_PREFIX_PATH=/your/prefix
cmake --build build
```

`CMAKE_PREFIX_PATH` is a semicolon-separated list, so several packages in several prefixes fit in one setting; `-Dsonare_DIR=/your/prefix/lib/cmake/sonare` names this one package's directory directly instead. The version file accepts any installation whose major version matches the one requested: the archives are rebuilt from source by whoever installs them, and what breaks compatibility is a C++ API change.

**Build time versus run time.** At build time a consumer needs a C++17 compiler, CMake 3.16 or later, and a threads library. Eigen is not a usage requirement, since no installed header includes it. If the installation was built with FFmpeg, the package file resolves the FFmpeg libraries through `pkg-config`, so the FFmpeg development packages have to be present on the consuming machine as well. At run time the default static installation needs nothing beyond the C++ runtime; a shared installation needs `libsonare.so` / `.dylib` on the loader path; and an FFmpeg-enabled installation of either kind needs the FFmpeg shared libraries.

### Install or add_subdirectory()?

`add_subdirectory()` on a checkout still works and defines the same `sonare::` target names, so a link line does not encode how libsonare was obtained. Prefer the installed package when the consumer is its own project: several projects share one installation, and rebuilding your app does not rebuild libsonare. Prefer `add_subdirectory()` when you are changing libsonare itself alongside the app, since it compiles the library from the checkout every time with no install step in between; set `BUILD_TESTING` and `BUILD_CLI` to `OFF` in the parent so the test tree and the CLI stay out of your build. The `examples/cpp` project in the libsonare repository does both, trying `find_package(sonare CONFIG QUIET)` first and falling back to the checkout when nothing is installed.

## Native Bindings (Python / Node.js)

For desktop use, native bindings provide direct C++ performance. Python is
available from PyPI. The Node.js N-API binding is **not published to npm** — it
is marked private and is consumed as a local dependency, so it is always built
from source. See the [Native Bindings](/docs/native-bindings) page for details.

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

// All-in-one analysis
const result = analyze(samples, audioBuffer.sampleRate);
```

For stereo files, downmix to mono first instead of passing only one channel if
you need both channels represented.

The demo below is the same browser/WASM path in visual form: decoded samples go in, an STFT-style time/frequency view comes out. If this renders in your app, the WASM package, initialization, and sample-rate plumbing are all working.

<SonareDemo id="stft-basics" />

### Python

```python
from libsonare import Audio

# Reads WAV/MP3 (rebuild with FFmpeg for M4A/FLAC/OGG/Opus)
audio = Audio.from_file("audio.mp3")

# Detect BPM
bpm = audio.detect_bpm()

# Detect key
key = audio.detect_key()

# All-in-one analysis
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

# Machine-readable all-in-one analysis
sonare analyze audio.mp3 --json > analysis.json
```

### C++

```cpp
#include <quick.h>

// Detect BPM
float bpm = sonare::quick::detect_bpm(samples, size, sample_rate);

// Detect key
sonare::Key key = sonare::quick::detect_key(samples, size, sample_rate);

// All-in-one analysis
sonare::AnalysisResult result = sonare::quick::analyze(samples, size, sample_rate);
```

For acoustic metrics, use `sonare::quick::analyze_impulse_response()` for measured
impulse responses and `sonare::quick::detect_acoustic()` for blind estimates.
For geometric room acoustics:

- include the header for the feature you use: `acoustic/rir_synthesizer.h`, `analysis/room_estimator.h`, or `effects/acoustic/room_morph.h`;
- build with `BUILD_ACOUSTIC_SIM=ON`.

Linking this from your own CMake project — `find_package(sonare)`, the `sonare::sonare` target, where the headers land, and `CMAKE_PREFIX_PATH` for an installation outside the system prefixes — is covered under [Installing the C++ Library](#installing-the-c-library). [Link targets](./cpp-api.md#link-targets) lists every exported target and the build flags that decide which ones exist.
