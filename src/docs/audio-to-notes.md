---
title: "Audio to MIDI: Turn Sound into Notes"
description: Transcribe mono audio into MIDI events or write notes onto a Project tempo map.
---

# Audio to MIDI: Turn Sound into Notes

Use transcription when a recording needs a symbolic MIDI representation. Both entry points analyze mono audio and produce note-on/note-off pairs. They differ in the clock they use and in where the events go.

| Need | Call | PPQ clock | Result |
|---|---|---|---|
| Inspect or post-process a transcription | `transcribe({ samples, sampleRate, tempoBpm? })` | One constant tempo for this call; `tempoBpm` is supplied or detected | `{ events, noteCount, tempoBpm, tuning }`; the project is unchanged |
| Put notes into an existing arrangement | `project.transcribeToClip({ clipId, samples, sampleRate, ... })` | The project's tempo map | Replaces the target MIDI clip's event list and returns the written note count |

The output is `ProjectMidiEvent[]`, a symbolic event list. Transcription does not modify the input audio. Its events are already shaped for `setMidiEvents`; a note produces two events, ordered with a note-off before a note-on at the same PPQ position.

<SonareDemo id="audio-to-notes" />

## Transcribe audio into a MIDI clip

The standalone `transcribe(...)` function takes an optional `tempoBpm` and returns `{ events, noteCount, tempoBpm, tuning }` on its own constant-tempo grid. `Project.transcribeToClip(...)` uses the project's tempo map instead: after `autoTempo(...)` installs that map, it replaces the clip's event list and returns the number of notes written. Its request has no `tempoBpm`.

::: code-group

```typescript [Browser / WASM]
import { Project, init, transcribe } from '@libraz/libsonare';

await init();
const sampleRate = 48000;
const samples = new Float32Array(sampleRate * 2); // replace with decoded mono 48 kHz PCM
const standalone = transcribe({ samples, sampleRate, tempoBpm: 120, polyphonic: true });
const project = new Project();
try {
  project.setSampleRate(sampleRate);
  const bpm = project.autoTempo(samples, sampleRate);
  const { clipId } = project.addMidiClip(0, 16);
  const noteCount = project.transcribeToClip({ clipId, samples, sampleRate, polyphonic: true });
  console.log(standalone.tempoBpm, standalone.noteCount, bpm, noteCount);
} finally {
  project.delete();
}
```

```python [Python]
import libsonare as sonare

sample_rate = 48000
samples = [0.0] * (sample_rate * 2)  # replace with decoded mono 48 kHz PCM
standalone = sonare.transcribe(samples, sample_rate, tempo_bpm=120, polyphonic=True)
with sonare.Project() as project:
    project.set_sample_rate(sample_rate)
    bpm = project.auto_tempo(samples, sample_rate=sample_rate)
    _track_id, clip_id = project.add_midi_clip(0.0, 16.0)
    note_count = project.transcribe_to_clip(clip_id, samples, sample_rate, polyphonic=True)
    print(standalone.tempo_bpm, standalone.note_count, bpm, note_count)
```

:::

## Choose the analysis mode

The default monophonic path follows one pYIN-derived pitch line and segments it into notes. Set `polyphonic: true` to use the multi-F0 path for overlapping notes. Omit either `fmin` or `fmax` to use that path's default for the endpoint (`65..2093 Hz` for mono, `55..1760 Hz` for poly). Explicit endpoints must be positive and are honored by both paths; the JavaScript and Python bindings reject an explicit `0`. In polyphonic mode the resolved bounds apply to the salience estimator's F0 axis; the cent-spectrum bounds remain independent.

`tempoBpm` is a coordinate system for the standalone function. Omit it to run tempo detection; if no usable tempo is found, the call uses 120 BPM. `Project.transcribeToClip` has no tempo option because it reads the project's map. Call `autoTempo` first when the project should follow the recording, then transcribe into the clip.

