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

<SonareDemo id="downbeat-tracking" />

## Why beats are not just tempo ÷ meter

You might expect beats to be trivial once the tempo is known: divide the timeline evenly. Real music makes that unreliable:

- tempo can drift;
- players can push or pull the beat;
- intros can be rubato (played with free, elastic timing);
- onset evidence can be noisy.

Beat tracking therefore solves an *optimization* problem. It tries to find beat times that line up with strong onsets **and** keep roughly steady spacing near the tempo.

Dynamic programming finds the globally best trade-off instead of greedily snapping each beat to the nearest onset and accumulating error.

## Beat tracking

Beat tracking starts from the onset-strength envelope and a tempo estimate. The tracker rewards frames with strong onset evidence and uses dynamic programming to choose a sequence whose spacing stays close to the expected beat period.

When adaptive tempo is enabled in the native configuration, the tracker can follow local period changes while still penalizing sudden jumps. This is still a pulse estimate, not a score-level transcription.

## Downbeat tracking

Downbeats are inferred after beats are placed. libsonare estimates [meter](./meter-and-grouping.md) phase and scores beat positions with beat strength, low-frequency energy, and a phase prior. The downbeat result is therefore more dependent on arrangement cues than raw beat tracking.

Chord-change evidence is a fourth cue, but it only becomes available once chords are known. The whole-track analysis path detects chords and then refines the downbeats a second time with that evidence; the standalone `detectDownbeats` helper never reaches that stage. Run the full music analysis when downbeat placement matters and the harmony is the clearest cue in the arrangement.

Sparse intros, pickups (notes that lead in before the first downbeat), weak bass, or ambiguous meter can shift the perceived "one." For UI, it is useful to show downbeats as an assistive overlay rather than as an absolute truth.

## The evidence behind the decision

The evidence the downbeat pass scores is published as `AnalysisResult.beatObservations`, so a caller doing its own meter or accent work scores what the library scores instead of rebuilding a weaker approximation. Each non-empty stream holds one value per beat and indexes in parallel with `beats`: `onsetStrength`, `lowFrequencyEnergy` (the accent evidence a log-spectral difference discards, empty when the analysis ran without audio), and `chordChange` (empty until chords are analyzed). An empty stream means the analysis could not produce it, which is not the same as every beat having scored zero.

::: warning `beat.strength` and `beatObservations.onsetStrength` are not the same measurement
A beat's own `strength` is the onset envelope sampled at that beat's single frame. It is raw and unbounded, its scale depends on the material, and it moves with any jitter in the beat position — so it does not compare across tracks and it is a noisy accent cue.

`onsetStrength` is the same envelope aggregated over a window around the beat, and it is the value the library's own downbeat pass scores. Use it for accents, and keep `strength` for the diagnostic it is.
:::

::: details How libsonare computes it
`BeatAnalyzer` computes mel onset strength, estimates BPM with `BpmAnalyzer`, and tracks beats with a dynamic program over candidate frames. It then refines downbeats with its internal `DownbeatObservations` using onset strength, low-frequency energy, and meter phase; the chord-change term is left empty at that point, and `MusicAnalyzer` calls the refinement again with it once chord detection has run. The public `beatObservations` carries the same three streams out of the analysis — it is the result surface, not that internal struct. Public helpers such as `detectBeats` and `detectDownbeats` return `Float32Array` / float-array time lists in seconds and stop at the first, chordless refinement.
:::

Related: [Onset Detection](./onset-detection.md), [Tempo and BPM](./tempo-bpm.md), [Chord Recognition](./chord-recognition.md)
