# Getting Started

libsonare is a C++17 audio analysis library for music information retrieval (MIR).

## Features

- **BPM Detection** - Accurate tempo estimation using tempogram and autocorrelation
- **Key Detection** - Musical key detection using Krumhansl-Schmuckler algorithm
- **Beat Tracking** - Dynamic programming-based beat extraction
- **Chord Recognition** - Template matching with 84 chord types
- **Section Detection** - Structural segmentation (Intro, Verse, Chorus, etc.)
- **Audio Characteristics** - Timbre, dynamics, rhythm analysis

## Quick Start

::: warning Package Not Published
The npm package `@libraz/sonare` is currently in beta and not yet publicly available. See [Installation](/docs/installation) for alternative options.
:::

### Browser (WebAssembly)

```typescript
import { init, analyze } from '@libraz/sonare';

// Initialize the WASM module
await init();

// Analyze audio samples
const result = analyze(samples, sampleRate);

console.log('BPM:', result.bpm);
console.log('Key:', result.key.name);
console.log('Chords:', result.chords);
```

### Node.js / C++

See [Installation](/docs/installation) for native usage.

## Try It Now

Visit the [Demo](/) to try libsonare in your browser. Simply drag and drop an audio file to see the analysis results.
