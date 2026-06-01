---
title: Realtime and Streaming
description: libsonare realtime surfaces — StreamAnalyzer for live MIR (mel/chroma/onset frames, progressive BPM/key/chord/pattern, quantized output formats) and RealtimeEngine for transport and playback, plus how to turn a streamed onset envelope into a tempogram.
---

# Realtime and Streaming

libsonare has two realtime-oriented surfaces:

- **`StreamAnalyzer`** — feeds in blocks of audio and emits *analysis frames* (mel, chroma, onset, spectral) plus progressive musical estimates (BPM, key, chord, chord progression, pattern). Use it for visualizers and live "what is this song doing" displays.
- **`RealtimeEngine`** — transport, automation, clip playback, graph routing, metronome, capture, offline bounce, freeze, and telemetry. Use it for playback engines.

In realtime docs, "chunk" or "block" means a short slice of audio processed repeatedly, often inside a Web Audio `AudioWorklet`. Realtime code should avoid heavy allocation inside the audio callback: prepare objects first, then process blocks.

::: info Chunk, block, and frame
**Chunks** and **blocks** are short groups of input samples from a realtime stream. **Frames** are time steps of analysis data produced from those blocks. Think "blocks go in, frames come out" when wiring a UI.
:::

## What You Will Learn

By the end of this page you should be able to:

- decide whether your app needs `StreamAnalyzer`, `RealtimeEngine`, or the mixing engine;
- feed audio blocks without confusing compressed file bytes, decoded samples, blocks, and frames;
- read feature frames for a UI and understand why quantized reads exist;
- use progressive estimates without treating early BPM/key/chord values as final answers;
- recognize which realtime operations are safe in an audio callback and which should be prepared outside it.

## Common beginner choices

| If you are building... | Start with |
|------------------------|------------|
| A visualizer that draws a spectrogram, chroma, onset strength, or live BPM/key estimate | `StreamAnalyzer` |
| A live chord / progression / pattern display | `StreamAnalyzer.stats()` |
| A playback engine with tempo, loop points, markers, metronome, clips, and automation | `RealtimeEngine` |
| A mixer with strips, sends, and meters | [Mixing Engine](./mixing.md) |
| A simple offline script | [Getting Started](./getting-started.md), not this page |

## Which API to use

| Need | API |
|------|-----|
| Mel/chroma/onset frames from a microphone or playing file | `StreamAnalyzer` |
| Progressive BPM, key, current chord, chord progression, and pattern scores | `StreamAnalyzer.stats()` |
| Transport, tempo, loop points, markers, metronome, clip scheduling, and automation | `RealtimeEngine` |
| AudioWorklet bridge for engine-style playback with telemetry | `RealtimeEngine` or the reduced `sonare-rt` module |
| Stem or strip mixing with sends and meters | [Mixing Engine](./mixing.md) |

::: info Runtime entry points
This page is centered on the Browser / WASM `StreamAnalyzer`, `RealtimeEngine`, and AudioWorklet bridge. Python and CLI are not the same live callback API; their main entry points are batch APIs that process files or arrays outside the audio callback.

| Runtime | Entry point | Typical use |
|---------|-------------|-------------|
| Browser / WASM | `StreamAnalyzer`, `RealtimeEngine`, `@libraz/libsonare/worklet` | Live visualizers, AudioWorklet tools, progressive BPM / key / chord displays |
| Python | `Audio.analyze()`, `onset_envelope(...)`, `tempogram(...)`, and related batch functions | Notebooks, offline analysis, validation scripts |
| CLI | `sonare analyze`, `sonare bpm`, `sonare key`, and related commands | File-level checks, batch jobs, JSON output |

If you need to analyze the same file from Python or CLI, use [Python API](./python-api.md) or [CLI Reference](./cli.md). Treat the WASM / Worklet examples as the source of truth for code that runs inside an audio callback.
:::

## StreamAnalyzer

`StreamAnalyzer` processes blocks and emits frame buffers for UI rendering. It is the right tool for spectrograms, chroma displays, onset-driven visuals, and incremental musical estimates. You construct it once, `process()` each incoming block, then drain whatever frames have accumulated.

::: tip `nFft` and `hopLength` in one line
The analyzer runs an STFT under the hood. `nFft` is the analysis window size in samples (bigger = finer frequency detail, coarser timing); `hopLength` is how far the window advances between frames (smaller = more frames per second, more CPU). The `2048`/`512` defaults below are the common starting point. See [MIR Overview](./glossary/concepts/mir-overview.md) if these are new.
:::

