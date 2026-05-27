---
title: Streaming Analysis
description: Blocks, frames, hops, progressive estimates, and quantized reads — how libsonare's StreamAnalyzer turns a live audio stream into UI-ready features.
---

# Streaming Analysis

Offline analysis sees the whole file at once. **Streaming analysis** sees the audio a chunk at a time and must produce results *as it goes*.

libsonare's `StreamAnalyzer` runs the same MIR pipeline incrementally. It emits per-frame features and progressive musical estimates for visualizers and live displays.

This page explains the streaming model. For the API recipe, see [Realtime and Streaming](../../realtime-streaming.md).

## Block, frame, hop — not the same thing

Four words are easy to confuse, and mixing them up causes most streaming bugs:

- **Block** (or chunk) — the slice of samples the host hands you each callback (e.g. 128 or 512 samples from an AudioWorklet). Its size is set by the audio system, not by you.
- **Frame** — one STFT analysis window's worth of output. The analyzer may emit several frames per block, or none, depending on sizes.
- **Hop** (`hopLength`) — how far the analysis window advances between frames; it sets the frame rate, independent of the block size.
- **`nFft`** — the analysis window size; bigger means finer frequency detail, blurrier timing.

You feed **blocks**; you read **frames**. The two rates are decoupled, which is why the analyzer buffers internally.

## Progressive estimates: provisional, then stable

Musical estimates — BPM, key, current chord, progression, pattern — are **progressive**: they refine as more audio arrives. The first second of a stream does not contain enough evidence for a confident BPM, so early values should be shown as provisional (or hidden) and allowed to revise. Treating the first frame as final is the classic streaming mistake.

## Quantized reads

Frames accumulate in a buffer between your `process()` calls. You drain whatever is available and render it, rather than expecting one frame per block. This **quantized read** model keeps the audio callback cheap (it just buffers) and moves the variable-rate frame handling to your UI loop, where jitter is harmless.

::: details How libsonare streams analysis
`StreamAnalyzer` is constructed once with `sampleRate`, `nFft`, `hopLength`, `nMels`, and `compute*` flags, then fed blocks via `process()`; `readFrames(availableFrames())` drains buffered mel/chroma/onset/spectral frames, and `stats()` returns progressive BPM/key/chord/progression/pattern estimates with an `updated` flag. Its default sample rate is 44100 Hz (vs the batch analyzer's 22050) because realtime audio arrives from playback/capture graphs at 44100/48000. `emitEveryNFrames` throttles frame output for UI rendering. It reuses the same STFT-derived feature stages as offline analysis.
:::

Related: [Realtime and Streaming](../../realtime-streaming.md), [Spectrogram and STFT](../analysis/spectrogram-stft.md), [Realtime Engine](./realtime-engine.md), [Realtime Safety](./realtime-safety.md)
