---
title: Physical Modeling
description: Physical modeling computes the instrument rather than replaying a recording of it — the digital waveguide, why expression becomes continuous instead of switched, the cost inversion against sampling, and the nine acoustic models libsonare builds this way.
---

# Physical Modeling

**Physical modeling** is usually met as a marketing word, and the natural guess is that it means "very good samples". It means close to the opposite. A sampled instrument holds a recording of a sound that already happened. A physical model holds a description of the *object* that would make the sound, and computes the note while you are listening to it. There is no recording anywhere in the signal path, because nothing was ever recorded.

This page explains what that buys, what it costs, and where it stops working. It is concepts only — no code.

::: info Two answers to the same question
Asked "what does a cello sound like", a sampler answers with a recording of one. A model answers with a string, a bow and a body, and lets the arithmetic decide. The first is accurate about one performance; the second is accurate about the *mechanism*, which is a different kind of accuracy and behaves differently at the edges.
:::

## Simulating the object

A vibrating string is not a waveform. It is a medium that carries waves which travel along it, reflect at each end, lose a little energy on every trip, and interfere with each other on the way. The tone you hear is what is left over after all of that, radiated through a bridge and a body. A model reproduces that process, sample by sample, and takes whatever comes out.

The consequence worth internalising is that **a model has no notion of a "note" as a stored thing**. It has a state — how much energy is where, in which direction it is moving — and a rule for advancing that state by one sample. Play a note, and the state evolves. Push on it halfway through, and the state evolves differently from there. Nothing is looked up.

## The digital waveguide

The workhorse of the family is the **digital waveguide**, and it is simpler than the name suggests. Three parts:

- A **delay line** stands in for the travel. A wave leaving one end takes a fixed number of samples to reach the other, and that number *is* the pitch: a shorter trip means a faster round trip means a higher note. These engines have no tuning oscillator, because length does the tuning.
- A **loss filter** stands in for what the trip costs. Every reflection loses energy, and loses more of it at high frequencies than at low — which is exactly why a plucked note goes dull before it goes quiet. One filter in the loop reproduces the whole decay behaviour.
- An **exciter** puts energy in. A hammer, a plectrum, a bow, a reed, a pair of lips, a jet of air.

<FlowDiagram
  title="The waveguide loop"
  :nodes="[
    { id: 'exc', label: 'Exciter', col: 0, row: 0, variant: 'accent' },
    { id: 'delay', label: 'Delay line (travel)', col: 1, row: 0 },
    { id: 'loss', label: 'Loss filter (reflection)', col: 2, row: 0 },
    { id: 'rad', label: 'Radiation', col: 1, row: 1, variant: 'success' }
  ]"
  :edges="[
    { from: 'exc', to: 'delay', label: 'energy in' },
    { from: 'delay', to: 'loss' },
    { from: 'loss', to: 'exc', label: 'the wave comes back' },
    { from: 'delay', to: 'rad', label: 'tap', style: 'dashed' }
  ]"
  caption="Pitch is the length of the round trip, decay is the loss filter, and the only stage that differs between a bow, a reed and a lip is the exciter — which is why brightness and damping mean the same thing on all of them."
/>

Because the loop is shared and only the exciter changes, the family is unusually coherent: a control that means "brighter" on a clarinet model means the same thing on a trumpet model, since both are describing the same loss stage.

## Expression becomes continuous, not switched

This is the practical difference, and it is larger than it sounds.

A sampler is a set of recordings arranged in a grid — a few notes across the keyboard, a few velocity layers stacked at each. Playing harder means **selecting a different recording**. However many layers were recorded, the grid is finite, and everything between two layers is a crossfade between two performances that never happened together. Worse, once a note has started, the recording is chosen: the sampler can fade it, filter it, or start another one, but it cannot make the note that is already sounding have been played harder.

A model has no grid. Force on the bow is a number the loop reads on every sample, so pressing harder mid-note makes the string grip differently *from that sample onward* — and the brightness that comes with it is not an effect applied on top, it is the consequence of the string being driven harder. You push on the bow instead of picking a louder recording, and the instrument responds the way an instrument does, because the thing being pushed on is the model of the mechanism.

## The cost inversion

Compared to sampling, physical modeling trades one resource for the other, and the trade is close to total:

| | Sampled instrument | Physical model |
|---|---|---|
| **Data** | Hundreds of megabytes; every note, every layer had to be recorded | A few dozen numbers |
| **CPU** | Read memory, resample, mix | Solve the physics once per sample, per voice |
| **Budget you run out of** | Disk, download, memory | Polyphony |
| **What a new note costs** | Nothing it did not already cost | Its own delay lines, filters and resonators |

That inversion is why these voices can be the floor under a MIDI file that arrives with no [SoundFont](./soundfont.md) at all: there is nothing to download, because there is nothing to store. It is also why a dense arrangement of bowed strings is a heavier render than the same arrangement played from samples. You are not fetching audio; you are computing it.

## Struck, and sustained

The exciters divide into two kinds, and the division decides what a player can do mid-note.

