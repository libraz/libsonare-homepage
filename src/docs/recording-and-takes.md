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

Recording crosses the realtime layer and the project layer. The engine captures samples; the project stores those samples as takes and comp instructions. The two halves meet at a single handoff point — `capturedAudio()` — which is also where you must switch from the audio thread to the main/control thread.

<FlowDiagram
  title="Capture-to-bounce pipeline"
  :nodes="[
    { id: 'source', label: 'Mic or engine output', col: 0, row: 0, variant: 'muted', group: 'realtime' },
    { id: 'buffer', label: 'Capture buffer', col: 1, row: 0, group: 'realtime' },
    { id: 'handoff', label: 'capturedAudio()', col: 2, row: 0, variant: 'accent' },
    { id: 'takes', label: 'addLoopRecordingTakes', col: 3, row: 0, group: 'project' },
    { id: 'cliptakes', label: 'Clip takes', col: 4, row: 0, group: 'project' },
    { id: 'comp', label: 'Comp segments', col: 5, row: 0, group: 'project' },
    { id: 'bounce', label: 'compile() / bounce()', col: 6, row: 0, variant: 'success' }
  ]"
  :edges="[
    { from: 'source', to: 'buffer' },
    { from: 'buffer', to: 'handoff' },
    { from: 'handoff', to: 'takes' },
    { from: 'takes', to: 'cliptakes' },
    { from: 'cliptakes', to: 'comp' },
    { from: 'comp', to: 'bounce' }
  ]"
  :groups="[
    { id: 'realtime', label: 'Realtime engine' },
    { id: 'project', label: 'Project model' }
  ]"
  caption="capturedAudio() is the one safe crossing point from the audio thread to the main/control thread."
/>

Do not put `Project` editing calls in the audio callback. Capture in the realtime engine first, then update the project from the main/control thread after the take is finished.

## What You Will Learn

By the end of this page you should be able to:

- size and arm the engine's capture buffer, pick a capture source, and read captured audio back;
- compensate for round-trip latency with a record offset and hear yourself with input monitoring;
- punch in and out so only a chosen region is recorded;
- open a browser microphone with `bindMicrophoneInput` and clean it up correctly;
- split a captured loop into takes with `addLoopRecordingTakes`, then comp across takes with `setClipTakes` / `setClipCompSegments`;
- find the cut points several free takes share with `splitSilenceCommonWithReport`, slice every channel on the same frames with `remixAlignedIntervals`, and warp a take that drifts under its reference with `alignTakeToReference`;
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

  // Process the engine block by block (in a real app this is your audio callback).
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

  // ... pass live input blocks via engine.process([micBlock]) ...

  const [mono] = engine.capturedAudio();    // the recorded take as a Float32Array
} finally {
  engine.destroy();
}
```
::::

## Browser microphone input

In the browser, `bindMicrophoneInput(audioContext, engine, options?)` wires a `getUserMedia` microphone stream into a realtime engine node and returns a binding you can close. It is **browser-only** — it needs a live `AudioContext` and the Web Audio graph — and runs without `SharedArrayBuffer` (no COOP/COEP headers required).

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
// binding.source  -> the MediaStreamAudioSourceNode connected to the engine

// When the take is done:
binding.close();             // disconnects the source (and stops tracks if stopTracksOnClose)
```

The options object **extends `MediaStreamConstraints`**, so any constraint you would pass to `getUserMedia` (the `audio` object with `echoCancellation`, `noiseSuppression`, `channelCount`, a device `deviceId`, …) goes straight through. Two extra fields are libsonare's own:

- **`stream`** — reuse a `MediaStream` you already obtained instead of prompting for a new one.
- **`stopTracksOnClose`** — defaults to `true`. When true, `binding.close()` also stops the underlying microphone tracks, turning off the OS recording indicator. Set it to `false` when you pass a `stream` you own and want to keep using elsewhere.

::: warning Close the binding when you are done
`binding.close()` disconnects the source node so the microphone stops sending audio to the engine. Pair every `bindMicrophoneInput` with a `close()` — typically when the user stops recording or the component unmounts. The default also stops microphone tracks so the OS recording indicator goes away; pass `stopTracksOnClose: false` only when another part of your app still needs the same stream.
:::

