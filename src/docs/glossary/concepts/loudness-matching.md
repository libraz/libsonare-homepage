---
title: Loudness Matching and A/B Comparison
description: How to run a level-matched A/B comparison between source and mastered audio, what to listen for, and when to turn matching off.
---

# Loudness Matching and A/B Comparison

A/B comparison switches between two versions of the same audio, typically the source and the processed master. Loudness matching means doing that at the same perceived volume, so the comparison is about tone, dynamics, width, and peak behavior rather than simple level. It is one of the simplest ways to make better mastering decisions.

Without loudness matching, the louder version usually wins the first impression. That can be useful when checking final delivery level, but it is a poor way to judge whether EQ, compression, stereo width, saturation, or limiting actually improved the track.

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

<SonareDemo id="loudness-meter" />

## What To Listen For

Do not ask only whether the master is louder. Ask whether the problems are smaller. Check whether the low end is steadier, the vocal or lead part is easier to follow, cymbals and sibilants (the sharp "s" sounds of a vocal) remain comfortable, and the loudest chorus is not being pinned by the limiter.

Avoid judging from one short loop. The intro, loudest chorus, bass-heavy section, and near-silent parts can reveal different side effects. Denoise, exciter, and stereo width changes are especially easy to overdo in quiet passages or on headphones.

## What It Does Not Tell You

Loudness matching is not a delivery target. A file can compare fairly in A/B mode and still be too loud, too quiet, or unsafe for release.

It also does not replace metering. Use [LUFS](../lufs.md) (Loudness Units relative to Full Scale, the broadcast/streaming unit for perceived loudness) and [true-peak](../true-peak.md) readings to check delivery constraints, then use matched listening to decide whether the processing is musically useful.

Turn matching off when verifying the actual exported level, the true peak ceiling, and the WAV file that will be delivered. Cross-environment checks follow the same logic: phone speakers, cheap earbuds, car stereos, and low-volume playback are easier to judge with matching off, because translation issues (whether the master still holds up on another playback system) are about absolute loudness, low-end balance, and sibilance, not the comparison fairness that matching exists to enforce.

## Measure it in libsonare

Measure each version's integrated LUFS, then attenuate the louder one down to the quieter one. The gain is never positive, so matching only ever turns something down. On the site's `comp-take-a.wav` (-8.3 LUFS) and `comp-take-b.wav` (-10.8 LUFS), take A plays 2.5 dB lower and take B is untouched.

::: code-group

```typescript [Browser]
import { init, lufs, masteringAbMatchLoudness } from '@libraz/libsonare';

await init();

const a = lufs(samplesA, sampleRate).integratedLufs;
const b = lufs(samplesB, sampleRate).integratedLufs;
const anchor = Math.min(a, b);
const gainA = anchor - a;   // dB to apply to A
const gainB = anchor - b;   // dB to apply to B

// Or let the engine bring the louder take (A) down to the quieter one (B):
const { samples: matched, appliedGainDb, matchedTruePeakDbtp } = masteringAbMatchLoudness({
  source: samplesA,
  reference: samplesB,
  sampleRate,
});
```

```python [Python]
import libsonare as sonare

a = sonare.lufs(samples_a, sample_rate).integrated_lufs
b = sonare.lufs(samples_b, sample_rate).integrated_lufs
anchor = min(a, b)
gain_a = anchor - a   # dB to apply to A
gain_b = anchor - b   # dB to apply to B

# Or let the engine bring the louder take (A) down to the quieter one (B):
matched, match = sonare.mastering_ab_match_loudness(samples_a, samples_b, sample_rate)
```

```bash [CLI]
sonare lufs take-a.wav   # integrated LUFS of A
sonare lufs take-b.wav   # integrated LUFS of B
# subtract the lower value from each to get the two gains
```

:::

`masteringAbMatchLoudness` moves the source to the reference's level in either direction. Pointed the other way, at a quieter source, it raises it with no headroom limit and can push the peak past 0 dBTP. Read `matchedTruePeakDbtp` before you export what it returns.

### Engine delivery targets

The mastering assistant knows these targets by name (`masteringPlatformNames()` lists them). They are the engine's own settings, not any streaming service's current policy.

| `targetPlatform` | Integrated loudness | True-peak ceiling |
|------------------|---------------------|-------------------|
| `streaming`, `youtube` | None of their own; the assistant defaults of -14 LUFS apply | -1 dBTP |
| `broadcast` | -23 LUFS | -1 dBTP |
| `podcast` | -16 LUFS | -1 dBTP |
| `club`, `cd` | -9 LUFS | -0.3 dBTP |
| `audiobook`, `cinema` | None; the values you pass stand | None |

`club` and `cd` trade headroom for density: -0.3 dBTP gives up part of the margin the other rows keep. `masteringStreamingPreview` goes the other way and shows what a platform's normalization would do to your master. By default it covers Spotify and YouTube at -14 LUFS and Apple Music at -16 LUFS, each with a -1 dBTP ceiling, and returns `normalizationGainDb` and `ceilingRisk` per platform.

## In The libsonare Demo

The mastering demo enables Match loudness for A/B playback by default. Whichever version you switch to is attenuated down to the quietest of the versions you have loaded, so nothing in the comparison is favoured by raw level. With a reference track loaded, that anchor can be the reference, in which case both the source and the rendered master play back attenuated.

The exported audio is not changed by this playback setting. The WAV download keeps the rendered level. Loudness matching only affects how the browser player compares the two versions.

:::: details Implementation notes

The demo takes the integrated LUFS of the source, the rendered master, and the reference track when one is loaded, and uses the lowest of the three as an anchor. Whichever side is playing gets a playback-only gain offset that brings it down to that anchor; the offset is never positive, so matching only ever attenuates.

This avoids modifying either buffer and keeps the exported WAV authoritative. It also means any report or CLI/API reproduction should use the rendered LUFS values, not the temporary comparison gain used by the browser player.

::::

Related: [LUFS](../lufs.md), [What Is Mastering?](./what-is-mastering.md)
