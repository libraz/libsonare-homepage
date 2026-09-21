---
title: Meter and Grouping
description: Time signatures, beat units, and accent grouping — how estimateMeter scores a meter over a beat series you already have, and how to read its grouping, searched, and candidateScores fields.
---

# Meter and Grouping

**Meter** is the pattern of strong and weak beats that repeats every bar. A **time signature** writes it down: the numerator counts the beats in a bar, the denominator names the note value one beat is worth. In 4/4 a bar holds four beats and one beat is a quarter note.

Beat tracking gives you a flat list of pulses. Meter is what turns that list into bars — how many beats a bar holds, which beat starts it, and where the secondary accents fall inside it.

::: info Meter is not tempo
Tempo says how fast the beats arrive; meter says how those beats are grouped. Two pieces at the same BPM can be in 4/4 and in 7/8 — identical pulse rate, different bar length. [Tempo and BPM](./tempo-bpm.md) covers the first, this page the second.
:::

## Scoring a meter over beats you already have

`estimateMeter` takes no audio. It takes two parallel arrays — one time and one accent value per beat — and scores candidate meters against them.

::: code-group

```typescript [Node]
import { estimateMeter } from '@libraz/libsonare-native';

const meter = estimateMeter({
  beatTimes: analysis.beats.map((beat) => beat.time),
  beatStrengths: analysis.beatObservations.onsetStrength,
  candidateNumerators: [3, 4, 5, 6, 7],
});

console.log(meter.timeSignature.numerator, meter.timeSignature.denominator); // 7 4
console.log(meter.grouping);      // [ 3, 2, 2 ]
console.log(meter.downbeatPhase); // index of the beat the first bar starts on
console.log(meter.searched);      // false means nothing was scored — see below
```

```python [Python]
import libsonare as sonare

meter = sonare.estimate_meter(
    [beat.time for beat in analysis.beats],
    analysis.beat_observations.onset_strength,
    candidate_numerators=[3, 4, 5, 6, 7],
)

print(meter.time_signature.numerator, meter.time_signature.denominator)  # 7 4
print(meter.grouping)         # [3, 2, 2]
print(meter.downbeat_phase)
print(meter.searched)
```

```bash [CLI]
sonare analyze song.wav --meter-candidates 3,4,5,7 --meter-denominator 4
```

:::

Because the beat series is the only input, an analysis you have already run can be re-scored without going near the pipeline again: over a wider candidate set, or over an arbitrary span of its beats — one section, one chorus — by slicing the two arrays. No audio is decoded and no frame-level onset envelope is computed.

The C ABI entry point is `sonare_estimate_meter_json(beat_times, beat_strengths, beat_count, options, out_json)`. Build the options with `sonare_meter_options_default()` rather than zeroing the struct — a zeroed candidate count is rejected, not read as "use the defaults".

## An odd meter is reported only if its numerator was asked for

The default candidate set is `{3, 4, 6}`. A 5, a 7 or an 11 is not in it, and the estimator never scores a numerator it was not handed, so an odd meter stays unreachable until `candidateNumerators` is widened to include it. That is the single most common reason a 7/8 piece comes back as a four.

Widening the set does not push the answer wider: every requested numerator competes on the same evidence, and a straight four asked to choose between 3, 4, 5, 6 and 7 still comes back a four. The list holds at most 16 entries, each in `[2, 32]`, and an empty list is rejected rather than falling back to the default.

## The result says how a bar divides, not just how long it is

`grouping` reports the accent groups inside the bar as a list of twos and threes that sums to the numerator. A seven comes back as `[3, 2, 2]` — the 3+2+2 an aksak meter is notated with — rather than as a bare seven, and the layout follows the accents, so `[2, 3, 2]` and `[2, 2, 3]` are separately reachable results for the same numerator.

It also separates meters a numerator alone cannot. A six accented 3+3 reports `[3, 3]`; a six accented 2+2+2 reports `[2, 2, 2]`. Both are 6 over the same denominator, and only the grouping tells them apart.

::: tip Reading a single-entry grouping
A `grouping` of one element means no division was resolved. There are three causes: the numerator has no two/three partition to find, the numerator is wider than the grouping search covers (above 16), or no search ran at all. `searched` is what separates the last case from the first two.
:::

## Three properties to read before using it as a measurement

**`searched` gates everything else.** It is `false` when the beat series was too short to score any candidate — under eight beats. Every other field then carries a fixed fallback rather than a result: a numerator of 4 over the denominator you requested, `downbeatPhase` 0, an undivided `grouping`, `candidateScores` all zero, and — the part that bites — a `timeSignature.confidence` of 0.5, which looks exactly like a middling measurement. Check `searched` before you read the confidence.

**The beat unit comes back as you asked for it.** Whether a beat subdivides into three is measured from the energy *between* the beats, and a per-beat accent series does not carry that. So a compound meter is not resolvable on this path: a six accented 3+3 keeps your denominator and reports `grouping` `[3, 3]` instead of being promoted to 6/8, and `compoundSubdivisionThreshold` has no effect here at all. The whole-track analysis, which has the audio, does resolve it and reports a denominator of 8 on its own.

**`candidateScores` is comparable only inside one result.** A score grows with the square root of how many beats were scored, because that is how evidence for a repeating accent accumulates — so the same meter over twice the beats scores about 1.41 times as high. Comparing spans of different lengths, as a segmentation search does, needs the length normalized out first. Note also that `candidateScores` runs parallel to the numerators you requested, while `candidates` is a ranking: entry *k* there is the k-th best hypothesis, not the k-th request.

## Which accent series to pass

Pass `AnalysisResult.beatObservations.onsetStrength`. That is the beat-local onset-strength window the library's own downbeat pass scores — aggregated over a window around each beat.

The per-beat `strength` on each `Beat` is a different thing: a single raw frame of the onset envelope sampled at the beat position. It is unbounded, its scale depends on the material, and it moves with any jitter in the beat placement. It is fine to display and poor to score accents with.

::: details How libsonare computes it
`MeterAnalyzer` folds the accent values onto each candidate numerator's beat positions and scores the downbeat positions against the whole span as a standardized difference: the group mean minus the overall mean, scaled by the square root of the group size and divided by the span's spread. The square-root term is what keeps a wide numerator from scoring lower simply because fewer beats land on its downbeat — and it is also why a score carries the length of the span it was measured over.

Groupings are enumerated as every partition of the numerator into twos and threes, twos emitted first so that a tie — which is what an unaccented bar produces — reports the most subdivided reading and leaves the compound one something the beats have to argue for. Each partition is scored only on its secondary accent positions, weighted by `subdivisionWeight`, on top of the phase score shared by all groupings of that numerator. Confidence comes from the margin between the best and second-best candidate, not from the winner's absolute score.

`estimateMeterFromBeats` is the same scorer called with an empty onset envelope, which is what switches the compound-subdivision branch off: the promotion to a denominator of 8 needs a frame sampled at the midpoint between two beats, and a per-beat series has no midpoint to sample.
:::

Related: [Beats and Downbeats](./beats-downbeats.md), [Onset Detection](./onset-detection.md), [Tempo and BPM](./tempo-bpm.md), [Node API](../../node-api.md), [Python API](../../python-api.md)
