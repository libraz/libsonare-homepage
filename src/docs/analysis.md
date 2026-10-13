---
title: Music Analysis
description: Task guide to libsonare music information retrieval — the one-call analysis, beats and meter, key and chords, structure, melody, source separation, and which glossary page explains each result.
---

# Music Analysis

**Music analysis** is the part of libsonare that listens to a recording and reports what is in it: how fast it is, where the beats fall, what key and chords it uses, how it is laid out in sections, and what the melody does.

This page is the task layer. It tells you which call to make, what the result actually means, and where the fuller explanation lives. The [glossary](./glossary/analysis/spectrogram-stft.md), starting from the spectrogram every feature is computed from, explains the concepts; the [JavaScript Analysis API](./js-api-analysis.md) is the field-by-field reference. Use this page to decide.

New to audio or MIR? Read [Audio Basics](./glossary/concepts/audio-basics.md) (samples, sample rate, decibels) and [MIR Overview](./glossary/concepts/mir-overview.md) (what each feature family measures) first.

::: tip Where analysis sits in the pipeline
**Analysis** tells you *what* a recording is. **Editing** changes one track. **Mixing** balances several. **Mastering** finishes the stereo result. Analysis is also the stage the others read from — a mastering target chosen per genre, a grid drawn from detected beats, a stem pulled out before pitch tracking.
:::

## What You Will Learn

By the end of this page you should be able to:

- run one call that returns tempo, key, beats, chords, sections, melody, timbre and dynamics together;
- pick a focused helper when the all-in-one result is too coarse or hides an option you need;
- read a meter estimate without confusing its two different `confidence` numbers, and tell a real detection from the fallback;
- interpret a key confidence as the model's own belief rather than as an accuracy;
- choose between the three source-separation routes and know what each one can and cannot recover;
- decide when the compatibility layer is the better entry point than the music-analysis calls.

## Start with one call

`analyze(...)` runs the whole chain and returns everything at once. It is the right first call for almost every application: it computes the shared spectral layer once, then reads every estimator off it.

::: code-group

```typescript [Browser]
import { init, analyze } from '@libraz/libsonare';

await init();

// The browser decodes; libsonare analyzes.
const ctx = new AudioContext();
const response = await fetch('track.mp3');
const buffer = await ctx.decodeAudioData(await response.arrayBuffer());
const samples = buffer.getChannelData(0); // the left channel only, not a mono mix

const result = analyze({ samples, sampleRate: buffer.sampleRate });

console.log(result.bpm, result.bpmConfidence);
console.log(result.key.name, result.key.confidence);
console.log(result.timeSignature.numerator, result.timeSignature.denominator);
console.log(result.beats.length, result.downbeatIndices.length);
console.log(result.chords.length, result.sections.length, result.form);
console.log(result.chords[0]?.name, result.chords[0]?.romanNumeral);
```

```typescript [Node]
import { Audio, analyze } from '@libraz/libsonare-native';

const audio = Audio.fromFile('track.mp3');
const result = analyze({ samples: audio.getData(), sampleRate: audio.getSampleRate() });

console.log(result.bpm, result.key.name, result.timeSignature.numerator);
console.log(result.beats.length, result.chords.length, result.sections.length, result.form);
```

```python [Python]
from libsonare import Audio, analyze

audio = Audio.from_file("track.mp3")
result = analyze(audio.data, audio.sample_rate)

print(result.bpm, result.key.name, result.time_signature.numerator)
print(len(result.beat_times), len(result.chords), len(result.sections), result.form)
```

```bash [CLI]
sonare analyze track.mp3 --json
# Score a 5-beat meter too (the default candidates are 3, 4 and 6):
sonare analyze track.mp3 --meter-candidates 3,4,5,6
```

:::

`getChannelData(0)` hands over the first channel of a stereo file, which is enough for a quick look but misses anything panned to the right. To analyze the whole mix, average the channels sample by sample first (`(left[i] + right[i]) / 2`).

The call is synchronous and the WASM build is single-threaded, so drive it from a Web Worker for anything longer than a short clip. `analyzeWithProgress(...)` takes the same request, reports `(progress, stage)`, and can cancel a long run. Its analysis options go beside `samples` or under `options`, as in `analyze`; a key that is not an analysis option throws a `TypeError` naming it.

```typescript
const result = analyzeWithProgress({
  samples,
  sampleRate,
  options: { tuning: 'auto' },
  onProgress: (progress, stage) => console.log(stage, progress),
  cancel: () => userPressedStop,
});
```

