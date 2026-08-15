---
title: Pitch Correction and Note Editing
description: MIDI-targeted pitch correction, note regions, and sample-accurate edits — how libsonare nudges a sung note toward a target and reshapes regions.
---

# Pitch Correction and Note Editing

**Pitch correction** nudges a note from its current pitch toward a target.

<SonareDemo id="pitch-correct" />

**Note editing** reshapes a chosen region, such as stretching one held note or tightening timing, without touching the rest of the clip.

Note editing is the surgical, region-aware one. Pitch correction is not: it takes no region and retunes the whole buffer you hand it. This page explains both through libsonare's `PitchCorrector` and `NoteEditor`; for the vocabulary, read [Editing Basics](../concepts/editing-basics.md).

## You supply the current pitch

`pitchCorrectToMidi` does not guess what note you sang. You provide the current note.

The workflow is:

1. Estimate the current pitch with `pitchYin`, `pitchPyin`, or your own detector.
2. Convert or read that pitch as a MIDI note number.
3. Pass the measured value as the **current** MIDI note.
4. Pass the desired note as the **target** MIDI note.

MIDI note numbers are semitone indexes:

| Example | Meaning |
|---------|---------|
| `69` | A4, 440 Hz |
| `68.7` | Slightly below A4 |
| `60` | C4, middle C |

Fractional values are normal because singers are rarely exactly on a note.

## Correction strength and transparency

Correction is a pitch shift, so the same artifact rules apply: small intervals stay transparent, large ones expose phase-vocoder smearing. For natural vocals, correct by small amounts toward the nearest scale tone rather than forcing a big jump. Hard, full-snap correction is a creative effect, not a transparent fix.

::: warning `pitchCorrectToMidi` retunes the whole buffer
`pitchCorrectToMidi(samples, sampleRate, currentMidi, targetMidi)` has no region parameter. It works out one interval and transposes every sample by it, so pointing it at a full take moves the whole take — not just the note you were listening to. It also clamps the interval to ±12 semitones without reporting anything, so a two-octave request quietly comes back one octave short.

To fix one note inside a take, either slice that span out of the buffer yourself and correct the slice, or use the time-varying variants: their per-frame F0 contour and `voiced` flags are what localise the correction, because unvoiced frames are left alone and each voiced frame gets its own amount.
:::

<SonareDemo id="pitch-shift" />

## Note regions: samples, not seconds

Region-based edits like `noteStretch` take **sample offsets**, not seconds, because sample positions are exact and never drift. Convert with `samples = round(seconds × sampleRate)` — at 48 kHz, 0.25 s is sample 12000. A region has an onset sample and an offset sample — where the note starts and where it ends; `stretchRatio > 1` lengthens that region, which pushes everything after it later by the same amount and makes the clip longer. The audio outside the region is otherwise untouched, apart from a short equal-power crossfade at each splice.

If your UI works in seconds, convert to samples immediately before the call. Passing fractional seconds can land a sample away from where you meant, depending on how it rounds, and that can turn into a faint click at a loop seam. Thinking in samples keeps every edit on the exact position you chose.

::: details How libsonare corrects and edits
`pitchCorrectToMidi` maps a current→target MIDI interval to a pitch shift over the signal, reusing the phase-vocoder path from [Time Stretch and Pitch Shift](./phase-vocoder-stretch.md). Region edits use `NoteEditor` (`NoteEditorConfig`) over a `NoteRegion` defined by onset/offset sample offsets, with `NoteSegmenter` helping locate regions. `noteStretch` applies a region-bounded stretch ratio. All operate on decoded mono samples; `Audio` exposes the same operations as methods so file workflows can load once and edit.
:::

Related: [Editing Basics](../concepts/editing-basics.md), [Time Stretch and Pitch Shift](./phase-vocoder-stretch.md), [Melody and Pitch](../analysis/melody-pitch.md), [Editing DSP](../../editing-dsp.md)
