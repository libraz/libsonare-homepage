---
title: Project & Arrangement Editing
description: Beginner-friendly guide to libsonare's headless-DAW edit API — the Project model, clip and track operations, undo/redo, the tempo map and time signatures, warp modes, automation, MIR write-back, compile diagnostics, JSON save/load, and SMF / MIDI 2.0 Clip File import-export, with copy-paste recipes.
---

# Project & Arrangement Editing

**Want to build a song's arrangement in code — without opening a DAW?** That is what `Project` is for. A **project** is the timeline that holds everything a song is made of: audio tracks, MIDI tracks, the clips placed on them, the tempo map, time signatures, and markers. libsonare ships a `Project` model — a small, headless DAW editing API — so you can build, edit, and serialize that timeline **inside your own app**, with no DAW host required.

The workflow is a short loop: you assemble an arrangement, edit it with undoable operations, [compile](./project-editing-midi.md#compiling-the-arrangement) it into a renderable timeline, save it to JSON, and finally [render audio](./project-editing-midi.md#rendering-audio) — see [MIDI, Compile & Save/Load](./project-editing-midi.md) for that half of the workflow. `Project` is an **offline, control-thread API** (it never runs on the audio thread), and it behaves identically in the browser (WASM), Node, and Python.

::: info Three words to know first
A **track** is one lane in the timeline (an audio lane or a MIDI lane). A **clip** is one block of content placed on a track — a slice of recorded audio or a region of MIDI notes. **PPQ** ("pulses per quarter note") is how libsonare measures musical time: every clip start, length, and event position is given in quarter-note units, so `lengthPpq: 4` is four quarter notes long regardless of tempo.
:::

::: info Headless DAW
A **headless DAW** is the editing and rendering core of a DAW without its own window, timeline UI, or plug-in host. libsonare gives you the data model and audio engine; your app supplies the buttons, waveform view, file picker, and project browser.
:::

::: tip Where editing sits in the pipeline
**Analysis** tells you *what* a track is. **Editing** arranges and trims clips on a timeline and fixes their timing. **Mixing** balances several tracks into a stereo bus. **Mastering** polishes that finished mix for delivery. This page is the editing stage: it is where "a folder of stems and MIDI" becomes "a structured arrangement" you can then mix and render. If terms like *clip*, *track*, *fade*, or *tempo map* are new, read [Editing Basics](./glossary/concepts/editing-basics.md) first.
:::

## The project model

A project nests a few simple parts, each one a container for the next:

- Each **track** holds **clips** (blocks of content placed on the timeline).
- An audio clip can carry alternate **takes** plus a **comp** that stitches the best parts of those takes into one performance.
- A track can have **automation lanes** — recorded curves that move a parameter (volume, a filter cutoff, …) over time, the way a fader moving on its own would.
- A MIDI track points at an instrument **destination** — the synth or sampler that will actually make its notes audible (defined just below).
- Every track routes through a strip in the **mixer scene** — its channel of EQ, fader, pan, and sends — on its way to the master.

<ProjectModelFigure title="The project model on the timeline" />

::: info What is a MIDI "destination"?
MIDI notes are just instructions (play note 60 now), not sound. A **destination** is the instrument those instructions are sent to — the synth or sampler that turns them into audio. A MIDI track names a destination; you bind an actual instrument to it when you render. See [Project Bounce](./project-bounce.md).
:::

<FlowDiagram
  title="Project structure"
  direction="TB"
  :nodes="[
    { id: 'project', label: 'Project', col: 0, row: 0, variant: 'accent' },
    { id: 'audioTrack', label: 'Audio track', col: 0, row: 1 },
    { id: 'midiTrack', label: 'MIDI track', col: 1, row: 1 },
    { id: 'automation', label: 'Automation lanes', col: 2, row: 1, variant: 'muted' },
    { id: 'audioClip', label: 'Audio clip (takes / comp)', col: 0, row: 2 },
    { id: 'midiClip', label: 'MIDI clip (note events)', col: 1, row: 2 },
    { id: 'destination', label: 'MIDI destination', col: 1, row: 3, variant: 'accent' },
    { id: 'scene', label: 'Mixer scene strip', col: 0, row: 3 },
    { id: 'master', label: 'Master bus', col: 0, row: 4, variant: 'success' }
  ]"
  :edges="[
    { from: 'project', to: 'audioTrack' },
    { from: 'project', to: 'midiTrack' },
    { from: 'project', to: 'automation' },
    { from: 'audioTrack', to: 'audioClip' },
    { from: 'midiTrack', to: 'midiClip' },
    { from: 'midiClip', to: 'destination' },
    { from: 'audioTrack', to: 'scene' },
    { from: 'midiTrack', to: 'scene' },
    { from: 'scene', to: 'master' }
  ]"
  caption="Every track, clip, and lane nests under the project; audio and MIDI tracks both route through the mixer scene on their way to the master bus."
