# WebAssembly Guide

libsonare can be compiled to WebAssembly for audio analysis directly in web
browsers. The key rule: its APIs work on decoded audio samples (a mono
`Float32Array` of numbers), not on a raw `.mp3`/`.wav` file. You get those
samples either by decoding the file yourself with the Web Audio API or another
JavaScript decoder, or by handing the encoded bytes to the `Audio.fromMemory*`
helpers, which decode for you. The table below shows the full path.

Use this page when you are building a browser app. If you are writing a Python script, terminal batch job, or native desktop tool, start with [Getting Started](./getting-started.md) and choose another runtime.

This page covers setup, the one-shot browser APIs, and mastering. For Web Worker integration, performance tuning, and a React example, see [WASM Advanced Usage](./wasm-advanced.md); for live streaming analysis, inverse reconstruction, and the realtime voice changer, see [WASM Streaming and Realtime](./wasm-streaming.md).

## Browser Mental Model

| Step | What happens |
|------|--------------|
| 1. Load a file | Use `fetch`, an `<input type="file">`, drag-and-drop, or another browser source |
| 2. Decode audio | Use `Audio.fromMemory(...)`, `Audio.fromMemoryWithBrowserFallback(...)`, `AudioContext.decodeAudioData(...)`, or your own decoder |
| 3. Choose samples | Pass one mono channel, downmix stereo yourself, or call stereo APIs where available |
| 4. Call libsonare | Pass samples plus `sampleRate` to analysis, editing, mastering, or mixing APIs |

The most common beginner mistake is passing an MP3 `ArrayBuffer` directly to an analysis function. Decode it first; libsonare's browser package works on PCM samples, not compressed file bytes.

Three quick sanity checks catch most setup problems:

- `await init()` has completed before any DSP call.
- The value passed as `sampleRate` is the rate of the decoded samples, usually `audioBuffer.sampleRate`.
- The sample array is PCM audio (`Float32Array`), not encoded file bytes.

::: details What are Float32Array, PCM, mono, and downmixing?
- **PCM samples** are the raw, uncompressed waveform — a long list of amplitude numbers. An MP3/WAV *file* is compressed or wrapped bytes; decoding turns it into PCM.
- **`Float32Array`** is the JavaScript typed array the Web Audio API uses to hold those samples as 32-bit floats (normally in the −1…1 range), one number per sample. libsonare's browser API takes this directly.
- **Mono / downmixing** — mono is a single channel. Stereo audio has separate left and right channels; *downmixing* combines them into one (typically by averaging) so you can pass a single channel to a mono API.
:::

## What You Will Learn

By the end of this page you should be able to:

- install and initialize the WASM package correctly;
- decode browser files into PCM and pass the right channel/sample-rate pair to libsonare;
- choose between one-shot functions, `Audio`, `StreamAnalyzer`, `StreamingMasteringChain`, `Mixer`, and `RealtimeEngine`;
- understand the bundle-size and Worker/AudioWorklet tradeoffs before shipping a browser app.

## Installation

### npm/yarn

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

### CDN

```html
<script type="module">
  import { init, detectBpm } from 'https://unpkg.com/@libraz/libsonare';
</script>
```

## Basic Usage

```typescript
import { init, detectBpm, detectKey, analyze } from '@libraz/libsonare';

async function analyzeAudio() {
  // Initialize WASM module
  await init();

  // Get audio data from AudioContext
  const audioCtx = new AudioContext();
  const response = await fetch('music.mp3');
  const arrayBuffer = await response.arrayBuffer();
  const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

  // Get one mono channel. Downmix explicitly if you need both stereo channels.
  const samples = audioBuffer.getChannelData(0);
  const sampleRate = audioBuffer.sampleRate;

  // Detect BPM
  const bpm = detectBpm(samples, sampleRate);
  console.log(`BPM: ${bpm}`);

  // Detect key
  const key = detectKey(samples, sampleRate);
  console.log(`Key: ${key.name}`);  // "C major"

  // All-in-one analysis
  const result = analyze(samples, sampleRate);
  console.log(result);
}
```

CLI equivalent for the same one-file checks:

```bash
sonare bpm music.mp3
sonare key music.mp3
sonare analyze music.mp3 --json
```

The demo below is the same data flow in visual form: decoded samples go in, a time/frequency view comes out. If your browser page can render this kind of result, the WASM package, initialization, decoding, and sample-rate plumbing are all connected.

