---
title: Editing Basics
description: The vocabulary of audio editing — pitch vs time, semitones and cents, MIDI note numbers, formant, and samples vs seconds — explained for newcomers before they touch the libsonare editing DSP.
---

# Editing Basics

**Editing** here means changing the sound of one part: its pitch, its length, or the character of a voice.

It is different from **analysis**, which only *measures* a track and leaves it untouched. It is also different from **mixing**, which *balances* several parts together.

This page defines the words you need before reading the [Editing DSP](../../editing-dsp.md) guide. It is concepts only; no code.

::: tip Where editing sits
You usually **edit** individual parts (fix timing, tune a note, change a voice), then **mix** them together, then **master** the finished stereo file for delivery. Editing is the per-part repair-and-shape step. Conservative edits keep the part natural; aggressive edits are a creative effect.
:::

## Pitch and time are independent

Speed up a tape and the music gets both faster *and* higher — the two are coupled. The whole point of modern editing DSP is to **separate** them, so you can change one without dragging the other along:

- **Time stretch** changes the duration without changing the pitch. Here `rate` is a playback-speed multiplier: a `rate` above `1.0` plays faster, so the clip gets *shorter*; below `1.0` plays slower, so it gets *longer*.
- **Pitch shift** changes the pitch without changing the duration.

Doing this cleanly is hard: the algorithm has to invent or remove time while keeping each note's frequency, so very large moves always leave some artifacts (smearing, a "phasey" or robotic tone). Small moves stay transparent.

<SonareDemo id="time-stretch" />

## Semitones and cents

Pitch in music is measured in **semitones**, the smallest step on a piano keyboard. Twelve semitones make one **octave**, and an octave **doubles** the frequency: A4 = 440 Hz, A5 = 880 Hz.

So `semitones = 12` shifts up one octave, `-12` shifts down one octave, and `7` is a perfect fifth.

A **cent** is 1/100 of a semitone. It is used for fine tuning; most listeners start to notice pitch error past roughly ±5-10 cents.

## MIDI note numbers

When a function asks for a *MIDI note number* (such as `pitchCorrectToMidi`'s `currentMidi` and `targetMidi`), it wants an integer (or fractional) index where **each whole number is one semitone**. Two anchors are worth memorizing:

- **A4 = 69 = 440 Hz** — the tuning reference.
- **C4 = 60** — "middle C".

Every octave adds 12, so C5 = 72, C3 = 48. A few common targets:

| Note | MIDI | Frequency |
|------|------|-----------|
| C3 | 48 | 130.81 Hz |
| C4 (middle C) | 60 | 261.63 Hz |
| E4 | 64 | 329.63 Hz |
| G4 | 67 | 392.00 Hz |
| A4 (tuning reference) | 69 | 440.00 Hz |
| C5 | 72 | 523.25 Hz |

To convert by hand: `midi = 69 + 12 · log2(freq / 440)` and `freq = 440 · 2^((midi − 69) / 12)`. A fractional MIDI value like `68.7` is simply a pitch a little below A4 — useful because a singer is rarely exactly on a note, and you can pass the *measured* pitch as the `current` value and a whole number as the `target`.

## Formant: pitch's independent partner

A **formant** is a peak of acoustic energy at a fixed frequency range. In a voice, formants come from resonances of the vocal tract. In instruments, similar resonances come from the body of the instrument.

Formants shape vowels and the *perceived size or character* of a voice. They are different from pitch: a singer can sing different notes while the vowel character still comes from the same vocal-tract resonances.

This is why voice tools keep pitch and formant on separate controls.

| Control | What changes | What you hear |
|---------|--------------|---------------|
| Pitch | The musical note | The same voice singing higher or lower |
| Formant | The vocal character | A smaller/brighter or larger/darker voice at the same note |

Moving both together too aggressively creates the familiar artificial "chipmunk" effect.

## Samples vs seconds

Editing functions that act on a *region* (like note stretch) usually take **sample offsets**, not seconds, because sample positions are exact and never drift. Convert with `samples = round(seconds × sampleRate)` — at 48 kHz, 0.25 s is sample 12000. See [Audio Basics](./audio-basics.md) for what a sample and sample rate are.

:::: details How libsonare implements editing DSP

The implementation uses the same C++ DSP core as analysis and mastering, but these functions **rewrite** the signal instead of measuring it.

| Function family | Implementation idea | Beginner takeaway |
|-----------------|---------------------|-------------------|
| Time stretch / pitch shift | Phase vocoder plus resampling | Duration and pitch can be changed separately, but large moves create artifacts |
| `voiceChange` | Shift the spectral envelope separately from harmonic pitch | Voice character can move without changing the target note |
| `pitchCorrectToMidi` | Move from a caller-supplied current MIDI note to a target MIDI note | Estimate the current pitch first with `pitchYin`, `pitchPyin`, or your own detector |
| `noteStretch` | Process an exact sample-offset region | Convert seconds to samples before calling it |

::::

Related: [Editing DSP](../../editing-dsp.md), [Audio Basics](./audio-basics.md), [MIR Overview](./mir-overview.md), [JavaScript API](../../js-api.md)
