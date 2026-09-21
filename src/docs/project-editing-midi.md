---
title: Project MIDI, Compiling and Save/Load
description: MIDI events and MIDI-FX baking on a Project, key/chord annotation write-back, assist sidecars, auto-tempo, compiling to a renderable timeline, deterministic JSON save/load, and SMF / MIDI 2.0 Clip File import-export.
---

# Project MIDI, Compiling and Save/Load

This page continues [Project & Arrangement Editing](./project-editing.md): MIDI content on a `Project`, key/chord annotation write-back, assist sidecars, auto-tempo, compiling to a renderable timeline, deterministic JSON save/load, and SMF / MIDI 2.0 Clip File interchange.

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
- **Chord quality** (`quality`): `1` = major, `2` = minor, `3` = diminished, `4` = augmented (see [Chord Recognition](./glossary/analysis/chord-recognition.md) for the full list).

So `{ tonicPc: 0, mode: 1 }` is C major and `{ rootPc: 7, quality: 1 }` is a G major chord.

::: warning These are arrangement ordinals, not the analysis enums
The `mode` and `quality` numbers here are **1-based arrangement ordinals** (major = 1), distinct from the **0-based** `Mode` and `ChordQuality` enums that `detectKey` / `detectChords` return (major = 0, minor = 1, diminished = 2, augmented = 3). They are off by one and cannot be passed through: feeding a `ChordQuality.Minor` (= 1) straight from the analysis API into `annotateChords`'s `quality` would label the chord **major** here. Remap analysis-API results before annotating (e.g. `quality = analysisQuality + 1`).
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

A MIDI clip holds a flat event list. Build events with the `Project.midi*` static packers (which produce the canonical MIDI 1.0 words) and replace the clip's list with `setMidiEvents`.

::: code-group

```typescript [Browser / WASM]
project.setMidiEvents(midiClip, [
  Project.midiNoteOn(0, 0, 0, 60, 100),  // (ppq, group, channel, note, velocity)
  Project.midiNoteOff(2, 0, 0, 60),
  Project.midiNoteOn(2, 0, 0, 64, 100),
  Project.midiNoteOff(4, 0, 0, 64),
]);
project.setProgram(midiClip, 4);          // GM program (e.g. 4 = electric piano)
```

```python [Python]
project.set_midi_events(midi_clip, [
    Project.midi_note_on(0.0, 0, 0, 60, 100),  # (ppq, group, channel, note, velocity)
    Project.midi_note_off(2.0, 0, 0, 60),
    Project.midi_note_on(2.0, 0, 0, 64, 100),
    Project.midi_note_off(4.0, 0, 0, 64),
])
project.set_program(midi_clip, 4)          # GM program (e.g. 4 = electric piano)
```

:::

In Python the static packers are `Project.midi_note_on(...)` / `Project.midi_note_off(...)`, each returning a `(ppq, data0, data1)` tuple, and the events list is any sequence of those tuples.

`setProgram` takes an optional third `bank` argument — `setProgram(clipId, program, bank = -1)` — that defaults to `-1` (no Bank Select emitted); pass a value `>= 0` to emit a Bank Select ahead of the program change. To change the program on a specific UMP (Universal MIDI Packet) group and channel rather than the clip default, use `setProgramOnChannel(clipId, group, channel, program, bank?)`. Both take the same optional `bank` across the WASM, Node, and Python bindings (`set_program(clip_id, program, bank=-1)`, `set_program_on_channel(clip_id, group, channel, program, bank=-1)`).

::: warning `ppq` is in quarter notes, not ticks
The `ppq` argument is a **position in quarter notes** (a float), *not* a MIDI tick count. `Project.midiNoteOn(1, …)` is one quarter note in; `Project.midiNoteOn(0.5, …)` is an eighth note in. Despite the name, it is **not** 480-ticks-per-quarter — `Project.midiNoteOn(480, …)` schedules the note 480 quarter notes (120 bars) away, almost always far past your render window, so it silently never sounds. If you are converting from a tick-based source (an SMF at 480 PPQ, say), divide by the source's ticks-per-quarter first. The same unit applies to `addMidiClip(startPpq, lengthPpq)` and every clip/automation position on this page.
:::

