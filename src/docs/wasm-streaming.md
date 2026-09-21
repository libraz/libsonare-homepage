---
title: WASM Streaming and Realtime
description: The libsonare WASM streaming and realtime APIs — live StreamAnalyzer analysis with AudioWorklet integration, inverse reconstruction from mel/MFCC, StreamingRetune, and RealtimeVoiceChanger.
---

# WASM Streaming and Realtime

This page covers the WASM streaming and realtime APIs — live streaming analysis, inverse reconstruction, streaming retune, and the realtime voice changer — continuing from [WebAssembly Guide](./wasm.md).

## Streaming Analysis

The Streaming API enables real-time audio analysis with low latency. Unlike batch analysis, streaming processes audio chunk by chunk as it arrives.

::: info Batch vs Streaming
| Approach | Use Case | Latency | Features |
|----------|----------|---------|----------|
| **Batch** | Pre-recorded files | High | All-in-one analysis (BPM, chords, sections) |
| **Streaming** | Live audio, visualization | Low (~10ms) | Mel, chroma, onset, updating BPM/key |
:::

<SonareDemo id="loudness-meter" />

### Architecture Overview

Audio capture and analysis run on the AudioWorklet thread so the main thread stays free to paint; only the small, already-computed frame buffer crosses the thread boundary via `postMessage`, not raw audio.

<FlowDiagram
  title="Streaming pipeline"
  :nodes="[
    { id: 'mic', label: 'Mic / File', col: 0, row: 0, group: 'browser', variant: 'muted' },
    { id: 'ctx', label: 'AudioContext', col: 1, row: 0, group: 'browser' },
    { id: 'node', label: 'AudioWorkletNode', col: 2, row: 0, group: 'browser', variant: 'accent' },
    { id: 'processor', label: 'AudioWorkletProcessor', col: 3, row: 0, group: 'worklet' },
    { id: 'analyzer', label: 'StreamAnalyzer', col: 4, row: 0, group: 'worklet', variant: 'accent' },
    { id: 'buffer', label: 'Quantized frames', col: 5, row: 0, group: 'worklet' },
    { id: 'viz', label: 'Visualization', col: 6, row: 0, group: 'main' },
    { id: 'canvas', label: 'Canvas / WebGL', col: 7, row: 0, group: 'main', variant: 'success' }
  ]"
  :edges="[
    { from: 'mic', to: 'ctx' },
    { from: 'ctx', to: 'node' },
    { from: 'node', to: 'processor' },
    { from: 'processor', to: 'analyzer' },
    { from: 'analyzer', to: 'buffer' },
    { from: 'buffer', to: 'viz', label: 'postMessage', style: 'dashed' },
    { from: 'viz', to: 'canvas' }
  ]"
  :groups="[
    { id: 'browser', label: 'Browser' },
    { id: 'worklet', label: 'AudioWorklet Thread' },
    { id: 'main', label: 'Main Thread' }
  ]"
  caption="Everything left of the dashed edge runs off the main thread; only the postMessage hop crosses back to it."
/>

### Basic Example

