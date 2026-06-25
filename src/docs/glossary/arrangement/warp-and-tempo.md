---
title: Warp and Tempo Sync
description: How warping makes an audio clip follow the project tempo — off, repitch, and tempo-sync modes, warp anchors, and the tempo map — explained from scratch for newcomers to libsonare's editing engine.
---

# Warp and Tempo Sync

Drop a drum loop recorded at 90 BPM into a project running at 120 BPM and it will not line up — it plays at its own speed while your grid moves faster. **Warping** is the feature that makes an audio clip bend to the project's tempo so everything stays locked together.

::: info One-line definition
**Warp** = time-stretching an audio clip so it follows the project tempo instead of its own original tempo.
:::

## The tempo map: the project's grid

Before warping makes sense, you need the thing a clip warps *to*: the project's **tempo map**.

The tempo map is a list of **tempo segments**. Each segment says "from this point on the timeline, the tempo is this many BPM". A song can have one constant tempo, or many segments — a slow intro, a faster verse, a ritardando at the end. A segment can also **ramp**: glide smoothly from one BPM to another instead of jumping.

Alongside the tempo map are **time signatures** (4/4, 3/4, 6/8…), which set how many beats make a bar. Together the tempo map and the time signatures define the **musical grid** — the bars-and-beats ruler that every clip position from [Clips and Tracks](./clips-and-tracks.md) is measured against.

```
seconds  0        2        4        6        8        10
tempo    │ 90 BPM          │ ramp 90→120     │ 120 BPM        │
bars     1        2        3        4        5        6
         └ a clip warped to this map stretches to match each region
```

The grid is the thing a clip warps *to*, so it helps to see how tempo turns musical positions into seconds. Drag the tempo below and watch the bars compress or spread against a fixed seconds ruler — that is exactly the mapping a clip has to follow.

<SonareDemo id="tempo-grid" />

## The three warp modes

Every audio clip has a **warp mode** that decides *how* (or whether) it follows the grid.

::: tip off vs repitch vs tempo-sync
- **off** — no stretching. The clip plays at its native speed and pitch, ignoring the project tempo. Use this for one-shots and sound effects that should not bend.
- **repitch** — like changing the speed of a tape. The clip is sped up or slowed down to fit the tempo, and the **pitch moves with it**: faster means higher, slower means lower. Simple, CPU-cheap, and musically useful when you *want* that vintage varispeed character.
- **tempo-sync** — follow the tempo while **keeping the original pitch**. The clip is time-stretched so its timing matches the grid, but a phase vocoder holds the pitch constant. This is what you want for vocals, melodic loops, and anything where the notes must stay in tune.
:::

<SonareDemo id="time-stretch" />

| Mode | Timing follows tempo? | Pitch stays the same? | Typical use |
|------|----------------------|----------------------|-------------|
| off | No | Yes | One-shots, SFX |
| repitch | Yes | No (moves with speed) | Tape/varispeed feel, drums |
| tempo-sync | Yes | Yes | Vocals, melodic loops |

## Warp anchors: pinning the audio to the grid

A tempo change tells the clip *how fast* to play, but real performances are not perfectly even — a drummer pushes and pulls, a phrase rushes slightly. **Warp anchors** let you pin specific points inside the audio to specific points on the timeline.

Each anchor ties a position in the source audio to a position on the project timeline. The downbeat of the loop snaps to bar 1, the snare hit snaps to beat 2, and the stretching between anchors is computed automatically. With enough anchors you can straighten a loose performance onto the grid, or deliberately bend a tight one to groove.

::: warning tempo-sync is real time-stretching, with limits
Because tempo-sync changes duration while preserving pitch, it uses a phase vocoder under the hood — the same family of algorithm described in [Phase Vocoder Stretch](../editing/phase-vocoder-stretch.md). Small stretches are transparent; very large ones can smear transients or add a "phasey" quality. On stereo and multichannel clips the stretch is phase-locked across channels, so the stereo image does not drift between left and right. repitch has no such artifacts (it is just resampling) but it moves the pitch, so the two modes trade different costs.
:::

## How playback and bounce stay consistent

A subtle but important guarantee: a clip warps the *same way* whether you are auditioning it live or rendering the final file. The tempo map, the warp mode, and the anchors are part of the project's edit model, so real-time playback and the offline [bounce](../../project-bounce.md) produce matching timing and pitch. What you hear while editing is what you get on render.

::: details How libsonare implements this
Warp lives on the `Project` editing model. A clip's mode is set with `setClipWarpMode(clipId, mode)` where the mode is one of `'off' | 'repitch' | 'tempo-sync'`. Warp anchors are first-class warp maps: `setWarpMap({ id, name?, anchors })`, with each anchor as `{ warpSample, sourceSample }`, and a clip references one via `setClipWarpRef(clipId, warpRefId)` (`removeWarpMap` clears it). The grid comes from `setTempoSegments` (each `{ startPpq, bpm, endBpm? }`, where `endBpm` drives a ramp) and `setTimeSignatures` (each `{ startPpq, numerator, denominator }`). For `tempo-sync`, the stretch is performed by `StreamingPhaseVocoder` so the pitch is preserved, and the *same* path is used in both realtime playback and offline `bounce()` — `repitch`, by contrast, resamples and lets pitch track speed. All of warp mode, anchors, tempo, and time signatures round-trip through project JSON via `toJson()` / `Project.fromJson(json)`.
:::

Related: [Project Editing](../../project-editing.md), [Phase Vocoder Stretch](../editing/phase-vocoder-stretch.md), [Project Bounce](../../project-bounce.md)
