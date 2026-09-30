---
title: MIDI 2.0, UMP, and Clip Files
description: Use MIDI 2.0 UMP builders, live multi-word messages, and MIDI 2.0 Clip Files across libsonare bindings.
---

# MIDI 2.0, UMP, and Clip Files

MIDI 2.0 messages travel through libsonare as Universal MIDI Packets (UMPs). A UMP is the packet transport; the message type and status define the MIDI meaning. A project event stores a PPQ position plus the first two UMP words, so a MIDI 1.0 channel-voice message and a two-word MIDI 2.0 channel-voice message can share one `setMidiEvents` list. `Project.midi*` helpers make MIDI 1.0 words; `Project.midi2*` helpers make full-resolution MIDI 2.0 words.

For the protocol definition, see the MIDI Association’s [Universal MIDI Packet and MIDI 2.0 Protocol specification](https://midi.org/universal-midi-packet-ump-and-midi-2-0-protocol-specification). The receiver and binding limits below describe libsonare.

::: info Value width and receiver behavior
A MIDI 2.0 UMP can carry a 16-bit note velocity, 32-bit controller or pressure value, 32-bit pitch bend, and per-note messages. The message keeps that width through the raw UMP and MIDI 2.0 Clip File paths. The instrument receiving it can still support only a subset of expression messages; see the receiver table below.
:::

<FlowDiagram
  title="MIDI 1.0 and MIDI 2.0 through UMP"
  :nodes="[
    { id: 'midi1', label: 'MIDI 1.0 / MT2', col: 0, row: 0 },
    { id: 'midi2', label: 'MIDI 2.0 / MT4', col: 0, row: 1 },
    { id: 'project', label: 'ProjectMidiEvent list', col: 1, row: 0, variant: 'accent' },
    { id: 'live', label: 'RealtimeEngine UMP', col: 2, row: 0 },
    { id: 'clip', label: 'SMF2CLIP', col: 2, row: 1, variant: 'success' },
    { id: 'smf', label: 'SMF conversion (loss possible)', col: 3, row: 1, variant: 'warning' }
  ]"
  :edges="[
    { from: 'midi1', to: 'project' },
    { from: 'midi2', to: 'project' },
    { from: 'project', to: 'live' },
    { from: 'project', to: 'clip' },
    { from: 'clip', to: 'smf' }
  ]"
  caption="UMP carries either one-word MIDI 1.0 or two-word MIDI 2.0 channel voice messages; the project list can preserve both before a receiver or file conversion applies its limits."
/>

## From MIDI 1.0 to MIDI 2.0

A UMP channel-voice word carries a 4-bit group and a 4-bit MIDI channel. The channel voice message type distinguishes the value layout: MT `0x2` is a one-word MIDI 1.0 message, while MT `0x4` is a two-word MIDI 2.0 message. The second word is where the wider value fields live. Both message types still identify notes with 7-bit note numbers and use the same group/channel ranges.

| Value or expression | MIDI 1.0 channel voice | MIDI 2.0 channel voice |
|---|---:|---:|
| Note velocity | 7-bit | 16-bit |
| CC, channel pressure, poly pressure | 7-bit | 32-bit |
| Pitch bend | 14-bit | 32-bit |
| Per-note controllers and per-note pitch bend | No channel-voice equivalent | Native MIDI 2.0 message forms |
| Note-on attribute | No equivalent field | Optional 16-bit attribute data with an attribute type |

MIDI 2.0 therefore carries more value precision and adds per-note expression, but it does not make every receiver apply every message. Separate per-note messages can address simultaneously sounding notes with different note numbers independently even when they share a channel; the instrument decides which of those forms it implements.

MIDI 1.0 can combine paired CC messages into 14-bit values; the table shows the width of a single CC message. MIDI 2.0 also includes MIDI-CI for capability discovery, Profiles for agreed controller behavior, and Property Exchange for exchanging device information. These are separate from UMP encoding: the libsonare APIs described here build, store, and deliver messages, and do not negotiate those capabilities with an external device.

## Project event shape

`ProjectMidiEvent` is `{ ppq, data0, data1? }` in JavaScript and `(ppq, data0, data1)` in Python. `data0` is the first UMP word and `data1` is the second (defaulting to zero when omitted). Project event lists carry channel-voice UMPs. SysEx payloads live in a separate store and are not represented by this flat type; `setMidiEvents` replaces the list and discards that store.

