---
title: Recording, Takes & Comping
description: How to capture audio from the libsonare realtime engine, take browser microphone input, record loop takes onto a project clip, comp the best parts across takes, and draw the recorded waveform — with copy-paste recipes.
---

# Recording, Takes & Comping

**This page is about getting live sound into a project and turning many imperfect attempts into one good performance.** **Recording** is capturing live audio — a vocal, a guitar DI (plugged in directly, no amp mic), a synth performance — into a buffer you can keep, edit, and arrange. **Comping** (short for "compilation") is what you do afterwards: you record the same part several times as alternate **takes**, then assemble one keeper by stitching the best moments of each take together — like choosing the best line from each of several photos to build one perfect group shot.

libsonare splits this into two cooperating pieces. The [realtime engine](./realtime-streaming.md) owns the live **capture path** — arming, the capture buffer, input monitoring, and punch in/out (re-record only a chosen region, leaving the rest of the take untouched). The [project model](./project-editing.md) owns the *result* — clips that carry **takes** and **comp segments** that the edit compiler renders into one continuous performance.

::: info Two clocks, two layers
The capture path works in **samples** on the audio thread. The project works in **PPQ** (musical position): one PPQ unit is one quarter note, so at 120 BPM `ppq: 1` lasts 0.5 s. You record in samples, then describe the result in beats. Keep the two straight and everything below falls into place.
:::

::: info Take and comp
A **take** is one recorded attempt. A **comp** is the edited keeper assembled from parts of several takes. In libsonare the original takes stay in the clip; comp segments only choose which take plays over each PPQ range.
:::

::: tip Where recording sits in the pipeline
**Recording** gets audio in. **Editing** fixes its timing and pitch. **Mixing** balances several tracks. **Mastering** polishes the stereo result. This page covers the first step and the comping work that turns a pile of takes into one usable clip — then hands off to [Project Editing](./project-editing.md).
:::

## From microphone to comped clip

Recording crosses the realtime layer and the project layer. The engine captures samples; the project stores those samples as takes and comp instructions.

```mermaid
flowchart LR
  A[Microphone or engine output] --> B[RealtimeEngine capture buffer]
  B --> C[capturedAudio()]
  C --> D[Project.addLoopRecordingTakes]
  D --> E[Clip takes]
  E --> F[Comp segments]
  F --> G[compile() / bounce()]
```

Do not put `Project` editing calls in the audio callback. Capture in the realtime engine first, then update the project from the main/control thread after the take is finished.

## What You Will Learn

By the end of this page you should be able to:

- size and arm the engine's capture buffer, pick a capture source, and read captured audio back;
- compensate for round-trip latency with a record offset and hear yourself with input monitoring;
- punch in and out so only a chosen region is recorded;
- open a browser microphone with `bindMicrophoneInput` and clean it up correctly;
- split a captured loop into takes with `addLoopRecordingTakes`, then comp across takes with `setClipTakes` / `setClipCompSegments`;
- draw the recorded waveform with `waveformPeaks` and `waveformPeakPyramid`.

## The capture path

The realtime engine records into a **capture buffer** you allocate up front. Nothing is captured until you both allocate the buffer and **arm** capture; each `process(...)` block then appends to it while armed.

The engine runs in Node, so the whole capture path below is testable outside the browser. Only the microphone section needs a browser.

```typescript
import { init, RealtimeEngine } from '@libraz/libsonare';

await init();

const sampleRate = 48000;
const engine = new RealtimeEngine(sampleRate, /* maxBlockSize */ 128);
try {
  engine.setCaptureBuffer(/* numChannels */ 2, /* capacityFrames */ sampleRate * 10); // room for 10 s
  engine.armCapture();           // start appending on the next processed block
  engine.play();

  // Drive the engine block by block (in a real app this is your audio callback).
  engine.process([blockL, blockR]);

  const status = engine.captureStatus();
  // { capturedFrames, overflowCount, armed, punchEnabled, source, recordOffsetSamples }

  const channels = engine.capturedAudio(); // Float32Array[] — one array per channel
} finally {
  engine.destroy();              // the WASM handle is NOT garbage-collected — always release it
}
```

