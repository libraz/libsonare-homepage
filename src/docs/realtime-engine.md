---
title: Realtime Engine
description: The libsonare RealtimeEngine reference — transport and telemetry, the realtime-safe lane mixer, group routing and sidechains, parameter automation, surround group buses with wide meters, sample-accurate MIDI clip scheduling, and routing a track to external MIDI gear.
---

# Realtime Engine

`RealtimeEngine` is libsonare's transport and playback engine: sample-accurate commands for parameters and transport, a per-track lane mixer (lanes, buses, sends, channel strips), MIDI clip scheduling, group routing and sidechains, surround group buses, capture, offline bounce, freeze, and telemetry. Use it when clips, MIDI, transport, and mixed audio are the *output* — a DAW-like timeline or an instrument host.

For the streaming analyzer (`StreamAnalyzer`), tempograms, the AudioWorklet bridge, paged clip audio streaming, and display waveform peaks, see [Realtime and Streaming](./realtime-streaming.md).

## What You Will Learn

The sections below are largely independent — read the first one, then jump to whichever matches your host. By the end of this page you should be able to:

- construct the engine, size it for your real channel count, and run transport plus meter/scope telemetry;
- mix the tracks you play with the built-in lane mixer, and tap a lane into a separate cue bus with PFL or AFL;
- reshape routing live — group buses, sidechains, pan — without rebuilding a channel strip;
- automate engine parameters and insert parameters along the timeline, and rewrite a lane while audio runs;
- schedule audio clips with a warp mode, and recognize a paging dropout when one happens;
- schedule MIDI clips against the tempo map, and send a track to external MIDI gear.

::: warning Check the engine ABI before constructing
`engineCapabilities().abiCompatible` confirms the loaded WASM matches the JS package's expected engine ABI — the application binary interface, the exact memory layout and call signatures the two sides agree on. The realtime engine is the most version-sensitive API in the library; constructing it against a mismatched binary is undefined. Guard with the check below; if it fails, update your `@libraz/libsonare` package so the WASM binary and JS package come from the same release.
:::

## Transport and output

`RealtimeEngine` exposes sample-accurate commands for parameters and transport, plus offline render helpers for non-realtime export.

Start with transport and output before adding the advanced pieces: construct the engine with the device sample rate and block size, set tempo/loop state, call `play()`, process blocks, and only then add meters, lane mixing, MIDI clips, or capture. That order keeps debugging clear because you can confirm "the engine plays" before asking it to route or record anything.