/>

## The edit flow at a glance

Keep this mental model in mind before reading the API list. You edit a `Project`; compiling checks that the timeline makes sense; bouncing turns the compiled timeline into audio samples.

<FlowDiagram
  title="Edit → compile → bounce"
  :nodes="[
    { id: 'source', label: 'Audio / MIDI source', col: 0, row: 0 },
    { id: 'project', label: 'Tracks & clips', col: 1, row: 0 },
    { id: 'edits', label: 'Undoable edits', col: 2, row: 0 },
    { id: 'compile', label: 'compile()', col: 3, row: 0 },
    { id: 'diagnostics', label: 'Diagnostics', col: 4, row: 0, variant: 'decision' },
    { id: 'bounce', label: 'Bounce', col: 5, row: 0, variant: 'accent' },
    { id: 'fix', label: 'Fix clip / track / routing', col: 5, row: 1, variant: 'warning' },
    { id: 'audio', label: 'Interleaved Float32 audio', col: 6, row: 0, variant: 'success' }
  ]"
  :edges="[
    { from: 'source', to: 'project' },
    { from: 'project', to: 'edits' },
    { from: 'edits', to: 'compile' },
    { from: 'compile', to: 'diagnostics' },
    { from: 'diagnostics', to: 'bounce', label: 'no errors' },
    { from: 'diagnostics', to: 'fix', label: 'errors', style: 'dashed' },
    { from: 'fix', to: 'edits', label: 'fix', style: 'dashed' },
    { from: 'bounce', to: 'audio' }
  ]"
  caption="When diagnostics report errors, fixing the clip, track, or routing loops back into the edit step (dashed) instead of ending the flow."
/>

When `compile()` comes back with errors, the fix is not a dead end — you correct the offending clip, track, or routing and the arrangement re-enters the same undoable-edit step, ready to compile again. Two points prevent most beginner mistakes:

- `compile()` does not make sound; it validates and prepares the arrangement.
- Plain `bounce()` renders audio tracks only. MIDI tracks need an instrument-bound bounce such as `bounceWithSynthInstrument(...)` or `bounceWithSf2Instrument(...)`.

## What You Will Learn

By the end of this page you should be able to:

- create a `Project`, add audio and MIDI tracks, and place clips on them;
- edit clips (split, trim, move, gain, fade, loop, re-source, duplicate, remove) and tracks (add, rename, route, change kind, remove) through **undoable** operations;
- place musical time correctly using PPQ, a tempo map with tempo segments, time signatures, and markers;
- choose a clip overlap policy and a warp mode (`off` / `repitch` / `tempo-sync` / `time-stretch`) with warp anchors;
- write key/chord annotations and automation lanes onto the project;
- compile to a renderable timeline and read its structured diagnostics and non-fatal warnings;
- save and load with deterministic JSON, and exchange MIDI through SMF (Standard MIDI File) and the MIDI 2.0 Clip File format.

## Create a project and add content

Every project starts empty. Set a sample rate, add tracks, then add clips. `addTrack` and `addClip` return stable integer ids you reuse for every later edit. Positions and lengths are in **PPQ**.

::: code-group

```typescript [Browser / WASM]
import { init, Project } from '@libraz/libsonare';

await init();

const project = Project.create();
try {
  project.setSampleRate(48000);

  // An audio track with one recorded clip (decoded interleaved float audio).
  const audioTrack = project.addTrack({ kind: 'audio', name: 'lead-gtr' });
  const clipId = project.addClip({
    trackId: audioTrack,
    startPpq: 0,          // place at the very start
    lengthPpq: 4,         // four quarter notes long
    audio: guitarMono,    // Float32Array of decoded samples
    audioChannels: 1,
    audioSampleRate: 48000,
  });

  // A MIDI track + clip in one call.
  const { trackId: midiTrack, clipId: midiClip } = project.addMidiClip(0, 8);
} finally {
  project.delete();       // the WASM handle is NOT garbage-collected — always release it
}
```