::: danger Always release the engine
`RealtimeEngine`, like every embind object, holds a WASM heap handle the JavaScript garbage collector cannot reclaim. Call `engine.destroy()` in a `finally` block. Leaking handles slowly exhausts WASM memory in long sessions.
:::

### Sizing the capture buffer

`setCaptureBuffer(numChannels, capacityFrames)` pre-allocates the recording so the audio thread never allocates mid-take. Size it for the longest take you expect: `capacityFrames = seconds * sampleRate`. When a take runs past the capacity the engine stops appending and counts the dropped frames in `captureStatus().overflowCount` — a non-zero count means you ran out of room, so allocate a larger buffer.

### Arming and capture status

`armCapture(armed?)` toggles recording. Call it with no argument (or `true`) to arm, and `armCapture(false)` to stop appending without discarding what you have. `resetCapture()` clears the captured frames back to zero so the next take starts fresh. Read progress any time with `captureStatus()`:

| Field | Tells you |
|-------|-----------|
| `capturedFrames` | How many frames are recorded so far |
| `overflowCount` | Frames dropped because the buffer was full (0 is healthy) |
| `armed` | Whether the engine is currently appending |
| `punchEnabled` | Whether a punch in/out region is active |
| `source` | `'output'` or `'input'` — what is being captured |
| `recordOffsetSamples` | The active record-offset compensation |

### Capture source: output bus vs live input

`setCaptureSource('output' | 'input')` chooses *what* the engine records:

- **`'output'`** (the default) captures the engine's rendered output bus — what you would hear, including any clips and instruments the engine is playing. Use it to bounce a live performance of the arrangement.
- **`'input'`** captures the raw audio you pass into `process(...)` — the live signal from a microphone or instrument. Use it to track a new part.

### Record-offset compensation

A live monitoring chain has latency: by the time a player hears the click and plays a note, the engine has already advanced. `setRecordOffsetSamples(offsetSamples)` shifts the captured audio to line it back up with the timeline. A negative offset pulls the recording earlier (the usual direction, to undo round-trip latency); the active value is echoed back in `captureStatus().recordOffsetSamples`.

### Input monitoring

`setInputMonitor(enabled, gain?)` decides whether the live input is mixed into the engine's output so the performer can hear themselves. `setInputMonitor(true, 0.5)` passes the input through at half level; `setInputMonitor(false)` records silently (useful when the performer monitors through hardware to avoid double-monitoring latency). Monitoring is independent of the capture source — you can monitor the input while capturing the output bus, or vice versa.

### Punch in/out

Punch recording arms capture only inside a chosen timeline region, so a fixed take is left untouched outside it. `setCapturePunch(startSample, endSample, enabled?)` sets the in/out points in timeline samples; while `punchEnabled` is true the engine appends only when the transport (the moving play position) is inside `[startSample, endSample)`. Pass `enabled: false` (or `resetCapture()`) to clear the region and return to free recording.

:::: details Track a part, then read it back
```typescript
const engine = new RealtimeEngine(48000, 128);
try {
  engine.setCaptureBuffer(1, 48000 * 8);   // mono, up to 8 s
  engine.setCaptureSource('input');         // record the live signal, not the mix
  engine.setRecordOffsetSamples(-256);      // undo ~256 frames of monitoring latency
  engine.setInputMonitor(true, 1.0);        // let the player hear themselves
  engine.armCapture();
  engine.play();

  // ... feed live input blocks via engine.process([micBlock]) ...

  const [mono] = engine.capturedAudio();    // the recorded take as a Float32Array
} finally {
  engine.destroy();
}
```
::::