`ppq` is a position in quarter notes, not a 480-ticks-per-quarter integer. An MT 0x2 MIDI 1.0 channel-voice message uses one word. An MT 0x4 MIDI 2.0 channel-voice message uses two words.

## Build MIDI 2.0 events

The JavaScript and Python project bindings expose the same builder families:

| Family | JavaScript | Python | Data |
|---|---|---|---|
| Notes | `midi2NoteOn`, `midi2NoteOff` | `midi2_note_on`, `midi2_note_off` | 16-bit attack/release velocity; note-on velocity `0` still means note-on |
| Channel expression | `midi2Cc`, `midi2ChannelPressure`, `midi2PitchBend` | snake_case equivalents | 32-bit controller, pressure, and bend; bend center `0x80000000` |
| Poly pressure | `midi2PolyPressure` | `midi2_poly_pressure` | 32-bit pressure for one note |
| Program | `midi2Program` | `midi2_program` | Program plus optional bank MSB/LSB in the same message |
| RPN / NRPN | registered/assignable and relative controller builders | snake_case equivalents | 32-bit values or signed deltas |
| Per-note | registered/assignable controller, per-note bend | snake_case equivalents | Per-note index `0..255`, or 32-bit bend |
| Management | `midi2PerNoteManagement` | `midi2_per_note_management` | Detach and reset flags for one note |

The note, group, channel, controller, program, bank, and note-controller indices use their protocol ranges. MIDI 2.0 `attributeType` and `attributeData` are optional on `midi2NoteOn`; type `3` carries pitch 7.9 data.

::: code-group

```typescript [Browser / Node]
import { Project, init } from '@libraz/libsonare';

await init(); // required by the browser/WASM build; this WASM package also requires initialization in Node
const project = new Project();
project.setSampleRate(48000);
const { clipId } = project.addMidiClip(0, 4);
const on = Project.midi2NoteOn(0, 0, 0, 60, 0xc000);
const bend = Project.midi2PerNotePitchBend(0.25, 0, 0, 60, 0x80000000);
const off = Project.midi2NoteOff(2, 0, 0, 60, 0x8000);
try {
  project.setMidiEvents(clipId, [on, bend, off]);
} finally {
  project.delete();
}
```

```python [Python]
import libsonare as sonare

with sonare.Project() as project:
    project.set_sample_rate(48000)
    _track_id, clip_id = project.add_midi_clip(0.0, 4.0)
    on = sonare.Project.midi2_note_on(0.0, 0, 0, 60, 0xC000)
    bend = sonare.Project.midi2_per_note_pitch_bend(0.25, 0, 0, 60, 0x80000000)
    off = sonare.Project.midi2_note_off(2.0, 0, 0, 60, 0x8000)
    project.set_midi_events(clip_id, [on, bend, off])
```

:::

MIDI 1.0 packers remain useful for a target that expects 7-bit values: `midiNoteOn`, `midiCc`, `midiChannelPressure`, and the other `midi*` methods produce canonical MIDI 1.0 UMP words. Converting a MIDI 2.0 event to MIDI 1.0 downscales the values and drops messages with no single MIDI 1.0 equivalent; use the MIDI 1.0 path only when that loss is acceptable.

## Queue raw UMP in realtime

`RealtimeEngine.pushMidiUmp(destinationId, words, renderFrame = -1)` accepts one to four most-significant-first 32-bit words. The array length must match the message type in its first word. An MT 0x4 MIDI 2.0 channel-voice message is delivered at full width. `pushMidiInputUmp(words, portTimeSamples = 0)` applies the same message rules to the engine-owned input source after `setMidiInputSource(...)`.

::: code-group

```typescript [Browser / Node]
import { Project, RealtimeEngine, init } from '@libraz/libsonare';

await init();
const engine = new RealtimeEngine(48000, 128); // control-thread queue; render on the engine's audio thread
engine.setBuiltinInstrument({}, 0);
engine.setMidiInputSource(0);
const note = Project.midi2NoteOn(0, 0, 0, 60, 0xc000);
try {
  engine.pushMidiUmp(0, [note.data0, note.data1 ?? 0], -1);
  engine.pushMidiInputUmp([note.data0, note.data1 ?? 0], 0);
} finally {
  engine.destroy();
}
```