```python [Python]
import libsonare as sonare

with sonare.Project() as project:
    project.set_sample_rate(48000)

    audio_track = project.add_track("audio", name="lead-gtr")
    clip_id = project.add_clip(
        audio_track,
        start_ppq=0.0,        # place at the very start
        length_ppq=4.0,       # four quarter notes long
        audio=guitar_mono,    # interleaved float samples
        audio_channels=1,
        audio_sample_rate=48000,
    )

    midi_track, midi_clip = project.add_midi_clip(0.0, 8.0)
# leaving the `with` block releases the native handle
```

:::

Use `project.trackCount()` and `project.clipCount()` to update project summaries or validate imported arrangements without walking the serialized JSON. Python exposes the same values as `track_count()` and `clip_count()`.

::: danger Always release the project
`Project`, like every WASM-backed object, holds a heap handle that JavaScript's garbage collector cannot reclaim. In the WASM package, construct it with `Project.create()` and call `project.delete()` in a `finally` block. In Node native, construct it with `Project.create()` and call `project.destroy()` or `project.delete()`. In Python use `Project` as a context manager (`with sonare.Project() as project:`) or call `project.close()`. Leaking handles slowly exhausts native or WASM memory in long sessions.
:::

## Editing clips

Every clip operation is a single undoable command and addresses the clip by its id.

| Operation | Method | What it does |
|-----------|--------|--------------|
| Split | `splitClip(clipId, splitPpq)` | Cuts the clip at an absolute PPQ; returns the new clip's id |
| Trim | `trimClip(clipId, newStartPpq, newLengthPpq)` | Resets start and length |
| Move | `moveClip(clipId, newStartPpq, newTrackId?)` | Slides the clip, optionally to another track |
| Gain | `setClipGain(clipId, gain)` | Linear per-clip playback gain (`>= 0`). On an audio clip it scales the clip's own samples; on a MIDI clip it scales the bound instrument's rendered output instead |
| Fade | `setClipFade(clipId, fadeIn, fadeOut)` | Fade-in / fade-out regions with a curve |
| Loop | `setClipLoop(clipId, mode, loopLengthPpq?, loopCrossfadePpq?)` | `'off'` or `'loop'` with a loop length and optional loop-seam crossfade |
| Re-source | `setClipSource(clipId, sourceId)` | Rebinds the clip to a different registered source |
| Duplicate | `duplicateClip(clipId, newStartPpq)` | Copies the clip on the same track; returns the new id |
| Remove | `removeClip(clipId)` | Deletes the clip |

```typescript
project.setClipGain(clipId, 0.8);
project.setClipFade(
  clipId,
  { lengthPpq: 0.5, curve: 'equal-power' },  // fade in over half a beat
  { lengthPpq: 1.0, curve: 'linear' },       // fade out over one beat
);
const tailId = project.splitClip(clipId, 2); // cut at beat 2; tail becomes a new clip
project.setClipLoop(tailId, 'loop', 2, 0.05); // loop the tail every two beats with a short seam crossfade
const copyId = project.duplicateClip(tailId, 8);
```

Fade curves are `'linear'`, `'equal-power'`, `'exponential'`, and `'logarithmic'`. Each fade length is clamped to the clip length, so an oversized fade cannot start before the clip; a negative length is rejected outright. Loop mode is `'off'` or `'loop'`; a positive `loopLengthPpq` is required when looping. `loopCrossfadePpq` is an optional equal-power crossfade at the loop seam. `0` keeps a hard loop; positive values blend the loop tail with the pre-roll source material. The engine clamps the value to the available source offset and half the loop length, and disables the seam crossfade for warped clips.