## Browser microphone input

In the browser, `bindMicrophoneInput(audioContext, engine, options?)` wires a `getUserMedia` microphone stream into a realtime engine node and returns a binding you can close. It is **browser-only** — it needs a live `AudioContext` and the WebAudio graph — and runs without `SharedArrayBuffer` (no COOP/COEP headers required).

```typescript
// Browser only — runs inside a page with a live AudioContext.
const binding = await bindMicrophoneInput(audioContext, engineNode, {
  // Any MediaStreamConstraints field is forwarded to getUserMedia:
  audio: { echoCancellation: false, noiseSuppression: false, channelCount: 1 },
  // Optionally reuse a stream you already opened:
  // stream: existingMediaStream,
  stopTracksOnClose: true,   // default; stop the mic tracks when you close the binding
});

// binding.stream  -> the live MediaStream
// binding.source  -> the MediaStreamAudioSourceNode feeding the engine

// When the take is done:
binding.close();             // disconnects the source (and stops tracks if stopTracksOnClose)
```

The options object **extends `MediaStreamConstraints`**, so any constraint you would pass to `getUserMedia` (the `audio` object with `echoCancellation`, `noiseSuppression`, `channelCount`, a device `deviceId`, …) goes straight through. Two extra fields are libsonare's own:

- **`stream`** — reuse a `MediaStream` you already obtained instead of prompting for a new one.
- **`stopTracksOnClose`** — defaults to `true`. When true, `binding.close()` also stops the underlying microphone tracks, turning off the OS recording indicator. Set it to `false` when you pass a `stream` you own and want to keep using elsewhere.

::: warning Close the binding when you are done
`binding.close()` disconnects the source node so the microphone stops feeding the engine. Pair every `bindMicrophoneInput` with a `close()` — typically when the user stops recording or the component unmounts. The default also stops microphone tracks so the OS recording indicator goes away; pass `stopTracksOnClose: false` only when another part of your app still needs the same stream.
:::

For the surrounding AudioWorklet plumbing — building the engine node, registering the worklet processor, and the SAB-free realtime path — see [Realtime Streaming](./realtime-streaming.md). To play a synth or sampler *into* the recording instead of an external mic, see [Native Synth](./native-synth.md) and the [SoundFont Player](./soundfont-player.md), and [MIDI Input](./midi-input.md) for driving them live.

## Loop recording into takes

Loop recording cycles the same musical region over and over while you play, capturing one **take** per pass. `Project.addLoopRecordingTakes(desc)` takes the *concatenated* captured audio for all passes and splits it into per-pass takes on a single new clip:

```typescript
import { init, Project } from '@libraz/libsonare';

await init();

const project = new Project();
try {
  const sampleRate = 48000;
  project.setSampleRate(sampleRate);
  const trackId = project.addTrack({ kind: 'audio', name: 'vocal' });

  // A 4-quarter-note loop at 120 BPM lasts 4 * (60 / 120) = 2 s.
  // Three passes therefore need 3 * 2 s of audio.
  const loopLengthQuarters = 4;
  const passes = 3;
  const passSamples = Math.round((loopLengthQuarters * 60 / 120) * sampleRate); // 96000
  const recorded = new Float32Array(passes * passSamples);                       // your concatenated takes

  const result = project.addLoopRecordingTakes({
    trackId,
    startPpq: 0,
    loopLengthPpq: loopLengthQuarters,   // loop length in quarter notes
    audio: recorded,
    audioChannels: 1,
    audioSampleRate: sampleRate,
  });
  // result -> { clipId, takeCount: 3 }
} finally {
  project.delete();
}
```

::: warning Supply enough audio for the takes you claim
`loopLengthPpq` is measured in quarter notes, so its duration depends on tempo: a 4-quarter-note loop is 2 s at 120 BPM but 4 s at 60 BPM. Set the project tempo first, work out the per-pass sample count from it, and supply `passes * passSamples` frames. Hand in less and you simply get fewer takes than you expected.
:::

