---
title: Realtime Safety
description: The audio callback, why allocation and locks are forbidden, denormal guards, and the AudioWorklet — what "real-time-safe" means and how libsonare achieves it.
---

# Realtime Safety

"Real-time-safe" is the property that lets the same libsonare DSP run inside a live audio callback without glitching. It is not a feature you turn on — it is a set of rules the audio path must never break. This page explains those rules and how libsonare honors them; for the streaming APIs see [Realtime and Streaming](../../realtime-streaming.md).

## The audio callback has a deadline

Audio is delivered in blocks on a high-priority thread, and each block must be filled *before* the speaker needs it — often within a couple of milliseconds. Miss that deadline once and you get an audible click, pop, or dropout. So the callback has a hard real-time deadline, and anything that *might* take an unbounded amount of time is forbidden inside it.

## What is forbidden in the callback

| Forbidden | Why it breaks audio |
|-----------|---------------------|
| Memory allocation (`new`/`malloc`) | Can block for an unpredictable time |
| Locks / mutexes | Can stall waiting for another thread |
| File / network I/O | Unbounded latency |
| Anything unbounded | A single overrun misses the deadline |

The discipline is: do all the slow work (allocation, file loading, setup) *outside* the callback, then let the callback only read and process pre-built buffers.

## How libsonare stays safe

libsonare's realtime path follows the callback rules in a few concrete ways:

| Technique | Why it matters |
|-----------|----------------|
| Pre-allocated buffers | No allocation happens per audio block |
| Lock-free parameter updates | UI changes do not stall the audio thread |
| Parameter smoothing | Control changes do not click |
| Denormal guards | Tiny floating-point tail values do not spike CPU |

Together these let the same DSP code run offline and live.

## The AudioWorklet

In the browser, real-time audio runs in an **AudioWorklet**. This is a dedicated audio-thread context separate from the main thread.

The intended pattern is:

1. Prepare objects on the main thread.
2. Move the prepared work into the AudioWorklet.
3. Process blocks there without allocating.

The site runs this path SAB-free: it does not require `SharedArrayBuffer`, so it does not need special COOP/COEP headers.

::: details How libsonare implements realtime safety
The mixer strips, buses, `RealtimeEngine`, and `StreamAnalyzer` share a real-time-safe core: pre-allocated buffers (including `Mixer.createRealtimeBuffer()` for per-block reuse), lock-free parameter changes, denormal guards, parameter smoothers for click-free moves, and plugin-delay compensation so parallel paths stay aligned. State that must cross threads is moved through lock-free channels and surfaced as telemetry rather than read directly. The same DSP therefore runs in offline rendering and inside a browser AudioWorklet without code changes.
:::

Related: [Realtime and Streaming](../../realtime-streaming.md), [Streaming Analysis](./streaming-analysis.md), [Realtime Engine](./realtime-engine.md), [Browser Local Processing](../concepts/browser-local-processing.md)