A **struck or plucked** exciter is finished almost immediately. A hammer contacts the string, transfers its energy, and leaves; everything afterwards is the loop ringing down on its own. Every expressive decision had to be made at the instant of the strike — how hard, how fast, where along the string — and after that the note is committed. This is not a limitation of the model; it is the piano.

A **sustained** exciter keeps feeding the loop for as long as the note lasts. A bow stays on the string, a breath keeps arriving at the reed, a bellows keeps pushing air past the tongue. The exciter is inside the loop, reacting to the wave coming back at it, which is what makes these instruments feel alive: press harder and the tone changes because the coupling changed, not because a parameter was faded.

What that buys is that **the player stays in the note**. A crescendo on a bowed string is one continuous gesture, not a sequence of re-articulations, and a wind player can shape a phrase after the attack has gone. On a struck model there is nothing left to shape, so an expressive control routed there has nowhere to land — and libsonare says so explicitly rather than accepting the control and quietly doing nothing with it.

## The honest limits

Two of them, and both are worth knowing before reaching for a model.

**A model sounds like what was modelled.** It is not a general-purpose realism setting. A bore model gives you clarinets and saxophones very well and gives you a choir not at all. The specific voice of a *specific* instrument — this cello, in this hall — is not in the mechanism, and getting close to it is calibration work rather than something the method provides.

**Outside its fitted range, a model does not degrade gracefully.** A sampler pushed past its recorded range sounds wrong in a familiar way: too bright, too slow, obviously stretched. A model pushed past the parameter range it was fitted for can stop being the instrument altogether — a bow force nothing grips at, a blowing pressure that overblows into a mode nobody wanted, a loss filter that stops losing and lets the loop run away. The failure is not a quality gradient; it is a different object.

## The nine acoustic models

libsonare's [built-in synthesizer](../../native-synth.md) builds nine of its engines this way. Each one is organised around one physical quantity — the thing a player actually controls, which the rest of the model is arranged to respond to:

| Model | What it models | The quantity it is built around |
|---|---|---|
| `piano` | Felt hammer, coupled unison strings, soundboard | Where the hammer strikes |
| `pipe-organ` | Flue pipe drawing on a shared wind chest | Wind pressure at the mouth |
| `bowed-string` | Rosined bow gripping and slipping on a string | Contact point and bow force |
| `reed` | Cane reed valving a cylindrical or conical bore | Blowing pressure and reed stiffness |
| `brass` | Lip valve on a flared bore | Blowing pressure and embouchure |
| `flute` | Air jet across an edge, driving an open pipe | Jet transit time against the bore period |
| `plucked-string` | String grazing a curved bridge | Pluck point and bridge buzz |
| `vocal` | Glottal source through five vowel formants | Which vowel |
| `free-reed` | Metal tongue swinging through a slot | Bellows pressure and tongue stiffness |

The parameters each one exposes, their defaults and ranges, and how settled each model is today all live on [Physical Models](../../physical-models.md). Two further engines are physical in spirit without being waveguides — `modal` strikes a bank of tuned resonators, and `percussion` models a circular membrane with a noise bed — and they are described alongside the rest on [Built-in Synthesizer](../../native-synth.md).

::: details How libsonare implements this
**Seven of the nine are waveguides** in the loop-and-loss-filter sense above: `piano`, `pipe-organ`, `bowed-string`, `reed`, `brass`, `flute` and `plucked-string`. **Two are not.** `vocal` is a source-filter model — a glottal source through a bank of vowel formant resonators, with no loop at all — and `free-reed` is a driven tongue swinging through a slot with no coupled air column. Both are in the family because they are still solved from a mechanism rather than drawn as a waveform.

Live expression reaches a model through **four abstract excitation axes** rather than through named per-voice fields: **force** (drive into the exciter — bow force, mouth pressure, bellows pressure), **position** (where the exciter meets the resonator, which only the bowed string has), **brightness** (timbral opening of the radiating end, held apart from loudness) and **morph** (registration morph, for an engine whose spectrum is drawn rather than excited). A modulation route names an axis, not an engine, so one dispatch line serves every voice and each engine reads only the axes it declares.

The accept set is declared rather than inferred: `engine_axis_capability()` in `excitation_axes.h` carries one row per engine mode, the switch behind it has no `default:` label so a new mode that declares nothing fails to compile, and an engine marked continuously excited with an empty axis mask fails a `static_assert`. **The struck and plucked engines decline all four axes** — `karplus-strong`, `modal`, `percussion`, `piano`, `plucked-string` and `harpsichord`, alongside the non-physical `subtractive`, `fm` and `sample` — because their exciter is finished before the second sample renders, so there is nothing per-sample for a route to reach. `additive` is the in-between case: drawbar tonewheels sustain but are not excited, so it takes the morph axis alone. `vocal` takes brightness only, force having no target that is not already the brightness tilt or the amplifier.
:::

Related: [Physical Models](../../physical-models.md), [Built-in Synthesizer (NativeSynth)](../../native-synth.md), [Sound Sources](../../sound-sources.md), [Synthesis Basics](./synthesis-basics.md), [SoundFont and Sampled Instruments](./soundfont.md)