::: warning Always pass `sampleRate`
Analysis calls default `sampleRate` to 22050 Hz when it is omitted, and nothing reports the mismatch. A 44.1 kHz recording analyzed without its rate is read at half speed: a 120 BPM click track comes back as 60. Every time-domain result (tempo, beat and section times, pitch frequencies) is scaled the same way. Pass the buffer's real rate, `buffer.sampleRate` in the browser, on every call. Room-acoustics calls default to 48000 instead.
:::

::: warning `analyze()` searches triads only
The unified path sets `useTriadsOnly` to `true`, while the standalone `detectChords(...)` leaves it `false`. Until you pass `useTriadsOnly: false`, a seventh chord comes back as the triad inside it. Pass it explicitly when the extended qualities matter.
:::

## The chain every estimator sits on

Nothing here is a separate algorithm reading the file again. Decoded samples become one short-time spectrum per frame, that one matrix fans out into the feature layer, and each estimator reads a decision off the features it needs.

<AnalysisPipelineFigure
  title="From decoded samples to an answer"
  caption="The STFT is computed once and shared: mel feeds MFCC and the onset envelope, chroma feeds key, chords and section labeling, and the onset envelope feeds tempo and beat tracking. The lower rail is what never passes through it — level, zero-crossing rate and the pitch trackers read the waveform directly, which is why melody survives on material the spectral path finds hard."
/>

That layout explains a cost difference worth knowing. `analyze(...)` pays for the STFT once and hands the same matrices to every estimator. The single-answer helpers each rebuild the chain from the samples, so calling four of them costs roughly four analyses. Reach for a helper when you want one field or an option the unified call hides — not to save work.

## Choose the call

Node uses the browser names. Python uses the same names in snake_case (`detect_bpm`, `analyze_sections`, `chord_functional_analysis`). The CLI column lists the matching `sonare` subcommand.