<SonareDemo id="stft-basics" />

The browser build also exposes the full librosa-parity helper set — functions that mirror the popular Python audio library librosa, so existing librosa recipes port over — grouped by intent:

- **Waveform pre-processing** — `preemphasis` / `deemphasis`, `trimSilence` / `splitSilence`
- **Framing / size alignment** — `frameSignal`, `padCenter`, `fixLength`, `fixFrames`
- **1-D post-processing** — `peakPick`, `vectorNormalize`
- **Features** — `pcen` (mel dynamic-range compression), `tonnetz` (harmonic-space projection), `tempogram` / `plp` (tempo representations)
- **Unit conversion** — `powerToDb` / `amplitudeToDb` / `dbToPower` / `dbToAmplitude`, `framesToSamples` / `samplesToFrames`

See the [JS API reference](./js-api-analysis.md) for signatures and the [librosa Compatibility](./librosa-compatibility.md) mapping.

## Browser Mixing

The WASM package exposes the mixing engine. Use `mixStereo(...)` for one-shot stem rendering, or keep a persistent `Mixer` built from scene JSON when you need buses, sends, insert automation, goniometer data, and strip meters.

```typescript
import { init, Mixer, mixStereo, mixingScenePresetJson } from '@libraz/libsonare';

await init();

const rendered = mixStereo([vocalL, musicL], [vocalR, musicR], sampleRate, {
  faderDb: [-3, -12],
  pan: [0, -0.2],
  width: [1, 0.9],
});

const mixer = Mixer.fromSceneJson(mixingScenePresetJson('vocalReverbSend'), sampleRate, 512);
mixer.scheduleFaderAutomation(0, sampleRate * 4, -6, 's-curve');
const block = mixer.processStereo([vocalBlockL, musicBlockL], [vocalBlockR, musicBlockR]);
const meter = mixer.stripMeter(0, 'postFader');
mixer.delete();
```

For a full walkthrough, see [Mixing Engine](./mixing.md).

CLI equivalent for rendering a built-in mixer scene:

```bash
sonare mix \
  --preset vocalReverbSend \
  --input vocal.wav \
  --input music.wav \
  -o mixed.wav
```

## Audio Class

You can use the `Audio` class as an object-oriented alternative to standalone functions. It wraps the samples and sample rate, so you don't need to pass them every time.

```typescript
import { init, Audio } from '@libraz/libsonare';

await init();

const audioCtx = new AudioContext();
const response = await fetch('music.mp3');
const arrayBuffer = await response.arrayBuffer();
const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

// Create Audio instance
const audio = Audio.fromBuffer(
  audioBuffer.getChannelData(0),
  audioBuffer.sampleRate
);

// Analysis
const bpm = audio.detectBpm();
const key = audio.detectKey();
const result = audio.analyze();

// Effects
const { harmonic, percussive } = audio.hpss();
const stretched = audio.timeStretch(1.5);
const shifted = audio.pitchShift(2);

// Feature extraction
const mel = audio.melSpectrogram();
const mfcc = audio.mfcc();
const chroma = audio.chroma();
const pitch = audio.pitchPyin();

console.log(`BPM: ${bpm}, Key: ${key.name}`);
console.log(`Median pitch: ${pitch.medianF0.toFixed(1)} Hz`);
```

CLI equivalents for the calls above. All four are available in the Python CLI:

```bash
sonare analyze music.mp3 --json
sonare hpss music.mp3 -o separated --json
sonare pitch-shift music.wav --semitones 2 -o shifted.wav
sonare pitch music.mp3 --algorithm pyin --json
```

