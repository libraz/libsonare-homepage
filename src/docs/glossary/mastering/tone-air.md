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

::: warning It re-excites a present top end; it cannot synthesise a missing one
Both halves of the stage are driven by the energy of the band they are meant to fill, so it is self-limiting. While the band's envelope sits below roughly −36 dBFS it produces no boost at all; even fully open the shelf tops out near +3 dB, and the synthesised component is held at least 6 dB below the band it was derived from. That is enough to open up a dull-but-present top end. If the upper octave was genuinely removed — a hard cliff from a lossy or generated render — the detector has nothing to follow, so use Exciter Amount instead: it builds new harmonics from the midrange and can reach above the cliff.
:::

## Adjustment Order

Start with Tilt EQ when the whole master is too dark or too bright. Move to Exciter Amount only when the track has the right balance but still lacks presence. Use Air Band Amount last, especially when the upper octave feels closed off or the source has a generated 16 kHz edge.

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
