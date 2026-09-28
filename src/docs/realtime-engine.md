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
- schedule audio clips with a warp mode, and recognise a paging dropout when one happens;
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

### Sizing prepare for the real channel count

The constructor and `prepare(...)` take an optional trailing `maxChannels`.
Prepare reserves the capture, instrument, PDC (plugin delay compensation), and
monitor planes for that count rather than always reserving 64, so a stereo host
is not paying for 64 planes of scratch it will never touch.

```typescript
// A stereo host: reserve 2 planes, not 64.
const engine = new RealtimeEngine(48000, 128, /*commandCapacity=*/undefined,
                                  /*telemetryCapacity=*/undefined, /*maxChannels=*/2);

// Or on an already-constructed engine:
engine.prepare(48000, 128, undefined, undefined, 8);   // 7.1 target
```

Set it to the largest channel count you will actually render. Leaving it unset
keeps the previous behaviour.

### Control-only hosts

A host that never calls `process()` — a headless controller, or an offline path
that queues commands and reads state — can drain the command queue explicitly:

```typescript
engine.setTempo(140);
engine.flushControlCommands();   // apply queued commands without rendering
```

`getTransportState()` includes a musical playhead as well as the raw sample and PPQ (musical position in quarter-note units) positions. `barCount` is zero-based, while `beat` is one-based within that bar and `beatFraction` is in `[0, 1)`. A UI can therefore render a conventional bar:beat display without deriving it from PPQ itself:

```typescript
const { barCount, beat, beatFraction } = transport;
const playhead = `${barCount + 1}:${beat}`; // for example, "3:2"
// beatFraction is the progress through that beat; use it for a smooth indicator.
```

Beyond transport, `RealtimeEngine` also registers parameter metadata, sets automation lanes, seeks to markers, configures metronome clicks, processes with monitor output, captures audio, runs offline bounces, and freezes clips. Two telemetry families matter when wiring a UI:

- **Meters** — `drainMeterTelemetry()` for the stereo fast path, and `drainMeterTelemetryWide()` for per-plane records on surround/offline targets.
- **Scopes** — call `configureScopeTelemetry(intervalFrames, bandCount)` once to enable per-target spectrum + vectorscope capture, then read snapshots with `drainScopeTelemetry()`:
  - `intervalFrames` — the minimum render-frame gap between snapshots (`0` disables capture).
  - `bandCount` — the FFT band resolution, clamped to `1..64`; the call returns the band count actually applied.

Each drained scope snapshot is addressed by `targetId` (master, a lane, or a bus) and carries two arrays: `bands` holds the linear-band FFT magnitudes in dB (length = the applied band count), and `points` holds up to 32 stereo goniometer samples as `{ left, right }` records for a vectorscope display. (The worklet scope ring buffer carries the same cloud in its own interleaved `[l0, r0, l1, r1, …]` `Float32Array` form.) Band levels scale with the render block size — roughly −3 dB per doubling of the block — so compare snapshots only within one fixed block size.

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

The engine carries its own realtime-safe **lane mixer**, so a playback engine can mix the tracks it plays without a second mixing pass. Each track occupies a **lane**; lanes can feed **aux sends** into numbered **buses**; and tracks, buses, and the master each own a full **channel strip** — the same strip model (EQ, inserts, fader, pan, sends) as the [Mixing Engine](./mixing.md). Plugin delay compensation (PDC) is recomputed automatically whenever the lane layout is republished.

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
Once a track id occupies a lane, its lane index stays fixed for the engine's lifetime. Each `setTrackLanes(...)` call must list the already-declared lane ids in their current order and may only append new track ids after them. On the raw `RealtimeEngine`, every call rebuilds each lane's sends from scratch from whatever `sends` array that lane's entry passed — omitting `sends` (including a bare id) clears that lane's sends rather than leaving them untouched. The `SonareEngine` worklet facade is the one that preserves sends on omission: it keeps its own JS-side send cache and resends the full list underneath on every call. `setSoloMute` addresses lanes by that fixed index.
:::

::: warning Structural strip calls belong on the control thread
`setTrackLanes`, `setTrackBuses`, and the strip JSON setters build internal structures and must not run concurrently with `process(...)` — issue them between renders or while stopped. The lightweight live controls are `setSoloMute` (queued sample-accurately) and the EQ-band updates, which mutate one band in place.
:::

### A bus insert chain sees the summed signal, once

