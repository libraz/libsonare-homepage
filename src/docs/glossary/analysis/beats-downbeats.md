---
title: Beats and Downbeats
description: Beat tracking, dynamic programming, meter phase, and downbeats — how libsonare places musical pulses on the timeline.
---

# Beats and Downbeats

**Beats** are the perceived pulse positions in the music. **Downbeats** are the first beat of a bar: the stronger "one" that anchors meter. libsonare exposes both beat and downbeat detection as time arrays.

## Beat, downbeat, and bar

A **beat** is a single pulse: what you tap your foot to.

A **bar** groups a fixed number of beats, and the **time signature** says how many. In 4/4, a bar has four beats.

The **downbeat** is the first beat of each bar, the accent you feel as the start of the cycle. Beat tracking gives you the grid; downbeat detection tells you where the grid *starts repeating*. That is what you align loops, lyrics, and sections to.

## Why beats are not just tempo ÷ meter

You might expect beats to be trivial once the tempo is known: divide the timeline evenly. Real music makes that unreliable:

- tempo can drift;
- players can push or pull the beat;
- intros can be rubato;
- onset evidence can be noisy.

Beat tracking therefore solves an *optimization* problem. It tries to find beat times that line up with strong onsets **and** keep roughly steady spacing near the tempo.

Dynamic programming finds the globally best trade-off instead of greedily snapping each beat to the nearest onset and accumulating error.

## Beat tracking

Beat tracking starts from the onset-strength envelope and a tempo estimate. The tracker rewards frames with strong onset evidence and uses dynamic programming to choose a sequence whose spacing stays close to the expected beat period.

When adaptive tempo is enabled in the native configuration, the tracker can follow local period changes while still penalizing sudden jumps. This is still a pulse estimate, not a score-level transcription.

## Downbeat tracking

Downbeats are inferred after beats are placed. libsonare estimates meter phase and scores beat positions with beat strength, low-frequency energy, chord-change evidence, and a phase prior. The downbeat result is therefore more dependent on arrangement cues than raw beat tracking.

Sparse intros, pickups, weak bass, or ambiguous meter can shift the perceived "one." For UI, it is useful to show downbeats as an assistive overlay rather than as an absolute truth.

::: details How libsonare computes it
`BeatAnalyzer` computes mel onset strength, estimates BPM with `BpmAnalyzer`, and tracks beats with a dynamic program over candidate frames. It then refines downbeats with `DownbeatObservations` using onset strength, low-frequency energy, chord changes, and meter phase. Public helpers such as `detectBeats` and `detectDownbeats` return `Float32Array` / float-array time lists in seconds.
:::

Related: [Onset Detection](./onset-detection.md), [Tempo and BPM](./tempo-bpm.md), [Chord Recognition](./chord-recognition.md)