The call adds one clip whose alternate takes are the loop passes, and sets the **active take** to the last full pass. From here you comp across those takes.

## Takes and comp segments

A clip can carry an ordered list of **takes** plus an **active take id** (the take that plays when no comp says otherwise) and a list of **comp segments** (PPQ ranges, each pointing at the take to play there). Both are undoable edits and both round-trip through JSON.

```typescript
// takes: each has a stable id; sourceOffsetPpq slides a take's source under the clip.
project.setClipTakes(clipId, [
  { id: 1, name: 'take A' },
  { id: 2, sourceOffsetPpq: 0, name: 'take B' },
], /* activeTakeId */ 2);

// comp segments: each PPQ range picks one take. Verses from A, chorus from B.
project.setClipCompSegments(clipId, [
  { startPpq: 0, endPpq: 2, takeId: 1 },
  { startPpq: 2, endPpq: 4, takeId: 2 },
]);
```

Each `ProjectClipTake` is `{ id, sourceId?, sourceOffsetPpq?, name? }`; each `ProjectClipCompSegment` is `{ startPpq, endPpq, takeId? }`. Take ids must be unique, and every `takeId` referenced by a comp segment must exist — both rules throw if violated, so a bad edit fails loudly rather than corrupting the clip.

::: tip Active take vs comp segments
The **active take** is the single take that plays when there are no comp segments — handy while you are still auditioning. **Comp segments** override that per region: wherever a segment covers a position, its `takeId` wins; outside every segment the active take fills in. Build the comp by adding segments over the active take, not by replacing it.
:::

### How the edit compiler renders a comp

When you `compile()` (or render) a project, the edit compiler walks the clip's timeline and, for each position, resolves which take's audio to read: a covering comp segment's take if one exists, otherwise the active take. Each take's source is read at its own `sourceOffsetPpq`, so a take that was recorded slightly late can be nudged into place without re-recording. The compiled timeline therefore plays one seamless performance assembled from many takes — the comp is a *view*, and the original takes stay intact for re-comping later.

### JSON round-trip

`project.toJson()` serializes takes, the active take, and comp segments (`"takes"`, `"active_take_id"`, `"comp_segments"`); `Project.fromJson(json)` restores them. Because comping is non-destructive metadata over the takes, saving and reloading a project preserves every alternate take and your comp — you can keep refining the comp across sessions.

:::: details Comp two takes and save
```typescript
project.setClipTakes(clipId, [
  { id: 1, name: 'take A' },
  { id: 2, name: 'take B' },
], 1);
project.setClipCompSegments(clipId, [
  { startPpq: 0, endPpq: 2, takeId: 1 },   // first half from take A
  { startPpq: 2, endPpq: 4, takeId: 2 },   // second half from take B
]);

const json = project.toJson();             // contains "takes" + "comp_segments"
const restored = Project.fromJson(json);   // comp survives the round-trip
restored.delete();
```
::::

## Drawing the recorded waveform

To draw a take you do not plot every sample — you reduce the audio to per-bucket **min/max** pairs and draw those as a filled envelope. `waveformPeaks(samples, channels, options?)` does the reduction from *interleaved* audio.

```typescript
import { init, waveformPeaks, waveformPeakPyramid } from '@libraz/libsonare';

await init();

// Interleaved stereo: L, R, L, R, ...
const interleaved = new Float32Array([
  -1.0, 0.5, 0.25, -0.25, 0.75, 0.1, -0.5, -0.75, 0.0, 0.9,
]);

const report = waveformPeaks(interleaved, 2, { samplesPerBucket: 2 });
// report = {
//   channels: 2,
//   bucketCount: 3,
//   samplesPerBucket: 2,
//   min: Float32Array [ -1, -0.5, 0,  -0.25, -0.75, 0.9 ],  // channel-major
//   max: Float32Array [ 0.25, 0.75, 0,  0.5,  0.1,   0.9 ],
// }
```

