# Getting Started

libsonare is a C++17 audio analysis library for music information retrieval (MIR).

## Features

- **BPM Detection** - Accurate tempo estimation using tempogram and autocorrelation
- **Key Detection** - Musical key detection using Krumhansl-Schmuckler algorithm
- **Beat Tracking** - Dynamic programming-based beat extraction
- **Chord Recognition** - Template matching with 108 chord types
- **Section Detection** - Structural segmentation (Intro, Verse, Chorus, etc.)
- **Melody / Pitch Tracking** - YIN and pYIN algorithms for F0 detection
- **Audio Characteristics** - Timbre, dynamics, rhythm analysis
- **Spectral Features** - Mel spectrogram, MFCC, chroma, CQT/VQT, spectral centroid/flatness
- **Audio Effects** - HPSS, time stretch, pitch shift, normalize, trim
- **Streaming Analysis** - Real-time chunk-by-chunk processing with progressive BPM/key/chord estimation

## Quick Start

::: warning Package Not Published
The npm package `@libraz/libsonare` is currently in beta and not yet publicly available. See [Installation](/docs/installation) for alternative options.
:::

### Browser (WebAssembly)

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

### Python / Node.js (Native)

Native bindings are available for Python (ctypes) and Node.js (N-API). See [Native Bindings](/docs/native-bindings) for installation and API reference.

## Try It Now

Visit the [Demo](/) to try libsonare in your browser. Simply drag and drop an audio file to see the analysis results.
