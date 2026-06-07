---
title: Voice and Formant
description: Formants, the vocal tract, pitch vs formant independence, and voice change — how libsonare reshapes vocal character without retuning the note.
---

# Voice and Formant

Changing a voice well means separating two things that naive pitch shifting smears together: the **note** being sung and the **character** of the voice.

That character lives in the **formants**.

This page grounds voice editing in libsonare's `VoiceChanger` and `FormantWarp`; for the vocabulary, read [Editing Basics](../concepts/editing-basics.md).

## What a formant is

A **formant** is a peak of acoustic energy at a fixed frequency range. In a voice, those peaks come from resonances of the vocal tract: mouth, throat, and nasal cavity.

Formants define two things:

| Formants affect | Example |
|-----------------|---------|
| Vowel identity | The difference between "ee" and "oh" |
| Perceived voice character | Whether a voice feels smaller, larger, brighter, or darker |

The important point is that formants stay in roughly the **same frequency regions regardless of the note**. A soprano and a bass singing the same vowel have very different pitches, but their formants can sit in similar regions.

## Why pitch shifting alone sounds wrong

A plain pitch shift moves *everything* up, formants included. Shift a voice up several semitones and the formants rise too, shrinking the apparent size of the singer — the "chipmunk" effect. Shift down and you get an unnatural, oversized voice. The problem is that pitch and formants were never meant to move together.

<SonareDemo id="pitch-shift" />

## Pitch and formant on separate controls

Good voice editing exposes the two independently:

- Change **pitch** alone → the same person sounds like they are singing a higher or lower note.
- Change **formant** alone → the voice sounds smaller/brighter or larger/darker at the *same* pitch.
- Change both → from subtle character tweaks to dramatic voice design.

That independence is what makes natural transposition (shift pitch, hold formants) and creative voice design (warp formants freely) both possible from one tool. As always, small moves stay natural; large moves are an effect.

::: details How libsonare changes a voice
`voiceChange` takes `pitchSemitones` and `formantFactor` as separate arguments. The pitch path reuses the phase-vocoder/resampling backend from [Time Stretch and Pitch Shift](./phase-vocoder-stretch.md), while `FormantWarp` (`FormantWarpConfig`) shifts the spectral envelope independently of the harmonic structure — so the vocal-tract character moves without retuning the note. Lowering the formant factor makes a voice larger and darker; raising it makes it smaller and brighter; the pitch stays where `pitchSemitones` puts it. It operates on decoded mono samples like the other editing helpers.
:::

Related: [Editing Basics](../concepts/editing-basics.md), [Time Stretch and Pitch Shift](./phase-vocoder-stretch.md), [Pitch Correction](./pitch-correction.md), [Editing DSP](../../editing-dsp.md)