Every shipped static packer returns one or more MIDI 1.0 UMP words ready to drop into a `setMidiEvents` list:

| Packer | Signature | Event |
|--------|-----------|-------|
| Note on | `Project.midiNoteOn(ppq, group, channel, note, velocity)` | Note-on |
| Note off | `Project.midiNoteOff(ppq, group, channel, note, velocity?=0)` | Note-off |
| Control change | `Project.midiCc(ppq, group, channel, controller, value)` | CC |
| Program change | `Project.midiProgram(ppq, group, channel, program)` | Program-change |
| Bank + program | `Project.midiBankProgram(ppq, group, channel, bankMsb, bankLsb, program)` | Bank-select + program-change (returns multiple events) |
| Poly pressure | `Project.midiPolyPressure(ppq, group, channel, note, pressure)` | Per-note aftertouch |
| Channel pressure | `Project.midiChannelPressure(ppq, group, channel, pressure)` | Channel aftertouch |
| Pitch bend | `Project.midiPitchBend(ppq, group, channel, bend)` | Pitch-bend; `bend` is unsigned 14-bit (`0`..`16383`, center `8192`) — out-of-range throws `RangeError` |

The event-level `Project.midiProgram(...)` packer places a program-change word inside a clip's event list; it is distinct from the clip-level `project.setProgram(midiClip, program)` convenience shown above, which sets the clip's default program directly.

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

### Route a captured MIDI stream

`Project.midiRouteEvents(events, config?)` is a static helper that runs a captured `ProjectMidiEvent` stream through the native `MidiRouter` (filter / remap / channel-thru) — the same router the live runtime uses — and returns a `ProjectMidiRouteResult`. Use it to pre-filter or remap recorded input offline before building clips.

```typescript
const routed = Project.midiRouteEvents(capturedEvents, {
  filterGroup: 0,        // keep group 0 only (omit / null = any)
  filterChannel: 9,      // keep channel 9 (the drum channel)
  remapChannel: 0,       // rewrite surviving events onto channel 0
  thru: true,            // pass matching events through
});
// routed.events       -> ProjectMidiEvent[]
// routed.overflowed   -> true if the router buffer dropped events
// routed.overflowCount-> number of dropped events
project.setMidiEvents(midiClip, routed.events);
```

Config fields are all optional and camelCase in JS/WASM (`filterGroup`, `filterChannel`, `remapChannel`, `thru`); a `null` or omitted filter field means "any", and an omitted `remapChannel` leaves the channel unchanged. Python uses snake_case (`filter_group`, `filter_channel`, `remap_channel`, `thru`). The helper ships across WASM, Node, and Python. Pair it with the offline MIDI-learn flow (`Project.midiCcLearn`, covered in [MIDI input](./midi-input.md)).

### Bake a MIDI-FX chain into a clip

A MIDI-FX chain (transpose, velocity curve, humanize, and so on) normally sits as a **non-destructive** layer over a clip's events. `bakeMidiFx` does the opposite: it runs the chain once and **rewrites the clip's stored MIDI events** with the result, so the transformed notes become the clip's real content. Bake when you want to freeze an effect into the arrangement; keep it non-destructive when you still want to tweak it.

```typescript
const configJson = JSON.stringify({ transpose_semitones: 12 }); // up one octave
project.bakeMidiFx(midiClip, configJson);                        // events are now transposed in place
```

When an editor needs to preserve a selection or annotation through the rewrite, use the request form. `sourceIndex` has one entry per transformed event in canonical order: it names the input event the output derives from, or `-1` when no input event produced it. A chord or arpeggiator can produce several events with the same source index.

```typescript
const count = project.previewMidiFxCount({ clipId: midiClip, configJson });
const { sourceIndex } = project.bakeMidiFx({
  clipId: midiClip,
  configJson,
  withSourceIndex: true,
});
```

`previewMidiFxCount(...)` runs the same deterministic transform without changing the project, so its result is the exact number of events the following bake produces. The positional `bakeMidiFx(clipId, configJson)` form remains available and returns no provenance. Python uses `project.preview_midi_fx_count(clip_id, config_json)` and `project.bake_midi_fx(clip_id, config_json, with_source_index=True)`.

