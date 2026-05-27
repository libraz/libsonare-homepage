---
title: Automation and Metering
description: Automation lanes, curve types, goniometer, correlation, and true-peak metering — how a libsonare mix moves over time and how you watch it.
---

# Automation and Metering

A static mix is rarely the best mix, and ears alone are not enough to trust one. **Automation** lets controls move over time; **metering** lets you watch the result with your eyes as well as your ears. This page grounds both in libsonare's automation and meter processors; for the basics see [Mixing Basics](../concepts/mixing-basics.md).

## Automation: a mix that breathes

**Automation** records how a control changes over time — push the vocal up half a dB in the chorus, fade a synth out over four bars, open a filter on a riser. Each control follows a **curve** between the points you set, and the curve shape changes the feel:

| Curve | Motion |
|-------|--------|
| Linear | A straight ramp between points |
| Exponential | Fast-then-slow (or slow-then-fast) — natural for fades |
| S-curve | Eased at both ends — smooth, musical transitions |
| Hold | Jumps instantly and stays until the next point |

Automation can target faders, pans, sends, and insert parameters, so the whole strip — not just level — can move.

## Metering: trusting your eyes too

Rooms lie and ears tire, so a mix is also judged on meters:

- **Peak / true peak** — the highest level; [true peak](../true-peak.md) catches inter-sample overs a plain sample meter misses.
- **RMS / LUFS** — average level and perceived [loudness](../lufs.md), which is what listeners actually judge.
- **Correlation** — whether left and right agree; strongly negative values warn the mix may weaken in [mono](../concepts/mono-compatibility.md).
- **Goniometer** — a vectorscope view of the stereo field, showing width and phase at a glance.

Meters describe; they do not decide. Use them to catch problems your ears miss, not to chase numbers.

::: details How libsonare models automation and metering
Automation is scheduled on `AutomationLane`s as sample-accurate `AutomationEvent`s with an `AutomationCurveType` (`linear`/`exponential`/`s-curve`/`hold`); an `AutomationTarget` points at a fader, pan, send, or insert parameter, and `InsertAutomationLane` automates inside an insert. Metering uses a `MeterProcessor` (`MeterConfig`) for peak/true-peak/RMS/LUFS and correlation, plus a `GoniometerBuffer` of `GoniometerPoint`s for the vectorscope. All of this is real-time-safe, so automation plays back and meters update both offline and inside an AudioWorklet, with engine-side telemetry available for UI displays.
:::

Related: [Mixing Basics](../concepts/mixing-basics.md), [Channel Strip](./channel-strip.md), [True Peak](../true-peak.md), [Reading Mastering Meters](../mastering/meter-reading.md)
