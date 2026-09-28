---
title: Tone and Air Controls
description: How tilt EQ, exciter amount, and air-band amount shape brightness and openness.
---

# Tone and Air Controls

Tone and air controls shape the broad spectral impression of a master. They should make the track clearer, not merely brighter.

The demo groups Tilt EQ, Exciter Amount, and Air Band Amount because they all affect perceived brightness, but they do it in different ways.

## Tilt EQ

Tilt EQ changes broad tonal balance around a midrange pivot. Positive tilt adds relative top-end energy and reduces some low-end weight. Negative tilt warms the master by leaning the balance downward.

Use it for broad correction. Do not use it to solve one narrow resonance.

<SonareDemo id="tilt-eq" />

## Exciter Amount

Exciter Amount adds controlled harmonic brightness. Unlike an EQ boost, an exciter creates new harmonic content from the existing signal.

Use it when a source feels veiled or flat. Back off if vocals become sharp, cymbals turn brittle, or generated sources sound more synthetic.

## Air Band Amount

Air Band Amount works in the very high-frequency region: it lifts and re-excites whatever already sits above the shelf frequency (12 kHz by default). A dynamic high shelf raises the band, and a harmonic generator fed from that same band adds a little extra texture over it.

It should be subtle. If the track starts to hiss or feel detached from the midrange, the amount is too high.

::: warning It needs energy in its detector band
Both halves of the stage are driven by energy above the shelf frequency, so they are self-limiting. Below roughly −36 dBFS of detector-band envelope, the dynamic shelf applies no boost; the harmonic path can still add a component if that band has energy. Even fully open, the shelf tops out near +3 dB, and the synthesised component is held at most half the detector band's RMS level. With the default 12 kHz shelf, a source cut off at 16 kHz may still have enough 12–16 kHz energy to drive newly generated harmonics above the cutoff. This cannot restore the original missing detail. If the detector band itself is absent, use Exciter Amount instead: it builds harmonics from lower frequencies.
:::

## Adjustment Order

Start with Tilt EQ when the whole master is too dark or too bright. Move to Exciter Amount only when the track has the right balance but still lacks presence. Use Air Band Amount last when there is upper-band energy to work with; at a 16 kHz cutoff, audition it only if content remains above the shelf frequency.

This order prevents a common mistake: using exciter or air-band processing to fix a broad tonal imbalance. If the low end is too heavy, adding air may create a louder, harsher master while the actual imbalance remains.

::: warning Don't use exciter or air to fix a broad imbalance
Brightness controls add presence; they do not rebalance the spectrum. If the master is too dark or too bass-heavy, reach for Tilt EQ first — then exciter for presence, and air-band last.
:::

## What To Listen For

Use loudness-matched A/B and listen past the first impression. Good tone moves make the vocal, snare, cymbals, and ambience easier to place without pulling the mix apart. Bad moves create a separate shiny layer above the song, make sibilants — the "s" and "sh" consonant sounds — jump forward, or make the low end feel smaller only because the top end became exaggerated.

:::: details Implementation notes

The demo maps the Quick Tone macro into three controls: tilt, exciter drive/amount, and air-band amount.

libsonare's tilt stage uses complementary shelving around a pivot. The demo keeps that pivot broad so it behaves like mastering EQ rather than surgical EQ.

Studio mode also exposes the pivot frequency. Extreme values tend to break the overall tonal balance, so it is usually safer to keep the pivot somewhere in the midrange.

The saturation stage receives exciter frequency, drive, amount, Q, and even/odd mix. The spectral air-band stage uses a high shelf-like restoration amount. AI-generated presets bias both stages higher and focus them toward the upper band.

::::

Related: [Air Band](../air-band.md), [Reference Track](../concepts/reference-track.md)