The config is a JSON object whose **stages are keyed by their parameters** — include a stage's keys to enable it, omit them to skip it. Unknown keys are ignored, so a typo silently does nothing:

| Stage | Keys |
|-------|------|
| Transpose | `transpose_semitones` |
| Velocity curve | `velocity_scale`, `velocity_offset`, `velocity_gamma` (>0) |
| Quantize | `quantize_ppq` (>0), `quantize_strength` (0–1, default 1) |
| Chord | `chord_intervals` (array of semitone offsets, 1-8 entries) |
| Arpeggiator | `arpeggiator_intervals` (array of semitone offsets, 1-16 entries), `arpeggiator_step_ppq` (>0), `arpeggiator_gate_ppq` (defaults to the step length, capped to it) |

`chord_intervals` is capped at 8 entries and `arpeggiator_intervals` at 16 — an empty array, or one past either limit, makes `bakeMidiFx` throw `SONARE_ERROR_INVALID_PARAMETER` rather than silently truncating.

```typescript
// Turn each held note into a three-step up-arpeggio, one sixteenth per step.
project.bakeMidiFx(midiClip, JSON.stringify({
  arpeggiator_intervals: [0, 4, 7],
  arpeggiator_step_ppq: 0.25,
  arpeggiator_gate_ppq: 0.2,
}));
```

Because the rewrite is destructive, it is an undoable edit like any other — `undo()` restores the original events.

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

`toJson()` serializes the whole project — tracks, clips, MIDI content, loop crossfades, tempo map, time signatures, markers, annotations, warp maps, and automation — to **deterministic JSON**: the same project always produces byte-identical text. `Project.fromJson(...)` restores it. Loop crossfade fields are omitted when they are zero, so older hard-loop projects keep the same JSON shape.

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

### Reading the model back, and rebinding audio after a load

Project JSON stores the *arrangement*, not the PCM. A loaded project therefore
knows it has a source, but has no samples behind it. Three read-only descriptor
families plus the PCM and source-metadata setters close that loop.

```typescript
const loaded = Project.fromJson(json);

for (let i = 0; i < loaded.trackCount(); i++) {
  const track = loaded.trackByIndex(i);      // { id, kind, midiDestinationId, gain, pan, mute, solo, name }
  console.log(track.id, track.name);
}
for (let i = 0; i < loaded.clipCount(); i++) {
  const clip = loaded.clipByIndex(i);        // { id, trackId, sourceId, startPpq, lengthPpq, … }
  console.log(clip.id, clip.startPpq, clip.lengthPpq);
}
const unresolvedAudioIds = new Set(loaded.unresolvedAudioSourceIds());
for (let i = 0; i < loaded.sourceCount(); i++) {
  const source = loaded.sourceByIndex(i);    // { id, kind, channelCount, sampleRateHint,
                                             //   nameOrUri, contentHash, externalStemRole }
  if (source.kind !== 0 || !unresolvedAudioIds.has(source.id)) continue; // 0 = audio; skip MIDI
  const pcm = await decodeFromYourStorage(source.nameOrUri);
  loaded.setSourceAudio(source.id, pcm, source.channelCount, source.sampleRateHint);
  loaded.setAudioSourceMetadata(source.id, 'sha256:...', 'lead-vocal');
}

const audio = loaded.bounce({ sampleRate: 48000 });
```

`trackByIndex` / `clipByIndex` / `sourceByIndex` are 0-based over the stored
order, paired with `trackCount()` / `clipCount()` / `sourceCount()`. They are
descriptors, not handles: mutating the returned object changes nothing. Use them
to render a project the host loaded from disk, or to build a UI over a project
your own code did not construct.

`setSourceAudio(sourceId, samples, channels, sampleRate)` rebinds decoded PCM to
a source before a bounce — the step that turns "loaded arrangement" into
"renderable project".

