---
title: Project MIDI
description: Project-level MIDI annotations, tempo, interchange, and links to clip editing, MIDI 2.0, transcription, and save/load.
---

# Project MIDI

This page is the project-level MIDI hub. Use the task pages for detailed event editing, audio transcription, note editing, MIDI 2.0, and persistence; the anchors below remain on this page for links written against the earlier layout.

| Task | Guide |
|---|---|
| Turn audio into note events | [Audio to MIDI](./audio-to-notes.md) |
| Edit measured notes inside audio | [Note Editing in Audio](./note-editing.md) |
| Edit a MIDI clip | [Edit MIDI Clips](./midi-editing.md) |
| Keep MIDI 2.0 values and UMP words | [MIDI 2.0, UMP, and Clip Files](./midi2.md) |
| Compile, save, load, and rebind a project | [Compile, Save, and Load Projects](./project-save-load.md) |

## Key and chord annotation write-back

A project can carry musical annotations — the **key** regions and **chord** symbols that an analyzer produced — so they travel with the arrangement and survive save/load. Both streams are replace-in-full and undoable.

::: code-group

```typescript [Browser / WASM]
project.annotateKeys([
  { startPpq: 0, endPpq: 16, tonicPc: 0, mode: 1 }, // C major (tonicPc 0, mode 1 = major)
]);
project.annotateChords([
  { startPpq: 0, endPpq: 4, rootPc: 0, quality: 1, romanNumeral: 'I' },
  { startPpq: 4, endPpq: 8, rootPc: 7, quality: 1, romanNumeral: 'V' },
]);
```

```python [Python]
project.annotate_keys([
    (0.0, 16.0, 0, 1),  # (start_ppq, end_ppq, tonic_pc, mode) — C major
])
project.annotate_chords([
    {"start_ppq": 0.0, "end_ppq": 4.0, "root_pc": 0, "quality": 1, "roman_numeral": "I"},
    {"start_ppq": 4.0, "end_ppq": 8.0, "root_pc": 7, "quality": 1, "roman_numeral": "V"},
])
```

:::

In Python `annotate_keys` takes `(start_ppq, end_ppq, tonic_pc, mode)` tuples while `annotate_chords` takes mappings with the same fields as the WASM objects (snake_case keys).

The numeric fields are small fixed encodings:

- **Pitch class** (`tonicPc`, `rootPc`): `0..11` with C = 0, C#/Db = 1, … B = 11; `255` means unknown.
- **Key mode** (`mode`): `1` = major, `2` = minor.
- **Chord quality** (`quality`): `1` = major, `2` = minor, `3` = diminished, `4` = augmented, `5` = dominant, `6` = half-diminished, `7` = suspended. `extensions` distinguishes variants within a family (see [Chord Recognition](./glossary/analysis/chord-recognition.md) for detector qualities).

So `{ tonicPc: 0, mode: 1 }` is C major and `{ rootPc: 7, quality: 1 }` is a G major chord.

::: warning These are arrangement ordinals, not the analysis enums
The `mode` and `quality` numbers here are **arrangement ordinals**, distinct from the **0-based** `Mode` and `ChordQuality` enums returned by `detectKey` / `detectChords`. Key modes and the four basic triads are offset by one (major = 0 in analysis, 1 here), so passing analysis `ChordQuality.Minor` (= 1) directly to `annotateChords` would label the chord **major**. The `+1` conversion applies only to those four triads. Extended detector qualities need an explicit family and `extensions` mapping: for example, Dominant7 → `{ quality: 5, extensions: [7] }`, HalfDim7 → `{ quality: 6, extensions: [7] }`, and Sus4 → `{ quality: 7, extensions: [4] }`.
:::

## Assist sidecars

An **assist sidecar** is an opaque, undoable per-project metadata blob — a place to stash an AI-assist suggestion, a tooling payload, or any binary annotation that should travel with the arrangement. Each sidecar is keyed by a **module id** plus a **target scope** (a track id and a PPQ region), and the whole store serializes under the project JSON `assist_sidecars` key, so it survives `toJson()` / `fromJson()` round-trips.

```typescript
const payload = new TextEncoder().encode(JSON.stringify({ suggestion: 'tighten chorus' }));
project.setAssistSidecar({
  moduleId: 'my-assistant',  // must be non-empty
  schemaVersion: 1,
  targetTrackId: 0,          // 0 = project scope
  regionStartPpq: 0,
  regionEndPpq: 16,
  payload,                    // Uint8Array (copied)
});

project.assistSidecars();     // all descriptors in stable project order
project.getAssistSidecar(0);  // { moduleId, schemaVersion, targetTrackId,
                              //   regionStartPpq, regionEndPpq, payload }
```

A sidecar that shares the same `moduleId` + `targetTrackId` + region scope as an existing one **replaces** it; otherwise it is appended. `targetTrackId` `0` means project scope. Because the write is an undoable edit, `undo()` / `redo()` reverse it.

The descriptor form above is the canonical **WASM and Node** JavaScript API; WASM also keeps the legacy positional overload `setAssistSidecar(moduleId, schemaVersion, targetTrackId, regionStartPpq, regionEndPpq, payload)`. Both JavaScript bindings expose the count, index accessor, and `assistSidecars()` all-at-once reader. **Python** uses `set_assist_sidecar(module_id, payload, *, schema_version=0, target_track_id=0, region_start_ppq=0.0, region_end_ppq=0.0)` (a mapping descriptor is also accepted), plus `assist_sidecar_count()`, `get_assist_sidecar(index)`, and `assist_sidecars()`. The C ABI remains positional as `sonare_project_set_assist_sidecar(...)`, with the matching count/get/free functions.

