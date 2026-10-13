---
title: Tempo and BPM
description: BPM, tempo, the tempogram, autocorrelation, and octave errors — how libsonare estimates how fast a track is from its onset envelope.
---

# Tempo and BPM

**Tempo** is how fast the music feels, measured in **BPM (beats per minute)** — 120 BPM means two beats every second. libsonare estimates it from the periodicity of the [onset-strength envelope](./onset-detection.md), not by counting beats directly. This page expands the timing section of [MIR Overview](../concepts/mir-overview.md).

## From onsets to a tempo

If the music has a steady pulse, its onset envelope is **periodic**: peaks recur at an even spacing. Tempo estimation measures that spacing. Two standard tools do this:

- **Autocorrelation** slides the onset envelope against a time-shifted copy of itself and measures how well they match at each lag. Lags where the curve lines up with itself reveal the repeating period — and the period converts directly to BPM.
- **The tempogram** turns that into a picture: a time × tempo map showing the strength of every candidate tempo at each moment. A strong horizontal band is a stable tempo; a band that drifts shows a track that speeds up or slows down.

Put simply, tempo estimation is looking for the spacing between peaks. Peaks every 0.5 s mean two beats a second, or 120 BPM. In real music the peaks are never perfectly even, so autocorrelation and the tempogram pick the spacing with the most support.

<SonareDemo id="tempogram" />

## Octave errors: the classic tempo trap

Tempo estimates famously land at **half or double** the "true" tempo — 75 BPM reported as 150, or 140 as 70. This is not a bug; it is genuinely ambiguous. A listener tapping along to the same groove can reasonably tap at half-time or double-time, and the periodicity supports both. These are called **octave errors** (by analogy with pitch octaves).

The ambiguity is not limited to factors of two. Triple relations are just as common: a shuffle or a 6/8 groove is routinely reported at 2/3 or 3/2 of the tempo a listener would tap, and libsonare's harmonic clustering weighs 1/2, 2/3, 3/4, 4/3, 3/2, 2, 3, and 4 alongside the estimate itself.

::: info libsonare leans toward 80–180 BPM
Inside the 30–300 BPM search range the estimator does not treat every octave alike. It groups the candidate tempos into harmonically related clusters, takes the cluster with the most support, and from that cluster reports a member between 80 and 180 BPM when one has enough support (then one between 60 and 200). A fast tempo whose half or third is also in evidence is therefore reported at that slower relative: synthetic click tracks at 200 and 240 BPM come back as about 100 and 80. A slow tempo stays slow when nothing faster is in evidence, so a 60 BPM click track reads 60. To report a fast tempo as itself, call `analyzeBpm(...)` with `bpmMin` above its slower relatives: with `bpmMin: 150` the 200 and 240 BPM tracks read about 199 and 238. `detectBpm(...)` takes no range.
:::

Practical handling: pick a sensible BPM range for your material (e.g. 70–180 for pop), and treat the estimate as one candidate among its metrical relatives — the triple ones included — rather than an exact truth. This matters most early in a stream, before enough audio has accumulated.

In a UI, it is kinder to present the estimate as "around 120 BPM, possibly 60 / 180 / 240" than to assert a single value. For an intro-only excerpt, drum-less material, a live performance, or a track whose tempo breathes, do not treat the first few seconds' value as final.

## Confidence and stability

A single number hides how *sure* the estimate is. A track with a tight, repetitive groove concentrates the periodicity evidence on one tempo family; rubato (freely elastic timing), ambient, or sparse material spreads it across unrelated tempos.

`bpmConfidence` (from `analyze(...)`) and `confidence` (from `analyzeBpm(...)`) measure exactly that spread. Each autocorrelation peak votes for its tempo, weighted by its strength; the votes are grouped into harmonically related clusters; and the confidence is the share of all votes that landed in the winning cluster, in `[0, 1]`. Three consequences follow:

- a half-time or double-time reading does not lower it, because those relatives sit in the same cluster;
- it says how unanimous the evidence was, not how likely the number is to match what a listener would tap;
- the fallbacks are fixed values: `0` when there was too little audio to measure, `0.25` when only the local tempo curve produced an answer.

Use it to decide whether to display the BPM, hedge it, or hide it. The per-candidate `confidence` values are a different number: each one is that tempo bin's own share of the votes. `analyzeBpm(...)` ranks its `candidates` by that share, so the reported `bpm` is not necessarily `candidates[0]` (a 120 BPM click track reports 119.7 with a 60 BPM bin first).

::: details How libsonare estimates tempo
`BpmAnalyzer` reads the mel-based onset-strength envelope and autocorrelates it. Every autocorrelation peak inside the search range becomes a weighted vote in a tempo histogram; the strongest bins are grouped into harmonic clusters, and the representative tempo is chosen inside the best cluster with the 80–180 / 60–200 BPM preference described above. A Fourier tempogram (`TempogramConfig`) of the same envelope supplies the local tempo curve, which is the answer only when the autocorrelation finds no peak. `TempogramMode` only selects whether the standalone `tempogram()` feature uses autocorrelation or cosine similarity; it has no effect on BPM estimation.

| Item | Detail |
|------|--------|
| Search range | `bpm_min = 30`, `bpm_max = 300` |
| Initial value | `start_bpm = 120`, used as the fallback |
| Onset settings | `n_fft = 2048` / `hop_length = 512` |
| Candidates | `BpmCandidate` carries the alternatives, so half- and double-tempo candidates remain available downstream |

The streaming analyzer exposes a BPM value that refines as more audio arrives, so early values should be treated as provisional. `BeatAnalyzer` then uses the tempo as a prior when placing individual beats, so tempo and beats are computed from the same onset information rather than independently.
:::

Related: [Onset Detection](./onset-detection.md), [Beats and Downbeats](./beats-downbeats.md), [MIR Overview](../concepts/mir-overview.md), [Realtime and Streaming](../../realtime-streaming.md)
