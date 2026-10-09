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
The analyzer runs an STFT (short-time Fourier transform — repeated FFTs over short, overlapping windows) under the hood.

| Parameter | Meaning | Larger / smaller |
|-----------|---------|------------------|
| `nFft` | Analysis window size in samples | Bigger = finer frequency detail, coarser timing |
| `hopLength` | How far the window advances between frames | Smaller = more frames per second, more CPU |

The `2048`/`512` defaults below are the common starting point. See [MIR Overview](./glossary/concepts/mir-overview.md) if these are new.
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
  maxPendingFrames: 256, // bound unread output; overflow drops newly produced frames
});

analyzer.process(inputBlock);

const frames = analyzer.readFrames(analyzer.availableFrames());
const stats = analyzer.stats();

if (stats.estimate.updated) {
  console.log(stats.estimate.bpm, stats.estimate.key, stats.estimate.chordRoot);
}
```

`maxPendingFrames` defaults to `4096`. Set it to a smaller value for a UI that may pause or fall behind: analysis continues, but newly produced output frames are dropped while the unread queue is full. `stats().pendingFrames` / `stats().droppedOutputFrames` report the current backlog and cumulative drops.

::: info Stream defaults differ from the batch analyzer
`StreamAnalyzer` defaults to **44100 Hz**, not the 22050 Hz batch default. Realtime audio arrives straight from the playback/capture graph (AudioWorklet, device callbacks), which almost always runs at 44100/48000 Hz; matching that rate avoids an extra resample on the hot path and keeps timestamps aligned with the audio clock. Pass `sampleRate: audioCtx.sampleRate` so estimates and timestamps line up with what you are actually playing.
:::

### Reading frames and output format

A `FrameBuffer` is **Structure-of-Arrays**: timestamps, mel, chroma, onset strength, RMS, spectral centroid, spectral flatness, chord root, chord quality, and chord confidence each live in their own typed array. That layout is cheap to slice and cheap to hand to another thread. Check `featureFlags` before consuming optional arrays (`MEL=1`, `CHROMA=2`, `ONSET=4`, `SPECTRAL=8`); disabled features are empty, and `nChroma` is `0` when chroma is absent.

::: details What are spectral centroid and flatness?
Both reduce the *shape* of one frame's spectrum to a single number you can plot or threshold.

| Measure | Meaning | How to read it |
|---------|---------|----------------|
| Spectral centroid | The magnitude-weighted mean frequency of the frame, Σ f·\|X\| / Σ\|X\| (magnitude, not energy — the two definitions give materially different numbers on a peaky spectrum) | Higher sounds "brighter" (more high-frequency content) |
| Spectral flatness | How evenly energy is spread across frequencies | Near 1 is noise-like (energy everywhere at once); near 0 is tonal (energy concentrated in a few strong peaks) |

Together they are a cheap way to describe timbre frame by frame.
:::

For thread transfer and visualization you often do not need full float precision. `StreamAnalyzer` can quantize the feature arrays, trading precision for bandwidth:

| Read method | Element type | Use it for |
|-------------|--------------|------------|
| `readFrames(n)` | `FrameBuffer` with `Float32Array` / `Int32Array` fields | Full-precision DSP, further analysis |
| `readFramesI16(n)` | `StreamFramesI16` with `Int16Array` fields | Bandwidth-reduced transfer to a worker / over the wire |
| `readFramesU8(n)` | `StreamFramesU8` with `Uint8Array` fields | Cheap visualization (a heatmap pixel only needs 8 bits) |

```typescript
// A spectrogram canvas only needs 8-bit mel — quantize at the source.
const analyzer = new StreamAnalyzer({ sampleRate, nMels: 64 });
analyzer.process(block);
const u8 = analyzer.readFramesU8(analyzer.availableFrames());
// u8.mel is a Uint8Array [nFrames x nMels], ready to write into ImageData
```

::: tip Match the read method to the consumer
The analyzer always runs in float. Pick `readFramesU8` when the data ends up as pixels, `readFramesI16` when it crosses a thread/network boundary and you want roughly half the bytes, and `readFrames` when something downstream does more math. `StreamConfig.outputFormat` is legacy and must be omitted or set to `0`.
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

`stats()` returns an `AnalyzerStats` whose `estimate` field is a **`ProgressiveEstimate`** — the analyzer's running best guess at the music, refined as more audio arrives. Check `estimate.updated` before reading: it is `true` on the periodic frames where the key or BPM estimate is recomputed (not only on frames where the recomputed value actually differs from before), so you can skip the frames where nothing was recomputed at all.

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
  mode: 'auto',            // uses SharedArrayBuffer (SAB) when available, postMessage otherwise
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

### Send PFL/AFL to a separate cue output

PFL/AFL monitoring normally folds the cue bus into the program output. Pass `cueOutput: true` when creating the node to give it a second output carrying only the cue bus; route output `0` to the program destination and output `1` to headphones or another device. Without this option the node keeps one output and the folded mix, sample for sample.

```typescript
import { SonareEngine } from '@libraz/libsonare/worklet';

