---
title: Glossary
description: A curated index for libsonare audio analysis, MIR, and browser mastering terms.
---

# Glossary

This glossary is an editorial index, not a generated term dump. Start with the grouped guides below, then follow the related links inside each page when you need implementation detail.

::: tip New to audio analysis?
Read [Audio Basics](./glossary/concepts/audio-basics.md) first, then [MIR Overview](./glossary/concepts/mir-overview.md). If you are here for the mastering demo, start with [What Is Mastering?](./glossary/concepts/what-is-mastering.md).
:::

## Foundations

These pages cover the signal and analysis concepts that recur across the API, CLI, WASM, and browser demos.

| Guide | Covers |
|-------|--------|
| [Audio Basics](./glossary/concepts/audio-basics.md) | Sample rate, bit depth, mono/stereo, amplitude, dB, clipping, headroom, and latency. |
| [MIR Overview](./glossary/concepts/mir-overview.md) | BPM, beats, onsets, key, chords, chroma, FFT, STFT, spectrograms, MFCC, CQT, VQT, HPSS, pitch, and sections. |
| [Browser Local Processing](./glossary/concepts/browser-local-processing.md) | What stays local in the browser mastering demo, what still loads from the network, and the tradeoffs of local WASM processing. |

## Mastering Concepts

These guides explain the listening and measurement ideas behind the mastering demo.

| Guide | Covers |
|-------|--------|
| [Mastering](./glossary/mastering.md) | The role of mastering and how loudness, tone, dynamics, stereo image, and peak safety work together. |
| [What Is Mastering?](./glossary/concepts/what-is-mastering.md) | A fuller introduction to mastering as a final delivery process. |
| [LUFS](./glossary/lufs.md) | Integrated loudness and common delivery targets. |
| [True Peak](./glossary/true-peak.md) | Inter-sample peak safety and why `dBTP` differs from sample peak. |
| [A/B Comparison](./glossary/ab-comparison.md) | Loudness-matched before/after listening. |
| [Loudness Matching](./glossary/concepts/loudness-matching.md) | How to compare processing decisions without louder-is-better bias. |
| [Reference Track](./glossary/concepts/reference-track.md) | Using a finished release as a tonal and loudness anchor. |
| [True Peak Safety](./glossary/concepts/true-peak-safety.md) | Choosing ceilings that survive encoding and playback conversion. |
| [Dynamic Range](./glossary/concepts/dynamic-range.md) | Reading movement and density beyond loudness alone. |
| [Crest Factor](./glossary/concepts/crest-factor.md) | Peak-to-average contrast and what it says about punch. |
| [Mono Compatibility](./glossary/concepts/mono-compatibility.md) | Checking whether stereo width survives mono playback. |
| [Gain Staging](./glossary/concepts/gain-staging.md) | Keeping levels sensible before, during, and after processing. |
| [Air Band](./glossary/air-band.md) | High-frequency openness and why it needs restraint. |

## Mastering Feature Guides

These pages group controls by how they are used in the chain. Individual parameters are intentionally not split into thin generated pages.

| Guide | Covers |
|-------|--------|
| [Repair and Input Controls](./glossary/mastering/repair.md) | Input gain, denoise, source clipping, and preparation before the main chain. |
| [Dynamics Controls](./glossary/mastering/dynamics.md) | Threshold, ratio, attack, release, knee, gain reduction, and punch. |
| [Tone and Air Controls](./glossary/mastering/tone-air.md) | Tilt EQ, exciter amount, air-band amount, and brightness decisions. |
| [Stereo, Limiter, and Loudness Controls](./glossary/mastering/stereo-limiter-loudness.md) | Stereo width, limiter ceiling, loudness target, and final rendering. |
| [Reference Match](./glossary/mastering/reference-match.md) | Reference import, level matching, spectral comparison, and match strength. |
| [Delivery Targets](./glossary/mastering/delivery-targets.md) | Choosing LUFS and true-peak targets for streaming, podcast, club, and archive use. |
| [Reading Mastering Meters](./glossary/mastering/meter-reading.md) | LUFS, peak, crest factor, correlation, phase, and stereo image together. |
| [Choosing a Mastering Preset](./glossary/mastering/preset-selection.md) | Selecting a starting point without treating presets as finished masters. |
| [Mastering Quality Checklist](./glossary/mastering/quality-checklist.md) | A final review path before trusting an export. |
| [Error Recovery](./glossary/mastering/error-recovery.md) | What to do when decoding, rendering, reference matching, or playback checks fail. |

## Related Docs

- [Introduction](./introduction.md)
- [Mastering Implementation](./mastering-implementation.md)
- [JavaScript API](./js-api.md)
- [Python API](./python-api.md)
- [CLI](./cli.md)
- [WASM](./wasm.md)
