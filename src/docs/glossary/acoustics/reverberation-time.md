---
title: Reverberation Time (RT60 and EDT)
description: RT60 and early decay time — how long a room's tail takes to fade, why the two measures disagree, and what they reveal about a space.
---

# Reverberation Time (RT60 and EDT)

**Reverberation time** is the headline measure of how long a room keeps ringing after a sound stops.

When a sound source switches off, the energy already in the room does not vanish — it keeps bouncing between surfaces, losing a little at every reflection, until it fades into the noise floor. How long that takes is what a room sounds like: a treated vocal booth dies away almost instantly, a stone cathedral washes on for many seconds.

## RT60: the 60 dB decay

**RT60** is the time, in seconds, for the reverberant tail to drop by **60 decibels** — a factor of one million in energy — after the source stops. Sixty dB is the historical definition because it spans roughly the range from a loud sound down to inaudibility in a quiet hall.

In practice the tail rarely stays clean across a full 60 dB before noise swamps it, so RT60 is almost always *extrapolated*. You measure the slope of the decay over a cleaner, smaller range and scale it up to 60 dB:

| Measure | Decay range measured | Scaled to |
|---------|----------------------|-----------|
| T20 | −5 dB to −25 dB | ×3 → 60 dB |
| T30 | −5 dB to −35 dB | ×2 → 60 dB |
| EDT | 0 dB to −10 dB | ×6 → 60 dB |

The first few dB are skipped because the very start of the decay is dominated by the direct sound and the strongest early reflections, which are not yet "reverberant."

## EDT: what the ear actually hears

**Early decay time (EDT)** measures only the first 10 dB of decay and scales that slope up to 60 dB. It weights the *beginning* of the tail — exactly the part the ear uses to judge how live a space feels.

EDT and RT60 agree in an ideal, perfectly diffuse room. They diverge in real ones:

- **EDT much shorter than RT60** — strong early reflections steepen the start of the decay, so the room *sounds* tighter than its long late tail suggests. Common in rooms with a reflective near field but absorptive far surfaces.
- **EDT close to RT60** — a smooth, well-diffused decay; the perceived reverberance matches the measured tail.

Because perception tracks EDT, two rooms with identical RT60 can feel quite different. EDT is the better predictor of "reverberance"; RT60 is the better predictor of how long a sustained note will smear into the next.

## Reading the numbers

| RT60 | Feel |
|------|------|
| < 0.3 s | Dead — booths, treated control rooms |
| 0.3–0.6 s | Tight — bedrooms, small studios |
| 0.6–1.2 s | Lively — live rooms, large lounges |
| 1.2–2.5 s | Reverberant — concert halls |
| > 2.5 s | Cavernous — cathedrals, large stone spaces |

RT60 scales with **room volume** and falls with **absorption**: a big, hard-surfaced space rings long; a small, soft-furnished one does not. That relationship is what lets libsonare estimate an equivalent room from a decay alone.

<SonareDemo id="room-decay" />

::: details How libsonare measures decay time
libsonare derives reverberation time from the energy decay curve (the Schroeder backward integral of the squared impulse response). It fits a line to the decay over the T20/T30 region, rejects segments where the curve is not linear enough, and extrapolates the slope to 60 dB; EDT is fit over the first 10 dB. Per-band reverberation time is computed by running the same fit on octave-band-filtered versions of the response, which is what the per-band decay table shows. When the input is ordinary music rather than a clean impulse, the decay is recovered blindly from the signal's gaps and offsets, and the confidence score reflects how clean that recovered decay was.
:::

Related: [Clarity and Definition (C50, C80, D50)](./clarity-definition.md), [Per-Band Decay and Absorption](./absorption-bands.md), [Inverse Room Estimation](./inverse-estimation.md), [Acoustic Analysis](../../acoustic-analysis.md)
