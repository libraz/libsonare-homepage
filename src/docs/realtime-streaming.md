---
title: Realtime and Streaming
description: libsonare streaming APIs — StreamAnalyzer for live MIR frames and updating BPM/key/chord/pattern estimates, tempograms from streamed onset data, the AudioWorklet engine bridge, paged clip audio streaming, and display waveform peaks.
---

# Realtime and Streaming

This page covers the **streaming** side of libsonare: turning a live audio stream into analysis frames and musical estimates, and the plumbing that streams clip audio and hosts the realtime engine on the audio thread.

- **`StreamAnalyzer`** — feeds in blocks of audio and emits *analysis frames* (mel, chroma, onset, spectral) plus musical estimates that update as more audio arrives (BPM, key, chord, chord progression, pattern). Use it for visualizers and live "what is this song doing" displays.
- **Engine streaming plumbing** — the AudioWorklet bridge that runs `RealtimeEngine` on the audio thread, paged clip audio streaming for arrangements too large to hold in memory, and waveform-peak reduction for drawing clips.

The short version: use `StreamAnalyzer` when audio is the input and information is the output. If you are building a UI, it usually feeds graphs, meters, and labels.

::: tip Looking for the engine itself?
The `RealtimeEngine` control surface — transport, the lane mixer, group routing and sidechains, parameter automation, surround group buses, MIDI clip scheduling, and external MIDI routing — has moved to its own page. See [Realtime Engine](./realtime-engine.md) when clips, MIDI, transport, and mixed audio are the *output* you are building.
:::

In realtime docs, "chunk" or "block" means a short slice of audio processed repeatedly, often inside a Web Audio `AudioWorklet` — the audio-callback context that runs your DSP on the realtime audio thread, separate from the main/UI thread. Realtime code should avoid heavy allocation inside the audio callback: prepare objects first, then process blocks.

::: info Chunk, block, and frame
**Chunks** and **blocks** are short groups of input samples from a realtime stream. **Frames** are time steps of analysis data produced from those blocks. Think "blocks go in, frames come out" when wiring a UI.
:::

::: info Sample rate and resampling
**Sample rate** is how many audio samples make one second (44100 and 48000 are common). When a stream's rate does not match what an analyzer expects, the audio must be **resampled** (rebuilt at the other rate) before processing, which costs extra CPU — so matching rates up front is faster.
:::

## What You Will Learn

By the end of this page you should be able to:

- decide whether your app needs `StreamAnalyzer`, `RealtimeEngine`, or the mixing engine;
- feed audio blocks without confusing compressed file bytes, decoded samples, blocks, and frames;
- read feature frames for a UI and understand why quantized reads exist;
- use updating estimates without treating early BPM/key/chord values as final answers;
- recognize which realtime operations are safe in an audio callback and which should be prepared outside it.

## Common beginner choices