Clip audio and hosted-instrument audio are two contributors to the same buses, and they are aggregated into one block before any strip, send, or bus chain runs. A bus insert chain therefore processes the **sum** of its contributors exactly once per block. That is what a non-linear insert needs: a compressor or a saturator run separately over the clip contribution and again over the instrument contribution acts on two partial signals, which is not the same thing as acting on the summed bus, and a reverb would advance its tail twice per block.

Two conditions open that merged block. Plugin delay compensation must be inactive — with PDC in play the clip bus is rendered into its own scratch buffer and delayed so it lands phase-aligned with the internally-delayed instruments, so those buses genuinely belong to that separate pass. And the instrument rack must be non-empty, since there is nothing to merge otherwise.

::: info Solo and mute ramps take their full time
Because each lane is finished once per block, its fader, pan, and gate smoothers advance once per block too. The gate — the smoother behind solo and mute — has a **10 ms** time constant, against **5 ms** for the pan smoother, so a solo or mute change is a short audible ramp rather than a step. This is unrelated to `setParamSmoothingMs`, which sets the default glide for insert-parameter and fader automation and defaults to 20 ms.
:::

<SonareDemo id="engine-lane-mixer" />

## Track monitor taps: off, PFL, and AFL

Each configured track lane can contribute to a separate cue/monitor bus. Queue a
mode with `setTrackMonitorMode(laneIndex, mode, renderFrame?)`; `laneIndex` is
the fixed, append-only index from `setTrackLanes`, `renderFrame` defaults to
`-1` (the next block head), and `mode` accepts `'off'`, `'pfl'`, or `'afl'`
(or ordinals `0`, `1`, and `2`).

- **off** — the lane contributes nothing to the monitor bus.
- **PFL** (pre-fader listen) — taps after the lane strip and its plugin-delay
  compensation, but before the lane fader, gate, and pan. It remains audible
  there when the lane is muted or solo-gated.
- **AFL** (after-fader listen) — taps after the fader, gate, and pan. For a
  surround lane it is after fader/gate and the surround plane placement; stereo
  AFL is post-pan.

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

The monitor bus sums every lane with a PFL/AFL tap. The ordinary `process(...)`
path folds that bus into the main output for compatibility. Use
`processWithMonitor(...)` when the program output and cue output must stay
separate:

```typescript
engine.setTrackMonitorMode(0, 'pfl');
const { output, monitor } = engine.processWithMonitor([leftBlock, rightBlock]);
engine.setTrackMonitorMode(0, 'off');
```

WASM and Node return `{ output, monitor }`; Python uses
`set_track_monitor_mode(0, 'afl')` and receives `(output, monitor)` from
`process_with_monitor(...)`. The C entry points are
`sonare_engine_set_track_monitor_mode` and `sonare_engine_process_with_monitor`.

## Group routing, sidechains, and live strip controls

Beyond the lane/send graph, a few realtime-safe controls reshape routing and pan without rebuilding a strip:

| Goal | Raw `RealtimeEngine` | `SonareEngine` worklet API |
|------|----------------------|-------------------------------|
| Fold a lane into a group bus (or pass `busId 0` to restore it to the master mix) | lane `outputBusId` in `setTrackLanes(...)` (`0` or absent = master mix) | `setTrackOutputBus(target, busId)` (`busId 0` restores the master mix) |
| Fold a bus into another bus, or send it a copy | bus `outputBusId` and `sends` in `setTrackBuses(...)` (`0`/absent output = master mix) | same fields on `setTrackBuses(...)` |
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

```typescript
// Route bus 2's output into bus 1, with a pre-fader send to the same bus,
// then duck bus 1's compressor off bus 2's own signal.
engine.setTrackBuses([
  { busId: 1, gainDb: 0 },
  { busId: 2, gainDb: -6, outputBusId: 1, sends: [{ busId: 1, levelDb: -12, sendTiming: 'preFader' }] },
]);
engine.setBusSidechain(1, 0, 'bus', 2);   // insert 0 on bus 1, keyed from bus 2
engine.setMasterSidechain(0, 'track', 1); // insert 0 on the master, keyed from track 1
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

// Or set it imperatively from the control thread (renderFrame -1 = immediate):
engine.setParameter(1, 0.5);
```

On the `SonareEngine` worklet API you can also automate a mixer fader/pan without registering a parameter: `automationParamId(target, 'faderDb' | 'pan')` and `busAutomationParamId(busId)` return reserved engine parameter ids in the mixer namespace, so you can pass them straight to `setAutomationLane(paramId, points)` to automate a track or master fader or pan, or a bus fader (a bus id resolves to its fader gain in dB). The `target`/`busId` declares the mixer lane/bus on first use.

