---
title: Edit Notes Inside Audio
description: Extract measured notes from audio, edit their NoteObjects, and render the edited signal.
---

# Edit Notes Inside Audio

This workflow renders edited audio. It does not change a project's MIDI clip. Choose the path by the material and the kind of edit you need.

| Material or reference | Path |
|---|---|
| One voice or one melodic line | `pitchPyin` → `extractNotes` → edit `NoteEdit` → `renderNotes` |
| Percussive hits | `extractPercussiveEvents` → edit timing/gain/mute → `renderPercussiveEvents` |
| Overlapping pitched voices | `analyzePolyphonic` → `notes()` / `setNoteEdit` → `render()` → `destroy()` |
| A written melody in an SMF | `noteTargetsFromSmf` + `assignNoteTargets` → `renderNotes` |

The note editors use sample spans and measured pitch. For a whole-buffer pitch or time transform without note boundaries, use [Editing DSP](./editing-dsp.md).

The examples below assume `samples` is a mono `Float32Array` decoded at the stated `sampleRate`. In the browser/WASM build, call `init()` before using the analysis functions; replace the placeholder buffer with your decoded recording.

<FlowDiagram
  title="Measure notes, edit spans, render audio"
  :nodes="[
    { id: 'audio', label: 'Mono audio', col: 0, row: 0 },
    { id: 'analysis', label: 'Pitch / note analysis', col: 1, row: 0, variant: 'accent' },
    { id: 'edits', label: 'NoteEdit changes', col: 2, row: 0 },
    { id: 'render', label: 'Rendered audio', col: 3, row: 0, variant: 'success' }
  ]"
  :edges="[
    { from: 'audio', to: 'analysis' },
    { from: 'analysis', to: 'edits' },
    { from: 'edits', to: 'render' }
  ]"
  caption="Note editing measures the source, changes note spans, and renders a new audio buffer; it does not edit a Project MIDI clip."
/>

## Extract and render a monophonic take

`pitchPyin` supplies an F0 track. `extractNotes` turns that track and its voicing flags into `NoteObject[]`; each object carries sample and frame bounds, `medianHz`, amplitude, and a pending `edit`. Change the edit and pass the list to `renderNotes`.

::: code-group

```typescript [Browser / WASM]
import { extractNotes, init, pitchPyin, renderNotes } from '@libraz/libsonare';

await init();
const sampleRate = 48000;
const samples = new Float32Array(sampleRate * 2); // replace with decoded mono 48 kHz PCM
const pitch = pitchPyin({ samples, sampleRate, hopLength: 512 });
const notes = extractNotes({
  samples,
  sampleRate,
  f0Hz: pitch.f0,
  voiced: pitch.voicedFlag,
  frameRate: sampleRate / 512,
  minNoteMs: 40,
});
if (notes.length >= 1) notes[0].edit.pitchShiftSemitones = 1;
if (notes.length >= 2) notes[1].edit.muted = true;
const edited = renderNotes({ samples, sampleRate, notes, fadeMs: 10 });
```

```python [Python]
import libsonare as sonare

sample_rate = 48000
samples = [0.0] * (sample_rate * 2)  # replace with decoded mono 48 kHz PCM
pitch = sonare.pitch_pyin(samples, sample_rate=sample_rate, hop_length=512)
notes = sonare.extract_notes(
    samples,
    sample_rate,
    pitch.f0,
    sample_rate / 512,
    voiced=pitch.voiced_flag,
    min_note_ms=40,
)
if len(notes) >= 1:
    notes[0].edit.pitch_shift_semitones = 1.0
if len(notes) >= 2:
    notes[1].edit.muted = True
edited = sonare.render_notes(samples, sample_rate, notes, fade_ms=10)
```

:::

An identity edit passes its source span through. Before rendering, all edited source spans are cleared. Notes are then rendered in array order; a later note overwrites an earlier destination where they overlap, with an equal-power cross-fade at each edited edge (5 ms by default). `renderNotes` returns audio with the same length and sample rate as its input. Every source span must satisfy `0 <= onsetSample < offsetSample <= samples.length` and source spans must not overlap; an invalid span is refused. A moved or lengthened note can write over neighboring samples, but destination writes are clipped to the output buffer and output beyond either end is truncated. A muted note clears its source span and does not erase destinations rendered by other notes. Non-finite audio samples are refused. `gainDb` and every amplitude-envelope value must be finite, envelope values must be non-negative, and a non-finite gain-times-envelope result is refused.

