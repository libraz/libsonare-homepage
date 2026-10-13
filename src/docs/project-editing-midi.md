---
title: Project MIDI
description: Project-level MIDI annotations, tempo, interchange, and links to clip editing, MIDI 2.0, transcription, and save/load.
---

# Project MIDI

This page covers the project-level MIDI pieces: key and chord annotations, assist sidecars, tempo detection, SMF import and export, and external MIDI gear. The task pages below go deeper on event editing, transcription, MIDI 2.0, and persistence.

| Task | Guide |
|---|---|
| Turn audio into note events | [Audio to MIDI](./audio-to-notes.md) |
| Edit measured notes inside audio | [Note Editing in Audio](./note-editing.md) |
| Edit a MIDI clip, validate notes, route a captured stream, bake MIDI-FX | [Edit MIDI Clips](./midi-editing.md) |
| Keep MIDI 2.0 values and UMP words | [MIDI 2.0, UMP, and Clip Files](./midi2.md) |
| Compile, save, load, rebind audio, import stems | [Compile, Save, and Load Projects](./project-save-load.md) |

## Key and chord annotation write-back

A project can carry musical annotations, the **key** regions and **chord** symbols that an analyzer produced, so they travel with the arrangement and survive save/load. Both streams are replace-in-full and undoable.

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
    (0.0, 16.0, 0, 1),  # (start_ppq, end_ppq, tonic_pc, mode): C major
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
- **Key mode** (`mode`): `0` unknown, `1` major, `2` minor, `3` dorian, `4` phrygian, `5` lydian, `6` mixolydian, `7` locrian. Use `keyModeFromAnalysis` to map an analysis mode.
- **Chord quality** (`quality`): `1` = major, `2` = minor, `3` = diminished, `4` = augmented, `5` = dominant, `6` = half-diminished, `7` = suspended. `extensions` lists scale degrees (`7`, `9`, `13`, or `2` / `4` for a suspension; at most 32) that distinguish variants within a family (see [Chord Recognition](./glossary/analysis/chord-recognition.md) for detector qualities).

So `{ tonicPc: 0, mode: 1 }` is C major and `{ rootPc: 7, quality: 1 }` is a G major chord.

::: warning These are arrangement ordinals, not the analysis enums
The `mode` and `quality` numbers here are **arrangement ordinals**, distinct from the **0-based** `Mode` and `ChordQuality` enums returned by `detectKey` / `detectChords`. Key modes and the four basic triads are offset by one (major = 0 in analysis, 1 here), so passing analysis `ChordQuality.Minor` (= 1) directly to `annotateChords` would label the chord **major**. The `+1` offset holds only for those four triads; extended detector qualities fold into a family plus scale degrees, for example Dominant7 → `{ quality: 5, extensions: [7] }`, HalfDim7 → `{ quality: 6, extensions: [7] }`, and Sus4 → `{ quality: 7, extensions: [4] }`. Do not map them by hand: the next section applies the library's own table.
:::

### Convert a detected chord or key

`chordSymbolFromAnalysis(chord)` (Python `chord_symbol_from_analysis`, C `sonare_chord_symbol_from_analysis`) turns an analysis chord into `{ rootPc, quality, extensions, slashBassPc }` (Python snake_case keys), the same conversion the library applies when it builds a harmonic timeline. The root is kept as given, and `slashBassPc` is `255` when the bass is the root. `keyModeFromAnalysis(mode)` (`key_mode_from_analysis`, `sonare_key_mode_from_analysis`) returns the annotation `mode` (1..7) for an analysis mode name or ordinal. Times are not converted; place the result with `startPpq` / `endPpq`. An unrecognized value is a `RangeError` (Python `SonareValueError`) naming the field, and a non-object chord is a `TypeError`.

```typescript
const { chords } = detectChords(samples, sampleRate);
project.annotateChords(
  chords.map((c) => ({ startPpq: 0, endPpq: 4, ...chordSymbolFromAnalysis(c) })),
);
project.annotateKeys([
  { startPpq: 0, endPpq: 16, tonicPc: key.root, mode: keyModeFromAnalysis(key.mode) },
]);
```

What the analyzers report before it becomes an annotation is on [Chord Recognition](./glossary/analysis/chord-recognition.md) and [Key Detection](./glossary/analysis/key-detection.md).

## Assist sidecars

An **assist sidecar** is an opaque, undoable per-project metadata blob: a place to stash an AI-assist suggestion, a tooling payload, or any binary annotation that should travel with the arrangement. Each sidecar is keyed by a **module id** plus a **target scope** (a track id and a PPQ region), and the whole store serializes under the project JSON `assist_sidecars` key, so it survives `toJson()` / `fromJson()` round-trips.

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

## Auto-tempo and snap-to-grid

Two helpers align edits to the beat.

`autoTempo(audio, sampleRate, candidateIndex?, applyTimeSignatures?, options?)` detects the tempo from a mono buffer, installs it as the tempo map, and returns the BPM. `analyzeTempo(audio, sampleRate, options?)` returns the ranked candidates (`primary`, `half`, `double`) without touching the project; pass a candidate's index as `candidateIndex` to install that one, with the same `options` on both calls. `options` are scoring settings:

| Option | Default | Meaning |
|--------|---------|---------|
| `adaptiveTempo` | `false` | Let beat tracking follow a tempo that moves during the take. Leave it off for material recorded to a click. |
| `tempoUpdateIntervalBeats` | native default | Beats of context for the local tempo estimate (only with `adaptiveTempo`). |
| `rampThreshold` | `0.02` | Relative tempo change at which one segment closes and the next opens. Smaller follows the performance more closely. |
| `includeOctaveCandidates` | `true` | Rank the half- and double-tempo alternatives alongside the primary. |

