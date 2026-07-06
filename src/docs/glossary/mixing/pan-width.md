---
title: Pan and Stereo Width
description: Pan position, pan modes, pan law, and stereo width — how libsonare places a track across the stereo field and controls its image.
---

# Pan and Stereo Width

**Pan** decides where a track sits left to right.

**Stereo width** decides how wide its image spreads.

Together they shape the horizontal space of a mix, giving each part room instead of stacking everything in the center. This page grounds the controls in libsonare's `PannerProcessor` and `StereoWidthProcessor`; for the basics see [Mixing Basics](../concepts/mixing-basics.md).

## Pan position

**Pan** moves a track between hard left and hard right. Spreading parts across the field lets each breathe and reduces masking. But "pan" hides two separate decisions — *how* a position maps to the channels, and *how loud* the center is — and libsonare exposes both.

## Pan mode: how position maps to channels

A **pan mode** chooses the mapping:

- A **true pan** moves a mono source across the field.
- A **balance** control turns one side of a stereo track down rather than repositioning it.
- **Independent L/R** positioning places each side separately.

Choosing the right mode matters most for stereo sources: a true-pan applied to an already-stereo track can collapse its image, where a balance keeps it intact.

## Pan law: keeping loudness steady as you pan

When a source pans from center to a side, its perceived loudness can jump unless compensated. **Pan law** sets how much the center is attenuated relative to the sides (common laws are around −3 dB or −4.5 dB at center) so a part does not get louder or quieter simply because you moved it. Match the pan law to your monitoring and summing expectations.

## Stereo width

**Stereo width** narrows or widens the image, usually by adjusting the side signal (left-minus-right) relative to the mid signal.

Widening adds spaciousness, but it can create [mono compatibility](../concepts/mono-compatibility.md) problems. Too much side energy can weaken or cancel when summed to mono.

Narrowing tightens focus and improves mono robustness. Width belongs late in the strip, after pan, so it acts on the already placed signal.

<SonareDemo id="mono-fold" />

::: details How libsonare models pan and width
Pan is a `PannerProcessor` configured by `PanMode` (true pan / balance / independent) and `PanLaw` (center attenuation), placed after the fader in the strip. Stereo width is a `StereoWidthProcessor` operating on the mid/side representation, late in the signal order so it acts on the panned signal. Both are parameter-smoothed for click-free moves and write to the post-fader `GoniometerBuffer` so the resulting image can be metered. The placement matches the fixed strip order described in [Channel Strip](./channel-strip.md).
:::

Related: [Mixing Basics](../concepts/mixing-basics.md), [Channel Strip](./channel-strip.md), [Mono Compatibility](../concepts/mono-compatibility.md), [Automation and Metering](./automation-metering.md)
