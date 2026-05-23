---
title: MIR Overview
description: How BPM, beats, key, chords, chroma, onsets, FFT, STFT, spectrograms, MFCC, CQT, VQT, HPSS, pitch, and sections fit together.
---

# MIR Overview

MIR means Music Information Retrieval. It is the part of audio analysis that extracts musical structure from sound: tempo, beat positions, key, chords, pitch, timbre, and sections.

These terms are grouped because they are not isolated features. Most MIR tasks build on spectral or time-frequency representations.

## Timing: BPM, Beat, Onset, Section

BPM estimates tempo. Beat tracking places pulses on the timeline. Onset detection finds moments where notes, drums, consonants, or other events begin.

Section analysis groups longer spans such as intro, verse-like material, chorus-like material, breaks, or repeated patterns. It usually depends on changes in rhythm, harmony, timbre, and energy over time.

## Harmony: Key, Chord, Chroma

Key detection estimates the tonal center. Chord recognition estimates local harmony. Chroma compresses frequency content into 12 pitch-class bins, which is useful because the same pitch class can appear in many octaves.

Chroma is powerful for harmony, but it ignores some octave and timbre detail. That is a feature for chord/key work and a limitation for other tasks.

## Spectrum: FFT, STFT, Spectrogram

The FFT is an efficient algorithm for computing the DFT (Discrete Fourier Transform), which converts a block of samples into frequency content. STFT repeats that process over many short windows so frequency content can be tracked over time.

A spectrogram is the visual result: time on one axis, frequency on another, and intensity as brightness or color.

## Perceptual Features: Mel, MFCC, CQT, VQT

Mel spectrograms warp frequency resolution toward human hearing. MFCCs are the DCT of the log-mel power spectrum, producing decorrelated coefficients that approximate the spectral envelope.

CQT and VQT use musically spaced frequency bins. They are useful when pitch relationships matter more than equal-Hz spacing.

## Separation and Pitch: HPSS and Pitch

HPSS separates harmonic material from percussive material by exploiting their different spectrogram footprints: harmonic content forms horizontal lines, percussive content forms vertical lines. This can improve downstream tasks because drums and pitched instruments often confuse each other.

Pitch estimation tracks fundamental frequency. It is useful for melody, vocals, instruments, tuning checks, and transcription-style workflows.

:::: details Implementation notes

libsonare exposes MIR functions across browser/WASM, JavaScript, Python, native bindings, CLI, and C++ APIs. Many features share intermediate representations such as STFT, chroma, and spectral energy curves, so asking for BPM, key, chord, and section results back-to-back on the same source does not repeat the heavy work — the intermediates are computed once and reused.

The browser analysis demo is built for interactive use, with progressive BPM/key/chord estimates through `StreamAnalyzer` and AudioWorklet integration in mind. The mastering demo focuses on measurement-style APIs instead: loudness measurement, reference comparison, and report export. Running both demos on the same library is meant to show what is reusable across analysis and finishing work.

::::

Related: [Introduction](../../introduction.md), [librosa Compatibility](../../librosa-compatibility.md), [Audio Basics](./audio-basics.md)
