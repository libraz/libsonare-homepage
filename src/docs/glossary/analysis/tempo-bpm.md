---
title: Tempo and BPM
description: BPM, tempo, the tempogram, autocorrelation, and octave errors — how libsonare estimates how fast a track is from its onset envelope.
---

# Tempo and BPM

**Tempo** is how fast the music feels, measured in **BPM (beats per minute)** — 120 BPM means two beats every second. libsonare estimates it from the periodicity of the [onset-strength envelope](./onset-detection.md), not by counting beats directly. This page expands the timing section of [MIR Overview](../concepts/mir-overview.md).

## From onsets to a tempo

If the music has a steady pulse, its onset envelope is **periodic**: peaks recur at an even spacing. Tempo estimation measures that spacing. Two standard tools do this:

- **Autocorrelation** slides the onset envelope against a time-shifted copy of itself and measures how well they match at each lag. Lags where the curve lines up with itself reveal the repeating period — and the period converts directly to BPM.
- **The tempogram** turns that into a picture: a time × tempo map showing the strength of every candidate tempo at each moment. A strong horizontal band is a stable tempo; a band that drifts shows a track that speeds up or slows down.

## Octave errors: the classic tempo trap

Tempo estimates famously land at **half or double** the "true" tempo — 75 BPM reported as 150, or 140 as 70. This is not a bug; it is genuinely ambiguous. A listener tapping along to the same groove can reasonably tap at half-time or double-time, and the periodicity supports both. These are called **octave errors** (by analogy with pitch octaves).

Practical handling: pick a sensible BPM range for your material (e.g. 70–180 for pop), and treat the estimate as one candidate among its half/double partners rather than an exact truth — especially early in a stream, before enough audio has accumulated.

## Confidence and stability

A single number hides how *sure* the estimate is. A track with a tight, repetitive groove yields a sharp tempogram peak and high confidence; rubato, ambient, or sparse material yields a flat tempogram and low confidence. When a confidence value is available, use it to decide whether to display the BPM, hedge it, or hide it.

::: details How libsonare estimates tempo
libsonare computes the onset-strength envelope from the STFT, then estimates tempo via tempogram and autocorrelation analysis of that envelope, selecting a dominant period and converting it to BPM. The streaming analyzer exposes a *progressive* BPM that refines as more audio arrives, so early values should be treated as provisional. Beat tracking then uses the tempo as a prior when placing individual beats, so tempo and beats are computed from the same onset information rather than independently.
:::

Related: [Onset Detection](./onset-detection.md), [Beats and Downbeats](./beats-downbeats.md), [MIR Overview](../concepts/mir-overview.md), [Realtime and Streaming](../../realtime-streaming.md)
