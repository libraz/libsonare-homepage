---
title: Loudness Matching
description: Why before/after comparisons should be level-matched when judging mastering changes.
---

# Loudness Matching

Loudness matching means comparing two versions at the same perceived volume. It is one of the simplest ways to make better mastering decisions.

Without loudness matching, the louder version usually wins the first impression. That can be useful when checking final delivery level, but it is a poor way to judge whether EQ, compression, stereo width, saturation, or limiting actually improved the track.

<SonareDemo id="loudness-meter" />

## Why Louder Feels Better

When two similar sounds are played back at different levels, the louder one often seems clearer, brighter, wider, and more exciting. This happens even when the only difference is gain.

That bias is especially dangerous in mastering because many processors change loudness as a side effect:

| Processor | How it can bias comparison |
|-----------|----------------------------|
| EQ | Boosts can make the processed version louder and more impressive. |
| Compression | Average level rises even if peaks are controlled. |
| Saturation | Added harmonics can increase perceived loudness. |
| Limiting | Peaks are reduced, then makeup level makes the master denser. |
| Stereo widening | A wider image can feel larger and more exciting even when it weakens the centered, mono-safe core of the mix. |

Matching loudness does not make the comparison perfect, but it removes the most obvious trap: choosing the louder version because it is louder.

## How To Use It

Use loudness matching while making creative or technical judgments:

1. Render the processed version.
2. Enable loudness-matched A/B playback.
3. Switch between before and after on the same musical phrase.
4. Listen for tone, punch, vocal stability, low-end control, stereo image, and artifacts.
5. Turn matching off only when checking the actual final delivery level.

If the processed version only sounds better when matching is off, the processing may mainly be a gain increase. In that case, reduce the effect and compare again.

## What It Does Not Tell You

Loudness matching is not a delivery target. A file can compare fairly in A/B mode and still be too loud, too quiet, or unsafe for release.

It also does not replace metering. Use LUFS and true-peak readings to check delivery constraints, then use matched listening to decide whether the processing is musically useful.

## In The libsonare Demo

The mastering demo enables Match loudness for A/B playback by default. When you switch between Before and After, the player lowers the louder side so the comparison is less biased by level.

The exported audio is not changed by this playback setting. The WAV download keeps the rendered level. Loudness matching only affects how the browser player compares the two versions.

:::: details Implementation notes

The demo uses rendered input/output LUFS values to calculate a playback-only gain offset. When the source is louder, the source playback is lowered; when the rendered master is louder, the rendered playback is lowered.

This avoids modifying either buffer and keeps the exported WAV authoritative. It also means any report or CLI/API reproduction should use the rendered LUFS values, not the temporary comparison gain used by the browser player.

::::

Related: [A/B comparison](../ab-comparison.md), [LUFS](../lufs.md), [What Is Mastering?](./what-is-mastering.md)
