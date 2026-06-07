---
title: Repair and Input Controls
description: How input gain and denoise prepare a source before mastering.
---

# Repair and Input Controls

Repair controls prepare the source before tonal shaping, dynamics, stereo processing, and limiting. They are most useful when the source has noise, generated artifacts, or unusual level.

In the demo, this group covers Input Gain and Denoise Amount.
Both controls are preparation steps. They are not the main source of tone or loudness; they make the later stages react to a healthier signal.

## Input Gain

Input Gain changes level before the mastering chain reacts. Leave it at 0 dB unless the source is unusually quiet or already too hot.

A quiet source can under-drive the compressor and exciter. A hot source can make later stages clamp down too early.
Do not use Input Gain as a shortcut for final loudness. Loudness should come from the optimizer and limiter. Pushing the input too hard changes what the compressor threshold means and moves the chain away from the preset design.

## Denoise Amount

Denoise Amount controls how strongly the repair stage suppresses steady background noise. It can help with hiss, low-level broadband noise, and some generated-source residue.

Start low. A little remaining noise is often better than smeared drums, softened attacks, or watery artifacts.

::: tip A little noise beats smeared drums
Stop as soon as the noise is unobtrusive. Pushing denoise further wobbles cymbal tails, vacuums room tone, and clips vocal breaths. And never use Input Gain to chase loudness — that belongs to the optimizer and limiter, and big input moves change what every downstream detector sees.
:::

<SonareDemo id="repair-denoise" />

## Signs to Back Off

If raising denoise produces wobbling cymbal tails, an unnaturally vacuumed room tone, or vocal breaths that cut off awkwardly, the repair stage is eating into the music itself. Noise is something to make unobtrusive, not something to erase completely.

If moving Input Gain visibly changes how the compressor or limiter reacts, return the gain to where it started before doing anything else. Input-stage changes alter the signal feeding every downstream detector, so using Input Gain to chase loudness usually breaks the chain's overall balance.

## Decision Order

1. Render once with Input Gain at 0 dB.
2. Check input peak and crest factor.
3. Raise Input Gain only if the source is clearly under-driven.
4. Raise Denoise Amount only if noise is audible in intros, tails, or quiet passages.
5. After denoise, check drums, consonants, and reverb tails for smearing.

With generated music, noise and tone can be hard to separate. Aim to make the noise unobtrusive, not to erase every trace of it.

:::: details Implementation notes

When repair is active, the demo sends denoise settings to libsonare WASM through the worker so spectral processing does not block the UI thread. The current configuration uses FFT frame processing with a conservative gain floor. Higher Denoise Amount lowers that floor and allows stronger suppression after noise estimation.

Input Gain is intentionally narrow in range because final loudness is handled by the LUFS optimizer. Large input moves would make compressor threshold decisions harder to interpret and could push unnecessary work into the limiter.

::::

Related: [What Is Mastering?](../concepts/what-is-mastering.md), [Tone and Air Controls](./tone-air.md)
