---
title: Envelopes and Modulation
description: Modulation means something changing over time — ADSR envelopes, filter envelopes, LFOs, velocity, key tracking, and the mod matrix that routes them, explained for newcomers.
---

# Envelopes and Modulation

A raw oscillator is static: press a key and it drones at one volume and one tone forever. Real instruments are alive — a note swells, brightens, decays, and fades. **Modulation** is the umbrella word for *something changing over time*, and it is what turns a flat synth tone into a musical sound.

This page explains the two kinds of modulation sources you will meet most often (envelopes and LFOs), the performance inputs that also act as modulation (velocity and key tracking), and the **mod matrix** that wires sources to destinations. It is concepts only — no code. For the blocks being modulated, read [Synthesis Basics](./synthesis-basics.md) first.

## The ADSR amplitude envelope

An **envelope** is a shape that plays out once per note. The classic envelope has four stages — **A**ttack, **D**ecay, **S**ustain, **R**elease (ADSR) — and the most important one controls loudness over the life of the note:

```mermaid
flowchart LR
  S["key down"] --> A["Attack<br/>rise to peak"]
  A --> D["Decay<br/>fall to sustain"]
  D --> SUS["Sustain<br/>held level"]
  SUS --> R["Release<br/>fade after key up"]
```

| Stage | What it controls | Long value sounds like | Short value sounds like |
|-------|------------------|------------------------|-------------------------|
| **Attack** | Time to rise from silence to full level | Slow swell (pad, strings) | Instant hit (pluck, piano) |
| **Decay** | Time to fall from the peak down to the sustain level | Gradual settle | Quick drop |
| **Sustain** | The *level* held while the key stays down (not a time) | Loud held body | Note dies away even while held |
| **Release** | Time to fade after the key is let go | Long tail, reverb-like | Abrupt cut-off |

A plucked sound is fast attack, fast decay, zero sustain, short release. A pad is slow attack, high sustain, long release. Same oscillator — completely different instrument, just from the envelope.

<SonareDemo id="synth-note" />

::: info Attack/Decay/Release are times; Sustain is a level
Three of the four ADSR controls are durations (in milliseconds). Sustain is the odd one out: it is a *volume level*, the amount held for as long as you keep the key down. That is why a "zero sustain" patch goes silent even while the key is still pressed.
:::

## A separate filter envelope

The amplitude envelope shapes *loudness*. A second, independent envelope can shape the **filter cutoff** so the *tone* evolves on its own schedule. A fast filter attack that decays back down gives the bright "pluck" of a synth bass; a slow filter attack makes a pad bloom open. Because the two envelopes are separate, a note can get quieter while getting brighter, or any combination.

## The LFO — slow, repeating movement

An **LFO** (low-frequency oscillator) is an oscillator too slow to hear as pitch — typically a fraction of a hertz up to a few hertz. Instead of being heard directly, its gentle up-and-down wave is used to *modulate* something:

- LFO → **pitch** = **vibrato** (the small wavering of a held note).
- LFO → **amplitude** = **tremolo** (a pulsing volume).
- LFO → **filter cutoff** = the slow "wobble" of bass and electronic textures.

The two key LFO controls are **rate** (how fast it cycles) and **depth** (how far it pushes the destination).

## Velocity and key tracking

Two modulation sources come from *how you play* rather than from the synth itself:

- **Velocity** — how hard a key is struck, sent as a number from 0 to 127 (see [MIDI Basics](./midi-basics.md)). Routing velocity to amplitude makes soft presses quiet and hard presses loud; routing it to the filter makes hard presses brighter, like a real instrument played harder.
- **Key tracking** — which key you play. Routing the played pitch to the filter cutoff keeps high notes as bright as low notes (without it, high notes can sound dull because their harmonics fall above a fixed cutoff).

## The mod matrix

The **mod matrix** is the patch bay that connects everything. Each routing is three choices:

| Part | Meaning | Examples |
|------|---------|----------|
| **Source** | What does the moving | LFO 1, LFO 2, amp envelope, filter envelope, velocity, key tracking, mod wheel, random |
| **Destination** | What gets moved | Pitch (cents), filter cutoff (cents), amplitude (gain), pan (position) |
| **Depth** | How much, and which direction | A large positive depth = a strong upward push; negative = the opposite |

So "LFO 1 → pitch, small depth" is vibrato; "velocity → cutoff, large depth" is dynamic brightness; "filter envelope → cutoff" is the classic synth pluck. The same handful of sources and destinations, recombined, produce an enormous range of expressive behavior.

::: details How libsonare implements this
In NativeSynth, modulation lives in the `SynthPatch`. The amplitude envelope is `ampAttackMs`, `ampDecayMs`, `ampSustain`, and `ampReleaseMs`; the independent filter envelope is the matching `filterAttackMs` / `filterDecayMs` / `filterSustain` / `filterReleaseMs` set. Two LFOs are configured with `lfoRateHz` and `lfo2RateHz` (with `lfoToPitchCents` as a direct vibrato shortcut). Free routings live in `modRoutings`, an array of `{ source, destination, depth }` entries — the `source` is one of `'lfo1'`, `'lfo2'`, `'amp-env'`, `'filter-env'`, `'velocity'`, `'key-track'`, `'mod-wheel'`, `'random'`, and the `destination` is one of `'pitch-cents'`, `'cutoff-cents'`, `'amp-gain'`, `'pan-units'`. A non-empty `modRoutings` replaces the base preset's matrix, and the matrix holds up to eight routings.
:::

Related: [Built-in Synthesizer (NativeSynth)](../../native-synth.md), [Synthesis Basics](./synthesis-basics.md), [MIDI Basics](./midi-basics.md)
