---
title: Streaming Analysis
description: Blocks, frames, hops, updating estimates, and compact frame reads — how libsonare's StreamAnalyzer turns a live audio stream into UI-ready features.
---

# Streaming Analysis

Offline analysis sees the whole file at once. **Streaming analysis** sees the audio a chunk at a time and must produce results *as it goes*.

libsonare's `StreamAnalyzer` runs the same [MIR (Music Information Retrieval)](../concepts/mir-overview.md) pipeline incrementally. It emits per-frame features and musical estimates that update over time for visualizers and live displays.

Use it when audio is arriving live — from a microphone, an AudioWorklet, or a playback graph — and you want meters, a spectrogram, or running BPM/key estimates to update in real time. For a fixed file you already have in full, batch (offline) analysis is simpler and more accurate.

This page explains the streaming model. For the API recipe, see [Realtime and Streaming](../../realtime-streaming.md).

<SonareDemo id="beat-tracking" />

## Block, frame, hop, nFft — four things people confuse

Four words are easy to confuse, and mixing them up causes most streaming bugs:

- **Block** (or chunk) — the slice of samples the host hands you each callback (e.g. 128 or 512 samples from an AudioWorklet). Its size is set by the audio system, not by you.
- **Frame** — one [STFT (short-time Fourier transform)](../analysis/spectrogram-stft.md) analysis window's worth of output. The analyzer may emit several frames per block, or none, depending on sizes.
- **Hop** (`hopLength`) — how far the analysis window advances between frames; it sets the frame rate, independent of the block size.
- **`nFft`** — the analysis window size; bigger means finer frequency detail, blurrier timing.

You feed **blocks**; you read **frames**. The two rates are decoupled, which is why the analyzer buffers internally.

## Progressive estimates: provisional, then stable

Musical estimates — BPM, key, current chord, progression, pattern — **update as more audio arrives**. The first second of a stream does not contain enough evidence for a confident BPM, so early values should be shown as provisional (or hidden) and allowed to revise. Treating the first frame as final is the classic streaming mistake.

## Quantized reads

Frames accumulate in a buffer between your `process()` calls. `process()` appends samples, synchronously runs the FFT and enabled per-frame features for each complete frame, and updates the progressive estimates. `readFrames(...)` only consumes frames that have already been published; it does not start analysis. Drain whatever is available rather than expecting one frame per block, and keep copying or rendering on the consumer side. The API uses "quantized" for optional 8-bit / 16-bit output formats; that is about reducing data size, not about timing.

::: details How libsonare streams analysis
`StreamAnalyzer` is constructed once with `sampleRate`, `nFft`, `hopLength`, `nMels`, and `compute*` flags, then fed blocks via `process()`.

| Call | Role |
|------|------|
| `process(block)` | Appends samples, analyzes complete frames synchronously, and updates progressive estimates |
| `readFrames(availableFrames())` | Drains the buffered mel/chroma/onset/spectral frames |
| `stats()` | Returns BPM/key/chord/progression/pattern estimates. `updated` is `true` on the periodic frames where the key or BPM estimate was recomputed — not only where the recomputed value differs from the previous one — so do not use it as a change detector |
| `emitEveryNFrames` | Throttles frame output for UI rendering |

Its default sample rate is 44100 Hz (vs the batch analyzer's 22050) because realtime audio arrives from playback/capture graphs at 44100/48000. It reuses the same STFT-derived feature stages as offline analysis.

The constructor reserves working and pending-output storage for ordinary callback blocks. The current setup reserves capacity for 16,384 input samples (or `nFft` when it is larger), covering common 128–2,048-sample callbacks. A larger one-shot chunk can grow the sanitization, resampling, or overlap buffers. For a hard realtime callback, construct and configure the analyzer outside the callback, then feed it bounded blocks from a streaming source; `process()` is the analysis step, not a cheap queueing call.
:::

Related: [Realtime and Streaming](../../realtime-streaming.md), [Spectrogram and STFT](../analysis/spectrogram-stft.md), [Realtime Engine](./realtime-engine.md), [Realtime Safety](./realtime-safety.md)
