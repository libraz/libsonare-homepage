---
title: Clarity and Definition (C50, C80, D50)
description: C50, C80, and D50 — early-to-late energy ratios that measure whether a room keeps speech and music articulate or smears it into the tail.
---

# Clarity and Definition (C50, C80, D50)

**Clarity** measures how much sound energy arrives *early* — soon enough to reinforce a note or syllable — versus *late*, where it blurs into reverberant wash.

Reverberation time tells you how long a room rings, but not whether you can understand it. A room can have a moderate RT60 and still be perfectly intelligible if the early energy dominates, or muddy if the late tail does. Clarity and definition put a number on that balance by splitting the impulse response at a time boundary and comparing the energy on each side.

## C50 — speech clarity

**C50** is the ratio, in decibels, of the energy in the first **50 milliseconds** to all the energy after it:

> C50 = 10·log₁₀( early energy (0–50 ms) / late energy (>50 ms) )

Fifty milliseconds is the rough window over which the ear fuses early reflections with the direct sound into a single, louder, *clearer* event (the precedence or Haas effect). Energy arriving later is heard as separate reverberation that masks the next syllable.

- **High C50** (positive, several dB) — consonants stay crisp; good for speech, dialogue, lectures.
- **Low C50** (negative) — the tail overwhelms the direct sound; speech smears and intelligibility drops.

## C80 — music clarity

**C80** uses an **80 millisecond** boundary instead. Music tolerates — and often wants — more reverberant blend than speech, so the early window is widened.

> C80 = 10·log₁₀( early energy (0–80 ms) / late energy (>80 ms) )

C80 is the standard "clarity index" for concert halls. Hall designers balance it carefully: too high and the music sounds dry and analytical; too low and fast passages turn into mush.

| C80 | Musical feel |
|-----|--------------|
| > +4 dB | Dry, articulate, close |
| 0 to +4 dB | Clear but supported by the room |
| −2 to 0 dB | Reverberant, blended |
| < −2 dB | Washy, indistinct |

## D50 — definition

**Definition (D50)**, sometimes called *Deutlichkeit*, expresses the same 50 ms split as a **fraction** rather than a ratio:

> D50 = early energy (0–50 ms) / total energy  (as a percentage)

D50 and C50 are two views of the same measurement and convert directly into each other. D50 ranges from 0% to 100%; higher means more of the energy is early, so the room is more "defined." Many people find the percentage more intuitive than a dB ratio for intelligibility.

## Why all three

They answer subtly different questions: C50 for *speech*, C80 for *music*, D50 for an intuitive *percentage* of early energy. A space optimized for spoken word (high C50, high D50) is not the same as one optimized for an orchestra (moderate, balanced C80). Seeing all three lets you judge what a recording space is actually good for, not just how long it rings.

::: details How libsonare computes clarity
libsonare integrates the squared impulse response on each side of the 50 ms and 80 ms boundaries to form the early and late energy sums, then reports C50 and C80 as 10·log₁₀ of the early/late ratio and D50 as the early/total fraction. The same boundaries are applied to the blindly recovered decay when the input is ordinary music, though clarity is most reliable from a clean impulse response. Because clarity depends on the exact arrival time of the direct sound, the analysis first locates the direct-sound peak and measures the windows relative to it; a mislocated direct sound is one reason a low confidence score should make you treat C50/C80/D50 as approximate.
:::

Related: [Reverberation Time (RT60 and EDT)](./reverberation-time.md), [Source Distance and DRR](./source-distance.md), [Inverse Room Estimation](./inverse-estimation.md), [Acoustic Analysis](../../acoustic-analysis.md)
