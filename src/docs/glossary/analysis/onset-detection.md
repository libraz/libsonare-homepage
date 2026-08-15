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

The curve is built by measuring frame-to-frame increases in per-band level — a *spectral flux* idea, taken in decibels across mel bands so a quiet passage is not drowned out by a loud one. When new energy appears, the curve spikes. During a sustained note, it stays low.

Peaks in this envelope are the candidate onsets.

The envelope matters because the *shape* of the curve, not just the peak list, is what tempo and beat algorithms analyze. A clean, peaky envelope gives confident tempo estimates; a smeared one does not.

## Why this helps tempo and beats

A steady groove makes the onset envelope **periodic** — peaks recur at roughly even spacing. Tempo estimation looks for that period; beat tracking then places a pulse train onto the peaks. Both read the same envelope, which is why improving onset detection improves tempo and beat accuracy together.

<SonareDemo id="beat-tracking" />

::: details How libsonare computes onset strength
libsonare derives the onset-strength envelope from a **mel spectrogram**, not from raw STFT magnitudes. The mel stage is mandatory: mel power is converted to dB (clamped 80 dB below the peak), the difference between a frame and the one before it (`lag = 1`) is half-wave rectified, and the surviving positive differences are *averaged* across mel bands into a single curve. Differencing in dB makes the curve react to a *ratio* change, so a quiet passage still produces peaks comparable to a loud one — reimplementing it on linear magnitudes instead gives a curve dominated by the loudest sections. A separate `spectralFlux()` helper does work on raw STFT magnitudes, but it is not what feeds onsets, BPM, or beats.

The envelope is used by the tempogram (for BPM) and the beat-tracking dynamic program, and it is also exposed through `onsetEnvelope()` for visualizers that want motion reacting to onsets.
:::

::: tip The envelope you fetch is not quite the one the detectors use
`OnsetConfig.detrend` defaults to `false`, matching `librosa.onset.onset_strength`. The onset, BPM, and beat analyzers set it to `true` internally, because subtracting the slow baseline sharpens peak picking. So a curve you fetch yourself with `onsetEnvelope()` keeps a drifting baseline the detectors have already removed — expect the shapes to differ, and do not calibrate a threshold on one and apply it to the other.
:::

Related: [MIR Overview](../concepts/mir-overview.md), [Tempo and BPM](./tempo-bpm.md), [Beats and Downbeats](./beats-downbeats.md), [Spectrogram and STFT](./spectrogram-stft.md)
