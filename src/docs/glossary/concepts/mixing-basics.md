---
title: Mixing Basics
description: The vocabulary of mixing — tracks and strips, faders and gain staging, pan, inserts vs sends, buses, automation, and metering — explained for newcomers before they touch the libsonare mixing API.
---

# Mixing Basics

**Mixing** is the craft of taking several recorded parts and balancing them into one stereo whole that sounds intentional: every element audible, nothing fighting, a sense of front-to-back depth and left-to-right space. This page defines the words you need before reading the [Mixing Engine](../../mixing.md) guide. It is concepts only — no code.

::: tip Where mixing sits
You usually **edit** individual parts (timing, pitch, noise), then **mix** them together, then **master** the finished stereo file for delivery. Mixing is the middle step that turns a folder of separate stems into a balanced song. Get the balance right here and mastering becomes a polish, not a rescue.
:::

## Tracks and channel strips

A **track** is one recorded part: a lead vocal, a bass DI, a stereo drum overhead pair. In a mixer, each track flows through a **channel strip** — a vertical lane of controls that processes just that part. The whole art of mixing is setting each strip so the parts combine well, then routing them to a common output.

## Level: trim, fader, and gain staging

There are two level controls on a strip and they do different jobs:

- **Input trim** sets a sensible *working* level on the way in, before any processing. Recordings arrive at wildly different volumes; trim evens them out so the processors that follow see a healthy signal.
- **Fader** is the *balance* control you ride against the other tracks: vocal forward, music back.

Keeping levels sensible at every stage — not too quiet (noisy), not too hot (clipping) — is called **gain staging**, and it is the single most important habit in mixing. See [Gain Staging](./gain-staging.md).

## Pan: placing sound left to right

**Pan** positions a track across the stereo field, from hard left to hard right. Spreading parts out gives each room to breathe instead of stacking in the center. Two refinements matter:

- **Pan mode** decides *how* a position maps to the channels — a true pan that moves a mono source, a balance control that just turns one side of a stereo track down, or independent left/right positioning.
- **Pan law** decides *how loud* the center is relative to the sides, so a part does not jump in volume as you pan it.

## Inserts vs sends

This is the distinction beginners most often miss, and it is simple once named:

- An **insert** sits *in series*: the whole track passes through it. Use inserts for processing that belongs to that track — a compressor on the vocal, an EQ on the bass.
- A **send** routes a *copy* of the track in *parallel* to a shared destination. Use sends for effects several tracks share — one reverb fed by the vocal, the snare, and the guitar, so they all sit in the same space.

::: info Pre-fader vs post-fader
A send can tap the signal **before** the fader (independent of the balance — good for headphone/cue mixes) or **after** it (follows the balance — so an effect stays proportional as you ride the fader). Choosing the right one is a common gotcha; the [Mixing Engine](../../mixing.md#the-channel-strip-signal-by-signal) page traces exactly where each tap sits.
:::

## Buses and subgroups

A **bus** is a shared destination that sums several signals. The most important bus is the **master** — the final stereo output everything reaches. Two other common roles:

- An **aux bus** is the return for sends (your shared reverb lives here).
- A **subgroup** (or submix) collects related tracks — all the drums, say — so you can process and ride them as one. A compressor on the drum subgroup glues the kit together; one fader controls the whole kit's level.

A **VCA group** is a related idea: a single fader that trims several tracks at once *without* re-routing their audio, useful when the parts must still flow to different buses.

## Automation

A static mix is rarely the best mix. **Automation** lets a control change over time: push the vocal up half a dB in the chorus, fade the synth out over four bars, open a filter on a riser. The control follows a curve between the points you set — a straight ramp, an eased S-curve, or an instant jump. This is how a mix breathes instead of sitting still.

## Metering: trusting your eyes as well as your ears

Ears tire and rooms lie, so mixers watch meters too. The ones that matter most:

- **Peak / true peak** — the highest level; [true peak](../true-peak.md) catches inter-sample overs your sample meter misses.
- **RMS / LUFS** — average level and perceived [loudness](../lufs.md), which is what listeners actually judge.
- **Correlation** — whether the left and right channels agree; strongly negative values warn that the mix may weaken or cancel in [mono](./mono-compatibility.md).

:::: details How libsonare models all of this
libsonare's mixing engine maps these concepts to concrete objects: a *strip* is a `ChannelStrip` with input trim, EQ, fader, pan, width, inserts, and sends in a fixed signal order; a *bus* carries a `master`/`aux`/`submix` role; a *send* taps pre- or post-fader; *automation* is scheduled at sample-accurate positions with `linear`/`exponential`/`s-curve`/`hold` curves; and every strip exposes a meter snapshot plus a goniometer history buffer. A whole mixer is described by a JSON *scene* you can save and reload. The engine is real-time-safe — denormal-guarded, lock-free parameter changes, pre-allocated buffers, and plugin-delay compensation across the routing graph — so the same model runs offline and inside an AudioWorklet.
::::

Related: [Mixing Engine](../../mixing.md), [Mixing Scene JSON](../../mixing-scene-json.md), [Gain Staging](./gain-staging.md), [Mono Compatibility](./mono-compatibility.md), [Audio Basics](./audio-basics.md)