::: warning `setClipGain` / `setClipFade` shape a MIDI clip's rendered audio, not its events
The compiler still copies a MIDI clip's note-on / note-off events verbatim into the render schedule — gain and fade never touch velocity or timing. What they shape instead is the bound instrument's *rendered output* at the clip's MIDI destination: while this clip is the most recently started one still active on that destination, its output follows `gain` and glides through the fade region the same way an audio clip's samples do. When it ends, an older clip that is still active takes over again. Only when no clip remains active does the destination hold the most recently ended clip's end value (`0` after a fade-out, `gain` otherwise). If clips start together, the larger clip id wins. Several tracks sharing one destination therefore share this envelope — the selected clip governs the whole destination, not each track independently. The **track gain** (`setTrackGain(trackId, gain)`, folded into the channel-strip fader in the [mixer scene](./mixing.md)) still layers underneath and is unaffected; a track gain of `0` silences the track's MIDI notes entirely regardless of any clip gain or fade.
:::

In Python the same operations are snake_case, and fades take separate length/curve arguments:

```python
project.set_clip_gain(clip_id, 0.8)
project.set_clip_fade(
    clip_id,
    fade_in_length_ppq=0.5,
    fade_out_length_ppq=1.0,
    fade_in_curve="equal-power",
    fade_out_curve="linear",
)
tail_id = project.split_clip(clip_id, 2.0)
project.set_clip_loop(tail_id, "loop", 2.0, loop_crossfade_ppq=0.05)
copy_id = project.duplicate_clip(tail_id, 8.0)
```

## Editing tracks

Track operations are likewise undoable.

| Operation | Method | What it does |
|-----------|--------|--------------|
| Add | `addTrack({ kind, name })` | Adds an `'audio'`, `'midi'`, or `'aux'` track; returns its id |
| Remove | `removeTrack(trackId)` | Deletes the track and its clips |
| Rename | `renameTrack(trackId, name)` | Renames the track |
| Change kind | `setTrackKind(trackId, kind)` | Switches a track between `'audio'` / `'midi'` / `'aux'` |
| Route | `setTrackRoute(trackId, channelStripRef, outputTarget)` | Binds the track to a mixer strip and output bus |
| Gain | `setTrackGain(trackId, gain)` | Sets the track's linear output gain (negative or non-finite values are rejected) |
| Mute | `setTrackMute(trackId, mute)` | Mutes or unmutes the track |
| Solo | `setTrackSolo(trackId, solo)` | Solos the track, implies-muting the others |
| Pan | `setTrackPan(trackId, pan)` | Pans the track in `[-1, 1]` (non-finite values are rejected) |
| MIDI destination | `setTrackMidiDestination(trackId, destinationId)` | Routes the track's MIDI to an instrument destination id (see [Built-in Instruments](./native-synth.md)) |

::: code-group

```typescript [Browser / WASM]
const drums = project.addTrack({ kind: 'audio', name: 'drums' });
project.renameTrack(drums, 'drum-bus');
project.setTrackRoute(drums, 'strip-drums', 'master'); // wire to a mixer scene strip
```

```python [Python]
drums = project.add_track("audio", name="drums")
project.rename_track(drums, "drum-bus")
project.set_track_route(drums, "strip-drums", "master")  # wire to a mixer scene strip
```

:::

An **aux** track carries no clips of its own — it is a routing/return lane (for example an effect return or a submix) rather than a place to record content.

`setTrackRoute` links a project track to a strip in the project's [mixer scene](./mixing-scene-json.md) (set with `setMixerSceneJson`) so the bounced track flows through that channel strip's processing.

## Undo and redo

The project keeps an **edit history**. Every clip, track, automation, and annotation operation pushes a command you can reverse.

::: code-group

```typescript [Browser / WASM]
project.setClipGain(clipId, 0.3);
project.undo();   // gain returns to its previous value
project.redo();   // re-applies the gain edit
```

```python [Python]
project.set_clip_gain(clip_id, 0.3)
project.undo()   # gain returns to its previous value
project.redo()   # re-applies the gain edit
```

:::

For long-lived editors, you can bound the memory retained for undo and redo or start a fresh editing session without changing the arrangement. `setMaxHistoryBytes(bytes)` sets one combined byte cap across both stacks and applies it immediately; `0` disables retention, so successful edits are not undoable. `setMaxUndoDepth(depth)` remains available when an edit-count bound is more useful and keeps the most recent `depth` edits; the WASM method requires an integer of at least `1`. `clearHistory()` removes both undo and redo entries while leaving the current project state untouched. Node exposes the same camelCase methods; Python uses `set_max_history_bytes(...)`, `set_max_undo_depth(...)`, and `clear_history()`.

