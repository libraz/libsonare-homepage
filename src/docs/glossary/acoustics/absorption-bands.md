---
title: Per-Band Decay and Absorption
description: Why rooms decay faster at high frequencies — per-band RT60, absorption coefficients, and what the band-by-band tail reveals about surfaces.
---

# Per-Band Decay and Absorption

A room does not ring the same way at every frequency. Measure reverberation time band by band and the tail is almost never flat: most rooms shed highs quickly and hold onto lows. The per-band view is where that frequency dependence becomes visible.

## Per-band RT60

**Per-band decay** is [reverberation time](./reverberation-time.md) measured separately in frequency bands — typically octave bands centered on 125, 250, 500, 1000, 2000, 4000 Hz and up. Instead of one RT60 for the whole signal, you get an RT60 for each band, revealing how the room's liveness changes across the spectrum.

The usual shape is a **high-frequency rolloff**: short RT60 up top, longer RT60 down low. Two physical effects drive it:

- **Air absorption.** High frequencies lose energy to the air itself over distance; lows barely do. In a large room this alone shortens the high-band tail noticeably ([below](#air-absorption-along-the-path)).
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

## Air absorption along the path

Wall absorption happens at each reflection. **Air absorption** happens between them: sound loses energy to the air it travels through, and the loss is proportional to distance. That makes it a property of the path rather than of the room's surfaces, which is why the two are different knobs.

Two mechanisms carry the loss. Classical viscous and thermal losses grow with the square of frequency. On top of them, oxygen and nitrogen molecules absorb energy through **vibrational relaxation** — a pressure cycle briefly excites the molecule and the energy comes back out of phase — and each gas has a relaxation frequency that depends on how much water vapour is present. Below that frequency the gas keeps up and absorbs little; around and above it the loss climbs steeply. Both mechanisms rise with frequency, so the coefficient is tiny in the bass and large in the treble. At the ISO 9613-1 reference climate — 20 °C, 50 % relative humidity — the loss is roughly 0.04 dB per 100 m at 125 Hz, 0.5 dB at 1 kHz, 3 dB at 4 kHz and 10 dB at 8 kHz: the 4 kHz band loses about seventy times more per metre than the 125 Hz band.

Why does a room notice a loss measured per hundred metres? Because a reverberant tail is a long path. A decay to −60 dB in 2 s is a path of almost 700 m, so at 4 kHz the air alone takes about 20 dB of those 60 dB, on top of what the walls take, while a small room's tail is over before the air loss adds up. This is why the effect scales with volume as well as with frequency, and why a model that counts only wall absorption over-predicts the high-band RT60 of a large hall.

Temperature and humidity are the two inputs, and pressure is not, because the relaxation frequencies are set by the **molar concentration of water vapour**: relative humidity times the saturation vapour pressure, which itself rises with temperature. Pressure enters the standard only as a ratio to the reference pressure, and at sea level that ratio is one, so libsonare fixes it there. Within ordinary indoor conditions the direction is simple: **drier or colder air absorbs the highs more.** The table gives the engine's own coefficient at 4 kHz, and the RT60 of a 30 × 20 × 12 m hall with walls at α = 0.2, whose geometry-only figure is 2.16 s in every climate.

| Climate | Loss at 4 kHz | Hall RT60 at 4 kHz | Hall RT60 at 1 kHz |
|---------|---------------|--------------------|--------------------|
| 20 °C, 80 % | 2.1 dB / 100 m | 1.71 s | 2.03 s |
| 20 °C, 50 % (reference) | 3.0 dB / 100 m | 1.58 s | 2.05 s |
| 20 °C, 20 % | 7.5 dB / 100 m | 1.12 s | 2.00 s |

Read across and the prediction rule falls out. Lowering the humidity from 50 % to 20 % takes a third off the hall's 4 kHz decay and leaves 1 kHz almost untouched; raising it to 80 % lengthens the 4 kHz decay by under a tenth. Temperature works the same way at a smaller scale: cooling from 20 °C to 10 °C at 50 % raises the 4 kHz loss from 3.0 to 4.7 dB per 100 m, and warming to 30 °C lowers it to 2.5. The bass never moves, and a room a tenth the size barely moves in any band.

::: warning Path loss is not boundary loss
Air absorption is not a substitute for the wall coefficients above. It only adds a term to the late tail's per-band decay rate; the early reflections are computed from the wall materials alone. A room whose highs ring too long because its walls are hard needs softer walls, and no climate will shorten a boomy low end — the air term at 125 Hz is too small to matter at any humidity.
:::

## Reading the band table

- **Steep high-band rolloff** (highs decay much faster than lows) → soft, absorptive surfaces, often a smaller furnished room; sounds warm but can be boomy if the low bands are very long.
- **Flat bands** (all frequencies decay alike) → hard, reflective surfaces, often a large bare space; sounds bright and "live."
- **A single band sticking out** → possibly a resonance or a surface that is reflective only in that range — but check it against its neighbours before acting on it. Each octave is isolated with an 8th-order zero-phase Butterworth high-pass at the lower edge and low-pass at the upper edge, giving 96 dB/octave rejection at each edge. Every band's RT60 is fitted independently, so a disagreement can still reflect the room's frequency-dependent behavior or fit noise.

Per-band decay turns "this room sounds boomy/bright" into something you can point at: the bands tell you *where* in the spectrum the room is misbehaving, which is the information you need to treat it.

::: details How libsonare derives the per-band profile
For an impulse-response input, libsonare splits the response into octave bands with a filterbank, using an 8th-order zero-phase Butterworth high-pass at each band's lower edge and low-pass at its upper edge. It then runs the same energy-decay-curve fit used for broadband RT60 on each band to produce a per-band reverberation time. For blind input, it filters the recording and estimates each band's RT60 from the recovered decay; it does not construct an impulse response. From those band RT60s and the estimated room it back-solves an effective absorption coefficient per band, using Eyring's relation — α = 1 − exp(−0.161·V / (S·RT)) — by default, or Sabine's α = 0.161·V / (S·RT) when `preferEyring` is set to `false`. The two agree while absorption is small and diverge above roughly α = 0.2, which is where a treated or soft-furnished room sits: Sabine's value overshoots there and is not bounded by 1, while Eyring's saturates. The surface area S in that back-solve comes from the assumed shoebox geometry rather than from anything measured, so the coefficients inherit the geometry priors. Because the bands are estimated independently, a noisy or reverb-light recording can leave individual bands less certain than the broadband number — another reason the confidence score is worth checking before reading fine detail into a single band. In the forward direction, `airAbsorptionEnabled` adds the classic 4·m·V air term — m from ISO 9613-1 at each band centre — to the absorption area before RT60 is solved; `estimateRoom(...)` has no such term, so the coefficient it reports for a large hall folds the air loss into the wall value.
:::

Related: [Reverberation Time (RT60 and EDT)](./reverberation-time.md), [Room Geometry and Volume](./room-geometry.md), [Inverse Room Estimation](./inverse-estimation.md), [Room Acoustics: air absorption options](../../acoustic-analysis.md#air-absorption)
