---
title: Audio Basics
description: Sample rate, bit depth, mono/stereo, amplitude, dB, clipping, headroom, and latency in one practical guide.
---

# Audio Basics

These are the audio terms you need before reading analysis or mastering pages. They are grouped here because they explain the same signal path: how sound is represented, measured, clipped, delayed, and played back.

<SonareDemo id="waveform-harmonics" />

## Sample Rate

Sample rate is how many audio samples are stored per second. `44.1 kHz` and `48 kHz` are common delivery rates. Higher sample rates can represent higher frequencies, but they also use more CPU and memory.

For most browser analysis and mastering work, the best first choice is the file's original sample rate. Avoid unnecessary conversion unless a tool requires it.

## Bit Depth

Bit depth describes the resolution of stored sample values. Higher bit depth gives more room for quiet detail and processing headroom. Final consumer files are often 16-bit or compressed formats, while production files are commonly 24-bit or floating point.

Inside Web Audio and libsonare processing, samples are represented as floating-point values. That gives processing headroom, but final export still needs sensible peak safety.

## Mono and Stereo

Mono has one channel. Stereo has left and right channels. Stereo can create width and spatial placement, but it also introduces mono-compatibility questions.

When a stereo signal is summed to mono, some side information can weaken or cancel. This is why the mastering demo shows correlation and stereo image.

## Amplitude and dB

Amplitude is the instantaneous sample value. dB is a logarithmic way to describe level. Audio work uses dB because human loudness perception is closer to logarithmic than linear.

Typical digital sample values are normalized around `-1.0` to `1.0`. A dBFS value of `0 dBFS` is the digital full-scale ceiling.

## Clipping and Headroom

Clipping happens when a signal asks for more level than the system can represent. Digital clipping can sound harsh because waveform peaks are cut flat.

Headroom is the margin between the current peak level and the ceiling. Mastering needs enough headroom before final limiting, and enough true-peak safety after final rendering.

## Latency

Latency is delay. Some processing, especially lookahead limiting and spectral repair, needs future samples before it can decide what to do. Offline rendering can tolerate latency. Live monitoring and interactive tools need it kept low.

:::: details Implementation notes

The browser demo decodes files through Web Audio, processes floating-point buffers through libsonare WASM, and exports stereo 16-bit PCM WAV. The mastering worker keeps heavy rendering away from the UI thread. Object URLs for source, rendered audio, reports, and settings are revoked when replaced to avoid accumulating browser memory.

::::

Related: [Mono Compatibility](./mono-compatibility.md), [True Peak Safety](./true-peak-safety.md), [Reading Mastering Meters](../mastering/meter-reading.md)