```typescript
import { init, StreamAnalyzer } from '@libraz/libsonare';

await init();

const analyzer = new StreamAnalyzer({
  sampleRate: audioCtx.sampleRate,
  nFft: 2048,
  hopLength: 512,
  nMels: 64,
  computeMel: true,
  computeChroma: true,
  computeOnset: true,
  emitEveryNFrames: 4,   // throttle: emit one frame per 4 hops
});

analyzer.process(inputBlock);

const frames = analyzer.readFrames(analyzer.availableFrames());
const stats = analyzer.stats();

if (stats.estimate.updated) {
  console.log(stats.estimate.bpm, stats.estimate.key, stats.estimate.chordRoot);
}
```

::: info Stream defaults differ from the batch analyzer
`StreamAnalyzer` defaults to **44100 Hz**, not the 22050 Hz batch default. Realtime audio arrives straight from the playback/capture graph (AudioWorklet, device callbacks), which almost always runs at 44100/48000 Hz; matching that rate avoids an extra resample on the hot path and keeps timestamps aligned with the audio clock. Pass `sampleRate: audioCtx.sampleRate` so estimates and timestamps line up with what you are actually playing.
:::

### Reading frames and output format

A `FrameBuffer` is **Structure-of-Arrays**: timestamps, mel, chroma, onset strength, RMS, spectral centroid, spectral flatness, chord root, chord quality, and chord confidence each live in their own typed array. That layout is cheap to slice and cheap to hand to another thread.

::: details What are spectral centroid and flatness?
Both reduce the *shape* of one frame's spectrum to a single number you can plot or threshold. The **spectral centroid** is the energy-weighted average frequency — a higher centroid sounds "brighter" (more high-frequency content). The **spectral flatness** measures how evenly energy is spread across frequencies: values near 1 are noise-like (energy everywhere at once), values near 0 are tonal (energy concentrated in a few strong peaks). Together they are a cheap way to describe timbre frame by frame.
:::

For thread transfer and visualization you often do not need full float precision. `StreamAnalyzer` can quantize the feature arrays, trading precision for bandwidth:

| Read method | Element type | `outputFormat` | Use it for |
|-------------|--------------|----------------|------------|
| `readFrames(n)` | `FrameBuffer` with `Float32Array` / `Int32Array` fields | `0` (default) | Full-precision DSP, further analysis |
| `readFramesI16(n)` | `StreamFramesI16` with `Int16Array` fields | `1` | Bandwidth-reduced transfer to a worker / over the wire |
| `readFramesU8(n)` | `StreamFramesU8` with `Uint8Array` fields | `2` | Cheap visualization (a heatmap pixel only needs 8 bits) |

```typescript
// A spectrogram canvas only needs 8-bit mel — quantize at the source.
const analyzer = new StreamAnalyzer({ sampleRate, nMels: 64, outputFormat: 2 });
analyzer.process(block);
const u8 = analyzer.readFramesU8(analyzer.availableFrames());
// u8.mel is a Uint8Array [nFrames x nMels], ready to write into ImageData
```

::: tip Match the format to the consumer, not the analyzer
`outputFormat` only changes how `readFramesU8`/`readFramesI16` quantize on the way out — the internal analysis still runs in float. Pick `Uint8` when the data ends up as pixels, `Int16` when it crosses a thread/network boundary and you want roughly half the bytes, and the default `Float32` when something downstream does more math on it.
:::

### Progressive estimates: BPM, key, chord, and pattern

`stats()` returns an `AnalyzerStats` whose `estimate` field is a **`ProgressiveEstimate`** — the analyzer's running best guess at the music, refined as more audio arrives. Check `estimate.updated` before reading: it is `true` only on frames where the estimate actually changed, so you can avoid redundant UI work.

```typescript
const { estimate } = analyzer.stats();
if (estimate.updated) {
  // Tempo and key (with confidence)
  estimate.bpm;            estimate.bpmConfidence;
  estimate.key;            estimate.keyMinor;  estimate.keyConfidence;

  // The chord playing right now
  estimate.chordRoot;      // PitchClass (numeric enum, 0 = C)
  estimate.chordQuality;   // ChordQuality (numeric enum)
  estimate.chordConfidence;
  estimate.chordStartTime;

  // The progression so far
  estimate.chordProgression;     // ChordChange[]  { root, quality, startTime, confidence }
  estimate.barChordProgression;  // BarChord[]     beat-synchronized, one per bar

  // Pattern detection (e.g. a I–V–vi–IV loop)
  estimate.detectedPatternName;  // best-matching known progression
  estimate.detectedPatternScore;
  estimate.allPatternScores;     // PatternScore[] { name, score }
  estimate.votedPattern;         // BarChord[] the locked, repeating pattern
  estimate.patternLength;        // bars in that pattern
  estimate.currentBar;           // estimate.barDuration  -> bar position/length
}
```

