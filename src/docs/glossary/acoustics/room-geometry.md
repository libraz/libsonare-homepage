---
title: Room Geometry and Volume
description: Estimated dimensions and volume — the equivalent shoebox room that reproduces a measured decay, and why it is acoustic, not architectural.
---

# Room Geometry and Volume

From a recording's reverberant tail, libsonare estimates an **equivalent room**: a length, width, and height — and the volume they enclose — that would decay the way the recording does.

<SonareDemo id="room-decay" />

## The equivalent shoebox

The estimate is a **shoebox model**: a simple rectangular room described by three dimensions. Real rooms have alcoves, balconies, furniture, and angled walls, but their *decay behavior* is governed mostly by two bulk properties — how much air the space encloses and how absorptive its surfaces are. The shoebox is the simplest shape that captures both, so libsonare solves for the rectangular room whose decay best matches what was measured.

<RoomEquivalenceFigure
  title="An equivalence, not a floor plan"
  caption="The inversion recovers the rectangular room whose volume and total absorption decay the way the recording does. Alcoves, angled walls, and where the furniture sits leave no separable trace in a single-channel decay, so none of them come back out."
/>

This means the dimensions are **acoustic, not architectural**. They reproduce the measured decay, not the literal floor plan. A long, hard corridor and a square, soft room can ring identically; the estimate reports whichever shoebox reproduces that ring, which may not match a tape measure. On the built-in preset rooms — synthesized from known geometry and then estimated back — you can compare the estimate against the ground truth to see how close the blind inversion lands.

::: warning The proportions are an input, not a result
A single decay fixes the room's *scale*, never its shape. libsonare solves the scale from RT60 and takes the length : width : height ratios straight from the `aspectHintLw` / `aspectHintLh` priors, which default to `1`. Call `estimateRoom(...)` without them and the three dimensions always come back equal — a cube. Pass the hints when you know roughly how the room is proportioned; otherwise read the volume and treat the individual dimensions as a way of drawing it.
:::

## Volume

**Volume** is the enclosed space, in cubic meters, derived directly from the estimated dimensions (length × width × height). It is the single most important driver of how a room sounds, because reverberation time scales with it.

The classic relationship (Sabine's equation) makes this explicit:

> RT60 ≈ 0.161 × V / A

where **V** is the volume and **A** is the total absorption (surface area weighted by each surface's absorption coefficient). Two consequences fall out of that formula:

- **Bigger volume → longer tail.** Sound travels farther between reflections, so it takes more bounces — more time — to decay. This is why large halls ring long even when their surfaces are fairly absorptive.
- **More absorption → shorter tail.** Soft, porous surfaces remove energy at each reflection. This is why a small bedroom full of soft furnishings can be deader than a much larger but bare room.

Volume and absorption therefore trade off, and a single decay cannot untangle them. It pins down only the *product* V × A: a large, lightly absorptive room and a small, heavily absorptive one can ring identically, and no amount of extra analysis of that one decay will tell them apart. libsonare closes the gap with a fixed mean-absorption prior (`referenceAbsorption`, default `0.15`) that sets the volume scale, then back-solves the per-band absorption at the geometry that prior implies. The estimated absorption is therefore not a second, independent reading that separates the two — it is derived from the assumed volume. Change the prior and the reported volume moves with the cube of it: assume half the true mean absorption and the room comes back about eight times too small.

## Why estimate geometry at all

The geometry estimate is what makes the result *visualizable* and *comparable*. A bare RT60 number is abstract; a reconstructed room you can orbit in 3D, with the listener and an estimated source shell inside it, turns the measurement into something spatial. The source-distance estimate also uses it, because critical distance depends on volume and absorption together.

::: details How libsonare reconstructs the room
libsonare treats geometry recovery as an inverse problem, but only one number in it is genuinely recovered. From the broadband reverberation time it inverts the Eyring relation (Sabine when `preferEyring` is `false`) under the mean-absorption prior to get the room's linear scale, then multiplies that scale out through the supplied aspect ratios to produce length, width, and height, and back-solves the per-band absorption at the resulting volume and surface area. No modal (room-resonance) analysis takes place, and no shape is inferred: the proportions are the caller's prior, defaulting to 1 : 1 : 1. The preset rooms are generated from known dimensions, rendered to an impulse response, and inverted back, so the demo can show the estimate beside the ground-truth geometry. Because the inversion is single-channel and assumes a diffuse, shoebox-like field, the dimensions should be read as an equivalent acoustic room rather than a survey of the actual space.
:::

Related: [Reverberation Time (RT60 and EDT)](./reverberation-time.md), [Per-Band Decay and Absorption](./absorption-bands.md), [Source Distance and DRR](./source-distance.md), [Acoustic Analysis](../../acoustic-analysis.md)
