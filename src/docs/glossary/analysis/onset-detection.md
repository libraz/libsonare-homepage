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

Take one snare hit. The instant it is struck is the onset. The sharp "crack" right after is the transient. The regular pulse you count as 1, 2, 3, 4 across the song is the beat. A fast fill produces many onsets, but only some of them are beats.

## The onset-strength envelope

libsonare does not just emit a list of onset times. It first computes an **onset-strength envelope**: a continuous curve that rises wherever the spectrum changes abruptly.

The curve is built by measuring frame-to-frame increases in per-band level — a *spectral flux* idea, taken in decibels across mel bands so a quiet passage is not drowned out by a loud one. When new energy appears, the curve spikes. During a sustained note, it stays low.

Peaks in this envelope are the candidate onsets.

Peak picking (deciding which hills count as real onsets) depends on a threshold and a minimum spacing. Packing the spacing too tightly counts one hit twice; loosening it too far drops notes of a fast fill. The denser the rhythm, the more this tuning decides the result.

Too many onsets usually means fine noise and decay tails are being picked up as events. Too few means the threshold is too high, or the material attacks softly and the spectrum barely changes.

The envelope matters because the *shape* of the curve, not just the peak list, is what tempo and beat algorithms analyze. A clean, peaky envelope gives confident tempo estimates; a smeared one does not.

## Why this helps tempo and beats

A steady groove makes the onset envelope **periodic** — peaks recur at roughly even spacing. Tempo estimation looks for that period; beat tracking then places a pulse train onto the peaks. Both read the same envelope, which is why improving onset detection improves tempo and beat accuracy together.

<SonareDemo id="beat-tracking" />

::: details How libsonare computes onset strength
libsonare derives the onset-strength envelope from a **mel spectrogram**, not from raw STFT magnitudes. The mel stage is mandatory: mel power is converted to dB (clamped 80 dB below the peak), the difference between a frame and the one before it (`lag = 1`) is half-wave rectified, and the surviving positive differences are *averaged* across mel bands into a single curve. Differencing in dB makes the curve react to a *ratio* change, so a quiet passage still produces peaks comparable to a loud one — reimplementing it on linear magnitudes instead gives a curve dominated by the loudest sections. A separate `spectralFlux()` helper does work on raw STFT magnitudes, but it is not what feeds onsets, BPM, or beats.

`OnsetConfig` exposes the difference lag (`lag = 1` frame), `detrend`, and `center`, which aligns each value to the frame center.

The envelope is used by the tempogram (for BPM) and the beat-tracking dynamic program, and it is also exposed through `onsetEnvelope()` for visualizers that want motion reacting to onsets.
:::

::: tip The envelope you fetch is not quite the one the detectors use
`OnsetConfig.detrend` defaults to `false`, matching `librosa.onset.onset_strength`. The onset, BPM, and beat analyzers set it to `true` internally. It subtracts the curve's mean, a constant: the curve from `onsetEnvelope()` is non-negative, and the one the detectors read is zero-mean. The peaks are in the same places, but a threshold tuned on one does not transfer to the other.
:::

Related: [MIR Overview](../concepts/mir-overview.md), [Tempo and BPM](./tempo-bpm.md), [Beats and Downbeats](./beats-downbeats.md), [Spectrogram and STFT](./spectrogram-stft.md)