The `min` and `max` arrays are **channel-major**: all of channel 0's buckets, then all of channel 1's. With `channels` and `bucketCount` you index bucket `b` of channel `c` as `report.min[c * report.bucketCount + b]`. When `samplesPerBucket` is omitted it defaults to 512 frames per bucket.

For a zoomable view, `waveformPeakPyramid(samples, channels, options?)` returns one report per zoom level instead of one report:

```typescript
const pyramid = waveformPeakPyramid(interleaved, 2, { samplesPerBucketLevels: [2, 4] });
// pyramid.length === 2
// pyramid[0].samplesPerBucket === 2  (finer — more buckets, zoomed in)
// pyramid[1].samplesPerBucket === 4  (coarser — fewer buckets, zoomed out)
```

Each level is a full `WaveformPeaksReport`. With no options the pyramid uses the standard zoom set `[512, 1024, 2048, 4096]` frames per bucket, so you can swap detail levels as the user zooms without recomputing peaks on every frame.

::: tip Drawing from captured audio
`capturedAudio()` returns **planar** channels (one `Float32Array` each), while `waveformPeaks` wants **interleaved** input. For a mono take pass the single channel straight in with `channels: 1`. For stereo, interleave the two channels first, or compute peaks per channel and draw each lane separately.
:::

## Recipes

:::: details Capture the output bus and draw it
Record a live pass of the arrangement, then reduce it to a drawable waveform.

```typescript
const engine = new RealtimeEngine(48000, 128);
try {
  engine.setCaptureBuffer(2, 48000 * 30);   // stereo, up to 30 s
  engine.setCaptureSource('output');         // capture the rendered mix
  engine.armCapture();
  engine.play();
  // ... drive engine.process([...]) for the performance ...

  const [left] = engine.capturedAudio();     // draw one channel
  const peaks = waveformPeaks(left, 1);      // 512-frame buckets by default
  // peaks.min / peaks.max -> envelope for your canvas
} finally {
  engine.destroy();
}
```
::::

:::: details Punch-record a fix into a fixed take
Re-record only one phrase without touching the rest.

```typescript
const inSample = Math.round(2.0 * 48000);    // punch in at 2 s
const outSample = Math.round(4.0 * 48000);   // punch out at 4 s
engine.setCapturePunch(inSample, outSample, true);
engine.setCaptureSource('input');
engine.armCapture();
engine.play();
// Capture appends only while the transport is inside [inSample, outSample).
```
::::

:::: details Loop-record three takes, then comp them
Capture three passes of a 2-bar phrase, split into takes, keep the best halves.

```typescript
const result = project.addLoopRecordingTakes({
  trackId, startPpq: 0, loopLengthPpq: 4,
  audio: threePassesOfAudio, audioChannels: 1, audioSampleRate: 48000,
});
project.setClipCompSegments(result.clipId, [
  { startPpq: 0, endPpq: 2, takeId: 1 },
  { startPpq: 2, endPpq: 4, takeId: 2 },
]);
```
::::

Once a take is captured and comped, it lives on a clip in your project like any other audio. From here you arrange and trim it in [Project Editing](./project-editing.md), then turn the finished arrangement into a file in [Bouncing Projects](./project-bounce.md).

## Related

- [Realtime Streaming](./realtime-streaming.md) — the engine node, AudioWorklet bridge, and SAB-free realtime path
- [Project Editing](./project-editing.md) — clips, PPQ, fades, warping, and the edit compiler that renders comps
- [MIDI Input](./midi-input.md) — drive instruments live while you record
- [Native Synth](./native-synth.md) · [SoundFont Player](./soundfont-player.md) — sources to record into the engine
- [Bouncing Projects](./project-bounce.md) — render the comped arrangement offline once recording is done
