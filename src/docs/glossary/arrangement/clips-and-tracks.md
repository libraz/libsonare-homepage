---
title: Clips and Tracks
description: The project model behind a DAW arrangement — tracks, clips, the musical timeline, and how a MIDI track routes to an instrument — explained from scratch for newcomers to libsonare's editing engine.
---

# Clips and Tracks

When you arrange music in a DAW, you are really filling in a small, predictable structure. Learn that structure once and every arrangement feature makes sense. This page describes the **project model** libsonare uses, in plain language, before you read the [Project Editing](../../project-editing.md) guide.

::: info The one-sentence summary
A **project** holds **tracks**, each track holds **clips**, and every clip sits at a position on a shared **timeline** measured in musical time (bars and beats).
:::

## The project model, top to bottom

A **project** is the whole song. It is the container that everything else lives inside, and it is the thing you save, load, and eventually [bounce](./bounce-and-rendering.md) to a finished file.

Inside the project are **tracks**. A track is a single lane of content — think of one horizontal row in the arrangement view. Each track is an audio track, a MIDI track, or an aux (routing/return) track:

- An **audio track** holds recorded or imported sound (a vocal take, a guitar, a drum loop).
- A **MIDI track** holds *notes*, not sound. The notes are instructions ("play C4 now, hold it for one beat") that only become audible when an instrument turns them into sound.
- An **aux track** is a routing lane, such as an effect return or a submix. It is not where recorded content belongs.

Inside each track are **clips**. A clip is one block of content placed at a specific spot on the timeline. An audio clip points at a piece of audio; a MIDI clip contains a list of note events. You can have many clips on one track, side by side or with gaps between them.

<SonareDemo id="engine-lane-mixer" />

<FlowDiagram
  title="Project → tracks → clips → instrument"
  direction="TB"
  :nodes="[
    { id: 'project', label: 'Project', col: 1, row: 0, variant: 'accent' },
    { id: 'vocals', label: 'Audio track: Vocals', col: 0, row: 1 },
    { id: 'drums', label: 'Audio track: Drums', col: 2, row: 1 },
    { id: 'bass', label: 'MIDI track: Bass', col: 3, row: 1 },
    { id: 'clipVerse', label: 'Clip: verse vocal', col: 0, row: 2 },
    { id: 'clipChorus', label: 'Clip: chorus vocal', col: 1, row: 2 },
    { id: 'clipDrum', label: 'Clip: drum loop', col: 2, row: 2 },
    { id: 'clipBass', label: 'Clip: bass line', col: 3, row: 2 },
    { id: 'destination', label: 'MIDI destination', col: 3, row: 3, variant: 'accent' },
    { id: 'instrument', label: 'Instrument: NativeSynth / SoundFont', col: 3, row: 4, variant: 'success' }
  ]"
  :edges="[
    { from: 'project', to: 'vocals' },
    { from: 'project', to: 'drums' },
    { from: 'project', to: 'bass' },
    { from: 'vocals', to: 'clipVerse' },
    { from: 'vocals', to: 'clipChorus' },
    { from: 'drums', to: 'clipDrum' },
    { from: 'bass', to: 'clipBass' },
    { from: 'bass', to: 'destination', label: 'routes to' },
    { from: 'destination', to: 'instrument', label: 'renders' }
  ]"
  caption="Audio tracks already hold sound and just play. A MIDI track's clips hold notes, so the track separately routes to a destination bound to an instrument, which renders them at bounce time."
/>

## Musical time, not seconds

Here is the idea that trips up most beginners: clip positions are stored in **musical time**, not in seconds.

A clip does not start "at 4.27 seconds". It starts "at bar 3, beat 1". The unit underneath is the **quarter note**: positions and lengths are floating-point numbers where `1.0` is exactly one quarter note. One bar of 4/4 is `4.0`, an eighth note is `0.5`, a dotted quarter is `1.5` — they are not integer ticks or a 960-based resolution, even though the parameter names use `Ppq` (short for *pulses per quarter note*; e.g. `startPpq`, `lengthPpq`). Every clip start and length you set is in these quarter-note units, so `lengthPpq: 4` is four quarter notes long.

::: tip Why musical time matters
Because positions are musical, the arrangement stays correct when you change the tempo. Move the song from 120 BPM to 100 BPM and "bar 3, beat 1" simply happens later in seconds — but it is still bar 3, beat 1. MIDI notes never drift off the grid. Audio is different: a recording has its own fixed speed, so after a tempo change an audio clip still starts on its bar, but the recording inside it plays at its native rate unless the clip is [warped](./warp-and-tempo.md) to follow. The conversion from musical time to actual sample positions happens later, when the project is compiled and rendered; the next section shows the arithmetic.
:::

## Converting seconds, samples, and PPQ

