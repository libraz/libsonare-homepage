---
title: Takes and Comping
description: What takes and comping mean in a DAW — recording a part several times and stitching the best moments into one performance — explained for beginners, then connected to libsonare's clip and edit-compiler model.
---

# Takes and Comping

Almost no great recorded performance is a single perfect pass. The singer nails the first verse on take 2 but the chorus on take 5; the guitar solo has a brilliant opening from one attempt and a clean ending from another. **Takes** and **comping** are the two ideas that let you keep the best of everything.

::: info Two words, defined
A **take** is one recorded attempt at a part. **Comping** (from *compositing*) is assembling a single final performance out of the best moments across several takes.
:::

## What a take is

When you record a part, that one pass is a **take**. Record it again and you have a second take. Rather than scattering these across the project, libsonare stores the takes *inside a single clip*. The clip keeps a list of takes, and exactly one of them is the **active take** — the one you currently hear when the clip plays.

This is convenient because the takes stay aligned: they share the same start position on the timeline, so switching the active take instantly auditions a different attempt of the same part without anything moving out of place.

## Loop recording: collecting takes fast

The fastest way to gather takes is **loop recording**. You set a loop region — say one verse — and the transport keeps cycling around it while you keep performing. Every time around the loop captures a **new take** into the clip. Ten passes around the loop give you ten takes stacked in one clip, ready to be comped.

::: tip Why this beats recording into separate clips
Because all the takes live in one clip on one track, they are pre-aligned and easy to compare. You are not juggling ten clips on ten lanes; you are flipping through alternatives in place.
:::

## Comping: building the best performance

Once you have several takes, you rarely want just one of them start to finish. **Comping** lets you choose, *for each segment of time*, which take plays.

You divide the clip's timeline into segments and assign a take to each. The first phrase plays from take 2, the next from take 5, the last from take 1 — and the result sounds like one flawless performance that never actually happened in a single pass.

Visually, comping looks like a stack of take "lanes" with a chosen path running through them:

```
time  ──────────────────────────────────────────►
take 1 │░░░░░░│      │      │██████████████████████│   ← end kept
take 2 │██████████████│      │      │░░░░░░░░░░░░░░░│   ← opening kept
take 3 │░░░░░░│██████████████│      │░░░░░░░░░░░░░░░│   ← middle kept
       └──────┴──────────────┴──────┴──────────────┘
comp:    take2     take3      gap        take1
```

Each filled block is a **comp segment**: a start time, an end time, and the id of the take that plays there. Together the segments form the **comp lane** — the recipe for the final performance.

<SonareDemo id="comping" />

## Why comping matters

| Part | Why comping helps |
|------|-------------------|
| Lead vocals | Pitch, timing, and emotion rarely peak in the same pass — comp the best line readings together |
| Solos | Keep an inspired phrase from one take and a clean landing from another |
| Spoken / voiceover | Splice the clearest delivery of each sentence without re-recording |

Comping is a non-destructive edit: the takes themselves are untouched. You are only describing *which* take to play *when*, so you can re-comp freely until it feels right.

::: warning Comping is not crossfading by hand
A comp describes which take owns each time segment; it is a higher-level structure than dragging audio regions and crossfading them yourself. Boundaries between comp segments are where you would normally want short fades — keep that in mind when a switch between takes is audible.
:::

::: details How libsonare implements this
Takes and comps are stored on the clip in the `Project` editing model. A clip carries a take list and an active take id, set with `setClipTakes(clipId, takes, activeTakeId?)` where each take is `{ id, sourceId?, sourceOffsetPpq?, name? }`. The comp lane is set with `setClipCompSegments(clipId, segments)`, each segment being `{ startPpq, endPpq, takeId? }` in quarter-note units (floats; 1.0 = one quarter note). Loop recording is captured in one call: `addLoopRecordingTakes({ trackId, loopLengthPpq, audio, ... })` slices the captured buffer at the loop boundary and adds the takes to a clip, returning `{ clipId, takeCount }`. When the project is compiled, the edit compiler renders the comp segments by reading each segment from its assigned take across the take list. Everything round-trips through project JSON via `toJson()` / `Project.fromJson(json)`, so a comp survives save and reload.
:::

Related: [Recording and Takes](../../recording-and-takes.md), [Clips and Tracks](./clips-and-tracks.md), [Project Editing](../../project-editing.md)
