---
title: Edit MIDI Clips
description: Build, validate, route, transform, and bake MIDI events in a Project.
---

# Edit MIDI Clips

A MIDI clip is a symbolic event list on a project timeline. This page covers the clip editing path: construct channel-voice events, replace a clip, check note pairs, route captured input, and choose between a non-destructive MIDI-FX chain and a baked result. For full-resolution MIDI 2.0 UMP builders and live multi-word messages, see [MIDI 2.0, UMP, and Clip Files](./midi2.md).

::: info MIDI events are not audio
`setMidiEvents` changes the stored note and controller events. It does not render or alter PCM. Bind an instrument and bounce the project when the clip should become sound; see [Project MIDI](./project-editing-midi.md#rendering-audio) and [Bouncing Projects](./project-bounce.md).
:::

<FlowDiagram
  title="Edit a MIDI clip"
  :nodes="[
    { id: 'capture', label: 'Captured / generated events', col: 0, row: 0 },
    { id: 'route', label: 'Validate or route', col: 1, row: 0 },
    { id: 'clip', label: 'Project MIDI clip', col: 2, row: 0, variant: 'accent' },
    { id: 'fx', label: 'MIDI-FX (optional bake)', col: 3, row: 0 },
    { id: 'render', label: 'Instrument render', col: 4, row: 0, variant: 'success' }
  ]"
  :edges="[
    { from: 'capture', to: 'route' },
    { from: 'route', to: 'clip' },
    { from: 'clip', to: 'fx' },
    { from: 'fx', to: 'render' }
  ]"
  caption="A clip stores symbolic events; routing and MIDI-FX happen before an instrument turns them into audio."
/>

## MIDI content

A MIDI clip holds a flat event list. Build events with the `Project.midi*` static packers (which produce the canonical MIDI 1.0 words) and replace the clip's list with `setMidiEvents`.

::: warning `setMidiEvents` discards the clip's SysEx
A clip's SysEx payloads (a GS Reset, a Roland DT1 setup block) live beside its event list, reached through a handle that `ProjectMidiEvent` does not carry. `importSmf()` keeps them, `exportSmf()` writes them back byte for byte, `toJson()` carries them, and an offline bounce realizes them: a GS insertion-effect type-select embedded in an imported SMF changes the rendered audio. `setMidiEvents()` replaces the list and leaves nothing referring to the payloads, so one call drops every frame, and there is no read-back entry point to save them through first. A caller that must preserve a GS setup block edits the exported file rather than the clip's event list.
:::

::: code-group

```typescript [Browser / WASM]
import { Project, init } from '@libraz/libsonare';

await init();
const project = new Project();
project.setSampleRate(48000);
const { clipId: midiClip } = project.addMidiClip(0, 4);
project.setMidiEvents(midiClip, [
  Project.midiNoteOn(0, 0, 0, 60, 100),  // (ppq, group, channel, note, velocity)
  Project.midiNoteOff(2, 0, 0, 60),
  Project.midiNoteOn(2, 0, 0, 64, 100),
  Project.midiNoteOff(4, 0, 0, 64),
]);
project.setProgram(midiClip, 4);          // GM program (e.g. 4 = electric piano)
// Keep `project` for the following edit steps; call project.delete() when done.
```

```python [Python]
import libsonare as sonare

project = sonare.Project()
project.set_sample_rate(48000)
_track_id, midi_clip = project.add_midi_clip(0.0, 4.0)
project.set_midi_events(midi_clip, [
    sonare.Project.midi_note_on(0.0, 0, 0, 60, 100),  # (ppq, group, channel, note, velocity)
    sonare.Project.midi_note_off(2.0, 0, 0, 60),
    sonare.Project.midi_note_on(2.0, 0, 0, 64, 100),
    sonare.Project.midi_note_off(4.0, 0, 0, 64),
])
project.set_program(midi_clip, 4)          # GM program (e.g. 4 = electric piano)
# Keep `project` for the following edit steps; call project.close() when done.
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

To make a MIDI arrangement audible you bind an instrument at render time — see [Rendering audio](./project-editing-midi.md#rendering-audio), the [native synth](./native-synth.md), and the [SoundFont player](./soundfont-player.md). For driving a project live from a controller, see [MIDI input](./midi-input.md).

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

When an editor needs to preserve a selection or annotation through the rewrite, use the request form. `sourceIndex` has one entry per transformed event in canonical order: it always names the input event the output derives from, with an index in `0..inputCount-1`. A chord or arpeggiator can produce several events with the same source index.

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
| Humanize | `humanize_ppq` (>=0), `humanize_velocity` (0–127), `seed` (non-negative integer); deterministic timing/velocity jitter |
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

## Related

- [Audio to MIDI](./audio-to-notes.md) — turn a mono recording into project MIDI events
- [MIDI 2.0, UMP, and Clip Files](./midi2.md) — full-resolution builders, live UMP, and lossless interchange
- [MIDI Input](./midi-input.md) — route live controller input to an instrument
