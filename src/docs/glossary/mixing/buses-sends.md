---
title: Buses and Sends
description: Buses, the master/aux/submix roles, pre- vs post-fader sends, FX buses, and VCA groups — how libsonare routes and groups signals.
---

# Buses and Sends

A mixer is not just strips. It is a **routing graph** that sums and groups them.

**Buses** are the shared destinations. **Sends** are the taps that send signal to them.

Getting these two right is what turns a pile of strips into a controllable mix. This page grounds the routing model in libsonare's `Bus` and send processors; for the gentler intro see [Mixing Basics](../concepts/mixing-basics.md).

## Buses: master, aux, submix

A **bus** is a destination that sums several signals. libsonare gives a bus a **role**:

- **Master** — the final stereo output everything eventually reaches.
- **Aux** — the return for sends, where a shared effect (one reverb, one delay) lives.
- **Submix** — a group that collects related tracks (all the drums) so you can process and ride them as one.

A compressor on a drum submix glues the kit together; one fader then controls the whole kit. The master is special only in that it is the last bus in the graph.

## Sends: parallel copies

An **insert** processes a track *in series* — the whole track passes through it. A **send** is different: it routes a *copy* of the track *in parallel* to a bus. Use sends for effects several tracks share, so a vocal, snare, and guitar can all sit in one reverb space without each carrying its own reverb.

## Pre-fader vs post-fader

A send taps either **before** the fader or **after** it, and this is the routing decision people most often get wrong:

| Tap | Follows the fader? | Use for |
|-----|--------------------|---------|
| Pre-fader | No | Headphone/cue mixes, effects that should stay constant while you ride the fader |
| Post-fader | Yes | Reverb/delay that should stay proportional to the balance |

## VCA groups vs submixes

A **submix** re-routes audio: the grouped tracks actually flow through the submix bus. A **VCA group** does not — it is a single fader that trims several tracks' levels at once *without* changing where their audio goes. Use a VCA when the parts must still reach different buses but you want one hand on their combined level.

::: details How libsonare models routing
Buses are `Bus` objects carrying a `BusRole` (`master`/`aux`/`submix`) and run a `BusProcessor`; `FxBus` hosts shared effects. A `SendProcessor` taps a strip at a `TapPoint` chosen by `SendTiming` (pre/post-fader) and feeds a destination bus. `VcaGroup` applies a shared gain offset across member strips without re-routing audio. The whole graph — strips, buses, sends, connections — is described by a serializable scene and runs with plugin-delay compensation so parallel paths stay time-aligned. See [Mixing Scene JSON](../../mixing-scene-json.md) for the field-level format.
:::

Related: [Mixing Basics](../concepts/mixing-basics.md), [Channel Strip](./channel-strip.md), [Automation and Metering](./automation-metering.md), [Mixing Scene JSON](../../mixing-scene-json.md)