For the surrounding AudioWorklet plumbing — building the engine node, registering the worklet processor, and the SAB-free (SharedArrayBuffer-free) realtime path — see [Realtime Streaming](./realtime-streaming.md). To play a synth or sampler *into* the recording instead of an external mic, see [Native Synth](./native-synth.md) and the [SoundFont Player](./soundfont-player.md), and [MIDI Input](./midi-input.md) for driving them live.

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
  const recorded = new Float32Array(passes * passSamples);                       // your concatenated passes (interleaved if audioChannels > 1)

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

::: warning Interleave the audio for multi-channel takes
The `audio` Float32Array is read as **interleaved** when `audioChannels > 1` (L, R, L, R, …). `engine.capturedAudio()` returns **planar** channels (one `Float32Array` per channel), so for a stereo loop you must interleave those channels before passing them to `addLoopRecordingTakes` — or record the loop with `audioChannels: 1` (mono) and pass the single channel straight through.
:::

The call adds one clip whose alternate takes are the loop passes, and sets the **active take** to the newest (last) pass. Note that if your captured audio did not end exactly on a loop boundary, that last pass is a short, partial take — so by default the clip plays the truncated take until you pick another take or build a comp. From here you comp across those takes.

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

Each `ProjectClipTake` is `{ id, sourceId?, sourceOffsetPpq?, name? }`; each `ProjectClipCompSegment` is `{ startPpq, endPpq, takeId?, crossfadePpq? }`. Take ids must be unique, and any *non-zero* `takeId` referenced by a comp segment must match an existing take — a bad non-zero reference throws, so the edit fails loudly rather than corrupting the clip. A `takeId` of `0` (or omitted) is the deliberate exception: it falls back to the clip's active/base take for that region, so you can leave a segment on the active take without naming an id.

### Softening the seam

Two takes are two different signals, so a comp splice steps the waveform wherever they disagree. `crossfadePpq` fades a segment in over the part *before* it, so the switch completes exactly where the segment starts and the clip length does not move. The fade is equal-power, which keeps the level steady across a correlated seam.

```typescript
project.setClipCompSegments(clipId, [
  { startPpq: 0, endPpq: 2, takeId: 1 },
  { startPpq: 2, endPpq: 4, takeId: 2, crossfadePpq: 0.25 }, // blend in over a quarter note
]);
```

`0` — the default — is the butt join: segments meet with no overlap. A fade cannot outrun either its own segment or the part ahead of it, and the first segment has nothing in front of it, so a crossfade there is held at `0`.

The third argument, `activeTakeId`, is optional and defaults to `0`. Pass `0` (or omit it) and the clip keeps playing its **base source** with no active-take override — useful when you have defined takes but do not want any of them to replace the original clip audio by default. Any non-zero `activeTakeId` must match the `id` of one of the takes you pass; take ids themselves are always non-zero, so `0` unambiguously means 'no active take'.

Comping also composes safely with the other clip edits: `splitClip` and trims carry the takes, their `sourceOffsetPpq` values, and the covering comp segments over to the resulting clips, so cutting a comped clip does not lose the comp. The one combination that is refused is **loop mode with comp segments that split the clip** — a looped clip repeats one continuous region, so an edit that would create both is rejected instead of producing a comp that cannot loop.

::: tip Active take vs comp segments
The **active take** is the single take that plays when there are no comp segments — handy while you are still auditioning. **Comp segments** override that per region: wherever a segment covers a position, its `takeId` wins; outside every segment the active take fills in. Build the comp by adding segments over the active take, not by replacing it.
:::

<SonareDemo id="comping" />

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

## Comping free takes: shared cut points and alignment

Loop takes arrive on the grid: every pass covers the same PPQ range, so `addLoopRecordingTakes` can split them by length alone. Takes recorded as separate passes — each a fresh run through the part against a guide vocal or a backing track — do not. Comping them means cutting every take at the same places, which only works while the takes share a timeline; a take sung live drifts against its reference throughout, a little ahead here and a little behind there, so no single offset places it. Three calls cover this ground: `splitSilenceCommonWithReport` finds the cut points every take agrees on and says whether the takes line up well enough to have any; `remixAlignedIntervals` turns those cut points into one frame set for all channels of a stereo take; `alignTakeToReference` handles the take that does not line up, returning the warp map that puts it under the reference. Signatures are on the [JavaScript API](./js-api-audio.md) page; this section is the order they go in and how to read what they return.

### Cut points the takes share