```typescript
import { init, RealtimeEngine, engineCapabilities } from '@libraz/libsonare';

await init();

const caps = engineCapabilities();
if (!caps.abiCompatible) throw new Error('Realtime engine ABI mismatch');

// (sampleRate, maxBlockSize, commandCapacity?, telemetryCapacity?, maxChannels?)
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

`getTransportState()` includes a musical playhead as well as the raw sample and PPQ (musical position in quarter-note units) positions. `barCount` is zero-based, while `beat` is one-based within that bar and `beatFraction` is in `[0, 1)`, so a UI can show a conventional bar:beat display (`${barCount + 1}:${beat}`, for example "3:2") without deriving it from PPQ. Use `beatFraction` for a smooth indicator.

::: info Three clocks
The engine keeps three positions, and the API says which one each argument means:

| Clock | Counts | Moves |
|-------|--------|-------|
| **Render frame** (`renderFrame`, the worklet's `sampleTime`) | Frames processed since `prepare` | Always forward, by every block, even while stopped; never jumps |
| **Timeline sample** (`timelineSample`) | The playhead's position in samples | Only while playing; jumps on a seek and folds back at a loop end |
| **PPQ** (`ppq`) | The playhead's musical position in quarter notes | Follows the timeline through the tempo map |

Commands are *scheduled* in render frames: `renderFrame` says in which upcoming frame a command takes effect, and omitting it means the **block head**, the first frame of the next block the engine processes. Clips, markers, and automation are *placed* in timeline samples or PPQ, which is why they follow seeks and loops. `sampleAtPpq(ppq)` converts between the last two. One field name breaks the pattern: a [MIDI clip](#midi-clip-scheduling-and-sampleatppq) event's `renderFrame` holds an engine-timeline sample.
:::

### Sizing prepare for the real channel count

The constructor and `prepare(...)` take an optional trailing `maxChannels`. Prepare reserves the capture, instrument, PDC (plugin delay compensation), and monitor planes for that count rather than always reserving 64, so a stereo host is not paying for 64 planes of scratch it will never touch.

```typescript
// A stereo host reserves 2 planes, not 64 (commandCapacity and telemetryCapacity left default).
const engine = new RealtimeEngine(48000, 128, undefined, undefined, 2);
engine.prepare(48000, 128, undefined, undefined, 8);   // or re-prepare for a 7.1 target
```

Set it to the largest channel count you will actually render (1 to 64). Leaving it unset reserves 64.

### Control-only hosts

A host that never calls `process()` (a headless controller, or an offline path that queues commands and reads state) can apply the queued commands explicitly with `engine.flushControlCommands()`, which renders nothing.

### Seeking and the metronome

`seekSample(timelineSample, renderFrame?)`, `seekPpq(ppq, renderFrame?)`, and `seekMarker(markerId, renderFrame?)` queue a jump of the playhead (after `setMarkers([...])` for the marker form); like every queued command they apply at `renderFrame`, or at the next block head when it is omitted. A seek releases sounding notes and resets controllers, as a loop wrap or stop does. `setMetronome({ enabled, beatGain?, accentGain?, clickSamples?, clickSeconds? })` configures the click, `metronome()` reads it back, and the click length is limited to one second. On the worklet `SonareEngine`, `setMetronome` returns `false` when the live ring cannot queue the command.

### Install a compiled Project timeline
`Project.compileTimeline()` returns the compile result plus a `timeline` handle. Check `hasTimeline` and the diagnostics before applying it; an error result has `timeline: null`. `RealtimeEngine.applyProjectTimeline(timeline)` is a control-thread operation for a **stopped, prepared** engine, and the timeline's project sample rate must equal the prepared rate. It replaces the tempo and time-signature segments, markers, track lanes, track automation, audio and MIDI clips, and the per-track strips from the project's mixer scene. Instruments, buses, the master strip, metronome, loop, and capture remain as configured on the engine, so bind instruments separately.

The apply is all-or-nothing. A disposed timeline, an invalid scene or timeline, or a scene strip routed from several tracks is rejected without publishing a replacement. In WASM, the timeline must be a `ProjectTimeline` created by the same initialized module; a handle from another module instance or a released handle cannot be applied. After a successful apply the engine owns its reference, so dispose the timeline immediately. Once a timeline is installed, preparing the engine at another sample rate is refused until both timeline clip domains have been cleared with `setClips([])` and `setMidiClips([])`.

```typescript
const compiled = project.compileTimeline(); // project: a Project with tempo, clips and events
if (!compiled.hasTimeline || compiled.timeline === null) {
  throw new Error(compiled.messages);
}
const engine = new RealtimeEngine(48000, 128);
try {
  engine.applyProjectTimeline(compiled.timeline);
  compiled.timeline.dispose(); // the engine retains its own reference
} finally {
  engine.destroy();
}
```

### Meter and scope telemetry

Two telemetry families matter when wiring a UI:

- **Meters**: `drainMeterTelemetry()` for the stereo fast path, and `drainMeterTelemetryWide()` for per-plane records on surround and offline targets.
- **Scopes**: call `configureScopeTelemetry(intervalFrames, bandCount)` once to enable per-target spectrum and vectorscope capture, then read snapshots with `drainScopeTelemetry()`. `intervalFrames` is the minimum render-frame gap between snapshots (`0` disables capture). `bandCount` is the FFT band resolution, clamped to `1..64`; the call returns the band count actually applied.

Each meter record carries these fields:

| Field | Stereo path | Wide path | Notes |
|-------|-------------|-----------|-------|
| Sample peak | `peakDbL`, `peakDbR` | `peakDb[]` | One value per plane on the wide path |
| RMS | `rmsDbL`, `rmsDbR` | `rmsDb[]` | |
| True peak | `truePeakDbL`, `truePeakDbR`, `maxTruePeakDb` | `truePeakDb[]`, `maxTruePeakDb` | Streaming measurement, a few samples behind the block |
| Pre-trim input peak | `inputPeakDbL`, `inputPeakDbR` | `inputPeakDb[]` | One value per valid plane |
| Loudness | `momentaryLufs`, `shortTermLufs`, `integratedLufs` | same | Rise above the floor only after sustained streaming; a short or one-shot render stays at −120 |
| Gain reduction | `gainReductionDb` | same | Reduction from the target strip or bus, as well as the master path |
| Phase and width | `correlation`, `monoCompatWidth` | same | Default 0 |
| `droppedRecords` | cumulative count | same | See below |

Every dB-valued level and loudness field has a defined floor of −120 dBFS and never carries `NaN` or `-Infinity`. An uninitialized, silent, or unwritten plane (for example the right channel of a mono lane) reports −120 dBFS, not 0 dBFS, so records are always JSON-safe. The non-dB fields (`correlation`, `monoCompatWidth`, `gainReductionDb`) default to 0.

Each record returned by `drainMeterTelemetry()`, `drainMeterTelemetryWide()`, and `drainScopeTelemetry()` carries a `droppedRecords` count for its producing tap. The count is cumulative from that tap's `prepare` or `reset`; draining does not clear it. Compare it with the value from the previous poll: an increase means records were lost between polls, while an unchanged value means no new drop. A non-zero value can refer to an earlier interval.

For the individual insert values behind `gainReductionDb`, call `meterTargetInsertGainReduction(targetId)`. It returns the last rendered block's reduction in dB (each value is `<= 0`) in combined pre-fader-then-post-fader insert order; bypassed and non-dynamics inserts return `0`, and the meter record's `gainReductionDb` is the minimum. Target `0` is the master, `1..32` are lanes, `33..40` are buses, and the input monitor target returns an empty array. In an AudioWorklet, a structured postMessage meter snapshot can include `insertGainReductionDb` only on the newest record for each target in one drain, and it describes the latest committed host block. The fixed SharedArrayBuffer meter ring has no room for this optional field: call `SonareEngine.pollInsertGainReduction(targetId)` (or the lower-level `SonareRealtimeEngineNode` method) when the ring path is in use.

The AudioWorklet raw meter ring uses a 49-float record whose header slot 3 carries protocol version 2, so a main thread and a worklet from different package versions must not share a ring. Code that reads its `SharedArrayBuffer` directly must size and stride records with the exported `SONARE_METER_RING_RECORD_FLOATS` constant and read the record count and header instead of hard-coding the record layout.

Each drained scope snapshot is addressed by `targetId` (master, a lane, or a bus) and carries two arrays: `bands` holds the linear-band FFT magnitudes in dB (length = the applied band count), and `points` holds up to 32 stereo goniometer samples as `{ left, right }` records for a vectorscope display. (The worklet scope ring buffer carries the same cloud in its own interleaved `[l0, r0, l1, r1, …]` `Float32Array` form.) The spectrum uses a Hann-windowed, coherently normalized FFT and reports the mean power of the bins in each linear band in dBFS. Readings depend on the render block size, FFT frequency resolution, and `bandCount`; compare snapshots only when those settings match.

To restart the master meter's integrated loudness, call `resetMasterLoudnessMeter(renderFrame?)` (`reset_master_loudness_meter(render_frame=None)` in Python; the worklet node takes `resetMasterLoudnessMeter(sampleTime?)`). The command clears only the integrated-loudness accumulator; momentary, short-term, and true-peak history are retained. `renderFrame` is the render frame at which the reset applies; omit it to apply at the next block head. A negative value is refused (`RangeError` in WASM and Node), and the same holds for every `renderFrame` parameter on transport, parameter, solo/mute, and MIDI calls.

### Offline render, bounce, and freeze

Scheduled clips and sequenced MIDI only sound while the transport is rolling; on a stopped engine they stay silent rather than leaking audio. The offline helpers roll the transport for the render duration and restore the prior state afterwards, so offline clip and MIDI rendering needs no manual `play()`.

| Call | Renders |
|------|---------|
| `renderOffline` | Into channel buffers you supply. The chunkable, lower-level renderer. |
| `bounceOffline` | The timeline into one interleaved buffer, optionally resampled. |
| `freezeOffline` | The source layer into a single clip. |

`bounceOffline` renders at the prepared engine rate. A zero or omitted `sourceSampleRate` selects that rate; a non-zero source rate must match it or the call is refused. `totalFrames` is counted at the source rate. A zero or omitted `targetSampleRate` keeps the source rate, while a different target rate resamples the returned buffer and is reported in `result.sampleRate`.

`bounceOffline` and `freezeOffline` perform a non-rendering offline prime before the audible render: they drain queued commands, reset every mixer and effect processor to its prepared state (instruments are not reset), adopt published tempo, graph, lane, and automation snapshots, apply start-position automation, and settle parameter ramps. The prime keeps transport stopped, so it does not advance the playhead, and no user `play()` or priming `process()` is needed. Because processors start from their prepared state, insert tails and delay lines still ringing from live playback are cut, and a second bounce of the same engine renders the same audio as the first.

`renderOffline` preserves the engine's current lifecycle and ramps, rolls a stopped transport only for the render, then restores it. A stopped `process()` quantum still advances processor state and is not an equivalent prime; `settleParameters()` only snaps known targets and does not adopt pending lane, graph, or tempo snapshots. Use it only off the live audio thread.

A block size larger than the block size the engine was prepared with is refused by `renderOffline`, `bounceOffline`, `freezeOffline`, and `primeOfflineParameters` (`SonareError` with `InvalidParameter`; the worklet facade throws `RangeError`) rather than rendering at the prepared size. `blockSize` defaults to 128 and may be smaller than the prepared size.

#### Chunked renders and priming by hand

A host that renders block by block can run the pieces of that prime itself:

| Method | Does |
|--------|------|
| `primeOfflineParameters(numChannels, blockSize)` | The whole offline prime without rendering: queued commands applied, mixer and effect processors reset, snapshots adopted, automation and lane gates resolved at the transport position, smoothers snapped. Call it once before the first chunk so a repeat render starts from the same state. |
| `resetProcessorState(renderFrame?)` | Queues the processor reset alone, applied at `renderFrame` (omitted: the next block head). Called during playback it cuts running insert tails and delay lines mid-sound, like a seek. |
| `settleParameters()` / `settleInsertParameters()` | Snap in-flight parameter ramps, or only the insert automation slots after a structural change. |
| `finishOfflineRender()` | Ends a chunked render started with `renderOffline({ ..., finalize: false })`: releases held notes and flushes the delay lines. Skipping it leaves notes at the last chunk sounding. |
| `tailSamples()` / `graphLatencySamplesQ8()` | The longest audible tail as a conservative upper bound in samples (`2147483647` means unbounded), and the processing latency in 1/256 samples. A drum-kit synth reports the tail of the kit pieces struck so far (about 0.69 s after one kick), and the whole-kit maximum only before the first note. |

```typescript
engine.primeOfflineParameters(2, 128);
// Each chunk is a whole number of blocks, all with the same blockSize.
engine.renderOffline({ channels: chunkA, blockSize: 128, finalize: false });
engine.renderOffline({ channels: chunkB, blockSize: 128, finalize: false });
engine.finishOfflineRender();
```

Python spells these `prime_offline_parameters`, `reset_processor_state`, `settle_insert_parameters`, `finish_offline_render`, `tail_samples` and `graph_latency_samples_q8`. The worklet `SonareEngine` also offers `bounceOffline`, `freezeOffline`, `finishOfflineRender`, and `renderOffline({ totalFrames, blockSize?, finalize? })`; they run on the facade's main-thread offline engine and block the calling thread for the whole render. See [Offline render, bounce, and freeze](./realtime-streaming.md#offline-render-bounce-and-freeze).

### Capture and live MIDI

For recording, the capture API adds a few controls:

- `setCaptureSource('output' | 'input')` records the engine's rendered output bus or the raw input you pass to `process(...)`.
- `setRecordOffsetSamples(offset)` shifts the captured audio to compensate for monitoring round-trip latency.
- `setInputMonitor(enabled, gain?)` mixes the live input into the output so the performer can hear themselves.

`captureStatus()` reports both the active capture `source` (`'output'` or `'input'`) and the current `recordOffsetSamples`, so the UI can confirm what is being recorded. See [Recording and Takes](./recording-and-takes.md) for the full flow.

The engine also accepts **live MIDI** into its instruments: `pushMidiNoteOn`, `pushMidiNoteOff`, `pushMidiCc`, `pushMidiProgram`, `pushMidiPitchBend`, `pushMidiChannelPressure`, `pushMidiPolyPressure`, `pushMidiUmp`, and `pushMidiSysex`. A MIDI value outside its range (a channel above 15, say) throws a `RangeError` naming the argument and its range. [MIDI Input](./midi-input.md) covers the Web MIDI bridge (port management, CC binding, NativeSynth and SF2 destinations), and [Recording and Takes](./recording-and-takes.md) covers loop-recording takes, comp lanes, and the browser microphone helper `bindMicrophoneInput(...)`.

## Track lanes, buses, and channel strips

The engine carries its own realtime-safe **lane mixer**, so a playback engine can mix the tracks it plays without a second mixing pass. Each track occupies a **lane**; lanes can feed **aux sends** into numbered **buses**; and tracks, buses, and the master each own a full **channel strip** — the same strip model (EQ, inserts, fader, pan, sends) as the [Mixing Engine](./mixing.md). Plugin delay compensation (PDC) is recomputed automatically whenever the lane layout is republished.

A track lane therefore has two gain layers. The first is the lane's channel strip, with its own trim, EQ, inserts, fader, and pan (set through `setTrackStripJson` and the `setTrackStrip*` calls). After it the lane mixer applies a **lane fader**, the mute/solo **gate**, and a **lane pan** (the `faderDb` / `pan` automation targets, `setSoloMute`, and the facade's `setStripGain` / `setStripPan`). The cue taps and the sidechain key below are defined relative to these two layers.

```typescript
// Declare buses first, then the lane order with sends.
engine.setTrackBuses([{ busId: 1, gainDb: 0 }]);
engine.setTrackLanes([
  { trackId: 1, sends: [{ busId: 1, levelDb: -12, enabled: true }] },
  2, // a bare track id appends a lane with no sends
]);

