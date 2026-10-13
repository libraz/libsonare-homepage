---
title: WASM Streaming and Realtime
description: The libsonare WASM streaming and realtime APIs — live StreamAnalyzer analysis with AudioWorklet integration, inverse reconstruction from mel/MFCC, StreamingRetune, and RealtimeVoiceChanger.
---

# WASM Streaming and Realtime

This page covers the WASM streaming and realtime APIs: live streaming analysis, inverse reconstruction, streaming retune, and the realtime voice changer. It continues from [WebAssembly Guide](./wasm.md).

## Streaming Analysis

The Streaming API analyzes audio chunk by chunk as it arrives, so a visualizer or a live BPM/key readout does not wait for the whole file.

::: info Batch vs Streaming
| Approach | Use Case | Latency | Features |
|----------|----------|---------|----------|
| **Batch** | Pre-recorded files | High | All-in-one analysis (BPM, chords, sections) |
| **Streaming** | Live audio, visualization | Low (one analysis window, ~46 ms at nFft 2048 / 44.1 kHz) | Mel, chroma, onset, updating BPM/key |
:::

<SonareDemo id="loudness-meter" />

### Choosing where the analyzer runs

| Path | Analysis runs on | WASM in the worklet | Use it for |
|------|------------------|---------------------|------------|
| [`SonareStreamAnalyzerNode`](#analyze-a-graph-branch) | Main thread | No | The default for a live graph: no processor to write, no `SharedArrayBuffer` |
| [Custom analyzer worklet](#custom-analyzer-worklet) | Audio thread | Yes | Analysis that must stay off the main thread and next to your own DSP |
| [`ScriptProcessorNode`](#basic-example) | Main thread | No | Demos only; the node is deprecated |

### Analyze a graph branch

`SonareStreamAnalyzerNode` runs a `StreamAnalyzer` against any node in your audio graph. The worklet side only averages the input channels to mono and transfers fixed-size chunks (`chunkFrames`, default 4096, at least 128); the analyzer itself runs on the main thread, so its frames lag the audio by about one chunk. The node has one input and no output.

```typescript
// analyzer-worklet.ts
import { registerSonareStreamAnalyzerWorkletProcessor } from '@libraz/libsonare/worklet';

registerSonareStreamAnalyzerWorkletProcessor();
```

```typescript
// main.ts
import { init } from '@libraz/libsonare';
import { SonareStreamAnalyzerNode } from '@libraz/libsonare/worklet';

await init();
await audioCtx.audioWorklet.addModule('/analyzer-worklet.js');
const analyzer = await SonareStreamAnalyzerNode.create(audioCtx, {
  config: { nMels: 64 },
});
source.connect(analyzer.node);

const stopFrames = analyzer.onFrames((frames) => draw(frames.mel, frames.nFrames));
const stopStats = analyzer.onStats((stats) => console.log(stats.estimate.bpm));

// Later:
stopFrames();
stopStats();
analyzer.destroy();
```

`config` takes the same fields as `new StreamAnalyzer(...)`. `sampleRate` defaults to the context's, and any other value throws `RangeError`. `onFrames` delivers the `readFrames` format, and `onStats` fires when the key or tempo estimate was re-estimated. If a chunk is dropped or the processor restarts, the analyzer's sample offset is reset rather than splicing the two streams together.

### Basic Example

::: warning `ScriptProcessorNode` is deprecated
The example below uses `createScriptProcessor()` because it is the shortest way to see frames flowing. The node runs on the main thread and can glitch under load. For anything real, use [`SonareStreamAnalyzerNode`](#analyze-a-graph-branch) or a [custom analyzer worklet](#custom-analyzer-worklet).
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
    computeMel: true, computeChroma: true, computeOnset: true,
    emitEveryNFrames: 4, // emit one frame per 4 hops (~21 frames/s at 44100Hz, hopLength 512)
  });

  const processor = audioCtx.createScriptProcessor(512, 1, 1);

  processor.onaudioprocess = (e) => {
    const input = e.inputBuffer.getChannelData(0);
    analyzer.process(input);

    const available = analyzer.availableFrames();
    if (available > 0) {
      const frames = analyzer.readFrames(available);
      updateVisualization(frames);

      // BPM/key estimates update as audio arrives
      const stats = analyzer.stats();
      if (stats.estimate.updated) {
        console.log(`BPM: ${stats.estimate.bpm.toFixed(1)}`);
        if (stats.estimate.keyName !== null) console.log(`Key: ${stats.estimate.keyName}`);
      }
    }
  };

  source.connect(processor);
  processor.connect(audioCtx.destination);

  // Call when the session ends: stop the callback, then release the WASM handle.
  return () => {
    processor.disconnect();
    source.disconnect();
    analyzer.delete();
  };
}
```

`delete()` releases the analyzer's WASM handle (`dispose()` is a backward-compatible alias, and `using` works too). An embind handle is never garbage-collected, so release it when the session ends.

### Custom analyzer worklet

Run `StreamAnalyzer` inside your own `AudioWorkletProcessor` when the analysis has to stay off the main thread. Only the small, already-computed frame buffer crosses the thread boundary through `postMessage`, never raw audio.

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

::: warning The worklet needs its own WASM module
A worklet has its own global scope and its own WASM heap. The argument-less `init()` does not work there: it loads the module with a dynamic `import()`, which a worklet scope forbids, and the glue code resolves the `.wasm` file through `URL` and `fetch`, which a worklet does not have. Import the Emscripten factory statically, fetch the `.wasm` bytes on the main thread, pass them in through `processorOptions`, and hand all three to `init({ moduleFactory, wasmBinary, locateFile })`.
:::

**analyzer-worklet.ts:**

```typescript
import { init, StreamAnalyzer } from '@libraz/libsonare';
// The Emscripten factory (sonare.js) that ships with the package's WASM glue.
import createModule from './sonare.js';

class AnalyzerWorklet extends AudioWorkletProcessor {
  private analyzer?: StreamAnalyzer;
  private frameCounter = 0;

  constructor(options: AudioWorkletNodeOptions) {
    super();
    const { wasmBinary } = options.processorOptions;
    void init({ moduleFactory: createModule, wasmBinary, locateFile: (path) => path }).then(() => {
      // sampleRate is a global in AudioWorkletGlobalScope
      this.analyzer = new StreamAnalyzer({
        sampleRate,
        nFft: 2048,
        hopLength: 512,
        nMels: 64, // reduced for bandwidth
        computeMel: true, computeChroma: true, computeOnset: true,
        emitEveryNFrames: 4,
      });
    });
    this.port.onmessage = (e) => {
      if (e.data.type === 'destroy') {
        this.analyzer?.delete();
        this.analyzer = undefined;
      }
    };
  }

  process(inputs: Float32Array[][]): boolean {
    const input = inputs[0]?.[0];
    if (!input || input.length === 0 || !this.analyzer) return true;

    this.analyzer.process(input);

    const available = this.analyzer.availableFrames();
    if (available >= 4) {
      const frames = this.analyzer.readFrames(available);

      // Transfer buffers for zero-copy
      this.port.postMessage({ type: 'frames', data: frames }, [
        frames.timestamps.buffer, frames.mel.buffer, frames.chroma.buffer,
      ]);
    }

    // Periodically send stats
    if (++this.frameCounter % 100 === 0) {
      this.port.postMessage({ type: 'stats', data: this.analyzer.stats() });
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

// wasmUrl: the URL of the package's sonare.wasm (your bundler's asset import).
const wasmBinary = await (await fetch(wasmUrl)).arrayBuffer();
const workletNode = new AudioWorkletNode(audioCtx, 'analyzer-worklet', {
  processorOptions: { wasmBinary },
});

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

// Later: release the analyzer inside the worklet.
workletNode.port.postMessage({ type: 'destroy' });
```

::: details Related entry points (realtime engine, MIDI)
To run the whole playback engine in a worklet (track lanes, channel strips, buses, MIDI clips, live MIDI, instruments, and capture), use the AudioWorklet bridge at `@libraz/libsonare/worklet`. Its `SonareEngine` API mirrors that engine to the worklet; see [Realtime and Streaming](./realtime-streaming.md).

The main package entry (`@libraz/libsonare`) also ships two main-thread browser integration helpers: `bindMicrophoneInput(...)` wires `getUserMedia` into an AudioWorklet engine node (see [Recording and Takes](./recording-and-takes.md)), and `bindWebMidi(...)` bridges Web MIDI input to the engine (see [MIDI Input](./midi-input.md)).
:::

### Bandwidth Optimization

The TypeScript `StreamAnalyzer` has three read methods. Choose them by how much precision your UI needs and how much data you can afford to move between threads.

| Method | Returned type | Approx. size per frame | Use when |
|--------|---------------|------------------------|----------|
| `readFrames(maxFrames)` | `FrameBuffer` with `Float32Array` / `Int32Array` fields | ~600 bytes | You need full precision for analysis or high-quality visuals |
| `readFramesI16(maxFrames)` | `StreamFramesI16` | ~300 bytes | You want smaller payloads but still enough precision for most visual meters |
| `readFramesU8(maxFrames)` | `StreamFramesU8` | ~150 bytes | You need very small payloads for mobile or dense visual updates |

The analyzer still computes internally in float. Select the transfer precision with the explicit read method: `readFrames()` for float data, `readFramesI16()` for 16-bit data, or `readFramesU8()` for 8-bit data. `StreamConfig.outputFormat` is retained only for source compatibility and must be omitted or set to `0`; the C++/WASM read path quantizes the integer forms, so you do not need to quantize manually before `postMessage`.

Both quantized read paths accept an optional `StreamQuantizeConfig` to widen the quantization ranges for unusually loud or quiet streams that would otherwise saturate; see [custom quantization ranges](./realtime-streaming.md#custom-quantization-ranges).

Plain lists and objects returned from WASM are rooted back into the JavaScript realm that called them. That means arrays from name-list helpers (`*Names()`), preset-name helpers, section results, key-candidate calls, the object from `synthPresetPatch(...)`, mixer meter snapshots (`meterTap`, `stripMeter`, `busMeter`), and goniometer samples (`readGoniometerLatest`) can be passed through `structuredClone()` or `postMessage()` without first rebuilding them by hand. Handles with native methods, such as `Mixer` and `StreamAnalyzer`, are not cloneable; send their plain data results instead. Typed-array payloads still follow the normal transferable-buffer rules below.

::: details What are "Structure-of-Arrays" and transferable objects?
- **Structure-of-Arrays (SoA)** means each field lives in its own flat typed array — all timestamps in one array, all mel values in another — instead of an array of per-frame objects. It is cheaper to slice and cheaper to hand to another thread.
- **Transferable objects** are `ArrayBuffer`s that `postMessage` can *move* to a worker instead of copying. Ownership transfers (the sender's view becomes empty afterward), which makes passing audio frames between threads near-instant. List the buffers in the second argument: `postMessage(msg, [buffer, ...])`.
- **Quantizing** here means packing each float into a smaller 16-bit or 8-bit integer — fewer bytes to send, at the cost of precision (fine for a meter or heatmap, not for further DSP).
:::

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
if (stats.estimate.keyName !== null) {
  console.log(`Key: ${stats.estimate.keyName}`); // e.g. "A minor"; keyShortName is "Am"
}
```

With no pitched content yet (silence), `key` and `chordRoot` are `-1`, `keyName` is `null`, and `chordName` is `'N.C.'`. The key estimate is computed from a 186 ms chroma window, so it trails the frame outputs, and `nFft` is rescaled on a stream below 44100 Hz; see [Usage, AudioWorklet integration, and timing](./js-api-streaming.md#usage-audioworklet-integration-and-timing).

### Visualization Example

```typescript
import type { StreamAnalyzer } from '@libraz/libsonare';

function renderVisualization(frames: ReturnType<StreamAnalyzer['readFrames']>, nMels: number) {
  const { nFrames, mel, chroma, onsetStrength } = frames;

  for (let f = 0; f < nFrames; f++) {
    for (let m = 0; m < nMels; m++) {
      const value = Math.min(1, mel[f * nMels + m]); // linear power, clamped to 0-1
      // Draw pixel at (scrollX + f, nMels - m)
    }
    for (let c = 0; c < 12; c++) {
      const value = chroma[f * 12 + c]; // 12 pitch classes
      // Draw chroma bar
    }
    if (onsetStrength[f] > 1.5) triggerBeatEffect(); // tune the threshold for your audio
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
| `melToStft(power, nMels, nFrames, sampleRate?, nFft?, fmin?, fmax?, htk?)` | `StftMagnitudeResult` `{ nBins, nFrames, magnitude }` | Pseudo-inverse of the mel filterbank |
| `melToAudio(power, nMels, nFrames, sampleRate?, nFft?, hopLength?, fmin?, fmax?, nIter?, htk?)` | `Float32Array` | Griffin-Lim audio synthesis |
| `mfccToMel(coefficients, nMfcc, nFrames, nMels?, lifter?)` | `MelPowerResult` `{ nMels, nFrames, power }` | Inverse DCT back to a mel spectrogram; pass the forward MFCC lifter |
| `mfccToAudio(coefficients, nMfcc, nFrames, nMels, sampleRate?, nFft?, hopLength?, fmin?, fmax?, nIter?, htk?, lifter?)` | `Float32Array` | MFCC → mel → audio in one call; pass the forward MFCC lifter |

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

`RealtimeVoiceChanger` is the WASM object for the preset-based live voice chain. It is separate from the offline `voiceChange(...)` helper because it keeps DSP state across blocks and exposes heap-backed zero-copy buffers for AudioWorklet-style loops. For the signal chain, presets, `formantMode` and the `voice.changer` insert, see [Realtime Voice Changer](./realtime-voice-changer.md).

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

The heap-backed buffers are views onto the WASM heap. `bufferGeneration()` increases whenever `prepare(...)` can replace the native scratch buffers, so re-acquire any cached view after it changes.

### In an AudioWorklet

The package ships a ready-made processor, so a voice changer in a worklet needs no hand-written loop. Register it from the worklet module, then create the node with `processorOptions`:

```typescript
// voice-worklet.ts
import { registerSonareRealtimeVoiceChangerWorkletProcessor } from '@libraz/libsonare/worklet';

registerSonareRealtimeVoiceChangerWorkletProcessor(); // 'sonare-realtime-voice-changer-processor'
```

```typescript
// main.ts
const node = new AudioWorkletNode(audioCtx, 'sonare-realtime-voice-changer-processor', {
  processorOptions: { preset: 'bright-idol', sampleRate: audioCtx.sampleRate, blockSize: 128, channelCount: 1 },
});

// Change the voice live. The worklet only accepts a normalized flat config, never JSON.
node.port.postMessage({ type: 'setConfig', config: realtimeVoiceChangerPresetConfig('soft-whisper') });
node.port.postMessage({ type: 'reset' });   // clear the DSP state
node.port.postMessage({ type: 'destroy' }); // release the changer
```

The processor builds its changer in the worklet's own realm, so the WASM module must be initialized there first, the same way as for a [custom analyzer worklet](#custom-analyzer-worklet). A flat config includes `formantMode`, so build it with `realtimeVoiceChangerPresetConfig(...)` rather than by hand.

## Paged clip audio streaming

A long arrangement can hold more clip audio than fits in memory at once. The engine streams clip audio in **pages**: instead of one giant buffer, a clip is backed by a *clip page provider* that hands the engine fixed-size pages on demand.

The flow is lock-free by design:

1. The render thread needs a page it does not have yet and pushes a request onto a **wait-free page-request queue**.
2. The main thread drains that queue with `engine.popClipPageRequest()`, reads the audio for the requested page from storage, and calls `provider.supply(pageIndex, channels)`.
3. When a page is no longer needed, `provider.clear(pageIndex)` releases it.
4. Separately, the render thread also reports the pages it is *about to* read and does not have yet, so the host can supply them before the playhead arrives. See [Lookahead](#lookahead) below.

Because the audio thread only enqueues requests and reads already-supplied pages, it never blocks on storage or allocation.

<FlowDiagram
  title="Lock-free paged-clip page handoff"
  direction="TB"
  :nodes="[
    { id: 'need', label: 'Render thread needs page N', col: 0, row: 0, variant: 'accent', group: 'audio' },
    { id: 'push', label: 'Push request onto wait-free queue', col: 0, row: 1, variant: 'accent', group: 'audio' },
    { id: 'pop', label: 'popClipPageRequest() drains queue', col: 1, row: 2, group: 'main' },
    { id: 'read', label: 'Read page audio from storage', col: 1, row: 3, group: 'main' },
    { id: 'supply', label: 'provider.supply(pageIndex, channels)', col: 1, row: 4, variant: 'success', group: 'main' },
    { id: 'consume', label: 'Render thread reads supplied page', col: 0, row: 5, variant: 'success', group: 'audio' },
    { id: 'clear', label: 'provider.clear(pageIndex)', col: 1, row: 6, variant: 'muted', group: 'main' }
  ]"
  :edges="[
    { from: 'need', to: 'push' },
    { from: 'push', to: 'pop', label: 'page request' },
    { from: 'pop', to: 'read' },
    { from: 'read', to: 'supply' },
    { from: 'supply', to: 'consume', label: 'page ready' },
    { from: 'consume', to: 'clear', label: 'no longer needed', style: 'dashed' }
  ]"
  :groups="[
    { id: 'audio', label: 'Audio / render thread' },
    { id: 'main', label: 'Main thread' }
  ]"
  caption="The audio thread only enqueues a request and reads pages already supplied; the slow storage read runs on the main thread."
/>

::: info Lock-free and wait-free, for beginners
A realtime audio thread must not pause — if it stalls for even a moment, the output glitches. **Lock-free** means the audio thread never waits to acquire a lock that another thread holds. **Wait-free** is the stronger guarantee used here: pushing a page-miss request onto the page-request queue always finishes in a bounded number of steps, so the audio thread never spins or blocks waiting on it. The slow part — reading the page from storage — happens on the main thread instead.
:::

### Lookahead

Reporting a miss only when the read has already happened is too late to be silent: the read produced silence for that block, and the host learns about it afterwards. At every page boundary it has not primed, that costs one block of silence. So the player also reports the pages it is about to reach.

`prepare(...)` sets the lookahead window to **half a second** at the engine's sample rate, and `setClipPagePrefetchFrames(frames)` changes it while audio is running (`clipPagePrefetchFrames()` reads it back; `0` disables the lookahead entirely). The C entry points are `sonare_engine_set_clip_page_prefetch_frames` and `sonare_engine_clip_page_prefetch_frames`, and the `SonareEngine` worklet facade forwards the setter to both the worklet engine and this thread's offline engine.

Lookahead requests drain through the same `popClipPageRequest()` queue, and within a block they are queued **after** that block's genuine misses. A host that keeps only the newest request per clip therefore tracks the lookahead frontier rather than a stale miss. The read-then-miss reporting above is unchanged and still runs, so a host that simply ignores lookahead requests behaves exactly as it would without them. A clip whose pages are all resident produces no requests at all, either way.

::: info This is not the `ClipPageStreamer` window
Two different mechanisms sit on top of each other, and you want both. The lookahead here is the **engine's** — the audio thread telling you which pages it is heading for. `ClipPageStreamer`'s `readAheadPages` / `retainBehindPages` (below) is the **JS-side** sliding window that decides how much audio stays resident in WASM memory. The engine's lookahead tells the streamer what to fetch; the streamer's window decides what to keep.
:::

### OPFS-backed provider in the browser

The package ships a ready-made provider that reads pages from the [Origin Private File System (OPFS)](https://developer.mozilla.org/docs/Web/API/File_System_API/Origin_private_file_system) on a worker, so disk reads stay off the main thread. The clip lives in OPFS as raw interleaved `Float32` (`L0, R0, L1, R1, …`), optionally behind a header you skip with `dataOffsetBytes`; only the pages inside the current window are ever in WASM memory.

Four exports make up the mechanism, and they nest: each one is built from the one above it.

| Export | What it is |
|--------|------------|
| `opfsClipPageWorkerSource` | A JavaScript **string**, not a function: the source text of the page-reading worker. Given a page index it opens the file with a synchronous access handle, reads `pageFrames` frames from `dataOffsetBytes + pageIndex * pageFrames * numChannels * 4`, de-interleaves them into one buffer per channel, and posts those buffers back with a transfer list. Reads for one `path` are serialized inside the worker. Use it only to bundle the worker yourself, for example under a CSP that forbids `blob:` workers. |
| `createOpfsClipPageWorker()` | `new Worker(...)` over a Blob URL of that source; the URL is revoked right after construction. Called for you when no `worker` is passed. |
| `createOpfsClipPageProvider(engine, options)` | Creates the engine-side `ClipPageProvider` (`engine.createClipPageProvider(numChannels, numSamples, pageFrames)`) and pairs it with the worker. Returns a binding: `provider`, `supplyPage(pageIndex)`, `supplyRequest(request)`, `clearPage(pageIndex)`, `close()`. Throws unless `numChannels`, `numSamples`, and `pageFrames` are all positive. |
| `writeOpfsClip(path, channels, options?)` | Writes planar `Float32Array` channels to `path` in the layout the readers expect: headerless little-endian float32, interleaved, from byte 0. Missing directories are created and an existing file is replaced. The write runs in an OPFS worker (`options.worker`, or a private one). Resolves `{ path, numChannels, numSamples }`; the file stores none of these, so pass them back when reading. A path an open page provider reads is refused with `SonareError` `InvalidState`; empty or unequal channels throw `RangeError`. |
| `importOpfsClip(path, source, options?)` | Decodes an `ArrayBuffer`, `Blob`, or `AudioBuffer` (every channel kept) and writes it with `writeOpfsClip`. No resampling is applied: the result adds the source `sampleRate`, which you pass as the clip's source rate. |
| `attachOpfsClipStream(streamer, engine, options)` | The one-call path for a session: builds the binding, primes the first `primePages` pages (default `1`) so playback can start without a miss, and registers the clip with a `ClipPageStreamer`. Returns `{ binding, provider }`. |

Servicing one clip by hand:

```typescript
import { createOpfsClipPageProvider } from '@libraz/libsonare';

const binding = createOpfsClipPageProvider(engine, {
  path: 'clips/long-take.f32',  // interleaved Float32 in OPFS
  numChannels: 2,
  numSamples: totalFrames,      // total frames in the file
  pageFrames: 65536,            // page size in frames
  // dataOffsetBytes?: skip a header
  // worker?: reuse your own Worker; it is left running on close()
  //          unless terminateWorkerOnClose: true
});

// In a UI tick, service whatever the render thread asked for:
let request;
while ((request = engine.popClipPageRequest()) !== null) {
  await binding.supplyRequest(request);  // reads and passes that page to the provider
}

// Later:
binding.close();  // releases the provider and (if owned) terminates the worker
```

`supplyRequest(request)` maps a popped request's sample position to a page index (`Math.floor(request.sample / pageFrames)`); `supplyPage(pageIndex)` prefetches a page directly. Both resolve `true` once the page is resident and `false` for a page outside the file or a short read; after `close()` they reject. Supplies through one binding run one at a time, in call order. One `Worker` can serve several bindings, since each binding only answers its own request ids.

#### Where SharedArrayBuffer matters, and where it does not

Page **data** never needs `SharedArrayBuffer`. The worker hands each page over as transferred `ArrayBuffer`s, so ownership moves to the main thread without a copy, and `provider.supply(...)` then copies the channels into WASM memory. On the worklet facade the main thread forwards the same buffers into the `AudioWorklet` by transfer again.

The **request** direction works without it too. A page miss originates on the render thread. In `'sab'` mode it reaches the main thread through a shared request ring that the facade polls every 8 ms. In `postMessage` mode the worklet reads the page misses without allocating and posts a request whenever the set of missing pages changes, and re-posts an unchanged set every 250 ms so a failed read is retried. `capabilities.clipPageRequestsRealtimeSafe` reports whether the ring is in use; `SonareEngine.attachOpfsClipStream(options)` works either way, so this site and any page without cross-origin isolation can page clips from OPFS into the worklet engine.

On the facade the call takes two arguments, `attachOpfsClipStream(engine, options)`, with no streamer: the facade keeps its own `ClipPageStreamer` and pumps it from the request ring. Pass the returned `provider` to `engine.addClip(trackId, provider, startPpq, { id: clipId })`, with `opts.id` equal to `options.clipId`; the facade rejects a `pageProvider` it did not create this way.

::: warning OPFS support varies by browser
The OPFS provider relies on `navigator.storage.getDirectory()` and synchronous access handles, which are available in current Chromium and Firefox and in WebKit on recent Safari, but not in older browsers. Feature-detect before using it, and keep a fully in-memory provider (or your own `ClipPageProvider` loaded from any source) for environments without OPFS.
:::

### Bounded-window streaming across many clips

The loop above services one provider by hand. For a multitrack arrangement you usually want the resident audio bounded no matter how many clips play or how long they are. `ClipPageStreamer` does that: it keeps only a sliding window of pages around each clip's live playback position — `retainBehindPages + readAheadPages + 1` pages per clip — fetching misses ahead of time and evicting pages that fall behind, so a whole session never holds its full PCM in WASM memory.

`attachOpfsClipStream(...)` wires one OPFS-backed clip into a shared streamer in a single call: it builds the provider, primes the leading pages so playback starts without an immediate miss, and registers the clip for windowed eviction.

```typescript
import { ClipPageStreamer, attachOpfsClipStream } from '@libraz/libsonare';

const streamer = new ClipPageStreamer(engine, { readAheadPages: 2, retainBehindPages: 1 });

// Attach each long clip; `provider` goes into the clip schedule.
const take = await attachOpfsClipStream(streamer, engine, {
  clipId: 1,                    // matches the page-miss request clipId
  path: 'clips/long-take.f32',
  numChannels: 2,
  numSamples: totalFrames,
  pageFrames: 65536,
});
engine.setClips([{ clipId: 1, /* ...timing... */ pageProvider: take.provider }]);

// Drain misses on a control-thread cadence (once per animation frame is typical):
function tick() {
  streamer.pump();              // fetch missing pages + read-ahead, evict out-of-window
  requestAnimationFrame(tick);
}

// Teardown closes every attached clip's binding:
streamer.close();
```

Call `pump()` on the main or control thread only — never the audio thread, since the fetches are asynchronous. Use `addSource`/`removeSource` to attach or drop clips you built providers for yourself. After an explicit seek or loop, call `resetSource(clipId)` to evict the old playback window and start a new fetch generation; backward page misses also trigger this reset automatically, preventing an older in-flight fetch from becoming resident after the seek.