Insert parameters use the same automation-lane mechanism, but first need a reserved id. Call `resolveTrackInsertAutomationId(trackId, insertIndex, paramName)`, `resolveMasterInsertAutomationId(...)`, or `resolveBusInsertAutomationId(...)`, then pass the returned id to `setAutomationLane`, `setParameter`, or `setParameterSmoothed`. `insertIndex` addresses the strip's combined pre-then-post insert sequence, and `paramName` is the JSON key reported by `masteringInsertParamInfo`. WASM/Node return `-1` for an unknown strip, insert, or key; Python raises `SonareError`.

The strip-insert processors — `eq.*`, `dynamics.*`, `saturation.*`, `spectral.*`, `stereo.*`, `maximizer.*`, and `multiband.*` — all resolve through these methods and can be driven at audio-block precision. Whole-signal mastering stages (`repair.*`, `loudness`, and match stages) have no insert form or automation id: they buffer the full signal and do not run on the realtime path.

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
engine.setSynthInstrument(0, patch);

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

::: warning Python takes the arguments in the opposite order
WASM and Node spell this `resolveInstrumentAutomationId(destinationId, paramName)` — destination first. Python spells it `resolve_instrument_automation_id(param_name, destination_id=0)` — **name first**, with the destination defaulting to `0`. Passing a destination id where the name belongs raises rather than resolving, so the mistake surfaces immediately, but it is worth checking once when porting a host between the two.
:::

The id encodes the destination slot as well as the parameter, so it survives an unbind and rebind of the *same* `destination_id` and simply applies nothing while that destination has no instrument bound. Structural fields — preset, engine mode, waveform, filter model, unison, polyphony — are not automatable: they resize voice pools or swap DSP topology, which is not audio-thread safe. Rebind the instrument with a new patch instead.