// Strips reuse mixer scene JSON. A track or master strip reads the scene's strips[0];
// a bus strip reads its buses[0] (the bus entry carrying inserts, trim, width and pan).
engine.setTrackStripJson(1, vocalSceneJson);
engine.setBusStripJson(1, reverbSceneJson);   // the bus must already exist via setTrackBuses
engine.setMasterStripJson(masterSceneJson);

// Tweak one embedded EQ band without rebuilding the strip (band JSON as in eq.parametric):
engine.setTrackStripEqBandJson(1, 0, JSON.stringify({ type: 'peak', frequencyHz: 250, gainDb: -2, q: 1.0 }));

// Bypass an insert in place; a 4th argument of true also resets its state.
engine.setTrackStripInsertBypassed(1, 0, true);

// Queueable solo/mute: lane index, then an optional renderFrame (omitted = next block head).
engine.setSoloMute(0, true, false);
```

::: info Lane order follows `setTrackLanes(...)`
On the raw `RealtimeEngine`, a successful `setTrackLanes(...)` call may reorder, remove, or add tracks. The `SonareEngine` facade's `setTrackLanes` is append-only: keep every declared id in its order and append new ones; reordering or removing is refused (see [AudioWorklet notes](./realtime-streaming.md#audioworklet-notes)). Queued commands, sends, insert automation, and lane state follow the track identity; lane indices are the current positions after the call. On the raw `RealtimeEngine`, every call rebuilds each lane's sends from scratch from whatever `sends` array that lane's entry passed — omitting `sends` (including a bare id) clears that lane's sends rather than leaving them untouched. The `SonareEngine` worklet facade preserves sends on omission by keeping its own JS-side send cache and resending the full list underneath on every call. Re-read any numeric lane or track-insert selector after a topology change.

To change one lane's sends or output bus without restating the lane list, use `setTrackSends(trackId, sends)` and `setTrackOutputBus(trackId, busId)` (C `sonare_engine_set_track_sends` / `sonare_engine_set_track_output_bus`, Python `set_track_sends` / `set_track_output_bus`). Each leaves the lane's other fields and every other lane unchanged, and an unchanged send list keeps its in-flight level ramps. They throw for an unknown track id, an undeclared bus, a duplicate send bus, or a send level outside the send range. On the raw `RealtimeEngine` the lane must already be declared through `setTrackLanes`; the worklet facade's `setTrackSends` creates the lane when the track has none.

A centered mono lane plays at unity for every pan law, including a lane whose strip the engine created for a send or insert or built from a scene spec; panning it still moves it.
:::

::: warning Structural strip calls belong on the control thread
`setTrackLanes`, `setTrackBuses`, and the strip JSON setters build internal structures and must not run concurrently with `process(...)` — issue them between renders or while stopped. The lightweight live controls are `setSoloMute` (queued sample-accurately) and the EQ-band updates, which mutate one band in place.
:::

### A bus insert chain sees the summed signal, once

A bus insert chain is stateful and usually non-linear: a compressor's envelope, a saturator's transfer curve, a reverb's tail. It therefore has to see the **sum** of everything feeding the bus, once per block. A compressor fed two partial signals separately is not the same processor as one fed their sum, and a reverb run twice would advance its tail twice per block.

Clip audio and hosted-instrument audio are two contributors to the same buses, so they are aggregated into one block before any strip, send, or bus chain runs. Every lane, every bus chain, and every strip smoother along the way then advances exactly once per block, however many sources produced audio. That merged pass needs a non-empty instrument rack and inactive plugin delay compensation. With PDC in play the clip bus is rendered into its own scratch buffer and delayed so it lands phase-aligned with the internally delayed instruments. A project with no hosted instruments has only one contributor and needs no merge.

With a saturating or compressing insert on a group bus, this is the difference between hearing it act on the group and hearing it act on each source that feeds the group.

::: info Solo and mute ramps take their full time
Each lane is finished once per block, so its fader, pan, and gate smoothers are not advanced a second time by another source; within the block they still run sample by sample. The gate — the smoother behind solo and mute — has a **10 ms** time constant, against **5 ms** for the lane fader and pan, so a solo or mute change is a short audible ramp rather than a step. These times are fixed; `setParamSmoothingMs` does not change them.
:::

<SonareDemo id="engine-lane-mixer" />

## Track monitor taps: off, PFL, and AFL

Each configured track lane can contribute to a separate cue/monitor bus. Queue a mode with `setTrackMonitorMode(laneIndex, mode, renderFrame?)`; `laneIndex` is the current index from the latest `setTrackLanes` call, so re-read it after a reorder; `renderFrame`, when omitted, applies at the next block head, and `mode` accepts `'off'`, `'pfl'`, or `'afl'` (or ordinals `0`, `1`, and `2`).

- **off**: the lane contributes nothing to the monitor bus.
- **PFL** (pre-fader listen): taps after the lane strip (including the strip's own fader) and its plugin-delay compensation, but before the lane fader, gate, and pan. It remains audible there when the lane is muted or solo-gated.
- **AFL** (after-fader listen): taps after the fader, gate, and pan. For a surround lane it is after fader/gate and the surround plane placement; stereo AFL is post-pan.

PFL behaves like a pre-fader send and AFL like a post-fader send. The demo below lets you hear the difference when the fader moves.

<SonareDemo id="pre-post-fader" />

<FlowDiagram
  title="Where PFL and AFL tap the lane"
  :nodes="[
    { id: 'strip', label: 'Lane strip + PDC', col: 0, row: 0 },
    { id: 'fader', label: 'Fader, gate, pan', col: 1, row: 0 },
    { id: 'out', label: 'Main output', col: 2, row: 0, variant: 'success' },
    { id: 'pfl', label: 'PFL tap', col: 1, row: 1, variant: 'accent' },
    { id: 'afl', label: 'AFL tap', col: 2, row: 1, variant: 'accent' },
    { id: 'cue', label: 'Cue / monitor bus', col: 3, row: 1, variant: 'success' }
  ]"
  :edges="[
    { from: 'strip', to: 'fader' },
    { from: 'fader', to: 'out' },
    { from: 'strip', to: 'pfl', label: 'pre-fader' },
    { from: 'fader', to: 'afl', label: 'post-fader' },
    { from: 'pfl', to: 'cue' },
    { from: 'afl', to: 'cue' }
  ]"
  caption="PFL listens before the fader, gate, and pan, so it stays audible on a muted lane; AFL listens after them."
/>

The monitor bus sums every lane with a PFL/AFL tap. The ordinary `process(...)` path folds that bus into the main output for compatibility, so a cued lane is heard there twice (at unity, a PFL lane comes out 6 dB louder) and a muted lane under PFL still reaches the main output. Use `processWithMonitor(...)` when the program output and cue output must stay separate. Offline renders, bounces, stem bounces and freezes contain the program output only, whatever the PFL/AFL or solo monitor state:

```typescript
engine.setTrackMonitorMode(0, 'pfl');
const { output, monitor } = engine.processWithMonitor([leftBlock, rightBlock]);
engine.setTrackMonitorMode(0, 'off');
```

WASM and Node return `{ output, monitor }`; Python uses `set_track_monitor_mode(0, 'afl')` and receives `(output, monitor)` from `process_with_monitor(...)`. The C entry points are `sonare_engine_set_track_monitor_mode` and `sonare_engine_process_with_monitor`.

## Group routing, sidechains, and live strip controls

Beyond the lane/send graph, a few realtime-safe controls reshape routing and pan without rebuilding a strip. The diagram shows where each one attaches:

<FlowDiagram
  title="Group routing and sidechain key taps"
  :nodes="[
    { id: 'lane', label: 'Lane strip', col: 0, row: 0 },
    { id: 'fader', label: 'Fader, gate, pan', col: 1, row: 0 },
    { id: 'bus', label: 'Bus inserts', col: 2, row: 0, variant: 'accent' },
    { id: 'busgain', label: 'Bus gainDb', col: 3, row: 0 },
    { id: 'master', label: 'Master', col: 4, row: 0, variant: 'success' },
    { id: 'laneKey', label: 'Lane key tap', col: 0, row: 1, variant: 'muted' },
    { id: 'busKey', label: 'Bus key tap', col: 3, row: 1, variant: 'muted' }
  ]"
  :edges="[
    { from: 'lane', to: 'fader' },
    { from: 'fader', to: 'bus', label: 'outputBusId' },
    { from: 'bus', to: 'busgain' },
    { from: 'busgain', to: 'master', label: 'outputBusId' },
    { from: 'lane', to: 'laneKey', label: 'after strip, before fader', style: 'dashed' },
    { from: 'laneKey', to: 'bus', label: 'sidechain key', style: 'dashed' },
    { from: 'lane', to: 'bus', label: 'send, preFader', style: 'dashed' },
    { from: 'fader', to: 'bus', label: 'send, postFader', style: 'dashed' },
    { from: 'bus', to: 'busKey', label: 'before gainDb', style: 'dashed' },
    { from: 'busKey', to: 'master', label: 'sidechain key', style: 'dashed' }
  ]"
  caption="A lane feeds a bus through its output and its sends; a bus feeds the master or another bus the same way. Key taps are read before the lane fader and before the bus gainDb. A destination narrower than its source receives a BS.775 downmix."
/>

| Goal | Raw `RealtimeEngine` | `SonareEngine` worklet API |
|------|----------------------|-------------------------------|
| Fold a lane into a group bus (or pass `busId 0` to restore it to the master mix) | lane `outputBusId` in `setTrackLanes(...)` (`0` or absent = master mix), or `setTrackOutputBus(trackId, busId)` for one lane | `setTrackOutputBus(target, busId)` (`busId 0` restores the master mix) |
| Replace one lane's aux sends (an empty array clears them) | `setTrackSends(trackId, sends)` | `setTrackSends(target, sends)` |
| Fold a bus into another bus, or send it a copy | bus `outputBusId` and `sends` in `setTrackBuses(...)` (`0`/absent output = master mix) | same fields on `setTrackBuses(...)` |
| Check a sidechain binding without applying it | `canSetLaneSidechain(trackId, insertIndex, sourceTrackId)`, `canSetBusSidechain(...)`, `canSetMasterSidechain(...)` (same arguments as the setters) | same names |
| Key one lane's insert off another lane (ducking) | `setLaneSidechain(trackId, insertIndex, sourceTrackId)` (pass `0` to clear) | `setLaneSidechain(target, insertIndex, sourceTarget)` (pass `null` to clear) |
| Key a bus insert off a track or another bus | `setBusSidechain(busId, insertIndex, sourceKind, sourceId)` (`sourceId 0` clears) | same |
| Key a master insert off a track or a bus | `setMasterSidechain(insertIndex, sourceKind, sourceId)` | same |
| Pan a lane | `setTrackStripPan(trackId, pan)` | `setTrackStripPan(target, pan)` |
| Pan law / pan mode | `setTrackStripPanLaw(...)`, `setTrackStripPanMode(...)` | same names |
| Independent L/R (dual) pan | `setTrackStripDualPan(trackId, left, right)` | `setTrackStripDualPan(target, left, right)` |
| Per-lane sample delay | `setTrackStripChannelDelaySamples(trackId, samples)` | same |
| Set one insert parameter by name | `setTrackStripInsertParamByName(trackId, insertIndex, paramName, value)` (master/bus: `setMasterStripInsertParamByName(...)`, `setBusStripInsertParamByName(...)`) | same, plus `setStripInsertParamByName(target, ...)` |
| Bypass a bus insert | `setBusStripInsertBypassed(busId, insertIndex, bypassed, resetOnBypass?)` | same |

`setTrackStripInsertParamByName(...)` is the realtime automation entry point — it addresses a parameter by the JSON key reported by [`masteringInsertParamInfo(name)`](./mastering-processors.md), so a host can change an insert's automatable parameters live without rebuilding the strip JSON. On the worklet API, `target` is a track id *or name*.

`sourceKind` for a bus or master sidechain key is `'track'` (a lane's post-strip signal, before its lane fader) or `'bus'` (a bus's processed signal, before its own `gainDb`, folded to stereo when it is wider); Python takes the same names, or the matching `0`/`1` ordinal, on `set_bus_sidechain` / `set_master_sidechain`. A master `insertIndex` counts its pre-fader inserts first, then its post-fader ones, the same order every other master insert setter uses. Both keys share the lane sidechain binding table (32 entries) and are control-thread-only, like `setTrackBuses` itself.

A lane sidechain key is taken from the source lane after its strip and before its lane fader, then delay-compensated to the destination strip input. The engine renders lanes in sidechain-key order, so the result is independent of the order passed to `setTrackLanes(...)` and of the render block size. A self-key, a cycle, a full binding table, or an alignment beyond the delay ceiling is refused and leaves the binding unchanged. The compensation is included in the reported engine latency. `setTrackStripChannelDelaySamples(...)` shifts only that strip; it does not become PDC or change the reported latency.

```typescript
// Route bus 2's output into bus 1, with a pre-fader send to the same bus,
// then duck bus 1's compressor off bus 2's own signal.
engine.setTrackBuses([
  { busId: 1, gainDb: 0 },
  { busId: 2, gainDb: -6, outputBusId: 1, sends: [{ busId: 1, levelDb: -12, sendTiming: 'preFader' }] },
]);
engine.setBusStripJson(1, busCompSceneJson); // insert 0 on the bus is a compressor
engine.setMasterStripJson(compSceneJson);    // insert 0 on the master is a compressor
engine.setTrackLanes([1, 2]);
engine.setBusSidechain(1, 0, 'bus', 2);   // insert 0 on bus 1, keyed from bus 2
engine.setMasterSidechain(0, 'track', 1); // insert 0 on the master, keyed from track 1
```

Each `canSet*Sidechain` call takes the arguments of its setter and returns a `SidechainCheck`, `{ ok, reason }`, without changing anything; `reason` is `null` exactly when `ok` is true, and otherwise names the first check the setter would fail: `'invalidTarget'`, `'insertOutOfRange'`, `'undeclaredSource'`, `'invalidSourceKind'`, `'selfKey'`, `'cycle'`, `'tableFull'`, or `'planRefused'`. A UI can use it to gray out an impossible key source before offering it. `insertOutOfRange` on a lane means its strip has no such insert (a lane with no strip has none), and `undeclaredSource` that the source track has no declared lane; the bus and master forms report the same. `planRefused` means only an alignment past the delay ceiling or an overflow. Python has the same three methods (`can_set_lane_sidechain`, ...) returning a `SidechainCheck` whose `reason` is the same value in snake_case (`'self_key'`, `'insert_out_of_range'`, ...); they are control-thread only.

```typescript
engine.setTrackLanes([1, 2]);
engine.setTrackStripJson(1, compSceneJson); // insert 0 on track 1 is a compressor
engine.canSetLaneSidechain(1, 0, 1);  // { ok: false, reason: 'selfKey' }
engine.canSetLaneSidechain(1, 0, 2);  // { ok: true, reason: null }
```

A bus's output, a send, or a sidechain key that lands on a narrower destination — a smaller bus, the master at its rendered width, or a stereo key tap — is folded through the [ITU-R BS.775 downmix the surround section below uses](#surround-group-buses-and-wide-meters); a wider destination receives the source planes on the same indices. Configuring a bus list is validated as one dependency graph over every output, send, and bus-sourced key: a cycle, a reference to an undeclared bus, a bus routed to itself, or removing a bus a lane still targets is refused and leaves the previous configuration in place.

## Parameter automation

`RealtimeEngine` carries an engine-level parameter registry separate from the strip-insert params of [`setTrackStripInsertParamByName`](#group-routing-sidechains-and-live-strip-controls). Register a parameter once with `addParameter(info)`, then change it live with `setParameter(id, value, renderFrame?)` (or `setParameterSmoothed(...)` for a ramp), or schedule it along the timeline with `setAutomationLane(id, points)`.

Inspect metadata with `parameterInfo(id)`. It resolves host-registered ids and reserved ids for hosted-instrument parameters, mixer fader/pan/width targets, and channel-strip insert parameters when the engine retains their strip specification. Reserved metadata comes from compiled defaults and the insert catalog, not the current audio state: an instrument's reported default describes its unloaded patch, and an externally bound strip has no retained specification for insert metadata. `parameterCount()` and `parameterInfoByIndex(index)` enumerate host-registered parameters only; reserved ids are available through `parameterInfo(id)` but never appear in that enumeration. Python uses `parameter_info`, `parameter_count`, and `parameter_info_by_index`; the C API uses `sonare_engine_parameter_info`, `sonare_engine_parameter_count`, and `sonare_engine_parameter_info_by_index`.

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

// Or set it imperatively from the control thread (omit renderFrame to apply at the next block head):
engine.setParameter(1, 0.5);
```

