---
title: Realtime Engine
description: The libsonare RealtimeEngine reference — transport and telemetry, the realtime-safe lane mixer, group routing and sidechains, parameter automation, surround group buses with wide meters, sample-accurate MIDI clip scheduling, and routing a track to external MIDI gear.
---

# Realtime Engine

`RealtimeEngine` is libsonare's transport and playback engine: sample-accurate commands for parameters and transport, a per-track lane mixer (lanes, buses, sends, channel strips), MIDI clip scheduling, group routing and sidechains, surround group buses, capture, offline bounce, freeze, and telemetry. Use it when clips, MIDI, transport, and mixed audio are the *output* — a DAW-like timeline or an instrument host.

For the streaming analyzer (`StreamAnalyzer`), tempograms, the AudioWorklet bridge, paged clip audio streaming, and display waveform peaks, see [Realtime and Streaming](./realtime-streaming.md).

::: warning Check the engine ABI before constructing
`engineCapabilities().abiCompatible` confirms the loaded WASM matches the JS package's expected engine ABI. The realtime engine is the most version-sensitive API in the library; constructing it against a mismatched binary is undefined. Guard with the check below; if it fails, update your `@libraz/libsonare` package so the WASM binary and JS package come from the same release.
:::

## Transport and output

`RealtimeEngine` exposes sample-accurate commands for parameters and transport, plus offline render helpers for non-realtime export.

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

## Track lanes, buses, and channel strips

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

## Group routing, sidechains, and live strip controls

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

## Parameter automation

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

## Surround group buses and wide meters

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

## MIDI clip scheduling and `sampleAtPpq`

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

## Sending a track to external MIDI gear

An **internal destination** renders MIDI through a NativeSynth/SF2 instrument inside libsonare. An **external destination** skips that instrument and places MIDI 1.0 byte messages in an output queue for your host to send to hardware or another application. libsonare prepares and timestamps the messages; opening the OS/Web MIDI port remains the host's job.

Mark the destination, process audio as usual, then drain the output queue frequently. The raw-engine methods carry the same names across bindings — camelCase in Browser and Node, snake_case in Python:

::: code-group

```typescript [Browser]
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

```typescript [Node]
// Node exposes the same camelCase raw-engine methods as WASM.
engine.setMidiDestinationExternal(2, true);
engine.setExternalMidiClockEnabled(true);

engine.process([leftBlock, rightBlock]);
for (const event of engine.drainExternalMidi(256)) {
  if (event.destinationId === 0xffffffff) {
    // Forward clock/transport to every open hardware port.
    for (const port of externalPorts.values()) port.sendMessage([...event.bytes]);
  } else {
    externalPorts.get(event.destinationId)?.sendMessage([...event.bytes]);
  }
}
```

```python [Python]
engine.set_midi_destination_external(2, True)  # destination 2 drives external gear
engine.set_external_midi_clock_enabled(True)   # optional: clock + start/continue/stop

engine.process([left_block, right_block])
for event in engine.drain_external_midi(256):
    if event.destination_id == 0xFFFFFFFF:
        # Broadcast clock/transport to every open hardware port.
        for port in external_ports.values():
            port.send_message(list(event.bytes))
    else:
        port = external_ports.get(event.destination_id)
        if port is not None:
            port.send_message(list(event.bytes))

# Advisory: a rising count means the queue filled before the host drained it.
dropped = engine.external_midi_dropped_count()
```

:::

Each event contains `destinationId`, `renderFrame`, and `bytes` (one lowered MIDI 1.0 message of 1–3 bytes; snake_case `destination_id` / `render_frame` in Python). Clock and transport messages use the sentinel destination `0xFFFFFFFF`; channel messages retain their destination id. `maxRecords` limits the returned messages, not source events, and any remainder stays queued for the next drain. Check `externalMidiDroppedCount()` (`external_midi_dropped_count()` in Python) — a rising value means the fixed-capacity realtime queue filled before the host drained it.

With the `SonareEngine` AudioWorklet facade (browser-only), use `setMidiDestinationExternal(trackId, true)` and subscribe with `onMidiOut(callback)`. The worklet already drains its engine once per render block and posts batches to the main thread, so do not try to call the raw drain as a second consumer:

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

## Running the engine in an AudioWorklet

The regular WASM package exposes this `RealtimeEngine` class directly. To run it on the realtime audio thread, the worklet bridge hosts the same embind-backed engine inside `AudioWorkletGlobalScope`, and the higher-level `SonareEngine` facade mirrors nearly the whole engine surface to the worklet through control messages. See [Realtime and Streaming — AudioWorklet notes](./realtime-streaming.md#audioworklet-notes) for the bridge setup, the `SonareEngine` facade table, and worklet-side scope snapshots.

## Related

- [Realtime and Streaming](./realtime-streaming.md) — `StreamAnalyzer`, tempograms, the AudioWorklet bridge, paged clip streaming, and waveform peaks
- [Mixing Engine](./mixing.md) — the standalone strip/bus/send mixer this engine's lane mixer shares its strip model with
- [MIDI Input](./midi-input.md) · [Recording and Takes](./recording-and-takes.md) — live MIDI into the engine, and capturing what it plays
