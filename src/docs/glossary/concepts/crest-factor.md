---
title: Crest Factor
description: The gap between peak level and average level, and how it helps interpret density and transient control.
---

# Crest Factor

Crest factor is the gap between peak level and average level. The "average" here is the RMS level — a measure of the signal's sustained energy rather than its momentary spikes — and crest factor is the difference between the two, reported in dB. In mastering, it is a quick way to understand how peaky, dense, or transient-heavy a signal is. A *transient* is the short, sharp burst at the start of a sound — a drum hit, a pick attack, a consonant.

A high crest factor means peaks rise far above the average level. A low crest factor means the signal is dense or heavily controlled. Neither is automatically good or bad.

<CrestFactorFigure
  title="Same peak, different crest"
  caption="Both panels reach the same peak level. The difference is how much of the time the signal sits near it, which moves the RMS line and therefore the gap between the two. That gap is the crest factor — the reason peak level alone says so little about how a track feels."
/>

## How To Read It

Think of crest factor as a clue, not a verdict. It is computed over the whole buffer as peak dB minus RMS dB. These values were measured on synthetic signals and on the clips the site's demos play:

| Signal | Peak (dBFS) | RMS (dBFS) | Crest (dB) |
|--------|-------------|------------|------------|
| Square wave | -6.0 | -6.0 | 0.0 |
| Sine wave | -6.0 | -9.0 | 3.0 |
| Synth lead (`lead.wav`) | -1.4 | -6.9 | 5.5 |
| Comping take (`comp-take-a.wav`) | -1.4 | -8.4 | 7.0 |
| Chords (`chord-turnaround.wav`) | -3.4 | -12.4 | 9.0 |
| Pad (`pad.wav`) | -1.7 | -17.5 | 15.8 |
| Band (`band.wav`) | -1.0 | -17.6 | 16.6 |
| Mix (`mix.wav`) | -1.0 | -18.7 | 17.7 |
| Drum loop (`drum.wav`) | -0.7 | -27.5 | 26.8 |

Read against that table, rough ranges look like this. They describe what these clips show, not a standard.

| Crest | Possible meaning |
|-------|------------------|
| 0-3 dB | A square wave or a hard-clipped signal. |
| 5-10 dB | Dense, heavily compressed or limited material. |
| 12-18 dB | An open mix that keeps its dynamics. |
| 20 dB and up | Isolated percussion or sparse material. |

A solo snare can have a high crest factor and still be healthy. A dense synth pad can have a low crest factor and still be correct. Context matters.

## Why It Matters

Limiters react to peaks. If a mix has a few peaks much louder than the rest, the limiter may work hard on those moments while the overall master remains quieter than expected.

Compression, clipping, saturation, and transient shaping can reduce crest factor. Used carefully, that can make a master feel more controlled. Used carelessly, it removes punch and makes the track tiring. Transient shaping runs both ways: pushed in the attack-boost direction it lifts peaks while barely moving RMS, so it *raises* crest factor instead.

The demo below blends a compressed copy with the dry signal. The dry path is what keeps the original transients.

<SonareDemo id="parallel-compression" />

## Relationship To Dynamic Range

Crest factor is related to dynamics, but it is not the same as musical dynamic range. It mostly describes peak-to-average behavior over a measurement window. A song can have a low crest factor in each section while still having macro dynamics between sections.

Use it alongside listening, [LUFS](../lufs.md) (Loudness Units relative to Full Scale, the loudness measure delivery targets are written in), true peak, and arrangement context.

## Common Pitfalls

If crest drops sharply and kicks or snares lose their attack at the same time, something in the compressor, saturator, or limiter is shaving transients too aggressively. That is not automatically wrong, but it should trigger a listening check for lost punch or groove. The opposite pattern — crest stays high but the LUFS target is missed — usually means only a few rare peaks are pushing the limiter while the rest of the mix has not actually become denser.

In that second case, do not solve it by raising the ceiling. Revisit the earlier dynamics stage, the input gain, and the low-end balance first.

## Measure it in libsonare

Crest factor is one call. The stereo form takes the peak across both channels and the RMS over both together, so an out-of-phase pair does not cancel out of the RMS the way it would in a mono downmix.

::: code-group

```typescript [Browser]
import { init, meteringCrestFactorDb, meteringCrestFactorDbStereo } from '@libraz/libsonare';

await init();

const crest = meteringCrestFactorDb(samples, sampleRate);   // peakDb - rmsDb
const stereoCrest = meteringCrestFactorDbStereo({ left, right, sampleRate });
```

```python [Python]
import libsonare as sonare

audio = sonare.Audio.from_file("song.wav")
crest = audio.crest_factor_db()                  # peak_db - rms_db

# Separate channels:
stereo_crest = sonare.metering_crest_factor_db_stereo(left, right, sample_rate)
```

```bash [CLI]
sonare meter song.wav   # native CLI only: peak, RMS and crest factor, with true peak and clipping
```

:::

The mastering demo shows crest for the source, the master, and a loaded reference. It is most useful when comparing a source against a reference track: if the reference has much lower crest, it may be denser, more limited, or simply arranged differently.

:::: details Implementation notes

The displayed crest value is computed from peak and RMS on the selected buffer and reported in dB. It is a lightweight diagnostic, not a replacement for a dedicated long-window loudness or dynamics meter.

::::

Related: [Dynamic Range](./dynamic-range.md), [Reference Track](./reference-track.md), [True Peak](../true-peak.md)