A track, bus, or master fader, a track or master pan, and the master width can be automated without registering a parameter. On the raw `RealtimeEngine`, declare the lane and bus first (`setTrackLanes`, `setTrackBuses`), then resolve the id:

```typescript
const faderId = engine.resolveTrackLaneAutomationId(1, 'faderDb'); // or 'pan'
const busId = engine.resolveBusAutomationId(1, 'faderDb');
if (faderId < 0 || busId < 0) throw new Error('declare the lane and bus first');
engine.setAutomationLane(faderId, [{ ppq: 0, value: 0 }, { ppq: 8, value: -12 }]);
```

Both return `-1` when the track has no lane or the bus is not configured (Python raises `SonareError`: `resolve_track_lane_automation_id`, `resolve_bus_automation_id`; C: `sonare_engine_resolve_track_lane_automation_id`, `sonare_engine_resolve_bus_automation_id`). The id names the track or bus, not its position, so it keeps driving that strip across `setTrackLanes` and `setTrackBuses` reorders and the removal of other strips; once its own track or bus is removed it applies nothing. The master strip always exists, so `resolveMasterAutomationId(paramName)` takes `'faderDb'`, `'pan'` or `'width'` and its id never goes stale (WASM/Node return `-1` for any other name; Python raises `SonareError`: `resolve_master_automation_id`; C: `sonare_engine_resolve_master_automation_id`). On the `SonareEngine` facade `automationParamId('master', 'faderDb' | 'pan')` returns the fader and pan ids. The reserved mixer id namespace (`0x4D58xxxx`) accepts only master ids: `setParameter`, `setParameterSmoothed`, and `setAutomationLane` refuse any other id in it with `InvalidParameter`, so take track and bus ids only from the resolvers or `automationParamId`, never by computing them. On the `SonareEngine` worklet API, `automationParamId(target, 'faderDb' | 'pan')` and `busAutomationParamId(busId)` return the same kind of id, declaring the mixer lane or bus on first use.