## MIDI content

MIDI clip construction, note-pair validation, captured-stream routing, and MIDI-FX baking now live in [Edit MIDI Clips](./midi-editing.md#midi-content).

### `validateMidiNotes`

See [`validateMidiNotes` in Edit MIDI Clips](./midi-editing.md#validatemidinotes).

### Route a captured MIDI stream

See [Route a captured MIDI stream](./midi-editing.md#route-a-captured-midi-stream).

### Bake a MIDI-FX chain into a clip

See [Bake a MIDI-FX chain into a clip](./midi-editing.md#bake-a-midi-fx-chain-into-a-clip).

## Auto-tempo and snap-to-grid

Two helpers align edits to the beat:

- **`autoTempo(audio, sampleRate)`** detects the tempo from a mono buffer, installs it as the tempo map, and returns the primary BPM.
- **`snapToGrid(ppq, strength)`** snaps a PPQ coordinate to the nearest beat of the project grid. `strength` is `0..1` (1 = snap fully).

```typescript
const bpm = project.autoTempo(monoMix, 48000); // detect + install tempo, returns ~120
const snapped = project.snapToGrid(1.2, 1.0);  // 1.2 -> 1 (nearest beat)
```

### Transcribe audio into a MIDI clip

See [Audio to MIDI](./audio-to-notes.md#transcribe-audio-into-a-midi-clip).

## Compiling the arrangement

See [Compile, Save, and Load Projects](./project-save-load.md#compiling-the-arrangement).

## Save and load: deterministic JSON

See [Save and load: deterministic JSON](./project-save-load.md#save-and-load-deterministic-json).

### Reading the model back, and rebinding audio after a load

See [Reading the model back, and rebinding audio after a load](./project-save-load.md#reading-the-model-back-and-rebinding-audio-after-a-load).

### Importing host-separated stems

See [Importing host-separated stems](./project-save-load.md#importing-host-separated-stems).

## MIDI interchange: SMF and MIDI 2.0 Clip File

The two interchange formats have different jobs. The [MIDI 2.0 guide](./midi2.md) covers full-resolution UMP and Clip File fidelity; this hub keeps the SMF compatibility facts that matter when choosing a file format.

### Standard MIDI File (SMF)

`exportSmf` always writes a format-1 (multi-track) file: track 0 carries the tempo + time-signature map, then one MTrk per clip, quantized to 480 ticks per quarter note.

```typescript
const smf = project.exportSmf();        // Uint8Array<ArrayBuffer> — SMF format-1, 480 PPQN
// … write `smf` to a .mid file …

const fresh = new Project();
try {
  const firstClip = fresh.importSmf(smf); // returns the first added clip id
} finally {
  fresh.delete();
}
```

`exportSmf()` and `exportClipFile()` are declared `Uint8Array<ArrayBuffer>`, the type the `Blob` and `File` constructors accept, so `new Blob([project.exportSmf()])` compiles with no intermediate `new Uint8Array(...)` copy.

The importer contains damage locally: if one SMF track has an overlong variable-length quantity or payload, parsing resynchronizes at that track's declared boundary so later valid tracks can still import instead of the whole file failing.

What an SMF round-trips is a *performance* — and engraved, that same note list is a score. The grand staff below is the notation view of a MIDI clip; press play to hear the events it stores.

<SonareDemo id="midi-score" />

### MIDI 2.0 Clip File (`SMF2CLIP`)

See [MIDI 2.0 Clip File](./midi2.md#midi-2-0-clip-file-smf2clip) for the lossless MIDI 2.0 path.

### An SMF as a reference melody: note targets

See [An SMF as a reference melody](./note-editing.md#an-smf-as-a-reference-melody-note-targets).

## Rendering audio

Editing produces a timeline; **rendering** turns it into samples. `Project` bounces offline through `bounce(...)` (audio tracks only) or one of the instrument-bound bounces (`bounceWithBuiltinInstrument`, `bounceWithSynthInstrument`, `bounceWithSf2Instrument`) that make MIDI tracks audible. The full set of render options, instrument binding, SoundFont loading, and the diagnostics reported by a bounce are covered on [Project Bounce & Rendering](./project-bounce.md).

```typescript
// Audio-only quick render. MIDI tracks are silent here.
const audio = project.bounce({ numChannels: 2 });
```

Once your arrangement compiles cleanly, the natural next step is turning it into audio — including making MIDI tracks audible. Continue with [Project Bounce & Rendering](./project-bounce.md).

## Related

- [Project Editing](./project-editing.md) — tracks, clips, tempo, markers, warp, and automation
- [Edit MIDI Clips](./midi-editing.md) — event lists and MIDI-FX
- [MIDI 2.0, UMP, and Clip Files](./midi2.md) — full-resolution MIDI messages and Clip Files
- [Audio to MIDI](./audio-to-notes.md) — transcription onto a constant or project tempo map
- [Compile, Save, and Load Projects](./project-save-load.md) — timeline compilation and persistence
- [MIDI Input](./midi-input.md) — live controller input
- [Bouncing Projects](./project-bounce.md) — render the timeline and bound instruments
