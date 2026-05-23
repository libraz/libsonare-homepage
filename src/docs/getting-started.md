# Getting Started

libsonare is a C++17 audio analysis and mastering DSP library for music information retrieval (MIR) and browser-native music tools.

## Choose Your Runtime

Start with the page that matches where you will run libsonare:

| You want to... | Use | Start here |
|----------------|-----|------------|
| Analyze audio in a web app | Browser WebAssembly package | [Browser / WASM](/docs/wasm) |
| Analyze files from Python scripts or notebooks | Python package from PyPI | [Python API](/docs/python-api) |
| Run analysis from a terminal | `sonare` CLI installed from PyPI via `pip install libsonare` | [CLI Reference](/docs/cli) |
| Use libsonare from a Node.js backend or desktop tool | Native N-API binding | [Node.js Native](/docs/native-bindings) |
| Embed the C++ library directly | C++17 library | [C++ API](/docs/cpp-api) |

The browser package is sample-based: it does not decode files by itself. The
Python package and CLI can load WAV/MP3 by default, and FFmpeg-enabled builds can
load more formats directly.

::: info Package names
- Browser / WASM: install `@libraz/libsonare` from npm.
- Python API and CLI: install `libsonare` from PyPI with `pip install libsonare`.
- Node.js native binding: use `@libraz/libsonare-native` from `bindings/node`; it is currently source-build oriented.
:::

## Quick Start

### Browser (WebAssembly)

Decode the file first, then pass mono `Float32Array` samples to libsonare.

```typescript
import { init, analyze } from '@libraz/libsonare';

// Initialize the WASM module
await init();

// Analyze audio samples
const result = analyze(samples, sampleRate);

console.log('BPM:', result.bpm);
console.log('Key:', result.key.name);
console.log('Chords:', result.chords);
```

Next: read the [WebAssembly Guide](/docs/wasm) and [JavaScript API Reference](/docs/js-api).

### Python

```bash
pip install libsonare
```

The standard wheel reads WAV and MP3 files. Rebuild with FFmpeg enabled for
direct M4A/AAC/FLAC/OGG/Opus input.

```python
from libsonare import Audio

audio = Audio.from_file("music.mp3")
result = audio.analyze()

print(f"BPM: {result.bpm}")
print(f"Key: {result.key}")
print(f"Beats: {len(result.beat_times)}")
```

Next: read the [Python API Reference](/docs/python-api).

### CLI

Use the CLI when you want a terminal tool for quick checks, batch scripts, or
JSON summaries. The CLI is installed from PyPI with the Python package. It is
not provided by the npm WebAssembly package.

```bash
pip install libsonare
sonare analyze music.mp3
sonare bpm music.mp3
sonare key music.mp3
```

The CLI uses the same audio decoding support as the installed Python package.

Next: read the [CLI Reference](/docs/cli) for output formats, JSON summaries,
and available commands.

### Node.js (Native)

Use the N-API package when you need native file loading and desktop/server-side
performance from Node.js. It is currently source-build oriented.

```bash
git clone https://github.com/libraz/libsonare.git
cd libsonare/bindings/node
npm install
npm run build
```

```typescript
import { Audio } from '@libraz/libsonare-native';

const audio = Audio.fromFile('music.mp3');
const result = audio.analyze();

console.log('BPM:', result.bpm);
console.log('Key:', result.key.name);
```

Next: read [Node.js / Native Bindings](/docs/native-bindings).

## What libsonare Can Analyze

- **BPM Detection** - Tempo estimation using tempogram and autocorrelation
- **Key Detection** - Musical key detection using Krumhansl-Schmuckler profiles
- **Beat Tracking** - Dynamic programming-based beat extraction
- **Chord Recognition** - Template matching with 108 chord types
- **Section Detection** - Structural segmentation such as intro, verse, and chorus
- **Melody / Pitch Tracking** - YIN and pYIN algorithms for F0 detection
- **Audio Characteristics** - Timbre, dynamics, and rhythm analysis
- **Spectral Features** - Mel spectrogram, MFCC, chroma, CQT/VQT, spectral centroid, and flatness
- **Audio Effects** - HPSS, time stretch, pitch shift, normalize, and trim
- **Streaming Analysis** - Chunk-by-chunk processing with progressive BPM/key/chord estimates

## Try It Now

Visit the [Demo](/) to try libsonare in your browser. Simply drag and drop an audio file to see the analysis results.
