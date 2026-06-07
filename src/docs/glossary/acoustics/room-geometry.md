---
title: Room Geometry and Volume
description: Estimated dimensions and volume — the equivalent shoebox room that reproduces a measured decay, and why it is acoustic, not architectural.
---

# Room Geometry and Volume

From a recording's reverberant tail, libsonare estimates an **equivalent room**: a length, width, and height — and the volume they enclose — that would decay the way the recording does.

## The equivalent shoebox

The estimate is a **shoebox model**: a simple rectangular room described by three dimensions. Real rooms have alcoves, balconies, furniture, and angled walls, but their *decay behavior* is governed mostly by two bulk properties — how much air the space encloses and how absorptive its surfaces are. The shoebox is the simplest shape that captures both, so libsonare solves for the rectangular room whose decay best matches what was measured.

This means the dimensions are **acoustic, not architectural**. They reproduce the measured decay, not the literal floor plan. A long, hard corridor and a square, soft room can ring identically; the estimate reports whichever shoebox reproduces that ring, which may not match a tape measure. On the built-in preset rooms — synthesized from known geometry and then estimated back — you can compare the estimate against the ground truth to see how close the blind inversion lands.

## Volume

**Volume** is the enclosed space, in cubic meters, derived directly from the estimated dimensions (length × width × height). It is the single most important driver of how a room sounds, because reverberation time scales with it.

The classic relationship (Sabine's equation) makes this explicit:

> RT60 ≈ 0.161 × V / A

where **V** is the volume and **A** is the total absorption (surface area weighted by each surface's absorption coefficient). Two consequences fall out of that formula:

- **Bigger volume → longer tail.** Sound travels farther between reflections, so it takes more bounces — more time — to decay. This is why large halls ring long even when their surfaces are fairly absorptive.
- **More absorption → shorter tail.** Soft, porous surfaces remove energy at each reflection. This is why a small bedroom full of soft furnishings can be deader than a much larger but bare room.

Volume and absorption therefore trade off. A long RT60 alone does not tell you whether a room is huge or merely reflective — but combined with the estimated absorption, the volume separates the two.

## Why estimate geometry at all

The geometry estimate is what makes the result *visualizable* and *comparable*. A bare RT60 number is abstract; a reconstructed room you can orbit in 3D, with the listener and an estimated source shell inside it, turns the measurement into something spatial. It also feeds the source-distance chain, because critical distance depends on volume and absorption together.

::: details How libsonare reconstructs the room
libsonare treats geometry recovery as an inverse problem: from the energy decay curve and per-band reverberation times it estimates the total absorption, then solves Sabine's relation for the volume that produces the measured decay, and distributes that volume into length/width/height using the proportions most consistent with the modal and decay cues in the response. The preset rooms are generated from known dimensions, rendered to an impulse response, and inverted back, so the demo can show the estimate beside the ground-truth geometry. Because the inversion is single-channel and assumes a diffuse, shoebox-like field, the dimensions should be read as an equivalent acoustic room rather than a survey of the actual space.
:::

Related: [Reverberation Time (RT60 and EDT)](./reverberation-time.md), [Per-Band Decay and Absorption](./absorption-bands.md), [Source Distance and DRR](./source-distance.md), [Acoustic Analysis](../../acoustic-analysis.md)