```typescript
project.setMaxUndoDepth(100); // retain at most the 100 most recent edits
project.setMaxHistoryBytes(8 * 1024 * 1024); // one cap shared by undo and redo
// ... save or hand the project to another editing session ...
project.clearHistory();       // the arrangement stays as-is; undo/redo are now empty
```

Because the history is exact, calling `toJson()` before an edit, undoing, and calling `toJson()` again yields byte-identical JSON — a useful invariant for testing and for change detection in an editor UI.

Compound clip edits are one history transaction: an operation that changes several clips is undone or redone in one step, rather than leaving the arrangement half-applied.

## Musical time: PPQ, tempo, time signatures, markers

All positions are in **PPQ** (quarter notes as a floating-point value, so fractional beats are exact). Tempo and time signatures live in the project as ordered segment lists.

### Tempo map and tempo segments

The **tempo map** is a list of tempo segments. Each segment starts at a PPQ position and sets a BPM; an optional `endBpm` makes the segment ramp linearly to a new tempo.

::: code-group

```typescript [Browser / WASM]
project.setTempoSegments([
  { startPpq: 0,  bpm: 120 },                 // constant 120 BPM from the top
  { startPpq: 16, bpm: 120, endBpm: 140 },    // ramp 120 -> 140 over this segment
  { startPpq: 32, bpm: 140 },
]);
project.tempoSegmentCount(); // 3
```

```python [Python]
project.set_tempo_segments([
    {"start_ppq": 0.0, "bpm": 120},                     # constant 120 BPM from the top
    {"start_ppq": 16.0, "bpm": 120, "end_bpm": 140},    # ramp 120 -> 140 over this segment
    {"start_ppq": 32.0, "bpm": 140},
])
project.tempo_segment_count()  # 3
```

:::

### Time signatures

Time signatures are a parallel list of segments, each with a numerator (beats per bar) and denominator (beat unit).

::: code-group

```typescript [Browser / WASM]
project.setTimeSignatures([
  { startPpq: 0,  numerator: 4, denominator: 4 },
  { startPpq: 64, numerator: 3, denominator: 4 },  // switch to 3/4 later
]);
```

```python [Python]
project.set_time_signatures([
    {"start_ppq": 0.0, "numerator": 4, "denominator": 4},
    {"start_ppq": 64.0, "numerator": 3, "denominator": 4},  # switch to 3/4 later
])
```

:::

### Markers

Markers label positions on the timeline. Pass marker id `0` to allocate a new id; the call returns the stable id.

```typescript
const introId = project.setMarker(0, 0,  'intro');
project.setMarker(0, 16, 'verse');
project.setMarker(introId, 0, 'intro (edited)'); // update by reusing the id
```

For structured markers, use `setMarkerEx(...)` with a full `ProjectMarker`. `MarkerKind` covers plain markers, text, lyrics, cue points, and key signatures; key-signature markers use `keyFifths` (`-7`...`+7`, sharps positive) plus `keyMinor`.

::: code-group

```typescript [Browser / WASM]
import { MarkerKind } from '@libraz/libsonare';

project.setMarkerEx({
  id: 0,
  ppq: 32,
  name: 'drop cue',
  kind: MarkerKind.cuePoint,
  keyFifths: 0,
  keyMinor: false,
});

project.setMarkerEx({
  id: 0,
  ppq: 64,
  name: 'E minor',
  kind: MarkerKind.keySignature,
  keyFifths: 1,
  keyMinor: true,
});

for (let i = 0; i < project.markerCount(); i += 1) {
  console.log(project.markerByIndex(i));
}
```

```python [Python]
from libsonare import MarkerKind, ProjectMarker

project.set_marker_ex(ProjectMarker(0, 32.0, "drop cue", MarkerKind.CUE_POINT))
project.set_marker_ex(
    ProjectMarker(0, 64.0, "E minor", MarkerKind.KEY_SIGNATURE, key_fifths=1, key_minor=True)
)

for index in range(project.marker_count()):
    print(project.marker_by_index(index))
```

:::

