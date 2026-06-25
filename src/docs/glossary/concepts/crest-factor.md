---
title: Crest Factor
description: The gap between peak level and average level, and how it helps interpret density and transient control.
---

# Crest Factor

Crest factor is the gap between peak level and average level. The "average" here is the RMS level — a measure of the signal's sustained energy rather than its momentary spikes — and crest factor is the difference between the two, reported in dB. In mastering, it is a quick way to understand how peaky, dense, or transient-heavy a signal is.

A high crest factor means peaks rise far above the average level. A low crest factor means the signal is dense or heavily controlled. Neither is automatically good or bad.

## How To Read It

Think of crest factor as a clue, not a verdict.

| Crest behavior | Possible meaning |
|----------------|------------------|
| High | Open dynamics, strong transients, or uncontrolled peaks. |
| Moderate | Balanced density and movement. |
| Low | Dense master, heavy limiting, or intentionally flat material. |

A solo snare can have a high crest factor and still be healthy. A dense synth pad can have a low crest factor and still be correct. Context matters.

## Why It Matters

Limiters react to peaks. If a mix has a few peaks much louder than the rest, the limiter may work hard on those moments while the overall master remains quieter than expected.

<SonareDemo id="loudness-meter" />

Compression, clipping, saturation, and transient shaping can reduce crest factor. Used carefully, that can make a master feel more controlled. Used carelessly, it removes punch and makes the track tiring.

## Relationship To Dynamic Range

Crest factor is related to dynamics, but it is not the same as musical dynamic range. It mostly describes peak-to-average behavior over a measurement window. A song can have a low crest factor in each section while still having macro dynamics between sections.

Use it alongside listening, LUFS, true peak, and arrangement context.

## Common Pitfalls

If crest drops sharply and kicks or snares lose their attack at the same time, something in the compressor, saturator, or limiter is shaving transients too aggressively. The opposite pattern — crest stays high but the LUFS target is missed — usually means only a few rare peaks are pushing the limiter while the rest of the mix has not actually become denser.

In that second case, do not solve it by raising the ceiling. Revisit the earlier dynamics stage, the input gain, and the low-end balance first.

## In libsonare

The mastering demo shows crest information for source, master, and reference material. It is especially useful when comparing a source against a reference track: if the reference has much lower crest, it may be denser, more limited, or simply arranged differently.

:::: details Implementation notes

The displayed crest value is computed from peak and RMS on the selected buffer and reported in dB. It is a lightweight diagnostic, not a replacement for a dedicated long-window loudness or dynamics meter.

If crest drops sharply after processing, the compressor, saturation, or limiter may be suppressing transients strongly. That is not automatically wrong, but it should trigger a listening check for lost punch or groove.

::::

Related: [Dynamic Range](./dynamic-range.md), [Reference Track](./reference-track.md), [True Peak](../true-peak.md)