`unresolvedAudioSourceIds()` is the public list of source ids that still need decoded PCM after deserialization. The `kind !== 0` guard above is defensive when walking descriptors (`0` is audio, `1` is MIDI): MIDI sources have no PCM to bind and no source metadata to update. `contentHash` and `externalStemRole` are owning metadata on audio-source descriptors (they are empty for MIDI sources). `setAudioSourceMetadata(sourceId, contentHash, externalStemRole)` replaces both strings as one undoable edit; pass an empty string to clear either value. WASM uses that positional form, Node also accepts `{ contentHash, externalStemRole }` as its second argument, and Python uses `set_audio_source_metadata(source_id, content_hash, external_stem_role)` (the C ABI is `sonare_project_set_audio_source_metadata`). Python uses `unresolved_audio_source_ids()` and source descriptors named `content_hash` / `external_stem_role`; the C getter returns heap strings that the matching free function must release.

### Importing host-separated stems

If your app already ran source separation (or simply has per-instrument WAVs),
`importExternalStems` turns them into one audio track and clip each, in one
transaction.

```typescript
const { trackIds, clipIds } = project.importExternalStems({
  sampleRate: 48000,
  stems: [
    { name: 'vocals', layout: 'stereo', planarSamples: [vocalL, vocalR], startFrame: 0 },
    { name: 'drums',  layout: 'stereo', planarSamples: [drumL, drumR],   startFrame: 0 },
    { name: 'bass',   layout: 'mono',   planarSamples: [bassMono],       startFrame: 0, role: 'bass' },
  ],
});
```

The import is **all-or-nothing**: if any stem is rejected, the project is left
untouched rather than half-populated. It performs no resampling, no retiming,
and no gain compensation — every stem must already be at `sampleRate`, and
`startFrame` places it on the project timeline as-is. The optional per-stem
`role` is host metadata that round-trips through the serializer and does not
change any DSP.

## MIDI interchange: SMF and MIDI 2.0 Clip File

The project's tempo map and MIDI clips round-trip through two formats.

### Standard MIDI File (SMF)

`exportSmf` always writes a format-1 (multi-track) file: track 0 carries the tempo + time-signature map, then one MTrk per clip, quantized to 480 ticks per quarter note.

```typescript
const smf = project.exportSmf();        // Uint8Array — SMF format-1, 480 PPQN
// … write `smf` to a .mid file …

const fresh = new Project();
try {
  const firstClip = fresh.importSmf(smf); // returns the first added clip id
} finally {
  fresh.delete();
}
```

The importer contains damage locally: if one SMF track has an overlong variable-length quantity or payload, parsing resynchronizes at that track's declared boundary so later valid tracks can still import instead of the whole file failing.

What an SMF round-trips is a *performance* — and engraved, that same note list is a score. The grand staff below is the notation view of a MIDI clip; press play to hear the events it stores.

<SonareDemo id="midi-score" />

### MIDI 2.0 Clip File (`SMF2CLIP`)

SMF predates MIDI 2.0, so it cannot carry 16-bit velocity, 32-bit CC, per-note controllers, or bank-valid Program Change without loss. The **MIDI 2.0 Clip File** (`SMF2CLIP`) preserves all of that. Prefer it when MIDI 2.0 fidelity matters.

```typescript
const clipFile = project.exportClipFile();   // Uint8Array, "SMF2CLIP" header
const firstClip = otherProject.importClipFile(clipFile);
```

In Python these are `export_smf` / `import_smf` and `export_clip_file` / `import_clip_file`, returning and accepting `bytes`.

## Rendering audio

Editing produces a timeline; **rendering** turns it into samples. `Project` bounces offline through `bounce(...)` (audio tracks only) or one of the instrument-bound bounces (`bounceWithBuiltinInstrument`, `bounceWithSynthInstrument`, `bounceWithSf2Instrument`) that make MIDI tracks audible. The full set of render options, instrument binding, SoundFont loading, and the diagnostics reported by a bounce are covered on [Project Bounce & Rendering](./project-bounce.md).

```typescript
// Audio-only quick render. MIDI tracks are silent here.
const audio = project.bounce({ numChannels: 2 });
```

Once your arrangement compiles cleanly, the natural next step is turning it into audio — including making MIDI tracks audible. Continue with [Project Bounce & Rendering](./project-bounce.md).