In Python the segment lists also accept plain tuples in place of the mappings shown above (`(start_ppq, bpm)` for tempo, `(start_ppq, numerator, denominator)` for time signatures), and the simple marker call is `set_marker(marker_id, ppq, name)`.

## Overlap policy

The **overlap policy** decides whether two clips on the same track may occupy the same time span. It is project-wide.

```typescript
project.setOverlapPolicy(0); // disallow overlapping clips (default)
project.setOverlapPolicy(1); // allow overlap (e.g. crossfades, layered takes)
project.getOverlapPolicy();  // read it back
```

`0` disallows overlaps; `1` allows them. Allow overlaps when you intend layered clips or crossfades; disallow to keep a track strictly sequential. The policy is a plain integer because it mirrors the native enum directly: only `0` (disallow) and `1` (allow) are defined, and any other value is rejected as an invalid parameter.

## Warp: stretching clips to the grid

**Warp** lets a recorded audio clip follow the project's grid instead of playing back at its fixed original speed — think of nudging and stretching a recording so its beats land where you want them. Internally, the clip keeps its own recorded timeline; a warp map pins positions on that recorded timeline to positions in project time. Each clip has a warp **mode**, and every mode except `'off'` needs a **warp map** of anchors to do anything.

| Warp mode | Meaning |
|-----------|---------|
| `'off'` | Play the audio at its native rate; ignore tempo |
| `'repitch'` | Speed up / slow down with the tempo (pitch moves too, like a tape) |
| `'tempo-sync'` | Time-stretch to follow the tempo while preserving pitch, baked on the control thread |
| `'time-stretch'` | Time-stretch to follow the tempo while preserving pitch, synthesized on the audio thread |

::: info How tempo-sync keeps the pitch
`'tempo-sync'` time-stretches the audio with a **phase vocoder** — an STFT-based time-stretch that changes the timing without changing the pitch (unlike `'repitch'`, which moves both like a tape). The same algorithm runs in both realtime playback and offline [bounce](./project-bounce.md), so a warped clip sounds identical whichever way you render it. On stereo and multichannel clips, all channels are stretched by one peak-locked vocoder pass, so the stretch stays phase-coherent across channels and the stereo image does not drift.
:::

`'time-stretch'` also preserves pitch, but reaches it a different way: it reads the *same* anchor map as `'repitch'` and synthesizes the output by overlap-adding source segments at a fixed rate, so changing the map moves the timing and leaves the pitch where it was. The practical difference is when the work happens — `'tempo-sync'` bakes the stretched audio on the control thread, while `'time-stretch'` takes effect from the next audio block with no re-bake. [Warp and Tempo Sync](./glossary/arrangement/warp-and-tempo.md) compares the two in full.

<SonareDemo id="time-stretch" />

A **warp map** is a list of anchors, and each anchor is a "this moment in the recording belongs here on the timeline" pin. Concretely, each `ProjectWarpAnchor` ties a `warpSample` (a position on the project/warped timeline) to a `sourceSample` (the matching position in the recorded audio); the engine stretches the audio smoothly between consecutive anchors.

<FlowDiagram
  title="Warp anchors map recording time onto project time"
  :nodes="[
    { id: 'r0', label: '0', col: 0, row: 0, group: 'rec' },
    { id: 'r1', label: '12000', col: 1, row: 0, group: 'rec' },
    { id: 'r2', label: '24000', col: 2, row: 0, group: 'rec' },
    { id: 'r3', label: '48000', col: 3, row: 0, group: 'rec' },
    { id: 'p0', label: '0', col: 0, row: 1, variant: 'accent', group: 'proj' },
    { id: 'p1', label: '12000', col: 1, row: 1, variant: 'accent', group: 'proj' },
    { id: 'p2', label: '36000', col: 2, row: 1, variant: 'accent', group: 'proj' },
    { id: 'p3', label: '48000', col: 3, row: 1, variant: 'accent', group: 'proj' }
  ]"
  :edges="[
    { from: 'r0', to: 'p0', style: 'dashed' },
    { from: 'r1', to: 'p1', style: 'dashed' },
    { from: 'r2', to: 'p2', style: 'dashed' },
    { from: 'r3', to: 'p3', style: 'dashed' },
    { from: 'p0', to: 'p1', label: '1× (as recorded)' },
    { from: 'p1', to: 'p2', label: '2× stretch' },
    { from: 'p2', to: 'p3', label: '0.5× (faster)' }
  ]"
  :groups="[
    { id: 'rec', label: 'Recording timeline (sourceSample)' },
    { id: 'proj', label: 'Project timeline (warpSample)' }
  ]"
  caption="Each dashed pin ties one sourceSample to its warpSample; between consecutive anchors the engine stretches the audio at that segment's ratio."