Insert parameters use the same automation-lane mechanism, but first need a reserved id. Call `resolveTrackInsertAutomationId(trackId, insertIndex, paramName)`, `resolveMasterInsertAutomationId(...)`, or `resolveBusInsertAutomationId(...)`, then pass the returned id to `setAutomationLane`, `setParameter`, or `setParameterSmoothed`. `insertIndex` addresses the strip's combined pre-then-post insert sequence, and `paramName` is the JSON key reported by `masteringInsertParamInfo`. WASM/Node return `-1` for an unknown strip, insert, or key; Python raises `SonareError`.

Track, bus, and master insert ids share one lifetime rule: an id names its strip by identity and the kind of processor in its slot (for `effects.gsEfx`, its EFX type too). It survives `setTrackLanes` and `setTrackBuses` reorders and the removal of other strips. It goes inert when its strip is removed or the slot comes to hold another kind of processor: it then applies nothing, its queued edits are dropped, and it is never reissued, so resolve again for the new processor. An engine holds 8192 insert-id entries; a strip, bus, or lane change that would exceed them is refused with `InvalidParameter`. `insertParameterConstructedValue(paramId)` returns the immutable value used when that insert parameter was constructed, rather than its current live or automated value.

The strip-insert processors — `eq.*`, `dynamics.*`, `saturation.*`, `spectral.*`, `stereo.*`, `maximizer.*`, and `multiband.*` — all resolve through these methods and can be driven at audio-block precision. `repair.decrackle` (median), `repair.dehum`, `repair.denoiseClassical`, and `repair.dereverbClassical` also run as realtime inserts. They match the offline function, delayed by the latency the insert reports, but their parameters resolve no automation id. Stages that need the whole signal (`loudness`, the match stages, and the remaining `repair.*`) have no insert form.