There are two chord progressions because they answer different questions:

| Field | Meaning |
|-------|---------|
| `chordProgression` | Raw detected chord changes as they arrive. |
| `barChordProgression` | Chords snapped to bar boundaries, which is easier to read as a chart. |

Pattern detection then votes across bars to recognize a *repeating* progression (`votedPattern` / `detectedPatternName`). That is what makes the display settle into a song-level pattern instead of flickering per frame.

::: tip Help pattern lock in with the expected duration
Pattern voting needs enough bars to be confident. If you know the clip length up front, call `analyzer.setExpectedDuration(seconds)` so timing and the pattern lock are scaled correctly; otherwise the estimate keeps refining as audio streams in. For non-standard tuning, `analyzer.setTuningRefHz(refHz)` shifts the key/chord reference off A4 = 440 Hz.
:::

## Tempograms from an onset envelope

`StreamAnalyzer` gives you a live **onset strength** stream: the `onsetStrength` array on each frame.

A *tempogram* turns an onset envelope into a time × tempo image. This is the offline view behind the progressive BPM estimate.

Compute it from the accumulated envelope, or from any onset envelope returned by `onsetEnvelope(...)`. This is a batch step for a buffered window, not work to run inside the audio callback.

```typescript
import { init, onsetEnvelope, tempogram, fourierTempogram, cyclicTempogram, tempogramRatio, plp } from '@libraz/libsonare';

await init();

const env = onsetEnvelope(samples, sampleRate, 2048, 512);

const ac  = tempogram(env, sampleRate, 512, 384, 'autocorrelation'); // default
const cos = tempogram(env, sampleRate, 512, 384, 'cosine');
const ft  = fourierTempogram(env, sampleRate, 512, 384);
const cyc = cyclicTempogram(env, sampleRate, 512, 384, 60, 60);
const ratio = tempogramRatio(ac.data, 384, sampleRate, 512);
const pulse = plp(env, sampleRate, 512, 30, 300, 384);
```

| Function | What it computes | Returns |
|----------|------------------|---------|
| `tempogram(..., 'autocorrelation')` | Local autocorrelation of the onset envelope (librosa default) | `{ nFrames, winLength, data }` |
| `tempogram(..., 'cosine')` | Window-local **cosine similarity** between lagged onset slices | `{ nFrames, winLength, data }` |
| `fourierTempogram(...)` | STFT of the onset envelope (Fourier tempogram) | `{ nBins, nFrames, data }` |
| `cyclicTempogram(...)` | Octave-folded tempo classes (60, 120, 240 BPM collapse together) | `{ nBins, nFrames, data }` |
| `tempogramRatio(...)` | Tempo-ratio features from a tempogram | `Float32Array` |
| `plp(...)` | Predominant local pulse curve | `Float32Array` |

::: details Autocorrelation vs. cosine tempogram
The default **autocorrelation** tempogram correlates the onset envelope with a lagged copy of itself, mirroring `librosa.feature.tempogram`. The **cosine** mode instead measures the cosine similarity between window-local lagged onset slices. Cosine emphasizes the *shape* match of the onset pattern rather than its raw energy, so it can be steadier when onset amplitude varies a lot across a window. Both produce a `[winLength x nFrames]` matrix where row `i` is the strength at lag `i`; switch with the fifth `mode` argument (`'autocorrelation'` | `'cosine'`).
:::

## RealtimeEngine

`RealtimeEngine` is the broader transport and playback engine. It exposes sample-accurate commands for parameters and transport, plus offline render helpers for non-realtime export.

```typescript
import { init, RealtimeEngine, engineCapabilities } from '@libraz/libsonare';

await init();

const caps = engineCapabilities();
if (!caps.abiCompatible) throw new Error('Realtime engine ABI mismatch');

const engine = new RealtimeEngine(48000, 128);
engine.setTempo(128);
engine.setTimeSignature(4, 4);
engine.setLoop(0, 16, true);
engine.play();

const output = engine.process([leftBlock, rightBlock]);
const transport = engine.getTransportState();
const telemetry = engine.drainTelemetry();

engine.stop();
engine.destroy();
```

`RealtimeEngine` can also register parameter metadata, set automation lanes, seek to markers, configure metronome clicks, process with monitor output, capture audio, run offline bounces, freeze clips, and drain meter telemetry.

::: warning Check the engine ABI before constructing
`engineCapabilities().abiCompatible` confirms the loaded WASM matches the JS wrapper's expected engine ABI. The realtime engine is the most version-sensitive surface in the library; constructing it against a mismatched binary is undefined. Guard with the check above; if it fails, update your `@libraz/libsonare` package so the WASM binary and JS wrapper come from the same release.
:::

