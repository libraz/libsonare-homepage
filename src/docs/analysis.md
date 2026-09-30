---
title: Music Analysis
description: Task guide to libsonare music information retrieval — the one-call analysis, beats and meter, key and chords, structure, melody, source separation, and which glossary page explains each result.
---

# Music Analysis

**Music analysis** is the part of libsonare that listens to a recording and reports what is in it: how fast it is, where the beats fall, what key and chords it uses, how it is laid out in sections, and what the melody does.

This page is the task layer. It tells you which call to make, what the result actually means, and where the fuller explanation lives. The [glossary](./glossary/analysis/beats-downbeats.md) explains the concepts; the [JavaScript Analysis API](./js-api-analysis.md) is the field-by-field reference. Use this page to decide.

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

```typescript
import { init, analyze } from '@libraz/libsonare';

await init();

// The browser decodes; libsonare analyzes.
const ctx = new AudioContext();
const response = await fetch('track.mp3');
const buffer = await ctx.decodeAudioData(await response.arrayBuffer());
const samples = buffer.getChannelData(0); // mono Float32Array

const result = analyze({ samples, sampleRate: buffer.sampleRate });

console.log(result.bpm, result.bpmConfidence);
console.log(result.key.name, result.key.confidence);
console.log(result.timeSignature.numerator, result.timeSignature.denominator);
console.log(result.beats.length, result.downbeatIndices.length);
console.log(result.chords.length, result.sections.length, result.form);
console.log(result.chords[0]?.name, result.chords[0]?.romanNumeral);
```

`sampleRate` defaults to 22050 Hz when omitted, so pass the buffer's real rate — a wrong rate rescales every time-domain result silently. The call is synchronous and the WASM build is single-threaded, so drive it from a Web Worker for anything longer than a short clip. `analyzeWithProgress(...)` accepts the same analysis options, reports `(progress, stage)`, and can cancel a long request.

::: warning `analyze()` searches triads only
The unified path sets `useTriadsOnly` to `true`, while the standalone `detectChords(...)` leaves it `false`. Until you pass `useTriadsOnly: false`, a seventh chord comes back as the triad inside it. Pass it explicitly when the extended qualities matter.
:::

## The chain every estimator sits on

Nothing here is a separate algorithm reading the file again. Decoded samples become one short-time spectrum per frame, that one matrix fans out into the feature layer, and each estimator reads a decision off the features it needs.

<AnalysisPipelineFigure
  title="From decoded samples to an answer"
  caption="The STFT is computed once and shared: mel feeds MFCC and the onset envelope, chroma feeds key, chords and section labelling, and the onset envelope feeds tempo and beat tracking. The lower rail is what never passes through it — level, zero-crossing rate and the pitch trackers read the waveform directly, which is why melody survives on material the spectral path finds hard."
/>

That layout explains a cost difference worth knowing. `analyze(...)` pays for the STFT once and hands the same matrices to every estimator. The single-answer helpers each rebuild the chain from the samples, so calling four of them costs roughly four analyses. Reach for a helper when you want one field or an option the unified call hides — not to save work.

## Choose the call

