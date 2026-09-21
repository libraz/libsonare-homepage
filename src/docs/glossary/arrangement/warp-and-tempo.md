---
title: Warp and Tempo Sync
description: How warping makes an audio clip follow the project tempo — the off, repitch, tempo-sync, and time-stretch modes, warp anchors, and the tempo map — explained from scratch for newcomers to libsonare's editing engine.
---

# Warp and Tempo Sync

Drop a drum loop recorded at 90 BPM (beats per minute) into a project running at 120 BPM and it will not line up — it plays at its own speed while your grid moves faster. **Warping** is the feature that makes an audio clip bend to the project's tempo so everything stays locked together.

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

## The warp modes

Every audio clip has a **warp mode** that decides *how* (or whether) it follows the grid.

::: tip off vs repitch vs tempo-sync vs time-stretch
- **off** — no stretching. The clip plays at its native speed and pitch, ignoring the project tempo. Use this for one-shots and sound effects that should not bend.
- **repitch** — like changing the speed of a tape. The clip is sped up or slowed down to fit the tempo, and the **pitch moves with it**: faster means higher, slower means lower. Simple, CPU-cheap, and musically useful when you *want* that vintage varispeed character.
- **tempo-sync** — follow the tempo while **keeping the original pitch**. The clip is time-stretched so its timing matches the grid, but a phase vocoder — an algorithm that stretches audio in the frequency domain — holds the pitch constant. This is what you want for vocals, melodic loops, and anything where the notes must stay in tune.
- **time-stretch** — also keeps the original pitch, but produces the stretch on the audio thread. It reads the *same* anchor map as repitch and synthesizes the output by overlap-adding source segments at a fixed rate, so changing the map moves the timing and leaves the pitch where it was. Use it when the user is dragging a tempo or an anchor and the result has to be audible immediately.
:::

<SonareDemo id="time-stretch" />

| Mode | Timing follows tempo? | Pitch stays the same? | Typical use |
|------|----------------------|----------------------|-------------|
| off | No | Yes | One-shots, SFX |
| repitch | Yes | No (moves with speed) | Tape/varispeed feel, drums |
| tempo-sync | Yes | Yes | Vocals, melodic loops |
| time-stretch | Yes | Yes | Live tempo/anchor editing |

### time-stretch vs tempo-sync

Both preserve pitch, so the choice between them is not about the sound — it is about **when the stretching happens** and what that costs a host.

`tempo-sync` bakes the stretched audio on the control thread, ahead of playback. That gives the phase vocoder the whole clip to work with, but every new anchor set means a re-bake — and a `tempo-sync` clip with no warp map at all is a `compile()` error rather than a silent fallback. `time-stretch` does the work block by block on the audio thread, so a new anchor set takes effect from the very next block with nothing to re-bake.

Paying for that immediacy means living inside a fixed budget. The stretcher's voices are preallocated: **eight warped clips** can stretch at once, each handling up to **two channels**. A clip that cannot get a voice — because all eight are busy, or because its source has more channels than a voice handles — falls back to `repitch` behaviour rather than allocating on the audio thread, which means its pitch starts moving with the tempo.

::: warning Watch the fallback, it is silent
The fallback makes no sound of its own — the clip simply starts behaving like `repitch`. `warpStretchOverflowCount()` counts the blocks in which that happened, so poll it from the control thread while developing and reduce how many `time-stretch` clips overlap if it climbs.
:::

### What time-stretch does, and what it costs

`tempo-sync` stretches in the frequency domain: the phase vocoder takes the clip apart into sinusoids, moves them in time and puts them back together. `time-stretch` stays in the time domain. It cuts the source into overlapping frames of 1024 samples, lays them down at a fixed hop of 512 samples so the output always advances by the same amount, and chooses *where in the source* each frame is cut from according to the warp map. Playing faster means the cut points advance through the source faster than the output does, so frames get skipped; slower means they get repeated. Because each frame is a verbatim slice of the source, the waveform's own period — its pitch — is untouched.

Laying arbitrary slices end to end would produce clicks and cancellation wherever two overlapping frames disagree in phase. That is the WSOLA step: before cutting a frame, the stretcher searches a window of ±512 samples around the mapped position for the offset whose start best continues the frame it just emitted, so consecutive frames overlap in phase and the sum stays clean. The search is a correlation, coarse first and then refined, and it is the whole per-frame cost: a bounded number of multiply-adds on the audio thread, with no transform and no allocation.

That design sets what it costs and what it sounds like.