```typescript
const thresholdId = engine.resolveBusInsertAutomationId(1, 0, 'thresholdDb');
if (thresholdId < 0) throw new Error('bus compressor threshold is not automatable');
engine.setAutomationLane(thresholdId, [
  { ppq: 0, value: -18 },
  { ppq: 8, value: -24, curveToNext: 3 },
]);
```

### Automating a hosted instrument

A synth bound to a MIDI destination has automatable parameters too, and they resolve the same way an insert parameter does. `resolveInstrumentAutomationId(destinationId, paramName)` turns a hosted instrument's continuous parameter — addressed by its JSON-key name, such as `'cutoffHz'` — into a reserved id you pass straight to `setAutomationLane`, `setParameter`, or `setParameterSmoothed`. A host can then drive a synth's cutoff or vibrato depth from an automation lane at audio-block precision instead of stepping it from the control thread, and because the resolved lane is smoothed on the audio thread, live and offline rendering agree.

Bind the instrument with `setSynthInstrument` or `setSf2Instrument` first, then resolve. Resolution is control-thread only and touches no audio state.

::: code-group

```typescript [node]
engine.setSynthInstrument(patch, 0);

const cutoffId = engine.resolveInstrumentAutomationId(0, 'cutoffHz');
if (cutoffId < 0) throw new Error('cutoffHz is not automatable on this instrument');

engine.setAutomationLane(cutoffId, [
  { ppq: 0, value: 400 },
  { ppq: 8, value: 6000, curveToNext: 1 },
]);
```

```python [python]
from libsonare import AutomationCurve, AutomationPoint

engine.set_synth_instrument(patch, destination_id=0)

# Note the argument order: param_name comes first here.
cutoff_id = engine.resolve_instrument_automation_id("cutoffHz", destination_id=0)

engine.set_automation_lane(cutoff_id, [
    AutomationPoint(ppq=0, value=400, curve_to_next=AutomationCurve.EXPONENTIAL),
    AutomationPoint(ppq=8, value=6000),
])
```

:::

WASM and Node take `resolveInstrumentAutomationId(destinationId, paramName)`; Python takes `resolve_instrument_automation_id(param_name, destination_id=0)`, name first. A destination id passed where the name belongs raises rather than resolving.

The id encodes the destination slot as well as the parameter, so it survives an unbind and rebind of the *same* `destination_id` and simply applies nothing while that destination has no instrument bound. Structural fields — preset, engine mode, waveform, filter model, unison, polyphony — are not automatable: they resize voice pools or swap DSP topology, which is not audio-thread safe. Rebind the instrument with a new patch instead.

