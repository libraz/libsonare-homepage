---
title: Repair and Input Controls
description: The six-stage repair chain and why its order is fixed, the denoise depth key, and how input gain and denoise prepare a source before mastering.
---

# Repair and Input Controls

Repair runs before tonal shaping, dynamics, stereo processing, and limiting. It is the one part of the chain whose job is to remove something rather than shape it, and it earns its place only when the source carries damage: clipping, clicks, crackle, hum, hiss, or a room the recording was never meant to keep.

In the demo this group is two controls, Input Gain and Denoise Amount. In the engine it is a chain of six stages behind the `repair.*` keys. Both views describe preparation, not the main source of tone or loudness; they make the later stages react to a healthier signal.

For detection and processing workflows, see [Audio Repair](../../audio-repair.md).

## The Six Stages and Their Fixed Order

The engine runs the repair stages in one order, and only the enabled ones run:

| # | Stage | Removes | What it looks for |
|---|-------|---------|-------------------|
| 1 | `declip` | Flat-topped runs where a clipper cut the peaks off | Runs of samples pinned at one level |
| 2 | `declick` | Isolated clicks and pops | Short impulsive runs that stand out from their neighbours |
| 3 | `decrackle` | Dense surface crackle | Samples that depart from the local median |
| 4 | `dehum` | A mains-frequency harmonic series | A prominent fundamental and its harmonics |
| 5 | `denoise` | Steady broadband noise | A noise spectrum estimated from the quietest frames |
| 6 | `dereverb` | The late reverberant tail | A stationary tail behind the direct sound |

The order is fixed because every stage's detector assumes the damage the earlier stages handle is already gone. The stages run widest-damage-first, so each one sees material the previous has already made well-formed:

- **`declip` before `declick`.** A flat-topped region has no transient for a click detector to measure. The peaks have to be rebuilt before a click can be told apart from a clipped edge.
- **Impulsive repair before broadband estimation.** `denoise` builds its noise spectrum from the quietest frames and then subtracts that estimate from every frame. A click or a crackle burst still sitting in those frames becomes part of the "noise" and is pulled out of frames where it never occurred. `declick` and `decrackle` go first so the estimate describes only the floor.
- **`dehum` before `denoise`.** Hum is a narrow harmonic series, which a tracked notch removes precisely. Left in place it would only be smeared into the broadband floor estimate.
- **`dereverb` last.** A broadband floor reads as a stationary late tail and biases the reverb estimate towards it. With the floor already down, what remains behind the direct sound is the room.

There is no reordering option because there is no order in which a later stage would see cleaner input.

## Denoise Depth: `repair.denoise.reductionDb`

The denoise stage has one main strength control, `repair.denoise.reductionDb`: the deepest attenuation the gain mask may apply to any frequency bin, in dB.

- **Sign:** non-negative; larger values permit deeper attenuation. At 26 the mask can attenuate a bin by at most 26 dB; 0 prevents mask attenuation.
- **Range:** any finite value of 0 or more. There is no upper bound; a negative or non-finite value is rejected with `denoise reduction_db must be finite and non-negative`.
- **Default:** 26 dB. Among the built-in presets only `shellac78` changes it, to 32 dB.

The value sets a lower bound on mask gain, not a guaranteed reduction of the noise itself. At 26 dB that bound is about 0.0501. Signal and noise estimates determine each bin’s actual gain, and audible artifacts remain possible. The demo's Denoise Amount slider is scaled onto this depth.

The chain also accepts the older linear form of the same control. `repair.denoise.gainFloor` is a floor in (0, 1] and is converted on the way in (`reductionDb = -20 * log10(gainFloor)`), so a document written with it loads unchanged; a floor above 1 would become a negative depth and is refused. The shorthand keys `repair.reductionDb` and `repair.gainFloor` resolve to the same `repair.denoise.*` keys. The Node and WASM types declare `gainFloor` as deprecated with that conversion, and a config the engine writes out carries only `reductionDb`.

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

Which stages a source needs, and which presets bundle them, is the subject of [Choosing a Mastering Preset](./preset-selection.md). Each stage's full parameter set is on the [Mastering Processors](../../mastering-processors.md) page.

:::: details Implementation notes

When repair is active, the demo sends denoise settings to libsonare WASM through the worker so spectral processing does not block the UI thread. The stage is an STFT denoiser: it estimates the noise spectrum from the quietest fraction of frames, derives a per-bin gain from the decision-directed a priori SNR, and clamps that gain at the floor `repair.denoise.reductionDb` sets. Higher Denoise Amount deepens that floor and allows stronger suppression after noise estimation.

Input Gain is intentionally narrow in range because final loudness is handled by the LUFS optimizer. Large input moves would make compressor threshold decisions harder to interpret and could push unnecessary work into the limiter.

::::

Related: [What Is Mastering?](../concepts/what-is-mastering.md), [Choosing a Mastering Preset](./preset-selection.md), [Tone and Air Controls](./tone-air.md), [Mastering Processors](../../mastering-processors.md)
