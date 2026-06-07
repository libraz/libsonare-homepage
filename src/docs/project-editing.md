---
title: Project & Arrangement Editing
description: Beginner-friendly guide to libsonare's headless-DAW edit surface — the Project model, clip and track operations, undo/redo, the tempo map and time signatures, warp modes, automation, MIR write-back, compile diagnostics, JSON save/load, and SMF / MIDI 2.0 Clip File import-export, with copy-paste recipes.
---

# Project & Arrangement Editing

**Want to build a song's arrangement in code — without opening a DAW?** That is what `Project` is for. A **project** is the timeline that holds everything a song is made of: audio tracks, MIDI tracks, the clips placed on them, the tempo map, time signatures, and markers. libsonare ships a `Project` model — a small, headless DAW edit surface — so you can build, edit, and serialize that timeline **inside your own app**, with no DAW host required.

The workflow is a short loop: you assemble an arrangement, edit it with undoable operations, [compile](#compiling-the-arrangement) it into a renderable timeline, save it to JSON, and finally [render audio](#rendering-audio). `Project` is an **offline, control-thread API** (it never runs on the audio thread), and it behaves identically in the browser (WASM), Node, and Python.

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
- A MIDI track points at an instrument **destination** (the synth or sampler that will actually make its notes audible).
- Every track routes through a strip in the **mixer scene** — its channel of EQ, fader, pan, and sends — on its way to the master.

::: info What is a MIDI "destination"?
MIDI notes are just instructions (play note 60 now), not sound. A **destination** is the instrument those instructions are sent to — the synth or sampler that turns them into audio. A MIDI track names a destination; you bind an actual instrument to it when you render. See [Project Bounce](./project-bounce.md).
:::

```mermaid
flowchart TD
  P[Project] --> T1[Audio track]
  P --> T2[MIDI track]
  P --> AUTO[Automation lanes]
  T1 --> C1[Audio clip<br/>takes / comp segments]
  T2 --> C2[MIDI clip<br/>note events]
  C2 --> DEST[MIDI destination<br/>instrument]
  T1 --> SCENE[Mixer scene strip]
  T2 --> SCENE
  SCENE --> MASTER[Master bus]
```

## The edit flow at a glance

Keep this mental model in mind before reading the API list. You edit a `Project`; compiling checks that the timeline makes sense; bouncing turns the compiled timeline into audio samples.

```mermaid
flowchart LR
  A[Decoded audio or MIDI events] --> B[Project tracks and clips]
  B --> C[Undoable edits]
  C --> D[compile()]
  D --> E{Diagnostics}
  E -->|no errors| F[bounce / instrument bounce]
  E -->|errors| G[Fix clip, track, or routing]
  F --> H[Interleaved Float32 audio]
```

Two points prevent most beginner mistakes:

- `compile()` does not make sound; it validates and prepares the arrangement.
- Plain `bounce()` renders audio tracks only. MIDI tracks need an instrument-bound bounce such as `bounceWithSynthInstrument(...)` or `bounceWithSf2Instrument(...)`.

## What You Will Learn

By the end of this page you should be able to:

- create a `Project`, add audio and MIDI tracks, and place clips on them;
- edit clips (split, trim, move, gain, fade, loop, re-source, duplicate, remove) and tracks (add, rename, route, change kind, remove) through **undoable** operations;
- place musical time correctly using PPQ, a tempo map with tempo segments, time signatures, and markers;
- choose a clip overlap policy and a warp mode (`off` / `repitch` / `tempo-sync`) with warp anchors;
- write key/chord annotations and automation lanes onto the project;
- compile to a renderable timeline and read its structured diagnostics and non-fatal warnings;
- save and load with deterministic JSON, and exchange MIDI through SMF and the MIDI 2.0 Clip File format.

## Create a project and add content

Every project starts empty. Set a sample rate, add tracks, then add clips. `addTrack` and `addClip` return stable integer ids you reuse for every later edit. Positions and lengths are in **PPQ**.

::: code-group

```typescript [Browser / Node]
import { init, Project } from '@libraz/libsonare';

await init();

const project = new Project();
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

::: danger Always release the project
`Project`, like every WASM-backed object, holds a heap handle that JavaScript's garbage collector cannot reclaim. Call `project.delete()` (Node also accepts `destroy()`) in a `finally` block. In Python use `Project` as a context manager (`with sonare.Project() as project:`) or call `project.close()`. Leaking handles slowly exhausts WASM memory in long sessions.
:::

## Editing clips

Every clip operation is a single undoable command and addresses the clip by its id.

| Operation | Method | What it does |
|-----------|--------|--------------|
| Split | `splitClip(clipId, splitPpq)` | Cuts the clip at an absolute PPQ; returns the new clip's id |
| Trim | `trimClip(clipId, newStartPpq, newLengthPpq)` | Resets start and length |
| Move | `moveClip(clipId, newStartPpq, newTrackId?)` | Slides the clip, optionally to another track |
| Gain | `setClipGain(clipId, gain)` | Linear per-clip playback gain (`>= 0`) |
| Fade | `setClipFade(clipId, fadeIn, fadeOut)` | Fade-in / fade-out regions with a curve |
| Loop | `setClipLoop(clipId, mode, loopLengthPpq?)` | `'off'` or `'loop'` with a loop length |
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
project.setClipLoop(tailId, 'loop', 2);      // loop the tail every two beats
const copyId = project.duplicateClip(tailId, 8);
```

Fade curves are `'linear'`, `'equal-power'`, `'exponential'`, and `'logarithmic'`. Loop mode is `'off'` or `'loop'`; a positive `loopLengthPpq` is required when looping.

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
project.set_clip_loop(tail_id, "loop", 2.0)
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

```typescript
const drums = project.addTrack({ kind: 'audio', name: 'drums' });
project.renameTrack(drums, 'drum-bus');
project.setTrackRoute(drums, 'strip-drums', 'master'); // wire to a mixer scene strip
```

An **aux** track carries no clips of its own — it is a routing/return lane (for example an effect return or a submix) rather than a place to record content.

`setTrackRoute` links a project track to a strip in the project's [mixer scene](./mixing-scene-json.md) (set with `setMixerSceneJson`) so the bounced track flows through that channel strip's processing.

## Undo and redo

The project keeps an **edit history**. Every clip, track, automation, and annotation operation pushes a command you can reverse.

```typescript
project.setClipGain(clipId, 0.3);
project.undo();   // gain returns to its previous value
project.redo();   // re-applies the gain edit
```

Because the history is exact, calling `toJson()` before an edit, undoing, and calling `toJson()` again yields byte-identical JSON — a useful invariant for testing and for change detection in an editor UI.

## Musical time: PPQ, tempo, time signatures, markers

All positions are in **PPQ** (quarter notes as a floating-point value, so fractional beats are exact). Tempo and time signatures live in the project as ordered segment lists.

### Tempo map and tempo segments

The **tempo map** is a list of tempo segments. Each segment starts at a PPQ position and sets a BPM; an optional `endBpm` makes the segment ramp linearly to a new tempo.

```typescript
project.setTempoSegments([
  { startPpq: 0,  bpm: 120 },                 // constant 120 BPM from the top
  { startPpq: 16, bpm: 120, endBpm: 140 },    // ramp 120 -> 140 over this segment
  { startPpq: 32, bpm: 140 },
]);
project.tempoSegmentCount(); // 3
```

### Time signatures

Time signatures are a parallel list of segments, each with a numerator (beats per bar) and denominator (beat unit).

```typescript
project.setTimeSignatures([
  { startPpq: 0,  numerator: 4, denominator: 4 },
  { startPpq: 64, numerator: 3, denominator: 4 },  // switch to 3/4 later
]);
```

### Markers

Markers label positions on the timeline. Pass marker id `0` to allocate a new id; the call returns the stable id.

```typescript
const introId = project.setMarker(0, 0,  'intro');
project.setMarker(0, 16, 'verse');
project.setMarker(introId, 0, 'intro (edited)'); // update by reusing the id
```

In Python: `set_tempo_segments`, `set_time_signatures`, and `set_marker` accept the same fields (mappings or tuples for the segment lists).

## Overlap policy

The **overlap policy** decides whether two clips on the same track may occupy the same time span. It is project-wide.

```typescript
project.setOverlapPolicy(0); // disallow overlapping clips (default)
project.setOverlapPolicy(1); // allow overlap (e.g. crossfades, layered takes)
project.getOverlapPolicy();  // read it back
```

`0` disallows overlaps; `1` allows them. Allow overlaps when you intend layered clips or crossfades; disallow to keep a track strictly sequential.

## Warp: stretching clips to the grid

**Warp** lets a recorded audio clip follow the project's tempo instead of playing back at its fixed original speed — think of nudging and stretching a recording so its beats land on the grid. It does this by decoupling the clip's recorded timeline from project time. Each clip has a warp **mode** and an optional **warp map** of anchors.

| Warp mode | Meaning |
|-----------|---------|
| `'off'` | Play the audio at its native rate; ignore tempo |
| `'repitch'` | Speed up / slow down with the tempo (pitch moves too, like a tape) |
| `'tempo-sync'` | Time-stretch to follow the tempo while preserving pitch |

::: info How tempo-sync keeps the pitch
`'tempo-sync'` time-stretches the audio with a **phase vocoder** — an STFT-based time-stretch that changes the timing without changing the pitch (unlike `'repitch'`, which moves both like a tape). The same algorithm runs in both realtime playback and offline [bounce](./project-bounce.md), so a warped clip sounds identical whichever way you render it.
:::

<SonareDemo id="time-stretch" />

A **warp map** is a list of anchors, and each anchor is a "this moment in the recording belongs here on the timeline" pin. Concretely, each `ProjectWarpAnchor` ties a `warpSample` (a position on the project/warped timeline) to a `sourceSample` (the matching position in the recorded audio); the engine stretches the audio smoothly between consecutive anchors.

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
// project.removeWarpMap(1);                 // remove the map by id when done
```

## Takes and comp lanes

A clip can carry alternate **takes** and a **comp** (composite) that stitches the best parts of several takes into one performance. These are first-class on `Project` (`setClipTakes`, `setClipCompSegments`, `addLoopRecordingTakes`) and are covered in depth — including loop-recording capture — on the dedicated page. See [Recording & Takes](./recording-and-takes.md).

## Automation lanes

An **automation lane** drives one host-defined parameter over time with breakpoints. Each breakpoint has a PPQ position, a value, and a curve to the next point (`'linear'`, `'exponential'`, `'hold'`, `'scurve'`).

```typescript
const lane = project.addAutomationLane(trackId, {
  targetParamId: 1,                                   // host id of the parameter to drive
  points: [
    { ppq: 0, value: 0.0, curve: 'linear' },
    { ppq: 4, value: 1.0, curve: 'exponential' },
  ],
});
project.editAutomationLane(trackId, lane, { targetParamId: 1, points: [/* … */] });
project.removeAutomationLane(trackId, lane);
```

The lane's `targetParamId` is your own parameter id; the project stores the breakpoints verbatim and replays them through the compiled timeline.

## Key and chord annotation write-back

A project can carry musical annotations — the **key** regions and **chord** symbols that an analyzer produced — so they travel with the arrangement and survive save/load. Both streams are replace-in-full and undoable.

```typescript
project.annotateKeys([
  { startPpq: 0, endPpq: 16, tonicPc: 0, mode: 1 }, // C major (tonicPc 0, mode 1 = major)
]);
project.annotateChords([
  { startPpq: 0, endPpq: 4, rootPc: 0, quality: 1, romanNumeral: 'I' },
  { startPpq: 4, endPpq: 8, rootPc: 7, quality: 1, romanNumeral: 'V' },
]);
```

Pitch classes are `0..11` (C = 0) or `255` for unknown; `mode` and `quality` are small ordinals (key mode `1` = major, `2` = minor; chord quality `1` = major, `2` = minor, …).

## MIDI content

A MIDI clip holds a flat event list. Build events with the `Project.midi*` static packers (which produce the canonical MIDI 1.0 words) and replace the clip's list with `setMidiEvents`.

```typescript
project.setMidiEvents(midiClip, [
  Project.midiNoteOn(0, 0, 0, 60, 100),  // (ppq, group, channel, note, velocity)
  Project.midiNoteOff(2, 0, 0, 60),
  Project.midiNoteOn(2, 0, 0, 64, 100),
  Project.midiNoteOff(4, 0, 0, 64),
]);
project.setProgram(midiClip, 4);          // GM program (e.g. 4 = electric piano)
```

### `validateMidiNotes`

Before bouncing, check a MIDI clip for hanging notes — a note-on with no matching note-off (or vice versa) plays a stuck note. `validateMidiNotes` pairs note-ons and note-offs FIFO per channel + note and reports the result.

```typescript
const check = project.validateMidiNotes(midiClip);
// { ok: true, unmatchedNoteOns: 0, unmatchedNoteOffs: 0 }
if (!check.ok) {
  console.warn(`hanging notes: ${check.unmatchedNoteOns} on / ${check.unmatchedNoteOffs} off`);
}
```

To make a MIDI arrangement audible you bind an instrument at render time — see [Rendering audio](#rendering-audio), the [native synth](./native-synth.md), and the [SoundFont player](./soundfont-player.md). For driving a project live from a controller, see [MIDI input](./midi-input.md).

### Bake a MIDI-FX chain into a clip

A MIDI-FX chain (transpose, velocity curve, humanize, and so on) normally sits as a **non-destructive** layer over a clip's events. `bakeMidiFx` does the opposite: it runs the chain once and **rewrites the clip's stored MIDI events** with the result, so the transformed notes become the clip's real content. Bake when you want to freeze an effect into the arrangement; keep it non-destructive when you still want to tweak it.

```typescript
const configJson = JSON.stringify({ transpose: 12 }); // up one octave
project.bakeMidiFx(midiClip, configJson);              // events are now transposed in place
```

In Python this is `project.bake_midi_fx(clip_id, config_json)`. Because the rewrite is destructive, it is an undoable edit like any other — `undo()` restores the original events.

## Auto-tempo and snap-to-grid

Two helpers align edits to the beat:

- **`autoTempo(audio, sampleRate)`** detects the tempo from a mono buffer, installs it as the tempo map, and returns the primary BPM.
- **`snapToGrid(ppq, strength)`** snaps a PPQ coordinate to the nearest beat of the project grid. `strength` is `0..1` (1 = snap fully).

```typescript
const bpm = project.autoTempo(monoMix, 48000); // detect + install tempo, returns ~120
const snapped = project.snapToGrid(1.2, 1.0);  // 1.2 -> 1 (nearest beat)
```

## Compiling the arrangement

`compile()` turns the edited project into a **renderable timeline** and reports structured **diagnostics**. Errors (severity `0`) mean the timeline could not be built; warnings (severity `1`) are non-fatal and the timeline is still renderable.

```typescript
const result = project.compile();
// result.hasTimeline     -> true when a renderable timeline was produced (no errors)
// result.diagnosticCount -> number of diagnostics
// result.diagnostics     -> [{ code, severity, targetId, message }, …]
// result.messages        -> newline-joined human-readable detail

if (!result.hasTimeline) {
  for (const d of result.diagnostics) {
    if (d.severity === 0) console.error(`compile error (clip/track ${d.targetId}): ${d.message}`);
  }
}
```

A common **non-fatal** warning: a project with MIDI clips but no bound instrument compiles fine, but bounces silently. After a bounce you can read the warnings that render produced with `lastBounceCompileResult()`:

```typescript
project.bounce({ numChannels: 2 });
const last = project.lastBounceCompileResult();
// last.diagnostics[0].message ->
//   "project contains MIDI clips; bounce is silent unless an instrument is bound"  (severity 1)
```

In Python, `project.compile()` returns the same shape (`has_timeline`, `diagnostic_count`, `diagnostics`, `messages`).

## Save and load: deterministic JSON

`toJson()` serializes the whole project — tracks, clips, MIDI content, tempo map, time signatures, markers, annotations, warp maps, and automation — to **deterministic JSON**: the same project always produces byte-identical text. `Project.fromJson(...)` restores it.

```typescript
const json = project.toJson();
// … persist `json` to disk, a database, or postMessage …

const restored = Project.fromJson(json);
try {
  // restored.toJson() === json
} finally {
  restored.delete();
}
```

Use `Project.fromJsonWithDiagnostics(json)` when you want to recover non-fatal load warnings (for example dangling source references preserved for repair):

```typescript
const { project: loaded, diagnostics } = Project.fromJsonWithDiagnostics(json);
try {
  if (diagnostics) console.warn(diagnostics);
} finally {
  loaded.delete();
}
```

Python mirrors this with `project.to_json()`, `Project.from_json(json)`, and `Project.from_json_with_diagnostics(json)`.

## MIDI interchange: SMF and MIDI 2.0 Clip File

The project's tempo map and MIDI clips round-trip through two formats.

### Standard MIDI File (SMF)

```typescript
const smf = project.exportSmf();        // Uint8Array, "MThd" header
// … write `smf` to a .mid file …

const fresh = new Project();
try {
  const firstClip = fresh.importSmf(smf); // returns the first added clip id
} finally {
  fresh.delete();
}
```

### MIDI 2.0 Clip File (`SMF2CLIP`)

SMF predates MIDI 2.0, so it cannot carry 16-bit velocity, 32-bit CC, per-note controllers, or bank-valid Program Change without loss. The **MIDI 2.0 Clip File** (`SMF2CLIP`) preserves all of that. Prefer it when MIDI 2.0 fidelity matters.

```typescript
const clipFile = project.exportClipFile();   // Uint8Array, "SMF2CLIP" header
const firstClip = otherProject.importClipFile(clipFile);
```

In Python these are `export_smf` / `import_smf` and `export_clip_file` / `import_clip_file`, returning and accepting `bytes`.

## Rendering audio

Editing produces a timeline; **rendering** turns it into samples. `Project` bounces offline through `bounce(...)` (audio tracks only) or one of the instrument-bound bounces (`bounceWithBuiltinInstrument`, `bounceWithSynthInstrument`, `bounceWithSf2Instrument`) that make MIDI tracks audible. The full set of render options, instrument binding, SoundFont loading, and the diagnostics a bounce surfaces are covered on [Project Bounce & Rendering](./project-bounce.md).

```typescript
// Audio-only quick render. MIDI tracks are silent here.
const audio = project.bounce({ numChannels: 2 });
```

Once your arrangement compiles cleanly, the natural next step is turning it into audio — including making MIDI tracks audible. Continue with [Project Bounce & Rendering](./project-bounce.md).

## Related

- [Editing Basics](./glossary/concepts/editing-basics.md) — the vocabulary, for newcomers
- [Project Bounce & Rendering](./project-bounce.md) — render the timeline to audio, with or without instruments
- [Recording & Takes](./recording-and-takes.md) — takes, comp lanes, and loop-recording capture
- [Native Synth](./native-synth.md) · [SoundFont Player](./soundfont-player.md) — make MIDI tracks audible
- [MIDI Input](./midi-input.md) — drive a project live from a controller
- [Mixing Scene JSON](./mixing-scene-json.md) — the scene a track routes into
- [Binding Parity](./binding-parity.md) — per-runtime API differences
