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

Put differently: pitch carries *which note*, formants carry *whose voice* and *which vowel*. An instrument keeps its timbre as you play up and down the keyboard, and in the same way a singer keeps the character their vocal tract gives them across different notes. Because the two are independent, it is worth being able to move them separately.

## Why pitch shifting alone sounds wrong

A plain pitch shift moves *everything* up, formants included. Shift a voice up several semitones and the formants rise too, shrinking the apparent size of the singer — the "chipmunk" effect. Shift down and you get an unnatural, oversized voice. The problem is that pitch and formants were never meant to move together.

<SonareDemo id="pitch-shift" />

## Pitch and formant on separate controls

Good voice editing exposes the two independently:

- Change **pitch** alone → the same person sounds like they are singing a higher or lower note.
- Change **formant** alone → the voice sounds smaller/brighter or larger/darker at the *same* pitch.
- Change both → from subtle character tweaks to dramatic voice design.

To make a male voice read as female, for instance, raise the formants a little as well as the pitch. Leave the pitch where it is and lower the formants instead, and the same performance sounds fuller and calmer.

Having the two on separate controls is what makes natural transposition (transpose, then put the formants back) and creative voice design (warp formants freely) both possible from one tool. As always, small moves stay natural; large moves are an effect.

::: warning `formantFactor` stacks on top of the pitch shift
In `voiceChange` the pitch shift runs first, and a pitch shift moves the whole spectrum — formants included. `FormantWarp` then works on that already-shifted signal, so `formantFactor` multiplies the formant displacement the transpose has already caused. `formantFactor: 1.0` means "no *extra* formant move", not "formants preserved": `{ pitchSemitones: 5, formantFactor: 1.0 }` is a plain chipmunk shift, with the formants sitting 2<sup>5/12</sup> ≈ 1.33× too high.

To transpose while holding the formants where they were, pass the reciprocal of the pitch ratio:

```typescript
const pitchSemitones = 5;
const formantFactor = 2 ** (-pitchSemitones / 12); // 0.749 for +5 semitones
const natural = voiceChange(vocal, sampleRate, { pitchSemitones, formantFactor });
```

Anything above that reciprocal brightens and shrinks the voice; anything below it darkens and enlarges it.
:::

<SonareDemo id="formant-shift" />

Compare this with the [pitch shift](#why-pitch-shifting-alone-sounds-wrong) above: there the harmonic comb — the evenly spaced stack of overtones above the sung note — slides and the formants ride along; here the comb and the fundamental (the lowest of those, the one that sets the note) hold still while only the envelope moves, meaning the formant shape riding on top of that comb. Those are the two independent axes `voiceChange` exposes.

::: details How libsonare changes a voice
`voiceChange` takes `pitchSemitones` and `formantFactor` as separate arguments and applies them as two stages in that order. The pitch stage reuses the phase-vocoder/resampling backend from [Time Stretch and Pitch Shift](./phase-vocoder-stretch.md), and its resampling step scales the whole spectrum, envelope and all. The formant stage, `FormantWarp` (`FormantWarpConfig`), then does LPC analysis of the shifted signal and resamples that envelope along the frequency axis by `formantFactor`, leaving the harmonic structure — and therefore the note — untouched. A factor of exactly `1.0` skips the stage entirely, so the LPC round trip costs nothing on a pitch-only change. Lowering the factor moves the envelope down (larger, darker); raising it moves the envelope up (smaller, brighter). It operates on decoded mono samples like the other editing helpers.
:::

Related: [Editing Basics](../concepts/editing-basics.md), [Time Stretch and Pitch Shift](./phase-vocoder-stretch.md), [Pitch Correction](./pitch-correction.md), [Editing DSP](../../editing-dsp.md)