| What you want to know | The call | Where it is explained |
|-----------------------|----------|-----------------------|
| Everything, once | `analyze(...)` · `analyzeWithProgress(...)` | This page, plus [JavaScript Analysis API](./js-api-analysis.md) |
| How fast it is | `detectBpm(...)` · `analyzeBpm(...)` | [Tempo and BPM](./glossary/analysis/tempo-bpm.md) |
| Where the beats and bar lines fall | `detectBeats(...)` · `detectDownbeats(...)` | [Beats and Downbeats](./glossary/analysis/beats-downbeats.md) |
| Where every attack is | `detectOnsets(...)` · `onsetEnvelope(...)` | [Onset Detection](./glossary/analysis/onset-detection.md) |
| What the time signature is | `estimateMeter(...)` | [Meter and Grouping](./glossary/analysis/meter-and-grouping.md) |
| What key it is in | `detectKey(...)` · `detectKeyCandidates(...)` | [Key Detection](./glossary/analysis/key-detection.md) |
| What the chords are | `detectChords(...)` · `chordFunctionalAnalysis(...)` | [Chord Recognition](./glossary/analysis/chord-recognition.md) |
| How the song is laid out | `analyzeSections(...)` · `detectBoundaries(...)` | [Section and Structure](./glossary/analysis/section-structure.md) |
| What the melody does | `analyzeMelody(...)` · `pitchYin(...)` · `pitchPyin(...)` | [Melody and Pitch](./glossary/analysis/melody-pitch.md) |
| What it sounds like | `analyzeTimbre(...)` · `mfcc(...)` · `melSpectrogram(...)` | [Mel, MFCC, and Timbre](./glossary/analysis/mel-mfcc-timbre.md) |
| Harmony as a matrix over time | `chroma(...)` · `chromaCqt(...)` · `nnlsChroma(...)` | [Chroma Features](./glossary/analysis/chroma-features.md) |
| The raw time-frequency picture | `stft(...)` · `melSpectrogram(...)` | [Spectrogram and STFT](./glossary/analysis/spectrogram-stft.md) |
| How to split a mono or multichannel mix | `hpss(...)` · `decomposeStems(...)` · `decomposeStemsLinked(...)` | [Source separation](#source-separation), below |

`analyze(...)` includes the principal tempo, beat, meter, key, chord, section, melody, timbre, dynamics, and rhythm results. Feature matrices, low-level transforms, and stem separation use focused helpers. Use those helpers when you want tighter control — a narrower tempo range, a different key profile, a chord search that includes extended qualities — or when you only need one answer and the rest would be wasted work.

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
| `result.bpm` from `analyze(...)` | One number plus `bpmConfidence` and `bpmCandidates`, each candidate labelled `primary`, `half`, `double` or `other` | You already ran the full analysis. The candidate relations are how you catch a half-time or double-time read. |
| `detectBpm(...)` | One number | Tempo is all you want from the file. |
| `analyzeBpm(...)` | `bpm`, `confidence`, ranked `candidates`, plus the `autocorrelation` and `tempogram` behind them | You want to show the evidence, or to search a restricted range: `bpmMin` 30, `bpmMax` 300, `startBpm` 120 and `maxCandidates` 5 by default. |
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

Watch the ranking rather than the headline in that demo: four bars of a plain 4/4 groove give 4 most of the support and leave 6 a real share, because every other downbeat also opens a six-beat span. Switching the view to Beats shows the pulse the scoring ran on.

`grouping` is the other half of the answer. It reports how the bar divides into accent groups of two and three, so a seven comes back as `[3, 2, 2]` rather than as a bare seven, and it always sums to the numerator. A single entry means no internal division was resolved. It is also what distinguishes a compound bar from a simple one: per-beat accents cannot say how a beat subdivides, so a six accented in threes keeps the denominator you asked for and reports `[3, 3]`.

#### Two different fields are called `confidence`

This is the single easiest thing to get wrong here, and grabbing the wrong one produces a number that looks plausible and means something else.

| Field | What it is | Range and behaviour |
|-------|-----------|---------------------|
| `timeSignature.confidence` | **Margin-derived.** How far the winning candidate pulled ahead of the runner-up, measured in the score's own noise units and mapped onto a confidence. | Starts at 0.45 with no margin at all and rises from there, so a tie between two candidates still reports about 0.45 — it is a separation, not a probability. An unresolved compound-versus-simple reading subtracts a fixed penalty. |
| `candidates[k].confidence` | **A normalised share.** Each candidate's positive score divided by the total across all of them. | The entries read as a breakdown of the support and sum to 1. A candidate at 0.6 holds 60 % of the support — it is not a 60 % chance of being right. |

So a clear 3/4 can put nearly all of the support on 3 in `candidates[0].confidence` while `timeSignature.confidence` sits well below 1, and a genuinely ambiguous clip can show a high `timeSignature.confidence` if the runner-up happens to fall far behind. They answer different questions; pick the one that matches yours, label it accordingly in a UI, and never run both through one threshold. [Meter and Grouping](./glossary/analysis/meter-and-grouping.md#two-confidences-under-one-field-name) has the formulas behind each.

Two more ordering facts, both easy to trip over:

- `candidates` is a **ranking** — entry `k` is the k-th best hypothesis, with the selected signature placed first. `candidateScores` is **parallel to the numerators you requested**, in the order you gave them. The two do not index alike.
- `candidateScores` is standardised and signed: zero is the level a numerator reaches on beats carrying no meter, so a negative entry means less support than noise would produce. A score also grows with the square root of how many beats were scored, so scores from spans of different lengths are not comparable without normalising for length first.

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

That fallback is a plausible-looking 4/4, which is exactly why the flag exists: a short clip, a quiet intro, or beat tracking that found little to work with all arrive at the same answer, and only `searched` separates it from a measurement. Check it before you render anything.

<SonareDemo id="meter-estimate-three" />

The waltz above is the contrast worth having next to the 4/4 clip: nothing in the material supports a four- or six-beat bar, so 3 takes essentially all of the support and the others fall away. A confident estimate and a divided one look different, and the breakdown is what tells them apart.

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

`detectKeyCandidates(...)` returns the raw `correlation` per candidate instead, unnormalised — reach for it when you want to inspect the shape of the decision rather than a single belief.

| Option | Effect |
|--------|--------|
| `profile` | Which key profile to correlate against: `'ks'`/`'krumhansl'`, `'temperley'`, `'shaath'`, the three EDM profiles, or `'bellman-budge'`. Genres differ enough that this is the first knob to try when results look systematically off. |
| `modes` | `'major-minor'`, `'modal'`, `'all'`, or an explicit list. Widening the mode set widens the candidate pool the softmax normalises over, so confidences drop even when the top pick does not change. |
| `genreHint` | Selects a profile heuristically when you know the material but not the right profile. |
| `useHpss` · `loudnessWeighted` · `highPassHz` | Clean the chroma before correlating: drop the percussive layer, weight by perceived loudness, or roll off the low end. |

### Chords

```typescript
import { detectChords, chordFunctionalAnalysis } from '@libraz/libsonare';

const chordOptions = {
  useTriadsOnly: false,   // include the extended qualities
  useHmm: true,           // smooth the sequence instead of deciding per frame
  useKeyContext: true,
  keyRoot: key.root,
  keyMode: key.mode,
  chromaMethod: 'nnls',
} as const;

const { chords } = detectChords({ samples, sampleRate, ...chordOptions });

for (const chord of chords) {
  console.log(chord.name, chord.start.toFixed(2), chord.duration.toFixed(2), chord.confidence);
}

// The same options, so roman[i] labels chords[i].
const roman = chordFunctionalAnalysis({ samples, sampleRate, ...chordOptions });
```

Each `Chord` carries `root`, `bass`, `quality`, `start`, `end`, `duration`, `confidence` and a `name` the core spells canonically, so `rootName`, `bassName` and `name` read identically from every binding. Chords inside `analyze(...)` additionally carry `romanNumeral` relative to `result.key`; it is empty for `N.C.`.

Quality coverage goes well past triads and plain sevenths. Beyond `maj`, `m`, `dim`, `aug`, `7`, `maj7`, `m7`, `m7b5`, `dim7`, `sus2`, `sus4`, `sus2add4`, `add9`, `madd9`, `maj9` and `9`, the search also recognises **`6`**, **`m6`**, **`mM7`**, **`7sus4`**, **`11`**, **`13`**, **`7b9`** and **`7#9`**. A slash chord appends the bass, as in `C/E`. Below the correlation `threshold` the segment is reported as unknown rather than as a forced guess.

| Option | Effect |
|--------|--------|
| `useTriadsOnly` | `false` here, `true` inside `analyze(...)`. Leave it false to get the qualities above. |
| `useHmm` · `hmmBeamWidth` | Decode the progression as a sequence rather than per frame, which removes most single-frame flicker. |
| `useKeyContext` · `keyRoot` · `keyMode` | Bias the search toward chords that belong to a key you already detected. |
| `chromaMethod` | `'stft'` or `'nnls'`. The second suppresses harmonics of the bass before matching, which helps on dense material. |
| `detectInversions` | Report the bass note separately instead of folding it into the root. |
| `tuning` | Shift the chord chroma by a tuning offset in fractions of a semitone. Use the unit returned by `estimateTuning(...)`; the value must be in `[-0.5, 0.5)` and defaults to `0` (A440). The same option on `analyze(...)` shifts the chroma used for key, chords and sections. |
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

`analyzeSections(...)` returns labelled spans — intro, verse, chorus, bridge, instrumental, outro, or unknown. `detectBoundaries(...)` is the unlabelled layer underneath it: the transitions plus the continuous novelty curve they were picked from, which is what you need in order to apply your own threshold. It is not a coarser view of the section list, and you cannot derive one from the other.

Two behaviours to plan for. A pre-chorus label has no detection branch, so filtering sections for it always comes back empty. And `unknown` covers three different situations: no boundary was found, the span matched no positive branch, or the evidence was too weak to assert a function — the first reports `confidence` 0, the last keeps its sub-threshold score, so the number tells you which one you got.

`noveltyCurve` is scaled by its own maximum, so a peak of 1 means "the most novel frame in this track", not "a large change". Multiply by `noveltyPeak` to recover the raw response the absolute threshold is compared against.

### Melody and pitch

```typescript
import { analyzeMelody } from '@libraz/libsonare';

const melody = analyzeMelody({ samples, sampleRate, usePyin: true, fmin: 65, fmax: 2093 });

console.log(melody.meanFrequency, melody.pitchRangeOctaves, melody.vibratoRate);
const voiced = melody.points.filter((point) => point.frequency > 0);
```

Pitch tracking reads the waveform directly rather than the STFT, and it expects **monophonic** material — one note at a time. Run it on a solo vocal, a lead line, or a stem you separated first; on a full mix it tracks whatever dominates, frame by frame.

`points[].frequency` is `0` at unvoiced frames, so filter before averaging. `usePyin: true` selects the Viterbi-smoothed tracker, which costs more and jumps octaves far less than plain per-frame YIN — the usual choice for anything a user will see. The defaults span `fmin` 65 Hz to `fmax` 2093 Hz with a voicing `threshold` of 0.1; narrowing the range to the instrument you actually have is the cheapest accuracy win available here.

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

`nFft` sets how long one analysis window is and `hopLength` how far the next one starts after it — the trade between frequency detail and time detail, and the two parameters most likely to change a result. The feature set also covers CQT and its variants, tonnetz, spectral contrast, rolloff, flatness, bandwidth and flux, per-frame level and zero-crossing rate, and the inverse transforms that turn a spectrogram back into audio. The [JavaScript Features API](./js-api-features.md) is the full list.

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
