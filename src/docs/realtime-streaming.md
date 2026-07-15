---
title: Realtime and Streaming
description: libsonare realtime APIs — StreamAnalyzer for live MIR frames and updating BPM/key/chord/pattern estimates, RealtimeEngine for transport and playback, and a guide to tempograms from streamed onset data.
---

# Realtime and Streaming

libsonare has two realtime-oriented APIs:

- **`StreamAnalyzer`** — feeds in blocks of audio and emits *analysis frames* (mel, chroma, onset, spectral) plus musical estimates that update as more audio arrives (BPM, key, chord, chord progression, pattern). Use it for visualizers and live "what is this song doing" displays.
- **`RealtimeEngine`** — transport, automation, clip playback, a per-track lane mixer (lanes, buses, sends, channel strips), MIDI clip scheduling, graph routing, metronome, capture, offline bounce, freeze, and telemetry. Use it for playback engines.

The short version: use `StreamAnalyzer` when audio is the input and information is the output; use `RealtimeEngine` when clips, MIDI, transport, and mixed audio are the output. If you are building a UI, `StreamAnalyzer` usually feeds graphs, meters, and labels. If you are building a DAW-like timeline or instrument host, `RealtimeEngine` is the object that actually plays.

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
| A playback engine with tempo, loop points, markers, metronome, clips, and automation | `RealtimeEngine` |
| A playback engine that also mixes its own tracks live (lanes, buses, sends, strips) | `RealtimeEngine` [lane mixer](#track-lanes-buses-and-channel-strips) |
| A standalone mixer with strips, sends, and meters (one-shot or scene-driven) | [Mixing Engine](./mixing.md) |
| A simple offline script | [Getting Started](./getting-started.md), not this page |

## Which API to use

| Need | API |
|------|-----|
| Mel/chroma/onset frames from a microphone or playing file | `StreamAnalyzer` |
| BPM, key, current chord, chord progression, and pattern scores that update over time | `StreamAnalyzer.stats()` |
| Transport, tempo, loop points, markers, metronome, clip scheduling, and automation | `RealtimeEngine` |
| Per-track lanes, buses, sends, and channel strips inside the playback engine | `RealtimeEngine` lane mixer (`setTrackLanes`, `setTrackBuses`, strip JSON setters) |
| Sample-accurate MIDI clip playback into engine instruments | `RealtimeEngine.setMidiClips()` + `sampleAtPpq()` |
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

## RealtimeEngine

`RealtimeEngine` is the broader transport and playback engine. It exposes sample-accurate commands for parameters and transport, plus offline render helpers for non-realtime export.

Start with transport and output before adding the advanced pieces: construct the engine with the device sample rate and block size, set tempo/loop state, call `play()`, process blocks, and only then add meters, lane mixing, MIDI clips, or capture. That order keeps debugging clear because you can confirm "the engine plays" before asking it to route or record anything.

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

Beyond transport, `RealtimeEngine` also registers parameter metadata, sets automation lanes, seeks to markers, configures metronome clicks, processes with monitor output, captures audio, runs offline bounces, and freezes clips. Two telemetry families matter when wiring a UI:

- **Meters** — `drainMeterTelemetry()` for the stereo fast path, and `drainMeterTelemetryWide()` for per-plane records on surround/offline targets.
- **Scopes** — call `configureScopeTelemetry(intervalFrames, bandCount)` once to enable per-target spectrum + vectorscope capture, then read snapshots with `drainScopeTelemetry()`:
  - `intervalFrames` — the minimum render-frame gap between snapshots (`0` disables capture).
  - `bandCount` — the FFT band resolution, clamped to `1..64`; the call returns the band count actually applied.

Each drained scope snapshot is addressed by `targetId` (master, a lane, or a bus) and carries two arrays: `bands` holds the linear-band FFT magnitudes in dB (length = the applied band count), and `points` holds an interleaved stereo goniometer cloud `[l0, r0, l1, r1, …]` (up to 32 stereo points) for a vectorscope display. Band levels are block-size-independent: the amplitude normalization accounts for short blocks, so the dB readings stay stable regardless of the AudioWorklet block size.

Each record returned by `drainMeterTelemetry()`, `drainMeterTelemetryWide()`, and `drainScopeTelemetry()` carries a `droppedRecords` count of snapshots lost from the lock-free telemetry ring since the previous drain. A non-zero value means the consumer is draining too slowly (back-pressure) — poll more frequently to keep the meters and scopes glitch-free.

All dB-valued level and loudness fields in a meter record — `peakDbL`/`R`, `rmsDbL`/`R`, `truePeakDbL`/`R`, `maxTruePeakDb`, and `momentaryLufs`/`shortTermLufs`/`integratedLufs` — have a defined floor of −120 dBFS and never carry `NaN` or `-Infinity`. An uninitialized, silent, or unwritten plane (e.g. the right channel of a mono lane) reports −120 dBFS, not 0 dBFS, so records are always JSON-safe. (Non-dB fields like `correlation`, `monoCompatWidth`, and `gainReductionDb` default to 0.) The integrating-meter fields — `momentaryLufs`/`shortTermLufs`/`integratedLufs` and the true-peak fields — only rise above the floor after sustained streaming; on a short or one-shot render they stay at −120.

Scheduled clips and sequenced MIDI only sound while the transport is rolling — on a stopped engine they stay silent rather than leaking audio. The offline helpers (`renderOffline`, `bounceOffline`, `freezeOffline`) roll the transport for the render duration and restore the prior state afterwards, so offline clip and MIDI rendering needs no manual `play()`.

For a **manual** offline render — when you drive `process()` yourself instead of using those helpers — run one priming `process()` block after seeking (it drains queued commands and applies automation at the seek position), then call `engine.settleParameters()` to snap every in-flight parameter ramp (engine-level smoothed params, mixer lane fader/pan/gate, and bus gains) to its target value, so the first audible block renders at settled values instead of ramping in from defaults. `settleParameters()` must not run concurrently with a live audio thread — it is offline / main-thread only.

```typescript
// Prime: drains queued commands and applies automation at the seek position.
engine.process([new Float32Array(blockSize), new Float32Array(blockSize)]);
engine.settleParameters(); // snap all smoothed ramps to target before the first audible block
```

For recording, the capture API adds a few controls:

- `setCaptureSource('output' | 'input')` — record the engine's rendered output bus or the raw input you pass to `process(...)`.
- `setRecordOffsetSamples(offset)` — shift the captured audio to compensate for monitoring round-trip latency.
- `setInputMonitor(enabled, gain?)` — mix the live input into the output so the performer can hear themselves.

`captureStatus()` reports both the active capture `source` (`'output'` or `'input'`) and the current `recordOffsetSamples`, so the UI can confirm what is being recorded. See [Recording and Takes](./recording-and-takes.md) for the full flow.

::: info Live MIDI and recording
The engine also accepts **live MIDI** into its instruments and **records** what plays back. Those APIs have their own pages: [MIDI Input](./midi-input.md) for the Web MIDI → engine bridge (port management, CC binding, NativeSynth/SF2 destinations), and [Recording and Takes](./recording-and-takes.md) for capture, loop-recording takes/comp lanes, and the browser microphone helper `bindMicrophoneInput(...)` that wires `getUserMedia` into an engine node.
:::

::: warning Check the engine ABI before constructing
`engineCapabilities().abiCompatible` confirms the loaded WASM matches the JS package's expected engine ABI. The realtime engine is the most version-sensitive API in the library; constructing it against a mismatched binary is undefined. Guard with the check above; if it fails, update your `@libraz/libsonare` package so the WASM binary and JS package come from the same release.
:::

### Track lanes, buses, and channel strips

The engine carries its own realtime-safe **lane mixer**, so a playback engine can mix the tracks it plays without a second mixing pass. Each track occupies a **lane**; lanes can feed **aux sends** into numbered **buses**; and tracks, buses, and the master each own a full **channel strip** — the same strip model (EQ, inserts, fader, pan, sends) as the [Mixing Engine](./mixing.md). Plugin delay compensation is recomputed automatically whenever the lane layout is republished.

```typescript
// Declare buses first, then the lane order with sends.
engine.setTrackBuses([{ busId: 1, gainDb: 0 }]);
engine.setTrackLanes([
  { trackId: 1, sends: [{ busId: 1, levelDb: -12, enabled: true }] },
  2, // a bare track id appends a lane with no sends
]);

// Strips reuse mixer scene JSON: the scene's first strips[0] entry becomes the strip spec.
engine.setTrackStripJson(1, vocalSceneJson);
engine.setBusStripJson(1, reverbSceneJson);   // the bus must already exist via setTrackBuses
engine.setMasterStripJson(masterSceneJson);

// Tweak one embedded EQ band without rebuilding the strip
// (same band JSON schema as eq.parametric / StreamingEqualizer):
engine.setTrackStripEqBandJson(1, 0,
  JSON.stringify({ type: 'peak', frequencyHz: 250, gainDb: -2, q: 1.0 }));

// Bypass an insert in place; pass true as the 4th argument to also reset its state.
engine.setTrackStripInsertBypassed(1, 0, true);

// Queueable solo/mute: takes a lane index and an optional renderFrame
// (-1 = apply immediately; a future frame applies sample-accurately).
engine.setSoloMute(0, true, false, -1);
```

::: info Lane indices are append-only
Once a track id occupies a lane, its lane index stays fixed for the engine's lifetime. Each `setTrackLanes(...)` call must list the already-declared lane ids in their current order and may only append new track ids after them. Entries carrying `sends` replace that track's send list; entries without `sends` (including bare ids) leave existing sends untouched. `setSoloMute` addresses lanes by that fixed index.
:::

::: warning Structural strip calls belong on the control thread
`setTrackLanes`, `setTrackBuses`, and the strip JSON setters build internal structures and must not run concurrently with `process(...)` — issue them between renders or while stopped. The lightweight live controls are `setSoloMute` (queued sample-accurately) and the EQ-band updates, which mutate one band in place.
:::

<SonareDemo id="engine-lane-mixer" />

### Group routing, sidechains, and live strip controls

Beyond the lane/send graph, a few realtime-safe controls reshape routing and pan without rebuilding a strip:

| Goal | Raw `RealtimeEngine` | `SonareEngine` worklet API |
|------|----------------------|-------------------------------|
| Fold a lane into a group bus (or pass `busId 0` to restore it to the master mix) | lane `outputBusId` in `setTrackLanes(...)` (`0` or absent = master mix) | `setTrackOutputBus(target, busId)` (`busId 0` restores the master mix) |
| Key one lane's insert off another lane (ducking) | `setLaneSidechain(trackId, insertIndex, sourceTrackId)` (pass `0` to clear) | `setLaneSidechain(target, insertIndex, sourceTarget)` (pass `null` to clear) |
| Pan a lane | `setTrackStripPan(trackId, pan)` | `setTrackStripPan(target, pan)` |
| Pan law / pan mode | `setTrackStripPanLaw(...)`, `setTrackStripPanMode(...)` | same names |
| Independent L/R (dual) pan | `setTrackStripDualPan(trackId, left, right)` | `setTrackStripDualPan(target, left, right)` |
| Per-lane sample delay | `setTrackStripChannelDelaySamples(trackId, samples)` | same |
| Set one insert parameter by name | `setTrackStripInsertParamByName(trackId, insertIndex, paramName, value)` (master/bus: `setMasterStripInsertParamByName(...)`, `setBusStripInsertParamByName(...)`) | same, plus `setStripInsertParamByName(target, ...)` |
| Bypass a bus insert | `setBusStripInsertBypassed(busId, insertIndex, bypassed, resetOnBypass?)` | same |

`setTrackStripInsertParamByName(...)` is the realtime automation entry point — it addresses a parameter by the JSON key reported by [`masteringInsertParamInfo(name)`](./mastering-processors.md), so a host can change an insert's automatable parameters live without rebuilding the strip JSON. On the worklet API, `target` is a track id *or name*.

### Parameter automation

`RealtimeEngine` carries an engine-level parameter registry separate from the strip-insert params of [`setTrackStripInsertParamByName`](#group-routing-sidechains-and-live-strip-controls). Register a parameter once with `addParameter(info)`, then change it live with `setParameter(id, value, renderFrame?)` (or `setParameterSmoothed(...)` for a ramp), or schedule it along the timeline with `setAutomationLane(id, points)`.

```typescript
// EngineParameterInfo: id, name, unit, min/max/default, rtSafe, defaultCurve (0=linear)
engine.addParameter({
  id: 1, name: 'volume', unit: 'lin',
  minValue: 0, maxValue: 1, defaultValue: 1,
  rtSafe: true, defaultCurve: 0,
});

// Automation points are positioned in PPQ (quarter-note units), with an
// optional curveToNext code (0=linear, 1=exponential, 2=hold, 3=s-curve).
engine.setAutomationLane(1, [
  { ppq: 0, value: 1, curveToNext: 0 },
  { ppq: 4, value: 0 },
]);

// Or set it imperatively from the control thread (renderFrame -1 = immediate):
engine.setParameter(1, 0.5);
```

On the `SonareEngine` worklet API you can also automate a mixer fader/pan without registering a parameter: `automationParamId(target, 'faderDb' | 'pan')` and `busAutomationParamId(busId)` return reserved engine parameter ids in the mixer namespace, so you can pass them straight to `setAutomationLane(paramId, points)` to automate a track or master fader or pan, or a bus fader (a bus id resolves to its fader gain in dB). The `target`/`busId` declares the mixer lane/bus on first use.

Insert parameters use the same automation-lane mechanism, but first need a reserved id. Call `resolveTrackInsertAutomationId(trackId, insertIndex, paramName)`, `resolveMasterInsertAutomationId(...)`, or `resolveBusInsertAutomationId(...)`, then pass the returned id to `setAutomationLane`, `setParameter`, or `setParameterSmoothed`. `insertIndex` addresses the strip's combined pre-then-post insert sequence, and `paramName` is the JSON key reported by `masteringInsertParamInfo`. WASM/Node return `-1` for an unknown strip, insert, or key; Python raises `SonareError`.

```typescript
const thresholdId = engine.resolveBusInsertAutomationId(1, 0, 'thresholdDb');
if (thresholdId < 0) throw new Error('bus compressor threshold is not automatable');
engine.setAutomationLane(thresholdId, [
  { ppq: 0, value: -18 },
  { ppq: 8, value: -24, curveToNext: 3 },
]);
```

`setParamSmoothingMs(ms)` changes the default glide used by smoothed fader/pan changes, insert-parameter automation, and MIDI-CC mappings. The default is `20` ms; `0` makes changes immediate. Set it once from the control thread before playback unless your host intentionally changes the global feel of automation.

### Surround group buses and wide meters

A bus declared with a surround `channelLayout` (`SonareChannelLayout`: `0` mono, `1` stereo, `2` 5.1, `3` 7.1) becomes a **surround group bus**: it sums into the master plane-by-plane and exposes per-plane meters. A lane routed to it is folded to a point source, then placed from its strip [`surroundPan`](./mixing.md#surround-and-multichannel) values. `azimuth`, `divergence`, and `lfe` are active; `elevation` and `distance` are reserved. The standalone `Mixer` remains stereo, so this DSP is specific to the realtime engine's wide-bus render path.

```typescript
engine.setTrackBuses([{ busId: 1, channelLayout: 2 }]); // a 5.1 group bus
engine.setTrackOutputBus(1, 1);                          // route the lane into it
engine.setTrackStripJson(1, JSON.stringify({
  strips: [{ id: 'source', surroundPan: { azimuth: -30, divergence: 0, lfe: 0 } }],
  buses: [],
  connections: [],
}));
```

`sourceChannelLayout` on `EngineTrackLane` is currently descriptive/serialized only: the lane render still consumes mono or stereo input and folds stereo to a point source before surround placement. Do not use it as a promise that an existing 5.1/7.1 source stays discrete.

Call `setTrackOutputBus(1, 0)` (or set `outputBusId: 0` in `setTrackLanes`) to fold the lane back onto the master mix.

Surround meters do not travel over the live worklet meter ring. Read them on an offline or main-thread engine with `drainMeterTelemetryWide(maxRecords?)`, which returns per-plane (wide) records; `drainMeterTelemetry()` stays the stereo fast path. The two drains pop the same single-consumer telemetry queue, so call only one per engine instance — the live AudioWorklet path already owns the queue via the stereo drain, which is why `drainMeterTelemetryWide()` is meant for an offline (non-worklet) engine; running both on one engine makes their records starve each other.

### MIDI clip scheduling and `sampleAtPpq`

Audio clips have the clip schedule and page providers; **MIDI clips** have their own realtime schedule. `setMidiClips(clips)` replaces the engine's whole MIDI clip schedule in one call, and each clip routes its events to a MIDI **destination id** — the instrument bound with `setBuiltinInstrument`, `setSynthInstrument`, or `setSf2Instrument` (see [MIDI Input](./midi-input.md) for the destination model).

The schedule is *compiled*: timing is in **absolute samples on the engine timeline**, not PPQ. Use `sampleAtPpq(ppq)` to convert musical positions through the engine's tempo map — it integrates every `setTempo` / `setTempoSegments` change, so the result stays correct across tempo ramps.

```typescript
// UMP MIDI 1.0 channel-voice words (note-on = status 0x9, note-off = 0x8).
const noteOn  = (ch: number, note: number, vel: number) =>
  (0x2 << 28) | (0x9 << 20) | (ch << 16) | (note << 8) | vel;
const noteOff = (ch: number, note: number) =>
  (0x2 << 28) | (0x8 << 20) | (ch << 16) | (note << 8);

const start = engine.sampleAtPpq(8);                  // tempo-map-aware
const length = engine.sampleAtPpq(16) - start;

engine.setMidiClips([{
  id: 1,
  trackId: 1,
  destinationId: 0,            // the instrument destination that renders these events
  startSample: start,
  startPpq: 8,
  lengthSamples: length,
  loop: true,
  loopLengthSamples: length,
  events: [
    // renderFrame is an absolute engine-timeline sample. wordCount may be
    // omitted for one-word MIDI 1.0 events (it is inferred from word0).
    { renderFrame: start,                          word0: noteOn(0, 60, 100) },
    { renderFrame: start + Math.floor(length / 2), word0: noteOff(0, 60) },
  ],
}]);
```

Looping clips repeat their event list every `loopLengthSamples`. To clear the schedule, call `setMidiClips([])`. If you work at the *project* level instead (notes in PPQ, takes, comping), build the arrangement with [Project Editing](./project-editing.md) and bounce it — this realtime schedule is the lower-level API a DAW front end compiles into.

### Sending a track to external MIDI gear

An **internal destination** renders MIDI through a NativeSynth/SF2 instrument inside libsonare. An **external destination** skips that instrument and places MIDI 1.0 byte messages in an output queue for your host to send to hardware or another application. libsonare prepares and timestamps the messages; opening the OS/Web MIDI port remains the host's job.

For the raw `RealtimeEngine`, mark the destination, process audio as usual, then drain the output queue frequently:

```typescript
engine.setMidiDestinationExternal(2, true); // destination 2 now drives external gear
engine.setExternalMidiClockEnabled(true);  // optional: clock + start/continue/stop

engine.process([leftBlock, rightBlock]);
for (const event of engine.drainExternalMidi(256)) {
  if (event.destinationId === 0xffffffff) {
    // Clock/transport is broadcast to every external port selected by the host.
    for (const output of externalOutputs.values()) output.send(event.bytes);
  } else {
    externalOutputs.get(event.destinationId)?.send(event.bytes);
  }
}
```

Each event contains `destinationId`, `renderFrame`, and `bytes` (one lowered MIDI 1.0 message of 1–3 bytes). Clock and transport messages use the sentinel destination `0xFFFFFFFF`; channel messages retain their destination id. `maxRecords` limits the returned messages, not source events, and any remainder stays queued for the next drain. Check `externalMidiDroppedCount()` — a rising value means the fixed-capacity realtime queue filled before the host drained it.

With the `SonareEngine` AudioWorklet facade, use `setMidiDestinationExternal(trackId, true)` and subscribe with `onMidiOut(callback)`. The worklet already drains its engine once per render block and posts batches to the main thread, so do not try to call the raw drain as a second consumer:

```typescript
engine.setMidiDestinationExternal('hardware-lead', true);
const unsubscribe = engine.onMidiOut((events) => {
  for (const event of events) {
    if (event.destinationId === 0xffffffff) {
      for (const output of externalOutputs.values()) output.send(event.bytes);
    } else {
      externalOutputs.get(event.destinationId)?.send(event.bytes);
    }
  }
});
```

Node exposes the same camelCase raw-engine methods. Python uses `set_midi_destination_external`, `set_external_midi_clock_enabled`, `drain_external_midi`, and `external_midi_dropped_count`.

## AudioWorklet notes

The regular WASM package exposes the `RealtimeEngine` class. The worklet bridge runs that embind-backed engine inside `AudioWorkletGlobalScope` through `SonareRealtimeEngineNode.create(...)`.

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

- [Mixing Engine](./mixing.md) — strips, buses, sends, and metering for multi-track realtime
- [JavaScript API](./js-api.md) · [Python API](./python-api.md) — the batch feature transforms behind these estimates
- [DSP Implementation Notes](./dsp-implementation.md) — how onset, chroma, and tempo features are built