Clips and events are placed in PPQ, but analysis results (onsets, chords, beats) come back in seconds or samples, and [warp anchors](./warp-and-tempo.md#warp-anchors-pinning-the-audio-to-the-grid) are in samples. `Project` has no conversion call, so the conversion is yours. It follows from the tempo map.

**Constant tempo.** One quarter note lasts `60 / bpm` seconds:

```text
seconds = ppq × 60 / bpm          ppq = seconds × bpm / 60
samples = round(seconds × sampleRate)
```

At 120 BPM and 48 kHz, `ppq: 1` is 0.5 s, or 24000 samples.

**Ramped segment.** Inside a tempo segment with an `endBpm`, the tempo moves in a straight line *per quarter note*, from `bpm0` at the segment's `startPpq` (`p0`) to `bpm1` at the next segment's start (`p1`). With `k = (bpm1 − bpm0) / (p1 − p0)`, the time from `p0` to a position `p` inside the segment is

```text
t = (60 / k) × ln(1 + k × (p − p0) / bpm0)        and back:  p = p0 + bpm0 × (e^(k × t / 60) − 1) / k
```

Add the segment's own start time, which is the sum of every earlier segment's duration.

Take the map from [Tempo map and tempo segments](../../project-editing.md#tempo-map-and-tempo-segments): 120 BPM from PPQ 0, a ramp from 120 to 140 BPM starting at PPQ 16, and 140 BPM from PPQ 32. The first segment is 16 quarter notes at 120 BPM, so PPQ 16 is at 8 s. The ramp has `k = (140 − 120) / 16 = 1.25`, so PPQ 24 is 8 + 48 × ln(130 / 120) ≈ 11.842 s, and PPQ 32 is 8 + 48 × ln(140 / 120) ≈ 15.399 s (739163 samples at 48 kHz). A [realtime engine](../../realtime-engine.md) given the same segments reports the same sample positions from `sampleAtPpq(ppq)`.

**A warp anchor.** A warp anchor's `warpSample` counts samples from the clip's own start. To pin a downbeat the recording has at source sample 95000 onto PPQ 8, in a clip starting at PPQ 4 at a constant 120 BPM and 48 kHz: PPQ 8 is (8 − 4) × 0.5 s = 2 s after the clip start, so the anchor is `{ warpSample: 96000, sourceSample: 95000 }`. Under a tempo map, take the difference of the two converted times instead.

## How a MIDI track makes sound

An audio track is self-contained: it already holds sound, so it just plays. A MIDI track is different. Its clips only hold note events, so something has to *perform* those notes.

That something is reached through the track's **MIDI destination**. A destination is a numbered routing slot. When you bind an instrument — such as **NativeSynth** or the **SoundFont** player — to a destination and route the track to it, the track's notes are dispatched to that instrument, which synthesizes the actual audio.

| Step | What you do | Result |
|------|-------------|--------|
| 1 | Add a MIDI track and a clip | A lane with notes, but silent |
| 2 | Put note events in the clip | The performance is written down |
| 3 | Route the track to a destination | Notes have somewhere to go |
| 4 | Bind an instrument to that destination | Notes become sound at render time |

This separation is powerful: the same MIDI clip can be played by a synth today and a sampled instrument tomorrow, just by changing the destination's instrument.

Step 2, *the performance is written down*, is literally a score: a clip's note events are standard musical notation. Here is one such clip engraved, then performed; switch the instrument and the same written notes are rendered by a different voice.

<SonareDemo id="midi-score" />

## What you can do to clips and tracks

Once the structure exists, arranging is mostly a handful of operations.

**Clip operations**, the everyday moves:

- **Move** a clip to a new position (and optionally to another track).
- **Set gain** to make one clip louder or quieter than its neighbors.
- **Fade in / fade out** so a clip enters and leaves smoothly instead of clicking.
- **Loop** a clip so a short block repeats across a longer region.
- **Duplicate** a clip to copy a part somewhere else.
- **Re-source** a clip to point it at different underlying material.
- **Remove** a clip you no longer want.

**Track operations** manage the lanes themselves: add a track, remove one, rename it, route it (bind it to a mixer strip / output, or set its MIDI destination), and change its kind between audio, MIDI, and aux.

::: warning Clips reference, they do not copy
Several clips can point at the *same* source material. Duplicating an audio clip shares the source rather than cloning the audio, which keeps projects small. Re-sourcing a clip changes only that clip; the others keep pointing at the shared source. Keep this in mind when you copy parts around.
:::

### Fade curves and crossfades

A fade multiplies the clip by a gain that runs from `0` to `1` (fade-in) or from `1` to `0` (fade-out) over the fade length. With `x` the fraction of the fade completed, the four curves `setClipFade` accepts are:

| Curve | Gain at `x` | Gain halfway | As a fade-in | As a fade-out |
|-------|-------------|--------------|--------------|---------------|
| `'linear'` | `x` | 0.5 (−6 dB) | Even ramp in amplitude | Even ramp in amplitude |
| `'equal-power'` | `sin(x · π/2)` | 0.707 (−3 dB) | Rises early, then levels off | Holds, then drops late |
| `'exponential'` | `x²` | 0.25 (−12 dB) | Stays quiet, then rises late | Drops early, then trails off quietly |
| `'logarithmic'` | `√x` | 0.707 (−3 dB) | Rises very early | Holds longest, then drops at the end |

A fade-out applies the same curve mirrored in time, with `x` counting the fraction of the fade still to go. The names describe the shape only: `'exponential'` is a square law and `'logarithmic'` a square-root law, not curves that are straight in decibels.

The choice matters most when two signals cross, as in a crossfade between overlapping clips, a loop seam, or a comp seam. What decides it is how alike the two signals are:

- **Unrelated material** (two different takes, two different sounds): their powers add, so the gains should satisfy `gain_out² + gain_in² = 1`. An `'equal-power'` pair (or a `'logarithmic'` pair) does this, and the level stays flat. A `'linear'` pair dips about 3 dB in the middle.
- **Near-identical material** (the same recording on both sides, or a loop point chosen on matching audio): the waveforms add in phase, so the gains should satisfy `gain_out + gain_in = 1`. A `'linear'` pair does this; an equal-power pair rises about 3 dB in the middle, because 0.707 + 0.707 = 1.41.

<FadeCurvesFigure
  title="Fade curves and what a crossfade sums to"
  caption="Left: the gain through a fade-in for each curve; the dots mark the halfway gains from the table. Right: a fade-out and a fade-in of the same curve, summed. Solid lines are near-identical material, which adds in amplitude; dashed lines are unrelated material, which adds in power. Linear stays flat for the first and dips 3 dB for the second, and equal-power does the reverse."
/>

The loop-seam crossfade (`loopCrossfadePpq`) and the comp-seam crossfade (`crossfadePpq` on a [comp segment](./takes-and-comping.md)) are always equal-power, which suits unrelated material. A single fade-in or fade-out has nothing to cross with, so there the curve is a matter of how the fade should sound.

## Source metadata and undo history

Two more edits sit above individual clips.

**Audio-source metadata.** Since several clips can share one source (see the warning above), it is often the source, not the clip, that needs to carry information. `setAudioSourceMetadata(sourceId, contentHash, externalStemRole)` attaches two informational strings to a source as one undoable edit: a `contentHash` a host can use to recognize the same underlying audio reappearing under a different source id (skip a redundant import, flag a stale reference), and an `externalStemRole` that records what an externally separated stem represents (for example "vocals" or "drums"), so a project built around stem separation can still tell its stems apart after a save and reload.

**Bounded undo/redo memory.** Every edit in this model — `moveClip`, `setClipGain`, `addAutomationLane`, and the rest — is retained on an undo stack so `undo()` / `redo()` can step back and forward through a session. Each edit command reports its own retained byte footprint, and `Project.setMaxHistoryBytes(bytes)` caps the *combined* memory the undo and redo stacks are allowed to hold; once the cap is reached, the oldest entries are evicted to make room. Setting the cap to zero disables retention entirely. `setMaxUndoDepth` caps the same history a different way, by entry count rather than bytes, and the two limits apply together.

::: details How libsonare implements this
The model lives on the `Project` class in the editing engine. `addTrack` creates a track (audio or MIDI), and `addMidiClip(startPpq, lengthPpq)` returns `{ trackId, clipId }` for a fresh MIDI track + clip; `addClip` adds an audio or MIDI clip to an existing track. All positions are floating-point quarter-note units (`1.0` = one quarter note), so `moveClip(clipId, newStartPpq, newTrackId?)`, `setClipGain(clipId, gain)`, `setClipFade(clipId, fadeIn, fadeOut)`, `setClipLoop`, `duplicateClip`, `setClipSource`, and `removeClip` work in musical time. Track lifecycle is `removeTrack`, `renameTrack`, `setTrackKind`, and `setTrackRoute`. A MIDI track reaches its instrument through `setTrackMidiDestination(trackId, destinationId)`: the compiler stamps each MIDI clip with that id so the engine dispatches its events to the instrument bound at that destination. The whole project round-trips through JSON via `toJson()` / `Project.fromJson(json)`, and musical time is converted to samples only at `compile()` / `bounce()`.
:::

Related: [Project Editing](../../project-editing.md), [Takes and Comping](./takes-and-comping.md), [Mixing Basics](../concepts/mixing-basics.md)
