---
title: Realtime Engine
description: Transport, clip scheduling, the metronome, automation playback, and telemetry — what libsonare's RealtimeEngine does beyond analysis.
---

# Realtime Engine

Where `StreamAnalyzer` *listens*, the **`RealtimeEngine`** *plays*.

It is the transport-and-playback side of libsonare's realtime surface. It handles tempo, clip scheduling, a metronome, automation, and metering telemetry.

Use it when you are building a playback engine rather than just a live analyzer. For the API, see [Realtime and Streaming](../../realtime-streaming.md).

## Transport: the playhead and tempo

**Transport** is the playback clock — play/stop/seek, the current position, loop points, and the tempo that everything else is timed against. A clip scheduled "at bar 5" or an automation point "two beats in" only has meaning relative to the transport, so the transport is the shared timeline the whole engine reads from.

## Clips and scheduling

The engine plays **clips** — buffers of audio placed on the timeline at scheduled positions. Scheduling means deciding *when* a clip starts and stops relative to the transport, so playback can be assembled from many pieces rather than one continuous stream. This is how an arrangement, a backing track, or a rhythm-game chart is driven.

<SonareDemo id="engine-lane-mixer" />

## Metronome

A **metronome** generates click events locked to the transport's tempo and meter — useful for monitoring, recording, and lining up performance. Because it is derived from the same transport clock, it stays in sync with clips and automation automatically.

## Telemetry: watching a realtime graph

You cannot inspect a realtime audio callback with a debugger without breaking timing. Instead the engine emits **telemetry** — periodic snapshots of meters and state — that your UI reads on a normal (non-audio) thread. This keeps the audio path untouched while still letting you draw level meters, a goniometer, or transport state.

::: details How libsonare models the engine
`RealtimeEngine` (driven by `EngineController`) owns the transport, schedules clips through `ClipPlayer`/`ClipSchedule` over `ClipAudioBuffer` storage, generates clicks with `Metronome` (`MetronomeConfig` → `MetronomeEvent`), and plays automation back on the mixer graph. Metering is surfaced through a `MeterTelemetryTap` producing `MeterTelemetryRecord`s and a general `Telemetry` channel (`TelemetryType`/`TelemetryErrorCode`) that a UI reads off the audio thread. The whole engine is real-time-safe and runs the same offline (bounce) and inside an AudioWorklet, including freeze and capture paths.
:::

Related: [Realtime and Streaming](../../realtime-streaming.md), [Streaming Analysis](./streaming-analysis.md), [Realtime Safety](./realtime-safety.md), [Automation and Metering](../mixing/automation-metering.md)
