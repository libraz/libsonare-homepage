---
title: Pan and Stereo Width
description: Pan position, pan modes, pan law, and stereo width — how libsonare places a track across the stereo field and controls its image.
---

# Pan and Stereo Width

**Pan** decides where a track sits left to right.

**Stereo width** decides how wide its image spreads.

Together they shape the horizontal space of a mix, giving each part room instead of stacking everything in the center. This page grounds the controls in libsonare's `PannerProcessor` and `StereoWidthProcessor`; for the basics see [Mixing Basics](../concepts/mixing-basics.md).

## Pan position

**Pan** moves a track between hard left and hard right. Spreading parts across the field lets each breathe and reduces masking — one part burying another that shares its frequency range. But "pan" hides two separate decisions — *how* a position maps to the channels, and *how loud* the center is — and libsonare exposes both.

Keep the vocal in the center, the guitar to the left, and the keys to the right, and each part gets a spot of its own, so each one is easier to follow than when all three are stacked in the middle. The busier the mix, the more this left-right placement decides how well the parts separate.

## Pan mode: how position maps to channels

A **pan mode** chooses the mapping:

- A **true pan** moves a mono source across the field.
- A **balance** control turns one side of a stereo track down rather than repositioning it.
- **Independent L/R** positioning places each side separately.

Choosing the right mode matters most for stereo sources. libsonare's true pan (`stereoPan`) first folds the track to mono, `(L + R) / 2`, and then places that mono signal, so it always collapses a stereo image: what differs between the channels is lost and anti-phase content cancels. A balance (the default) keeps the image intact.

## Pan law: keeping loudness steady as you pan

When a source pans from center to a side, its perceived loudness can jump unless compensated. **Pan law** sets how much the center is attenuated relative to the sides so a part does not get louder or quieter simply because you moved it. libsonare offers four:

| Law | Center gain per channel | Keeps steady |
|-----|-------------------------|--------------|
| `const3dB` (default) | −3 dB (0.707) | Total power, which is what matters over speakers |
| `const4.5dB` | −4.5 dB (0.595) | A compromise between the two |
| `const6dB` | −6 dB (0.5) | The mono sum (constant amplitude) |
| `linear0dB` | 0 dB (1.0) | Nothing; no center compensation |

The center dip reaches the output only with a true pan. In the default balance mode the channel the pan points toward stays at unity and only the other channel is turned down, so a centered track is at 0 dB under every law; the law then only shapes how fast the far side falls. See [Mixing Engine](../../mixing.md#pan-modes-and-pan-laws) for the arithmetic.

## Stereo width

**Stereo width** narrows or widens the image, usually by adjusting the side signal (left minus right — what differs between the channels) relative to the mid signal (what the two channels share).

Widening adds spaciousness, but it can create [mono compatibility](../concepts/mono-compatibility.md) problems. Side-only content disappears in a mono sum. Pure M/S width scales the side while keeping the mono sum unchanged; Haas delays, polarity changes, subsequent limiting, or comparison normalization can change the mono result.

Narrowing tightens focus and improves mono robustness. Width sits late in the strip, after pan, so it acts on the already placed signal, and that has a side effect on a panned mono source: width changes its position too. A hard-left mono source at width 0 ends up centered at −6 dB, and at width 2 the opposite channel gets an anti-phase copy at half level. Leave width at 1 on mono sources and place them with pan.

<SonareDemo id="mono-fold" />

::: details How libsonare models pan and width
Pan is a `PannerProcessor` configured by `PanMode` (true pan / balance / independent) and `PanLaw` (center attenuation), placed after the fader in the strip. Stereo width is a `StereoWidthProcessor` operating on the mid/side representation, late in the signal order so it acts on the panned signal. Both are parameter-smoothed for click-free moves and write to the post-fader `GoniometerBuffer` so the resulting image can be metered. The placement matches the fixed strip order described in [Channel Strip](./channel-strip.md).
:::

Related: [Mixing Basics](../concepts/mixing-basics.md), [Channel Strip](./channel-strip.md), [Mono Compatibility](../concepts/mono-compatibility.md), [Automation and Metering](./automation-metering.md)