See the [JS API Reference](/docs/js-api-audio#audio-class) for the full list of instance methods.

## Browser Mastering

The `/mastering` demo uses the same WASM package described here. Audio decoding happens in the browser, mastering work runs in a Web Worker, and the rendered WAV plus JSON report are created locally.

For implementation details, see [Mastering Implementation](./mastering-implementation.md), [Browser Local Processing](./glossary/concepts/browser-local-processing.md), [Mastering](./glossary/mastering.md), and [Stereo, Limiter, and Loudness Controls](./glossary/mastering/stereo-limiter-loudness.md).

The mastering API also includes `masteringAssistantSuggest(...)`, `masteringAudioProfile(...)`, and `masteringStreamingPreview(...)` for JSON-driven assistant output, source profiling, and platform preview reporting.

CLI equivalent for a simple loudness-normalized master:

```bash
sonare mastering track.wav --target-lufs -14 --ceiling-db -1 -o master.wav
```

## File Input

Most WASM APIs take decoded PCM samples. For encoded bytes, use
`Audio.fromMemory(...)` for WAV/MP3 or
`Audio.fromMemoryWithBrowserFallback(...)` to try the native decoder first and
then use `AudioContext.decodeAudioData()` for browser-supported formats such as
AAC, OGG, and FLAC.

```typescript
async function analyzeFile(file: File) {
  await init();
  const audioCtx = new AudioContext();

  const arrayBuffer = await file.arrayBuffer();
  const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
  const samples = audioBuffer.getChannelData(0);

  return analyze(samples, audioBuffer.sampleRate);
}

// Usage with file input
const input = document.querySelector('input[type="file"]');
input.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  const result = await analyzeFile(file);
  console.log(`BPM: ${result.bpm}`);
});
```

## Progress Reporting

```typescript
import { init, analyzeWithProgress } from '@libraz/libsonare';

await init();

const result = analyzeWithProgress(samples, sampleRate, (progress, stage) => {
  const percent = Math.round(progress * 100);
  console.log(`${stage}: ${percent}%`);

  // Update UI
  progressBar.style.width = `${percent}%`;
  statusText.textContent = stage;
});
```

## Cancellation

Long-running offline analysis and mastering calls take a `cancel` callback. It
is polled at the same progress boundaries `onProgress` reports, so a user who
loads the wrong file does not have to wait out the render.

```typescript
import {
  ErrorCode,
  init,
  isSonareError,
  masteringChainWithProgress,
} from '@libraz/libsonare';

await init();

let abandoned = false;
cancelButton.onclick = () => { abandoned = true; };

try {
  const result = masteringChainWithProgress({
    samples,
    sampleRate,
    config,
    onProgress: (progress, stage) => updateUi(progress, stage),
    cancel: () => abandoned,
  });
  render(result);
} catch (error) {
  if (!(isSonareError(error) && error.code === ErrorCode.Cancelled)) throw error;
  // Expected: the user asked to stop.
}
```

Returning `true` from `cancel` aborts the call, which throws with
`SONARE_ERROR_CANCELLED` (error code 8). A cancelled call leaves its outputs
unallocated — there is no partial result to read, so treat the throw as "nothing
happened" rather than "half a master".

## Stereo to Mono Conversion

```typescript
async function getMonoSamples(audioBuffer: AudioBuffer): Promise<Float32Array> {
  if (audioBuffer.numberOfChannels === 1) {
    return audioBuffer.getChannelData(0);
  }

  // Mix stereo to mono
  const left = audioBuffer.getChannelData(0);
  const right = audioBuffer.getChannelData(1);
  const mono = new Float32Array(left.length);

  for (let i = 0; i < left.length; i++) {
    mono[i] = (left[i] + right[i]) / 2;
  }

  return mono;
}
```

## Browser Compatibility

| Browser | Minimum Version |
|---------|-----------------|
| Chrome | 57+ |
| Firefox | 52+ |
| Safari | 11+ |
| Edge | 16+ |

Requirements:
- WebAssembly support
- Web Audio API
- ES2017+ (async/await)

## Package Artifacts

The published package ships a few coordinated pieces:

- **Main module** — `sonare.js` plus `sonare.wasm`, the Emscripten build behind every analysis, mastering, mixing, and editing API.
- **Main API entry** — the package `index` (`index.js` / `index.d.ts`) is the tsup bundle behind `import ... from '@libraz/libsonare'`; it exposes the all-in-one analysis, mastering, mixing, and editing API.
- **AudioWorklet entry** — `worklet.js` / `worklet.d.ts`, a separate, self-contained tsup bundle (no code-splitting, so it is fully portable into an `AudioWorkletGlobalScope`); it carries the `SonareEngine` API, the worklet processor classes and their registration helpers, and the ring-buffer protocol, and re-exports only `init` / `isInitialized` from the main entry so the worklet realm can initialize its own WASM instance.
- **Analysis-only module** — `sonare-analysis.js` / `sonare-analysis.wasm` behind the `@libraz/libsonare/analysis` entry, compiled without the mastering, mixing, realtime, and project bindings. CI records its size in a report, but size growth alone does not fail the build.
- **Offline Worker entry** — `worker.js` behind `@libraz/libsonare/worker`, the Worker side of `OfflineWorkerClient`.
- **Voice-changer JSON Schemas** — both preset schemas ship in the package under `schemas/`, so a host can validate a preset document without fetching anything.

### Instantiating The Module Yourself

`sonare.js` / `sonare.wasm` are the Emscripten module the package wraps, and almost no application needs to touch them directly: importing from `@libraz/libsonare` instantiates the module, keeps one instance per realm, and is the supported entry point. If you do instantiate the module yourself — a custom loader, a non-standard bundler target, a host that manages its own heap — one input shape is worth knowing about.

::: warning The mastering-chain binding takes the flattened envelope only
The module's mastering-chain entry accepts exactly one configuration shape: the flattened parameter envelope that the core's own parameter parser reads. Hand it a nested configuration object instead and the call is **refused by name** — it reports the configuration it cannot read rather than applying the part of it that it recognizes and dropping the rest.

**This does not affect the npm package.** `masteringChain` and `masterAudio` flatten a nested `MasteringChainConfig` — repair stages, denoise settings and all — before anything crosses into the module, so code that imports from `@libraz/libsonare` passes nested configs exactly as the JavaScript API describes and is unaffected. Only a caller who instantiates the module directly and passes a nested object straight into the binding meets this, and what they get is a clear error instead of a partly applied chain.
:::

## Bundle Size

The size table covers the main module and the main API entry. The analysis-only
module, the realtime runtime, and the worklet bundle are separate artifacts and
are not listed here — the analysis module is substantially smaller than
`sonare.wasm` because it leaves the mastering, mixing, realtime, and project
surfaces out.

| File | Size | Gzipped |
|------|------|---------|
| `sonare.js` | ~{{ wasmMeta.sonareJs.sizeKB }} KB | ~{{ wasmMeta.sonareJs.gzipKB }} KB |
| `index.js` | ~{{ wasmMeta.indexJs.sizeKB }} KB | ~{{ wasmMeta.indexJs.gzipKB }} KB |
| `sonare.wasm` | ~{{ wasmMeta.wasm.sizeKB }} KB | ~{{ wasmMeta.wasm.gzipKB }} KB |
| **Total** | ~{{ wasmMeta.total.sizeKB }} KB | ~{{ wasmMeta.total.gzipKB }} KB |

## Troubleshooting

### AudioContext Not Allowed

Modern browsers require user interaction before creating AudioContext:

```typescript
document.addEventListener('click', async () => {
  const audioCtx = new AudioContext();
  await audioCtx.resume();
});
```

### Cross-Origin Issues

When loading audio from other domains:

```typescript
const response = await fetch(url, {
  mode: 'cors',
  credentials: 'omit'
});
```

### Memory Issues

For very long audio files, consider analyzing in chunks:

```typescript
const CHUNK_DURATION = 60; // seconds

for (let start = 0; start < totalDuration; start += CHUNK_DURATION) {
  const chunk = samples.slice(
    start * sampleRate,
    (start + CHUNK_DURATION) * sampleRate
  );
  // Analyze chunk
}
```

### Native Failures Throw `SonareError`

When the C++ core rejects an input, the WASM binding throws a structured `SonareError` carrying a numeric `code` and `codeName` — never a raw Emscripten pointer number or an opaque `[object Object]`. Catch it with the exported `isSonareError(...)` guard and branch on `ErrorCode`; see [Error Handling](./js-api-types.md#error-handling).

That holds for the mixing and project entry points too: each reports the error code its own C entry point documents rather than surfacing the underlying C++ exception. `Mixer.fromSceneJson` on a scene that names an unknown insert throws `InvalidState` with the wrapped message from the core, and malformed scene JSON throws `InvalidState` as well — not an unknown-error code. Code that only branches on success needs no change; code that branches on a specific code should branch on the documented one.

## Where the sections went

| Section | Page |
|---|---|
| Web Worker Usage | [WASM Advanced Usage](./wasm-advanced.md) |
| Performance Tips | [WASM Advanced Usage](./wasm-advanced.md) |
| React Example | [WASM Advanced Usage](./wasm-advanced.md) |
| Streaming Analysis | [WASM Streaming and Realtime](./wasm-streaming.md) |
| Inverse Reconstruction | [WASM Streaming and Realtime](./wasm-streaming.md) |
| Streaming Retune | [WASM Streaming and Realtime](./wasm-streaming.md) |
| Realtime Voice Changer | [WASM Streaming and Realtime](./wasm-streaming.md) |
