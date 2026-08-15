---
title: Source Distance and DRR
description: Direct-to-reverberant ratio, critical distance, and source distance — how one channel reveals how far a source is, but not which direction.
---

# Source Distance and DRR

From a single recording it is possible to estimate **how far** the source was from the microphone — though not **which direction**. The chain that gets there runs from the direct-to-reverberant ratio, through the room's critical distance, to a distance in meters. libsonare supplies the first link, the DRR; the [Spatial Room Scanner](/spatial) takes it the rest of the way.

## DRR — direct-to-reverberant ratio

The **direct-to-reverberant ratio (DRR)** is the level of the direct sound — the first wavefront to reach the mic, straight from the source — relative to the reverberant energy that follows, expressed in decibels.

> DRR = 10·log₁₀( direct energy / reverberant energy )

DRR is the single strongest cue for distance. Move the mic closer and the direct sound gets louder while the room's reverberant field stays roughly constant, so DRR rises. Back away and the direct sound falls toward the steady reverberant level, so DRR drops.

- **High DRR** — close, dry, present; the source is "in your face."
- **Low DRR** — distant, washy; the room dominates the sound.

This is exactly the cue your ears use to judge distance in a familiar room, which is why a close-mic'd vocal sounds intimate and a far one sounds like it is "across the room."

::: warning DRR is only meaningful for impulse-like input
libsonare measures DRR on the waveform you hand it: the energy inside a ±2.5 ms window around the single loudest sample counts as direct, everything outside it counts as reverberant. On a clap, a pop, or a sweep-derived IR that peak *is* the direct sound. On ordinary music it is just the loudest transient in the programme, so `drrDb` stops being a direct-to-reverberant ratio in any useful sense. Check `confidence`, and treat DRR — and any distance derived from it — as a rough hint unless the input really is an impulse response.
:::

<SonareDemo id="room-decay" />

## Critical distance

The **critical distance** is the distance from the source at which the direct sound and the reverberant field are *equally loud* — where DRR equals 0 dB.

Closer than the critical distance, the direct sound wins and the source reads as clear and localized. Farther, the reverberant field wins and the sound becomes diffuse and room-dominated. Critical distance depends on the room: a dead room (high absorption, short RT60) pushes it far out, so you can stand well back and still hear a direct sound; a live room pulls it close, so even a few steps back drowns the source in reverberation.

<DistanceBalanceFigure
  title="Two curves, and where they cross"
  caption="DRR is the vertical gap between the direct sound and the reverberant field. Treating the room lowers the reverberant line without moving the direct one, which pushes the crossing — the critical distance — further out. The same measured DRR therefore means a different distance in a different room."
/>

Roughly, the more absorptive the room, the weaker its reverberant field, so the direct sound stays dominant farther out — critical distance grows with the square root of the room's *total* absorption (the A in Sabine's equation: surface area weighted by how absorptive each surface is). That is why the same talker sounds intelligible across a treated studio but muddy across a cathedral at the same distance.

## Source distance

Putting them together: the measured DRR, referenced against the room's critical distance, places the source at an estimated **distance in meters** from the listener/mic. A DRR of 0 dB lands the source right at the critical distance; higher DRR pulls it closer, lower pushes it farther.

The hard limit is geometry. A single channel carries one number — energy versus time — so it can resolve *one* equivalent distance but contains **no directional information**. The scanner therefore draws the estimated source as a full *shell* (a sphere) around the listener at the estimated radius, not as a point: every direction at that distance is equally consistent with what one mic heard. Recovering direction would need at least two channels and the time/level differences between them.

A further consequence: multiple real sources — several talkers, a whole band — collapse into a single equivalent distance, because one channel cannot separate them.

::: details How libsonare estimates distance
The library part is deliberately blunt. `estimateRoom(...)` finds the strongest sample in the recording, counts the energy within ±2.5 ms of it as direct and all remaining energy — the build-up before it as well as the tail after it — as reverberant, and reports the ratio as `drrDb`. There is no separately recovered impulse response behind that number; it is measured on the input waveform as supplied.

Critical distance and source distance are not library functions at all. The Spatial Room Scanner derives them from the estimated room: the critical distance from the volume and RT60 (r<sub>c</sub> ≈ 0.057·√(V / RT60), assuming an omnidirectional source), and then the radius from the measured DRR as r = r<sub>c</sub> · 10<sup>−DRR/20</sup>. Because the model is single-channel, the result is a radius, not a position, and the visualization renders it as a distance shell around the listener. Its reliability tracks how cleanly the direct sound could be separated from the tail — sources well past the critical distance, where direct energy is faint, are inherently harder to place, and so is any source in a recording that is not impulse-like to begin with.
:::

Related: [Reverberation Time (RT60 and EDT)](./reverberation-time.md), [Room Geometry and Volume](./room-geometry.md), [Inverse Room Estimation](./inverse-estimation.md), [Acoustic Analysis](../../acoustic-analysis.md)