What takes of one part share is their silence, not their sound: a take that happens to go quiet where another is still singing must not be cut there. `splitSilenceCommon({ signals })` takes all the takes at once and returns the **union** of each take's sounding intervals — the same flat `[start0, end0, start1, end1, …]` `Int32Array` that `splitSilence` returns for one signal — merged where they touch, so every gap between the returned intervals is silent in all takes at once and a cut placed in a gap lands mid-phrase in none of them. Takes of unequal length need no padding: a shorter take contributes nothing past its own end, which is the same as being silent there. A single signal answers exactly as `splitSilence` does. Cutting is left to you, and it is an array slice.

`splitSilenceCommonWithReport` returns the identical intervals plus a `report`. The report exists because one interval covering everything is the answer to three different situations, and the interval list cannot separate them:

```typescript
import { splitSilenceCommonWithReport } from '@libraz/libsonare';

const topDb = 60; // the default: a frame is silent when it sits this far under its own take's peak
const { intervals, report } = splitSilenceCommonWithReport({
  signals: [takeA, takeB, takeC],   // one Float32Array per take, one channel each
  topDb,
});
// intervals -> Int32Array [start0, end0, start1, end1, ...], valid for every take
// report    -> { silenceCeilingDb, maxSignalIntervals, minSignalIntervals }
```

Read `silenceCeilingDb` — the largest `topDb` at which **every** take still shows silence — against the `topDb` you passed:

| `silenceCeilingDb` | What it says | What to do |
|--------------------|--------------|------------|
| Near `0` | A take never stops sounding; no threshold can open a gap in it | Take the cut points from something other than silence — a marker, a beat |
| Below `topDb` | The threshold was too loose to see the quiet these takes do have | Re-run with a `topDb` under the reported ceiling; that figure cuts |
| At or above `topDb`, and still one interval | Every take goes quiet at this setting, but never in the same place | The takes are out of time with each other — align them first (below) |

The two interval counts describe shape, not cause: a take that sounds once and stops counts `1` exactly as a take with no silence does, so use them to see whether any take has an interior gap at all (`maxSignalIntervals >= 2`) and whether the takes differ in how broken up they are — the ceiling carries the verdict. `silenceCeilingDb` is `0` for an all-silent take, where the peak is zero and the ratio has no value. All three figures come from the same RMS pass as the intervals, so they never describe a different measurement. The plain `splitSilenceCommon` stays for a caller who is only cutting; both entry points share their defaults (`topDb` 60, `frameLength` 2048, `hopLength` 512) and their refusals — an empty `signals` list or an empty take throws from either.

### Slice every channel on the same frames

For a mono take, `take.subarray(start, end)` over each interval is the whole job. A stereo take has one more step. `remix` can snap a cut point to a zero crossing so a slice does not start on a click, but snapping is a per-signal decision: run it channel by channel and each channel snaps to a different frame, and the stereo image drifts apart at every cut. `remixAlignedIntervals` resolves the snapped cut set from **one** channel, without cutting, and returns one clamped `(start, end)` pair per input interval so the same frames can be applied to every channel:

```typescript
import { remixAlignedIntervals } from '@libraz/libsonare';

const cuts = remixAlignedIntervals({
  samples: takeLeft,    // resolve from one channel only
  intervals,            // the shared intervals from the split above
  sampleRate,           // validated, so pass the real rate
  alignZeros: true,     // the default here; remix itself defaults to false
});
for (let i = 0; i < cuts.length; i += 2) {
  const left = takeLeft.subarray(cuts[i], cuts[i + 1]);
  const right = takeRight.subarray(cuts[i], cuts[i + 1]);   // identical frames
}
```

Two guards keep a slice from vanishing: a channel with no sign change at all (silence, a DC offset, any constant) is not snapped, and a slice that had content but would collapse to empty after snapping keeps its unsnapped boundaries. With `alignZeros: false` the pairs are simply the inputs clamped to the buffer. Note what this call consumes: the intervals from the silence split, in sample positions of the take's own buffer — not the anchors from the alignment below, which describe the project timeline.

### Aligning a take that drifts

