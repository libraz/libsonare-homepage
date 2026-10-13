# Installation

Use this page after [Getting Started](./getting-started.md), when you already know which runtime you want.

## What You Will Learn

By the end of this page you should be able to:

- install the browser/WASM npm package, Python package, or source build for the right use case;
- understand why the npm package does not install the `sonare` CLI;
- decide when you need FFmpeg-enabled decoding instead of the default WAV/MP3 support;
- build from source only when wheels or prebuilt packages do not cover your target;
- install the C++ library under a prefix and link it from your own CMake project with `find_package(sonare)`;
- recognize an `AbiMismatch` at load time and bring the binding and its native code back to one build.

## Which Install Do You Need?

| You are building... | Install | Needs a compiler? | Reads files directly? |
|---------------------|---------|-------------------|-----------------------|
| Browser app | `npm install @libraz/libsonare` | No | Decodes WAV/MP3 bytes; the browser decodes other formats |
| Node.js script or service on WebAssembly | `npm install @libraz/libsonare` | No | Decodes WAV/MP3 bytes you read with `node:fs` |
| Python script or notebook | `pip install libsonare` | No, on [platforms with a wheel](#supported-platforms) | Yes: WAV/MP3, more with FFmpeg |
| Terminal batch workflow | `pip install libsonare` and use `sonare` | No, on platforms with a wheel | Yes, the same formats as the Python package |
| Node native service or desktop tool | Build `bindings/node` as `@libraz/libsonare-native` | Yes | Yes |
| C++ integration | Build from source, `cmake --install`, then `find_package(sonare)` | Yes | Yes |
| Custom WASM build | Build from source with Emscripten | Yes, Emscripten | Same as the npm package |

::: tip Choose by where the app runs
For a browser UI, start with npm / WASM. For notebooks or local scripts, start with PyPI. For terminal checks, use the `sonare` CLI installed by the PyPI package. Reach for Node native or a C++ build when WASM or Python is not enough for performance, distribution, or existing-code integration.
:::

[Getting Started](./getting-started.md#first-result) has a first program for each of the no-compiler rows. You can switch runtimes later. The core analysis and DSP behavior is shared; the install choice mostly decides how you feed audio in and where the results are consumed.

## npm (Browser and Node.js)

`@libraz/libsonare` is the WebAssembly package; the same build runs in browsers and in Node.js. The package's `engines` field asks for Node.js 22.12.0 or later, which applies to Node.js itself and to your build tooling; the browser needs only WebAssembly.

Most APIs are sample-based: pass decoded mono `Float32Array` samples. `Audio.fromMemory(...)` decodes WAV/MP3 bytes in memory, and `Audio.fromMemoryWithBrowserFallback(...)` falls back to the browser codec stack for formats such as AAC, OGG, and FLAC.

The npm package does not install the `sonare` CLI. For the command-line tool, install the Python package from PyPI with `pip install libsonare`.

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
| `@libraz/libsonare/vocal-edit-worker` | The Worker side of the vocal-edit worker client |
| `@libraz/libsonare/wasm` | Raw main WASM asset for bundlers or custom loaders |
| `@libraz/libsonare/wasm/analysis` | Raw WASM asset of the analysis-only module |
| `@libraz/libsonare/hrtf/default.shrf` | The default HRTF set |
| `@libraz/libsonare/schemas/realtime-voice-changer-preset.schema.json` | JSON Schema for a voice-changer preset document |
| `@libraz/libsonare/schemas/realtime-voice-changer-preset-pack.schema.json` | JSON Schema for a preset pack |
| `@libraz/libsonare/schemas/mixer-scene.schema.json` | JSON Schema for a mixer scene document |
| `@libraz/libsonare/schemas/playback-renderer-config.schema.json` | JSON Schema for a playback renderer configuration |

Every JavaScript entry is exported under the `import` and `default` conditions,
and the package carries a `typesVersions` map for `analysis`, `worklet`,
`worker`, and `vocal-edit-worker`, so a bundler or a TypeScript project using
`moduleResolution: "node10"` resolves the subpaths too. The package is
tree-shakeable apart from the two Worker entries and its `Symbol.dispose`
shim, which it declares as side effects.

::: tip Pick the analysis bundle when you only analyze
`@libraz/libsonare/analysis` compiles the same DSP with the mastering, mixing, realtime, and project surfaces left out. If your page detects BPM, key, chords, or draws a spectrogram and never masters or mixes, importing it instead of the main entry cuts the WASM download substantially.
:::

## Python (pip)

Requires Python 3.11 or later (3.11, 3.12, 3.13) and NumPy 2.0.2 or later. `pip` installs NumPy as a runtime dependency.

```bash
pip install libsonare
```

This installs the Python library and the `sonare` CLI command. See [CLI Reference](/docs/cli) for command-line usage.

The PyPI wheels decode WAV and MP3. To load M4A, AAC, FLAC, OGG, Opus, or other FFmpeg-supported formats directly, build a wheel from source with FFmpeg enabled. The `SONARE_FFMPEG` flag is read by the wheel-builder script, not by `pip`, so clone the repository and run the build script:

```bash
git clone https://github.com/libraz/libsonare.git
cd libsonare
SONARE_FFMPEG=1 bash bindings/python/build_wheel.sh
pip install bindings/python/dist/*.whl
```

FFmpeg-enabled builds require FFmpeg development libraries. On macOS, install them with `brew install ffmpeg`. On Debian/Ubuntu, install `libavformat-dev libavcodec-dev libavutil-dev libswresample-dev`.

## Supported Platforms

The declared supported platforms are **Linux, macOS, WebAssembly, and WSL2**.

| Platform | Notes |
|----------|-------|
| Linux | `x86_64` and `aarch64` wheels and CLI archives. Wheels are built inside matching manylinux 2.28 images, repaired with `auditwheel`, and checked against glibc 2.31 |
| macOS | Python wheel: Apple Silicon, macOS 11.0 and later. CLI archive: `arm64`, macOS 14.0 and later. On an Intel Mac, build from source |
| WebAssembly | Any browser with WebAssembly; no SharedArrayBuffer required for the default path |
| WSL2 | The supported way to build and run on a Windows machine |

::: warning Native Windows builds are rejected
A Windows CMake configuration fails with a pointer to WSL2 rather than half-configuring. Use WSL2 for native builds on Windows. The npm WebAssembly package works in any browser on Windows; this limit is about compiling the native library, not about running the browser build.
:::

The published artifacts are the WebAssembly npm package, the Python wheel, and the native CLI release archives. The Node native binding is marked private and is installed as a local dependency only; see [Native Bindings](/docs/native-bindings).

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

A source build is also the only way to obtain the C++ library, since no prebuilt archives are published, but a consumer does not have to reference the build tree. `cmake --install` copies everything a downstream CMake project needs under one prefix:

```bash
cmake --install build --prefix /your/prefix
```

The rest of this section is reference for the consuming CMake project: where the files land, how `find_package(sonare)` finds them, and when to use `add_subdirectory()` instead.

::: details Install layout, find_package, and add_subdirectory()
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

**Consuming with `find_package`.** The package name is `sonare`, the namespace is `sonare::`, and the target to link is `sonare::sonare`. A complete consumer project:

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

**Install or `add_subdirectory()`?** `add_subdirectory()` on a checkout still works and defines the same `sonare::` target names, so a link line does not encode how libsonare was obtained. Prefer the installed package when the consumer is its own project: several projects share one installation, and rebuilding your app does not rebuild libsonare. Prefer `add_subdirectory()` when you are changing libsonare itself alongside the app, since it compiles the library from the checkout every time with no install step in between; set `BUILD_TESTING` and `BUILD_CLI` to `OFF` in the parent so the test tree and the CLI stay out of your build. The `examples/cpp` project in the libsonare repository does both, trying `find_package(sonare CONFIG QUIET)` first and falling back to the checkout when nothing is installed.

For geometric room acoustics, include the header for the feature you use (`acoustic/rir_synthesizer.h`, `analysis/room_estimator.h`, or `effects/acoustic/room_morph.h`) and build with `BUILD_ACOUSTIC_SIM=ON`.
:::

## Native Bindings (Python / Node.js)

For desktop use, native bindings provide direct C++ performance. Python is available from PyPI. The Node.js N-API binding is **not published to npm**: it is marked private and consumed as a local dependency, so it is always built from source. See [Native Bindings](/docs/native-bindings) for details.

The Node.js native binding uses Yarn 4 and requires Node.js 22 or later:

```bash
git clone https://github.com/libraz/libsonare.git
cd libsonare/bindings/node
yarn install
yarn build
```

## Verify the Install

Each line prints the version it loaded; `sonare doctor` also lists the library path and the formats this build decodes.

```bash
node --input-type=module -e "import { init, version } from '@libraz/libsonare'; await init(); console.log(version())"
python -c "import libsonare; print(libsonare.__version__)"
sonare doctor
```

Then run the first program for your runtime in [Getting Started](./getting-started.md#first-result). C++ consumers start from the `main.cpp` in [Installing the C++ Library](#installing-the-c-library).

## Troubleshooting

### AbiMismatch when loading the library

Every binding checks that the native code it loaded implements the interface it was built for before it makes a single call. The number compared is `sonare_abi_version()`, which packs the feature, project, voice-changer and acoustic struct versions into one value, currently `0x05030207` (84083207 in decimal); [ABI Versions](./native-bindings.md#abi-versions) explains the packing. A different value means the binding and the native code come from different builds, and the binding stops with error code 10 rather than misread a struct.

| Binding | When it is raised | What you see | Usual cause |
|---------|-------------------|--------------|-------------|
| Python and the `sonare` CLI | first library use | `SonareError` with `ErrorCode.ABI_MISMATCH`: `[10] libsonare ABI mismatch: native binary reports 67240454, expected 84083207. …`; the CLI prints it as `Error: …` and exits 13 | `SONARE_LIB_PATH` names a library from another build, or a source checkout's `build/lib` holds an older one |
| Node native | when the package is imported | `SonareError` with `codeName` `AbiMismatch`: `libsonare native addon ABI mismatch: the addon reports version 0x…, but this package expects 0x05030207. …` | `build/Release/sonare-node.node` was built before the TypeScript it is loaded by |
| WASM | `init()` | `SonareError` with `codeName` `AbiMismatch`: `libsonare ABI mismatch: wasm module reports 0x…, this package expects 0x05030207. …` | a `wasmBinary`, `locateFile` or `moduleFactory` option, or a cached `sonare.wasm`, serving a binary from another package version |
| C / C++ | never; the library does not raise it | — | a header from one version compiled against a library from another; compare `sonare_abi_version()` with `SONARE_ABI_VERSION` yourself |

Python looks for its library in this order, and the first hit wins: `SONARE_LIB_PATH` when the file exists, `build/lib/` of the source checkout the package sits in, the copy inside the installed package, then the system library path. The fix follows from where the mismatched library came from:

- **Python.** Unset `SONARE_LIB_PATH` or point it at a library built from the same checkout as the package, rebuild that checkout's `build/lib`, or reinstall the wheel. Once it loads, `sonare doctor` prints the path of the library it picked.
- **Node native.** Run `yarn build` in `bindings/node` so the addon matches the package's TypeScript.
- **WASM.** Serve the `sonare.wasm` that ships in the same package version as the JavaScript, and clear any cached copy (a CDN or a service worker).

Two related messages carry the same code. A library that passes the version check but lacks an entry point the Python binding needs reads `libsonare ABI mismatch: <path> does not export a symbol this binding requires`; it predates the binding, so rebuild it. The realtime engine and the project subsystem keep versions of their own, which each `RealtimeEngine` constructor and, on Node and Python, `Project` check when the object is created: `libsonare engine ABI mismatch …` (`Engine ABI mismatch: wasm=…, expected=…` on WASM) and `libsonare project ABI mismatch …`. A project version of `0` there means the library was built without arrangement support.