The tuning reference defaults to 440 Hz. For a take recorded away from A440, pass `referenceHz: 'auto'` (Python `reference_hz="auto"`) to measure it from the audio before any pitch is tracked, or pass the reference in Hz. The result's `tuning` (a semitone fraction from A440) reports the reference used either way, so a transcription that sits a fraction off can be traced to it; `tuningToReferenceHz` and `referenceHzToTuning` convert between that unit and Hz. The audio must be non-empty, finite, mono samples with a sample rate in `[8000, 384000]`. Finding no notes is a successful result with an empty event list and `noteCount: 0`.

## Options and limits

| Option | Meaning |
|---|---|
| `polyphonic` | `false` uses the monophonic pYIN segmentation; `true` uses multi-F0 tracking |
| `referenceHz` | Positive tuning reference in Hz for MIDI note numbers, or `'auto'` to measure it from the audio; default `440` |
| `fmin`, `fmax` | F0 search range in Hz for either path; omit an endpoint for the selected path's default, or supply a positive value, with resolved `fmax > fmin` |
| `minNoteMs` | Shortest note span in milliseconds. Default `30` monophonic; polyphonic, a thirty-second note at the transcription tempo held within `30..60` ms |
| `minNoteDivision` | Shortest note as a note value (Python `min_note_division`, CLI `--min-note-division`): `n` is a `1/n` note at the transcription tempo, an integer in `1..128`, so `32` keeps notes from a thirty-second note up. Applies to both paths and is refused together with `minNoteMs`. The tempo is the given or detected one, or the project's tempo at its start for `transcribeToClip` |
| `segmentationThresholdCents` | Pitch movement that starts a new monophonic note; default `50` cents |
| `maxPolyphony` | Polyphonic only. Voices one frame may hold, `1..64`; default `10` |
| `minFramePeakRatio` | Polyphonic only. A frame's search stops below this share of its first peak, `0..1`; default `0.20` |
| `minRidgePeakRatio` | Polyphonic only. A ridge ends below this share of its own running peak, `0..1`; default `0.10` |
| `reattackRatio` | Polyphonic only. Splits a ridge into two notes where its salience climbs past this multiple of the level just before (the same pitch struck again while it sounds); above `1`, default `2.0`, `0` turns the split off |
| `velocityFloorDb` / `fixedVelocity` | Map RMS level from the negative dBFS floor, or assign one velocity in `1..127` |
| `group` / `channel` | UMP group and MIDI channel, each in `0..15` |

`velocityFloorDb` and `fixedVelocity` are alternatives: omit both to measure level, set a negative floor to map it, or set `fixedVelocity` to bypass level measurement. Invalid zero values on options that require a positive value are rejected rather than silently replaced; for the two peak ratios `0` is a real zero (no cut). The four polyphonic limits are snake_case in Python (`max_polyphony`, `min_frame_peak_ratio`, `min_ridge_peak_ratio`, `reattack_ratio`), flags of the same names on both CLIs, and refused on the monophonic path with an error naming the field.

The polyphonic path keeps dense material by default (up to ten voices per frame, notes down to a thirty-second note, a same-pitch re-strike as a new note) and runs in time proportional to the input length. Its known limits: the upper note of an octave doubling is usually lost, a re-strike much softer than the note it interrupts is not split, and broadband noise yields short notes, so raise `minNoteMs` or `minNoteDivision` for noisy input.

## Add post-processing

The event list can be checked, routed, transformed, and optionally baked with [Edit MIDI Clips](./midi-editing.md). Use [MIDI 2.0, UMP, and Clip Files](./midi2.md) when the next stage needs 16-bit velocity, 32-bit controllers, or per-note messages.

## Related

- [Note Editing in Audio](./note-editing.md) — edit measured audio notes and render the result back to audio
- [Project MIDI](./project-editing-midi.md) — install a tempo map, annotate it, compile it, and save it