When the report puts the ceiling at or above `topDb` and still returns one interval, the takes each go quiet but never together: they are out of time with each other, and no threshold fixes that. `alignTakeToReference` measures a chromagram (the twelve pitch classes over time) for the reference and for the take, aligns the two with dynamic time warping, and returns the alignment as project **warp anchors** — the `{ warpSample, sourceSample }` pairs [`setWarpMap`](./project-editing.md#warp-stretching-clips-to-the-grid) accepts, already oriented for a clip whose source is the take: `warpSample` is a position on the **reference** timeline and `sourceSample` the matching position in the **take**. The recording itself is untouched; the clip plays it stretched under the reference.

```typescript
import { alignTakeToReference, Project } from '@libraz/libsonare';

const { anchors, alignment } = alignTakeToReference({
  reference,     // Float32Array: the guide take, or the backing track the takes were sung against
  take,          // Float32Array: the take to place under it
  sampleRate,    // the rate of BOTH buffers — nothing here resamples
  // hopLength: 512,      // chroma hop: a smaller hop measures more frames and yields more anchors
  // binsPerOctave: 12,   // must be a positive multiple of 12; leave it unless checked against the rate
});
// alignment -> { meanResidualFrames, referenceFrames, takeFrames } — descriptive, never a failure

const project = new Project();
try {
  project.setSampleRate(sampleRate);
  const trackId = project.addTrack({ kind: 'audio', name: 'take 2' });
  const clipId = project.addClip({ trackId, lengthPpq: 8, audio: take, audioSampleRate: sampleRate });
  project.setWarpMap({ id: 1, name: 'take 2 under guide', anchors });
  project.setClipWarpRef(clipId, 1);
  project.setClipWarpMode(clipId, 'time-stretch');   // follow the anchors, keep the pitch
} finally {
  project.delete();
}
```

A warp map belongs to a clip, so each aligned take gets its own clip and its own map; once they all play in time under the reference, the comp is cut on that shared timeline with `splitClip` and trims, and a `'time-stretch'` clip takes the new map from the next audio block with no re-bake. The anchors are already reduced to the strictly increasing form a warp map requires — a DTW path holds one axis still wherever the two recordings differ in speed, and a run of tied coordinates is represented by its middle anchor — so the result goes into `setWarpMap` as it is. `alignment` says how well the pair was conditioned: `takeFrames / referenceFrames` is the overall rate difference the anchors encode, and `meanResidualFrames` is the mean absolute departure of the path from its own diagonal trend — a coarse indication of how much the take disagrees with the reference, not an error bound. None of these figures fails the call; a caller deciding what is acceptable supplies its own threshold.

::: warning What is refused, and how
A take that cannot be aligned is reported, never answered with a map you cannot use. Two layers refuse, and which one answers decides what you are told:

- **Named by field, before the measurement.** An empty buffer (`reference must not be empty`, `take must not be empty`), a non-finite sample (`reference contains NaN or Inf`, `take contains NaN or Inf`), a `sampleRate` that is not an integer in `[8000, 384000]`, and a `hopLength` or `binsPerOctave` of the wrong shape (a string, a fraction) all throw a `RangeError` that names the offending field.
- **`SonareError` `InvalidParameter`, from the measurement.** A negative `hopLength`; a `binsPerOctave` that is negative or not a multiple of 12 (each pitch class is the mean of a whole number of CQT bins, so 13 and 18 have no fold); and a pair that yields no two distinct anchors — either recording shorter than one chroma frame is what that looks like. The core reports the condition without naming an argument.

A multiple of 12 is necessary, not sufficient: the finest usable `binsPerOctave` depends on the sample rate and does not rise with it, so leave the field at its default unless a finer grid has been checked at the rate it will run at. Omitting either field, or writing `0`, selects the library value.

**Sample rates are not converted.** The call takes one `sampleRate` for both buffers; resample first if they differ, or the chromagrams are measured on two different grids and the anchors are wrong without anything reporting it. The CLI counterpart, `sonare project align-takes`, reads the reference and each take from their files and refuses a mismatch by name before calling the core — `align-takes reads both at one rate and does not resample` — rather than resampling either side.
:::

::: tip Which path, decided by the report
Takes that already line up — loop passes, or takes tracked to a click — go straight from `splitSilenceCommonWithReport` to `remixAlignedIntervals` and the comp. `alignTakeToReference` is for the take the report flags as out of time: warp it under the reference first, and cut the comp on the project timeline rather than on shared silence.
:::

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
  // ... call engine.process([...]) for the performance ...

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
- [JavaScript API](./js-api-audio.md) — signatures for `alignTakeToReference`, `remixAlignedIntervals`, and `splitSilenceCommonWithReport`
- [MIDI Input](./midi-input.md) — drive instruments live while you record
- [Native Synth](./native-synth.md) · [SoundFont Player](./soundfont-player.md) — sources to record into the engine
- [Bouncing Projects](./project-bounce.md) — render the comped arrangement offline once recording is done
