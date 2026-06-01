# Getting Started

libsonare is a dependency-free C++17 audio DSP toolkit for music information retrieval (MIR), mastering, mixing, editing, creative FX, and browser-native music tools.

If you are unsure which feature or runtime you need, start with the [Learning Path](./learning-path.md). This page assumes you are ready to run a first example.

## What You Will Learn

By the end of this page you should be able to:

- explain the basic sample/sample-rate/mono/stereo vocabulary used by every API;
- choose the runtime that matches your project before installing anything;
- run one minimal browser, Python, CLI, or Node native example;
- know which runtime-specific reference to open next.

## Before You Choose A Runtime

Most examples follow the same pattern: load or decode audio, pass `Float32Array` samples plus a sample rate, then read analysis or processing results. Browser code usually needs you to decode the file first. Python and CLI workflows can usually load common audio files directly.

| Term | Plain meaning |
|------|---------------|
| Sample | One amplitude value in the audio waveform |
| Sample rate | How many samples exist per second, such as 44,100 or 48,000 |
| Mono | One channel of audio |
| Stereo | Two channels, left and right |
| WASM | WebAssembly, the browser runtime used by the npm package |

::: info Separate the file from the samples
MP3 and WAV are file formats. Most libsonare APIs receive decoded PCM samples, such as a `Float32Array` in JavaScript or a sample array in Python. In the browser you decode the file first; in Python and CLI workflows the package can often load the file for you.
:::

## Choose Your Runtime

Start with the page that matches where you will run libsonare:

| You want to... | Use | Start here |
|----------------|-----|------------|
| Analyze audio in a web app | Browser WebAssembly package | [Browser / WASM](/docs/wasm) |
| Analyze files from Python scripts or notebooks | Python package from PyPI | [Python API](/docs/python-api) |
| Run analysis from a terminal | `sonare` CLI installed from PyPI via `pip install libsonare` | [CLI Reference](/docs/cli) |
| Add pitch or voice editing | Editing DSP | [Editing DSP](/docs/editing-dsp) |
| Estimate room decay, clarity, or blind acoustic parameters | Acoustic analysis helpers | [Room Acoustics](/docs/acoustic-analysis) |
| Build a mixer, routing view, or stem renderer | Mixing engine through WASM, Python, Node, or C++ | [Mixing Engine](/docs/mixing) |
| Build a mastering UI with explainable suggestions | Mastering assistant/profile/preview APIs | [Mastering Assistant](/docs/mastering-assistant) |
| Build live visualizations or playback tools | Streaming analyzer and realtime engine | [Realtime and Streaming](/docs/realtime-streaming) |
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
print(f"Key: {result.key.name}")
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
yarn install
yarn build
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
- **Room Acoustics** - reverberation time (RT60 / EDT), clarity (C50 / C80), definition (D50), octave-band decay, and blind acoustic estimates
- **Spectral Features** - Mel spectrogram, MFCC, chroma, CQT/VQT, spectral centroid, and flatness
- **Audio Effects** - HPSS, time stretch, pitch shift, normalize, and trim
- **Streaming Analysis** - Chunk-by-chunk processing with progressive BPM/key/chord estimates
- **Mastering** - Preset and configurable mastering chains with LUFS targets, true-peak limiting, EQ, dynamics, repair, stereo tools, and reference matching
- **Mixing** - Channel strips, sends, buses, automation, scene presets, goniometer/true-peak metering, and offline stereo rendering
- **Editing DSP and inserts** - Direct pitch correction, note-region stretch, and voice-change pitch/formant controls; reverb and ducking are available through named processor or mixer insert paths where enabled
- **Inverse Feature Helpers** - Approximate STFT/audio reconstruction from mel spectrograms and MFCCs

::: details Acronyms in this list
- **BPM** — beats per minute; the tempo of the song.
- **STFT** — short-time Fourier transform; the windowed frequency analysis behind spectrograms.
- **MFCC** — compact timbre features often used for ML or classification.
- **CQT / VQT** — frequency analyses shaped around musical pitch spacing.
- **HPSS** — harmonic/percussive source separation.
- **LUFS / True Peak** — mastering metrics for perceived loudness and peak safety.
- **Goniometer** — a stereo meter that visualizes width and phase behavior.
:::

## Try It Now

Visit the [Demos](/demos) to try libsonare in your browser. Simply drag and drop an audio file to see the analysis results.