The `NoteEdit` fields cover sample movement, semitone shift, gain in dB, time stretch, formant shift, mute, an amplitude envelope, and drift/vibrato changes. Ordinary edits do not need pitch metadata. Curve edits (`vibratoDepthChange` and `driftChange`) need the original `f0Hz` track and `frameRate` in the render request; in JS/WASM, `f0Hz` must be a `Float32Array`. An optional `voiced` flag array must have the same length as `f0Hz`: `false` suppresses a positive F0, while `true` cannot make a non-positive, non-finite, or otherwise unusable F0 valid. `decomposeNotePitch` accepts the same optional flags. `extractNotes` accepts either voiced flags or voiced probabilities; a non-positive or non-finite F0 frame contributes no pitch measurement.

### Seconds beside samples

A note or percussive event handed to `renderNotes` or `renderPercussiveEvents` gives each span bound as samples (`onsetSample`, `offsetSample`) or seconds (`onsetSec`, `offsetSec`), and an edit's move as `timeOffsetSamples` or `timeOffsetSec` (negative moves earlier). Seconds are rounded to the nearest sample at the call's sample rate. Give one spelling of each; both together is refused. Python spells these `onset_sec`, `offset_sec` and `time_offset_sec`.

```typescript
const edited = renderNotes({
  samples,
  sampleRate,
  notes: [{ onsetSec: 0.25, offsetSec: 0.75, edit: { timeOffsetSec: 0.1 } }],
});
```

A negative `onsetSample` or `offsetSample` is refused (`RangeError` on WASM and Node, `SonareValueError` in Python). `-1` is not a "to the end" sentinel; omit a bound to take the input's edge.

### Split and merge notes

`splitNote` cuts one note at a track frame and `mergeNotes` joins a run of notes. Both take the same source as `extractNotes` (`samples`, `sampleRate`, `f0Hz`, `voiced`, `frameRate`) plus the current `notes`, and return the whole new note set, because every note is re-derived from the audio and the track. Notes are therefore identified by their `frameStart` / `frameEnd`, not by object identity.

```typescript
import { mergeNotes, splitNote } from '@libraz/libsonare';

const source = { samples, sampleRate, f0Hz: pitch.f0, voiced: pitch.voicedFlag, frameRate: sampleRate / 512 };
const middle = Math.floor((notes[0].frameStart + notes[0].frameEnd) / 2);

const halves = splitNote({ ...source, notes, index: 0, frame: middle }); // one note longer
const rejoined = mergeNotes({ ...source, notes: halves, first: 0, last: 1 }); // back to the original count
```

`frame` must lie strictly inside the note's span and `first < last < notes.length`; otherwise the call throws a `SonareError` (`InvalidParameter`). A merged note spans from the first note's onset to the last note's offset, gap included, and takes the first note's edit; set the edit afterwards if the notes carried different ones. Python: `split_note(samples, sample_rate, f0_hz, frame_rate, notes, index, frame, voiced=...)` and `merge_notes(..., notes, first, last, voiced=...)`.

## Edit overlapping voices with a held analysis

`analyzePolyphonic` keeps the spectrogram and per-note claim sets in a native handle. The returned notes have the same `NoteObject` shape, while `setNoteEdit(index, edit)` changes only the pending edit. `render()` produces audio at the source length. The handle owns substantial memory, so analyze the passage being edited and release it with `destroy()` / `delete()`; Python supports `with PolyphonicAnalysis.analyze(...)` or `close()`.

::: code-group

```typescript [Browser / WASM]
import { analyzePolyphonic, init } from '@libraz/libsonare';

await init();
const sampleRate = 48000;
const samples = new Float32Array(sampleRate * 2); // replace with decoded mono 48 kHz PCM
const analysis = analyzePolyphonic({ samples, sampleRate, maxPolyphony: 3 });
try {
  const notes = analysis.notes();
  if (notes.length > 0) {
    const lowest = notes.reduce((a, b) => (a.medianHz <= b.medianHz ? a : b));
    analysis.setNoteEdit(notes.indexOf(lowest), { pitchShiftSemitones: 1 });
  }
  const edited = analysis.render({ fadeMs: 10 });
} finally {
  analysis.destroy();
}
```

```python [Python]
import libsonare as sonare

sample_rate = 48000
samples = [0.0] * (sample_rate * 2)  # replace with decoded mono 48 kHz PCM
with sonare.PolyphonicAnalysis.analyze(samples, sample_rate, max_polyphony=3) as analysis:
    notes = analysis.notes()
    if notes:
        edit = notes[0].edit
        edit.gain_db = -6.0
        analysis.set_note_edit(0, edit)
    edited = analysis.render(fade_ms=10)
```

:::

The fresh polyphonic render is the analysis round trip, including STFT reconstruction error; it is not a byte-for-byte copy of the source. A short passage is the practical unit: the held spectrogram and claim sets scale with the analyzed audio, and a released handle cannot be queried or rendered.

## An SMF as a reference melody: note targets