With `adaptiveTempo` on, a drifting performance becomes several tempo segments, which [export to SMF as stepped tempo events](#standard-midi-file-smf). The tempo analysis itself is described on [Analysis](./analysis.md).

`snapToGrid(ppq, strength, division)` snaps a PPQ coordinate to the project grid. `strength` is `0..1` (1 snaps fully). `division` is `0` for bars, `1` for beats (default), or the number of subdivisions per beat (`4` for sixteenths).

::: code-group

```typescript [Browser / WASM]
const bpm = project.autoTempo(monoMix, 48000); // detects and installs the tempo, returns the detected BPM
const snapped = project.snapToGrid(1.2, 1.0);  // 1.2 -> 1 (nearest beat)
```

```python [Python]
bpm = project.auto_tempo(mono_mix, 48000)      # keyword options: adaptive_tempo=True, ramp_threshold=0.05
snapped = project.snap_to_grid(1.2, 1.0)       # 1.2 -> 1 (nearest beat)
```

:::

## MIDI interchange: SMF and MIDI 2.0 Clip File

The two interchange formats have different jobs. SMF is the compatible, 480-tick format covered here. For lossless MIDI 2.0 values use the Clip File (`SMF2CLIP`), described in [MIDI 2.0, UMP, and Clip Files](./midi2.md#midi-2-0-clip-file-smf2clip).

### Standard MIDI File (SMF)

`exportSmf` always writes a format-1 (multi-track) file: track 0 carries the tempo + time-signature map, then one MTrk per clip, quantized to 480 ticks per quarter note. At the lower-level SMF exporter, a nonzero PPQN must fit the positive 15-bit range `0x0001`–`0x7fff`; zero selects the default 480. The importer accepts formats 0 and 1, but a format-0 header must declare exactly one track; format 2, SMPTE timing, and zero PPQN in an input header are rejected.

::: code-group

```typescript [Browser / WASM]
const smf = project.exportSmf();        // Uint8Array<ArrayBuffer>: SMF format 1, 480 PPQN
// … write `smf` to a .mid file …

const fresh = Project.create();
try {
  const firstClip = fresh.importSmf(smf); // returns the first added clip id
} finally {
  fresh.delete();
}
```

```python [Python]
smf = project.export_smf()              # bytes: SMF format 1, 480 PPQN
# … write `smf` to a .mid file …

with sonare.Project() as fresh:
    first_clip = fresh.import_smf(smf)  # returns the first added clip id
```

:::

Node uses the same calls as the browser package.

SMF represents tempo with discrete Set Tempo events. The exporter writes a tempo ramp as sixteenth-note steps whose durations follow the project tempo map at each step boundary, subject to tick and microsecond quantization. Long ramps use larger steps to limit each ramp to 4096 events. If the first tempo segment starts after PPQ 0, its initial tempo is also written at tick 0, matching the tempo map before that segment. Importing the file restores those steps rather than the original continuous ramp.

`exportSmf()` and `exportClipFile()` are declared `Uint8Array<ArrayBuffer>`, the type the `Blob` and `File` constructors accept, so `new Blob([project.exportSmf()])` compiles with no intermediate `new Uint8Array(...)` copy.

On import, a key-signature meta event is kept only when its fifths value is in `-7..7` and its minor flag is `0` or `1`. A missing or invalid key-signature payload is skipped and counted in `skipped_events`; parsing of the rest of the track continues.

The importer contains damage locally: if one SMF track has an overlong variable-length quantity or payload, parsing resynchronizes at that track's declared boundary so later valid tracks can still import instead of the whole file failing.

What an SMF round-trips is a *performance*, and engraved, that same note list is a score. The grand staff below is the notation view of a MIDI clip; press play to hear the events it stores.

<SonareDemo id="midi-score" />

### An SMF as a reference melody: note targets

See [An SMF as a reference melody](./note-editing.md#an-smf-as-a-reference-melody-note-targets).

## Rendering audio

Editing produces a timeline; **rendering** turns it into samples. `Project` bounces offline through `bounce(...)` (audio tracks only) or one of the instrument-bound bounces (`bounceWithBuiltinInstrument`, `bounceWithSynthInstrument`, `bounceWithSf2Instrument`) that make MIDI tracks audible. The full set of render options, instrument binding, SoundFont loading, and the diagnostics reported by a bounce are covered on [Project Bounce & Rendering](./project-bounce.md).

```typescript
// Audio-only quick render. MIDI tracks are silent here.
const audio = project.bounce({ numChannels: 2 });
```

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

Each event contains `destinationId`, `renderFrame`, and `bytes` (one lowered MIDI 1.0 message of 1–3 bytes; snake_case `destination_id` / `render_frame` in Python). Clock and transport messages use the sentinel destination `0xFFFFFFFF`; channel messages retain their destination id. `maxRecords` limits the returned messages, not source events, and any remainder stays queued for the next drain. Check `externalMidiDroppedCount()` (`external_midi_dropped_count()` in Python): a rising value means the fixed-capacity realtime queue filled before the host drained it.

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

## Related

- [Project Editing](./project-editing.md) — tracks, clips, tempo, markers, warp, and automation
- [Edit MIDI Clips](./midi-editing.md) — event lists and MIDI-FX
- [MIDI 2.0, UMP, and Clip Files](./midi2.md) — full-resolution MIDI messages and Clip Files
- [Audio to MIDI](./audio-to-notes.md) — transcription onto a constant or project tempo map
- [Compile, Save, and Load Projects](./project-save-load.md) — timeline compilation and persistence
- [MIDI Input](./midi-input.md) — live controller input
- [Bouncing Projects](./project-bounce.md) — render the timeline and bound instruments
