---
title: Realtime Safety
description: The audio callback, why allocation and locks are forbidden, denormal guards, and the AudioWorklet — what "real-time-safe" means and how libsonare achieves it.
---

# Realtime Safety

"Real-time-safe" is the property that lets the same libsonare DSP run inside a live audio callback without glitching. It is not a feature you turn on — it is a set of rules the audio path must never break. This page explains those rules and how libsonare honors them; for the streaming APIs see [Realtime and Streaming](../../realtime-streaming.md).

## The audio callback has a deadline

Audio is delivered in blocks on a high-priority thread, and each block must be filled *before* the speaker needs it. The time you have is the block's own duration, block size divided by sample rate:

| Block size | At 44.1 kHz | At 48 kHz |
|-----------:|------------:|----------:|
| 128 frames | 2.9 ms | 2.7 ms |
| 256 frames | 5.8 ms | 5.3 ms |
| 512 frames | 11.6 ms | 10.7 ms |
| 1024 frames | 23.2 ms | 21.3 ms |

In a browser the block is fixed: an AudioWorklet's `process()` is called with a **render quantum** of 128 frames, so the budget is under 3 ms. Native audio APIs let the host pick a size, usually 64–1024 frames. The delay a listener hears is longer than one block, because the system also queues buffers on the way to the device (in a browser, `AudioContext.baseLatency` plus `outputLatency`); see [Audio Basics](../concepts/audio-basics.md#latency).

Miss that deadline once and you get an audible click, pop, or dropout. So the callback has a hard real-time deadline, and anything that *might* take an unbounded amount of time is forbidden inside it.

<CallbackBudgetFigure
  title="A budget, and one block that overruns"
  caption="Average speed is not the property that matters here. Every block has the same fixed budget, and normal blocks finish with headroom to spare — but a single wait on a mutex or an allocator blows through one deadline, the buffer is not ready, and the listener hears it. That is why the forbidden list is about operations whose cost is unbounded rather than operations that are merely slow."
/>

## What is forbidden in the callback

| Forbidden | Why it breaks audio |
|-----------|---------------------|
| Memory allocation (`new`/`malloc`) | Can block for an unpredictable time |
| JavaScript allocation in an AudioWorklet (new arrays, objects, closures, a `postMessage` per block) | Feeds the garbage collector, whose pauses land on the audio thread |
| Locks / mutexes | Can stall waiting for another thread |
| File / network I/O | Unbounded latency |
| Anything unbounded | A single overrun misses the deadline |

The discipline is: do all the slow work (allocation, file loading, setup) *outside* the callback, then let the callback only read and process pre-built buffers. In JavaScript that means reusing the same typed arrays every block, for example through `Mixer.createRealtimeBuffer()` or the `...Into(...)` methods that write into arrays you allocated once.

## Passing data without a lock: the ring buffer

The audio thread still has to receive commands (a fader move) and send results back (meter values). It does that through a **ring buffer**: a fixed-size array with a write position and a read position that wrap around at the end. With one writer and one reader (single-producer, single-consumer, SPSC), each side only moves its own position, so neither ever waits for the other. When the ring is full the writer drops the item or reports it rather than blocking, which is why libsonare's queues expose overflow counters such as `droppedRecords`. libsonare's command queue, telemetry and meter queues, and the AudioWorklet's shared rings all work this way, and a single-consumer queue must be drained by only one reader.

## How libsonare stays safe

libsonare's realtime path follows the callback rules in a few concrete ways:

| Technique | Why it matters |
|-----------|----------------|
| Pre-allocated buffers for the configured block size | Ordinary blocks avoid allocator work after setup |
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
The mixer strips, buses, and `RealtimeEngine` use pre-allocated buffers (including `Mixer.createRealtimeBuffer()` for per-block reuse), lock-free parameter changes, denormal guards, parameter smoothers for click-free moves, and plugin-delay compensation so parallel paths stay aligned. `StreamAnalyzer` also pre-allocates its FFT, feature, and pending-output storage for ordinary bounded blocks, but `process()` synchronously computes the FFT, enabled features, and progressive estimates. Larger input chunks can grow its sanitization, resampling, or overlap buffers. For a hard realtime callback, construct and configure it outside the callback, feed it stable blocks from a streaming source, and drain frames on the consumer side. State that must cross threads is moved through lock-free channels and surfaced as telemetry rather than read directly. The same DSP implementation can run offline or in an AudioWorklet when its configured block work fits the callback deadline.
:::

Related: [Realtime and Streaming](../../realtime-streaming.md), [Streaming Analysis](./streaming-analysis.md), [Realtime Engine](./realtime-engine.md), [Browser Local Processing](../concepts/browser-local-processing.md)