/>

```typescript
// Define a reusable warp map, then attach it to a clip.
project.setWarpMap({
  id: 1,
  name: 'groove',
  anchors: [
    { warpSample: 0,     sourceSample: 0 },
    { warpSample: 24000, sourceSample: 12000 }, // first half of the bar plays at 2x source
  ],
});
project.setClipWarpRef(clipId, 1);          // reference the map (0 clears it)
project.setClipWarpMode(clipId, 'tempo-sync');
// project.setClipWarpMode(clipId, 'time-stretch'); // same map, stretched on the audio thread
// project.removeWarpMap(1);                 // remove the map by id when done
```

A warp map is a first-class, id-keyed object: `setWarpMap({ id, name, anchors })` adds or replaces one, `setClipWarpRef(clipId, id)` assigns it to a clip (`0` clears the reference), and `project.removeWarpMap(id)` deletes it by id. Removing a map that a clip still references leaves that clip with a dangling warp ref, so clear those clips first with `setClipWarpRef(clipId, 0)`.

::: warning Anchors are yours to maintain, and two of them are the minimum
Anchors are absolute sample-to-sample pairs, and the engine never re-derives them from the tempo map. Editing the tempo with `setTempoSegments(...)` therefore does **not** restretch a warped clip — it moves the clip's start and length on the timeline, so a different amount of the same fixed warp curve gets played. When the tempo changes and the audio should follow it, recompute the anchors in your app and push a new map with `setWarpMap(...)`.

A map also needs at least two anchors before it describes a stretch at all. A `'tempo-sync'` clip with no registered warp map (and no pre-baked warped audio) is a compile error — a dangling source ref, reported by `compile()`. A `'repitch'` or `'time-stretch'` clip with no warp ref at all is not an error: it silently plays at its native rate, exactly as if the mode were `'off'`. What *is* an error in every mode is a clip that references a warp map id nobody registered, which `compile()` reports as the same dangling source ref.
:::

## Takes and comp lanes

A clip can carry alternate **takes** and a **comp** (composite) that stitches the best parts of several takes into one performance. These are first-class on `Project` (`setClipTakes`, `setClipCompSegments`, `addLoopRecordingTakes`) and are covered in depth — including loop-recording capture — on the dedicated page. See [Recording & Takes](./recording-and-takes.md).

## Automation lanes

An **automation lane** changes one host-defined parameter over time with breakpoints. Each breakpoint has a PPQ position, a value, and a curve to the next point (`'linear'`, `'exponential'`, `'hold'`, `'scurve'`).

::: code-group

```typescript [Browser / WASM]
// addAutomationLane returns the lane's target parameter id — the handle the
// edit and remove calls take. Omitting targetKind keeps the legacy opaque lane.
const laneParamId = project.addAutomationLane(trackId, {
  targetParamId: 1,                                   // host id of the parameter to change
  points: [
    { ppq: 0, value: 0.0, curve: 'linear' },
    { ppq: 4, value: 1.0, curve: 'exponential' },
  ],
});
project.editAutomationLane(trackId, laneParamId, { targetParamId: 1, points: [/* … */] });
project.removeAutomationLane(trackId, laneParamId);

const faderLaneId = project.addAutomationLane(trackId, {
  targetParamId: 2,
  targetKind: 'track-fader-db',                   // or 'track-pan'
  points: [
    { ppq: 0, value: 0, curve: 'linear' },       // fader values are dB
    { ppq: 4, value: -6, curve: 'linear' },
  ],
});
project.editAutomationLane(trackId, faderLaneId, {
  targetParamId: 2,
  targetKind: 'track-fader-db',
  points: [{ ppq: 0, value: -3, curve: 'linear' }],
});
```

