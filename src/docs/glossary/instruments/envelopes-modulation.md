---
title: Envelopes and Modulation
description: Modulation means something changing over time — ADSR and DAHDSR envelopes, one-shot notes, filter envelopes, LFOs, per-voice drift, velocity, key tracking, and the mod matrix that routes them, explained for newcomers.
---

# Envelopes and Modulation

A raw oscillator is static: press a key and it drones at one volume and one tone forever. Real instruments are alive — a note swells, brightens, decays, and fades. **Modulation** is the umbrella word for *something changing over time*, and it is what turns a flat synth tone into a musical sound.

This page explains the two kinds of modulation sources you will meet most often (envelopes and LFOs), the slow per-voice drift that keeps stacked notes from sounding identical, the performance inputs that also act as modulation (velocity and key tracking), and the **mod matrix** that wires sources to destinations. It is concepts first; the parameter names are collected at the end. For the blocks being modulated, read [Synthesis Basics](./synthesis-basics.md) first.

## The ADSR amplitude envelope

An **envelope** is a shape that plays out once per note. The classic envelope has four stages — **A**ttack, **D**ecay, **S**ustain, **R**elease (ADSR) — and the most important one controls loudness over the life of the note:

<FlowDiagram
  title="ADSR envelope"
  :nodes="[
    { id: 'keydown', label: 'Key down', col: 0, row: 0, variant: 'muted' },
    { id: 'attack', label: 'Attack', col: 1, row: 0 },
    { id: 'decay', label: 'Decay', col: 2, row: 0 },
    { id: 'sustain', label: 'Sustain', col: 3, row: 0, variant: 'warning' },
    { id: 'release', label: 'Release', col: 4, row: 0 }
  ]"
  :edges="[
    { from: 'keydown', to: 'attack' },
    { from: 'attack', to: 'decay' },
    { from: 'decay', to: 'sustain' },
    { from: 'sustain', to: 'release', label: 'key up' }
  ]"
  caption="Only Sustain holds at a level — Attack, Decay, and Release move toward one and take actual time."
/>

| Stage | What it controls | Long value sounds like | Short value sounds like |
|-------|------------------|------------------------|-------------------------|
| **Attack** | Time to rise from silence to full level | Slow swell (pad, strings) | Instant hit (pluck, piano) |
| **Decay** | Time to fall from the peak down to the sustain level | Gradual settle | Quick drop |
| **Sustain** | The *level* held while the key stays down (not a time) | Loud held body (high level) | Quiet or silent even while held (low/zero level) |
| **Release** | Time to fade after the key is let go | Long tail, reverb-like | Abrupt cut-off |

A plucked sound is fast attack, fast decay, zero sustain, short release. A pad is slow attack, high sustain, long release. Same oscillator — completely different instrument, just from the envelope.

<SonareDemo id="synth-adsr" />

::: info Attack/Decay/Release are times; Sustain is a level
Three of the four ADSR controls are durations (in milliseconds). Sustain is the odd one out: it is a *volume level*, the amount held for as long as you keep the key down. That is why a "zero sustain" patch goes silent even while the key is still pressed.
:::

### The shape of each stage

The stages are curves, not straight lines, because a straight-line fade sounds mechanical: real instruments die away by a fixed fraction per unit of time.

- **Attack** rises along a curve that is steep at first and flattens near the top, and it reaches full level at exactly the attack time. Measured in NativeSynth with a 200 ms attack, the level is −7.4 dB at 50 ms, −3.2 dB at 100 ms and full at 200 ms.
- **Decay and release** fall exponentially, which is a straight line when the level is drawn in decibels. The time you set is where the fall has covered about 26 dB (three time constants, about 95% of the way), not where it reaches silence. A 600 ms release measures −8.5 dB after 200 ms, −17.2 dB after 400 ms, −25.9 dB after 600 ms, and is still at −51.9 dB after 1.2 s.

<EnvelopeCurveFigure
  title="An amplitude envelope in decibels"
  caption="Attack 200 ms, decay 300 ms to a sustain of 0.5, release 600 ms. The attack aims past full scale and stops where it reaches it, which is why it is steep early. On a decibel axis the release is a straight line: each time constant, a third of the set time, takes off about 8.7 dB, so the set release time lands about 26 dB below where the release began and the tail keeps falling after it."
/>

So a release always rings on past its set time, quietly. When a tail must end at a known moment, shorten the release rather than expecting the set time to be the end.

## Delay and hold: DAHDSR

Two more stages extend ADSR at the start. **Delay** keeps the envelope at zero for a set time after the key goes down, before the attack begins. **Hold** keeps it at the peak for a set time after the attack, before the decay begins. The full sequence is Delay, Attack, Hold, Decay, Sustain, Release: **DAHDSR**. With both at zero, which is the default, it is the ordinary ADSR above.

Delay staggers layers: two patches on the same note, one with a 200 ms delay, give a second voice that enters after the first. Hold keeps a percussive hit at full level long enough to read as a body before it starts to fall. Measured in NativeSynth, a 200 ms `ampDelayMs` puts the first non-zero output sample at exactly 0.200 s; a 300 ms `ampHoldMs` keeps the level flat at the peak until 0.3 s, after which the decay takes it down to the sustain level. Both stages run from 0 to 5000 ms and exist on the filter envelope too.

## One-shot notes

Normally the key-up decides when the release starts. A **one-shot** voice ignores the key-up and plays its envelope to the end on its own schedule, the way a struck drum does not care how long the stick stays on the head. Note length stops mattering; the decay time sets the tail.

In NativeSynth that is `oneShot: true`. A sine patch with a 400 ms decay, zero sustain and a 1500 ms release, played for 0.1 s, shows the difference. Without `oneShot` the key-up switches to the 1500 ms release, and the note is still sounding at about −52 dB between 1.0 and 1.5 s. With `oneShot` it keeps decaying on the 400 ms curve and is silent by then.

