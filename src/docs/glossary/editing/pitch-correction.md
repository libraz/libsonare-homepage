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

Correction is a pitch shift, so the same rule applies: small intervals stay transparent, large ones expose the resynthesis. Which artifacts you hear depends on the engine doing the work (see the next section). For natural vocals, correct by small amounts toward the nearest scale tone rather than forcing a big jump. Hard, full-snap correction is a creative effect, not a transparent fix.

## Two resynthesis engines

libsonare changes pitch in two different ways, and the choice decides what happens to the formants (the vocal-tract resonances; see [Voice and Formant](./voice-formant.md)).

| Engine | How it works | Formants | Typical artifacts | Used by |
|--------|--------------|----------|-------------------|---------|
| Phase vocoder + resample | Stretch the audio in the STFT domain, then resample it back to the original length ([Time Stretch and Pitch Shift](./phase-vocoder-stretch.md)) | Move with the pitch (the "chipmunk" effect) | Phasiness, smeared attacks | `pitchShift`, `pitchCorrectToMidi`, the pitch stage of `voiceChange`, `renderNotes`' `pitchShiftSemitones` |
| TD-PSOLA (time-domain pitch-synchronous overlap-add) | Cut the waveform into grains one pitch period long and lay them down closer together or further apart | Stay roughly in place, because each grain keeps its own spectral envelope | Roughness or buzz on breathy or noisy voices; needs a usable F0 | `pitchCorrectToMidiTimevarying`, `pitchCorrectTimevarying`, `autoTune`, the vocal edit session, `renderNotes`' vibrato and drift edits |

TD-PSOLA moves each grain by the per-frame correction, so it only touches voiced frames and needs the F0 contour you pass in. One pass covers up to 6 semitones; a larger correction is applied as several passes. The phase-vocoder path needs no pitch track, which is why the constant-interval calls use it.

::: warning `pitchCorrectToMidi` retunes the whole buffer
`pitchCorrectToMidi(samples, sampleRate, currentMidi, targetMidi)` has no region parameter. It works out one interval and transposes every sample by it, so pointing it at a full take moves the whole take — not just the note you were listening to.

The interval itself is applied in full. Both endpoints are yours, so this is a transposition rather than a correction: C3 → C5 moves the buffer by all 24 semitones. `max_correction_semitones` bounds only a *retune* — a correction computed from a measured pitch — so it does not apply here. Both MIDI numbers are validated to `[0, 127]` and a value outside that range is rejected rather than silently adjusted.

To fix one note inside a take, either slice that span out of the buffer yourself and correct the slice, or use the time-varying variants: their per-frame F0 contour and `voiced` flags are what localize the correction, because unvoiced frames are left alone and each voiced frame gets its own amount.
:::

<SonareDemo id="pitch-shift" />

## Snapping to a scale

Correcting toward one note fits a single held pitch. A whole line is corrected toward a key instead: each voiced frame is pulled to the nearest tone of the scale, and three controls shape how it feels. **Retune amount** is how far toward the target a frame moves, **retune speed** is how quickly it gets there, and **vibrato threshold** is the deviation small enough to count as already in tune. Sung vibrato (typically ±50 to ±100 cents) is wider than the default threshold of 20 cents, so it survives mainly through a slower retune speed, which follows the average pitch instead of every swing. [Editing DSP](../../editing-dsp.md#scale-snap-correction) lists the options, and [Tune a Vocal Take](../../use-cases/vocal-tuning.md) walks through a full take.

## Note regions: sample positions

Region-based edits like `noteStretch` take **sample positions**, which are exact and never drift; `onsetSec` / `offsetSec` give the same bounds in seconds, rounded to the nearest sample. `samples = round(seconds × sampleRate)` — at 48 kHz, 0.25 s is sample 12000. A negative position is refused. A region has an onset sample and an offset sample — where the note starts and where it ends. `stretchRatio > 1` lengthens the replacement region, and `noteStretch` blends the source samples at its start and end with an equal-power crossfade. These crossfades stay inside the replacement region rather than consuming neighboring samples, so the clip length and the shift of following material follow the replacement region's length change. `stretchRatio: 1` keeps the whole clip length neutral; for other ratios, the time-stretch backend can round the replacement length by a few samples. A clip edge has no neighboring audio on that side, so it has no crossfade there. Because the two sides of a seam are closely related, the level inside it can move by a few dB on sustained material; [Editing DSP](../../editing-dsp.md#region-selection-for-notestretch) gives the measured figures.

Seconds are rounded once, at the call's sample rate; keep the sample value if the position comes from analysis.

::: details How libsonare corrects and edits
`pitchCorrectToMidi` maps a current→target MIDI interval to a pitch shift over the signal, reusing the phase-vocoder path from [Time Stretch and Pitch Shift](./phase-vocoder-stretch.md). The contour-following correctors run `PitchCorrector::resynthesize`, the TD-PSOLA path, over the per-frame corrections. `PitchCorrectionConfig::max_correction_semitones` (default 12) bounds only the paths that derive the correction from a measured F0 — the `F0Track` overloads and the per-frame pipeline — never a caller-stated interval. Region edits use `NoteEditor` (`NoteEditorConfig`) over a `NoteRegion` defined by onset/offset sample offsets, with `NoteSegmenter` helping locate regions. `noteStretch` applies a region-bounded stretch ratio. All operate on decoded mono samples; `Audio` exposes the same operations as methods so file workflows can load once and edit.
:::

Related: [Editing Basics](../concepts/editing-basics.md), [Edit Notes Inside Audio](../../note-editing.md), [Time Stretch and Pitch Shift](./phase-vocoder-stretch.md), [Melody and Pitch](../analysis/melody-pitch.md), [Editing DSP](../../editing-dsp.md)