```python [Python]
import libsonare as sonare

engine = sonare.RealtimeEngine(48000, 128)  # queue commands; render blocks through process()
engine.set_builtin_instrument()
engine.set_midi_input_source(0)
try:
    note = sonare.Project.midi2_note_on(0.0, 0, 0, 60, 0xC000)
    engine.push_midi_ump(0, [note[1], note[2]], render_frame=-1)
finally:
    engine.close()
```

:::

The AudioWorklet `SonareEngine` facade has a narrower `pushMidiUmp(trackId, word0, renderFrame = -1)` method that accepts one word. Use `RealtimeEngine` for a two-word MIDI 2.0 channel-voice message. Raw MT 0x3 / MT 0x5 data messages are rejected by `pushMidiUmp`; send a complete SysEx frame through `pushMidiSysex` instead. Queue-full and malformed-word errors are reported by the binding.

## What the built-in receivers apply

All three project/realtime instrument bindings receive MIDI 2.0 channel-voice UMPs with their supplied value width. Expression support remains instrument-specific:

| Receiver | Applies | Boundary |
|---|---|---|
| Built-in waveform synth | Full-width note velocity, channel pressure, polyphonic pressure, and per-note pitch bend | MPE bend handling follows the built-in synth's zone configuration |
| NativeSynth | Full-width note velocity, channel pressure, polyphonic pressure, and per-note pitch bend | RPN 0 controls bend range; other MIDI 2.0 statuses are not implied to affect every patch |
| SoundFont player | Full-width note velocity, channel pressure, pitch bend, and MIDI 2.0 per-note pitch | Polyphonic key pressure is deliberately ignored; MPE member channels still carry channel expression |

The UMP keeps the original message even when a receiver ignores one expression type. See [MIDI Input](./midi-input.md) for the direct raw-UMP path and the Web MIDI bridge's MIDI 1.0 convenience methods.

## MIDI 2.0 Clip File (`SMF2CLIP`)

A MIDI 2.0 Clip File is an in-memory UMP container with an `SMF2CLIP` header. `Project.exportClipFile()` exports the project tempo map and MIDI clips into a single clip container; `importClipFile(...)` adds the imported clip. The format keeps MIDI 2.0 channel-voice messages without converting their values.

It preserves 16-bit velocity, 32-bit CC, per-note and registered controllers, and bank-valid Program Change. This is the interchange path to use when those values matter. Clip files also carry SysEx7/8 data. Export serializes the project’s separate SysEx store into the file; import restores it to that store.

::: code-group

```typescript [Browser / Node]
import { Project, init } from '@libraz/libsonare';

await init();
const project = new Project();
const imported = new Project();
try {
  const clipFile = project.exportClipFile(); // Uint8Array beginning with "SMF2CLIP"
  const clipId = imported.importClipFile(clipFile);
  console.log(clipId);
} finally {
  imported.delete();
  project.delete();
}
```

```python [Python]
import libsonare as sonare

with sonare.Project() as project, sonare.Project() as imported:
    clip_file = project.export_clip_file()  # bytes beginning with b"SMF2CLIP"
    clip_id = imported.import_clip_file(clip_file)
```

:::

[Standard MIDI File](./project-editing-midi.md#standard-midi-file-smf) export remains useful for MIDI 1.0 tools. SMF cannot represent every MIDI 2.0 value or per-note message without loss; project export drops MIDI 2.0-only events that have no MIDI 1.0 representation. SMF export uses format 1 with a tempo/signature track and 480 ticks per quarter note, so it is a compatibility format rather than a full-fidelity MIDI 2.0 archive.

## Boundaries to keep visible

- A `ProjectMidiEvent` contains the first two UMP words and only represents channel-voice project events. It is not a general UMP or SysEx container.
- Raw realtime `pushMidiUmp` accepts the message's complete one-to-four-word packet, but rejects MT 0x3 and MT 0x5 data messages. Use `pushMidiSysex` for SysEx.
- MIDI 1.0 helper output uses 7-bit channel values and 14-bit pitch bend. MIDI 2.0 builders use 16-bit or 32-bit fields as named above.
- Receiver support is narrower than packet precision. A packet can retain poly pressure or a per-note controller while a particular instrument ignores it.

## Related

- [Edit MIDI Clips](./midi-editing.md) — replace, validate, route, and bake project event lists
- [Audio to MIDI](./audio-to-notes.md) — create MIDI 1.0 note pairs from audio
- [MIDI Input](./midi-input.md) — bind live input and distinguish direct UMP from Web MIDI
- [Project MIDI](./project-editing-midi.md) — project-level tempo, annotations, and SMF overview