A one-shot voice has to end somewhere. With zero sustain the decay ends it. With a positive sustain it needs an engine that stops by itself — a finite FM envelope, a percussion strike, a non-looping sample. A subtractive patch with `oneShot` and sustain above zero never ends, so an automatic-length bounce of it is refused; render it with an explicit length instead.

## A separate filter envelope

The amplitude envelope shapes *loudness*. A second, independent envelope can shape the **filter cutoff** so the *tone* evolves on its own schedule. A fast filter attack that decays back down gives the bright "pluck" of a synth bass; a slow filter attack makes a pad bloom open. Because the two envelopes are separate, a note can get quieter while getting brighter, or any combination.

## The LFO — slow, repeating movement

An **LFO** (low-frequency oscillator) is an oscillator too slow to hear as pitch — typically a fraction of a hertz up to a few hertz. Instead of being heard directly, its gentle up-and-down wave is used to *modulate* something:

- LFO → **pitch** = **vibrato** (the small wavering of a held note).
- LFO → **amplitude** = **tremolo** (a pulsing volume).
- LFO → **filter cutoff** = the slow "wobble" of bass and electronic textures.

The two key LFO controls are **rate** (how fast it cycles) and **depth** (how far it pushes the destination).

<SonareDemo id="synth-tremolo" />

## Drift: every voice slightly out of tune

Acoustic instruments and old analog oscillators never hold perfectly still. **Drift** is a slow, small pitch movement given to each voice separately, so a chord of three notes does not move in lockstep and stacked voices beat gently against each other. It is the opposite of vibrato: vibrato is one shared, audible wobble, drift is a per-voice wander meant to sit below notice.

NativeSynth's drift has two controls. `driftCents` is the depth, from 0 (the default, off) to 100 cents. `driftRateHz` is how fast it wanders, from 0.01 to 20 Hz, 0.3 by default. Each voice draws its own share of the depth, with its own sign, and its own rate between 0.75 and 1.25 times `driftRateHz`, and starts in tune. With `driftCents: 50` at 1 Hz, three notes measured ±3.2, ±10.2 and ±9.3 cents. With `retrigger: 'note'` that draw comes from the note number, so the same note drifts the same way every time; with the catalog's `'free'` it changes from note to note.

## Velocity and key tracking

Two modulation sources come from *how you play* rather than from the synth itself:

- **Velocity** — how hard a key is struck, sent as a number from 0 to 127 (see [MIDI Basics](./midi-basics.md)). Routing velocity to amplitude makes soft presses quiet and hard presses loud; routing it to the filter makes hard presses brighter, like a real instrument played harder.
- **Key tracking** — which key you play. Routing the played pitch to the filter cutoff keeps high notes as bright as low notes (without it, high notes can sound dull because their harmonics fall above a fixed cutoff).

## The mod matrix

The **mod matrix** is the patch bay — a routing table of "what moves what" — that connects the sources above to the things they control. Each routing is three choices:

| Part | Meaning | Examples |
|------|---------|----------|
| **Source** | What does the moving | LFO 1, LFO 2, amp envelope, filter envelope, velocity, key tracking, mod wheel, random |
| **Destination** | What gets moved | Pitch (cents — 100 cents is one semitone), filter cutoff (cents), amplitude (gain), pan (position) |
| **Depth** | How much, and which direction | A large positive depth = a strong upward push; negative = the opposite |

So "LFO 1 → pitch, small depth" is vibrato; "velocity → cutoff, large depth" is dynamic brightness; "filter envelope → cutoff" is the classic synth pluck. The same handful of sources and destinations, recombined, produce an enormous range of expressive behavior.

::: details How libsonare implements this
In NativeSynth, modulation lives in the `SynthPatch`. The amplitude envelope is `ampDelayMs`, `ampAttackMs`, `ampHoldMs`, `ampDecayMs`, `ampSustain` and `ampReleaseMs`; the independent filter envelope is the matching `filterDelayMs` / `filterAttackMs` / `filterHoldMs` / `filterDecayMs` / `filterSustain` / `filterReleaseMs` set. `synthPatchParamInfo()` reports their ranges: delay and hold 0–5000 ms, attack and decay 0–20000 ms, release 1–20000 ms, sustain 0–1. `oneShot` is a boolean that makes the voice ignore note-off. Per-voice drift is a triangle LFO whose depth is `driftCents` times a seeded factor in [−1, 1] and whose rate is `driftRateHz` times a seeded factor in [0.75, 1.25]. Two LFOs are configured with `lfoRateHz` and `lfo2RateHz`; LFO 1 drives pitch directly through `lfoToPitchCents`, and LFO 2 does nothing until a routing uses it. Free routings live in `modRoutings`, an array of at most eight `{ source, destination, depth }` entries that replaces the base preset's matrix when non-empty. The sources are `'amp-env'`, `'filter-env'`, `'lfo1'`, `'lfo2'`, `'velocity'`, `'key-track'`, `'mod-wheel'`, `'random'`, `'breath'`, `'aftertouch'`, `'expression-cc'` and `'pitch-bend'`; the destinations are `'pitch-cents'`, `'cutoff-cents'`, `'amp-gain'`, `'pan-units'`, `'resonance-q'`, `'vibrato-depth-cents'`, `'filter-env-depth'`, `'lfo1-rate-scale'` and the physical engines' `'excitation-force'`, `'excitation-position'`, `'excitation-brightness'` and `'spectrum-morph'`.
:::

Related: [Built-in Synthesizer (NativeSynth)](../../native-synth.md), [Synthesis Basics](./synthesis-basics.md), [MIDI Basics](./midi-basics.md)