```python [Python]
lane_param_id = project.add_automation_lane(
    track_id,
    target_param_id=1,                # host id of the parameter to change
    points=[
        (0.0, 0.0, "linear"),         # (ppq, value, curve)
        (4.0, 1.0, "exponential"),
    ],
)
project.edit_automation_lane(track_id, lane_param_id, points=[])
project.remove_automation_lane(track_id, lane_param_id)

fader_lane_id = project.add_automation_lane(
    track_id,
    target_param_id=2,
    target_kind="track-fader-db",     # or "track-pan"
    points=[(0.0, 0.0, "linear"), (4.0, -6.0, "linear")],
)
```

:::

In Python the breakpoints are `(ppq, value, curve)` tuples rather than objects, and `add_automation_lane` / `edit_automation_lane` take `target_param_id` and `points` as separate arguments. Pass `target_kind="opaque"` (or omit it) for the legacy lane, or `"track-fader-db"` / `"track-pan"` for a typed mixer target; Python accepts those names or ordinals `0` / `1` / `2`, and also accepts a mapping descriptor with snake_case or camelCase keys.

The lane's `targetParamId` is your own parameter id; the project stores the breakpoints verbatim and replays them through the compiled timeline. It is also the lane's **identity**: a track holds at most one lane per target, `addAutomationLane` returns that id, and the edit and remove calls address a lane by it. Changing which parameter a lane drives is therefore a remove followed by an add, not an edit.

Typed lanes use `targetKind: 'track-fader-db'` or `'track-pan'` to target the owning track's mixer fader or pan. JavaScript accepts the names or ordinals `0` / `1` / `2`; at compile/install time the project resolves that lane to the engine's reserved parameter namespace (the persistent `targetParamId` is not the realtime id), and an offline bounce applies it through the track mixer. A track may have at most one lane for each typed kind. `targetKind: 'opaque'` is the host-defined legacy target and is used when `targetKind` is omitted. The JSON field is `target_kind`; a project containing a typed lane serializes as schema version `2`, while a project with only opaque lanes keeps schema version `1` and its existing bytes. The C extended entry points are `sonare_project_add_automation_lane_ex` and `sonare_project_edit_automation_lane_ex`; the legacy C calls remain opaque/preserve-kind paths.

::: warning Lanes are addressed by target parameter id, not by position
`editAutomationLane` and `removeAutomationLane` take the target parameter id where they used to take a positional lane index. Both are numbers and the argument count is unchanged, so an index-based call still runs — it just edits a different lane. Audit any call that passed a stored index.
:::


## Where the sections went

| Section | Moved to |
|---|---|
| Key and chord annotation write-back | [MIDI, Compile & Save/Load](./project-editing-midi.md#key-and-chord-annotation-write-back) |
| Assist sidecars | [MIDI, Compile & Save/Load](./project-editing-midi.md#assist-sidecars) |
| MIDI content | [MIDI, Compile & Save/Load](./project-editing-midi.md#midi-content) |
| Auto-tempo and snap-to-grid | [MIDI, Compile & Save/Load](./project-editing-midi.md#auto-tempo-and-snap-to-grid) |
| Compiling the arrangement | [MIDI, Compile & Save/Load](./project-editing-midi.md#compiling-the-arrangement) |
| Save and load: deterministic JSON | [MIDI, Compile & Save/Load](./project-editing-midi.md#save-and-load-deterministic-json) |
| MIDI interchange: SMF and MIDI 2.0 Clip File | [MIDI, Compile & Save/Load](./project-editing-midi.md#midi-interchange-smf-and-midi-2-0-clip-file) |
| Rendering audio | [MIDI, Compile & Save/Load](./project-editing-midi.md#rendering-audio) |

## Related

- [Editing Basics](./glossary/concepts/editing-basics.md) — the vocabulary, for newcomers
- [Project Bounce & Rendering](./project-bounce.md) — render the timeline to audio, with or without instruments
- [Recording & Takes](./recording-and-takes.md) — takes, comp lanes, and loop-recording capture
- [Native Synth](./native-synth.md) · [SoundFont Player](./soundfont-player.md) — make MIDI tracks audible
- [MIDI Input](./midi-input.md) — play a project live from a controller
- [Mixing Scene JSON](./mixing-scene-json.md) — the scene a track routes into
- [Binding Parity](./binding-parity.md) — per-runtime API differences