The engine holds **32** instrument-automation slots; once they are claimed, further resolutions fail rather than retargeting an existing lane. Resolution returns `-1` on WASM and Node — or `SONARE_ERROR_INVALID_PARAMETER` at the C entry point `sonare_engine_resolve_instrument_automation_id` — when the key is unknown, no instrument is bound to that destination, the instrument exposes no automatable parameters, or the slot table is full. Always check the returned id before handing it to a lane. In a build without the arrangement subsystem the C entry point returns `SONARE_ERROR_NOT_SUPPORTED`, and that build reports `instrumentParamAutomation: false` in its capability JSON — the way a host detects up front that the resolver will not answer. See [`capabilities()`](./js-api.md#capabilities).

`setParamSmoothingMs(ms)` sets the time constant of the ramps started by `setParameterSmoothed(...)`, whatever id they target. On the `SonareEngine` facade that includes `setStripGain`, `setStripPan`, and `setBusGain`, which send smoothed fader, pan, and bus-gain changes. The default is `20` ms; `0` makes those changes immediate. It does not affect automation-lane playback, insert and instrument automation (fixed 5 ms smoothers), MIDI-CC mappings (applied directly), or the lane fader, pan, and gate smoothers. Set it once from the control thread before playback.

### How a lane plays back

A lane is a breakpoint curve, not a list of scheduled jumps. Each point is `{ ppq, value, curveToNext? }`, and a point's `curveToNext` shapes the segment that leads to the *next* point:

| `curveToNext` | Segment to the next point |
|---------------|---------------------------|
| `0` linear | a straight line between the two values |
| `1` exponential | interpolates the magnitude in the log domain, so a frequency or linear-gain sweep sounds even; two values of opposite sign fall back to linear, and 0 counts as positive. A `faderDb` lane is already in dB, where `linear` is the even fade (see [`exponential` on a dB lane](./mixing.md#automation)) |
| `2` hold | keeps this point's value until the next point, then steps |
| `3` s-curve | eases out of this point and into the next (smoothstep) |

Outside the curve the lane is flat: before the first point it returns the first value, after the last point the last value, and nothing extrapolates. Points are sorted by `ppq` on receipt, and two points at the same `ppq` collapse to the first one you supplied — an instantaneous jump is a `hold` segment (or a second point placed a hair later), not two coincident points. A non-finite `ppq` or `value`, or a curve code outside `0..3`, is rejected as `InvalidParameter` rather than clamped.

The audio thread samples the curve at every breakpoint — the block is split there, so a breakpoint lands on its exact frame — and every **64 frames** in between, widened only for blocks so large that the fixed boundary list would overflow. Each sampled value goes to the target the way a live `setParameter` would: mixer fader, pan and bus gain, insert parameters and instrument parameters run through their own fixed smoothers (5 ms for lane fader and pan, insert, and instrument parameters), so a step in the curve is a short glide; a parameter registered with `addParameter` is set directly and steps. A block holding more breakpoints than the boundary list can carry is reported as `BoundaryOverflow`, and the surplus breakpoints apply at the next 64-frame boundary instead of their own frame.

**Writing a lane while audio is running does not glitch.** `setAutomationLane(id, points)` replaces the lane for that one id and leaves the others in place. The control thread builds the new lane set and publishes it; the audio thread adopts the newest set once, at the start of its next block — never mid-block, never with a lock or an allocation. What *can* be audible is the value you wrote: if the new curve differs from the old one at the current playhead, the target moves to the new value at the next sub-block — a glide on a smoothed target, a step on a directly-set one. A lane aimed at an id nothing is bound to is skipped and reported on `drainTelemetry()` as `UnknownTarget`; a parameter registered with `rtSafe: false` is refused up front (WASM and Node throw `SonareError`, the C entry point returns `SONARE_ERROR_INVALID_PARAMETER`).

To clear a lane, pass an empty point list: `setAutomationLane(id, [])`. After the audio thread adopts the clear, the target restores the last value sent through `setParameter` or `setParameterSmoothed`. If no manual value was ever sent for that id, the current value remains unchanged. The result is the same regardless of whether the manual write or the lane clear reaches the audio thread first. Python passes `[]`; the C API uses `point_count == 0`.

## Audio clips: warp mode and page underruns

`setClips(clips)` replaces the engine's whole audio clip schedule in one call, on the control thread. A clip is either **direct** (`channels`: one `Float32Array` per channel) or **paged** (`pageProvider`: a provider the host feeds page by page — see [Paged clip audio streaming](./wasm-streaming.md#paged-clip-audio-streaming)); `startPpq` places it, `lengthSamples`, `clipOffsetSamples`, `loop`, `gain` and the fade lengths shape it, and `warpMode` plus `warpAnchors` decide how it follows the tempo map. Python spells the same call `set_clips` with `warp_mode`.

```typescript
engine.setClips([{
  id: 1, trackId: 1, channels: [left, right],
  startPpq: 0, lengthSamples: barLength,
  warpMode: 'time-stretch',            // 'off' | 'repitch' | 'tempo-sync' | 'time-stretch' (or 0..3)
  warpAnchors: [                       // warpSample: from the clip start; sourceSample: into the source
    { warpSample: 0,         sourceSample: 0 },
    { warpSample: barLength, sourceSample: sourceBarLength },
  ],
}]);
```

`setClips` replaces the whole schedule. To add, replace, or remove a single clip without resending the others, use `upsertClip(clip)` (replaces the clip with the same `id`, or adds it) and `removeClip(clipId)` (`InvalidParameter` when no clip has that id). The other clips are not copied again, and a refused clip leaves the published set unchanged. Python spells them `upsert_clip` and `remove_clip`.

Anchors must be finite, non-negative and strictly increasing on both axes, or the call is rejected. `'repitch'` and `'time-stretch'` read the same anchor map on the audio thread; with fewer than two anchors both play the clip at its native rate, under either mode the map alone decides the source position (`clipOffsetSamples` is not added on top), and the loop-seam crossfade is not applied. `'tempo-sync'` is different in kind on the raw engine: the stretched audio is baked when `setClips` runs, so a tempo-sync clip cannot be paged, cannot `loop`, and must keep `clipOffsetSamples` inside the source — each is rejected as `InvalidParameter`. What the modes mean musically, and when to prefer one, is on [Warp and Tempo Sync](./glossary/arrangement/warp-and-tempo.md).

### The `'time-stretch'` voice budget

A `'time-stretch'` clip borrows one preallocated stretcher voice for each block it renders. The pool capacity is **8** by default, and each voice handles up to **two** channels. Set it from the control thread with `setWarpVoiceCapacity(voices)` and read it with `warpVoiceCapacity()`; Python uses `set_warp_voice_capacity()` and `warp_voice_capacity()`, while C uses `sonare_engine_set_warp_voice_capacity()` and `sonare_engine_warp_voice_capacity()`. The accepted range is **0..64**. A value above 64 is rejected and leaves the previous capacity unchanged. Capacity **0** disables time-stretch for these clips: they use the `'repitch'` path, and those fallbacks do not increment `warpStretchOverflowCount()` (`warp_stretch_overflow_count()` in Python, `sonare_engine_warp_stretch_overflow_count()` in C). When the engine is already prepared, changing the capacity rebuilds the voice pool immediately, so any clip using a voice restarts its WSOLA state.

A clip keeps the voice it used last block; a new clip takes a free voice, or the voice that has been idle longest — a voice still producing output is never stolen mid-note. If no voice is available, the clip uses the `'repitch'` path for that block and the overflow counter increments. A source with more than two channels also uses `'repitch'` because it cannot fit the stretcher state. The counter is monotonic within a prepared session and resets on `prepare`. A seek, a loop wrap, or a voice reassignment restarts the stretcher stream at the new position, so the join is a clean start rather than a smear of the previous one.

### What a page underrun looks like

A paged clip reads its samples from the provider on the audio thread. When the page holding a sample is not resident, the read is a **page miss**: that clip contributes silence for that sample, every other clip and instrument renders as usual, and the transport keeps rolling — the engine never stalls waiting for storage. The miss is queued as a page request for the host to serve, and it is reported once per block on `drainTelemetry()` as error `ClipPageUnderrun` (ordinal `15`, `CLIP_PAGE_UNDERRUN` in Python) with `value` set to the clip id. That record is the dropout signal.

To keep the record from ever appearing, the player also asks for the pages it is *about to* read: by default the half second of timeline ahead of each block, through the same request queue. The window, its setter and how it interacts with the JS-side streaming window are on [Lookahead](./wasm-streaming.md#lookahead). A request does not say whether it was a miss or a lookahead — only the telemetry record marks a miss — so serve every request promptly. If the bounded request queue fills, `clipPageRequestOverflowCount()` rises; the dropped pages are asked for again on the following block, but every block that arrives before they are served is a block of silence.

::: warning Recognising a paging dropout
A gap in one clip that lines up with a `ClipPageUnderrun` record is the host supplying a page after the playhead reached it. Check `clipPageRequestOverflowCount()` first — a rising value means requests are being dropped — then widen the lookahead or the streamer's read-ahead window. A dropout with **no** such record is not a paging problem; look at `droppedRecords`, command-queue overflow, or the block budget instead.
:::

## Surround group buses and wide meters

A bus declared with a surround `channelLayout` (`SonareChannelLayout`: `0` mono, `1` stereo, `2` 5.1, `3` 7.1) becomes a **surround group bus**: it sums into the master plane-by-plane and exposes per-plane meters. A lane routed to it is folded to a point source, then placed from its strip [`surroundPan`](./mixing.md#surround-and-multichannel) values. `azimuth`, `divergence`, and `lfe` are active; `elevation` and `distance` are reserved. The [mixer graph and project bounce](./project-bounce.md#bounce-options) render a surround bus at the same width and follow the same rules; only the standalone `Mixer` (`processStereo`) stays stereo-only.

A strip fed by a surround bus — the return strip on the far side of a bus output or send — runs at the bus's own width rather than folding it to stereo and re-scattering it: its fader, inserts and sends all act on every plane, and only a strip with a stereo (or narrower) main output keeps its pan and width stages. A destination narrower than a bus's width — another bus, the master at its rendered channel count, or a sidechain key tap, which is always stereo — receives an [ITU-R BS.775](https://www.itu.int/rec/R-REC-BS.775) downmix rather than the front pair alone; a wider destination receives the source planes on their own indices unchanged. A surround bus, and the master when it is built wider than stereo, refuses a non-default pan or width for the same reason it already refused pan — there is no stereo image on a speaker bed to narrow, widen, or move.

```typescript
engine.setTrackBuses([{ busId: 1, channelLayout: 2 }]);  // a 5.1 group bus
engine.setTrackLanes([{ trackId: 1, outputBusId: 1 }]);  // route the lane into it
engine.setTrackStripJson(1, JSON.stringify({
  strips: [{ id: 'source', surroundPan: { azimuth: -30, divergence: 0, lfe: 0 } }], buses: [], connections: [],
}));
```

A track lane's `sourceChannelLayout` must be stereo (the default): `setTrackLanes` refuses a mono, 5.1, or 7.1 layout (`RangeError` in WASM, `InvalidParameter` elsewhere) because lane audio is always folded from stereo to a point source before surround placement. A C caller zero-initializing `SonareEngineTrackLane` reads as mono and must set `SONARE_CHANNEL_LAYOUT_STEREO`.

Move a lane's placement live with `setTrackStripSurroundPan(trackId, { azimuth, divergence, lfe })` (on `RealtimeEngine` and, with a track id or name, on the `SonareEngine` worklet facade). Omitted fields default to a centered point source, a non-finite field or a track without a lane strip throws, and the placement glides with a time constant of about 5 ms rather than clicking, holding total power constant through the move.

Output plane order is the canonical `L R C LFE Ls Rs` for 5.1 and `L R C LFE Ls Rs Lss Rss` for 7.1. A `SonareEngine` with `channelCount` 6 or 8 renders that many planes, but the Web Audio default destination is 2-channel `'speakers'`, so the browser mixes them down to stereo unless the app first raises `audioContext.destination.channelCount` (up to `destination.maxChannelCount`). The interpretation only matters while the counts differ: `'speakers'` has defined down-mixes for mono, stereo, quad and 5.1 sources and falls back to `'discrete'` for any other count such as 8, and `'discrete'` copies the leading planes and drops the rest. With equal counts the planes pass through unchanged in either mode.

Set `outputBusId: 0` in `setTrackLanes`, or call `setTrackOutputBus(1, 0)` (on the raw engine and on the `SonareEngine` facade alike), to fold the lane back onto the master mix.

On a main-thread or offline engine, read surround meters with `drainMeterTelemetryWide(maxRecords?)`, which returns per-plane (wide) records and treats a stereo target's left and right as planes 0 and 1; it is the one meter drain, and `drainMeterTelemetry()` stays the stereo fast path. The drains pop the same single-consumer telemetry queue, so call only one per engine instance; running two on one engine makes their records starve each other.

In an AudioWorklet, the `SonareEngine` meter snapshot of a target wider than stereo keeps its stereo fields and adds `channelCount` plus the per-channel arrays `peakDb`, `rmsDb`, `truePeakDb`, and `inputPeakDb`, on both the postMessage and the SharedArrayBuffer ring paths. The worklet keeps its meter interval per target, so one target's records never delay another's.

## MIDI clip scheduling and `sampleAtPpq`

Audio clips have the clip schedule and page providers; **MIDI clips** have their own realtime schedule. `setMidiClips(clips)` replaces the engine's whole MIDI clip schedule in one call, and each clip routes its events to a MIDI **destination id** — the instrument bound with `setBuiltinInstrument`, `setSynthInstrument`, or `setSf2Instrument` (see [MIDI Input](./midi-input.md) for the destination model).

The schedule is *compiled*: timing is in **absolute samples on the engine timeline**, not PPQ. Use `sampleAtPpq(ppq)` to convert musical positions through the engine's tempo map — it integrates every `setTempo` / `setTempoSegments` change, so the result stays correct across tempo ramps.

`setTempoSegments([{ startPpq, bpm, endBpm? }, ...])` and `setTimeSignatureSegments([{ startPpq, numerator, denominator }, ...])` install a piecewise map on the control thread. A non-zero `endBpm` ramps from that segment's `bpm`; pass an empty array to clear the map and return to the most recent single value set with `setTempo` or `setTimeSignature`.

```typescript
// UMP MIDI 1.0 channel-voice words (note-on = status 0x9, note-off = 0x8).
const noteOn  = (ch: number, note: number, vel: number) =>
  (0x2 << 28) | (0x9 << 20) | (ch << 16) | (note << 8) | vel;
const noteOff = (ch: number, note: number) =>
  (0x2 << 28) | (0x8 << 20) | (ch << 16) | (note << 8);

const start = engine.sampleAtPpq(8);                  // tempo-map-aware
const length = engine.sampleAtPpq(16) - start;

engine.setMidiClips([{
  id: 1, trackId: 1,
  destinationId: 0,            // the instrument destination that renders these events
  startSample: start, startPpq: 8,
  lengthSamples: length, loop: true, loopLengthSamples: length,
  events: [
    // renderFrame is an absolute engine-timeline sample; wordCount is inferred
    // from word0 for one-word MIDI 1.0 events.
    { renderFrame: start,                          word0: noteOn(0, 60, 100) },
    { renderFrame: start + Math.floor(length / 2), word0: noteOff(0, 60) },
  ],
}]);
```

Looping clips repeat their event list every `loopLengthSamples`. To clear the schedule, call `setMidiClips([])`. If you work at the *project* level instead (notes in PPQ, takes, comping), build the arrangement with [Project Editing](./project-editing.md) and bounce it — this realtime schedule is the lower-level API a DAW front end compiles into.

A clip carries `gain` (linear, default `1`), `fadeInSamples` and `fadeOutSamples` (default `0`, over the clip's full length rather than per loop repeat), applied to the destination's rendered instrument output rather than to the events themselves — note timing and velocity are unaffected. Per destination, the envelope follows the most recently started active clip. When that clip ends, an older clip that is still active takes over; only when none is active does the destination hold the most recently ended clip's end value (`0` after a fade-out, its `gain` otherwise). If clips start together, the larger clip id wins. Before any clip on a destination has started, the destination plays at unity. Several tracks routed to the same destination share this envelope — the selected clip governs the whole destination, not one clip per track. `fadeOutSamples` above `0` is rejected when `lengthSamples` is `0` (open-ended): a clip with no end has nothing to fade toward. A zero-initialized `SonareEngineMidiClipSchedule` on the C ABI is silent (`gain` reads `0`); the JS and Python bindings default an omitted `gain` to `1` instead.

### Replacing an instrument during playback

Rebinding or clearing a destination's instrument takes effect while the transport rolls, on the raw engine and the `SonareEngine` facade alike. The calls are `setBuiltinInstrument`, `setSynthInstrument`, `setSf2Instrument`, `loadSoundFont`, `setMidiFx`, and `clearMidiFx`.

| Part | Behavior |
|------|----------|
| Outgoing instrument | Fades out over 10 ms instead of being cut at a block boundary. You may destroy it as soon as the call returns. |
| Incoming instrument | Starts from its default channel state. The engine does not replay program, bank, or controller state, so resend what the new instrument needs after the change. |
| Tail length | `tailSamples()` is a conservative upper bound on the longest audible tail. Size a bounce or freeze from it, not from the 10 ms fade. |

## Running the engine in an AudioWorklet

The regular WASM package exposes this `RealtimeEngine` class directly. To run it on the realtime audio thread, the worklet bridge hosts the same embind-backed engine inside `AudioWorkletGlobalScope`, and the higher-level `SonareEngine` facade mirrors nearly the whole engine surface to the worklet through control messages. See [Realtime and Streaming — AudioWorklet notes](./realtime-streaming.md#audioworklet-notes) for the bridge setup, the `SonareEngine` facade table, and worklet-side scope snapshots.

## Related

- [Realtime and Streaming](./realtime-streaming.md) — `StreamAnalyzer`, tempograms, the AudioWorklet bridge, paged clip streaming, and waveform peaks
- [Mixing Engine](./mixing.md) — the standalone strip/bus/send mixer this engine's lane mixer shares its strip model with
- [MIDI Input](./midi-input.md) · [Recording and Takes](./recording-and-takes.md) — live MIDI into the engine, and capturing what it plays