## AudioWorklet notes

The full WASM package exposes the complete `RealtimeEngine` class. The optional worklet bridge can run either the full embind-backed runtime or the dedicated `sonare-rt` runtime through `SonareRealtimeEngineNode.create(...)`.

The bridge helpers live under the package subpath `@libraz/libsonare/worklet`.
Register the processor inside the worklet module, then create the node on the
main thread. `moduleUrl` is the compiled worklet module that calls
`registerSonareRealtimeEngineWorkletProcessor()`.

```typescript
// sonare-engine-worklet.ts
import { registerSonareRealtimeEngineWorkletProcessor } from '@libraz/libsonare/worklet';

registerSonareRealtimeEngineWorkletProcessor();
```

```typescript
// main.ts
import { SonareRealtimeEngineNode } from '@libraz/libsonare/worklet';

const audioCtx = new AudioContext();
const engineNode = await SonareRealtimeEngineNode.create(audioCtx, {
  moduleUrl: '/sonare-engine-worklet.js',
  runtimeTarget: 'embind', // full RealtimeEngine in the worklet
  channelCount: 2,
  mode: 'auto',            // uses SAB when available, postMessage otherwise
});

engineNode.node.connect(audioCtx.destination);
engineNode.play();
engineNode.onTelemetry((telemetry) => console.log(telemetry));
console.log(engineNode.capabilities.mode, engineNode.capabilities.degradedReason);

// In requestAnimationFrame or another UI tick, drain SAB telemetry if used.
engineNode.pollTelemetry();

// Later:
engineNode.destroy();
```

For app code that wants a higher-level facade, `SonareEngine` combines two pieces:

| Piece | Role |
|-------|------|
| Worklet node | Runs the realtime audio side. |
| Main-thread `RealtimeEngine` | Handles offline and timeline operations. |

Its `transport` facade covers play/stop, seek by seconds or PPQ, tempo, and loop updates. It also mirrors automation lanes, clips, recording arm/punch, metronome, offline render, meter listeners, and telemetry polling.

```typescript
import { SonareEngine } from '@libraz/libsonare/worklet';

const engine = await SonareEngine.create(audioCtx, {
  moduleUrl: '/sonare-engine-worklet.js',
  mode: 'auto',
  channelCount: 2,
});

engine.transport.setTempo(120);
engine.transport.setLoop(0, 4, true);
engine.transport.play();
engine.onMeter((meter) => console.log(meter.rmsDbL, meter.rmsDbR));

const offline = await engine.renderOffline(48000);
console.log(offline[0].length);

engine.destroy();
```

The separate `sonare-rt` module is intentionally smaller and designed for the AudioWorklet hot path: transport, tempo/loop, marker seek, metronome enablement, capture arming/punch commands, block processing, and basic telemetry drain. It omits the embind-heavy surfaces that are better kept on the main thread:

```typescript
const rtNode = await SonareRealtimeEngineNode.create(audioCtx, {
  moduleUrl: '/sonare-engine-worklet.js',
  runtimeTarget: 'sonare-rt',
  rtModuleUrl: '/sonare-rt.js', // required for the reduced runtime
  channelCount: 2,
});

await rtNode.ready; // resolves after the reduced module is loaded in the worklet
```

| Full `RealtimeEngine` only | Why it is omitted from `sonare-rt` |
|----------------------------|------------------------------------|
| Parameter registry and automation lanes (`addParameter`, `parameterInfo`, `setAutomationLane`, `setParameter*`) | Avoids JS object/string marshalling in the render callback |
| Transport readback (`getTransportState`) | Worklet state is mirrored through the bridge instead |
| Full marker/time-signature helpers | `sonare-rt` keeps only marker seek and transport commands |
| Graph topology and clip scheduling | Graph/clip editing belongs on the full embind runtime |
| Capture readback and offline rendering (`capturedAudio`, `renderOffline`, `bounceOffline`, `freezeOffline`) | These are non-realtime operations |
| Meter telemetry drain | The reduced runtime exposes only the basic telemetry path |

Use the full package on the main thread when you need scene editing, parameter inspection, graph operations, capture readback, or offline export. Use `sonare-rt` inside an AudioWorklet processor when the render callback must stay allocation- and GC-conscious.

## Related

- [Mixing Engine](./mixing.md) — strips, buses, sends, and metering for multi-track realtime
- [JavaScript API](./js-api.md) · [Python API](./python-api.md) — the batch feature transforms behind these estimates
- [DSP Implementation Notes](./dsp-implementation.md) — how onset, chroma, and tempo features are built
