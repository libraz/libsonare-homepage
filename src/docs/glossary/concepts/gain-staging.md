---
title: Gain Staging
description: Keeping signal levels sensible before, during, and after mastering.
---

# Gain Staging

Gain staging means keeping signal levels in a useful range as audio moves through a chain. In mastering, it prevents the compressor, exciter, stereo stage, limiter, and loudness optimizer from reacting to a misleading level.

Good gain staging is not about making everything quiet. It is about leaving enough room for processing decisions to remain meaningful.

<SonareDemo id="engine-lane-mixer" />

## Why It Matters

If the source is too hot, every processor may behave as if the track needs heavy control. Compression can become too dense, saturation can get harsh, and the limiter can work harder than needed.

If the source is too quiet, processors may barely react. You may then overcompensate later with loudness or limiting, which hides the real issue.

## Practical Mastering Checks

1. Check whether the source is clipped before doing anything.
2. Leave Input Gain at `0 dB` unless the source is clearly too quiet or too hot.
3. Adjust dynamics by listening to gain reduction and punch, not by chasing a fixed threshold number.
4. Let the loudness optimizer handle final delivery gain.
5. Keep true-peak ceiling separate from loudness ambition.

## Common Misjudgments

A quiet source does not need a large initial lift. Compressors and limiters downstream will react harder than they should, and the result tends to be a dense, fatiguing master. The opposite — keeping the input quiet and chasing loudness only at the very end — hides which stage is doing what to the signal.

Input Gain is not the place to set "how loud the listener hears it." It is the place to set the level entering the chain. Final delivery loudness belongs to the loudness stage, and peak safety belongs to the True Peak limiter.

## Gain Staging vs Loudness Target

Gain staging is about how processors react inside the chain. Loudness target is about where the final rendered file lands. Do not solve one with the other.

If the master is too dense, lowering the loudness target may help, but you should also check threshold, ratio, attack, release, and input level.

:::: details Implementation notes

The demo exposes Input Gain as a narrow control and keeps final gain inside the loudness stage. This avoids making compressor threshold decisions depend on large arbitrary input moves. The exported report records both source and rendered metrics so gain decisions can be audited after rendering.

Moving Input Gain changes the signal level reaching every downstream detector.

That affects several later stages:

| Stage | What changes when input gain moves |
|-------|------------------------------------|
| Compressor | The same threshold can react more or less strongly |
| Saturation | The same drive setting can distort more or less |
| Limiter | Gain reduction can increase or decrease |

After a large Input Gain move, re-check the dynamics and limiter settings. After changing presets, reset Input Gain to its default unless you intentionally want to carry the old offset forward.

::::

Related: [Repair and Input Controls](../mastering/repair.md), [Dynamics Controls](../mastering/dynamics.md), [Delivery Targets](../mastering/delivery-targets.md)