| If you are building... | Start with |
|------------------------|------------|
| A visualizer that draws a spectrogram, chroma, onset strength, or live BPM/key estimate | `StreamAnalyzer` |
| A live chord / progression / pattern display | `StreamAnalyzer.stats()` |
| A playback engine with tempo, loop points, markers, metronome, clips, and automation | [Realtime Engine](./realtime-engine.md) |
| A playback engine that also mixes its own tracks live (lanes, buses, sends, strips) | [Realtime Engine lane mixer](./realtime-engine.md#track-lanes-buses-and-channel-strips) |
| A standalone mixer with strips, sends, and meters (one-shot or scene-driven) | [Mixing Engine](./mixing.md) |
| A simple offline script | [Getting Started](./getting-started.md), not this page |

## Which API to use

| Need | API |
|------|-----|
| Mel/chroma/onset frames from a microphone or playing file | `StreamAnalyzer` |
| BPM, key, current chord, chord progression, and pattern scores that update over time | `StreamAnalyzer.stats()` |
| Transport, tempo, loop points, markers, metronome, clip scheduling, and automation | [Realtime Engine](./realtime-engine.md) |
| Per-track lanes, buses, sends, and channel strips inside the playback engine | [Realtime Engine lane mixer](./realtime-engine.md#track-lanes-buses-and-channel-strips) |
| Sample-accurate MIDI clip playback into engine instruments | [Realtime Engine](./realtime-engine.md#midi-clip-scheduling-and-sampleatppq) `setMidiClips()` + `sampleAtPpq()` |
| AudioWorklet bridge for engine-style playback with telemetry | `@libraz/libsonare/worklet` |
| Stem or strip mixing with sends and meters | [Mixing Engine](./mixing.md) |

::: info Runtime entry points
This page is centered on the Browser / WASM `StreamAnalyzer`, `RealtimeEngine`, and AudioWorklet bridge. Python and CLI are not the same live callback API; their main entry points are batch APIs that process files or arrays outside the audio callback.

| Runtime | Entry point | Typical use |
|---------|-------------|-------------|
| Browser / WASM | `StreamAnalyzer`, `RealtimeEngine`, `@libraz/libsonare/worklet` | Live visualizers, AudioWorklet tools, updating BPM / key / chord displays |
| Python | `Audio.analyze()`, `onset_envelope(...)`, `tempogram(...)`, and related batch functions | Notebooks, offline analysis, validation scripts |
| CLI | `sonare analyze`, `sonare bpm`, `sonare key`, and related commands | File-level checks, batch jobs, JSON output |

If you need to analyze the same file from Python or CLI, use [Python API](./python-api.md) or [CLI Reference](./cli.md). Treat the WASM / Worklet examples as the source of truth for code that runs inside an audio callback.
:::

## StreamAnalyzer

`StreamAnalyzer` processes blocks and emits frame buffers for UI rendering. It is the right tool for spectrograms, chroma displays, onset-driven visuals, and incremental musical estimates. You construct it once, `process()` each incoming block, then drain whatever frames have accumulated.

For a first implementation, keep the loop simple:

1. create one analyzer with the same `sampleRate` as the audio device;
2. call `process(block)` for each decoded or live audio block;
3. call `readFrames(...)` for drawing and `stats()` for the current musical estimate;
4. treat early estimates as provisional until several seconds of audio have arrived.

The demo below shows the same "audio in, markers out" idea visually: onset detection marks every attack, while beat tracking turns those attacks into a steadier pulse.

<SonareDemo id="beat-tracking" />

::: info Mel, chroma, onset in one line
- **Mel** — a spectrogram (energy per frequency band over time) on a perceptual pitch scale; good for a "what does this sound like" heatmap.
- **Chroma** — energy folded into the 12 pitch classes (C, C#, … B); good for showing harmony and key.
- **Onset** — a strength curve that spikes when a new note or beat starts; useful for visuals that react to beats and tempo.
:::

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
  maxPendingFrames: 256, // bound unread output; overflow drops the oldest frame
});

analyzer.process(inputBlock);

const frames = analyzer.readFrames(analyzer.availableFrames());
const stats = analyzer.stats();

if (stats.estimate.updated) {
  console.log(stats.estimate.bpm, stats.estimate.key, stats.estimate.chordRoot);
}
```

`maxPendingFrames` defaults to `4096`. Set it to a smaller value for a UI that may pause or fall behind: analysis continues, the oldest unread frames are dropped, and `stats().pendingFrames` / `stats().droppedOutputFrames` report the current backlog and cumulative drops.

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

::: info Magnitude frames are not a read path
`StreamAnalyzer` does not expose per-frame magnitude spectra. There is no `readFrames*` field for them, so the constructor rejects `computeMagnitude: true` rather than silently doing nothing. Use mel for a spectrogram view, or run [`meteringSpectrumFrame(...)`](./mastering-processors.md) on a buffered window when you need a raw single-frame FFT.
:::

#### Custom quantization ranges

Both quantized read paths accept an optional `StreamQuantizeConfig` second argument. The defaults assume a "normal" signal; a stream that is much louder or quieter than that will saturate to all-`255` or collapse to `0` once quantized. Widen the ranges so the visible detail survives the 8-bit/16-bit squeeze:

```typescript
// A hot live input: lift the mel floor and raise the onset/RMS ceilings.
const u8 = analyzer.readFramesU8(analyzer.availableFrames(), {
  melDbMin: -60,    // default -80; raise the floor for a loud stream
  melDbMax: 0,      // default 0
  onsetMax: 80,     // default 50; avoid clipping strong transients
  rmsMax: 1.5,      // default 1
  centroidMax: 11025,
});
```

The same `StreamQuantizeConfig` applies to `readFramesI16(...)`. Omit the argument to keep the defaults. Only the *output* mapping changes; the internal float analysis is unaffected.

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

A *tempogram* turns an onset envelope into a time × tempo image: at each moment it shows how strongly each candidate tempo is present. The live BPM estimate is essentially this image collapsed to its strongest tempo over time. It is useful, but still provisional early in the stream; the tempogram is the fuller picture that estimate is drawn from.

Compute it from the accumulated envelope, or from any onset envelope returned by `onsetEnvelope(...)`. This is a batch step for a buffered window, not work to run inside the audio callback.

```typescript
import { init, onsetEnvelope, tempogram, fourierTempogram, cyclicTempogram, tempogramRatio, plp } from '@libraz/libsonare';

await init();

const env = onsetEnvelope(samples, sampleRate, 2048, 512);

const ac  = tempogram(env, sampleRate, 512, 384, 'autocorrelation'); // default
const cos = tempogram(env, sampleRate, 512, 384, 'cosine');
const ft  = fourierTempogram(env, sampleRate, 512, 384);
const cyc = cyclicTempogram(env, sampleRate, 512, 384, 60, 60);
const ratio = tempogramRatio(ac.data, 384, sampleRate, 512, [0.5, 1, 2, 3, 4]);
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

## AudioWorklet notes

The regular WASM package exposes the `RealtimeEngine` class. The worklet bridge runs that embind-backed engine inside `AudioWorkletGlobalScope` through `SonareRealtimeEngineNode.create(...)`. For the engine's own control surface — transport, the lane mixer, automation, MIDI clips, and external MIDI — see [Realtime Engine](./realtime-engine.md).

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

For app code that wants a higher-level worklet API, `SonareEngine` combines two pieces:

| Piece | Role |
|-------|------|
| Worklet node | Runs the realtime audio side. |
| Main-thread `RealtimeEngine` | Handles offline and timeline operations. |

Its `transport` API covers play/stop, seek by seconds or PPQ, tempo, and loop updates. Beyond transport, the worklet API mirrors essentially the whole engine to the worklet through control messages — the main thread stays the single source of truth and the audio thread receives synced snapshots:

| Need | Facade API |
|------|-----------|
| Track routing, fader, pan, solo/mute | `setTrackLanes`, `setStripGain`, `setStripPan`, `setTrackStripPan`, `setTrackStripPanLaw`, `setTrackStripPanMode`, `setTrackStripDualPan`, `setTrackStripChannelDelaySamples`, `setSoloMute` |
| Track and master inserts and EQ | `setTrackStripJson`, `setMasterStripJson`, `setTrackStripEqBand`, `setMasterStripEqBand`, `setTrackStripInsertParamByName`, `setMasterStripInsertParamByName`, insert-bypass methods |
| Sends and buses | `setSends`, `setBusGain`, `setBusStripJson` |
| MIDI clips and live MIDI | `setMidiClips`, `pushMidiNoteOn`, `pushMidiNoteOff`, `pushMidiCc`, `pushMidiPanic` |
| Parameter automation | `setAutomationLane`, `addAutomationPoint`, `automationParamId(target, kind)`, `busAutomationParamId(busId)`, `listParameters`, `automationLaneCount` |
| Instruments | `setBuiltinInstrument`, `setSynthInstrument`, `loadSoundFont`, `setSf2Instrument` |
| Recording and monitoring | `configureCapture` (incl. `inputMonitor`), `armRecord`, `punch`, `capturedAudio`, `captureStatus` |
| Transport, tempo, markers | `getTransportState`, `cachedTransportState`, `setTempoSegments`, `setTimeSignatureSegments`, marker methods (incl. the replace-all `setMarkers`, which returns the resolved marker list — each entry carries its engine `id`), `setLoopFromMarkers` |
| Clip updates | `addClip`, `removeClip` — sends incremental clip deltas to the worklet |
| Meters and telemetry | `onMeter` / `onTelemetry` / `onScope`, `pollMeters` / `pollTelemetry` / `pollScope`; meter records carry master, lane, bus, and input target ids. Offline/main-thread engines can also drain wide meter records and scope snapshots |
| Offline export | `renderOffline` on the main-thread mirror |

On the worklet API, strip-addressing methods take a track id *or name* (`target: string | number`), and `setSoloMute(target, solo, mute)` resolves the lane index for you. `setTrackStripEqBand` accepts an `EqBand` object directly, so you rarely hand-build band JSON.

`automationParamId(target, 'faderDb' | 'pan')` and `busAutomationParamId(busId)` return reserved engine parameter ids in the mixer namespace, so you can pass them straight to `setAutomationLane(paramId, points)` to automate a track or master fader or pan, or a bus fader (which resolves to its fader gain in dB), without first registering a custom parameter via `addParameter`. The `target`/`busId` declares the mixer lane/bus on first use.

For Worklet-side scope snapshots, pass `scopeIntervalFrames`, `scopeBands`, and optionally `scopeSharedBuffer` / `scopeRingCapacity` to `SonareRealtimeEngineNode.create(...)`. The lower-level `createSonareScopeRingBuffer(...)` and `readSonareScopeRingBuffer(...)` helpers are exported for custom bridges that want to move spectrum plus vectorscope snapshots through a shared ring.

```typescript
import { SonareEngine } from '@libraz/libsonare/worklet';

const engine = await SonareEngine.create(audioCtx, {
  moduleUrl: '/sonare-engine-worklet.js',
  mode: 'auto',
  channelCount: 2,
});

engine.setTrackLanes([{ trackId: 1 }]);
engine.setTrackStripJson(1, trackSceneJson);
engine.addClip(1, [clipL, clipR], 0);
engine.setTempoSegments([{ startPpq: 0, bpm: 120 }]);
engine.transport.setLoop(0, 4, true);
engine.transport.play();
engine.onMeter((meter) => console.log(meter.rmsDbL, meter.rmsDbR));

const offline = await engine.renderOffline(48000);
console.log(offline[0].length);

engine.destroy();
```

::: tip Worklet sync messages
`SonareEngine` runs the full embind engine inside the worklet. If your host worklet entry filters message names before forwarding, allowlist every `sync*`, `captureRequest`, and `transportRequest` message — otherwise lane/strip/MIDI sync messages are silently dropped.
:::

## Paged clip audio streaming

A long arrangement can hold more clip audio than fits in memory at once. The engine streams clip audio in **pages**: instead of one giant buffer, a clip is backed by a *clip page provider* that hands the engine fixed-size pages on demand.

The flow is lock-free by design:

1. The render thread needs a page it does not have yet and pushes a request onto a **wait-free page-request queue**.
2. The main thread drains that queue with `engine.popClipPageRequest()`, reads the audio for the requested page from storage, and calls `provider.supply(pageIndex, channels)`.
3. When a page is no longer needed, `provider.clear(pageIndex)` releases it.

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

### OPFS-backed provider in the browser

The package ships a ready-made provider that reads pages from the [Origin Private File System (OPFS)](https://developer.mozilla.org/docs/Web/API/File_System_API/Origin_private_file_system) on a worker, so disk reads stay off the main thread:

```typescript
import { createOpfsClipPageProvider } from '@libraz/libsonare';

const binding = createOpfsClipPageProvider(engine, {
  path: 'clips/long-take.f32',  // interleaved Float32 in OPFS
  numChannels: 2,
  numSamples: totalFrames,      // total frames in the file
  pageFrames: 65536,            // page size in frames
  // dataOffsetBytes?: skip a header; worker?: reuse your own Worker
});

// In a UI tick, service whatever the render thread asked for:
let request;
while ((request = engine.popClipPageRequest()) !== null) {
  await binding.supplyRequest(request);  // reads and passes that page to the provider
}

// Later:
binding.close();  // releases the provider and (if owned) terminates the worker
```

`createOpfsClipPageProvider(...)` builds the engine-side `ClipPageProvider` for you and pairs it with a worker. By default it spins up an inline worker via `createOpfsClipPageWorker()`, whose body is exported as `opfsClipPageWorkerSource` if you prefer to bundle it yourself or pass your own `Worker`. `supplyRequest(request)` maps a popped request's sample position to a page index; `supplyPage(pageIndex)` lets you prefetch a page directly.

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

## Display waveform peaks

Drawing a clip at an arbitrary zoom does not need every sample — it needs the min/max envelope per screen column. `waveformPeaks(...)` reduces interleaved audio to per-channel min/max **buckets** you can stroke directly:

```typescript
import { init, waveformPeaks, waveformPeakPyramid } from '@libraz/libsonare';

await init();

// interleaved stereo (L0,R0,L1,R1,...); here `mono` is channels = 1
const peaks = waveformPeaks(samples, /* channels */ 1, { samplesPerBucket: 512 });
// peaks.min / peaks.max are channel-major Float32Array of length
// peaks.channels * peaks.bucketCount; draw a vertical line per bucket
for (let b = 0; b < peaks.bucketCount; b++) {
  drawColumn(b, peaks.min[b], peaks.max[b]);
}
```

For a clip the user can zoom freely, precompute several bucket sizes once with `waveformPeakPyramid(...)` and pick the level closest to the current pixels-per-second:

```typescript
const pyramid = waveformPeakPyramid(samples, 1, {
  samplesPerBucketLevels: [512, 1024, 2048, 4096],
});
// pyramid[i] is a WaveformPeaksReport for that bucket size; coarser levels
// have fewer buckets and are cheaper to draw when zoomed out
```

Both are batch reductions for a buffered clip, not audio-callback work. `samplesPerBucket` is the bucket width in frames; a smaller bucket means more detail and more buckets.

## Related

- [Realtime Engine](./realtime-engine.md) — transport, the lane mixer, automation, MIDI clips, and external MIDI routing for the engine this page's bridge and clip streaming feed
- [Mixing Engine](./mixing.md) — strips, buses, sends, and metering for multi-track realtime
- [JavaScript API](./js-api.md) · [Python API](./python-api.md) — the batch feature transforms behind these estimates
- [DSP Implementation Notes](./dsp-implementation.md) — how onset, chroma, and tempo features are built