An SMF can provide the reference melody for a recorded take. `noteTargetsFromSmf` and `assignNoteTargets` are module-level functions: the first reads targets from an in-memory SMF, and the second applies them to notes from `extractNotes`. `pitchCorrectToMidi` on [Editing DSP](./editing-dsp.md) moves a whole buffer by one interval; this workflow assigns a target to each note.

A **note** (`NoteObject`) contains a sample span and measured `medianHz`. A **note target** (`NoteTarget`) is `{ startSec, endSec, targetMidi }`. They match by time rather than array index, and targets have no measured pitch. Target times are **seconds from the start of the audio the notes were extracted from**, not PPQ. An SMF stores events in quarter-note positions, and `noteTargetsFromSmf` converts each boundary through the file's tempo map, including stepwise tempo changes.

`noteTargetsFromSmf({ data, trackIndex? })` reads one track of an in-memory SMF and returns `NoteTarget[]` sorted by `startSec`. Each note-on is paired with the next note-off of the same note number on the same channel; a retrigger before the first note-off closes the newer sounding note. Each pair becomes one target at the note's own pitch. Unclosed note-ons and zero-length notes are omitted. A track with no closed note returns an empty array. `trackIndex` (default `0`) counts **MIDI-bearing tracks only**, not the file's own track numbering: a track holding only meta events — the conductor track `exportSmf` writes as track 0 — produces no clip and is not counted, so a project's own export has its first clip at index `0`. Unreadable bytes throw `InvalidFormat`; an index with no MIDI-bearing track throws `InvalidParameter`.

`assignNoteTargets({ notes, sampleRate, targets, unmatchedPolicy?, minOverlapRatio?, maxCorrectionSemitones? })` matches each note to the target it overlaps longest when that overlap covers at least `minOverlapRatio` (default `0.5`) of the note's span; an exact tie goes to the target that starts first. A matched note gets `edit.pitchShiftSemitones` equal to `targetMidi` minus its measured MIDI pitch, clamped to `maxCorrectionSemitones` (default `12`). `sampleRate` converts each note's `onsetSample` / `offsetSample` to seconds, so it must be the take's own rate. A note with a measured pitch and no target follows `unmatchedPolicy`:

| `unmatchedPolicy` | A pitched note with no target |
|-------------------|-------------------------------|
| `'leave'` (default) | Edit untouched; the note renders as recorded |
| `'mute'` | `edit.muted` is set |
| `'nearest'` | Takes the target nearest in time, however far away it is |

A note whose `medianHz` is not finite and positive is never assigned and never edited. The input notes are not modified. The result is `{ notes, assignedCount }`: a new array in which only `edit.pitchShiftSemitones` and `edit.muted` are rewritten, plus the number of notes that received a target. `assignedCount` can be `0`.

```typescript
import { assignNoteTargets, extractNotes, noteTargetsFromSmf, pitchPyin, renderNotes } from '@libraz/libsonare';

// 1. The reference: a project's own export, or any .mid file read into a Uint8Array.
const targets = noteTargetsFromSmf({ data: project.exportSmf() }); // melody is at trackIndex 0

// 2. The take: segment it into notes over an F0 track.
const pitch = pitchPyin({ samples, sampleRate, hopLength: 512 });
const notes = extractNotes({
  samples, sampleRate, f0Hz: pitch.f0, voiced: pitch.voicedFlag, frameRate: sampleRate / 512,
});

// 3. Line the two up; each matched note receives its pitch shift.
const { notes: retuned, assignedCount } = assignNoteTargets({
  notes, sampleRate, targets, unmatchedPolicy: 'mute',
});
if (assignedCount === 0) console.warn('the reference does not line up with the take');

// 4. Render the edited set back over the take.
const corrected = renderNotes({ samples, sampleRate, notes: retuned });
```

Node takes the same request objects. Python uses `note_targets_from_smf(data, *, track_index=0)`, returning `NoteTarget` dataclasses (`start_sec`, `end_sec`, `target_midi`), and `assign_note_targets(notes, sample_rate, targets, *, unmatched_policy="leave", min_overlap_ratio=None, max_correction_semitones=None)`, which returns a `(notes, assigned_count)` tuple. The C ABI is `sonare_note_targets_from_smf` / `sonare_assign_note_targets`. The SMF reader lives in the arrangement library, so a build without it reports `NotSupported` (in WASM, an `Error` from the wrapper) while `assignNoteTargets` stays available for targets built by hand.

## Related

- [Audio to MIDI](./audio-to-notes.md) — write symbolic notes to a project clip
- [Editing DSP](./editing-dsp.md) — whole-buffer transforms and realtime voice processing
- [MIDI 2.0, UMP, and Clip Files](./midi2.md) — full-resolution symbolic MIDI and clip-file exchange
