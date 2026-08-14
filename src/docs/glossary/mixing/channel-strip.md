---
title: Channel Strip
description: The channel strip signal order — trim, polarity, delay, EQ, inserts, fader, pan, width, and sends — and why the order decides what every control does.
---

# Channel Strip

A **channel strip** is one track's lane in the mixer. It is the column of controls that processes a single part, such as a vocal, bass, or drum bus, before it reaches the master.

<SonareDemo id="engine-lane-mixer" />

The processing order matters. Once you know the order, it becomes much easier to predict what every control does.

This page goes deeper than [Mixing Basics](../concepts/mixing-basics.md) and grounds the model in libsonare's `ChannelStrip`.

## The fixed signal order

libsonare processes each block of a strip in one fixed order. Reading it top to bottom explains most "why did that control behave like that?" questions:

1. **Input trim** — a clean level adjustment on the way in, before anything else sees the signal.
2. **Polarity invert (L/R)** — flips the waveform; used to fix phase between mics or channels.
3. **Channel delay** — time-aligns the track against others (sample- or millisecond-accurate).
4. **EQ** — tone shaping; its position can be pre- or post-fader (see below).
5. **Pre-fader inserts** — in-series processors that run before the fader.
6. **Fader (+ VCA offset)** — the balance control you ride against other tracks.
7. **Pan** — places the track across the stereo field, using the chosen pan law.
8. **Post-fader inserts** — in-series processors after the fader.
9. **Stereo width** — narrows or widens the stereo image.
10. **Meter / goniometer tap** — measurement, not processing.

## Why the order matters

The order is not cosmetic. It changes what each processor hears.

| Placement | What happens |
|-----------|--------------|
| Compressor before the fader | It reacts to the raw level and keeps reacting the same way as you move the fader |
| Compressor after the fader | It reacts to your balance moves |
| Pre-fader send | It taps before the fader, so it is independent of the mix balance |
| Post-fader send | It follows the fader, so the effect stays proportional as you ride the level |

Picking the wrong tap point is one of the most common routing mistakes.

## EQ position

EQ can sit pre- or post-fader. Pre-fader EQ shapes the tone the inserts and fader then act on; post-fader EQ shapes the already-balanced signal. libsonare exposes this as a strip option rather than forcing one choice.

## Cue monitoring: PFL and AFL

Sometimes you need to hear one track in isolation without disturbing the mix everyone else is hearing — checking a vocal for breath noise before a show, or auditioning a track while the room keeps listening to the main output. That is **cue monitoring**: a separate tap that feeds a headphone or monitor bus alongside the regular mix, not instead of it.

**PFL** (pre-fader listen) taps the signal after the lane strip but before the lane's fader, gate, and pan, so a PFL cue stays audible even when the track is muted, gated, or panned away — useful for checking a source's raw content regardless of where the fader sits. **AFL** (after-fader listen) taps after those stages instead, including the surround path, so it reflects the same level and placement the track is actually contributing to the mix.

::: details How libsonare schedules a cue tap
Cue monitoring is a queueable realtime command: `setTrackMonitorMode(laneIndex, mode, renderFrame?)` on `RealtimeEngine` (`EngineTrackMonitorMode` = `'off' | 'pfl' | 'afl'`), mirrored in the C ABI as `sonare_engine_set_track_monitor_mode` (`SonareEngineTrackMonitorMode`) and exposed in Python as `set_track_monitor_mode`. It is reachable from the WASM AudioWorklet path the same as any other engine command, and the monitor bus is folded into the engine's regular output while also being readable on its own.
:::

::: details How libsonare models a strip
A strip is a `ChannelStrip` configured by `ChannelStripConfig`, processing a block through trim, polarity, channel delay, EQ (`EqPosition` chooses pre/post-fader), pre-fader `InsertSlot`s, fader with VCA offset, `PannerProcessor` (`PanLaw`/`PanMode`), post-fader inserts, and `StereoWidthProcessor`, in that order. `TapPoint` marks where pre- and post-fader sends and the `GoniometerBuffer`/`MeterProcessor` read the signal. All gain and pan changes are parameter-smoothed and the path is real-time-safe (pre-allocated, denormal-guarded), so the same strip runs offline and inside an AudioWorklet.
:::

Related: [Mixing Basics](../concepts/mixing-basics.md), [Buses and Sends](./buses-sends.md), [Pan and Stereo Width](./pan-width.md), [Realtime Engine](../realtime/realtime-engine.md), [Mixing Engine](../../mixing.md)
