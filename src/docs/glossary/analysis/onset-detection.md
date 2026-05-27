---
title: Onset Detection
description: Onsets, the onset-strength envelope, and transients — the root of the rhythm family that tempo, beat, and section analysis all grow from.
---

# Onset Detection

An **onset** is the moment a musical event *begins* — a note struck, a drum hit, a consonant sung. Finding onsets is the root of the whole rhythm family: tempo, beats, and even section boundaries all grow from onset information. This page expands the timing section of [MIR Overview](../concepts/mir-overview.md).

## Onset vs. transient vs. beat

These three are easy to confuse:

- An **onset** is the *start* of any sound event, whether or not it lands on a beat.
- A **transient** is the short, high-energy burst at the very front of a sound (the stick hitting the drum). Onsets are detected *from* transients and other spectral changes.
- A **beat** is a perceived pulse of the music. Beats usually coincide with onsets, but not every onset is a beat (a fast drum fill has many onsets between two beats).

So the pipeline is: spectral change → onsets → tempo/beats.

## The onset-strength envelope

libsonare does not just emit a list of onset times. It first computes an **onset-strength envelope**: a continuous curve that rises wherever the spectrum changes abruptly.

The curve is built by measuring frame-to-frame increases in spectral energy, a *spectral flux* idea. When new energy appears, the curve spikes. During a sustained note, it stays low.

Peaks in this envelope are the candidate onsets.

The envelope matters because the *shape* of the curve, not just the peak list, is what tempo and beat algorithms analyze. A clean, peaky envelope gives confident tempo estimates; a smeared one does not.

## Why this drives tempo and beats

A steady groove makes the onset envelope **periodic** — peaks recur at roughly even spacing. Tempo estimation looks for that period; beat tracking then places a pulse train onto the peaks. Both read the same envelope, which is why improving onset detection improves tempo and beat accuracy together.

::: details How libsonare computes onset strength
libsonare derives the onset-strength envelope from STFT magnitudes by summing positive frame-to-frame spectral differences, optionally per mel band, then aggregating into a single curve. The envelope feeds the tempogram (for BPM) and the beat-tracking dynamic program, and it is also exposed for visualizers that want onset-driven motion. Because it is built on the shared STFT, requesting onsets alongside other features does not recompute the spectrogram.
:::

Related: [MIR Overview](../concepts/mir-overview.md), [Tempo and BPM](./tempo-bpm.md), [Beats and Downbeats](./beats-downbeats.md), [Spectrogram and STFT](./spectrogram-stft.md)
