---
title: Spaced Receivers and Inter-Channel Coherence
description: How libsonare's room functions turn one room into a stereo pair — two omnidirectional receivers a set distance apart, and the frequency-dependent coherence between their reverb tails.
---

# Spaced Receivers and Inter-Channel Coherence

A room has no left and right. A stereo room sound exists only once something listens from two places, and how far apart those two places are decides how wide the room sounds. libsonare's stereo room functions model that directly: the room is heard at a **spaced pair** of omnidirectional receivers, and `receiverSpacingM` sets the distance between them.

## Two microphones, one room

Put two identical omnidirectional microphones in a hall a short distance apart. Neither one is aimed anywhere; they differ only in where they stand. Each picks up the direct sound, then its own set of wall reflections, then the dense late reverberation. The direct sound and the early reflections arrive at slightly different times at the two positions. The late reverberation is a field of waves arriving from every direction at once, and two points in such a field hear the same thing only at wavelengths long compared with the gap between them. Acoustics calls that an ideal **diffuse field**: equal energy arriving from every direction, with no phase relation between the arrivals.

How alike the two signals are at each frequency is their **inter-channel correlation**, a coefficient from −1 to 1: 1 means identical, 0 means unrelated, and a negative value means the two move in opposite directions. (Coherence is the closely related magnitude of that relation, which never goes below 0.) For two points a distance *d* apart in a diffuse field, the correlation at frequency *f* is

sin(kd) / (kd), with k = 2π·f / c and c = 343 m/s,

which starts at 1 at low frequencies, first reaches 0 at f = c / (2d), and above that swings slightly negative and back toward 0. At the default 0.5 m that is 343 Hz. Below it the two tails move together; above it they are close to independent.

## Why the spacing matters

Correlated channels sound narrow and stay full when summed to mono. Uncorrelated channels sound wide and lose level in a mono sum, because their energies add rather than their amplitudes. The spacing moves the frequency where one turns into the other:

- **Close spacing** keeps the tails correlated well up the spectrum. The room sounds centered and narrow, and survives a mono fold-down.
- **Wide spacing** pushes the decorrelation down into the bass. Only the lowest octave still moves together, and the room spreads across the image.

What the spacing does not do is pan the source. The engine centres the pair on the listener and lays its axis horizontally, at right angles to the direction of the source, so both receivers sit at the same distance from it and the direct sound arrives in both channels on the same sample. The width comes from the reflections and the tail, which is also where a spaced pair of real microphones gets it.

## What the engine measures

A 10 × 8 × 4 m room with absorption 0.15, a source 4 m from the listener, and a unit impulse fed to both input channels of `roomMorphStereo`. The correlation of the two output tails after the first 150 ms, per band:

| `receiverSpacingM` | 63–125 Hz | 250–500 Hz | 1–2 kHz | 4–8 kHz |
|---|---|---|---|---|
| 0.02 | 1.00 | 1.00 | 0.93 | 0.09 |
| 0.17 | 0.98 | 0.75 | −0.08 | 0.00 |
| 0.5 (default) | 0.86 | 0.00 | −0.02 | 0.00 |
| 2 | 0.30 | 0.00 | −0.02 | 0.00 |
| 4 | 0.21 | 0.00 | −0.02 | 0.00 |

The 0.5 m row lands where the formula puts it: the low band still moves together, and the 250–500 Hz band straddles the first zero at 343 Hz. At that spacing, summing the two tails to mono loses 3.00 dB against the average channel above 1 kHz and 0.20 dB below 100 Hz. That is the exact figure for independent and for nearly identical signals.

## Where the pair is used

- **`roomMorphStereo({ left, right, ...options })`** morphs a stereo recording toward a target room. The left channel is convolved with the left receiver's response and the right with the right's. `receiverSpacingM` is in (0, 4] m and defaults to 0.5 when omitted. `0`, a value above 4 or a non-finite value is a `RangeError`.
- **The `effects.reverb.room` and `effects.acoustic.roomMorph` inserts** use the pair on a stereo strip and the single-listener response on a mono strip. Their `receiverSpacingM` key reads `0` as "use 0.5 m".
- **`roomMorph` and `synthesizeRir`** are mono. They render one listener and place no pair.

Either receiver leaving the room is refused rather than moved, since a moved receiver is a different room sound. A listener closer to a side wall than half the spacing therefore fails, and the error names the receiver and its coordinates (`left receiver at (7.000, -0.150, 1.500) lies outside the room`). The insert descriptor's maximum of 2.5 m is that same rule evaluated at the insert's default room and placement, where the right receiver hits the wall above 2.5 m; the descriptor's `coupledWith` names the room and placement keys that move it. In a larger room the full 4 m builds.

The [Spatial Room Scanner](/spatial) auditions its estimated or selected room through `roomMorphStereo` at the default 0.5 m, with the estimate's per-octave `bandAbsorption`, so the two ears hear different tails.

::: details How libsonare builds the pair
`receiver_pair` offsets the two receivers by ±d/2 along the horizontal axis perpendicular to the listener-to-source direction (the y axis when the source is directly above or below the listener). `synthesize_rir_pair` runs the image-source early reflections, mixing time and crossfade separately for each receiver. The late tails come from `synthesize_late_tail_pair`: the left tail is the mono late-tail noise stream, and the right tail mixes that stream with a second, independently seeded one as γ·left + √(1 − γ²)·right in each third-octave band, before the shared per-band decay envelope. γ is the band average of sinc(2π·f·d/c) over the band's frequency range (`late_tail_pair_coherence`). One level-match scale, taken at the centre listener, serves both channels. Validation reports `acoustic.receiver_spacing_out_of_range` and `acoustic.receiver_outside_room`. A two-channel insert shares one source-tail suppressor gain between the channels, driven by the louder one, so suppression does not shift the image.
:::

Related: [Source Distance and DRR](./source-distance.md), [Room Geometry and Volume](./room-geometry.md), [Mono Compatibility](../concepts/mono-compatibility.md), [Room Acoustics](../../acoustic-analysis.md#stereo-room-morph), [Effects Inserts](../../effects-inserts.md#geometric-room-inserts)
