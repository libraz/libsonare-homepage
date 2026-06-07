---
title: Per-Band Decay and Absorption
description: Why rooms decay faster at high frequencies — per-band RT60, absorption coefficients, and what the band-by-band tail reveals about surfaces.
---

# Per-Band Decay and Absorption

A room does not ring the same way at every frequency. Measure reverberation time band by band and the tail is almost never flat: most rooms shed highs quickly and hold onto lows. The per-band view is where that frequency dependence becomes visible.

## Per-band RT60

**Per-band decay** is reverberation time measured separately in frequency bands — typically octave bands centered on 125, 250, 500, 1000, 2000, 4000 Hz and up. Instead of one RT60 for the whole signal, you get an RT60 for each band, revealing how the room's liveness changes across the spectrum.

The usual shape is a **high-frequency rolloff**: short RT60 up top, longer RT60 down low. Two physical effects drive it:

- **Air absorption.** High frequencies lose energy to the air itself over distance; lows barely do. In a large room this alone shortens the high-band tail noticeably.
- **Surface behavior.** Most soft, porous materials — carpet, curtains, foam, upholstery, people — absorb highs efficiently but are nearly transparent to lows. Bass energy passes through and keeps bouncing.

The result is that bass decays slowest, which is why untreated rooms sound "boomy" and why bass trapping (low-frequency absorption) is the hardest part of room treatment.

## Absorption coefficients

**Absorption** is the fraction of sound energy a surface removes at each reflection, from 0 (perfectly reflective) to 1 (perfectly absorptive), reported here per band as a percentage. It is the material counterpart to the decay: high absorption in a band shortens that band's RT60.

| Surface | Low-band absorption | High-band absorption |
|---------|---------------------|----------------------|
| Painted concrete, glass | very low | very low |
| Wood, drywall | low | low–moderate |
| Carpet, curtains | low | moderate–high |
| Acoustic foam, mineral wool | moderate | high |

Notice the pattern in the right two columns: most everyday materials climb from left (lows) to right (highs). A surface that absorbs lows *and* highs evenly is rare and expensive — which is exactly why real per-band curves slope.

## Reading the band table

- **Steep high-band rolloff** (highs decay much faster than lows) → soft, absorptive surfaces, often a smaller furnished room; sounds warm but can be boomy if the low bands are very long.
- **Flat bands** (all frequencies decay alike) → hard, reflective surfaces, often a large bare space; sounds bright and "live."
- **A single band sticking out** → a resonance or a surface that is reflective only in that range.

Per-band decay turns "this room sounds boomy/bright" into something you can point at: the bands tell you *where* in the spectrum the room is misbehaving, which is the information you need to treat it.

::: details How libsonare derives the per-band profile
libsonare splits the (possibly blindly recovered) impulse response into octave bands with a filterbank, then runs the same energy-decay-curve fit used for broadband RT60 on each band to produce a per-band reverberation time. From those band RT60s and the estimated room volume it back-solves an effective absorption coefficient per band via Sabine's relation, which is what the absorption column reports. Because the bands are estimated independently, a noisy or reverb-light recording can leave individual bands less certain than the broadband number — another reason the confidence score is worth checking before reading fine detail into a single band.
:::

Related: [Reverberation Time (RT60 and EDT)](./reverberation-time.md), [Room Geometry and Volume](./room-geometry.md), [Inverse Room Estimation](./inverse-estimation.md), [Acoustic Analysis](../../acoustic-analysis.md)