The engine holds **32** instrument-automation slots; once they are claimed, further resolutions fail rather than retargeting an existing lane. Resolution returns `-1` on WASM and Node — or `SONARE_ERROR_INVALID_PARAMETER` at the C entry point `sonare_engine_resolve_instrument_automation_id` — when the key is unknown, no instrument is bound to that destination, the instrument exposes no automatable parameters, or the slot table is full. Always check the returned id before handing it to a lane. In a build without the arrangement subsystem the C entry point returns `SONARE_ERROR_NOT_SUPPORTED`, and that build reports `instrumentParamAutomation: false` in its capability JSON — the way a host detects up front that the resolver will not answer. See [`capabilities()`](./js-api.md#capabilities).

`setParamSmoothingMs(ms)` changes the default glide used by smoothed fader/pan changes, insert-parameter automation, and MIDI-CC mappings. The default is `20` ms; `0` makes changes immediate. Set it once from the control thread before playback unless your host intentionally changes the global feel of automation.

### How a lane plays back

A lane is a breakpoint curve, not a list of scheduled jumps. Each point is `{ ppq, value, curveToNext? }`, and a point's `curveToNext` shapes the segment that leads to the *next* point:

| `curveToNext` | Segment to the next point |
|---------------|---------------------------|
| `0` linear | a straight line between the two values |
| `1` exponential | interpolated in the log domain, so a gain or frequency sweep sounds even; two values of opposite sign fall back to linear |
| `2` hold | keeps this point's value until the next point, then steps |
| `3` s-curve | eases out of this point and into the next (smoothstep) |

Outside the curve the lane is flat: before the first point it returns the first value, after the last point the last value, and nothing extrapolates. Points are sorted by `ppq` on receipt, and two points at the same `ppq` collapse to the first one you supplied — an instantaneous jump is a `hold` segment (or a second point placed a hair later), not two coincident points. A non-finite `ppq` or `value`, or a curve code outside `0..3`, is rejected as `InvalidParameter` rather than clamped.

The audio thread samples the curve at every breakpoint — the block is split there, so a breakpoint lands on its exact frame — and every **64 frames** in between, widened only for blocks so large that the fixed boundary list would overflow. Each sampled value goes to the target the way a live `setParameter` would: mixer fader, pan and bus gain, insert parameters and instrument parameters run through their smoothers (`setParamSmoothingMs` governs the insert and instrument ones), so a step in the curve is a short glide; a parameter registered with `addParameter` is set directly and steps. A block holding more breakpoints than the boundary list can carry is reported as `BoundaryOverflow`, and the surplus breakpoints apply at the next 64-frame boundary instead of their own frame.

**Writing a lane while audio is running does not glitch.** `setAutomationLane(id, points)` replaces the lane for that one id and leaves the others in place. The control thread builds the new lane set and publishes it; the audio thread adopts the newest set once, at the start of its next block — never mid-block, never with a lock or an allocation. What *can* be audible is the value you wrote: if the new curve differs from the old one at the current playhead, the target moves to the new value at the next sub-block — a glide on a smoothed target, a step on a directly-set one. A lane aimed at an id nothing is bound to is skipped and reported on `drainTelemetry()` as `UnknownTarget`; a parameter registered with `rtSafe: false` is refused up front (WASM and Node throw `SonareError`, the C entry point returns `SONARE_ERROR_INVALID_PARAMETER`).

To clear a lane, pass an empty point list: `setAutomationLane(id, [])`. After the audio thread adopts the clear, the target restores the last value sent through `setParameter` or `setParameterSmoothed`. If no manual value was ever sent for that id, the current value remains unchanged. The result is the same regardless of whether the manual write or the lane clear reaches the audio thread first. Python passes `[]`; the C API uses `point_count == 0`.

## Audio clips: warp mode and page underruns

`setClips(clips)` replaces the engine's whole audio clip schedule in one call, on the control thread. A clip is either **direct** (`channels`: one `Float32Array` per channel) or **paged** (`pageProvider`: a provider the host feeds page by page — see [Paged clip audio streaming](./realtime-streaming.md#paged-clip-audio-streaming)); `startPpq` places it, `lengthSamples`, `clipOffsetSamples`, `loop`, `gain` and the fade lengths shape it, and `warpMode` plus `warpAnchors` decide how it follows the tempo map. Python spells the same call `set_clips` with `warp_mode`.

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

Anchors must be finite, non-negative and strictly increasing on both axes, or the call is rejected. `'repitch'` and `'time-stretch'` read the same anchor map on the audio thread; with fewer than two anchors both play the clip at its native rate, under either mode the map alone decides the source position (`clipOffsetSamples` is not added on top), and the loop-seam crossfade is not applied. `'tempo-sync'` is different in kind on the raw engine: the stretched audio is baked when `setClips` runs, so a tempo-sync clip cannot be paged, cannot `loop`, and must keep `clipOffsetSamples` inside the source — each is rejected as `InvalidParameter`. What the modes mean musically, and when to prefer one, is on [Warp and Tempo Sync](./glossary/arrangement/warp-and-tempo.md).

### The `'time-stretch'` voice budget

A `'time-stretch'` clip borrows one preallocated stretcher voice for each block it renders. The pool capacity is **8** by default, and each voice handles up to **two** channels. Set it from the control thread with `setWarpVoiceCapacity(voices)` and read it with `warpVoiceCapacity()`; Python uses `set_warp_voice_capacity()` and `warp_voice_capacity()`, while C uses `sonare_engine_set_warp_voice_capacity()` and `sonare_engine_warp_voice_capacity()`. The accepted range is **0..64**. A value above 64 is rejected and leaves the previous capacity unchanged. Capacity **0** disables time-stretch for these clips: they use the `'repitch'` path, and those fallbacks do not increment `warpStretchOverflowCount()` (`warp_stretch_overflow_count()` in Python, `sonare_engine_warp_stretch_overflow_count()` in C). When the engine is already prepared, changing the capacity rebuilds the voice pool immediately, so any clip using a voice restarts its WSOLA state.

A clip keeps the voice it used last block; a new clip takes a free voice, or the voice that has been idle longest — a voice still producing output is never stolen mid-note. If no voice is available, the clip uses the `'repitch'` path for that block and the overflow counter increments. A source with more than two channels also uses `'repitch'` because it cannot fit the stretcher state. The counter is monotonic within a prepared session and resets on `prepare`. A seek, a loop wrap, or a voice reassignment restarts the stretcher stream at the new position, so the join is a clean start rather than a smear of the previous one.

### What a page underrun looks like

A paged clip reads its samples from the provider on the audio thread. When the page holding a sample is not resident, the read is a **page miss**: that clip contributes silence for that sample, every other clip and instrument renders as usual, and the transport keeps rolling — the engine never stalls waiting for storage. The miss is queued as a page request for the host to serve, and it is reported once per block on `drainTelemetry()` as error `ClipPageUnderrun` (ordinal `15`, `CLIP_PAGE_UNDERRUN` in Python) with `value` set to the clip id. That record is the dropout signal.

To keep the record from ever appearing, the player also asks for the pages it is *about to* read: by default the half second of timeline ahead of each block, through the same request queue. The window, its setter and how it interacts with the JS-side streaming window are on [Look-ahead](./realtime-streaming.md#look-ahead). A request does not say whether it was a miss or a look-ahead — only the telemetry record marks a miss — so serve every request promptly. If the bounded request queue fills, `clipPageRequestOverflowCount()` rises; the dropped pages are asked for again on the following block, but every block that arrives before they are served is a block of silence.

::: warning Recognising a paging dropout
A gap in one clip that lines up with a `ClipPageUnderrun` record is the host supplying a page after the playhead reached it. Check `clipPageRequestOverflowCount()` first — a rising value means requests are being dropped — then widen the look-ahead or the streamer's read-ahead window. A dropout with **no** such record is not a paging problem; look at `droppedRecords`, command-queue overflow, or the block budget instead.
:::

## Surround group buses and wide meters

A bus declared with a surround `channelLayout` (`SonareChannelLayout`: `0` mono, `1` stereo, `2` 5.1, `3` 7.1) becomes a **surround group bus**: it sums into the master plane-by-plane and exposes per-plane meters. A lane routed to it is folded to a point source, then placed from its strip [`surroundPan`](./mixing.md#surround-and-multichannel) values. `azimuth`, `divergence`, and `lfe` are active; `elevation` and `distance` are reserved. The [mixer graph and project bounce](./project-bounce.md#bounce-options) render a surround bus at the same width and follow the same rules; only the standalone `Mixer` (`processStereo`) stays stereo-only.

A strip fed by a surround bus — the return strip on the far side of a bus output or send — runs at the bus's own width rather than folding it to stereo and re-scattering it: its fader, inserts and sends all act on every plane, and only a strip with a stereo (or narrower) main output keeps its pan and width stages. A destination narrower than a bus's width — another bus, the master at its rendered channel count, or a sidechain key tap, which is always stereo — receives an [ITU-R BS.775](https://www.itu.int/rec/R-REC-BS.775) downmix rather than the front pair alone; a wider destination receives the source planes on their own indices unchanged. A surround bus, and the master when it is built wider than stereo, refuses a non-default pan or width for the same reason it already refused pan — there is no stereo image on a speaker bed to narrow, widen, or move.

```typescript
engine.setTrackBuses([{ busId: 1, channelLayout: 2 }]);  // a 5.1 group bus
engine.setTrackLanes([{ trackId: 1, outputBusId: 1 }]);  // route the lane into it
engine.setTrackStripJson(1, JSON.stringify({
  strips: [{ id: 'source', surroundPan: { azimuth: -30, divergence: 0, lfe: 0 } }],
  buses: [],
  connections: [],
}));
```

`sourceChannelLayout` on `EngineTrackLane` is currently descriptive/serialized only: the lane render still consumes mono or stereo input and folds stereo to a point source before surround placement. Do not use it as a promise that an existing 5.1/7.1 source stays discrete.

Set `outputBusId: 0` in `setTrackLanes` — or call `setTrackOutputBus(1, 0)` on the `SonareEngine` worklet facade, which owns that method — to fold the lane back onto the master mix.

Surround meters do not travel over the live worklet meter ring. Read them on an offline or main-thread engine with `drainMeterTelemetryWide(maxRecords?)`, which returns per-plane (wide) records; `drainMeterTelemetry()` stays the stereo fast path. The two drains pop the same single-consumer telemetry queue, so call only one per engine instance — the live AudioWorklet path already owns the queue via the stereo drain, which is why `drainMeterTelemetryWide()` is meant for an offline (non-worklet) engine; running both on one engine makes their records starve each other.

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

A clip carries `gain` (linear, default `1`), `fadeInSamples` and `fadeOutSamples` (default `0`, over the clip's full length rather than per loop repeat), applied to the destination's rendered instrument output rather than to the events themselves — note timing and velocity are unaffected. Per destination, the envelope follows the most recently started active clip. When that clip ends, an older clip that is still active takes over; only when none is active does the destination hold the most recently ended clip's end value (`0` after a fade-out, its `gain` otherwise). If clips start together, the larger clip id wins. Before any clip on a destination has started, the destination plays at unity. Several tracks routed to the same destination share this envelope — the selected clip governs the whole destination, not one clip per track. `fadeOutSamples` above `0` is rejected when `lengthSamples` is `0` (open-ended): a clip with no end has nothing to fade toward. A zero-initialized `SonareEngineMidiClipSchedule` on the C ABI is silent (`gain` reads `0`); the JS and Python bindings default an omitted `gain` to `1` instead.

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