| What you want to know | The call | In `analyze(...)`? | CLI | Where it is explained |
|-----------------------|----------|:------------------:|-----|-----------------------|
| Everything, once | `analyze(...)` · `analyzeWithProgress(...)` | n/a | `analyze` | This page, plus [JavaScript Analysis API](./js-api-analysis.md) |
| How fast it is | `detectBpm(...)` · `analyzeBpm(...)` | Yes | `bpm` | [Tempo and BPM](./glossary/analysis/tempo-bpm.md) |
| Where the beats and bar lines fall | `detectBeats(...)` · `detectDownbeats(...)` | Yes | `beats` · `downbeats` | [Beats and Downbeats](./glossary/analysis/beats-downbeats.md) |
| Where every attack is | `detectOnsets(...)` · `onsetEnvelope(...)` | No | `onsets` | [Onset Detection](./glossary/analysis/onset-detection.md) |
| What the time signature is | `estimateMeter(...)` | Yes | `analyze --meter-candidates` | [Meter and Grouping](./glossary/analysis/meter-and-grouping.md) |
| What key it is in | `detectKey(...)` · `detectKeyCandidates(...)` | Yes | `key` | [Key Detection](./glossary/analysis/key-detection.md) |
| What the chords are | `detectChords(...)` · `chordFunctionalAnalysis(...)` | Yes | `chords` | [Chord Recognition](./glossary/analysis/chord-recognition.md) |
| How the song is laid out | `analyzeSections(...)` · `detectBoundaries(...)` | Sections only | `sections` | [Section and Structure](./glossary/analysis/section-structure.md) |
| What the melody does | `analyzeMelody(...)` · `pitchYin(...)` · `pitchPyin(...)` | Melody only | `pitch` | [Melody and Pitch](./glossary/analysis/melody-pitch.md) |
| What it sounds like | `analyzeTimbre(...)` · `mfcc(...)` · `melSpectrogram(...)` | Timbre only | `mel` | [Mel, MFCC, and Timbre](./glossary/analysis/mel-mfcc-timbre.md) |
| Harmony as a matrix over time | `chroma(...)` · `chromaCqt(...)` · `nnlsChroma(...)` | No | `chroma` | [Chroma Features](./glossary/analysis/chroma-features.md) |
| The raw time-frequency picture | `stft(...)` · `melSpectrogram(...)` | No | n/a | [Spectrogram and STFT](./glossary/analysis/spectrogram-stft.md) |
| How to split a mono or multichannel mix | `hpss(...)` · `decomposeStems(...)` · `decomposeStemsLinked(...)` | No | n/a | [Source separation](#source-separation), below |

Use a helper when you want tighter control (a narrower tempo range, a different key profile, a chord search that includes extended qualities) or when you need one answer and the rest would be wasted work. `analyze(...)` takes the chord, HMM and inversion switches under longer names: `useChordHmm`, `useChordKeyContext` and `detectChordInversions` there are `useHmm`, `useKeyContext` and `detectInversions` on `detectChords(...)`.

## Rhythm

Rhythm is where most integration mistakes happen, because four different numbers in this area are all reasonable answers to "what is the tempo" and two different fields are both called `confidence`. Take them one at a time.

### Beats, downbeats, and the evidence behind them

Beat tracking finds the steady pulse you would tap along to; downbeat detection picks out which of those beats starts a bar. `analyze(...)` returns both, along with the per-beat evidence it used to decide.

```typescript
const { beats, beatTimes, downbeatIndices, beatObservations } = analyze({
  samples,
  sampleRate,
});

// beats[downbeatIndices[k]] is the k-th bar start.
const isDownbeat = new Set(downbeatIndices);
for (const [index, beat] of beats.entries()) {
  console.log(beat.time.toFixed(3), isDownbeat.has(index) ? 'bar' : 'beat');
}
```

| Field | What it holds |
|-------|---------------|
| `beatTimes` | Beat positions in seconds, as a `Float32Array`. |
| `beats` | The same positions as objects, each with a `strength`. |
| `downbeatIndices` | Indices *into* `beats`, one per detected bar start — not a parallel array and not a second time series. Test for a downbeat with a membership check. |
| `downbeatPhase` | Which beat of the first bar the track starts on. It comes from the meter estimator and is not re-derived when downbeats are later refined, so it can disagree with `downbeatIndices[0]`. |
| `beatObservations` | The accent evidence behind the decision: `onsetStrength`, `lowFrequencyEnergy` and `chordChange`, each one value per beat. A stream comes back empty when the analysis could not produce it, which is not the same as every beat scoring zero. |
| `beatLocalBpm` | Smoothed tempo at each beat. Empty unless you set `computeTempoCurve: true`, and a moving tempo needs `adaptiveTempo: true` as well. |

`beats[].strength` and `beatObservations.onsetStrength` are not interchangeable. The first is a single unwindowed frame of the onset envelope sampled at the beat, so it is unbounded and moves with any jitter in the beat position. The second is aggregated over a window around the beat, which is what the library's own downbeat pass scores. For anything that compares accents between beats, use `onsetStrength`.

### Tempo

| Route | Returns | Use it when |
|-------|---------|-------------|
| `result.bpm` from `analyze(...)` | One number plus `bpmConfidence` and `bpmCandidates`, each candidate labeled `primary`, `half`, `double` or `other` | You already ran the full analysis. The candidate relations are how you catch a half-time or double-time read. `bpmConfidence` is the share of the periodicity votes behind the winning tempo family ([Tempo and BPM](./glossary/analysis/tempo-bpm.md#confidence-and-stability)). |
| `detectBpm(...)` | One number | Tempo is all you want from the file. |
| `analyzeBpm(...)` | `bpm`, `confidence`, `candidates` (the chosen tempo first, then the rest by vote share), plus the `autocorrelation` and `tempogram` behind them | You want to show the evidence, or to search a restricted range: `bpmMin` 30, `bpmMax` 300, `startBpm` 120 and `maxCandidates` 5 by default. |
| `analyzeRhythm(...)` | Its own `bpm`, refined from the local beat period, alongside groove, syncopation, regularity and `beatIntervals` | You want rhythmic character rather than just a number. Its default range is narrower — `bpmMin` 60, `bpmMax` 200. |

`analyzeRhythm(...)`'s `bpm` is deliberately a third figure rather than either of the others: it is measured from the beat grid the tracker settled on, and against synthesized click trains it lands closer to the known tempo than either tempo entry point. Do not expect the three to agree to the decimal.

### Meter: `estimateMeter`

`estimateMeter(...)` scores candidate time signatures over a beat series you supply. It needs no audio and no frame-level envelope, so you can score any span of an existing analysis — a single section, say — without re-running anything.

```typescript
import { analyze, estimateMeter } from '@libraz/libsonare';

const result = analyze({ samples, sampleRate });

const meter = estimateMeter({
  beatTimes: result.beatTimes,
  beatStrengths: result.beatObservations.onsetStrength,
  candidateNumerators: [3, 4, 6], // the default
  denominator: 4,                 // the default
});

console.log(meter.timeSignature, meter.grouping, meter.downbeatPhase);
```

Pass `beatObservations.onsetStrength`, not `beats[].strength`. Neither needs pre-scaling — the series is divided by its own maximum before scoring, so only the accent contrast inside it is read. Do not assemble the series yourself from `onsetEnvelope(...)` frames either: that read changes with the sample rate, and a browser decodes at the output device's rate, so the same clip answers differently per visitor. [Meter and Grouping](./glossary/analysis/meter-and-grouping.md#which-accent-series-to-pass) has the measurement.

<SonareDemo id="meter-estimate" />

Read the ranking rather than the headline in that demo: four bars of plain 4/4 give 4 most of the support and leave 6 a real share, because every other downbeat also opens a six-beat span.

`grouping` is the other half of the answer: how the bar divides into accent groups of two and three. A seven comes back as `[3, 2, 2]` and the entries always sum to the numerator. A single entry means no division was resolved. A six accented in threes keeps the denominator you asked for and reports `[3, 3]`, because per-beat accents cannot say how a beat subdivides.

#### Two different fields are called `confidence`

This is the single easiest thing to get wrong here, and grabbing the wrong one produces a number that looks plausible and means something else.

| Field | What it is | Range and behavior |
|-------|-----------|---------------------|
| `timeSignature.confidence` | **Margin-derived.** How far the winning candidate pulled ahead of the runner-up, measured in the score's own noise units and mapped onto a confidence. | Starts at 0.45 with no margin at all and rises from there, so a tie between two candidates still reports about 0.45 — it is a separation, not a probability. An unresolved compound-versus-simple reading subtracts a fixed penalty. |
| `candidates[k].confidence` | **A normalized share.** Each candidate's positive score divided by the total across all of them. | The entries read as a breakdown of the support and sum to 1. A candidate at 0.6 holds 60 % of the support — it is not a 60 % chance of being right. |

So a clear 3/4 can put nearly all of the support on 3 in `candidates[0].confidence` while `timeSignature.confidence` sits well below 1, and a genuinely ambiguous clip can show a high `timeSignature.confidence` if the runner-up happens to fall far behind. They answer different questions; pick the one that matches yours, label it accordingly in a UI, and never run both through one threshold. [Meter and Grouping](./glossary/analysis/meter-and-grouping.md#two-confidences-under-one-field-name) has the formulas behind each.

`candidates` is a **ranking** (entry `k` is the k-th best hypothesis, the selected signature first), while `candidateScores` is **parallel to the numerators you requested**, so the two do not index alike. Scores also grow with the number of beats scored, so compare them only within one result. [Meter and Grouping](./glossary/analysis/meter-and-grouping.md) covers both.

#### A short span is not searched at all

Below **eight detected beats** the estimator does not search. It returns a fully populated result anyway — 4/4, a `timeSignature.confidence` of **0**, an undivided `grouping`, one candidate and all-zero scores — and the only field that tells you so is `searched`. The zero means an unchecked read degrades toward "no idea" rather than toward a middling detection; the 4/4 beside it still looks exactly like a finding.

```typescript
const meter = estimateMeter({
  beatTimes: result.beatTimes,
  beatStrengths: result.beatObservations.onsetStrength,
});

if (!meter.searched) {
  // Nothing was measured: timeSignature.confidence is 0 and every
  // other field is the fixed fallback.
  console.log('too few beats to estimate a meter');
} else {
  console.log(meter.timeSignature.numerator + '/' + meter.timeSignature.denominator);
}
```

The fallback is a plausible-looking 4/4. A short clip, a quiet intro, or beat tracking that found little all arrive at the same answer, and only `searched` separates it from a measurement. Check it before you render anything.

<SonareDemo id="meter-estimate-three" />

The waltz is the contrast to the 4/4 clip: nothing supports a four- or six-beat bar, so 3 takes essentially all of the support. A confident estimate and a divided one look different in the breakdown.

## Harmony

### Key

```typescript
import { detectKey, detectKeyCandidates } from '@libraz/libsonare';

const key = detectKey({ samples, sampleRate, profile: 'temperley' });
console.log(key.name, key.shortName, key.confidence);

const ranked = detectKeyCandidates({ samples, sampleRate, modes: 'all' });
for (const { key: candidate, correlation } of ranked.slice(0, 3)) {
  console.log(candidate.shortName, correlation.toFixed(3));
}
```

`Key.confidence` is a **softmax** over the profile correlations of every candidate that was scored. It falls as the runner-up closes in, so two keys splitting the evidence — a relative major and minor, typically — each report about half. That makes it a good ambiguity signal and a poor accuracy claim: it says how decisively the chroma picked this key out of the candidate set, not how often that pick is right. Nothing in it has been fitted against annotated recordings, so a confident wrong answer is entirely possible and a pipeline that branches on it should pick its own threshold against its own material.

`detectKeyCandidates(...)` returns the raw `correlation` per candidate instead, unnormalized — reach for it when you want to inspect the shape of the decision rather than a single belief.

`key.mode` is a name — `'major'`, `'minor'`, or a church mode such as `'dorian'` — and `detectKey(...)` also returns the `tuning` its chroma was built with. By default the chroma is read at concert A440; pass `tuning: 'auto'` to measure the offset from a recording that sits between semitones, and read the value back from the result. The same option exists on `detectChords(...)` and `analyze(...)`.

```typescript
const detected = detectKey({ samples, sampleRate, tuning: 'auto' });
console.log(detected.mode, detected.tuning);   // e.g. "major", a semitone fraction in [-0.5, 0.5)
```

| Option | Effect |
|--------|--------|
| `profile` | Which key profile to correlate against: `'ks'`/`'krumhansl'`, `'temperley'`, `'shaath'`, the three EDM profiles, or `'bellman-budge'`. Genres differ enough that this is the first knob to try when results look systematically off. |
| `modes` | `'major-minor'`, `'modal'`, `'all'`, or an explicit list. Widening the mode set widens the candidate pool the softmax normalizes over, so confidences drop even when the top pick does not change. |
| `genreHint` | Selects a profile heuristically when you know the material but not the right profile. |
| `useHpss` · `loudnessWeighted` · `highPassHz` | Clean the chroma before correlating: drop the percussive layer, weight by perceived loudness, or roll off the low end. |

### Chords

```typescript
import { detectChords, chordFunctions } from '@libraz/libsonare';

const chordOptions = {
  useTriadsOnly: false,   // include the extended qualities
  useHmm: true,           // smooth the sequence instead of deciding per frame
  useKeyContext: true,
  keyRoot: key.root,
  keyMode: key.mode,   // a name or a Mode ordinal
  chromaMethod: 'nnls',
} as const;

const { chords } = detectChords({ samples, sampleRate, ...chordOptions });

for (const chord of chords) {
  console.log(chord.name, chord.start.toFixed(2), chord.duration.toFixed(2), chord.confidence);
}

// Label the chords you already have with their function in the key; nothing is re-detected.
const labelled = chordFunctions({ chords, key });
console.log(labelled[0].roman, labelled[0].function);   // e.g. "I", "tonic"
```

`chordFunctions(...)` returns the same timed entries with a Roman numeral (`roman`) and a harmonic function (`'tonic'`, `'subdominant'`, `'dominant'`, `'chromatic'` for a root outside the key's scale, `'none'` for `N.C.`) added. `chordFunctionalAnalysis(...)` does detection and labeling in one call for a key you already know, and returns the same entries. `keyRoot` is required: `chordFunctionalAnalysis({ samples, sampleRate, keyRoot: key.root, keyMode: key.mode })`. To write the result back into a project as chord annotations, see [From a detected chord to a project annotation](./glossary/analysis/chord-recognition.md#from-a-detected-chord-to-a-project-annotation).

Each `Chord` carries `root`, `bass`, `quality`, `start`, `end`, `duration`, `confidence` and a `name` the core spells canonically, so `rootName`, `bassName` and `name` read identically from every binding. Chords inside `analyze(...)` additionally carry `romanNumeral` relative to `result.key`; it is empty for `N.C.`.

Quality coverage goes well past triads and plain sevenths. Beyond `maj`, `m`, `dim`, `aug`, `7`, `maj7`, `m7`, `m7b5`, `dim7`, `sus2`, `sus4`, `sus2add4`, `add9`, `madd9`, `maj9` and `9`, the search also recognizes **`6`**, **`m6`**, **`mM7`**, **`7sus4`**, **`11`**, **`13`**, **`7b9`** and **`7#9`**. A slash chord appends the bass, as in `C/E`. Below the correlation `threshold` the segment is reported as unknown rather than as a forced guess.

| Option | Effect |
|--------|--------|
| `useTriadsOnly` | `false` here, `true` inside `analyze(...)`. Leave it false to get the qualities above. |
| `useHmm` · `hmmBeamWidth` | Decode the progression as a sequence rather than per frame, which removes most single-frame flicker. |
| `useKeyContext` · `keyRoot` · `keyMode` | Bias the search toward chords that belong to a key you already detected. |
| `chromaMethod` | `'stft'` or `'nnls'`. The second suppresses harmonics of the bass before matching, which helps on dense material. |
| `detectInversions` | Report the bass note separately instead of folding it into the root. |
| `tuning` | Shift the chord chroma by a tuning offset in fractions of a semitone, in `[-0.5, 0.5)`; defaults to `0` (A440). `'auto'` measures it, and the result reports the value used. The same option on `analyze(...)` shifts the chroma used for key, chords and sections. |
| `nFft` | The chroma window, in samples at 22050 Hz and rescaled to the input rate, so it spans the same time at every rate. |
| `useBeatSync` · `minDuration` · `smoothingWindow` | Control how the frame-level decision is aggregated into segments. |

## Structure and melody

### Sections

```typescript
import { analyzeSections, detectBoundaries } from '@libraz/libsonare';

const sections = analyzeSections({ samples, sampleRate, minSectionSec: 4 });
for (const section of sections) {
  console.log(section.name, section.start.toFixed(1), section.energyLevel, section.confidence);
}

const { boundaries, noveltyCurve, noveltyPeak } = detectBoundaries({ samples, sampleRate });
```

`analyzeSections(...)` returns labeled spans: intro, verse, chorus, bridge, instrumental, outro, or unknown. `detectBoundaries(...)` is the unlabeled layer underneath it: the transitions plus the continuous novelty curve they were picked from, which is what you need in order to apply your own threshold. It is not a coarser view of the section list, and you cannot derive one from the other.

Two behaviors to plan for. A pre-chorus label has no detection branch, so filtering sections for it always comes back empty. And `unknown` has two sources, both with `confidence` 0: no boundary was found (one span covers the track), or an edge span is not quiet and repeats nothing else. [Section and Structure](./glossary/analysis/section-structure.md#two-ways-to-get-unknown) shows how to tell them apart.

`noveltyCurve` is scaled by its own maximum, so a peak of 1 means "the most novel frame in this track", not "a large change". Multiply by `noveltyPeak` to recover the raw response the absolute threshold is compared against.

Each peak must reach `threshold` times the largest novelty within `referenceWindow` seconds (60 by default) on either side, so a dominant change does not hide weaker section changes far from it on a long track. A lone loud burst, one that no other event in the window reaches 30% of, is set aside from that reference so it does not hide the section changes around it. Each section's `energyLevel` is its median frame RMS, normalized by the loudest section, so a short burst does not make its own section the loudest.

`analyzeSections(...)` takes only `nFft`, `hopLength` and `minSectionSec`, and uses the default 60 s `referenceWindow`. The other boundary options belong to `detectBoundaries(...)`:

| Option | Default | Meaning |
|--------|---------|---------|
| `threshold` | 0.3 | Fraction of the local reference that a peak must reach. |
| `absoluteThreshold` | 0.005 | Floor on the raw novelty. With 0, only `threshold` gates, and a stationary input is segmented anyway. |
| `referenceWindow` | 60 | One-sided span in seconds for the local reference. 0 turns the relative gate off; a value at least the track length gives a whole-track reference. |
| `peakDistance` | 2 | Minimum spacing between peaks in seconds, strongest peak first. |
| `kernelSize` · `nMfcc` · `nChroma` · `useMfcc` · `useChroma` | 64 · 13 · 12 · true · true | The checkerboard kernel, in frames of `hopLength` (64 frames at hop 512 and 22050 Hz span about 1.5 s), and the feature mix. At least one of `useMfcc` and `useChroma` must stay on. |

### Melody and pitch

```typescript
import { analyzeMelody } from '@libraz/libsonare';

const melody = analyzeMelody({ samples, sampleRate, usePyin: true, fmin: 65, fmax: 2093 });

console.log(melody.meanFrequency, melody.pitchRangeOctaves, melody.vibratoRate);
const voiced = melody.points.filter((point) => point.frequency > 0);
```

Pitch tracking reads the waveform directly rather than the STFT, and it expects **monophonic** material — one note at a time. Run it on a solo vocal, a lead line, or a stem you separated first; on a full mix it tracks whatever dominates, frame by frame.

`points[].frequency` is `0` at unvoiced frames, so filter before averaging. `usePyin: true` selects the Viterbi-smoothed tracker, which costs more and jumps octaves far less than plain per-frame YIN — the usual choice for anything a user will see. The defaults span `fmin` 65 Hz to `fmax` 2093 Hz with a YIN `threshold` of 0.1 (how deep a dip in the difference function must be to count as a period; lower is stricter). Under pYIN the voiced/unvoiced decision comes from `voicedFlag`, not from this value; narrowing the range to the instrument you actually have is the cheapest accuracy win available here.

## Source separation

Choose harmonic/percussive separation, NMF components, or linked multichannel masks on [Source Separation](./source-separation.md). That page includes audio comparisons and the reconstruction and phase limits of each route.

## The layer underneath

Every estimator above is reading features, and those features are available directly when you want to build something the estimators do not cover.

```typescript
import { stft, melSpectrogram, chroma, mfcc, onsetEnvelope, spectralCentroid } from '@libraz/libsonare';

const spectrum = stft({ samples, sampleRate, nFft: 2048, hopLength: 512 });
const mel = melSpectrogram({ samples, sampleRate, nMels: 128 });
const pitchClasses = chroma({ samples, sampleRate });
const timbre = mfcc({ samples, sampleRate, nMfcc: 13 });
const envelope = onsetEnvelope({ samples, sampleRate });
const brightness = spectralCentroid({ samples, sampleRate });
```

`nFft` sets how long one analysis window is and `hopLength` how far the next one starts after it — the trade between frequency detail and time detail, and the two parameters most likely to change a result. These feature functions read `nFft` as samples of the buffer you pass. The analyzers that take audio at its own rate (beats, tempo, onsets, key, rhythm, chords, timbre) read it as samples at 22050 Hz and rescale it to the input rate, so the same `nFft` covers the same duration at 44100 Hz or 48000 Hz; `hopLength` stays in samples of the input. The feature set also covers CQT and its variants, tonnetz, spectral contrast, rolloff, flatness, bandwidth and flux, per-frame level and zero-crossing rate, and the inverse transforms that turn a spectrogram back into audio. The [JavaScript Features API](./js-api-features.md) is the full list.

## This page or the compatibility layer

libsonare exposes the same DSP twice. The music-analysis calls on this page are shaped around musical questions and return musical objects. The compatibility layer is shaped around librosa, the Python feature-extraction library: the same function names, the same argument names, the same array shapes.

Pick the compatibility layer when you are porting existing Python analysis code, reproducing a published pipeline, or matching numbers against results you already have. Pick the calls on this page when you are building something new — they hand you a chord list rather than a chroma matrix you still have to interpret. The two share one core, so mixing them in a single application is fine. See [librosa Compatibility](./librosa-compatibility.md) for the mapping and for the places the two deliberately differ.

## Related

- [Beats and Downbeats](./glossary/analysis/beats-downbeats.md) · [Tempo and BPM](./glossary/analysis/tempo-bpm.md) · [Meter and Grouping](./glossary/analysis/meter-and-grouping.md) — the rhythm concepts, with the estimator's assumptions spelled out
- [Key Detection](./glossary/analysis/key-detection.md) · [Chord Recognition](./glossary/analysis/chord-recognition.md) · [Chroma Features](./glossary/analysis/chroma-features.md) — how harmony is measured
- [Section and Structure](./glossary/analysis/section-structure.md) · [Melody and Pitch](./glossary/analysis/melody-pitch.md) · [Onset Detection](./glossary/analysis/onset-detection.md) — form, line, and attacks
- [Spectrogram and STFT](./glossary/analysis/spectrogram-stft.md) · [Mel, MFCC, and Timbre](./glossary/analysis/mel-mfcc-timbre.md) — the shared layer under all of it
- [JavaScript Analysis API](./js-api-analysis.md) · [JavaScript Features API](./js-api-features.md) — the field-by-field reference
- [librosa Compatibility](./librosa-compatibility.md) — the other way into the same core
- [Room Acoustics](./acoustic-analysis.md) — analysis of the recording space rather than the music
- [Getting Started](./getting-started.md) — installing and decoding your first file