- **A fixed voice budget.** The stretcher's state is preallocated so the audio thread never allocates. Eight voices exist, each handling up to two channels, and a `time-stretch` clip borrows one for every block it renders. A clip that cannot get a voice — all eight busy, or a source with more than two channels — renders through `repitch` for that block, silently, and its pitch moves with the tempo. How voices are assigned and how to watch the overflow counter is on [Realtime Engine](../../realtime-engine.md#the-time-stretch-voice-budget).
- **Transients survive; dense textures can double.** A slice is the source itself, so a drum hit keeps its attack shape. On sustained, polyphonic material — a pad, a choir — a large stretch repeats or skips slices that no single offset can align for every note at once, and the result is a faint doubling or flutter rather than the phase vocoder's smear.
- **A roughly 10 ms grain.** Position is honoured to within the search radius: each frame lands within about 10 ms of where the map points, which is invisible for tempo following and only matters when lining up sample-exact edits.

Reach for `time-stretch` when the map is going to *change while audio runs* — a tempo the user is dragging, an anchor being nudged, a groove being auditioned — because the next block simply reads the new map. On the raw engine it is also the pitch-preserving mode that works with paged clips, where `tempo-sync` bakes and therefore cannot. Reach for `tempo-sync` when the map is settled and the material is sustained or harmonic, where the vocoder's whole-clip view gives the cleaner stretch.

## Warp anchors: pinning the audio to the grid

A tempo change tells the clip *how fast* to play, but real performances are not perfectly even — a drummer pushes and pulls, a phrase rushes slightly. **Warp anchors** let you pin specific points inside the audio to specific points on the timeline.

Each anchor ties a position in the source audio to a position on the project timeline. The downbeat of the loop snaps to bar 1, the snare hit snaps to beat 2, and the stretching between anchors is computed automatically. With enough anchors you can straighten a loose performance onto the grid, or deliberately bend a tight one to groove.

<WarpMapFigure
  title="Anchors pin, the spans between them stretch"
  :labels="{ marker: 'warp anchor' }"
  caption="An anchor fixes one point in the source to one point on the timeline. Whatever audio sits between two anchors is fitted to whatever distance the grid gives it, so a rushed phrase gets stretched and a dragging one gets compressed — inside the same clip, with no edit to the source file."
/>

::: tip Your app owns the anchors
The engine reads anchors, it does not invent them. Each anchor is an absolute pair of sample positions, so a clip bends to the grid exactly as far as the map you supplied says — and editing the tempo map afterwards does not rewrite it. A host that lets the user change tempo has to recompute the anchors and push a new warp map. A map with fewer than two anchors describes no stretch at all: a `repitch` or `time-stretch` clip then plays at its native rate, and a `tempo-sync` clip fails to compile.
:::

::: warning tempo-sync is real time-stretching, with limits
Because tempo-sync changes duration while preserving pitch, it uses a phase vocoder under the hood — the same family of algorithm described in [Phase Vocoder Stretch](../editing/phase-vocoder-stretch.md). Small stretches are transparent; very large ones can smear transients or add a "phasey" quality. On stereo and multichannel clips the stretch is phase-locked across channels, so the stereo image does not drift between left and right. repitch has no such artifacts (it is just resampling) but it moves the pitch, so the two modes trade different costs.
:::

## How playback and bounce stay consistent

A subtle but important guarantee: a clip warps the *same way* whether you are auditioning it live or rendering the final file. The tempo map, the warp mode, and the anchors are part of the project's edit model, so real-time playback and the offline [bounce](../../project-bounce.md) produce matching timing and pitch. What you hear while editing is what you get on render.

::: details How libsonare implements this
Warp lives on the `Project` editing model. A clip's mode is set with `setClipWarpMode(clipId, mode)` where the mode is one of `'off' | 'repitch' | 'tempo-sync' | 'time-stretch'`. Warp anchors are first-class warp maps: `setWarpMap({ id, name?, anchors })`, with each anchor as `{ warpSample, sourceSample }`, and a clip references one via `setClipWarpRef(clipId, warpRefId)` (`removeWarpMap` clears it). The grid comes from `setTempoSegments` (each `{ startPpq, bpm, endBpm? }`, where `endBpm` drives a ramp) and `setTimeSignatures` (each `{ startPpq, numerator, denominator }`). For `tempo-sync`, the stretch is performed by `StreamingPhaseVocoder` so the pitch is preserved, and the *same* path is used in both realtime playback and offline `bounce()` — `repitch`, by contrast, resamples and lets pitch track speed, and `time-stretch` reads the same map as `repitch` but overlap-adds source segments on the audio thread, with `warpStretchOverflowCount()` reporting the blocks that fell back to resampling. All of warp mode, anchors, tempo, and time signatures round-trip through project JSON via `toJson()` / `Project.fromJson(json)`.
:::

Related: [Project Editing](../../project-editing.md), [Phase Vocoder Stretch](../editing/phase-vocoder-stretch.md), [Project Bounce](../../project-bounce.md)
