---
title: Per-Band Decay and Absorption
description: Why rooms decay faster at high frequencies — per-band RT60, absorption coefficients, and what the band-by-band tail reveals about surfaces.
---

# Per-Band Decay and Absorption

A room does not ring the same way at every frequency. Measure reverberation time band by band and the tail is almost never flat: most rooms shed highs quickly and hold onto lows. The per-band view is where that frequency dependence becomes visible.

## Per-band RT60

**Per-band decay** is [reverberation time](./reverberation-time.md) measured separately in frequency bands — typically octave bands centered on 125, 250, 500, 1000, 2000, 4000 Hz and up. Instead of one RT60 for the whole signal, you get an RT60 for each band, revealing how the room's liveness changes across the spectrum.

The usual shape is a **high-frequency rolloff**: short RT60 up top, longer RT60 down low. Two physical effects drive it:

- **Air absorption.** High frequencies lose energy to the air itself over distance; lows barely do. In a large room this alone shortens the high-band tail noticeably.
- **Surface behavior.** Most soft, porous materials — carpet, curtains, foam, upholstery, people — absorb highs efficiently but are nearly transparent to lows. Bass energy passes through and keeps bouncing.

The result is that bass decays slowest, which is why untreated rooms sound "boomy" and why bass trapping (low-frequency absorption) is the hardest part of room treatment.

<SonareDemo id="room-decay" />

## Absorption coefficients

**Absorption** is the fraction of sound energy a surface removes at each reflection, from 0 (perfectly reflective) to 1 (perfectly absorptive), reported here per band as a percentage. It is the material counterpart to the decay: high absorption in a band shortens that band's RT60.

| Surface | Low-band absorption | High-band absorption |
|---------|---------------------|----------------------|
| Painted concrete, sealed masonry | very low | very low |
| Glass panes, drywall, thin wood panelling | low–moderate | very low |
| Carpet, curtains | low | moderate–high |
| Acoustic foam, mineral wool | moderate | high |

The rising left-to-right pattern belongs to **porous** absorbers — carpet, curtains, foam, mineral wool. They work by making air move through a resistive material, which they do best at short wavelengths, so they take the highs and let the lows pass.

**Panel (membrane) absorbers** run the other way. A large pane of glass or a sheet of drywall flexes under low-frequency pressure and loses energy doing it (α ≈ 0.18 and ≈ 0.29 at 125 Hz), while staying almost perfectly reflective on top (α ≈ 0.02–0.09 at 4 kHz). Only sealed masonry is uniformly low across the whole band. This is worth knowing before treating a room: in light construction the windows and the drywall are already the main bass absorbers, and stacking more porous material on the walls will not touch the low end.

## Reading the band table

- **Steep high-band rolloff** (highs decay much faster than lows) → soft, absorptive surfaces, often a smaller furnished room; sounds warm but can be boomy if the low bands are very long.
- **Flat bands** (all frequencies decay alike) → hard, reflective surfaces, often a large bare space; sounds bright and "live."
- **A single band sticking out** → possibly a resonance or a surface that is reflective only in that range — but check it against its neighbours before acting on it. Each octave is split off with a single biquad bandpass whose skirts are shallower than an IEC 61260 class filter, so neighbouring bands leak into each other, and every band's RT60 is fitted independently. One band disagreeing with the rest can just as easily be filter leakage or fit noise.

Per-band decay turns "this room sounds boomy/bright" into something you can point at: the bands tell you *where* in the spectrum the room is misbehaving, which is the information you need to treat it.

::: details How libsonare derives the per-band profile
libsonare splits the (possibly blindly recovered) impulse response into octave bands with a filterbank, then runs the same energy-decay-curve fit used for broadband RT60 on each band to produce a per-band reverberation time. From those band RT60s and the estimated room it back-solves an effective absorption coefficient per band, using Eyring's relation — α = 1 − exp(−0.161·V / (S·RT)) — by default, or Sabine's α = 0.161·V / (S·RT) when `preferEyring` is set to `false`. The two agree while absorption is small and diverge above roughly α = 0.2, which is where a treated or soft-furnished room sits: Sabine's value overshoots there and is not bounded by 1, while Eyring's saturates. The surface area S in that back-solve comes from the assumed shoebox geometry rather than from anything measured, so the coefficients inherit the geometry priors. Because the bands are estimated independently, a noisy or reverb-light recording can leave individual bands less certain than the broadband number — another reason the confidence score is worth checking before reading fine detail into a single band.
:::

Related: [Reverberation Time (RT60 and EDT)](./reverberation-time.md), [Room Geometry and Volume](./room-geometry.md), [Inverse Room Estimation](./inverse-estimation.md), [Acoustic Analysis](../../acoustic-analysis.md)