::: warning `ScriptProcessorNode` is deprecated — use AudioWorklet in production
The first example below uses `createScriptProcessor()` because it is the shortest way to see frames flowing. `ScriptProcessorNode` is **deprecated**: it runs on the main thread and can glitch under load. For anything real, use the [AudioWorklet integration](#audioworklet-integration) shown right after it, which runs the analyzer off the main thread.
:::

```typescript
import { init, StreamAnalyzer } from '@libraz/libsonare';

async function setupStreaming() {
  await init();

  const audioCtx = new AudioContext();
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const source = audioCtx.createMediaStreamSource(stream);

  // Create analyzer with output-frame throttling
  const analyzer = new StreamAnalyzer({
    sampleRate: audioCtx.sampleRate,
    nFft: 2048,
    hopLength: 512,
    nMels: 128,
    computeMel: true,
    computeChroma: true,
    computeOnset: true,
    emitEveryNFrames: 4, // emit one frame per 4 hops (~21 frames/s at 44100Hz, hopLength 512)
  });

  // Use ScriptProcessor for simplicity (AudioWorklet recommended for production)
  const processor = audioCtx.createScriptProcessor(512, 1, 1);

  processor.onaudioprocess = (e) => {
    const input = e.inputBuffer.getChannelData(0);
    analyzer.process(input);

    const available = analyzer.availableFrames();
    if (available > 0) {
      const frames = analyzer.readFrames(available);
      updateVisualization(frames);

      // Check BPM/key estimates that update as audio arrives
      const stats = analyzer.stats();
      if (stats.estimate.updated) {
        const keyNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const mode = stats.estimate.keyMinor ? 'minor' : 'major';
        console.log(`BPM: ${stats.estimate.bpm.toFixed(1)}`);
        // estimate.key is a PitchClass index (0-11), not a string
        console.log(`Key: ${keyNames[stats.estimate.key]} ${mode}`);
      }
    }
  };

  source.connect(processor);
  processor.connect(audioCtx.destination);
}
```

### AudioWorklet Integration

For production use, run `StreamAnalyzer` in an AudioWorklet — the browser's dedicated audio-rendering thread — so analysis does not block the main thread. The example below shows a self-contained analyzer worklet.

::: warning WASM in AudioWorklet
Loading WASM in AudioWorklet requires special handling. The WASM module must be loaded and instantiated within the worklet context.
:::

**analyzer-worklet.ts:**

```typescript
import { init, StreamAnalyzer } from '@libraz/libsonare';

class AnalyzerWorklet extends AudioWorkletProcessor {
  private analyzer?: StreamAnalyzer;
  private frameCounter = 0;

  constructor() {
    super();
    void init().then(() => {
      // sampleRate is a global in AudioWorkletGlobalScope
      this.analyzer = new StreamAnalyzer({
        sampleRate,
        nFft: 2048,
        hopLength: 512,
        nMels: 64, // reduced for bandwidth
        computeMel: true,
        computeChroma: true,
        computeOnset: true,
        emitEveryNFrames: 4,
      });
    });
  }

  process(inputs: Float32Array[][]): boolean {
    const input = inputs[0]?.[0];
    if (!input || input.length === 0 || !this.analyzer) return true;

    this.analyzer.process(input);

    const available = this.analyzer.availableFrames();
    if (available >= 4) {
      const frames = this.analyzer.readFrames(available);

      // Transfer buffers for zero-copy
      this.port.postMessage({
        type: 'frames',
        data: frames
      }, [
        frames.timestamps.buffer,
        frames.mel.buffer,
        frames.chroma.buffer
      ]);
    }

    // Periodically send stats
    if (++this.frameCounter % 100 === 0) {
      this.port.postMessage({
        type: 'stats',
        data: this.analyzer.stats()
      });
    }

    return true;
  }
}

registerProcessor('analyzer-worklet', AnalyzerWorklet);
```

**main.ts:**

```typescript
const audioCtx = new AudioContext();
await audioCtx.audioWorklet.addModule('analyzer-worklet.js');

const workletNode = new AudioWorkletNode(audioCtx, 'analyzer-worklet');

workletNode.port.onmessage = (e) => {
  if (e.data.type === 'frames') {
    renderVisualization(e.data.data);
  } else if (e.data.type === 'stats') {
    updateBpmDisplay(e.data.data.estimate);
  }
};

// Connect audio source
const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
const source = audioCtx.createMediaStreamSource(stream);
source.connect(workletNode);
```

::: details Related entry points (realtime engine, MIDI)
The example above builds a custom analyzer worklet. If you instead want to run the whole playback engine in a worklet — track lanes, channel strips, buses, MIDI clips, live MIDI, instruments, and capture — the package ships an AudioWorklet bridge at `@libraz/libsonare/worklet`. The bridge's `SonareEngine` API mirrors that engine to the worklet; see [Realtime and Streaming](./realtime-streaming.md).

The main package entry (`@libraz/libsonare`) also ships two main-thread browser integration helpers: `bindMicrophoneInput(...)` wires `getUserMedia` into an AudioWorklet engine node (see [Recording and Takes](./recording-and-takes.md)), and `bindWebMidi(...)` bridges Web MIDI input to the engine (see [MIDI Input](./midi-input.md)).
:::

### Bandwidth Optimization

The TypeScript `StreamAnalyzer` has three read methods. Choose them by how much precision your UI needs and how much data you can afford to move between threads.

| Method | Returned type | Use when |
|--------|---------------|----------|
| `readFrames(maxFrames)` | `FrameBuffer` with `Float32Array` / `Int32Array` fields | You need full precision for analysis or high-quality visuals |
| `readFramesI16(maxFrames)` | `StreamFramesI16` | You want smaller payloads but still enough precision for most visual meters |
| `readFramesU8(maxFrames)` | `StreamFramesU8` | You need very small payloads for mobile or dense visual updates |

The analyzer still computes internally in float. Select the transfer precision with the explicit read method: `readFrames()` for float data, `readFramesI16()` for 16-bit data, or `readFramesU8()` for 8-bit data. `StreamConfig.outputFormat` is retained only for source compatibility and must be omitted or set to `0`; the C++/WASM read path quantizes the integer forms, so you do not need to quantize manually before `postMessage`.

Both quantized read paths accept an optional `StreamQuantizeConfig` to widen the quantization ranges for unusually loud or quiet streams that would otherwise saturate; see [custom quantization ranges](./realtime-streaming.md#custom-quantization-ranges).

Plain lists and objects returned from WASM are rooted back into the JavaScript realm that called them. That means arrays from name-list helpers (`*Names()`), preset-name helpers, section results, key-candidate calls, and the object from `synthPresetPatch(...)` can be passed through `structuredClone()` or `postMessage()` without first rebuilding them by hand. Typed-array payloads still follow the normal transferable-buffer rules below.

::: details What are "Structure-of-Arrays" and transferable objects?
- **Structure-of-Arrays (SoA)** means each field lives in its own flat typed array — all timestamps in one array, all mel values in another — instead of an array of per-frame objects. It is cheaper to slice and cheaper to hand to another thread.
- **Transferable objects** are `ArrayBuffer`s that `postMessage` can *move* to a worker instead of copying. Ownership transfers (the sender's view becomes empty afterward), which makes passing audio frames between threads near-instant. List the buffers in the second argument: `postMessage(msg, [buffer, ...])`.
- **Quantizing** here means packing each float into a smaller 16-bit or 8-bit integer — fewer bytes to send, at the cost of precision (fine for a meter or heatmap, not for further DSP).
:::

| Approach | Approx. size per frame | Best For |
|----------|------------------------|----------|
| `readFrames()` (Float32 SoA) | ~600 bytes | General use, full precision |
| `readFramesI16()` (quantized SoA) | ~300 bytes | High-quality visualizations |
| `readFramesU8()` (quantized SoA) | ~150 bytes | Mobile, bandwidth-limited |

### Updating Estimates

The Streaming API provides **BPM and key estimates that improve over time**:

```typescript
const stats = analyzer.stats();

// BPM (available after ~10 seconds — see StreamConfig.bpmUpdateIntervalSec)
if (stats.estimate.bpm > 0) {
  const confidence = stats.estimate.bpmConfidence;
  console.log(`BPM: ${stats.estimate.bpm.toFixed(1)} (${(confidence * 100).toFixed(0)}%)`);
}

// Key (available after ~5 seconds — see StreamConfig.keyUpdateIntervalSec)
if (stats.estimate.key >= 0) {
  const keyNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const keyName = keyNames[stats.estimate.key];
  const mode = stats.estimate.keyMinor ? 'minor' : 'major';
  console.log(`Key: ${keyName} ${mode}`);
}
```

### Visualization Example

```typescript
import type { StreamAnalyzer } from '@libraz/libsonare';

function renderVisualization(frames: ReturnType<StreamAnalyzer['readFrames']>, nMels: number) {
  const { nFrames, mel, chroma, onsetStrength } = frames;

  // Render mel spectrogram (scrolling display). Values are linear power; clamp/scale to 0-1.
  for (let f = 0; f < nFrames; f++) {
    for (let m = 0; m < nMels; m++) {
      const value = Math.min(1, mel[f * nMels + m]);
      const c = Math.round(value * 255);
      const color = `rgb(${c}, ${Math.round(c * 0.5)}, ${255 - c})`;
      // Draw pixel at (scrollX + f, nMels - m)
    }
  }

  // Render chroma (12 pitch classes)
  for (let f = 0; f < nFrames; f++) {
    for (let c = 0; c < 12; c++) {
      const value = chroma[f * 12 + c];
      // Draw chroma bar
    }
  }

  // Trigger effects on strong onsets (linear units)
  for (let f = 0; f < nFrames; f++) {
    if (onsetStrength[f] > 1.5) { // tune threshold for your audio
      triggerBeatEffect();
    }
  }
}
```

## Inverse Reconstruction

The WASM build ships the inverse reconstruction helpers, so you can go from a mel spectrogram or MFCC matrix back to a spectrum or audio entirely in the browser:

```typescript
import { melSpectrogram, melToAudio, mfcc, mfccToAudio, init } from '@libraz/libsonare';

await init();

// Mel → audio (Griffin-Lim phase reconstruction)
const mel = melSpectrogram(samples, sampleRate, 2048, 512, 128);
const reconstructed = melToAudio(mel.power, mel.nMels, mel.nFrames, sampleRate);

// MFCC → audio
const m = mfcc(samples, sampleRate, 2048, 512, 128, 20);
const fromMfcc = mfccToAudio(m.coefficients, m.nMfcc, m.nFrames, mel.nMels, sampleRate);
```

Source-built C++ CLI equivalents:

```bash [C++ CLI]
sonare mel-to-audio music.wav -o mel-reconstructed.wav
sonare mfcc-to-audio music.wav -o mfcc-reconstructed.wav
```

| Function | Returns | Notes |
|----------|---------|-------|
| `melToStft(melPower, nMels, nFrames, sampleRate?, nFft?, fmin?, fmax?, htk?)` | `StftPowerResult` `{ nBins, nFrames, power }` | Pseudo-inverse of the mel filterbank |
| `melToAudio(melPower, nMels, nFrames, sampleRate?, nFft?, hopLength?, fmin?, fmax?, nIter?, htk?)` | `Float32Array` | Griffin-Lim audio synthesis |
| `mfccToMel(mfccCoefficients, nMfcc, nFrames, nMels?, lifter?)` | `MelPowerResult` `{ nMels, nFrames, power }` | Inverse DCT back to a mel spectrogram; pass the forward MFCC lifter |
| `mfccToAudio(mfccCoefficients, nMfcc, nFrames, nMels, sampleRate?, nFft?, hopLength?, fmin?, fmax?, nIter?, htk?, lifter?)` | `Float32Array` | MFCC → mel → audio in one call; pass the forward MFCC lifter |

::: warning Lossy round-trip
These reconstruct *magnitude* and estimate phase with Griffin-Lim, so the output is an approximation — fine for sonification, audition, and visualization, not for bit-exact recovery. See [Inverse Features](./inverse-features.md) for the processing flow and caveats.
:::

## Streaming Retune

`StreamingRetune` is the WASM block-by-block mono retune object. Use it for live or chunked pitch shifting when you need state to continue across blocks.

```typescript
import { init, StreamingRetune } from '@libraz/libsonare';

await init();

const retune = new StreamingRetune({ semitones: 3, mix: 1 });
retune.prepare(48000, 512);

try {
  const shifted = retune.processMono(inputBlock);
  retune.setConfig({ semitones: -2, mix: 0.75 });
  const next = retune.processMono(nextInputBlock);
  console.log(shifted, next, retune.grainSize());
} finally {
  retune.delete();
}
```

For file-based offline processing from the terminal, use the closest CLI
commands. Both are available in the Python CLI:

```bash
sonare pitch-shift vocal.wav --semitones 3 -o shifted.wav
sonare voice-change vocal.wav --pitch-semitones 3 --formant-factor 1.0 -o voice.wav
```

## Realtime Voice Changer

`RealtimeVoiceChanger` is the WASM object for the preset-based live voice chain. It is separate from the offline `voiceChange(...)` helper because it keeps DSP state across blocks and exposes heap-backed zero-copy buffers for AudioWorklet-style loops.

```typescript
import {
  init,
  RealtimeVoiceChanger,
  realtimeVoiceChangerPresetConfig,
  realtimeVoiceChangerPresetNames,
  voiceCharacterPresetId,
} from '@libraz/libsonare';

await init();

const changer = new RealtimeVoiceChanger('bright-idol');
changer.prepare(48000, 128, 1);

try {
  const out = changer.processMono(inputBlock);

  const realtime = changer.createRealtimeMonoBuffer(128);
  realtime.input.set(inputBlock.subarray(0, 128));
  realtime.process();

  console.log(
    voiceCharacterPresetId(1),
    realtimeVoiceChangerPresetNames(),
    realtimeVoiceChangerPresetConfig('bright-idol'),
    out,
    realtime.output,
  );
} finally {
  changer.delete();
}
```

Use `realtimeVoiceChangerPresetJson(name)` to inspect a built-in preset and `validateRealtimeVoiceChangerPresetJson(json)` before accepting user-authored preset JSON. `RealtimeVoiceChangerConfigInput` accepts one of the six strict `VoicePresetId` strings or a preset object with either a `dsp` object or a `macros` object, never both. `voiceCharacterPresetId(...)` returns `null` for an unknown numeric ordinal and throws for an unknown string ID; `realtimeVoiceChangerPresetConfig(...)` throws when it cannot resolve a preset. If you need the canonical ID or resolved flat POD config, use `voiceCharacterPresetId(...)` and `realtimeVoiceChangerPresetConfig(...)`.