const engine = await SonareEngine.create(audioCtx, {
  moduleUrl: '/sonare-engine-worklet.js',
  cueOutput: true,
});
engine.setTrackMonitorMode(trackId, 'pfl');
engine.node.connect(audioCtx.destination, 0);
engine.node.connect(cueDestination, 1);
```

For a custom zero-copy worklet path, call `prepareChannels(...)` and `prepareMonitorChannels(...)` from a message handler, before audio processing begins. On each render block, call `processPreparedWithMonitor(numFrames)` and read the program and cue views with `getChannelBuffer(...)` and `getMonitorChannelBuffer(...)`. The preparation calls allocate; the prepared processing path is allocation-free. `processWithMonitor(...)` remains the copy-in alternative outside that hot path.

### Mastering preview in the render realm

`StreamingMasteringChain` is also exported from `@libraz/libsonare/worklet`, so a live mastering preview can stay in the render realm. Construct and `prepare()` it from a message handler, never from `AudioWorkletProcessor.process()`: preparation allocates. A `loudness` stage needs an offline-measured `loudnessStaticGainDb`, because integrated LUFS cannot be measured block by block. After the final block, flush until empty and discard the leading `latencySamples()` samples when alignment matters. The chain is a host-side stage, outside the engine's delay compensation and bypass, so compensate it against other engine outputs yourself.

For app code that wants a higher-level worklet API, `SonareEngine` combines two pieces:

| Piece | Role |
|-------|------|
| Worklet node | Runs the realtime audio side. |
| Main-thread `RealtimeEngine` | Handles offline and timeline operations. |

Its `transport` API covers play/stop, seek by seconds or PPQ (musical position in quarter-note units), tempo, and loop updates. Beyond transport, the worklet API mirrors essentially the whole engine to the worklet through control messages — the main thread stays the single source of truth and the audio thread receives synced snapshots:

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
| Offline export | `renderOffline`, `finishOfflineRender`, `bounceOffline`, `freezeOffline` on the main-thread mirror (see [Offline render, bounce, and freeze](#offline-render-bounce-and-freeze)) |
| Processor state and timing | `resetProcessorState(renderFrame?)`, `tailSamples()`, `graphLatencySamplesQ8()` |

On the worklet API, strip-addressing methods take a track id *or name* (`target: string | number`), and `setSoloMute(target, solo, mute)` resolves the lane index for you. `setTrackStripEqBand` accepts an `EqBand` object directly, so you rarely hand-build band JSON.

`automationParamId(target, 'faderDb' | 'pan')` and `busAutomationParamId(busId)` return reserved engine parameter ids, so you can pass them straight to `setAutomationLane(paramId, points)` to automate a track or master fader or pan, or a bus fader (which resolves to its fader gain in dB), without first registering a custom parameter via `addParameter`. The `target`/`busId` declares the mixer lane/bus on first use. A track or bus id names that track or bus, not its position: it keeps driving it across `setTrackLanes` and `setTrackBuses` reorders and the removal of others, and applies nothing once its track or bus is removed. Resolve ids through these methods rather than computing them; the main-thread mirror and the worklet engine number them identically.

For Worklet-side scope snapshots, pass `scopeIntervalFrames`, `scopeBands`, and optionally `scopeSharedBuffer` / `scopeRingCapacity` to `SonareRealtimeEngineNode.create(...)`. The SAB scope ring keeps the render callback allocation-free; `pollScope()` drains it, and `onScope()` receives the same `SonareWorkletScopeSnapshot` shape. When SAB is unavailable or `mode: 'postMessage'` is selected, the processor sends each snapshot with transferred `Float32Array` buffers for `bands` and `points`; `onScope()` receives the same shape, while `pollScope()` returns an empty array because there is no ring. The postMessage fallback materializes the bounded arrays for each snapshot before transfer. The lower-level `createSonareScopeRingBuffer(...)` and `readSonareScopeRingBuffer(...)` helpers are exported for custom shared-ring bridges.

Meter snapshots reach `onMeter` the same way on both transports. A target wider than stereo (a 5.1 or 7.1 bus) adds `channelCount` plus per-plane `peakDb`, `rmsDb`, `truePeakDb`, and `inputPeakDb` arrays in canonical WAVE channel order; the stereo fields always hold planes 0 and 1. The SAB meter ring record is `SONARE_METER_RING_RECORD_FLOATS` (49) floats, and header slot 3 carries `SONARE_METER_RING_PROTOCOL_VERSION` (2). Size a custom reader from those constants, and do not share a ring between a main thread and a worklet from different package versions.

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

`SonareEngine.create`, `SonareRealtimeEngineNode.create`, the playback node, and `SonareStreamAnalyzerNode.create` take an optional `sampleRate`. The worklet always runs at the `AudioContext`'s rate, so a value that differs from `audioCtx.sampleRate` throws `RangeError` before any node exists; omit it.

### Offline render, bounce, and freeze

`renderOffline`, `bounceOffline`, and `freezeOffline` run on the facade's main-thread engine and block the calling thread for the whole render, so run long jobs where blocking is acceptable. Each returns after restoring the mirror's transport position, and OPFS-streamed clips are paged in for the span first. `bounceOffline` and `freezeOffline` take the options of the raw engine's methods of the same name and return its results; see [Realtime Engine](./realtime-engine.md).

| Call | Behaviour |
|------|-----------|
| `renderOffline(totalFrames)` | Renders from the current position and returns one planar buffer per offline channel. |
| `renderOffline({ totalFrames, blockSize?, finalize? })` | The request form. `blockSize` defaults to the engine's offline block size and must not exceed it (`RangeError`). `finalize: false` renders one chunk of a longer timeline, leaving held notes and delay tails running into the next call. |
| `finishOfflineRender()` | Ends a chunked series: releases held notes, flushes the delay lines, and restores the transport position. |
| `bounceOffline(options)` | Bounces the timeline to an interleaved buffer. `blockSize` has the same ceiling. |
| `freezeOffline(options)` | Freezes the source layer into one clip. The facade, the mirror, and the worklet then hold only that clip. |

```typescript
const total = 4 * 48000;
const chunkFrames = 48000;
const left: Float32Array[] = [];
for (let done = 0; done < total; done += chunkFrames) {
  const last = done + chunkFrames >= total;
  const chunk = await engine.renderOffline({
    totalFrames: Math.min(chunkFrames, total - done),
    finalize: last,
  });
  left.push(chunk[0]);
}
```

Every offline entry point resets the mirror's mixer and effect processors to their prepared state first, so two renders of the same span are identical. `resetProcessorState(renderFrame?)` exposes that reset for the live engine: it cuts running insert tails and delay lines like a seek, applies at `renderFrame` (omitted: the next block head), and leaves instruments alone. `tailSamples()` is an upper bound on the longest audible tail in samples (`2147483647` means unbounded), and `graphLatencySamplesQ8()` is the processing latency in 1/256 samples; both answer from the mirror.

### Node-level control and polling

`engine.node` is the `SonareRealtimeEngineNode`; use it directly for sample-accurate commands and for draining the worklet's output queues.

| Method | Use |
|--------|-----|
| `play`, `stop`, `seekSample(timelineSample, sampleTime?)`, `seekPpq(ppq, sampleTime?)`, `resetProcessorState`, `resetMasterLoudnessMeter` | Queue a transport or reset command at an absolute `sampleTime`. Omit it to apply at the next block head; a negative value throws `RangeError`. Each returns whether the command was queued. |
| `hasCommandRoom()` | Whether one more well-formed command would fit the queue now; queues nothing. |
| `requestTransportState()` | Resolves with the worklet's own transport state. |
| `requestCaptureStatus()`, `requestCapturedAudio()`, `requestCaptureReset()` | Read the capture buffer held in the worklet. |
| `pollMidiOut()` / `onMidiOut(cb)` | Drain external-MIDI events already lowered to MIDI 1.0 bytes, for a Web MIDI output port. While `onMidiOut` is subscribed it consumes the ring, so a manual poll sees only what arrived since. |
| `pollClipPageRequests()` / `onClipPageRequests(cb)` | Drain batches of clip-page misses for your own paging code. |
| `onSyncError(cb)` | Receives control messages the worklet rejected; returns an unsubscribe function. |

### Analyzing a graph branch

`SonareStreamAnalyzerNode` runs a `StreamAnalyzer` against any node in your audio graph without writing a processor. The worklet side only averages the input channels to mono and transfers fixed-size chunks (`chunkFrames`, default 4096, at least 128); the analyzer runs on the main thread, so it needs no WASM in the worklet realm and no `SharedArrayBuffer`, and its frames lag the audio by about one chunk. The node has one input and no output.

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

`config` takes the same fields as `new StreamAnalyzer(...)`; `sampleRate` defaults to the context's and any other value throws `RangeError`. `onFrames` delivers the `readFrames` format, and `onStats` fires when the key or tempo estimate was re-estimated. If a chunk is dropped or the processor restarts, the analyzer's sample offset is reset rather than splicing the two streams together.

::: tip Worklet sync messages
`SonareEngine` runs the full embind engine inside the worklet. If your host worklet entry filters message names before forwarding, allowlist every `sync*`, `captureRequest`, and `transportRequest` message — otherwise lane/strip/MIDI sync messages are silently dropped.
:::

## Display waveform peaks

Drawing a clip at an arbitrary zoom does not need every sample — it needs the min/max envelope per screen column. `waveformPeaks(...)` reduces interleaved audio to per-channel min/max **buckets** you can stroke directly:

```typescript
import { init, waveformPeaks, waveformPeakPyramid } from '@libraz/libsonare';

await init();

// Interleaved layout is (L0,R0,L1,R1,...) for stereo; this example is mono,
// so channels = 1.
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
- [JavaScript API](./js-api-analysis.md) · [Python API](./python-api.md) — the batch feature transforms behind these estimates
- [DSP Implementation Notes](./dsp-implementation.md) — how onset, chroma, and tempo features are built
